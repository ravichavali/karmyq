# Sprint 115 Belonging Graph — Earned Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace renderer-invented person-graph structure with deterministic ego orbits and direct community-ring chords, while making the 150-member community response neutral and explicitly incomplete when truncated.

**Architecture:** `BelongingGraph` remains the only fetch/normalization wrapper and dispatches the canonical `GraphData` contract to purpose-built renderers. Pure models use deterministic normalized-name + ID ordering in `O(V log V)`, then compute geometry, adjacency, and paths in `O(V + E)`, for total end-to-end model construction of `O(V log V + E)`; React SVG components render that geometry and reuse the existing D3 zoom helper without allowing focus to recompute paths. The existing full-community endpoint keeps its ADR-082 projection but selects members neutrally and adds structural completeness metadata.

**Tech Stack:** TypeScript, React 19, Next.js Pages Router, SVG, D3 7 zoom only, Express, PostgreSQL, Jest, Testing Library, Turborepo.

## Global Constraints

- Target release is `v11.22.0`; do not reuse reverted `v11.21.0`.
- No database migration, new endpoint, dependency, force simulation, random seed, or reputation-math change.
- Person nodes remain equal-sized and never expose or read `trust_score`, `karma`, centrality, reciprocity, raw weight, or effective weight.
- At-rest person-edge width is exactly `1.35px`; focused incident-edge width is exactly `2.5px` and is an interaction affordance only.
- Relationship opacity is `strong=0.62`, `warm=0.40`, `fading=0.23`, `nearly_forgotten=0.11`, defensive `swept=0.05`, and missing/unknown `0.16`.
- Caller edges are amber, ordinary edges slate, focused incident edges teal; caller-edge amber takes precedence over teal.
- Ego layout derives distance with local BFS from `currentUserId` and never reads `node.degrees_of_separation` for geometry or ordering.
- Community layout keeps every returned member on one ring and emits one direct quadratic curve per valid link; no clusters, bundles, sampling, or inferred groups.
- Preserve all returned topology. Above 40 members persist only caller/focused/searched labels; use focus, title, keyboard, and zoom for every other name.
- `communities` stays on `CommunityHubGraph`; `fission` stays on `TrustGraphHEB`. Public profiles, offer corridors, path ranking, and temporal lineage remain out of scope.
- New tests begin in each workspace's `tests/tdd/`, pass red-to-green, and are promoted to `tests/regression/` before the final gate.
- Run the mandatory `pre-commit-check` skill before every commit; unit and regression suites must be green before push.
- Work in the existing shared checkout and branch `agent/codex/sprint-115-belonging-presentation`; do not create a worktree or merge the PR.

---

## File Structure

| File | Responsibility |
|---|---|
| `services/social-graph-service/src/database/trustEdgeDb.ts` | Select up to 149 non-caller active members by normalized name + ID, union the caller, and return completeness metadata. |
| `services/social-graph-service/tests/tdd/sprint-115-full-community-contract.test.ts` | Lock neutral selection, caller inclusion, counts, truncation, and privacy-safe projection preservation. |
| `apps/frontend/src/components/graphs/types.ts` | Add optional `totalActiveMembers` metadata. |
| `apps/frontend/src/components/graphs/graphVisualEncoding.ts` | Own person-node colors, edge hues/widths/opacities, state labels, adjacency, and accessible labels. |
| `apps/frontend/src/components/graphs/communityRingModel.ts` | Pure stable node ordering, ring coordinates, direct quadratic paths, and dangling-link filtering. |
| `apps/frontend/src/components/graphs/CommunityRingGraph.tsx` | Declarative SVG community renderer, focus/detail/truncation states, keyboard access, and zoom ownership. |
| `apps/frontend/src/components/graphs/egoOrbitModel.ts` | Pure BFS distances, stable baseline orbits, expansion arcs, and valid edge geometry. |
| `apps/frontend/src/components/graphs/EgoOrbitGraph.tsx` | Declarative SVG ego renderer with focus, labels, sparse state, keyboard access, and zoom ownership. |
| `apps/frontend/src/components/BelongingGraph.tsx` | Fetch and normalize once, then dispatch `ego`, `community`, `communities`, and `fission` to contextual renderers. |
| `apps/frontend/src/components/BelongingSection.tsx` | Own the profile's one replaceable expansion and recoverable failure state. |
| `apps/frontend/src/pages/network.tsx` | Pass baseline/expansion identity into the ego layout and narrate complete vs truncated community data. |
| `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx` | Replace clustering/bundling copy with direct relationships and redundant-belonging guidance. |
| `apps/frontend/src/components/graphs/TrustGraphHEB.tsx` | Retain only fission rendering and proposal interactions. |
| `apps/frontend/tests/tdd/sprint-115-graph-models.test.ts` | Exact deterministic model and encoding contracts. |
| `apps/frontend/tests/tdd/sprint-115-graph-renderers.test.tsx` | Accessibility, focus, density, zoom, detail, and no-geometry-recompute contracts. |
| `apps/frontend/tests/tdd/sprint-115-belonging-surfaces.test.tsx` | Wrapper dispatch, profile expansion, community completeness, and untouched-mode contracts. |
| `apps/frontend/tests/regression/sprint-111-graph-foundation.test.tsx` | Update the wrapper contract from one renderer to contextual dispatch. |
| `apps/frontend/tests/regression/sprint-111-graph-interaction.test.tsx` | Move shared person interaction/privacy assertions to the new renderers; retain fission assertions on HEB. |
| `apps/frontend/tests/regression/sprint-113-graph-zoom.test.tsx` | Assert one zoom owner for ego, community, communities, and fission renderers. |
| `apps/frontend/tests/regression/belonging-graph-consolidation.test.ts` | Guard one wrapper + canonical model + shared encoding, rather than one universal renderer. |
| `docs/adr/ADR-083-contextual-belonging-graph-rendering.md` | Record Earned Structure and partial supersession of ADR-063/081's one-renderer choice. |
| `docs/guides/trust-graph.md`, `docs/concepts/reading-the-trust-graph.md` | Explain how to read the shipped views without reputation or cluster claims. |
| `apps/frontend/CONTEXT.md`, `services/social-graph-service/CONTEXT.md`, `services/registry.json` | Keep implementation and API governance current. |
| `package.json`, `package-lock.json` | Release version `11.22.0`. |

---

### Task 1: Make the full-community contract neutral and explicit

**Files:**
- Create: `services/social-graph-service/tests/tdd/sprint-115-full-community-contract.test.ts`
- Modify: `services/social-graph-service/src/database/trustEdgeDb.ts`
- Modify: `services/social-graph-service/tests/regression/sprint-74-trust-graph-full.test.ts`
- Modify: `services/social-graph-service/tests/regression/sprint-112-disclosure-projection.test.ts`

**Interfaces:**
- Produces: `getFullCommunityGraph(communityId, callingUserId): Promise<{ nodes: TrustNode[]; links: TrustLink[]; meta: { totalActiveMembers: number; truncated: boolean } }>`.
- Preserves: `projectPersonGraph()` passes `meta` through without adding forbidden reputation keys.

- [ ] **Step 1: Write the failing contract tests**

Create a pool-mocked suite that queues the two existing queries and asserts the exact structural result:

```ts
import { jest } from '@jest/globals'

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }))

import { pool } from '../../src/config/database'
import { getFullCommunityGraph } from '../../src/database/trustEdgeDb'
import { projectPersonGraph } from '../../src/services/disclosureProjection'
import { assertNoForbiddenReputationKeys } from '@karmyq/shared'

const query = (pool as any).query

describe('Sprint 115 full-community contract', () => {
  beforeEach(() => query.mockReset())

  it('selects members by normalized name and id, never trust score, and unions the caller', async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] })
    await getFullCommunityGraph('community', 'caller')
    const sql = query.mock.calls[0][0] as string
    expect(sql).toContain('LOWER(BTRIM(u.name))')
    expect(sql).toMatch(/ORDER BY[\s\S]*normalized_name[\s\S]*user_id/)
    expect(sql).toMatch(/LIMIT 149/)
    expect(sql).toMatch(/UNION/)
    expect(sql).toContain('$2::uuid')
    expect(sql).not.toMatch(/ORDER BY\s+trust_score/i)
  })

  it.each([
    [150, 150, false],
    [151, 150, true],
  ])('returns total=%i, returned=%i, truncated=%s', async (total, returned, truncated) => {
    query
      .mockResolvedValueOnce({
        rows: Array.from({ length: returned }, (_, i) => ({
          id: `u-${i}`,
          name: `User ${i}`,
          trust_score: '9',
          karma: '7',
          is_current_user: i === 0,
          total_active_members: String(total),
        })),
      })
      .mockResolvedValueOnce({ rows: [] })
    const graph = await getFullCommunityGraph('community', 'u-0')
    expect(graph.meta).toEqual({ totalActiveMembers: total, truncated })
    const safe = projectPersonGraph(graph, 0.5, 'u-0')
    expect(safe.meta).toEqual(graph.meta)
    expect(() => assertNoForbiddenReputationKeys(safe)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm --workspace @karmyq/social-graph-service run test:tdd -- --runInBand sprint-115-full-community-contract
```

Expected: FAIL because the SQL still orders by `trust_score` and the result has no `meta`.

- [ ] **Step 3: Replace trust-ranked selection and return metadata**

In `getFullCommunityGraph`, replace `member_scores/top_members` selection with this shared CTE in both node and link queries:

```ts
const memberCTE = `
  WITH active_members AS (
    SELECT m.user_id,
           LOWER(BTRIM(u.name)) COLLATE "C" AS normalized_name
    FROM communities.members m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.community_id = $1 AND m.status = 'active'
  ),
  neutral_members AS (
    SELECT user_id
    FROM active_members
    WHERE user_id <> $2::uuid
    ORDER BY normalized_name, user_id
    LIMIT 149
  ),
  selected_members AS (
    SELECT user_id FROM neutral_members
    UNION
    SELECT user_id FROM active_members WHERE user_id = $2::uuid
  )
`
```

Use `selected_members` everywhere the old query used `top_members`. In the node query, independently expose the total and continue computing internal node values without using them for selection:

```sql
SELECT u.id, u.name,
  COALESCE((
    SELECT SUM(tel.current_weight)
    FROM social_graph.trust_edges_live tel
    WHERE (tel.user_id_a = u.id OR tel.user_id_b = u.id)
      AND tel.community_id = $1
  ), 0) AS trust_score,
  COALESCE((
    SELECT SUM(kr.points) FROM reputation.karma_records kr
    WHERE kr.user_id = u.id AND kr.community_id = $1
  ), 0) AS karma,
  (u.id = $2::uuid) AS is_current_user,
  (SELECT COUNT(*) FROM active_members) AS total_active_members
FROM selected_members sm
JOIN auth.users u ON u.id = sm.user_id
```

Return structural metadata from the parsed rows:

```ts
const nodes = redactNodeMetrics(nodesResult.rows.map(r => ({
  id: r.id,
  name: r.name,
  trust_score: parseFloat(r.trust_score) || 0,
  karma: parseFloat(r.karma) || 0,
  isCurrentUser: r.is_current_user,
})))
const totalActiveMembers = Number(nodesResult.rows[0]?.total_active_members ?? nodes.length)

return {
  nodes,
  links: edgesResult.rows.map(r => ({
    source: r.source,
    target: r.target,
    raw_weight: parseFloat(r.raw_weight) || 0,
    effective_weight: parseFloat(r.effective_weight) || 0,
  })),
  meta: {
    totalActiveMembers,
    truncated: totalActiveMembers > nodes.length,
  },
}
```

- [ ] **Step 4: Update old regression fixtures for the additive result**

Add `total_active_members` to node rows in `sprint-74-trust-graph-full.test.ts`, expect two queries as before, change the selection assertion from “top by score” to normalized name/ID, and assert `result.meta`. Extend the `projectPersonGraph` meta fixture in `sprint-112-disclosure-projection.test.ts` to:

```ts
meta: { depth: 2, truncated: true, totalActiveMembers: 151 }
```

and expect that exact object to survive projection.

- [ ] **Step 5: Run service tests and verify GREEN**

Run:

```powershell
npm --workspace @karmyq/social-graph-service run test:tdd -- --runInBand sprint-115-full-community-contract
npm --workspace @karmyq/social-graph-service run test:regression -- --runInBand sprint-74-trust-graph-full sprint-112-disclosure-projection
npx tsc --noEmit -p services/social-graph-service/tsconfig.json
```

Expected: all selected suites PASS and TypeScript emits no errors.

- [ ] **Step 6: Promote and commit**

Move the green TDD file to regression, rerun it there, invoke `pre-commit-check`, then commit:

```powershell
Move-Item -LiteralPath 'services/social-graph-service/tests/tdd/sprint-115-full-community-contract.test.ts' -Destination 'services/social-graph-service/tests/regression/sprint-115-full-community-contract.test.ts'
npm --workspace @karmyq/social-graph-service run test:regression -- --runInBand sprint-115-full-community-contract
git add services/social-graph-service/src/database/trustEdgeDb.ts services/social-graph-service/tests/regression/sprint-74-trust-graph-full.test.ts services/social-graph-service/tests/regression/sprint-112-disclosure-projection.test.ts services/social-graph-service/tests/regression/sprint-115-full-community-contract.test.ts
git commit -m "fix: make community graph selection neutral"
```

---

### Task 2: Define the shared visual language and community geometry

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-115-graph-models.test.ts`
- Create: `apps/frontend/src/components/graphs/graphVisualEncoding.ts`
- Create: `apps/frontend/src/components/graphs/communityRingModel.ts`
- Modify: `apps/frontend/src/components/graphs/types.ts`

**Interfaces:**
- Produces: `edgeVisual(link, currentUserId, focusedNodeId)` returning `{ stroke, opacity, width, label }`.
- Produces: `buildAdjacency(graphData)` and `personNodeAriaLabel(node, currentUserId, distance, connections)`.
- Produces: `buildCommunityRingModel(graphData, width, height): CommunityRingModel` with stable nodes and one direct path per valid link.

- [ ] **Step 1: Write exact encoding and geometry tests**

Cover all six opacity outcomes, constant/focus widths, hue precedence, equal ring radius, name+ID ordering, reversed-link curve stability, dangling-link filtering, and finite output. The core expectations are:

```ts
expect(edgeVisual(link('strong'), 'me')).toMatchObject({ opacity: 0.62, width: 1.35 })
expect(edgeVisual(link('warm'), 'me')).toMatchObject({ opacity: 0.40 })
expect(edgeVisual(link('fading'), 'me')).toMatchObject({ opacity: 0.23 })
expect(edgeVisual(link('nearly_forgotten'), 'me')).toMatchObject({ opacity: 0.11 })
expect(edgeVisual(link('swept'), 'me')).toMatchObject({ opacity: 0.05 })
expect(edgeVisual({ source: 'a', target: 'b' }, 'me')).toMatchObject({ opacity: 0.16 })
expect(edgeVisual({ source: 'me', target: 'a', decayTier: 'warm' }, 'me', 'a')).toMatchObject({
  stroke: PERSON_COLORS.callerEdge,
  width: 2.5,
})

const model = buildCommunityRingModel(graph, 700, 560)
expect(model.nodes.map(n => n.id)).toEqual(['a-id', 'b-id', 'z-id'])
expect(new Set(model.nodes.map(n => Math.hypot(n.x, n.y).toFixed(4))).size).toBe(1)
expect(model.links).toHaveLength(graph.links.length - 1) // dangling link removed
expect(model.links.every(l => /^M[-\d.]+ [-\d.]+ Q[-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+$/.test(l.path))).toBe(true)
```

Include a fixture whose nodes contain non-zero `trust_score`/`karma` and whose links contain
`raw_weight`/`effective_weight`; freeze those objects and prove coordinates, paths, visual tokens, and
labels are unchanged when only forbidden values change. The returned `RingLink.link` may preserve the
canonical input object for identity, but neither the model nor renderer may branch on its numeric fields.

- [ ] **Step 2: Run the model test and verify RED**

```powershell
npm --workspace karmyq-frontend run test:tdd -- --runInBand sprint-115-graph-models
```

Expected: FAIL because both modules and `meta.totalActiveMembers` are absent.

- [ ] **Step 3: Implement semantic visual encoding**

Create `graphVisualEncoding.ts` with these exported values and pure functions:

```ts
import type { GraphData, TrustLink, TrustNode } from './types'

export const PERSON_EDGE_WIDTH = 1.35
export const FOCUSED_EDGE_WIDTH = 2.5
export const UNRELATED_OPACITY = 0.05
export const PERSON_COLORS = {
  callerNode: '#10b981',
  ordinaryNode: '#94a3b8',
  callerEdge: '#f59e0b',
  ordinaryEdge: '#64748b',
  focusedEdge: '#14b8a6',
  focusRing: '#f8fafc',
} as const

const OPACITY = {
  strong: 0.62,
  warm: 0.40,
  fading: 0.23,
  nearly_forgotten: 0.11,
  swept: 0.05,
} as const

export function relationshipLabel(tier: TrustLink['decayTier']): string {
  return tier ? tier.replaceAll('_', ' ') : 'relationship state unavailable'
}

export function edgeVisual(link: TrustLink, currentUserId: string, focusedNodeId?: string) {
  const caller = link.source === currentUserId || link.target === currentUserId
  const focused = !!focusedNodeId && (link.source === focusedNodeId || link.target === focusedNodeId)
  return {
    stroke: caller ? PERSON_COLORS.callerEdge : focused ? PERSON_COLORS.focusedEdge : PERSON_COLORS.ordinaryEdge,
    opacity: link.decayTier ? OPACITY[link.decayTier] : 0.16,
    width: focused ? FOCUSED_EDGE_WIDTH : PERSON_EDGE_WIDTH,
    label: relationshipLabel(link.decayTier),
  }
}

export function buildAdjacency(graph: GraphData): Map<string, Set<string>> {
  const adjacency = new Map(graph.nodes.map(node => [node.id, new Set([node.id])]))
  for (const link of graph.links) {
    if (!adjacency.has(link.source) || !adjacency.has(link.target)) continue
    adjacency.get(link.source)!.add(link.target)
    adjacency.get(link.target)!.add(link.source)
  }
  return adjacency
}

export function personNodeAriaLabel(
  node: TrustNode,
  currentUserId: string,
  distance: number | undefined,
  connections: number
): string {
  const parts = [node.name]
  if (node.id === currentUserId) parts.push('you')
  if (distance != null && node.id !== currentUserId) parts.push(`${distance} ${distance === 1 ? 'degree' : 'degrees'} away`)
  parts.push(`${connections} ${connections === 1 ? 'connection' : 'connections'}`)
  return parts.join(', ')
}
```

- [ ] **Step 4: Implement the pure community ring**

Create `communityRingModel.ts` with no React or DOM imports:

```ts
import { linkKey } from './normalizeGraphData'
import type { GraphData, TrustLink, TrustNode } from './types'

export interface RingNode extends TrustNode { x: number; y: number; angle: number }
export interface RingLink { key: string; link: TrustLink; path: string }
export interface CommunityRingModel { nodes: RingNode[]; links: RingLink[]; radius: number }

const identityKey = (node: TrustNode) => `${node.name.normalize('NFKD').trim().toLowerCase()}\u0000${node.id}`
export const compareGraphNodes = (a: TrustNode, b: TrustNode) => {
  const ak = identityKey(a)
  const bk = identityKey(b)
  return ak < bk ? -1 : ak > bk ? 1 : 0
}
const finite = (value: number) => Number.isFinite(value) ? Number(value.toFixed(3)) : 0

export function buildCommunityRingModel(graph: GraphData, width: number, height: number): CommunityRingModel {
  const ordered = [...graph.nodes].sort(compareGraphNodes)
  const radius = Math.max(60, Math.min(width, height) / 2 - 72)
  const nodes = ordered.map((node, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(ordered.length, 1)
    return { ...node, x: finite(Math.cos(angle) * radius), y: finite(Math.sin(angle) * radius), angle }
  })
  const byId = new Map(nodes.map(node => [node.id, node]))
  const links = graph.links.flatMap(link => {
    const source = byId.get(link.source)
    const target = byId.get(link.target)
    if (!source || !target) return []
    const [a, b] = source.id < target.id ? [source, target] : [target, source]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.hypot(dx, dy) || 1
    const bow = Math.min(18, length * 0.08)
    const cx = finite((a.x + b.x) / 2 - (dy / length) * bow)
    const cy = finite((a.y + b.y) / 2 + (dx / length) * bow)
    return [{
      key: linkKey(link),
      link,
      path: `M${source.x} ${source.y} Q${cx} ${cy} ${target.x} ${target.y}`,
    }]
  })
  return { nodes, links, radius }
}
```

Add `totalActiveMembers?: number` beside `truncated?: boolean` in `GraphData.meta`.

- [ ] **Step 5: Run the focused model suite and TypeScript**

```powershell
npm --workspace karmyq-frontend run test:tdd -- --runInBand sprint-115-graph-models
npx tsc --noEmit -p apps/frontend/tsconfig.json
```

Expected: PASS; no coordinate/path contains `NaN` or `Infinity`.

- [ ] **Step 6: Commit the pure foundation**

Invoke `pre-commit-check`, then:

```powershell
git add apps/frontend/src/components/graphs/types.ts apps/frontend/src/components/graphs/graphVisualEncoding.ts apps/frontend/src/components/graphs/communityRingModel.ts apps/frontend/tests/tdd/sprint-115-graph-models.test.ts
git commit -m "feat: define earned graph geometry"
```

Keep the model test in TDD until Task 5 exercises both model files and promotes it.

---

### Task 3: Render the community ring without manufactured clusters

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-115-graph-renderers.test.tsx`
- Create: `apps/frontend/src/components/graphs/CommunityRingGraph.tsx`
- Modify: `apps/frontend/tests/regression/sprint-113-graph-zoom.test.tsx`

**Interfaces:**
- Consumes: `buildCommunityRingModel`, `edgeVisual`, `buildAdjacency`, existing `installGraphZoom/zoomBy/zoomReset`.
- Produces: default `CommunityRingGraph({ graphData, currentUserId, height?, focusedNodeId?, onNodeActivate?, enableZoom? })`.

- [ ] **Step 1: Add failing renderer tests**

Render a four-node chain and assert:

```ts
expect(container.querySelectorAll('g[data-node-id]')).toHaveLength(4)
expect(container.querySelectorAll('path[data-link-key]')).toHaveLength(3)
expect(container.querySelector('[data-node-id="peer"]')).toHaveAttribute('role', 'button')
expect(container.querySelector('[data-node-id="peer"]')).toHaveAttribute('tabindex', '0')
expect(container.querySelector('[data-node-id="peer"] title')).toHaveTextContent('Peer')
fireEvent.keyDown(container.querySelector('[data-node-id="peer"]')!, { key: 'Enter' })
expect(onNodeActivate).toHaveBeenCalledWith('peer')
```

Focus a node and assert its non-caller incident edge is teal/`2.5`, caller incident edge remains amber/`2.5`, unrelated edges/nodes recede, and every path's `d` string is unchanged. Assert zoom controls appear once and drive `svg.__zoom`. For 41 nodes, assert only the caller and focused node have persistent `<text class="node-label">`; all 41 retain `<title>` and focusable button groups. Assert a zero-link/single-member graph says “This community doesn’t have any trust connections yet” and explains that connections appear after completed help. For truncated metadata, assert “Showing 41 of 151 active members” and “incomplete view”; for complete metadata, assert redundant-belonging guidance is present.

- [ ] **Step 2: Run and verify RED**

```powershell
npm --workspace karmyq-frontend run test:tdd -- --runInBand sprint-115-graph-renderers
```

Expected: FAIL because `CommunityRingGraph` does not exist.

- [ ] **Step 3: Implement the declarative SVG renderer**

Use React state only for selected/hovered/focused identity. Compute geometry with:

```ts
const model = useMemo(
  () => buildCommunityRingModel(graphData, width, height),
  [graphData.nodes, graphData.links, width, height]
)
const adjacency = useMemo(() => buildAdjacency(graphData), [graphData.nodes, graphData.links])
const activeFocus = transientFocusId ?? focusedNodeId ?? selectedNodeId ?? undefined
const related = activeFocus ? adjacency.get(activeFocus) ?? new Set([activeFocus]) : null
const connectionsFor = (nodeId: string) => Math.max(0, (adjacency.get(nodeId)?.size ?? 1) - 1)
```

The SVG root is `<g ref={rootRef}>`; install/clear zoom in an effect keyed by `width`, `height`, and `enableZoom`, not focus. Render edges before nodes:

```tsx
{model.links.map(item => {
  const visual = edgeVisual(item.link, currentUserId, activeFocus)
  const incident = !!activeFocus && (item.link.source === activeFocus || item.link.target === activeFocus)
  return (
    <path
      key={item.key}
      data-link-key={item.key}
      d={item.path}
      fill="none"
      stroke={visual.stroke}
      strokeWidth={visual.width}
      strokeOpacity={activeFocus && !incident ? UNRELATED_OPACITY : visual.opacity}
      className="transition-opacity motion-reduce:transition-none"
    >
      <title>{visual.label}</title>
    </path>
  )
})}
```

Each node is a focusable SVG group with pointer/keyboard handlers, equal `r={6}`, current-user white ring, visible focus/selected stroke, `<title>`, and conditional persistent label:

```tsx
const showLabel = model.nodes.length <= 40 || node.id === currentUserId || node.id === activeFocus
const activate = () => {
  setSelectedNodeId(previous => previous === node.id ? null : node.id)
  onNodeActivate?.(node.id)
}
```

Before the SVG, return the tested community-specific sparse state when there are no links and no more
than one node. The detail panel must show name, “This is you” when appropriate,
`connectionsFor(selectedNode.id)`, and an incident-state summary produced by counting only the selected
node's links by `relationshipLabel`. The legend names strong/warm/fading/nearly forgotten in text. If
`meta.truncated && meta.totalActiveMembers`, render the incomplete `N of M` message and omit the
complete-community reading prompt; otherwise render: “Look for multiple routes, several bridges, few
isolates, and whether one person has become indispensable.”

- [ ] **Step 4: Wire one zoom owner**

Copy the established ref contract, not a second zoom implementation:

```ts
const svgRef = useRef<SVGSVGElement>(null)
const rootRef = useRef<SVGGElement>(null)
const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
const initialTransformRef = useRef(d3.zoomIdentity)

useEffect(() => {
  if (!svgRef.current || !rootRef.current) return
  const root = d3.select(rootRef.current)
  if (enableZoom) {
    const handle = installGraphZoom(svgRef.current, root, { width, height, cx: width / 2, cy: height / 2 })
    zoomBehaviorRef.current = handle.behavior
    initialTransformRef.current = handle.initialTransform
  } else {
    clearGraphZoom(svgRef.current, root, width / 2, height / 2)
    zoomBehaviorRef.current = null
  }
  return () => { if (svgRef.current) d3.select(svgRef.current).on('.zoom', null) }
}, [width, height, enableZoom])
```

Mount `GraphZoomControls` once and call existing `zoomBy`/`zoomReset` with those refs.

- [ ] **Step 5: Run renderer and zoom tests**

```powershell
npm --workspace karmyq-frontend run test:tdd -- --runInBand sprint-115-graph-renderers
npm --workspace karmyq-frontend run test:regression -- --runInBand sprint-113-graph-zoom
npx tsc --noEmit -p apps/frontend/tsconfig.json
```

Expected: the TDD suite passes. The old HEB-specific community zoom test also remains green because
dispatch has not changed yet; Task 7 migrates that still-valid contract before removing HEB's person modes.

- [ ] **Step 6: Commit the community aperture**

Invoke `pre-commit-check`, then:

```powershell
git add apps/frontend/src/components/graphs/CommunityRingGraph.tsx apps/frontend/tests/tdd/sprint-115-graph-renderers.test.tsx
git commit -m "feat: render direct community relationship ring"
```

---

### Task 4: Build ego geometry from disclosed topology

**Files:**
- Create: `apps/frontend/src/components/graphs/egoOrbitModel.ts`
- Modify: `apps/frontend/tests/tdd/sprint-115-graph-models.test.ts`

**Interfaces:**
- Consumes: canonical `GraphData`, `compareGraphNodes`, `linkKey`.
- Produces: `buildEgoOrbitModel(graph, currentUserId, width, height, { baselineNodeIds?, expansionRootIds? }): EgoOrbitModel`.
- Guarantees: caller center, local BFS distances, stable baseline positions, expansion arcs, finite valid links.

- [ ] **Step 1: Extend the model suite with failing ego cases**

Use a baseline `me—maya—john` plus an expansion whose response incorrectly marks `maya` distance `0` and its new neighbor distance `1`. Assert the model returns `me=0`, `maya=1`, new neighbor `2`, and never changes those results when every `node.degrees_of_separation` is replaced. Also assert:

```ts
expect(byId.get('me')).toMatchObject({ x: 0, y: 0, displayDistance: 0 })
expect(positionAfterExpansion.get('maya')).toEqual(positionBeforeExpansion.get('maya'))
expect(positionAfterCollapse.get('maya')).toEqual(positionBeforeExpansion.get('maya'))
expect(model.links).toHaveLength(validLinkCount)
expect(JSON.stringify(model)).not.toMatch(/NaN|Infinity/)
```

- [ ] **Step 2: Run and verify RED**

```powershell
npm --workspace karmyq-frontend run test:tdd -- --runInBand sprint-115-graph-models
```

Expected: FAIL because `egoOrbitModel.ts` is absent.

- [ ] **Step 3: Implement BFS and stable orbits**

Create these types and helpers:

```ts
export interface EgoOrbitNode extends TrustNode {
  x: number
  y: number
  angle: number
  displayDistance: number | null
  isExpansionNode: boolean
}
export interface EgoOrbitLink { key: string; link: TrustLink; x1: number; y1: number; x2: number; y2: number }
export interface EgoOrbitModel { nodes: EgoOrbitNode[]; links: EgoOrbitLink[]; maxDistance: number }
export interface EgoOrbitOptions { baselineNodeIds?: readonly string[]; expansionRootIds?: readonly string[] }
```

Build adjacency only from links whose endpoints exist. BFS starts exclusively at `currentUserId`, stores `0`, then visits neighbors in `compareGraphNodes` order. Never access `degrees_of_separation`. Partition nodes into baseline IDs (default: every input node) and expansion IDs. Place baseline nodes by `displayDistance`: caller at `(0,0)`, distance `d` at radius `Math.min(width, height) * (0.19 + (d - 1) * 0.13)` with stable sorted equal spacing. For expansion nodes, choose the first adjacent `expansionRootId` sorted by root order; center a `±0.32` radian arc on that root's angle at the node's BFS radius. Unreachable nodes use the outermost radius and stable full-circle ordering. Return straight edge coordinates only for valid endpoints.

Use `Number(value.toFixed(3))` for coordinates, not random jitter. Ensure division uses `Math.max(count, 1)`.

- [ ] **Step 4: Run and verify GREEN**

```powershell
npm --workspace karmyq-frontend run test:tdd -- --runInBand sprint-115-graph-models
npx tsc --noEmit -p apps/frontend/tsconfig.json
```

Expected: all encoding, ring, and ego model tests PASS.

- [ ] **Step 5: Commit the ego model**

Invoke `pre-commit-check`, then:

```powershell
git add apps/frontend/src/components/graphs/egoOrbitModel.ts apps/frontend/tests/tdd/sprint-115-graph-models.test.ts
git commit -m "feat: derive stable ego orbits from topology"
```

---

### Task 5: Render the ego orbit and preserve its mental map

**Files:**
- Create: `apps/frontend/src/components/graphs/EgoOrbitGraph.tsx`
- Modify: `apps/frontend/tests/tdd/sprint-115-graph-renderers.test.tsx`
- Move: `apps/frontend/tests/tdd/sprint-115-graph-models.test.ts` → `apps/frontend/tests/regression/sprint-115-graph-models.test.ts`
- Move: `apps/frontend/tests/tdd/sprint-115-graph-renderers.test.tsx` → `apps/frontend/tests/regression/sprint-115-graph-renderers.test.tsx`

**Interfaces:**
- Consumes: `buildEgoOrbitModel`, shared visual encoding, existing zoom helper.
- Produces: default `EgoOrbitGraph({ graphData, currentUserId, baselineNodeIds?, expansionRootIds?, height?, focusedNodeId?, onNodeActivate?, enableZoom? })`.

- [ ] **Step 1: Add failing ego renderer assertions**

Assert the caller is at `translate(0 0)`, direct and second-degree nodes have different radii, wrong response-supplied depths do not affect geometry, Enter/Space activate, focus does not change coordinates or edge endpoints, zoom mounts once, and an empty ego renders:

```text
You don’t have any trust connections yet.
Connections grow through the help you give and receive.
```

Assert the same >40 label rule and accessible label fields as the community renderer.

- [ ] **Step 2: Run and verify RED**

```powershell
npm --workspace karmyq-frontend run test:tdd -- --runInBand sprint-115-graph-renderers
```

Expected: FAIL because `EgoOrbitGraph` does not exist.

- [ ] **Step 3: Implement the ego renderer**

Follow `CommunityRingGraph`'s React SVG, accessibility, density, detail, and zoom contracts. The only geometry differences are:

```ts
const model = useMemo(
  () => buildEgoOrbitModel(graphData, currentUserId, width, height, { baselineNodeIds, expansionRootIds }),
  [graphData.nodes, graphData.links, currentUserId, width, height, baselineNodeIds, expansionRootIds]
)
```

Render edge lines from `x1/y1/x2/y2` with the shared visual tokens. Render subtle orbit `<circle>` guides once per positive `displayDistance`, never sized or colored by person. Include `displayDistance` from the model—not `node.degrees_of_separation`—in `personNodeAriaLabel` and the selected detail panel. Center the SVG root through the same zoom effect and exclude focus from the model/zoom dependency lists.

Click/keyboard activation toggles internal selection and invokes `onNodeActivate`; transient hover/focus changes styles only. Caller-edge amber still overrides teal.

- [ ] **Step 4: Run both renderer/model suites and TypeScript**

```powershell
npm --workspace karmyq-frontend run test:tdd -- --runInBand sprint-115-graph-models sprint-115-graph-renderers
npx tsc --noEmit -p apps/frontend/tsconfig.json
```

Expected: PASS.

- [ ] **Step 5: Promote the green suites and commit**

```powershell
Move-Item -LiteralPath 'apps/frontend/tests/tdd/sprint-115-graph-models.test.ts' -Destination 'apps/frontend/tests/regression/sprint-115-graph-models.test.ts'
Move-Item -LiteralPath 'apps/frontend/tests/tdd/sprint-115-graph-renderers.test.tsx' -Destination 'apps/frontend/tests/regression/sprint-115-graph-renderers.test.tsx'
npm --workspace karmyq-frontend run test:regression -- --runInBand sprint-115-graph-models sprint-115-graph-renderers
git add apps/frontend/src/components/graphs/EgoOrbitGraph.tsx apps/frontend/tests/regression/sprint-115-graph-models.test.ts apps/frontend/tests/regression/sprint-115-graph-renderers.test.tsx
git commit -m "feat: render deterministic ego orbit"
```

Invoke `pre-commit-check` before the commit.

---

### Task 6: Dispatch contextual renderers and integrate profile/community surfaces

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-115-belonging-surfaces.test.tsx`
- Modify: `apps/frontend/src/components/BelongingGraph.tsx`
- Modify: `apps/frontend/src/components/BelongingSection.tsx`
- Modify: `apps/frontend/src/pages/network.tsx`
- Modify: `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx`
- Modify: `apps/frontend/tests/regression/sprint-111-graph-foundation.test.tsx`
- Modify: `apps/frontend/tests/regression/sprint-111-belonging-surfaces.test.tsx`
- Modify: `apps/frontend/tests/regression/sprint-111-network-expand.test.tsx`

**Interfaces:**
- Adds wrapper props: `baselineNodeIds?: readonly string[]`, `expansionRootIds?: readonly string[]`.
- Profile owns `baseline`, one `{ nodeId, data }` expansion, `expandingNodeId`, and recoverable error.
- Network passes `baseline.nodes.map(n => n.id)` and `expansions.map(e => e.nodeId)` only in ego mode.

- [ ] **Step 1: Write failing dispatch and profile state tests**

Mock `EgoOrbitGraph`, `CommunityRingGraph`, `CommunityHubGraph`, and the dynamic HEB renderer with distinct test IDs. Assert all four modes dispatch correctly, supplied data never fetches, and metadata survives `normalizePersonGraph`.

For `BelongingSection`, mock the aggregate baseline and neighborhood expansion. Click Maya, assert depth-1 fetch and one expanded node; click John, assert Maya's branch is replaced; click John again, assert collapse. Make the second fetch reject and assert the old branch stays visible beside Retry/Dismiss controls.

For `/network`, assert baseline IDs and three FIFO expansion roots reach the wrapper and community truncation copy is exactly “Showing 150 of 151 active members. This view is incomplete.”

- [ ] **Step 2: Run and verify RED**

```powershell
npm --workspace karmyq-frontend run test:tdd -- --runInBand sprint-115-belonging-surfaces
```

Expected: FAIL because dispatch and profile expansion are not implemented.

- [ ] **Step 3: Turn `BelongingGraph` into a mode dispatcher**

Statically import `EgoOrbitGraph`, `CommunityRingGraph`, and `CommunityHubGraph`; keep only fission's `TrustGraphHEB` dynamic/client-only. After existing fetch/loading/error logic, select:

```tsx
if (mode === 'ego') {
  return <EgoOrbitGraph graphData={effectiveData} currentUserId={currentUserId}
    baselineNodeIds={baselineNodeIds} expansionRootIds={expansionRootIds}
    height={height} focusedNodeId={focusedNodeId} onNodeActivate={onNodeActivate} enableZoom={enableZoom} />
}
if (mode === 'community') {
  return <CommunityRingGraph graphData={effectiveData} currentUserId={currentUserId}
    height={height} focusedNodeId={focusedNodeId} onNodeActivate={onNodeActivate} enableZoom={enableZoom} />
}
if (mode === 'communities') {
  return <CommunityHubGraph graphData={effectiveData} height={height}
    focusedNodeId={focusedNodeId} onNodeActivate={onNodeActivate} enableZoom={enableZoom} />
}
return <TrustGraphHEB graphData={effectiveData} currentUserId={currentUserId} mode="fission"
  groupMap={groupMap} groupALabel={groupALabel} groupBLabel={groupBLabel}
  onSwitchGroup={onSwitchGroup} height={height} focusedNodeId={focusedNodeId}
  onNodeActivate={onNodeActivate} enableZoom={enableZoom} />
```

Keep fetch/normalize/loading/error behavior in the wrapper; do not duplicate API calls inside renderers.

- [ ] **Step 4: Add one replaceable profile expansion**

In `BelongingSection`, import `socialGraphService`, `normalizePersonGraph`, and `mergeGraphData`. Use:

```ts
interface ProfileExpansion { nodeId: string; data: GraphData }
const [baseline, setBaseline] = useState<GraphData | null>(null)
const [expansion, setExpansion] = useState<ProfileExpansion | null>(null)
const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null)
const [expandError, setExpandError] = useState<{ nodeId: string; message: string } | null>(null)
const mergedGraph = useMemo(
  () => baseline && expansion ? mergeGraphData(baseline, expansion.data) : baseline,
  [baseline, expansion]
)
const baselineNodeIds = useMemo(() => baseline?.nodes.map(node => node.id), [baseline])
const expansionRootIds = useMemo(() => expansion ? [expansion.nodeId] : [], [expansion])
const onDataLoaded = useCallback((data: GraphData) => setBaseline(current => current ?? data), [])
```

`expandNode(nodeId)` ignores the caller, collapses the same open root, and otherwise requests `getNeighborhood(nodeId, { depth: 1 })`. Do not clear the current expansion before the request. On success replace it; on failure retain it and set retryable error. Retry invokes the same node; Dismiss clears only the error. Pass `graphData={mergedGraph ?? undefined}`, baseline IDs, the one expansion root, and `onNodeActivate={expandNode}` to `BelongingGraph`.

- [ ] **Step 5: Thread stable-layout identity through `/network` and correct completeness copy**

Memoize the identity arrays so a search/focus render cannot invalidate pure geometry, then pass them:

```ts
const baselineNodeIds = useMemo(
  () => mode === 'ego' ? baseline?.nodes.map(node => node.id) : undefined,
  [mode, baseline]
)
const expansionRootIds = useMemo(
  () => mode === 'ego' ? expansions.map(expansion => expansion.nodeId) : undefined,
  [mode, expansions]
)
```

```tsx
baselineNodeIds={baselineNodeIds}
expansionRootIds={expansionRootIds}
```

Replace the generic truncated message with mode-aware copy:

```tsx
{mode === 'community' && mergedGraph?.meta?.truncated && mergedGraph.meta.totalActiveMembers != null && (
  <p className="text-xs text-amber-500">
    Showing {mergedGraph.nodes.length} of {mergedGraph.meta.totalActiveMembers} active members. This view is incomplete.
  </p>
)}
{mode === 'ego' && mergedGraph?.meta?.truncated && (
  <p className="text-xs text-amber-500">Showing the closest connections only — some distant ones are hidden.</p>
)}
```

- [ ] **Step 6: Replace obsolete community copy**

Use exact mode descriptions in `TrustGraphTab`:

```ts
community: 'Scale 2 · This Community — every returned member on one ring. Each chord is a disclosed relationship; amber lines are yours, and brighter lines are more active.'
ego: 'Scale 1 · My Network — you at the center, with each orbit showing another degree of connection. Amber lines are yours. This view travels with you across communities.'
```

Below the complete community graph, explain redundant belonging without a score: “Look for multiple routes between people, several bridges, few isolated members, and whether the community depends on one indispensable person.” Ensure incomplete graphs suppress this interpretation inside `CommunityRingGraph`.

- [ ] **Step 7: Update old wrapper/surface tests and run GREEN**

Replace the generic `next/dynamic` HEB assertion in `sprint-111-graph-foundation` with explicit contextual renderer mocks. Keep fetch normalization assertions intact. Extend existing surface/network tests for the new props without removing FIFO, race, sparse, privacy, fission, or communities coverage.

Run:

```powershell
npm --workspace karmyq-frontend run test:tdd -- --runInBand sprint-115-belonging-surfaces
npm --workspace karmyq-frontend run test:regression -- --runInBand sprint-111-graph-foundation sprint-111-belonging-surfaces sprint-111-network-expand
npx tsc --noEmit -p apps/frontend/tsconfig.json
```

Expected: PASS.

- [ ] **Step 8: Promote and commit**

```powershell
Move-Item -LiteralPath 'apps/frontend/tests/tdd/sprint-115-belonging-surfaces.test.tsx' -Destination 'apps/frontend/tests/regression/sprint-115-belonging-surfaces.test.tsx'
npm --workspace karmyq-frontend run test:regression -- --runInBand sprint-115-belonging-surfaces
git add apps/frontend/src/components/BelongingGraph.tsx apps/frontend/src/components/BelongingSection.tsx apps/frontend/src/pages/network.tsx apps/frontend/src/components/community/tabs/TrustGraphTab.tsx apps/frontend/tests/regression/sprint-111-graph-foundation.test.tsx apps/frontend/tests/regression/sprint-111-belonging-surfaces.test.tsx apps/frontend/tests/regression/sprint-111-network-expand.test.tsx apps/frontend/tests/regression/sprint-115-belonging-surfaces.test.tsx
git commit -m "feat: surface contextual belonging graphs"
```

Invoke `pre-commit-check` before the commit.

---

### Task 7: Retire person HEB paths without losing regressions

**Files:**
- Modify: `apps/frontend/src/components/graphs/TrustGraphHEB.tsx`
- Modify: `apps/frontend/tests/regression/sprint-111-graph-interaction.test.tsx`
- Modify: `apps/frontend/tests/regression/sprint-113-graph-zoom.test.tsx`
- Modify: `apps/frontend/tests/regression/belonging-graph-consolidation.test.ts`
- Create: `apps/frontend/tests/regression/sprint-115-structural-truth.test.ts`

**Interfaces:**
- `TrustGraphHEBProps.mode` becomes the literal `'fission'`.
- Shared accessibility/privacy/focus/zoom contracts live against the renderer that now owns each mode.
- Structural fixtures compare topology; they do not compute or display a health score.

- [ ] **Step 1: Inventory before deletion**

Run:

```powershell
rg -n "TrustGraphHEB|mode=\"ego\"|mode=\"community\"|close-knit|bundle|detectClusters" apps/frontend/tests apps/frontend/src
```

Expected: every old direct person-mode HEB assertion is accounted for in `sprint-115-graph-renderers`, the updated interaction suite, or the updated zoom suite before source cleanup begins.

- [ ] **Step 2: Migrate shared interaction tests**

In `sprint-111-graph-interaction.test.tsx`, render `EgoOrbitGraph` for person accessibility/keyboard/keyed-update/privacy cases and `CommunityRingGraph` for community focus/detail. Render `CommunityHubGraph` directly for communities membership sizing. Keep `TrustGraphHEB` only for the fission isolated ring and switch-group behavior. Use privacy-safe fixtures (`decayTier`, no person metrics) except the explicit forbidden-field non-read test.

In `sprint-113-graph-zoom.test.tsx`, use `it.each` over ego and community renderers, retain direct hub coverage, and use HEB only with `mode="fission"`. Every case asserts exactly one Zoom in/out/reset cluster and a real `__zoom` scale change.

- [ ] **Step 3: Simplify HEB to fission only**

Remove `CommunityHubGraph`, `detectClusters`, person opacity/decay state, community/ego sparse states, and non-fission legend/detail branches from `TrustGraphHEB.tsx`. Keep:

- group A/B/unassigned cluster mapping;
- within-group green and cross-group red links;
- fission weights and dashed lineage/isolation styling;
- keyboard activation, zoom, selected structural detail, and `onSwitchGroup`;
- keyed D3 joins and proposal labels.

Change the prop to `mode: 'fission'` so TypeScript prevents person modes from returning.

- [ ] **Step 4: Update the consolidation invariant**

Require these files to exist:

```ts
'src/components/BelongingGraph.tsx',
'src/components/graphs/types.ts',
'src/components/graphs/normalizeGraphData.ts',
'src/components/graphs/graphVisualEncoding.ts',
'src/components/graphs/EgoOrbitGraph.tsx',
'src/components/graphs/CommunityRingGraph.tsx',
'src/components/graphs/CommunityHubGraph.tsx',
'src/components/graphs/TrustGraphHEB.tsx',
```

Keep the dead dependency/wrapper guards. Rename the contract description to “one wrapper, canonical model, shared visual encoding, contextual renderers.”

- [ ] **Step 5: Add structural-truth fixtures**

Create equal-size redundant, hub-dependent, and fragmented `GraphData` fixtures. Build each through `buildCommunityRingModel` and assert:

```ts
expect(redundant.links).toHaveLength(8)
expect(hubDependent.links.every(edge => [edge.link.source, edge.link.target].includes('hub'))).toBe(true)
expect(componentCount(fragmentedGraph)).toBe(3)
expect(new Set([redundant.links.map(l => l.key).sort().join('|'), hubDependent.links.map(l => l.key).sort().join('|'), fragmented.links.map(l => l.key).sort().join('|')]).size).toBe(3)
```

Implement `componentCount` inside the test using endpoint adjacency. Do not add a production health metric.

- [ ] **Step 6: Run the migrated regression surface**

```powershell
npm --workspace karmyq-frontend run test:regression -- --runInBand sprint-111-graph-interaction sprint-113-graph-zoom belonging-graph-consolidation sprint-115
npx tsc --noEmit -p apps/frontend/tsconfig.json
```

Expected: PASS, with no HEB person-mode mount remaining.

- [ ] **Step 7: Commit regression migration and cleanup**

Invoke `pre-commit-check`, then:

```powershell
git add apps/frontend/src/components/graphs/TrustGraphHEB.tsx apps/frontend/tests/regression/sprint-111-graph-interaction.test.tsx apps/frontend/tests/regression/sprint-113-graph-zoom.test.tsx apps/frontend/tests/regression/belonging-graph-consolidation.test.ts apps/frontend/tests/regression/sprint-115-structural-truth.test.ts
git commit -m "refactor: retain HEB for fission only"
```

---

### Task 8: Close the documentation loop and bump v11.22.0

**Files:**
- Create: `docs/adr/ADR-083-contextual-belonging-graph-rendering.md`
- Modify: `docs/adr/README.md`
- Modify: `docs/adr/ADR-063-canonical-trust-metric-and-unified-graph.md`
- Modify: `docs/adr/ADR-081-belonging-graph-system.md`
- Modify: `docs/guides/trust-graph.md`
- Modify: `docs/concepts/reading-the-trust-graph.md`
- Modify: `apps/frontend/CONTEXT.md`
- Modify: `services/social-graph-service/CONTEXT.md`
- Modify: `services/registry.json`
- Modify only if its existing copy is stale: `apps/frontend/src/lib/onboarding/workflows.ts`
- Modify: `package.json`, `package-lock.json`
- Regenerate ignored/tracked output as configured: `apps/landing/src/data/docs/**`

**Interfaces:**
- Documents the shipped mode map and additive `meta: { totalActiveMembers, truncated }` contract.
- Records ADR-083 as Accepted until deploy validation; Claude alone marks sprint complete.

- [ ] **Step 1: Write ADR-083 and amend prior decisions**

ADR-083 must state:

- Context: force/HEB presentation can manufacture apparent structure.
- Decision: one canonical graph contract through contextual ego orbit, community ring, community hub, and fission HEB renderers.
- Visual truth: equal person nodes, direct disclosed links, constant width, qualitative intensity, semantic hue.
- API correction: neutral name/ID selection, guaranteed caller, explicit incompleteness.
- Consequences: more components but clearer responsibility; no health score; public profiles/path corridor/time lineage deferred.
- Supersession: partially supersedes ADR-063/081 only where they mandate one universal person renderer; preserves canonical data and privacy.

Add ADR-083 to `docs/adr/README.md` and amendment notes to ADR-063/081.

- [ ] **Step 2: Update user-facing graph documentation**

In both source Markdown pages, remove cluster-color, close-knit-group, trust-score, variable-width, and bundle-reading guidance. Document exact ego/community layouts, edge hues, five intensity bands (including defensive swept), focus behavior, >40 label behavior, incomplete `N of M`, and the unchanged across-community/fission views. State that connection is context, not endorsement or transferable trust.

- [ ] **Step 3: Update implementation/API governance**

In `apps/frontend/CONTEXT.md`, add the exact mode map and pure-model/memoization test pattern. In `services/social-graph-service/CONTEXT.md`, replace top-trust selection and stale raw metric response examples with safe person projections plus:

```json
"meta": { "totalActiveMembers": 151, "truncated": true }
```

Update the `/trust/graph/:communityId/full` entry in `services/registry.json` to say “up to 150 neutrally selected active members, caller included, structural completeness metadata, ADR-082 safe nodes/links.”

Audit onboarding copy:

```powershell
rg -n "cluster|bundle|close-knit|trust score|line width|graph" apps/frontend/src/lib/onboarding/workflows.ts
```

Edit only an existing graph step that contradicts the shipped visual language; do not add a new workflow.

- [ ] **Step 4: Bump the root release version**

Run:

```powershell
npm version 11.22.0 --no-git-tag-version
```

Expected: root `package.json` and `package-lock.json` both report `11.22.0`; no git tag is created.

- [ ] **Step 5: Regenerate landing docs and verify drift**

Run:

```powershell
npx tsx scripts/generate-docs.ts
rg -n 'ADR-083|Earned Structure|totalActiveMembers|community ring|ego orbit' apps/landing/src/data/docs
npm run feedback:check
```

Expected: generated ADR/guide/concept JSON and nav contain the new sources; feedback check passes. Stage generated files only if the repository tracks them (use `git check-ignore -v` to confirm; if ignored, leave them generated but uncommitted as established).

- [ ] **Step 6: Commit docs and version**

Invoke `pre-commit-check`, then stage the named source files, any changed onboarding file, package files, and tracked generated docs:

```powershell
git add docs/adr docs/guides/trust-graph.md docs/concepts/reading-the-trust-graph.md apps/frontend/CONTEXT.md services/social-graph-service/CONTEXT.md services/registry.json apps/frontend/src/lib/onboarding/workflows.ts package.json package-lock.json
git commit -m "docs: explain earned belonging structure"
```

Before committing, use `git diff --cached --name-only` and unstage `workflows.ts` if the audit required no edit.

---

### Task 9: Validate density, complete the SDLC gates, and hand off the PR

**Files:**
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`
- Modify only for genuine test-discovered defects: Sprint 115 implementation/test/docs files above.

**Interfaces:**
- Produces: a clean, pushed contributor branch and complete PR contract; no merge or deploy.

- [ ] **Step 1: Run focused workspace gates without Turbo cache ambiguity**

```powershell
npx tsc --noEmit -p apps/frontend/tsconfig.json
npx tsc --noEmit -p services/social-graph-service/tsconfig.json
npm --workspace karmyq-frontend run test:unit -- --runInBand
npm --workspace karmyq-frontend run test:regression -- --runInBand
npm --workspace @karmyq/social-graph-service run test:unit -- --runInBand
npm --workspace @karmyq/social-graph-service run test:regression -- --runInBand
```

Expected: all commands PASS.

- [ ] **Step 2: Run repository-wide gates**

```powershell
npm test
npm run feedback:check
npm run lint
npm run build
npm audit --audit-level=high
```

Expected: all required checks PASS. Record only established non-blocking warnings; do not call warnings green without identifying them.

- [ ] **Step 3: Validate 150-member rendering and focus cost**

Run the frontend locally and load deterministic sparse and high-edge 150-member fixtures through a development-only test harness or the renderer regression fixture—do not commit a production route. In browser performance tools record:

- initial model/render duration;
- focus-update duration;
- path count before/after focus;
- every `d` value before/after focus.

Pass conditions: no crash, missing node, `NaN`, `Infinity`, duplicate zoom controls, or unusable pan/zoom; focus reuses every path string and does not invoke the pure model again. Validate desktop and a mobile viewport with `prefers-reduced-motion` both off and on.

- [ ] **Step 4: Validate real surfaces with rich and sparse demo accounts**

Check profile, community Trust Graph, and `/network` for:

- stable reload coordinates;
- one replaceable profile expansion with retry retaining the old graph;
- three FIFO explorer expansions and collapse;
- community focus without layout movement;
- complete vs truncated copy;
- every node reachable by keyboard with visible focus and full title;
- no person reputation, cluster, extraction, or endorsement claim;
- unchanged Across Communities and fission administration.

Use the existing demo account documented in handoff; do not deploy without Admin authorization.

- [ ] **Step 5: Run mandated review skills and fix findings forward**

Run `/simplify`, `/code-review`, and `/security-review` according to repository process. Re-run the focused suite after every fix and the full gates after the final fix. Contributor agents do not dismiss security findings or merge.

- [ ] **Step 6: Update the handoff, including separate future work**

Update `.claude/handoff/CURRENT_HANDOFF.md` with branch, commits, test evidence, remaining human validation, and PR status. Carry forward as separate future sprints:

- Sprint 116 named connection corridor + offer context: shortest first, strongest complete equal-hop corridor, named mutuals, “clearest connection,” never endorsement.
- Public-profile navigation after an API-enforced visibility contract.
- Temporal fission/fusion lineage after durable event/history design.
- Landing CTA follow-up: header/home primary “Try the live demo” to `karmyq.com`, Founding Circle as normal/secondary navigation, How It Works to demo, Research to Founding Circle, and dual home-ending CTAs. Do not mix landing CTA code into Sprint 115.

Invoke `pre-commit-check`, then:

```powershell
git add .claude/handoff/CURRENT_HANDOFF.md
git commit -m "docs: hand off Sprint 115 implementation"
```

- [ ] **Step 7: Push and open the contributor PR contract**

Verify the tree and commits:

```powershell
git status --short
git log --oneline origin/master..HEAD
```

Expected: clean tree and only Sprint 115 commits. Push the owned branch, copy `.github/pull_request_template.md`, fill every section (tests, risks, docs, security dismissals), and open the PR. Do not merge. Claude performs merge-readiness validation; Admin authorizes merge/deploy.

---

## Plan Self-Review Checklist

- [x] Every Sprint 115 acceptance criterion maps to a task above.
- [x] Every new behavior begins with a failing TDD test and ends in regression.
- [x] `swept`, unknown state, BFS-not-response-depth, truncation, caller inclusion, and dense labels each have exact tests.
- [x] No task introduces public profiles, connection corridors, offer wiring, time history, clusters, bundles, health scores, or person metrics.
- [x] `communities` and `fission` retain dedicated regression coverage after HEB cleanup.
- [x] Function names and props are consistent across producing and consuming tasks.
- [x] No placeholder implementation step remains.
