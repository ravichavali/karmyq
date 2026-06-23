# Sprint 111: Belonging Graph System — Implementation & Ship (Design Spec)

**Date**: 2026-06-22
**Status**: Ready to execute (follows S110 research)
**Version**: v11.17.0 → v11.18.0
**Sprint Branch**: `feature/sprint-111-belonging-graph-system`
**ADR**: ADR-081 (Proposed in S110, implement → Implemented in S111)
**Deliverable**: One HEB engine, one data model, one expandable `/network` explorer, raised profile
altitude, dead-lib removal. Ships as v11.18.0.

---

## Overview

Sprint 110 produced the audit, the reference study, and ADR-081 (Proposed). Sprint 111 implements it.
The work is frontend-only (no backend redesign) except for one new endpoint (`GET /trust/neighborhood/:userId`,
added to `trustGraph.ts`, mounted at `/trust`) needed for the click-to-expand feature. No DB schema
changes. The `BelongingPulse` profile stat reuses existing reputation/community read APIs (see §Profile
Altitude) rather than a raw DB query. No deploy-script changes.

**Core change**: Replace today's patchwork of four graph wrappers with a single `<BelongingGraph mode>` component over a canonical data model; build the full-page `/network` explorer; raise the profile graph to headline altitude.

---

## Pre-Sprint Context (derived from S110 audit)

### What exists and is healthy — keep unchanged

| Asset | File | Role |
|-------|------|------|
| `TrustGraphHEB` | `components/graphs/TrustGraphHEB.tsx` (354 lines) | The HEB D3 engine — the single canonical renderer |
| `socialGraphService` | `lib/api.ts` (L840+) | **The graph data fetches**: `getTrustGraphAggregate()` (ego), `getFullCommunityGraph(id)`/`getTrustGraph(id)` (community), `getCommunityGraph()` (inter-community depth) |
| `socialGraphClient` | `lib/socialGraphClient.ts` (141 lines) | **Paths + invitations only** (`getPath`/`getBatchPaths` + invitations) — NOT graph fetches |
| `useLazyGraphData` | `hooks/useLazyGraphData.ts` (71 lines) | IntersectionObserver lazy-load for heavy D3 |
| `useTrustPath` | `hooks/useTrustPath.ts` (147 lines) | Powers TrustPathBadge |
| social-graph-service | port 3010 | Graph data contracts (nodes/links, ego/community/depth/fission, decayTier). Routes in `src/routes/trustGraph.ts`, mounted at `/trust`: `GET /trust/graph`, `GET /trust/graph/:id/full`, `GET /trust/communities` |

### What needs to change

| Issue | Change |
|-------|--------|
| `CommunityDepthGraph.tsx` (circular idiom) | Fold into `TrustGraphHEB` as `mode="communities"` |
| `NetworkGraph.tsx` wrapper | Replace with `<BelongingGraph mode="ego">` |
| `TrustGraph.tsx` wrapper | Replace with `<BelongingGraph mode={mode}>` |
| Dead libs: `cytoscape`, `react-cytoscapejs`, `react-force-graph-2d` | Remove from `package.json` + delete `.d.ts` |
| Dead `/network` route | Build `/network` page (full-page explorer) |
| Profile widget: reused dashboard card | Replace with `<BelongingSection>` (higher altitude) |
| Four `TrustNode`/`TrustLink` type declarations | Collapse to `components/graphs/types.ts` |

---

## File Map

### New files to create

| File | Responsibility |
|------|---------------|
| `apps/frontend/src/components/graphs/types.ts` | Canonical `TrustNode`, `TrustLink`, `GraphData` types + `BelongingMode` union |
| `apps/frontend/src/components/BelongingGraph.tsx` | Single `<BelongingGraph mode>` wrapper dispatching to `TrustGraphHEB`; replaces `NetworkGraph` + `TrustGraph` + `CommunityDepthGraph` |
| `apps/frontend/src/components/BelongingSection.tsx` | Profile "How you're woven into Karmyq" headline section (raised altitude) |
| `apps/frontend/src/components/BelongingPulse.tsx` | "You've helped N people across M communities" stat line (above profile graph) |
| `apps/frontend/src/pages/network.tsx` | Full-page `/network` explorer: full-bleed SVG, mode switch, depth slider, search/focus, zoom/pan, click-to-expand |

### Existing files to modify

| File | Change |
|------|--------|
| `components/graphs/TrustGraphHEB.tsx` | Add `communities` mode (port `CommunityDepthGraph` data handling); add `onNodeExpand` prop + hover-highlight; add `<title>` for node tooltips |
| `components/dashboard/TrustNetworkWidget.tsx` | Replace `NetworkGraph` import with `<BelongingGraph mode="ego">` and `<BelongingGraph mode="communities">` |
| `components/community/tabs/TrustGraphTab.tsx` | Replace `TrustGraph` import with `<BelongingGraph mode="community">` / `mode="ego"` |
| `components/community/tabs/FissionTab.tsx` | Replace `TrustGraph mode="fission"` with `<BelongingGraph mode="fission">` |
| `pages/profile.tsx` | Replace `TrustNetworkWidget` at L842 with `<BelongingSection>` |
| `apps/frontend/package.json` | Remove `cytoscape`, `react-cytoscapejs`, `@types/cytoscape`, `react-force-graph-2d` |
| `apps/frontend/src/types/react-cytoscapejs.d.ts` | Delete |
| `lib/api.ts` | Add `getNeighborhood(userId: string)` to `socialGraphService` (calls `GET /trust/neighborhood/:userId`) for the expand endpoint |
| `docs/adr/ADR-081-belonging-graph-system.md` | Update status from `Proposed` → `Implemented` |
| `scripts/generate-docs.ts` | (already wired in S110 — no change needed) |
| `.claude/handoff/CURRENT_HANDOFF.md` | Update to S111 complete / S112 direction |

### Files to delete

| File | Reason |
|------|--------|
| `apps/frontend/src/components/NetworkGraph.tsx` | Replaced by `<BelongingGraph mode="ego">` |
| `apps/frontend/src/components/TrustGraph.tsx` | Replaced by `<BelongingGraph mode={mode}>` |
| `apps/frontend/src/components/graphs/CommunityDepthGraph.tsx` | Folded into `TrustGraphHEB` + `BelongingGraph` |
| `apps/frontend/src/types/react-cytoscapejs.d.ts` | Dead type shim for removed library |

### Backend (social-graph-service)

| File | Change |
|------|--------|
| `services/social-graph-service/src/routes/trustGraph.ts` | Add `GET /trust/neighborhood/:userId` (router path `/neighborhood/:userId`, mounted at `/trust`) → returns 1-hop `TrustNode[]` + `TrustLink[]` for the given user (needed for click-to-expand on `/network`) |
| `services/social-graph-service/src/routes/trustGraph.ts` | Consider: can the `GET /trust/communities` response (`getCommunityDepthGraph`) be reshaped to emit `TrustNode`/`TrustLink` format directly? Audit in S111 Task 3 |
| `services/social-graph-service/.claude/CONTEXT.md` | Document new endpoint |
| `services/registry.json` | Add new endpoint to `social-graph-service` `apis.provides` |

---

## Component API Designs

### `types.ts` — canonical client graph types

```typescript
export type BelongingMode = 'ego' | 'community' | 'communities' | 'fission'

export interface TrustNode {
  id: string
  name: string
  trust_score: number
  karma: number
  isCurrentUser?: boolean
  isIsolated?: boolean
  // S111 additions (optional, from backend if available)
  degrees_of_separation?: number  // for degree-ring encoding (stretch)
  member_count?: number           // for communities mode (from DepthNode)
  is_member?: boolean             // for communities mode (from DepthNode)
}

export interface TrustLink {
  source: string
  target: string
  raw_weight: number
  effective_weight: number
  decayTier?: 'strong' | 'warm' | 'fading' | 'nearly_forgotten' | 'swept'
  type?: 'organic' | 'fission'   // for communities mode (from DepthLink)
}

export interface GraphData {
  nodes: TrustNode[]
  links: TrustLink[]
}
```

### `BelongingGraph.tsx` — single wrapper

```typescript
interface BelongingGraphProps {
  mode: BelongingMode
  // For community + ego modes:
  communityId?: string
  currentUserId: string
  // For fission mode:
  groupMap?: Record<string, 'group_a' | 'group_b'>
  groupALabel?: string
  groupBLabel?: string
  onSwitchGroup?: (nodeId: string, group: 'group_a' | 'group_b' | null) => Promise<void>
  height?: number
  // For expand mode (only active on /network page):
  expandable?: boolean
  onNodeExpand?: (nodeId: string) => Promise<GraphData>
}
```

`BelongingGraph` handles its own data fetching via `useLazyGraphData` + `socialGraphService` (the
graph fetches in `api.ts` — **not** `socialGraphClient`, which is paths/invitations only), dispatches
to `TrustGraphHEB`, and normalizes `communities` mode data from the `getCommunityGraph()` response to
`TrustNode`/`TrustLink` shape.

### `/network` page — full-page explorer

Route: `pages/network.tsx`

```
/network                  → defaults to ego mode
/network?mode=ego         → your trust network
/network?mode=community&id=<communityId>  → specific community graph
/network?mode=communities → all communities depth graph
```

Page structure:
```
<PageLayout>
  <header>
    <h1>Your Network</h1>
    <ModeSwitch value={mode} onChange={setMode} />        {/* ego | community | communities */}
    {mode === 'community' && <CommunityPicker onChange={setSelectedCommunityId} />}
    <DepthSlider value={depth} onChange={setDepth} min={1} max={3} />  {/* stretch */}
    <SearchBox placeholder="Find a member…" onFocus={focusNode} />     {/* stretch */}
  </header>
  <main style={{ flex: 1, position: 'relative' }}>
    <BelongingGraph
      mode={mode}
      currentUserId={user.id}
      communityId={selectedCommunityId}
      height={windowHeight - HEADER_HEIGHT}
      expandable           ← enables click-to-expand
      onNodeExpand={async (id) => socialGraphService.getNeighborhood(id)}
    />
  </main>
</PageLayout>
```

The page uses `next/dynamic` with `ssr: false` to avoid hydration issues with the D3 SVG.

---

## `TrustGraphHEB` Extensions

### `communities` mode (porting `CommunityDepthGraph` behavior)

The `communities` mode receives `TrustNode[]` where each node represents a community. The HEB
cluster layout remains radial but uses `member_count` for node sizing (larger member count = larger
node) and `is_member` for the emerald ring (member communities are emphasized). Edge `type`:
`organic` → solid slate line; `fission` → dashed violet line (same semantic as `CommunityDepthGraph`'s
color scheme, but expressed in HEB visual language).

Data normalization in `BelongingGraph` (not in `TrustGraphHEB`) converts `DepthNode`/`DepthLink`
to `TrustNode`/`TrustLink`:
```typescript
// DepthNode → TrustNode
{ id, name, member_count, is_member, status } → { id, name, trust_score: 0, karma: 0, member_count, is_member }
// DepthLink → TrustLink
{ source, target, weight, type } → { source, target, raw_weight: weight, effective_weight: weight, type }
```

**Discovery task**: Does `GET /trust/communities` (the `getCommunityDepthGraph` response) already
return these fields, or does `member_count`/`is_member` need to be added? Audit the endpoint response
in Task 3.

### Hover-highlight (neighborhood focus + fade)

Add `onMouseEnter`/`onMouseLeave` to node elements. On hover, set `activeNodeId`; in the path
selection, apply `opacity = isNeighbor(d) || d.id === activeNodeId ? 1 : 0.15`. "Neighbor" =
any node connected by a link where `link.source === activeNodeId || link.target === activeNodeId`.

### Click-to-expand (full-page explorer only, `expandable` prop)

When `expandable=true` and `onNodeExpand` is provided, clicking a node (instead of showing the
detail panel) calls `onNodeExpand(node.id)`, merges the returned neighborhood into `graphData`,
and re-runs the cluster layout with `.transition().duration(400)`. Collapse: right-click or ✕
button on expanded node collapses back. Cap: max 3 expanded nodes at once (FIFO).

### Node tooltips

Add `<title>{node.name}</title>` inside the D3 `text` selection — native browser tooltip on
overflow. Zero layout change.

---

## Profile Altitude: `BelongingSection` + `BelongingPulse`

Replace `pages/profile.tsx:L842 <TrustNetworkWidget>` with:

```tsx
<BelongingSection userId={user.id} />
```

`BelongingSection` renders:
1. A warm section heading: "How you're woven into Karmyq"
2. `<BelongingPulse userId>` — the stat line
3. `<BelongingGraph mode="ego" currentUserId height={480}>` (larger than widget's 360)
4. `<a href="/network?mode=ego">Explore your full network →</a>`

`BelongingPulse` derives its two numbers from **existing read APIs — no new backend endpoint and no
raw DB query** (`reputation.karma_records` has no `karma_awarded_to` column; the recipient *is*
`user_id`, so "people you helped" is NOT derivable from that table):

- **N people** = node count from the ego graph `BelongingSection` already fetches
  (`socialGraphService.getTrustGraphAggregate()`). Trust-graph edges are built from helping
  relationships, so "people you're connected to" is the honest, available version of this stat.
  Pass the loaded `graphData.nodes.length - 1` (minus the current-user node) down to `BelongingPulse`
  to avoid a second fetch.
- **M communities** = `communityService.getMyCommunities(userId)` length (existing API; schema is
  `communities.members`, plural schema name — but the component never touches SQL directly).

Combine: `"You're connected to N people across M communities"` as a `<p>` in warm text above the
graph. (Copy intentionally says "connected to," not "helped" — the graph encodes trust connections,
and a literal "helped" count would require a new reputation aggregate the research did not scope.)

---

## Dead Library Removal

```bash
# In apps/frontend/
npm uninstall cytoscape react-cytoscapejs @types/cytoscape react-force-graph-2d
rm src/types/react-cytoscapejs.d.ts
```

Verification:
```powershell
rg "cytoscape|react-cytoscapejs|react-force-graph" apps/frontend/src --glob "!*.d.ts"
# → no output
```

Bundle impact: cytoscape + react-cytoscapejs ≈ 1.1 MB pre-minify; react-force-graph-2d ≈ 500 KB.

---

## Backend: `GET /trust/neighborhood/:userId`

Add to `services/social-graph-service/src/routes/trustGraph.ts` (the existing graph router, mounted at
`/trust` in `src/index.ts`). The router uses bare paths (e.g. `router.get('/graph', …)` →
`/trust/graph`), so the new route is `router.get('/neighborhood/:userId', …)` → `/trust/neighborhood/:userId`.
Auth is applied at the router mount (`rateLimiters.readLight` + the service's auth middleware that
populates `req.user.userId`); follow the existing `/trust/graph` handler shape, not a per-route
`requireAuth`.

```typescript
// router.get('/neighborhood/:userId', …)  → GET /trust/neighborhood/:userId
// Returns 1-hop TrustNode[] + TrustLink[] for the given userId
// Used by click-to-expand on the /network explorer
router.get('/neighborhood/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params
  const callingUserId = (req as any).user?.userId
  // Query trust_edges_live (the VIEW) where source = userId OR target = userId (1-hop)
  // Return: res.json({ success: true, data: { nodes: TrustNode[], links: TrustLink[] } })
})
```

The result is the 1-hop neighborhood (direct trust edges) of the given user — nodes the current user
may not know yet. Read from `trust_edges_live` (a VIEW — never INSERT/UPDATE it), mirroring how
`getTrustGraphAggregate`/`getCommunityDepthGraph` already query.

---

## Test Plan

### Unit tests

| Test | File location |
|------|--------------|
| `BelongingGraph` renders in all four modes | `tests/unit/BelongingGraph.test.tsx` |
| `BelongingPulse` renders correct stat copy ("N people, M communities") | `tests/unit/BelongingPulse.test.tsx` |
| `types.ts` normalization: `DepthNode` → `TrustNode` converter produces correct shape | `tests/unit/graphTypeNormalization.test.ts` |

### Regression tests

| Test | File location |
|------|--------------|
| Dead libs absent from package.json | `tests/regression/dead-graph-libs.test.ts` |
| `/network` page exists (no 404) | `tests/regression/network-page-exists.test.ts` |
| `TrustNetworkWidget` "View full →" link points to `/network` | Existing widget tests |

### TDD tests (can fail, promote on pass)

| Test | File location |
|------|--------------|
| `/network` explorer renders with `mode=ego` | `services/social-graph-service/tests/tdd/network-page.test.tsx` |
| Expand: clicking a node in expandable mode calls `onNodeExpand` with correct id | `tests/tdd/BelongingGraph-expand.test.tsx` |
| Hover-highlight: `mouseover` reduces non-neighbor opacity | `tests/tdd/TrustGraphHEB-hover.test.tsx` |

### Manual smoke test (human validation)

1. Dashboard → "Your Trust Network" People tab: HEB graph loads. Communities tab: communities-as-nodes
   HEB loads (same visual language as People tab, not the old circular layout).
2. Dashboard → "View full →" link: navigates to `/network` (not a 404).
3. `/network` page: full-bleed graph loads, mode switch works (ego → communities).
4. `/network` click a node: neighborhood expands inline with transition. Right-click: collapses.
5. Profile page: `<BelongingSection>` appears with warm heading, pulse stat, and larger graph.
6. Community page → Trust Graph tab: HEB loads for community + ego sub-tabs.
7. `npm ls cytoscape react-cytoscapejs react-force-graph-2d`: no packages found (removed).

---

## User Guide & Landing Doc Updates (S111 obligation)

- **User guide**: `docs/guides/your-belonging-graph.md` — new guide explaining the graph system,
  what the trust path means, how to explore on `/network`, and what fading edges mean (links to
  the ADR-070 concept). Add to `ADR_GROUPS` user guides + `nav.json`.
- **ADR-081 status**: Update from `Proposed` → `Implemented` in both `docs/adr/ADR-081-*.md` and
  the landing concept JSON (regenerate via `npm run generate-docs`).
- **Concept page** for "Your Network Explorer" (`docs/concepts/your-network-explorer.md`) — brief
  concept page explaining what `/network` is and why it exists.

---

## SDLC Gates (every sprint)

1. `npm test` (unit + regression) — blocking
2. `cd tests && npx jest regression/doc-context-drift-gate.test.ts --runInBand` — ADR index + nav wired
3. `npm run feedback:check` — advisory
4. `/simplify` on the diff
5. `/code-review` on the branch diff
6. `/security-review` on the branch diff

---

## Critical Implementation Notes

1. **No backend redesign** — social-graph-service gets one new endpoint; all existing contracts stay.
2. **The data layer must survive** — `socialGraphService` (graph fetches in `api.ts`),
   `socialGraphClient` (paths/invitations), `useLazyGraphData`, `useTrustPath` are unchanged.
   `BelongingGraph` wraps them, doesn't replace them. (Graph fetches are on `socialGraphService`,
   NOT `socialGraphClient` — don't conflate the two.)
3. **`CommunityDepthGraph` data normalization** — the backend `getCommunityGraph()` response uses
   `DepthNode`/`DepthLink` shape. Normalize in `BelongingGraph`, not in `TrustGraphHEB` (keep the
   HEB engine type-clean).
4. **Dead lib removal order** — remove from `package.json` first, then delete `.d.ts`, then run
   `npm install`, then verify the `rg` check. Don't delete the `.d.ts` while the package is still
   listed (TypeScript will complain the type is now unresolvable).
5. **Expand is gated on `expandable` prop** — dashboard card, profile widget, and community tab all
   render `<BelongingGraph>` without `expandable`; only the `/network` page passes it. This is the
   S79 guard.
6. **Lazy loading must survive** — `useLazyGraphData` must wrap `BelongingGraph` data fetching.
   The full-page explorer fires immediately (container is always visible); card views defer until
   scroll.
7. **Version bump** — `package.json` root + `apps/frontend/package.json` → `11.18.0`.
8. **ADR-081 status** — update to `Implemented` after merge + deploy.
9. **Windows/PowerShell repo** — all verification commands use `rg`/PowerShell.
10. **`git add CLAUDE.md`** — tracked as lowercase `claude.md`; use `git add claude.md` if needed.
