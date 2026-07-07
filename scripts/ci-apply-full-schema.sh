#!/usr/bin/env bash
#
# Bring the CI integration test DB up to the FULL migrated schema.
#
# WHY THIS EXISTS
# ---------------
# The CI integration DB is seeded from the consolidated `infrastructure/postgres/init.sql`, a
# fresh-install snapshot that has DRIFTED behind the migration chain. init.sql is missing whole
# migrations (federation, governance, ui_schemas, provider-collectives) AND recent constraint /
# column migrations (e.g. `chk_help_requests_status` from 20260603, `social_graph.trust_decay_config`
# + `trust_edges.stability` from 20260526). Because init.sql lags, DB CHECK-constraint and
# column-shape gaps were invisible to CI and only surfaced against the live demo — Sprint 117's
# reset took five live attempts for exactly this reason.
#
# KNOWN LIMITATION — this is a CI-only convergence workaround, not the root-cause fix. init.sql
# itself remains stale after this script runs; a fresh local `docker-compose up` still gets the
# drifted schema, and every migration that adds something CI needs to catch requires a maintainer to
# notice and (optionally) add another sentinel assertion below. The actual fix-forward move is
# regenerating init.sql from a fully-migrated schema (e.g. `pg_dump --schema-only` against a DB that
# has had `scripts/apply-migrations.sh` run against it) so there is only ONE seed path everywhere.
# That is a separate, higher-risk task (dump artifacts, RLS/ownership statements, hand-written
# comments in init.sql to reconcile) — tracked as a follow-up, deliberately not attempted here.
#
# We cannot naively replay the whole chain on top of init.sql: the two overlap, and unguarded
# statements collide (e.g. migration 009's `CREATE TYPE request_type_enum`, which init.sql already
# has). So we apply every migration in its OWN psql invocation with `ON_ERROR_STOP=0`. This is a
# CORRECTNESS REQUIREMENT, not a convenience: 15 of the 64 migration files create multiple objects
# in a single file with no explicit BEGIN/COMMIT of their own (each statement autocommits
# independently). `ON_ERROR_STOP=1` would abort the whole file on the FIRST collision and silently
# drop every later, genuinely-new statement in that same file. `ON_ERROR_STOP=0` lets psql skip only
# the colliding statement and keep applying the rest of the file.
#
# Because ON_ERROR_STOP=0 hides errors from psql's own exit code, this script inspects the captured
# output itself: any ERROR line matching the redundancy allowlist (already exists / does not exist /
# etc.) is expected drift-closing noise and is skipped; anything else is a genuinely unexpected
# failure and FAILS THE JOB (see FAILED below) — this is the real, general gate, not just log noise.
# The sentinel assertions at the end are an additional, narrower belt-and-suspenders check for the
# specific objects Sprint 117's reset needs.
#
# After applying, this script also backfills `public.schema_migrations` (the same tracking table
# `scripts/apply-migrations.sh` uses in prod/demo) for every migration file, so the CI DB's tracking
# state converges with what a from-scratch `apply-migrations.sh` run would leave behind.
#
# This is CI-only. Production/demo builds still use `scripts/apply-migrations.sh` (strict, tracked).
#
set -euo pipefail

CONTAINER="${TEST_PG_CONTAINER:-karmyq-postgres-test}"
PGUSER="${TEST_PG_USER:-karmyq_test}"
PGDB="${TEST_PG_DB:-karmyq_test}"
MIG_DIR="${MIG_DIR:-infrastructure/postgres/migrations}"

pg() { docker exec -i "$CONTAINER" psql -U "$PGUSER" -d "$PGDB" "$@"; }

pg -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    migration_name VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
SQL

FAILED=0
echo "== Applying full migrated schema to ${CONTAINER}/${PGDB} =="
for f in $(ls "${MIG_DIR}"/*.sql | sort); do
  name="$(basename "$f")"
  # ON_ERROR_STOP=0: redundant objects already in init.sql collide-and-skip; missing ones apply.
  out="$(pg -v ON_ERROR_STOP=0 -q < "$f" 2>&1 || true)"
  # Anything NOT matching expected redundancy noise is a genuinely unexpected failure — fail the job.
  real="$(printf '%s\n' "$out" \
    | grep -iE 'ERROR' \
    | grep -viE 'already exists|does not exist|duplicate|multiple primary keys|cannot (drop|alter)|is not a|violates|no partition' \
    || true)"
  if [ -n "$real" ]; then
    echo "  ! ${name}: unexpected error — will fail this job:"
    printf '    %s\n' "$real"
    FAILED=1
    continue
  fi
  # Backfill the tracking row only for a file that applied cleanly or was confirmed redundant, so
  # schema_migrations converges with what a from-scratch apply-migrations.sh run would leave behind
  # (a real apply-migrations.sh run never records a tracking row for a migration whose content
  # errored — the INSERT is inside the same failed transaction).
  name_sql="${name//\'/\'\'}"
  pg -v ON_ERROR_STOP=1 -q -c \
    "INSERT INTO public.schema_migrations (migration_name) VALUES ('${name_sql}') ON CONFLICT DO NOTHING;" \
    >/dev/null
done

if [ "$FAILED" -ne 0 ]; then
  echo "FAILED: one or more migrations produced an unexpected error (see above)." >&2
  exit 1
fi

echo "== Verifying sentinel objects landed =="
assert() {
  local desc="$1" sql="$2" got
  got="$(pg -tAc "$sql" | tr -d '[:space:]' || true)"
  if [ "$got" != "t" ]; then
    echo "  MISSING: ${desc}  (query returned '${got}')"
    echo "FAILED: the full migrated schema did not fully materialize in the CI test DB." >&2
    exit 1
  fi
  echo "  ok: ${desc}"
}

# help_requests status lifecycle CHECK (20260603) — the constraint that rejected the reset live.
assert "chk_help_requests_status constraint" \
  "SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='chk_help_requests_status')"
# interaction half-life (20260526) — table + column the reset writes.
assert "social_graph.trust_decay_config table" \
  "SELECT (to_regclass('social_graph.trust_decay_config') IS NOT NULL)"
assert "social_graph.trust_edges.stability column" \
  "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='social_graph' AND table_name='trust_edges' AND column_name='stability')"
assert "social_graph.trust_edges_live view" \
  "SELECT (to_regclass('social_graph.trust_edges_live') IS NOT NULL)"
# A whole migration init.sql never had (001_federation_schema) — proves fully-missing chains apply.
assert "federation.instances table" \
  "SELECT (to_regclass('federation.instances') IS NOT NULL)"
# designed-to-forget (20260607) retention config.
assert "requests.retention_config table" \
  "SELECT (to_regclass('requests.retention_config') IS NOT NULL)"

echo "== Full migrated schema applied and verified =="
