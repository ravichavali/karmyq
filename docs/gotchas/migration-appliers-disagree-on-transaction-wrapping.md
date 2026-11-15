# Migration appliers disagree on transaction wrapping

Two scripts apply the same migration files with opposite transaction behavior. A migration has to
be correct under both.

**Deploy** (`scripts/apply-migrations.sh`, step 6 of `scripts/deploy.sh`) feeds each pending file to
psql as `BEGIN; <file>; INSERT INTO public.schema_migrations …; COMMIT;` with `ON_ERROR_STOP=1`.
The whole file and its ledger row commit or roll back together.

**CI's drift check and init.sql regeneration** (`scripts/ci-apply-full-schema.sh`, which
`scripts/regenerate-init-sql.sh` also calls) replay every migration on top of the generated
`init.sql` with `ON_ERROR_STOP=0`. If a file has a plain top-level `BEGIN;`/`COMMIT;` (and no
`ROLLBACK` or psql `\if`/`\set`), the script **strips those lines**, so each statement autocommits
on its own (a file with no wrapper already runs that way). Any error outside the redundancy allowlist (`already exists`, `does not exist`,
`duplicate`, …) fails the job.

## What breaks

- A top-level `LOCK TABLE` in autocommit raises "LOCK TABLE can only be used in transaction
  blocks". That text is not allowlisted, so the CI schema step and init.sql regen fail.
- A migration that relies on several statements being atomic (lock, then backfill, then install
  triggers) gets no atomicity in CI.
- A file's own `COMMIT;` under the deploy wrapper ends the wrapper's transaction early, so the
  ledger insert runs outside it. An integration test that runs the migration text inside its
  own `BEGIN … ROLLBACK` gets committed too.

## What to do instead

Put no `BEGIN`/`COMMIT` in the file. Put the statements that must be atomic, locks included, in one
`DO $migration$ … $migration$;` block. A single statement is atomic in CI's autocommit replay, and
under deploy it holds its locks until the wrapper's `COMMIT`. Make it rerunnable: CI replays it over
an `init.sql` that already contains its objects, and the normalized schema dump must not change.

## Evidence

Sprint 142 (`infrastructure/postgres/migrations/20261112-governance-quorum.sql`) needed table locks
to fence old writers during a deploy. Plan review found that a top-level `LOCK TABLE` would have
failed CI. The single `DO` block passed `scripts/apply-migrations.sh` (exactly one migration applied) and
`scripts/ci-apply-full-schema.sh --drift-check` (zero drift) on isolated databases, then PR #338's CI
"Regenerate and verify init.sql" and "Integration Tests" jobs.
