# Sprint 32: Fractal Feed — Design Spec

**Date**: 2026-03-20
**Status**: Approved
**Version**: v9.6.0 → v9.7.0
**Sprint Branch**: `feature/sprint-32-fractal-feed`

---

## Overview

Sprints 30 and 31 built the full trust evolution pipeline: individual params evolve based on interaction signals, community params drift from aggregated member deltas. But nothing downstream uses these evolved values yet. Trust scores still compute using static community weights; the curated feed treats all unconnected requesters the same regardless of how open a user is to cross-community interaction.

Sprint 32 closes the loop. It wires `getUserEffectiveParams()` — which already correctly blends user overrides and community defaults — into two places: (1) trust score computation, so that a user whose depth/breadth weights have evolved will have a trust score that reflects their actual interaction style, and (2) the curated feed, so that a user with a high cross-community prior sees more cross-community requests ranked higher. The arc is complete: the trust model now fractal-reflects individual calibration at every level.

Sprint 32 also surfaces the global opt-out: a single toggle on the trust page that stops personal trust evolution across all communities. This is the UX commitment made in Sprint 30 — giving users control without complexity. It also introduces a Redis cache for effective params so the evolved params are available in the hot feed path without per-request DB lookups.

### Core Principle: Trust that actually shapes experience

The evolved params have been accumulating since Sprint 30. Sprint 32 is the moment they start mattering — every trust score and feed ranking reflects the user's calibrated model.

---

## Multi-Sprint Arc (ADR-046)

### Sprint 30 — Individual trust config + evolution engine (complete)
Per-user trust params (`depth_weight`, `breadth_weight`, `cross_community_prior`) stored and evolved via signals. `getUserEffectiveParams()` written but not wired downstream.

### Sprint 31 — Community evolution engine (complete)
Community params drift from aggregated member deltas. Evolution defaults flipped to TRUE (opt-out model). Community evolution log created. `isEvolutionEligible()` checks both community and user flags.

### Sprint 32 — Fractal feed: wired (this sprint)
`getUserEffectiveParams()` wired into trust score computation and curated feed scoring. Cross-community prior becomes a live calibration signal in the feed. Global opt-out surfaced in UI. Arc complete.

---

## New Concepts

**Effective params**: The blended output of `getUserEffectiveParams(userId, communityId)`. Returns user overrides where set, community defaults otherwise. Three values: `depth_weight`, `breadth_weight`, `cross_community_prior`.

**Fractal feed**: A feed where each user's ranking reflects their personal trust model — different users see different orderings of the same request pool based on their calibrated params.

**Global opt-out**: A user-level flag (`global_evolution_enabled` in `reputation.user_trust_preferences`) that gates ALL personal evolution regardless of community settings. Stops personal params from changing; user still contributes to community evolution.

---

## Data Model

### New table: `reputation.user_trust_preferences`

```sql
CREATE TABLE IF NOT EXISTS reputation.user_trust_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  global_evolution_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

No other schema changes. The `user_trust_config` table (per-community params) is unchanged.

---

## API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/reputation/users/:userId/effective-params?communityId=` | Returns blended effective params for user+community, served from Redis cache (TTL 4h) | Self only |
| `GET` | `/reputation/users/:userId/evolution-global` | Returns current global evolution preference | Self only |
| `PUT` | `/reputation/users/:userId/evolution-global` | Set global evolution enabled/disabled | Self only |

The existing `PUT /reputation/trust-config/:userId/:communityId` remains unchanged for per-community evolution toggling.

---

## Frontend Changes

### `apps/frontend/src/pages/reputation/trust.tsx`
- **Remove** the "It will influence your experience in a future update." caveat — it's live now
- **Add** global opt-out toggle at the top of the "Trust Model Evolution" section, above the per-community toggles
  - Label: "Pause all trust evolution" / "Trust evolution active"
  - When paused: per-community toggles are shown grayed out (evolution still displayed, but global flag overrides)
- **Add** effective params display inside each `TrustEvolutionToggle` card — show `depth_weight`, `breadth_weight`, `cross_community_prior` as read-only badges (e.g. "Depth 0.64 · Breadth 0.36 · Cross-community 58%")

### `apps/frontend/src/lib/api.ts`
- Add `getGlobalEvolutionSetting(userId)` — GET `/reputation/users/:userId/evolution-global`
- Add `setGlobalEvolutionSetting(userId, enabled)` — PUT `/reputation/users/:userId/evolution-global`

---

## User Guide & Doc Updates

- **Update** `apps/landing/src/data/docs/guides/trust-evolution.json` (or source `docs/guides/trust-evolution.md`) — add section on fractal feed: how the curated feed now uses evolved params; how global opt-out works
- **Add** concept page `docs/concepts/fractal-feed.md` — explains how individual trust calibration now shapes feed ranking end-to-end
- **Update** ADR-046 status from `Accepted` → `Implemented` (3-sprint arc complete)
- **Update** landing page nav via `scripts/generate-docs.ts` to include fractal-feed concept

---

## Critical Implementation Notes

1. **`getUserEffectiveParams()` is already safe for null userConfig** — if no user override row exists, it falls back to community defaults (lines 82–85 in `trustEvolutionService.ts`). No need to add extra null guards.

2. **`updateTrustScore()` currently uses `getCommunityTrustConfig()` for `depth_weight`/`breadth_weight`** (karmaService.ts:253–266). Replace only those two values with `getUserEffectiveParams()` output. Keep `feedback_threshold`, `min_interactions_for_bonus`, `negative_allowed` from community config — those are community policy, not user calibration.

3. **Redis cache key pattern**: `trust_params:{userId}:{communityId}`, TTL 14400 (4h). Invalidate in `upsertUserTrustConfig()` after write. Use `REPUTATION_REDIS_URL` env var (same Redis as Bull queues).

4. **Cross-community prior formula in feed**: For null-degree requesters (unconnected), replace `scoreTrustDistance(null)` (= 10) with `Math.round(cross_community_prior * 100)`. Example: prior=0.5 → 50; prior=0.9 → 90; prior=0.1 → 10. This IS an intentional behavior change — users with neutral/high priors will see more cross-community requests. Only applies when `degrees === null`.

5. **Effective params HTTP call in request-service feed**: The curated feed route lives in `request-service` but effective params come from `reputation-service`. Call `GET /reputation/users/:userId/effective-params?communityId=` at the start of the curated handler. Since the reputation service serves from Redis cache (4h TTL), this adds minimal latency. Fall back to `{ depth_weight: 0.6, breadth_weight: 0.4, cross_community_prior: 0.5 }` if the call fails — never block the feed.

6. **`isEvolutionEligible()` global gate**: Add a check for `user_trust_preferences.global_evolution_enabled` BEFORE the per-community checks. If the row doesn't exist (new user), treat as `global_evolution_enabled = true` (opted in by default — consistent with opt-out model from Sprint 31).

7. **`generate-docs.ts` is the source of truth for nav.json** — never edit `apps/landing/src/data/docs/nav.json` directly. Add entries to `generate-docs.ts` and run `npm run generate-docs` in `apps/landing/`.

8. **Trust.tsx page already has per-community evolution toggles** — Sprint 32 adds the global toggle ABOVE these, not replacing them. When global is OFF, per-community toggles are still shown but with a note that global evolution is paused.
