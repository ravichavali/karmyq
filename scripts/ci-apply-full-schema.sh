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
# We cannot naively replay the whole chain on top of init.sql: the two overlap, and unguarded
# statements collide (e.g. migration 009's `CREATE TYPE request_type_enum`, which init.sql already
# has). So we apply every migration in its OWN psql invocation with `ON_ERROR_STOP=0`:
#   * a migration whose objects are already in init.sql aborts on the first collision and skips —
#     it is fully redundant, so skipping is correct;
#   * a migration missing from init.sql commits fully;
#   * idempotent migrations (`IF NOT EXISTS`, `DROP ... IF EXISTS`) apply as no-ops or new objects.
# Files stay independent (one psql process each), so an aborted transaction never poisons the next.
#
# `ON_ERROR_STOP=0` HIDES errors, so the apply loop alone cannot prove the schema is complete. The
# ASSERTIONS at the end are the real gate: they fail the job if the sentinel objects the reset needs
# did not materialize, and they catch future drift if init.sql or the chain changes shape.
#
# This is CI-only. Production/demo builds still use `scripts/apply-migrations.sh` (strict, tracked).
#
set -euo pipefail

CONTAINER="${TEST_PG_CONTAINER:-karmyq-postgres-test}"
PGUSER="${TEST_PG_USER:-karmyq_test}"
PGDB="${TEST_PG_DB:-karmyq_test}"
MIG_DIR="${MIG_DIR:-infrastructure/postgres/migrations}"

pg() { docker exec -i "$CONTAINER" psql -U "$PGUSER" -d "$PGDB" "$@"; }

echo "== Applying full migrated schema to ${CONTAINER}/${PGDB} =="
for f in $(ls "${MIG_DIR}"/*.sql | sort); do
  name="$(basename "$f")"
  # ON_ERROR_STOP=0: redundant objects already in init.sql collide-and-skip; missing ones apply.
  out="$(pg -v ON_ERROR_STOP=0 -q < "$f" 2>&1 || true)"
  # Surface only errors that are NOT the expected redundancy noise, so a genuinely broken migration
  # is still visible in the log (it does not fail the job — the assertions below are the gate).
  real="$(printf '%s\n' "$out" \
    | grep -iE 'ERROR' \
    | grep -viE 'already exists|does not exist|duplicate|multiple primary keys|cannot (drop|alter)|is not a|violates|no partition' \
    || true)"
  if [ -n "$real" ]; then
    echo "  ! ${name}: unexpected output:"
    printf '    %s\n' "$real"
  fi
done

echo "== Verifying sentinel objects landed =="
assert() {
  local desc="$1" sql="$2" got
  got="$(pg -tAc "$sql" | tr -d '[:space:]')"
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
# A whole migration init.sql never had (001_federation_schema) — proves fully-missing chains apply.
assert "federation.instances table" \
  "SELECT (to_regclass('federation.instances') IS NOT NULL)"
# designed-to-forget (20260607) retention config.
assert "requests.retention_config table" \
  "SELECT (to_regclass('requests.retention_config') IS NOT NULL)"

echo "== Full migrated schema applied and verified =="
