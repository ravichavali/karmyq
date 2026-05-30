# Trust Graph Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the click-heavy ego-network with three purpose-built visualizations: hierarchical edge bundling for community + fission views (D3), radial/concentric layout for the ego view (Cytoscape.js), and a new full-community-graph endpoint that makes the whole thing possible.

**Architecture:** New `GET /trust/graph/:communityId/full` endpoint in social-graph-service. Frontend introduces `TrustGraphHEB.tsx` (D3 SVG) and `TrustGraphRadial.tsx` (Cytoscape.js) as purpose-built graph components. `TrustGraph.tsx` becomes a thin router delegating to the right component. `react-force-graph-2d` stays for the cross-community `NetworkGraph.tsx`.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, D3 (HEB), Cytoscape.js (radial), react-force-graph-2d (existing aggregate view).

**Simplify standard:** Run `/simplify` after each implementation task (Tasks 1–9) before moving to the next. Focus on any newly written code — remove dead branches, flatten unnecessary wrappers, clean up one-off variable names.

---

## File Map

### New files to create
| File | Responsibility |
|------|----------------|
| `apps/frontend/src/components/graphs/TrustGraphHEB.tsx` | D3 hierarchical edge bundling — community + fission views |
| `apps/frontend/src/components/graphs/TrustGraphRadial.tsx` | Cytoscape.js concentric — ego / My Network view |
| `services/social-graph-service/tests/tdd/sprint-74-trust-graph-full.test.ts` | TDD test for new endpoint |

### Existing files to modify
| File | Change |
|------|--------|
| `services/social-graph-service/src/database/trustEdgeDb.ts` | Add `getFullCommunityGraph()` |
| `services/social-graph-service/src/routes/trustGraph.ts` | Add `GET /trust/graph/:communityId/full` (before existing param route) |
| `apps/frontend/src/lib/api.ts` | Add `getFullCommunityGraph()` to `socialGraphService` |
| `apps/frontend/src/components/TrustGraph.tsx` | Thin router — delegates to HEB or Radial by mode |
| `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx` | Community + My Network sub-tabs, uses new components |
| `apps/frontend/src/components/community/tabs/FissionTab.tsx` | Switch to TrustGraphHEB in fission mode |
| `apps/frontend/src/components/NetworkGraph.tsx` | Screen space improvements (react-force-graph-2d unchanged) |
| `apps/frontend/package.json` | Add d3, @types/d3, cytoscape, react-cytoscapejs, @types/cytoscape |
| `apps/landing/src/data/docs/guides/trust-graph.json` | Create trust graph user guide |
| `apps/landing/src/data/docs/concepts/trust-graph.json` | Update/create concept page |
| `apps/landing/src/data/docs/nav.json` | Add guide entry |
| `scripts/generate-docs.ts` | Add trust-graph slug to GUIDE_ORDER + GUIDE_LABELS + GUIDE_SLUGS |
| `services/social-graph-service/CONTEXT.md` | Document new endpoint |
| `services/registry.json` | Add endpoint to social-graph-service apis.provides |
| `package.json` (root) | Bump 10.2.0 → 10.3.0 |
| `tests/regression/version.test.ts` | Update version invariant to 10.3.0 |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Route order**: Register `GET /trust/graph/:communityId/full` BEFORE `GET /trust/graph/:communityId`. Express matches `full` as a communityId if registered second — silently breaks both routes.

2. **trust_edges_live is a VIEW**: Never INSERT/UPDATE. Read from `trust_edges_live`, write to `trust_edges`.

3. **Calling user always included**: `top 149 ORDER BY trust_score UNION calling_user_uuid`. Never drop the UNION.

4. **D3 HEB angle math**: Use `d3.lineRadial().curve(d3.curveBundle.beta(0.85))`. For each link, call `source.path(target)` from d3-hierarchy to get the bundling path. Convert polar to Cartesian: `x = r * Math.cos(angle - Math.PI/2)`, `y = r * Math.sin(angle - Math.PI/2)`.

5. **react-cytoscapejs SSR crash**: Next.js will fail to SSR the Cytoscape import. In `TrustGraph.tsx`, load `TrustGraphRadial` with `dynamic(() => import('./graphs/TrustGraphRadial'), { ssr: false })`.

6. **D3 + React DOM conflict**: D3 mutates the DOM; React does too. Render D3 into `svgRef.current` inside a `useEffect`. Always call `d3.select(svgRef.current).selectAll('*').remove()` before re-rendering.

7. **Cytoscape mapData**: `mapData(field, from, to, mapFrom, mapTo)` needs the field's min/max across the dataset. Compute `maxWeight` and `maxScore` from the response before building the stylesheet.

8. **Landing docs gitignored**: `apps/landing/src/data/docs/` — always `git add -f`.

9. **nav.json revert bug**: Add new slugs to `GUIDE_ORDER`, `GUIDE_LABELS`, `GUIDE_SLUGS` in `scripts/generate-docs.ts` before running `npm run generate-docs` from `apps/landing/`.

---

## Task 1: Feature branch + full community graph DB query

**Files:**
- Modify: `services/social-graph-service/src/database/trustEdgeDb.ts`

- [ ] `git checkout -b feature/sprint-74-trust-graph-foundation`

- [ ] Add `getFullCommunityGraph(communityId, callingUserId)` to `trustEdgeDb.ts`:

```typescript
export async function getFullCommunityGraph(
  communityId: string,
  callingUserId: string
): Promise<{ nodes: TrustNode[]; links: TrustLink[] }> {
  const memberCTE = `
    WITH active_members AS (
      SELECT user_id FROM communities.members
      WHERE community_id = $1 AND status = 'active'
    ),
    member_scores AS (
      SELECT am.user_id, COALESCE(SUM(tel.current_weight), 0) AS trust_score
      FROM active_members am
      LEFT JOIN social_graph.trust_edges_live tel
        ON (tel.user_id_a = am.user_id OR tel.user_id_b = am.user_id)
        AND tel.community_id = $1
      GROUP BY am.user_id
    ),
    top_members AS (
      (SELECT user_id FROM member_scores ORDER BY trust_score DESC LIMIT 149)
      UNION
      (SELECT $2::uuid)
    )
  `;

  const nodesQuery = `
    ${memberCTE}
    SELECT u.id, u.name,
      COALESCE(ms.trust_score, 0) AS trust_score,
      COALESCE((
        SELECT SUM(kr.points) FROM reputation.karma_records kr
        WHERE kr.user_id = u.id AND kr.community_id = $1
      ), 0) AS karma,
      (u.id = $2::uuid) AS is_current_user
    FROM top_members tm
    JOIN auth.users u ON u.id = tm.user_id
    LEFT JOIN member_scores ms ON ms.user_id = tm.user_id
  `;

  const edgesQuery = `
    ${memberCTE}
    SELECT tel.user_id_a AS source, tel.user_id_b AS target,
           tel.raw_weight, tel.current_weight AS effective_weight
    FROM social_graph.trust_edges_live tel
    WHERE tel.community_id = $1
      AND tel.user_id_a IN (SELECT user_id FROM top_members)
      AND tel.user_id_b IN (SELECT user_id FROM top_members)
  `;

  const [nodesResult, edgesResult] = await Promise.all([
    pool.query(nodesQuery, [communityId, callingUserId]),
    pool.query(edgesQuery, [communityId, callingUserId]),
  ]);

  return {
    nodes: nodesResult.rows.map(r => ({
      id: r.id, name: r.name,
      trust_score: parseFloat(r.trust_score) || 0,
      karma: parseFloat(r.karma) || 0,
      isCurrentUser: r.is_current_user,
    })),
    links: edgesResult.rows.map(r => ({
      source: r.source, target: r.target,
      raw_weight: parseFloat(r.raw_weight) || 0,
      effective_weight: parseFloat(r.effective_weight) || 0,
    })),
  };
}
```

- [ ] `/simplify` — check for duplicated CTE string, any unnecessary intermediate vars

- [ ] `cd services/social-graph-service && npx tsc --noEmit`

---

## Task 2: Backend route — GET /trust/graph/:communityId/full

**Files:**
- Modify: `services/social-graph-service/src/routes/trustGraph.ts`

- [ ] Import `getFullCommunityGraph` from `trustEdgeDb`

- [ ] Register the new route **before** the existing `router.get('/:communityId', ...)`:

```typescript
// MUST be before /:communityId — see implementation note #1
router.get('/:communityId/full', authenticateToken, async (req, res) => {
  const { communityId } = req.params;
  const callingUserId = req.user!.userId;

  const memberCheck = await pool.query(
    `SELECT 1 FROM communities.members
     WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
    [communityId, callingUserId]
  );
  if (memberCheck.rows.length === 0) {
    return res.status(403).json({ success: false, message: 'Not a community member' });
  }

  const graph = await getFullCommunityGraph(communityId, callingUserId);
  return res.json({ success: true, data: graph });
});
```

- [ ] `/simplify`

- [ ] Verify route ordering by checking `router.stack` log or manual test: `curl -H "Authorization: Bearer <token>" http://localhost:3010/trust/graph/<communityId>/full`

---

## Task 3: API client + install packages

**Files:**
- Modify: `apps/frontend/src/lib/api.ts`
- Modify: `apps/frontend/package.json`

- [ ] Add to `socialGraphService` in `api.ts`:

```typescript
getFullCommunityGraph: (communityId: string) =>
  api.get(`/social-graph/trust/graph/${communityId}/full`),
```

- [ ] Install new dependencies from `apps/frontend/`:

```bash
npm install d3 cytoscape react-cytoscapejs
npm install --save-dev @types/d3 @types/cytoscape
```

- [ ] `/simplify` — verify no duplicate api method signatures

- [ ] `npx tsc --noEmit`

---

## Task 4: TrustGraphHEB.tsx — hierarchical edge bundling

**Files:**
- Create: `apps/frontend/src/components/graphs/TrustGraphHEB.tsx`

- [ ] Create the component. Key implementation steps:

**Cluster detection** (used in 'community' mode; fission mode skips this):
```typescript
function detectClusters(nodes: TrustNode[], links: TrustLink[]): Map<string, number> {
  const parent = new Map(nodes.map(n => [n.id, n.id]));
  const find = (x: string): string => {
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));

  [...links]
    .sort((a, b) => b.effective_weight - a.effective_weight)
    .slice(0, Math.floor(links.length * 0.4)) // merge on top 40% strongest edges
    .forEach(l => union(l.source as string, l.target as string));

  const rootToCluster = new Map<string, number>();
  let nextId = 0;
  const result = new Map<string, number>();
  nodes.forEach(n => {
    const root = find(n.id);
    if (!rootToCluster.has(root)) rootToCluster.set(root, nextId++);
    result.set(n.id, rootToCluster.get(root)!);
  });
  return result;
}
```

**D3 HEB rendering** (in `useEffect` on `svgRef.current`):
- Build hierarchy: `d3.hierarchy({ children: clusters.map(c => ({ children: c.nodes })) })`
- `d3.cluster().size([2 * Math.PI, radius])` — positions nodes
- Sort nodes by cluster so same-cluster nodes are adjacent on the circle
- `d3.lineRadial().curve(d3.curveBundle.beta(0.85))` — bundled splines
- For each link: `sourceNode.path(targetNode)` → array of hierarchy nodes → pass to line generator
- Draw links first (z-order), then nodes, then labels
- Edge colors:
  - Same cluster: `rgba(99, 102, 241, 0.6)` (indigo)
  - Cross cluster: `rgba(148, 163, 184, 0.25)` (muted)
  - My edges: `rgba(251, 146, 60, 0.85)` (amber, rendered last/on top)
- Node radius: `4 + Math.min((trust_score / maxScore) * 6, 6)` → range 4–10px
- Labels: `textAnchor` and `transform rotate` based on angle

**Props interface:**
```typescript
interface TrustGraphHEBProps {
  nodes: TrustNode[];
  links: TrustLink[];
  currentUserId: string;
  mode: 'community' | 'fission';
  groupMap?: Map<string, 'A' | 'B'>; // fission only
  width?: number;
  height?: number;
}
```

- [ ] `/simplify` — the D3 rendering chain tends to accumulate intermediate variables; collapse any that are used only once

- [ ] Render check in dev: community tab should show nodes on a circle with bundled edges

---

## Task 5: TrustGraphRadial.tsx — Cytoscape concentric layout

**Files:**
- Create: `apps/frontend/src/components/graphs/TrustGraphRadial.tsx`

- [ ] Create the component using `react-cytoscapejs`:

```typescript
import CytoscapeComponent from 'react-cytoscapejs';
import type { ElementDefinition, StylesheetStyle } from 'cytoscape';

interface TrustGraphRadialProps {
  nodes: TrustNode[];
  links: TrustLink[];
  currentUserId: string;
  onNodeClick?: (nodeId: string) => void;
}
```

**Elements**: map nodes to `{ data: { id, label: name, trust_score, isCurrentUser } }` and links to `{ data: { source, target, effective_weight } }`

**Layout**:
```typescript
const layout = {
  name: 'concentric',
  concentric: (node: any) => node.data('isCurrentUser') ? 1000 : node.data('trust_score') + 1,
  levelWidth: () => 3,
  minNodeSpacing: 30,
  animate: true,
  animationDuration: 400,
};
```

**Stylesheet** (compute `maxWeight`, `maxScore` from props before building):
```typescript
const stylesheet: StylesheetStyle[] = [
  { selector: 'node', style: {
    'background-color': '#64748b',
    'width': `mapData(trust_score, 0, ${maxScore}, 16, 32)`,
    'height': `mapData(trust_score, 0, ${maxScore}, 16, 32)`,
    'label': 'data(label)',
    'font-size': '10px',
    'color': '#e2e8f0',
    'text-valign': 'bottom',
    'text-margin-y': 4,
  }},
  { selector: 'node[?isCurrentUser]', style: {
    'background-color': '#6366f1',
    'width': 36, 'height': 36,
    'font-size': '11px',
    'font-weight': 'bold',
  }},
  { selector: 'edge', style: {
    'line-color': '#94a3b8',
    'width': `mapData(effective_weight, 0, ${maxWeight}, 1, 5)`,
    'opacity': `mapData(effective_weight, 0, ${maxWeight}, 0.2, 0.85)`,
    'curve-style': 'bezier',
  }},
  // amber edges touching current user — applied via cy.on('render') or edge class
];
```

- [ ] Amber highlight: after mount, `cy.edges().forEach(e => { if (e.source().id() === currentUserId || e.target().id() === currentUserId) e.addClass('my-edge'); })`. Add `.my-edge` style entry with `line-color: #fb923c`.

- [ ] `/simplify`

- [ ] Render check in dev: My Network tab shows concentric rings with you at center

---

## Task 6: TrustGraph.tsx — thin router

**Files:**
- Modify: `apps/frontend/src/components/TrustGraph.tsx`

- [ ] Rewrite `TrustGraph.tsx` as a mode router. Keep the existing prop interface (backward compat for any callers not yet updated), add `mode: 'ego' | 'community' | 'fission'`:

```typescript
const TrustGraphRadial = dynamic(
  () => import('./graphs/TrustGraphRadial'),
  { ssr: false }
);
import TrustGraphHEB from './graphs/TrustGraphHEB';

export default function TrustGraph(props: TrustGraphProps) {
  if (props.mode === 'ego') return <TrustGraphRadial {...props} />;
  return <TrustGraphHEB {...props} />;
}
```

- [ ] Remove any force-directed logic that was previously in TrustGraph.tsx — it's fully replaced

- [ ] `/simplify`

- [ ] `npx tsc --noEmit`

---

## Task 7: TrustGraphTab.tsx + FissionTab.tsx

**Files:**
- Modify: `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx`
- Modify: `apps/frontend/src/components/community/tabs/FissionTab.tsx`

**TrustGraphTab.tsx:**

- [ ] Add `subTab: 'community' | 'ego'` state, default `'community'`

- [ ] Add a two-button toggle above the graph:
```tsx
<div className="flex gap-2 mb-3">
  <button onClick={() => setSubTab('community')} className={subTab === 'community' ? 'active-tab' : 'tab'}>
    Community
  </button>
  <button onClick={() => setSubTab('ego')} className={subTab === 'ego' ? 'active-tab' : 'tab'}>
    My Network
  </button>
</div>
```

- [ ] Community sub-tab: call `socialGraphService.getFullCommunityGraph(communityId)` on mount (or when switching to this tab), render `<TrustGraph mode="community" currentUserId={userId} nodes={...} links={...} />`

- [ ] My Network sub-tab: call `socialGraphService.getTrustGraph(communityId)` on mount, render `<TrustGraph mode="ego" currentUserId={userId} nodes={...} links={...} onNodeClick={...} />`

- [ ] Container div: `className="w-full min-h-[600px] h-[calc(100vh-320px)]"`

**FissionTab.tsx:**

- [ ] Replace the existing `<TrustGraph mode="fission" groupMap={groupMap} ...>` prop pass-through — it should now work automatically since `TrustGraph.tsx` routes `mode="fission"` to `TrustGraphHEB`

- [ ] Verify `groupMap` prop flows through correctly

- [ ] `/simplify` on both files

---

## Task 8: NetworkGraph.tsx — screen space

**Files:**
- Modify: `apps/frontend/src/components/NetworkGraph.tsx`

- [ ] Update container height: `min-h-[600px] h-[calc(100vh-300px)]`

- [ ] Canvas width/height: `width="100%" height="100%"` (react-force-graph-2d already respects these)

- [ ] `/simplify`

---

## Task 9: User guides + landing page docs

**Files:**
- Modify/create: `apps/landing/src/data/docs/guides/trust-graph.json`
- Modify/create: `apps/landing/src/data/docs/concepts/trust-graph.json`
- Modify: `scripts/generate-docs.ts`
- Run: `npm run generate-docs` from `apps/landing/`
- Force-add: `git add -f apps/landing/src/data/docs/`

- [ ] Create `guides/trust-graph.json`:
```json
{
  "slug": "trust-graph",
  "title": "Reading the Trust Graph",
  "description": "How to interpret community trust graphs, your ego-network view, and fission visualizations.",
  "content": "# Reading the Trust Graph\n\n## Community Graph\n\nThe Community tab shows every member of your community arranged in a circle, grouped by how closely they're connected. Edges bundle together when they follow similar paths through the network — this is called hierarchical edge bundling.\n\n**What you see:**\n- Nodes on the circle are community members. Larger nodes have higher trust scores.\n- Thick, bright edges within a group mean strong, active relationships.\n- Thin, muted threads crossing between groups are weak connections — the ties that would break in a split.\n- **Amber edges** are your connections — every line touching your node.\n\n## My Network\n\nThe My Network tab centers the view on you. Your direct connections appear in the first ring, ordered by connection strength. Their connections appear in the second ring. No clicking required — two degrees of your network are visible immediately.\n\n## Fission View\n\nWhen a community proposes splitting, the fission graph shows the same hierarchical layout but with two clusters: the proposed Group A and Group B. Green edges are strong within-group connections. Red threads are cross-group connections — the relationships that span the proposed boundary.\n\n## What makes a strong connection?\n\nConnection strength is based on completed exchanges, endorsements, karma, and shared events — weighted by recency. A 6-month half-life means recent interactions count more than old ones."
}
```

- [ ] Check `scripts/generate-docs.ts` for `GUIDE_ORDER`, `GUIDE_LABELS`, `GUIDE_SLUGS` — add `trust-graph` entry to each if missing

- [ ] `cd apps/landing && npm run generate-docs`

- [ ] Grep-verify `trust-graph` appears in the regenerated `nav.json`; re-apply if missing

- [ ] `git add -f apps/landing/src/data/docs/`

---

## Task 10: CONTEXT.md + registry.json + TDD test + version bump

**Files:**
- Modify: `services/social-graph-service/CONTEXT.md`
- Modify: `services/registry.json`
- Create: `services/social-graph-service/tests/tdd/sprint-74-trust-graph-full.test.ts`
- Modify: `package.json` (root) — 10.2.0 → 10.3.0
- Modify: `tests/regression/version.test.ts` — assert 10.3.0

- [ ] Add to `services/social-graph-service/CONTEXT.md` under API Endpoints:
  ```
  GET /trust/graph/:communityId/full — Full community trust graph (up to 150 members + all inter-member edges)
  ```

- [ ] Add to `services/registry.json` social-graph-service `apis.provides`:
  ```json
  { "method": "GET", "path": "/trust/graph/:communityId/full", "description": "Full community trust graph — up to 150 members ranked by trust score with all inter-member edges" }
  ```

- [ ] Bump root `package.json` `10.2.0` → `10.3.0`

- [ ] Update `tests/regression/version.test.ts` to assert `10.3.0`

- [ ] Create TDD test `services/social-graph-service/tests/tdd/sprint-74-trust-graph-full.test.ts`:

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));

import { pool } from '../../src/config/database';
import { getFullCommunityGraph } from '../../src/database/trustEdgeDb';

const mockPool = pool as jest.Mocked<typeof pool>;

describe('getFullCommunityGraph', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns parsed nodes and links', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [
        { id: 'ua', name: 'Alice', trust_score: '10', karma: '50', is_current_user: true },
        { id: 'ub', name: 'Bob',   trust_score: '8',  karma: '30', is_current_user: false },
      ]})
      .mockResolvedValueOnce({ rows: [
        { source: 'ua', target: 'ub', raw_weight: '5', effective_weight: '4.2' }
      ]});

    const result = await getFullCommunityGraph('comm-1', 'ua');

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0]).toMatchObject({ id: 'ua', trust_score: 10, isCurrentUser: true });
    expect(result.links[0]).toMatchObject({ source: 'ua', target: 'ub', effective_weight: 4.2 });
  });

  it('passes communityId and callingUserId to both queries', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValue({ rows: [] });

    await getFullCommunityGraph('comm-1', 'user-z');

    const calls = (mockPool.query as jest.Mock).mock.calls;
    expect(calls[0][1]).toEqual(['comm-1', 'user-z']);
    expect(calls[1][1]).toEqual(['comm-1', 'user-z']);
  });
});
```

- [ ] `cd services/social-graph-service && npx jest tests/tdd/sprint-74-trust-graph-full.test.ts`

---

## Task 11: Type check + full test suite

- [ ] TypeScript check:
```bash
cd services/social-graph-service && npx tsc --noEmit
cd apps/frontend && npx tsc --noEmit
```

- [ ] Full test suite:
```bash
npm test
```
163+ unit + regression tests must pass.

- [ ] TDD suite:
```bash
npm run test:tdd
```
New sprint-74 test must pass. Pre-existing failures (listed in handoff) are unchanged — do not fix them.

- [ ] Docs check:
```bash
npm run feedback:check
```

---

## Task 12: Merge + Deploy

- [ ] Use the `/deploy` skill.

```bash
git add -A
git commit -m "feat(trust-graph): Sprint 74 — HEB community graph, radial ego view, v10.3.0"
git push origin feature/sprint-74-trust-graph-foundation
```
