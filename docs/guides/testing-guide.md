# Testing Guide

**Audience:** developers working in this repo.
**Related:** [ADR-029: TDD Test Framework](../adr/ADR-029-tdd-test-framework.md),
[ADR-088: Test-Tier Truthfulness](../adr/ADR-088-test-tier-truthfulness.md).

---

## The four tiers

Most workspaces (services and apps) keep their tests under `tests/` in one of four tiers:

| Tier | Directory | Meaning |
|---|---|---|
| Unit | `tests/unit/` | Fast, isolated, mocked. No external dependencies. |
| Regression | `tests/regression/` | Locked-in behavior. Once a test lands here, breaking it is a breaking change. |
| TDD | `tests/tdd/` | Work-in-progress. Allowed to fail. Write-tests-first lives here. |
| Integration | `tests/integration/` | Requires a real database (`infrastructure/docker`). |

**Two workspaces do not use that directory layout, and both are legitimate:**

- **`packages/shared`** colocates its suites at `src/**/__tests__/` with `roots: ['<rootDir>/src']`
  in its jest config, and has no `tests/` directory at all.
- **The `tests` workspace** *is* the tests directory, so its tiers sit at its own root —
  `tests/unit/`, `tests/regression/` — not at `tests/tests/unit/`.

Both are covered: the tier-coverage gate resolves either shape, and a separate assertion catches
any workspace that has test files but runs none of them, which is what reaches `packages/shared`.

Some workspaces (`cleanup-service`, `simulation-service`, `apps/landing`, `apps/mobile`) run a
single bare `jest` invocation instead of tiered `test:unit` / `test:regression` / `test:tdd`
scripts. That invocation covers every tier directory in one pass — it is a legitimate second
layout, not a shortcut. A regression gate
(`tests/regression/sprint-122-tier-parity.test.ts`) checks both layouts the same way: whatever
the workspace's `test` script resolves to must actually cover the test files present on disk for
every tier that has files.

## What blocks a push, what only reports

- **`npm test` (unit + regression) — BLOCKS.** The pre-push hook runs this and refuses the push on
  any failure. `git push --no-verify` skips it; that's an emergency escape hatch, not a normal
  workflow step.
- **`npm run test:integration` — BLOCKS if a database is reachable, otherwise skipped.** The
  pre-push hook checks for `DATABASE_URL`/a live Postgres before running it.
- **`npm run test:tdd` — NEVER blocks.** It's informational. Tests here are expected to fail; the
  hook reports pass/fail and suggests promotion when everything's green.
- **`npm run feedback:check` — NEVER blocks.** It's an advisory to-do list for the diff (see
  CLAUDE.md's Pre-Merge Checklist), not a test run.

## Scoping with `--testPathPatterns`: use `(unit|regression)/`, not a positional argument

Jest's positional filename argument does a **substring** match against the full path, not a
directory match. `npx jest unit` does not mean "run the `unit/` directory" — it means "run any
test file whose path contains the substring `unit`." That substring shows up in places you don't
expect: **`comm-unit-y`** (as in `community`) contains `unit`. A positional `unit` filter can pull
in `community`-named test files that have nothing to do with the unit tier, or silently miss files
depending on naming.

The correct, unambiguous form is an explicit regex anchored to the tier directory:

```bash
npx jest --testPathPatterns='(unit|regression)/'
```

This is why `@karmyq/tests`' scripts use `--testPathPatterns=unit/`, `--testPathPatterns=regression/`,
etc. instead of a bare positional argument — see ADR-029.

> **The flag was renamed in jest 30** (Sprint 122 PR 4): it used to be `--testPathPattern`,
> singular. The old spelling is **not** silently ignored — jest 30 exits 1 with
> *"Option `testPathPattern` was replaced by `--testPathPatterns`"* — so a stale command fails
> loudly rather than quietly running the wrong set. `tests/regression/sprint-122-jest-toolchain-gate.test.ts`
> checks every flag in every jest script against the installed jest's own option table, so the
> next rename is caught the same way without anyone maintaining a list.

## Turbo caches test results — how to force a real run

Turbo caches `#test` task output keyed on the task's `inputs`. As of ADR-088, `turbo.json`
declares `inputs: ["$TURBO_DEFAULT$"]` for the `test` task, so the cache key includes the
package's own test files, jest config, and setup files — a test edit invalidates the cache.

**`@karmyq/tests#test` is uncached, deliberately.** The five gates in `tests/regression/` and
`tests/unit/` that audit *other* workspaces (Turbo cache-key shape, tier-coverage parity, lint
config loadability, Expo SDK alignment, the promoter's directory walk) live in the `tests`
workspace but read files outside it. `$TURBO_DEFAULT$` scopes a task's cache key to its own
package directory, so `@karmyq/tests#test`'s inputs never include the services/apps it's
checking — a change to, say, `services/reputation-service/package.json` doesn't invalidate the
`tests` workspace's cache, and a warm cache would replay a stale pass instead of re-running the
gate. `turbo.json` gives `@karmyq/tests#test` a package-specific override (`"cache": false`), so
it always runs live. **A local `npm test` only guarantees a task ran for real if either it isn't
cross-workspace, or it's the `tests` workspace** — don't assume a green cached run elsewhere
re-validated anything outside its own package directory.

Two ways to bypass the cache when you need a guaranteed real run on a workspace that IS cached:

```bash
# Force every workspace's test task to actually run
npx turbo run test --force

# Or just run the workspace directly, bypassing Turbo entirely
cd services/auth-service && npm test
```

Prefer running the workspace directly when you're debugging a specific failure — it also avoids
Turbo's cross-workspace cache masking a stale pass for a test that reads across workspace
boundaries (see the flake note below).

## How a `tdd/` test graduates

`scripts/promote-tdd-tests.js` runs every test file under each workspace's `tests/tdd/` (and, as
of ADR-088, walks `apps/` as well as `services/` — it previously only walked `services/`) and
individually checks whether it passes:

- **Passes → moved to `tests/regression/`.** From that point on, it's a locked-in contract; a
  future change that breaks it blocks the push.
- **Fails → left in `tests/tdd/`.** No action needed; it stays informational.

Root `package.json` runs the promoter as a `posttest` hook, so it runs automatically after
`npm test` at the root. You can also run it directly: `npm run test:promote-tdd`.

**Known gap (as of Sprint 122 PR 2):** the promoter's file matcher (`findTestFiles()`) only
recognizes `*.test.ts`. `apps/frontend/tests/tdd/` is mostly `.test.tsx` files (component tests),
so most of that directory is currently invisible to the promoter even though the directory walk
itself now reaches `apps/frontend`. This is a deliberate, logged limitation — extending the filter
would move a large batch of tests into the blocking regression tier in one change, which needs its
own review. See `docs/BUGS.md` and ADR-088's Consequences section.

## Two known flakes — not bugs, don't debug them

- **Windows Turbo timeout on the shared rate-limiter test.** Under Turbo on Windows,
  `packages/shared`'s rate-limiter `errorContract` test occasionally times out. If you hit it,
  confirm by running the package directly (`cd packages/shared && npm test`) before concluding
  anything is actually broken — it's Turbo-and-Windows specific, not a real regression.
- **`feed-dibs` privacy timestamp flake.** A digit regex in the feed-dibs privacy test false-fires
  on millisecond timestamps roughly 2 times in 1000 runs. A lone red run on this specific test in
  CI is expected noise — rerun the job rather than investigating it as a regression.

## Don't trust a suspiciously-green run after deletes or renames

Turbo's cache can miss cross-workspace test inputs — a test in `tests/regression/` that reads
files from `apps/landing` can cache a stale pass while a fresh CI run (which starts cold) fails.
If you've just deleted or renamed files, re-run the relevant test directly rather than trusting a
green Turbo-cached result:

```bash
cd tests && npx jest regression/<file> --force
```
