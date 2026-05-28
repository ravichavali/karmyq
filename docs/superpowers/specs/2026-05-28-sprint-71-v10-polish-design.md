# Sprint 71: v10.0 Polish + karmyq.org Update — Design Spec

**Date**: 2026-05-28
**Status**: Approved
**Version**: v9.95.0 → v10.0.0
**Sprint Branch**: `feature/sprint-71-v10-polish`

---

## Overview

Sprint 70 shipped the Fusion Mechanism, completing the Trust Network Arc (Sprints 65–70). Sprint 71 is the capstone: it polishes the two community lifecycle features (fission + fusion), updates the public karmyq.org site to reflect v10.0, and bumps the root package version.

The graph work addresses two known UX problems deferred from Sprint 69: the ego-network view scatters nodes randomly (the current user is not visually anchored), and the fission bipartite view fails to reliably separate Group A from Group B because a force simulation optimizes for trust-based clustering, not group assignment. Both can be fixed with targeted changes — no library swaps, no full rewrites.

The landing page update adds community lifecycle (fission + fusion) to the "How communities govern themselves" narrative in `HowItWorks.tsx`, giving v10.0 a natural milestone feel without touching the emotional arc of `TheStory.tsx` or `TheThinking.tsx`.

### Core Principle: Targeted Polish

Sprint 71 fixes specific, named UX problems. It does not generalize or expand scope. A fix is right-sized when the UX problem it solves is exactly as large as the change required.

---

## Multi-Sprint Arc: Trust Network (complete after this sprint)

| Sprint | Theme | Status |
|--------|-------|--------|
| **65** | Trust Graph Foundation | ✅ Shipped v9.50.0 |
| **66** | Trust Graph Visualization + Governance ADR | ✅ Shipped v9.60.0 |
| **67** | Ego-Network + Governance | ✅ Shipped v9.70.0 |
| **68** | Interaction Half-Life (Ebbinghaus decay) | ✅ Shipped v9.80.0 |
| **69** | Fission Mechanism | ✅ Shipped v9.90.0 |
| **70** | Fusion Mechanism | ✅ Shipped v9.95.0 |
| **71** | v10.0 Polish + karmyq.org update | 🔲 This sprint |

---

## Problem Statements

### P1: Ego-network — current user node drifts

In `TrustGraphTab`, the force simulation places the current user node wherever d3 happens to settle it. For an ego-network (your direct connections), the user should be visually at the center. Neighbors should orbit around them. Right now the current user can end up at a corner or edge, making the graph hard to read.

**Fix**: Pin the current user node at the simulation origin (`fx: 0, fy: 0`). react-force-graph-2d respects `fx`/`fy` as frozen coordinates. The rest of the simulation runs normally, and d3's link/charge forces will naturally arrange neighbors around the pinned center. Also raise `warmupTicks` to 120 so the simulation stabilizes before the first paint.

### P2: Fission graph — groups don't visually separate

In `FissionTab`, the fission graph shows all members colored by group (blue/orange) but force-directed layout clusters nodes by trust weight, not by group assignment. Members in different groups who trust each other end up adjacent. The Group A / Group B distinction becomes hard to read.

**Fix**: Add a custom d3 x-force when `groupMap` is provided. Group A nodes are attracted to `graphWidth × 0.28`, Group B to `graphWidth × 0.72`, unassigned to center. This is applied via the `ForceGraph` ref after each render. No new dependency required — react-force-graph-2d exposes the underlying d3 simulation via `fgRef.current.d3Force(...)`.

### P3: Landing page — community lifecycle is invisible

The "How communities govern themselves" section in `HowItWorks.tsx` mentions the 150-member Dunbar limit but says nothing about what happens when a community approaches it. Fission and fusion now exist — they should be part of the public narrative.

**Fix**: Add a focused paragraph block (3 paragraphs) to the "How communities govern themselves" section describing the community lifecycle: size alerts → governed fission → community fusion. Framing is philosophical (trust-informed splitting, voluntary merging) not mechanical (no API route names).

### P4: Version number out of sync

Root `package.json` says `9.50.0` (set at Sprint 65, never updated). The handoff tracks versions separately. Bump root to `10.0.0`.

---

## Data Model

No schema changes this sprint.

---

## API Endpoints

No new or modified endpoints this sprint.

---

## Frontend Changes

### `apps/frontend/src/components/TrustGraph.tsx`

Two mode-specific changes:

**Ego-network mode (when `groupMap` is undefined):**
- `fgData` useMemo: add `fx: 0, fy: 0` to the node whose `id === currentUserId`
- Add `warmupTicks={120}` prop to ForceGraph (was `cooldownTicks={100}` only)
- Add `fgRef` and wire `d3Force` to strengthen the center charge (optional, may not be needed once user is pinned)

**Fission mode (when `groupMap` is defined):**
- Add `fgRef = useRef<any>(null)` 
- Add a `useEffect` that fires after `[graphData, groupMap, graphWidth]` change:
  - Calls `fgRef.current.d3Force('x', ...)` with a position force toward left column (Group A) or right column (Group B)
  - Calls `fgRef.current.d3ReheatSimulation()` to re-run the simulation with the new force
- Strength: `0.4` — strong enough to separate groups, gentle enough not to fight the link force
- Unassigned nodes attracted to `graphWidth * 0.5` (center column)

No changes to the component's public API (props unchanged).

### `apps/landing/src/components/sections/HowItWorks.tsx`

**Add to "How communities govern themselves" section**, after the existing two paragraphs:

A new `AnimateOnScroll`-wrapped paragraph block (3 paragraphs) describing:
1. What happens as a community approaches 150 members — the platform surfaces a size alert
2. Fission: governed, trust-informed splitting — admin proposes, members vote (prestige-weighted), algorithm suggests member groupings from trust graph data
3. Fusion: two communities can choose to merge — bilateral proposal, parallel vote, atomic execution
4. Frame these as sovereignty: communities control their own shape over time

### Root `package.json`

`"version": "9.50.0"` → `"version": "10.0.0"`

---

## User Guide & Doc Updates

**Required every sprint:**

1. **`docs/guides/trust-graph.md`** + **`apps/landing/src/data/docs/guides/trust-graph.json`**
   - Add a note about the ego-network anchor: current user is now pinned at center
   - Add a brief section on fission mode: "When your community has an active fission proposal, the Trust Graph tab shows a Group Assignment view..."

No new guides needed — fission and fusion guides already exist and are linked from nav.json.

---

## Critical Implementation Notes

1. **`fx`/`fy` must go in the `fgData` useMemo** — not in the raw `graphData.nodes`. The useMemo produces the copy that react-force-graph-2d owns. Setting `fx`/`fy` on the original node objects would mutate shared state.

2. **`fgRef` for fission x-force**: The ref must be passed as `ref={fgRef}` to the `<ForceGraph>` component. `fgRef.current.d3Force(...)` is only callable after the component mounts. Wrap in a `useEffect` with a guard: `if (!fgRef.current) return`.

3. **`d3ReheatSimulation()` after x-force**: Adding a new force doesn't re-run the simulation automatically. Must call `fgRef.current.d3ReheatSimulation()` to trigger it.

4. **Do not add d3 as a direct import**: react-force-graph-2d bundles d3. Use `fgRef.current.d3Force('x', d3.forceX(...).strength(...))` only if d3 is already available in scope via the ref's simulation object. If not, create a simple custom force function inline: a force is just `(alpha) => { nodes.forEach(node => { node.vx += (target - node.x) * strength * alpha }) }`.

5. **`warmupTicks` vs `cooldownTicks`**: `warmupTicks` runs the simulation synchronously before first render (improves initial layout). `cooldownTicks` limits how long the live animation runs. Use `warmupTicks={120} cooldownTicks={50}` — fast initial settle, stops animating quickly.

6. **Landing page `git add -f`**: `apps/landing/src/data/docs/` is in `.gitignore`. Always use `git add -f` for files in that path.

7. **nav.json regeneration**: `scripts/generate-docs.ts` overwrites nav.json on every docs build. No nav changes needed this sprint (trust-graph.json is already in nav), but always grep-verify after any `npm run docs` invocation.

8. **ADR status**: Both ADR-057 and ADR-058 are already `implemented` in source `.md` files and landing page `.json` files. No ADR work needed this sprint.
