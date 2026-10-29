# BUG-077 Completion Side Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** a completed exchange's reputation job succeeds on its first attempt and runs every live side effect: the
badge insert supplies `reputation.badges.name`, only a karma failure can fail the job, and trust evolution nudges
compute on numbers.

**Architecture:** three reputation-service edits: `badgeService.ts` (name map, truthful report), `subscriber.ts` (two
try/catch blocks after karma) and `trustEvolutionService.ts` (one `Number()` coercion). No schema, endpoint, event,
queue, dependency or client change.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*.

**Spec:** [`docs/superpowers/specs/2026-10-29-sprint-134-pr-bug-077-badge-insert-design.md`](../specs/2026-10-29-sprint-134-pr-bug-077-badge-insert-design.md)

**Branch:** `agent/claude/sprint-134-pr-bug-077-badge-insert` (exists, pushed, cut from `origin/master` `ae9f8957`).
**Version:** 11.105.0 → 11.106.0, **provisional**: re-derive from `origin/master`'s `package.json` at merge time.
**Rules (maintainer):** no demo-host operation, merge or CodeQL dismissal without explicit per-operation authorization;
no dependency or lockfile change beyond the root version; push and leave the tree clean at every stopping point.
**Tag:** `no-deploy` in this chat cadence: the chat stops at PR creation (maintainer rule, 2026-10-22); the maintainer
merges; the next chat records the deploy.

**Planning dry run (2026-10-29, all edits restored, nothing committed):** the three tdd files below are **8 red / 1
green** on `ae9f8957` (the green one is the preservation case), each red on the defect: the INSERT without `name`,
`['first_helper']` reported for an absorbed insert, the job rejecting on a badge or provider failure, and `NaN` in the
upsert. With Tasks 4–6's code applied verbatim: the tdd files plus `tests/regression/sprint-126-subscriber-boundary.test.ts`
and `sprint-133-pr-q-consumer-queue.test.ts` pass **18/18** (4 runs, one with `--no-cache`); reputation-service
`npm test` passes (unit 5, regression 334 + 3 todo); the root `unit/reputation/prestige-badges`, `trustEvolutionService`,
`fractalFeed`, `provider-completion-rate`, `regression/sprint-133-pr-q-event-routes` and `sprint-134-pr-k-claim-gate`
pass **80/80**; reputation-service `tsc` exits 0. The integration file type-checks (`tsc --listFilesOnly` includes it
and `badgeService.ts`; the tests project's 70 pre-existing errors are elsewhere). One run, the first right after the
edits, reported a suite that failed to run with no failed test; its output was not captured and it did not reproduce.
**Capture every run to a file**, never only through `grep | head`. **The real-SQL test was not run** (no local Docker;
CI-only).

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `services/reputation-service/tests/tdd/sprint-134-bug-077-badge-insert.test.ts` | Every insert supplies the name; exact names; an absorbed insert is not reported |
| `services/reputation-service/tests/tdd/sprint-134-bug-077-handler-isolation.test.ts` | A badge or provider failure does not fail the job; evolution still runs; karma failure still fails first |
| `services/reputation-service/tests/tdd/sprint-134-bug-079-evolution-numeric.test.ts` | Nudges compute on pg's NUMERIC strings |
| `tests/integration/sprint-134-bug-077-completion-side-effects.integration.test.ts` | Real SQL + Bull: job completes on attempt 1, badge row, evolution row; injected badge failure; all five types |

### Existing files to modify
| File | Change |
|------|--------|
| `package.json`, `package-lock.json` | Root version 11.105.0 → 11.106.0 (3 lines) |
| `services/reputation-service/src/services/badgeService.ts` | `BADGE_NAMES`; insert supplies `name`; report only real inserts |
| `services/reputation-service/src/events/subscriber.ts` | Own try/catch for the provider completion rate and the badge check |
| `services/reputation-service/src/services/trustEvolutionService.ts` | `Number()` on the current value (BUG-079) |
| `tests/integration/sprint-134-bug-074-match-status-guards.integration.test.ts` | Cleanup comment no longer blames BUG-077 |
| `docs/guides/understanding-karma-guide.md` | *Trust Model Evolution*: how it switches on and what it does |
| `docs/adr/ADR-016-prestige-based-recognition.md` | Amendment: Phase 1 badges were never written until this fix |
| `services/reputation-service/CONTEXT.md` | Recent Changes; badges DDL; the stale "Implement Badge System" sample |
| `services/reputation-service/README.md`, `docs/ARCHITECTURE.md` | Badges columns |
| `services/registry.json` | `services['reputation-service'].notes` sentence |
| `docs/BUGS.md` | BUG-077 and BUG-079 fixed (BUG-080 already logged at planning) |
| `apps/landing/src/data/docs/**` | Regenerated pages (ADR-016, reputation service), churn reverted |
| `.claude/handoff/CURRENT_HANDOFF.md` | BUG-077 state |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Read the schema, not the code.** `reputation.badges` is `id, user_id, name NOT NULL, description, icon_url,
   earned_at, badge_type, community_id` (`init.sql:2093-2102`). Migration 024's DDL is not the table.
2. **No migration and no `init.sql` edit.** The fix is in the insert. `init.sql` is generated; never hand-edit it.
3. **Names are pinned by tests:** `first_helper` 'First help given', `milestone_10` 'Helped 10 times', `milestone_50`
   'Helped 50 times', `milestone_100` 'Helped 100 times', `connector` 'Helped 10 different people'. `BADGE_NAMES` is a
   `Record<BadgeType, string>`, so a new type without a name fails `tsc`.
4. **Report only real inserts:** `if (result.rowCount === 0) continue;` before pushing to the returned list and
   logging. `rowCount === 0`, not `!rowCount`: the root `tests/unit/reputation/prestige-badges.test.ts:63` mocks inserts
   without `rowCount`, and those must still count.
5. **Karma keeps its rethrow and runs first.** Only the projector may fail the job. Never move badges or the provider
   update before karma, and never wrap karma in a catch that swallows.
6. **Each side effect gets its own try/catch** inside the existing outer `try`. Do not restructure or re-indent the
   trust-evolution block. Log prefix, the match id, then the error:
   `console.error('[badges] badge check failed, skipping:', match_id, err)`.
7. **BUG-079 is one coercion at the use site**: `Number(effectiveParams[parameter])` in `evaluateUserEvolution`. Do
   not change the DB helpers or `getUserEffectiveParams`; that changes `GET /reputation/trust-config`'s wire format.
8. **Mocks must return what pg returns.** The BUG-079 tdd file feeds NUMERIC values as strings (`'0.60'`, `'0.50'`).
   Root `jest.config.js` has `resetMocks: true`, which wipes a module-scope `jest.fn(impl)`; use plain functions in
   `jest.mock` factories, or set implementations in `beforeEach` (`sprint-126-subscriber-boundary.test.ts:19-20`).
9. **The real-SQL test is CI-only on this Windows box** (no local Docker). It must type-check
   (`npx tsc --noEmit -p tests/tsconfig.json`, no diagnostics naming the file). Missing infrastructure fails, never
   skips.
10. **Fixture facts, from `init.sql`:** no trigger creates `communities.community_configs`, so insert one row
    (defaults give `community_evolution_enabled true`, `trust_depth_weight 0.60`). Opt the helper in over HTTP with
    `PUT /reputation/trust-config/:userId/:communityId` `{ evolution_enabled: true }`. `help_requests.request_type` and
    `visibility_scope` are enums: in an `INSERT ... SELECT` leave them to their defaults (a text literal in a SELECT
    list will not assign to an enum). Cast status parameters (`$n::varchar`). `karma_records.community_id` has no ON
    DELETE CASCADE (`init.sql:6145`): delete karma before the community.
11. **Read the job, never sleep for it:** `getJob('completion-<match id>')` on `karmyq-completion-reputation`, poll its
    state until `completed` or `attemptsMade > 0`, then assert `{ state: 'completed', attemptsMade: 0, failedReason:
    null, stacktrace: [] }`. Close every Bull queue the test opens, remove the delayed `karmyq-community-evolution` job
    (`jobId` = the community id, `trustEvolutionService.ts:151-158`), and end the reputation-service pool the direct case
    imported (`sprint-126-standing-backfill.integration.test.ts:175-176`).
12. **The injected badge failure is scoped and always dropped:** a `BEFORE INSERT` trigger on `reputation.badges`
    raising only for that case's helper id, dropped in `finally` after the job is read (pattern:
    `sprint-132-directed-audience.integration.test.ts:234-253`).
13. **Tests first:** reputation-service `tests/tdd/` (red), then the code; promote with
    `node scripts/promote-tdd-tests.js` (`.npmrc` sets `ignore-scripts`, so `npm test` never runs it) and restore every
    unrelated file it sweeps (`services/reputation-service/tests/tdd/sprint-125-provider-reputation-auth.test.ts` is
    already there).
14. **No dependency or lockfile change** beyond the root version: `package.json` and the two root `"version"` lines in
    `package-lock.json`.
15. **No JWT claim reads, no new routes.** The claim gate (`tests/regression/sprint-134-pr-k-claim-gate.test.ts`) must
    stay green; this PR touches no route.
16. **Ask before** any merge ("admin merge, yes/no?"), any demo-host operation, any CodeQL dismissal. No ADR number is
    needed (ADR-016 amendment).

---

## Task 1: Branch check and provisional version bump

**Files:**
- Modify: `package.json`, `package-lock.json` (root `"version"` lines only)

- [ ] **Check the base.** `git fetch origin`, `git status --short` (clean), `git branch --show-current`
  (`agent/claude/sprint-134-pr-bug-077-badge-insert`), `git log --oneline origin/master -3`. If master moved past
  `ae9f8957`, merge it in with a merge commit (never rebase, never force-push) and re-derive the version.
- [ ] **Bump 11.105.0 → 11.106.0** in `package.json` and the two root `"version"` lines of `package-lock.json`
  (`package-lock.json:3` and `:9`, as in `d8da50f0` and `ae9f8957`). Edit them; never run `npm install`.

```bash
node -e "for (const f of ['package.json','package-lock.json']) { const j = require('./' + f); console.log(f, j.version, j.packages?.['']?.version ?? '') }"
git diff --stat   # exactly 2 files, 3 changed lines
```

- [ ] **Commit:** `chore: v11.106.0 (provisional) for BUG-077`.

---

## Task 2: Reputation-service TDD tests (red)

**Files:**
- Create: `services/reputation-service/tests/tdd/sprint-134-bug-077-badge-insert.test.ts`
- Create: `services/reputation-service/tests/tdd/sprint-134-bug-077-handler-isolation.test.ts`
- Create: `services/reputation-service/tests/tdd/sprint-134-bug-079-evolution-numeric.test.ts`

- [ ] **Write `sprint-134-bug-077-badge-insert.test.ts`:**

```ts
/**
 * Sprint 134 BUG-077: every badge insert supplies reputation.badges.name, which is NOT NULL. The table predates
 * migration 024, whose CREATE TABLE IF NOT EXISTS never ran (init.sql `CREATE TABLE reputation.badges`). A conflict
 * that inserts nothing is not reported as awarded.
 *
 * The SQL here is mocked; the real table is exercised by the root
 * tests/integration/sprint-134-bug-077-completion-side-effects.integration.test.ts (CI-only on Windows).
 */
const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...a: unknown[]) => mockQuery(...a) }));

import { BADGE_TYPES, checkAndAwardBadges } from '../../src/services/badgeService';

const INSERT = 'INSERT INTO reputation.badges (user_id, badge_type, name) VALUES ($1, $2, $3) ON CONFLICT (user_id, badge_type) DO NOTHING';

function db(opts: { completed: number; distinct: number; existing?: string[]; rowCount?: (badgeType: string) => number }) {
  mockQuery.mockImplementation(async (sql: string, params: unknown[]) => {
    if (sql.includes('completed_as_helper')) {
      return { rows: [{ completed_as_helper: String(opts.completed), distinct_people_helped: String(opts.distinct) }] };
    }
    if (sql.includes('FROM reputation.badges')) return { rows: (opts.existing ?? []).map((badge_type) => ({ badge_type })) };
    if (sql.includes('INSERT INTO reputation.badges')) return { rows: [], rowCount: opts.rowCount ? opts.rowCount(params[1] as string) : 1 };
    throw new Error(`unexpected query: ${sql}`);
  });
}

const inserts = () => mockQuery.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO reputation.badges'));

describe('BUG-077 badge insert', () => {
  it('inserts every newly earned badge type with its display name', async () => {
    db({ completed: 100, distinct: 10 });

    expect(await checkAndAwardBadges('u1')).toEqual([...BADGE_TYPES]);

    for (const [sql] of inserts()) expect(String(sql).replace(/\s+/g, ' ').trim()).toBe(INSERT);
    expect(inserts().map(([, params]) => params)).toEqual([
      ['u1', 'first_helper', 'First help given'],
      ['u1', 'milestone_10', 'Helped 10 times'],
      ['u1', 'milestone_50', 'Helped 50 times'],
      ['u1', 'milestone_100', 'Helped 100 times'],
      ['u1', 'connector', 'Helped 10 different people'],
    ]);
  });

  it('does not report a badge whose insert the unique key absorbed', async () => {
    db({ completed: 1, distinct: 1, rowCount: () => 0 });

    expect(await checkAndAwardBadges('u1')).toEqual([]);
    expect(inserts()).toHaveLength(1);
  });

  it('reports only the badges it inserted', async () => {
    db({ completed: 10, distinct: 2, rowCount: (badgeType) => (badgeType === 'first_helper' ? 0 : 1) });

    expect(await checkAndAwardBadges('u1')).toEqual(['milestone_10']);
  });
});
```

- [ ] **Write `sprint-134-bug-077-handler-isolation.test.ts`** (harness from
  `tests/regression/sprint-126-subscriber-boundary.test.ts`):

```ts
/**
 * Sprint 134 BUG-077: in the match_completed handler, only a karma projection failure may fail the job. Karma commits
 * first in its own transaction and replays idempotently (ADR-096); a rethrow from a later step made Bull re-run the
 * whole job ten times and skipped every step after it. Badges and the provider completion rate are recomputed from
 * history on the helper's next completion, so each logs its own failure and the handler carries on.
 */
type Handler = (job: { data: unknown }) => Promise<unknown>;
const handlers: Record<string, Handler> = {};

// A plain constructor, not jest.fn(impl): the root config's resetMocks would wipe the implementation.
jest.mock('bull', () => function MockBull() {
  return {
    process: (nameOrFn: unknown, fn?: Handler) => {
      if (typeof nameOrFn === 'string' && fn) handlers[nameOrFn] = fn;
      else handlers.__default = nameOrFn as Handler;
    },
    on: () => undefined,
    add: () => undefined,
    close: () => undefined,
  };
});

const mockAward = jest.fn();
const mockProviderRate = jest.fn();
const mockBadges = jest.fn();
const mockEvaluateEvolution = jest.fn();
const mockQuery = jest.fn();

jest.mock('../../src/services/standingProjector', () => ({
  awardKarmaForCompletedMatch: (...a: unknown[]) => mockAward(...a),
}));
jest.mock('../../src/services/providerTrustService', () => ({
  updateProviderCompletionRate: (...a: unknown[]) => mockProviderRate(...a),
}));
jest.mock('../../src/services/badgeService', () => ({
  checkAndAwardBadges: (...a: unknown[]) => mockBadges(...a),
}));
jest.mock('../../src/services/trustEvolutionService', () => ({
  evaluateUserEvolution: (...a: unknown[]) => mockEvaluateEvolution(...a),
  EVOLUTION_SIGNALS: {
    CROSS_COMMUNITY_MATCH_COMPLETED: 'cross_community_match_completed',
    REPEAT_INTERACTION_SAME_PERSON: 'repeat_interaction_same_person',
    DIVERSE_COMMUNITY_INTERACTIONS: 'diverse_community_interactions',
  },
}));
jest.mock('../../src/database/trustEvolutionDb', () => ({
  isCrossCommunityParticipant: async () => false,
  getDiverseCommunityCount: async () => 0,
}));
jest.mock('../../src/services/communityEvolutionService', () => ({
  applyCommunityEvolution: async () => undefined,
}));
jest.mock('../../src/database/db', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
}));

const PAYLOAD = {
  match_id: 'match-1',
  request_id: 'request-1',
  requester_id: 'requester-1',
  responder_id: 'helper-1',
  completed_at: '2026-10-29T10:00:00.000Z',
};

async function deliver() {
  const { initEventSubscriber } = require('../../src/events/subscriber');
  await initEventSubscriber();
  return handlers.match_completed({ data: { payload: PAYLOAD } });
}

let errors: jest.SpyInstance;

beforeEach(() => {
  mockAward.mockResolvedValue({ matchId: 'match-1', communityIds: ['community-1'], insertedKarmaRows: 3, insertedActivityRows: 2 });
  mockProviderRate.mockResolvedValue(undefined);
  mockBadges.mockResolvedValue([]);
  mockEvaluateEvolution.mockResolvedValue(undefined);
  // The evolution block's own reads: the helper's request community, and a third completed exchange with this requester.
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM requests.request_communities rc')) return { rows: [{ community_id: 'community-1' }] };
    if (sql.includes('COUNT(*) AS cnt')) return { rows: [{ cnt: '3' }] };
    throw new Error(`unexpected query: ${sql}`);
  });
  errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

const evolutionRan = () => expect(mockEvaluateEvolution).toHaveBeenCalledWith(
  'helper-1', 'community-1', 'repeat_interaction_same_person', { triggerEventId: 'match-1' });
const karmaBlamed = () => errors.mock.calls.some(([first]) => String(first).includes('Failed to award karma'));

describe('BUG-077 match_completed side-effect isolation', () => {
  it('finishes the job when the badge check fails, logs it as a badge failure, and still runs trust evolution', async () => {
    const failure = new Error('badge insert failed');
    mockBadges.mockRejectedValue(failure);

    await expect(deliver()).resolves.toBeUndefined();

    evolutionRan();
    expect(errors).toHaveBeenCalledWith('[badges] badge check failed, skipping:', 'match-1', failure);
    expect(karmaBlamed()).toBe(false);
  });

  it('finishes the job when the provider completion rate fails, and still runs badges and trust evolution', async () => {
    const failure = new Error('provider update failed');
    mockProviderRate.mockRejectedValue(failure);

    await expect(deliver()).resolves.toBeUndefined();

    expect(mockBadges).toHaveBeenCalledWith('helper-1');
    evolutionRan();
    expect(errors).toHaveBeenCalledWith('[provider-trust] completion rate update failed, skipping:', 'match-1', failure);
    expect(karmaBlamed()).toBe(false);
  });

  // Preservation: passes against the old handler too. Only karma may fail the job, and it fails before any side effect.
  it('still fails the job on a karma projection failure, before any side effect', async () => {
    mockAward.mockRejectedValue(new Error('projection failed'));

    await expect(deliver()).rejects.toThrow('projection failed');

    expect(mockProviderRate).not.toHaveBeenCalled();
    expect(mockBadges).not.toHaveBeenCalled();
    expect(mockEvaluateEvolution).not.toHaveBeenCalled();
  });
});
```

- [ ] **Write `sprint-134-bug-079-evolution-numeric.test.ts`:**

```ts
/**
 * Sprint 134 BUG-079: pg returns NUMERIC columns as strings (pg-types registers no parser for OID 1700), so the
 * community default depth weight arrives as "0.60" and a member's prior as "0.50". evaluateUserEvolution added the
 * nudge to that string ("0.600.01"), clamp() made it NaN, and the write was rejected. The mocks below return exactly
 * what pg returns; the older unit tests (tests/unit/reputation/trustEvolutionService.test.ts) return numbers, which
 * is how this hid.
 */
jest.mock('bull', () => function MockBull() {
  return { add: () => Promise.resolve(), on: () => undefined };
});

const mockUpsert = jest.fn();
const mockLog = jest.fn();
let mockPrior = '0.50';

jest.mock('../../src/database/trustEvolutionDb', () => ({
  // A member who switched evolution on: the row exists, its weights inherit the community's (NULL).
  getUserTrustConfig: async () => ({
    user_id: 'u1', community_id: 'c1', depth_weight: null, breadth_weight: null,
    cross_community_prior: mockPrior, evolution_enabled: true,
  }),
  upsertUserTrustConfig: (...a: unknown[]) => mockUpsert(...a),
  insertEvolutionLog: (...a: unknown[]) => mockLog(...a),
  getLastEvolutionForParameter: async () => null,
  getCommunityEvolutionConfig: async () => ({ community_evolution_enabled: true, cross_community_prior: '0.50' }),
  getGlobalEvolutionPreference: async () => true,
}));
// getUserEffectiveParams reads only these two fields (trustEvolutionService.ts), raw from trust_depth_weight /
// trust_breadth_weight (trustConfigDb.ts).
jest.mock('../../src/database/trustConfigDb', () => ({
  getCommunityTrustConfig: async () => ({ depth_weight: '0.60', breadth_weight: '0.40' }),
}));
jest.mock('../../src/services/effectiveParamsCache', () => ({
  invalidateEffectiveParamsCache: async () => undefined,
}));

import { evaluateUserEvolution, EVOLUTION_SIGNALS } from '../../src/services/trustEvolutionService';

beforeEach(() => {
  mockPrior = '0.50';
  mockUpsert.mockResolvedValue(undefined);
  mockLog.mockResolvedValue(undefined);
});

describe('BUG-079 trust evolution on NUMERIC strings', () => {
  it('nudges depth weight from the community default "0.60" to 0.61', async () => {
    await evaluateUserEvolution('u1', 'c1', EVOLUTION_SIGNALS.REPEAT_INTERACTION_SAME_PERSON, { triggerEventId: 'm1' });

    expect(mockUpsert.mock.calls).toEqual([['u1', 'c1', { depth_weight: 0.61 }]]);
    expect(mockLog.mock.calls).toEqual([[{
      user_id: 'u1', community_id: 'c1', parameter: 'depth_weight', old_value: 0.6, new_value: 0.61,
      trigger_signal: 'repeat_interaction_same_person', trigger_event_id: 'm1',
    }]]);
  });

  it('nudges the cross-community prior from "0.50" to 0.51', async () => {
    await evaluateUserEvolution('u1', 'c1', EVOLUTION_SIGNALS.CROSS_COMMUNITY_MATCH_COMPLETED, { triggerEventId: 'm2' });

    expect(mockUpsert.mock.calls).toEqual([['u1', 'c1', { cross_community_prior: 0.51 }]]);
    expect(mockLog.mock.calls).toEqual([[{
      user_id: 'u1', community_id: 'c1', parameter: 'cross_community_prior', old_value: 0.5, new_value: 0.51,
      trigger_signal: 'cross_community_match_completed', trigger_event_id: 'm2',
    }]]);
  });

  it('writes nothing when a string value already sits at its bound', async () => {
    mockPrior = '0.95';

    await evaluateUserEvolution('u1', 'c1', EVOLUTION_SIGNALS.CROSS_COMMUNITY_MATCH_COMPLETED, { triggerEventId: 'm3' });

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockLog).not.toHaveBeenCalled();
  });
});
```

- [ ] **Run them red and record the evidence:**

```bash
cd services/reputation-service
npx jest --runTestsByPath tests/tdd/sprint-134-bug-077-badge-insert.test.ts \
  tests/tdd/sprint-134-bug-077-handler-isolation.test.ts tests/tdd/sprint-134-bug-079-evolution-numeric.test.ts \
  > "$TEMP/bug077-red.log" 2>&1; echo "exit $?"; grep -E '^Tests:|●.*›' "$TEMP/bug077-red.log"
```

Expected (dry run): **8 failed, 1 passed**. Badge insert 3/3 red (the INSERT has no `name`; `['first_helper']` and
`['first_helper','milestone_10']` reported for absorbed inserts); isolation 2 red ("Received promise rejected instead of
resolved") + 1 green (preservation); evolution 3/3 red (`depth_weight: NaN`, `cross_community_prior: NaN`, an upsert
at the bound). Any other red reason is a test bug: stop and fix the test.

- [ ] **Commit:** `test(reputation): BUG-077 badge insert, side-effect isolation and BUG-079 numeric contracts (red)`.

---

## Task 3: Root real-SQL integration test (CI-only on Windows)

**Files:**
- Create: `tests/integration/sprint-134-bug-077-completion-side-effects.integration.test.ts`

- [ ] **Write the file:**

```ts
/**
 * Sprint 134 BUG-077 / BUG-079: a completed exchange's reputation job succeeds on its first attempt and runs every live
 * side effect. Real JWT, request and reputation services over HTTP, real PostgreSQL and Bull. Missing infrastructure is
 * a failure, never a skip.
 *
 * Proofs: (1) a two-party completion's karmyq-completion-reputation job completes with no failed attempt, writes the
 * helper's first_helper badge with its display name, and nudges the helper's depth weight 0.60 → 0.61 (trust evolution
 * ran; before BUG-079 the nudge was NaN and its write was rejected); (2) a badge insert that fails no longer fails the
 * job: it still completes on its first attempt and trust evolution still runs; (3) one badge check over 100 completed
 * exchanges with 10 people writes all five Phase 1 badge types with their names, and a second check writes nothing.
 *
 * Before the fix every reputation job failed on reputation.badges.name NOT NULL (the 2025 table that migration 024's
 * CREATE TABLE IF NOT EXISTS never replaced), so (1) and (2) read a failed attempt and (3) throws.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import Queue from 'bull';
import { randomUUID } from 'crypto';
import { createPool, ServiceUrls } from '../fixtures';

describe('Sprint 134 BUG-077 completion side effects', () => {
  const pool = createPool();
  // R requester; H helper (case 1); H2 helper whose badge insert is made to fail (case 2); H5 helper for the direct
  // five-badge check, with ten requesters P.
  const R = randomUUID(), H = randomUUID(), H2 = randomUUID(), H5 = randomUUID();
  const P = Array.from({ length: 10 }, () => randomUUID());
  const users = [R, H, H2, H5, ...P];
  const Cm = randomUUID();
  const redis = process.env.REDIS_URL || 'redis://localhost:6380';
  const reputationJobs = new Queue('karmyq-completion-reputation', redis);
  const communityEvolution = new Queue('karmyq-community-evolution', redis);

  const bearer = (id: string) => `Bearer ${jwt.sign({ userId: id, email: `${id}@karmyq.test`, communities: [] }, process.env.JWT_SECRET || 'dev-secret-key')}`;
  const complete = (as: string, matchId: string) => request(ServiceUrls.REQUEST).put(`/matches/${matchId}/complete`)
    .set('Authorization', bearer(as)).send({});

  // Status parameters are INSERT values cast to varchar; nothing compares a parameter with requests.matches.status.
  async function ask(status: string): Promise<string> {
    const id = randomUUID();
    await pool.query(`INSERT INTO requests.help_requests
      (id,requester_id,title,description,category,request_type,visibility_scope,status)
      VALUES ($1,$2,'BUG-077 ask','Fixture','generic','generic','community',$3::varchar)`, [id, R, status]);
    await pool.query('INSERT INTO requests.request_communities(request_id,community_id) VALUES ($1,$2)', [id, Cm]);
    return id;
  }
  async function match(requestId: string, responder: string, status: string): Promise<string> {
    const { rows } = await pool.query(`INSERT INTO requests.matches (request_id,responder_id,status,completed_at)
      VALUES ($1,$2,$3::varchar,CASE WHEN $3::varchar = 'completed' THEN CURRENT_TIMESTAMP END) RETURNING id`,
    [requestId, responder, status]);
    return rows[0].id;
  }

  // Opts `helper` into trust evolution in Cm the way the app does (PUT trust-config creates the member's row; without
  // one a member is not eligible) and seeds two earlier completed exchanges with R, so the HTTP completion is the pair's
  // third and fires repeat_interaction_same_person (subscriber.ts: repeatCount >= 3).
  async function preparedHelper(helper: string) {
    const optIn = await request(ServiceUrls.REPUTATION).put(`/reputation/trust-config/${helper}/${Cm}`)
      .set('Authorization', bearer(helper)).send({ evolution_enabled: true });
    expect(optIn.status).toBe(200);
    for (let i = 0; i < 2; i++) await match(await ask('completed'), helper, 'completed');
  }

  async function completeOverHttp(helper: string): Promise<string> {
    const m = await match(await ask('matched'), helper, 'matched');
    expect((await complete(helper, m)).status).toBe(200);
    const last = await complete(R, m);
    expect(last.status).toBe(200);
    expect(last.body.data).toEqual({ fully_completed: true, waiting_for: null });
    return m;
  }

  // The reputation job for a completion is `completion-<match id>` (request-service completionEvents.ts). Bull counts
  // only failed attempts (lib/job.js _saveAttempt), so a first-try success reads attemptsMade 0 and no stack trace.
  // Returns at the first failed attempt, so a red run shows its failedReason instead of timing out.
  async function reputationJob(matchId: string) {
    for (const deadline = Date.now() + 20_000; Date.now() < deadline;) {
      const job = await reputationJobs.getJob(`completion-${matchId}`);
      if (job) {
        const state = await job.getState();
        if (state === 'completed' || job.attemptsMade > 0) {
          return { state, attemptsMade: job.attemptsMade, failedReason: job.failedReason ?? null, stacktrace: job.stacktrace };
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`reputation job for match ${matchId} neither completed nor failed within 20 s`);
  }
  const FIRST_TRY = { state: 'completed', attemptsMade: 0, failedReason: null, stacktrace: [] };

  const evolutionLog = async (helper: string) => (await pool.query(`SELECT parameter, old_value::text AS old_value,
      new_value::text AS new_value, trigger_signal, trigger_event_id
    FROM reputation.user_trust_evolution_log WHERE user_id = $1 AND community_id = $2`, [helper, Cm])).rows;

  beforeAll(async () => {
    await pool.query('SELECT 1');
    expect((await request(ServiceUrls.REQUEST).get('/health')).status).toBe(200);
    expect((await request(ServiceUrls.REPUTATION).get('/health')).status).toBe(200);
    for (const id of users) {
      await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)',
        [id, `BUG-077 ${id.slice(0, 8)}`, `${id}@karmyq.test`, 'not-a-login']);
    }
    await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4)',
      [Cm, `BUG-077 ${Cm}`, 'Fixture', R]);
    // No trigger creates a config row, and without one community evolution reads as disabled. Defaults:
    // community_evolution_enabled true, trust_depth_weight 0.60.
    await pool.query('INSERT INTO communities.community_configs(community_id) VALUES ($1)', [Cm]);
    for (const id of [R, H, H2]) {
      await pool.query("INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'member','active')", [id, Cm]);
    }
  });

  afterAll(async () => {
    try {
      // The delayed community-evolution check queued by case 1 and 2 (jobId = the community id).
      await (await communityEvolution.getJob(Cm))?.remove().catch(() => undefined);
      const byRequester = 'SELECT id FROM requests.help_requests WHERE requester_id = ANY($1::uuid[])';
      await pool.query(`DELETE FROM requests.matches WHERE request_id IN (${byRequester})`, [users]);
      await pool.query(`DELETE FROM requests.feed_events WHERE request_id IN (${byRequester})`, [users]);
      await pool.query('DELETE FROM notifications.notifications WHERE user_id = ANY($1::uuid[])', [users]);
      // karma_records.community_id has no ON DELETE CASCADE: clear it before the community.
      await pool.query('DELETE FROM reputation.karma_records WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM reputation.trust_scores WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM social_graph.trust_edges WHERE user_id_a = ANY($1::uuid[]) OR user_id_b = ANY($1::uuid[])', [users]);
      await pool.query(`DELETE FROM requests.request_communities WHERE request_id IN (${byRequester})`, [users]);
      await pool.query('DELETE FROM requests.help_requests WHERE requester_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM communities.members WHERE user_id = ANY($1::uuid[])', [users]);
      // Cascades community_configs, user_trust_configs and the evolution log.
      await pool.query('DELETE FROM communities.communities WHERE id = $1', [Cm]);
      // Cascades badges, activity_log and the rest keyed on the user.
      await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [users]);
    } finally {
      await reputationJobs.close();
      await communityEvolution.close();
      await pool.end();
      // Case 3 imported the service's own pool.
      const servicePool = (await import('../../services/reputation-service/src/database/db')).default;
      await servicePool.end().catch(() => undefined);
    }
  });

  it('completes the reputation job on its first attempt, awards first_helper with its name, and runs trust evolution', async () => {
    await preparedHelper(H);
    const m = await completeOverHttp(H);

    expect(await reputationJob(m)).toEqual(FIRST_TRY);
    // Positive control: karma, which commits first, landed for this match.
    expect(Number((await pool.query('SELECT COUNT(*) FROM reputation.karma_records WHERE related_entity_id = $1', [m])).rows[0].count))
      .toBeGreaterThan(0);
    // Three completed exchanges as helper with one person: only first_helper qualifies. Badges go to the helper only.
    expect((await pool.query('SELECT badge_type, name, community_id FROM reputation.badges WHERE user_id = $1', [H])).rows)
      .toEqual([{ badge_type: 'first_helper', name: 'First help given', community_id: null }]);
    expect((await pool.query('SELECT badge_type FROM reputation.badges WHERE user_id = $1', [R])).rows).toEqual([]);
    // Trust evolution ran: the pair's third exchange nudged depth weight from the community default.
    expect(await evolutionLog(H)).toEqual([{
      parameter: 'depth_weight', old_value: '0.60', new_value: '0.61',
      trigger_signal: 'repeat_interaction_same_person', trigger_event_id: m,
    }]);
    expect((await pool.query('SELECT depth_weight::text AS depth_weight FROM reputation.user_trust_configs WHERE user_id = $1 AND community_id = $2', [H, Cm])).rows)
      .toEqual([{ depth_weight: '0.61' }]);
  });

  it('a failing badge insert no longer fails the job; trust evolution still runs', async () => {
    await preparedHelper(H2);
    const suffix = H2.replace(/-/g, '');
    const fn = `reputation.reject_badge_${suffix}`, trigger = `reject_badge_${suffix}`;
    try {
      await pool.query(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.user_id = '${H2}' THEN RAISE EXCEPTION 'injected badge failure'; END IF; RETURN NEW; END $$`);
      await pool.query(`CREATE TRIGGER ${trigger} BEFORE INSERT ON reputation.badges FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
      const m = await completeOverHttp(H2);

      expect(await reputationJob(m)).toEqual(FIRST_TRY);
      expect((await pool.query('SELECT badge_type FROM reputation.badges WHERE user_id = $1', [H2])).rows).toEqual([]);
      expect(await evolutionLog(H2)).toEqual([{
        parameter: 'depth_weight', old_value: '0.60', new_value: '0.61',
        trigger_signal: 'repeat_interaction_same_person', trigger_event_id: m,
      }]);
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${trigger} ON reputation.badges`);
      await pool.query(`DROP FUNCTION IF EXISTS ${fn}()`);
    }
  });

  it('one badge check writes every Phase 1 badge type with its name; a second check writes nothing', async () => {
    // 100 completed exchanges as H5's helper, 10 with each of P: crosses milestone_100 and connector (10 people) at once.
    // request_type and visibility_scope are enums: a text literal in a SELECT list will not assign to them, so they keep
    // their defaults ('generic', 'community').
    await pool.query(`WITH history AS (
        INSERT INTO requests.help_requests (requester_id,title,description,category,status)
        SELECT ($1::uuid[])[1 + (g % 10)], 'BUG-077 history', 'Fixture', 'generic', 'completed'
        FROM generate_series(0, 99) AS g
        RETURNING id)
      INSERT INTO requests.matches (request_id,responder_id,status,completed_at)
      SELECT id, $2, 'completed', CURRENT_TIMESTAMP FROM history`, [P, H5]);
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://karmyq_test:test_password@localhost:5433/karmyq_test';
    const { checkAndAwardBadges } = await import('../../services/reputation-service/src/services/badgeService');
    const badges = async () => (await pool.query(
      'SELECT badge_type, name FROM reputation.badges WHERE user_id = $1 ORDER BY badge_type COLLATE "C"', [H5])).rows;
    const all = [
      { badge_type: 'connector', name: 'Helped 10 different people' },
      { badge_type: 'first_helper', name: 'First help given' },
      { badge_type: 'milestone_10', name: 'Helped 10 times' },
      { badge_type: 'milestone_100', name: 'Helped 100 times' },
      { badge_type: 'milestone_50', name: 'Helped 50 times' },
    ];

    expect((await checkAndAwardBadges(H5)).sort()).toEqual(all.map((b) => b.badge_type));
    expect(await badges()).toEqual(all);

    expect(await checkAndAwardBadges(H5)).toEqual([]);
    expect(await badges()).toEqual(all);
  });
});
```

- [ ] **Type-check it** (the tests project has ~70 pre-existing errors elsewhere; this file must add none):

```bash
npx tsc --noEmit -p tests/tsconfig.json > "$TEMP/tsc-tests.log" 2>&1
grep sprint-134-bug-077 "$TEMP/tsc-tests.log" || echo "no diagnostics for the BUG-077 file"
npx tsc --listFilesOnly -p tests/tsconfig.json | grep -c sprint-134-bug-077-completion-side-effects   # 1: really compiled
```

- [ ] **Do not run it locally** (no Docker on this box). CI's `test-integration` job is its first run. Expected on
  the current code, if it were run: cases 1 and 2 return `attemptsMade 1` with `failedReason` "null value in column
  \"name\" of relation \"badges\" violates not-null constraint"; case 3 throws the same error. Record that as reasoning,
  not evidence.
- [ ] **Commit:** `test: BUG-077 real-SQL completion side effects (CI-only)`.

---

## Task 4: Badge insert supplies the name (BUG-077)

**Files:**
- Modify: `services/reputation-service/src/services/badgeService.ts`

- [ ] **Add the name map** after `export type BadgeType` (`:15`):

```ts
/**
 * Display names for reputation.badges.name, which is NOT NULL: the table predates migration 024, whose
 * CREATE TABLE IF NOT EXISTS never ran, and the insert without it never succeeded (BUG-077).
 */
export const BADGE_NAMES: Record<BadgeType, string> = {
  first_helper: 'First help given',
  milestone_10: 'Helped 10 times',
  milestone_50: 'Helped 50 times',
  milestone_100: 'Helped 100 times',
  connector: 'Helped 10 different people',
};
```

- [ ] **Replace the insert loop and return** (`:83-94`):

```ts
  // Insert new badges (ON CONFLICT DO NOTHING for safety)
  const awarded: BadgeType[] = [];
  for (const badge_type of toAward) {
    const result = await query(
      `INSERT INTO reputation.badges (user_id, badge_type, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, badge_type) DO NOTHING`,
      [responderId, badge_type, BADGE_NAMES[badge_type]]
    );
    // The unique key absorbed it: another run awarded this badge first.
    if (result.rowCount === 0) continue;
    awarded.push(badge_type);
    console.log(`🏅 Badge awarded: user=${responderId} badge=${badge_type}`);
  }

  return awarded;
```

- [ ] **Verify:** the badge-insert tdd file 3/3; root `unit/reputation/prestige-badges.test.ts` still green (its insert
  mocks carry no `rowCount`, which `=== 0` lets through).

```bash
cd services/reputation-service && npx jest --runTestsByPath tests/tdd/sprint-134-bug-077-badge-insert.test.ts > "$TEMP/t4.log" 2>&1; echo "exit $?"; grep -E '^Tests:' "$TEMP/t4.log"
cd ../.. && npm exec --workspace=tests -- jest --runTestsByPath unit/reputation/prestige-badges.test.ts > "$TEMP/t4root.log" 2>&1; echo "exit $?"; grep -E '^Tests:' "$TEMP/t4root.log"
```

- [ ] **Commit:** `fix(reputation): badge insert supplies the NOT NULL name and reports only real inserts (BUG-077)`.

---

## Task 5: Only a karma failure fails the job (BUG-077)

**Files:**
- Modify: `services/reputation-service/src/events/subscriber.ts`

- [ ] **Wrap the two calls after the karma log** (`:68-74`). Leave the karma call, its rethrow and the trust-evolution
  block exactly as they are:

```ts
        console.log('✅ Karma awarded for match:', match_id);

        // Karma is committed and replays idempotently, so nothing below may fail the job: a rethrow made Bull re-run
        // the whole job and skipped every later step (BUG-077). The completion rate and badges are recomputed from
        // history on the helper's next completion, so a skipped run repairs itself.

        // Update provider completion_rate if responder is a registered provider
        try {
          await updateProviderCompletionRate(responder_id);
        } catch (providerErr) {
          console.error('[provider-trust] completion rate update failed, skipping:', match_id, providerErr);
        }

        // Check and award prestige badges to the helper
        try {
          await checkAndAwardBadges(responder_id);
        } catch (badgeErr) {
          console.error('[badges] badge check failed, skipping:', match_id, badgeErr);
        }
```

- [ ] **Verify:** the isolation tdd file 3/3, and the existing subscriber suites still green.

```bash
cd services/reputation-service && npx jest --runTestsByPath tests/tdd/sprint-134-bug-077-handler-isolation.test.ts \
  tests/regression/sprint-126-subscriber-boundary.test.ts tests/regression/sprint-133-pr-q-consumer-queue.test.ts \
  > "$TEMP/t5.log" 2>&1; echo "exit $?"; grep -E '^Test Suites|^Tests:' "$TEMP/t5.log"
```

- [ ] **Commit:** `fix(reputation): badge and provider-rate failures no longer fail the completion job (BUG-077)`.

---

## Task 6: Trust evolution nudges numbers (BUG-079)

**Files:**
- Modify: `services/reputation-service/src/services/trustEvolutionService.ts`

- [ ] **Coerce at the use site** (`:130`):

```ts
    // pg returns NUMERIC columns as strings ("0.60"), and `+` would concatenate the nudge onto one (BUG-079).
    const currentValue = Number(effectiveParams[parameter]);
```

- [ ] **Verify:** the evolution tdd file 3/3; root `unit/reputation/trustEvolutionService.test.ts` and
  `fractalFeed.test.ts` green; reputation-service `tsc` clean.

```bash
cd services/reputation-service && npx jest --runTestsByPath tests/tdd/sprint-134-bug-079-evolution-numeric.test.ts > "$TEMP/t6.log" 2>&1; echo "exit $?"; grep -E '^Tests:' "$TEMP/t6.log"
npx tsc --noEmit -p . ; echo "tsc exit $?"
cd ../.. && npm exec --workspace=tests -- jest --runTestsByPath unit/reputation/trustEvolutionService.test.ts unit/reputation/fractalFeed.test.ts > "$TEMP/t6root.log" 2>&1; echo "exit $?"; grep -E '^Tests:' "$TEMP/t6root.log"
```

- [ ] **Commit:** `fix(reputation): trust evolution nudges NUMERIC values as numbers (BUG-079)`.

---

## Task 7: Promote the tdd tests

- [ ] **Run the promoter** (`.npmrc` sets `ignore-scripts`, so `npm test` never runs it):

```bash
node scripts/promote-tdd-tests.js
git status --short
```

- [ ] **Keep only the three BUG-077/079 files' moves** (`services/reputation-service/tests/tdd/` →
  `tests/regression/`). Restore every other file the promoter swept, including
  `services/reputation-service/tests/tdd/sprint-125-provider-reputation-auth.test.ts` if it moved
  (`git checkout -- <path>`; delete the new copy it made in `regression/`).
- [ ] **Verify:** `cd services/reputation-service && npm test` (unit + regression) exit 0, run to a file.
- [ ] **Commit:** `test(reputation): promote the BUG-077/079 contracts to regression`.

---

## Task 8: User guide, ADR-016 amendment and landing docs

**Files:**
- Modify: `docs/guides/understanding-karma-guide.md`, `docs/adr/ADR-016-prestige-based-recognition.md`,
  `tests/integration/sprint-134-bug-074-match-status-guards.integration.test.ts`
- Regenerate: `apps/landing/src/data/docs/**`

- [ ] **Guide, *Trust Model Evolution* (`understanding-karma-guide.md:80`).** Replace the first paragraph, and fix
  the pause location in the second (the global switch and the per-community toggles are both in the profile page's
  "Trust Evolution Settings" section, `apps/frontend/src/pages/profile.tsx:749-767`; `pages/reputation/trust.tsx:221`
  points there):

```markdown
Your trust model can calibrate itself from your exchanges, one community at a time. It is off until you turn it on:
in **Trust Evolution Settings** on your profile page, each community has an **Evolution On / Off** toggle. (A community
admin can turn evolution off for the whole community, which disables the toggle.) Once it is on, completed exchanges
nudge your parameters in small steps. For example, a third completed exchange with the same person raises your depth
weight by 0.01. Each parameter changes at most once every 7 days, and every change is listed in your evolution
history together with what caused it.

**Global opt-out**: If you prefer your trust model to stay fixed, you can pause evolution globally in **Trust
Evolution Settings** on your profile page. When paused, your parameters won't change regardless of per-community
settings.
```

  Keep the *Effective parameters* paragraph as it is.
- [ ] **ADR-016 amendment.** Append (status line unchanged; no README index change, PR B precedent):

```markdown
## Amendment — Sprint 134 BUG-077: Phase 1 badges are written (2026-10-29)

Phase 1 was marked implemented in Sprint 14, but no badge was ever written. Migration 024 created the table with
`CREATE TABLE IF NOT EXISTS`, and an older `reputation.badges` (2025, with `name VARCHAR(255) NOT NULL`) already
existed, so 024 only added `badge_type`, `community_id` and the `(user_id, badge_type)` key. The insert supplied no
`name`, so it failed on every completion, and the failure also aborted the rest of the completion job (BUG-077).

From Sprint 134 the insert supplies a display name for each Phase 1 type (`BADGE_NAMES` in
`services/reputation-service/src/services/badgeService.ts`), and a badge failure no longer fails the job. There was no
backfill: a helper's next completed exchange awards every badge whose threshold their history already crossed, dated
at that award. No notification announces a badge, and no screen shows one yet.
```

- [ ] **The BUG-074 integration cleanup comment** (`sprint-134-bug-074-match-status-guards.integration.test.ts:107-108`)
  names BUG-077 as the current cause of retries. Reword to:

```ts
      // Matches first: a retried match_completed job needs the match row to re-award karma, and a re-inserted karma
      // row would block the community delete.
```

- [ ] **Regenerate landing** (`npm test` runs the landing prebuild, or run the generator directly). Commit the
  regenerated ADR-016 page and reputation-service pages (`git add -f`; the directory is gitignored but tracked).
  Revert timestamp, HEAD-sha and `adr-010` CR churn first (`feedback_npm_test_regenerates_landing_docs`).
- [ ] **Check the license gate's phrase list** has no match in the new text
  (`docs/gotchas/license-gate-flags-claim-phrases-in-any-tracked-file.md`).
- [ ] **Commit:** `docs: BUG-077 trust-evolution guide, ADR-016 amendment, landing regen`.

---

## Task 9: CONTEXT.md, README, ARCHITECTURE, registry.json and BUGS.md

**Files:**
- Modify: `services/reputation-service/CONTEXT.md`, `services/reputation-service/README.md`, `docs/ARCHITECTURE.md`,
  `services/registry.json`, `docs/BUGS.md`

- [ ] **CONTEXT.md, Recent Changes** (new first bullet, above the 2026-10-28 entry):

```markdown
- **2026-10-29 (Sprint 134 BUG-077 + BUG-079)**: every `match_completed` job failed at the badge insert, after karma.
  `reputation.badges.name` is `NOT NULL` (the 2025 table; migration 024's `CREATE TABLE IF NOT EXISTS` never ran),
  and `checkAndAwardBadges` did not supply it, so no badge was ever awarded, the trust-evolution step after it never
  ran, and Bull retried every job. The insert now supplies `name` from `BADGE_NAMES` (`Record<BadgeType, string>`)
  and reports only rows it inserted. In the handler, the provider completion-rate update and the badge check each
  catch and log their own failure (`[provider-trust]`, `[badges]`), so only a karma projection failure fails the job;
  both are recomputed from history on the helper's next completion. **BUG-079:** `evaluateUserEvolution` added each
  nudge to a NUMERIC value pg returns as a string (`"0.60" + 0.01` → NaN), so no nudge was ever written; it now
  coerces with `Number()` (the `GET /reputation/trust-config` wire format is unchanged). No schema, endpoint, event or
  queue change. No backfill: a helper's next completion awards every badge already earned (`earned_at` = the award).
  Tests: `tests/regression/sprint-134-bug-077-badge-insert.test.ts`, `sprint-134-bug-077-handler-isolation.test.ts`,
  `sprint-134-bug-079-evolution-numeric.test.ts`; root real SQL
  `tests/integration/sprint-134-bug-077-completion-side-effects.integration.test.ts` (CI-only on Windows).
```

- [ ] **CONTEXT.md, badges DDL** (`:216-224`, the `-- reputation.badges` block): replace with the live shape:

```sql
-- reputation.badges: the live shape (init.sql). The table predates migration 024, whose CREATE TABLE IF NOT EXISTS
-- never ran; 024 only added badge_type, community_id and the unique key.
CREATE TABLE reputation.badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,            -- display name: BADGE_NAMES in badgeService.ts (BUG-077)
    description TEXT,                      -- unused
    icon_url VARCHAR(255),                 -- unused
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    badge_type TEXT,                       -- first_helper | milestone_10 | milestone_50 | milestone_100 | connector
    community_id UUID REFERENCES communities.communities(id) ON DELETE SET NULL,  -- never set
    UNIQUE (user_id, badge_type)
);
```

- [ ] **CONTEXT.md, "Implement Badge System"**: replace everything from the line `### Implement Badge System`
  (`:1205`) up to, not including, `## Security Considerations` (`:1266`). The old sample writes `badge_name` and
  publishes a `badge_earned` event, neither of which exists:

```markdown
### Badges (Phase 1, ADR-016)

`src/services/badgeService.ts`: `checkAndAwardBadges(responderId)` runs after karma in the `match_completed` handler,
compares the helper's whole completed history with each threshold, and inserts every newly earned type with its
`BADGE_NAMES` display name (`ON CONFLICT (user_id, badge_type) DO NOTHING`). It returns only the types it inserted.
To add a type: extend `BADGE_TYPES` (`tsc` then requires a `BADGE_NAMES` entry), add its threshold, and extend
`tests/regression/sprint-134-bug-077-badge-insert.test.ts` and the root real-SQL file. No event announces an award.

```

- [ ] **README.md** (`:70-72`): `- id, user_id, badge_type, name` / `- earned_at`.
- [ ] **ARCHITECTURE.md** (`:444`): `reputation.badges (id, user_id, badge_type, name, earned_at, ...)`.
- [ ] **registry.json:** append to `services['reputation-service'].notes` (keep it one JSON string; validate with
  `node -e "require('./services/registry.json')"`):
  ` Sprint 134 BUG-077/BUG-079: the badge insert supplies reputation.badges.name (NOT NULL); the provider completion-rate update and the badge check each isolate their own failure, so only the karma projection fails a match_completed job; user trust evolution coerces NUMERIC strings before nudging. No endpoint, schema, event or queue change.`
- [ ] **BUGS.md:** BUG-077 header → `fixed (Sprint 134 BUG-077 PR, v11.106.0)`; BUG-079 header → the same; add a
  short "Fixed" paragraph to each naming the commits and tests. BUG-080 stays open (logged at planning).
- [ ] **feedback:check on the STAGED diff** (it reads `git diff --cached`; clean on a committed branch, so run it
  before committing):

```bash
git add -A && npm run feedback:check
```

- [ ] **Commit:** `docs(reputation): BUG-077/079 CONTEXT, README, registry and bug log`.

---

## Task 10: SDLC quality gates

- [ ] **`/simplify`**, one pass over the branch diff (small diff). Record each finding as fixed or skipped with a reason.
- [ ] **`/code-review` medium** on the branch diff (small, well-specified). Escalate to high only if medium finds a
  correctness issue in the handler. Fix real findings test-first; log unrelated pre-existing ones to BUGS.md, not here.
- [ ] **`/security-review`** on the branch diff. Expected surface: none new (no route, no input, no query built from
  input; the test's trigger SQL interpolates only a `randomUUID()`).
- [ ] **Verification line for each gate** goes in the handoff and the PR body.
- [ ] **Commit** any gate fixes separately, each with its own red→green where behavior changes.

---

## Task 11: Final verification

- [ ] **Re-run, each to a file, reading the exit code** (`| tail` masks it):

```bash
(cd services/reputation-service && npx tsc --noEmit -p .); echo "reputation tsc $?"
npm test > "$TEMP/final-npm-test.log" 2>&1; echo "npm test $?"
npm test --workspace=tests > "$TEMP/final-root.log" 2>&1; echo "root tests $?"
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-134-pr-k-claim-gate.test.ts regression/doc-context-drift-gate.test.ts > "$TEMP/final-gates.log" 2>&1; echo "gates $?"
git status --short   # only landing churn to revert, nothing else
```

- [ ] **A lone red in another workspace under Turbo** → re-run that package alone before debugging (Turbo parallel
  timeout flake). A suspiciously green Turbo run after the promotion moves → re-run the moved files directly.
- [ ] **Revert landing churn**, confirm a clean tree.

---

## Task 12: Handoff, push, PR, stop

- [ ] **Update `.claude/handoff/CURRENT_HANDOFF.md`** (*BUG-077 state*: commits, red/green evidence, gate results, PR
  number once open, the human checks below). Commit and push.
- [ ] **Push and open the PR** with the repository PR template (`pr-contract.yml` requires `## Summary`,
  `## Validation`, `## Quality gates`, `## Security dismissals`). Body: the defect and its three effects; the four
  decisions; BUG-079; BUG-080 named as out of scope; the red evidence (Task 2 output, Task 3 reasoning); the gates;
  and the human checks:
  1. **Demo schema parity.** After the deploy, the reputation log shows no `violates not-null constraint` and no
     `Failed to award karma for match` for new completions, and shows `🏅 Badge awarded` lines. (CI runs `init.sql`;
     demo's table grew by migration. A demo-host read: ask first.)
  2. **PR L2's nightly log, still owed.** Read the reputation log covering the first 02:00Z run after the deploy; this
     also shows whether the log window now holds a night. (A demo-host read: ask first.)
- [ ] **Stop.** No CI watch, merge request or post-merge work in this chat: merging, demo operations and CodeQL
  dismissals each need the maintainer's explicit authorization. After the merge, the post-merge record (CI/CD run,
  deploy health, CodeQL on the merge sha, the real-SQL file's first result) goes on the next branch.
