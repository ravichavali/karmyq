# ADR-070: Visible Decay Model (decay tiers + re-warming nudge)

**Status**: Accepted
**Date**: 2026-06-07
**Sprint**: 90
**Version**: 10.14.0

## Context

The trust graph already decays: `trust_edges_live.current_weight` falls exponentially
([ADR-056], Sprint 68 half-life), and `trustEdgeSweepJob` deletes an edge once its decayed weight drops
below the community's `disappearance_threshold`. But a member could not **see** any of this. A bond
about to disappear looked identical to a thriving one until it silently vanished. The "relationships
that fade when they go quiet" promise was ranking math with no perceptible surface.

## Decision

Introduce a qualitative **decay tier** derived from each edge's decayed weight relative to its
disappearance threshold, and render it consistently so bonds **perceptibly fade**.

### The tier model

Let `r = current_weight / disappearance_threshold`:

| Tier | Condition | Meaning |
|------|-----------|---------|
| `strong` | `r ≥ 3` | Active, well-tended |
| `warm` | `2 ≤ r < 3` | Healthy |
| `fading` | `1.3 ≤ r < 2` | Going quiet; visibly faded |
| `nearly_forgotten` | `1 ≤ r < 1.3` | About to be swept — **triggers the re-warming nudge** |
| `swept` | `r < 1` | Already deleted by `trustEdgeSweepJob`; not normally returned |

No new decay math — only a classification over values the live view already exposes. The band math
lives in **one shared pure helper**, `classifyDecayTier(currentWeight, threshold)` in `@karmyq/shared`,
consumed by the social-graph endpoints and their tests so backend and UI never drift.

### Where it surfaces

1. **Graph + relationship faces fade.** The `/trust/graph/:communityId(/full)` routes attach
   `currentWeight`, `disappearanceThreshold`, and `decayTier` per edge. The shared `TrustPathBadge`
   (the relationship-face element) and the HEB graph edges fade via an opacity/desaturation ramp keyed
   on the tier (`.kq-decay-*` tokens), with the tier label on hover.
2. **Re-warming nudge.** `GET /trust/relationships/fading` returns `nearly_forgotten` bonds. The
   `ReWarmingNudge` component gently invites the member to reconnect ("You and {name} used to help each
   other often — reconnect before it fades"). It renders nothing when there are none.
3. **Profile memory section.** `GET /trust/me/memory` returns `activeCount` + `fading[]` +
   `nearlyForgotten[]`. The profile `MemorySection` shows what's held and what's fading, suppressing
   rows with no data (no empty placeholder tiles).

## Consequences

- **Positive:** members can feel bonds fading and act before they vanish; the decay promise becomes
  perceptible and trustworthy; one shared helper guarantees backend/UI agreement.
- **Negative / trade-offs:** tier bands are a fixed heuristic (not yet community-tunable beyond the
  threshold); the nudge is gentle and easily ignored (intentional — not a growth-hack).
- **Follow-ups:** per-community tunable bands; mobile parity (Sprint 91).

## Related

- [ADR-069: Data Retention and Forgetting](ADR-069-data-retention-and-forgetting.md) — the content half.
- [ADR-056], Sprint 68 interaction half-life; manifesto §7.
