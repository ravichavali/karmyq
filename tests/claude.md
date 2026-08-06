# Tests Directory

Root-level test workspace. **Read this before adding or moving any test.**

Per-workspace suites also exist (`services/*/tests/`, `apps/*/tests/`, `packages/shared/src/__tests__/`)
and follow the same tier rules. `npm test` at the repo root is `turbo run test` across all of them.

---

## Test tiers ([ADR-029](../docs/adr/ADR-029-tdd-test-framework.md)) — this is the contract

| Tier | Blocks push? | Needs what |
|---|---|---|
| `unit/` | **YES** | nothing |
| `regression/` | **YES** | nothing |
| `tdd/` | no — reports only | nothing |
| `integration/` | blocks *if* a DB is reachable | Postgres |
| `performance/` | no | **running services** (3001/3002) |
| `e2e/` | no | running app; separate npm project |
| `load/` | no | running app; `load-test.ts` |

(File counts deliberately omitted — a hardcoded count in prose is drift waiting to happen.
`ls tests/<tier>/*.test.ts | wc -l` is the answer.)

**`tdd/` is the WIP tier and it auto-promotes — but NOT in this directory.**
`scripts/promote-tdd-tests.js` runs as root `posttest` and moves passing `tests/tdd/*` files into
`regression/`, but it only walks **`services/*` and `apps/*`** (`SERVICES_DIR`, `APPS_DIR`). A test
left in **root `tests/tdd/`** therefore never blocks a push *and* never gets promoted — it runs and
reports, forever. ⚠️ **If a test is meant to enforce something, put it straight in
`tests/regression/`.** A rule "enforced" by a root-`tdd/` test is not enforced.

**New sprint tests start in the CHANGED workspace's `tests/tdd/`** (e.g.
`services/request-service/tests/tdd/`), not in this directory. Put a test here only when it spans
workspaces or asserts a repo-wide invariant (see `regression/doc-context-drift-gate.test.ts`).

---

## Commands

```bash
cd tests

npm test                 # test:unit && test:regression — the blocking pair
npm run test:unit
npm run test:regression
npm run test:tdd         # WIP tier; never blocks
npm run test:integration # jest.integration.config.js — needs Postgres

# One file, straight through Jest (no Turbo cache):
npx jest regression/doc-context-drift-gate.test.ts
```

**Jest 30 renamed the flag to `--testPathPatterns` (plural).** The tier scripts use it; the old
singular form is gone. And never pass a bare positional pattern to select a tier — Jest treats it
as a substring match against the full path, so `jest unit` also matches
`services/community-service/...` because "comm**unit**y" contains "unit". Use the tier scripts.

**Never trust a suspiciously-green Turbo run after a delete/rename.** Turbo misses cross-workspace
test inputs — a `regression/*` test that reads `apps/landing` caches a stale pass while CI fails.
Re-run the file directly (above) or `--force`.

### Integration environment

```bash
npm run test:integration:setup     # docker compose -f docker-compose.test.yml up -d
npm run test:integration
npm run test:integration:teardown  # ...down -v
npm run test:integration:full      # all three in sequence
```

Or use the shared dev DB: `cd infrastructure/docker && docker-compose up -d postgres redis`.

### e2e and load are separate npm projects

```bash
cd tests/e2e  && npm install && npx playwright test   # specs in e2e/tests/ and e2e/admin/
cd tests/load && npm install && npm test              # npx ts-node load-test.ts
```

`load-test.ts` is **not k6** — it is a k6-*style* harness that runs natively on Node. Tune it with
`LOAD_TEST_USERS` / `LOAD_TEST_DURATION`, or use `test:light` / `test:heavy` / `test:stress`.

---

## Jest config gotchas (`jest.config.js`)

- `testMatch: ['**/*.test.ts']` with `roots: ['<rootDir>']` — every tier shares one config; the
  tier scripts select by path pattern, nothing else.
- `moduleNameMapper` resolves `@karmyq/shared` to **TypeScript source**, not `dist/`, so
  cross-workspace imports work without a prior build. If you add a shared subpath import that
  fails to resolve here, add it to that map — don't build `dist/` to work around it.
- `testTimeout: 30000`, `setupFilesAfterEnv: ['<rootDir>/setup.ts']`.
- Coverage thresholds are 80% globally and collect from `../services/**` only.

---

## Fixtures (`fixtures/index.ts`)

Class factories, not standalone helpers:

```typescript
import { TestScenario, UserFactory, CommunityFactory } from '../fixtures'

let scenario: TestScenario

beforeAll(async () => {
  scenario = new TestScenario()
})

afterAll(async () => {
  await CommunityFactory.delete(scenario.pool, community.id)
  await UserFactory.delete(scenario.pool, user.id)
})
```

Exports: `UserFactory`, `CommunityFactory`, `RequestFactory`, `OfferFactory`, `TestScenario`,
`TestPresets` (canned valid/invalid inputs), `ServiceUrls`, `createPool()`. Factories are `static`
and take the pool as their first argument; cleanup is explicit per entity — there is no global
`cleanup()`.

Seed/generator data lives alongside them (`consolidatedSeeder.ts`, `realisticDataFactory.ts`,
`timeTravelFactory.ts`, `volumeSeeder.ts`, plus generated `.sql`/`.json` sets). Data-management
scripts are in `scripts/` (`seed-data.ts`, `cleanup-test-data.ts`, each with `--dry-run`/`--force`
variants exposed as npm scripts).

---

## Writing a good test here

Assert exact values, not shapes. Don't stub the logic under test. A gate must be shown able to
**fail** — inject a violation and watch it go red — because a check that cannot fail is worse than
no check. Skipped tests need a justification comment or `feedback:check` flags them.
