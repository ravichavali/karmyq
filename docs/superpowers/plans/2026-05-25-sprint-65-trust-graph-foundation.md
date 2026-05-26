# Trust Graph Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add weighted, decaying, community-scoped trust edges to the social-graph service — the data foundation for the v10.0 trust network arc.

**Architecture:** New `social_graph.trust_edges` table captures interaction history between users with per-type weights and 6-month half-life decay. A Bull queue subscriber fires on `match_completed` events to update edges. New API endpoint returns graph data ready for the Sprint 66 visualizer.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260525-trust-graph-foundation.sql` | Schema migration: trust_edges, interaction_weights, community_trust_edges |
| `services/social-graph-service/src/database/trustEdgeDb.ts` | DB layer: upsert/query trust edges |
| `services/social-graph-service/src/services/trustEdgeService.ts` | Business logic: upsert, weight computation, decay |
| `services/social-graph-service/src/events/subscriber.ts` | Bull queue subscriber: match_completed → upsert edge |
| `services/social-graph-service/src/routes/trustGraph.ts` | GET /trust/graph/:communityId, GET /trust/edge |
| `docs/adr/ADR-054-trust-graph-architecture.md` | ADR |
| `apps/landing/src/data/docs/concepts/adr-054-trust-graph-architecture.json` | Landing page ADR JSON |
| `services/social-graph-service/tests/tdd/sprint-65-trust-graph.test.ts` | TDD tests |

### Existing files to modify
| File | Change |
|------|--------|
| `infrastructure/postgres/init.sql` | Add new tables after existing social_graph block |
| `services/social-graph-service/src/services/pathComputation.ts` | Use trust_edges.raw_weight as edge cost (replaces karma proxy) |
| `services/social-graph-service/src/index.ts` | Register trustGraph router + start subscriber |
| `services/social-graph-service/CONTEXT.md` | Document new endpoints and schema |
| `services/registry.json` | Add new endpoints and event subscriber |
| `apps/landing/src/data/docs/nav.json` | Add ADR-054 entry |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Normalized pair**: Always store `user_id_a < user_id_b` (string compare on UUID). Normalize in `upsertTrustEdge` before writing. Violation = silent duplicate edges.

2. **`effective_weight` computed at read time**: `raw_weight` = sum of (count × type_weight). Apply half-life decay only when returning API responses, not when storing. Formula: `raw_weight × 0.5^(age_ms / HALF_LIFE_MS)` where `HALF_LIFE_MS = 6 months`.

3. **Backfill is mandatory**: Migration must populate `trust_edges` from existing `requests.matches WHERE status = 'completed'`. Without this, Sprint 66 visualization shows an empty graph on the demo server.

4. **Community-community edges**: When the two matched users have different primary community memberships, also increment `community_trust_edges` for that pair. Query `communities.members` to find primary community for each user (first active membership).

5. **Do NOT remove `social_graph.connections`**: Leave it. Other code may query it. Add `trust_edges` alongside. Deprecation is Sprint 71.

6. **Interaction weight lookup**: Read community override first (`WHERE community_id = $1`), fall back to platform default (`WHERE community_id IS NULL`). If no row found for type, default weight = 1.0.

7. **nav.json revert bug**: After editing `apps/landing/src/data/docs/nav.json`, always verify with `grep` before committing. The linter has silently reverted this file before (Sprint 64 incident).

---

## Task 1: Feature Branch + DB Migration

**Files:**
- Create: `infrastructure/postgres/migrations/20260525-trust-graph-foundation.sql`
- Modify: `infrastructure/postgres/init.sql`

- [ ] Create branch: `git checkout -b feature/sprint-65-trust-graph-foundation`

- [ ] Write migration file with new tables + indexes + seed data:

```sql
-- 20260525-trust-graph-foundation.sql
-- Trust Graph Foundation: weighted user-user and community-community edges

-- Weighted trust edges (community-scoped, bidirectional)
CREATE TABLE IF NOT EXISTS social_graph.trust_edges (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_a             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id_b             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id          UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  match_completed_count INT NOT NULL DEFAULT 0,
  endorsement_count     INT NOT NULL DEFAULT 0,
  karma_given_count     INT NOT NULL DEFAULT 0,
  event_count           INT NOT NULL DEFAULT 0,
  raw_weight            FLOAT NOT NULL DEFAULT 0,
  last_interaction_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trust_edges_normalized CHECK (user_id_a::text < user_id_b::text),
  UNIQUE(user_id_a, user_id_b, community_id)
);

CREATE INDEX IF NOT EXISTS trust_edges_user_a_community ON social_graph.trust_edges(user_id_a, community_id);
CREATE INDEX IF NOT EXISTS trust_edges_user_b_community ON social_graph.trust_edges(user_id_b, community_id);
CREATE INDEX IF NOT EXISTS trust_edges_community ON social_graph.trust_edges(community_id);
CREATE INDEX IF NOT EXISTS trust_edges_weight ON social_graph.trust_edges(raw_weight DESC);

-- Interaction weight config (NULL community_id = platform default)
CREATE TABLE IF NOT EXISTS social_graph.interaction_weights (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id     UUID REFERENCES communities.communities(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('match_completed','endorsement','karma_given','event')),
  weight           FLOAT NOT NULL DEFAULT 1.0,
  UNIQUE(community_id, interaction_type)
);

-- Platform default weights
INSERT INTO social_graph.interaction_weights (community_id, interaction_type, weight) VALUES
  (NULL, 'match_completed', 10.0),
  (NULL, 'endorsement',      5.0),
  (NULL, 'karma_given',      3.0),
  (NULL, 'event',            2.0)
ON CONFLICT DO NOTHING;

-- Community-to-community trust edges (fractal level 2)
CREATE TABLE IF NOT EXISTS social_graph.community_trust_edges (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id_a          UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  community_id_b          UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  cross_interaction_count INT NOT NULL DEFAULT 0,
  weight                  FLOAT NOT NULL DEFAULT 0,
  last_interaction_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT community_trust_normalized CHECK (community_id_a::text < community_id_b::text),
  UNIQUE(community_id_a, community_id_b)
);

-- Backfill trust_edges from existing completed matches
-- Uses 10.0 weight per match (platform default for match_completed)
-- Takes the first shared community between requester and responder
INSERT INTO social_graph.trust_edges (
  user_id_a, user_id_b, community_id,
  match_completed_count, raw_weight, last_interaction_at
)
SELECT
  LEAST(hr.requester_id::text, m.responder_id::text)::uuid   AS user_id_a,
  GREATEST(hr.requester_id::text, m.responder_id::text)::uuid AS user_id_b,
  rc.community_id,
  COUNT(*)::int                                               AS match_completed_count,
  COUNT(*) * 10.0                                             AS raw_weight,
  MAX(m.completed_at)                                         AS last_interaction_at
FROM requests.matches m
JOIN requests.help_requests hr ON hr.id = m.request_id
JOIN requests.request_communities rc ON rc.request_id = m.request_id
WHERE m.status = 'completed'
  AND m.completed_at IS NOT NULL
GROUP BY
  LEAST(hr.requester_id::text, m.responder_id::text),
  GREATEST(hr.requester_id::text, m.responder_id::text),
  rc.community_id
ON CONFLICT (user_id_a, user_id_b, community_id) DO UPDATE SET
  match_completed_count = EXCLUDED.match_completed_count,
  raw_weight            = EXCLUDED.raw_weight,
  last_interaction_at   = EXCLUDED.last_interaction_at,
  updated_at            = NOW();
```

- [ ] Add same tables to `infrastructure/postgres/init.sql` after the existing `social_graph.connections` block (line ~1285)

- [ ] **Verification**: Run migration against local DB, confirm tables exist and backfill populated:
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM social_graph.trust_edges;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM social_graph.interaction_weights;"
```

---

## Task 2: DB Layer — trustEdgeDb.ts

**Files:**
- Create: `services/social-graph-service/src/database/trustEdgeDb.ts`

- [ ] Implement functions:

```typescript
// Key functions to implement:
export async function upsertTrustEdge(params: {
  userA: string; userB: string; communityId: string;
  interactionType: 'match_completed' | 'endorsement' | 'karma_given' | 'event';
}): Promise<void>
// Normalizes pair (a < b), increments the count column, recalculates raw_weight,
// updates last_interaction_at. Uses ON CONFLICT DO UPDATE.

export async function getInteractionWeight(
  communityId: string,
  interactionType: string
): Promise<number>
// Reads community override first, falls back to NULL (platform default). Returns 1.0 if not found.

export async function getTrustGraph(communityId: string): Promise<{
  nodes: GraphNode[]; edges: GraphEdge[];
}>
// Returns all active members as nodes with trust_score + karma,
// and all trust_edges for the community as edges with effective_weight applied.

export async function getTrustEdge(
  userA: string; userB: string; communityId: string
): Promise<GraphEdge | null>

export async function upsertCommunityTrustEdge(
  communityA: string; communityB: string
): Promise<void>
// Normalizes pair, increments cross_interaction_count.
```

- [ ] `raw_weight` computation in upsert: fetch all 4 interaction weights for the community, multiply by counts, sum.

```typescript
const weights = await getInteractionWeightsForCommunity(communityId);
const rawWeight =
  newCounts.match_completed * weights.match_completed +
  newCounts.endorsement * weights.endorsement +
  newCounts.karma_given * weights.karma_given +
  newCounts.event * weights.event;
```

---

## Task 3: Service Layer — trustEdgeService.ts

**Files:**
- Create: `services/social-graph-service/src/services/trustEdgeService.ts`

- [ ] Implement `computeEffectiveWeight(rawWeight: number, lastInteractionAt: Date): number`:

```typescript
const HALF_LIFE_MS = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months
const ageMs = Date.now() - lastInteractionAt.getTime();
return rawWeight * Math.pow(0.5, ageMs / HALF_LIFE_MS);
```

- [ ] Implement `processMatchCompleted(params: { requesterId, responderId, communityId })`:
  1. Call `upsertTrustEdge({ userA: requesterId, userB: responderId, communityId, interactionType: 'match_completed' })`
  2. If requester and responder have different primary communities, call `upsertCommunityTrustEdge(communityA, communityB)`

- [ ] Implement `getTrustGraphForCommunity(communityId)` — wraps `getTrustGraph`, applies `computeEffectiveWeight` to each edge.

---

## Task 4: Event Subscriber — subscriber.ts

**Files:**
- Create: `services/social-graph-service/src/events/subscriber.ts`
- Modify: `services/social-graph-service/src/index.ts`

- [ ] Subscribe to `match_completed` on the `karmyq-events` Bull queue:

```typescript
import Queue from 'bull';
import { processMatchCompleted } from '../services/trustEdgeService';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const eventsQueue = new Queue('karmyq-events', REDIS_URL);

eventsQueue.process('match_completed', async (job) => {
  const { requesterId, responderId, communityId } = job.data;
  await processMatchCompleted({ requesterId, responderId, communityId });
});
```

- [ ] Start subscriber in `src/index.ts` (import and call, no await needed — subscriber runs in background)

- [ ] **Verification**: Use the simulation service or a manual test to complete a match and verify `trust_edges` row is created/updated.

---

## Task 5: API Route — trustGraph.ts

**Files:**
- Create: `services/social-graph-service/src/routes/trustGraph.ts`
- Modify: `services/social-graph-service/src/index.ts`

- [ ] Implement `GET /trust/graph/:communityId`:
  - Auth required (Bearer JWT)
  - Caller must be a member of the community
  - Return `{ nodes, edges }` from `getTrustGraphForCommunity`

- [ ] Implement `GET /trust/edge?userA=X&userB=Y&communityId=Z`:
  - Return single edge with `effective_weight`
  - Returns `{ data: null }` if no edge exists (not a 404)

- [ ] Register router in `src/index.ts`:
```typescript
import trustGraphRouter from './routes/trustGraph';
app.use('/trust', trustGraphRouter);
```

- [ ] **Verification**:
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3010/trust/graph/$COMMUNITY_ID
# Should return { success: true, data: { nodes: [...], edges: [...] } }
```

---

## Task 6: Update pathComputation.ts

**Files:**
- Modify: `services/social-graph-service/src/services/pathComputation.ts`

- [ ] In `computeShortestPath`: instead of querying `requests.matches` for edge existence, query `social_graph.trust_edges` to get edge weights. Use `raw_weight` as edge cost in BFS (lower weight = longer distance conceptually; invert: use `1/weight` as BFS cost or just prefer higher-weight paths).

Actually: keep the existing BFS logic (it works). Just change the trust score calculation at the end — instead of summing karma of intermediate nodes, sum the `effective_weight` of edges along the path.

```typescript
// Replace the karma-based trust score with edge weight sum
const trustScore = pathEdges.reduce((sum, edge) => sum + edge.effective_weight, 0);
```

- [ ] Fetch edge weights for path edges from `social_graph.trust_edges` after BFS completes (the path is known, so this is a targeted query).

- [ ] **Verification**: Call the existing trust path endpoint and verify `trustScore` is non-zero and edge-based.

---

## Task 7: ADR-054 + Landing Page

**Files:**
- Create: `docs/adr/ADR-054-trust-graph-architecture.md`
- Create: `apps/landing/src/data/docs/concepts/adr-054-trust-graph-architecture.json`
- Modify: `apps/landing/src/data/docs/nav.json`

- [ ] Write ADR-054 covering:
  - Trust ≠ Karma distinction
  - Bidirectional community-scoped edges
  - Interaction type hierarchy and modular weights
  - 6-month half-life decay (consistent with ADR-011)
  - Fractal property: user↔user and community↔community edges share the same structure
  - Relationship to existing social_graph.connections (parallel, not replacement)

- [ ] Create landing page JSON using standard ADR format:
```json
{
  "slug": "adr-054-trust-graph-architecture",
  "number": "054",
  "title": "ADR-054: Trust Graph Architecture",
  "status": "implemented",
  "description": "**Status**: Implemented",
  "content": "...(full ADR markdown)...",
  "filename": "ADR-054-trust-graph-architecture.md"
}
```

- [ ] Add nav.json entry under "Architecture Decisions":
```json
{ "title": "ADR-054: Trust Graph Architecture", "slug": "adr-054-trust-graph-architecture" }
```

- [ ] **Verify nav.json edit survived** (grep for the slug before committing — known revert bug):
```bash
grep "adr-054" apps/landing/src/data/docs/nav.json
```

- [ ] Commit landing docs with `git add -f` (files are in .gitignore):
```bash
git add -f apps/landing/src/data/docs/concepts/adr-054-trust-graph-architecture.json
git add -f apps/landing/src/data/docs/nav.json
```

---

## Task 8: Tests — Unit + TDD Integration (robust, no stubs)

**Files:**
- Create: `services/social-graph-service/tests/unit/trustEdge.test.ts`
- Create: `services/social-graph-service/tests/tdd/sprint-65-trust-graph.test.ts`
- Modify: `services/social-graph-service/CONTEXT.md`
- Modify: `services/registry.json`

### Testing philosophy for this sprint
No shallow tests. No stubs for logic under test. Assert specific values, not just truthiness. Every mathematical invariant must be proven with exact numbers. Integration tests hit the real DB.

---

### Unit tests — `tests/unit/trustEdge.test.ts`

These test pure functions with no DB. Fast, deterministic.

- [ ] **Pair normalization**:
```typescript
it('normalizes pair so user_id_a < user_id_b lexicographically', () => {
  const bigger = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  const smaller = '00000000-0000-0000-0000-000000000001';
  const { userIdA, userIdB } = normalizePair(bigger, smaller);
  expect(userIdA).toBe(smaller);
  expect(userIdB).toBe(bigger);
});

it('returns unchanged when already normalized', () => {
  const a = '00000000-0000-0000-0000-000000000001';
  const b = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  const { userIdA, userIdB } = normalizePair(a, b);
  expect(userIdA).toBe(a);
  expect(userIdB).toBe(b);
});
```

- [ ] **Decay formula — exact values**:
```typescript
const HALF_LIFE_MS = 6 * 30 * 24 * 60 * 60 * 1000;

it('returns full raw_weight for brand-new interaction (age = 0)', () => {
  const now = new Date();
  expect(computeEffectiveWeight(100, now)).toBeCloseTo(100, 5);
});

it('returns exactly half raw_weight at 6-month half-life', () => {
  const sixMonthsAgo = new Date(Date.now() - HALF_LIFE_MS);
  expect(computeEffectiveWeight(100, sixMonthsAgo)).toBeCloseTo(50, 1);
});

it('returns quarter raw_weight at 12 months (two half-lives)', () => {
  const twelveMonthsAgo = new Date(Date.now() - 2 * HALF_LIFE_MS);
  expect(computeEffectiveWeight(100, twelveMonthsAgo)).toBeCloseTo(25, 1);
});

it('returns 0 for raw_weight of 0 regardless of age', () => {
  const old = new Date(Date.now() - 5 * HALF_LIFE_MS);
  expect(computeEffectiveWeight(0, old)).toBe(0);
});
```

- [ ] **Raw weight computation from counts**:
```typescript
it('computes raw_weight correctly using platform default weights', () => {
  const counts = { match_completed: 2, endorsement: 1, karma_given: 0, event: 3 };
  const weights = { match_completed: 10, endorsement: 5, karma_given: 3, event: 2 };
  // 2×10 + 1×5 + 0×3 + 3×2 = 31
  expect(computeRawWeight(counts, weights)).toBe(31);
});

it('uses community-specific weight override when provided', () => {
  const counts = { match_completed: 1, endorsement: 0, karma_given: 0, event: 0 };
  const customWeights = { match_completed: 15, endorsement: 5, karma_given: 3, event: 2 };
  expect(computeRawWeight(counts, customWeights)).toBe(15);
});
```

---

### TDD Integration tests — `tests/tdd/sprint-65-trust-graph.test.ts`

These hit the real test DB. Use the existing integration test setup pattern (`tests/integration/setup.ts`).

- [ ] **DB upsert — first insert**:
```typescript
it('creates trust_edge row on first upsertTrustEdge call', async () => {
  await upsertTrustEdge({ userA: USER_A, userB: USER_B, communityId: COMMUNITY_ID, interactionType: 'match_completed' });
  const edge = await getTrustEdge(USER_A, USER_B, COMMUNITY_ID);
  expect(edge).not.toBeNull();
  expect(edge!.match_completed_count).toBe(1);
  expect(edge!.raw_weight).toBe(10.0);  // platform default for match_completed
});
```

- [ ] **DB upsert — idempotency and increment**:
```typescript
it('increments match_completed_count on second call, same pair', async () => {
  await upsertTrustEdge({ userA: USER_A, userB: USER_B, communityId: COMMUNITY_ID, interactionType: 'match_completed' });
  await upsertTrustEdge({ userA: USER_A, userB: USER_B, communityId: COMMUNITY_ID, interactionType: 'match_completed' });
  const edge = await getTrustEdge(USER_A, USER_B, COMMUNITY_ID);
  expect(edge!.match_completed_count).toBe(2);
  expect(edge!.raw_weight).toBe(20.0);
  // Assert only ONE row exists (no duplicate)
  const count = await pool.query(
    'SELECT COUNT(*) FROM social_graph.trust_edges WHERE user_id_a = $1 AND user_id_b = $2 AND community_id = $3',
    [min(USER_A, USER_B), max(USER_A, USER_B), COMMUNITY_ID]
  );
  expect(parseInt(count.rows[0].count)).toBe(1);
});
```

- [ ] **Reversed pair produces same row**:
```typescript
it('stores reversed pair submission in the same row as forward pair', async () => {
  await upsertTrustEdge({ userA: USER_B, userB: USER_A, communityId: COMMUNITY_ID, interactionType: 'match_completed' });
  await upsertTrustEdge({ userA: USER_A, userB: USER_B, communityId: COMMUNITY_ID, interactionType: 'match_completed' });
  const edge = await getTrustEdge(USER_A, USER_B, COMMUNITY_ID);
  expect(edge!.match_completed_count).toBe(2);  // both landed on same row
});
```

- [ ] **Different community = separate row**:
```typescript
it('creates separate edge for same user pair in different community', async () => {
  await upsertTrustEdge({ userA: USER_A, userB: USER_B, communityId: COMMUNITY_A, interactionType: 'match_completed' });
  await upsertTrustEdge({ userA: USER_A, userB: USER_B, communityId: COMMUNITY_B, interactionType: 'match_completed' });
  const edgeA = await getTrustEdge(USER_A, USER_B, COMMUNITY_A);
  const edgeB = await getTrustEdge(USER_A, USER_B, COMMUNITY_B);
  expect(edgeA!.match_completed_count).toBe(1);
  expect(edgeB!.match_completed_count).toBe(1);
});
```

- [ ] **Mixed interaction types accumulate correctly**:
```typescript
it('accumulates different interaction types on the same edge', async () => {
  await upsertTrustEdge({ userA: USER_A, userB: USER_B, communityId: COMMUNITY_ID, interactionType: 'match_completed' });
  await upsertTrustEdge({ userA: USER_A, userB: USER_B, communityId: COMMUNITY_ID, interactionType: 'endorsement' });
  const edge = await getTrustEdge(USER_A, USER_B, COMMUNITY_ID);
  expect(edge!.match_completed_count).toBe(1);
  expect(edge!.endorsement_count).toBe(1);
  expect(edge!.raw_weight).toBe(15.0);  // 10 + 5 platform defaults
});
```

- [ ] **Non-existent edge returns null**:
```typescript
it('returns null for users who have never interacted', async () => {
  const edge = await getTrustEdge(USER_A, USER_C_NEVER_INTERACTED, COMMUNITY_ID);
  expect(edge).toBeNull();
});
```

- [ ] **Community-community edge created for cross-community match**:
```typescript
it('creates community_trust_edges row when matched users are from different communities', async () => {
  // USER_A's primary community = COMMUNITY_A, USER_X's primary community = COMMUNITY_B
  await processMatchCompleted({ requesterId: USER_A, responderId: USER_X_OTHER_COMMUNITY, communityId: COMMUNITY_A });
  const commEdge = await pool.query(
    `SELECT * FROM social_graph.community_trust_edges
     WHERE (community_id_a = $1 AND community_id_b = $2)
        OR (community_id_a = $2 AND community_id_b = $1)`,
    [COMMUNITY_A, COMMUNITY_B]
  );
  expect(commEdge.rows.length).toBe(1);
  expect(commEdge.rows[0].cross_interaction_count).toBe(1);
});
```

- [ ] **API auth guard**:
```typescript
it('GET /trust/graph/:communityId returns 401 without auth header', async () => {
  const res = await request(app).get(`/trust/graph/${COMMUNITY_ID}`);
  expect(res.status).toBe(401);
});
```

- [ ] **API response shape**:
```typescript
it('GET /trust/graph/:communityId returns nodes and edges with required fields', async () => {
  // Seed one edge first
  await upsertTrustEdge({ userA: USER_A, userB: USER_B, communityId: COMMUNITY_ID, interactionType: 'match_completed' });
  const res = await request(app)
    .get(`/trust/graph/${COMMUNITY_ID}`)
    .set('Authorization', `Bearer ${memberToken}`);
  expect(res.status).toBe(200);
  expect(res.body.data.nodes).toBeInstanceOf(Array);
  expect(res.body.data.edges).toBeInstanceOf(Array);
  // Every edge must have these fields
  const edge = res.body.data.edges[0];
  expect(edge).toHaveProperty('source');
  expect(edge).toHaveProperty('target');
  expect(edge).toHaveProperty('raw_weight');
  expect(edge).toHaveProperty('effective_weight');
  expect(typeof edge.effective_weight).toBe('number');
  // effective_weight must be <= raw_weight (decay applied)
  expect(edge.effective_weight).toBeLessThanOrEqual(edge.raw_weight);
});
```

- [ ] **GET /trust/edge for non-existent pair returns null data, not 404**:
```typescript
it('GET /trust/edge returns { data: null } for unknown pair', async () => {
  const res = await request(app)
    .get(`/trust/edge?userA=${USER_A}&userB=${USER_C_NEVER_INTERACTED}&communityId=${COMMUNITY_ID}`)
    .set('Authorization', `Bearer ${memberToken}`);
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  expect(res.body.data).toBeNull();
});
```

- [ ] **pathComputation regression — edge-weight-based trust score**:
```typescript
it('computeTrustPath returns trustScore from edge weights, not karma', async () => {
  // Seed a trust edge between USER_A and USER_B
  await upsertTrustEdge({ userA: USER_A, userB: USER_B, communityId: COMMUNITY_ID, interactionType: 'match_completed' });
  const path = await computeTrustPath(USER_A, USER_B, COMMUNITY_ID);
  expect(path).not.toBeNull();
  // trustScore should now reflect edge weight, not karma sum
  // A direct 1-degree connection has no intermediate nodes, so trustScore = 0 by convention
  // (only intermediate node weights/edges count in path score)
  expect(path!.degrees).toBe(1);
});
```

---

### Run all tests

- [ ] Unit tests:
```bash
cd services/social-graph-service && npm run test:unit
```

- [ ] TDD tests:
```bash
cd services/social-graph-service && npm run test:tdd
```

- [ ] Full suite from root (must pass before push):
```bash
npm test
```

---

## Task 9: CONTEXT.md + registry.json

**Files:**
- Modify: `services/social-graph-service/CONTEXT.md`
- Modify: `services/registry.json`

- [ ] Update `services/social-graph-service/CONTEXT.md`:
  - "API Endpoints" section: add `GET /trust/graph/:communityId` and `GET /trust/edge`
  - "Database Schema" section: add `social_graph.trust_edges`, `social_graph.interaction_weights`, `social_graph.community_trust_edges`
  - "Events" section: add `match_completed` as subscribed event

- [ ] Update `services/registry.json` entry for `social-graph-service`:
  - Add to `apis.provides`: `GET /trust/graph/:communityId` and `GET /trust/edge`
  - Add to `events.subscribes`: `match_completed`

- [ ] Run `npm run feedback:check` to verify docs are complete:
```bash
npm run feedback:check
```

---

## Task 10: Type Check + Pre-Push Verification

**Files:** No new files.

- [ ] TypeScript check (social-graph-service):
```bash
cd services/social-graph-service && npx tsc --noEmit
```

- [ ] Full test suite (root):
```bash
npm test
```

- [ ] Feedback loop check:
```bash
npm run feedback:check
```

- [ ] Bump version in `package.json`: `9.40.0` → `9.50.0`

- [ ] Verify nav.json one final time:
```bash
grep "adr-054" apps/landing/src/data/docs/nav.json
```

---

## Task 11: Merge + Deploy

- [ ] Merge to master and push:
```bash
git checkout master && git merge feature/sprint-65-trust-graph-foundation
git push origin master
```

- [ ] Monitor GitHub Actions — watch for Docker build + test results

- [ ] SSH to demo server and run migration:
```bash
ssh ubuntu@karmyq.com
psql -U postgres -d karmyq < ~/karmyq/infrastructure/postgres/migrations/20260525-trust-graph-foundation.sql
```

- [ ] Verify trust_edges populated on demo server:
```bash
psql -U postgres -d karmyq -c "SELECT COUNT(*) FROM social_graph.trust_edges;"
```

- [ ] Use `/deploy` skill for full deploy sequence if GitHub Actions doesn't auto-trigger.
