# Backend Simplification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal**: Remove duplicated infrastructure across services by centralizing logger and event publisher in `packages/shared`, extract query-building logic from the request service's 1,391-line route file, and replace placeholder test assertions with real ones.

**Architecture**: No new services or endpoints. Refactor only — all external interfaces unchanged. Shared package gains two exports (`logger` already exists, `createPublisher` is new). Services lose local implementations and import from shared.

**Tech Stack**: Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `packages/shared/src/events/publisher.ts` | Shared Bull queue publisher factory; accepts `source` param |
| `services/request-service/src/utils/queryBuilder.ts` | Extracted SQL query-building logic from requests route |

### Existing files to modify
| File | Change |
|------|--------|
| `packages/shared/src/index.ts` | Export new `createPublisher` |
| `services/auth-service/src/utils/logger.ts` | Delete local impl, re-export from shared |
| `services/social-graph-service/src/config/logger.ts` | Delete local impl, re-export from shared |
| `services/auth-service/src/events/publisher.ts` | Replace with import of `createPublisher` from shared |
| `services/request-service/src/events/publisher.ts` | Replace with import of `createPublisher` from shared |
| `services/community-service/src/events/publisher.ts` | Replace with import of `createPublisher` from shared |
| `services/reputation-service/src/events/publisher.ts` | Replace with import of `createPublisher` from shared |
| `services/request-service/src/routes/requests.ts` | Remove query-building block (lines ~35–99), import from queryBuilder |
| `services/auth-service/tests/regression/auth.routes.test.ts` | Replace `expect(true).toBe(true)` with real mock-based assertions |
| `services/reputation-service/tests/regression/placeholder.test.ts` | Convert to `it.todo()` stubs or delete |
| `services/social-graph-service/tests/regression/placeholder.test.ts` | Convert to `it.todo()` stubs or delete |
| `tests/tdd/community-evolution-flow.test.ts` | Convert infra-blocked tests to `it.todo()` |
| `tests/tdd/fractal-feed-flow.test.ts` | Convert infra-blocked tests to `it.todo()` |
| `tests/integration/complete-workflow.test.ts` | Replace trivial assertions with real ones |
| `apps/landing/src/data/docs/architecture.json` | Add shared package sentence to content |
| `package.json` | Bump version v9.22.0 → v9.23.0 |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Check shared logger API before migrating services.** Read `packages/shared/utils/logger.ts` exports before touching any service logger. Confirm the call signature (constructor vs factory, `service` name param) so all migration sites match.

2. **`@karmyq/shared` must be in each service's `package.json` dependencies.** If missing, Turbo skips building shared first → import failures at build time. Check each service's `package.json` before modifying its imports.

3. **`moduleResolution: node16` for subpath imports.** Services importing `@karmyq/shared/src/events/publisher` need `"moduleResolution": "node16"` in `tsconfig.json`. Grep for existing usage pattern before adding.

4. **Query builder scope is lines 35–99 only.** Extract the dynamic SQL builder (the block with `paramCount++` tracking). Do not refactor the route handlers themselves.

5. **Placeholder file rule.** If a test file would have zero real assertions after conversion, delete it rather than leaving an empty file. `it.todo()` is fine for documenting intent; an empty `describe` block is not.

6. **Do not use `--no-verify`.** Pre-push hook runs regression tests. Fix assertions, don't bypass hooks.

---

## Task 1: Feature Branch

**Files:** none

- [ ] **Create sprint branch**

```bash
git checkout -b feature/sprint-56-backend-simplification
```

- [ ] **Verify**

```bash
git branch --show-current
```

---

## Task 2: Audit Shared Logger and Event Publisher APIs

**Files:**
- Read: `packages/shared/utils/logger.ts`
- Read: one existing service publisher (e.g., `services/auth-service/src/events/publisher.ts`)

- [ ] **Read the shared logger to confirm its exported API** — note whether it's a class, factory, or singleton, and whether it takes a service name param.

- [ ] **Read one service publisher to understand the current interface** — note what it exports (`publish`, `publishEvent`, queue name, etc.)

- [ ] **Confirm `@karmyq/shared` is in each affected service's `package.json` dependencies.** Run:

```bash
grep -l "@karmyq/shared" services/auth-service/package.json services/request-service/package.json services/community-service/package.json services/reputation-service/package.json services/social-graph-service/package.json
```

- [ ] **Check moduleResolution in affected tsconfigs:**

```bash
grep -r "moduleResolution" services/auth-service/tsconfig.json services/request-service/tsconfig.json services/community-service/tsconfig.json services/reputation-service/tsconfig.json
```

---

## Task 3: Create Shared Event Publisher

**Files:**
- Create: `packages/shared/src/events/publisher.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Create `packages/shared/src/events/publisher.ts`** with a `createPublisher(source: string)` factory that wraps the Bull queue logic currently duplicated across the four service publishers. Match the interface those publishers currently export.

```typescript
// packages/shared/src/events/publisher.ts
import Queue from 'bull';

const QUEUE_NAME = 'karmyq-events';

export interface PublishOptions {
  event: string;
  data: Record<string, unknown>;
}

export function createPublisher(source: string) {
  const queue = new Queue(QUEUE_NAME, {
    redis: { host: process.env.REDIS_HOST || 'localhost', port: 6379 }
  });

  return {
    async publish(options: PublishOptions): Promise<void> {
      await queue.add({ ...options.data, source, event: options.event });
    }
  };
}
```

- [ ] **Export from `packages/shared/src/index.ts`:**

```typescript
export { createPublisher } from './events/publisher';
```

- [ ] **Build shared package to confirm it compiles:**

```bash
cd packages/shared && npm run build
```

---

## Task 4: Migrate Service Event Publishers

**Files:**
- Modify: `services/auth-service/src/events/publisher.ts`
- Modify: `services/request-service/src/events/publisher.ts`
- Modify: `services/community-service/src/events/publisher.ts`
- Modify: `services/reputation-service/src/events/publisher.ts`

- [ ] **Replace each service publisher** with a thin wrapper that calls `createPublisher` from shared with the correct `source` name. Keep the same exported API so callers don't change.

Example (`auth-service`):
```typescript
import { createPublisher } from '@karmyq/shared';
export const publisher = createPublisher('auth-service');
```

- [ ] **Build all four services to confirm no import errors:**

```bash
npm run build --workspace=services/auth-service
npm run build --workspace=services/request-service
npm run build --workspace=services/community-service
npm run build --workspace=services/reputation-service
```

---

## Task 5: Consolidate Service Loggers

**Files:**
- Modify: `services/auth-service/src/utils/logger.ts`
- Modify: `services/social-graph-service/src/config/logger.ts`

- [ ] **Read `packages/shared/utils/logger.ts`** to confirm the exact export shape (done in Task 2 — apply findings here).

- [ ] **Replace `services/auth-service/src/utils/logger.ts`** — remove custom winston setup, re-export from shared:

```typescript
export { logger } from '@karmyq/shared/utils/logger';
```

Or, if the shared logger is a default export or requires a service name:
```typescript
import { createLogger } from '@karmyq/shared';
export const logger = createLogger('auth-service');
```

Match the actual API confirmed in Task 2.

- [ ] **Repeat for `services/social-graph-service/src/config/logger.ts`.**

- [ ] **Grep for any remaining local `winston` imports in services** (excluding shared package and node_modules):

```bash
grep -r "require('winston')\|import winston\|from 'winston'" services/ --include="*.ts" --exclude-dir=node_modules
```

Migrate any found instances.

- [ ] **Build affected services:**

```bash
npm run build --workspace=services/auth-service
npm run build --workspace=services/social-graph-service
```

---

## Task 6: Extract Request Route Query Builder

**Files:**
- Create: `services/request-service/src/utils/queryBuilder.ts`
- Modify: `services/request-service/src/routes/requests.ts`

- [ ] **Read `services/request-service/src/routes/requests.ts` lines 35–99** to understand the full scope of the query-building block.

- [ ] **Create `services/request-service/src/utils/queryBuilder.ts`** with a `buildRequestsQuery` function that accepts filter params and returns `{ query: string, params: unknown[] }`. Extract the `paramCount++` tracking logic into this function.

- [ ] **Update `services/request-service/src/routes/requests.ts`** to import and call `buildRequestsQuery` instead of building the query inline.

- [ ] **Verify the route file is shorter and the query builder is independently importable:**

```bash
wc -l services/request-service/src/routes/requests.ts
```

Should be meaningfully shorter (target: under 1,200 lines after extraction).

- [ ] **Build request-service:**

```bash
npm run build --workspace=services/request-service
```

---

## Task 7: Fix Placeholder Tests

**Files:**
- Modify: `services/auth-service/tests/regression/auth.routes.test.ts`
- Modify: `services/reputation-service/tests/regression/placeholder.test.ts`
- Modify: `services/social-graph-service/tests/regression/placeholder.test.ts`
- Modify: `tests/tdd/community-evolution-flow.test.ts`
- Modify: `tests/tdd/fractal-feed-flow.test.ts`
- Modify: `tests/integration/complete-workflow.test.ts`

- [ ] **Read each placeholder file** to understand what the tests claim to cover.

- [ ] **For `auth-service/tests/regression/auth.routes.test.ts`:** Replace the 8 `expect(true).toBe(true)` tests with real mock-based assertions. Mock the auth middleware and test that routes return the correct status codes and response shapes. Example:

```typescript
it('returns 401 when no token provided', async () => {
  const res = await request(app).get('/auth/me');
  expect(res.status).toBe(401);
  expect(res.body.success).toBe(false);
});
```

- [ ] **For reputation and social-graph placeholder files:** If the files contain only trivial tests with no real setup, convert each `it('...')` to `it.todo('...')` keeping the description. If the file becomes all-todos with no assertions, delete the file (empty test files cause jest warnings).

- [ ] **For `tests/tdd/community-evolution-flow.test.ts` and `fractal-feed-flow.test.ts`:** Convert the infrastructure-blocked placeholders to `it.todo()`. Keep any tests that already have real assertions.

- [ ] **For `tests/integration/complete-workflow.test.ts`:** Replace `expect(true).toBe(true)` with specific assertions about HTTP status codes and response shapes (mock the DB where needed).

- [ ] **Run tests to confirm no false-passing placeholders remain:**

```bash
npm run test:regression
npm test
```

Confirm output shows real test counts, not inflated by passing-placeholder tests.

---

## Task 8: Wire TDD Promotion Pipeline

**Files:**
- Modify: `package.json` (root scripts)

- [ ] **Run the promotion script once manually** to promote any currently-passing TDD tests to regression:

```bash
node scripts/promote-tdd-tests.js
```

- [ ] **Review what was promoted** (check git diff) — confirm promoted tests have real assertions, not placeholders.

- [ ] **Add promotion to posttest script in root `package.json`:**

```json
"posttest": "node scripts/promote-tdd-tests.js"
```

This ensures the promotion runs automatically after every `npm test`.

- [ ] **Verify the pipeline runs:**

```bash
npm test
```

Confirm promotion output appears after test results.

---

## Task 9: Landing Page Docs

**Files:**
- Modify: `apps/landing/src/data/docs/architecture.json`

- [ ] **Read `apps/landing/src/data/docs/architecture.json`** to find the section describing services and the shared package.

- [ ] **Add a sentence** to the content field noting that shared infrastructure (logging, event publishing) is centralized in `packages/shared` and imported by all services. Keep the addition to 1–2 sentences — this is an internal refactor, not a user-facing change.

---

## Task 10: Version Bump + Final Verification

**Files:**
- Modify: `package.json` (root)

- [ ] **Bump version in root `package.json`:**

```json
"version": "9.23.0"
```

- [ ] **Run full build:**

```bash
npm run build
```

- [ ] **Run all tests:**

```bash
npm test
npm run test:tdd
```

- [ ] **Run feedback check:**

```bash
npm run feedback:check
```

- [ ] **Run type check across the monorepo:**

```bash
npx tsc --noEmit -p tsconfig.json
```

All must pass before proceeding to Task 11.

---

## Task 11: Merge + Deploy

- [ ] **Run pre-commit check skill** (`/pre-commit-check`) and resolve any issues.

- [ ] **Commit all changes:**

```bash
git add -A
git commit -m "refactor(shared): centralize logger + event publisher; extract request query builder; fix TDD placeholders (v9.23.0)"
```

- [ ] **Merge to master and push:**

```bash
git checkout master && git merge feature/sprint-56-backend-simplification && git push origin master
```

- [ ] **Monitor GitHub Actions** for green build.

- [ ] **Use `/deploy` skill** if manual deployment to karmyq.com is needed.
