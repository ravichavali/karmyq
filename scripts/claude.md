# Scripts Directory

Flat directory of operational scripts, plus four subdirectories. **Most are reached through an npm
script — prefer those**, since they carry the right arguments and working directory.

## Entry points wired into `package.json`

| npm script | Runs | Purpose |
|---|---|---|
| `npm test` → `posttest` | `promote-tdd-tests.js` | Moves passing `tests/tdd/*` into `regression/` — **`services/*` and `apps/*` only**, not root `tests/` |
| `npm run feedback:check` | `feedback-loop.js` | Advisory docs to-do list for the staged diff |
| `npm run analyze:services` | `analyze-services.js` | Regenerates the dependency graph + impact analysis |
| `npm run context:generate` | `generate-service-context.js` | Generates a service's `CONTEXT.md` |
| `npm run health:check` | `health-check.sh` | Health of every production service in the registry |
| `npm run dashboard` | `dashboard.js` | Interactive service dashboard |
| `npm run hooks:install` | `install-hooks.sh` | Installs `git-hooks/` into the **active** hooks dir (once after clone) |
| Expo SDK drift workflow | `expo-divergences.js` | Applies the SDK-major-scoped divergence registry to the complete output of Expo's live compatibility check; malformed, stale, or unregistered drift fails closed (ADR-094) |
| `image-size` advisory watch workflow | `check-image-size-upstream.js` | Re-takes the ADR-059 exemption measurements from live arbiters (npm registry, GitHub advisory API, resolved tree). Exits non-zero only when something is actionable. **Never writes `security/audit-exemptions.json`** — renewal is a reviewed human decision |

`.npmrc` sets `ignore-scripts=true` ([ADR-061](../docs/adr/ADR-061-supply-chain-and-secrets-hardening.md)),
so `hooks:install` does **not** run automatically on `npm install` — run it by hand after cloning.

⚠️ **`health-check.sh` requires `jq`, which is not installed on the Windows dev box** — it exits 1
immediately. Run it on the server, or probe an `/api/...` route with `node -e` locally.

## Deploy & database

| Script | Purpose |
|---|---|
| `deploy.sh` | Unified deployment — what CI runs on the demo server |
| `smoke-test.sh` | Post-deploy: hits each service's `/health`, reports pass/fail |
| `apply-migrations.sh` | Applies pending migrations |
| `regenerate-init-sql.sh` | Rebuilds the generated `init.sql` from the migration chain |
| `ci-apply-full-schema.sh` | Teaches CI the full migrated schema; `--drift-check` proves convergence |
| `truncate-database.{sh,bat,sql}` | Wipes data — **destructive** |
| `cleanup-demo-data.ts`, `seed-test-data.sh`, `seed-ui-schemas.ts` | Demo/test data management |
| `audit-*.sql`, `repair-*.sql`, `backfill-*.sql` | One-off data audits and repairs |

**Dry-run every data repair before it touches real rows**, and remember demo-server data ops use
the DB user `karmyq_prod`.

## Docs, deps & maintenance

`generate-docs.ts` (build-time landing-docs generator — the landing prebuild runs it, which is why
`npm test` can leave `apps/landing/src/data/docs/` dirty; revert timestamp/HEAD-sha churn before
committing) · `update-service-deps.js` · `update-service-tdd-docs.js` · `add-tdd-scripts.js` ·
`check-storage.sh` · `clean-docker-logs.sh` · `setup-log-rotation.sh` · `start-dev-services.sh` ·
`test-all.{sh,bat}` / `test-local.{sh,bat}`.

## Claude Code hooks

`update-memory-state.js` — refreshes the memory state file from live git state; wired to the
**Stop** hook. `dependency-guard-hook.js` — wired to **PreToolUse/PostToolUse** on Bash; blocks
`npm install --workspace`, `npm dedupe`, and lockfile deletion, and warns on lockfile churn over
60 lines. Both are configured in [`.claude/settings.json`](../.claude/settings.json); the guard is
covered by `tests/regression/dependency-guard-hook.test.ts`.

## Subdirectories

- **`lib/`** — shared script internals, not standalone entry points.
  `exemption-registry.js` validates the structural rules common to the audit and Expo registries;
  each caller owns its own identity, field, and expiry policy (ADR-094). The spec supplies
  `entryName` and `dateFields` too — the core names no field of its own, so nothing audit-shaped
  leaks into a future registry.
- **`git-hooks/`** — `pre-commit`, `pre-push` sources. Edit these, not the installed copies.
  ⚠️ **`core.hooksPath` decides where hooks live.** When it is set — husky sets it, and it outlives
  husky's removal — git reads *only* that directory and ignores `.git/hooks` entirely. The
  installer resolves it (Sprint 123; it used to hardcode `.git/hooks`, which made every hook on
  such a machine dead code and every push silent). `scripts/setup/setup-git-hooks.sh` is a **third,
  vestigial** installer that reintroduces husky — don't run it.
  `pre-push` runs `npm test` (unit + regression, blocking), integration if a DB is reachable, and
  `test:tdd` for reporting only. `SKIP_PREPUSH=1` skips it; `--no-verify` for emergencies only.
- **`setup/`** — server and first-run setup: `init-production-database.sh`, `run-migrations.sh`,
  `setup-registry*.sh`, `setup-logging.sh`, git-hook installers, `restart-services.sh`.
- **`test-utils/`** — `test-validation.js`.
- **`archive/`** — deprecated scripts superseded by `deploy.sh`; see its `README.md`. **Nothing in
  here is live.** Don't copy a pattern out of it without checking the current equivalent first.

## Conventions

Bash with `set -e`; accept configuration through environment variables; log to stdout/stderr. When
a script is wrong, **fix that script** — never fork a workaround copy alongside it.
