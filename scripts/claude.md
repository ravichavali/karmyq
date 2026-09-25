# Scripts Directory

Flat directory of operational scripts, plus four subdirectories. **Most are reached through an npm
script — prefer those**, since they carry the right arguments and working directory.

## Entry points wired into `package.json`

| npm script | Runs | Purpose |
|---|---|---|
| `npm test` → `posttest` | `promote-tdd-tests.js` | Moves passing `tests/tdd/*` into `regression/` — **`services/*` and `apps/*` only**, not root `tests/`. ⚠️ Wired as `posttest`, but `ignore-scripts=true` stopped it running on npm 10.8.2 (see `git-hooks/` below); run it by hand |
| `npm run feedback:check` | `feedback-loop.js` | Advisory docs to-do list for the staged diff |
| `npm run analyze:services` | `analyze-services.js` | Regenerates the dependency graph + impact analysis |
| `npm run context:generate` | `generate-service-context.js` | Generates a service's `CONTEXT.md` |
| `npm run health:check` | `health-check.sh` | Health of every production service in the registry |
| `npm run dashboard` | `dashboard.js` | Interactive service dashboard |
| `npm run hooks:install` | `install-hooks.sh` | Installs `git-hooks/` into the **active** hooks dir (once after clone) |
| Demo health workflow | `check-demo-health.js` | Asserts a demo session can be issued **and** that the story rows are >14 days from cleanup's hard delete. Models the real two-stage deletion predicate (mark sets `updated_at`; delete keys off it) rather than `expires_at + 7 days`, and reports a `basis` so an operator can tell a running clock from an estimate. Read-only; `tests/regression/sprint-129-demo-health-gate.test.ts` proves it can fail |
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

`audit-exemptions.js` validates audit evidence before matching the ADR-059 registry (Sprint 128,
BUG-038). Empty/malformed reports, npm error objects, invalid severity graphs, unsupported exit
statuses, signals and timeouts fail with an unavailable-evidence error. The subprocess captures
stderr and has a 120-second timeout; upstream error bodies are not echoed. Only valid npm success
or finding output is evaluated. A critical finding cannot be exempted. Retry unavailable evidence;
remove an unmatched exemption only after a valid report establishes that it no longer matches.
`tests/regression/sprint-128-audit-response-contract.test.ts` covers the boundary and actual CLI.

`generate-docs.ts` (build-time landing-docs generator — the landing prebuild runs it, which is why
`npm test` can leave `apps/landing/src/data/docs/` dirty; revert timestamp/HEAD-sha churn before
committing) · `update-service-tdd-docs.js` · `add-tdd-scripts.js` ·
`check-storage.sh` · `clean-docker-logs.sh` · `setup-log-rotation.sh` · `start-dev-services.sh` ·
`test-all.{sh,bat}` / `test-local.{sh,bat}`.

**Deleted in Sprint 131 PR B2: `update-service-deps.js`.** It stripped a hardcoded `HOISTED_DEPS`
list (`express`, `pg`, `redis`, `bull`, `winston`, `zod`, `dotenv`, `express-rate-limit`, `bcryptjs`,
`jsonwebtoken`, `ioredis`, `cors`) out of every `services/*/package.json` "since they're now in the
root package.json" — which is precisely the "declare what you import" violation that became BUG-046.
Nothing invoked it (no npm script, no CI step); re-running it would have reverted this PR's
declarations. `tests/regression/sprint-131-workspace-declarations.test.ts` now blocks that state, so
the script was a landmine with no remaining use.

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
  `pre-push` runs unit + regression through `prepush-test-runner.js` (blocking), integration if a
  DB is reachable, and `test:tdd` for reporting only. `SKIP_PREPUSH=1` skips it; `--no-verify`
  for emergencies only.
  ⚠️ Two things the hook does NOT do, whatever older docs say: it does not run the TDD promoter
  (`npm test`'s `posttest` never runs under `.npmrc`'s `ignore-scripts=true`; verified with npm
  10.8.2), and its `test:tdd` step runs nothing (turbo: "Could not find task `test:tdd`", and the
  step is report-only, so the error is swallowed).
  Neither is the answer to a slow or flaky push: tune the caps below instead, and never read "open
  the PR" as permission to skip the hook.
  **Test parallelism is capped for every `npm test`**, the hook, CI and your shell alike.
  Uncapped, every workspace ran at once with cores-1 Jest workers each, and on the 8-core, 7.6 GB
  Windows box ordinary tests hit their Jest timeouts and passed standalone. Two caps:
  `turbo.json` `"concurrency": "4"` (override with `TURBO_CONCURRENCY` or `--concurrency`), and
  **`jest-worker-cap.js`**: 2 Jest workers (override with `KARMYQ_JEST_MAX_WORKERS`), which every
  jest config wraps, directly or through the root config; a config that pins its own
  `maxWorkers` keeps it. On a bigger machine, raise both.
  **`prepush-test-runner.js`** (the hook's gate, not `npm test`'s) runs the same bounded
  `turbo run test` and adds one thing: a test task whose ONLY failures are Jest timeouts (every
  failure block opens with Jest's timeout error) is re-run once, alone, serially, together with
  any task that never ran; its first-run log is kept in `.turbo/prepush/`. A `cache: false` task
  (the root `tests` suite) gets no Turbo log file, so its log is read from Turbo's prefixed
  output, which the runner streams live and keeps. Everything else
  blocks: assertions, suites that failed to run, build failures, missing logs, tasks that never
  ran while nothing failed, and missing or contradictory run summaries. A new jest config (any
  `jest*.config.js`) must wrap its export in `withWorkerCap` or pin `maxWorkers`, and
  `KARMYQ_JEST_MAX_WORKERS` must stay in `turbo.json`'s `globalPassThroughEnv` (strict env mode
  strips it otherwise); `tests/regression/sprint-131-prepush-test-runner.test.ts` enforces both,
  proves the repo's turbo honours the config, and proves the hook rejects a real push.
- **`demo/`** — demo-host wiring for `rotate:demo-stories` (Sprint 129, BUG-039).
  `enable-demo.sh` (`DEMO_ENABLE_CMD`) idempotently sets `DEMO_SESSION_ENABLED=true` and asserts the
  post-condition on **every** occurrence of the key — the env file is known to carry duplicates, and
  last-wins means one stale line would disable the demo while the first looked right.
  `restart-auth.sh` (`DEMO_RESTART_AUTH_CMD`) recreates the auth container so compose re-interpolates
  the republished ids — a plain `docker restart` reuses the old environment and would not.
  `probe-story-rows.js` is the read-only retention probe the demo-health workflow pipes into
  `docker exec -i karmyq-auth-service node`; **SELECT only**, and it emits story *kinds* rather than
  UUIDs because its output is rendered into a public GitHub issue.
  ⚠️ Both shell scripts re-anchor to the repo root from `${BASH_SOURCE[0]}`: `npm --workspace` sets
  cwd to the *workspace* directory, so a relative path would resolve under `services/…` and miss.
- **`setup/`** — server and first-run setup: `init-production-database.sh`, `run-migrations.sh`,
  `setup-registry*.sh`, `setup-logging.sh`, git-hook installers, `restart-services.sh`.
- **`test-utils/`** — `test-validation.js`.
- **`archive/`** — deprecated scripts superseded by `deploy.sh`; see its `README.md`. **Nothing in
  here is live.** Don't copy a pattern out of it without checking the current equivalent first.

## Conventions

Bash with `set -e`; accept configuration through environment variables; log to stdout/stderr. When
a script is wrong, **fix that script** — never fork a workaround copy alongside it.
