-- Sprint 117: this raw SQL truncate is intentionally disabled.
--
-- Running raw TRUNCATE against the database cannot guarantee the safety controls the demo reset
-- requires: an explicit demo fingerprint, a verified restorable backup, an advisory lock, paused
-- mutation jobs, a single transaction, and a complete (drift-checked) table classification. The
-- old version also disabled constraint enforcement during the wipe and truncated a stale,
-- incomplete table list — both unsafe.
--
-- This file now refuses to run and points to the one supported path.

\echo ''
\echo '❌ REFUSING: scripts/truncate-database.sql is disabled (Sprint 117).'
\echo '   Use the guarded, dry-run-by-default demo reset instead:'
\echo ''
\echo '     npm --workspace @karmyq/simulation-service run reset:demo            # dry-run plan'
\echo '     npm --workspace @karmyq/simulation-service run reset:demo -- --apply # guarded reset'
\echo ''
\echo '   Read-only health check:'
\echo '     npm --workspace @karmyq/simulation-service run verify:demo'
\echo ''

\quit
