# ADR-045: Network Cohesion Score

**Status**: Implemented
**Date**: 2026-03-10
**Author**: Karmyq Core Team

---

## Context

ADR-040 introduced a Community Trust Score measuring member quality and bonding/bridging social capital rates. That model captures *who* the members are and *whether* help gets completed, but it does not capture the structural properties of the helping network itself.

Graph topology metrics answer different questions:

- **Reciprocity**: Does help flow both ways, or is the community a one-way charity relationship?
- **Density**: How connected are members — are most people helping most other people, or is help concentrated among a clique?
- **Clustering**: Do members form tight supportive sub-groups (high clustering coefficient)?
- **Path length**: How quickly can support spread from one member to any other?

These structural signals reveal whether the community is a genuine mutual aid network — one where members support each other fluidly — or whether it has structural fragilities (a hub-and-spoke topology, isolated cliques, or very few reciprocal relationships) that could cause it to collapse if key members leave.

The ADR-040 score is preserved unchanged. The Network Cohesion Score is a complementary structural signal, not a replacement.

---

## Decision

Introduce a **Network Cohesion Score** (0–100) computed from four graph topology metrics over a rolling 90-day window. Both the active member set and the edge data (help interactions) are scoped to this window.

### Metrics

#### 1. Reciprocity (weight: 0.30)

The fraction of directed edges that have a corresponding reverse edge. Measures whether help flows both ways between member pairs.

```
reciprocal_pairs = count of (A→B, B→A) pairs where both directions exist
total_pairs      = count of distinct ordered pairs (A, B) where A helped B
Reciprocity      = reciprocal_pairs / total_pairs   (0 if total_pairs == 0)
```

#### 2. Density (weight: 0.20)

The fraction of possible connections that are actually realized. Measures how broadly help is distributed across the member set.

```
actual_edges     = count of distinct (helper, requester) pairs in the window
N                = active member count in the window
possible_edges   = N × (N - 1)
Density          = actual_edges / possible_edges   (0 if N < 2)
```

#### 3. Clustering Coefficient (weight: 0.30)

The average local clustering coefficient across all nodes. Measures whether a member's helpers also help each other — i.e., how well-knit the local neighborhoods are.

```
For each node i with degree k_i ≥ 2:
  local_cc_i = (triangles through i) / (k_i × (k_i - 1) / 2)

ClusteringCC = mean(local_cc_i) over all nodes with k_i ≥ 2
             = 0 if no node has degree ≥ 2
```

#### 4. Path Score (weight: 0.20)

An inverse-normalized average shortest path length. Short average paths mean support can spread quickly to any member.

```
avg_path_length = average shortest path between all connected pairs
                  (ignoring disconnected pairs; 0 if graph has < 2 nodes)

PathScore = 1 / avg_path_length   capped at 1.0
          = 0 if avg_path_length == 0
```

### Composite Formula

```
score = round(
  (Reciprocity × 0.30 + Density × 0.20 + ClusteringCC × 0.30 + PathScore × 0.20)
  × 100
)
```

Score is an integer 0–100.

### Labels

| Score Range | Label |
|-------------|-------|
| ≥ 80 | Highly Cohesive |
| ≥ 60 | Cohesive |
| ≥ 40 | Developing |
| ≥ 20 | Emerging |
| < 20 | Fragile |

---

## Consequences

### Positive

- Surfaces structural network health that the ADR-040 bonding/bridging score does not capture
- Reciprocity metric specifically rewards genuine mutual aid (bidirectional) vs. one-way charity dynamics
- 90-day rolling window ensures the score reflects current network structure, not historical activity
- Computed daily via cron alongside existing ADR-040 scores — no new cron infrastructure needed
- Labels are human-readable and surfaced in the community admin Stats tab

### Negative / Trade-offs

- Graph algorithms (BFS for path length, triangle counting for clustering) are computationally heavier than simple aggregation; acceptable at community scale (hundreds, not millions, of members)
- Average path length is undefined for disconnected graphs — isolated members are excluded from path calculation rather than penalized, which may understate fragility in sparse communities
- Small communities (< 5 active members) will produce noisy scores; no minimum floor is applied in Phase 1 (deferred, same as ADR-040)

---

## Implementation

**New columns on `reputation.community_trust_scores`** (migration 025):

```sql
ALTER TABLE reputation.community_trust_scores
  ADD COLUMN IF NOT EXISTS previous_score INTEGER,
  ADD COLUMN IF NOT EXISTS previous_calculated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS network_cohesion_score INTEGER,
  ADD COLUMN IF NOT EXISTS network_reciprocity NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS network_density NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS network_clustering NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS network_avg_path_length NUMERIC(6,4);
```

**New files**:
- `services/reputation-service/src/services/networkCohesionService.ts` — `calculateNetworkCohesion(communityId)`, `calculateAllNetworkCohesionScores()`

**Modified files**:
- `services/reputation-service/src/services/healthMetricsService.ts` — wire `calculateAllNetworkCohesionScores()` into daily cron
- `services/reputation-service/src/routes/reputation.ts` — `GET /reputation/network-metrics/:communityId`

**Endpoint**: `GET /reputation/network-metrics/:communityId`

Returns:
```json
{
  "community_id": "...",
  "network_cohesion_score": 67,
  "label": "Cohesive",
  "reciprocity": 0.42,
  "density": 0.18,
  "clustering": 0.61,
  "avg_path_length": 2.3,
  "active_member_count": 22,
  "window_days": 90,
  "last_calculated": "2026-03-10T..."
}
```

Displayed in the community admin Stats tab alongside the ADR-040 community trust score.

---

## Open Questions (Phase 2)

1. **Minimum activity floor**: Should communities with fewer than 5 active members return `null` rather than a potentially noisy score?
2. **Disconnected components**: Should isolated sub-graphs be flagged explicitly (e.g., a `fragmentation_index` field)?
3. **Trend display**: Should the admin UI show score delta vs. previous calculation to surface improving/declining cohesion?
