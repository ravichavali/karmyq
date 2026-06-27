# ADR-083: Belonging Graph Rendering Engine

**Status**: Accepted
**Date**: 2026-06-26
**Sprint**: 114
**Version**: 11.21.0
**Supersedes (partially)**: the renderer/engine decision of [ADR-081](ADR-081-belonging-graph-system.md) (D1 "one D3 HEB engine", D2 "D3 is the single graph dependency") — **not** its canonical graph model, and not [ADR-082](ADR-082-reputation-disclosure-boundary.md)'s disclosure boundary.

## Context

Sprint 111 (ADR-081) made the belonging graph coherent: one wrapper (`<BelongingGraph mode>`), one
canonical client model (`TrustNode`/`TrustLink`/`GraphData` in `components/graphs/types.ts`), and one
rendering engine — D3 hierarchical edge bundling (`TrustGraphHEB`), with the across-communities scale
delegating to a D3 egocentric hub (`CommunityHubGraph`). ADR-081 D2 deliberately **removed**
`react-force-graph-2d` (and cytoscape) as dead dependencies, declaring "D3 is the single graph
dependency."

Two things changed the calculus since:

1. **The graph is becoming a product centerpiece, not a card.** ADR-081 D4/D6 already raised altitude
   (full-page `/network` explorer, profile belonging section). The Phase 1–3 direction makes the
   belonging graph *the* way Karmyq tells a member's story. A radial edge-bundle is beautiful but
   rigid: it recomputes the whole `d3.cluster()` tree on any node change (the very instability ADR-081
   D5 had to work around with keyed joins + 400ms tweens + a hard 80-node cap), and it is awkward for
   the free pan/zoom/explore interaction the centerpiece direction wants.
2. **Hand-rolled D3 SVG is expensive to keep at parity.** `TrustGraphHEB` (≈420 lines) and
   `CommunityHubGraph` (≈300 lines) each re-implement zoom, hit-testing, drag, force/layout math, and
   draw loops by hand. A maintained force-graph library gives canvas rendering (far better at hundreds
   of nodes than SVG DOM), built-in zoom/pan/pinch, and a stable `ForceGraphMethods` ref — removing
   most of that bespoke surface area.

Adopting a canvas/force renderer is a **reversal of ADR-081's renderer decision specifically**. It does
*not* reverse the parts of ADR-081 that worked: the single wrapper, the one canonical data model, and
the one full-page explorer all stay. ADR-082's reputation disclosure boundary is likewise untouched —
node detail remains structure-only.

## Decision

**Adopt `react-force-graph-2d@1.29.1` as the belonging graph's rendering engine, behind a thin
`GraphCanvas` boundary, while keeping the canonical `GraphData` model and D3 for force/layout helper
math.** Specifically:

### D1 — One canvas renderer behind a thin boundary

A new `components/graphs/GraphCanvas.tsx` is the *only* component that imports `react-force-graph-2d`.
It owns force configuration and the canvas draw callbacks (`nodeCanvasObject`, `nodePointerAreaPaint`,
`linkCanvasObject`) and nothing else. `components/graphs/BelongingGraphRenderer.tsx` wraps it with all
DOM chrome (legend, zoom controls, empty/sparse states, selected-node detail, depth readout). The old
D3 renderers `TrustGraphHEB.tsx` and `CommunityHubGraph.tsx` — and their shared `graphZoom.ts`
D3-zoom helper — are deleted.

### D2 — Re-add the dependency, pinned, supply-chain reviewed

`react-force-graph-2d@1.29.1` is added to `apps/frontend/package.json` **pinned exactly** (no caret),
per the ADR-061 supply-chain posture, and must pass `npm audit --audit-level=high` (ADR-059 gate)
before merge. D3 remains a dependency — it is still useful for force/layout helper math — but is no
longer the renderer.

### D3 — Canonical model and disclosure boundary unchanged

`BelongingGraph` remains the *only* fetch/normalization wrapper; `GraphCanvas` never calls
`socialGraphService`. The canonical `TrustNode`/`TrustLink`/`GraphData` types and the
`normalizePersonGraph` / `normalizeCommunityDepthGraph` normalizers (ADR-081 D3) are reused verbatim.
Node detail stays structure-only — degrees away, connection count, relationship state — never a trust
score or karma (ADR-082). Because `react-force-graph-2d` mutates node objects (`x`, `y`, `vx`, `vy`,
`fx`, `fy`), `GraphCanvas` clones the canonical data before handing it to the renderer; it never
mutates props.

### D4 — Phase 1 is parity, not redesign

Phase 1 ports the existing product semantics onto canvas: zoom controls (now driving the
`ForceGraphMethods` ref — `zoom`/`centerAt`/`zoomToFit` — instead of `d3.zoom`), pan/pinch,
hover/focus dimming, node detail, legends, empty/sparse states, the depth readout, the fission split
view (proposed-group colors, isolated-member dashed ring, admin move-group action), and the Scale
1/2/3 explorer framing. Visual constants (link colors, dash arrays, node sizing, decay-tier opacity)
are **ported from the old renderers**, not reinvented. Geometry changes from radial/SVG to
force/canvas; everything else stays at parity. Removing Scale framing and tabbed modes is a later
phase.

### D5 — Surface consolidation

S114 also retires three redundant belonging-graph homes so the graph has clear, non-duplicated entry
points: the dead dashboard `TrustNetworkWidget`, the Home `MyNetworkPreview` card, and the community
**My Network** sub-tab. The graph's homes are now **profile**, **community** ("How we're connected" —
member topology only), and the **`/network`** explorer, plus the top-nav My Network link.

## Alternatives Considered

**A — Keep D3 HEB and invest in smoother expand/zoom.** Rejected: it doubles down on a hand-rolled
SVG engine that recomputes its whole layout on change and re-implements zoom/hit-testing/drag by hand.
The centerpiece direction wants free exploration the bundle resists, and the maintenance surface is
exactly what a library removes.

**B — A different renderer (cytoscape, sigma.js, raw canvas).** Rejected: `react-force-graph-2d` is
the lightest fit — React-native, canvas-based, force layout built in, a small ref API — and was
already the experiment ADR-081 removed; re-adopting one pinned dependency is cheaper than introducing
a heavier graph framework or hand-writing a canvas engine.

**C — Do nothing (ship no renderer change).** Rejected: the maintainer's explicit goal is to make the
belonging graph more prominent and interactive; the D3 HEB's layout instability and bespoke
interaction code are the things standing in the way.

## Consequences

**Positive**:
- Canvas rendering scales to hundreds of nodes far better than SVG DOM.
- Built-in zoom/pan/pinch and a stable `ForceGraphMethods` ref replace ~700 lines of bespoke D3 SVG.
- Free force-directed exploration the centerpiece direction wants, without the cluster-recompute jank.
- The `GraphCanvas` boundary keeps `react-force-graph-2d` in exactly one file — swappable later.
- Surface consolidation removes three duplicate/dead graph homes.

**Negative / costs**:
- **Canvas is not DOM-queryable.** Tests can no longer assert `<circle>`/`<path>` nodes. The test
  strategy moves to asserting boundary props (the captured `react-force-graph-2d` props), style/config
  helper outputs, callbacks, and the surrounding DOM chrome. `react-force-graph-2d` is ESM and pulls
  D3 submodules, so it is mapped to a project-level Jest mock (`tests/mocks/reactForceGraph2DMock.tsx`)
  via `moduleNameMapper`; per-file mocks are forbidden because forgetting one reintroduces the ESM
  transform failure.
- A renderer dependency returns to the bundle — justified by the centerpiece direction and pinned +
  audited per ADR-059/061.
- Geometry visibly changes for members (radial bundle → force/canvas). Privacy, controls, and detail
  semantics are preserved, so the *meaning* is unchanged.

## Related ADRs

- **ADR-081**: Belonging Graph System — established the wrapper, canonical model, and the D3 HEB
  engine this ADR's renderer decision reverses (model + wrapper + explorer retained).
- **ADR-082**: Reputation Disclosure Boundary — node detail stays structure-only on the canvas.
- **ADR-070**: Trust Relationship Memory & Decay — decay tiers still drive link opacity, now in canvas.
- **ADR-059 / ADR-061**: Dependency security gate & supply-chain hardening — govern the pinned,
  audited re-adoption of `react-force-graph-2d`.
