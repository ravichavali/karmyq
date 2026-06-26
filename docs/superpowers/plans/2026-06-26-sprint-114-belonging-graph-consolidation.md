# Belonging Graph Consolidation Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt `react-force-graph-2d` and consolidate the belonging graph to profile,
community, and `/network` at v11.20.0 informational and behavioral parity.

**Architecture:** Keep `BelongingGraph` as the only fetch/normalization wrapper over the canonical
`GraphData` contract, and replace the D3 SVG renderers with a thin `GraphCanvas` boundary backed by
`react-force-graph-2d`. The DOM chrome remains outside the canvas: legends, zoom controls, empty
states, node detail, depth readout, and privacy assertions stay testable with Testing Library.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 15 Pages Router, React 19, PostgreSQL 15, Bull
queue, `react-force-graph-2d@1.29.1`, D3 for force helpers/layout math where useful.

## Global Constraints

- Phase 1 only: no `GET /trust/explain`, no click-to-recenter traversal, no breadcrumb, no URL-synced
  focus, no lineage-channel redesign, no removal of Scale 1/2/3 framing text.
- Data/privacy unchanged: reuse `normalizePersonGraph`, `normalizeCommunityDepthGraph`, and
  `disclosureProjection`; no reputation numbers in graph node detail.
- Renderer geometry may change from radial/SVG to force/canvas; all other product semantics stay at
  parity.
- Pin dependency exactly: `react-force-graph-2d@1.29.1`.
- Current version is `11.20.0`; target version is `11.21.0`.
- No DB migration and no backend API change in Sprint 114.
- Claude and Codex share one physical working tree; one agent edits at a time and commits or stashes
  before handoff.

---

## File Map

### New files to create

| File | Responsibility |
|------|----------------|
| `apps/frontend/src/components/graphs/GraphCanvas.tsx` | Client-only canvas renderer boundary around `react-force-graph-2d`; owns force config and canvas drawing callbacks only. |
| `apps/frontend/src/components/graphs/BelongingGraphRenderer.tsx` | React/DOM chrome around `GraphCanvas`: empty states, legend, zoom controls, selected-node detail, hover/focus state. |
| `apps/frontend/src/components/graphs/graphCanvasModel.ts` | Pure conversion/styling helpers: clone canonical graph data, set initial/pinned layout positions, derive node/link visual styles, compute adjacency. |
| `apps/frontend/tests/tdd/sprint-114-graph-canvas-boundary.test.tsx` | TDD tests for canvas boundary props, callbacks, zoom controls, and privacy-safe DOM chrome. |
| `apps/frontend/tests/tdd/sprint-114-surface-consolidation.test.tsx` | TDD tests for retired surfaces and remaining profile/community/explorer homes. |
| `docs/adr/ADR-083-belonging-graph-rendering-engine.md` | ADR recording the renderer reversal from S111 single-D3 renderer to `react-force-graph-2d`. |
| `apps/landing/src/data/docs/concepts/adr-083-belonging-graph-rendering-engine.json` | Landing docs copy of ADR-083. |

### Existing files to modify

| File | Change |
|------|--------|
| `package.json` | Bump root version `11.20.0` -> `11.21.0`. |
| `package-lock.json` | Lock `react-force-graph-2d@1.29.1` and version bump. |
| `apps/frontend/package.json` | Add `react-force-graph-2d` dependency. |
| `apps/frontend/src/components/BelongingGraph.tsx` | Dynamic-import `BelongingGraphRenderer` instead of `TrustGraphHEB`; keep fetch/normalization contract unchanged. |
| `apps/frontend/src/components/graphs/GraphZoomControls.tsx` | Reuse for canvas zoom; no duplicate control clusters. |
| `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx` | Retire the community `My Network` sub-tab; community page renders member topology only plus link to `/network`. |
| `apps/frontend/src/components/Feed/UnifiedFeed.tsx` | Remove `MyNetworkPreview` import and Home preview card render. |
| `apps/frontend/src/pages/network.tsx` | Keep explorer modes and Scale 1/2/3 framing; verify the new renderer receives `focusedNodeId` and `onNodeActivate` unchanged. |
| `apps/frontend/src/pages/dashboard.tsx` | Remove any live dashboard graph widget call if present; Home uses nav/explorer entry, not an embedded graph card. |
| `apps/frontend/tests/regression/belonging-graph-consolidation.test.ts` | Invert S111 dependency guardrail: `react-force-graph-2d` is now required; D3 is allowed but no longer the sole renderer. |
| `apps/frontend/tests/regression/sprint-111-graph-foundation.test.tsx` | Keep wrapper fetch/normalization assertions; update renderer stub name/props. |
| `apps/frontend/tests/regression/sprint-111-graph-interaction.test.tsx` | Replace SVG node assertions with canvas-boundary and DOM-chrome assertions. |
| `apps/frontend/tests/regression/sprint-111-belonging-surfaces.test.tsx` | Update surface expectations: no dashboard widget, no community `My Network` sub-tab, profile/community/explorer remain. |
| `apps/frontend/tests/regression/sprint-113-graph-zoom.test.tsx` | Move from D3 `__zoom` checks to `ForceGraphMethods.zoom`/`zoomToFit` mock checks. |
| `docs/adr/README.md` | Add ADR-083 under Trust & Reputation or Infrastructure with status Accepted. |
| `docs/guides/trust-graph.md` | Update access list and renderer explanation for Phase 1 consolidation. |
| `docs/concepts/reading-the-trust-graph.md` | Update "one engine" copy to canvas/force renderer at parity. |
| `apps/landing/src/data/docs/guides/trust-graph.json` | Landing JSON mirror of trust-graph guide. |
| `apps/landing/src/data/docs/concepts/reading-the-trust-graph.json` | Landing JSON mirror of concept page. |
| `apps/landing/src/data/docs/nav.json` | Add ADR-083 entry. |
| `apps/frontend/CONTEXT.md` | Add Sprint 114 note for renderer boundary, surface consolidation, test strategy. |
| `.claude/handoff/CURRENT_HANDOFF.md` | Update execution handoff as tasks complete. |

---

## Critical Implementation Notes

1. Preserve `GraphData` and normalization exactly. Do not change backend payloads or expose reputation
   numbers to make the canvas easier to draw.
2. `react-force-graph-2d` mutates node objects (`x`, `y`, `vx`, `vy`, `fx`, `fy`). Clone graph data in
   `graphCanvasModel.ts` before passing it to the renderer; never mutate canonical `GraphData` from
   props.
3. Canvas is not DOM-queryable. Tests assert boundary props, style/config helpers, callbacks, and DOM
   chrome, not `<circle>` or `<path>` nodes.
4. `BelongingGraph` remains the only fetch/normalization wrapper. `GraphCanvas` must not call
   `socialGraphService`.
5. Zoom has one owner. `GraphZoomControls` calls the `react-force-graph-2d` ref (`zoom`, `centerAt`,
   `zoomToFit`); do not also wire D3 zoom or wrapper-level controls.
6. Keep Phase 1 chrome: legend, empty/sparse states, node-detail panel, depth readout, and Scale 1/2/3
   text. Removing that copy is Phase 3.
7. Retire exactly three redundant surfaces: dashboard `TrustNetworkWidget`, Home `MyNetworkPreview`,
   and the community `My Network` sub-tab. Keep top-nav My Network and `/network`.
8. Fission view must remain admin-operable: proposed-group colors, isolated-member dashed ring, and
   move-group action still work.
9. Supply-chain checks matter: dependency must be pinned, `npm audit --audit-level=high` must pass or
   a blocking alert must be resolved before merge.
10. Human validation must include the carried S113 post-deploy spot-check plus S114 renderer/consolidation
    checks on the demo.

---

## Task 1: Branch, Dependency, and Guardrail Red Tests

**Files:**
- Modify: `apps/frontend/package.json`
- Modify: `package-lock.json`
- Modify: `package.json`
- Modify: `apps/frontend/tests/regression/belonging-graph-consolidation.test.ts`

**Interfaces:**
- Consumes: approved S114 spec and current branch `feature/sprint-114-belonging-graph-consolidation`.
- Produces: pinned renderer dependency and an intentional failing guardrail until renderer files exist.

- [ ] **Step 1: Verify branch and clean tree**

```powershell
git branch --show-current
git status --short
```

Expected: branch is `feature/sprint-114-belonging-graph-consolidation`; status is clean or only your
current task files after you start editing.

- [ ] **Step 2: Add the renderer dependency and update the lockfile**

```powershell
npm install react-force-graph-2d@1.29.1 --workspace apps/frontend --save-exact
```

Expected: `apps/frontend/package.json` contains `"react-force-graph-2d": "1.29.1"` and
`package-lock.json` contains `node_modules/react-force-graph-2d`.

- [ ] **Step 3: Bump the root app version**

Edit `package.json`:

```json
{
  "version": "11.21.0"
}
```

Keep all other fields unchanged.

- [ ] **Step 4: Invert the S111 dependency guardrail**

In `apps/frontend/tests/regression/belonging-graph-consolidation.test.ts`, change the dependency block
to this contract:

```ts
describe('belonging graph renderer dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(FRONTEND_ROOT, 'package.json'), 'utf8'))
  const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }

  it.each(['cytoscape', 'react-cytoscapejs', '@types/cytoscape'])(
    '%s remains retired',
    dep => {
      expect(allDeps[dep]).toBeUndefined()
    }
  )

  it('uses react-force-graph-2d as the Phase 1 canvas renderer', () => {
    expect(allDeps['react-force-graph-2d']).toBe('1.29.1')
  })

  it('keeps d3 available for force/layout helpers, but not as the sole renderer', () => {
    expect(allDeps['d3']).toBeDefined()
  })
})
```

Also update the "unified surfaces exist" table to expect the new renderer files after Task 3:

```ts
'src/components/graphs/GraphCanvas.tsx',
'src/components/graphs/BelongingGraphRenderer.tsx',
'src/components/graphs/graphCanvasModel.ts',
```

- [ ] **Step 5: Run the focused guardrail and confirm the expected red**

```powershell
cd apps/frontend; npx jest tests/regression/belonging-graph-consolidation.test.ts --runInBand
```

Expected now: fails because the new renderer files do not exist yet.

- [ ] **Step 6: Run supply-chain audit after dependency install**

```powershell
npm audit --audit-level=high
```

Expected: no high/critical findings. If it fails, stop and resolve the dependency issue in this task.

- [ ] **Step 7: Commit**

```powershell
git add package.json apps/frontend/package.json package-lock.json apps/frontend/tests/regression/belonging-graph-consolidation.test.ts
git commit -m "test: set S114 graph renderer dependency guardrails"
```

Run the mandatory `pre-commit-check` skill before this commit.

---

## Task 2: Pure Canvas Model Helpers

**Files:**
- Create: `apps/frontend/src/components/graphs/graphCanvasModel.ts`
- Create: `apps/frontend/tests/tdd/sprint-114-graph-canvas-boundary.test.tsx`

**Interfaces:**
- Consumes: `GraphData`, `BelongingMode`, `TrustNode`, `TrustLink`.
- Produces:
  - `type GraphLayout = 'egocentric' | 'member-topology' | 'network-web'`
  - `function layoutForMode(mode: BelongingMode): GraphLayout`
  - `function toCanvasGraphData(graphData: GraphData, options: CanvasGraphOptions): CanvasGraphData`
  - `function buildAdjacency(graphData: GraphData): Map<string, Set<string>>`
  - `function describeNodeDetail(node: TrustNode, graphData: GraphData, currentUserId: string, mode: BelongingMode): Array<{ label: string; value: string; tone?: 'self' }>`

- [ ] **Step 1: Write failing tests for cloning, layout mapping, and privacy-safe detail rows**

Add this first describe block to `apps/frontend/tests/tdd/sprint-114-graph-canvas-boundary.test.tsx`:

```ts
import {
  buildAdjacency,
  describeNodeDetail,
  layoutForMode,
  toCanvasGraphData,
} from '@/components/graphs/graphCanvasModel'
import type { GraphData } from '@/components/graphs/types'

const graph: GraphData = {
  nodes: [
    { id: 'me', name: 'Maria', isCurrentUser: true, degrees_of_separation: 0 },
    { id: 'p1', name: 'Aisha', degrees_of_separation: 1, trust_score: 99, karma: 88 },
    { id: 'p2', name: 'Lee', degrees_of_separation: 2 },
  ],
  links: [
    { source: 'me', target: 'p1', decayTier: 'strong' },
    { source: 'p1', target: 'p2', decayTier: 'fading' },
  ],
}

describe('graphCanvasModel', () => {
  it('maps belonging modes to Phase 1 layouts', () => {
    expect(layoutForMode('ego')).toBe('egocentric')
    expect(layoutForMode('community')).toBe('member-topology')
    expect(layoutForMode('fission')).toBe('member-topology')
    expect(layoutForMode('communities')).toBe('network-web')
  })

  it('clones graph data and pins the ego focus without mutating props', () => {
    const before = JSON.parse(JSON.stringify(graph))
    const canvas = toCanvasGraphData(graph, {
      mode: 'ego',
      currentUserId: 'me',
      layout: 'egocentric',
      width: 640,
      height: 480,
    })
    expect(canvas).not.toBe(graph)
    expect(canvas.nodes[0]).not.toBe(graph.nodes[0])
    expect(canvas.nodes.find(n => n.id === 'me')).toEqual(expect.objectContaining({ fx: 0, fy: 0 }))
    expect(graph).toEqual(before)
  })

  it('builds symmetric adjacency for hover/focus highlighting', () => {
    const adjacency = buildAdjacency(graph)
    expect([...adjacency.get('p1')!].sort()).toEqual(['me', 'p1', 'p2'])
  })

  it('describes node detail with structure only, never reputation numbers', () => {
    const rows = describeNodeDetail(graph.nodes[1], graph, 'me', 'ego')
    expect(rows).toEqual([
      { label: 'Degrees away', value: '1' },
      { label: 'Connections', value: '2' },
    ])
    expect(JSON.stringify(rows)).not.toMatch(/99|88|trust|karma/i)
  })
})
```

- [ ] **Step 2: Run the test and verify red**

```powershell
cd apps/frontend; npx jest tests/tdd/sprint-114-graph-canvas-boundary.test.tsx --runInBand
```

Expected: fails because `graphCanvasModel.ts` does not exist.

- [ ] **Step 3: Implement `graphCanvasModel.ts`**

Create `apps/frontend/src/components/graphs/graphCanvasModel.ts` with the exported types and helpers
from the Interfaces block. Implementation rules:

```ts
export interface CanvasGraphOptions {
  mode: BelongingMode
  currentUserId: string
  layout: GraphLayout
  width: number
  height: number
}
```

Use these exact layout rules:
- `ego` -> current user/focus node `fx=0`, `fy=0`; nodes with `degrees_of_separation` get initial
  radius `90 * depth`.
- `community` and `fission` -> no fixed nodes; initial positions may be a stable circle seeded by
  array index.
- `communities` -> member communities (`is_member`) start near the center; non-member communities
  start on an outer ring; do not fix them permanently.

Use these exact detail rules:
- Person graphs: `This is you`, `Degrees away`, `Connections`.
- Communities graph: `Members`, `Status`, and `You're a member` when applicable.
- Fission graph: `Group` and `Connections`; group action is rendered by `BelongingGraphRenderer`, not
  this helper.

- [ ] **Step 4: Run the focused test and verify green**

```powershell
cd apps/frontend; npx jest tests/tdd/sprint-114-graph-canvas-boundary.test.tsx --runInBand
```

Expected: all `graphCanvasModel` tests pass.

- [ ] **Step 5: Simplify pass**

Run `/simplify` mentally/on diff for the helper only: no helper should both compute graph geometry and
render React. If a helper grows past one responsibility, split it before continuing.

- [ ] **Step 6: Commit**

```powershell
git add apps/frontend/src/components/graphs/graphCanvasModel.ts apps/frontend/tests/tdd/sprint-114-graph-canvas-boundary.test.tsx
git commit -m "feat: add belonging graph canvas model helpers"
```

Run the mandatory `pre-commit-check` skill before this commit.

---

## Task 3: GraphCanvas Boundary

**Files:**
- Create: `apps/frontend/src/components/graphs/GraphCanvas.tsx`
- Modify: `apps/frontend/tests/tdd/sprint-114-graph-canvas-boundary.test.tsx`

**Interfaces:**
- Consumes: `toCanvasGraphData`, `GraphLayout`, canonical `GraphData`.
- Produces: `GraphCanvas` with props:

```ts
export interface GraphCanvasProps {
  graphData: GraphData
  mode: BelongingMode
  currentUserId: string
  height: number
  width: number
  focusedNodeId?: string
  hoveredNodeId?: string | null
  enableZoom?: boolean
  onNodeHover?: (nodeId: string | null) => void
  onNodeClick?: (nodeId: string) => void
  graphRef?: React.MutableRefObject<ForceGraphMethods<any, any> | undefined>
}
```

- [ ] **Step 1: Mock `react-force-graph-2d` and write boundary tests**

Append this mock and tests to `sprint-114-graph-canvas-boundary.test.tsx`:

```ts
let lastForceGraphProps: any = null
const forceGraphMethods = {
  zoom: jest.fn(),
  centerAt: jest.fn(),
  zoomToFit: jest.fn(),
  d3Force: jest.fn(),
  d3ReheatSimulation: jest.fn(),
}

jest.mock('react-force-graph-2d', () => ({
  __esModule: true,
  default: (props: any) => {
    lastForceGraphProps = props
    if (props.ref) props.ref.current = forceGraphMethods
    return <canvas data-testid="force-graph" />
  },
}))

describe('GraphCanvas boundary', () => {
  beforeEach(() => {
    lastForceGraphProps = null
    jest.clearAllMocks()
  })

  it('passes cloned graph data and canvas callbacks to react-force-graph-2d', async () => {
    const { default: GraphCanvas } = await import('@/components/graphs/GraphCanvas')
    render(<GraphCanvas graphData={graph} mode="ego" currentUserId="me" width={640} height={480} />)
    expect(screen.getByTestId('force-graph')).toBeInTheDocument()
    expect(lastForceGraphProps.graphData.nodes.find((n: any) => n.id === 'me').fx).toBe(0)
    expect(typeof lastForceGraphProps.nodeCanvasObject).toBe('function')
    expect(typeof lastForceGraphProps.nodePointerAreaPaint).toBe('function')
    expect(typeof lastForceGraphProps.onNodeHover).toBe('function')
    expect(typeof lastForceGraphProps.onNodeClick).toBe('function')
  })

  it('translates force-graph hover/click callbacks to node ids', async () => {
    const { default: GraphCanvas } = await import('@/components/graphs/GraphCanvas')
    const onNodeHover = jest.fn()
    const onNodeClick = jest.fn()
    render(
      <GraphCanvas
        graphData={graph}
        mode="ego"
        currentUserId="me"
        width={640}
        height={480}
        onNodeHover={onNodeHover}
        onNodeClick={onNodeClick}
      />
    )
    lastForceGraphProps.onNodeHover({ id: 'p1' }, null)
    lastForceGraphProps.onNodeHover(null, { id: 'p1' })
    lastForceGraphProps.onNodeClick({ id: 'p2' })
    expect(onNodeHover).toHaveBeenNthCalledWith(1, 'p1')
    expect(onNodeHover).toHaveBeenNthCalledWith(2, null)
    expect(onNodeClick).toHaveBeenCalledWith('p2')
  })
})
```

- [ ] **Step 2: Run and verify red**

```powershell
cd apps/frontend; npx jest tests/tdd/sprint-114-graph-canvas-boundary.test.tsx --runInBand
```

Expected: fails because `GraphCanvas.tsx` does not exist.

- [ ] **Step 3: Implement `GraphCanvas.tsx`**

Implementation requirements:
- Import `ForceGraph2D`, `ForceGraphMethods` from `react-force-graph-2d`.
- Build canvas data with `toCanvasGraphData`.
- Use `nodeCanvasObject`, `nodePointerAreaPaint`, `linkCanvasObject`, and `linkCanvasObjectMode="replace"`.
- Set `nodeLabel` to full name plus `(you)` for the current user.
- Set `minZoom={0.5}`, `maxZoom={4}`, `enableNodeDrag={mode === 'communities'}`.
- Use `enableZoomInteraction={(event) => event.type !== 'wheel'}` and `enablePanInteraction={true}` so
  drag/pinch remain available while mouse-wheel page scrolling is not captured.
- Call `onNodeHover(node?.id ?? null)` and `onNodeClick(node.id)`.
- Configure forces in `onEngineStop` or an effect through the ref:
  - `ego`: stronger center force, shorter links.
  - `community`/`fission`: moderate charge, cluster-friendly link distance.
  - `communities`: larger link distance and weaker charge.

- [ ] **Step 4: Run the focused boundary test**

```powershell
cd apps/frontend; npx jest tests/tdd/sprint-114-graph-canvas-boundary.test.tsx --runInBand
```

Expected: passes.

- [ ] **Step 5: Commit**

```powershell
git add apps/frontend/src/components/graphs/GraphCanvas.tsx apps/frontend/tests/tdd/sprint-114-graph-canvas-boundary.test.tsx
git commit -m "feat: add react force graph canvas boundary"
```

Run the mandatory `pre-commit-check` skill before this commit.

---

## Task 4: DOM Chrome Renderer and Zoom Controls

**Files:**
- Create: `apps/frontend/src/components/graphs/BelongingGraphRenderer.tsx`
- Modify: `apps/frontend/tests/tdd/sprint-114-graph-canvas-boundary.test.tsx`
- Modify: `apps/frontend/tests/regression/sprint-113-graph-zoom.test.tsx`

**Interfaces:**
- Consumes: `GraphCanvas`, `GraphZoomControls`, `describeNodeDetail`, `buildAdjacency`.
- Produces: renderer component that preserves DOM chrome and exposes the same props formerly passed to
  `TrustGraphHEB`.

- [ ] **Step 1: Write chrome tests for zoom, detail, and privacy**

Add tests that import `BelongingGraphRenderer` and assert:
- `Zoom in`, `Zoom out`, `Reset zoom` buttons render when `enableZoom` is true.
- Clicking zoom buttons calls `forceGraphMethods.zoom` and reset calls `zoomToFit`.
- Clicking node `p1` through `lastForceGraphProps.onNodeClick({ id: 'p1' })` opens a DOM detail panel
  with `Connections`, not `trust score` or `karma`.
- Fission mode renders group labels and a move button when `onSwitchGroup` is supplied.

- [ ] **Step 2: Run and verify red**

```powershell
cd apps/frontend; npx jest tests/tdd/sprint-114-graph-canvas-boundary.test.tsx tests/regression/sprint-113-graph-zoom.test.tsx --runInBand
```

Expected: fails until `BelongingGraphRenderer.tsx` exists and old zoom tests are ported.

- [ ] **Step 3: Implement `BelongingGraphRenderer.tsx`**

Implementation requirements:
- Use `useGraphContainerWidth()` for width, as the old renderers did.
- Keep empty states:
  - `community` with `links.length === 0 && nodes.length <= 1`: "This community doesn't have any trust connections yet."
  - `ego` with `links.length === 0 && nodes.length <= 1`: "You don't have any trust connections yet."
  - `communities` with `nodes.length < 2`: "Join more communities to see how they connect."
- Render `GraphZoomControls` once, above `GraphCanvas`.
- Maintain `selectedNodeId` and `hoveredNodeId`.
- Render the existing legends in DOM, including fission group legend and communities `size = membership`.
- Render selected-node detail from `describeNodeDetail`; add fission `Move to {group}` action exactly as
  the old renderer did.

- [ ] **Step 4: Port `sprint-113-graph-zoom.test.tsx`**

Change imports from `TrustGraphHEB` to `BelongingGraphRenderer`. Replace `svg.__zoom` assertions with
the mock method assertions:

```ts
fireEvent.click(screen.getByLabelText(/zoom in/i))
expect(forceGraphMethods.zoom).toHaveBeenCalled()
fireEvent.click(screen.getByLabelText(/reset zoom/i))
expect(forceGraphMethods.zoomToFit).toHaveBeenCalled()
```

- [ ] **Step 5: Run focused tests**

```powershell
cd apps/frontend; npx jest tests/tdd/sprint-114-graph-canvas-boundary.test.tsx tests/regression/sprint-113-graph-zoom.test.tsx --runInBand
```

Expected: passes.

- [ ] **Step 6: Simplify pass**

Run `/simplify` for the renderer: if force drawing code appears in `BelongingGraphRenderer`, move it
down to `GraphCanvas`; if DOM state appears in `GraphCanvas`, move it up.

- [ ] **Step 7: Commit**

```powershell
git add apps/frontend/src/components/graphs/BelongingGraphRenderer.tsx apps/frontend/tests/tdd/sprint-114-graph-canvas-boundary.test.tsx apps/frontend/tests/regression/sprint-113-graph-zoom.test.tsx
git commit -m "feat: add belonging graph renderer chrome"
```

Run the mandatory `pre-commit-check` skill before this commit.

---

## Task 5: Swap BelongingGraph to the Canvas Renderer

**Files:**
- Modify: `apps/frontend/src/components/BelongingGraph.tsx`
- Modify: `apps/frontend/tests/regression/sprint-111-graph-foundation.test.tsx`
- Modify: `apps/frontend/tests/regression/sprint-111-graph-interaction.test.tsx`

**Interfaces:**
- Consumes: `BelongingGraphRenderer`.
- Produces: existing `<BelongingGraph>` API backed by the new renderer.

- [ ] **Step 1: Update tests to stub `BelongingGraphRenderer` instead of `TrustGraphHEB`**

In `sprint-111-graph-foundation.test.tsx`, change the `next/dynamic` stub label from `heb` to
`belonging-renderer`, and keep asserting:
- mode is passed through;
- node count is passed through;
- fetch dispatch is unchanged;
- `onDataLoaded` is still called with canonical normalized data.

- [ ] **Step 2: Update interaction regression away from SVG DOM**

In `sprint-111-graph-interaction.test.tsx`, import `BelongingGraphRenderer` or `GraphCanvas` instead of
`TrustGraphHEB`. Assert:
- `GraphCanvas` receives `onNodeClick`;
- `BelongingGraphRenderer` opens detail panel on callback;
- `focusedNodeId` is passed down to `GraphCanvas`;
- no test queries `circle`, `path`, `svg > g`, or `data-node-id`.

- [ ] **Step 3: Run and verify red**

```powershell
cd apps/frontend; npx jest tests/regression/sprint-111-graph-foundation.test.tsx tests/regression/sprint-111-graph-interaction.test.tsx --runInBand
```

Expected: fails until `BelongingGraph.tsx` imports the new renderer.

- [ ] **Step 4: Modify `BelongingGraph.tsx`**

Replace the dynamic import block:

```ts
const BelongingGraphRenderer = dynamic(() => import('./graphs/BelongingGraphRenderer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading graph...</div>
  ),
})
```

Then render `<BelongingGraphRenderer ... />` with the exact prop list currently sent to `TrustGraphHEB`.
Do not change the fetcher.

- [ ] **Step 5: Run focused tests**

```powershell
cd apps/frontend; npx jest tests/regression/sprint-111-graph-foundation.test.tsx tests/regression/sprint-111-graph-interaction.test.tsx --runInBand
```

Expected: passes.

- [ ] **Step 6: Commit**

```powershell
git add apps/frontend/src/components/BelongingGraph.tsx apps/frontend/tests/regression/sprint-111-graph-foundation.test.tsx apps/frontend/tests/regression/sprint-111-graph-interaction.test.tsx
git commit -m "feat: route belonging graph through canvas renderer"
```

Run the mandatory `pre-commit-check` skill before this commit.

---

## Task 6: Mode Parity for Ego, Community, Communities, and Fission

**Files:**
- Modify: `apps/frontend/src/components/graphs/GraphCanvas.tsx`
- Modify: `apps/frontend/src/components/graphs/BelongingGraphRenderer.tsx`
- Modify: `apps/frontend/src/components/graphs/graphCanvasModel.ts`
- Modify: `apps/frontend/tests/tdd/sprint-114-graph-canvas-boundary.test.tsx`

**Interfaces:**
- Consumes: renderer boundary from Tasks 3-5.
- Produces: parity styling for all four modes.

- [ ] **Step 1: Add tests for parity styling**

Add test cases covering:
- Person nodes are uniform size except current-user visual ring/anchor.
- Community nodes use `member_count` for `nodeVal`.
- Your edges are amber.
- Fission links are dashed and fission isolated members surface the dashed-ring legend.
- Decay tiers affect link opacity/style helper output.

- [ ] **Step 2: Run and verify red**

```powershell
cd apps/frontend; npx jest tests/tdd/sprint-114-graph-canvas-boundary.test.tsx --runInBand
```

Expected: new parity tests fail until style helpers are filled out.

- [ ] **Step 3: Implement style helpers and drawing callbacks**

Rules:
- `nodeVal`: people `1`, current user `1.8`, communities `Math.max(1, Math.sqrt(member_count ?? 1))`.
- `nodeCanvasObject`: draw a circle, ring current user/member communities, and draw labels for
  `communities` mode.
- `nodePointerAreaPaint`: paint a hit circle using the same radius as the visual node.
- `linkColor`: fission `#a78bfa` for lineage, amber for current-user edges, indigo for same cluster,
  slate for bridges.
- `linkLineDash`: `[6, 4]` for `link.type === 'fission'`, otherwise `null`.
- `linkWidth`: derive from qualitative state or `effective_weight`, never from hidden reputation.
- Highlight: dim unrelated nodes/links when `hoveredNodeId` or `focusedNodeId` is set.

- [ ] **Step 4: Run focused parity tests**

```powershell
cd apps/frontend; npx jest tests/tdd/sprint-114-graph-canvas-boundary.test.tsx --runInBand
```

Expected: passes.

- [ ] **Step 5: Commit**

```powershell
git add apps/frontend/src/components/graphs/GraphCanvas.tsx apps/frontend/src/components/graphs/BelongingGraphRenderer.tsx apps/frontend/src/components/graphs/graphCanvasModel.ts apps/frontend/tests/tdd/sprint-114-graph-canvas-boundary.test.tsx
git commit -m "feat: preserve belonging graph mode parity"
```

Run the mandatory `pre-commit-check` skill before this commit.

---

## Task 7: Surface Consolidation Tests

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-114-surface-consolidation.test.tsx`
- Modify: `apps/frontend/tests/regression/sprint-111-belonging-surfaces.test.tsx`
- Modify: `apps/frontend/tests/tdd/sprint-113-mynetwork-prominence.test.tsx`
- Modify: `apps/frontend/tests/tdd/sprint-113-fractal-scales.test.tsx`

**Interfaces:**
- Consumes: S114 IA decision.
- Produces: red tests for exactly two homes plus explorer.

- [ ] **Step 1: Write TDD tests for retired surfaces**

`sprint-114-surface-consolidation.test.tsx` should assert:
- `TrustGraphTab` renders a community graph and no `My Network` sub-tab button.
- `TrustGraphTab` still links to `/network?mode=communities`.
- `UnifiedFeed` no longer renders `My Network` preview copy on Home.
- No source file imports `components/dashboard/TrustNetworkWidget` or `Feed/MyNetworkPreview`.

- [ ] **Step 2: Update S111/S113 tests**

Change older expectations:
- `sprint-111-belonging-surfaces.test.tsx`: remove the dashboard widget behavior test; add profile and
  community homes remain.
- `sprint-113-mynetwork-prominence.test.tsx`: top-nav My Network remains; Home preview is retired.
- `sprint-113-fractal-scales.test.tsx`: `/network` retains Scale 1/2/3; community sub-tab no longer
  exposes Scale 1.

- [ ] **Step 3: Run and verify red**

```powershell
cd apps/frontend; npx jest tests/tdd/sprint-114-surface-consolidation.test.tsx tests/regression/sprint-111-belonging-surfaces.test.tsx tests/tdd/sprint-113-mynetwork-prominence.test.tsx tests/tdd/sprint-113-fractal-scales.test.tsx --runInBand
```

Expected: fails until surfaces are retired.

- [ ] **Step 4: Commit tests only if they are meaningfully red**

```powershell
git add apps/frontend/tests/tdd/sprint-114-surface-consolidation.test.tsx apps/frontend/tests/regression/sprint-111-belonging-surfaces.test.tsx apps/frontend/tests/tdd/sprint-113-mynetwork-prominence.test.tsx apps/frontend/tests/tdd/sprint-113-fractal-scales.test.tsx
git commit -m "test: define S114 graph surface consolidation"
```

Run the mandatory `pre-commit-check` skill before this commit.

---

## Task 8: Retire Redundant Surfaces

**Files:**
- Modify: `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx`
- Modify: `apps/frontend/src/components/Feed/UnifiedFeed.tsx`
- Delete: `apps/frontend/src/components/Feed/MyNetworkPreview.tsx`
- Delete: `apps/frontend/src/components/dashboard/TrustNetworkWidget.tsx`
- Modify: any caller found by `rg -n "TrustNetworkWidget|MyNetworkPreview" apps/frontend/src apps/frontend/tests`

**Interfaces:**
- Consumes: failing consolidation tests from Task 7.
- Produces: profile + community + `/network` as the only graph homes.

- [ ] **Step 1: Retire the community `My Network` sub-tab**

In `TrustGraphTab.tsx`:
- Remove `useState` and `SubTab`.
- Render the `community` graph unconditionally.
- Update copy to "This community's member topology - every member, grouped by how closely they
  connect."
- Keep `MemoryLegend`, `ReWarmingNudge`, and the link to `/network?mode=communities`.

- [ ] **Step 2: Remove the Home preview card**

In `UnifiedFeed.tsx`:
- Remove `import MyNetworkPreview from './MyNetworkPreview'`.
- Remove `{!isCommunity && <MyNetworkPreview />}`.
- Do not replace it with another card; top-nav My Network and `/network` are the Home entry.

- [ ] **Step 3: Delete retired components**

Delete:
- `apps/frontend/src/components/Feed/MyNetworkPreview.tsx`
- `apps/frontend/src/components/dashboard/TrustNetworkWidget.tsx`

- [ ] **Step 4: Search for dead references**

```powershell
rg -n "TrustNetworkWidget|MyNetworkPreview" apps/frontend/src apps/frontend/tests
```

Expected: only deleted-file references in git diff or no results. Update tests/imports until no live
reference remains.

- [ ] **Step 5: Run consolidation tests**

```powershell
cd apps/frontend; npx jest tests/tdd/sprint-114-surface-consolidation.test.tsx tests/regression/sprint-111-belonging-surfaces.test.tsx tests/tdd/sprint-113-mynetwork-prominence.test.tsx tests/tdd/sprint-113-fractal-scales.test.tsx --runInBand
```

Expected: passes.

- [ ] **Step 6: Simplify pass**

Run `/simplify`: confirm the surface removals did not leave renamed aliases or inert wrapper files.

- [ ] **Step 7: Commit**

```powershell
git add apps/frontend/src/components/community/tabs/TrustGraphTab.tsx apps/frontend/src/components/Feed/UnifiedFeed.tsx apps/frontend/src/components/Feed/MyNetworkPreview.tsx apps/frontend/src/components/dashboard/TrustNetworkWidget.tsx apps/frontend/tests
git commit -m "feat: consolidate belonging graph surfaces"
```

Run the mandatory `pre-commit-check` skill before this commit.

---

## Task 9: Remove Old D3 Renderers and Finish Guardrails

**Files:**
- Delete: `apps/frontend/src/components/graphs/TrustGraphHEB.tsx`
- Delete: `apps/frontend/src/components/graphs/CommunityHubGraph.tsx`
- Modify: `apps/frontend/tests/regression/belonging-graph-consolidation.test.ts`
- Modify: any file found by `rg -n "TrustGraphHEB|CommunityHubGraph|heb-root|hub-root|querySelector\\('circle|querySelector\\('path" apps/frontend/src apps/frontend/tests`

**Interfaces:**
- Consumes: fully wired canvas renderer.
- Produces: no live old renderer imports or SVG-DOM tests.

- [ ] **Step 1: Search old renderer references**

```powershell
rg -n "TrustGraphHEB|CommunityHubGraph|heb-root|hub-root" apps/frontend/src apps/frontend/tests
```

Expected before deletion: tests and old renderer files show up. Update/delete every live reference.

- [ ] **Step 2: Delete old renderer files**

Delete:
- `apps/frontend/src/components/graphs/TrustGraphHEB.tsx`
- `apps/frontend/src/components/graphs/CommunityHubGraph.tsx`

- [ ] **Step 3: Update consolidation guardrail**

In `belonging-graph-consolidation.test.ts`, add old renderer files to the retired list:

```ts
'src/components/graphs/TrustGraphHEB.tsx',
'src/components/graphs/CommunityHubGraph.tsx',
```

Keep `GraphZoomControls.tsx`, `types.ts`, `normalizeGraphData.ts`, `GraphCanvas.tsx`,
`BelongingGraphRenderer.tsx`, and `graphCanvasModel.ts` in the active list.

- [ ] **Step 4: Run guardrail and graph tests**

```powershell
cd apps/frontend; npx jest tests/regression/belonging-graph-consolidation.test.ts tests/tdd/sprint-114-graph-canvas-boundary.test.tsx tests/regression/sprint-111-graph-foundation.test.tsx tests/regression/sprint-111-graph-interaction.test.tsx tests/regression/sprint-113-graph-zoom.test.tsx --runInBand
```

Expected: passes.

- [ ] **Step 5: Commit**

```powershell
git add apps/frontend/src/components/graphs apps/frontend/tests/regression/belonging-graph-consolidation.test.ts apps/frontend/tests/regression/sprint-111-graph-foundation.test.tsx apps/frontend/tests/regression/sprint-111-graph-interaction.test.tsx apps/frontend/tests/regression/sprint-113-graph-zoom.test.tsx
git commit -m "refactor: retire old D3 graph renderers"
```

Run the mandatory `pre-commit-check` skill before this commit.

---

## Task 10: ADR-083 and User/Landing Docs

**Files:**
- Create: `docs/adr/ADR-083-belonging-graph-rendering-engine.md`
- Create: `apps/landing/src/data/docs/concepts/adr-083-belonging-graph-rendering-engine.json`
- Modify: `docs/adr/README.md`
- Modify: `docs/guides/trust-graph.md`
- Modify: `docs/concepts/reading-the-trust-graph.md`
- Modify: `apps/landing/src/data/docs/guides/trust-graph.json`
- Modify: `apps/landing/src/data/docs/concepts/reading-the-trust-graph.json`
- Modify: `apps/landing/src/data/docs/nav.json`

**Interfaces:**
- Consumes: implemented renderer/surface changes.
- Produces: docs and ADR matching shipped behavior.

- [ ] **Step 1: Create ADR-083**

Use this exact title and initial status:

```md
# ADR-083: Belonging Graph Rendering Engine

**Status**: Accepted
**Date**: 2026-06-26
**Sprint**: 114
**Version**: 11.21.0
```

The ADR must include:
- Context: S111 standardized on D3 HEB and removed `react-force-graph-2d`; S114 reverses renderer
  direction because the graph is becoming a centerpiece.
- Decision: adopt `react-force-graph-2d@1.29.1` as the belonging graph renderer, keep D3 available
  for force/layout helpers, keep canonical `GraphData`.
- Consequences: canvas test strategy, supply-chain review under ADR-061, no SVG DOM node assertions,
  surface consolidation.
- Supersedes in part: ADR-081's "D3 is the single graph dependency" renderer decision only; not the
  canonical graph model.

- [ ] **Step 2: Update docs/adr README**

Add:

```md
- [ADR-083: Belonging Graph Rendering Engine](ADR-083-belonging-graph-rendering-engine.md) — **Accepted**
```

- [ ] **Step 3: Update user guide and concept copy**

`docs/guides/trust-graph.md` must say:
- Access points are profile, community "How we're connected", and `/network`.
- Dashboard widget and Home preview card are retired.
- Community page no longer has a `My Network` sub-tab.
- The renderer is force/canvas; geometry differs from v11.20.0 but privacy, controls, and detail
  semantics remain.

`docs/concepts/reading-the-trust-graph.md` must say:
- "One canonical graph, one canvas renderer, multiple homes."
- Node detail remains structure-only, no reputation numbers.
- Scale 1/2/3 language remains in the explorer for Phase 1.

- [ ] **Step 4: Update landing JSON and nav**

Mirror the markdown content into:
- `apps/landing/src/data/docs/guides/trust-graph.json`
- `apps/landing/src/data/docs/concepts/reading-the-trust-graph.json`
- `apps/landing/src/data/docs/concepts/adr-083-belonging-graph-rendering-engine.json`

Add ADR-083 to `apps/landing/src/data/docs/nav.json` next to ADR-081/ADR-082.

- [ ] **Step 5: Verify docs drift directly**

```powershell
cd tests; npx jest regression/doc-context-drift-gate.test.ts --runInBand
```

Expected: passes.

- [ ] **Step 6: Commit**

```powershell
git add docs/adr/ADR-083-belonging-graph-rendering-engine.md docs/adr/README.md docs/guides/trust-graph.md docs/concepts/reading-the-trust-graph.md apps/landing/src/data/docs/concepts/adr-083-belonging-graph-rendering-engine.json apps/landing/src/data/docs/guides/trust-graph.json apps/landing/src/data/docs/concepts/reading-the-trust-graph.json apps/landing/src/data/docs/nav.json
git commit -m "docs: record S114 graph renderer decision"
```

Run the mandatory `pre-commit-check` skill before this commit.

---

## Task 11: Context, Registry, and TDD Promotion

**Files:**
- Modify: `apps/frontend/CONTEXT.md`
- Modify: `services/registry.json` only if API docs or endpoint metadata need a wording update
- Move: passing `apps/frontend/tests/tdd/sprint-114-*.test.tsx` to `apps/frontend/tests/regression/`
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

**Interfaces:**
- Consumes: completed implementation and docs.
- Produces: project context and regression coverage ready for CI.

- [ ] **Step 1: Update frontend context**

Add a Sprint 114 section near the top of `apps/frontend/CONTEXT.md`:
- `react-force-graph-2d@1.29.1` is the renderer boundary.
- `BelongingGraph` remains fetch/normalization wrapper.
- Canvas tests assert boundary/config/callbacks, not DOM SVG nodes.
- Retired surfaces: dashboard graph widget, Home My Network preview, community My Network sub-tab.

- [ ] **Step 2: Check whether registry changed**

Because S114 has no backend API change, `services/registry.json` should usually not change. Run:

```powershell
rg -n "trust/graph|trust/communities|trust/neighborhood" services/registry.json
```

Expected: existing social-graph endpoints remain accurate. Update registry only if docs text is stale.

- [ ] **Step 3: Promote passing S114 TDD tests**

Move:
- `apps/frontend/tests/tdd/sprint-114-graph-canvas-boundary.test.tsx`
- `apps/frontend/tests/tdd/sprint-114-surface-consolidation.test.tsx`

to:
- `apps/frontend/tests/regression/sprint-114-graph-canvas-boundary.test.tsx`
- `apps/frontend/tests/regression/sprint-114-surface-consolidation.test.tsx`

- [ ] **Step 4: Run promoted tests**

```powershell
cd apps/frontend; npx jest tests/regression/sprint-114-graph-canvas-boundary.test.tsx tests/regression/sprint-114-surface-consolidation.test.tsx --runInBand
```

Expected: passes.

- [ ] **Step 5: Update handoff immediately**

Mark which tasks are done, what remains, and any test failures in `.claude/handoff/CURRENT_HANDOFF.md`.

- [ ] **Step 6: Commit**

```powershell
git add apps/frontend/CONTEXT.md apps/frontend/tests/tdd apps/frontend/tests/regression .claude/handoff/CURRENT_HANDOFF.md services/registry.json
git commit -m "test: promote S114 graph regression coverage"
```

Run the mandatory `pre-commit-check` skill before this commit.

---

## Task 12: Final Quality Gates

**Files:**
- Modify: any files required by findings from the gates.
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

**Interfaces:**
- Consumes: full branch diff.
- Produces: merge-ready branch with findings resolved or documented.

- [ ] **Step 1: Type-check frontend**

```powershell
cd apps/frontend; npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 2: Run focused frontend tests**

```powershell
cd apps/frontend; npm run test:unit; npm run test:regression
```

Expected: exits 0.

- [ ] **Step 3: Run root unit + regression tests**

```powershell
npm test
```

Expected: exits 0.

- [ ] **Step 4: Run feedback check**

```powershell
npm run feedback:check
```

Expected: no relevant unresolved warnings. If warnings are unrelated false positives, note them in the
handoff and PR body.

- [ ] **Step 5: Run dependency audit**

```powershell
npm audit --audit-level=high
```

Expected: exits 0.

- [ ] **Step 6: Run `/simplify` on the full branch diff**

Verification line for PR body: `/simplify completed; findings resolved: {summary}`.

- [ ] **Step 7: Run `/code-review` on the full branch diff**

Verification line for PR body: `/code-review completed; findings resolved: {summary}`.

- [ ] **Step 8: Run `/security-review` on the full branch diff**

Verification line for PR body: `/security-review completed; findings resolved or dismissed: {summary}`.

- [ ] **Step 9: Update handoff**

Record final gate results and next action in `.claude/handoff/CURRENT_HANDOFF.md`.

- [ ] **Step 10: Commit gate fixes and handoff**

```powershell
git add .
git commit -m "chore: complete S114 quality gates"
```

Run the mandatory `pre-commit-check` skill before this commit.

---

## Task 13: PR, Merge, and Deploy

**Files:**
- Modify: `.github/pull_request_template.md` copy in PR body only, not the template file.

**Interfaces:**
- Consumes: green local gates.
- Produces: PR ready for cross-agent review and admin merge/deploy.

- [ ] **Step 1: Push the branch**

```powershell
git push -u origin feature/sprint-114-belonging-graph-consolidation
```

Expected: branch exists on GitHub.

- [ ] **Step 2: Create PR using the template**

Copy `.github/pull_request_template.md` into the PR body and fill every section. Security dismissals
must include any audit/CodeQL false-positive justification.

- [ ] **Step 3: Wait for CI**

```powershell
gh pr checks --watch
```

Expected: required checks green. Remember: PR-level "Deploy to Demo" shows `skipping`; real deploy is
the post-merge master CI/CD run.

- [ ] **Step 4: Cross-agent review**

Request Codex/Claude cross-agent review by the non-authoring agent. Resolve real findings.

- [ ] **Step 5: Admin merge and deploy**

Contributor agents do not self-merge. After Admin authorizes merge/deploy, use the `/deploy` skill or
the established CI/CD path:

```powershell
gh pr merge --squash --delete-branch
```

Then monitor the master CI/CD Pipeline run, not the PR skipped deploy check.

---

## Task 14: Sprint 114 Post-Deploy Validation (Human Checklist)

**Files:**
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`
- Modify: PR body/checklist if validation finds follow-ups.

**Interfaces:**
- Consumes: deployed demo build.
- Produces: validation evidence and final sprint handoff.

- [ ] **Step 1: Confirm deployment**

```powershell
gh run list --branch master --workflow "CI/CD Pipeline" --limit 3
```

Expected: latest post-merge master run is success and its `Deploy to Demo` job is success.

- [ ] **Step 2: S113 carried spot-check**

On `https://karmyq.com`, log in as `maria.reyes@test.karmyq.com` / `password123`:
- My Network is reachable from top nav.
- Scale 1/2/3 explorer modes read as distinct.
- Zoom controls work in each mode.
- Depth readout shows "Showing N people within D hops".
- No `NaN` appears.

- [ ] **Step 3: S114 renderer/consolidation spot-check**

In the same session:
- Profile page: "How you're woven into Karmyq" graph renders, pans/zooms, opens structure-only detail.
- Community page: "How we're connected" renders member topology; there is no `My Network` sub-tab.
- Dashboard/Home feed: no embedded graph widget and no `My Network` preview card.
- `/network?mode=ego`, `/network?mode=community&id={communityId}`, and `/network?mode=communities`
  render with the canvas renderer and no reputation numbers in node detail.

- [ ] **Step 4: Optional DOM smoke via browser console**

On `/network`, run:

```js
document.querySelectorAll('canvas').length
```

Expected: at least `1` on each graph mode.

- [ ] **Step 5: Final handoff**

Update `.claude/handoff/CURRENT_HANDOFF.md`:
- S114 deployed or blocked.
- Validation pass/fail evidence.
- Phase 2 recommendation for S115: trust explanation + traversal + hero prominence.
- Carry forward fission-lineage conflation bug to Phase 3 unless fixed earlier.
