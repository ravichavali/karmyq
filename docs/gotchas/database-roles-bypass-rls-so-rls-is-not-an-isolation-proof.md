# Database roles bypass RLS, so RLS is not an isolation proof

Row-level security is enabled on many tables (for example `communities.members`), but the roles that
CI and the default service configuration connect as are **superusers**. Superusers bypass RLS
entirely. A test asserting that RLS hides another community's rows therefore cannot fail in CI.

## Where

- **CI**: integration tests connect as `karmyq_test`, the `POSTGRES_USER` of
  `tests/docker-compose.test.yml`. The official postgres image creates that user as a superuser.
  PR #338's CI integration log (run 43513192874, 2026-11-13) printed
  `{ current_user: 'karmyq_test', rolsuper: true, rolbypassrls: true }`.
- **Services by default**: `.env.example` connects as `karmyq_user`, the `POSTGRES_USER` of
  `infrastructure/docker/docker-compose.yml`, which is also the image's superuser. The live demo's
  `DATABASE_URL` is supplied by the environment, so its role's flags are **UNVERIFIED**. Measure
  them; don't infer them.
- **Context setting**: `dbContextMiddleware` (`packages/shared/middleware/dbContext.ts`) calls
  `set_config(..., true)` through a separate `pool.query`. A transaction-local setting does not
  reach the route's later queries on other pooled connections, so even a role subject to RLS would
  see no context there.

## What to do instead

- Isolate in SQL: every read and write carries an explicit `community_id = $path` (or equivalent)
  predicate. Test that predicate with a real second community, e.g. a nomination from community B
  addressed under community A's path returns 404 and writes nothing.
- When a transaction needs DB context, set it on the checked-out client inside that transaction.
- Record the connected role's `rolsuper`/`rolbypassrls` in integration evidence
  (`SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`).
- CLAUDE.md → *Database* says a query that skips `setDbContext` "sees nothing rather than
  erroring". That holds only for a role RLS actually applies to; it is not what these roles do.

## Evidence

Sprint 142 (PR #338). The original governance routes read `communities.members` through bare
`pool.query` with no DB context and still worked, which is only possible if RLS does not apply. The
Sprint 142 integration suite logs the role flags quoted above.
