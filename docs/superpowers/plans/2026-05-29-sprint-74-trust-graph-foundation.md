# Trust Graph Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace click-heavy ego-network with a full community graph (all members + edges, no expansion) and a smarter ego-view that pre-loads 2 degrees — making trust graphs immediately readable and useful.

**Architecture:** New `GET /trust/graph/:communityId/full` endpoint in social-graph-service returns up to 150 members and all their edges. Frontend TrustGraphTab switches to this full-graph view as the default, with edge weight driving visual thickness/opacity and amber highlights marking the current user's connections.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, react-force-graph-2d.

---

## File Map

### New files to create
| File | Responsibility |
|------|----------------|
| `services/social-graph-service/tests/tdd/sprint-74-trust-graph-full.test.ts` | TDD integration test for new endpoint |

### Existing files to modify
| File | Change |
|------|--------|
| `services/social-graph-service/src/database/trustEdgeDb.ts` | Add `getFullCommunityGraph()` |
| `services/social-graph-service/src/routes/trustGraph.ts` | Add `GET /trust/graph/:communityId/full` route (before existing param route) |
| `apps/frontend/src/lib/api.ts` | Add `getFullCommunityGraph()` to `socialGraphService` |
| `apps/frontend/src/components/TrustGraph.tsx` | Visual encoding overhaul — mode prop, edge weight, highlight layer, screen space |
| `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx` | Switch to full graph endpoint, add Community / My Network sub-tabs |
| `apps/frontend/src/components/NetworkGraph.tsx` | Screen space improvements, ego pre-load |
| `apps/landing/src/data/docs/guides/trust-graph.json` | Create/update trust graph user guide |
| `apps/landing/src/data/docs/concepts/trust-graph.json` | Update concept page — community topology section |
| `apps/landing/src/data/docs/nav.json` | Add guide entry if new |
| `scripts/generate-docs.ts` | Add trust-graph slug to GUIDE_ORDER + GUIDE_LABELS + GUIDE_SLUGS |
| `services/social-graph-service/CONTEXT.md` | Document new endpoint |
| `services/registry.json` | Add endpoint to social-graph-service apis.provides |
| `package.json` (root) | Bump 10.2.0 → 10.3.0 |
| `tests/regression/version.test.ts` | Update version invariant to 10.3.0 |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Route order matters**: Register `GET /trust/graph/:communityId/full` BEFORE `GET /trust/graph/:communityId`. Express matches params greedily — "full" will be treated as a communityId if registered second.

2. **trust_edges_live is a VIEW**: Never INSERT or UPDATE it. Write to `trust_edges`, read from `trust_edges_live` (which applies time decay via `current_weight`).

3. **Calling user always included**: The 150-node cap is implemented as `top 149 by trust_score UNION calling_user_uuid`. Do not drop the UNION or the current user may disappear from their own community graph.

4. **Edge weight normalization is client-side**: `maxEffectiveWeight` is computed from the response payload — `Math.max(...links.map(l => l.effective_weight))`. Do not assume a fixed max.

5. **react-force-graph-2d APIs**: Edge color → `linkColor` prop as a function. Edge width → `linkWidth` as a function. Node size → `nodeVal` prop. Node color → `nodeColor` prop. All are functions receiving the node/link object.

6. **Landing docs gitignored**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f` those files.

7. **nav.json revert bug**: `generate-docs.ts` regenerates nav.json. New slugs must be in `GUIDE_ORDER`, `GUIDE_LABELS`, `GUIDE_SLUGS` before running `npm run generate-docs`. Run from `apps/landing/`, not root.

8. **trust_edges normalized constraint**: `user_id_a::text < user_id_b::text`. Edges query reads from `trust_edges_live` which already enforces this — no re-sorting needed in the new query.

---

## Task 1: Feature branch + full community graph DB query

**Files:**
- Modify: `services/social-graph-service/src/database/trustEdgeDb.ts`

- [ ] Check out branch: `git checkout -b feature/sprint-74-trust-graph-foundation`

- [ ] Add `getFullCommunityGraph(communityId, callingUserId)` to `trustEdgeDb.ts`:

```typescript
export async function getFullCommunityGraph(
  communityId: string,
  callingUserId: string
): Promise<{ nodes: TrustNode[]; links: TrustLink[] }> {
  const nodesQuery = `
    WITH active_members AS (
      SELECT user_id FROM communities.members
      WHERE community_id = $1 AND status = 'active'
    ),
    member_scores AS (
      SELECT
        am.user_id,
        COALESCE(SUM(tel.current_weight), 0) AS trust_score
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
    SELECT
      u.id, u.name,
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
    WITH active_members AS (
      SELECT user_id FROM communities.members
      WHERE community_id = $1 AND status = 'active'
    ),
    member_scores AS (
      SELECT
        am.user_id,
        COALESCE(SUM(tel.current_weight), 0) AS trust_score
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
    SELECT
      tel.user_id_a AS source,
      tel.user_id_b AS target,
      tel.raw_weight,
      tel.current_weight AS effective_weight
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
      id: r.id,
      name: r.name,
      trust_score: parseFloat(r.trust_score) || 0,
      karma: parseFloat(r.karma) || 0,
      isCurrentUser: r.is_current_user,
    })),
    links: edgesResult.rows.map(r => ({
      source: r.source,
      target: r.target,
      raw_weight: parseFloat(r.raw_weight) || 0,
      effective_weight: parseFloat(r.effective_weight) || 0,
    })),
  };
}
```

- [ ] **Verification**: Function compiles — `cd services/social-graph-service && npx tsc --noEmit`

---

## Task 2: Backend route — GET /trust/graph/:communityId/full

**Files:**
- Modify: `services/social-graph-service/src/routes/trustGraph.ts`

- [ ] Import `getFullCommunityGraph` from `trustEdgeDb`

- [ ] Register the new route **before** the existing `router.get('/:communityId', ...)` handler:

```typescript
// Full community graph — MUST be before /:communityId route
router.get('/:communityId/full', authenticateToken, async (req, res) => {
  const { communityId } = req.params;
  const callingUserId = req.user!.userId;

  // Verify community membership
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

- [ ] **Verification**: `curl -H "Authorization: Bearer <token>" http://localhost:3010/trust/graph/<communityId>/full` returns `{ success: true, data: { nodes: [...], links: [...] } }`

---

## Task 3: API client

**Files:**
- Modify: `apps/frontend/src/lib/api.ts`

- [ ] Add to `socialGraphService` object:

```typescript
getFullCommunityGraph: (communityId: string) =>
  api.get(`/social-graph/trust/graph/${communityId}/full`),
```

- [ ] **Verification**: TypeScript compiles — `cd apps/frontend && npx tsc --noEmit`

---

## Task 4: TrustGraph.tsx — visual encoding overhaul

**Files:**
- Modify: `apps/frontend/src/components/TrustGraph.tsx`

- [ ] Add `'community'` to the `mode` prop type: `mode: 'ego' | 'community' | 'fission'`

- [ ] Add `currentUserId?: string` prop (pass through for highlight layer)

- [ ] Compute `maxEffectiveWeight` from the links dataset:
```typescript
const maxEffectiveWeight = useMemo(
  () => Math.max(1, ...graphData.links.map((l: TrustLink) => l.effective_weight)),
  [graphData.links]
);
```

- [ ] Set `linkWidth` as a function:
```typescript
linkWidth={(link: TrustLink) => Math.max(1, Math.log1p(link.effective_weight) * 1.5)}
```

- [ ] Set `linkColor` as a function — amber for my edges, muted slate for others:
```typescript
linkColor={(link: TrustLink) => {
  const src = typeof link.source === 'object' ? (link.source as any).id : link.source;
  const tgt = typeof link.target === 'object' ? (link.target as any).id : link.target;
  return src === currentUserId || tgt === currentUserId
    ? 'rgba(251, 146, 60, 0.85)'
    : 'rgba(148, 163, 184, 0.45)';
}}
```

- [ ] Set `linkOpacity` (if supported, else fold into `linkColor` alpha)

- [ ] Set `nodeVal` as a function for node sizing:
```typescript
nodeVal={(node: TrustNode) =>
  node.isCurrentUser ? 22 : 5 + Math.min((node.trust_score || 0) / 10, 15)
}
```

- [ ] Set `nodeColor` — current user gets bright accent, others use trust-score-based shade

- [ ] In `community` mode: disable click-to-expand (no `onNodeClick` data fetch). Clicking a node recenters the simulation on that node without fetching new data.

- [ ] Increase default graph container height to 600px minimum in the component's outer div

- [ ] **Verification**: TrustGraph renders in Storybook or dev — no TypeScript errors

---

## Task 5: TrustGraphTab.tsx — Community / My Network sub-tabs

**Files:**
- Modify: `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx`

- [ ] Add a `subTab` state: `'community' | 'ego'`, defaulting to `'community'`

- [ ] Add a two-button toggle above the graph (e.g., `Community` | `My Network`)

- [ ] **Community sub-tab**: call `socialGraphService.getFullCommunityGraph(communityId)` on mount, render `<TrustGraph mode="community" currentUserId={userId} ... />`

- [ ] **My Network sub-tab**: call `socialGraphService.getTrustGraph(communityId)` on mount (no center param — loads caller's ego), render `<TrustGraph mode="ego" currentUserId={userId} ... />`. Remove click-to-expand behavior; clicking a node calls `getTrustGraph(communityId, nodeId)` to recenter.

- [ ] Update graph container div: `className="w-full min-h-[600px] h-[calc(100vh-320px)]"`

- [ ] **Verification**: Both sub-tabs load and render data in dev environment

---

## Task 6: NetworkGraph.tsx — screen space + ego pre-load

**Files:**
- Modify: `apps/frontend/src/components/NetworkGraph.tsx`

- [ ] Update container height to match TrustGraphTab pattern: `min-h-[600px]`

- [ ] On mount, load ego-network once (no waiting for user to click). The component currently loads on viewport intersection — keep that, but once loaded, show depth-1 + depth-2 connections without requiring expansion clicks.

- [ ] Apply the same `linkColor`, `linkWidth`, `nodeVal` visual encoding from Task 4 (extract shared constants or duplicate for now)

- [ ] **Verification**: NetworkGraph renders full ego-network on first load

---

## Task 7: User guides + landing page docs

**Files:**
- Modify/create: `apps/landing/src/data/docs/guides/trust-graph.json`
- Modify: `apps/landing/src/data/docs/concepts/trust-graph.json` (if exists, else create)
- Modify: `scripts/generate-docs.ts` (if trust-graph not yet in GUIDE_ORDER)
- Modify: `apps/landing/src/data/docs/nav.json`

- [ ] Create or update `guides/trust-graph.json`:
```json
{
  "slug": "trust-graph",
  "title": "Reading the Trust Graph",
  "description": "How to interpret community trust graphs and your ego-network view.",
  "content": "# Reading the Trust Graph\n\n## Community Graph\n\nThe Community tab shows all members of your community and every connection between them — up to 150 members ranked by trust score.\n\n**What you see:**\n- Each node is a community member. Larger nodes have higher trust scores.\n- Edges (lines) between nodes represent trust built through interactions — exchanges completed, endorsements given, karma awarded.\n- Thicker, more opaque edges mean stronger, more recent connections.\n- **Amber edges** are your connections — every line touching your node is highlighted so you can immediately see where you sit in the network.\n\n## My Network Tab\n\nThe My Network tab centers the view on you and pre-loads your 2-degree neighborhood — your direct connections and their connections. Click any node to recenter.\n\n## What makes a strong connection?\n\nConnection strength is based on interactions weighted by recency. A match completed last week counts more than one from a year ago. The platform applies a 6-month half-life so trust graphs reflect current relationships, not historical ones."
}
```

- [ ] Check if `trust-graph` is in `GUIDE_ORDER`, `GUIDE_LABELS`, `GUIDE_SLUGS` in `scripts/generate-docs.ts`. Add if missing.

- [ ] Run from `apps/landing/`: `npm run generate-docs`

- [ ] Verify nav.json has the trust-graph entry, re-apply if generate-docs reverted it

- [ ] `git add -f apps/landing/src/data/docs/` (gitignored directory)

---

## Task 8: CONTEXT.md + registry.json + TDD test

**Files:**
- Modify: `services/social-graph-service/CONTEXT.md`
- Modify: `services/registry.json`
- Create: `services/social-graph-service/tests/tdd/sprint-74-trust-graph-full.test.ts`
- Modify: `package.json` (root) — bump to 10.3.0
- Modify: `tests/regression/version.test.ts` — update invariant to 10.3.0

- [ ] Update `services/social-graph-service/CONTEXT.md` — add under API Endpoints:
  ```
  GET /trust/graph/:communityId/full — Full community graph (up to 150 members + all edges)
  ```

- [ ] Update `services/registry.json` — add to social-graph-service `apis.provides`:
  ```json
  {
    "method": "GET",
    "path": "/trust/graph/:communityId/full",
    "description": "Full community trust graph — up to 150 members ranked by trust score with all inter-member edges"
  }
  ```

- [ ] Bump root `package.json` version `10.2.0` → `10.3.0`

- [ ] Update `tests/regression/version.test.ts` to assert `10.3.0`

- [ ] Create `services/social-graph-service/tests/tdd/sprint-74-trust-graph-full.test.ts`:

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the database pool
jest.mock('../../src/config/database', () => ({
  pool: { query: jest.fn() }
}));

import { pool } from '../../src/config/database';
import { getFullCommunityGraph } from '../../src/database/trustEdgeDb';

const mockPool = pool as jest.Mocked<typeof pool>;

describe('getFullCommunityGraph', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns nodes and links for a community', async () => {
    const nodes = [
      { id: 'user-a', name: 'Alice', trust_score: '10', karma: '50', is_current_user: true },
      { id: 'user-b', name: 'Bob', trust_score: '8', karma: '30', is_current_user: false },
    ];
    const links = [
      { source: 'user-a', target: 'user-b', raw_weight: '5', effective_weight: '4.2' }
    ];

    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: nodes })   // nodes query
      .mockResolvedValueOnce({ rows: links });  // edges query

    const result = await getFullCommunityGraph('comm-1', 'user-a');

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0]).toMatchObject({
      id: 'user-a', name: 'Alice', trust_score: 10, karma: 50, isCurrentUser: true
    });
    expect(result.links).toHaveLength(1);
    expect(result.links[0]).toMatchObject({
      source: 'user-a', target: 'user-b', raw_weight: 5, effective_weight: 4.2
    });
  });

  it('always includes calling user even if outside top 149', async () => {
    // Verify both queries are called with the communityId and callingUserId params
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await getFullCommunityGraph('comm-1', 'user-z');

    const [nodesCall, edgesCall] = (mockPool.query as jest.Mock).mock.calls;
    expect(nodesCall[1]).toEqual(['comm-1', 'user-z']);
    expect(edgesCall[1]).toEqual(['comm-1', 'user-z']);
  });
});
```

- [ ] **Verification**: `cd services/social-graph-service && npx jest tests/tdd/sprint-74-trust-graph-full.test.ts`

---

## Task 9: Type check + full test suite

- [ ] TypeScript check across all modified packages:
```bash
cd services/social-graph-service && npx tsc --noEmit
cd apps/frontend && npx tsc --noEmit
```

- [ ] Run full test suite:
```bash
npm test
```
All unit + regression tests must pass (163+ tests green).

- [ ] Run TDD suite — new test must pass:
```bash
npm run test:tdd
```

- [ ] Run feedback check:
```bash
npm run feedback:check
```

- [ ] **Verification**: All commands exit 0. No new failures beyond the pre-existing known TDD failures listed in the handoff.

---

## Task 10: Merge + Deploy

- [ ] Use the `/deploy` skill to merge and deploy.

```bash
git add -A
git commit -m "feat(trust-graph): Sprint 74 — full community graph, visual encoding, v10.3.0"
git push origin feature/sprint-74-trust-graph-foundation
# Merge to master, push, monitor GitHub Actions
```
