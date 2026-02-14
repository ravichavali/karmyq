#!/bin/bash
# =============================================================================
# Apply pending database migrations
# =============================================================================
#
# Usage: ./scripts/apply-migrations.sh
#
# Applies all SQL migration files in infrastructure/postgres/migrations/
# that haven't been applied yet. Uses a tracking table to know which
# migrations have already been applied.
#
# Environment:
#   DATABASE_URL - PostgreSQL connection string (required)
#   POSTGRES_CONTAINER - Docker container name (default: karmyq-postgres)
#
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$PROJECT_DIR/infrastructure/postgres/migrations"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-karmyq-postgres}"

# Determine how to run psql
run_psql() {
  if [ -n "$DATABASE_URL" ]; then
    # Direct connection via DATABASE_URL
    psql "$DATABASE_URL" "$@"
  else
    # Via docker exec
    docker exec -i "$POSTGRES_CONTAINER" psql -U "${POSTGRES_USER:-karmyq_user}" -d "${POSTGRES_DB:-karmyq_db}" "$@"
  fi
}

echo ""
echo "=== Database Migration Runner ==="
echo ""

# Step 1: Create migrations tracking table if it doesn't exist
echo -e "${GREEN}[INFO]${NC} Ensuring migration tracking table exists..."
run_psql <<'SQL'
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    migration_name VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
SQL

# Step 2: Get list of already-applied migrations
APPLIED=$(run_psql -t -A -c "SELECT migration_name FROM public.schema_migrations ORDER BY migration_name" 2>/dev/null || echo "")

# Step 3: Find and apply pending migrations (sorted by filename)
PENDING=0
APPLIED_COUNT=0
FAILED=0

for migration_file in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  migration_name=$(basename "$migration_file")

  # Skip non-migration files
  if [[ "$migration_name" == "MIGRATION_STRATEGY.md" ]] || [[ "$migration_name" == "README.md" ]]; then
    continue
  fi

  # Check if already applied
  if echo "$APPLIED" | grep -q "^${migration_name}$"; then
    continue
  fi

  PENDING=$((PENDING + 1))
  echo -e "${YELLOW}[APPLYING]${NC} $migration_name ..."

  # Apply migration inside a transaction
  if run_psql <<EOSQL
BEGIN;
$(cat "$migration_file")
INSERT INTO public.schema_migrations (migration_name) VALUES ('$migration_name');
COMMIT;
EOSQL
  then
    echo -e "${GREEN}[OK]${NC} $migration_name applied successfully"
    APPLIED_COUNT=$((APPLIED_COUNT + 1))
  else
    echo -e "${RED}[FAIL]${NC} $migration_name failed!"
    FAILED=$((FAILED + 1))
    # Don't continue on failure - migration order matters
    echo -e "${RED}[ERROR]${NC} Stopping migration runner due to failure"
    exit 1
  fi
done

# Summary
echo ""
if [ $PENDING -eq 0 ]; then
  echo -e "${GREEN}[INFO]${NC} All migrations already applied. Database is up to date."
elif [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}[INFO]${NC} Applied $APPLIED_COUNT migration(s) successfully."
else
  echo -e "${RED}[ERROR]${NC} $FAILED migration(s) failed out of $PENDING pending."
  exit 1
fi
