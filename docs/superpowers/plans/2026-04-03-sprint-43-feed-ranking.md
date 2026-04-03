# Feed Ranking v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the community feed the primary driver of participation by scoring on 7 trust signals and logging feed outcomes for future weight tuning.

**Architecture:** Extend the shared `calculateFeedScore()` function and `FeedScoringWeights` type with 3 new signals (requester trust score, prior interaction, recency); add a `requests.feed_events` table for impression/outcome logging; batch-query `social_graph.connections` in the curated feed endpoint; fix CommitmentsTab chronological sort.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260403-feed-ranking-v2.sql` | New weight columns + feed_events table + row update |
| `docs/adr/ADR-038-feed-ranking-v2.md` | Architecture decision record for 7-signal feed |
| `apps/landing/src/data/docs/concepts/adr-038-feed-ranking-v2.json` | Landing page ADR entry |
| `docs/superpowers/specs/2026-04-03-sprint-43-feed-ranking-design.md` | Design spec (already created) |
| `tests/tdd/sprint-43-feed-ranking.test.ts` | Integration test for new signals |

### Existing files to modify
| File | Change |
|------|--------|
| `packages/shared/src/matching/types.ts` | Add 3 new fields to `FeedScoreInput` and `FeedScoringWeights` |
| `packages/shared/src/matching/utils.ts` | Extend `calculateFeedScore()`, `DEFAULT_FEED_WEIGHTS`, add `scoreRecency()`, add weight-sum validation |
| `packages/shared/src/matching/__tests__/feedScoring.test.ts` | Tests for new signals and validation |
| `services/request-service/src/routes/requests.ts` | Batch connections query, recency calc, new signal wiring, feed_events logging |
| `apps/frontend/src/utils/commitmentSort.ts` | Sort by `created_at ASC` within status groups |
| `apps/frontend/src/components/CommitmentsTab.tsx` | Ensure `created_at` available in sort |
| `services/request-service/CONTEXT.md` | Document feed_events table + updated feed formula |
| `services/registry.json` | Add feed_events schema entry |
| `apps/landing/src/data/docs/services/request-service.json` | Document feed event logging endpoint behavior |
| `apps/landing/src/data/docs/nav.json` | Add ADR-038 under Architecture Decisions |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Weight sum constraint** — Drop the DB CHECK constraint on `community_configs`; enforce in `calculateFeedScore()` (throw if weights don't sum to 1.0 ± 0.01).

2. **Existing config rows** — Migration MUST `UPDATE` all rows to new weights before committing. Columns added with DEFAULT 0 + no UPDATE = broken sum validation on first feed call.

3. **Prior interaction batch query** — Single SQL query, both directions:
   ```sql
   SELECT
     CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END as other_user_id,
     type, last_interaction_at
   FROM social_graph.connections
   WHERE (user_a_id = $1 OR user_b_id = $1)
     AND (CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END) = ANY($2::uuid[])
   ```
   Score: `type='exchange'` → 100, `type='community'` → 50, no row → 0.

4. **Feed events non-blocking** — `void (async () => { await query(...) })()` inside `setImmediate`. Never `await` in the feed response path. Wrap in try/catch; log but never rethrow.

5. **Recency in app layer** — No DB join. Compute from `request.created_at` (already in response row).

6. **CommitmentsTab** — Sort direction: `created_at ASC` (earliest first) within each status group. Verify `created_at` is present on match objects from the API; if not, add it to the matches query.

7. **Error messages** — Every new catch block must log structured context: `{ service, endpoint, step, error }`. Distinguish user errors (400) from unexpected errors (500) in response messages.

---

## Task 1: Feature branch + DB migration

**Files:**
- Create: `infrastructure/postgres/migrations/20260403-feed-ranking-v2.sql`

- [ ] **Checkout feature branch**

```bash
git checkout -b feature/sprint-43-feed-ranking
```

- [ ] **Write migration**

```sql
-- 20260403-feed-ranking-v2.sql
-- Sprint 43: Extend feed scoring weights + add feed_events table

BEGIN;

-- 1. Add new weight columns to community_configs
ALTER TABLE communities.community_configs
  ADD COLUMN IF NOT EXISTS feed_weight_requester_trust   DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS feed_weight_prior_interaction DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS feed_weight_recency           DECIMAL(3,2) NOT NULL DEFAULT 0.00;

-- 2. Drop the old 4-column sum constraint (name from migration 013)
ALTER TABLE communities.community_configs
  DROP CONSTRAINT IF EXISTS community_configs_feed_weights_sum_check,
  DROP CONSTRAINT IF EXISTS chk_feed_weights_sum;

-- 3. Redistribute all existing rows to new 7-signal defaults
UPDATE communities.community_configs SET
  feed_weight_skill_match         = 0.25,
  feed_weight_trust_distance      = 0.20,
  feed_weight_community_relevance = 0.15,
  feed_weight_urgency             = 0.10,
  feed_weight_requester_trust     = 0.15,
  feed_weight_prior_interaction   = 0.15,
  feed_weight_recency             = 0.05;

-- 4. Create feed_events table
CREATE TABLE IF NOT EXISTS requests.feed_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id    UUID NOT NULL REFERENCES requests.help_requests(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK (event_type IN ('impression', 'offer_made', 'match_completed')),
  feed_score    NUMERIC(5,2),
  feed_rank     INTEGER,
  source_tier   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_events_user
  ON requests.feed_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_events_request
  ON requests.feed_events(request_id, event_type);
CREATE INDEX IF NOT EXISTS idx_feed_events_type_date
  ON requests.feed_events(event_type, created_at DESC);

COMMIT;
```

- [ ] **Verify migration runs locally**

```bash
psql $DATABASE_URL -f infrastructure/postgres/migrations/20260403-feed-ranking-v2.sql
psql $DATABASE_URL -c "\d requests.feed_events"
psql $DATABASE_URL -c "SELECT feed_weight_requester_trust, feed_weight_prior_interaction, feed_weight_recency FROM communities.community_configs LIMIT 3;"
```

---

## Task 2: Extend shared types

**Files:**
- Modify: `packages/shared/src/matching/types.ts`

- [ ] **Add 3 fields to `FeedScoringWeights`**

In `FeedScoringWeights` interface, add after `feed_weight_urgency`:
```typescript
feed_weight_requester_trust: number;
feed_weight_prior_interaction: number;
feed_weight_recency: number;
```

- [ ] **Add 3 fields to `FeedScoreInput`**

In `FeedScoreInput` interface, add after `urgencyScore`:
```typescript
requesterTrustScore: number;      // 0-100, from requester's trust_score
priorInteractionScore: number;    // 0-100, 100=prior exchange, 50=community, 0=none
recencyScore: number;             // 0-100, time-decay of request age
```

- [ ] **Build shared package**

```bash
cd packages/shared && npm run build
```

---

## Task 3: Extend scoring function

**Files:**
- Modify: `packages/shared/src/matching/utils.ts`

- [ ] **Update `DEFAULT_FEED_WEIGHTS`**

```typescript
export const DEFAULT_FEED_WEIGHTS: FeedScoringWeights = {
  feed_weight_skill_match: 0.25,
  feed_weight_trust_distance: 0.20,
  feed_weight_community_relevance: 0.15,
  feed_weight_urgency: 0.10,
  feed_weight_requester_trust: 0.15,
  feed_weight_prior_interaction: 0.15,
  feed_weight_recency: 0.05,
};
```

- [ ] **Add `scoreRecency()` helper** (after `scoreTrustDistance`):

```typescript
/**
 * Score request freshness based on age in days.
 * Newer requests score higher to surface timely needs.
 */
export function scoreRecency(createdAt: Date | string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 1) return 100;
  if (ageDays <= 3) return 85;
  if (ageDays <= 7) return 70;
  if (ageDays <= 14) return 50;
  if (ageDays <= 30) return 30;
  return 15;
}
```

- [ ] **Extend `calculateFeedScore()`** to include 3 new signals and add weight-sum validation:

Replace the function body so it:
1. Validates `sum(weights) === 1.0 ± 0.01` (throw `Error('Feed weights must sum to 1.0')`)
2. Clamps and computes `requesterTrust`, `priorInteraction`, `recency`
3. Includes them in the weighted sum
4. Includes them in `breakdown`

- [ ] **Rebuild shared**

```bash
cd packages/shared && npm run build
```

---

## Task 4: Unit tests for new scoring

**Files:**
- Modify: `packages/shared/src/matching/__tests__/feedScoring.test.ts`

- [ ] **Add tests for `scoreRecency()`**
  - 6 hours old → 100
  - 2 days old → 85
  - 5 days old → 70
  - 10 days old → 50
  - 20 days old → 30
  - 45 days old → 15

- [ ] **Add tests for new signals in `calculateFeedScore()`**
  - All 7 signals weighted correctly in output
  - `breakdown` includes `requesterTrust`, `priorInteraction`, `recency`

- [ ] **Add test for weight-sum validation**
  - Throws when weights sum to 0.90
  - Does not throw when weights sum to 1.00 or 1.005

- [ ] **Run tests**

```bash
cd packages/shared && npm test
```

---

## Task 5: Update `/requests/curated` endpoint

**Files:**
- Modify: `services/request-service/src/routes/requests.ts`

- [ ] **Add batch prior-interaction query** (after the karma batch query, ~line 511):

```typescript
// Batch prior interaction lookup (social_graph.connections)
const priorInteractionMap = new Map<string, 'exchange' | 'community' | null>();
if (requesterIds.length > 0) {
  try {
    const connResult = await query(
      `SELECT
         CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END as other_user_id,
         type
       FROM social_graph.connections
       WHERE (user_a_id = $1 OR user_b_id = $1)
         AND (CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END) = ANY($2::uuid[])`,
      [userId, requesterIds]
    );
    for (const row of connResult.rows) {
      priorInteractionMap.set(row.other_user_id, row.type as 'exchange' | 'community');
    }
  } catch (e: any) {
    console.error({ service: 'request-service', endpoint: '/requests/curated', step: 'prior-interaction-batch', error: e.message });
    // Non-fatal — continue without prior interaction signal
  }
}
```

- [ ] **Add helper to score prior interaction** (inline or as a local function):

```typescript
function scorePriorInteraction(type: 'exchange' | 'community' | null | undefined): number {
  if (type === 'exchange') return 100;
  if (type === 'community') return 50;
  return 0;
}
```

- [ ] **Wire new signals into `calculateFeedScore()` call** (in `requestsWithScores.map`):

```typescript
const priorInteraction = scorePriorInteraction(priorInteractionMap.get(request.requester_id));
const recency = scoreRecency(request.created_at);
const requesterTrust = requesterReputation.trustScore; // already fetched

const feedResult = calculateFeedScore(
  {
    skillMatchScore: matchResult.score,
    trustDistanceScore: trustDistance,
    communityRelevanceScore: communityRelevance,
    urgencyScore: urgencyVal,
    requesterTrustScore: requesterTrust,
    priorInteractionScore: priorInteraction,
    recencyScore: recency,
  },
  weights
);
```

- [ ] **Add new fields to breakdown in the returned object**:

```typescript
priorInteractionScore: priorInteraction,
recencyScore: recency,
```

- [ ] **Apply same changes to sister community scoring block** (~line 605)

- [ ] **Import `scoreRecency` from shared package** at top of file

- [ ] **Type check**

```bash
cd services/request-service && npx tsc --noEmit
```

---

## Task 6: Feed events logging

**Files:**
- Modify: `services/request-service/src/routes/requests.ts`

- [ ] **Add impression logging at the end of `/requests/curated`** (after response is sent or just before, fire-and-forget):

After the `return res.json(...)` block (or just before, using `setImmediate`):
```typescript
// Fire-and-forget: log impressions to feed_events (never block feed response)
setImmediate(() => {
  void (async () => {
    try {
      const impressionValues = filteredAndSorted
        .slice(0, limit)
        .map((r: any, idx: number) => ({
          userId,
          requestId: r.id,
          feedScore: r.feedScore,
          feedRank: idx + 1,
          sourceTier: r.sourceTier,
        }));

      if (impressionValues.length > 0) {
        const placeholders = impressionValues.map(
          (_: any, i: number) => `($${i*5+1}, $${i*5+2}, 'impression', $${i*5+3}, $${i*5+4}, $${i*5+5})`
        ).join(', ');
        const flatValues = impressionValues.flatMap((v: any) => [
          v.userId, v.requestId, v.feedScore, v.feedRank, v.sourceTier
        ]);
        await query(
          `INSERT INTO requests.feed_events (user_id, request_id, event_type, feed_score, feed_rank, source_tier)
           VALUES ${placeholders}
           ON CONFLICT DO NOTHING`,
          flatValues
        );
      }
    } catch (e: any) {
      console.error({ service: 'request-service', step: 'feed-impression-log', error: e.message });
    }
  })();
});
```

- [ ] **Add `offer_made` event logging** in the match creation handler (POST `/requests/:id/matches`):

After a successful match insert, fire-and-forget:
```typescript
setImmediate(() => {
  void query(
    `INSERT INTO requests.feed_events (user_id, request_id, event_type)
     VALUES ($1, $2, 'offer_made')
     ON CONFLICT DO NOTHING`,
    [userId, requestId]
  ).catch((e: any) => console.error({ service: 'request-service', step: 'feed-offer-log', error: e.message }));
});
```

- [ ] **Add `match_completed` event logging** in the Bull event handler for `match_completed`:

Find the event handler that processes `match_completed` in the request service. After existing processing:
```typescript
void query(
  `INSERT INTO requests.feed_events (user_id, request_id, event_type)
   VALUES ($1, $2, 'match_completed')
   ON CONFLICT DO NOTHING`,
  [helperId, requestId]
).catch((e: any) => console.error({ service: 'request-service', step: 'feed-completion-log', error: e.message }));
```

- [ ] **Type check**

```bash
cd services/request-service && npx tsc --noEmit
```

---

## Task 7: CommitmentsTab sort fix

**Files:**
- Modify: `apps/frontend/src/utils/commitmentSort.ts`
- Modify: `apps/frontend/src/components/CommitmentsTab.tsx`

- [ ] **Update sort direction in `commitmentSort.ts`**

Change the secondary sort from `updated_at DESC` to `created_at ASC`:
```typescript
// Was:
return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
// Now:
return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
```

Update the generic type constraint from `{ status: string; updated_at: string }` to `{ status: string; created_at: string }`.

- [ ] **Verify `created_at` is present on match objects in `CommitmentsTab.tsx`**

Search for where matches are fetched and check the API response shape includes `created_at`. If it doesn't, add it to the SQL query in the matches endpoint. Check `services/request-service/src/routes/requests.ts` GET `/matches`.

- [ ] **Build frontend to verify no type errors**

```bash
cd apps/frontend && npx tsc --noEmit
```

---

## Task 8: Feed correctness check

**Files:**
- Read-only check: `services/request-service/src/routes/requests.ts`
- Read-only check: `apps/frontend/src/components/CommitmentsTab.tsx`

- [ ] **Verify `dibs_pending` status is excluded from browse feed**

In the `/requests/curated` query, the `WHERE r.status = 'open'` clause excludes `dibs_pending` (comment already present at line 346). Confirm this is correct: requests in `dibs_pending` state should NOT appear in browse feed.

If `dibs_pending` is a separate status value (not `'open'`): confirmed — filter is correct.
If `dibs_pending` requests still have `status = 'open'` with a separate column flag: the filter may be insufficient — check `help_requests` schema.

- [ ] **Verify both parties see matched request in CommitmentsTab**

Check the GET `/matches` endpoint. It should return matches where `user_id = $1 OR helper_id = $1` (both requester and helper). If it only returns one side, fix the query.

- [ ] **Document findings** — if no bugs found, note "verified correct" in commit message.

---

## Task 9: ADR-038 + user guides + landing docs

**Files:**
- Create: `docs/adr/ADR-038-feed-ranking-v2.md`
- Create: `apps/landing/src/data/docs/concepts/adr-038-feed-ranking-v2.json`
- Modify: `apps/landing/src/data/docs/nav.json`
- Modify: `apps/landing/src/data/docs/services/request-service.json`

- [ ] **Write ADR-038**

```markdown
# ADR-038: Feed Ranking v2 — 7-Signal Formula + Interaction Logging

**Status**: Implemented
**Date**: 2026-04-03
**Supersedes**: ADR-031 (feed scoring weights — extended, not replaced)

## Context
The Sprint 43 feed improvement extends ADR-031's 4-signal feed scoring with 3 additional
signals: requester trust score, prior interaction history, and request recency. It also
introduces a `feed_events` table to log impressions and outcomes for future weight tuning.

## Decision
Extend `FeedScoringWeights` and `FeedScoreInput` with `requesterTrustScore`,
`priorInteractionScore`, and `recencyScore`. Redistribute default weights to sum to 1.0
across all 7 signals. Move weight-sum validation from DB constraint to application code.
Add `requests.feed_events` table with fire-and-forget impression/outcome logging.

## Signal Definitions
- **requesterTrustScore**: Requester's community trust score (0–100) from `reputation.trust_scores`
- **priorInteractionScore**: 100 if viewer and requester have a prior exchange, 50 if community-only, 0 if none. Source: `social_graph.connections`
- **recencyScore**: Time-decay score: 100 (0–1d) → 85 (2–3d) → 70 (4–7d) → 50 (8–14d) → 30 (15–30d) → 15 (30d+)

## Default Weights (v2)
skill_match=0.25, trust_distance=0.20, community_relevance=0.15, urgency=0.10,
requester_trust=0.15, prior_interaction=0.15, recency=0.05

## Logging Strategy
`requests.feed_events` records: impression (on feed load), offer_made (on match creation),
match_completed (on Bull event). This enables correlation analysis: do higher prior_interaction
scores actually lead to more completions? Weights can be tuned based on this data.

## Consequences
- Feed results will shift: requests from people you've helped before, and fresh requests,
  will rank higher. Skill match weight decreases from 40% to 25%.
- Community admins can override weights in `community_configs` (7 columns).
- Weight-sum validation moves to application code — misconfigured weights throw at call time.
```

- [ ] **Create landing ADR JSON**

```json
{
  "slug": "adr-038-feed-ranking-v2",
  "number": "038",
  "title": "ADR-038: Feed Ranking v2",
  "status": "implemented",
  "description": "**Status**: Implemented",
  "content": "# ADR-038: Feed Ranking v2 — 7-Signal Formula + Interaction Logging\n\n...(full content)...",
  "filename": "ADR-038-feed-ranking-v2.md"
}
```

- [ ] **Add to nav.json** under "Architecture Decisions":

```json
{ "title": "ADR-038: Feed Ranking v2", "href": "/docs/adr-038-feed-ranking-v2" }
```

- [ ] **Update `request-service.json`** — add `feed_events` table description and note updated `/requests/curated` behavior (7 signals, impression logging).

---

## Task 10: CONTEXT.md + registry.json

**Files:**
- Modify: `services/request-service/CONTEXT.md`
- Modify: `services/registry.json`

- [ ] **Update `services/request-service/CONTEXT.md`**
  - "API Endpoints" section: note `/requests/curated` now uses 7-signal formula; note `priorInteractionScore` and `recencyScore` in response
  - "Database Schema" section: add `requests.feed_events` table description
  - "Recent Fixes / Changes" section: Sprint 43 feed ranking v2

- [ ] **Update `services/registry.json`**
  - Add `feed_events` under request-service schema entries

- [ ] **Run feedback check**

```bash
npm run feedback:check
```

---

## Task 11: TDD integration test

**Files:**
- Create: `tests/tdd/sprint-43-feed-ranking.test.ts`

- [ ] **Write integration test** covering:
  - `GET /requests/curated` returns `priorInteractionScore` and `recencyScore` in `feedBreakdown`
  - `requests.feed_events` has an impression row after feed load
  - Requests from a user the viewer has matched with before rank above otherwise-equal requests
  - CommitmentsTab sort: earliest commitment appears first

```typescript
describe('Sprint 43: Feed Ranking v2', () => {
  it('GET /requests/curated returns new signal breakdown fields');
  it('logs impression events to feed_events after feed load');
  it('requests from prior exchange partners rank higher');
  it('recency score is 100 for today, decays for older requests');
});
```

---

## Task 12: Final verification

- [ ] **Run all tests**

```bash
npm test
npm run test:tdd
```

- [ ] **Type check both changed packages**

```bash
cd packages/shared && npx tsc --noEmit
cd services/request-service && npx tsc --noEmit
cd apps/frontend && npx tsc --noEmit
```

- [ ] **Run feedback check**

```bash
npm run feedback:check
```

- [ ] **Confirm feed_events table exists on local DB**

```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM requests.feed_events;"
```

- [ ] **Manual spot-check**: Load the browse feed. Check browser network tab — `/requests/curated` should return `feedBreakdown` with all 7 signal fields.

---

## Task 13: Merge + Deploy

- [ ] **Use the `/deploy` skill** — merge to master, push, monitor GitHub Actions, SSH to run migration if needed.

```bash
git checkout master
git merge feature/sprint-43-feed-ranking
git push origin master
```

Monitor: GitHub Actions → deploy job → health check.

If migration needs manual run on demo server:
```bash
ssh ubuntu@karmyq.com
cd ~/karmyq
psql $DATABASE_URL -f infrastructure/postgres/migrations/20260403-feed-ranking-v2.sql
```
