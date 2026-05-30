# Sprint 74: Trust Graph Foundation — Design Spec

**Date**: 2026-05-29
**Status**: Approved
**Version**: v10.2.0 → v10.3.0
**Sprint Branch**: `feature/sprint-74-trust-graph-foundation`

---

## Overview

The trust graph is currently the least useful screen in Karmyq. It shows a click-heavy ego-network that never reveals the full community topology, uses a single force-directed layout for every context, and is rendered in undersized containers. Users open it, see a handful of nodes, and close it.

This sprint replaces the one-size-fits-all force-directed graph with three purpose-built visualizations — each chosen for what it needs to communicate:

**Hierarchical Edge Bundling (community + fission views)** — all nodes arranged on a circle, grouped by their cluster. Edges within clusters bundle tightly; cross-cluster edges are thin threads. Dense communities show their dominant structure immediately. Weak cross-cluster edges look exactly like what they are: the threads that would break in a split.

**Radial/Concentric Layout (ego / "My Network" view)** — you at the absolute center. Direct connections in ring 1, ordered by strength clockwise. Their connections in ring 2. Degree of separation is a spatial property, not something you click to reveal. No expansion required.

**Fission view** — same HEB as the community graph, but cluster assignment comes from the proposed split groups (A/B) rather than algorithmic detection. Cross-group edges read as the contested connections that make a split hard.

### Core Principle: Visualization Serves the Question

Each view answers a different question. Community HEB: "what's the structure of this community?" Ego radial: "how do I connect into it?" Fission HEB: "why does this split make sense?"

---

## Multi-Sprint Trust Graph Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **74** | Foundation — three-visualization architecture, full community graph endpoint | ⬅ This sprint |
| **75** | Depth — inter-community zoom view (communities as nodes, zoom in) | Upcoming |
| **76** | Community / Governance Polish | Upcoming |

---

## Libraries

| Library | Purpose | Added this sprint |
|---------|---------|-------------------|
| `d3` | Hierarchical edge bundling (community + fission views) | Yes |
| `@types/d3` | TypeScript types for D3 | Yes |
| `cytoscape` | Graph library for radial/concentric layout | Yes |
| `react-cytoscapejs` | React wrapper for Cytoscape.js | Yes |
| `@types/cytoscape` | TypeScript types | Yes |
| `react-force-graph-2d` | Existing — kept for NetworkGraph aggregate view | No change |

---

## New API Endpoint

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/trust/graph/:communityId/full` | Full community graph (up to 150 members + all inter-member edges) | JWT + community member |

### Route registration order — CRITICAL

Register `GET /trust/graph/:communityId/full` **before** `GET /trust/graph/:communityId`. Express matches params greedily — "full" matches as a communityId if registered second.

### Response shape

```json
{
  "success": true,
  "data": {
    "nodes": [
      { "id": "uuid", "name": "Alice", "trust_score": 42.5, "karma": 180, "isCurrentUser": true }
    ],
    "links": [
      { "source": "uuid-a", "target": "uuid-b", "raw_weight": 12, "effective_weight": 8.4 }
    ]
  }
}
```

### Query design — `getFullCommunityGraph(communityId, callingUserId)`

Top 149 members by trust score UNION the calling user (always included). All edges between that member set read from `trust_edges_live`.

```sql
WITH active_members AS (
  SELECT user_id FROM communities.members
  WHERE community_id = $1 AND status = 'active'
),
member_scores AS (
  SELECT
    am.user_id,
    COALESCE(SUM(tel.current_weight), 0) AS trust_score
  FROM active_members am
  LEFT JOIN social_graph.trust_edges_live tel
    ON (tel.user_id_a = am.user_id OR tel.user_id_b = am.user_id)
    AND tel.community_id = $1
  GROUP BY am.user_id
),
top_members AS (
  (SELECT user_id FROM member_scores ORDER BY trust_score DESC LIMIT 149)
  UNION
  (SELECT $2::uuid)
)
SELECT
  u.id, u.name,
  COALESCE(ms.trust_score, 0) AS trust_score,
  COALESCE((
    SELECT SUM(kr.points) FROM reputation.karma_records kr
    WHERE kr.user_id = u.id AND kr.community_id = $1
  ), 0) AS karma,
  (u.id = $2::uuid) AS is_current_user
FROM top_members tm
JOIN auth.users u ON u.id = tm.user_id
LEFT JOIN member_scores ms ON ms.user_id = tm.user_id;
```

---

## Frontend Architecture

### Component structure

```
TrustGraph.tsx (router — selects component by mode)
├── graphs/TrustGraphHEB.tsx   (D3 SVG — community + fission views)
└── graphs/TrustGraphRadial.tsx (Cytoscape.js — ego / My Network view)
```

`react-force-graph-2d` remains in `NetworkGraph.tsx` for the cross-community aggregate view — not changed this sprint.

---

## TrustGraphHEB.tsx — Hierarchical Edge Bundling

### How it works

1. **Cluster detection** (client-side, greedy union-find):
   - Sort edges by `effective_weight` descending
   - Use union-find to merge nodes connected by strong edges
   - Result: `Map<nodeId, clusterId>`
   - For fission mode: cluster assignment comes directly from the `groupMap` prop (A/B), skipping detection

2. **Radial layout (D3)**:
   - Build a `d3.hierarchy` tree: `root → [cluster-0, cluster-1, ...] → [nodes]`
   - `d3.cluster().size([2 * Math.PI, radius])` computes angular positions
   - Nodes arranged on circle, sorted by cluster (so same-cluster nodes are adjacent)

3. **Edge bundling (D3)**:
   - `d3.lineRadial().curve(d3.curveBundle.beta(0.85))` creates bundled splines
   - Beta 0.85: strong bundling within clusters, looser cross-cluster paths
   - Edge stroke-width: `Math.max(0.5, Math.log1p(effective_weight) * 1.2)`
   - Edge opacity: `0.1 + 0.7 * (effective_weight / maxEffectiveWeight)`
   - Same-cluster edges: `rgba(99, 102, 241, 0.6)` (indigo)
   - Cross-cluster edges: `rgba(148, 163, 184, 0.25)` (muted slate — thin threads)
   - My edges (touching currentUserId): `rgba(251, 146, 60, 0.85)` (amber, always on top)

4. **Node rendering**:
   - Small circles (r = 4–8px based on trust_score)
   - Node label rotated along the circle (readable at each angle)
   - Current user node: larger, accent color, label bold

### Fission mode differences

- Cluster A = group A nodes, Cluster B = group B nodes (from `groupMap` prop, no detection)
- Same-cluster edges: green (`rgba(34, 197, 94, 0.6)`)
- Cross-cluster edges: red/muted (`rgba(239, 68, 68, 0.3)`)
- Cross-cluster edges = the contested connections that make a split costly

---

## TrustGraphRadial.tsx — Cytoscape Concentric Layout

### Layout config

```typescript
const layout = {
  name: 'concentric',
  concentric: (node: cytoscape.NodeSingular) => {
    if (node.data('isCurrentUser')) return Infinity; // center
    return node.data('trust_score') + 1;             // ring by trust score
  },
  levelWidth: () => 3,   // max 3 nodes per ring level
  minNodeSpacing: 30,
  equidistant: false,
};
```

### Style

- Edge width: `line-width: mapData(effective_weight, 0, maxWeight, 1, 6)`
- Edge opacity: `opacity: mapData(effective_weight, 0, maxWeight, 0.2, 0.9)`
- My edges (touching current user): `line-color: #fb923c` (amber)
- Other edges: `line-color: #94a3b8` (slate)
- Current user node: `background-color: #6366f1`, size 36px
- Other nodes: `background-color: #64748b`, size `mapData(trust_score, 0, maxScore, 16, 32)`
- Node label: name, font-size 10px

### Interaction

- Clicking a node recenters by re-fetching `getTrustGraph(communityId, nodeId)` (existing behavior, no expansion needed since 2 degrees are pre-loaded on mount)

---

## TrustGraphTab.tsx — Updated

Two sub-tabs replacing the single ego view:

| Sub-tab | View | Data source |
|---------|------|-------------|
| **Community** | TrustGraphHEB (community mode) | `GET /trust/graph/:communityId/full` |
| **My Network** | TrustGraphRadial (concentric) | `GET /trust/graph/:communityId` (existing, pre-loaded) |

Default: Community tab.

Container: `min-h-[600px] h-[calc(100vh-320px)]`

---

## FissionTab.tsx — Updated

Replace `<TrustGraph mode="fission" />` with `<TrustGraphHEB mode="fission" groupMap={groupMap} />`.
Pass `groupMap` (existing: `Map<userId, 'A' | 'B'>`) directly — the HEB uses it as the cluster assignment, bypassing cluster detection.

---

## User Guide & Doc Updates

- **Create/update** `apps/landing/src/data/docs/guides/trust-graph.json` — explain the three views, what edge bundling shows, what the concentric rings mean
- **Update** `apps/landing/src/data/docs/concepts/trust-graph.json` — community topology section, HEB explanation
- **Update** `services/social-graph-service/CONTEXT.md` — document new endpoint
- **Update** `services/registry.json` — add endpoint

---

## Critical Implementation Notes

1. **Route order**: `GET /trust/graph/:communityId/full` must be registered before `GET /trust/graph/:communityId`. Express matches `full` as a communityId otherwise.

2. **trust_edges_live is a VIEW**: Never INSERT/UPDATE. Read from `trust_edges_live`, write to `trust_edges`.

3. **Calling user always included**: `top 149 UNION calling_user_uuid`. Do not remove the UNION.

4. **D3 HEB angle math**: D3's cluster layout uses radians. Node positions are `(angle, radius)`. Converting to Cartesian: `x = r * Math.cos(angle - Math.PI / 2)`, `y = r * Math.sin(angle - Math.PI / 2)`. The `lineRadial` generator handles this natively.

5. **d3.curveBundle requires the hierarchical path**: To bundle edges, you must provide the hierarchical path from source to LCA to target. The standard pattern: for each link, compute `source.path(target)` using d3-hierarchy's `.path()` method, then pass to the line generator.

6. **Cytoscape mapData**: The `mapData(field, from, to, mapFrom, mapTo)` CSS function requires the `min`/`max` of the field across the dataset. Compute `maxWeight` and `maxScore` from the data before passing to Cytoscape stylesheet.

7. **react-cytoscapejs SSR**: Next.js SSR will fail on Cytoscape import. Use `dynamic(() => import('./graphs/TrustGraphRadial'), { ssr: false })` in `TrustGraph.tsx`.

8. **D3 + React**: D3 manipulates the DOM directly; React also does. Use a `useEffect` with a `ref` to the SVG element. D3 renders into `svgRef.current` after mount. Cleanup: `d3.select(svgRef.current).selectAll('*').remove()` before re-render.

9. **Landing docs gitignored**: `apps/landing/src/data/docs/` — always `git add -f`.

10. **nav.json revert bug**: Add new guide slugs to `GUIDE_ORDER`, `GUIDE_LABELS`, `GUIDE_SLUGS` in `scripts/generate-docs.ts` before running `npm run generate-docs` from `apps/landing/`.
