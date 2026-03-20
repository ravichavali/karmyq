# Sprint 31: Community Evolution Engine — Design Spec

**Date**: 2026-03-20
**Status**: Approved
**Version**: v9.5.0 → v9.6.0
**Sprint Branch**: `feature/sprint-31-community-evolution`

---

## Overview

Sprint 30 built the individual trust evolution layer: each user's trust parameters calibrate based on lived experience. Sprint 31 builds the next level — those individual calibrations ripple upward to evolve the community's own trust configuration.

The core mechanic is **delta-based**: when a user's trust begins evolving, their starting values form a baseline. As they interact and their trust calibrates, we track the delta (evolved value − baseline). Periodically, we aggregate these deltas across all evolving members and nudge the community's config in the direction of collective experience.

This is evolution by participation, not by decree. The community's trust model becomes a living reflection of what its members are actually experiencing — not what was configured at founding time. A community whose members are consistently calibrating toward more openness is telling the system something real. The system listens.

### Core Principle: Participation, Not Permission

Members who opt into personal trust evolution automatically contribute to community evolution. There is no third flag — you're either in the evolution ecosystem or you're not. Communities evolve from the collective signal of participating members. Admins can disable community-level evolution if they prefer a fixed config, but they cannot selectively exclude individual members' signals while keeping evolution on.

This design eliminates free-rider complexity: no separate "contribute to community" toggle, no reconciliation between three flag states. Two flags, two scopes, clean semantics.

---

## The 3-Sprint Arc

- **Sprint 30** (complete) — Individual trust config + evolution engine + history report
- **Sprint 31** (this sprint) — Community evolution: aggregate member deltas → community config drift
- **Sprint 32** (upcoming) — Fractal feed: feed/matching uses blended individual + community model

---

## New Concepts

### Delta-Based Aggregation

The community evolution signal is computed from the *change* in each member's trust params since their evolution began — not from their current absolute values. A community of uniformly trusting members who never evolved tells us nothing. A community where members are consistently calibrating upward tells us the community should open up.

**Baseline derivation (no new table required):** A member's baseline for a given parameter is the first `old_value` in `user_trust_evolution_log` for that `(user_id, community_id, parameter)`. Members with zero evolution events are excluded from aggregation — they haven't evolved yet, so they have no delta to contribute.

### Interaction Rate Health Metric

Before applying any community evolution, we snapshot the current interaction rate (completed matches per active member per 30 days). If the rate is declining, we dampen the nudge. This ensures we don't drift config in directions that correlate with declining engagement. The snapshot is stored alongside each evolution event so future sprints can analyze the correlation.

**Dampening table:**
| Interaction rate trend | Damping factor |
|------------------------|---------------|
| Stable or improving | 1.0 (full nudge) |
| Declining >10% | 0.5 (half nudge) |
| Declining >25% | 0.0 (skip cycle, log it) |

### Direction Consensus (for `trust_path_max_hops`)

Because hop count changes have large downstream effects on trust score calculations, `trust_path_max_hops` only shifts when the last **3 consecutive** community evolution cycles agree on direction for `cross_community_prior`. This gate prevents oscillation on a high-impact integer parameter.

---

## Default Behavior Change

Sprint 30 shipped with `evolution_enabled = FALSE` (opt-in). Sprint 31 flips to **opt-out**:

- `reputation.user_trust_configs.evolution_enabled` → default `TRUE`
- `communities.community_configs.community_evolution_enabled` → default `TRUE`

The migration updates existing rows to `TRUE`. This is a deliberate design reset — the platform's philosophy is that evolution happens unless you explicitly stop it.

---

## Data Model

### Migration: `20260320-community-evolution.sql`

```sql
-- 1. Flip evolution defaults to opt-out (TRUE)
ALTER TABLE reputation.user_trust_configs
  ALTER COLUMN evolution_enabled SET DEFAULT TRUE;
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

Also update `init.sql` to match both changes (new table + flipped defaults).

### Schema: Parameters That Evolve

| Parameter | DB column in `community_configs` | Range | Mechanism |
|-----------|----------------------------------|-------|-----------|
| Cross-community prior | `cross_community_prior` | 0.05–0.95 | Direct delta aggregation × 0.30 damping |
| Karma split (helper share) | `karma_split_helper` | 0–100 | Follows prior direction, ±1 per cycle |
| Trust path depth | `trust_path_max_hops` | 1–5 | Follows prior direction, ±1 only after 3 consecutive same-direction cycles |

### Baseline Derivation Query

```sql
-- For a given community, compute each member's delta per parameter
WITH first_log AS (
  SELECT DISTINCT ON (user_id, parameter)
    user_id, parameter, old_value AS baseline
  FROM reputation.user_trust_evolution_log
  WHERE community_id = $1
  ORDER BY user_id, parameter, created_at ASC
),
current_values AS (
  SELECT
    utc.user_id,
    utc.cross_community_prior,
    utc.depth_weight,
    utc.breadth_weight
  FROM reputation.user_trust_configs utc
  JOIN communities.members cm
    ON cm.user_id = utc.user_id AND cm.community_id = $1 AND cm.status = 'active'
  WHERE utc.community_id = $1
    AND utc.evolution_enabled = TRUE
)
SELECT
  fl.user_id,
  fl.parameter,
  fl.baseline,
  CASE fl.parameter
    WHEN 'cross_community_prior' THEN cv.cross_community_prior
    WHEN 'depth_weight'          THEN cv.depth_weight
    WHEN 'breadth_weight'        THEN cv.breadth_weight
  END AS current_value,
  CASE fl.parameter
    WHEN 'cross_community_prior' THEN cv.cross_community_prior - fl.baseline
    WHEN 'depth_weight'          THEN cv.depth_weight - fl.baseline
    WHEN 'breadth_weight'        THEN cv.breadth_weight - fl.baseline
  END AS delta
FROM first_log fl
JOIN current_values cv ON cv.user_id = fl.user_id
WHERE fl.parameter = 'cross_community_prior'  -- run per-parameter
```

---

## Community Evolution Aggregation Logic

```
1. Check community_evolution_enabled — if FALSE, return early
2. Check community cooldown — if last evolution < 30 days ago, return early
3. Compute aggregate_delta for cross_community_prior:
     median(deltas) across all active evolving members
     If fewer than 3 contributing members, return early (insufficient signal)
4. Compute interaction_rate:
     completed_matches_30d / active_member_count
5. Determine damping_factor from interaction_rate trend
6. Apply to cross_community_prior:
     nudge = round2(aggregate_delta × 0.30 × damping_factor)
     new_prior = clamp(current_prior + nudge, 0.05, 0.95)
7. Apply to karma_split_helper (follows prior direction):
     if nudge > 0: karma_split_helper = min(100, current + 1)
     if nudge < 0: karma_split_helper = max(0, current - 1)
8. Apply to trust_path_max_hops (direction consensus gate):
     check last 3 community_evolution_log entries for cross_community_prior
     if all 3 agree on direction: trust_path_max_hops ± 1 (clamped 1–5)
9. Log each parameter change to community_evolution_log
```

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/reputation/community/:communityId/evolution/history` | Admin | Paginated `community_evolution_log` entries |
| GET | `/reputation/community/:communityId/evolution/summary` | Admin | Current config vs. first evolution baseline; contributing member count |
| PUT | `/reputation/community/:communityId/evolution/toggle` | Admin | Toggle `community_evolution_enabled` on/off |

---

## Frontend Changes

### Community Admin Page — Settings Tab (`/communities/[id]`)

Add a **Trust Evolution** section below existing trust config:
- Toggle: "Community trust evolution" (on/off, maps to `community_evolution_enabled`)
- Read-only summary line: "N parameters have evolved since [first evolution date]"
- Drift table: Parameter | Original → Current | Last Changed
- When disabled, show: "Evolution is paused. Existing config is unchanged."

### Personal Trust Page (`/reputation/trust`)

Add a read-only acknowledgment line when `evolution_enabled = true`:
> "Your trust model is evolving and contributing to your community's evolution."

No toggle here — the toggle for personal evolution already exists; this is just context.

---

## Pluggability Architecture

`communityEvolutionService.ts` is a self-contained module. Every public function checks `community_evolution_enabled` at the top and returns early if false. No other service imports from it except:
- `trustEvolutionService.ts` (queues the community check after user evolution fires)
- `subscriber.ts` (consumes the Bull job)
- `reputation.ts` routes (API endpoints)

Disabling community evolution is a single flag flip. The service can be removed by deleting the file and its three call sites — nothing in the core karma/trust system depends on it.

**Bull queue deduplication**: Community evolution jobs are keyed by `community_id`. Only one pending `community_evolution_check` job per community at a time. Multiple user evolutions in the same day result in a single community evolution evaluation.

---

## Critical Implementation Notes

1. **Evolution default flip updates ALL existing rows** — the migration has `UPDATE ... SET evolution_enabled = TRUE` for both tables. This is intentional and a design reset.

2. **No member snapshot table** — baselines come from the first `old_value` in `user_trust_evolution_log`. Members with no evolution history contribute no delta and are silently excluded.

3. **Community cooldown via log query** — no separate column. Query `MAX(applied_at)` from `community_evolution_log WHERE community_id = $1`. If < 30 days ago, skip.

4. **`karma_split_helper` and `trust_path_max_hops` are derived from prior direction** — users have no per-user versions of these params. The aggregate prior delta is the sole directional signal for all three parameters.

5. **Direction consensus for hops requires 3 log entries** — if `community_evolution_log` has fewer than 3 entries for `cross_community_prior`, skip hop evolution entirely. New communities won't shift hops for at least 90 days (3 × 30-day cooldown).

6. **Interaction rate formula** — `completed matches in last 30 days / active member count`. Join `matches` (status = 'completed') through `requests.request_communities` for community scoping.

7. **Minimum contributing members = 3** — if fewer than 3 active members have evolution log entries for a community, skip the cycle. Prevents single-member communities from generating meaningful signal.

8. **`communityEvolutionService.ts` must never throw** — wrap the aggregation in try/catch and log errors without propagating. A community evolution failure must never affect the user-facing request flow.
