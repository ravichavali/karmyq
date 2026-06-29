# Sprint 115: Belonging Graph — Earned Structure — Design Spec

**Date**: 2026-06-27
**Status**: Approved
**Version**: v11.20.0 → v11.22.0
**Sprint Branch**: `agent/codex/sprint-115-belonging-presentation`

---

## Overview

Karmyq's belonging graphs should help a member understand two things: how trust reaches through
people, and whether a community's relationships form a resilient structure. Sprint 114 replaced the
radial graph with a force-directed canvas, but the result was a pleasant, arbitrary constellation:
position encoded simulation physics rather than belonging. The sprint was reverted because the
renderer supplied beauty without supplying meaning.

Sprint 115 replaces the idea of one universal renderer with **one relationship truth shown through
contextual apertures**. Profile and ego exploration use a stable orbit centered on the member;
community views keep the member ring that already reads well but remove inferred cluster ordering,
cluster color, and hierarchical edge bundling. Every community edge becomes a direct, softly curved
relationship chord. Line width remains constant; hue identifies whose relationship is being read;
intensity carries only the privacy-safe qualitative relationship state.

This sprint changes presentation, not trust math. It introduces no schema and exposes no new
reputation data. It makes one additive correction to the full-community graph contract: member
selection becomes neutral rather than hidden-trust-ranked, and completeness metadata states when the
150-member view is truncated. The across-community and fission renderers remain intact. A later sprint
will add the named person-to-person connection corridor and offer integration after its path-ranking
semantics are designed and tested separately.

### Core Principle: Earned Legibility

**Every visual distinction must correspond to disclosed relationship truth; the renderer may clarify
structure, but must not manufacture health or hide pathology.**

---

## Multi-Sprint Arc

### Sprint 114 — Force-directed rendering engine (reverted)

The canvas renderer made expansion smooth but gave node position no domain meaning. PR #123 shipped
v11.21.0 and PR #124 reverted it, restoring v11.20.0.

### Sprint 115 — Earned Structure (this sprint)

Ship purpose-built ego and community layouts over the existing privacy-safe person-graph contracts.
Profile answers "how am I woven in?"; community answers "how do we hold together?"

### Sprint 116 — Named Connection Corridor (upcoming)

Add person-to-person and offer-context connection views. Path choice is shortest-first; among equal
length paths, the most supported complete corridor wins. The UI names the intermediaries and calls it
the "clearest connection," never a recommendation or transfer of trust.

### Later — public profiles and temporal lineage

- Public-profile navigation requires a real visibility contract and is not inferred from graph access.
- A time-based fission/fusion lens is deferred. Rendering is cheap, but durable fusion events and
  historical community states need a separate domain design.

---

## Goals and Non-Goals

### Goals

1. Make node position stable and meaningful in ego and community person graphs.
2. Preserve the community member ring while removing renderer-invented clusters and bundles.
3. Let community topology reveal isolation, hub dependence, fragmentation, and redundant paths
   without producing a health score or grading a person.
4. Keep relationship strength legible through the existing qualitative decay states.
5. Preserve keyboard, zoom, focus, sparse-state, and progressive-expansion behavior.
6. Prove deterministic layout and privacy-safe encoding with exact tests and 150-member validation.
7. Remove hidden-reputation selection from the full-community graph and disclose when its 150-member
   view is incomplete.

### Non-Goals

- No force-directed layout or physics simulation.
- No trust, karma, centrality, reciprocity, or extraction metric on person nodes.
- No raw/effective edge weights in the client contract.
- No backend path-ranking rewrite or offer integration (Sprint 116).
- No public member-profile route or profile-visibility model.
- No change to the across-community `CommunityHubGraph` or current fission workflow.
- No temporal fission/fusion history view.
- No database migration, new endpoint, or reputation-math change. One existing endpoint receives
  additive completeness metadata and neutral member selection.

---

## New Concepts

### Contextual aperture

One canonical graph contract can support multiple layouts when each layout answers a different
question. Shared semantics live in visual tokens and interactions, not in a mandate that every mode
use the same renderer.

### Redundant belonging

A community is structurally resilient when members have multiple routes into it, clusters have more
than one bridge, few members are stranded, and no single person is indispensable. The UI does not
reduce this to a score. It makes these patterns visible in the relationship shape and explains what
to look for in words.

### Earned structure

Position, hue, intensity, and interaction have explicit meanings. No visual degree of freedom may
quietly imply a relationship or group that the data does not contain.

---

## Visual Language

### Nodes

| Visual property | Meaning |
|-----------------|---------|
| Equal person-node radius | A person is not sized by importance or reputation. |
| Emerald node + white ring | The authenticated member: "you are here." |
| Neutral person-node hue | An ordinary member; no inferred cluster membership. |
| Visible focus ring | The keyboard-, pointer-, or search-focused member. |
| Radius from ego center | Degrees of separation in the ego aperture only. |

### Edges

All edges are constant width (`1.35px`) at rest. Width may temporarily increase to `2.5px` for the
focused member's incident edges so keyboard and pointer focus remain legible; this is an interaction
state, not a metric.

| Hue | Meaning |
|-----|---------|
| Amber | A relationship incident to the authenticated member. |
| Slate | An ordinary community relationship. |
| Teal | A focused member's incident relationships while the rest recede. |

Intensity maps the canonical client decay tier to five discrete opacity bands. ADR-082's outward
`relationship_state` intentionally returns the first four states (swept edges should already be
absent), but `TrustLink.decayTier` still admits `swept`; shared encoding handles it defensively rather
than treating it as unknown.

| Relationship state | Opacity |
|--------------------|---------|
| `strong` | `0.62` |
| `warm` | `0.40` |
| `fading` | `0.23` |
| `nearly_forgotten` | `0.11` |
| `swept` | `0.05` |

Amber "your relationship" edges use the same relative ordering with a higher-contrast hue; hue does
not override the relationship-state meaning. A missing/unknown state renders at neutral subdued
opacity (`0.16`) and is never treated as `strong`. Hue precedence is deterministic: an edge incident
to the authenticated member remains amber even when its other endpoint is focused; teal applies to
the focused member's remaining incident edges.

Color and intensity are not the only carriers: the legend and focused detail panel name the
relationship state in text.

---

## Layouts

### Ego orbit — Profile and My Network

- The authenticated member is fixed at the center.
- Direct neighbors occupy the inner orbit.
- Radius encodes degrees of separation from the authenticated member. The layout recomputes that
  display distance with a local breadth-first traversal after graphs merge; it does not trust an
  expansion response's `degrees_of_separation`, which is relative to the clicked expansion center.
- `egoOrbitModel` never reads `node.degrees_of_separation` for radius or ordering. That populated
  compatibility field may still be used by textual readouts outside the layout model.
- Progressive expansion places newly revealed neighbors on an outer arc aligned with the activated
  member.
- Clockwise ordering is deterministic: normalized display name, then user ID as a tie-breaker.
- Identical input produces identical coordinates. No simulation or load-time jiggle occurs.
- Profile allows one open expansion. Activating a second member replaces the first expansion.
- The full `/network?mode=ego` explorer retains depth 1–3 and up to three collapsible expansions.
- Opening/collapsing a profile branch never reassigns baseline nodes; only outer-arc nodes are
  added/removed. A deliberate explorer depth change may recompute the baseline orbit. Transitions
  honor `prefers-reduced-motion`.

### Community ring — This Community

- Every returned active member occupies one equal position on a single circle. When the community has
  at most 150 active members the view is complete; larger communities are explicitly marked truncated.
- Clockwise ordering uses the same normalized-name + ID ordering as the ego aperture.
- Each edge is a direct source-to-target relationship rendered as one quadratic Bézier curve. Its
  control point is the chord midpoint displaced perpendicular to the chord by
  `min(18px, chordLength × 0.08)`; direction comes from the lexicographically normalized endpoint
  pair. This modest deterministic bow prevents near-diameter chords from all converging at the
  center. Curves have no shared hierarchy and do not merge into visual bundles.
- There is no cluster detection, cluster ordering, cluster hue, centrality size, or generated group.
- Activating a member focuses their incident relationships and dims unrelated nodes/edges without
  changing any positions.
- The community view is already complete, so activation focuses rather than expands.
- Isolation appears as a member with no chords; hub dependence appears as spokes into one person;
  fragmentation appears as disconnected webs; redundant belonging appears as multiple independent
  routes. The renderer does not label any individual as healthy, unhealthy, extractive, or central.

### Unchanged apertures

- `communities` continues to use `CommunityHubGraph`.
- `fission` continues to use the restored D3 renderer and current proposal interactions.
- Sprint 115 does not reinterpret organic community ties or fission lineage.

---

## Component Architecture

`BelongingGraph` remains the only public wrapper that fetches and normalizes graph data. It becomes a
mode dispatcher instead of forcing every mode through one renderer.

| File | Responsibility |
|------|----------------|
| `apps/frontend/src/components/BelongingGraph.tsx` | Fetch/normalize canonical data, own loading/error states, and dispatch by `mode`. |
| `apps/frontend/src/components/graphs/graphVisualEncoding.ts` (new) | Semantic colors, qualitative opacity bands, constant widths, accessible labels, and focus predicates shared by person renderers. |
| `apps/frontend/src/components/graphs/egoOrbitModel.ts` (new) | Pure deterministic ego-orbit coordinate and edge model. |
| `apps/frontend/src/components/graphs/EgoOrbitGraph.tsx` (new) | SVG ego renderer, focus/keyboard/zoom behavior, and bounded branch presentation. |
| `apps/frontend/src/components/graphs/communityRingModel.ts` (new) | Pure deterministic ring positions and direct-curve paths. |
| `apps/frontend/src/components/graphs/CommunityRingGraph.tsx` (new) | SVG community renderer, focus/keyboard/zoom behavior, and detail panel. |
| `apps/frontend/src/components/graphs/types.ts` | Add `totalActiveMembers` to canonical graph metadata. |
| `apps/frontend/src/components/graphs/TrustGraphHEB.tsx` | Remains for fission during Sprint 115; no longer handles `ego` or `community`. |
| `apps/frontend/src/components/graphs/CommunityHubGraph.tsx` | Unchanged renderer for `communities`. |
| `apps/frontend/src/components/graphs/GraphZoomControls.tsx` + `graphZoom.ts` | Reused; renderer remains the single zoom owner for its SVG. |
| `apps/frontend/src/components/BelongingSection.tsx` | Add the profile's single bounded ego expansion while retaining the pulse and explorer link. |
| `apps/frontend/src/pages/network.tsx` | Route ego/community supplied data to their new renderers; retain search, depth, and expansion controls. |
| `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx` | Replace cluster/bundle copy with ring/direct-relationship/redundant-belonging language. |

Pure layout models stay separate from React and D3 DOM effects so their meanings can be tested without
jsdom geometry or screenshot inference. Deterministic normalized-name + ID ordering is `O(V log V)`;
geometry, adjacency, and path generation after ordering are `O(V + E)`; total end-to-end model
construction is `O(V log V + E)`. Renderers memoize coordinates and path geometry by graph data +
viewport dimensions; changing focus may update classes/styles but must not recompute coordinates or SVG
path `d` values. Do not use per-edge filters, blur, or glow effects.

---

## Data Model

**No database migration. No schema changes.**

The canonical client `GraphData`, `TrustNode`, and `TrustLink` types remain. Person graphs continue to
carry identity + structure on nodes and qualitative `relationship_state` normalized to `decayTier` on
links. Optional numeric fields remain reserved for non-person community-depth data and must not be
read by the new person renderers. `GraphData.meta` adds optional `totalActiveMembers`; the existing
optional `truncated` flag is reused by the community ring.

---

## API Endpoints

**No new endpoints. One additive response-contract change.** Sprint 115 keeps ADR-082's strict
person projections and modifies only the full-community graph's selection/completeness envelope.

| Method | Path | Aperture | Use |
|--------|------|----------|-----|
| GET | `/trust/graph` | Profile ego | Aggregate baseline across the caller's communities. |
| GET | `/trust/graph/:communityId` | Community-scoped ego | Baseline for the community My Network sub-tab. |
| GET | `/trust/neighborhood/:userId?depth=1..3` | Ego explorer/expansion | Privacy-scoped recursive neighborhood and branch expansion. |
| GET | `/trust/graph/:communityId/full` | Community ring | Up to 150 neutrally selected active members, in-scope links, and `meta: { totalActiveMembers, truncated }`. |

`normalizePersonGraph` remains the response seam. Layout components never consume raw API rows.

### Full-community selection correction

The current database query selects the top 149 members by internal trust score and unions the caller.
That hidden ranking makes low-scoring members less likely to appear and biases the visible topology.
Sprint 115 replaces it with a neutral deterministic selection:

1. Select up to 149 active members ordered by normalized display name, then user ID.
2. Union the authenticated caller so "you are here" is guaranteed (at most 150 returned nodes).
3. Count all active community members independently.
4. Return `totalActiveMembers` and `truncated = totalActiveMembers > returnedNodeCount`.

Internal trust weights remain available only for selecting/projecting link relationship states; they
must not affect which people occupy the ring. The route continues to pass nodes/links through the
ADR-082 person projection before returning them.

---

## Interaction Flow

### Profile

1. `BelongingGraph` loads the existing aggregate ego baseline.
2. Activating a non-caller node requests its depth-1 privacy-scoped neighborhood.
3. The branch merges through the existing pure `mergeGraphData` helper.
4. Only one profile expansion remains open; a new one replaces the old branch.
5. Activating the same focused member collapses the branch.

### Full ego explorer

The existing depth control, loaded-node search, three-expansion FIFO cap, and collapse chips remain.
The new renderer consumes the already-merged graph and places expansion nodes on the appropriate
outer orbit/arc.

### Community

The full graph loads once. Activation changes only focus state: incident edges become teal (the
caller-member edge remains identifiable as "yours"), unrelated structure fades, and a structural
detail panel shows name, degrees where available, connection count, and textual relationship state.

### Public profiles

Node detail does not link to another person's profile in Sprint 115. Karmyq has no public-member
profile contract or profile-visibility field. Adding a link to the self-profile route or inferring
public visibility from shared membership would be a privacy bug. Public profiles require a separate
design and API-enforced visibility policy.

---

## Failure and Density Behavior

- **Empty ego:** explain that connections grow through completed help; do not show a generic empty
  data error.
- **Expansion failure:** retain the baseline and existing expansion, show a non-blocking retry/dismiss
  message, and never clear the graph.
- **Missing community:** keep the existing choose-a-community state.
- **Missing relationship state:** render a subdued neutral edge, never a strong edge.
- **Dangling link:** filter the link at the pure model boundary and continue rendering valid data.
- **Dense graph:** preserve every returned node and link. At 40 members or fewer, persist every name;
  above 40, persist only the caller and focused/searched name while focus, keyboard navigation,
  tooltip/title, and zoom recover every other member's name.
- **Truncated response:** show "Showing N of M active members" and state that the visible subgraph is
  incomplete. Suppress complete-community health interpretation while `truncated=true`.
- **Small viewport:** keep the same topology, allow pan/zoom, and prefer focus labels over overlapping
  persistent labels. Do not switch to an unrelated mobile layout.

---

## Accessibility

- Every node remains an SVG button with `tabindex=0`, Enter/Space activation, a visible focus ring,
  `<title>`, and a full `aria-label`.
- Labels include name, "you" where applicable, degrees away, and connection count when known.
- Relationship state is available in text through the legend/detail panel; opacity alone is not the
  only signal.
- Focus and selected state use stroke/shape in addition to hue.
- Zoom controls have accessible labels and remain inside the active renderer so they are mounted once.
- Transitions disable under `prefers-reduced-motion`.

---

## Testing Strategy

Tests are written first in `apps/frontend/tests/tdd/`; passing tests promote to regression.

### Pure model tests

- Identical nodes/links always produce identical coordinates and paths.
- Ego center is fixed; node radius matches degrees of separation.
- Ego display distance is recomputed from the authenticated member after expansion merges; a clicked
  expansion center never becomes display distance zero unless it is the authenticated member.
- Community nodes all lie on one ring with equal radius.
- Normalized-name + ID ordering is deterministic and collision-safe.
- Each community link produces one direct curve between its actual endpoints; no hierarchy/bundle
  intermediary exists.
- Dangling links are filtered and no coordinate/path contains `NaN` or `Infinity`.

### Encoding tests

- Every at-rest person edge has width `1.35px` regardless of relationship state.
- All five canonical client decay tiers map to the exact approved opacity bands, including defensive
  `swept=0.05`; missing/unknown state maps to `0.16`.
- Caller edges, ordinary edges, and focused-member edges use their semantic hues.
- Forbidden person fields (`trust_score`, `karma`, raw/effective weight) are never read or rendered.

### Component and interaction tests

- Representative ego and community graphs render nodes/edges and honest sparse states.
- Profile permits one expansion and preserves baseline data on failure.
- Explorer retains three-expansion FIFO/collapse behavior.
- Community activation focuses without changing node coordinates.
- Full-community contract tests prove neutral name/ID selection, guaranteed caller inclusion, exact
  `totalActiveMembers`, and correct `truncated` behavior above/below the cap.
- Keyboard activation, focus ring, accessible labels, and reduced motion work.
- Zoom controls mount once per graph and use the existing D3/jsdom mapping and `ResizeObserver` stubs.

### Existing regression migration

Sprint 111/113 regression suites currently mount `TrustGraphHEB` directly in `ego`/`community` modes
and assert HEB-specific DOM. Implementation must inventory those assertions before changing dispatch:

- Move shared accessibility, privacy, focus, keyed-update, and zoom contracts to representative
  `EgoOrbitGraph` / `CommunityRingGraph` tests.
- Preserve HEB-specific fission assertions against `TrustGraphHEB`.
- Update `BelongingGraph` dispatch tests to mock all contextual renderers and assert the correct mode
  target.
- Update the consolidation invariant from "one renderer" to "one wrapper + canonical model + shared
  visual encoding." Do not delete a regression merely because its old DOM selector fails.

### Structural truth fixtures

Use equal-size synthetic fixtures for:

1. **Redundant community** — multiple independent routes and no indispensable member.
2. **Hub-dependent community** — spokes converge on one member.
3. **Fragmented community** — disconnected components and isolated members.

Tests assert that the direct edge topology and focus neighborhoods remain distinct; human visual
validation confirms the renderer does not normalize all three into the same pleasant shape.

### Human validation

- Render a 150-member fixture on desktop and mobile; verify no crash, `NaN`, missing focus path, or
  unusable zoom.
- Exercise both a realistic sparse 150-member fixture and a high-edge stress fixture. Record initial
  model/render and focus-update timings with `performance.mark`; focus must reuse path geometry. If the
  stress fixture misses the interaction budget, optimize rendering rather than sampling topology.
- Validate profile, community tab, and `/network` against real demo data, including a rich account and
  a sparse account.
- Confirm identical data retains its mental map across reloads and expansion/collapse cycles.

---

## User Guide and Documentation Updates

Mandatory Sprint 115 documentation:

- Create **ADR-083: Contextual Belonging Graph Rendering — Earned Structure**, partially superseding
  ADR-063/081's "one renderer" decision while preserving one canonical model and visual language.
- Update `docs/adr/README.md` and add the matching landing ADR JSON/nav entry.
- Update `docs/guides/trust-graph.md` and landing `guides/trust-graph.json`: ego orbit, community ring,
  direct chords, constant width, intensity meaning, focus behavior, and unchanged other modes.
- Update `docs/concepts/reading-the-trust-graph.md` and its landing JSON: remove trust-score and
  cluster/bundle language that no longer matches ADR-082/Sprint 115.
- Update `apps/frontend/CONTEXT.md` with the mode-to-renderer map and testing patterns.
- Update `services/social-graph-service/CONTEXT.md` and `services/registry.json` for the additive
  `/trust/graph/:communityId/full` metadata and neutral selection behavior.
- Audit `apps/frontend/src/lib/onboarding/workflows.ts`; update graph/navigation copy only where an
  existing workflow describes the changed visuals. Do not invent a new onboarding flow this sprint.

---

## Critical Implementation Notes

1. **No force simulation.** Ego and community coordinates are pure and deterministic. Identical input
   must render identically across reloads; no physics, random seed, or tick loop is permitted.
2. **No inferred clusters or visual bundles in person community graphs.** Do not run `detectClusters`,
   group members by computed connectivity, color them as groups, or route edges through a shared
   hierarchy. One chord equals one disclosed relationship.
3. **Width does not encode strength.** At-rest person edges are always `1.35px`; only the four
   qualitative ADR-082 states control intensity. Temporary focus width is interaction affordance only.
4. **Preserve the disclosure boundary.** Person renderers consume identity + topology + qualitative
   `relationship_state`; never read or reintroduce node reputation, raw edge weights, centrality, or
   reciprocity labels.
5. **One wrapper, contextual renderers.** `BelongingGraph` remains the only fetch/normalization seam,
   but `ego`, `community`, `communities`, and `fission` may dispatch to purpose-built renderers. Do not
   repeat Sprint 114's assumption that one physics/layout engine must serve every story.
6. **Do not regress untouched modes.** `CommunityHubGraph` remains the `communities` renderer and the
   current D3 renderer remains for `fission`. Preserve fission admin movement, lineage styling, and
   zoom behavior.
7. **Expansion is bounded by surface.** Profile holds one replaceable branch; the explorer retains its
   existing three-expansion FIFO cap and collapse chips; community focus never fetches expansion data.
8. **Recompute ego distance after merge.** Neighborhood responses measure degrees from their requested
   center. The ego orbit must run a local BFS from `currentUserId` and must never read
   `node.degrees_of_separation` for layout; never place merged nodes directly from center-relative
   response metadata.
9. **Public profile navigation stays deferred.** Shared-community graph access is not consent to a
   public profile. Do not add another-member links until an API-enforced visibility contract exists.
10. **Dense and incomplete graphs stay honest.** Preserve all returned topology, disclose truncation,
    and never claim community health from an incomplete response. Use focus/search/zoom rather than
    silently sampling edges.
11. **Member visibility is never trust-ranked.** The full-community query selects by normalized name
    + ID and always includes the caller. Internal trust score/weight may classify link state but must
    not decide which members are visible.
12. **Migrate, do not discard, HEB-era regressions.** Existing Sprint 111/113 tests directly assert
    `TrustGraphHEB` behavior in `ego`/`community` modes. Move shared contracts to the new renderers,
    retain fission-specific HEB tests, and update the consolidation invariant before removing old DOM
    assertions.
13. **Keep dense focus cheap.** Deterministic normalized-name + ID ordering is `O(V log V)`; geometry,
    adjacency, and path generation after ordering are `O(V + E)`; total end-to-end model construction is
    `O(V log V + E)` and memoized by data + viewport. Focus changes styles only. Avoid filters/glows and
    never recompute Bézier paths on hover/focus.
14. **Use the repository's D3/Jest pattern.** Map `d3` to `d3/dist/d3.min.js`, stub
    `ResizeObserver`, seed `__zoom` directly where needed, and test pure layout models outside jsdom.
15. **All behavior changes need tests and docs in the same sprint.** Follow TDD placement, update the
    user guide/concept/landing copies, create ADR-083, and run the full SDLC gates before merge.

---

## Acceptance Criteria

- Profile and ego explorer render through the deterministic ego orbit.
- Community person graphs retain a stable circle and use direct softly curved chords.
- No ego/community person view uses force simulation, cluster grouping/color, edge bundling, variable
  strength width, or person reputation metrics.
- Relationship states are distinguishable by approved intensity bands and readable in text.
- `swept` has a tested defensive encoding even though ADR-082 outward person graphs normally omit it.
- Profile expansion, explorer expansion, community focus, keyboard behavior, and zoom work as designed.
- Across-community and fission behavior remains unchanged.
- Full-community member visibility is neutral rather than trust-ranked, the caller is present, and
  truncated graphs disclose "N of M" without making a complete-community health claim.
- Unit/regression tests pass; 150-member and real-demo human validation pass.
- ADR, guides, concepts, landing docs, and frontend context match the shipped behavior.
