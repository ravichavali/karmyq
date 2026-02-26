# ADR-037: Multi-Signal Trust Score — Bonding Capital, Bridging Capital, and Community-Configurable Floors

**Date**: 2026-02-25
**Status**: Accepted (Implementation Pending)
**Deciders**: Development Team
**Supersedes**: ADR-035 (trust score portion only; karma allocation unchanged)

---

## Context

### The Problem with the Current Formula

ADR-035 abstracted the trust score into `trustScoreStrategy.ts` with the formula:

```
score = 50 + min(40, floor(karma/10)) + round((avg_feedback/5) × 10)
range: 50–100
```

This model has two fundamental problems:

**1. The artificial base of 50 conflates strangers with participants.**

A new user who has never interacted with anyone scores 50. A user who completed 1 interaction also scores roughly 50–51. There is no meaningful distinction between "I have no information about this person" and "I know this person did one helpful thing." Trust should be earned from zero, not assumed.

In real communities, trust is not the default state — familiarity is. A stranger on the street is not trusted, they're unknown. The platform should reflect this: unknown people have trust score 0 (no information), not 50 (presumed trustworthy).

**2. Karma is a blunt proxy for trust-building activity.**

Karma was designed as a community currency — a visible reward for participation. Using it as a trust input conflates two distinct concepts:
- **Karma** = how much you've given to the community (social currency, publicly visible)
- **Trust** = how reliably and broadly you've demonstrated helpfulness (private reputation signal)

These overlap but are not the same. A user who earned 1000 karma by being the primary helper in one tight community is not necessarily more trustworthy to a stranger than someone with 200 karma spread across five communities. Width and depth of interactions matter, not just the accumulated points.

**3. No signal for the nature of interactions.**

The current model cannot distinguish between:
- Someone who helped 50 different strangers across 3 communities (high bridging capital)
- Someone who helped the same 3 friends repeatedly in one community (high bonding capital)

These represent different kinds of trust, and different communities may value them differently.

---

## Sociological Basis: Bonding vs. Bridging Social Capital

Robert Putnam's social capital framework identifies two distinct types:

**Bonding capital** — dense connections within a group (deep, exclusive):
- High trust between specific known individuals
- Strong reciprocity norms
- "I know this person, they've helped me before"
- Risk: insularity, cliquishness, "good old boys" dynamics

**Bridging capital** — sparse connections across groups (broad, inclusive):
- Generalized trust beyond immediate circle
- Enables cooperation with strangers
- "This person helps whoever needs help, not just their friends"
- Risk: superficiality, lack of accountability

Karmyq is fundamentally a platform about **enabling help between people who don't already know each other**. This means bridging capital should be the primary trust signal — can we trust this person with someone they've never met? But bonding capital matters too: depth of relationship signals accountability and reliability within a specific community context.

The key insight: **both signals are useful, and different communities may legitimately prioritize them differently**. A cohousing community that already has dense relationships might weight bonding more (established members are well-known). A neighborhood mutual aid network that wants to expand might weight bridging more (we want helpers who can serve strangers).

---

## Decision

### New Multi-Signal Formula

```
volume_score    = min(30, floor(log2(interactions_completed + 1) × 10))
                  → 0–30 pts, logarithmic diminishing returns
                  → 0 interactions: 0pts, 1: 10pts, 3: 16pts, 7: 22pts, 15: 30pts

quality_score   = avg_feedback_score != null
                  ? round((avg_feedback_score / 5) × 25)
                  : 0
                  → 0–25 pts (0 if no feedback received yet)
                  → 5.0 feedback → 25pts, 2.5 → 12pts, 1.0 → 5pts

depth_score     = min(15, repeat_interaction_pairs × 2) × community_depth_weight
                  → 0–15 pts (scaled by community config)
                  → repeat_pairs: unique counterparties seen 2+ times in completed interactions

breadth_score   = (min(10, distinct_people_count × 2) + min(10, distinct_communities_count × 3))
                  × community_breadth_weight
                  → 0–20 pts (scaled by community config)

bonus_score     = interactions_completed >= min_interactions_for_trust ? 5 : 0
                  → 0–5 pts, signals "has crossed the community's trust threshold"

raw_score = volume_score + quality_score + depth_score + breadth_score + bonus_score

floor = community_negative_allowed ? -50 : 0
trust_score = max(floor, min(100, raw_score))
```

### Score interpretation

| Score | Meaning |
|-------|---------|
| -50–0 | Known bad actor (punitive communities only) |
| 0 | Unknown / no history |
| 1–20 | New participant, early interactions |
| 20–50 | Active participant, established in community |
| 50–75 | Trusted member, broad or deep track record |
| 75–100 | Highly trusted, diverse + high-quality contributions |

### Why logarithmic for volume?

Logarithmic scaling prevents "trust farming" — a user cannot simply grind interactions to maximize trust. Each additional interaction contributes less than the previous one, so trust grows fast initially (each interaction matters a lot to a new participant) and plateaus as the signal saturates. Quality and breadth become the differentiators at higher activity levels.

### Why karma no longer drives trust?

Karma remains as a community currency (visible on profiles, used for community status, subject to decay per ADR-011). It is NOT removed from the system. But it is removed as a trust input because:
1. `interactions_completed` is a cleaner, direct measure of what karma was proxying (activity)
2. Karma can be awarded in different amounts by community config (ADR-035), making raw karma non-comparable across communities
3. Decoupling karma and trust allows each to evolve independently

---

## Community Configuration

Two existing `community_configs` JSONB fields now formally used:

### `trust_depth_weight` (existing, previously unused)
- Type: `FLOAT`, range 0.0–1.0
- Default: 0.5
- Controls how much bonding capital (repeat interactions) contributes to trust score
- Example configs: Cohousing (0.6), Neighborhood Cautious (0.7), Experimental (0.5)

### `trust_breadth_weight` (existing, previously unused)
- Type: `FLOAT`, range 0.0–1.0
- Default: 0.5
- Controls how much bridging capital (distinct people + communities) contributes
- Note: `depth_weight + breadth_weight` need not equal 1.0 — they scale independent sub-scores

### `trust_negative_allowed` (new field)
- Type: `BOOLEAN`
- Default: `false`
- Determines whether bad actors can score below 0 (below the "stranger" baseline)

| `trust_negative_allowed` | Community philosophy | Trust floor |
|--------------------------|---------------------|-------------|
| `false` (Restorative) | Bad interactions slow trust growth but don't actively warn others. Someone with poor history is treated as unknown, not threatening. | 0 |
| `true` (Punitive) | Communities that want to actively signal that certain members are less trustworthy than a stranger — e.g., neighborhood safety contexts, high-stakes mutual aid. | -50 |

The floor of -50 is a platform constant, not configurable per community. This prevents "infinite punishment" while still enabling the community to signal "this person is worse than unknown."

---

## Migration Implications

**Existing users** who have trust scores computed under the ADR-035 formula (50-base) will see their scores reset when the new formula activates. Specifically:
- Users with no interactions: 50 → 0 (correct: they are genuinely unknown)
- Users with moderate karma: ~60 → 20–40 (lower, but more accurate)
- Users with high karma + feedback: ~90 → 60–80 (lower absolute, higher relative to peers)

This is not a regression — it is a more accurate representation. The trust score is an internal signal used for feed curation and trust distance filtering. It is not displayed as a number to users (ADR-036), so the reset is not visible as a jarring change. Feed recommendations will re-calibrate as the new scores propagate.

**Rollout recommendation**: When Phase 2 (implementation) ships, recompute all trust scores in a background job at deploy time. The transition will be instantaneous for the scoring model.

---

## Open Questions (To Resolve Before Phase 2 Implementation)

### 1. Depth: dyadic vs. effort-based
The current depth definition (repeat counterparties) measures relational depth. An alternative is effort-based depth (e.g., ride requests require more commitment than generic asks). The two are not mutually exclusive. **Current decision: use dyadic depth (repeat pairs) for Phase 2; revisit effort-based in Phase 3.**

### 2. How negative trust interacts with trust path visibility
If a user's trust score is -20 in community A, should they appear in the trust path badge at all? Options:
- Hide entirely from trust path
- Show with a warning indicator
- Show normally (path exists, trust score is separate)
**Current decision: defer to Phase 3.**

### 3. Cross-community trust aggregation
The current model is per-community. Should there be a platform-wide trust score? **Current decision: keep per-community; platform-wide trust is the average or max across communities (TBD).**

### 4. `min_interactions_for_trust` threshold
The `bonus_score` awards 5 pts for meeting the community's minimum interaction threshold. This threhsold is already in `community_configs` (e.g., 1, 3, or 5 interactions). **This is already configurable — just needs to be read and used.**

---

## Implementation Roadmap

### Phase 1 (Complete): Documentation
- This ADR
- Landing page concept doc
- CONTEXT.md update

### Phase 2 (Next implementation session): Formula
1. Update `services/reputation-service/src/services/trustScoreStrategy.ts`
   - New `TrustScoreInputs` interface (add depth/breadth/floor fields, remove total_karma)
   - New formula implementation
2. Create `services/reputation-service/src/database/trustMetricsDb.ts`
   - `getTrustMetrics(userId, communityId)` — queries for distinct_people, distinct_communities, repeat_pairs, interactions_completed
3. Update `services/reputation-service/src/services/karmaService.ts`
   - Read `trust_depth_weight`, `trust_breadth_weight`, `trust_negative_allowed` from community config
   - Call `getTrustMetrics()` before computing trust score
4. Update `services/reputation-service/src/routes/reputation.ts` (feedback endpoint)
   - Same wiring
5. Update tests in `trustScoreStrategy.test.ts`
   - Remove 50-base assertions (will break by design)
   - Add volume, depth, breadth, floor tests

### Phase 3 (Future): Community Config Wiring
1. Add `trust_negative_allowed` to `community_configs` JSONB defaults
2. Surface in community admin UI (CommunityConfigEditor)
3. Resolve open questions (negative trust display, cross-community aggregation)

---

## References

- ADR-011: Reputation Decay System (karma decay, complements this model)
- ADR-035: Karma Allocation Strategy and Trust Score Abstraction (karma model unchanged)
- ADR-036: Private Feedback Model (feedback is the quality signal input)
- Putnam, Robert D. "Bowling Alone: The Collapse and Revival of American Community" (2000)
- `services/reputation-service/src/services/trustScoreStrategy.ts` — current formula (to be replaced in Phase 2)
- `infrastructure/postgres/init.sql` lines 847–917 — `community_configs` schema
