# ADR-081: Belonging Graph System — One Engine, One Language, One Explorer

**Status**: Implemented
**Date**: 2026-06-22 (Proposed) → 2026-06-23 (Implemented)
**Sprint**: 110 (research) → 111 (implementation)
**Version**: 11.17.0 (Proposed) → 11.18.0 (Implemented in S111)

## Context

Karmyq's trust/belonging graphs are one of the platform's most important surfaces — the primary
way the product tells a member's story: *who they are, which communities they belong to, and how
their belonging is woven through people they've actually helped.* The Sprint 110 audit
(`docs/design/sprint-110-belonging-graphs/audit.md`) found six surfaces across three visual idioms
with six identifiable root causes making the experience feel patchy:

1. **Two D3 idioms** — the ego/community/fission views use hierarchical edge bundling (`TrustGraphHEB`,
   354 lines); the inter-community widget tab uses a circular static layout (`CommunityDepthGraph`,
   213 lines). Same data domain, two unrelated visual languages.
2. **Three dead graph libraries** — `cytoscape`, `react-cytoscapejs`, and `react-force-graph-2d`
   are in `apps/frontend/package.json` but render nothing. They are residue of an earlier experiment
   that migrated to D3 but left the old dependencies behind.
3. **A dead `/network` route** — `TrustNetworkWidget` links "View full →" to `/network`, but no
   `src/pages/network*` file exists. The "see the whole thing" affordance is broken.
4. **Four wrappers, four type redeclarations** — `NetworkGraph`, `TrustGraph`, `TrustGraphHEB`,
   and `TrustGraphTab` each redeclare `TrustNode`/`TrustLink`; `CommunityDepthGraph` declares a
   different shape (`DepthNode`/`DepthLink`). No single client-side source of truth.
5. **Expand/explore was removed, not improved (Sprint 79)** — progressive click-to-expand was
   removed because it caused layout instability on the small dashboard card (D3 HEB recomputes the
   entire radial cluster on node addition, causing jarring re-renders in a 360px card). The
   maintainer wants expandable/explorable back.
6. **Under-presented altitude** — both dashboard and profile render the graph as a secondary card
   widget, visually indistinguishable from any other content block. For a surface that tells
   belonging, that altitude is too low.

The Sprint 110 reference study (`docs/design/sprint-110-belonging-graphs/references.md`) drew from
Obsidian/Roam graph view (full-canvas first-class explorer), LinkedIn connection degrees (path as
narrative), Are.na/Kumu (expand-on-click with collapse affordance), GitHub/Spotify Wrapped (personal
data as identity), and D3 HEB galleries (tension, hover-highlight, transitions).

The Sprint 110 design spec (`docs/superpowers/specs/2026-06-22-sprint-110-belonging-graph-system-research-design.md`)
proposed six design decisions (D1–D6). This ADR records the chosen version of each.

## Decision

**Adopt the Belonging Graph System: one D3 HEB engine, one client data model, one expandable
full-page explorer at `/network`, with raised altitude on profile and a deliberate re-introduction
of progressive expand scoped to the explorer.** Specifically:

### D1 — One engine: D3 hierarchical edge bundling, polished

Standardize **all** belonging views on the existing `TrustGraphHEB` engine. The inter-community
"Communities" tab view (`CommunityDepthGraph`) is **folded into HEB**: communities become the
bundled node set, the same visual tokens apply (cluster colors, amber "your" edges, decay-fade per
ADR-070, node sizing, labels, transitions). The `CommunityDepthGraph` component is retired in S111.

**`CommunityDepthGraph` fate: fold into HEB (not a sanctioned exception).** The circular layout
used by `CommunityDepthGraph` does not carry meaningful semantic value the HEB idiom cannot express.
The audit found it scores 1/5 on "consistency with the rest of the system" — the lowest score of any
surface — and its `DepthNode`/`DepthLink` type split is the most severe data-model divergence. Folding
it into HEB reduces two idioms to one, eliminates the type split, and gives the Communities view the
same interaction model (hover-highlight, node selection, decay fade) as every other graph view.

### D2 — Remove the dead libraries

Drop `cytoscape`, `react-cytoscapejs`, `@types/cytoscape`, and `react-force-graph-2d` from
`apps/frontend/package.json` and delete `src/types/react-cytoscapejs.d.ts`. D3 is the single graph
dependency. (Verification: `rg "cytoscape|react-force-graph" apps/frontend/src --glob "!*.d.ts"`
returns zero hits — no runtime imports.)

### D3 — One client data model + one `<BelongingGraph mode>` wrapper

Collapse `NetworkGraph`, `TrustGraph`, `CommunityDepthGraph`, and the standalone `TrustGraphHEB`
usages into a single `<BelongingGraph mode={…} />` component backed by a single canonical
`TrustNode` / `TrustLink` / `GraphData` type (lifted to `components/graphs/types.ts`). Modes:

| Mode | Former component | Data source |
|------|-----------------|-------------|
| `ego` | `NetworkGraph` | `socialGraphService.getTrustGraphAggregate()` |
| `community` | `TrustGraph mode="community"` | `socialGraphService.getFullCommunityGraph(communityId)` |
| `communities` | `CommunityDepthGraph` (retired) | `socialGraphService.getCommunityGraph()` — response shape normalized to `TrustNode`/`TrustLink` |
| `fission` | `TrustGraph mode="fission"` | caller-supplied `graphData` (FissionTab builds it from `getTrustGraph(communityId)` + proposal assignments); the wrapper does not fetch |

**As implemented (S111):** `TrustGraph.tsx`, `NetworkGraph.tsx`, and `CommunityDepthGraph.tsx` were
**deleted outright** — not kept as deprecated aliases — once every caller (dashboard, community Trust
Graph tab, fission tab, profile) moved to `<BelongingGraph>`. The canonical types live in
`components/graphs/types.ts`; `DepthNode`/`DepthLink` normalization lives in
`components/graphs/normalizeGraphData.ts` (pure), keeping `TrustGraphHEB` canonical-type-only.

### D4 — A real, prominent full-page explorer at `/network`

Build the page the dead "View full →" link promises. Spec:

- **Full-bleed SVG canvas** — no surrounding card padding; fills the viewport.
- **Mode switch** — toggles between `ego`, `community` (picker for which community), and `communities`.
- **Depth control** — slider 1–3 hops; **ego mode only**; refetches `getNeighborhood(user.id, { depth })`.
- **Search/focus** — type a name to focus a node **already loaded** in the current graph (not a global directory).
- **Click-to-expand** — progressive neighborhood reveal, **ego mode only** (see D5 below).
- **Zoom/pan** — D3 zoom behavior (scale extent `[0.5, 4]`) on the SVG.

**As implemented (S111):** `community` mode in the explorer is the **whole** selected community via
`getFullCommunityGraph(communityId)` — searchable and zoomable, but **no depth slider and no
expansion** (the baseline is already the full community). `communities` mode is likewise static. This
prevents two conflicting meanings of "community graph" (the S79 guard).

Dashboard and profile widgets remain the compact static card; "View full →" becomes the invitation.

### D5 — Reintroduce expand/explore deliberately

**Why S79 removed it**: Progressive expand caused layout instability on the 360px dashboard card.
D3 HEB recomputes its entire `d3.cluster()` radial tree when nodes are added — on a small card
this fires jarring full-redraws. The S79 decision was correct for the card context.

**How this design avoids that failure**: Expand is scoped to the `/network` full-page explorer
*only*. On the dashboard card and profile widget, the static HEB (click → floating detail panel)
is unchanged. On the explorer:

1. Activating a node calls `GET /trust/neighborhood/:userId` (implemented in S111 in
   `services/social-graph-service/src/routes/trustGraph.ts`, mounted at `/trust`) returning the
   depth-1 set for that node, **privacy-scoped** to the caller's shared active communities.
2. The result merges into the graph via a pure, order-independent `mergeGraphData` (baseline is
   authoritative on identity; expansions add neighbors and pull shared nodes closer by min depth).
   `TrustGraphHEB` uses **keyed D3 joins + a 400ms transition** so layout changes tween rather than
   jump — no `svg.selectAll('*').remove()` teardown per update.
3. Each open expansion shows a keyboard-reachable **"Collapse {name}"** chip; collapsing recomputes
   the merged graph from the baseline plus the remaining expansions.
4. Growth is **capped**: up to 3 expansions at once; a 4th evicts the oldest (FIFO).

This answers the three failure modes S79 encountered: large-canvas context (not a card), smooth
transitions (tween), bounded growth (cap + collapse).

### D6 — Raise the altitude on profile

The belonging graph on profile must not be a reused dashboard card. It becomes a distinct section
with:

- Headline: "How you're woven into Karmyq"
- A `BelongingPulse` stat: **"You're connected to N people across M communities"**
- Larger canvas (`height=480`, vs dashboard's 360)
- "Explore your full network →" link to `/network?mode=ego`

This is the "this is your weave" identity moment (GitHub contribution graph / Spotify Wrapped pattern).

**As implemented (S111):** the pulse says **"connected to"**, not "helped" — the graph encodes trust
connections, and a literal "helped" count would need a new reputation aggregate this work did not
scope. `N` is the ego graph's node count excluding the current user, derived from the **same** ego
response the section already loads (via `onDataLoaded`) — no duplicate graph fetch. `M` is
`communityService.getMyCommunities(userId).length`; if that read fails, the section degrades to the
graph-only sentence ("You're connected to N people.") rather than hiding.

## Alternatives Considered

**A — Keep two idioms (`CommunityDepthGraph` as sanctioned exception)**

Would avoid one consolidation task but leaves the visual inconsistency intact and means two sets
of types, two interaction models, and two maintenance paths. Rejected: the consistency benefit of
one idiom outweighs the migration cost, and the circular layout offers no semantic value the HEB
cannot express.

**B — Replace D3 with Cytoscape.js or react-force-graph-2d**

A force-directed library might make expand/explore easier (physics simulation naturally accommodates
node addition). Rejected: D3 HEB is already deeply integrated, has the decay-fade (ADR-070), and the
only two callers of the dead libraries are `react-cytoscapejs.d.ts` and nothing. Pulling in a new
runtime dependency at this scale for a capability D3 already handles is net-negative.

**C — Do nothing (ship no graph changes)**

The dead `/network` link and two visual idioms are not causing user-facing failures. Rejected: the
maintainer explicitly named graphs as "the primary way Karmyq tells a member's story" and "more
prominent and interactive" as the goal. The dead affordances actively underdeliver that goal.

## Consequences

**Positive**:
- One visual language across all belonging surfaces — the app reads as a single product.
- Dead `/network` route finally delivers on its promise.
- Bundle size decreases: three dead libraries removed (cytoscape ~1.1 MB pre-minify, react-cytoscapejs, react-force-graph-2d).
- Type sprawl eliminated: four independent `TrustNode` declarations collapse to one.
- Progressive explore (expand) returns in a context where it is safe.
- Profile belonging gains "identity" altitude.

**Negative / risks**:
- `CommunityDepthGraph` folding into HEB requires normalizing `DepthNode`/`DepthLink` to
  `TrustNode`/`TrustLink` and confirming the backend `GET /trust/communities` response (in
  `trustGraph.ts`) can supply the required fields. If fields are missing, a new backend endpoint or
  field augmentation is needed (S111 discovery task).
- `GET /trust/neighborhood/:userId` is a new backend endpoint (not currently in social-graph-service;
  it would sit alongside `/trust/graph`, `/trust/communities` in `trustGraph.ts`).
  S111 must implement it; expand is blocked on that endpoint.
- Expand performance: adding nodes to a large graph (100+ members) and running `d3.cluster()` with
  a 400ms transition may still be perceptible on low-end devices. S111 should measure with
  `performance.mark` and cap graph size to 80 nodes before enabling expand.

## Related ADRs

- **ADR-063**: Unified Trust Graph Visualisation — established D3 HEB as the canonical idiom.
- **ADR-070**: Trust Relationship Memory & Decay — decay tiers drive edge opacity in TrustGraphHEB.
- **ADR-079**: Visual Design System v2 — warm shell that the `/network` explorer must adopt.
- **ADR-080**: Geocoding Cache Policy — no direct relation; S110 follows S109's docs-only precedent.
