# Sprint 74: Trust Graph Foundation — Design Spec

**Date**: 2026-05-29
**Status**: Approved
**Version**: v10.2.0 → v10.3.0
**Sprint Branch**: `feature/sprint-74-trust-graph-foundation`

---

## Overview

The trust graph is currently the least useful screen in Karmyq. It shows an ego-network (you + direct neighbors) that requires repeated node-clicking to explore — and even fully expanded, it never shows the whole community's topology. Users open it, see a handful of nodes, and close it. It adds no value.

This sprint replaces that model with two distinct, purposeful views:

**Community graph** — a full network view of all community members (up to 150, ranked by trust score) with all their connections visible at once. Edge thickness and opacity encode connection strength. Edges touching the current user are highlighted in a distinct color so you can immediately see where you sit in the larger network. No clicking required.

**Ego-network** — kept as a separate sub-view, but pre-loaded to 2 degrees on mount so the expansion UX is eliminated. Click to recenter on a neighbor, not to reveal them.

The goal: open the graph, immediately understand the community's trust topology, immediately see how you connect into it.

### Core Principle: Show the Network, Not the Ego

Every prior design decision in the trust graph was ego-centric. This sprint inverts that for the community view — the community's topology is the primary visual, and "you" are a highlighted layer on top of it.

---

## Multi-Sprint Trust Graph Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **74** | Foundation — full community graph, visual encoding, screen space | ⬅ This sprint |
| **75** | Depth — inter-community zoom view, fission edge differentiation | Upcoming |
| **76** | Governance + Admin polish | Upcoming |

---

## API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/trust/graph/:communityId/full` | Full community graph (up to 150 members + all their edges) | JWT + community member |

### Route registration order — CRITICAL

The new `/trust/graph/:communityId/full` route MUST be registered **before** the existing `/trust/graph/:communityId` route. If registered after, Express will match `full` as the `communityId` param and never reach the correct handler.

### Response shape

```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "uuid",
        "name": "Alice",
        "trust_score": 42.5,
        "karma": 180,
        "isCurrentUser": true
      }
    ],
    "links": [
      {
        "source": "uuid-a",
        "target": "uuid-b",
        "raw_weight": 12,
        "effective_weight": 8.4
      }
    ]
  }
}
```

### Query design — `getFullCommunityGraph(communityId, callingUserId)`

The query selects the top 149 members by trust score + always includes the calling user (even if outside top 149), then returns all edges between that member set.

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
  (SELECT $2::uuid)   -- always include the calling user
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

Edges query uses the same `top_members` CTE to return only edges between members in the result set.

---

## Frontend Changes

### TrustGraph.tsx — visual encoding overhaul

| Property | Before | After |
|----------|--------|-------|
| `mode` prop | `'default' \| 'fission'` | `'ego' \| 'community' \| 'fission'` |
| Edge width | Fixed or minimal | `Math.max(1, Math.log1p(effective_weight) * 1.5)` |
| Edge opacity | Fixed | `0.15 + 0.75 * (effective_weight / maxEffectiveWeight)` |
| Edge color (default) | Single color | `rgba(148, 163, 184, 0.5)` — muted slate |
| Edge color (my connections) | None | `rgba(251, 146, 60, 0.85)` — amber highlight |
| Node size | Fixed | `5 + Math.min(trust_score / 10, 15)` (range 5–20px) |
| Current user node | Slightly larger | 22px + bright accent ring |
| Click behavior (community mode) | Expand ego | Recenter graph on node (no data fetch) |
| Graph container height | ~400px | 600px minimum, fills available space |

The "my connections" highlight layer: any edge where `source === currentUserId || target === currentUserId` renders in amber. All other edges render in muted slate. This means "you" read as a visual layer on top of the community network, not just another node.

### TrustGraphTab.tsx — community full graph

Replace the single ego-network view with two sub-tabs:

- **Community** tab: calls `GET /trust/graph/:communityId/full`, renders all members + edges in `community` mode. No expansion. This is the default.
- **My Network** tab: keeps existing ego-network, but pre-loads 2 degrees on mount (no clicking required to see neighbors).

### Ego-network 2-degree pre-load

The existing `getTrustGraph` query already fetches the calling user's neighbors and their mutual connections. "2 degrees pre-loaded" means: on mount, load the ego-network once. Do not require clicking to expand neighbors. The click handler on nodes recenters (re-fetches with `center=nodeId`) rather than appending.

### Screen space

- TrustGraphTab container: increase from fixed height to `min-h-[600px] h-[calc(100vh-300px)]`
- Graph canvas: `width="100%" height="100%"` so it fills the container
- Remove padding/margin that was artificially constraining the graph div

### API client (api.ts)

Add to `socialGraphService`:

```typescript
getFullCommunityGraph: (communityId: string) =>
  api.get(`/social-graph/trust/graph/${communityId}/full`)
```

---

## User Guide & Doc Updates

- **Update** `apps/landing/src/data/docs/guides/trust-graph.json` (or create if missing) — explain community graph vs ego-network views, what edge thickness means, what the amber highlights mean
- **Update** `apps/landing/src/data/docs/concepts/trust-graph.json` — add full community topology section, describe the 150-member cap and ranking
- **Update** `services/social-graph-service/CONTEXT.md` — document new `/trust/graph/:communityId/full` endpoint
- **Update** `services/registry.json` — add new endpoint to social-graph-service `apis.provides`

---

## Critical Implementation Notes

1. **Route order matters**: Register `GET /trust/graph/:communityId/full` BEFORE `GET /trust/graph/:communityId` in the route file. Express matches params greedily — "full" will be treated as a communityId if the full-graph route is registered second.

2. **trust_edges_live is a VIEW**: Never INSERT or UPDATE it. Write to `trust_edges`, read from `trust_edges_live`.

3. **trust_edges normalized**: `social_graph.trust_edges` requires `user_id_a::text < user_id_b::text`. The full community graph edges query reads from `trust_edges_live` directly, so normalization is already enforced — no need to re-sort in the query.

4. **Calling user always included**: The 150-node cap is `top 149 by trust_score UNION calling_user`. This prevents the current user from disappearing from the community graph if they have low trust.

5. **Edge weight normalization**: `maxEffectiveWeight` must be computed from the returned dataset, not assumed. Compute it client-side after the API response arrives: `Math.max(...links.map(l => l.effective_weight))`.

6. **react-force-graph-2d canvas rendering**: Edge color and width are set via `linkColor` and `linkWidth` props as functions — `(link) => isMyEdge(link) ? '#fb923c' : 'rgba(148,163,184,0.5)'`. Node size via `nodeVal` prop.

7. **Landing docs in .gitignore**: `apps/landing/src/data/docs/` is gitignored — always `git add -f` those files.

8. **nav.json revert bug**: `generate-docs.ts` regenerates nav.json. Any new guide/concept slugs must be added to `GUIDE_ORDER`, `GUIDE_LABELS`, and `GUIDE_SLUGS` in `scripts/generate-docs.ts`. Run `npm run generate-docs` from `apps/landing/`, not root.
