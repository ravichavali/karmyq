# Interaction Half-Life Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace stored trust weight snapshots with intrinsic Ebbinghaus decay (computed live via a DB view), hard-delete completed+rated requests after 30 days, and surface the half-life metaphor visually in the trust graph and request feed.

**Architecture:** A new `stability` column on `trust_edges` grows with each interaction, and a `trust_edges_live` view computes `current_weight` on every read — no job does the decaying. Two sweep jobs in cleanup-service handle garbage collection only (deleting dead edges and TTL-expired requests).

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, node-cron.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260526-interaction-halflife.sql` | Add `stability` column, create `trust_decay_config` table, create `trust_edges_live` view |
| `services/social-graph-service/src/database/trustDecayConfigDb.ts` | Read/upsert decay config |
| `services/social-graph-service/src/routes/trustDecayConfig.ts` | Admin endpoints: GET/PUT decay config |
| `services/cleanup-service/src/jobs/trustEdgeSweepJob.ts` | Delete edges below disappearance threshold |
| `services/cleanup-service/src/jobs/requestTtlSweepJob.ts` | Hard-delete completed+rated requests older than 30 days |
| `docs/adr/ADR-056-intrinsic-trust-decay.md` | ADR for the intrinsic decay architecture decision |
| `apps/landing/src/data/docs/guides/interaction-half-life.json` | User guide: half-life concept, fading UI, what happens at 30 days |
| `apps/landing/src/data/docs/concepts/adr-056-intrinsic-trust-decay.json` | Landing ADR page |
| `services/social-graph-service/tests/tdd/sprint-68-halflife.test.ts` | TDD integration tests |

### Existing files to modify
| File | Change |
|------|--------|
| `services/social-graph-service/src/database/trustEdgeDb.ts` | `upsertTrustEdge` grows stability; `getTrustGraph*` query `trust_edges_live`; return `raw_weight` + `current_weight` |
| `services/social-graph-service/src/routes/trustGraph.ts` | Mount decay config router |
| `services/social-graph-service/src/index.ts` | Register decay config routes |
| `services/cleanup-service/src/index.ts` | Register two new sweep jobs (cron + admin endpoints) |
| `apps/frontend/src/components/TrustGraph.tsx` | Edge opacity from `decay_ratio = current_weight / raw_weight` |
| `apps/frontend/src/components/Feed/FeedItem.tsx` | Completed request fading from `completed_at` age |
| `apps/frontend/src/components/OfferItem.tsx` | Completed offer fading from `completed_at` age |
| `apps/landing/src/data/docs/nav.json` | Add interaction-half-life guide + ADR-056 entries |
| `scripts/generate-docs.ts` | Add `interaction-half-life` + `adr-056-intrinsic-trust-decay` to hardcoded slug list |
| `services/social-graph-service/CONTEXT.md` | Document new view, config table, stability field |
| `services/cleanup-service/CONTEXT.md` | Document two new sweep jobs |
| `services/registry.json` | Add new social-graph-service endpoints |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **`raw_weight` is peak weight, never decayed.** Only update it when a new interaction occurs. The view reads it as the decay ceiling.
2. **Stability grows on every `upsertTrustEdge` call.** Read community's `stability_growth_rate` from `trust_decay_config` (fall back to global NULL row). Formula: `stability = stability * (1 + rate)`.
3. **All `getTrustGraph*` functions must query `trust_edges_live`, not `trust_edges`.** The view adds `current_weight` to every row.
4. **Return both `raw_weight` and `current_weight` from the API.** Frontend needs both to compute `decay_ratio` for opacity.
5. **Request TTL sweep: delete `requests.matches` before `requests.help_requests`** (FK constraint).
6. **Sweep jobs follow the existing cleanup-service pattern**: job function + `cron.schedule` entry + admin POST endpoint.
7. **FeedItem/OfferItem fading is client-side only** — no API change needed.
8. **Migration is additive**: `ADD COLUMN stability FLOAT NOT NULL DEFAULT 1.0` — zero existing rows break.
9. **nav.json revert bug**: add new slugs to hardcoded list in `scripts/generate-docs.ts` or they'll be wiped on next build.
10. **Landing docs are gitignored**: always `git add -f apps/landing/src/data/docs/`.

---

## Task 1: Feature branch + DB migration

**Files:**
- Create: `infrastructure/postgres/migrations/20260526-interaction-halflife.sql`

- [ ] **Create branch**
```bash
git checkout -b feature/sprint-68-interaction-halflife
```

- [ ] **Write migration**

```sql
-- 20260526-interaction-halflife.sql

-- 1. Add stability column to trust_edges (existing rows default to 1.0)
ALTER TABLE social_graph.trust_edges
  ADD COLUMN IF NOT EXISTS stability FLOAT NOT NULL DEFAULT 1.0;

-- 2. Decay config table
CREATE TABLE IF NOT EXISTS social_graph.trust_decay_config (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id            UUID REFERENCES communities.communities(id) ON DELETE CASCADE,
  base_half_life_days     FLOAT NOT NULL DEFAULT 30.0,
  stability_growth_rate   FLOAT NOT NULL DEFAULT 0.20,
  disappearance_threshold FLOAT NOT NULL DEFAULT 0.5,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(community_id)
);

-- Global default row (community_id = NULL)
INSERT INTO social_graph.trust_decay_config
  (community_id, base_half_life_days, stability_growth_rate, disappearance_threshold)
VALUES (NULL, 30.0, 0.20, 0.5)
ON CONFLICT DO NOTHING;

-- 3. Live view: current_weight computed at every read
CREATE OR REPLACE VIEW social_graph.trust_edges_live AS
SELECT
  te.*,
  te.raw_weight * EXP(
    -EXTRACT(EPOCH FROM (NOW() - te.last_interaction_at)) / 86400.0
    / (te.stability * COALESCE(
        (SELECT base_half_life_days FROM social_graph.trust_decay_config
         WHERE community_id = te.community_id LIMIT 1),
        (SELECT base_half_life_days FROM social_graph.trust_decay_config
         WHERE community_id IS NULL LIMIT 1),
        30.0
      ))
  ) AS current_weight
FROM social_graph.trust_edges te;
```

- [ ] **Verify migration applies cleanly**
```bash
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -f /path/to/20260526-interaction-halflife.sql
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -c "SELECT id, raw_weight, stability, current_weight FROM social_graph.trust_edges_live LIMIT 3;"
```

---

## Task 2: Update `upsertTrustEdge` — grow stability on each interaction

**Files:**
- Modify: `services/social-graph-service/src/database/trustEdgeDb.ts`

- [ ] **Add `TrustEdgeLiveRow` interface** (extends `TrustEdgeRow` with `current_weight: number`)

- [ ] **Add `getDecayConfig(communityId)` helper** — queries `trust_decay_config`, community-specific first, then global fallback

- [ ] **Update `upsertTrustEdge`** — after recomputing `raw_weight`, also grow stability:

```typescript
// After raw_weight is recomputed, fetch growth rate and update stability
const config = await getDecayConfig(communityId);
await pool.query(
  `UPDATE social_graph.trust_edges
   SET stability   = stability * $1,
       updated_at  = NOW()
   WHERE user_id_a = $2 AND user_id_b = $3 AND community_id = $4`,
  [1 + config.stabilityGrowthRate, userIdA, userIdB, communityId]
);
```

- [ ] **Type check passes**
```bash
cd services/social-graph-service && npx tsc --noEmit
```

---

## Task 3: Update trust graph queries to use `trust_edges_live`

**Files:**
- Modify: `services/social-graph-service/src/database/trustEdgeDb.ts`

- [ ] **Update `getTrustGraph`**: replace all `social_graph.trust_edges` references in edges query with `social_graph.trust_edges_live`. Return `current_weight` and `raw_weight` per link:

```typescript
// In edgesQuery, select both weights:
te.raw_weight,
te.current_weight AS effective_weight
```

Update `TrustLink` interface:
```typescript
export interface TrustLink {
  source: string;
  target: string;
  raw_weight: number;
  effective_weight: number; // this is current_weight from the view
}
```

- [ ] **Update `getTrustGraphAggregate`** — same change (SUM of `current_weight` across communities)

- [ ] **Update `getTrustGraphAggregateForCenter`** — same change

- [ ] **Type check passes**
```bash
cd services/social-graph-service && npx tsc --noEmit
```

---

## Task 4: Decay config endpoints (social-graph-service)

**Files:**
- Create: `services/social-graph-service/src/database/trustDecayConfigDb.ts`
- Create: `services/social-graph-service/src/routes/trustDecayConfig.ts`
- Modify: `services/social-graph-service/src/index.ts`

- [ ] **Create `trustDecayConfigDb.ts`**

```typescript
export interface DecayConfig {
  communityId: string | null;
  baseHalfLifeDays: number;
  stabilityGrowthRate: number;
  disappearanceThreshold: number;
}

export async function getDecayConfig(communityId: string): Promise<DecayConfig> {
  const result = await pool.query(
    `SELECT * FROM social_graph.trust_decay_config
     WHERE community_id = $1 OR community_id IS NULL
     ORDER BY community_id NULLS LAST
     LIMIT 1`,
    [communityId]
  );
  const row = result.rows[0];
  return {
    communityId: row.community_id,
    baseHalfLifeDays: row.base_half_life_days,
    stabilityGrowthRate: row.stability_growth_rate,
    disappearanceThreshold: row.disappearance_threshold,
  };
}

export async function upsertDecayConfig(
  communityId: string | null,
  params: Partial<Omit<DecayConfig, 'communityId'>>
): Promise<DecayConfig> { /* INSERT ... ON CONFLICT DO UPDATE */ }
```

- [ ] **Create `trustDecayConfig.ts` route** — `GET /trust/decay-config`, `GET /trust/decay-config/:communityId`, `PUT /trust/decay-config/:communityId` (admin-only)

- [ ] **Register router in `index.ts`**: `app.use('/trust', trustDecayConfigRouter)`

- [ ] **Type check passes**
```bash
cd services/social-graph-service && npx tsc --noEmit
```

---

## Task 5: Sweep jobs (cleanup-service)

**Files:**
- Create: `services/cleanup-service/src/jobs/trustEdgeSweepJob.ts`
- Create: `services/cleanup-service/src/jobs/requestTtlSweepJob.ts`
- Modify: `services/cleanup-service/src/index.ts`

- [ ] **Create `trustEdgeSweepJob.ts`**

```typescript
export async function sweepDeadTrustEdges(): Promise<number> {
  // For each community, get its disappearance_threshold (fall back to global)
  // Delete edges from trust_edges_live where current_weight < threshold
  const result = await pool.query(`
    DELETE FROM social_graph.trust_edges
    WHERE id IN (
      SELECT te.id FROM social_graph.trust_edges_live tel
      JOIN social_graph.trust_edges te ON te.id = tel.id
      WHERE tel.current_weight < COALESCE(
        (SELECT disappearance_threshold FROM social_graph.trust_decay_config
         WHERE community_id = te.community_id LIMIT 1),
        (SELECT disappearance_threshold FROM social_graph.trust_decay_config
         WHERE community_id IS NULL LIMIT 1),
        0.5
      )
    )
  `);
  return result.rowCount ?? 0;
}
```

- [ ] **Create `requestTtlSweepJob.ts`**

```typescript
export async function sweepExpiredRequests(): Promise<number> {
  // Hard-delete completed+rated requests older than 30 days
  // Delete matches FIRST (FK constraint), then help_requests
  await pool.query(`
    DELETE FROM requests.matches
    WHERE request_id IN (
      SELECT hr.id FROM requests.help_requests hr
      WHERE hr.status = 'completed'
        AND hr.updated_at < NOW() - INTERVAL '30 days'
        AND EXISTS (
          SELECT 1 FROM requests.matches m
          WHERE m.request_id = hr.id
            AND m.requester_rating IS NOT NULL
            AND m.responder_rating IS NOT NULL
        )
    )
  `);
  const result = await pool.query(`
    DELETE FROM requests.help_requests
    WHERE status = 'completed'
      AND updated_at < NOW() - INTERVAL '30 days'
  `);
  return result.rowCount ?? 0;
}
```

- [ ] **Wire into `index.ts`** — add two cron schedules and two admin POST endpoints:

```typescript
// Trust edge sweep: daily at 4:30 AM
cron.schedule('30 4 * * *', async () => {
  const deleted = await sweepDeadTrustEdges();
  logger.info(`Trust edge sweep: deleted ${deleted} dead edges`);
});

// Request TTL sweep: daily at 2:30 AM
cron.schedule('30 2 * * *', async () => {
  const deleted = await sweepExpiredRequests();
  logger.info(`Request TTL sweep: deleted ${deleted} expired requests`);
});
```

Also add `/jobs/sweep-trust-edges` and `/jobs/sweep-request-ttl` admin POST endpoints following the existing pattern.

- [ ] **Type check passes**
```bash
cd services/cleanup-service && npx tsc --noEmit
```

---

## Task 6: Frontend — trust graph edge opacity

**Files:**
- Modify: `apps/frontend/src/components/TrustGraph.tsx`

- [ ] **Update `TrustLink` type** in the component to include `raw_weight`:
```typescript
interface TrustLink {
  source: string | TrustNode;
  target: string | TrustNode;
  raw_weight: number;
  effective_weight: number;
}
```

- [ ] **Compute `decayRatio` per link** and map to opacity:
```typescript
const decayRatio = link.raw_weight > 0
  ? Math.min(1, link.effective_weight / link.raw_weight)
  : 1;
const opacity = 0.2 + decayRatio * 0.8; // 0.2 (dead) → 1.0 (fresh)
```

- [ ] **Apply opacity** to the SVG `<line>` element for each link: `style={{ opacity }}` (or `strokeOpacity` on the D3 selection)

- [ ] **Verify** trust graph renders, edges near-zero weight show visibly faded vs full-strength edges

---

## Task 7: Frontend — completed request/offer fading

**Files:**
- Modify: `apps/frontend/src/components/Feed/FeedItem.tsx`
- Modify: `apps/frontend/src/components/OfferItem.tsx`

- [ ] **Add `completedFadeOpacity` utility** (inline or shared):
```typescript
function completedFadeOpacity(completedAt: string | null | undefined): number {
  if (!completedAt) return 1;
  const days = (Date.now() - new Date(completedAt).getTime()) / 86_400_000;
  const fadeFactor = Math.min(1, days / 30);
  return 1 - fadeFactor * 0.55; // 1.0 (fresh) → 0.45 (at 30 days)
}
```

- [ ] **Apply to `FeedItem.tsx`** — when `item.status === 'completed'`, wrap card container with `style={{ opacity: completedFadeOpacity(item.completed_at ?? item.updated_at) }}`

- [ ] **Apply to `OfferItem.tsx`** — same pattern for offers/matches with `status === 'completed'`

- [ ] **Visual check**: a freshly completed request renders at full opacity; a 15-day-old completed request renders noticeably dimmer; a 30-day-old request is at minimum opacity (~0.45)

---

## Task 8: ADR-056 + user guide + landing page docs

**Files:**
- Create: `docs/adr/ADR-056-intrinsic-trust-decay.md`
- Create: `apps/landing/src/data/docs/guides/interaction-half-life.json`
- Create: `apps/landing/src/data/docs/concepts/adr-056-intrinsic-trust-decay.json`
- Modify: `apps/landing/src/data/docs/guides/trust-graph.json` (add fading section)
- Modify: `apps/landing/src/data/docs/nav.json`
- Modify: `scripts/generate-docs.ts`

- [ ] **Write ADR-056** covering: decision (intrinsic view vs. job-based), context (decay as a property not an event), consequences (live view cost, no staleness, per-community tuning)

- [ ] **Write interaction-half-life user guide**:
  - What is interaction half-life?
  - How trust edges strengthen with repeated interactions (stability concept)
  - What the fading UI means in the trust graph and feed
  - What happens at 30 days (request deleted, relationship lives on)

- [ ] **Update trust-graph user guide** — add section: "Reading edge opacity" (full opacity = active relationship, faded = relationship weakening)

- [ ] **Create landing JSON files** for guide + ADR (use standard JSON format from CLAUDE.md)

- [ ] **Add slugs to `scripts/generate-docs.ts` hardcoded list**:
  ```typescript
  // Add to hardcoded concepts array:
  'adr-056-intrinsic-trust-decay',
  // Add to hardcoded guides array:
  'interaction-half-life',
  ```

- [ ] **Update nav.json** — add to "User Guides" and "Architecture Decisions" sections

- [ ] **Force-add landing docs**:
```bash
git add -f apps/landing/src/data/docs/
```

- [ ] **Verify nav.json entries persist** after running generate-docs:
```bash
node scripts/generate-docs.ts
grep -A2 "interaction-half-life" apps/landing/src/data/docs/nav.json
```

---

## Task 9: CONTEXT.md + registry.json + TDD tests

**Files:**
- Modify: `services/social-graph-service/CONTEXT.md`
- Modify: `services/cleanup-service/CONTEXT.md`
- Modify: `services/registry.json`
- Create: `services/social-graph-service/tests/tdd/sprint-68-halflife.test.ts`

- [ ] **Update `social-graph-service/CONTEXT.md`**:
  - New section: "Trust Decay Model" — describe `stability`, `trust_edges_live` view, `trust_decay_config`
  - Update "API Endpoints" section — add three decay config endpoints
  - Update "Database Schema" section — add `stability` column, `trust_decay_config` table, `trust_edges_live` view

- [ ] **Update `cleanup-service/CONTEXT.md`**:
  - Add two new jobs to "Scheduled Jobs" section
  - Add two new admin endpoints

- [ ] **Update `services/registry.json`**:
  - Add three new endpoints to `social-graph-service` apis.provides

- [ ] **Write TDD tests** in `services/social-graph-service/tests/tdd/sprint-68-halflife.test.ts`:

```typescript
describe('Ebbinghaus trust decay', () => {
  it('current_weight equals raw_weight immediately after interaction', ...);
  it('current_weight is less than raw_weight after 30 days', ...);
  it('stability grows by stability_growth_rate on each upsert', ...);
  it('higher stability results in slower decay', ...);
  it('current_weight falls below threshold after sufficient inactivity', ...);
});

describe('trustEdgeSweepJob', () => {
  it('deletes edges with current_weight below disappearance_threshold', ...);
  it('does not delete edges above threshold', ...);
});

describe('requestTtlSweepJob', () => {
  it('hard-deletes completed+rated requests older than 30 days', ...);
  it('does not delete completed requests with missing ratings', ...);
  it('does not delete completed requests younger than 30 days', ...);
});
```

- [ ] **Run TDD tests** (can fail — they document intent):
```bash
cd services/social-graph-service && npm run test:tdd
```

---

## Task 10: Final type check + pre-push verification

- [ ] **TypeScript across all modified services**
```bash
cd services/social-graph-service && npx tsc --noEmit
cd services/cleanup-service && npx tsc --noEmit
```

- [ ] **Unit + regression tests pass**
```bash
npm test
```

- [ ] **TDD tests pass** (or document known failures)
```bash
npm run test:tdd
```

- [ ] **Feedback loop clean**
```bash
npm run feedback:check
```

- [ ] **All new API endpoints respond correctly on local dev**
```bash
# Trust graph returns current_weight and raw_weight per edge
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3010/trust/graph/$COMMUNITY_ID" | jq '.data.links[0]'
# Should show: { source, target, raw_weight, effective_weight }

# Decay config returns defaults
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3010/trust/decay-config" | jq '.'
```

---

## Task 11: Merge + Deploy

- [ ] **Run `/pre-commit-check`** — verify all checklist items pass

- [ ] **Merge to master and push** → GitHub Actions deploys automatically
```bash
git checkout master
git merge feature/sprint-68-interaction-halflife
git push origin master
```

- [ ] **Monitor GitHub Actions** — watch for green build + deploy

- [ ] **SSH to demo server and apply migration manually**
```bash
ssh ubuntu@karmyq.com
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -f ~/karmyq/infrastructure/postgres/migrations/20260526-interaction-halflife.sql
```

- [ ] **Verify on demo**:
```bash
# Check view exists and returns current_weight
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -c "SELECT raw_weight, stability, current_weight FROM social_graph.trust_edges_live LIMIT 5;"
# Check decay config seeded
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -c "SELECT * FROM social_graph.trust_decay_config;"
```

- [ ] **Use the `/deploy` skill** if GitHub Actions is unavailable
