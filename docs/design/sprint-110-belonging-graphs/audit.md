# Belonging Graph System — Current-State Audit (Sprint 110)

**Date**: 2026-06-22  
**Sprint**: 110 (research only — no app code changes)  
**Status**: Verified against codebase; all claims include file:line evidence

---

## Six Surfaces, Three Visual Idioms

| # | Surface | Component(s) | Engine / idiom | File evidence |
|---|---------|--------------|----------------|---------------|
| 1 | **Dashboard "Your Trust Network"** | `TrustNetworkWidget` → `NetworkGraph` (People tab) / `CommunityDepthGraph` (Communities tab) | D3 **HEB radial** (People) + D3 **force layout** (Communities) | `components/dashboard/TrustNetworkWidget.tsx:L1-55`, `components/NetworkGraph.tsx:L1-62`, `components/graphs/CommunityDepthGraph.tsx:L1-213` |
| 2 | **Profile page** | `pages/profile.tsx:L842` imports same `TrustNetworkWidget` | same as #1 (reused widget) | `pages/profile.tsx:L10,842` |
| 3 | **Community page** | `community/tabs/TrustGraphTab.tsx` → `TrustGraph.tsx` → `graphs/TrustGraphHEB.tsx` | D3 **HEB** (community + ego subtabs) | `components/community/tabs/TrustGraphTab.tsx`, `components/TrustGraph.tsx:L1-55`, `components/graphs/TrustGraphHEB.tsx:L1-354` |
| 4 | **Inter-community depth** | `graphs/CommunityDepthGraph.tsx` | D3 **force / circular** layout (different idiom) | `components/graphs/CommunityDepthGraph.tsx:L1-213` |
| 5 | **Inline trust path** | `TrustPathBadge.tsx` + `hooks/useTrustPath.ts` | Non-graph badge (path chip) | Used in: `components/Feed/RequestCard.tsx`, `components/OfferItem.tsx:L2-3,49,69-70`, `components/requests/DibsPrompt.tsx`, `components/KarmaBadge.tsx`, `components/profile/MemorySection.tsx`, `pages/providers/[id].tsx` |
| 6 | **Fission** | `community/tabs/FissionTab.tsx` → `TrustGraph` with `mode="fission"` | D3 **HEB** (fission mode) | `components/TrustGraph.tsx:L52-54`, `components/graphs/TrustGraphHEB.tsx` (mode prop) |

---

## Root Causes of "Patchy"

### RC-1: Two D3 idioms, not one

The ego / community / fission views all use **hierarchical edge bundling** (radial, nodes arranged on
a circle, bundled bezier curves) implemented in `components/graphs/TrustGraphHEB.tsx` (354 lines).
The inter-community "Communities" tab in the widget uses `components/graphs/CommunityDepthGraph.tsx`
(213 lines), which uses a **circular layout with straight-line SVG edges** — a visually different
idiom even though it does not use D3's force simulation. Both use D3 but in completely different
ways: HEB uses `d3.cluster()` + custom bezier bundles; `CommunityDepthGraph` computes a static
circle ring with `Math.sin/cos`. The same visual domain (trust/belonging network) presented in two
unrelated visual languages makes the app feel like two separate products.

Evidence:
- `TrustGraphHEB.tsx`: uses `d3.cluster()`, `d3.linkRadial()`, hierarchical bundling
- `CommunityDepthGraph.tsx:L60-70`: uses `orderedNodes`, deterministic circular layout, `degreeById`

### RC-2: Three dead graph libraries — bundle weight + abandoned approach smell

`apps/frontend/package.json` lists three graph libraries that render nothing:
- `"cytoscape": "^3.33.4"` — only reference is `src/types/react-cytoscapejs.d.ts` (a manual type shim, not an actual import)
- `"react-cytoscapejs": "^2.0.0"` — same, referenced only by the `.d.ts`; no TSX/JSX import in source
- `"react-force-graph-2d": "^1.29.1"` — referenced **nowhere** in `apps/frontend/src/`
- `"@types/cytoscape": "^3.21.9"` — type package for the dead library

Verification:
```
rg "cytoscape|react-cytoscapejs|react-force-graph" apps/frontend/src --glob "!*.d.ts"
# → no output (zero non-declaration imports)
```
These are residue of an earlier graph experiment that migrated to D3 but left the old libraries in
`package.json`. They add bundle weight and signal an abandoned approach to any reader of the manifest.

### RC-3: A dead `/network` route

`components/dashboard/TrustNetworkWidget.tsx:L28-29` renders:
```tsx
<Link href="/network" className="text-sm text-indigo-400 hover:text-indigo-300">
  View full →
</Link>
```
But `apps/frontend/src/pages/network*` **does not exist**:
```powershell
ls apps/frontend/src/pages/network*   # → No such file
```
The "see the whole thing" affordance is broken — the graph can never reach a full-canvas,
prominent, explorable home. The dead link undersells both the widget and the graph system.

### RC-4: Four wrappers redeclaring the same types

Each of the four graph components declares its own `TrustNode` / `TrustLink` interface:

| File | Interface(s) declared | Lines |
|------|-----------------------|-------|
| `components/graphs/TrustGraphHEB.tsx` | `TrustNode`, `TrustLink`, `TrustGraphData`, `TrustGraphHEBProps` | L1-50 |
| `components/TrustGraph.tsx` | `TrustNode`, `TrustLink`, `TrustGraphData`, `TrustGraphProps` | L1-36 |
| `components/NetworkGraph.tsx` | `TrustNode`, `TrustLink`, `NetworkGraphProps` | L14-30 |
| `components/community/tabs/TrustGraphTab.tsx` | `TrustNode`, `TrustLink`, `GraphData` | L13-32 |
| `components/graphs/CommunityDepthGraph.tsx` | `DepthNode`, `DepthLink` (different shape) | L7-22 |

No single source of truth for the client graph data model. When the backend data contract changes,
every one of these must be updated. The `CommunityDepthGraph` uses a completely different shape
(`DepthNode`/`DepthLink` vs `TrustNode`/`TrustLink`), deepening the split.

### RC-5: Expand/explore was removed, not improved

`components/NetworkGraph.tsx:L36-40` (the JSDoc comment):
> "Progressive click-to-expand was removed in Sprint 79; the HEB component owns node selection
> and its own detail panel."

The maintainer's goal is an **expandable, explorable** belonging graph. The current model is
select-a-node → static detail panel — useful but not explorable. Sprint 79 removed progressive
expand (reason not documented in-code). S111 must re-introduce it deliberately, stating why S79
removed it and how this avoids repeating that failure.

### RC-6: Under-presented altitude on dashboard and profile

`components/dashboard/TrustNetworkWidget.tsx:L19`:
```tsx
<div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
```
The graph lives in a secondary card, visually indistinguishable from any other widget. On profile
(`pages/profile.tsx:L842`) it is the same reused `TrustNetworkWidget` — no distinct "this is you,
here's your weave" treatment for belonging. For "the primary way we tell belonging," this altitude
is too low.

---

## Data Layer Health Assessment (keep)

The backend-facing data layer is **healthy and should not change in S110 or S111**:

| Asset | File | Lines | Assessment |
|-------|------|-------|------------|
| `socialGraphClient` | `lib/socialGraphClient.ts` | 141 | Well-typed; exposes trust path, ego graph, community graph, depth graph, fission | Keep |
| `socialGraphUrls` | `lib/socialGraphUrls.ts` | 8 | URL builder | Keep |
| `socialGraphService` (in `api.ts`) | `lib/api.ts` | — | Axios-backed graph endpoints | Keep |
| `useLazyGraphData` | `hooks/useLazyGraphData.ts` | 71 | IntersectionObserver lazy-load; prevents heavy D3 from blocking page paint | Keep |
| `useTrustPath` | `hooks/useTrustPath.ts` | 147 | Powers `TrustPathBadge`; caching + error handling | Keep |
| social-graph-service | port 3010 | — | Graph data contracts (nodes/links, ego/community/depth/fission, decayTier per ADR-070) | Keep |

This sprint is **frontend presentation + consolidation**, not a backend redesign. Any new endpoint
need discovered during the reference study is an S111 line item, flagged in the spec.

---

## Surface-by-Surface Scorecard (1–5)

| Surface | Consistency | Prominence | Interactivity | Belonging narrative | Code health | Total |
|---------|:-----------:|:----------:|:-------------:|:-------------------:|:-----------:|:-----:|
| Dashboard widget (People) | 3 | 2 | 2 | 2 | 3 | **12** |
| Dashboard widget (Communities) | 1 | 2 | 2 | 2 | 3 | **10** |
| Profile (reused widget) | 2 | 2 | 2 | 1 | 3 | **10** |
| Community TrustGraphTab | 4 | 4 | 3 | 3 | 3 | **17** |
| Inter-community depth | 2 | 3 | 2 | 2 | 3 | **12** |
| Inline TrustPathBadge | 4 | 3 | 2 | 3 | 4 | **16** |
| Fission (via TrustGraph) | 4 | 3 | 3 | 3 | 3 | **16** |

Scoring key: 1 = poor, 3 = acceptable, 5 = excellent  
Community TrustGraphTab leads because it has the richest data, two sub-tabs, MemoryLegend, and
ReWarmingNudge. Profile trails because it is the same widget as the dashboard with no distinct
"belonging as identity" framing.

---

## Prioritized Problem List

1. **Dead `/network` route** — the highest-impact fix: a working full-canvas explorer turns every
   widget's "View full →" into a real affordance and gives belonging a first-class home.
2. **Two D3 idioms** — the Communities tab and the Community page read as different products;
   consolidating to one engine (or explicitly sanctioning the exception) restores visual coherence.
3. **No expand/explore** — the S79 removal left the graph static-but-selectable; progressive expand
   on the full-page explorer would make "belonging" feel alive and explorable.
4. **Under-presented on profile** — the "this is your weave" moment is the same card as the dashboard;
   profile should treat belonging as a headline identity element.
5. **Type sprawl / four wrappers** — four sets of `TrustNode`/`TrustLink` declarations create
   maintenance overhead; a single `<BelongingGraph mode>` wrapper over a shared type is cleaner.
6. **Dead libraries** — `cytoscape`, `react-cytoscapejs`, `react-force-graph-2d` add bundle weight
   and signal an abandoned approach; removing them is low-risk and clarifying.
