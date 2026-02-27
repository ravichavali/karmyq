# ADR-040: Community Trust Score

**Status**: Implemented
**Date**: 2026-02-27
**Author**: Karmyq Core Team

---

## Context

Karmyq computes trust scores for individual users (ADR-037), but communities themselves have no trust signal. A user considering whether to post a request in a new community — or whether to trust an offer from a member of an unfamiliar community — has no way to assess the community's reliability as a mutual aid network.

Communities vary in how they operate: some are tightly-knit groups focused on helping their own members (bonding social capital), others are open networks that reach across community lines to help anyone (bridging social capital). Both are valuable, but they are different — a neighborhood mutual aid group and an open cross-community helpdesk should be measured differently.

Putnam's distinction between bonding and bridging social capital (from "Bowling Alone") provides the theoretical framework: **bonding capital** deepens ties within a group, while **bridging capital** creates connections across groups. The individual trust formula (ADR-037) already reflects this via `depth_weight` (bonding) and `breadth_weight` (bridging). This ADR applies the same principle at the community level.

---

## Decision

Introduce a **Community Trust Score** (0–100) that measures how reliably a community fulfills its mutual aid purpose. The score has three components:

### 1. Member Quality (40 pts)

The average trust score of members who have been active in the last 90 days. Measures: *are the people in this community trustworthy?*

```
member_quality_score = (avg_member_trust_score / 100) × 40
```

### 2. Bonding Score (up to 30 pts, scaled by bonding_weight)

Internal cohesion — how well the community helps *each other*.

Two sub-signals:
- **Completion rate**: % of matched requests completed in the last 90 days
- **Retention rate**: % of members with 2+ completed interactions ever

```
bonding_raw = completion_rate × 0.5 + retention_rate × 0.5
bonding_score = bonding_raw × bonding_weight × 30
```

### 3. Bridging Score (up to 30 pts, scaled by bridging_weight)

External reach — how much the community engages *across* community lines.

Two sub-signals:
- **Cross-community interaction rate**: fraction of interactions involving members from other communities
- **External help rate**: fraction of help provided to people outside this community

```
bridging_raw = cross_community_rate × 0.5 + external_help_rate × 0.5
bridging_score = bridging_raw × bridging_weight × 30
```

### Final Formula

```
community_trust_score = clamp(0, 100, member_quality_score + bonding_score + bridging_score)
```

### Community Configuration

Communities control the bonding/bridging balance via two configurable weights (new columns in `communities.community_configs`):

| Field | Default | Meaning |
|-------|---------|---------|
| `community_trust_bonding_weight` | 0.60 | Weight toward internal cohesion |
| `community_trust_bridging_weight` | 0.40 | Weight toward external reach |

Weights are independent (not required to sum to 1.0), consistent with ADR-037's approach to depth/breadth weights.

**Example configurations**:
- Neighborhood mutual aid group: `bonding=0.8, bridging=0.2`
- Open cross-community helpdesk: `bonding=0.3, bridging=0.7`
- Default (balanced): `bonding=0.6, bridging=0.4`

---

## Consequences

### Positive
- Communities have a trust signal visible to members and potential members
- The bonding/bridging distinction prevents communities from being penalized for being either highly internal or highly external — both are valid
- Configurable weights let community admins tune to their identity
- The 90-day window ensures the score reflects current community health, not historical activity
- Scores are computed daily (alongside existing health metrics) — no new cron infrastructure needed

### Negative / Trade-offs
- Member quality score (40%) means a community of high-trust users scores well even with low activity — acceptable because trustworthy members are a key community asset
- Cross-community interaction rate approximation may undercount bridging in multi-community requests — acceptable for Phase 1

---

## Implementation

**New files**:
- `infrastructure/postgres/migrations/021-community-trust-scores.sql` — `reputation.community_trust_scores` table + new config columns
- `services/reputation-service/src/database/communityTrustDb.ts` — `getCommunityTrustScore()`, `upsertCommunityTrustScore()`
- `services/reputation-service/src/services/communityTrustService.ts` — `calculateCommunityTrustScore()`, `calculateAllCommunityTrustScores()`

**Modified files**:
- `services/reputation-service/src/services/healthMetricsService.ts` — wire into daily cron
- `services/reputation-service/src/routes/reputation.ts` — `GET /reputation/community-trust/:communityId`

**Endpoint**: `GET /reputation/community-trust/:communityId`

Returns:
```json
{
  "community_id": "...",
  "score": 72,
  "member_quality_score": 30,
  "bonding_score": 25,
  "bridging_score": 17,
  "active_member_count": 14,
  "last_calculated": "2026-02-27T..."
}
```

---

## Open Questions (Phase 3)

1. **Score visibility**: Should community trust scores be public (visible to non-members) or private (admin only)?
2. **Minimum activity floor**: Should communities with fewer than N active members (e.g. 3) be excluded from scoring?
3. **Score surfacing**: Display community trust in community search/discovery so prospective members can compare communities
4. **Trust decay for communities**: Should inactive communities see their score decay over time (similar to individual trust)?
