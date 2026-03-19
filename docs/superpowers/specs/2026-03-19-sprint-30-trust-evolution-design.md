# Sprint 30: Trust Evolution Foundation — Design Spec

**Date**: 2026-03-19
**Status**: Approved
**Version**: v9.5.0 → v10.0.0
**Sprint Branch**: `feature/sprint-30-trust-evolution`

---

## Overview

Karmyq's trust model is currently static after community setup. Every user in a community is evaluated using the same formula parameters, regardless of their actual experiences. This sprint introduces the **Individual Trust Layer** — the first phase of a three-sprint arc that will ultimately allow both people and communities to have living, experience-calibrated trust models.

### Core Principle: Accuracy Over Direction

The evolution system is **direction-agnostic**. The system does not assume that more cross-community trust is better, or that less is better. It assumes that an *accurate* model is better. A community whose cross-community experiences are genuinely positive should calibrate toward higher cross-community trust. A community whose experiences are genuinely difficult should calibrate in the other direction. Both are correct outcomes. Trust can only grow on a foundation that reflects reality.

---

## The Three-Sprint Arc

### Sprint 30 — Individual Trust Layer (this sprint)
Introduces per-user trust config, the `cross_community_prior` concept, opt-in auto-evolution, and evolution history. Foundation for everything that follows.

### Sprint 31 — Community Evolution Engine
Aggregates individual signals across opted-in members. Computes community-level "drift pressure." Auto-adjusts community config based on collective behavior. Admin-facing evolution history.

### Sprint 32 — Fractal Feed Interface
Feed and request ranking use `blend(user_personal_params, community_params, blend_factor)`. Community configures how much individual models can diverge from its baseline. Match scoring considers model compatibility.

---

## New Concept: `cross_community_prior`

A new first-class trust parameter (range: 0.05–0.95, default: 0.50) representing a user's or community's **starting trust assumption** for people from other communities — before any interaction history exists.

This is a Bayesian prior. It calibrates based on actual experience, in either direction.

**Distinction from existing parameters:**
- `depth_weight` / `breadth_weight` — measure *patterns* of interaction (repeat vs. diverse)
- `cross_community_prior` — measures *starting trust assumption* for unknown cross-community members

**UI language rule:** Never describe higher values as "more open" or lower values as "more cautious." Use neutral language: "Your trust calibration for cross-community interactions."

---

## Data Model

### New table: `reputation.user_trust_configs`

Per-user, per-community trust preferences. `NULL` values mean "use community default" — users start with NULLs and the system fills them in via `getUserEffectiveParams()`.

```sql
CREATE TABLE reputation.user_trust_configs (
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id       UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  depth_weight       DECIMAL(3,2) DEFAULT NULL   -- NULL = community default; valid range [0.10, 0.90]
                       CONSTRAINT chk_utc_depth CHECK (depth_weight IS NULL OR depth_weight BETWEEN 0.10 AND 0.90),
  breadth_weight     DECIMAL(3,2) DEFAULT NULL   -- NULL = community default; valid range [0.10, 0.90]
                       CONSTRAINT chk_utc_breadth CHECK (breadth_weight IS NULL OR breadth_weight BETWEEN 0.10 AND 0.90),
  cross_community_prior DECIMAL(3,2) NOT NULL DEFAULT 0.50  -- always present; valid range [0.05, 0.95]
                       CONSTRAINT chk_utc_prior CHECK (cross_community_prior BETWEEN 0.05 AND 0.95),
  evolution_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, community_id)
);
```

### New table: `reputation.user_trust_evolution_log`

Immutable audit trail. Every parameter adjustment is logged with its signal trigger and before/after values.

```sql
CREATE TABLE reputation.user_trust_evolution_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id     UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  parameter        VARCHAR(50) NOT NULL,     -- 'depth_weight' | 'breadth_weight' | 'cross_community_prior'
  old_value        DECIMAL(3,2),             -- NULL on first adjustment from community default
  new_value        DECIMAL(3,2) NOT NULL,
  trigger_signal   VARCHAR(100) NOT NULL,    -- one of the EVOLUTION_SIGNALS constants
  trigger_event_id UUID,                     -- match_id or feedback_id that caused this
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for user_trust_configs (PK covers primary read path)
CREATE INDEX IF NOT EXISTS idx_utc_user ON reputation.user_trust_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_utc_comm ON reputation.user_trust_configs(community_id);

-- Composite index for user_trust_evolution_log cooldown lookups and pagination
-- getLastEvolutionForParameter() and getEvolutionLog() both use this
CREATE INDEX IF NOT EXISTS idx_utel_user_comm_param_created
  ON reputation.user_trust_evolution_log (user_id, community_id, parameter, created_at DESC);
```

### Modified table: `communities.community_configs`

Two new typed columns (following the existing `ADD COLUMN IF NOT EXISTS` pattern):

| Column | Type | Default | Meaning |
|--------|------|---------|---------|
| `community_evolution_enabled` | BOOLEAN | FALSE | Admin toggle: allow community member trust models to evolve |
| `cross_community_prior` | DECIMAL(3,2) | 0.50 | Community's starting assumption for cross-community trust |

---

## Evolution Engine

### Signals

Five behavioral signals trigger parameter calibrations. Three fire from the `match_completed` Bull queue event; two fire inline from the `POST /reputation/feedback` handler (no new Bull event types needed, because that handler already calls trust logic directly).

| Signal | Code path | Trigger condition | Parameter(s) affected | Delta |
|--------|-----------|-------------------|----------------------|-------|
| `cross_community_positive_feedback` | Inline in `POST /reputation/feedback` after feedback insert | Rating ≥ 4 AND `from_user_id` is not a member of `community_id` | `cross_community_prior` +0.02, `breadth_weight` +0.01 |
| `cross_community_negative_feedback` | Inline in `POST /reputation/feedback` after feedback insert | Rating ≤ 2 AND `from_user_id` is not a member of `community_id` | `cross_community_prior` −0.02 |
| `cross_community_match_completed` | `match_completed` Bull event handler | `requester_id` is not a member of `communityId` | `cross_community_prior` +0.01 |
| `repeat_interaction_same_person` | `match_completed` Bull event handler | Count of completed matches between `responder_id` and `requester_id` ≥ 3 | `depth_weight` +0.01 |
| `diverse_community_interactions` | `match_completed` Bull event handler (secondary eval) | `getDiverseCommunityCount(responder_id, days=30)` returns ≥ 3 | `breadth_weight` +0.02, `cross_community_prior` +0.01 |

**Cross-community check**: `SELECT NOT EXISTS (SELECT 1 FROM communities.members WHERE user_id = $fromUserId AND community_id = $communityId AND status = 'active')` — if the feedback/match initiator has no active membership in the match community, they are cross-community.

**Note:** A completed match is directionally positive (both parties completed). Negative feedback calibrates the prior downward. Both are accurate responses to reality.

### Eligibility Gates (all must pass to apply a nudge)

1. `community_evolution_enabled = true` on the community
2. `evolution_enabled = true` for this user in this community
3. Last adjustment to this specific parameter was > 7 days ago (per-parameter cooldown)
4. New value is different from current value after clamping (already at bound → skip)

### Parameter Bounds

| Parameter | Min | Max |
|-----------|-----|-----|
| `depth_weight` | 0.10 | 0.90 |
| `breadth_weight` | 0.10 | 0.90 |
| `cross_community_prior` | 0.05 | 0.95 |

---

## Service Architecture

### New: `trustConfigDb.ts`
Extracted shared helper (currently duplicated between `karmaService.ts` and `communityTrustService.ts`). Returns community trust config from `community_configs`. Used by `getUserEffectiveParams()` for NULL-fallback resolution.

### New: `trustEvolutionDb.ts`
All DB queries for evolution data:
- `getUserTrustConfig(userId, communityId)`
- `upsertUserTrustConfig(userId, communityId, patch)`
- `insertEvolutionLog(entry)`
- `getEvolutionLog(userId, communityId, limit, offset)`
- `getLastEvolutionForParameter(userId, communityId, parameter)` — MAX(created_at) query; uses composite index `(user_id, community_id, parameter, created_at DESC)` for the cooldown check
- `getCommunityEvolutionConfig(communityId)`
- `updateCommunityEvolutionConfig(communityId, patch)`
- `getEvolutionOptInRate(communityId)` — COUNT of `evolution_enabled = true` vs. total active members
- `getDiverseCommunityCount(userId, days=30)` — counts distinct `community_id` values in `reputation.karma_records` WHERE `user_id = userId AND reason IN ('Provided help', 'Received help') AND created_at >= NOW() - INTERVAL '$days days'`; returns integer; fired as secondary evaluation after every `match_completed` event for `responder_id`

### New: `trustEvolutionService.ts`
The core engine. Key exports:
- `getUserEffectiveParams(userId, communityId)` — merges user overrides with community defaults for NULLs. **This is the Sprint 32 integration point.** In Sprint 30 it exists but is not yet called by `updateTrustScore()`.
- `isEvolutionEligible(userId, communityId, parameter, cooldownDays=7)`
- `evaluateUserEvolution(userId, communityId, signal, context)` — applies nudge if eligible
- `isCrossCommunityParticipant(fromUserId, communityId)` — membership check helper

---

## API Endpoints

All new routes added to `services/reputation-service/src/routes/reputation.ts`. All use existing `authMiddleware`.

| Method | Path | Auth | Body/Response |
|--------|------|------|---------------|
| GET | `/reputation/trust-config/:userId/:communityId` | Self or community admin | UserTrustConfig with effective params filled |
| PUT | `/reputation/trust-config/:userId/:communityId` | Self only | `{ evolution_enabled: boolean }` |
| GET | `/reputation/trust-config/:userId/:communityId/history` | Self or admin | Paginated `EvolutionLogEntry[]`, query: `?limit&offset` |
| GET | `/reputation/communities/:communityId/trust-evolution` | Community admin | `{ community_evolution_enabled, cross_community_prior, opted_in_rate }` |
| PUT | `/reputation/communities/:communityId/trust-evolution` | Community admin | `{ community_evolution_enabled?, cross_community_prior? }` |

All responses follow `{ success: boolean, data: T, message?: string }`.

**Admin authorization pattern** (no existing precedent in `reputation.ts` — must implement from scratch):
```typescript
const memberships = req.user?.communities ?? [];  // NOTE: field is 'communities', NOT 'communityMemberships'
const isAdmin = req.user?.role === 'admin' ||
  memberships.some(m => m.id === communityId && m.role === 'admin');
if (!isAdmin) return res.status(403).json({ success: false, message: 'Forbidden' });
```

---

## Frontend

### `/reputation/trust` (existing page)

New "Trust Model Evolution" section below community breakdown:
- Per-community toggle: "Allow my trust model to evolve based on my experiences"
- When enabled: current personal params vs. community defaults (side-by-side)
- `cross_community_prior` shown with neutral label ("Your cross-community trust calibration")
- Link to "My Trust Journey" timeline
- Helper text when community hasn't enabled evolution: "Your community hasn't enabled trust evolution yet."

### `/reputation/evolution` (new page)

"My Trust Journey" — paginated timeline of evolution log entries:
- Human-readable parameter names and signal triggers
- Old → New value with directional arrow
- Date
- Empty state: "No evolution events yet. Turn on evolution and start making connections."

### Community admin Settings tab (existing page)

New "Trust Evolution" section:
- "Enable Community Trust Evolution" toggle
- Member opt-in rate display
- Community's `cross_community_prior` with neutral description

---

## Documentation Updates

### New files
| File | Content |
|------|---------|
| `docs/adr/ADR-046-trust-model-evolution.md` | ADR, status: Accepted |
| `apps/landing/src/data/docs/concepts/adr-046-trust-model-evolution.json` | Landing ADR page |
| `apps/landing/src/data/docs/concepts/trust-model-evolution.json` | Concept: "A Trust Model That Reflects Reality" |

### Framing resolution
The platform previously said trust parameters are "configured once, during community setup." This must be updated: parameters are *initial values* that can evolve with experience. The concept page framing: the goal is accuracy, not direction; an accurate low-trust model is healthier than an inaccurate high-trust model.

### Files to update
- `apps/landing/src/data/docs/nav.json` — 2 new entries (concept + ADR)
- `apps/landing/src/data/docs/concepts/trust-and-karma.json` — paragraph on living trust models
- `apps/landing/src/data/docs/guides/community-trust-model.json` — evolution section
- `services/reputation-service/CONTEXT.md` — new endpoints + schema
- `services/registry.json` — 5 new endpoints

---

## Testing Plan

### Unit tests (`tests/unit/reputation/trustEvolutionService.test.ts`)
Pattern: `prestige-badges.test.ts` (mock `query`, describe/it structure).

Key scenarios:
- `getUserEffectiveParams`: NULL fallback to community defaults, user overrides respected
- `isEvolutionEligible`: all three gates enforced independently
- `evaluateUserEvolution`: correct nudge per signal, clamping at bounds, skips when at bound, logs every adjustment
- Negative signal calibrates downward (cross_community_negative_feedback)
- Eligibility gate blocks adjustment

### Regression test
Verify `computeTrustScore()` produces identical output with fixed inputs before and after Sprint 30. No regression in existing formula.

### TDD integration test (`tests/tdd/trust-evolution-flow.test.ts`)
Enable evolution → trigger signal → verify log entry + parameter update (requires live services; can fail until available).

---

## Risks & Known Limitations

| Item | Decision |
|------|----------|
| `getUserEffectiveParams` not wired into trust score formula yet | Intentional. Sprint 32 connects it. UI communicates: "Your model evolves now; it will influence your experience soon." |
| Cross-community membership check uses current membership, not historical | Accept for Sprint 30. Documented in ADR-046 as known limitation. |
| 7-day cooldown is application-level, not DB-level | Accept. Simulation is single-threaded; bound-clamping makes race duplicates harmless. |
| `community_configs` uses typed columns, not JSONB | Confirmed. Use `ADD COLUMN IF NOT EXISTS` — consistent with prior migrations. |

---

## Explicit Out of Scope (Sprint 30)

- Wiring `getUserEffectiveParams` into feed/request ranking (Sprint 32)
- Community-level parameter drift from aggregate signals (Sprint 31)
- Manual parameter editing by users (auto-evolution only)
- The conformity/blend-factor dial (Sprint 32)
- Social graph naturalness improvements (separate backlog)
- Security vulnerability remediation (separate sprint candidate)
