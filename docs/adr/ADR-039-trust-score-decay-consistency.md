# ADR-039: Trust Score Decay Consistency — Time-Weighted Signals

**Date**: 2026-02-26
**Status**: Proposed
**Deciders**: Karmyq Core Team
**Related**: [ADR-011](ADR-011-reputation-decay.md) (karma decay), [ADR-037](ADR-037-multi-signal-trust-score.md) (multi-signal formula), [ADR-038](ADR-038-cross-community-trust.md) (cross-community carry)

---

## Context

ADR-011 established a **6-month half-life exponential decay** on karma points, correctly recognizing that old activity should matter less over time. `getUserKarmaWithDecay()` implements this.

However, the trust score formula introduced in the current interim model (2026-02-26) has an inconsistency: **karma decay is not wired into the trust score path**, and the other two trust score inputs — interaction count and feedback average — have no decay at all.

### The gap

| Signal | Decays? | Implementation |
|---|---|---|
| `karma_bonus` | **No** (in trust path) | `getUserTrustScore()` uses raw `SUM(points)` — not `getUserKarmaWithDecay()` |
| `interaction_score` | **No** | All-time count, log-scaled |
| `quality_score` (feedback avg) | **No** | `AVG(rating)` over all historical feedback |

This means a user who was very active 3 years ago and went dormant will still show a high trust score indefinitely. Karma was designed to decay — the trust score should follow the same philosophy.

### Why this matters

Trust in a mutual aid context is fundamentally about **current reliability**, not historical participation. Someone who completed 20 interactions 4 years ago and has since gone silent is not the same as someone actively engaged today. The platform should distinguish between:

- **Established but dormant** — high historical track record, not recently active
- **Actively building** — fewer total interactions, but recent and consistent

An all-time average feedback score is also vulnerable to a specific problem: a single 5-star rating from years ago still lifts the quality score, even if the user's recent behavior has deteriorated. This is exactly the kind of stale signal the decay model was designed to prevent.

---

## Decision

**Apply time-weighting to all three trust score inputs consistently.**

### 1. Interaction score — sliding window (12 months)

Count only interactions completed in the last 12 months for the `interaction_score` component. The logarithmic scaling already handles volume well; restricting it to recent activity makes the score reflect current engagement.

```
recent_interactions = COUNT of completed interactions in last 12 months
interaction_score   = min(60, floor(log2(recent_interactions + 1) × 15))
```

**Rationale for window vs. exponential decay**: Interaction count is an integer event count, not a continuous quantity like karma points. A sliding window is simpler to reason about, explain, and query. The 12-month window is generous enough to not penalize occasional helpers (someone who does 2 interactions every 3 months is active), while clearly excluding dormant users.

### 2. Quality score — recency-weighted feedback average

Weight feedback ratings by age. Ratings in the last 6 months count fully; older ratings decay with the same 6-month half-life used for karma (ADR-011):

```
weight(rating) = max(0.1, 0.5 ^ (age_months / 6))
quality_score  = round((weighted_avg / 5) × 30)
```

A minimum weight of `0.1` is applied so that old feedback never fully disappears — a user with no recent ratings still carries some quality signal from their history, but at reduced weight.

**Why not a sliding window here?** Feedback is sparse relative to karma records. A user who does 1 interaction per year might have only 1 or 2 ratings. Dropping them entirely after 12 months would cause the quality score to oscillate between meaningful and null. Exponential decay is more graceful for sparse data.

### 3. Karma bonus — use the existing decay path

`getUserTrustScore()` should call `getUserKarmaWithDecay()` (or the same decay math) rather than a raw `SUM(points)` query. ADR-011's decay model already specifies the right behavior; this ADR just closes the gap where the trust path bypassed it.

---

## Consequences

### Positive
- **Consistent philosophy**: All three trust score inputs decay on approximately the same timescale (6–12 months), matching ADR-011's intent
- **Accurate current signal**: Dormant users' scores degrade gracefully over time without any manual intervention
- **No abrupt drops**: Exponential decay and sliding windows both produce smooth transitions rather than cliff edges
- **Honest cold-start interaction**: A returning user who left for 2 years effectively re-enters as "low trust" — which is accurate, and the carry model from ADR-038 provides a soft floor from their cross-community history

### Negative
- **Slightly more complex queries**: Recency-weighted feedback avg requires computing weights in application code (or a SQL window function with age calculation); not a plain `AVG()`
- **Interaction count window changes the score for active users**: A user with 15 total interactions but only 8 in the last 12 months sees a lower `interaction_score` (45 vs. 60). This is intentional but may feel like a regression to users who were active 2 years ago.

### Neutral
- The carry model (ADR-038) partially mitigates the "feels like a regression" concern: a user's cross-community history provides a floor, so they don't drop all the way to zero after a period of inactivity — just to wherever their highest other community score decayed to.
- These changes are internal to the trust score computation. No API response shape changes.

---

## Design Choices

### Why 12 months for the interaction window?

Mutual aid participation is seasonal and life-dependent. A 12-month window captures at least one full cycle of someone's life. A 6-month window would be too aggressive — someone who helped consistently for 3 years but took a 7-month break (illness, job loss) should not be treated as new. A 24-month window is too forgiving to distinguish active from dormant.

### Why not apply decay to the interaction *count* using karma's half-life?

Karma is an additive score — you accumulate points, and the decay acts on the total continuously. Interaction count is a discrete event count — you either did the interaction or you didn't. Applying exponential decay to event counts produces fractional "virtual interactions" (e.g., 0.5 interactions) that are harder to reason about and explain. A sliding window is semantically cleaner.

### Does a dormant user's score drop to zero?

Not immediately. With exponential decay on feedback:
- After 6 months of inactivity: quality score drops to ~50% of full value
- After 12 months: ~25%
- After 24 months: ~6%

With a 12-month interaction window: if the user did no interactions in the last 12 months, `interaction_score = 0`. With decayed karma: the karma bonus also trends toward zero.

A user who was once in the Trusted tier (80–100) and goes dormant for 24 months would end up in the New–Building range (15–40 depending on their remaining decayed feedback quality). This is correct: they are not currently trusted until they re-engage.

### Interaction window vs. feedback window — why are they different?

Feedback ratings and interaction events have different sparsity characteristics. High-volume users may complete 20+ interactions per year; feedback is only given at match completion and may represent a subset of those (not all users rate). The sliding window handles the denser interaction signal cleanly. Exponential decay handles the sparse feedback signal more gracefully.

---

## Open Questions

### 1. Minimum weight floor for old feedback
The `0.1` minimum weight on old feedback is a placeholder. Should it be lower (e.g., 0.05) to more aggressively discount 3-year-old ratings? Or higher (e.g., 0.2) to preserve more historical signal? This should be tunable as a community config parameter in the future.

### 2. Returning user UX
When a previously Trusted user returns after 2 years and sees a lower score, will they understand why? The carry model provides a floor but the score may still feel like a punishment for taking a break. Consider whether to show users a "last active" signal or a "your score before/after inactivity" explanation.

### 3. Interaction window alignment with carry model
ADR-038's carry model applies when `community_score == 0` (no local interactions). After this ADR, the relevant threshold is "no recent local interactions in the 12-month window" — which is different from "no interactions ever." The carry model trigger condition may need to be updated accordingly.

---

## Implementation Roadmap

### Phase 1 (this ADR)
- Document the design decision and open questions

### Phase 2 (implement alongside ADR-037 multi-signal formula)
1. Update `feedbackDb.ts`: add `getWeightedAvgFeedback(toUserId, communityId, halfLifeMonths=6)` that computes the recency-weighted blend
2. Update `karmaService.ts`: `getUserTrustScore()` — use decayed karma and recency-weighted feedback
3. Update `karmaService.ts`: `updateTrustScore()` (event-driven path) — pass recent interaction count (last 12 months) instead of all-time count
4. Add `created_at` timestamp filter to interaction count queries
5. Tests: verify score decreases appropriately for dormant users; verify active users are unaffected

---

## References

- [ADR-011: Reputation Decay System](ADR-011-reputation-decay.md) — 6-month half-life karma decay
- [ADR-037: Multi-Signal Trust Score](ADR-037-multi-signal-trust-score.md) — formula design
- [ADR-038: Cross-Community Trust Carry](ADR-038-cross-community-trust.md) — carry floor for dormant/new users
- `services/reputation-service/src/services/karmaService.ts` — `getUserTrustScore()`, `getUserKarmaWithDecay()`
- `services/reputation-service/src/database/feedbackDb.ts` — `getBlendedAvgFeedback()`
