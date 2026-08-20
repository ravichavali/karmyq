# Sprint 126: Honest Standing Backfill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make zero-standing semantics consistent and project stored completed-match history through
one canonical, transactional, retry-safe standing path so demo data looks rich because its source
history is rich—not because scores or feedback were invented.

**Architecture:** `@karmyq/shared` owns the pure completed-match reason, community-selection,
allocation, and milestone policy. Reputation-service supplies database facts to that policy inside
one transaction for live delivery and historical replay; a dry-run-first CLI performs read-only
preflight, then an explicitly authorized apply reprojects attributable legacy rows and recalculates
all active memberships.

**Tech Stack:** Node.js 24/Express 5/TypeScript, PostgreSQL 15, Bull queue, Jest 30.

**Spec:** [`docs/superpowers/specs/2026-08-19-sprint-126-standing-backfill-design.md`](../specs/2026-08-19-sprint-126-standing-backfill-design.md)

## Global Constraints

- Version moves from `v11.45.0` to `v11.46.0`.
- `trust_scores.score` becomes `DEFAULT 0 NOT NULL`; missing and stored cold-start standing agree.
- Projection identity is `(user_id, community_id, reason, related_entity_id)` for karma and
  `(user_id, community_id, activity_type, related_entity_id)` for activity.
- `MAX_COMMUNITIES_PER_KARMA_AWARD` is exactly 3.
- One `asOf = (completed_at, match_id)` key controls replay: community history is strictly before
  it; milestone history is through it.
- Historical rows use `matches.completed_at`, never `NOW()`.
- Dry-run is the default; `--apply` is separately authorized after deployment and a fresh backup.
- No feedback, matches, scores, badges, provider metrics, notifications, or trust-evolution events
  are fabricated or replayed.
- `infrastructure/postgres/init.sql` and landing JSON are generated artifacts, never hand-edited.
- New tests start in each changed workspace's `tests/tdd/` tier and promote to `regression/` only
  after they pass.

---

## File Map

### New files to create

| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260819-standing-projection-foundation.sql` | Zero default plus partial unique projection indexes |
| `packages/shared/src/projections/completedMatchStanding.ts` | Canonical reasons, cap, replay key ordering, community selection, allocation, and milestone planning |
| `services/reputation-service/src/services/standingProjector.ts` | Transactional database adapter for one completed match |
| `services/reputation-service/src/services/standingBackfillService.ts` | Read-only preflight/report and bounded apply orchestration |
| `services/reputation-service/src/scripts/backfillStanding.ts` | `backfill:standing` argument parsing and operator output |
| `services/reputation-service/tests/tdd/sprint-126-standing-projector.test.ts` | Transaction, retry, timestamp, cap, and as-of projector tests |
| `services/reputation-service/tests/tdd/sprint-126-standing-backfill.test.ts` | Dry-run/apply, legacy repair, resume, and report tests |
| `services/community-service/tests/regression/sprint-126-karma-carry-conflicts.test.ts` | Fusion/fission conflict-safe carry regression (blocking tier; see Task 1 deviations) |
| `tests/tdd/sprint-126-standing-projection-equivalence.test.ts` | Shared fixture/live policy equivalence gate while RED; manually promote to `tests/regression/` in Task 6 |
| `tests/integration/sprint-126-standing-schema.integration.test.ts` | PostgreSQL 15 migration/default/index/idempotency coverage, plus the fusion-overlap SUM proof (gating tier; see Task 1 deviations) |
| `docs/adr/ADR-096-canonical-completed-match-standing-projection.md` | Projection identity, temporal rules, and operator boundary |

### Existing files to modify

| File | Change |
|------|--------|
| `infrastructure/postgres/init.sql` | Regenerate from the migration chain |
| `packages/shared/src/projections/completedExchange.ts` | Delegate fixture karma to the canonical policy; remove copied schedule and allocation |
| `packages/shared/src/projections/index.ts`, `packages/shared/index.ts` | Root-export the canonical policy without adding a subpath |
| `packages/shared/src/projections/__tests__/completedExchange.test.ts` | Pin canonical fixture output and per-community milestones |
| `services/reputation-service/src/database/db.ts` | Add async-context transaction routing and `withTransaction()` |
| `services/reputation-service/src/services/karmaAllocation.ts` | Re-export the shared allocation contract for compatibility |
| `services/reputation-service/src/services/karmaService.ts` | Delegate completion writes; retain trust reads and `updateTrustScore` |
| `services/reputation-service/src/utils/activityTracker.ts` | Required/idempotent activity writes with supplied occurrence time |
| `services/reputation-service/src/events/subscriber.ts` | Use the transactional projector; keep non-standing side effects live-only |
| `services/reputation-service/package.json` | Add `backfill:standing` |
| `services/reputation-service/tests/regression/karmaService.test.ts` | Remove obsolete skipped sequence tests after replacement coverage exists |
| `services/community-service/src/services/fusionService.ts` | Conflict-safe karma carry |
| `services/community-service/src/services/fissionService.ts` | Conflict-safe karma carry |
| `services/simulation-service/src/fixtures/curatedDemo/baselineWriter.ts` | Supply eligible request communities to canonical fixture projection |
| `tests/tdd/sprint-117-projection-equivalence.test.ts` | Extend the existing cross-workspace gate to canonical standing semantics |
| `docs/adr/ADR-037-multi-signal-trust-score.md` | Canonical provenance, zero cold start, historical timestamps |
| `docs/adr/ADR-095-authenticated-provider-directory-and-reach-gated-standing.md` | Resolve the default-50 inconsistency |
| `docs/adr/README.md` | Index ADR-096 |
| `docs/guides/demo-data.md` | Remove false two-sided-rating claim; explain history-derived standing |
| `apps/landing/src/data/docs/concepts/adr-037-multi-signal-trust-score.json` | Generated ADR-037 amendment |
| `apps/landing/src/data/docs/concepts/adr-095-authenticated-provider-directory-and-reach-gated-standing.json` | Generated ADR-095 resolution note |
| `apps/landing/src/data/docs/concepts/adr-096-canonical-completed-match-standing-projection.json` | Generated ADR-096 concept |
| `apps/landing/src/data/docs/guides/demo-data.json` | Generated honest demo-data guide |
| `apps/landing/src/data/docs/services/community-service.json` | Generated conflict-safe carry context |
| `apps/landing/src/data/docs/services/reputation-service.json` | Generated projector/CLI context |
| `apps/landing/src/data/docs/services/simulation-service.json` | Generated canonical fixture context |
| `apps/landing/src/data/docs/nav.json` | Generated ADR-096 navigation entry |
| `packages/shared/CONTEXT.md` | Canonical projection exports and invariants |
| `services/reputation-service/CONTEXT.md` | Projector, indexes, CLI, and runbook |
| `services/simulation-service/CONTEXT.md` | Fixture delegation and expected output change |
| `services/community-service/CONTEXT.md` | Conflict-safe fusion/fission karma carry |
| `services/registry.json` | Idempotent `match_completed` reputation semantics |
| `package.json`, `package-lock.json` | Surgical version bump to `11.46.0` |
| `.claude/handoff/CURRENT_HANDOFF.md` | Reconcile execution and later deployment state |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **One projector, not equivalent-looking copies.** Live events, curated reset data, and historical
   backfill must share canonical reason and milestone policy. An equivalence claim needs a test that
   can fail.
2. **Foundation before backfill.** Change `trust_scores.score` to `DEFAULT 0 NOT NULL`; reproject
   attributable legacy rows from completed-match facts rather than renaming them in place.
3. **Historical time is data.** Use `matches.completed_at`; stamping replayed rows with `NOW()` makes
   decay and recent-activity output falsely rich.
4. **Idempotency lives in PostgreSQL.** Per-match transactions and unique projection identities are
   required; a CLI checkpoint file or `SELECT`-then-insert check is insufficient.
5. **Oldest first.** First-help and milestone outcomes depend on chronological history. Sort by
   completion timestamp and match ID. Define one `asOf = (completed_at, match_id)` key. Historical
   community priority may read only canonical history lexicographically strictly before `asOf`;
   milestone rank may count canonical helper history through `asOf`. Current/future replay writes
   must change neither result.
6. **No fabricated feedback.** Demo currently has no feedback rows. Keep quality neutral; Sprint 127
   may create future ratings only through ordinary authenticated workflows.
7. **Backfill only standing side effects.** Do not replay badges, provider metrics, notifications,
   trust evolution, or other subscriber work merely because a match is historical.
8. **Dry-run is the default and must be provably read-only.** `--apply` is a separately authorized
   demo data operation after deployment and backup.
9. **Every active membership is evaluated.** A zero is a meaningful result for no history, not a
   missing batch.
10. **Do not tune scores to look attractive.** Report the distribution produced by stored facts.
    Human validation checks credibility against histories, not a target bell curve.
11. **Generated files stay generated.** Regenerate `init.sql` and landing docs from their sources;
    revert unrelated timestamp/HEAD churn.
12. **Demo facts are a dated snapshot.** Re-run preflight immediately before apply because the live
    simulator can add matches after this spec's 2026-08-19 audit.
13. **Audit every writer before adding uniqueness.** Fusion and fission karma copies must use
    `ON CONFLICT DO NOTHING`, with shared-match regression coverage, before the indexes land.
14. **Every projector predicate is as-of.** Community selection, milestone eligibility, and any
    future write decision must be a function only of stored history as of the match plus the match
    itself—never current table state. `updateTrustScore` is the deliberate exception because its
    cache is supposed to reflect the present.

---

## Task 1: Schema foundation and conflict-safe existing writers

> **Executed 2026-08-19. Four recorded deviations from the text below:**
>
> 1. **Test placement.** The schema test went to `tests/integration/`, not root `tests/tdd/`, and
>    the karma-carry test to `services/community-service/tests/regression/`. Root `tests/tdd/` is
>    neither promoted (`scripts/promote-tdd-tests.js` walks only `services/*` and `apps/*`) nor run
>    by CI except where a file is named explicitly, so a test there would never gate. CI's
>    `test-integration` job runs `tests/integration/` against migrated Postgres and is a required
>    dependency of deploy.
> 2. **The migration adds `UPDATE reputation.trust_scores SET score = 0 WHERE score IS NULL`**
>    before the ALTERs. `SET NOT NULL` aborts on any existing NULL, so the approved DDL alone could
>    not apply. It writes the value every read path already infers via `COALESCE(ts.score, 0)`.
> 3. **`init.sql` was updated with the semantic delta only, not a wholesale regeneration.**
>    Regenerating on PostgreSQL 15.15 rewrites 78 lines of unrelated CHECK-constraint cast
>    placement (the documented pg_dump-patch sensitivity: `normalize_schema_dump` canonicalizes 2 of
>    14 such constraints). The delta was isolated by diffing two dumps taken with the SAME pg_dump,
>    then verified end-to-end: a fresh database loaded from the edited `init.sql` and replayed
>    through the full migration chain passes `ci-apply-full-schema.sh --drift-check`.
> 4. **Fusion karma carry was split in two and now SUMs.** The migration-validator review found that
>    a bare `ON CONFLICT DO NOTHING` on the fusion carry causes *silent, nondeterministic karma
>    loss*: production splits one match's pool across up to three shared communities, so a user can
>    hold the same `(reason, match)` identity in both origin communities, and fusing them collapses
>    those onto one identity. The identity-bearing half now aggregates
>    (`SUM(points)`, `MIN(created_at)`, `GROUP BY user_id, reason, related_entity_id`); the
>    `related_entity_id IS NULL` half stays row-for-row because the index does not constrain it and
>    aggregating would merge genuinely distinct manual adjustments. Both statements are exported
>    from `fusionService.ts` so the integration test executes the shipped SQL rather than a retyped
>    copy. `services/reputation-service/src/services/karmaService.ts` `recordKarma` also gained
>    `ON CONFLICT DO NOTHING` to close the deploy-window gap; Task 4 supersedes that code path.

**Files:**
- Create: `infrastructure/postgres/migrations/20260819-standing-projection-foundation.sql`
- Create: `tests/integration/sprint-126-standing-schema.integration.test.ts`
- Create: `services/community-service/tests/regression/sprint-126-karma-carry-conflicts.test.ts`
- Modify: `services/community-service/src/services/fusionService.ts`
- Modify: `services/community-service/src/services/fissionService.ts`
- Modify: `infrastructure/postgres/init.sql` (generated)

**Interfaces:**
- Consumes: existing karma/activity schemas and fusion/fission transaction clients.
- Produces: `uq_karma_match_projection`, `uq_activity_match_projection`, and conflict-safe carry
  writers required by every later task.

- [ ] **Step 1: Write RED migration assertions.** In the PostgreSQL 15 test, apply the migration
  twice and assert: omitted trust score inserts 0; null score fails `23502`; exact karma/activity
  projection duplicates fail `23505`; rows with null `related_entity_id` remain unrestricted.

```sql
INSERT INTO reputation.trust_scores (user_id, community_id)
VALUES ($1, $2)
RETURNING score;

SELECT indexname FROM pg_indexes
WHERE schemaname = 'reputation'
  AND indexname IN ('uq_karma_match_projection', 'uq_activity_match_projection');
```

- [ ] **Step 2: Write RED fusion/fission tests.** Seed two origin communities with the same
  `(user_id, reason, related_entity_id)` row, execute fusion into one target, and assert one target
  identity survives. Re-execute fission carry and assert it remains one row without `23505`.

```bash
npm --workspace karmyq-community-service run test:tdd -- --runInBand sprint-126-karma-carry-conflicts
```

  Expected: FAIL because both carry writers use bare `INSERT ... SELECT`.

- [ ] **Step 3: Make both carry writers conflict-safe.** Append `ON CONFLICT DO NOTHING` to the
  karma-copy statements at `fusionService.ts:97-103` and `fissionService.ts:311-317`; do not alter
  membership, trust-edge, or carry-factor behavior.

- [ ] **Step 4: Add the idempotent migration.** Use exactly the approved DDL.

```sql
ALTER TABLE reputation.trust_scores
  ALTER COLUMN score SET DEFAULT 0,
  ALTER COLUMN score SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_karma_match_projection
  ON reputation.karma_records (user_id, community_id, reason, related_entity_id)
  WHERE related_entity_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_match_projection
  ON reputation.activity_log (user_id, community_id, activity_type, related_entity_id)
  WHERE related_entity_id IS NOT NULL;
```

- [ ] **Step 5: Regenerate and validate.** Run the generator against a disposable PostgreSQL 15
  database, then request the required `migration-validator` review before committing.

```bash
bash scripts/regenerate-init-sql.sh
cd tests && npx jest --config jest.integration.config.js integration/sprint-126-standing-schema.integration.test.ts --runInBand
npx jest regression/sprint-120-init-sql-drift-gate.test.ts --runInBand
cd ../services/community-service && npm run test:tdd -- --runInBand sprint-126-karma-carry-conflicts
```

- [ ] **Step 6: Promote green workspace TDD coverage and commit.** Keep the root PostgreSQL test in
  `tests/tdd/`; move the green community test to `tests/regression/` through the promotion script.

```bash
node scripts/promote-tdd-tests.js
git add infrastructure/postgres/migrations/20260819-standing-projection-foundation.sql infrastructure/postgres/init.sql tests/integration/sprint-126-standing-schema.integration.test.ts services/community-service/src/services/fusionService.ts services/community-service/src/services/fissionService.ts services/community-service/tests/regression/sprint-126-karma-carry-conflicts.test.ts
git commit -m "feat: add standing projection schema foundation"
```

---

## Task 2: Canonical pure standing policy

**Files:**
- Create: `packages/shared/src/projections/completedMatchStanding.ts`
- Create: `tests/tdd/sprint-126-standing-projection-equivalence.test.ts`
- Modify: `packages/shared/src/projections/index.ts`
- Modify: `packages/shared/index.ts`
- Modify: `services/reputation-service/src/services/karmaAllocation.ts`

**Interfaces:**
- Consumes: existing largest-remainder `allocateKarma()` behavior.
- Produces:
  `COMPLETED_MATCH_REASONS`, `COMPLETED_MATCH_MILESTONES`,
  `MAX_COMMUNITIES_PER_KARMA_AWARD`, `compareReplayKeys()`,
  `selectStandingCommunities()`, `allocateCompletedMatchKarma()`, and
  `planCompletedMatchStanding()`.

```typescript
export interface RequestTypeConfig { name: string; karma_multiplier?: number }
export interface CommunityKarmaConfig {
  community_id: string;
  karma_split_helper: number;
  karma_split_requestor: number;
  enabled_request_types?: RequestTypeConfig[];
}
export interface CommunityAllocation {
  community_id: string; helperPoints: number; requesterPoints: number;
}
export interface ReplayKey { completedAt: Date; matchId: string }
export interface StandingCommunityCandidate extends CommunityKarmaConfig {
  priorHelperKarma: number;
  helperHelpCountThroughAsOf: number;
}
export interface CompletedMatchStandingFacts {
  matchId: string; requesterId: string; helperId: string; requestType?: string;
  occurredAt: Date; candidates: StandingCommunityCandidate[];
}
export interface PlannedStandingKarmaRow {
  userId: string; communityId: string; points: number;
  reason: typeof COMPLETED_MATCH_REASONS[keyof typeof COMPLETED_MATCH_REASONS];
  relatedEntityId: string; createdAt: Date;
}
export interface CompletedMatchStandingPlan {
  replayKey: ReplayKey; communityIds: string[];
  allocations: CommunityAllocation[]; rows: PlannedStandingKarmaRow[];
}
export function compareReplayKeys(left: ReplayKey, right: ReplayKey): number;
export function selectStandingCommunities(
  candidates: readonly StandingCommunityCandidate[], limit?: number,
): StandingCommunityCandidate[];
export function allocateCompletedMatchKarma(
  configs: readonly CommunityKarmaConfig[], totalPool: number, requestType?: string,
): CommunityAllocation[];
export function planCompletedMatchStanding(
  facts: CompletedMatchStandingFacts, totalPool?: number,
): CompletedMatchStandingPlan;
```

- [ ] **Step 1: Write RED contract tests.** Cover one, three, and four eligible communities;
  descending prior helper karma with community-ID tie-break; 60/40 fixed-pool totals; canonical
  reason strings; per-community ranks 1/10/50/100; and two matches sharing a timestamp ordered by
  match ID.

```typescript
expect(compareReplayKeys(
  { completedAt: sameTime, matchId: '0002' },
  { completedAt: sameTime, matchId: '0001' },
)).toBeGreaterThan(0);
expect(selectStandingCommunities(candidates).map(c => c.community_id)).toEqual([
  'community-b', 'community-c', 'community-d',
]);
expect(plan.rows.map(row => row.reason)).toEqual([
  'Provided help', 'Received help', 'First help in community',
]);
```

```bash
cd tests && npx jest tdd/sprint-126-standing-projection-equivalence.test.ts --runInBand
```

  Expected: FAIL because the shared contract does not exist.

- [ ] **Step 2: Define the exact shared types and constants.** Keep them in the existing root export
  surface; do not add a `package.json` subpath.

```typescript
export const MAX_COMMUNITIES_PER_KARMA_AWARD = 3;
export const COMPLETED_MATCH_REASONS = {
  provided: 'Provided help', received: 'Received help',
  first: 'First help in community', milestone10: '10 exchanges milestone',
  milestone50: '50 exchanges milestone', milestone100: '100 exchanges milestone',
} as const;
```

- [ ] **Step 3: Move—not copy—the allocation implementation.** Put largest-remainder allocation in
  `completedMatchStanding.ts`; make `karmaAllocation.ts` import and re-export it under the existing
  `allocateKarma` name so current importers do not change all at once.

- [ ] **Step 4: Implement deterministic planning.** Sort candidates by `priorHelperKarma DESC,
  community_id ASC`, slice to 3, allocate the one fixed pool, and emit bonus rows only at counts
  `1 → 15`, `10 → 25`, `50 → 50`, `100 → 100`.

- [ ] **Step 5: Verify type and behavioral compatibility.** The old allocation regression and new
  equivalence tests must both pass.

```bash
npm --workspace @karmyq/shared test
npm --workspace karmyq-reputation-service run test:regression -- --runInBand karmaAllocation
cd tests && npx jest tdd/sprint-126-standing-projection-equivalence.test.ts tdd/sprint-117-projection-equivalence.test.ts --runInBand
```

- [ ] **Step 6: Commit.**

```bash
git add packages/shared/src/projections/completedMatchStanding.ts packages/shared/src/projections/index.ts packages/shared/index.ts services/reputation-service/src/services/karmaAllocation.ts tests/tdd/sprint-126-standing-projection-equivalence.test.ts
git commit -m "feat: centralize completed match standing policy"
```

---

## Task 3: Transaction routing and required historical activity

**Files:**
- Modify: `services/reputation-service/src/database/db.ts`
- Modify: `services/reputation-service/src/utils/activityTracker.ts`
- Modify: `services/cleanup-service/src/jobs/reputationDecayJob.ts` — **added during Task 1.** The
  migration-validator review found `recordActivity` duplicated near-verbatim at
  `reputationDecayJob.ts:116-128`, with the same unguarded `activity_log` insert, the same
  `last_activity_at` update *after* it, and the same swallowed error. Once
  `uq_activity_match_projection` exists, a replay there silently skips the activity row AND leaves
  `last_activity_at` stale, so the decay job can decay a genuinely active user. Fix both copies
  (CLAUDE.md "grep ALL instances"), or extract one shared implementation.
- Create: `services/reputation-service/tests/tdd/sprint-126-standing-projector.test.ts`

**Interfaces:**
- Consumes: every reputation database helper's existing `query(text, params)` calls.
- Produces: `withTransaction<T>(work: () => Promise<T>): Promise<T>` and
  timestamp-aware required activity writes.

```typescript
export function withTransaction<T>(work: () => Promise<T>): Promise<T>;
export interface RecordActivityOptions { occurredAt?: Date; required?: boolean }
export function recordActivity(
  userId: string,
  communityId: string,
  activityType: string,
  relatedEntityId?: string,
  options?: RecordActivityOptions,
): Promise<void>;
```

- [ ] **Step 1: Write RED transaction tests.** Assert all nested calls to exported `query()` use
  the same checked-out client inside `withTransaction`; success commits/releases; failure
  rolls back/releases; unrelated calls outside the async context still use `pool.query`.

- [ ] **Step 2: Implement async-context transaction routing.** Use
  `AsyncLocalStorage<PoolClient>` so existing helpers participate without invasive optional-client
  plumbing.

```typescript
const transactionClient = new AsyncLocalStorage<PoolClient>();

export async function query(text: string, params?: unknown[]) {
  return (transactionClient.getStore() ?? pool).query(text, params);
}

export async function withTransaction<T>(work: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await transactionClient.run(client, work);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 3: Make activity writes projector-safe.** Supply `created_at` from `occurredAt`, add
  `ON CONFLICT DO NOTHING`, update `last_activity_at` to `GREATEST(existing, occurredAt)`, and only
  swallow errors for legacy callers. `required: true` must rethrow so the match transaction rolls
  back.

- [ ] **Step 4: Verify RED→GREEN and commit.**

```bash
cd services/reputation-service && npm run test:tdd -- --runInBand sprint-126-standing-projector
cd ../.. && node scripts/promote-tdd-tests.js
git add services/reputation-service/src/database/db.ts services/reputation-service/src/utils/activityTracker.ts services/reputation-service/tests/regression/sprint-126-standing-projector.test.ts
git commit -m "refactor: add reputation transaction context"
```

---

## Task 4: Transactional completed-match standing projector

**Files:**
- Create: `services/reputation-service/src/services/standingProjector.ts`
- Modify: `services/reputation-service/src/services/karmaService.ts`
- Modify: `services/reputation-service/tests/regression/sprint-126-standing-projector.test.ts`

**Interfaces:**
- Consumes: `withTransaction`, `planCompletedMatchStanding`, `recordActivity`, and
  `updateTrustScore`.
- Produces: `projectCompletedMatchStanding(input, options)` and the compatibility wrapper
  `awardKarmaForCompletedMatch(data)`.

```typescript
export interface CompletedMatchStandingInput {
  matchId: string; requestId: string; requesterId: string; helperId: string;
  requestType?: string; completedAt?: Date;
}
export interface StandingProjectionOptions {
  mode: 'live' | 'historical'; allowRequestCommunityFallback?: boolean;
}
export interface StandingProjectionResult {
  matchId: string; communityIds: string[];
  insertedKarmaRows: number; insertedActivityRows: number;
}
export interface MatchCompletionData {
  match_id: string; request_id: string; requester_id: string; responder_id: string;
  request_type?: string; completed_at?: string | Date;
}
export function projectCompletedMatchStanding(
  input: CompletedMatchStandingInput,
  options: StandingProjectionOptions,
): Promise<StandingProjectionResult>;
export function awardKarmaForCompletedMatch(
  data: MatchCompletionData,
): Promise<StandingProjectionResult>;
```

- [ ] **Step 1: Expand tests before implementation.** Cover validation, transaction-scoped
  advisory lock, no historical fallback, one/three/>three candidates, exact timestamps, exact
  canonical rows, same delivery twice, concurrent delivery, forced activity failure rollback,
  earlier-match replay after 10/50/100 helps, later rows ignored, and equal timestamps ordered by
  match ID.

- [ ] **Step 2: Load authoritative match facts under lock.** Use
  `pg_advisory_xact_lock(hashtextextended(matchId, 0))`; join match/request participants, status,
  request type, and `completed_at`; reject mismatches and require `status = 'completed'`.

- [ ] **Step 3: Query candidates with the replay boundary.** For `asOf = ($completedAt, $matchId)`,
  sum helper canonical karma only from rows whose source match joins to an ordering key strictly
  before `asOf`. Order again in TypeScript through `selectStandingCommunities` so SQL and pure
  policy cannot drift.

```sql
AND (source.completed_at < $5
  OR (source.completed_at = $5 AND source.id::text < $6))
ORDER BY prior_helper_karma DESC, rc.community_id ASC
```

- [ ] **Step 4: Derive per-community milestone counts through `asOf`.** Count canonical `Provided
  help` rows whose source key is before or equal to the current key. Do not count bonuses, legacy
  snake-case rows, later rows, or current table totals without a source-match bound.

- [ ] **Step 5: Write the plan idempotently with historical time.** Insert all karma rows and both
  activities with `ON CONFLICT DO NOTHING` and `created_at = completedAt`; call
  `updateTrustScore` for each affected pair inside the async-context transaction.

- [ ] **Step 6: Preserve the live-only fallback boundary.** Live delivery may use one stable
  request community only when membership intersection is empty; historical mode fails closed.

- [ ] **Step 7: Replace `awardKarmaForCompletedMatch` internals with a compatibility wrapper.** Map
  snake-case event fields to the new input and run `projectCompletedMatchStanding(..., {mode:
  'live', allowRequestCommunityFallback: true})`.

  **Also delete the duplicate constants** (added after the Task 2 `/simplify` pass — three of the
  four reviewers raised this independently). `karmaService.ts:20-31` still defines
  `KARMA_DEFAULTS.{FIRST_HELP, MILESTONE_10, MILESTONE_50, MILESTONE_100, BASE_KARMA_POOL}` and a
  module-local `MAX_COMMUNITIES_PER_KARMA_AWARD = 3`, byte-identical to the shared constants. Import
  them from `@karmyq/shared` and remove the local block, and make the SQL `LIMIT` at
  `karmaService.ts:92` bind `MAX_COMMUNITIES_PER_KARMA_AWARD` rather than a literal. `HELP_PROVIDED`
  and `HELP_RECEIVED` have no readers at all and go with them. **Without this the sprint ends having
  ADDED a copy of the milestone schedule rather than removed one** — nothing can fail if the two
  drift, because the Task 2 tests pin the shared constants against their own literals.

  Replace the remaining reason string literals at the award sites (`karmaService.ts:157,166,182,194,
  202,210`) with `COMPLETED_MATCH_REASONS.*`. The SQL comparison sites cannot import a TS constant
  and stay as they are.

- [ ] **Step 8: Verify and commit.**

```bash
cd services/reputation-service
npm run test:tdd -- --runInBand sprint-126-standing-projector
npm run test:regression -- --runInBand karmaService karmaAllocation trustScoreStrategy
cd ../.. && node scripts/promote-tdd-tests.js
git add services/reputation-service/src/services/standingProjector.ts services/reputation-service/src/services/karmaService.ts services/reputation-service/tests/regression/sprint-126-standing-projector.test.ts
git commit -m "feat: project completed match standing atomically"
```

---

## Task 5: Keep the event boundary live-only and retry-safe

**Files:**
- Modify: `services/reputation-service/src/events/subscriber.ts`
- Modify: `services/reputation-service/tests/regression/karmaService.test.ts`
- Modify: `services/reputation-service/tests/regression/sprint-126-standing-projector.test.ts`

**Interfaces:**
- Consumes: `awardKarmaForCompletedMatch` compatibility wrapper.
- Produces: unchanged public `match_completed` payload with idempotent standing side effects.

- [ ] **Step 1: Add a subscriber test.** Deliver one job twice and assert standing rows are stable
  while badge/provider/trust-evolution handlers remain subscriber-owned and are not exported to the
  backfill service.

- [ ] **Step 2: Pass the event completion timestamp when present.** If the payload omits it, let the
  projector read stored `matches.completed_at`; never synthesize `new Date()` for historical facts.

- [ ] **Step 3: Remove the obsolete skipped sequence suite.** Delete only the quarantined
  `describe.skip('awardKarmaForCompletedMatch', ...)` after the new projector suite covers every
  behavior it named; retain the active trust/karma/leaderboard regression tests.

- [ ] **Step 4: Verify and commit.**

```bash
cd services/reputation-service
npm test -- --runInBand
git add src/events/subscriber.ts tests/regression/karmaService.test.ts tests/regression/sprint-126-standing-projector.test.ts
git commit -m "refactor: route live standing through canonical projector"
```

---

## Task 6: Converge curated fixture projection

**Files:**
- Modify: `packages/shared/src/projections/completedExchange.ts`
- Modify: `packages/shared/src/projections/__tests__/completedExchange.test.ts`
- Modify: `services/simulation-service/src/fixtures/curatedDemo/baselineWriter.ts`
- Modify: `tests/tdd/sprint-117-projection-equivalence.test.ts`
- Move: `tests/tdd/sprint-126-standing-projection-equivalence.test.ts` →
  `tests/regression/sprint-126-standing-projection-equivalence.test.ts` after GREEN

**Interfaces:**
- Consumes: canonical `planCompletedMatchStanding()` and existing trust-edge/connection projection.
- Produces: curated fixture karma with production reasons, cap 3, and `(helper, community)` ranks.

- [ ] **Step 1: Extend RED fixture tests.** Pin all four intentional output changes: reason labels,
  1/10/50/100 schedule, per-community helper counts, and stable cap-3 selection from four eligible
  communities. Assert total allocated points remain one fixed pool per match.

- [ ] **Step 2: Extend event facts.** Add `eligibleCommunityIds?: string[]` to
  `CompletedExchangeEvent`; default to `[communityId]` so existing manifests describe their actual
  single request community without inventing cross-posting.

- [ ] **Step 3: Remove fixture policy copies.** Delete `HELP_MILESTONES` and
  `allocateKarmaFixture`; maintain prior canonical karma and per-community helper counts while
  iterating chronological `(completedAt, key)` order, then delegate each event's karma rows to the
  shared planner. Trust edges and connections remain unchanged.

- [ ] **Step 4: Update baseline writer.** Pass the compiled exchange's actual request community as
  the eligible set and keep mapping semantic keys to match UUIDs. Add `ON CONFLICT DO NOTHING` to
  fixture karma inserts because the new schema identity is authoritative.

- [ ] **Step 5: Verify exact fixture/live equivalence.**

```bash
npm --workspace @karmyq/shared test
npm --workspace @karmyq/simulation-service test
cd tests && npx jest tdd/sprint-117-projection-equivalence.test.ts tdd/sprint-126-standing-projection-equivalence.test.ts --runInBand
```

- [ ] **Step 6: Promote the green new root test manually.** The workspace promotion script does
  not walk root `tests/tdd/`, so use `git mv`; the pre-existing Sprint 117 TDD file remains where it
  is because this task did not create it.

```bash
git mv tests/tdd/sprint-126-standing-projection-equivalence.test.ts tests/regression/sprint-126-standing-projection-equivalence.test.ts
cd tests && npx jest regression/sprint-126-standing-projection-equivalence.test.ts --runInBand
```

- [ ] **Step 6b: Finish removing the duplicates the canonical policy replaced** (from the Task 2
  `/simplify` pass).
  - `completedExchange.ts:142-144` sorts with `a.completedAt.getTime() - b.completedAt.getTime() ||
    a.key.localeCompare(b.key)` — the same rule `compareReplayKeys` owns, but `localeCompare` is
    locale/ICU-collation sensitive and can order a pair differently from the canonical code-unit
    comparison. Re-point it at `compareReplayKeys`.
  - Derive the fixture's as-of values through the exported `isStrictlyBefore` / `isThrough`
    predicates rather than restating the boundary, so the one axis no pure test can cross-check
    (SQL derivation vs TS derivation) shares a single predicate.
  - `ProjectedKarmaRecord` (`completedExchange.ts:58-65`) duplicates `PlannedStandingKarmaRow`
    field-for-field; alias it.
  - `baselineWriter.ts:57` defines a fourth `DEFAULT_BASE_KARMA_POOL = 100`; use `DEFAULT_KARMA_POOL`
    (that file already imports from `@karmyq/shared`).
  - **Delete `services/reputation-service/src/services/karmaAllocation.ts`.** After Tasks 4 and 6 its
    only importers are two regression suites; re-point
    `services/reputation-service/tests/regression/karmaAllocation.test.ts:1` and
    `sprint-62-karma-multipliers.test.ts:8` at `@karmyq/shared` and remove the shim. No other task
    deletes it, so without this step a 22-line file survives solely to preserve an old import path.

- [ ] **Step 7: Commit.**

```bash
git add packages/shared/src/projections/completedExchange.ts packages/shared/src/projections/__tests__/completedExchange.test.ts services/simulation-service/src/fixtures/curatedDemo/baselineWriter.ts tests/tdd/sprint-117-projection-equivalence.test.ts tests/regression/sprint-126-standing-projection-equivalence.test.ts
git commit -m "feat: align curated standing with production policy"
```

---

## Task 7: Read-only standing preflight and realistic report

**Files:**
- Create: `services/reputation-service/src/services/standingBackfillService.ts`
- Create: `services/reputation-service/tests/tdd/sprint-126-standing-backfill.test.ts`

**Interfaces:**
- Consumes: shared pure replay policy and production `computeTrustScore`.
- Produces: `analyzeStandingBackfill(): Promise<StandingBackfillReport>` with no DML.

- [ ] **Step 1: Write RED dry-run tests.** Fingerprint karma, activity, and trust tables before and
  after analysis; assert exact equality. Cover attributable/unattributable legacy rows, missing
  participants/request communities/completion timestamps, duplicate identities, active pairs with
  no history, score/source buckets, interaction depth/breadth, and provider floors 1/20/40/60.

```typescript
export interface StandingBackfillReport {
  completedMatches: number; eligibleMatches: number; alreadyProjectedMatches: number;
  anomalies: Array<{ code: string; matchId?: string; detail: string }>;
  activeMembershipPairs: number; sourcedPairs: number; zeroHistoryPairs: number;
  legacy: { attributableRows: number; unattributableRows: number; exactDuplicates: number };
  predicted: { karmaRows: number; activityRows: number; trustRowsEvaluated: number };
  scoreBuckets: Record<'0' | '1-19' | '20-39' | '40-59' | '60-79' | '80-100', number>;
  providerEligibility: Record<'1' | '20' | '40' | '60', number>;
}
```

- [ ] **Step 2: Load facts with SELECT-only queries.** Assert the implementation contains no
  `INSERT`, `UPDATE`, `DELETE`, or transaction write. Sort completed matches by
  `(completed_at, id)` and replay into an in-memory canonical ledger using the shared planner.

- [ ] **Step 3: Classify legacy rows conservatively.** A row is attributable only when
  `related_entity_id` joins a completed match with a non-null completion time. Report fixture-only
  milestone labels separately; never alias them to production milestones.

- [ ] **Step 4: Compute derived distributions from projected facts.** Evaluate each active
  membership, including zero-history pairs, with production score math and real feedback/config
  facts. Do not tune or clamp beyond the existing calculator.

- [ ] **Step 5: Fail closed on anomalies.** The report may be printed, but `canApply` is false when
  required match facts are missing, legacy provenance is ambiguous, or an existing canonical row
  conflicts in points/timestamp with the predicted identity.

- [ ] **Step 6: Verify and commit.**

```bash
cd services/reputation-service && npm run test:tdd -- --runInBand sprint-126-standing-backfill
cd ../.. && node scripts/promote-tdd-tests.js
git add services/reputation-service/src/services/standingBackfillService.ts services/reputation-service/tests/regression/sprint-126-standing-backfill.test.ts
git commit -m "feat: add read-only standing backfill preflight"
```

---

## Task 8: Bounded apply, legacy repair, and resume safety

**Files:**
- Modify: `services/reputation-service/src/services/standingBackfillService.ts`
- Modify: `services/reputation-service/tests/regression/sprint-126-standing-backfill.test.ts`

**Interfaces:**
- Consumes: `projectCompletedMatchStanding()` and `withTransaction()`.
- Produces: `applyStandingBackfill({ batchSize }): Promise<StandingBackfillReport>`.

```typescript
export interface StandingBackfillApplyOptions { batchSize: number }
export function applyStandingBackfill(
  options: StandingBackfillApplyOptions,
): Promise<StandingBackfillReport>;
```

- [ ] **Step 1: Add RED apply tests.** Assert attributable fixture rows are deleted and rebuilt in
  the same match transaction; unattributable rows retain points/timestamps through collision-safe
  normalization; a forced failure rolls back that match; stopping mid-batch and resuming yields the
  identical communities/ranks; second apply writes zero rows.

- [ ] **Step 2: Re-run preflight at apply start.** Refuse when `canApply` is false. Do not trust a
  report file or a prior live count because simulation may have added matches.

- [ ] **Step 3: Process bounded oldest-first batches.** Default `batchSize = 100`; order by
  `completed_at, id`; emit durable progress containing completed batch count and last committed
  match ID. Do not store a checkpoint—the database identities are the checkpoint.

- [ ] **Step 4: Repair attributable legacy rows per match.** Inside the match transaction, delete
  only fixture-derived rows for that `related_entity_id`, then call the historical projector. Never
  delete feedback, trust edges, connections, badges, or unrelated karma.

- [ ] **Step 5: Normalize unattributable legacy rows collision-safely.** Preserve points and
  `created_at`; canonicalize only `help_provided`, `help_received`, and `first_help_bonus`; retain
  fixture milestone labels verbatim; collapse only exact duplicate projection identities.

- [ ] **Step 6: Evaluate every active membership after projection.** Call `updateTrustScore` even
  for no-history pairs so a stored 0 exists. This present-state cache refresh is intentionally after
  historical match decisions.

- [ ] **Step 7: Verify and commit.**

```bash
cd services/reputation-service && npm run test:regression -- --runInBand sprint-126-standing-backfill sprint-126-standing-projector
git add src/services/standingBackfillService.ts tests/regression/sprint-126-standing-backfill.test.ts
git commit -m "feat: apply standing backfill idempotently"
```

---

## Task 9: Dry-run-first operator CLI

**Files:**
- Create: `services/reputation-service/src/scripts/backfillStanding.ts`
- Modify: `services/reputation-service/package.json`
- Modify: `services/reputation-service/tests/regression/sprint-126-standing-backfill.test.ts`

**Interfaces:**
- Consumes: `analyzeStandingBackfill()` and `applyStandingBackfill()`.
- Produces: `npm --workspace karmyq-reputation-service run backfill:standing -- [--apply]
  [--batch-size N]`.

- [ ] **Step 1: Add argument-contract tests.** No flags runs analysis only; unknown flags, bare
  `--batch-size`, non-integer, zero, and negative sizes exit 2 without database mutation; `--apply`
  is the only mutation switch.

- [ ] **Step 2: Implement strict parsing.** Accept exactly `--apply` and
  `--batch-size <positive integer>`; default batch size 100. Print the selected mode before any DB
  call.

- [ ] **Step 3: Print stable operator output.** Include all report fields, anomalies, score/source
  buckets, provider floors, exact apply command, and—during apply—last committed match progress.
  Never print credentials or full user records.

- [ ] **Step 4: Add the package command.** Use the service's existing `ts-node` toolchain.

```json
"backfill:standing": "ts-node src/scripts/backfillStanding.ts"
```

- [ ] **Step 5: Prove default dry-run and argument safety.**

```bash
npm --workspace karmyq-reputation-service run backfill:standing
npm --workspace karmyq-reputation-service run backfill:standing -- --batch-size 25
npm --workspace karmyq-reputation-service run backfill:standing -- --unknown
```

  Expected: first two exit 0 with no table fingerprint change; third exits 2 before connecting.

- [ ] **Step 6: Commit.**

```bash
git add services/reputation-service/src/scripts/backfillStanding.ts services/reputation-service/package.json services/reputation-service/tests/regression/sprint-126-standing-backfill.test.ts
git commit -m "feat: add standing backfill operator command"
```

---

## Task 10: ADRs, user guide, and landing documentation

**Files:**
- Create: `docs/adr/ADR-096-canonical-completed-match-standing-projection.md`
- Modify: `docs/adr/ADR-037-multi-signal-trust-score.md`
- Modify: `docs/adr/ADR-095-authenticated-provider-directory-and-reach-gated-standing.md`
- Modify: `docs/adr/README.md`
- Modify: `docs/guides/demo-data.md`
- Modify: `apps/landing/src/data/docs/concepts/adr-037-multi-signal-trust-score.json` (generated)
- Modify: `apps/landing/src/data/docs/concepts/adr-095-authenticated-provider-directory-and-reach-gated-standing.json` (generated)
- Create: `apps/landing/src/data/docs/concepts/adr-096-canonical-completed-match-standing-projection.json` (generated)
- Modify: `apps/landing/src/data/docs/guides/demo-data.json` (generated)
- Modify: `apps/landing/src/data/docs/nav.json` (generated)

**Interfaces:**
- Consumes: approved design decisions and shipped operator command.
- Produces: durable architecture record and honest operator/user explanation.

- [ ] **Step 1: Write ADR-096.** Record canonical projection identity, the single replay key,
  strict-before community ranking, through-key milestone rank, per-match transaction, schema-backed
  retries, dry-run/apply authority boundary, and live-only non-standing side effects.

- [ ] **Step 2: Amend ADR-037 and ADR-095.** ADR-037 names canonical completed-match provenance,
  zero cold start, and historical occurrence time. ADR-095 marks `DEFAULT 50` resolved by Sprint 126
  without changing its fail-closed provider rule.

- [ ] **Step 3: Correct the demo guide.** Remove the false claim that both parties rate every
  completed match. Explain that standing is derived from stored exchange history and absent ratings
  remain neutral—not synthesized.

- [ ] **Step 4: Index and regenerate.** Add ADR-096 to `docs/adr/README.md`, run the generator, and
  verify both ADR-095 and ADR-096 plus the guide remain wired in `nav.json`.

```bash
npm --workspace @karmyq/landing run generate-docs
rg -n "adr-095|adr-096|demo-data" apps/landing/src/data/docs/nav.json
cd tests && npx jest regression/doc-context-drift-gate.test.ts --runInBand
```

- [ ] **Step 5: Revert only unrelated generated churn and commit.** Keep semantic generated
  changes; revert timestamp/HEAD-only changes in unrelated JSON.

```bash
git add docs/adr/ADR-096-canonical-completed-match-standing-projection.md docs/adr/ADR-037-multi-signal-trust-score.md docs/adr/ADR-095-authenticated-provider-directory-and-reach-gated-standing.md docs/adr/README.md docs/guides/demo-data.md apps/landing/src/data/docs/concepts/adr-037-multi-signal-trust-score.json apps/landing/src/data/docs/concepts/adr-095-authenticated-provider-directory-and-reach-gated-standing.json apps/landing/src/data/docs/concepts/adr-096-canonical-completed-match-standing-projection.json apps/landing/src/data/docs/guides/demo-data.json apps/landing/src/data/docs/nav.json
git commit -m "docs: define canonical standing projection"
```

---

## Task 11: Context, registry, version, and full integration proof

**Files:**
- Modify: `packages/shared/CONTEXT.md`
- Modify: `services/reputation-service/CONTEXT.md`
- Modify: `services/simulation-service/CONTEXT.md`
- Modify: `services/community-service/CONTEXT.md`
- Modify: `services/registry.json`
- Modify: `apps/landing/src/data/docs/services/community-service.json` (generated)
- Modify: `apps/landing/src/data/docs/services/reputation-service.json` (generated)
- Modify: `apps/landing/src/data/docs/services/simulation-service.json` (generated)
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tests/integration/sprint-126-standing-schema.integration.test.ts`

**Interfaces:**
- Consumes: all completed Sprint 126 behavior.
- Produces: documented ownership plus one disposable-PostgreSQL end-to-end proof.

- [ ] **Step 1: Update local contexts.** Document the shared contract, reputation transaction and
  CLI runbook, curated-output changes, and conflict-safe fusion/fission writers. Remove the old
  `DEFAULT 50` schema example from reputation context.

- [ ] **Step 2: Update registry event semantics.** Keep the `match_completed` payload unchanged;
  state that reputation projection is atomic, idempotent, timestamp-preserving, and capped at three
  shared request communities.

- [ ] **Step 3: Regenerate service documentation.** Run the generator after the context edits and
  retain semantic changes only in the three explicitly listed service JSON files plus the already
  planned ADR/guide/nav output.

```bash
npm --workspace karmyq-landing run generate-docs
```

- [ ] **Step 4: Extend PostgreSQL integration coverage.** In one disposable database: apply the
  migration; seed 1/3/>3-community matches, equal timestamps, legacy curated rows, active zero-history
  memberships, and a shared-match fusion case; run dry-run, apply, interrupted resume, dry-run, and
  second apply; assert zero residual writes and trace representative score buckets to matches.

- [ ] **Step 5: Bump the root version surgically.** Change only the root `version` in `package.json`
  and the two root version fields in `package-lock.json` from `11.45.0` to `11.46.0`; do not run a
  workspace install or regenerate the lockfile.

- [ ] **Step 6: Run feedback and integration gates.** On this machine, use the documented remote
  disposable PostgreSQL 15 container because local Docker/WSL is unavailable.

```bash
npm run feedback:check
cd tests && npx jest --config jest.integration.config.js integration/sprint-126-standing-schema.integration.test.ts --runInBand
cd .. && npm run analyze:services
```

- [ ] **Step 7: Commit.**

```bash
git add packages/shared/CONTEXT.md services/reputation-service/CONTEXT.md services/simulation-service/CONTEXT.md services/community-service/CONTEXT.md services/registry.json apps/landing/src/data/docs/services/community-service.json apps/landing/src/data/docs/services/reputation-service.json apps/landing/src/data/docs/services/simulation-service.json package.json package-lock.json tests/integration/sprint-126-standing-schema.integration.test.ts
git commit -m "docs: record Sprint 126 standing contract"
```

---

## Task 12: SDLC quality gates

**Files:**
- None planned. If a verified finding requires a code or documentation edit, stop first and amend
  this plan's File Map and the affected task with the exact path before editing.

**Interfaces:**
- Consumes: complete branch diff.
- Produces: simplified, reviewed, security-reviewed merge candidate.

- [ ] **Step 1: Run `/simplify` after each implementation task, then a final branch-diff pass.**
  Verify no copied standing policy, dead compatibility wrapper, orphaned import, or avoidable query
  sequence remains.

```bash
git diff origin/master...HEAD --check
```

- [ ] **Step 2: Run `/code-review` at high effort.** Pay special attention to async transaction
  context, `ON CONFLICT` identities, as-of SQL, milestone ranks, legacy deletion boundaries,
  interruption/resume, and dry-run purity. Resolve every correctness finding.

```bash
git diff origin/master...HEAD --stat
```

- [ ] **Step 3: Run `/security-review`.** Inspect CLI authorization assumptions, SQL parameters,
  logs for personal data, RLS context, advisory-lock scope, and whether legacy repair can delete
  unrelated rows. Resolve real findings and document any dismissal in the PR body.

```bash
npm audit --package-lock-only --audit-level=high
```

- [ ] **Step 4: Run the required pre-commit review process.** Use `.claude/skills/pre-commit-check`
  and its mandatory process reviewer on the exact staged scope before the final code commit.

---

## Task 13: Final verification and execution handoff

**Files:**
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

**Interfaces:**
- Consumes: reviewed branch plus disposable-database results.
- Produces: push-ready branch and truthful rolling state.

- [ ] **Step 1: Type-check every touched TypeScript workspace.**

```bash
npm --workspace @karmyq/shared run type-check
npx tsc --noEmit -p services/reputation-service
npx tsc --noEmit -p services/community-service
npx tsc --noEmit -p services/simulation-service
```

- [ ] **Step 2: Run focused tests.**

```bash
npm --workspace @karmyq/shared test
npm --workspace karmyq-reputation-service test
npm --workspace karmyq-community-service test
npm --workspace @karmyq/simulation-service test
cd tests && npx jest tdd/sprint-117-projection-equivalence.test.ts regression/sprint-126-standing-projection-equivalence.test.ts --runInBand
npx jest --config jest.integration.config.js integration/sprint-126-standing-schema.integration.test.ts --runInBand
```

- [ ] **Step 3: Run the full blocking suite with safe concurrency.** Do not pipe through `tail`.

```bash
npx turbo run test --concurrency=2
npm run feedback:check
node scripts/audit-exemptions.js
git diff --check
```

- [ ] **Step 4: Prove operator behavior against the disposable database.** Retain the dry-run
  report. Do not point `--apply` at demo during implementation.

```bash
npm --workspace karmyq-reputation-service run backfill:standing
npm --workspace karmyq-reputation-service run backfill:standing -- --apply --batch-size 100
npm --workspace karmyq-reputation-service run backfill:standing
npm --workspace karmyq-reputation-service run backfill:standing -- --apply --batch-size 100
```

  Expected: first dry-run predicts writes; first apply performs them; second dry-run and second apply
  both report zero new projection writes; all active memberships were evaluated.

- [ ] **Step 5: Reconcile the handoff against git and PR state.** Preserve dated obligations and
  machine notes; record exact tests, remaining approval gates, and that demo apply still requires a
  backup plus separate authorization.

- [ ] **Step 6: Confirm clean intentional scope and hooks.** `docs/IDEAS.md` is a pre-existing user
  edit and must remain unstaged.

```bash
git status --short
git diff --cached --name-status
git config core.hooksPath
```

---

## Task 14: Merge, deploy, and separately authorize demo apply

**Files:**
- Read: `.github/pull_request_template.md`
- Modify: `.claude/handoff/CURRENT_HANDOFF.md` only after verified deployment/apply state changes.

**Interfaces:**
- Consumes: the reviewed branch, completed PR template, green CI, maintainer merge authorization,
  deploy approval, fresh backup, and separate demo-apply authorization.
- Produces: deployed `v11.46.0`, converged demo standing, retained operator report, and archived
  Sprint 126 handoff.

- [ ] **Step 1: Open the PR using the full template.** Fill every contract section, list the
  disposable PostgreSQL proof, and record any security-review dismissals with justification.

- [ ] **Step 2: Wait for all CI gates.** Unit/regression, PostgreSQL integration, dependency audit
  (ADR-059), CodeQL (ADR-060), PR contract, generated-schema drift, and docs/context drift must be
  green.

- [ ] **Step 3: Obtain explicit maintainer merge authorization.** Never self-merge; any `--admin`
  override requires its own explicit approval.

- [ ] **Step 3b: Prove the unique indexes can be created before deploying them.** The Task 1
  migration runs `CREATE UNIQUE INDEX` against demo *before* Step 7 collapses duplicates, and
  `IF NOT EXISTS` does not tolerate duplicate data — it aborts the migration and rolls the deploy
  back. The spec audited 0 duplicates (spec:101-102) but that is a 2026-08-19 snapshot, and the
  non-idempotent retry path this sprint replaces is exactly what would create one. Re-measure
  against demo immediately before the deploy and refuse to proceed on any non-zero count.

```sql
SELECT COUNT(*) FROM (
  SELECT 1 FROM reputation.karma_records WHERE related_entity_id IS NOT NULL
  GROUP BY user_id, community_id, reason, related_entity_id HAVING COUNT(*) > 1) d;
SELECT COUNT(*) FROM (
  SELECT 1 FROM reputation.activity_log WHERE related_entity_id IS NOT NULL
  GROUP BY user_id, community_id, activity_type, related_entity_id HAVING COUNT(*) > 1) d;

-- Measured, not gating: the migration rewrites these NULLs to 0 before SET NOT NULL.
SELECT COUNT(*) FROM reputation.trust_scores WHERE score IS NULL;
```

  Expected: both duplicate counts `0`. On any non-zero result, stop and resolve the duplicates as
  their own authorized data operation before the deploy. Record the NULL-score count before it is
  silently rewritten.

  Prefer a quiet deploy window: `scripts/deploy.sh` applies migrations at step 6 but does not
  rebuild service images until step 8, so the unique indexes are live against the OLD images for a
  few minutes. Task 1 made the pre-existing writers conflict-safe precisely to survive that gap.

- [ ] **Step 4: Use `/deploy`.** Merge and deploy schema/code without running the backfill. Verify
  service health and one ordinary live match completion first.

- [ ] **Step 5: Take a fresh demo database backup and run dry-run.** Re-measure the live match count
  and retain the report. The 2026-08-19 count of 7,817 is a snapshot, not an apply target.

- [ ] **Step 6: Obtain separate explicit authorization for demo `--apply`.** Deployment approval is
  not data-operation approval.

- [ ] **Step 7: Apply in bounded batches and prove convergence.**

```bash
npm --workspace karmyq-reputation-service run backfill:standing -- --apply --batch-size 100
npm --workspace karmyq-reputation-service run backfill:standing
npm --workspace karmyq-reputation-service run backfill:standing -- --apply --batch-size 100
```

- [ ] **Step 8: Human realism check.** Verify all active membership pairs were evaluated; inspect
  score/source/depth/breadth buckets; exercise PDX providers at floor 20 unless the source-derived
  distribution makes that threshold semantically unsuitable; trace representative low/medium/high
  profiles to stored matches. Do not permanently change the floor without separate authorization.

- [ ] **Step 9: Update/archive the handoff only after verified deployment and apply.** Only the
  orchestrator marks Sprint 126 complete.
