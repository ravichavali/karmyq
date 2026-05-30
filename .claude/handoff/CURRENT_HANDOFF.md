# Sprint 74: Trust Graph Foundation — Ready to Execute

## Handoff Document

**Date**: 2026-05-29
**Current Version**: v10.2.0 (on master)
**Target Version**: v10.3.0
**Status**: Sprint 74 spec + plan written. Ready to execute.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-74-trust-graph-foundation`
3. Open plan: `docs/superpowers/plans/2026-05-29-sprint-74-trust-graph-foundation.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint Goal

Make trust graphs actually useful: replace the click-heavy ego-network with a **full community graph** (all members + edges, visible at once) and a smarter ego-view that pre-loads 2 degrees without clicking. Edge thickness and opacity encode connection strength. Amber highlights show the current user's connections in the community network.

---

## Multi-Sprint Trust Graph + Governance Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **72** | Simulation Engine | ✅ Complete + deployed |
| **73** | Request Service | ✅ Complete + deployed |
| **74** | Trust Graph Foundation | ⬅ This sprint |
| **75** | Trust Graph Depth (inter-community zoom, fission edge differentiation) | Upcoming |
| **76** | Community / Governance Polish | Upcoming |

---

## Spec + Plan

- **Design spec**: `docs/superpowers/specs/2026-05-29-sprint-74-trust-graph-foundation-design.md`
- **Implementation plan**: `docs/superpowers/plans/2026-05-29-sprint-74-trust-graph-foundation.md`

---

## Visualization Architecture (revised)

Three purpose-built visualizations replace the single force-directed graph:

| View | Component | Library | When |
|------|-----------|---------|------|
| Community full graph | `TrustGraphHEB.tsx` | D3 (hierarchical edge bundling) | Community tab default |
| My Network (ego) | `TrustGraphRadial.tsx` | Cytoscape.js (concentric) | My Network sub-tab |
| Fission split | `TrustGraphHEB.tsx` (fission mode) | D3 HEB, A/B as clusters | FissionTab |
| Cross-community aggregate | `NetworkGraph.tsx` | react-force-graph-2d (unchanged) | Not changed this sprint |

`TrustGraph.tsx` becomes a thin mode router. `react-force-graph-2d` stays only for `NetworkGraph.tsx`.

New deps: `d3`, `@types/d3`, `cytoscape`, `react-cytoscapejs`, `@types/cytoscape`

## What This Sprint Ships

### Backend (social-graph-service)
- New function `getFullCommunityGraph(communityId, callingUserId)` in `trustEdgeDb.ts`
  - Top 149 members by trust score + calling user always included (UNION)
  - All edges between those members from `trust_edges_live`
- New route `GET /trust/graph/:communityId/full` (registered BEFORE `/:communityId` — see gotcha #1)

### Frontend
- `graphs/TrustGraphHEB.tsx`: D3 hierarchical edge bundling — nodes on a circle by cluster, bundled splines, strong/weak edge differentiation, amber highlights for my connections
- `graphs/TrustGraphRadial.tsx`: Cytoscape.js concentric — you at center, rings by trust score, 2-degree pre-loaded
- `TrustGraph.tsx`: thin router (mode → component)
- `TrustGraphTab.tsx`: Community tab (HEB) + My Network tab (Radial)
- `FissionTab.tsx`: uses HEB with A/B groupMap as cluster assignment
- `NetworkGraph.tsx`: screen space improvements only

## Simplify Standard
Run `/simplify` after each implementation task before moving to the next.

### Docs
- Trust graph user guide (landing)
- Trust graph concept page update (landing)
- social-graph-service CONTEXT.md + registry.json

### Version
- 10.2.0 → 10.3.0

---

## ⚠️ Critical Implementation Notes

1. **Route order**: Register `GET /trust/graph/:communityId/full` BEFORE `GET /trust/graph/:communityId`. Express matches `full` as a communityId if registered second — silently breaks both routes.

2. **trust_edges_live is a VIEW**: Never INSERT/UPDATE. Write to `trust_edges`, read from `trust_edges_live`.

3. **Calling user always included**: `top 149 UNION calling_user_uuid`. Never drop the UNION.

4. **D3 HEB angle math**: `d3.lineRadial().curve(d3.curveBundle.beta(0.85))`. For each link call `source.path(target)` from d3-hierarchy to get the bundling path.

5. **react-cytoscapejs SSR crash**: Use `dynamic(() => import('./graphs/TrustGraphRadial'), { ssr: false })` in `TrustGraph.tsx`.

6. **D3 + React DOM conflict**: Render D3 into `svgRef.current` in a `useEffect`. Always `d3.select(svgRef.current).selectAll('*').remove()` before re-rendering.

7. **Cytoscape mapData**: Compute `maxWeight` and `maxScore` from the data before building the stylesheet — `mapData` needs explicit min/max.

8. **Landing docs gitignored**: `apps/landing/src/data/docs/` — always `git add -f`.

9. **nav.json revert bug**: Add new slugs to `GUIDE_ORDER`, `GUIDE_LABELS`, `GUIDE_SLUGS` in `scripts/generate-docs.ts` before running `npm run generate-docs` from `apps/landing/`.

---

## Pre-Existing TDD Failures (do NOT fix)

These were failing before Sprint 73 and should remain untouched:
- `sprint-39-provider-ux` (7 fail)
- `sprint-43-feed-ranking` (crashes)
- `admin-schemas-api.test.ts` (request-service)
- `sprint-68-halflife` (6 DB connection tests)
- `sprint-67-governance` (DB connection tests)
- `social-graph-service/tests/tdd/sprint-66-trust-graph-visualization.test.ts`
- `social-graph-service/tests/tdd/sprint-67-ego-network.test.ts`
- `social-graph-service/tests/tdd/sprint-68-halflife.test.ts`

---

## Architecture Gotchas (Persistent)

- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`
- **ADR numbering**: Next ADR is **059**
- **ADR-057 and ADR-058**: Already `implemented` in both source `.md` and landing `.json`
- **TDD test placement**: Social graph service tests in `services/social-graph-service/tests/tdd/`
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **`git add` on CLAUDE.md**: Tracked as lowercase `claude.md` — always `git add claude.md`
- **Solo dev — no worktrees**: Work directly on feature branches
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json — always add new slugs to GUIDE_ORDER + GUIDE_LABELS + GUIDE_SLUGS in `scripts/generate-docs.ts`; run generate-docs from `apps/landing/` (`npm run generate-docs`), not root
- **trust_edges_live is a VIEW**: Never INSERT/UPDATE it. Use `trust_edges` for writes, `trust_edges_live` for reads
- **API response unwrap**: `createApiClient` interceptor already unwraps envelope — use `res.data`, not `res.data.data`
- **trust_edges normalized constraint**: `social_graph.trust_edges` requires `user_id_a::text < user_id_b::text` — always sort
- **community_links UNIQUE**: fusion_origin links must be (merged↔A) and (merged↔B), NOT (A↔B)
- **Root package.json version**: 10.2.0 (→ 10.3.0 this sprint)
