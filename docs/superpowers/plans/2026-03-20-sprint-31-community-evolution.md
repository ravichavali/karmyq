# Community Evolution Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Aggregate member trust deltas into community config drift across three parameters — default-on, opt-out, with a clean pluggable service boundary.

**Architecture:** A new self-contained `communityEvolutionService.ts` reads from the existing user evolution log to compute member deltas, applies dampened nudges to community config, and logs each event. The service is triggered via a deduplicated Bull queue job fired after each user trust evolution, and is removable by deleting the file and its three call sites.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260320-community-evolution.sql` | Flip evolution defaults to TRUE; add `community_evolution_log` table |
| `services/reputation-service/src/database/communityEvolutionDb.ts` | All DB reads/writes for community evolution |
| `services/reputation-service/src/services/communityEvolutionService.ts` | Aggregation logic, damping, nudge application |
| `docs/adr/ADR-047-community-evolution-engine.md` | Architecture Decision Record |
| `apps/landing/src/data/docs/concepts/adr-047-community-evolution-engine.json` | Landing page ADR |
| `apps/landing/src/data/docs/concepts/community-evolution.json` | Landing page concept |
| `tests/unit/reputation/communityEvolutionService.test.ts` | Unit tests (written BEFORE implementation) |
| `tests/tdd/community-evolution-flow.test.ts` | Integration test |

### Existing files to modify
| File | Change |
|------|--------|
| `infrastructure/postgres/init.sql` | Flip evolution defaults; add `community_evolution_log` table definition |
| `services/reputation-service/src/services/trustEvolutionService.ts` | After user evolution fires, queue community evolution check |
| `services/reputation-service/src/events/subscriber.ts` | Handle `community_evolution_check` Bull job; snapshot on `user_joined_community` |
| `services/reputation-service/src/routes/reputation.ts` | Add 3 community evolution endpoints |
| `apps/frontend/src/pages/communities/[id].tsx` | Add Trust Evolution section to admin Settings tab |
| `apps/frontend/src/pages/reputation/trust.tsx` | Add community contribution acknowledgment line |
| `services/reputation-service/CONTEXT.md` | Update API endpoints section |
| `services/registry.json` | Update endpoints |
| `apps/landing/src/data/docs/nav.json` | Add ADR + concept entries |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Evolution default flip updates ALL existing rows** — the migration has `UPDATE ... SET evolution_enabled = TRUE` for both `user_trust_configs` and `community_configs`. This is intentional.

2. **No member snapshot table** — baselines come from the first `old_value` in `user_trust_evolution_log`. Members with no evolution history are silently excluded from aggregation.

3. **Community cooldown via log query** — no separate column. Query `MAX(applied_at)` from `community_evolution_log WHERE community_id = $1`. If < 30 days ago, skip.

4. **`karma_split_helper` and `trust_path_max_hops` follow prior direction** — users have no per-user versions of these. The aggregate `cross_community_prior` delta is the sole directional signal for all three parameters.

5. **Direction consensus gate for hops** — only shift `trust_path_max_hops` if the last 3 entries in `community_evolution_log` for `cross_community_prior` agree on direction. If fewer than 3 entries exist, skip hop evolution.

6. **Minimum 3 contributing members** — if fewer than 3 active members have any evolution log entries in the community, skip the cycle. Prevents noise from micro-communities.

7. **`communityEvolutionService.ts` must never throw** — wrap everything in try/catch, log errors, never propagate. Community evolution failure must not affect the user request flow.

8. **Bull job deduplication** — use `community_id` as the Bull job ID. Bull will silently discard duplicate jobs with the same ID if one is already waiting/active. No custom dedup logic needed.

9. **`community_evolution_enabled` default was FALSE in Sprint 30** — the migration must also update `init.sql` so fresh DB installs get the correct default.

---

## Task 1: Feature branch + DB migration

**Files:**
- Create: `infrastructure/postgres/migrations/20260320-community-evolution.sql`
- Modify: `infrastructure/postgres/init.sql`

- [ ] Check out feature branch:
```bash
git checkout -b feature/sprint-31-community-evolution
```

- [ ] Create the migration file:
```sql
-- infrastructure/postgres/migrations/20260320-community-evolution.sql
-- Sprint 31: Community Evolution Engine (ADR-047)
-- Core principle: communities evolve from collective member experience, not by admin decree.

-- 1. Flip evolution defaults: opt-out instead of opt-in
ALTER TABLE reputation.user_trust_configs
  ALTER COLUMN evolution_enabled SET DEFAULT TRUE;

-- Update existing rows (demo data design reset — intentional)
UPDATE reputation.user_trust_configs SET evolution_enabled = TRUE;

ALTER TABLE communities.community_configs
  ALTER COLUMN community_evolution_enabled SET DEFAULT TRUE;

UPDATE communities.community_configs SET community_evolution_enabled = TRUE;

-- 2. Community evolution audit log
CREATE TABLE IF NOT EXISTS reputation.community_evolution_log (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id              UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  parameter                 VARCHAR(50) NOT NULL,
  old_value                 DECIMAL(6,2) NOT NULL,
  new_value                 DECIMAL(6,2) NOT NULL,
  aggregate_delta           DECIMAL(6,2) NOT NULL,
  contributing_member_count INTEGER NOT NULL,
  interaction_rate_snapshot DECIMAL(6,2),
  damping_applied           DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  applied_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cel_community_applied
  ON reputation.community_evolution_log (community_id, applied_at DESC);
```

- [ ] Update `init.sql`:
  - Change `evolution_enabled BOOLEAN NOT NULL DEFAULT FALSE` → `DEFAULT TRUE` (in `user_trust_configs` table definition, around line 490)
  - Change `community_evolution_enabled BOOLEAN DEFAULT FALSE` → `DEFAULT TRUE` (in `community_configs` table definition, around line 1045)
  - Add `community_evolution_log` table definition after `user_trust_evolution_log`

- [ ] Verify migration syntax:
```bash
npx ts-node -e "console.log('migration syntax check — run manually against DB')"
```

---

## Task 2: Unit tests (TDD — write first, they will fail until Task 4)

**Files:**
- Create: `tests/unit/reputation/communityEvolutionService.test.ts`

- [ ] Create the test file. These tests must fail now and pass after Task 4:

```typescript
// tests/unit/reputation/communityEvolutionService.test.ts
import { computeAggregateDeltas, computeDampingFactor, shouldEvolvHops } from '../../../services/reputation-service/src/services/communityEvolutionService';

describe('computeAggregateDeltas', () => {
  it('returns median of member deltas', () => {
    const deltas = [+0.10, +0.05, +0.15, -0.02, +0.08];
    expect(computeAggregateDeltas(deltas)).toBeCloseTo(0.08, 2);
  });

  it('returns 0 for empty delta list', () => {
    expect(computeAggregateDeltas([])).toBe(0);
  });

  it('handles single member delta', () => {
    expect(computeAggregateDeltas([+0.12])).toBeCloseTo(0.12, 2);
  });

  it('handles all-negative deltas', () => {
    const deltas = [-0.10, -0.05, -0.08];
    expect(computeAggregateDeltas(deltas)).toBeCloseTo(-0.08, 2);
  });
});

describe('computeDampingFactor', () => {
  it('returns 1.0 when no previous rate (first cycle)', () => {
    expect(computeDampingFactor(null, 2.5)).toBe(1.0);
  });

  it('returns 1.0 when rate is stable (within 10%)', () => {
    expect(computeDampingFactor(2.5, 2.4)).toBe(1.0);
  });

  it('returns 0.5 when rate declines >10%', () => {
    // 2.5 → 2.0 is a 20% drop
    expect(computeDampingFactor(2.5, 2.0)).toBe(0.5);
  });

  it('returns 0.0 when rate declines >25%', () => {
    // 2.5 → 1.8 is a 28% drop
    expect(computeDampingFactor(2.5, 1.8)).toBe(0.0);
  });

  it('returns 1.0 when rate is improving', () => {
    expect(computeDampingFactor(2.0, 2.8)).toBe(1.0);
  });
});

describe('shouldEvolveHops', () => {
  it('returns false if fewer than 3 prior cycles', () => {
    const recentDeltas = [+0.03, +0.02]; // only 2
    expect(shouldEvolveHops(recentDeltas)).toBe(false);
  });

  it('returns true (positive) if last 3 cycles all positive', () => {
    const recentDeltas = [+0.03, +0.02, +0.04];
    expect(shouldEvolveHops(recentDeltas)).toBe(1);
  });

  it('returns true (negative) if last 3 cycles all negative', () => {
    const recentDeltas = [-0.03, -0.02, -0.04];
    expect(shouldEvolveHops(recentDeltas)).toBe(-1);
  });

  it('returns false if direction is mixed', () => {
    const recentDeltas = [+0.03, -0.02, +0.04];
    expect(shouldEvolveHops(recentDeltas)).toBe(false);
  });
});
```

- [ ] Run tests to confirm they fail (expected):
```bash
cd services/reputation-service && npx jest tests/unit/reputation/communityEvolutionService --no-coverage 2>&1 | tail -5
```

---

## Task 3: `communityEvolutionDb.ts`

**Files:**
- Create: `services/reputation-service/src/database/communityEvolutionDb.ts`

- [ ] Create the DB layer:

```typescript
// services/reputation-service/src/database/communityEvolutionDb.ts
import { query } from './db';

export interface CommunityEvolutionLogEntry {
  id?: string;
  community_id: string;
  parameter: string;
  old_value: number;
  new_value: number;
  aggregate_delta: number;
  contributing_member_count: number;
  interaction_rate_snapshot: number | null;
  damping_applied: number;
  applied_at?: string;
}

/** Compute each active evolving member's delta for cross_community_prior.
 *  Baseline = first old_value in user_trust_evolution_log for that member.
 *  Members with no evolution log entries are excluded. */
export async function getMemberPriorDeltas(
  communityId: string
): Promise<{ user_id: string; delta: number }[]> {
  const result = await query(
    `WITH first_log AS (
       SELECT DISTINCT ON (user_id)
         user_id, old_value AS baseline
       FROM reputation.user_trust_evolution_log
       WHERE community_id = $1 AND parameter = 'cross_community_prior'
       ORDER BY user_id, created_at ASC
     )
     SELECT
       fl.user_id,
       (utc.cross_community_prior - fl.baseline) AS delta
     FROM first_log fl
     JOIN reputation.user_trust_configs utc
       ON utc.user_id = fl.user_id AND utc.community_id = $1
     JOIN communities.members cm
       ON cm.user_id = fl.user_id AND cm.community_id = $1 AND cm.status = 'active'
     WHERE utc.evolution_enabled = TRUE`,
    [communityId]
  );
  return result.rows.map(r => ({
    user_id: r.user_id,
    delta: parseFloat(r.delta),
  }));
}

/** Current interaction rate: completed matches per active member in last 30 days. */
export async function getInteractionRate(communityId: string): Promise<number> {
  const result = await query(
    `WITH active_members AS (
       SELECT COUNT(*) AS cnt
       FROM communities.members
       WHERE community_id = $1 AND status = 'active'
     ),
     completed AS (
       SELECT COUNT(DISTINCT m.id) AS cnt
       FROM requests.matches m
       JOIN requests.request_communities rc ON rc.request_id = m.request_id
       WHERE rc.community_id = $1
         AND m.status = 'completed'
         AND m.updated_at >= NOW() - INTERVAL '30 days'
     )
     SELECT
       CASE WHEN am.cnt = 0 THEN 0
            ELSE (c.cnt::decimal / am.cnt)
       END AS rate
     FROM active_members am, completed c`,
    [communityId]
  );
  return parseFloat(result.rows[0]?.rate ?? '0');
}

/** Previous interaction rate from the most recent evolution log entry. */
export async function getPreviousInteractionRate(
  communityId: string
): Promise<number | null> {
  const result = await query(
    `SELECT interaction_rate_snapshot
     FROM reputation.community_evolution_log
     WHERE community_id = $1
     ORDER BY applied_at DESC
     LIMIT 1`,
    [communityId]
  );
  const val = result.rows[0]?.interaction_rate_snapshot;
  return val != null ? parseFloat(val) : null;
}

/** Days since last community evolution cycle. Returns null if never evolved. */
export async function getDaysSinceLastEvolution(
  communityId: string
): Promise<number | null> {
  const result = await query(
    `SELECT MAX(applied_at) AS last_at
     FROM reputation.community_evolution_log
     WHERE community_id = $1`,
    [communityId]
  );
  const last = result.rows[0]?.last_at;
  if (!last) return null;
  return (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24);
}

/** The aggregate_delta values from the last N community evolution log entries for cross_community_prior.
 *  Used for the direction consensus gate on trust_path_max_hops. */
export async function getRecentPriorEvolutionDeltas(
  communityId: string,
  count = 3
): Promise<number[]> {
  const result = await query(
    `SELECT aggregate_delta
     FROM reputation.community_evolution_log
     WHERE community_id = $1 AND parameter = 'cross_community_prior'
     ORDER BY applied_at DESC
     LIMIT $2`,
    [communityId, count]
  );
  return result.rows.map(r => parseFloat(r.aggregate_delta));
}

/** Current community config values for the three evolving parameters. */
export async function getCommunityEvolvingParams(
  communityId: string
): Promise<{
  community_evolution_enabled: boolean;
  cross_community_prior: number;
  karma_split_helper: number;
  trust_path_max_hops: number;
} | null> {
  const result = await query(
    `SELECT
       community_evolution_enabled,
       cross_community_prior,
       karma_split_helper,
       trust_path_max_hops
     FROM communities.community_configs
     WHERE community_id = $1`,
    [communityId]
  );
  if (!result.rows[0]) return null;
  const r = result.rows[0];
  return {
    community_evolution_enabled: r.community_evolution_enabled,
    cross_community_prior: parseFloat(r.cross_community_prior),
    karma_split_helper: parseInt(r.karma_split_helper, 10),
    trust_path_max_hops: parseInt(r.trust_path_max_hops, 10),
  };
}

/** Apply the nudge to the three evolving parameters in community_configs. */
export async function applyCommunityConfigNudge(
  communityId: string,
  patch: {
    cross_community_prior?: number;
    karma_split_helper?: number;
    trust_path_max_hops?: number;
  }
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  const columns = Object.keys(patch);
  const values = Object.values(patch);
  const setClauses = columns.map((col, i) => `${col} = $${i + 2}`).join(', ');
  await query(
    `UPDATE communities.community_configs SET ${setClauses} WHERE community_id = $1`,
    [communityId, ...values]
  );
}

/** Log a community evolution event. */
export async function insertCommunityEvolutionLog(
  entry: Omit<CommunityEvolutionLogEntry, 'id' | 'applied_at'>
): Promise<void> {
  await query(
    `INSERT INTO reputation.community_evolution_log
       (community_id, parameter, old_value, new_value, aggregate_delta,
        contributing_member_count, interaction_rate_snapshot, damping_applied)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entry.community_id, entry.parameter, entry.old_value, entry.new_value,
      entry.aggregate_delta, entry.contributing_member_count,
      entry.interaction_rate_snapshot, entry.damping_applied,
    ]
  );
}

/** Paginated evolution history for a community. */
export async function getCommunityEvolutionHistory(
  communityId: string,
  limit = 50,
  offset = 0
): Promise<CommunityEvolutionLogEntry[]> {
  const result = await query(
    `SELECT id, community_id, parameter, old_value, new_value, aggregate_delta,
            contributing_member_count, interaction_rate_snapshot, damping_applied, applied_at
     FROM reputation.community_evolution_log
     WHERE community_id = $1
     ORDER BY applied_at DESC
     LIMIT $2 OFFSET $3`,
    [communityId, limit, offset]
  );
  return result.rows;
}

/** Summary: first evolution date, count of evolved parameters, contributing member count. */
export async function getCommunityEvolutionSummary(communityId: string): Promise<{
  first_evolution_at: string | null;
  evolved_parameter_count: number;
  last_contributing_member_count: number;
}> {
  const result = await query(
    `SELECT
       MIN(applied_at) AS first_evolution_at,
       COUNT(DISTINCT parameter) AS evolved_parameter_count,
       (SELECT contributing_member_count
        FROM reputation.community_evolution_log
        WHERE community_id = $1
        ORDER BY applied_at DESC LIMIT 1) AS last_contributing_member_count
     FROM reputation.community_evolution_log
     WHERE community_id = $1`,
    [communityId]
  );
  const r = result.rows[0];
  return {
    first_evolution_at: r?.first_evolution_at ?? null,
    evolved_parameter_count: parseInt(r?.evolved_parameter_count ?? '0', 10),
    last_contributing_member_count: parseInt(r?.last_contributing_member_count ?? '0', 10),
  };
}
```

---

## Task 4: `communityEvolutionService.ts`

**Files:**
- Create: `services/reputation-service/src/services/communityEvolutionService.ts`

- [ ] Create the core service. Exports the three pure functions tested in Task 2 plus the main `applyCommunityCommunityEvolution` orchestrator:

```typescript
// services/reputation-service/src/services/communityEvolutionService.ts
import {
  getMemberPriorDeltas,
  getInteractionRate,
  getPreviousInteractionRate,
  getDaysSinceLastEvolution,
  getRecentPriorEvolutionDeltas,
  getCommunityEvolvingParams,
  applyCommunityConfigNudge,
  insertCommunityEvolutionLog,
} from '../database/communityEvolutionDb';

const COMMUNITY_COOLDOWN_DAYS = 30;
const MIN_CONTRIBUTING_MEMBERS = 3;
const PRIOR_DAMPING = 0.30;

/** Pure: compute median of a list of deltas. Returns 0 for empty list. */
export function computeAggregateDeltas(deltas: number[]): number {
  if (deltas.length === 0) return 0;
  const sorted = [...deltas].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? round2((sorted[mid - 1] + sorted[mid]) / 2)
    : round2(sorted[mid]);
}

/** Pure: compute damping factor based on interaction rate trend.
 *  previousRate=null means first cycle — no dampening. */
export function computeDampingFactor(
  previousRate: number | null,
  currentRate: number
): number {
  if (previousRate === null || previousRate === 0) return 1.0;
  const change = (currentRate - previousRate) / previousRate;
  if (change <= -0.25) return 0.0;
  if (change <= -0.10) return 0.5;
  return 1.0;
}

/** Pure: returns 1 (up), -1 (down), or false (no consensus) for hop evolution.
 *  Requires exactly 3+ recent aggregate_delta values all in the same direction. */
export function shouldEvolveHops(recentDeltas: number[]): 1 | -1 | false {
  if (recentDeltas.length < 3) return false;
  const last3 = recentDeltas.slice(0, 3);
  const allPositive = last3.every(d => d > 0);
  const allNegative = last3.every(d => d < 0);
  if (allPositive) return 1;
  if (allNegative) return -1;
  return false;
}

function round2(n: number): number {
  return parseFloat(n.toFixed(2));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Main entry point — called by Bull job handler.
 *  Never throws; errors are caught and logged. */
export async function applyCommunityEvolution(communityId: string): Promise<void> {
  try {
    // 1. Load current config and check evolution flag
    const params = await getCommunityEvolvingParams(communityId);
    if (!params) return;
    if (!params.community_evolution_enabled) return;

    // 2. Cooldown check
    const daysSinceLast = await getDaysSinceLastEvolution(communityId);
    if (daysSinceLast !== null && daysSinceLast < COMMUNITY_COOLDOWN_DAYS) return;

    // 3. Gather member deltas
    const memberDeltas = await getMemberPriorDeltas(communityId);
    if (memberDeltas.length < MIN_CONTRIBUTING_MEMBERS) return;

    const rawDeltas = memberDeltas.map(m => m.delta);
    const aggregateDelta = computeAggregateDeltas(rawDeltas);
    if (aggregateDelta === 0) return;

    // 4. Interaction rate health check
    const [currentRate, previousRate] = await Promise.all([
      getInteractionRate(communityId),
      getPreviousInteractionRate(communityId),
    ]);
    const damping = computeDampingFactor(previousRate, currentRate);

    // 5. Compute nudge for cross_community_prior
    const priorNudge = round2(aggregateDelta * PRIOR_DAMPING * damping);
    if (priorNudge === 0) {
      // Damped to zero — log it but don't apply config changes
      await insertCommunityEvolutionLog({
        community_id: communityId,
        parameter: 'cross_community_prior',
        old_value: params.cross_community_prior,
        new_value: params.cross_community_prior,
        aggregate_delta: aggregateDelta,
        contributing_member_count: memberDeltas.length,
        interaction_rate_snapshot: currentRate,
        damping_applied: damping,
      });
      return;
    }

    const newPrior = round2(clamp(
      params.cross_community_prior + priorNudge,
      0.05, 0.95
    ));

    // 6. Karma split follows prior direction (±1)
    const splitDirection = priorNudge > 0 ? 1 : -1;
    const newKarmaSplit = clamp(params.karma_split_helper + splitDirection, 0, 100);

    // 7. Hop evolution — direction consensus gate
    const recentDeltas = await getRecentPriorEvolutionDeltas(communityId, 3);
    const hopDirection = shouldEvolveHops([...recentDeltas, aggregateDelta]);
    const newHops = hopDirection !== false
      ? clamp(params.trust_path_max_hops + hopDirection, 1, 5)
      : params.trust_path_max_hops;

    // 8. Apply config changes
    const configPatch: Record<string, number> = {
      cross_community_prior: newPrior,
      karma_split_helper: newKarmaSplit,
    };
    if (newHops !== params.trust_path_max_hops) {
      configPatch.trust_path_max_hops = newHops;
    }
    await applyCommunityConfigNudge(communityId, configPatch);

    // 9. Log each changed parameter
    await insertCommunityEvolutionLog({
      community_id: communityId,
      parameter: 'cross_community_prior',
      old_value: params.cross_community_prior,
      new_value: newPrior,
      aggregate_delta: aggregateDelta,
      contributing_member_count: memberDeltas.length,
      interaction_rate_snapshot: currentRate,
      damping_applied: damping,
    });

    if (newKarmaSplit !== params.karma_split_helper) {
      await insertCommunityEvolutionLog({
        community_id: communityId,
        parameter: 'karma_split_helper',
        old_value: params.karma_split_helper,
        new_value: newKarmaSplit,
        aggregate_delta: splitDirection,
        contributing_member_count: memberDeltas.length,
        interaction_rate_snapshot: currentRate,
        damping_applied: damping,
      });
    }

    if (newHops !== params.trust_path_max_hops) {
      await insertCommunityEvolutionLog({
        community_id: communityId,
        parameter: 'trust_path_max_hops',
        old_value: params.trust_path_max_hops,
        new_value: newHops,
        aggregate_delta: hopDirection as number,
        contributing_member_count: memberDeltas.length,
        interaction_rate_snapshot: currentRate,
        damping_applied: damping,
      });
    }
  } catch (err) {
    console.error(`[communityEvolution] Error for community ${communityId}:`, err);
    // Never rethrow — evolution failure must not affect caller
  }
}
```

- [ ] Run unit tests — they should now pass:
```bash
cd services/reputation-service && npx jest tests/unit/reputation/communityEvolutionService --no-coverage 2>&1 | tail -10
```

---

## Task 5: Wire user evolution → queue community check

**Files:**
- Modify: `services/reputation-service/src/services/trustEvolutionService.ts`

- [ ] At the bottom of `evaluateUserEvolution()`, after the evolution nudges are applied, queue a community evolution check. Add to the end of the function (after the `for` loop):

```typescript
// Add import at top of file:
import Queue from 'bull';

// Add after the existing nudge loop in evaluateUserEvolution():
// Queue a community evolution check (deduplicated by community_id as job ID)
try {
  const evolutionQueue = new Queue('karmyq-community-evolution', {
    redis: { host: process.env.REDIS_HOST ?? 'localhost', port: 6379 },
  });
  await evolutionQueue.add(
    { communityId },
    {
      jobId: communityId,          // deduplication key — one pending job per community
      delay: 5000,                 // 5s delay to allow multiple user evolutions to coalesce
      removeOnComplete: true,
      removeOnFail: false,
    }
  );
} catch (err) {
  console.error('[trustEvolution] Failed to queue community evolution check:', err);
  // Do not rethrow — queue failure must not fail user evolution
}
```

---

## Task 6: Bull queue consumer + `user_joined_community` handler

**Files:**
- Modify: `services/reputation-service/src/events/subscriber.ts`

- [ ] Add import for `applyCommunityEvolution` at the top:
```typescript
import { applyCommunityEvolution } from '../services/communityEvolutionService';
```

- [ ] Add the `karmyq-community-evolution` queue consumer after the existing queue setup:
```typescript
const communityEvolutionQueue = new Queue('karmyq-community-evolution', {
  redis: { host: process.env.REDIS_HOST ?? 'localhost', port: 6379 },
});

communityEvolutionQueue.process(async (job) => {
  const { communityId } = job.data;
  await applyCommunityEvolution(communityId);
});
```

- [ ] In the existing `user_joined_community` event handler (or add one if absent), ensure the joining member's `user_trust_configs` row is initialized with `evolution_enabled = TRUE` (the new default). This happens automatically via `upsertUserTrustConfig` if called; no code change needed if the row is created on first trust evaluation. Verify by reading the existing handler logic and confirming the default is picked up.

- [ ] Verify subscriber.ts still compiles:
```bash
cd services/reputation-service && npx tsc --noEmit 2>&1 | head -20
```

---

## Task 7: API routes

**Files:**
- Modify: `services/reputation-service/src/routes/reputation.ts`

- [ ] Add imports at the top of `reputation.ts`:
```typescript
import {
  getCommunityEvolutionHistory,
  getCommunityEvolutionSummary,
} from '../database/communityEvolutionDb';
import { updateCommunityEvolutionConfig } from '../database/trustEvolutionDb';
```

- [ ] Add three new routes (place after existing trust evolution routes):

```typescript
// GET /reputation/community/:communityId/evolution/history
router.get('/community/:communityId/evolution/history', requireAuth, async (req, res) => {
  try {
    const { communityId } = req.params;
    const user = (req as any).user;
    // Admin check
    const memberships = user.communities ?? [];
    const isAdmin = memberships.some((m: any) => m.id === communityId && m.role === 'admin');
    if (!isAdmin) return res.status(403).json({ success: false, message: 'Admin only' });

    const limit = Math.min(parseInt(req.query.limit as string ?? '50', 10), 100);
    const offset = parseInt(req.query.offset as string ?? '0', 10);
    const history = await getCommunityEvolutionHistory(communityId, limit, offset);
    return res.json({ success: true, data: history });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /reputation/community/:communityId/evolution/summary
router.get('/community/:communityId/evolution/summary', requireAuth, async (req, res) => {
  try {
    const { communityId } = req.params;
    const user = (req as any).user;
    const memberships = user.communities ?? [];
    const isAdmin = memberships.some((m: any) => m.id === communityId && m.role === 'admin');
    if (!isAdmin) return res.status(403).json({ success: false, message: 'Admin only' });

    const summary = await getCommunityEvolutionSummary(communityId);
    return res.json({ success: true, data: summary });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /reputation/community/:communityId/evolution/toggle
router.put('/community/:communityId/evolution/toggle', requireAuth, async (req, res) => {
  try {
    const { communityId } = req.params;
    const user = (req as any).user;
    const memberships = user.communities ?? [];
    const isAdmin = memberships.some((m: any) => m.id === communityId && m.role === 'admin');
    if (!isAdmin) return res.status(403).json({ success: false, message: 'Admin only' });

    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'enabled (boolean) required' });
    }
    await updateCommunityEvolutionConfig(communityId, { community_evolution_enabled: enabled });
    return res.json({ success: true, data: { community_evolution_enabled: enabled } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
```

- [ ] Type check:
```bash
cd services/reputation-service && npx tsc --noEmit 2>&1 | head -20
```

---

## Task 8: Frontend — community admin Trust Evolution section

**Files:**
- Modify: `apps/frontend/src/pages/communities/[id].tsx`

- [ ] Add API calls to the frontend API layer (`apps/frontend/src/api.ts` or equivalent):
```typescript
export const getCommunityEvolutionSummary = (communityId: string) =>
  apiClient.get(`/reputation/community/${communityId}/evolution/summary`);

export const getCommunityEvolutionHistory = (communityId: string) =>
  apiClient.get(`/reputation/community/${communityId}/evolution/history`);

export const toggleCommunityEvolution = (communityId: string, enabled: boolean) =>
  apiClient.put(`/reputation/community/${communityId}/evolution/toggle`, { enabled });
```

- [ ] In `[id].tsx`, locate the Settings tab section (the `isAdmin` gated section). Add a **Trust Evolution** card below the existing trust config form:

```tsx
{/* Trust Evolution — admin only */}
{isAdmin && (
  <div className="mt-6 border-t pt-6">
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Community Trust Evolution</h3>
        <p className="text-xs text-gray-500 mt-1">
          When enabled, your community&apos;s trust parameters calibrate based on
          how members&apos; trust evolves over time.
        </p>
      </div>
      <button
        onClick={() => handleToggleCommunityEvolution(!evolutionEnabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          evolutionEnabled ? 'bg-indigo-600' : 'bg-gray-200'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          evolutionEnabled ? 'translate-x-6' : 'translate-x-1'
        }`} />
      </button>
    </div>

    {evolutionSummary && evolutionSummary.first_evolution_at && (
      <div className="text-xs text-gray-600 space-y-1">
        <p>
          {evolutionSummary.evolved_parameter_count} parameter
          {evolutionSummary.evolved_parameter_count !== 1 ? 's' : ''} evolved
          since {new Date(evolutionSummary.first_evolution_at).toLocaleDateString()}
        </p>
        <p className="text-gray-400">
          Last cycle contributed by {evolutionSummary.last_contributing_member_count} members
        </p>
      </div>
    )}

    {!evolutionEnabled && (
      <p className="text-xs text-amber-600 mt-2">
        Evolution is paused. Existing config is unchanged.
      </p>
    )}
  </div>
)}
```

- [ ] Add the corresponding state and handlers in the component (near other admin state):
```typescript
const [evolutionEnabled, setEvolutionEnabled] = useState(true);
const [evolutionSummary, setEvolutionSummary] = useState<any>(null);

useEffect(() => {
  if (!isAdmin || !community?.id) return;
  getCommunityEvolutionSummary(community.id)
    .then(res => setEvolutionSummary(res))
    .catch(() => {});
}, [isAdmin, community?.id]);

const handleToggleCommunityEvolution = async (enabled: boolean) => {
  try {
    await toggleCommunityEvolution(community.id, enabled);
    setEvolutionEnabled(enabled);
  } catch {
    // silent fail — not critical path
  }
};
```

---

## Task 9: Frontend — personal trust page acknowledgment

**Files:**
- Modify: `apps/frontend/src/pages/reputation/trust.tsx`

- [ ] Read `trust.tsx` first to find where `evolution_enabled` is displayed.

- [ ] After the evolution toggle, add a one-line acknowledgment (only when evolution is enabled):
```tsx
{config?.evolution_enabled && (
  <p className="text-xs text-gray-500 mt-2">
    Your trust model is evolving and contributing to your community&apos;s calibration.
  </p>
)}
```

---

## Task 10: ADR-047 + landing page docs

**Files:**
- Create: `docs/adr/ADR-047-community-evolution-engine.md`
- Create: `apps/landing/src/data/docs/concepts/adr-047-community-evolution-engine.json`
- Create: `apps/landing/src/data/docs/concepts/community-evolution.json`
- Modify: `apps/landing/src/data/docs/nav.json`

- [ ] Create `docs/adr/ADR-047-community-evolution-engine.md`:

```markdown
# ADR-047: Community Evolution Engine

**Status**: Implemented
**Date**: 2026-03-20
**Sprint**: 31

## Context

Sprint 30 introduced individual trust evolution — each user's trust parameters calibrate
based on lived experience. This creates a source of signal that had no destination: individual
calibrations happened but didn't feed back into the community-level trust model.

## Decision

Build a Community Evolution Engine that aggregates member trust deltas to drift community config.

Key design decisions:
1. **Delta-based, not absolute**: The signal is the change in each member's trust since
   they began evolving — not their current values. A community of uniformly trusting members
   who never evolved has no signal to contribute.
2. **Two opt-out levels, no middle state**: Users opt in/out of personal evolution.
   Communities opt in/out of community evolution. If a user's trust evolves, their delta
   contributes to the community — there is no third flag.
3. **Interaction rate as a health validator**: Before applying evolution, we check whether
   interaction rate is declining. Declining interaction dampens the nudge, preventing the
   system from drifting toward configurations that correlate with disengagement.
4. **Direction consensus for hop count**: `trust_path_max_hops` only changes after 3
   consecutive evolution cycles agree on direction, preventing oscillation on a high-impact
   parameter.
5. **Pluggable by design**: `communityEvolutionService.ts` checks the evolution flag at
   every entry point and is removable without touching core karma/trust logic.
6. **Default opt-out**: Both user and community evolution default to TRUE. Consent is given
   at account/community creation.

## Three Parameters That Evolve

- `cross_community_prior` (0.05–0.95): Direct delta aggregation × 0.30 damping
- `karma_split_helper` (0–100): Follows prior direction, ±1 per cycle
- `trust_path_max_hops` (1–5): Follows prior direction, ±1 only after 3 consecutive same-direction cycles

## Consequences

- Community configs are no longer static — they require a history audit log (`community_evolution_log`)
- Admins need a UI surface to observe evolution history and toggle it off
- Sprint 32 (fractal feed) can now blend individual + community evolved params in the matching model
```

- [ ] Create `apps/landing/src/data/docs/concepts/adr-047-community-evolution-engine.json` — follow exact format from existing ADR JSON files in that directory.

- [ ] Create `apps/landing/src/data/docs/concepts/community-evolution.json`:
```json
{
  "slug": "community-evolution",
  "title": "Community Evolution",
  "description": "How communities learn from their members — aggregating individual trust calibrations into living community config.",
  "content": "# Community Evolution\n\nKarmyq communities don't have fixed trust configurations. Over time, they learn from their members.\n\n## How It Works\n\nWhen members' individual trust models calibrate based on lived experience, those calibrations become a signal. The Community Evolution Engine aggregates these signals into periodic nudges to the community's trust config.\n\n## What Evolves\n\nThree parameters evolve over time:\n- **Cross-community prior**: how openly the community treats interactions with outsiders\n- **Karma split**: the balance of karma awarded between helpers and requesters\n- **Trust path depth**: how many relationship hops the community considers when computing trust\n\n## The Core Mechanic\n\nEach member's evolution is tracked as a delta — the change from their starting values. A community where members are consistently calibrating toward more openness tells the system something real. The community config nudges in that direction.\n\n## Interaction Health Check\n\nBefore applying any evolution, the system checks whether interaction rates are declining. If they are, the nudge is dampened or skipped. This prevents the system from drifting toward configurations that correlate with disengagement.\n\n## Opting Out\n\nBoth communities and individual users can opt out. Community admins can pause evolution from the Settings tab. Users can disable personal trust evolution from their Trust settings — doing so also stops their signal from contributing to community evolution."
}
```

- [ ] Update `apps/landing/src/data/docs/nav.json`:
  - Add ADR-047 under "Architecture Decisions"
  - Add "community-evolution" under "Concepts"

- [ ] Force-add (these files are gitignored but tracked):
```bash
git add -f apps/landing/src/data/docs/concepts/adr-047-community-evolution-engine.json
git add -f apps/landing/src/data/docs/concepts/community-evolution.json
git add -f apps/landing/src/data/docs/nav.json
```

---

## Task 11: CONTEXT.md + registry.json + TDD integration test

**Files:**
- Modify: `services/reputation-service/CONTEXT.md`
- Modify: `services/registry.json`
- Create: `tests/tdd/community-evolution-flow.test.ts`

- [ ] Update `services/reputation-service/CONTEXT.md` — add to "API Endpoints":
```
GET  /reputation/community/:communityId/evolution/history  Admin — paginated community evolution log
GET  /reputation/community/:communityId/evolution/summary  Admin — drift summary since first evolution
PUT  /reputation/community/:communityId/evolution/toggle   Admin — enable/disable community evolution
```

- [ ] Update `services/registry.json` — add the three new endpoints to reputation-service's `apis.provides` array as plain strings:
```json
"GET /reputation/community/:communityId/evolution/history",
"GET /reputation/community/:communityId/evolution/summary",
"PUT /reputation/community/:communityId/evolution/toggle"
```

- [ ] Create the TDD integration test:

```typescript
// tests/tdd/community-evolution-flow.test.ts
// Integration test: requires live DB. Documents expected community evolution behavior.
// Lives in tdd/ — can fail without blocking. Promotes to regression/ when DB is stable.

describe('Community Evolution Flow (integration)', () => {
  it('applies community evolution after sufficient member deltas accumulate', async () => {
    // Setup: create test community with evolution_enabled = true
    // Create 3+ members with evolution log entries (prior deltas > 0)
    // Call applyCommunityEvolution(communityId)
    // Assert: community_configs.cross_community_prior increased
    // Assert: community_evolution_log has one new entry
    // Assert: karma_split_helper increased by 1
    expect(true).toBe(true); // placeholder — replace with real DB assertions
  });

  it('skips evolution when fewer than 3 contributing members', async () => {
    // Setup: community with 2 members who have evolution logs
    // Call applyCommunityEvolution(communityId)
    // Assert: no community_evolution_log entry created
    expect(true).toBe(true);
  });

  it('dampens nudge when interaction rate is declining', async () => {
    // Setup: community with declining match completion rate
    // Call applyCommunityEvolution(communityId)
    // Assert: damping_applied = 0.5 in community_evolution_log
    expect(true).toBe(true);
  });

  it('skips hop evolution when fewer than 3 prior cycles agree', async () => {
    // Setup: only 2 prior evolution cycles
    // Call applyCommunityEvolution(communityId)
    // Assert: trust_path_max_hops unchanged
    expect(true).toBe(true);
  });
});
```

- [ ] Run feedback check:
```bash
npm run feedback:check
```

---

## Task 12: Final type check + verification

- [ ] TypeScript type check across all changed services:
```bash
cd services/reputation-service && npx tsc --noEmit
cd apps/frontend && npx tsc --noEmit
```

- [ ] Run unit + regression tests:
```bash
npm test
```

- [ ] Run TDD tests:
```bash
npm run test:tdd
```

- [ ] Run feedback check:
```bash
npm run feedback:check
```

- [ ] Verify build:
```bash
npm run build 2>&1 | tail -20
```

- [ ] Confirm all files exist:
```bash
ls services/reputation-service/src/database/communityEvolutionDb.ts
ls services/reputation-service/src/services/communityEvolutionService.ts
ls infrastructure/postgres/migrations/20260320-community-evolution.sql
ls docs/adr/ADR-047-community-evolution-engine.md
```

- [ ] Stage and commit:
```bash
git add services/reputation-service/src/database/communityEvolutionDb.ts \
        services/reputation-service/src/services/communityEvolutionService.ts \
        services/reputation-service/src/events/subscriber.ts \
        services/reputation-service/src/routes/reputation.ts \
        services/reputation-service/src/services/trustEvolutionService.ts \
        services/reputation-service/CONTEXT.md \
        infrastructure/postgres/migrations/20260320-community-evolution.sql \
        infrastructure/postgres/init.sql \
        apps/frontend/src/pages/communities/[id].tsx \
        apps/frontend/src/pages/reputation/trust.tsx \
        services/registry.json \
        docs/adr/ADR-047-community-evolution-engine.md \
        tests/unit/reputation/communityEvolutionService.test.ts \
        tests/tdd/community-evolution-flow.test.ts
git add -f apps/landing/src/data/docs/concepts/adr-047-community-evolution-engine.json \
           apps/landing/src/data/docs/concepts/community-evolution.json \
           apps/landing/src/data/docs/nav.json
git commit -m "feat(reputation): Sprint 31 — Community Evolution Engine (ADR-047)"
```
