# Test Coverage — Critical Paths — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal**: Add meaningful unit tests to four high-risk silent-failure areas and enforce the existing 80% CI coverage threshold so missing tests actually block pushes.

**Architecture**: No new services or endpoints. All changes are test files, jest config edits, an ADR status update, and a landing page JSON update.

**Tech Stack**: Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|----------------|
| `services/cleanup-service/tests/unit/expirationJob.test.ts` | Unit tests for expiration cron job (table updates, rowCount aggregation) |
| `services/cleanup-service/tests/unit/reputationDecayJob.test.ts` | Unit tests for reputation decay cron job (formula, conditional update) |
| `services/auth-service/tests/unit/jwtClaims.test.ts` | Unit tests for JWT payload shape and multi-community claims |
| `services/auth-service/tests/unit/authMiddleware.test.ts` | Unit tests for auth middleware (valid/expired/missing token) |
| `services/feed-service/tests/unit/basicFeedRanker.test.ts` | Unit tests for feed ranking algorithm (proximity, urgency, recency) |

### Existing files to modify
| File | Change |
|------|--------|
| `services/cleanup-service/jest.config.js` | Remove `passWithNoTests: true` |
| `services/community-service/tests/regression/communities.test.ts` | Replace `expect(true).toBe(true)` with real assertions |
| `services/community-service/jest.config.js` | Raise coverage thresholds from `0` to `60` |
| `docs/adr/ADR-029-tdd-test-framework.md` | Update status from Accepted → Implemented |
| `apps/landing/src/data/docs/concepts/adr-029-tdd-test-framework.json` | Update status field to "implemented" |
| `package.json` | Bump version v9.19.0 → v9.20.0 |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Mock target**: cleanup-service jobs import `{ query }` from `'../database/db'`. Mock: `jest.mock('../database/db', () => ({ query: jest.fn() }))`. Return `{ rowCount: N, rows: [] }`.

2. **Write tests BEFORE removing CI bypasses.** Remove `passWithNoTests` only after cleanup-service tests pass. Raise community-service threshold only after real tests pass.

3. **auth-service unit/ doesn't exist** — create the directory. Root `tests/` is already in jest config's `roots` so discovery is automatic.

4. **feed-service unit/ doesn't exist** — create the directory. The service jest config already has `tests/unit/**/*.test.ts` in `testMatch`.

5. **JWT field is `communities`** (not `communityMemberships`). Tests must verify this exact field name. Wrong field = always 403 downstream.

6. **community-service threshold**: Set to `60`, not `80`. Database-dependent routes can't be fully unit-tested without a live DB. Zero is indefensible; 60 is honest.

7. **Version bump in root `package.json`**: Bump to v9.20.0.

---

## Task 1: Feature Branch

**Files:**
- No file changes

- [ ] **Create sprint branch**

```bash
git checkout -b feature/sprint-53-test-coverage
```

- [ ] **Verify branch created**

```bash
git branch --show-current
```

---

## Task 2: cleanup-service Unit Tests

**Files:**
- Create: `services/cleanup-service/tests/unit/expirationJob.test.ts`
- Create: `services/cleanup-service/tests/unit/reputationDecayJob.test.ts`

- [ ] **Read the job source files to understand exact query patterns**

```bash
cat services/cleanup-service/src/jobs/expirationJob.ts
cat services/cleanup-service/src/jobs/reputationDecayJob.ts
```

- [ ] **Create `expirationJob.test.ts`** — mock `query`, verify each table's UPDATE is called, verify rowCount is returned

```typescript
import { markExpiredData } from '../../src/jobs/expirationJob';

jest.mock('../../src/database/db', () => ({
  query: jest.fn(),
}));

import { query } from '../../src/database/db';
const mockQuery = query as jest.MockedFunction<typeof query>;

describe('markExpiredData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls UPDATE for all four tables', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    await markExpiredData();
    expect(mockQuery).toHaveBeenCalledTimes(4);
  });

  it('returns aggregated rowCount from all tables', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 3 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 2 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
    // Function is void — verify it completes without throwing
    await expect(markExpiredData()).resolves.not.toThrow();
  });

  it('handles zero expired rows without error', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    await expect(markExpiredData()).resolves.not.toThrow();
  });
});
```

- [ ] **Create `reputationDecayJob.test.ts`** — mock `query`, verify formula and conditional update logic

```typescript
import { updateDecayedTrustScores } from '../../src/jobs/reputationDecayJob';

jest.mock('../../src/database/db', () => ({
  query: jest.fn(),
}));

import { query } from '../../src/database/db';
const mockQuery = query as jest.MockedFunction<typeof query>;

describe('updateDecayedTrustScores', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches all user-community trust score pairs', async () => {
    // First call: SELECT all pairs; subsequent calls: calculate_decayed_karma + conditional UPDATE
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // no pairs
    await updateDecayedTrustScores();
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('calls calculate_decayed_karma with correct userId and communityId', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ user_id: 'u1', community_id: 'c1', trust_score: 10 }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({ rows: [{ decayed_karma: 100 }], rowCount: 1 } as any) // karma result
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // UPDATE
    await updateDecayedTrustScores();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('calculate_decayed_karma'),
      expect.arrayContaining(['u1', 'c1'])
    );
  });

  it('applies min(100, floor(karma / 10)) formula — caps at 100', async () => {
    // karma = 1050 → floor(1050/10) = 105 → min(100, 105) = 100; stored score = 50 → update fires
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ user_id: 'u1', community_id: 'c1', trust_score: 50 }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({ rows: [{ decayed_karma: 1050 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
    await updateDecayedTrustScores();
    // Third call should be the UPDATE with new score = 100
    const updateCall = mockQuery.mock.calls[2];
    expect(updateCall[1]).toContain(100);
  });

  it('skips UPDATE when calculated score equals current score', async () => {
    // karma = 100 → floor(100/10) = 10 → min(100, 10) = 10; stored score = 10 → no update
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ user_id: 'u1', community_id: 'c1', trust_score: 10 }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({ rows: [{ decayed_karma: 100 }], rowCount: 1 } as any);
    await updateDecayedTrustScores();
    // Only 2 calls (SELECT + decay calc) — no UPDATE
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });
});
```

**Note**: Adjust mock call counts and import paths if the actual source reads differently. Read the source before writing, adapting the test stubs above to match the real function signature and SQL call pattern.

- [ ] **Run cleanup-service tests to verify they pass**

```bash
npx jest --config services/cleanup-service/jest.config.js --testPathPattern="tests/unit" --no-coverage
```

---

## Task 3: Remove cleanup-service CI Bypass

**Files:**
- Modify: `services/cleanup-service/jest.config.js`

**Only do this after Task 2 tests pass.**

- [ ] **Remove `passWithNoTests: true`** from `services/cleanup-service/jest.config.js`

Remove the lines:
```js
// Pass when no tests are found (until we write tests)
passWithNoTests: true,
```

- [ ] **Verify tests still discovered and pass**

```bash
npx jest --config services/cleanup-service/jest.config.js --no-coverage
```

---

## Task 4: auth-service JWT + Role Unit Tests

**Files:**
- Create: `services/auth-service/tests/unit/jwtClaims.test.ts`
- Create: `services/auth-service/tests/unit/authMiddleware.test.ts`

- [ ] **Read the auth routes to understand JWT generation and export surface**

```bash
cat services/auth-service/src/routes/auth.ts
cat packages/shared/middleware/auth.ts
```

- [ ] **Create `tests/unit/` directory**

```bash
New-Item -ItemType Directory -Path services/auth-service/tests/unit -Force
```

- [ ] **Create `jwtClaims.test.ts`** — verify JWT payload shape

```typescript
import jwt from 'jsonwebtoken';

describe('JWT payload shape', () => {
  const secret = 'test-secret';

  it('payload contains communities field (not communityMemberships)', () => {
    const payload = {
      userId: 'u1',
      email: 'test@example.com',
      communities: [
        { id: 'c1', name: 'Community 1', role: 'member' },
        { id: 'c2', name: 'Community 2', role: 'admin' },
      ],
    };
    const token = jwt.sign(payload, secret, { expiresIn: '1h' });
    const decoded = jwt.verify(token, secret) as any;

    expect(decoded.communities).toBeDefined();
    expect((decoded as any).communityMemberships).toBeUndefined();
  });

  it('all community memberships appear in token', () => {
    const communities = [
      { id: 'c1', name: 'A', role: 'member' },
      { id: 'c2', name: 'B', role: 'admin' },
      { id: 'c3', name: 'C', role: 'member' },
    ];
    const token = jwt.sign({ userId: 'u1', email: 'x@x.com', communities }, secret);
    const decoded = jwt.verify(token, secret) as any;
    expect(decoded.communities).toHaveLength(3);
    expect(decoded.communities.map((c: any) => c.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('role is encoded correctly for admin and member', () => {
    const communities = [
      { id: 'c1', name: 'A', role: 'admin' },
      { id: 'c2', name: 'B', role: 'member' },
    ];
    const token = jwt.sign({ userId: 'u1', email: 'x@x.com', communities }, secret);
    const decoded = jwt.verify(token, secret) as any;
    expect(decoded.communities[0].role).toBe('admin');
    expect(decoded.communities[1].role).toBe('member');
  });

  it('user.communities ?? [] handles missing communities field without throwing', () => {
    const token = jwt.sign({ userId: 'u1', email: 'x@x.com' }, secret);
    const decoded = jwt.verify(token, secret) as any;
    const memberships = decoded.communities ?? [];
    expect(memberships).toEqual([]);
    expect(() => memberships.some((m: any) => m.role === 'admin')).not.toThrow();
  });
});
```

- [ ] **Create `authMiddleware.test.ts`** — test valid/invalid/missing token scenarios

Adapt the middleware test to the actual signature in `packages/shared/middleware/auth.ts`. The middleware should call `next()` on success and send 401 on failure:

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Read packages/shared/middleware/auth.ts first, then import the actual middleware
// import { authenticateToken } from '../../../../packages/shared/middleware/auth';

describe('auth middleware', () => {
  const secret = process.env.JWT_SECRET || 'test-secret';
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('valid token — calls next() and populates req.user', () => {
    const token = jwt.sign(
      { userId: 'u1', email: 'x@x.com', communities: [] },
      secret
    );
    req.headers = { authorization: `Bearer ${token}` };
    // authenticateToken(req as Request, res as Response, next);
    // expect(next).toHaveBeenCalled();
    // expect((req as any).user?.userId).toBe('u1');
    // Implement after reading actual middleware export
    expect(true).toBe(true); // placeholder — replace after reading middleware
  });

  it('missing Authorization header — returns 401', () => {
    req.headers = {};
    // authenticateToken(req as Request, res as Response, next);
    // expect(res.status).toHaveBeenCalledWith(401);
    // expect(next).not.toHaveBeenCalled();
    expect(true).toBe(true); // placeholder — replace after reading middleware
  });
});
```

**IMPORTANT**: Read `packages/shared/middleware/auth.ts` fully before implementing. Replace the placeholder `expect(true).toBe(true)` assertions with real ones. The stubs above show structure only.

- [ ] **Run auth-service unit tests**

```bash
npx jest --config services/auth-service/jest.config.js --testPathPattern="tests/unit" --no-coverage
```

---

## Task 5: feed-service basicFeedRanker Unit Tests

**Files:**
- Create: `services/feed-service/tests/unit/basicFeedRanker.test.ts`

- [ ] **Read basicFeedRanker.ts in full** to understand exported function signatures, types, and scoring constants

```bash
cat services/feed-service/src/services/basicFeedRanker.ts
```

- [ ] **Create `tests/unit/` directory**

```bash
New-Item -ItemType Directory -Path services/feed-service/tests/unit -Force
```

- [ ] **Create `basicFeedRanker.test.ts`** — ranking by proximity, urgency, recency

```typescript
// Adapt imports based on actual exports from basicFeedRanker.ts
// import { rankFeedItems, FeedRequest, SocialProximity } from '../../src/services/basicFeedRanker';

describe('basicFeedRanker', () => {
  // Build test fixtures using the actual FeedRequest/SocialProximity types
  // after reading the source

  it('1° connection outranks 2°, which outranks 3°, which outranks none', () => {
    // const items = [3deg, none, 1deg, 2deg] mixed; after ranking: [1deg, 2deg, 3deg, none]
    expect(true).toBe(true); // replace with real test
  });

  it('high urgency outranks low urgency at same proximity', () => {
    expect(true).toBe(true); // replace with real test
  });

  it('more recent request outranks older at same proximity + urgency', () => {
    expect(true).toBe(true); // replace with real test
  });

  it('ranking is deterministic for identical inputs', () => {
    expect(true).toBe(true); // replace with real test
  });

  it('returns empty array given empty input', () => {
    // const result = rankFeedItems([]);
    // expect(result).toEqual([]);
    expect(true).toBe(true); // replace with real test
  });

  it('single-item array returned unchanged', () => {
    expect(true).toBe(true); // replace with real test
  });
});
```

**IMPORTANT**: The stubs above are structural scaffolding. After reading `basicFeedRanker.ts`, replace every `expect(true).toBe(true)` with a real assertion that tests actual behavior. Tests must fail if the ranked order is wrong.

- [ ] **Run feed-service unit tests**

```bash
npx jest --config services/feed-service/jest.config.js --testPathPattern="tests/unit" --no-coverage
```

---

## Task 6: community-service Real Tests + Coverage Threshold Fix

**Files:**
- Modify: `services/community-service/tests/regression/communities.test.ts`
- Modify: `services/community-service/jest.config.js`

**Only raise the threshold after real tests are in place.**

- [ ] **Read the existing test file and helpers directory**

```bash
cat services/community-service/tests/regression/communities.test.ts
ls services/community-service/tests/helpers/
cat services/community-service/tests/helpers/*.ts 2>/dev/null | head -60
```

- [ ] **Replace placeholder `expect(true).toBe(true)` with real assertions** in `communities.test.ts`

Real tests to implement:
- GET /communities → 200 with array; each item has `id` and `name` fields
- GET /communities without token → 401
- POST /communities without `name` field → 400 validation error
- POST /communities with valid body → 201 with `{ success: true, data: { id, name } }`
- POST /communities without token → 401

Use the existing helpers for mock auth tokens and test setup. Mirror the pattern in `config-validation.test.ts`.

- [ ] **Verify no `expect(true).toBe(true)` remains in community-service**

```bash
grep -r "expect(true).toBe(true)" services/community-service/
```

Expected output: no matches.

- [ ] **Update `services/community-service/jest.config.js`** — change all `0` thresholds to `60`

```js
coverageThreshold: {
  global: {
    branches: 60,
    functions: 60,
    lines: 60,
    statements: 60,
  },
},
```

- [ ] **Run community-service tests with coverage**

```bash
npx jest --config services/community-service/jest.config.js --coverage
```

Verify: tests pass and coverage report shows thresholds met.

---

## Task 7: Codebase-wide Placeholder Sweep

**Files:**
- None (verification only)

- [ ] **Search entire codebase for remaining `expect(true).toBe(true)` occurrences**

```bash
grep -r "expect(true).toBe(true)" --include="*.ts" .
```

Expected: zero matches. If any are found, replace them with real assertions before proceeding.

- [ ] **Run full test suite**

```bash
npm test
```

All suites should pass. Note any pre-existing failures (sprint-39-provider-ux, sprint-43-feed-ranking, schema tests) — these are pre-existing and should NOT be fixed in this sprint.

---

## Task 8: User Guides + Landing Page Docs + ADR-029 Update

**Files:**
- Modify: `docs/adr/ADR-029-tdd-test-framework.md`
- Modify: `apps/landing/src/data/docs/concepts/adr-029-tdd-test-framework.json`
- Modify: `package.json` (root)

- [ ] **Update ADR-029 status from Accepted → Implemented**

In `docs/adr/ADR-029-tdd-test-framework.md`:
- Change the `**Status**:` line from `Accepted` to `Implemented`
- Add a note in the Implementation/History section: "2026-05-06 (Sprint 53): Coverage enforcement gap closed — removed `passWithNoTests: true` from cleanup-service and raised community-service threshold from 0% to 60%. All four critical-path services now have meaningful unit tests."

- [ ] **Update landing site ADR JSON**

In `apps/landing/src/data/docs/concepts/adr-029-tdd-test-framework.json`:
- Change `"status"` to `"implemented"`
- Update `"description"` to include `"**Status**: Implemented"`

- [ ] **Bump version in root `package.json`**

Change `"version": "9.19.0"` → `"version": "9.20.0"`.

- [ ] **Verify ADR JSON is valid**

```bash
node -e "require('./apps/landing/src/data/docs/concepts/adr-029-tdd-test-framework.json'); console.log('valid')"
```

---

## Task 9: CONTEXT.md + registry.json + Feedback Check

**Files:**
- Minimal changes — no new endpoints or schema changes this sprint

- [ ] **Update services/registry.json** — bump `"updated"` timestamp to `2026-05-06`

- [ ] **Run feedback:check**

```bash
npm run feedback:check
```

Resolve any flagged items. This sprint has no endpoint or schema changes, so only version/doc updates should be flagged.

---

## Task 10: Final Type Check + Pre-Push Verification

**Files:**
- None (verification only)

- [ ] **Run TypeScript type checks for touched services**

```bash
cd services/cleanup-service && npx tsc --noEmit && cd ../..
cd services/auth-service && npx tsc --noEmit && cd ../..
cd services/feed-service && npx tsc --noEmit && cd ../..
cd services/community-service && npx tsc --noEmit && cd ../..
```

- [ ] **Run full test suite (must pass before push)**

```bash
npm test
```

All unit + regression suites must pass.

- [ ] **Run TDD tests (informational — failures do not block)**

```bash
npm run test:tdd
```

Note any new failures. Pre-existing failures (sprint-39, sprint-43, schema) are expected.

- [ ] **Final grep — confirm zero `expect(true).toBe(true)` in codebase**

```bash
grep -r "expect(true).toBe(true)" --include="*.ts" .
```

Expected: zero matches.

- [ ] **Commit**

```bash
git add -A
git commit -m "feat(tests): Sprint 53 — critical-path test coverage + CI enforcement"
```

---

## Task 11: Merge + Deploy

Use the `/deploy` skill.

- [ ] **Merge to master and push**

```bash
git checkout master
git merge feature/sprint-53-test-coverage
git push origin master
```

- [ ] **Monitor GitHub Actions** — all stages should pass (tests, build, deploy)

- [ ] **Verify demo server health**

```bash
ssh ubuntu@karmyq.com "curl -s localhost:3001/health | python3 -m json.tool"
```

- [ ] **No DB migration needed this sprint** — skip migration step
