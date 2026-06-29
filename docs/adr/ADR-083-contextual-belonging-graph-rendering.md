# ADR-083: Contextual Belonging Graph Rendering (Earned Structure)

**Status**: Accepted
**Date**: 2026-06-27 (Accepted) → (Implemented on deploy validation)
**Sprint**: 115
**Version**: 11.22.0
**Supersedes (partially)**: the single-universal-renderer choice in [ADR-063](ADR-063-canonical-trust-metric-and-unified-graph.md) and [ADR-081](ADR-081-belonging-graph-system.md)
**Builds on**: [ADR-082](ADR-082-reputation-disclosure-boundary.md) (reputation disclosure boundary — preserved)

## Context

ADR-081 unified every belonging-graph surface onto one renderer (the hierarchical edge bundling
radial, `TrustGraphHEB`), and ADR-063 made node size and the trust metric consistent. That
consolidation was the right move for *coherence* — but the chosen presentation **manufactures
structure that the data does not contain**:

- **Force/HEB layouts invent shape.** A force simulation settles nodes wherever its springs relax;
  hierarchical edge bundling routes edges through a *detected* cluster hierarchy. Both produce a
  confident-looking picture of "groups" and "cores" that is an artifact of the layout algorithm, not
  a disclosed fact about the community. Sprint 114's force-graph experiment was reverted for exactly
  this reason: it told a story the data hadn't earned.
- **Greedy cluster detection is editorial.** `detectClusters` merged the strongest 40% of edges into
  named groups. Two members landed in "the same close-knit group" because of a threshold, then the
  layout drew them adjacent — a claim the platform cannot stand behind.
- **Variable width / bundle prettiness implied precision.** Edge width scaled with a derived weight
  and bundles implied shared "paths," reading as quantitative endorsement.
- **The full-community endpoint selected by hidden score.** `/trust/graph/:communityId/full` picked
  its top 150 members by trust score and silently truncated, so an incomplete graph looked complete
  and the selection itself leaked a ranking ADR-082 had just made private.

The position of a node and the existence of an edge are the parts of a graph people read as truth.
If we cannot stand behind them, we should not draw them.

## Decision

Keep **one canonical graph contract** (`GraphData`, one fetch/normalize wrapper `BelongingGraph`,
one shared visual encoding) but render it through **purpose-built, deterministic renderers** — one
per context — instead of a single universal renderer. Structure is **earned**: position and edges
come only from disclosed topology.

### Contextual renderers (the mode map)

| Mode | Renderer | Geometry |
|---|---|---|
| `ego` (My Network) | `EgoOrbitGraph` | You at the origin; concentric orbits by **local BFS distance** from you; baseline positions stable across expand/collapse; expansions fan on a small arc near their root. |
| `community` (This Community) | `CommunityRingGraph` | Every returned member on **one ring** (stable normalized-name + ID order); one **direct quadratic chord** per disclosed relationship; no clusters, bundles, or sampling. |
| `communities` (Across Communities) | `CommunityHubGraph` | Unchanged egocentric hub; a node is a *community* and its size honestly encodes membership. |
| `fission` | `TrustGraphHEB` | Unchanged; the radial now renders **only** the group-split proposal. |

### Visual truth (shared encoding)

- **Equal person nodes** — node size never encodes a person's importance (ADR-063 preserved).
- **Direct disclosed links** — a chord/line exists iff the relationship was disclosed; nothing inferred.
- **Constant at-rest width** (`1.35px`); a focused incident edge widens to `2.5px` as an *interaction
  affordance only*, never as data.
- **Qualitative intensity, not quantity** — five opacity bands keyed to the relationship state
  (`strong` 0.62, `warm` 0.40, `fading` 0.23, `nearly_forgotten` 0.11, defensive `swept` 0.05;
  unknown 0.16). No raw or effective weight is read.
- **Semantic hue** — caller edges amber, ordinary slate, focused incident teal (caller amber wins).
- Geometry is derived from local BFS distance, **never** from the response-supplied
  `degrees_of_separation`, which an expansion can report incorrectly.

### API correction

`/trust/graph/:communityId/full` now selects up to **149 non-caller active members neutrally** by
normalized name + ID (never by trust score), **always unions the caller**, and returns additive
structural completeness metadata `meta: { totalActiveMembers, truncated }`. An incomplete graph says
"Showing N of M active members. This view is incomplete." and suppresses any complete-community
interpretation. No migration, no new endpoint; the projection stays ADR-082-safe.

## Consequences

### Positive

- The graph only ever asserts what the data contains: read multiple routes, bridges, isolates, or one
  indispensable person from the **topology**, not from a layout's invented grouping.
- Clear single responsibility per renderer; each is a pure model + declarative SVG, deterministic and
  directly unit-testable; focus never recomputes geometry, so the mental map is stable.
- Truncation is honest and visible; neutral selection removes a ranking leak.

### Negative / trade-offs

- More components than one universal renderer (four renderers vs one), and some duplicated SVG/zoom
  scaffolding (mitigated by the shared `graphVisualEncoding`, `graphZoom`, and container-width hook).
- No automatic "cluster" affordance — redundant belonging is read structurally, by eye, on purpose.
- **No** person health score, reputation display, inferred clusters, bundles, or centrality.

### Deferred (separate future sprints)

Named connection corridors + offer context; public profiles (pending an API-enforced visibility
contract); temporal fission/fusion lineage (pending durable event/history design).

## Supersession

Partially supersedes ADR-063 and ADR-081 **only** where they mandate a single universal *person*
renderer. The canonical data model, the one-wrapper architecture, uniform person-node sizing, and the
ADR-082 reputation boundary are all preserved.
