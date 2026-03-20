# Fractal Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire `getUserEffectiveParams()` into trust score computation and curated feed ranking, add global opt-out for personal evolution, and cache effective params in Redis.

**Architecture:** Three new integration points — trust scores computed with evolved depth/breadth weights, curated feed cross-community scoring driven by evolved `cross_community_prior`, and a global evolution preference table that gates all personal evolution. Redis cache makes effective params available across services without per-request DB hits.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue, Redis (ioredis).

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260320-fractal-feed.sql` | `reputation.user_trust_preferences` table |
| `services/reputation-service/src/services/effectiveParamsCache.ts` | Redis cache: get/set/invalidate effective params |
| `tests/unit/reputation/fractalFeed.test.ts` | Unit tests for cache, updateTrustScore wiring, global opt-out |
| `tests/tdd/fractal-feed-flow.test.ts` | Integration test for full pipeline |
| `docs/concepts/fractal-feed.md` | Source for landing page fractal-feed concept page |

### Existing files to modify
| File | Change |
|------|--------|
| `services/reputation-service/src/services/karmaService.ts` | `updateTrustScore()` uses `getUserEffectiveParams()` for depth/breadth weights |
| `services/reputation-service/src/services/trustEvolutionService.ts` | `isEvolutionEligible()` checks global opt-out first |
| `services/reputation-service/src/database/trustEvolutionDb.ts` | `upsertUserTrustConfig()` invalidates Redis cache on write |
| `services/reputation-service/src/routes/reputation.ts` | 3 new endpoints: effective-params GET, evolution-global GET/PUT |
| `services/request-service/src/routes/requests.ts` | Curated feed: cross-community prior replaces fixed trust distance for null-degree requesters |
| `apps/frontend/src/pages/reputation/trust.tsx` | Global opt-out toggle + effective params display + remove "future update" caveat |
| `apps/frontend/src/lib/api.ts` | 2 new methods: getGlobalEvolutionSetting, setGlobalEvolutionSetting |
| `infrastructure/postgres/init.sql` | Add `reputation.user_trust_preferences` table |
| `services/reputation-service/CONTEXT.md` | Document 3 new endpoints |
| `services/registry.json` | Add 3 new endpoints to reputation service |
| `scripts/generate-docs.ts` | Add fractal-feed concept + update trust-evolution guide entry |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **`getUserEffectiveParams()` is already safe for null userConfig** — falls back to community defaults. No extra null guards needed.

2. **`updateTrustScore()` partial replacement** — only replace `depth_weight` and `breadth_weight` with effective params output. Keep `feedback_threshold`, `min_interactions_for_bonus`, `negative_allowed` from community config — those are community policy.

3. **Redis cache key**: `trust_params:{userId}:{communityId}`, TTL 14400 seconds (4h). Invalidate in `upsertUserTrustConfig()` after write.

4. **Cross-community prior formula**: For `degrees === null` requesters only, use `Math.round(cross_community_prior * 100)` as trust distance score (replaces fixed `scoreTrustDistance(null)` = 10). Behavior change is intentional.

5. **Fallback for effective params HTTP call** in request-service: if call fails, use defaults `{ depth_weight: 0.6, breadth_weight: 0.4, cross_community_prior: 0.5 }`. Never block the feed.

6. **Global opt-out gate in `isEvolutionEligible()`**: Check `user_trust_preferences.global_evolution_enabled` FIRST. Missing row = opted in (default TRUE).

7. **`generate-docs.ts` is source of truth** — never edit `nav.json` directly.

8. **Global toggle placement in UI**: ABOVE per-community toggles. When global is OFF, show per-community toggles grayed out with a "global evolution paused" note.

---

## Task 1: Feature branch + DB migration

**Files:**
- Create: `infrastructure/postgres/migrations/20260320-fractal-feed.sql`
- Modify: `infrastructure/postgres/init.sql`

- [ ] **Create feature branch**

```bash
git checkout -b feature/sprint-32-fractal-feed
```

- [ ] **Write migration**

```sql
-- infrastructure/postgres/migrations/20260320-fractal-feed.sql
-- Sprint 32: Global evolution preference for users

CREATE TABLE IF NOT EXISTS reputation.user_trust_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  global_evolution_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Add same table to `infrastructure/postgres/init.sql`** — find the end of the `reputation` schema block and add the CREATE TABLE after `user_trust_evolution_log`. Keep consistent with existing style.

- [ ] **Verify migration syntax**

```bash
cat infrastructure/postgres/migrations/20260320-fractal-feed.sql
```

---

## Task 2: Unit tests (TDD — write before implementation)

**Files:**
- Create: `tests/unit/reputation/fractalFeed.test.ts`

- [ ] **Write unit tests** for the following behaviors:

```typescript
// tests/unit/reputation/fractalFeed.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock dependencies
jest.mock('../../../services/reputation-service/src/database/trustEvolutionDb');
jest.mock('../../../services/reputation-service/src/database/trustConfigDb');
jest.mock('../../../services/reputation-service/src/services/effectiveParamsCache');

describe('updateTrustScore uses effective params', () => {
  it('passes evolved depth_weight and breadth_weight to computeTrustScore', async () => {
    // Arrange: mock getUserEffectiveParams to return evolved values
    // Assert: computeTrustScore called with evolved depth_weight=0.75 not community default 0.60
  });

  it('still uses community config for feedback_threshold and min_interactions_for_bonus', async () => {
    // These are community policy, not user calibration
  });
});

describe('cross-community prior in feed scoring', () => {
  it('returns cross_community_prior * 100 as trust distance for null-degree requesters', () => {
    const prior = 0.7;
    expect(Math.round(prior * 100)).toBe(70);
  });

  it('at neutral prior 0.5, gives score 50 (higher than old fixed 10)', () => {
    expect(Math.round(0.5 * 100)).toBe(50);
  });

  it('at low prior 0.1, gives score 10 (same as old baseline)', () => {
    expect(Math.round(0.1 * 100)).toBe(10);
  });

  it('does NOT apply prior for connected requesters (degrees !== null)', () => {
    // When degrees = 2, use scoreTrustDistance(2) = 75, not prior * 100
  });
});

describe('global opt-out gate in isEvolutionEligible', () => {
  it('returns false when global_evolution_enabled is false', async () => {
    // Mock user_trust_preferences row with global_evolution_enabled = false
  });

  it('returns true (eligible) when no preference row exists (new user defaults to opted in)', async () => {
    // Mock no row in user_trust_preferences → treated as enabled
  });

  it('still checks per-community flags when global is enabled', async () => {
    // Global on, community evolution off → still returns false
  });
});

describe('effectiveParamsCache', () => {
  it('returns cached value on hit without DB call', async () => {});
  it('calls getUserEffectiveParams and caches on miss', async () => {});
  it('invalidates cache key on upsertUserTrustConfig', async () => {});
});
```

- [ ] **Verify tests are discovered** (will fail until implementation)

```bash
cd tests && npx jest unit/reputation/fractalFeed --no-coverage 2>&1 | head -30
```

---

## Task 3: Redis effective params cache service

**Files:**
- Create: `services/reputation-service/src/services/effectiveParamsCache.ts`
- Modify: `services/reputation-service/src/database/trustEvolutionDb.ts`

- [ ] **Create cache service**

```typescript
// services/reputation-service/src/services/effectiveParamsCache.ts
import Redis from 'ioredis';
import { getUserEffectiveParams } from './trustEvolutionService';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const TTL_SECONDS = 14400; // 4 hours

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) _redis = new Redis(REDIS_URL);
  return _redis;
}

function cacheKey(userId: string, communityId: string): string {
  return `trust_params:${userId}:${communityId}`;
}

export async function getCachedEffectiveParams(
  userId: string,
  communityId: string
): Promise<{ depth_weight: number; breadth_weight: number; cross_community_prior: number }> {
  try {
    const cached = await getRedis().get(cacheKey(userId, communityId));
    if (cached) return JSON.parse(cached);
  } catch {
    // Redis unavailable — fall through to DB
  }
  const params = await getUserEffectiveParams(userId, communityId);
  try {
    await getRedis().setex(cacheKey(userId, communityId), TTL_SECONDS, JSON.stringify(params));
  } catch {
    // Non-fatal — return params even if cache write fails
  }
  return params;
}

export async function invalidateEffectiveParamsCache(
  userId: string,
  communityId: string
): Promise<void> {
  try {
    await getRedis().del(cacheKey(userId, communityId));
  } catch {
    // Non-fatal
  }
}
```

- [ ] **Add cache invalidation to `upsertUserTrustConfig()` in `trustEvolutionDb.ts`** — after the DB upsert, call `invalidateEffectiveParamsCache(userId, communityId)`. Import is lazy (dynamic import or top-level) to avoid circular dependencies — check for circulars first.

- [ ] **Verify no circular import**: `trustEvolutionDb.ts` → `effectiveParamsCache.ts` → `trustEvolutionService.ts` → `trustEvolutionDb.ts`. This IS circular. Use `invalidateEffectiveParamsCache` from a Redis utility that doesn't import trustEvolutionService, or call invalidation in `trustEvolutionService.ts` after `upsertUserTrustConfig()` calls (caller-side invalidation pattern). Prefer caller-side: in `evaluateUserEvolution()`, after each `upsertUserTrustConfig()` call, call `invalidateEffectiveParamsCache()`.

---

## Task 4: Wire `updateTrustScore()` to use effective params

**Files:**
- Modify: `services/reputation-service/src/services/karmaService.ts`

- [ ] **Import `getCachedEffectiveParams`** at top of `karmaService.ts`

```typescript
import { getCachedEffectiveParams } from './effectiveParamsCache';
```

- [ ] **In `updateTrustScore()` (line ~253), add effective params lookup alongside existing parallel calls**

```typescript
// BEFORE (existing):
const [trustConfig, avg_feedback_score, trustMetrics] = await Promise.all([
  getCommunityTrustConfig(community_id),
  getWeightedAvgFeedback(user_id, community_id),
  getTrustMetrics(user_id, community_id),
]);

// AFTER:
const [trustConfig, avg_feedback_score, trustMetrics, effectiveParams] = await Promise.all([
  getCommunityTrustConfig(community_id),
  getWeightedAvgFeedback(user_id, community_id),
  getTrustMetrics(user_id, community_id),
  getCachedEffectiveParams(user_id, community_id),
]);
```

- [ ] **Update `computeTrustScore()` call to use evolved depth/breadth** — replace `depth_weight: trustConfig.depth_weight` and `breadth_weight: trustConfig.breadth_weight` with effective params values. Keep all other fields from `trustConfig`.

```typescript
const score = computeTrustScore({
  recent_interactions: parseInt(recent_interactions),
  avg_feedback_score,
  repeat_interaction_pairs: trustMetrics.repeat_interaction_pairs,
  distinct_people_count: trustMetrics.distinct_people_count,
  distinct_communities_count: trustMetrics.distinct_communities_count,
  depth_weight: effectiveParams.depth_weight,      // ← evolved
  breadth_weight: effectiveParams.breadth_weight,  // ← evolved
  feedback_threshold: trustConfig.feedback_threshold,       // ← community policy
  min_interactions_for_bonus: trustConfig.min_interactions_for_bonus, // ← community policy
  negative_allowed: trustConfig.negative_allowed,           // ← community policy
});
```

- [ ] **Type-check**

```bash
cd services/reputation-service && npx tsc --noEmit
```

---

## Task 5: Global opt-out — DB layer, API endpoints, evolution gate

**Files:**
- Modify: `services/reputation-service/src/services/trustEvolutionService.ts`
- Modify: `services/reputation-service/src/routes/reputation.ts`

- [ ] **Add DB helpers for `user_trust_preferences`** — add to `trustEvolutionDb.ts`:

```typescript
export async function getGlobalEvolutionPreference(userId: string): Promise<boolean> {
  const result = await query(
    `SELECT global_evolution_enabled FROM reputation.user_trust_preferences WHERE user_id = $1`,
    [userId]
  );
  // Missing row = opted in by default
  return result.rows[0]?.global_evolution_enabled ?? true;
}

export async function upsertGlobalEvolutionPreference(userId: string, enabled: boolean): Promise<void> {
  await query(
    `INSERT INTO reputation.user_trust_preferences (user_id, global_evolution_enabled, updated_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE SET
       global_evolution_enabled = $2,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, enabled]
  );
}
```

- [ ] **Update `isEvolutionEligible()` in `trustEvolutionService.ts`** — add global gate as FIRST check, before community and per-community checks:

```typescript
export async function isEvolutionEligible(...): Promise<boolean> {
  const [globalPref, communityEvolution, userConfig, lastEvolution] = await Promise.all([
    getGlobalEvolutionPreference(userId),
    getCommunityEvolutionConfig(communityId),
    getUserTrustConfig(userId, communityId),
    getLastEvolutionForParameter(userId, communityId, parameter),
  ]);
  if (!globalPref) return false;                              // ← global gate (new)
  if (!communityEvolution.community_evolution_enabled) return false;
  if (!userConfig?.evolution_enabled) return false;
  // ... cooldown check unchanged
}
```

- [ ] **Add 3 new endpoints to `reputation.ts`**:

```typescript
// GET /reputation/users/:userId/effective-params?communityId=
// Returns effective params from cache
router.get('/users/:userId/effective-params', requireSelf, async (req, res) => {
  const { userId } = req.params;
  const { communityId } = req.query as { communityId: string };
  if (!communityId) return res.status(400).json({ success: false, message: 'communityId required' });
  try {
    const params = await getCachedEffectiveParams(userId, communityId);
    return res.json({ success: true, data: params });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /reputation/users/:userId/evolution-global
router.get('/users/:userId/evolution-global', requireSelf, async (req, res) => {
  try {
    const enabled = await getGlobalEvolutionPreference(req.params.userId);
    return res.json({ success: true, data: { global_evolution_enabled: enabled } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /reputation/users/:userId/evolution-global
router.put('/users/:userId/evolution-global', requireSelf, async (req, res) => {
  const { global_evolution_enabled } = req.body;
  if (typeof global_evolution_enabled !== 'boolean') {
    return res.status(400).json({ success: false, message: 'global_evolution_enabled (boolean) required' });
  }
  try {
    await upsertGlobalEvolutionPreference(req.params.userId, global_evolution_enabled);
    return res.json({ success: true, data: { global_evolution_enabled } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
```

Note: `requireSelf` is a middleware that checks `req.user?.userId === req.params.userId`. Check if it already exists in the router file; if not, inline the check as done in existing evolution endpoints.

- [ ] **Type-check**

```bash
cd services/reputation-service && npx tsc --noEmit
```

---

## Task 6: Cross-community prior in curated feed

**Files:**
- Modify: `services/request-service/src/routes/requests.ts`

- [ ] **Fetch effective params for the requesting user** at the top of the `GET /requests/curated` handler (after userId extraction):

```typescript
// After: const userId = (req as any).user?.userId;
// Add:
const EFFECTIVE_PARAMS_DEFAULT = { depth_weight: 0.6, breadth_weight: 0.4, cross_community_prior: 0.5 };
let userEffectiveParams = EFFECTIVE_PARAMS_DEFAULT;
try {
  const paramsRes = await fetch(
    `${process.env.REPUTATION_API_URL || 'http://localhost:3004'}/reputation/users/${userId}/effective-params?communityId=${primaryCommunityId}`,
    { headers: { Authorization: req.headers.authorization || '' } }
  );
  if (paramsRes.ok) {
    const paramsData = await paramsRes.json();
    if (paramsData.success) userEffectiveParams = paramsData.data;
  }
} catch {
  // Non-fatal — use defaults
}
```

Note: `primaryCommunityId` is the first community from the user's JWT `communities` array. Check how the curated handler currently derives community context — it may already have this.

- [ ] **Apply cross-community prior** in the feed scoring loop, for requests where `degrees === null`:

```typescript
// In the requestsWithScores.map() loop, find where trustDistance is computed:
const degrees = trustDistanceMap.get(request.requester_id) ?? null;
// BEFORE:
// const trustDistance = scoreTrustDistance(degrees);
// AFTER:
const trustDistance = degrees !== null
  ? scoreTrustDistance(degrees)
  : Math.round(userEffectiveParams.cross_community_prior * 100);
```

- [ ] **Apply same change to sister community requests** in the `sisterRequestsWithScores.map()` block (look for the second `calculateFeedScore` call around line 581). Sister community requests have their own trust carry factor — keep that, but also apply the cross-community prior to the trust distance component.

- [ ] **Type-check**

```bash
cd services/request-service && npx tsc --noEmit
```

---

## Task 7: Frontend — global opt-out toggle + effective params + remove caveat

**Files:**
- Modify: `apps/frontend/src/pages/reputation/trust.tsx`
- Modify: `apps/frontend/src/lib/api.ts`

- [ ] **Add API methods to `api.ts`**:

```typescript
// In reputationService object, add:
getGlobalEvolutionSetting: (userId: string) =>
  reputationApi.get(`/reputation/users/${userId}/evolution-global`),

setGlobalEvolutionSetting: (userId: string, enabled: boolean) =>
  reputationApi.put(`/reputation/users/${userId}/evolution-global`, { global_evolution_enabled: enabled }),

getEffectiveParams: (userId: string, communityId: string) =>
  reputationApi.get(`/reputation/users/${userId}/effective-params?communityId=${communityId}`),
```

- [ ] **Add global opt-out state and toggle to `trust.tsx`** — at top of `TrustScorePage`:

```typescript
const [globalEvolutionEnabled, setGlobalEvolutionEnabled] = useState<boolean | null>(null)
// Load in fetchTrustData:
const globalRes = await reputationService.getGlobalEvolutionSetting(userId)
setGlobalEvolutionEnabled(globalRes.data?.global_evolution_enabled ?? true)
```

- [ ] **Add global toggle UI** — in the "Trust Model Evolution" section, add BEFORE the per-community `TrustEvolutionToggle` map:

```tsx
{globalEvolutionEnabled !== null && (
  <div className="border rounded-lg p-4 mb-5 bg-surface-raised">
    <div className="flex justify-between items-center">
      <div>
        <div className="font-semibold text-text">Trust evolution</div>
        <div className="text-xs text-text-muted mt-1">
          {globalEvolutionEnabled
            ? 'Your trust model is calibrating based on your experiences.'
            : 'Trust evolution is paused. Your model will not change.'}
        </div>
      </div>
      <button
        onClick={async () => {
          const next = !globalEvolutionEnabled
          setGlobalEvolutionEnabled(next)
          try {
            await reputationService.setGlobalEvolutionSetting(user.id, next)
          } catch {
            setGlobalEvolutionEnabled(!next) // revert
          }
        }}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          globalEvolutionEnabled ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
        }`}
      >
        {globalEvolutionEnabled ? 'Active' : 'Paused'}
      </button>
    </div>
  </div>
)}
```

- [ ] **Remove the "future update" caveat** from the per-community description paragraph — change:
> "It will influence your experience in a future update."
to:
> "It shapes your trust scores and the requests you see in your feed."

- [ ] **Update `TrustEvolutionToggle`** to accept and display `effectiveParams`:
  - Add `effectiveParams?: { depth_weight: number; breadth_weight: number; cross_community_prior: number }` to props
  - Show as small badges inside the card when evolution is enabled: `Depth ${(p.depth_weight * 100).toFixed(0)}% · Breadth ${(p.breadth_weight * 100).toFixed(0)}% · Cross-community ${(p.cross_community_prior * 100).toFixed(0)}%`
  - Fetch effective params inside the toggle component alongside trust config (extend the existing `useEffect` that calls `getTrustConfig`)

- [ ] **Type-check frontend**

```bash
cd apps/frontend && npx tsc --noEmit
```

---

## Task 8: User guides + landing page docs + ADR update

**Files:**
- Create: `docs/concepts/fractal-feed.md`
- Modify: `scripts/generate-docs.ts`
- Modify: `docs/adr/ADR-046-trust-model-evolution-arc.md` (update status to Implemented)

- [ ] **Create concept page source**

```markdown
# docs/concepts/fractal-feed.md
# Fractal Feed

Karmyq's feed is personalized to each member's evolved trust calibration. The same pool of requests appears differently to different users — ordered by a blend of skill match, trust distance, community relevance, and urgency, where the trust distance component is calibrated to each user's personal cross-community openness.

## How it works

Each user's trust model contains three parameters that evolve based on their interaction patterns:
- **Depth weight**: how much repeated relationships count in your trust score
- **Breadth weight**: how much diversity of connections counts
- **Cross-community prior**: your baseline trust toward people from other communities

When your cross-community prior is high (earned through positive cross-community interactions), you'll naturally see more requests from people outside your immediate community. When it's low, your feed skews toward your established network.

## Your evolved parameters

Visit your Trust Score page to see your current calibration. The parameters are read-only — they evolve automatically from your experiences, not from manual configuration. You can pause evolution globally if you prefer your model to stay fixed.

## The arc

The fractal feed is the third phase of a three-sprint arc (ADR-046):
1. **Individual trust evolution** — your personal params learn from your interactions
2. **Community evolution** — your community's model drifts from aggregate member patterns
3. **Fractal feed** — the feed uses both your individual calibration and your community's evolved model to rank what you see
```

- [ ] **Update `scripts/generate-docs.ts`** to include:
  - `fractal-feed` concept page (from `docs/concepts/fractal-feed.md`)
  - Update trust-evolution guide entry to reflect Sprint 32 (global opt-out, effective params display)
  - Add `adr-046` if not already present — update its status to `implemented`

- [ ] **Run the doc generator and verify output**

```bash
cd apps/landing && npm run generate-docs
```

- [ ] **Force-add the generated landing page files**

```bash
git add -f apps/landing/src/data/docs/concepts/fractal-feed.json
git add -f apps/landing/src/data/docs/nav.json
```

- [ ] **Update ADR-046 status** — find `docs/adr/ADR-046-trust-model-evolution-arc.md`, change `Status: Accepted` → `Status: Implemented`, add implementation note at the bottom referencing Sprints 30–32.

---

## Task 9: CONTEXT.md + registry.json

**Files:**
- Modify: `services/reputation-service/CONTEXT.md`
- Modify: `services/registry.json`

- [ ] **Update `services/reputation-service/CONTEXT.md`** — in the "API Endpoints" section, add the 3 new endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/reputation/users/:userId/effective-params` | Blended trust params from Redis cache (4h TTL), falls back to DB |
| GET | `/reputation/users/:userId/evolution-global` | User's global evolution on/off preference |
| PUT | `/reputation/users/:userId/evolution-global` | Set global evolution enabled/disabled |

Also add note in "Recent Changes": "Sprint 32 — `updateTrustScore()` now uses evolved `depth_weight`/`breadth_weight` per user; `isEvolutionEligible()` checks global opt-out first."

- [ ] **Update `services/registry.json`** — in the reputation service entry, add the 3 endpoints to `apis.provides`.

- [ ] **Run feedback check**

```bash
npm run feedback:check
```

---

## Task 10: Integration test + final verification

**Files:**
- Create: `tests/tdd/fractal-feed-flow.test.ts`

- [ ] **Write integration test**

```typescript
// tests/tdd/fractal-feed-flow.test.ts
// Requires DB connection — tagged as integration
describe('Fractal feed pipeline (integration)', () => {
  it('trust score uses evolved depth_weight after evolution runs', async () => {
    // 1. Create user with evolved depth_weight=0.80 in user_trust_config
    // 2. Call updateTrustScore(userId, communityId)
    // 3. Verify trust_scores row reflects evolved weights (score differs from community-default computation)
  });

  it('global opt-out prevents evolution from running', async () => {
    // 1. Set user_trust_preferences.global_evolution_enabled = false
    // 2. Call isEvolutionEligible(userId, communityId, 'depth_weight')
    // 3. Expect false
  });

  it('effective params endpoint serves from Redis on cache hit', async () => {
    // 1. Pre-populate Redis key with known params
    // 2. GET /reputation/users/:userId/effective-params?communityId=
    // 3. Expect returned params match Redis (not DB — verify DB not called)
  });
});
```

- [ ] **Run full test suite**

```bash
npm test
```

- [ ] **Run TDD tests**

```bash
npm run test:tdd
```

- [ ] **TypeScript check across all services**

```bash
cd services/reputation-service && npx tsc --noEmit
cd ../../services/request-service && npx tsc --noEmit
cd ../../apps/frontend && npx tsc --noEmit
```

- [ ] **Feedback loop check**

```bash
npm run feedback:check
```

- [ ] **Commit**

```bash
git add -A
git commit -m "feat(feed): Sprint 32 — Fractal Feed, evolved params wired to trust scores and curated feed (ADR-046 complete)"
```
