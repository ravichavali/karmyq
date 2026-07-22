#!/usr/bin/env bash
#
# Apply the full migration chain and, in --drift-check mode, prove schema convergence.
#
# WHY THIS EXISTS
# ---------------
# ADR-087 makes init.sql the generated product of the migration chain. This script is its drift
# guard: --drift-check takes a normalized schema-only dump before replay, applies every migration,
# takes the same normalized dump afterward, and fails on any difference. A migration that adds a
# genuinely new object is therefore visible even when PostgreSQL emits no ERROR line.
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
# ON_ERROR_STOP=0 alone is NOT enough for the 10 files that wrap themselves in their own explicit
# `BEGIN;...COMMIT;`: once ONE statement inside that block fails (even an expected, allowlisted
# collision with something init.sql already has), Postgres marks the WHOLE transaction aborted and
# every later statement in that same file — including genuinely new content init.sql lacks — silently
# no-ops with "current transaction is aborted" until the file's own COMMIT (confirmed live: this
# exact failure mode hit 001_request_community_junction.sql and 009_social_graph.sql in CI). So
# before applying, strip a file's own top-level BEGIN;/COMMIT; lines (apply_migration below) UNLESS
# the file self-manages its transaction (a real ROLLBACK statement or a psql `\if`/`\set` meta-command
# outside comments — e.g. 20260530-community-dedup.sql's dry-run-by-default repair script, which MUST
# keep its own transaction control intact). Stripping makes every statement autocommit independently,
# exactly like the 15 files that never had a wrapper — a colliding statement is skipped, everything
# else in the file still gets its own chance to apply.
#
# Because ON_ERROR_STOP=0 hides errors from psql's own exit code, this script inspects the captured
# output itself: any ERROR line matching the redundancy allowlist (already exists / does not exist /
# etc.) is expected drift-closing noise and is skipped; anything else is a genuinely unexpected
# failure and FAILS THE JOB (see FAILED below) — this is the real, general gate, not just log noise.
# The error inspection and sentinel assertions remain belt-and-suspenders checks. Running without
# --drift-check preserves the legacy converge-and-verify behavior for callers that intentionally
# start from an older snapshot; generated-seed CI must use --drift-check.
#
# After applying, this script also backfills `public.schema_migrations` (the same tracking table
# `scripts/apply-migrations.sh` uses in prod/demo) for every migration file, so the CI DB's tracking
# state converges with what a from-scratch `apply-migrations.sh` run would leave behind.
#
# Production/demo builds still use `scripts/apply-migrations.sh` (strict, tracked).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER="${TEST_PG_CONTAINER:-karmyq-postgres-test}"
PGUSER="${TEST_PG_USER:-karmyq_test}"
PGDB="${TEST_PG_DB:-karmyq_test}"
MIG_DIR="${MIG_DIR:-infrastructure/postgres/migrations}"
DRIFT_CHECK=0
DRIFT_TEMP_DIR=""

case "${1:-}" in
  "") ;;
  --drift-check) DRIFT_CHECK=1 ;;
  *) echo "Usage: $0 [--drift-check]" >&2; exit 2 ;;
esac
if [ "$#" -gt 1 ]; then
  echo "Usage: $0 [--drift-check]" >&2
  exit 2
fi

cleanup_drift_temp() {
  if [ -n "$DRIFT_TEMP_DIR" ] && [ -d "$DRIFT_TEMP_DIR" ]; then
    rm -rf -- "$DRIFT_TEMP_DIR"
  fi
}

if [ "$DRIFT_CHECK" -eq 1 ]; then
  # Keep normalization identical to the generator; otherwise formatting noise could masquerade as
  # drift or hide it behind two subtly different post-processors.
  # shellcheck source=scripts/regenerate-init-sql.sh
  source "$SCRIPT_DIR/regenerate-init-sql.sh"
  DRIFT_TEMP_DIR="$(mktemp -d)"
  trap cleanup_drift_temp EXIT
  dump_normalized_schema "$CONTAINER" "$PGUSER" "$PGDB" "$DRIFT_TEMP_DIR/before.sql"
fi

pg() { docker exec -i "$CONTAINER" psql -U "$PGUSER" -d "$PGDB" "$@"; }

# Feed a migration file to psql. If it wraps itself in a plain BEGIN;/COMMIT; (no ROLLBACK, no psql
# `\if`/`\set` meta-command outside comments), strip those two lines so statements autocommit
# independently instead of a single collision poisoning the whole file's transaction. Otherwise the
# file manages its own transaction control deliberately — apply it verbatim.
apply_migration() {
  local f="$1" exec_lines
  exec_lines="$(grep -v '^\s*--' "$f")"
  # Always drop \connect lines first: one migration (001-add-polymorphic-requests.sql) opens with
  # `\c karmyq_prod;`, and in NON-interactive psql a failed \connect terminates the whole session —
  # every later statement in the file silently never applies, and the FATAL "database ... does not
  # exist" text matches the redundancy allowlist below, so nothing flags it. CI is already connected
  # to the right DB; a \connect is never needed here. (`\b` keeps `\copy` etc. unaffected.)
  # NOTE: a literal backslash in these ERE patterns must be written as [\\] — GNU grep silently
  # fails to match `\\c` / `\\(` here (verified empirically; the `\\(if|set)` form never matched).
  local strip_connect='^\s*[\\]c(onnect)?\b'
  if printf '%s\n' "$exec_lines" | grep -qiE '^\s*BEGIN\s*;\s*(--.*)?$' \
     && ! printf '%s\n' "$exec_lines" | grep -qiE '\bROLLBACK\b|^\s*[\\](if|set)\b'; then
    grep -vE "$strip_connect" "$f" | grep -viE '^\s*(BEGIN|COMMIT)\s*;\s*(--.*)?$' | pg -v ON_ERROR_STOP=0 -q 2>&1 || true
  else
    grep -vE "$strip_connect" "$f" | pg -v ON_ERROR_STOP=0 -q 2>&1 || true
  fi
}

# Same DDL as scripts/apply-migrations.sh's tracking table — keep the two in sync.
pg -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    migration_name VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
SQL

FAILED=0
APPLIED_VALUES=""
echo "== Applying full migrated schema to ${CONTAINER}/${PGDB} =="
for f in "${MIG_DIR}"/*.sql; do
  [ -e "$f" ] || { echo "FAILED: no migration files found in ${MIG_DIR}" >&2; exit 1; }
  name="$(basename "$f")"
  # ON_ERROR_STOP=0: redundant objects already in init.sql collide-and-skip; missing ones apply.
  out="$(apply_migration "$f")"
  # Anything NOT matching expected redundancy noise is a genuinely unexpected failure — fail the
  # job. Deliberately NOT allowlisted: bare "violates" — benign re-run dup-key noise already reads
  # "duplicate key value violates unique constraint" (caught by 'duplicate'), so any other
  # constraint violation (FK/CHECK/NOT NULL in a data backfill) is a real failure that would
  # otherwise be silently skipped here and then hard-fail live in apply-migrations.sh.
  real="$(printf '%s\n' "$out" \
    | grep -iE 'ERROR' \
    | grep -viE 'already exists|does not exist|duplicate|multiple primary keys|cannot (drop|alter)|is not a|no partition' \
    || true)"
  if [ -n "$real" ]; then
    echo "  ! ${name}: unexpected error — will fail this job:"
    printf '    %s\n' "$real"
    FAILED=1
    continue
  fi
  # Queue the tracking row only for a file that applied cleanly or was confirmed redundant, so
  # schema_migrations converges with what a from-scratch apply-migrations.sh run would leave behind
  # (a real apply-migrations.sh run never records a tracking row for a migration whose content
  # errored — the INSERT is inside the same failed transaction).
  name_sql="${name//\'/\'\'}"
  APPLIED_VALUES="${APPLIED_VALUES}${APPLIED_VALUES:+,}('${name_sql}')"
done

# One batched backfill instead of a docker-exec round-trip per file. Runs BEFORE the fail-exit so
# a failed run still records its cleanly-applied files, matching apply-migrations.sh's
# record-each-success-as-you-go semantics for anyone inspecting the failed CI DB.
if [ -n "$APPLIED_VALUES" ]; then
  pg -v ON_ERROR_STOP=1 -q -c \
    "INSERT INTO public.schema_migrations (migration_name) VALUES ${APPLIED_VALUES} ON CONFLICT DO NOTHING;" \
    >/dev/null
fi

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
# BUG-030: decay-derived path scores are fractional and must remain lossless in cache.
assert "auth.social_distances.path_trust_score double precision" \
  "SELECT (data_type = 'double precision') FROM information_schema.columns WHERE table_schema='auth' AND table_name='social_distances' AND column_name='path_trust_score'"
# A whole migration init.sql never had (001_federation_schema) — proves fully-missing chains apply.
assert "federation.instances table" \
  "SELECT (to_regclass('federation.instances') IS NOT NULL)"
# designed-to-forget (20260607) retention config.
assert "requests.retention_config table" \
  "SELECT (to_regclass('requests.retention_config') IS NOT NULL)"
# 001-add-polymorphic-requests applied past its (stripped) \connect line: it sets DEFAULT true,
# while the later 006_social_karma_v2 would set DEFAULT false — the default value proves WHICH
# migration created the column, i.e. that the \connect-bearing file really ran.
assert "help_requests.is_public default true (001-add-polymorphic applied)" \
  "SELECT (column_default = 'true') FROM information_schema.columns WHERE table_schema='requests' AND table_name='help_requests' AND column_name='is_public'"

if [ "$DRIFT_CHECK" -eq 1 ]; then
  echo "== Comparing schema before and after migration replay =="
  dump_normalized_schema "$CONTAINER" "$PGUSER" "$PGDB" "$DRIFT_TEMP_DIR/after.sql"
  if ! diff -u "$DRIFT_TEMP_DIR/before.sql" "$DRIFT_TEMP_DIR/after.sql" >"$DRIFT_TEMP_DIR/schema.diff"; then
    cat "$DRIFT_TEMP_DIR/schema.diff"
    echo "FAILED: init.sql schema drifted from the migration chain." >&2
    exit 1
  fi
  echo "Schema drift check passed: no changes after migration replay."
fi

echo "== Full migrated schema applied and verified =="
