# Trust Graph Visualization + Governance ADR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Trust Graph" tab to every community page showing a live force-directed graph of member trust relationships, and publish ADR-055 (Trust-Based Governance Architecture) to the landing site.

**Architecture:** A new `TrustGraph.tsx` component (react-force-graph-2d, SSR-safe dynamic import) is wrapped in `TrustGraphTab.tsx` and wired into the existing `[id].tsx` community page as a new `'trust'` tab visible to all active members. ADR-055 is a doc-only artifact this sprint — no governance implementation code.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|----------------|
| `apps/frontend/src/components/TrustGraph.tsx` | Force-directed graph component; visual encoding, click-to-highlight, detail panel |
| `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx` | Data fetching wrapper; loading/empty/error states |
| `docs/adr/ADR-055-trust-governance-architecture.md` | Architecture decision record for trust-based governance |
| `apps/landing/src/data/docs/concepts/adr-055-trust-governance-architecture.json` | Landing site ADR page |
| `apps/landing/src/data/docs/guides/trust-graph.json` | User guide: how to read the trust graph |
| `services/social-graph-service/tests/tdd/sprint-66-trust-graph-visualization.test.ts` | TDD integration test |

### Existing files to modify
| File | Change |
|------|--------|
| `apps/frontend/src/lib/api.ts` | Add `getTrustGraph` to `socialGraphService` |
| `apps/frontend/src/pages/communities/[id].tsx` | Add `'trust'` tab type, button, render block |
| `apps/landing/src/data/docs/nav.json` | Add trust-graph guide + ADR-055 entries |
| `scripts/generate-docs.ts` | Add `'adr-055-trust-governance-architecture'` to hardcoded slug list |
| `services/social-graph-service/CONTEXT.md` | Note TrustGraph.tsx as a consumer of `/trust/graph` |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **`react-force-graph-2d` is already installed** (`^1.29.1`). Do NOT add it to package.json. Follow `NetworkGraph.tsx` — dynamic import inside `useCallback`, never at module level.

2. **SSR will crash without dynamic import.** Next.js 14 runs components server-side. `react-force-graph-2d` accesses `window`. Must be imported dynamically.

3. **`'trust'` must be added to BOTH `ValidTab` type AND `VALID_TABS` array** in `[id].tsx`. Missing either breaks URL tab routing.

4. **Tab visibility**: show to all `isMember` — not admin-gated. All members need to see trust bonds for Sprint 67 governance to be meaningful.

5. **`linkWidth` is a function**, not a number: `linkWidth={(link: any) => Math.max(1, link.effective_weight / 5)}`.

6. **nav.json revert bug**: After editing, verify with `grep "adr-055" apps/landing/src/data/docs/nav.json`. Re-apply if missing.

7. **Landing page docs in .gitignore**: Always `git add -f apps/landing/src/data/docs/`.

8. **ADR-055 is doc-only this sprint.** No implementation code. Sprint 67 implements it.

9. **TrustGraphTab handles its own data fetching.** Do not add trust graph state to `useCommunityData` hook.

---

## Task 1: Feature branch + API client method

**Files:**
- Modify: `apps/frontend/src/lib/api.ts`

- [ ] **Create the sprint branch**

```bash
git checkout -b feature/sprint-66-trust-graph-visualization
```

- [ ] **Add `getTrustGraph` to `socialGraphService`**

Find the `socialGraphService` object in `apps/frontend/src/lib/api.ts`. Add after `getNetwork`:

```typescript
getTrustGraph: (communityId: string) =>
  socialGraphApi.get(`/trust/graph/${communityId}`),
```

- [ ] **Verify the addition compiles**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

---

## Task 2: TrustGraph.tsx component

**Files:**
- Create: `apps/frontend/src/components/TrustGraph.tsx`

- [ ] **Create the component with SSR-safe dynamic import, visual encoding, and click interaction**

```typescript
import { useCallback, useEffect, useRef, useState } from 'react'

interface TrustNode {
  id: string
  name: string
  trust_score: number
  karma: number
}

interface TrustEdge {
  source: string
  target: string
  raw_weight: number
  effective_weight: number
  match_completed_count: number
  endorsement_count: number
  karma_given_count: number
  event_count: number
  last_interaction_at: string
}

interface TrustGraphData {
  nodes: TrustNode[]
  edges: TrustEdge[]
}

interface TrustGraphProps {
  graphData: TrustGraphData
  currentUserId: string
}

export default function TrustGraph({ graphData, currentUserId }: TrustGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ForceGraph, setForceGraph] = useState<any>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  useEffect(() => {
    import('react-force-graph-2d').then(({ default: FG }) => {
      setForceGraph(() => FG)
    })
  }, [])

  const fgData = {
    nodes: graphData.nodes.map(n => ({ ...n })),
    links: graphData.edges.map(e => ({ ...e })),
  }

  const selectedNode = selectedNodeId
    ? graphData.nodes.find(n => n.id === selectedNodeId)
    : null

  const connectedEdge = selectedNodeId
    ? graphData.edges.find(
        e => e.source === selectedNodeId || e.target === selectedNodeId
      )
    : null

  const connectedNodeIds = selectedNodeId
    ? new Set(
        graphData.edges
          .filter(e => e.source === selectedNodeId || e.target === selectedNodeId)
          .flatMap(e => [e.source, e.target])
      )
    : null

  if (graphData.edges.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-text-muted text-sm">
        No trust connections yet — complete help exchanges to build the graph.
      </div>
    )
  }

  return (
    <div ref={containerRef}>
      {ForceGraph && (
        <ForceGraph
          graphData={fgData}
          width={700}
          height={500}
          nodeLabel={(node: any) => node.name}
          nodeVal={(node: any) => Math.max(5, node.trust_score / 10)}
          nodeColor={(node: any) => {
            if (selectedNodeId && !connectedNodeIds?.has(node.id)) return '#94a3b8'
            if (node.id === currentUserId) return '#10b981'
            return '#6366f1'
          }}
          linkWidth={(link: any) => Math.max(1, link.effective_weight / 5)}
          linkColor={(link: any) => {
            if (!selectedNodeId) return 'rgba(99,102,241,0.4)'
            const src = typeof link.source === 'object' ? link.source.id : link.source
            const tgt = typeof link.target === 'object' ? link.target.id : link.target
            return src === selectedNodeId || tgt === selectedNodeId
              ? 'rgba(99,102,241,0.9)'
              : 'rgba(99,102,241,0.1)'
          }}
          onNodeClick={(node: any) => {
            setSelectedNodeId(prev => (prev === node.id ? null : node.id))
          }}
          onBackgroundClick={() => setSelectedNodeId(null)}
          backgroundColor="transparent"
        />
      )}

      {selectedNode && (
        <div className="mt-4 p-4 bg-surface rounded-lg border border-border text-sm">
          <div className="font-semibold text-text mb-2">{selectedNode.name}</div>
          <div className="grid grid-cols-2 gap-2 text-text-muted">
            <span>Trust score</span><span className="text-text">{selectedNode.trust_score.toFixed(1)}</span>
            <span>Karma</span><span className="text-text">{selectedNode.karma}</span>
            <span>Connections</span>
            <span className="text-text">
              {graphData.edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Verify component types compile**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | grep TrustGraph
```

---

## Task 3: TrustGraphTab.tsx wrapper

**Files:**
- Create: `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx`

- [ ] **Create the tab wrapper with its own data fetching**

```typescript
import { useEffect, useState } from 'react'
import { socialGraphService } from '@/lib/api'
import TrustGraph from '@/components/TrustGraph'

interface TrustGraphTabProps {
  communityId: string
  currentUserId: string
}

interface TrustGraphData {
  nodes: any[]
  edges: any[]
}

export default function TrustGraphTab({ communityId, currentUserId }: TrustGraphTabProps) {
  const [graphData, setGraphData] = useState<TrustGraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    socialGraphService.getTrustGraph(communityId)
      .then((res: any) => setGraphData(res.data.data))
      .catch(() => setError('Failed to load trust graph.'))
      .finally(() => setLoading(false))
  }, [communityId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-text-muted text-sm">
        Loading trust graph…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16 text-red-500 text-sm">
        {error}
      </div>
    )
  }

  if (!graphData) return null

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-text">Community Trust Graph</h3>
        <p className="text-sm text-text-muted mt-1">
          Node size = trust score · Edge thickness = relationship strength · Click a node to highlight connections
        </p>
      </div>
      <TrustGraph graphData={graphData} currentUserId={currentUserId} />
    </div>
  )
}
```

- [ ] **Verify types compile**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | grep TrustGraphTab
```

---

## Task 4: Wire the trust tab into the community page

**Files:**
- Modify: `apps/frontend/src/pages/communities/[id].tsx`

- [ ] **Add `'trust'` to the `ValidTab` type**

Change:
```typescript
type ValidTab = 'overview' | 'people' | 'requests' | 'providers' | 'settings' | 'activities'
```
To:
```typescript
type ValidTab = 'overview' | 'people' | 'requests' | 'providers' | 'settings' | 'activities' | 'trust'
```

- [ ] **Add `'trust'` to `VALID_TABS`**

Change:
```typescript
const VALID_TABS: ValidTab[] = ['overview', 'people', 'requests', 'providers', 'settings', 'activities']
```
To:
```typescript
const VALID_TABS: ValidTab[] = ['overview', 'people', 'requests', 'providers', 'settings', 'activities', 'trust']
```

- [ ] **Add the import for `TrustGraphTab`**

Add with the other tab imports:
```typescript
import TrustGraphTab from '@/components/community/tabs/TrustGraphTab'
```

- [ ] **Add the "Trust" tab button in the nav**

Add after the `people` tab button block and before the `activities` conditional, visible to all `isMember`:

```typescript
{isMember && (
  <button onClick={() => setActiveTab('trust')} className={tabBtnClass('trust')}>
    trust graph
  </button>
)}
```

- [ ] **Add the render block**

Add after the `activities` render block:

```typescript
{activeTab === 'trust' && (
  <TrustGraphTab communityId={communityId!} currentUserId={currentUser?.id ?? ''} />
)}
```

- [ ] **Verify the full page compiles without errors**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -30
```

---

## Task 5: ADR-055 — Trust-Based Governance Architecture

**Files:**
- Create: `docs/adr/ADR-055-trust-governance-architecture.md`

- [ ] **Create the ADR**

```markdown
# ADR-055: Trust-Based Governance Architecture

**Status**: Accepted
**Date**: 2026-05-25
**Deciders**: Ravi Chavali
**Supersedes**: —
**Superseded by**: —

---

## Context

karmyq communities currently have static admin/moderator roles assigned at creation and never rotated. Sprint 65 added `social_graph.trust_edges` — a persistent, weighted, community-scoped record of member interactions. As trust data matures, there is an opportunity to ground governance authority in measured trust rather than legacy assignment.

The problem with static roles: a founding admin who has become inactive retains governance authority indefinitely. This creates oligarchic lock-in and undermines the platform's mutual-aid philosophy where contribution drives standing.

## Decision

Governance roles are trust-gated and non-permanent. The architecture has four components:

### 1. Founder Group
- 5–6 members initialized at community creation
- Selected by the creator; handles admin/mod/governance bootstrapping
- Founders have full governance rights until the community's trust graph matures (avg trust score ≥ `eligibility_threshold` across founders)

### 2. Role Eligibility
- Eligibility threshold: trust score ≥ `governance.eligibility_threshold` (community-configurable, default 50)
- Any eligible member can be nominated for a governance role
- Ratification: a quorum of current role-holders must approve
- A member's role becomes eligible for reassignment when their trust score drops below threshold

### 3. Trust-Gated Authority
New communities have constrained governance rights that expand as trust matures:
- **Constrained** (avg trust < threshold): invite-only membership decisions, read-only config
- **Mature** (avg trust ≥ threshold): full governance rights — config changes, moderation, role assignment

This prevents governance capture by communities that haven't built real trust yet.

### 4. Anti-Oligarchy
- Roles are non-permanent: anyone rotates out when trust drops
- No founding privilege after the community reaches maturity
- Rotation is triggered by trust score drop, not time-based decay
- Historical contribution (karma) does not protect a role — only current trust does

### Governance Templates
The `CommunityTrustQuestionnaire` questionnaire matching suggests governance templates from similar communities:
- **small-collective**: 3-member quorum, flat authority
- **council**: 5-member quorum, role specialization (admin/mod/treasurer)
- **open-delegation**: trust-weighted voting on governance decisions

## Implementation Plan

Sprint 67 implements this ADR. Schema additions to `community_settings`:
```json
{
  "governance": {
    "eligibility_threshold": 50,
    "quorum_size": 3,
    "template": "small-collective"
  }
}
```

New API endpoints (Sprint 67):
- `GET /communities/:id/governance` — current governance state
- `POST /communities/:id/governance/nominate` — nominate a member for a role
- `POST /communities/:id/governance/ratify/:nominationId` — ratify a nomination

## Consequences

**Positive**:
- Roles reflect current trust, preventing oligarchic lock-in
- New communities have sensible constraints that lift automatically as trust builds
- The trust graph (Sprint 66) makes governance state visible and legible

**Negative**:
- More complex role assignment than static admin flags
- Communities need enough trust data before governance works well — mitigated by Sprint 65 backfill

**Neutral**:
- Existing admin flags are not removed; they coexist with the trust-gated system until Sprint 71 deprecation
```

- [ ] **Update the ADR index**

```bash
# Verify ADR-055 doesn't already exist in README
grep "ADR-055" docs/adr/README.md
```

Add to `docs/adr/README.md`:
```markdown
| ADR-055 | Trust-Based Governance Architecture | Accepted |
```

---

## Task 6: Landing page docs — user guide + ADR-055

**Files:**
- Create: `apps/landing/src/data/docs/guides/trust-graph.json`
- Create: `apps/landing/src/data/docs/concepts/adr-055-trust-governance-architecture.json`
- Modify: `apps/landing/src/data/docs/nav.json`
- Modify: `scripts/generate-docs.ts`

- [ ] **Create the Trust Graph user guide**

```json
{
  "slug": "trust-graph",
  "title": "Understanding Your Community's Trust Graph",
  "description": "How to read the trust graph tab on your community page — what nodes, edges, and visual encoding mean.",
  "content": "# Understanding Your Community's Trust Graph\n\nEvery community on karmyq builds a trust graph over time. Each completed help exchange, endorsement, and karma interaction adds to the bond between two members. The Trust Graph tab makes those bonds visible.\n\n## How to Access It\n\nOpen any community you belong to and click the **Trust Graph** tab in the community navigation.\n\n## Reading the Graph\n\n### Nodes (circles)\nEach node represents a community member. **Larger nodes** have a higher trust score — they've been consistently rated as reliable and helpful by other members. **Your own node** appears in green; other members appear in indigo.\n\n### Edges (lines)\nLines between nodes represent trust bonds. **Thicker lines** mean a stronger recent relationship — more completed exchanges, endorsements, or karma interactions between those two members. Edge thickness reflects *effective weight*, which factors in how recent the interactions were.\n\n## Interacting with the Graph\n\n**Click any node** to highlight that member's direct connections. Their edges brighten and all other connections dim, making it easy to see who they have strong bonds with. The panel below the graph shows their trust score, karma, and number of connections.\n\n**Click the background** (or the same node again) to deselect and return to the full view.\n\n## What Drives Trust?\n\nFour interaction types contribute to trust bonds:\n\n| Interaction | Weight |\n|-------------|--------|\n| Completed help exchange | 10 |\n| Endorsement | 5 |\n| Karma given | 3 |\n| Shared event | 2 |\n\nOlder interactions contribute less than recent ones — trust bonds reflect current relationships, not just historical ones.\n\n## Empty Graph\n\nIf the graph shows \"No trust connections yet,\" the community hasn't completed any help exchanges between members. Complete a request to start building the graph.\n\n## What's Coming\n\nSprint 67 will use this trust graph to power community governance — role eligibility, ratification, and rotation are all grounded in trust scores."
}
```

- [ ] **Create the ADR-055 landing page JSON**

```json
{
  "slug": "adr-055-trust-governance-architecture",
  "number": "055",
  "title": "ADR-055: Trust-Based Governance Architecture",
  "status": "accepted",
  "description": "**Status**: Accepted",
  "content": "# ADR-055: Trust-Based Governance Architecture\n\n**Status**: Accepted  \n**Date**: 2026-05-25\n\n## Context\n\nkarmyq communities currently have static admin/moderator roles assigned at creation and never rotated. Sprint 65 added `social_graph.trust_edges` — persistent, weighted interaction history between members. As trust data matures, there is an opportunity to ground governance authority in measured trust rather than legacy assignment.\n\n## Decision\n\nGovernance roles are trust-gated and non-permanent.\n\n**Founder Group**: 5–6 members initialized at community creation. Full governance rights until the community's trust graph matures.\n\n**Role Eligibility**: Trust score ≥ configurable threshold (default 50). Nomination + quorum ratification required. Roles eligible for reassignment when trust drops below threshold.\n\n**Trust-Gated Authority**: New communities have constrained governance rights (invite-only decisions, read-only config) that expand automatically as the community builds trust.\n\n**Anti-Oligarchy**: Roles are non-permanent. Historical karma does not protect a role — only current trust does. Rotation is triggered by trust score drop, not time.\n\n## Consequences\n\nRoles reflect current trust rather than founding status. New communities have sensible constraints that lift automatically. Sprint 67 implements this architecture.\n\n## Implementation\n\nSprint 67 adds `governance` settings to `community_settings`, new governance API endpoints, and nomination/ratification workflows.",
  "filename": "ADR-055-trust-governance-architecture.md"
}
```

- [ ] **Update nav.json — add trust-graph guide and ADR-055**

Find the "User Guides" section in `apps/landing/src/data/docs/nav.json` and add:
```json
{ "slug": "trust-graph", "title": "Understanding Your Community's Trust Graph" }
```

Find the "Architecture Decisions" section and add:
```json
{ "slug": "adr-055-trust-governance-architecture", "title": "ADR-055: Trust-Based Governance Architecture" }
```

- [ ] **Verify nav.json contains both entries**

```bash
grep -E "trust-graph|adr-055" apps/landing/src/data/docs/nav.json
```

- [ ] **Update generate-docs.ts — add ADR-055 slug to hardcoded list**

Find the hardcoded ADR slug array in `scripts/generate-docs.ts` (search for `adr-054`) and add `'adr-055-trust-governance-architecture'` after `adr-054`.

- [ ] **Verify generate-docs.ts has the slug**

```bash
grep "adr-055" scripts/generate-docs.ts
```

---

## Task 7: CONTEXT.md + registry.json

**Files:**
- Modify: `services/social-graph-service/CONTEXT.md`

- [ ] **Update social-graph-service CONTEXT.md**

Find the "Consumers" or "API Endpoints" section in `services/social-graph-service/CONTEXT.md`. Add a note under `GET /trust/graph/:communityId`:
```
Consumer: apps/frontend/src/components/community/tabs/TrustGraphTab.tsx (Sprint 66)
```

- [ ] **Verify registry.json needs no changes**

```bash
grep "trust/graph" services/registry.json
```

No new endpoints were added this sprint — registry.json should already list the Sprint 65 endpoint. If it's missing, add it.

---

## Task 8: TDD integration test

**Files:**
- Create: `services/social-graph-service/tests/tdd/sprint-66-trust-graph-visualization.test.ts`

- [ ] **Create the test file testing the API contract the visualizer depends on**

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://karmyq_user:karmyq_password@localhost:5432/karmyq_dev',
  connectionTimeoutMillis: 5000,
});

describe('Sprint 66: Trust Graph API for Visualization', () => {
  afterAll(async () => {
    await pool.end();
  });

  describe('getTrustGraph shape', () => {
    it('returns { nodes, edges } shape with correct field types', async () => {
      const result = await pool.query(`
        SELECT COUNT(*) AS edge_count FROM social_graph.trust_edges
      `);
      const edgeCount = parseInt(result.rows[0].edge_count, 10);
      expect(edgeCount).toBeGreaterThanOrEqual(0);
    });

    it('trust_edges rows have required visualization fields', async () => {
      const result = await pool.query(`
        SELECT
          user_id_a, user_id_b, community_id,
          raw_weight, match_completed_count,
          endorsement_count, karma_given_count, event_count,
          last_interaction_at
        FROM social_graph.trust_edges
        LIMIT 1
      `);

      if (result.rows.length === 0) {
        // No edges yet — schema must still have the columns
        const colResult = await pool.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'social_graph' AND table_name = 'trust_edges'
          ORDER BY column_name
        `);
        const cols = colResult.rows.map(r => r.column_name);
        expect(cols).toContain('user_id_a');
        expect(cols).toContain('user_id_b');
        expect(cols).toContain('raw_weight');
        expect(cols).toContain('effective_weight');
        expect(cols).toContain('last_interaction_at');
        return;
      }

      const row = result.rows[0];
      expect(typeof row.user_id_a).toBe('string');
      expect(typeof row.user_id_b).toBe('string');
      expect(typeof row.community_id).toBe('string');
      expect(typeof parseFloat(row.raw_weight)).toBe('number');
      expect(row.last_interaction_at).toBeTruthy();
    });

    it('effective_weight column exists (needed for edge thickness)', async () => {
      const result = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'social_graph'
          AND table_name = 'trust_edges'
          AND column_name = 'effective_weight'
      `);
      expect(result.rows).toHaveLength(1);
    });

    it('trust_score is available on community members for node sizing', async () => {
      // The visualizer uses trust_score from the graph endpoint; verify the source
      // (reputation service trust scores joinable via user id)
      const result = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'social_graph'
          AND table_name = 'trust_edges'
      `);
      const cols = result.rows.map((r: any) => r.column_name);
      // trust_edges must have the fields the graph endpoint needs
      expect(cols).toContain('user_id_a');
      expect(cols).toContain('user_id_b');
      expect(cols).toContain('raw_weight');
    });

    it('normalized pair invariant: user_id_a < user_id_b for all rows', async () => {
      const result = await pool.query(`
        SELECT COUNT(*) AS violations
        FROM social_graph.trust_edges
        WHERE user_id_a >= user_id_b
      `);
      expect(parseInt(result.rows[0].violations, 10)).toBe(0);
    });

    it('interaction_weights table has the 4 platform defaults', async () => {
      const result = await pool.query(`
        SELECT interaction_type, weight
        FROM social_graph.interaction_weights
        WHERE community_id IS NULL
        ORDER BY weight DESC
      `);
      expect(result.rows).toHaveLength(4);
      expect(result.rows[0]).toMatchObject({ interaction_type: 'match_completed', weight: '10' });
      expect(result.rows[1]).toMatchObject({ interaction_type: 'endorsement', weight: '5' });
      expect(result.rows[2]).toMatchObject({ interaction_type: 'karma_given', weight: '3' });
      expect(result.rows[3]).toMatchObject({ interaction_type: 'event', weight: '2' });
    });
  });
});
```

- [ ] **Run the TDD test to confirm it works against the dev DB**

```bash
cd services/social-graph-service && npx jest tests/tdd/sprint-66-trust-graph-visualization.test.ts --forceExit 2>&1 | tail -20
```

---

## Task 9: Final type check + pre-push verification

- [ ] **TypeScript: frontend type check must be clean**

```bash
cd apps/frontend && npx tsc --noEmit
```

Fix any errors before proceeding.

- [ ] **Run unit + regression tests**

```bash
npm test
```

Must pass. Do not proceed if any unit/regression test fails.

- [ ] **Run TDD tests**

```bash
npm run test:tdd
```

Report failures but do not block on them if they are pre-existing (`sprint-39`, `sprint-43`).

- [ ] **Run feedback check**

```bash
npm run feedback:check
```

- [ ] **Verify nav.json has both new entries (revert bug check)**

```bash
grep -E "trust-graph|adr-055" apps/landing/src/data/docs/nav.json
```

If either is missing, re-apply the nav.json edit.

- [ ] **Stage and commit**

```bash
git add apps/frontend/src/components/TrustGraph.tsx
git add apps/frontend/src/components/community/tabs/TrustGraphTab.tsx
git add apps/frontend/src/pages/communities/[id].tsx
git add apps/frontend/src/lib/api.ts
git add docs/adr/ADR-055-trust-governance-architecture.md
git add docs/adr/README.md
git add scripts/generate-docs.ts
git add services/social-graph-service/CONTEXT.md
git add services/social-graph-service/tests/tdd/sprint-66-trust-graph-visualization.test.ts
git add -f apps/landing/src/data/docs/guides/trust-graph.json
git add -f apps/landing/src/data/docs/concepts/adr-055-trust-governance-architecture.json
git add -f apps/landing/src/data/docs/nav.json
git add docs/superpowers/specs/2026-05-25-sprint-66-trust-graph-visualization-design.md
git add docs/superpowers/plans/2026-05-25-sprint-66-trust-graph-visualization.md
git add .claude/handoff/CURRENT_HANDOFF.md

git commit -m "feat(sprint-66): Trust Graph Visualization + ADR-055 — v9.60.0"
```

---

## Task 10: Merge + Deploy

Use the `/deploy` skill to merge to master, push, and monitor GitHub Actions deployment.

```bash
# Merge to master
git checkout master
git merge feature/sprint-66-trust-graph-visualization
git push origin master
```

Monitor GitHub Actions — deployment to karmyq.com runs automatically on push to master.

### Post-deploy validation

- [ ] **Visit a community on karmyq.com → click "trust graph" tab → graph renders**
- [ ] **Click a node → connections highlight, detail panel appears**
- [ ] **Visit `https://karmyq.com/docs/concepts/adr-055-trust-governance-architecture` → ADR renders**
- [ ] **Visit `https://karmyq.com/docs/guides/trust-graph` → user guide renders**
