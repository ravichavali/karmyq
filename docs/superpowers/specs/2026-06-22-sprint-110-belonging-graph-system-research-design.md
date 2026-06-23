# Sprint 110: Belonging Graph System — Research & ADR (Design Spec)

**Date**: 2026-06-22
**Status**: Approved (research sprint)
**Version**: v11.17.0 → v11.17.0 (no version bump — research/ADR only, **no-deploy**)
**Sprint Branch**: `feature/sprint-110-belonging-graph-research`
**Deliverable**: Layout audit + reference-product study + **ADR-081 (Proposed)** + the S111 implementation design spec. **No production code, no migration, no deploy.**

---

## Overview

Karmyq's graphs — trust paths, "your network," community connections — are one of the most
important ways the platform tells a member's story: *who they are, which communities they belong to,
and how their belonging is woven through people they've actually helped.* The maintainer's read is
that today these graphs look **patchy**, are **under-presented** for how much they matter, and should
be **more prominent and interactive (expandable, explorable)**.

This is a UX sprint, and per the project's standing rule (`feedback_ui_research_first`) **UX sprints
start with a layout audit + reference-product study before any implementation plan**. Following the
S104→S105 facelift precedent (research sprint produces a Proposed ADR + spec; the *next* sprint
implements), Sprint 110 is the **research half**. It produces the audit, the reference study, the
decision (ADR-081), and a ready-to-execute S111 implementation spec. **Sprint 111 implements and ships.**

### Core Principle: One belonging-graph system, presented like it matters

There should be exactly **one** graph engine, one visual language, and one interaction model for
"belonging," rendered consistently wherever belonging is shown — and given the visual weight of a
primary feature, not a sidebar widget. Every surface (dashboard, profile, community, the full-page
explorer, the inline trust-path badge) is a *view* of that single system, not a separate
re-implementation.

---

## Multi-Sprint Arc

### Sprint 109 — Geocoding Cache Hardening (complete, v11.17.0)
### Sprint 110 — Belonging Graph System: **Research & ADR-081** (this sprint, no-deploy)
### Sprint 111 — Belonging Graph System: **Implementation & ship** (upcoming, v11.18.0)

S110 decides *what* the unified, prominent, interactive/expandable graph system is and *how* it
migrates from today's patchwork. S111 builds it.

---

## Current-State Audit (the "patchy" feeling, made concrete)

This audit is the spine of the sprint. The execution chat must formalize and verify it into
`docs/design/sprint-110-belonging-graphs/audit.md`, but the findings below are established:

### Surfaces today (six surfaces, three visual idioms)

| # | Surface | Component(s) | Engine / idiom | Notes |
|---|---------|--------------|----------------|-------|
| 1 | Dashboard "Your Trust Network" | `dashboard/TrustNetworkWidget` → `NetworkGraph` (ego) / `CommunityDepthGraph` | D3 **HEB radial** *and* D3 **force layout** | People/Communities toggle. **Dead `View full →` link to `/network`.** |
| 2 | Profile page | `pages/profile.tsx` renders the *same* `TrustNetworkWidget` (L842) + `MemorySection` | same as #1 | Widget is reused but profile gives belonging no distinct, prominent treatment. |
| 3 | Community page | `community/tabs/TrustGraphTab` → `TrustGraph` → `graphs/TrustGraphHEB` | D3 HEB | community / ego subtabs + `MemoryLegend` + `ReWarmingNudge`. The richest surface. |
| 4 | Inter-community depth | `graphs/CommunityDepthGraph` | D3 **force layout** (different idiom) | Communities-as-nodes; organic vs fission edges. Looks unlike the HEB views. |
| 5 | Inline trust path | `TrustPathBadge` + `useTrustPath` | non-graph badge | Rendered in `RequestCard`, `OfferItem`, `DibsPrompt`, `KarmaBadge`, `MemorySection`, `providers/[id]`. The "how you're connected" micro-surface. |
| 6 | Fission | `FissionTab`, `FissionAssignmentView`, `FissionProposalModal` | D3 HEB (`fission` mode) | Reuses the HEB engine with a group map. |

### Root causes of "patchy"

1. **Two D3 idioms, not one.** The ego/community/fission views use **hierarchical edge bundling**
   (radial, `TrustGraphHEB`, 354 lines); the inter-community view uses a **force-directed layout**
   (`CommunityDepthGraph`, 213 lines). Same data domain, two unrelated visual languages → the set
   reads as inconsistent.
2. **Three dead graph libraries shipped.** `cytoscape`, `react-cytoscapejs`, and
   `react-force-graph-2d` are dependencies but render nothing (`cytoscape`/`react-cytoscapejs` are
   referenced only by `src/types/react-cytoscapejs.d.ts`; `react-force-graph-2d` is referenced
   **nowhere**). They are bundle weight + an "abandoned approach" smell, and likely the residue of
   earlier graph experiments that left the visuals half-migrated.
3. **A dead route.** `TrustNetworkWidget` links to `/network` ("View full →") but **`src/pages/network*`
   does not exist.** The "see the whole thing" affordance is broken — so the graph never gets a
   prominent, full-canvas home.
4. **Four overlapping wrappers redeclaring the same types.** `NetworkGraph`, `TrustGraph`,
   `TrustGraphHEB`, `CommunityDepthGraph` each redeclare `TrustNode` / `TrustLink`. No single source
   of truth for the graph data model on the client.
5. **Interactivity was removed, not improved.** Per `NetworkGraph`'s own comment: *"Progressive
   click-to-expand was removed in Sprint 79; the HEB component owns node selection and its own detail
   panel."* The current model is select-a-node-see-a-panel, **not** explore/expand. The maintainer
   wants expandable/explorable back — so S111 must re-introduce it deliberately, with a rationale for
   why it will work this time (see Open Questions).
6. **Under-presented.** On both dashboard and profile the graph is a `bg-slate-800/50 rounded-xl p-5`
   card — visually a secondary widget. For "the primary way we tell belonging," that altitude is too
   low.

### Data layer (shared, healthy — keep)

- `lib/socialGraphClient.ts` (141 lines), `lib/socialGraphUrls.ts`, `socialGraphService` in `lib/api.ts`.
- `hooks/useLazyGraphData.ts` — IntersectionObserver lazy-load (good; keep, the heavy D3 should stay lazy).
- `hooks/useTrustPath.ts` — powers `TrustPathBadge`.
- Backend: **social-graph-service** (port 3010). Graph data contracts (nodes/links, ego/community/
  depth/fission, decayTier per ADR-070) already exist; this sprint is **frontend presentation +
  consolidation**, not a backend redesign. Any new endpoint need discovered during research is an
  S111 line item, flagged here.

---

## Reference-Product Study (to be authored in S110)

The execution chat produces `docs/design/sprint-110-belonging-graphs/references.md` — a study of how
mature products present a personal/relationship graph *prominently and interactively*, each distilled
into 2–3 concrete "steal this" lessons for Karmyq. Required reference set (extend if useful):

| Product | What to study | Likely lesson for Karmyq |
|---------|---------------|--------------------------|
| **Obsidian / Roam graph view** | Full-canvas force graph as a first-class page; hover-highlight neighborhood; zoom-to-fit; depth filter | The `/network` explorer should be full-bleed and zoomable, not a card. |
| **LinkedIn "My Network" / connection degrees** | 1st/2nd/3rd-degree framing; "how you're connected" path | Aligns with `TrustPathBadge` + `degrees_of_separation`; make the path a *story*, not a chip. |
| **Are.na / Kumu / Nodus relationship maps** | Expand-on-click ego→neighborhood growth; clustering; node detail without leaving the canvas | The expand model to reintroduce post-S79. |
| **GitHub contribution graph / Spotify "wrapped"** | Making personal data feel like *identity*, warm and narrative | Belonging graph as a "this is you, here's your weave" moment on profile. |
| **D3 hierarchical edge bundling galleries** | Best-in-class HEB interaction (focus/fade, radial labels, transitions) | Polish the existing engine rather than replacing it. |

Each lesson must map to a specific Karmyq surface and an S111 task.

---

## Proposed Design Direction (the decision ADR-081 records)

The research must validate or revise the following direction; it is the spec's recommended target so
S111 has something concrete to build. ADR-081 records the chosen version with rationale + alternatives.

### D1 — One engine: D3 hierarchical edge bundling, polished

Standardize **all** belonging views on the existing `TrustGraphHEB` engine. The inter-community
"depth" view is re-expressed in the same HEB visual language (communities as the bundled set) so the
whole system shares cluster colors, amber "your" edges, decay-fade (ADR-070), node sizing, labels, and
transitions. **Retire the force-directed `CommunityDepthGraph` idiom** (port its data into HEB), or —
if research shows force layout is genuinely better for community-of-communities — explicitly scope it
as the *one* sanctioned exception with a shared visual token set. ADR-081 must state which.

### D2 — Remove the dead libraries

Drop `cytoscape`, `react-cytoscapejs` (+ its `.d.ts`), and `react-force-graph-2d` from
`apps/frontend/package.json`. D3 is the single graph dependency. (Verification that nothing imports
them is an S111 task; the audit already shows they're unused.)

### D3 — One client data model + one wrapper

Collapse `NetworkGraph` / `TrustGraph` / `CommunityDepthGraph` wrappers into a single
`<BelongingGraph mode=… />` component over a single shared `TrustNode`/`TrustLink`/`GraphData` type
(lifted to one module, ideally re-exported from `@karmyq/shared` if the backend already owns it).
Modes: `ego` | `community` | `communities` | `fission`.

### D4 — A real, prominent full-page explorer at `/network`

Build the page the dead link already promises: a **full-bleed, zoomable, explorable** belonging
explorer. Mode switch (you ↔ a community ↔ your communities), depth control, search/focus a member,
and **click-to-expand** a node's neighborhood inline. This is the "present more significantly" home;
the dashboard/profile widgets become *invitations* into it (`View full →` finally works).

### D5 — Reintroduce expand/explore deliberately (un-do the S79 removal)

S79 removed progressive expand in favor of a static ego graph + detail panel. Research must surface
*why* (perf? confusion? data volume?) and the design must answer it — e.g. expand only on the
full-page explorer (not the dashboard card), capped neighborhood growth, smooth layout transitions,
"collapse" affordance. ADR-081 records the rationale so we don't silently re-break what S79 fixed.

### D6 — Raise the altitude on profile

Treat the belonging graph on **profile** as a headline identity element (the "this is your weave"
moment), not a reused dashboard card. Exact treatment to be designed in S111; the spec commits to
*more prominent*, the design study informs *how*.

### Non-goals (explicit)

- No social-graph **backend** redesign. Frontend presentation + consolidation only (flag any endpoint
  gap for S111).
- No change to trust math, decay (ADR-070), or fission semantics — only their *presentation*.
- No new graph library. D3 stays; the others leave.

---

## Frontend Changes (S110)

**None to app code.** S110 ships documentation only:

- `docs/design/sprint-110-belonging-graphs/audit.md` — the formalized surface-by-surface audit + scorecard.
- `docs/design/sprint-110-belonging-graphs/references.md` — the reference-product study.
- `docs/adr/ADR-081-belonging-graph-system.md` (**Status: Proposed**) — the decision.
- The landing concept page for ADR-081 — **generated**, not hand-authored: add the slug to `ADR_GROUPS`
  in `scripts/generate-docs.ts`, then `cd apps/landing && npm run generate-docs` produces
  `concepts/adr-081-belonging-graph-system.json` and rewrites `nav.json`. Never hand-edit the output.
- The S111 implementation design spec (`docs/superpowers/specs/…-sprint-111-…-design.md`) as the
  research output.

---

## User Guide & Doc Updates

This is a research sprint, so user-facing guides change in **S111** when the feature ships. S110's doc
obligation is the **ADR-081 landing concept page** (authored + nav-wired so the drift gate passes) and
the design docs above. No `docs/guides/` change ships in S110 because no user-visible behavior changes
yet; the guide update is a tracked S111 deliverable.

---

## Critical Implementation Notes

1. **No-deploy, no version bump.** S110 merges docs/ADR only; ADR-081 is **Proposed**, version stays
   `11.17.0`. Mirror S104/ADR-079's research-sprint shape. The plan omits the deploy task.
2. **The audit is the deliverable — verify, don't assert.** Before writing the references/ADR, the
   execution chat must confirm each audit claim in code (dead libs unimported, `/network` truly
   absent, two D3 idioms) and capture exact file:line evidence.
3. **Do not start consolidating components in S110.** No app-code edits. Tempting "while I'm here"
   refactors (deleting dead libs, merging wrappers) belong to **S111** so the research stays clean and
   reviewable.
4. **Re-introducing expand must answer S79.** The design cannot just say "add expand back." It must
   state *why S79 removed it* and *how this design avoids that failure* (scope expand to `/network`,
   cap growth, smooth transitions). Put the rationale in ADR-081.
5. **Keep the data layer.** `socialGraphClient`, `useLazyGraphData`, `useTrustPath`, and the
   social-graph-service contracts are healthy — the sprint is presentation/consolidation, not a data
   rewrite. Lazy-loading the heavy D3 must survive the redesign.
6. **Drift gate: ADR must be indexed + nav-wired.** ADR-081 must appear in `docs/adr/README.md` and
   the landing concept must have a `nav.json` entry, or `doc-context-drift-gate.test.ts` fails CI.
7. **Landing docs are GENERATED — never hand-edit `nav.json` or the concept JSON.**
   `scripts/generate-docs.ts` builds the concept JSON from `docs/adr/*.md`, writes `nav.json` from the
   `ADR_GROUPS` list, and `main()` does `fs.rmSync(OUT_DIR)` first — so hand edits are wiped on the next
   build. This generator *is* the "nav.json silently reverts" gotcha (`feedback_nav_json_revert`). Wire
   via `ADR_GROUPS` + regenerate (`reference_generate_docs`).
8. **Landing generated docs are gitignored** — `git add -f apps/landing/src/data/docs` after generating.
9. **This repo is Windows/PowerShell** — author verification commands in `rg`/PowerShell, not Bash.
10. **Pre-push gate still runs `npm test`.** Even on a docs-only sprint the blocking gate is `npm test`
    (unit + regression); run it before pushing rather than treating drift/feedback as the only gates.
11. **ADR numbering:** S109 used ADR-080; S110 uses **ADR-081**; next free after = 082.
12. **Decide CommunityDepthGraph's fate explicitly.** D1 proposes retiring the force idiom into HEB;
    if research argues to keep it, ADR-081 must name it the single sanctioned exception with shared
    tokens — don't leave two idioms undecided.
