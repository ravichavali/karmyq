# ADR-035: Karma Allocation Strategy and Trust Score Abstraction

**Date**: 2026-02-25
**Status**: Implemented
**Deciders**: Development Team

---

## Context

The reputation system had two related problems:

**1. Karma inflation across communities**

When a request was posted to multiple communities and both users were members of all of them, karma was awarded independently in each shared community (up to 3). A user in 3 communities could earn 3× the karma per interaction. This creates perverse incentives — being in many communities earns more karma than actual helping behaviour.

**2. Hardcoded, one-dimensional trust score**

The trust score formula was inlined directly in `karmaService.ts` and used only total karma:

```typescript
const karma_contribution = Math.min(50, Math.floor(total_karma / 10));
const score = 50 + karma_contribution;
```

Trust should reflect the full picture of a user's standing — their karma, their interaction history, the quality of their interactions (feedback), and eventually their connections and recency. There was no abstraction point to evolve this formula without touching service logic.

---

## Decision

### Karma: Fixed pool per interaction, divided across communities

A fixed karma pool (`BASE_KARMA_POOL = 15` pts by default) is awarded per interaction, regardless of how many communities the request spans. The pool is divided proportionally across shared communities, with each community applying its own helper/requester split ratio to its share.

**Key properties:**
- Total karma earned is always `BASE_KARMA_POOL`, never multiplied by community count
- Each community still applies its configured split (e.g. 60% helper / 40% requester)
- Fractional amounts are resolved using largest-remainder rounding so integer awards sum exactly to the pool
- Community config continues to control the split between helper and requester

**Example — 2 communities, pool=15, splits 60/40 and 50/50:**
```
Community A share = 7.5 → helper=4.5, requester=3.0
Community B share = 7.5 → helper=3.75, requester=3.75
After rounding:   A=(5,3),   B=(4,3)  →  total sum = 15 ✓
```

### Trust score: Abstracted, multi-factor, extensible

The trust score formula is moved into `trustScoreStrategy.ts` with a typed `TrustScoreInputs` interface designed to accept more signals over time. The initial formula incorporates karma AND feedback ratings (already stored but previously unused):

```
score = 50 + min(40, floor(karma / 10)) + round((avg_feedback / 5) × 10)
```

Range: 50–100. Future inputs (connections, recency, tenure) are documented in the interface and can be wired in without touching `karmaService.ts`.

---

## Implementation

Two new modules in `services/reputation-service/src/services/`:

- **`karmaAllocation.ts`** — `allocateKarma(configs, totalPool)` — the karma distribution tuning surface
- **`trustScoreStrategy.ts`** — `computeTrustScore(inputs)` — the trust score computation tuning surface

`karmaService.ts` is updated to call both. No schema changes required.

---

## Consequences

**Positive:**
- Karma no longer inflates for users in many communities
- Trust score formula is now isolated and independently evolvable
- Feedback ratings (avg_helpfulness, avg_responsiveness, avg_clarity) now contribute to trust score
- Both algorithms are easy to unit test in isolation
- Adding new signals (connections, recency) requires only changes to the strategy module

**Negative / Trade-offs:**
- Users in multiple communities earn slightly less karma per interaction than before (by design)
- `BASE_KARMA_POOL` currently defaults to 15 — the sum of old defaults (10+5). If the community's split is not exactly 2/3 helper, the helper receives more or less than 10
- Trust score values will differ from pre-ADR-035 scores for users who have received feedback (scores will be slightly higher for well-rated users)

---

## Future Directions

- `BASE_KARMA_POOL` could be made configurable per community (already partially supported via `base_karma_pool_per_request` in `community_configs`)
- `allocateKarma` can accept community weights (communities that contribute more to the match get a larger share of the pool)
- `computeTrustScore` inputs `direct_connection_count`, `days_active_last_30`, `community_tenure_days` are stubbed and ready to be wired from the social-graph service
- Eventually, both strategy modules could become their own microservice for independent scaling and A/B testing
