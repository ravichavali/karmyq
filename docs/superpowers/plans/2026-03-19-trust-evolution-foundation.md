# Trust Evolution Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a per-user trust config layer with automatic parameter calibration based on behavioral signals, giving individuals an opt-in living trust model that reflects their actual cross-community experience.

**Architecture:** Three new DB tables (`user_trust_configs`, `user_trust_evolution_log`, and two new columns on `community_configs`) feed a new `trustEvolutionService` that fires parameter nudges from existing event hooks. Five new API endpoints expose the config and history. A "My Trust Journey" frontend page visualizes the calibration over time.

**Tech Stack:** Node.js/Express/TypeScript (reputation-service), Next.js 14 (frontend), PostgreSQL 15, Bull queue for events.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260319-trust-evolution.sql` | Idempotent DDL for new tables + community_configs columns |
| `services/reputation-service/src/database/trustConfigDb.ts` | Extracted shared `getCommunityTrustConfig` helper (removes duplication) |
| `services/reputation-service/src/database/trustEvolutionDb.ts` | All DB queries for evolution data |
| `services/reputation-service/src/services/trustEvolutionService.ts` | Evolution engine: signal nudges, eligibility gates, effective params |
| `apps/frontend/src/pages/reputation/evolution.tsx` | "My Trust Journey" timeline page |
| `docs/adr/ADR-046-trust-model-evolution.md` | ADR document |
| `apps/landing/src/data/docs/concepts/trust-model-evolution.json` | Landing concept page |
| `apps/landing/src/data/docs/concepts/adr-046-trust-model-evolution.json` | Landing ADR JSON |
| `tests/unit/reputation/trustEvolutionService.test.ts` | Unit tests for evolution engine |
| `tests/tdd/trust-evolution-flow.test.ts` | TDD integration test (can fail without live services) |

### Existing files to modify
| File | Change |
|------|--------|
| `infrastructure/postgres/init.sql` | Add new tables + 2 columns to community_configs |
| `services/reputation-service/src/services/karmaService.ts` | Import getCommunityTrustConfig from trustConfigDb instead of local def |
| `services/reputation-service/src/services/communityTrustService.ts` | Same import switch |
| `services/reputation-service/src/events/subscriber.ts` | Wire evolution calls into match_completed handler |
| `services/reputation-service/src/routes/reputation.ts` | Add 5 new endpoints + inline evolution call in feedback handler |
| `apps/frontend/src/lib/api.ts` | Add 5 new reputationService methods |
| `apps/frontend/src/pages/reputation/trust.tsx` | Add evolution toggle section |
| `apps/frontend/src/pages/communities/[id].tsx` | Add community evolution admin section |
| `apps/landing/src/data/docs/nav.json` | Add 2 entries |
| `apps/landing/src/data/docs/concepts/trust-and-karma.json` | Add evolution paragraph |
| `apps/landing/src/data/docs/guides/community-trust-model.json` | Add evolution section |
| `services/reputation-service/CONTEXT.md` | New endpoints + schema |
| `services/registry.json` | New reputation-service endpoints |

---

## Task 1: Feature branch + migration file

**Files:**
- Create: `infrastructure/postgres/migrations/20260319-trust-evolution.sql`

- [ ] **Create feature branch**

```bash
git checkout -b feature/sprint-30-trust-evolution
```

- [ ] **Create the migration file**

```sql
-- infrastructure/postgres/migrations/20260319-trust-evolution.sql
-- Sprint 30: Individual Trust Evolution Layer (ADR-046)
-- Core principle: accuracy over direction — the system calibrates toward reality, not a preferred value.

-- 1. Add community-level evolution flags to existing community_configs
ALTER TABLE communities.community_configs
  ADD COLUMN IF NOT EXISTS community_evolution_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cross_community_prior DECIMAL(3,2) DEFAULT 0.50;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'chk_community_cross_community_prior'
  ) THEN
    ALTER TABLE communities.community_configs
      ADD CONSTRAINT chk_community_cross_community_prior
        CHECK (cross_community_prior BETWEEN 0.05 AND 0.95);
  END IF;
END$$;

-- 2. Per-user trust config (one row per user per community)
CREATE TABLE IF NOT EXISTS reputation.user_trust_configs (
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id       UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  depth_weight       DECIMAL(3,2) DEFAULT NULL
                       CONSTRAINT chk_utc_depth CHECK (depth_weight IS NULL OR depth_weight BETWEEN 0.10 AND 0.90),
  breadth_weight     DECIMAL(3,2) DEFAULT NULL
                       CONSTRAINT chk_utc_breadth CHECK (breadth_weight IS NULL OR breadth_weight BETWEEN 0.10 AND 0.90),
  cross_community_prior DECIMAL(3,2) NOT NULL DEFAULT 0.50
                       CONSTRAINT chk_utc_prior CHECK (cross_community_prior BETWEEN 0.05 AND 0.95),
  evolution_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, community_id)
);

CREATE INDEX IF NOT EXISTS idx_utc_user ON reputation.user_trust_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_utc_comm ON reputation.user_trust_configs(community_id);

-- 3. Immutable evolution audit log
CREATE TABLE IF NOT EXISTS reputation.user_trust_evolution_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id     UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  parameter        VARCHAR(50) NOT NULL,
  old_value        DECIMAL(3,2),
  new_value        DECIMAL(3,2) NOT NULL,
  trigger_signal   VARCHAR(100) NOT NULL,
  trigger_event_id UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index: covers cooldown lookups (user, community, parameter, created_at)
-- and history pagination (user, community, created_at)
CREATE INDEX IF NOT EXISTS idx_utel_user_comm_param_created
  ON reputation.user_trust_evolution_log (user_id, community_id, parameter, created_at DESC);
```

- [ ] **Update `infrastructure/postgres/init.sql`**

Add the two new `community_configs` columns to the `CREATE TABLE communities.community_configs` block (after existing trust columns). Add the two new `reputation` tables after `reputation.community_trust_scores`. Keep init.sql the source of truth for fresh installs.

- [ ] **Verify the migration is idempotent** — run it twice on a local DB, confirm no error on second run:

```bash
docker exec karmyq-postgres psql -U karmyq_user -d karmyq_db -f /dev/stdin < infrastructure/postgres/migrations/20260319-trust-evolution.sql
docker exec karmyq-postgres psql -U karmyq_user -d karmyq_db -f /dev/stdin < infrastructure/postgres/migrations/20260319-trust-evolution.sql
# Expected: no errors on either run
```

- [ ] **Verify tables created**

```bash
docker exec karmyq-postgres psql -U karmyq_user -d karmyq_db -c "\d reputation.user_trust_configs"
docker exec karmyq-postgres psql -U karmyq_user -d karmyq_db -c "\d reputation.user_trust_evolution_log"
docker exec karmyq-postgres psql -U karmyq_user -d karmyq_db -c "SELECT column_name FROM information_schema.columns WHERE table_name='community_configs' AND column_name IN ('community_evolution_enabled','cross_community_prior')"
# Expected: rows returned for both columns
```

- [ ] **Commit**

```bash
git add infrastructure/postgres/migrations/20260319-trust-evolution.sql infrastructure/postgres/init.sql
git commit -m "feat(db): add user_trust_configs, evolution_log, community evolution flags"
```

---

## Task 2: Extract shared `trustConfigDb.ts`

`getCommunityTrustConfig` is a private function in `karmaService.ts`. Extract and export it so `trustEvolutionService` can reuse it without circular imports.

> **Important:** `communityTrustService.ts` has a function with the same name but it queries entirely different columns (`community_trust_bonding_weight`, `community_trust_bridging_weight`) — it is NOT a duplicate. Do NOT touch `communityTrustService.ts`.

**Files:**
- Create: `services/reputation-service/src/database/trustConfigDb.ts`
- Modify: `services/reputation-service/src/services/karmaService.ts` only

- [ ] **Read `karmaService.ts`** — find the private `getCommunityTrustConfig` function. Note the exact interface it returns (the field names it remaps from raw DB columns). The function likely remaps `trust_depth_weight` → `depth_weight`, etc. You must copy the exact interface and mapping.

- [ ] **Create `trustConfigDb.ts`** — copy the private function verbatim from `karmaService.ts` and export it. The interface field names must match what `karmaService.ts` already consumes internally. Example (confirm against actual `karmaService.ts` before writing):

```typescript
// services/reputation-service/src/database/trustConfigDb.ts
import { query } from './db';

// Interface names must match what karmaService.ts already expects
// (typically remapped from raw DB columns — read karmaService.ts first)
export interface CommunityTrustConfig {
  depth_weight: number;           // from trust_depth_weight column
  breadth_weight: number;         // from trust_breadth_weight column
  feedback_threshold: number;     // from trust_feedback_threshold column
  min_interactions_for_bonus: number;
  negative_allowed: boolean;
  carry_enabled: boolean;
  carry_factor: number;
  carry_cap: number;
}

export async function getCommunityTrustConfig(communityId: string): Promise<CommunityTrustConfig> {
  // Copy this function VERBATIM from karmaService.ts — do not change the query or return shape
  // karmaService.ts will import from here instead of defining it locally
}
```

> **Note:** The example above shows likely field names — verify against the actual `karmaService.ts` source. The goal is zero change to how `karmaService.ts` calls this function.

- [ ] **Update `karmaService.ts`** — import from `trustConfigDb` and remove the local private function:

```typescript
import { getCommunityTrustConfig } from '../database/trustConfigDb';
// Remove the private getCommunityTrustConfig function definition (keep all call sites unchanged)
```

- [ ] **Run type check to confirm no breakage**

```bash
cd services/reputation-service && npx tsc --noEmit
# Expected: 0 errors
```

- [ ] **Run existing unit tests**

```bash
npm test
# Expected: all pass (no regression)
```

- [ ] **Commit**

```bash
git add services/reputation-service/src/database/trustConfigDb.ts \
        services/reputation-service/src/services/karmaService.ts \
        services/reputation-service/src/services/communityTrustService.ts
git commit -m "refactor(reputation): extract getCommunityTrustConfig to shared trustConfigDb"
```

---

## Task 3: Write unit tests first (TDD)

Write the full test file before any implementation. Tests will fail — that's correct.

**Files:**
- Create: `tests/unit/reputation/trustEvolutionService.test.ts`

- [ ] **Read the existing test pattern**

Read `tests/unit/reputation/prestige-badges.test.ts` to understand the mock setup — specifically how `jest.mock` and `mockQuery` are used. The pattern below matches it.

- [ ] **Create the test file**

```typescript
// tests/unit/reputation/trustEvolutionService.test.ts
import {
  getUserEffectiveParams,
  isEvolutionEligible,
  evaluateUserEvolution,
  EVOLUTION_SIGNALS,
} from '../../../services/reputation-service/src/services/trustEvolutionService';

// Mock all DB modules — never hit real DB in unit tests
jest.mock('../../../services/reputation-service/src/database/trustEvolutionDb');
jest.mock('../../../services/reputation-service/src/database/trustConfigDb');

import * as trustEvolutionDb from '../../../services/reputation-service/src/database/trustEvolutionDb';
import * as trustConfigDb from '../../../services/reputation-service/src/database/trustConfigDb';

const mockGetUserTrustConfig = trustEvolutionDb.getUserTrustConfig as jest.MockedFunction<typeof trustEvolutionDb.getUserTrustConfig>;
const mockGetCommunityEvolutionConfig = trustEvolutionDb.getCommunityEvolutionConfig as jest.MockedFunction<typeof trustEvolutionDb.getCommunityEvolutionConfig>;
const mockGetLastEvolutionForParameter = trustEvolutionDb.getLastEvolutionForParameter as jest.MockedFunction<typeof trustEvolutionDb.getLastEvolutionForParameter>;
const mockUpsertUserTrustConfig = trustEvolutionDb.upsertUserTrustConfig as jest.MockedFunction<typeof trustEvolutionDb.upsertUserTrustConfig>;
const mockInsertEvolutionLog = trustEvolutionDb.insertEvolutionLog as jest.MockedFunction<typeof trustEvolutionDb.insertEvolutionLog>;
const mockGetCommunityTrustConfig = trustConfigDb.getCommunityTrustConfig as jest.MockedFunction<typeof trustConfigDb.getCommunityTrustConfig>;

// Field names must match what getCommunityTrustConfig (trustConfigDb.ts) actually returns.
// Confirm against the real karmaService.ts interface after Task 2 — adjust names here if different.
const COMMUNITY_DEFAULTS = {
  depth_weight: 0.60,           // remapped from trust_depth_weight
  breadth_weight: 0.40,         // remapped from trust_breadth_weight
  feedback_threshold: 3.0,
  min_interactions_for_bonus: 1,
  negative_allowed: false,
  carry_factor: 0.40,
  carry_cap: 59,
  carry_enabled: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCommunityTrustConfig.mockResolvedValue(COMMUNITY_DEFAULTS);
  mockGetUserTrustConfig.mockResolvedValue(null); // No user config by default
  mockGetCommunityEvolutionConfig.mockResolvedValue({
    community_evolution_enabled: true,
    cross_community_prior: 0.50,
  });
  mockGetLastEvolutionForParameter.mockResolvedValue(null); // No prior adjustments
  mockUpsertUserTrustConfig.mockResolvedValue(undefined);
  mockInsertEvolutionLog.mockResolvedValue(undefined);
});

describe('getUserEffectiveParams', () => {
  it('returns community defaults when user config has NULL weights', async () => {
    const params = await getUserEffectiveParams('user-1', 'comm-1');
    expect(params.depth_weight).toBe(0.60);
    expect(params.breadth_weight).toBe(0.40);
  });

  it('returns user override when depth_weight is set', async () => {
    mockGetUserTrustConfig.mockResolvedValue({
      user_id: 'user-1',
      community_id: 'comm-1',
      depth_weight: 0.75,
      breadth_weight: null,
      cross_community_prior: 0.50,
      evolution_enabled: true,
    });
    const params = await getUserEffectiveParams('user-1', 'comm-1');
    expect(params.depth_weight).toBe(0.75);
    expect(params.breadth_weight).toBe(0.40); // still community default
  });

  it('cross_community_prior always returned from user config', async () => {
    mockGetUserTrustConfig.mockResolvedValue({
      user_id: 'user-1',
      community_id: 'comm-1',
      depth_weight: null,
      breadth_weight: null,
      cross_community_prior: 0.72,
      evolution_enabled: true,
    });
    const params = await getUserEffectiveParams('user-1', 'comm-1');
    expect(params.cross_community_prior).toBe(0.72);
  });
});

describe('isEvolutionEligible', () => {
  it('returns false when community_evolution_enabled is false', async () => {
    mockGetCommunityEvolutionConfig.mockResolvedValue({
      community_evolution_enabled: false,
      cross_community_prior: 0.50,
    });
    mockGetUserTrustConfig.mockResolvedValue({
      user_id: 'u', community_id: 'c', depth_weight: null,
      breadth_weight: null, cross_community_prior: 0.50, evolution_enabled: true,
    });
    const eligible = await isEvolutionEligible('u', 'c', 'cross_community_prior');
    expect(eligible).toBe(false);
  });

  it('returns false when user evolution_enabled is false', async () => {
    mockGetUserTrustConfig.mockResolvedValue({
      user_id: 'u', community_id: 'c', depth_weight: null,
      breadth_weight: null, cross_community_prior: 0.50, evolution_enabled: false,
    });
    const eligible = await isEvolutionEligible('u', 'c', 'cross_community_prior');
    expect(eligible).toBe(false);
  });

  it('returns false when user has no config row (evolution_enabled defaults to false)', async () => {
    mockGetUserTrustConfig.mockResolvedValue(null);
    const eligible = await isEvolutionEligible('u', 'c', 'cross_community_prior');
    expect(eligible).toBe(false);
  });

  it('returns false when last adjustment was less than 7 days ago', async () => {
    mockGetUserTrustConfig.mockResolvedValue({
      user_id: 'u', community_id: 'c', depth_weight: null,
      breadth_weight: null, cross_community_prior: 0.50, evolution_enabled: true,
    });
    const recentDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    mockGetLastEvolutionForParameter.mockResolvedValue(recentDate);
    const eligible = await isEvolutionEligible('u', 'c', 'cross_community_prior');
    expect(eligible).toBe(false);
  });

  it('returns true when all gates pass', async () => {
    mockGetUserTrustConfig.mockResolvedValue({
      user_id: 'u', community_id: 'c', depth_weight: null,
      breadth_weight: null, cross_community_prior: 0.50, evolution_enabled: true,
    });
    const eligible = await isEvolutionEligible('u', 'c', 'cross_community_prior');
    expect(eligible).toBe(true);
  });
});

describe('evaluateUserEvolution', () => {
  beforeEach(() => {
    // User has evolution enabled, no prior adjustments
    mockGetUserTrustConfig.mockResolvedValue({
      user_id: 'u', community_id: 'c', depth_weight: null,
      breadth_weight: null, cross_community_prior: 0.50, evolution_enabled: true,
    });
  });

  it('nudges cross_community_prior +0.02 and breadth_weight +0.01 on positive feedback', async () => {
    await evaluateUserEvolution('u', 'c', EVOLUTION_SIGNALS.CROSS_COMMUNITY_POSITIVE_FEEDBACK, {});

    // Should upsert twice (one per nudged parameter)
    expect(mockUpsertUserTrustConfig).toHaveBeenCalledWith('u', 'c', { cross_community_prior: 0.52 });
    expect(mockUpsertUserTrustConfig).toHaveBeenCalledWith('u', 'c', { breadth_weight: 0.41 });
    expect(mockInsertEvolutionLog).toHaveBeenCalledTimes(2);
  });

  it('nudges cross_community_prior -0.02 on negative feedback', async () => {
    await evaluateUserEvolution('u', 'c', EVOLUTION_SIGNALS.CROSS_COMMUNITY_NEGATIVE_FEEDBACK, {});
    expect(mockUpsertUserTrustConfig).toHaveBeenCalledWith('u', 'c', { cross_community_prior: 0.48 });
    expect(mockInsertEvolutionLog).toHaveBeenCalledTimes(1);
  });

  it('clamps cross_community_prior at upper bound (0.95)', async () => {
    mockGetUserTrustConfig.mockResolvedValue({
      user_id: 'u', community_id: 'c', depth_weight: null,
      breadth_weight: null, cross_community_prior: 0.94, evolution_enabled: true,
    });
    await evaluateUserEvolution('u', 'c', EVOLUTION_SIGNALS.CROSS_COMMUNITY_POSITIVE_FEEDBACK, {});
    // 0.94 + 0.02 = 0.96, clamped to 0.95
    expect(mockUpsertUserTrustConfig).toHaveBeenCalledWith('u', 'c', { cross_community_prior: 0.95 });
  });

  it('clamps cross_community_prior at lower bound (0.05)', async () => {
    mockGetUserTrustConfig.mockResolvedValue({
      user_id: 'u', community_id: 'c', depth_weight: null,
      breadth_weight: null, cross_community_prior: 0.06, evolution_enabled: true,
    });
    await evaluateUserEvolution('u', 'c', EVOLUTION_SIGNALS.CROSS_COMMUNITY_NEGATIVE_FEEDBACK, {});
    // 0.06 - 0.02 = 0.04, clamped to 0.05
    expect(mockUpsertUserTrustConfig).toHaveBeenCalledWith('u', 'c', { cross_community_prior: 0.05 });
  });

  it('skips a parameter if already at its bound', async () => {
    mockGetUserTrustConfig.mockResolvedValue({
      user_id: 'u', community_id: 'c', depth_weight: null,
      breadth_weight: null, cross_community_prior: 0.95, evolution_enabled: true,
    });
    await evaluateUserEvolution('u', 'c', EVOLUTION_SIGNALS.CROSS_COMMUNITY_POSITIVE_FEEDBACK, {});
    // cross_community_prior at 0.95 (upper bound) — delta +0.02 → still 0.95, skip
    // breadth_weight = community default 0.40, nudge +0.01 → 0.41, should apply
    const calls = mockUpsertUserTrustConfig.mock.calls.map(c => c[2]);
    expect(calls).not.toContainEqual({ cross_community_prior: 0.95 }); // skipped (no change)
    expect(calls).toContainEqual({ breadth_weight: 0.41 });
  });

  it('logs old_value and new_value for each adjustment', async () => {
    await evaluateUserEvolution('u', 'c', EVOLUTION_SIGNALS.CROSS_COMMUNITY_NEGATIVE_FEEDBACK, { triggerEventId: 'match-123' });
    expect(mockInsertEvolutionLog).toHaveBeenCalledWith(expect.objectContaining({
      parameter: 'cross_community_prior',
      old_value: 0.50,
      new_value: 0.48,
      trigger_signal: 'cross_community_negative_feedback',
      trigger_event_id: 'match-123',
    }));
  });

  it('nudges depth_weight +0.01 on repeat_interaction_same_person', async () => {
    await evaluateUserEvolution('u', 'c', EVOLUTION_SIGNALS.REPEAT_INTERACTION_SAME_PERSON, {});
    expect(mockUpsertUserTrustConfig).toHaveBeenCalledWith('u', 'c', { depth_weight: 0.61 });
  });

  it('nudges breadth_weight +0.02 and cross_community_prior +0.01 on diverse_community_interactions', async () => {
    await evaluateUserEvolution('u', 'c', EVOLUTION_SIGNALS.DIVERSE_COMMUNITY_INTERACTIONS, {});
    expect(mockUpsertUserTrustConfig).toHaveBeenCalledWith('u', 'c', { breadth_weight: 0.42 });
    expect(mockUpsertUserTrustConfig).toHaveBeenCalledWith('u', 'c', { cross_community_prior: 0.51 });
  });

  it('does nothing when community evolution is disabled', async () => {
    mockGetCommunityEvolutionConfig.mockResolvedValue({
      community_evolution_enabled: false,
      cross_community_prior: 0.50,
    });
    await evaluateUserEvolution('u', 'c', EVOLUTION_SIGNALS.CROSS_COMMUNITY_POSITIVE_FEEDBACK, {});
    expect(mockUpsertUserTrustConfig).not.toHaveBeenCalled();
    expect(mockInsertEvolutionLog).not.toHaveBeenCalled();
  });

  it('does nothing for an unknown signal', async () => {
    await evaluateUserEvolution('u', 'c', 'unknown_signal', {});
    expect(mockUpsertUserTrustConfig).not.toHaveBeenCalled();
  });
});
```

- [ ] **Run the tests to confirm they fail (expected)**

```bash
npm run test:unit -- --testPathPattern=trustEvolutionService
# Expected: FAIL — "Cannot find module trustEvolutionService"
```

- [ ] **Commit the test file**

```bash
git add tests/unit/reputation/trustEvolutionService.test.ts
git commit -m "test(reputation): add trustEvolutionService unit tests (failing — TDD)"
```

---

## Task 4: Implement `trustEvolutionDb.ts`

**Files:**
- Create: `services/reputation-service/src/database/trustEvolutionDb.ts`

- [ ] **Create the file**

```typescript
// services/reputation-service/src/database/trustEvolutionDb.ts
import { query } from './db';

export interface UserTrustConfig {
  user_id: string;
  community_id: string;
  depth_weight: number | null;
  breadth_weight: number | null;
  cross_community_prior: number;
  evolution_enabled: boolean;
}

export interface EvolutionLogEntry {
  id?: string;
  user_id: string;
  community_id: string;
  parameter: string;
  old_value: number | null;
  new_value: number;
  trigger_signal: string;
  trigger_event_id?: string;
  created_at?: string;
}

export async function getUserTrustConfig(
  userId: string,
  communityId: string
): Promise<UserTrustConfig | null> {
  const result = await query(
    `SELECT user_id, community_id, depth_weight, breadth_weight,
            cross_community_prior, evolution_enabled
     FROM reputation.user_trust_configs
     WHERE user_id = $1 AND community_id = $2`,
    [userId, communityId]
  );
  return result.rows[0] ?? null;
}

export async function upsertUserTrustConfig(
  userId: string,
  communityId: string,
  patch: Partial<Pick<UserTrustConfig, 'depth_weight' | 'breadth_weight' | 'cross_community_prior' | 'evolution_enabled'>>
): Promise<void> {
  const columns = Object.keys(patch);
  const values = Object.values(patch);
  const setClauses = columns.map((col, i) => `${col} = $${i + 3}`).join(', ');
  await query(
    `INSERT INTO reputation.user_trust_configs (user_id, community_id, ${columns.join(', ')})
     VALUES ($1, $2, ${values.map((_, i) => `$${i + 3}`).join(', ')})
     ON CONFLICT (user_id, community_id) DO UPDATE SET ${setClauses}, updated_at = NOW()`,
    [userId, communityId, ...values]
  );
}

export async function insertEvolutionLog(entry: EvolutionLogEntry): Promise<void> {
  await query(
    `INSERT INTO reputation.user_trust_evolution_log
       (user_id, community_id, parameter, old_value, new_value, trigger_signal, trigger_event_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      entry.user_id, entry.community_id, entry.parameter,
      entry.old_value, entry.new_value, entry.trigger_signal,
      entry.trigger_event_id ?? null,
    ]
  );
}

export async function getEvolutionLog(
  userId: string,
  communityId: string,
  limit = 50,
  offset = 0
): Promise<EvolutionLogEntry[]> {
  const result = await query(
    `SELECT id, user_id, community_id, parameter, old_value, new_value,
            trigger_signal, trigger_event_id, created_at
     FROM reputation.user_trust_evolution_log
     WHERE user_id = $1 AND community_id = $2
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [userId, communityId, limit, offset]
  );
  return result.rows;
}

export async function getLastEvolutionForParameter(
  userId: string,
  communityId: string,
  parameter: string
): Promise<Date | null> {
  const result = await query(
    `SELECT MAX(created_at) AS last_at
     FROM reputation.user_trust_evolution_log
     WHERE user_id = $1 AND community_id = $2 AND parameter = $3`,
    [userId, communityId, parameter]
  );
  return result.rows[0]?.last_at ?? null;
}

export async function getCommunityEvolutionConfig(
  communityId: string
): Promise<{ community_evolution_enabled: boolean; cross_community_prior: number }> {
  const result = await query(
    `SELECT community_evolution_enabled, cross_community_prior
     FROM communities.community_configs
     WHERE community_id = $1`,
    [communityId]
  );
  return result.rows[0] ?? { community_evolution_enabled: false, cross_community_prior: 0.50 };
}

export async function updateCommunityEvolutionConfig(
  communityId: string,
  patch: { community_evolution_enabled?: boolean; cross_community_prior?: number }
): Promise<void> {
  const columns = Object.keys(patch);
  const values = Object.values(patch);
  const setClauses = columns.map((col, i) => `${col} = $${i + 2}`).join(', ');
  await query(
    `UPDATE communities.community_configs SET ${setClauses} WHERE community_id = $1`,
    [communityId, ...values]
  );
}

export async function getEvolutionOptInRate(
  communityId: string
): Promise<{ opted_in: number; total: number }> {
  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE utc.evolution_enabled = true) AS opted_in,
       COUNT(cm.user_id) AS total
     FROM communities.members cm
     LEFT JOIN reputation.user_trust_configs utc
       ON utc.user_id = cm.user_id AND utc.community_id = cm.community_id
     WHERE cm.community_id = $1 AND cm.status = 'active'`,
    [communityId]
  );
  return {
    opted_in: parseInt(result.rows[0]?.opted_in ?? '0', 10),
    total: parseInt(result.rows[0]?.total ?? '0', 10),
  };
}

export async function getDiverseCommunityCount(
  userId: string,
  days = 30
): Promise<number> {
  const result = await query(
    `SELECT COUNT(DISTINCT community_id) AS community_count
     FROM reputation.karma_records
     WHERE user_id = $1
       AND reason IN ('Provided help', 'Received help')
       AND created_at >= NOW() - ($2 || ' days')::INTERVAL`,
    [userId, days]
  );
  return parseInt(result.rows[0]?.community_count ?? '0', 10);
}

export async function isCrossCommunityParticipant(
  fromUserId: string,
  communityId: string
): Promise<boolean> {
  const result = await query(
    `SELECT NOT EXISTS (
       SELECT 1 FROM communities.members
       WHERE user_id = $1 AND community_id = $2 AND status = 'active'
     ) AS is_cross_community`,
    [fromUserId, communityId]
  );
  return result.rows[0]?.is_cross_community ?? true;
}
```

- [ ] **Commit**

```bash
git add services/reputation-service/src/database/trustEvolutionDb.ts
git commit -m "feat(reputation): add trustEvolutionDb — all DB queries for evolution system"
```

---

## Task 5: Implement `trustEvolutionService.ts`

**Files:**
- Create: `services/reputation-service/src/services/trustEvolutionService.ts`

- [ ] **Create the file**

```typescript
// services/reputation-service/src/services/trustEvolutionService.ts
import {
  getUserTrustConfig,
  upsertUserTrustConfig,
  insertEvolutionLog,
  getLastEvolutionForParameter,
  getCommunityEvolutionConfig,
} from '../database/trustEvolutionDb';
import { getCommunityTrustConfig } from '../database/trustConfigDb';

export const EVOLUTION_SIGNALS = {
  CROSS_COMMUNITY_POSITIVE_FEEDBACK: 'cross_community_positive_feedback',
  CROSS_COMMUNITY_NEGATIVE_FEEDBACK: 'cross_community_negative_feedback',
  CROSS_COMMUNITY_MATCH_COMPLETED:   'cross_community_match_completed',
  REPEAT_INTERACTION_SAME_PERSON:    'repeat_interaction_same_person',
  DIVERSE_COMMUNITY_INTERACTIONS:    'diverse_community_interactions',
} as const;

// Parameter bounds — direction-agnostic; both ends are valid calibrations
const BOUNDS = {
  depth_weight:          { min: 0.10, max: 0.90 },
  breadth_weight:        { min: 0.10, max: 0.90 },
  cross_community_prior: { min: 0.05, max: 0.95 },
} as const;

type BoundedParam = keyof typeof BOUNDS;

// Each signal nudges specific parameters by a delta.
// Positive deltas calibrate upward; negative deltas calibrate downward.
// Neither direction is "better" — accuracy to experience is the goal.
const SIGNAL_NUDGES: Record<string, Array<{ parameter: BoundedParam; delta: number }>> = {
  cross_community_positive_feedback: [
    { parameter: 'cross_community_prior', delta: +0.02 },
    { parameter: 'breadth_weight',        delta: +0.01 },
  ],
  cross_community_negative_feedback: [
    { parameter: 'cross_community_prior', delta: -0.02 },
  ],
  cross_community_match_completed: [
    { parameter: 'cross_community_prior', delta: +0.01 },
  ],
  repeat_interaction_same_person: [
    { parameter: 'depth_weight',          delta: +0.01 },
  ],
  diverse_community_interactions: [
    { parameter: 'breadth_weight',        delta: +0.02 },
    { parameter: 'cross_community_prior', delta: +0.01 },
  ],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return parseFloat(value.toFixed(2));
}

/** Returns user's effective trust params: user overrides + community defaults for NULLs.
 *  This is the Sprint 32 integration point — feed/matching will call this. */
export async function getUserEffectiveParams(
  userId: string,
  communityId: string
): Promise<{ depth_weight: number; breadth_weight: number; cross_community_prior: number }> {
  const [userConfig, communityConfig] = await Promise.all([
    getUserTrustConfig(userId, communityId),
    getCommunityTrustConfig(communityId),
  ]);
  // NOTE: use communityConfig.depth_weight and communityConfig.breadth_weight —
  // the remapped field names that getCommunityTrustConfig returns.
  // Confirm against the actual interface in trustConfigDb.ts after Task 2.
  return {
    depth_weight:          userConfig?.depth_weight          ?? communityConfig.depth_weight,
    breadth_weight:        userConfig?.breadth_weight        ?? communityConfig.breadth_weight,
    cross_community_prior: userConfig?.cross_community_prior ?? 0.50,
  };
}

/** All three gates must pass for a nudge to apply. */
export async function isEvolutionEligible(
  userId: string,
  communityId: string,
  parameter: string,
  cooldownDays = 7
): Promise<boolean> {
  const [communityEvolution, userConfig, lastEvolution] = await Promise.all([
    getCommunityEvolutionConfig(communityId),
    getUserTrustConfig(userId, communityId),
    getLastEvolutionForParameter(userId, communityId, parameter),
  ]);
  if (!communityEvolution.community_evolution_enabled) return false;
  if (!userConfig?.evolution_enabled) return false;
  if (lastEvolution) {
    const daysSince = (Date.now() - lastEvolution.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < cooldownDays) return false;
  }
  return true;
}

/** Evaluate whether a signal should nudge a user's trust parameters.
 *  Applies all eligible nudges, clamps to bounds, and logs each adjustment. */
export async function evaluateUserEvolution(
  userId: string,
  communityId: string,
  signal: string,
  context: { triggerEventId?: string } = {}
): Promise<void> {
  const nudges = SIGNAL_NUDGES[signal];
  if (!nudges) return;

  const effectiveParams = await getUserEffectiveParams(userId, communityId);

  for (const { parameter, delta } of nudges) {
    const eligible = await isEvolutionEligible(userId, communityId, parameter);
    if (!eligible) continue;

    const currentValue = effectiveParams[parameter];
    const { min, max } = BOUNDS[parameter];
    const newValue = round2(clamp(currentValue + delta, min, max));

    if (newValue === currentValue) continue; // already at bound, no change

    await upsertUserTrustConfig(userId, communityId, { [parameter]: newValue });
    await insertEvolutionLog({
      user_id:          userId,
      community_id:     communityId,
      parameter,
      old_value:        currentValue,
      new_value:        newValue,
      trigger_signal:   signal,
      trigger_event_id: context.triggerEventId,
    });
  }
}
```

- [ ] **Run the unit tests — they should now pass**

```bash
npm run test:unit -- --testPathPattern=trustEvolutionService
# Expected: all tests PASS
```

- [ ] **Run full test suite to confirm no regression**

```bash
npm test
# Expected: all existing tests still pass
```

- [ ] **Commit**

```bash
git add services/reputation-service/src/services/trustEvolutionService.ts
git commit -m "feat(reputation): implement trustEvolutionService — evolution engine with signal nudges"
```

---

## Task 6: Wire evolution into event subscriber

**Files:**
- Modify: `services/reputation-service/src/events/subscriber.ts`

- [ ] **Read `subscriber.ts`** — understand the existing `match_completed` handler payload shape before adding to it.

- [ ] **Add imports at the top of `subscriber.ts`**

```typescript
import {
  evaluateUserEvolution,
  EVOLUTION_SIGNALS,
} from '../services/trustEvolutionService';
import {
  isCrossCommunityParticipant,
  getDiverseCommunityCount,
} from '../database/trustEvolutionDb';
```

- [ ] **Add helper to count repeat matches** — add this private helper function near the top of subscriber.ts (after imports), or create a small inline query. Read how `trustMetricsDb.ts` counts repeat pairs and use the same `query` import:

```typescript
async function getRepeatMatchCount(userA: string, userB: string): Promise<number> {
  const result = await query(
    `SELECT COUNT(*) AS cnt FROM requests.matches
     WHERE status = 'completed'
       AND ((responder_id = $1 AND requester_id = $2)
            OR (responder_id = $2 AND requester_id = $1))`,
    [userA, userB]
  );
  return parseInt(result.rows[0]?.cnt ?? '0', 10);
}
```

> **Note:** Read `requests.matches` schema in init.sql first to confirm column names (`responder_id`, `requester_id`, `status`).

- [ ] **Read the `match_completed` handler in `subscriber.ts`** — understand how it iterates communities. The `match_completed` payload does NOT include `community_id`. The existing handler calls something like `awardKarmaForCompletedMatch` which internally iterates the shared communities between both parties. You must add evolution calls inside that same community loop, not outside it.

- [ ] **Add evolution calls inside the per-community loop** in the `match_completed` handler (after existing karma/badge logic for that community, inside the same community iteration):

```typescript
// Sprint 30: Trust evolution signals — added inside the per-community loop
// (community_id is from the loop variable, not the event payload)
try {
  const isCrossComm = await isCrossCommunityParticipant(requester_id, communityId);
  if (isCrossComm) {
    await evaluateUserEvolution(
      responder_id, communityId,
      EVOLUTION_SIGNALS.CROSS_COMMUNITY_MATCH_COMPLETED,
      { triggerEventId: match_id }
    );
  }
  // Repeat pair signal — checked once per match, community-scoped
  const repeatCount = await getRepeatMatchCount(responder_id, requester_id);
  if (repeatCount >= 3) {
    await evaluateUserEvolution(
      responder_id, communityId,
      EVOLUTION_SIGNALS.REPEAT_INTERACTION_SAME_PERSON,
      { triggerEventId: match_id }
    );
  }
  // Diverse communities signal — counts across all communities
  const diverseCount = await getDiverseCommunityCount(responder_id, 30);
  if (diverseCount >= 3) {
    await evaluateUserEvolution(
      responder_id, communityId,
      EVOLUTION_SIGNALS.DIVERSE_COMMUNITY_INTERACTIONS,
      { triggerEventId: match_id }
    );
  }
} catch (evolutionErr) {
  console.error('[trust-evolution] Error evaluating evolution signals:', evolutionErr);
  // Never rethrow — evolution errors must not fail match_completed processing
}
```

> **Note:** The exact loop variable name (e.g., `communityId`, `community.id`, `comm_id`) depends on how `subscriber.ts` currently iterates communities. Read the existing handler before implementing — use the same variable name it already uses.

- [ ] **Type check**

```bash
cd services/reputation-service && npx tsc --noEmit
# Expected: 0 errors
```

- [ ] **Commit**

```bash
git add services/reputation-service/src/events/subscriber.ts
git commit -m "feat(reputation): wire trust evolution signals into match_completed handler"
```

---

## Task 7: Wire inline feedback evolution + add 5 API routes

**Files:**
- Modify: `services/reputation-service/src/routes/reputation.ts`

- [ ] **Read `reputation.ts`** — find the `POST /reputation/feedback` handler to understand its structure. Add evolution calls inline after `updateTrustScore()`.

- [ ] **Add imports at top of `reputation.ts`**

```typescript
import {
  evaluateUserEvolution,
  getUserEffectiveParams,
  EVOLUTION_SIGNALS,
} from '../services/trustEvolutionService';
import {
  getUserTrustConfig,
  upsertUserTrustConfig,
  getEvolutionLog,
  getCommunityEvolutionConfig,
  updateCommunityEvolutionConfig,
  getEvolutionOptInRate,
  isCrossCommunityParticipant,
} from '../database/trustEvolutionDb';
```

- [ ] **Inside the `POST /reputation/feedback` handler**, after the `updateTrustScore()` call, add:

```typescript
// Sprint 30: Evolution signal for cross-community feedback
try {
  const crossComm = await isCrossCommunityParticipant(from_user_id, community_id);
  if (crossComm && (rating >= 4 || rating <= 2)) {
    const signal = rating >= 4
      ? EVOLUTION_SIGNALS.CROSS_COMMUNITY_POSITIVE_FEEDBACK
      : EVOLUTION_SIGNALS.CROSS_COMMUNITY_NEGATIVE_FEEDBACK;
    // Use match_id as triggerEventId — insertFeedback returns void (no feedback row ID)
    await evaluateUserEvolution(to_user_id, community_id, signal, { triggerEventId: match_id });
  }
} catch (evolutionErr) {
  console.error('[trust-evolution] Error in feedback evolution:', evolutionErr);
}
```

> Read the feedback handler to confirm the exact variable names for `from_user_id`, `to_user_id`, `community_id`, `rating`, and `match_id`. The variable names above are typical — confirm before implementing. Do NOT use `feedback_id` — `insertFeedback` returns `void`.

- [ ] **Add the 5 new route handlers** to `reputation.ts`. Add them before the existing catch-all/404 handler:

```typescript
// ─── Trust Evolution Routes (Sprint 30) ───────────────────────────────────────

// GET /reputation/trust-config/:userId/:communityId
// Auth: self OR community admin
router.get('/trust-config/:userId/:communityId', authMiddleware, async (req, res) => {
  try {
    const { userId, communityId } = req.params;
    const memberships = req.user?.communities ?? [];
    const isSelf = req.user?.userId === userId;
    const isAdmin = req.user?.role === 'admin' ||
      memberships.some((m: any) => m.id === communityId && m.role === 'admin');
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const [userConfig, effectiveParams, communityEvolution] = await Promise.all([
      getUserTrustConfig(userId, communityId),
      getUserEffectiveParams(userId, communityId),
      getCommunityEvolutionConfig(communityId),
    ]);
    return res.json({
      success: true,
      data: {
        user_config: userConfig,
        effective_params: effectiveParams,
        community_evolution_enabled: communityEvolution.community_evolution_enabled,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /reputation/trust-config/:userId/:communityId
// Auth: self only
router.put('/trust-config/:userId/:communityId', authMiddleware, async (req, res) => {
  try {
    const { userId, communityId } = req.params;
    if (req.user?.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const { evolution_enabled } = req.body;
    if (typeof evolution_enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'evolution_enabled must be a boolean' });
    }
    await upsertUserTrustConfig(userId, communityId, { evolution_enabled });
    return res.json({ success: true, data: { evolution_enabled } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /reputation/trust-config/:userId/:communityId/history
// Auth: self OR community admin
router.get('/trust-config/:userId/:communityId/history', authMiddleware, async (req, res) => {
  try {
    const { userId, communityId } = req.params;
    const memberships = req.user?.communities ?? [];
    const isSelf = req.user?.userId === userId;
    const isAdmin = req.user?.role === 'admin' ||
      memberships.some((m: any) => m.id === communityId && m.role === 'admin');
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 100);
    const offset = parseInt(req.query.offset as string || '0', 10);
    const history = await getEvolutionLog(userId, communityId, limit, offset);
    return res.json({ success: true, data: history });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /reputation/communities/:communityId/trust-evolution
// Auth: community admin only
router.get('/communities/:communityId/trust-evolution', authMiddleware, async (req, res) => {
  try {
    const { communityId } = req.params;
    const memberships = req.user?.communities ?? [];
    const isAdmin = req.user?.role === 'admin' ||
      memberships.some((m: any) => m.id === communityId && m.role === 'admin');
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const [config, optInRate] = await Promise.all([
      getCommunityEvolutionConfig(communityId),
      getEvolutionOptInRate(communityId),
    ]);
    return res.json({
      success: true,
      data: { ...config, opted_in_rate: optInRate },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /reputation/communities/:communityId/trust-evolution
// Auth: community admin only
router.put('/communities/:communityId/trust-evolution', authMiddleware, async (req, res) => {
  try {
    const { communityId } = req.params;
    const memberships = req.user?.communities ?? [];
    const isAdmin = req.user?.role === 'admin' ||
      memberships.some((m: any) => m.id === communityId && m.role === 'admin');
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const { community_evolution_enabled, cross_community_prior } = req.body;
    const patch: Record<string, unknown> = {};
    if (typeof community_evolution_enabled === 'boolean') patch.community_evolution_enabled = community_evolution_enabled;
    if (typeof cross_community_prior === 'number') {
      if (cross_community_prior < 0.05 || cross_community_prior > 0.95) {
        return res.status(400).json({ success: false, message: 'cross_community_prior must be between 0.05 and 0.95' });
      }
      patch.cross_community_prior = cross_community_prior;
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }
    await updateCommunityEvolutionConfig(communityId, patch as any);
    return res.json({ success: true, data: patch });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
```

- [ ] **Type check**

```bash
cd services/reputation-service && npx tsc --noEmit
# Expected: 0 errors
```

- [ ] **Run tests**

```bash
npm test
# Expected: all pass
```

- [ ] **Commit**

```bash
git add services/reputation-service/src/routes/reputation.ts
git commit -m "feat(reputation): add 5 trust evolution API routes + inline feedback evolution signal"
```

---

## Task 8: Frontend API methods + evolution toggle on trust page

**Files:**
- Modify: `apps/frontend/src/lib/api.ts`
- Modify: `apps/frontend/src/pages/reputation/trust.tsx`

- [ ] **Read `apps/frontend/src/lib/api.ts`** — find the `reputationService` object and follow its exact pattern (literal object, `reputationApi.get/put` calls).

- [ ] **Add 5 new methods to `reputationService` in `api.ts`**

```typescript
// Trust Evolution (Sprint 30)
getTrustConfig: (userId: string, communityId: string) =>
  reputationApi.get(`/reputation/trust-config/${userId}/${communityId}`),

updateTrustConfig: (userId: string, communityId: string, data: { evolution_enabled: boolean }) =>
  reputationApi.put(`/reputation/trust-config/${userId}/${communityId}`, data),

getTrustEvolutionHistory: (userId: string, communityId: string, params?: { limit?: number; offset?: number }) =>
  reputationApi.get(`/reputation/trust-config/${userId}/${communityId}/history`, { params }),

getCommunityEvolutionStatus: (communityId: string) =>
  reputationApi.get(`/reputation/communities/${communityId}/trust-evolution`),

updateCommunityEvolution: (communityId: string, data: { community_evolution_enabled?: boolean; cross_community_prior?: number }) =>
  reputationApi.put(`/reputation/communities/${communityId}/trust-evolution`, data),
```

- [ ] **Read `apps/frontend/src/pages/reputation/trust.tsx`** — understand the existing structure (how communities are rendered, where to add the new section).

- [ ] **Add the Trust Model Evolution section** to `trust.tsx` — add below the existing community trust breakdown. Find where `communities` are mapped and after that map, add a second section:

```tsx
{/* Trust Model Evolution */}
<div className="mt-8">
  <h2 className="text-xl font-semibold mb-4">Trust Model Evolution</h2>
  <p className="text-gray-600 text-sm mb-4">
    When enabled, your trust model calibrates automatically based on your experiences.
    The goal is accuracy — not a particular direction.
  </p>
  {communities.map((community) => (
    <TrustEvolutionToggle
      key={community.id}
      community={community}
      userId={user.id}
    />
  ))}
</div>
```

- [ ] **Create inline `TrustEvolutionToggle` component in the same file** (or as a sibling file if the file is already large — read it first):

```tsx
function TrustEvolutionToggle({ community, userId }: { community: any; userId: string }) {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reputationService.getTrustConfig(userId, community.id)
      .then((res: any) => setConfig(res.data))
      .catch(() => {}) // Community may not have config yet
      .finally(() => setLoading(false));
  }, [userId, community.id]);

  const handleToggle = async () => {
    const newValue = !config?.user_config?.evolution_enabled;
    setConfig((prev: any) => ({
      ...prev,
      user_config: { ...(prev?.user_config ?? {}), evolution_enabled: newValue },
    })); // optimistic
    try {
      await reputationService.updateTrustConfig(userId, community.id, { evolution_enabled: newValue });
    } catch {
      // revert on failure
      setConfig((prev: any) => ({
        ...prev,
        user_config: { ...(prev?.user_config ?? {}), evolution_enabled: !newValue },
      }));
    }
  };

  if (loading) return <div className="text-sm text-gray-400 py-2">Loading {community.name}…</div>;

  const evolutionEnabled = config?.user_config?.evolution_enabled ?? false;
  const communityEvolutionEnabled = config?.community_evolution_enabled ?? false;

  return (
    <div className="border rounded-lg p-4 mb-3">
      <div className="flex justify-between items-center">
        <div>
          <div className="font-medium">{community.name}</div>
          {!communityEvolutionEnabled && (
            <div className="text-xs text-gray-400 mt-1">
              Your community hasn&apos;t enabled trust evolution yet.
            </div>
          )}
          {communityEvolutionEnabled && config?.effective_params && (
            <div className="text-xs text-gray-500 mt-1">
              Cross-community trust calibration:{' '}
              {(config.effective_params.cross_community_prior * 100).toFixed(0)}
            </div>
          )}
        </div>
        <button
          onClick={handleToggle}
          disabled={!communityEvolutionEnabled}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            evolutionEnabled
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-600'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {evolutionEnabled ? 'Evolution On' : 'Evolution Off'}
        </button>
      </div>
      {evolutionEnabled && (
        <div className="mt-2 text-right">
          <a
            href={`/reputation/evolution?communityId=${community.id}`}
            className="text-xs text-blue-600 hover:underline"
          >
            View my trust journey →
          </a>
        </div>
      )}
    </div>
  );
}
```

> **Note:** Confirm where `reputationService` is imported from in `trust.tsx` and use the same import. Confirm how `user.id` and `communities` are available — read the existing component.

- [ ] **Type check**

```bash
cd apps/frontend && npx tsc --noEmit
# Expected: 0 errors
```

- [ ] **Commit**

```bash
git add apps/frontend/src/lib/api.ts apps/frontend/src/pages/reputation/trust.tsx
git commit -m "feat(frontend): add trust evolution toggle to reputation/trust page"
```

---

## Task 9: "My Trust Journey" page

**Files:**
- Create: `apps/frontend/src/pages/reputation/evolution.tsx`

- [ ] **Create the page**

```tsx
// apps/frontend/src/pages/reputation/evolution.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { reputationService } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth'; // confirm import from existing hook

const PARAMETER_LABELS: Record<string, string> = {
  cross_community_prior: 'Cross-Community Trust',
  depth_weight:          'Depth of Relationships',
  breadth_weight:        'Breadth of Connections',
};

const SIGNAL_LABELS: Record<string, string> = {
  cross_community_positive_feedback: 'You received positive feedback from a cross-community exchange',
  cross_community_negative_feedback: 'You received difficult feedback from a cross-community exchange',
  cross_community_match_completed:   'You completed a cross-community exchange',
  repeat_interaction_same_person:    'You\'ve exchanged with the same person 3+ times',
  diverse_community_interactions:    'You helped people across 3+ communities this month',
};

export default function TrustEvolutionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const communityId = router.query.communityId as string;
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !communityId) return;
    reputationService.getTrustEvolutionHistory(user.id, communityId, { limit: 50 })
      .then((res: any) => setHistory(res.data ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [user?.id, communityId]);

  if (!communityId) return <div className="p-6">No community selected.</div>;
  if (loading) return <div className="p-6">Loading your trust journey…</div>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">My Trust Journey</h1>
      <p className="text-gray-500 text-sm mb-6">
        How your trust model has calibrated based on experience.
        Each event reflects something real — in either direction.
      </p>

      {history.length === 0 ? (
        <div className="text-gray-400 text-sm border rounded-lg p-8 text-center">
          No evolution events yet.
          Turn on evolution and start making connections.
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((entry) => (
            <div key={entry.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-sm">
                    {PARAMETER_LABELS[entry.parameter] ?? entry.parameter}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {SIGNAL_LABELS[entry.trigger_signal] ?? entry.trigger_signal}
                  </div>
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <span className="text-sm font-mono">
                    {entry.old_value ?? '—'} → {entry.new_value}
                  </span>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <a href="/reputation/trust" className="text-sm text-blue-600 hover:underline">
          ← Back to trust overview
        </a>
      </div>
    </div>
  );
}
```

> **Note:** Confirm how `useAuth` is imported from existing pages. Read any existing page in `apps/frontend/src/pages/reputation/` that uses the same hook.

- [ ] **Type check**

```bash
cd apps/frontend && npx tsc --noEmit
# Expected: 0 errors
```

- [ ] **Commit**

```bash
git add apps/frontend/src/pages/reputation/evolution.tsx
git commit -m "feat(frontend): add My Trust Journey evolution timeline page"
```

---

## Task 10: Community admin trust evolution section

**Files:**
- Modify: `apps/frontend/src/pages/communities/[id].tsx`

- [ ] **Read `apps/frontend/src/pages/communities/[id].tsx`** — find the admin-gated Settings tab. Look for the pattern used for other admin config toggles.

- [ ] **Add the Trust Evolution admin section** inside the admin-gated Settings tab:

```tsx
{/* Trust Evolution — admin only */}
{isAdmin && (
  <CommunityTrustEvolutionSection communityId={community.id} />
)}
```

- [ ] **Create the `CommunityTrustEvolutionSection` component** (inline or sibling file):

```tsx
function CommunityTrustEvolutionSection({ communityId }: { communityId: string }) {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reputationService.getCommunityEvolutionStatus(communityId)
      .then((res: any) => setStatus(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [communityId]);

  const handleToggle = async () => {
    const newValue = !status?.community_evolution_enabled;
    setStatus((prev: any) => ({ ...prev, community_evolution_enabled: newValue }));
    try {
      await reputationService.updateCommunityEvolution(communityId, { community_evolution_enabled: newValue });
    } catch {
      setStatus((prev: any) => ({ ...prev, community_evolution_enabled: !newValue }));
    }
  };

  if (loading) return <div className="text-sm text-gray-400">Loading evolution settings…</div>;

  const { community_evolution_enabled, cross_community_prior, opted_in_rate } = status ?? {};

  return (
    <div className="border rounded-lg p-4 mt-4">
      <h3 className="font-semibold mb-2">Trust Model Evolution</h3>
      <p className="text-sm text-gray-500 mb-3">
        When enabled, members who opt in have their trust parameters calibrate automatically based on experience.
        The system aims for accuracy — not a particular direction.
      </p>
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm">Community Trust Evolution</span>
        <button
          onClick={handleToggle}
          className={`px-3 py-1 rounded text-sm font-medium ${
            community_evolution_enabled ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
          }`}
        >
          {community_evolution_enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>
      {opted_in_rate && (
        <div className="text-xs text-gray-500">
          {opted_in_rate.opted_in} of {opted_in_rate.total} members have enabled personal evolution
        </div>
      )}
      {cross_community_prior !== undefined && (
        <div className="text-xs text-gray-500 mt-1">
          Community cross-community trust calibration: {(cross_community_prior * 100).toFixed(0)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Type check**

```bash
cd apps/frontend && npx tsc --noEmit
# Expected: 0 errors
```

- [ ] **Commit**

```bash
git add apps/frontend/src/pages/communities/[id].tsx
git commit -m "feat(frontend): add community trust evolution admin section"
```

---

## Task 11: ADR and landing page documentation

**Files:**
- Create: `docs/adr/ADR-046-trust-model-evolution.md`
- Create: `apps/landing/src/data/docs/concepts/trust-model-evolution.json`
- Create: `apps/landing/src/data/docs/concepts/adr-046-trust-model-evolution.json`
- Modify: `apps/landing/src/data/docs/nav.json`
- Modify: `apps/landing/src/data/docs/concepts/trust-and-karma.json`
- Modify: `apps/landing/src/data/docs/guides/community-trust-model.json`

- [ ] **Create `docs/adr/ADR-046-trust-model-evolution.md`**

```markdown
# ADR-046: Trust Model Evolution

**Status**: Accepted
**Date**: 2026-03-19
**Deciders**: Platform team
**Relates to**: ADR-037 (Multi-Signal Trust Score), ADR-040 (Community Trust Score), ADR-043 (Three-Score Model)

## Context

Trust parameters (depth/breadth weights, carry factor, decay) are currently configured once at community setup and remain static. This means users with consistently positive cross-community experiences have no way to reflect that in their trust model. Communities whose actual behavior diverges from their initial config drift silently.

## Decision

Introduce a bidirectional trust evolution system with three layers:

1. **Sprint 30 — Individual layer**: per-user trust config table (`reputation.user_trust_configs`) with opt-in auto-evolution. Five behavioral signals nudge parameters. An audit log (`reputation.user_trust_evolution_log`) tracks every adjustment.

2. **Sprint 31 — Community evolution**: aggregate individual signals to drive community-level config drift.

3. **Sprint 32 — Fractal feed interface**: feed and request ranking use blended `(user_personal, community, blend_factor)` weights.

## Core Principle

**Accuracy over direction.** The system calibrates toward what is real for this user or community. High cross-community trust is not better than low cross-community trust. An accurate low-trust model is healthier than an inaccurate high-trust model. Trust grows on honest foundations.

## New Parameter: `cross_community_prior`

A Bayesian prior (0.05–0.95, default 0.50) representing the starting trust assumption for people from other communities, before interaction history exists. Distinct from depth/breadth weights (which measure interaction patterns). Calibrates based on actual experience, in either direction.

## Known Limitations (Sprint 30)

- `getUserEffectiveParams()` exists but is not yet wired into `updateTrustScore()` — individual parameters don't yet affect displayed scores. Wired in Sprint 32.
- Cross-community membership check uses current membership, not historical. A user who left a community after submitting feedback will be classified as cross-community. Acceptable approximation for Sprint 30.
- 7-day cooldown is application-level, not DB-level. Duplicate nudges during concurrent events are bounded-harmless (clamped to same value at bound).

## Evolution Signals

| Signal | Code path | What it calibrates |
|--------|-----------|-------------------|
| `cross_community_positive_feedback` | Inline, `POST /feedback` | `cross_community_prior` +0.02, `breadth_weight` +0.01 |
| `cross_community_negative_feedback` | Inline, `POST /feedback` | `cross_community_prior` −0.02 |
| `cross_community_match_completed` | `match_completed` event | `cross_community_prior` +0.01 |
| `repeat_interaction_same_person` | `match_completed` event | `depth_weight` +0.01 |
| `diverse_community_interactions` | `match_completed` event | `breadth_weight` +0.02, `cross_community_prior` +0.01 |
```

- [ ] **Create `apps/landing/src/data/docs/concepts/trust-model-evolution.json`**

Read `apps/landing/src/data/docs/concepts/network-cohesion.json` to understand the exact JSON format (`slug`, `title`, `description`, `content` fields).

```json
{
  "slug": "trust-model-evolution",
  "title": "A Trust Model That Reflects Reality",
  "description": "How Karmyq's trust parameters calibrate based on lived experience — in either direction.",
  "content": "# A Trust Model That Reflects Reality\n\nKarmyq's trust model has always been configurable per community. But trust isn't static — people change, communities learn, and a model that stays frozen at its initial settings drifts away from reality.\n\n## The Core Principle\n\nThe trust evolution system calibrates toward accuracy, not toward any particular value. Higher cross-community trust is not better than lower cross-community trust. The correct model is the one that reflects what's real.\n\nAn accurate low-trust model is healthier than an inaccurate high-trust model. Trust grows on honest foundations.\n\n## What Evolves\n\nThree parameters can calibrate over time:\n\n- **Depth weight** — how much repeat interactions with the same people contribute to your trust score\n- **Breadth weight** — how much diverse interactions across many people contribute\n- **Cross-community prior** — your starting trust assumption for people from other communities, before you have any shared history\n\nThe third is new. It's a Bayesian prior: the system's best guess about how you'll relate to a stranger from another community, based on your history with strangers from other communities.\n\n## How It Calibrates\n\nFive behavioral signals nudge parameters based on what actually happens:\n\n- Positive cross-community feedback → cross-community prior calibrates upward\n- Difficult cross-community feedback → cross-community prior calibrates downward\n- Completed cross-community exchange → slight upward calibration\n- Repeated help with same person → depth weight increases\n- Help spread across 3+ communities in a month → breadth weight increases\n\nCalibration is gradual — small steps, no rapid swings. Each parameter has a 7-day cooldown to prevent volatility.\n\n## Opt-In\n\nEvolution is disabled by default. Two switches must both be on:\n\n1. The community admin enables trust evolution for the community\n2. The individual member enables evolution for themselves\n\nBoth can be turned off at any time. Evolution history remains visible even when evolution is paused.\n\n## Your Trust Journey\n\nEvery parameter adjustment is logged. You can view your full calibration history: what changed, what caused it, and by how much. The goal is transparency — your trust model should make sense to you, not feel like a black box.\n\n## What Comes Next\n\nIn a future sprint, your calibrated model will influence what you see in your feed and how your requests are matched. The platform's behavior will emerge from the intersection of your personal model and your community's model — a fractal of the same trust mechanics operating at two scales simultaneously."
}
```

- [ ] **Create `apps/landing/src/data/docs/concepts/adr-046-trust-model-evolution.json`**

Read `apps/landing/src/data/docs/concepts/adr-045-network-cohesion-score.json` to confirm the exact format (`slug`, `number`, `title`, `status`, `description`, `content`, `filename`).

```json
{
  "slug": "adr-046-trust-model-evolution",
  "number": "046",
  "title": "ADR-046: Trust Model Evolution",
  "status": "accepted",
  "description": "**Status**: Accepted",
  "content": "# ADR-046: Trust Model Evolution\n\n**Status**: Accepted\n**Date**: 2026-03-19\n\n## Context\n\nTrust parameters are currently static after community setup. Users with consistently positive cross-community experiences have no way to reflect that in their trust model.\n\n## Decision\n\nIntroduce a bidirectional trust evolution system. Individual users can opt in to automatic parameter calibration. Community admins can enable community-level evolution. Feed and request ranking will eventually blend both models.\n\n## Core Principle\n\nAccuracy over direction. The system calibrates toward reality — not toward more or less openness. An accurate low-trust model is healthier than an inaccurate high-trust model.\n\n## New Concept: `cross_community_prior`\n\nA Bayesian prior (0.05–0.95) representing the starting trust assumption for cross-community members before interaction history exists. Calibrates in either direction based on experience.\n\n## Known Limitations\n\n- Individual parameters don't yet affect displayed scores (wired in Sprint 32)\n- Cross-community membership check uses current, not historical, membership",
  "filename": "ADR-046-trust-model-evolution.md"
}
```

- [ ] **Update `apps/landing/src/data/docs/nav.json`** — add two entries. Read the file first to find the right sections:
  - Under "How It Works" concepts: add `{ "label": "Trust Model Evolution", "href": "/docs/concepts/trust-model-evolution" }`
  - Under "Architecture Decisions": add `{ "label": "ADR-046: Trust Model Evolution", "href": "/docs/concepts/adr-046-trust-model-evolution" }`

- [ ] **Update `apps/landing/src/data/docs/concepts/trust-and-karma.json`** — read the file, then add at the end of the `content` field:

```
\n\n## Living Trust Models\n\nTrust parameters are initial values, not permanent settings. Members can opt in to automatic calibration — their model adjusts gradually based on what actually happens in their exchanges. The goal is accuracy: a model that reflects lived experience, in whatever direction that experience points.
```

- [ ] **Update `apps/landing/src/data/docs/guides/community-trust-model.json`** — read the file, then add a new section at the end of `content`:

```
\n\n## Trust Model Evolution\n\nCommunities can enable automatic trust evolution in the Settings tab. When enabled, members who opt in will have their personal trust parameters calibrate based on experience. As an admin, you'll see the opt-in rate and your community's current cross-community trust calibration. You can disable evolution at any time — the history remains visible.
```

- [ ] **Verify landing page TypeScript builds**

```bash
cd apps/landing && npm run build
# Expected: 0 errors, build succeeds
```

- [ ] **Commit**

```bash
git add docs/adr/ADR-046-trust-model-evolution.md \
        apps/landing/src/data/docs/concepts/trust-model-evolution.json \
        apps/landing/src/data/docs/concepts/adr-046-trust-model-evolution.json \
        apps/landing/src/data/docs/nav.json \
        apps/landing/src/data/docs/concepts/trust-and-karma.json \
        apps/landing/src/data/docs/guides/community-trust-model.json
git commit -m "docs: add ADR-046, trust evolution concept page, landing nav entries"
```

---

## Task 12: Service docs + registry + TDD integration test

**Files:**
- Modify: `services/reputation-service/CONTEXT.md`
- Modify: `services/registry.json`
- Create: `tests/tdd/trust-evolution-flow.test.ts`

- [ ] **Update `services/reputation-service/CONTEXT.md`**

Add to "API Endpoints" section:
```
GET  /reputation/trust-config/:userId/:communityId      — User trust config + effective params
PUT  /reputation/trust-config/:userId/:communityId      — Toggle evolution_enabled
GET  /reputation/trust-config/:userId/:communityId/history — Evolution history log
GET  /reputation/communities/:communityId/trust-evolution  — Community evolution status (admin)
PUT  /reputation/communities/:communityId/trust-evolution  — Toggle community evolution (admin)
```

Add to "Database Schema" section:
```
reputation.user_trust_configs — Per-user trust parameters (depth_weight, breadth_weight, cross_community_prior, evolution_enabled)
reputation.user_trust_evolution_log — Immutable log of every parameter adjustment with trigger signal and event ID
communities.community_configs — Added: community_evolution_enabled, cross_community_prior
```

- [ ] **Update `services/registry.json`** — add 5 new endpoints to reputation-service `apis.provides` array (as plain strings, following the existing format):

```json
"GET /reputation/trust-config/:userId/:communityId",
"PUT /reputation/trust-config/:userId/:communityId",
"GET /reputation/trust-config/:userId/:communityId/history",
"GET /reputation/communities/:communityId/trust-evolution",
"PUT /reputation/communities/:communityId/trust-evolution"
```

- [ ] **Create TDD integration test** (allowed to fail without live services):

```typescript
// tests/tdd/trust-evolution-flow.test.ts
// Integration test — requires live reputation-service and database.
// Can fail without live services. Will be promoted to regression once services are stable.

import axios from 'axios';

const BASE = process.env.REPUTATION_URL || 'http://localhost:3004';
const TEST_TOKEN = process.env.TEST_JWT_TOKEN || '';

describe('Trust Evolution — Integration Flow', () => {
  const TEST_USER_ID = process.env.TEST_USER_ID || '';
  const TEST_COMMUNITY_ID = process.env.TEST_COMMUNITY_ID || '';

  it('can enable evolution for a user', async () => {
    const res = await axios.put(
      `${BASE}/reputation/trust-config/${TEST_USER_ID}/${TEST_COMMUNITY_ID}`,
      { evolution_enabled: true },
      { headers: { Authorization: `Bearer ${TEST_TOKEN}` } }
    );
    expect(res.data.success).toBe(true);
    expect(res.data.data.evolution_enabled).toBe(true);
  });

  it('can read user trust config', async () => {
    const res = await axios.get(
      `${BASE}/reputation/trust-config/${TEST_USER_ID}/${TEST_COMMUNITY_ID}`,
      { headers: { Authorization: `Bearer ${TEST_TOKEN}` } }
    );
    expect(res.data.success).toBe(true);
    expect(res.data.data).toHaveProperty('effective_params');
    expect(res.data.data.effective_params).toHaveProperty('cross_community_prior');
  });

  it('evolution log starts empty for new user', async () => {
    const res = await axios.get(
      `${BASE}/reputation/trust-config/${TEST_USER_ID}/${TEST_COMMUNITY_ID}/history`,
      { headers: { Authorization: `Bearer ${TEST_TOKEN}` } }
    );
    expect(res.data.success).toBe(true);
    expect(Array.isArray(res.data.data)).toBe(true);
  });
});
```

- [ ] **Run full test suite + feedback check**

```bash
npm test                   # unit + regression — must all pass
npm run test:tdd           # TDD tests — may fail without live services (OK)
npm run feedback:check     # all docs complete
npm run analyze:services   # no circular deps
```

- [ ] **Commit**

```bash
git add services/reputation-service/CONTEXT.md \
        services/registry.json \
        tests/tdd/trust-evolution-flow.test.ts
git commit -m "docs: update CONTEXT.md, registry.json; add TDD integration test"
```

---

## Task 13: Final type check + pre-push verification

- [ ] **Full monorepo type check**

```bash
npm run build
# Expected: all 27 turbo tasks pass
```

- [ ] **Full test suite**

```bash
npm test
# Expected: all unit + regression pass
```

- [ ] **Feedback loop check**

```bash
npm run feedback:check
# Expected: passes
```

- [ ] **Update handoff** — open `.claude/handoff/CURRENT_HANDOFF.md` and mark Sprint 30 as complete. Add Sprint 31 (Community Evolution Engine) as the next sprint. Document the migration file that must be applied manually on the demo server.

- [ ] **Final commit if anything changed**

```bash
git add .claude/handoff/CURRENT_HANDOFF.md
git commit -m "docs: update handoff — Sprint 30 complete, Sprint 31 ready"
```

- [ ] **Push**

```bash
git push origin feature/sprint-30-trust-evolution
```

---

## Verification Checklist

```bash
# 1. New tables exist on demo after migration applied
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -c "\d reputation.user_trust_configs"

# 2. No regression in existing tests
npm test

# 3. Evolution toggle works end-to-end
# PUT /reputation/trust-config/:userId/:communityId { evolution_enabled: true }
# → GET same endpoint → user_config.evolution_enabled === true

# 4. /reputation/evolution?communityId=... renders timeline (empty for new users)

# 5. Admin trust evolution section visible in community settings

# 6. Landing page builds
cd apps/landing && npm run build
```

---

## Note on `getUserEffectiveParams` and Sprint 32

`getUserEffectiveParams()` is intentionally NOT wired into `updateTrustScore()` in this sprint. The evolution log will fill with parameter adjustments, but they won't yet affect displayed trust scores.

**UI must communicate this clearly** with text like: *"Your trust model is calibrating. It will influence your experience in a future update."* This language is already included in the evolution toggle section above.

Sprint 32 wires `getUserEffectiveParams` into feed ranking and match scoring.
