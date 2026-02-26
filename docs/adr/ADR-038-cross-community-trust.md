# ADR-038: Cross-Community Trust — Carry Model with Community-Configurable Decay

**Date**: 2026-02-26
**Status**: Proposed
**Deciders**: Karmyq Core Team
**Related**: [ADR-037](ADR-037-multi-signal-trust-score.md) (Open Question #5), [ADR-035](ADR-035-karma-allocation-trust-score-strategy.md)

---

## Context

Trust scores in Karmyq are computed per-community. A user joining a new community starts with a score of 0 and must earn trust from scratch. This creates two problems:

1. **Cold-start problem**: Members with strong track records elsewhere are indistinguishable from brand-new users when they join a community. This may lead to genuinely trustworthy people being passed over in the feed, or having to do a disproportionate amount of work to prove themselves again.

2. **Network fragmentation**: Karmyq's vision includes multi-community membership and eventually federated mutual aid networks. A fully siloed trust model works against this — it doesn't reward people who help broadly across communities.

At the same time, naive trust portability creates risks:

- **Trust laundering**: A user could build trust in a low-standards community and exploit that reputation in a community with stricter norms.
- **Signal dilution**: If trust transfers fully and permanently, the per-community signal loses meaning — every community effectively shares a single global score.
- **Context mismatch**: Skill at giving rides in Community A says little about reliability for childcare in Community B.

ADR-037 deferred this as Open Question #5. This ADR resolves the design.

---

## Decision

**Implement a carry model with community-configurable decay.**

When a user has no completed interactions in a target community, their score in that community is floored by a *carried score* derived from their highest trust score across other communities they belong to:

```
carried_score   = min(CARRY_CAP, floor(max_other_score × carry_factor))
community_score = locally earned score (interactions + quality + karma)
displayed_score = max(community_score, carried_score)
```

Once `community_score` surpasses `carried_score`, the carry no longer has any effect — the user's local reputation is stronger.

### Parameters

| Parameter | Default | Stored in |
|---|---|---|
| `trust_carry_factor` | `0.40` | `community_configs` JSONB |
| `trust_carry_cap` | `59` (Building tier ceiling) | `community_configs` JSONB |
| `trust_carry_enabled` | `true` | `community_configs` JSONB |

### Example

User has a trust score of 75 (Reliable) in Community A. They join Community B:
- `carry_factor = 0.40` (B's default)
- `carried_score = min(59, floor(75 × 0.40)) = min(59, 30) = 30`
- User starts Community B in the **Building tier** rather than New (0)
- After completing 3 interactions with 4-star feedback in B: `community_score = 54`
- `displayed_score = max(54, 30) = 54` — local score now dominates

### Carry cap rationale

The cap of 59 (top of the Building tier) is intentional:
- **You can never arrive as Trusted** in a new community based on reputation alone
- **You can skip New** if you have meaningful reputation elsewhere
- This prevents trust laundering while still rewarding established members

---

## Consequences

### Positive
- Removes the cold-start disadvantage for users with established reputations
- Rewards cross-community participation without enabling exploitation
- Community-configurable: conservative communities can disable carry entirely (`trust_carry_enabled: false`) or use a very low factor
- Graceful: carry only applies when local score is lower — it never reduces someone's earned score

### Negative
- Slightly more complex score computation: requires querying other communities the user belongs to
- Score displayed may be "inherited" rather than locally earned — could feel opaque to users (mitigated by keeping trust scores private)
- Communities with very different cultures/norms may not want any carry at all

### Neutral
- Carry is a floor, not a blend — the math is simple and auditable
- Per-community config follows the existing `community_configs` JSONB pattern (ADR-030)

---

## Design Choices

### Why carry from the *highest* score, not an average?

An average would penalize users who are active in low-trust communities or communities where they haven't yet built history. The highest score is the most charitable and most relevant signal — it represents the best version of themselves in any single community context.

### Why is carry one-hop only?

Trust from Community C should not carry through A to reach B unless the user is a direct member of all three. One-hop-only prevents manufactured trust chains. Federation (multi-hop carry) is a future consideration once the federation model is designed.

### Why carry on zero-interaction threshold?

The transition is binary by design: carry applies when you have no local history; once you have any completed interaction, the locally-earned score is used. This avoids a blending period that would be confusing to explain ("your score is 40% carried and 60% local"). Once you do anything, you're on your own.

### Should negative trust carry?

**No, for now.** If a user's best score across all communities is below the carry cap (e.g., they score 20 in their best community), the carried score will be `min(59, floor(20 × 0.40)) = 8`. This is low but nonzero — the user still starts slightly above zero. Whether negative trust (a score so low it should *penalize* entry) should be carried is deferred as an open question below.

---

## Configuration Examples

```json
// Open community: welcomes members with established reputations elsewhere
{
  "trust_carry_enabled": true,
  "trust_carry_factor": 0.60,
  "trust_carry_cap": 59
}

// Standard community: default carry
{
  "trust_carry_enabled": true,
  "trust_carry_factor": 0.40,
  "trust_carry_cap": 59
}

// Conservative / closed community: fully siloed trust
{
  "trust_carry_enabled": false
}

// High-trust community: allows carry but only above a source score threshold
// (future feature — not in Phase 2)
{
  "trust_carry_enabled": true,
  "trust_carry_factor": 0.40,
  "trust_carry_cap": 59,
  "trust_carry_min_source_score": 60
}
```

---

## Open Questions

### 1. Should negative-signal carry be implemented?
If a user's best community score is very low (e.g., 5), they carry a small floor. But what if a user has explicitly earned *negative* trust signals — e.g., multiple 1-star ratings, or a community has flagged concerns? Should those signals follow the user to new communities?

**Current decision**: Negative carry deferred. The carry floor already handles low scores gracefully (carry of 5 = `min(59, floor(5 × 0.40)) = 2`). Explicit negative carry (reducing below 0 in a new community) requires a separate harm-signal model not yet designed.

### 2. What happens when a source community score drops?
If a user's trust score in Community A falls from 75 to 30 after the carry was established in Community B, does the carried floor in B update retroactively?

**Current decision**: Carry is computed at display time, not cached — the max of other community scores is always recalculated live. So a drop in the source community is reflected immediately in communities where the user hasn't yet earned local history.

### 3. Multi-hop carry for federation
Once Karmyq federates with external mutual aid networks (future), should trust carry across federation boundaries? If so, at what factor?

**Current decision**: Federation carry is explicitly deferred. No cross-federation carry until a federation trust model is designed.

### 4. Minimum source score threshold
Should a community be able to require that a user's source trust score be above some threshold before carry applies at all? (e.g., "only carry if source score ≥ 60")

**Current decision**: Not in Phase 2. Configurable as `trust_carry_min_source_score` in the future when communities request it.

---

## Implementation Roadmap

### Phase 1 (this ADR)
- Document the design decision
- Add `trust_carry_factor`, `trust_carry_cap`, `trust_carry_enabled` to `community_configs` JSONB schema documentation

### Phase 2 (future sprint — implement after ADR-037 multi-signal formula)
1. Add carry config fields to `infrastructure/postgres/migrations/` (new migration)
2. Update `services/reputation-service/src/services/karmaService.ts`:
   - `getUserTrustScore()` — after computing local score, if `community_score == 0` (no interactions), fetch user's other community memberships and compute carried floor
3. New helper: `getCarriedTrustScore(userId, targetCommunityId)` in a new `trustCarryDb.ts`
   ```sql
   SELECT MAX(ts.score) as max_other_score
   FROM reputation.trust_scores ts
   JOIN community.members cm ON ts.user_id = cm.user_id AND ts.community_id = cm.community_id
   WHERE ts.user_id = $1
     AND ts.community_id != $2
     AND cm.status = 'active'
   ```
4. Wire carry into `getUserTrustScore()` response
5. Tests: unit tests for carry formula, integration test for full flow

### Phase 3 (future)
- `trust_carry_min_source_score` config
- Negative-signal carry model (if designed)
- Federation carry (pending federation ADR)

---

## References

- [ADR-037: Multi-Signal Trust Score](ADR-037-multi-signal-trust-score.md) — Open Question #5
- [ADR-035: Karma Allocation and Trust Score Abstraction](ADR-035-karma-allocation-trust-score-strategy.md)
- [ADR-030: Community Configuration System](ADR-030-community-configuration-system.md) — `community_configs` JSONB pattern
- `services/reputation-service/src/services/trustScoreStrategy.ts` — current formula
- `services/reputation-service/src/services/karmaService.ts` — `getUserTrustScore()`
