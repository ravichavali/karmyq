# Belonging Graph Consolidation — Design Spec

**Sprint:** 114 (Phase 1 of a 3-phase initiative)
**Date:** 2026-06-26
**Status:** Design approved (Claude brainstorm + Codex cross-review), spec under review
**Predecessors:** S110 research → S111 belonging graph (v11.18.0) → S112 ADR-082 reputation boundary (v11.19.0) → S113 truth + prominence (v11.20.0)

---

## Why this initiative

The belonging graph is the platform's most important idea, but it is currently a **feature tucked into tabs**: it appears in five places (profile `BelongingSection`, dashboard `TrustNetworkWidget`, community `TrustGraphTab` sub-tabs, the S113 Home preview card, and the `/network` explorer) with overlapping modes and a lot of explanatory chrome. S113 proved the concept (three legible scales, the egocentric hub, depth legibility), but in doing so confirmed the next direction: **the graph should be the spine of the product** — the first thing you see when you drill into a person or a community, answering *"how am I connected, and why can I trust this?"*

S113's work is a **stepping stone, not the final form**: the egocentric-hub layout, the ADR-082 privacy normalization, and the depth/sparse legibility carry forward; the "Scale 1/2/3" framing text, the tabbed mode-switcher, and the scattered surfaces get replaced.

## North star (the whole initiative)

One canonical, interactive, traversable belonging graph that:
- is the **hero** of a person's profile and a community's page (prominence),
- answers **"why can I trust this person/community"** via a trust-explanation view (you ↔ them + shared trusted anchors),
- is driven by **interaction, not text** (hover highlight + compact public-property panel, click-to-navigate, click-to-re-center traversal),
- renders **distinct relationship channels** (organic trust vs. directed fission lineage),
- consolidates the five surfaces into **two homes (profile, community) + one deep explorer (`/network`)**.

## Decomposition (3 phases)

| Phase | Sprint | Scope |
|-------|--------|-------|
| **1 — Renderer + Consolidation at parity** | **114 (this spec)** | Adopt `react-force-graph-2d`; rebuild the unified graph component at visual + behavior parity with today's modes; consolidate the 5 surfaces → 2 homes + explorer; retire the 3 redundant surfaces; ADR for the renderer reversal. **No new product semantics.** |
| 2 — Trust-explanation + traversal + prominence | 115 | New privacy-scoped `GET /trust/explain/:targetUserId`; the someone-else's-profile trust view; hover property panel; click-to-re-center traversal + breadcrumb + URL sync; make the graph the page hero. |
| 3 — Lineage channel + chrome cleanup + polish | 116 | Distinct directed fission-lineage channel (vs organic trust); remove the scale-framing text + tabbed modes; animation/prominence polish. |

Each phase ships independently and is independently validatable. **This spec details Phase 1 only.**

---

# Phase 1 — Renderer adoption + surface consolidation at parity

## Goal

Swap the rendering engine to `react-force-graph-2d` and collapse the five graph surfaces into two homes + the explorer, **at informational and behavioral parity** with what ships in v11.20.0. This de-risks the renderer change by holding *product semantics* constant, and lands the IA consolidation. New semantics (trust-explanation, traversal, hero prominence, lineage channel) are explicitly **Phases 2–3**.

### What "parity" means here (and what it does not)

Adopting a force renderer **intentionally changes the layout geometry** — that is the point, and the user approved it: the ego graph becomes **center-out** (you/the focus node pinned at center) instead of everyone on a radial circle, and community-to-community becomes a **force/network** view. So Phase 1 is *not* pixel-parity. "Parity" is held on everything **except** geometry:

- **Same data + privacy** (the ADR-082 normalization/contract, structure-only, no reputation numbers).
- **Same interaction affordances** as today (zoom in/out/reset, pan, hover highlight, click-to-select node-detail) — re-implemented on the new renderer, **not** yet extended with traversal/navigation (Phase 2).
- **Same chrome** (legend, empty/sparse states, node-detail panel, depth readout, the Scale 1/2/3 framing text — removed only in Phase 3).
- **Same modes** (ego / community / communities / fission) and the same per-mode information.

The geometry moving from radial to force is the *only* intended visual change in Phase 1.

## Non-goals (Phase 1)

- No `GET /trust/explain` endpoint, no someone-else's-profile trust view (Phase 2).
- No click-to-re-center traversal, no breadcrumb, no URL-synced focus (Phase 2).
- No removal of the "Scale 1/2/3" framing text or tabbed modes — kept as-is for parity (Phase 3 removes them).
- No distinct fission-lineage channel — Phase 1 keeps the current organic/fission styling (Phase 3 redesigns it).
- No reputation-math, DB-migration, or ADR-082 contract change.

## Architecture

### One component, pluggable layouts

A single `<BelongingGraph>` (replacing the S113 `TrustGraphHEB` + `CommunityHubGraph` pair) renders, off the **existing canonical `GraphData` contract** (unchanged — `apps/frontend/src/components/graphs/types.ts`), three layouts via `react-force-graph-2d`:

- **Egocentric** — the focus node pinned at center, others positioned by hop distance. Backs the person ego graph and "your communities." (Generalizes the S113 egocentric hub.)
- **Member topology** — a community's members, force-clustered so groups self-separate (replaces the radial HEB circle; "circle is fine" intent preserved, now force-relaxed).
- **Network/web** — community-to-community, force-directed and draggable.

The `BelongingMode` → layout mapping: `ego` → egocentric, `community` → member topology, `communities` → network/web, `fission` → member topology (split-group coloring).

### Renderer boundary (keep it swappable + testable)

Wrap `react-force-graph-2d` behind a thin internal interface (`GraphCanvas`) that takes `{ nodes, links, layout, styling, onNodeHover, onNodeClick }` and owns only rendering + the force config. The surrounding React chrome (legend, controls, empty/sparse states, node-detail panel) stays in queryable DOM. This keeps the canvas concern isolated and the rest unit-testable, and means a future renderer change touches one boundary.

### Data + privacy unchanged

The ADR-082 normalization (`normalizePersonGraph` / `normalizeCommunityDepthGraph`, the `disclosureProjection`, relationship-state-not-weights) is **renderer-agnostic and reused verbatim**. No node exposes reputation numbers; structure + relationship state only.

## ADR — re-adopting react-force-graph-2d

Sprint 111 intentionally made D3 the **sole** graph dependency (removing react-force-graph). Phase 1 reverses that, so it requires an ADR (`ADR-083: Belonging graph rendering engine`) recording:
- **Decision:** adopt `react-force-graph-2d` as the belonging-graph renderer; D3 (`d3-force`/`d3-selection`) remains available for data/layout math but is no longer the renderer.
- **Why:** the graph is becoming the platform centerpiece; canvas rendering + built-in force/zoom/drag/hover scale and extend far better than hand-rolled SVG for an exploration surface that will grow (Phases 2–3 and beyond).
- **Consequences:** (a) supply-chain review per ADR-061 (new runtime dependency, pinned version, audit clean); (b) **test-strategy change** — canvas is not DOM-queryable, so renderer tests assert the **data contract, layout/style config, and interaction callbacks** (and the React chrome via DOM), not rendered SVG nodes; the S113 `querySelector('circle')`-style assertions are replaced; (c) one-time rebuild of the visual language in the new renderer.
- **Supersedes:** the S111 "single D3 graph dependency" direction (note it explicitly).

## IA consolidation (5 surfaces → 2 homes + explorer)

| Surface | Today | Phase 1 |
|---------|-------|---------|
| Person profile (`BelongingSection`) | ego graph section | **Home A** — renders `<BelongingGraph>` (your ego graph), opens `/network` |
| Community page (`TrustGraphTab`) | two sub-tabs (This Community / My Network) | **Home B** — member-topology `<BelongingGraph>`; the "My Network" sub-tab is **retired** (redundant with the profile ego graph) |
| `/network` explorer | 3 modes | **Explorer** — same component, full screen (kept) |
| Dashboard `TrustNetworkWidget` | People/Communities toggle | **Retired** — link to `/network` instead |
| Home preview card (`MyNetworkPreview`, S113) | Home feed card | **Retired** — the My Network nav link (S113) remains as the Home→graph entry |

Net: profile + community are the two homes; the explorer is the deep-dive; the dashboard widget, Home card, and community My-Network sub-tab are removed. Reputation/skills on profile stay where they are in Phase 1 (hero-prominence reordering is Phase 2).

## Parity checklist (must match v11.20.0 behavior)

- Person nodes uniform size (ADR-063); the "you" anchor enlarged + ringed; **community** nodes sized by membership (S113).
- Your-edges amber; cluster vs bridge edge coloring; **decay-tier edge fade** (ADR-070).
- Zoom controls (in/out/reset), single-owner; pinch/drag pan; wheel does not hijack page scroll.
- Empty/sparse states (ego "no connections", community "no trust yet", communities `<2`).
- Node-detail panel (structure-only: degrees away, connection count; community member_count/status/is_member). **No reputation numbers.**
- Fission split view (proposed-group coloring, isolated dashed ring, admin move-group action).
- Keyboard a11y (nodes focusable/activatable, names as tooltips) — preserved via the chrome/interaction layer.
- Depth readout + sparse state on the ego explorer (S113); the "Scale 1/2/3" framing text retained verbatim (removed in Phase 3).

## Test strategy

- **Renderer/data:** unit-test the `GraphCanvas` boundary's inputs — given `GraphData` + a layout, assert the nodes/links/styling objects passed to `react-force-graph-2d` and that `onNodeHover`/`onNodeClick` fire the right callbacks. (No SVG DOM assertions.)
- **Chrome/DOM:** the legend, zoom controls, empty/sparse states, and node-detail panel remain in DOM and keep `@testing-library` assertions.
- **Privacy regression:** keep/port the cross-user "no reputation number rendered" assertions against the node-detail panel (DOM) — these must not regress.
- **Surface wiring:** profile renders the ego graph; community renders member topology; the retired surfaces (dashboard widget, Home card, sub-tab) are gone (assert absence / updated nav).
- Replace the S113 `querySelector('circle')` radius/opacity tests with boundary/callback tests per the ADR.

## Risks & mitigations

- **Regression on just-shipped S113 features** (zoom, three modes, hub, depth readout) → the parity checklist is the acceptance gate; keep ADR-082 normalization untouched; port privacy assertions first.
- **Canvas testability** → the `GraphCanvas` boundary + DOM chrome split keeps most logic testable; the ADR records the strategy shift.
- **Supply-chain** → ADR-061 review, pinned version, `npm audit` clean before merge.
- **Bundle size** (canvas lib) → measure; `react-force-graph-2d` (2D-only) avoids the 3D/three.js weight.

## Success criteria (Phase 1)

- `react-force-graph-2d` adopted; ADR-083 merged; audit clean.
- The unified `<BelongingGraph>` renders all four modes at parity (checklist passes).
- Profile + community render the component; `/network` explorer works; the 3 redundant surfaces are retired with no dead references.
- Frontend unit + regression green (with the new test strategy); `tsc` clean; feedback:check clean; doc-context drift gate green.
- Deployed to demo; post-deploy check: every graph surface renders, zooms, and shows no NaN / no reputation numbers; nothing visibly worse than v11.20.0.

## Out of scope / carry-forward

- Trust-explanation endpoint + view, traversal, hero-prominence → **Phase 2**.
- Distinct fission-lineage channel, chrome/text removal, polish → **Phase 3**.
- No reputation-math change, no DB migration, no ADR-082 contract change anywhere in this initiative.
