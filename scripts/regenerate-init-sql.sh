#!/usr/bin/env bash
# Regenerate infrastructure/postgres/init.sql from the complete migration chain.
#
# The generated schema is portable: it carries neither object ownership nor ACLs. PostgreSQL's
# docker-entrypoint runs it as POSTGRES_USER, which therefore owns the objects. Curated data is
# maintained separately in infrastructure/postgres/seed-data.sql and spliced into the artifact.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DEFAULT_INIT_SQL="$PROJECT_DIR/infrastructure/postgres/init.sql"
DEFAULT_SEED_SQL="$PROJECT_DIR/infrastructure/postgres/seed-data.sql"
DEFAULT_MIGRATIONS_DIR="$PROJECT_DIR/infrastructure/postgres/migrations"
DEFAULT_OUTPUT_SQL="$PROJECT_DIR/infrastructure/postgres/init.sql.generated"
REGEN_TEMP_DIR=""

cleanup_temp_dir() {
  if [ -n "$REGEN_TEMP_DIR" ] && [ -d "$REGEN_TEMP_DIR" ]; then
    rm -rf -- "$REGEN_TEMP_DIR"
  fi
}

normalize_schema_dump() {
  # PostgreSQL 15 emits stable object ordering. Remove version/session noise and trailing spaces so
  # regeneration and drift checks compare the schema itself rather than pg_dump metadata.
  awk '
    /^-- Dumped from database version / { next }
    /^-- Dumped by pg_dump version / { next }
    /^\\restrict / { next }
    /^\\unrestrict / { next }
    { sub(/[[:space:]]+$/, "") }
    /^[[:space:]]*$/ {
      if (blank) next
      blank = 1
      print ""
      next
    }
    { blank = 0; print }
  '
}

dump_normalized_schema() {
  local container="$1" pg_user="$2" pg_db="$3" output="$4"
  docker exec "$container" pg_dump \
    -U "$pg_user" \
    -d "$pg_db" \
    --schema-only \
    --no-owner \
    --no-privileges \
    | normalize_schema_dump >"$output"
}

reset_scratch_database() {
  local container="$1" pg_user="$2" pg_db="$3" escaped_db escaped_user

  # Identifiers cannot be passed as psql values. Quote them as SQL identifiers after doubling the
  # only character with meaning inside a quoted identifier. Environment inputs never become shell
  # code and are passed to docker as single arguments.
  escaped_db="${pg_db//\"/\"\"}"
  escaped_user="${pg_user//\"/\"\"}"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U "$pg_user" -d postgres <<SQL
DROP DATABASE IF EXISTS "$escaped_db" WITH (FORCE);
CREATE DATABASE "$escaped_db" OWNER "$escaped_user";
SQL
}

migration_names() {
  local migrations_dir="$1"
  find "$migrations_dir" -maxdepth 1 -type f -name '*.sql' -print \
    | LC_ALL=C sort \
    | while IFS= read -r migration; do basename "$migration"; done
}

append_migration_backfill() {
  local output="$1" migrations_dir="$2" name escaped_name

  {
    printf '\n-- =============================================================================\n'
    printf '%s\n' '-- MIGRATION LEDGER — GENERATED FROM SORTED migrations/*.sql'
    printf '%s\n' '-- ============================================================================='
    printf 'INSERT INTO public.schema_migrations (migration_name) VALUES\n'

    local first=1
    while IFS= read -r name; do
      escaped_name="${name//\'/\'\'}"
      if [ "$first" -eq 0 ]; then
        printf ',\n'
      fi
      printf "  ('%s')" "$escaped_name"
      first=0
    done < <(migration_names "$migrations_dir")

    if [ "$first" -eq 1 ]; then
      echo "ERROR: no migration SQL files found in $migrations_dir" >&2
      return 1
    fi
    printf '\nON CONFLICT (migration_name) DO NOTHING;\n'
  } >>"$output"
}

main() {
  local container="${REGEN_PG_CONTAINER:-}"
  local pg_user="${REGEN_PG_USER:-karmyq_test}"
  local pg_db="${REGEN_PG_DB:-karmyq_regen}"
  local source_init="${SOURCE_INIT_SQL:-$DEFAULT_INIT_SQL}"
  local seed_sql="${SEED_DATA_SQL:-$DEFAULT_SEED_SQL}"
  local migrations_dir="${MIG_DIR:-$DEFAULT_MIGRATIONS_DIR}"
  local output="${OUTPUT_INIT_SQL:-$DEFAULT_OUTPUT_SQL}"
  local temp_dir schema_dump candidate

  if [ -z "$container" ]; then
    echo "ERROR: REGEN_PG_CONTAINER must name a dedicated PostgreSQL 15 container" >&2
    return 1
  fi
  case "$pg_db" in
    postgres|template0|template1)
      echo "ERROR: REGEN_PG_DB must be a disposable non-system database" >&2
      return 1
      ;;
  esac
  for required in "$source_init" "$seed_sql" "$SCRIPT_DIR/ci-apply-full-schema.sh"; do
    if [ ! -f "$required" ]; then
      echo "ERROR: required file not found: $required" >&2
      return 1
    fi
  done
  if [ ! -d "$migrations_dir" ]; then
    echo "ERROR: migrations directory not found: $migrations_dir" >&2
    return 1
  fi
  if ! docker inspect "$container" >/dev/null 2>&1; then
    echo "ERROR: PostgreSQL container not found: $container" >&2
    return 1
  fi

  temp_dir="$(mktemp -d)"
  REGEN_TEMP_DIR="$temp_dir"
  trap cleanup_temp_dir EXIT
  schema_dump="$temp_dir/schema.sql"
  candidate="$temp_dir/init.sql"

  echo "== Resetting scratch database ${container}/${pg_db} =="
  reset_scratch_database "$container" "$pg_user" "$pg_db"

  echo "== Loading current init.sql =="
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U "$pg_user" -d "$pg_db" \
    <"$source_init" >/dev/null

  echo "== Applying complete migration chain =="
  TEST_PG_CONTAINER="$container" \
  TEST_PG_USER="$pg_user" \
  TEST_PG_DB="$pg_db" \
  MIG_DIR="$migrations_dir" \
    "$SCRIPT_DIR/ci-apply-full-schema.sh"

  echo "== Dumping normalized migrated schema =="
  dump_normalized_schema "$container" "$pg_user" "$pg_db" "$schema_dump"

  {
    printf '%s\n' '-- ============================================================================='
    printf '%s\n' '-- GENERATED SCHEMA — DO NOT EDIT BY HAND'
    printf '%s\n' '-- Source: scripts/regenerate-init-sql.sh + infrastructure/postgres/migrations/*.sql'
    printf '%s\n\n' '-- ============================================================================='
    cat "$schema_dump"
    printf '\n-- =============================================================================\n'
    printf '%s\n' '-- CURATED SEED DATA — MAINTAIN infrastructure/postgres/seed-data.sql'
    printf '%s\n' '-- ============================================================================='
    cat "$seed_sql"
  } >"$candidate"
  append_migration_backfill "$candidate" "$migrations_dir"

  mkdir -p "$(dirname "$output")"
  if [ -f "$output" ] && cmp -s "$candidate" "$output"; then
    echo "== Regenerated init.sql is byte-identical: $output =="
    return 0
  fi
  cp "$candidate" "$output"
  echo "== Wrote regenerated init.sql: $output =="
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
