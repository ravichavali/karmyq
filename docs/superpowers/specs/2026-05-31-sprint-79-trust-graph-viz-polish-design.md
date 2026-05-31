# Sprint 79: Trust Graph Viz Polish + Depth — Design Spec

**Date**: 2026-05-31
**Status**: Approved
**Version**: v10.6.2 → v10.7.0
**Sprint Branch**: `feature/sprint-79-trust-graph-viz-polish`

---

## Overview

Sprint 74 shipped the trust graph foundation: a **Community** view and a **Split (fission)** view, both rendered as hierarchical edge-bundled (HEB), cluster-revealing D3 graphs. Those two views land well and should be preserved. The two **ego/relationship** views did not: the per-community **"My Network"** sub-tab renders a Cytoscape *concentric* layout (`TrustGraphRadial`) and the dashboard **"Your Network"** renders a *force-directed* graph (`NetworkGraph`). Both fail to "tell the story of connectivity" — the radial view double-encodes trust (ring distance **and** dot size) while hiding who-connects-to-whom, and the force-directed view is an undifferentiated hairball. They also use a **different, inconsistent trust metric** than the community view.

This sprint unifies all relationship views onto the same graphical, clustered, structure-revealing HEB style, fixes the trust-metric inconsistency platform-wide, and adds the long-deferred **inter-community depth** view (communities as nodes, with fission lineage differentiated from organic cross-community ties). Three phases, sequenced by user impact: (1) ego-view rework, (2) metric consistency folded in, (3) inter-community depth.

### Core Principle: Position and color tell the story; size is not a variable

Encode connectivity through **layout (clustering, position, centrality)** and **categorical color** — never through dot size. Size carries no default meaning; the only node visually emphasized is the current user. A reader should see *who clusters with whom* and *where they sit*, not decode a second trust dimension from radius.

---

## Multi-Sprint Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **74** | Trust Graph Foundation (HEB Community + Split, radial ego) | ✅ Complete + deployed |
| **77** | Simulation Data Hygiene: Community De-duplication (ADR-062) | ✅ Complete + deployed (v10.6.0) |
| **78** | Autonomous Fission (propose→vote→execute) | ✅ Complete + deployed (v10.6.2) |
| **79** | **Trust Graph Viz Polish + Depth** (this sprint) | 📋 Ready to execute (v10.7.0) |
| **TBD** | Supply-Chain Hardening remainder (ADR-061 items 4–5; Socket App; log sanitization) | Backlog |

---

## New Concepts

- **Canonical trust metric (decayed).** A node's `trust_score` is **always** `SUM(current_weight)` read from the `social_graph.trust_edges_live` VIEW (interaction-half-life decayed), never `SUM(raw_weight)`. This becomes the single platform-wide definition (ADR-063). It already governs the community view; this sprint extends it to every ego/aggregate function.
- **Uniform node sizing.** All HEB node circles render at one fixed radius; only the current user is enlarged + ringed. `trust_score` no longer drives radius in any view. It remains available in the node detail panel and may inform cluster ordering, but is never size-encoded.
- **Inter-community (depth) graph.** A zoomed-out view where **nodes are communities** and **edges are inter-community ties**, of two kinds:
  - **Organic** — accumulated cross-community help exchanges, from `social_graph.community_trust_edges` (weight = `cross_interaction_count`).
  - **Fission** — parent→child lineage from executed splits (`communities.split_proposals` where `status='executed'`), rendered distinctly (dashed, differentiated color).

---

## Data Model

**No schema changes.** Every input already exists:

- `social_graph.trust_edges_live` (VIEW) — `current_weight` for the decayed metric.
- `social_graph.community_trust_edges` — organic inter-community edges (`community_id_a`, `community_id_b`, `cross_interaction_count`, `weight`), already upserted by `processMatchCompleted` on cross-community matches.
- `communities.split_proposals` — fission lineage (`community_id` = parent, `child_community_a_id`, `child_community_b_id`, `status='executed'`, `executed_at`).
- `communities.communities` — community node attributes (`name`, `current_members`, `status`).

> **trust_edges_live is a VIEW** — read-only. Never INSERT/UPDATE it. Write `trust_edges`, read `trust_edges_live`.

---

## API Endpoints

| Method | Path | Description | Auth | Response |
|--------|------|-------------|------|----------|
| GET | `/trust/graph/:communityId` | Per-community ego-network. **Changed**: node `trust_score` now decayed (`current_weight`). | Member of community | `{ nodes, links }` |
| GET | `/trust/graph` | Cross-community aggregate ego-network. **Changed**: node `trust_score` now decayed. | Authenticated | `{ nodes, links }` |
| GET | `/trust/graph?center=:userId` | Neighbor ego expansion (shared communities). **Changed**: decayed metric. | Authenticated | `{ nodes, links }` |
| GET | `/trust/communities` | **New.** Inter-community depth graph for the calling user: community nodes + organic edges + fission edges. | Authenticated | `{ nodes: CommunityNode[], links: CommunityLink[] }` |

`CommunityNode`: `{ id, name, member_count, status }`
`CommunityLink`: `{ source, target, weight, type: 'organic' \| 'fission' }`

`/trust/graph/:communityId/full` (community view) is **unchanged** — it already uses the decayed metric.

---

## Frontend Changes

### Phase 1 — Ego-view rework (primary)

- **`TrustGraphHEB.tsx`** (modify): add an `'ego'` mode (cluster color + amber-your-edges, current-user emphasis — visually the community style applied to ego data). Make `nodeRadius` **uniform** across *all* modes (community, fission, ego); only the current user is enlarged + white-ringed. Removes `trust_score → radius` mapping everywhere.
- **`TrustGraph.tsx`** (modify): the dispatcher's `ego` mode now routes to `TrustGraphHEB` (was `TrustGraphRadial`).
- **`TrustGraphTab.tsx`** ("My Network" sub-tab in community detail): render via HEB ego mode; drop radial.
- **`NetworkGraph.tsx`** (dashboard "Your Network"): **replace** the force-directed react-force-graph implementation with a **static clustered HEB** view fed by `getTrustGraphAggregate()`. **Drop** click-to-expand progressive expansion; node click opens the detail panel. (Confirmed decision: structure-first static clustered view.)
- **`TrustGraphRadial.tsx`** (delete): no longer referenced after the dispatcher change. Remove `react-cytoscapejs`/`cytoscape` from `apps/frontend` deps if nothing else imports them (verify with grep first).

### Phase 3 — Inter-community depth view

- **`CommunityDepthGraph.tsx`** (new): communities-as-nodes graph fed by `GET /trust/communities`. Organic edges solid (weight → opacity/width), fission edges dashed + differentiated color. Current user's communities emphasized; node click → detail panel (name, members, status, tie breakdown).
- **Dashboard network section** (modify, e.g. `profile.tsx` / dashboard host of `NetworkGraph`): add a view toggle — **People** (`NetworkGraph`, ego) vs **Communities** (`CommunityDepthGraph`, depth).
- **`api.ts`** (modify): add `socialGraphService.getCommunityGraph()` → `GET /trust/communities`.

---

## User Guide & Doc Updates

- **`docs/guides/trust-graph.md`** (create or update): how to read each view — Community, Split, My Network, Your Network, **Communities (depth)**. Document the uniform-sizing convention ("dot size carries no meaning; color = cluster, amber = your ties, larger ringed dot = you") and the decayed trust metric. Add the new Communities view + how to read organic vs fission edges.
- **`apps/landing/src/data/docs/concepts/`** — new/updated concept page **"Reading the Trust Graph"** covering the unified visual language + depth view.
- **`apps/landing/src/data/docs/concepts/adr-063-*.json`** — ADR-063 (canonical trust metric + unified visualization), plus nav.json "Architecture Decisions" entry.
- **`apps/landing/src/data/docs/services/social-graph-service.json`** — document `GET /trust/communities` + the metric change on `/trust/graph` endpoints.
- **`apps/landing/src/data/docs/nav.json`** — entries for the new concept page + ADR (run `generate-docs` from `apps/landing/`, grep-verify, re-apply if reverted).
- **`apps/frontend/src/lib/onboarding/workflows.ts`** — update any trust-graph/network workflow copy referencing the radial/force views.

---

## Critical Implementation Notes

1. **The metric fix is decayed, everywhere.** Change `getTrustGraph`, `getTrustGraphAggregate`, and `getTrustGraphAggregateForCenter` node `trust_score` from `SUM(te2.raw_weight)` (on `trust_edges`) to `SUM(tel.current_weight)` (on `trust_edges_live`). `getFullCommunityGraph` already does this — match it exactly. Edges already expose `effective_weight = current_weight`; only the **node** aggregate is wrong today.
2. **Uniform sizing is global.** Confirmed decision: apply to Community and Split views too, not just ego. `nodeRadius` becomes a constant (current user `+N`). Verify the Community/Split views still read well with uniform dots before merging — they "land well" today and must not regress.
3. **HEB ego mode ≈ community mode visually.** Cluster color (`#818cf8` within-cluster, slate cross-cluster), amber (`#fb923c`) for the current user's edges, emerald current-user node with white ring. Don't invent a new palette — reuse the community-mode styling so all relationship views match.
4. **Dashboard "Your Network" loses expansion.** Remove `handleExpandNode`, `expandedNodes`, `mergeGraphData`, `getTrustGraphAggregate(center)` wiring from `NetworkGraph`. The static view renders the full first-degree aggregate once. Keep the IntersectionObserver lazy-load.
5. **No schema changes.** Fission edges come from `split_proposals` (`status='executed'`, parent `community_id` → `child_community_a_id`/`child_community_b_id`); organic edges from `community_trust_edges`. Don't add tables.
6. **`community_trust_edges` may be sparse.** Cross-community matches are rare in the sim, so the depth view may show few organic edges — that's expected, not a bug. Fission edges will be the denser signal (9+ executed splits on the demo DB).
7. **`community_trust_normalized` CHECK** requires `community_id_a::text < community_id_b::text`. When reading edges for the depth graph, don't assume a direction maps to a real "source→target" — it's an undirected pair. Fission edges *are* directed (parent→child); keep them separate.
8. **trust_edges_live is a VIEW** — read-only. Never write it.
9. **JWT field is `communities`** (`user.communities ?? []`), never `communityMemberships`.
10. **Schema is `communities.communities`** (plural) and `communities.split_proposals` — ignore stale `community.*` comments.
11. **Landing docs are gitignored** — `git add -f apps/landing/src/data/docs/...`. Run `generate-docs` from `apps/landing/` (not root); nav.json silently reverts — grep-verify and re-apply.
12. **Version 10.6.2 → 10.7.0.** Update the `v10-polish` version-invariant test if it pins the number (it broke on prior bumps — see commit `d8342be`).
13. **`react-cytoscapejs` removal is conditional** — only drop the dep if no other component imports `cytoscape`/`react-cytoscapejs` after `TrustGraphRadial` is deleted. Grep first.
