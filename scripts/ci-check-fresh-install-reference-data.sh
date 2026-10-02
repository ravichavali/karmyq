#!/usr/bin/env bash
# TEMPORARY negative-proof checkpoint: omit Driving from expectation; restore before readiness.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONTAINER="${TEST_PG_CONTAINER:-karmyq-postgres-test}"
PG_USER="${TEST_PG_USER:-karmyq_test}"
PG_DB="${TEST_PG_DB:-karmyq_test}"
MIGRATION="$PROJECT_DIR/infrastructure/postgres/migrations/20260930-skill-vocabulary.sql"
CHECK_DIR="$(mktemp -d)"
trap 'rm -rf -- "$CHECK_DIR"' EXIT

pg() { docker exec -i "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U "$PG_USER" -d "$PG_DB" -tA "$@"; }

# Parse the VALUES from the real migration; PostgreSQL interprets the SQL literals.
# Both sides use identical serialization and sort synonyms before comparison.
node - "$MIGRATION" > "$CHECK_DIR/expected.sql" <<'JS'
const fs = require('fs');
const source = fs.readFileSync(process.argv[2], 'utf8');
const inserts = [...source.matchAll(/INSERT\s+INTO\s+auth\.skill_vocabulary\s*\(\s*slug\s*,\s*label\s*,\s*synonyms\s*\)\s*VALUES\s*([\s\S]*?)\s*ON\s+CONFLICT\s*\(\s*slug\s*\)\s*DO\s+NOTHING\s*;/gi)];
if (inserts.length !== 1 || !inserts[0][1].trim()) {
  throw new Error('Expected exactly one nonempty vocabulary INSERT in the migration');
}
process.stdout.write(
  'WITH expected(slug, label, synonyms) AS (VALUES ' + inserts[0][1] + ')\n' +
  "SELECT slug || '|' || label || '|' || to_json(ARRAY(SELECT s FROM unnest(synonyms) s ORDER BY s))::text FROM expected WHERE slug <> 'driving' ORDER BY slug;\n"
);
JS
pg < "$CHECK_DIR/expected.sql" > "$CHECK_DIR/expected"
test -s "$CHECK_DIR/expected"
pg > "$CHECK_DIR/actual" <<'SQL'
SELECT slug || '|' || label || '|' ||
       to_json(ARRAY(SELECT s FROM unnest(synonyms) s ORDER BY s))::text
FROM auth.skill_vocabulary ORDER BY slug;
SQL
if ! diff -u "$CHECK_DIR/expected" "$CHECK_DIR/actual"; then
  echo "ERROR: fresh-install skill vocabulary differs from the migration" >&2
  exit 1
fi
ledger="$(pg -c "SELECT count(*) FROM public.schema_migrations WHERE migration_name = '20260930-skill-vocabulary.sql'")"
if [ "$ledger" != "1" ]; then
  echo "ERROR: fresh-install migration ledger is missing 20260930-skill-vocabulary.sql" >&2
  exit 1
fi
echo "Fresh-install skill vocabulary and migration ledger match."
