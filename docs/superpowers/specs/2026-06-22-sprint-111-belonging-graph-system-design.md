# Sprint 111: Belonging Graph System — Implementation & Ship (Design Spec)

**Date**: 2026-06-22
**Status**: Approved
**Version**: v11.17.0 → v11.18.0
**Sprint Branch**: `feature/sprint-111-belonging-graph-system`
**ADR**: ADR-081 (Proposed in S110, implement → Implemented in S111)
**Deliverable**: One HEB engine, one data model, one expandable `/network` explorer, raised profile
altitude, dead-lib removal. Ships as v11.18.0.

---

## Overview

Sprint 110 produced the audit, the reference study, and ADR-081 (Proposed). Sprint 111 implements it.
The work is frontend-led (no backend redesign) with one bounded social-graph read endpoint:
`GET /trust/neighborhood/:userId`. It provides privacy-scoped, depth-limited graph reads for the
full-page explorer. No DB schema changes. The profile pulse reuses the loaded graph plus the existing
community-membership read rather than adding another aggregate. No deploy-script changes.

**Core change**: Replace today's patchwork of four graph wrappers with a single `<BelongingGraph mode>` component over a canonical data model; build the full-page `/network` explorer; raise the profile graph to headline altitude.

---

## Multi-Sprint Arc

### Sprint 110 — Belonging Graph Research (complete)

Audited all six graph surfaces, studied reference products, and accepted ADR-081 as Proposed.

### Sprint 111 — Belonging Graph Implementation (this sprint)

Implement D1–D6, ship the explorer, and mark ADR-081 Implemented as v11.18.0.

### Sprint 112 — Not pre-committed

Use post-deploy evidence to choose the next sprint; do not pull demo-liveliness, privacy export, or
cleanup-service work into Sprint 111.

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
| `apps/frontend/src/components/graphs/normalizeGraphData.ts` | Pure `DepthNode`/`DepthLink` → canonical graph conversion |
| `apps/frontend/src/components/BelongingGraph.tsx` | Single `<BelongingGraph mode>` wrapper dispatching to `TrustGraphHEB`; replaces `NetworkGraph` + `TrustGraph` + `CommunityDepthGraph` |
| `apps/frontend/src/components/BelongingSection.tsx` | Profile "How you're woven into Karmyq" headline section (raised altitude) |
| `apps/frontend/src/components/BelongingPulse.tsx` | "You're connected to N people across M communities" stat line |
| `apps/frontend/src/pages/network.tsx` | Full-page `/network` explorer: full-bleed SVG, mode switch, depth slider, search/focus, zoom/pan, click-to-expand |

### Existing files to modify

| File | Change |
|------|--------|
| `components/graphs/TrustGraphHEB.tsx` | Add `communities` mode, hover/focus, zoom/pan, keyed transitions, node activation, and accessible tooltips |
| `components/dashboard/TrustNetworkWidget.tsx` | Replace `NetworkGraph` import with `<BelongingGraph mode="ego">` and `<BelongingGraph mode="communities">` |
| `components/community/tabs/TrustGraphTab.tsx` | Replace `TrustGraph` import with `<BelongingGraph mode="community">` / `mode="ego"` |
| `components/community/tabs/FissionTab.tsx` | Replace `TrustGraph mode="fission"` with `<BelongingGraph mode="fission">` |
| `pages/profile.tsx` | Replace `TrustNetworkWidget` at L842 with `<BelongingSection>` |
| `apps/frontend/package.json` | Remove `cytoscape`, `react-cytoscapejs`, `@types/cytoscape`, `react-force-graph-2d` |
| `apps/frontend/src/types/react-cytoscapejs.d.ts` | Delete |
| `lib/api.ts` | Add typed `getNeighborhood(userId, { depth, communityId? })` |
| `docs/adr/ADR-081-belonging-graph-system.md` | Update status from `Proposed` → `Implemented` |
| `docs/guides/trust-graph.md` | Update the existing guide with explorer, depth, search, zoom, and expansion behavior |
| `docs/concepts/reading-the-trust-graph.md` | Update the existing concept page for the unified four-mode visual language |
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
| `services/social-graph-service/src/database/trustEdgeDb.ts` | Add the privacy-scoped recursive neighborhood query (depth 1–3, maximum 80 nodes) |
| `services/social-graph-service/src/routes/trustGraph.ts` | Add `GET /trust/neighborhood/:userId?depth=1..3&communityId=` and validate auth/scope |
| `services/social-graph-service/CONTEXT.md` | Document new endpoint |
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
  degrees_of_separation?: 0 | 1 | 2 | 3 // shortest BFS depth from the requested center
  member_count?: number           // for communities mode (from DepthNode)
  is_member?: boolean             // for communities mode (from DepthNode)
  status?: string                 // community status in communities mode
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
  meta?: {
    depth?: 1 | 2 | 3
    truncated?: boolean
  }
}
```

### `BelongingGraph.tsx` — single wrapper

```typescript
interface BelongingGraphProps {
  mode: BelongingMode
  communityId?: string
  currentUserId: string
  // Fission and explorer callers can provide already-loaded data.
  graphData?: GraphData
  load?: 'lazy' | 'immediate'
  onDataLoaded?: (data: GraphData) => void
  groupMap?: Record<string, 'group_a' | 'group_b'>
  groupALabel?: string
  groupBLabel?: string
  onSwitchGroup?: (nodeId: string, group: 'group_a' | 'group_b' | null) => Promise<void>
  height?: number
  focusedNodeId?: string
  onNodeActivate?: (nodeId: string) => void
  enableZoom?: boolean
}
```

`BelongingGraph` handles its own data fetching via `useLazyGraphData` + `socialGraphService` (the
graph fetches in `api.ts` — **not** `socialGraphClient`, which is paths/invitations only), dispatches
to `TrustGraphHEB`, and normalizes `communities` mode data. When `graphData` is supplied (fission and
the full-page explorer), it renders that data without a second fetch. `onDataLoaded` lets
`BelongingSection` derive its pulse from the same ego response rather than fetching twice.

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
    {mode === 'ego' && <DepthSlider value={depth} onChange={setDepth} min={1} max={3} />}
    <SearchBox placeholder={mode === 'communities' ? 'Find a community…' : 'Find a member…'} />
  </header>
  <main style={{ flex: 1, position: 'relative' }}>
    <BelongingGraph
      mode={mode}
      currentUserId={user.id}
      communityId={selectedCommunityId}
      graphData={mergedGraph}
      load="immediate"
      height={windowHeight - HEADER_HEIGHT}
      focusedNodeId={focusedNodeId}
      onNodeActivate={expandNode}
      enableZoom
    />
  </main>
</PageLayout>
```

The page owns explorer state. Its baseline graph is explicit by mode:

- `ego`: `getNeighborhood(currentUserId, { depth })`; node activation progressively expands a
  depth-1 neighborhood.
- `community`: `getFullCommunityGraph(communityId)`, matching the existing Community Trust Graph
  tab's whole-community semantics. It is searchable and zoomable but does not progressively expand,
  because the baseline is already the full capped community graph.
- `communities`: `getCommunityGraph()`; searchable and zoomable, with no person-neighborhood expand.

Ego expansions are stored separately from the baseline and merged deterministically; removing an
expansion recomputes from baseline plus the remaining expansions, so shared nodes are never
accidentally deleted. The page uses `next/dynamic` with `ssr: false` to avoid hydration issues with
the D3 SVG. Search operates over the currently loaded node set; it focuses a result but does not
expose a global member directory.

---

## `TrustGraphHEB` Extensions

### `communities` mode (porting `CommunityDepthGraph` behavior)

The `communities` mode receives `TrustNode[]` where each node represents a community. The HEB
cluster layout remains radial and preserves ADR-063's uniform node sizing; `member_count` appears in
the detail panel rather than changing radius. `is_member` adds an emerald ring so the caller's
communities are emphasized. Edge `type`:
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

The live endpoint already returns `id`, `name`, `member_count`, `status`, and `is_member`; no backend
shape change is required for communities mode.

### Hover-highlight (neighborhood focus + fade)

Add node hover/focus state. Connected edges and adjacent nodes remain fully visible; unrelated edges
and nodes fade to `0.15`. Keyboard focus uses the same treatment.

### Click-to-expand (full-page explorer only)

On `/network`, node activation calls the page's `expandNode(node.id)`. The page fetches a depth-1
neighborhood and records it in an ordered expansion map. At most three expansions remain active;
activating a fourth evicts the oldest. An explicit, keyboard-reachable “Collapse {name}” control
removes an expansion. `TrustGraphHEB` uses keyed joins and a 400ms transition rather than deleting
the entire SVG before every render.

### Node tooltips

Each interactive node receives a `<title>`, `tabindex="0"`, an accessible label, and Enter/Space
activation. Labels remain visually truncated where needed; the native title exposes the full name.

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

`BelongingPulse` derives its two numbers from **existing reads — no new backend endpoint and no raw
DB query**:

- **N people** = node count from the ego graph `BelongingSection` already fetches
  (`socialGraphService.getTrustGraphAggregate()`). Pass `nodes.filter(n => n.id !== userId).length`
  down from `BelongingSection` to avoid a second graph fetch.
- **M communities** = `communityService.getMyCommunities(userId)` length (existing API; schema is
  `communities.members`, plural schema name — but the component never touches SQL directly).

Combine: `"You're connected to N people across M communities"` as a `<p>` in warm text above the
graph. (Copy intentionally says "connected to," not "helped" — the graph encodes trust connections,
and a literal "helped" count would require a new reputation aggregate the research did not scope.)

---

## Dead Library Removal

```bash
# From repo root; update the existing cross-platform lock in place.
npm uninstall --workspace apps/frontend cytoscape react-cytoscapejs @types/cytoscape react-force-graph-2d
Remove-Item apps/frontend/src/types/react-cytoscapejs.d.ts
```

Verification:
```powershell
rg "cytoscape|react-cytoscapejs|react-force-graph" apps/frontend/src --glob "!*.d.ts"
# → no output
```

Bundle impact: cytoscape + react-cytoscapejs ≈ 1.1 MB pre-minify; react-force-graph-2d ≈ 500 KB.

---

## Backend: `GET /trust/neighborhood/:userId`

Contract:

```http
GET /trust/neighborhood/:userId?depth=1|2|3&communityId=<uuid>
```

- Auth comes from the existing `/trust` router mount.
- `depth` defaults to `1`; invalid values return `400`.
- With `communityId`, the caller and center user must both be active members of that community.
- Without `communityId`, the center user must share at least one active community with the caller.
- The recursive traversal reads only `trust_edges_live` edges in those allowed communities and only
  active members. An inaccessible center returns `404`, avoiding an account-existence leak.
- Each returned node includes `degrees_of_separation` (`0` for the center, then shortest BFS depth
  `1`–`3`). Results are capped at 80 nodes and return `meta: { depth, truncated }`.
- The view is read-only: never insert into or update `trust_edges_live`.

The existing `/trust/graph/:communityId?center=` compatibility path remains unchanged. The new
endpoint is canonical for the explorer because it supports aggregate scope, explicit depth, privacy
rules, and a hard result cap.

---

## Test Plan

### Unit tests

| Test | File location |
|------|--------------|
| `BelongingGraph` fetches/renders all four modes and honors supplied data | `apps/frontend/tests/unit/BelongingGraph.test.tsx` |
| `BelongingPulse` renders exact singular/plural stat copy | `apps/frontend/tests/unit/BelongingPulse.test.tsx` |
| `DepthNode`/`DepthLink` normalization preserves member/status/type fields | `apps/frontend/tests/unit/normalizeGraphData.test.ts` |
| Neighborhood validation and privacy scope | `services/social-graph-service/tests/unit/neighborhood.test.ts` |

### Regression tests

| Test | File location |
|------|--------------|
| Dead libs and retired wrappers are absent | `apps/frontend/tests/regression/belonging-graph-consolidation.test.ts` |
| `/network` page renders from query state and the widget link reaches it | `apps/frontend/tests/regression/network-explorer.test.tsx` |

### TDD tests (can fail, promote on pass)

| Test | File location |
|------|--------------|
| Recursive neighborhood read respects depth, active membership, scope, and 80-node cap | `services/social-graph-service/tests/tdd/sprint-111-neighborhood.test.ts` |
| Explorer expansion keeps baseline data, supports collapse, and enforces FIFO-three | `apps/frontend/tests/tdd/sprint-111-network-expand.test.tsx` |
| Hover/focus fades unrelated topology; zoom can be enabled only by explorer | `apps/frontend/tests/tdd/sprint-111-graph-interaction.test.tsx` |

### Manual smoke test (human validation)

1. Dashboard → "Your Trust Network" People tab: HEB graph loads. Communities tab: communities-as-nodes
   HEB loads (same visual language as People tab, not the old circular layout).
2. Dashboard → "View full →" link: navigates to `/network` (not a 404).
3. `/network` page: full-bleed graph loads, mode switch works (ego → communities).
4. `/network` click or keyboard-activate a node: its neighborhood expands inline with transition.
   The visible collapse control removes it; a fourth expansion evicts the oldest.
5. Profile page: `<BelongingSection>` appears with warm heading, pulse stat, and larger graph.
6. Community page → Trust Graph tab: HEB loads for community + ego sub-tabs.
7. `npm ls cytoscape react-cytoscapejs react-force-graph-2d`: no packages found (removed).

---

## User Guide & Landing Doc Updates (S111 obligation)

- **User guide**: update `docs/guides/trust-graph.md` rather than creating a duplicate. Explain the
  unified modes, `/network`, depth, search, zoom/pan, expansion/collapse, and fading edges.
- **ADR-081 status**: Update from `Proposed` → `Implemented` in both `docs/adr/ADR-081-*.md` and
  the landing concept JSON (regenerate via `npm run generate-docs`).
- **Concept page**: update the existing `docs/concepts/reading-the-trust-graph.md` with the explorer
  and communities-mode semantics. Do not create a second overlapping graph concept.

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
4. **Lockfile safety** — update the existing lock in place with workspace-scoped `npm uninstall`;
   never scratch-regenerate `package-lock.json` on Windows.
5. **Expand is ego-explorer-only** — dashboard, profile, community, communities, and fission
   surfaces do not pass expansion activation; only `/network?mode=ego` owns expansion state. The
   explorer's community mode uses `getFullCommunityGraph`, matching TrustGraphTab. This is the S79
   guard and prevents two meanings of “community graph.”
6. **Lazy loading must survive** — `useLazyGraphData` must wrap `BelongingGraph` data fetching.
   The full-page explorer fires immediately (container is always visible); card views defer until
   scroll.
7. **Version bump** — root `package.json` and root entries in `package-lock.json` only →
   `11.18.0`; `apps/frontend/package.json` remains package version `1.0.0`.
8. **ADR-081 status** — update to `Implemented` after merge + deploy.
9. **Windows/PowerShell repo** — all verification commands use `rg`/PowerShell.
10. **`git add CLAUDE.md`** — tracked as lowercase `claude.md`; use `git add claude.md` if needed.
11. **Neighborhood privacy** — never expose arbitrary-user neighborhoods. Center and returned nodes
    must remain inside the caller's active shared-community scope; inaccessible centers return 404.
12. **No duplicate docs** — update `docs/guides/trust-graph.md` and
    `docs/concepts/reading-the-trust-graph.md`; generated landing JSON is rebuilt, not hand-edited.
