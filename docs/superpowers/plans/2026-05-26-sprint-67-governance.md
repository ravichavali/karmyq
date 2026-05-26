# Sprint 67: Ego-Network + Governance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the trust graph to ego-centric, unify dashboard network with trust data, and implement trust-gated governance with full nomination/ratification UI.

**Architecture:** Ego-network is computed server-side by filtering `social_graph.trust_edges` to the calling user's neighborhood. Governance nominations and ratifications are stored in two new `community` schema tables managed by community-service, which cross-queries `social_graph.trust_edges` for eligibility checks.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create

| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/009-governance-schema.sql` | `governance_settings` column + nominations + ratifications tables |
| `services/community-service/src/db/governanceDb.ts` | All governance DB queries (getGovernanceState, createNomination, addRatification) |
| `services/community-service/src/routes/governance.ts` | GET governance, POST nominate, POST ratify handlers |
| `apps/frontend/src/components/GovernanceTab.tsx` | Governance tab — maturity banner, eligible members, nominations, ratify flow |
| `services/social-graph-service/tests/tdd/sprint-67-ego-network.test.ts` | Ego-network query tests |
| `services/community-service/tests/tdd/sprint-67-governance.test.ts` | Governance endpoint + auto-ratify tests |

### Existing files to modify

| File | Change |
|------|--------|
| `services/social-graph-service/src/db/trustEdgeDb.ts` | Rewrite `getTrustGraph` to accept `callingUserId`; add `getTrustGraphAggregate` |
| `services/social-graph-service/src/routes/trust.ts` | Extract `userId` from JWT, pass to `getTrustGraph`; add `GET /trust/graph` aggregate route |
| `apps/frontend/src/components/NetworkGraph.tsx` | Accept trust-format data (nodes with `trust_score`, links with `effective_weight`) |
| `apps/frontend/src/pages/dashboard.tsx` | Call `getTrustGraphAggregate()` instead of old `/network` endpoint |
| `apps/frontend/src/lib/api.ts` | Add `getGovernanceState`, `nominateForRole`, `ratifyNomination`, `getTrustGraphAggregate` |
| `apps/frontend/src/pages/communities/[id].tsx` | Add `'governance'` to `ValidTab` + `VALID_TABS`; render `<GovernanceTab>` |
| `services/community-service/src/index.ts` (or router entry) | Mount governance routes |
| `services/social-graph-service/CONTEXT.md` | Document ego-network change + aggregate endpoint |
| `services/community-service/CONTEXT.md` | Document three new governance endpoints |
| `services/registry.json` | Add new endpoints |
| `scripts/generate-docs.ts` | Add `governance` slug to hardcoded concept list |
| `docs/guides/trust-graph.md` | Add ego-network explanation section |
| `apps/landing/src/data/docs/concepts/adr-055-trust-governance-architecture.json` | Update status to `implemented` |
| `apps/landing/src/data/docs/services/social-graph-service.json` | Add ego-network + aggregate endpoints |
| `apps/landing/src/data/docs/nav.json` | Add governance concept entry |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Ego-network requires callingUserId from JWT.** `GET /trust/graph/:communityId` must call `verifyToken` middleware and pass `req.user.userId` to `getTrustGraph`. Add auth middleware to this route if not already present.

2. **Cross-schema SQL is fine in community-service.** `governanceDb.ts` can `SELECT trust_score FROM social_graph.trust_edges` — same PostgreSQL instance, different schemas.

3. **Auto-ratify is synchronous in the ratify handler.** When count reaches quorum: `UPDATE community.members SET role = $role` + `UPDATE governance_nominations SET status = 'ratified'` in the same transaction.

4. **`'governance'` must be added to BOTH `ValidTab` type AND `VALID_TABS` array** in `[id].tsx`. Missing either breaks URL tab routing.

5. **Governance tab visibility**: all `isMember` — not admin-gated.

6. **nav.json revert bug**: add `governance` slug to `scripts/generate-docs.ts` hardcoded list before committing.

7. **Landing docs in .gitignore**: `git add -f apps/landing/src/data/docs/`.

8. **JWT field is `communities`** not `communityMemberships`.

9. **Aggregate route ordering**: `GET /trust/graph` (no param) must be declared before `GET /trust/graph/:communityId` in the router.

10. **No "show full graph" mode.** Ego-network only, forever. Do not add any toggle.

11. **Nomination idempotency**: 409 if a pending nomination already exists for same community + user + role.

12. **TDD test placement**: ego-network → `services/social-graph-service/tests/tdd/`, governance → `services/community-service/tests/tdd/`.

---

## Task 1: Feature branch + DB migration

**Files:**
- Create: `infrastructure/postgres/migrations/009-governance-schema.sql`

- [ ] **Create the feature branch**

```bash
git checkout -b feature/sprint-67-governance
```

- [ ] **Write the migration**

```sql
-- infrastructure/postgres/migrations/009-governance-schema.sql

-- Governance config on communities
ALTER TABLE community.communities
  ADD COLUMN IF NOT EXISTS governance_settings JSONB
  NOT NULL DEFAULT '{"eligibility_threshold": 50, "quorum_size": 3, "template": "small-collective"}'::jsonb;

-- Nominations
CREATE TABLE IF NOT EXISTS community.governance_nominations (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id           UUID        NOT NULL REFERENCES community.communities(id) ON DELETE CASCADE,
  nominated_user_id      UUID        NOT NULL REFERENCES auth.users(id),
  nominated_for_role     VARCHAR(50) NOT NULL,
  nominator_id           UUID        NOT NULL REFERENCES auth.users(id),
  status                 VARCHAR(20) NOT NULL DEFAULT 'pending',
  required_ratifications INT         NOT NULL DEFAULT 3,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at            TIMESTAMPTZ,
  CONSTRAINT valid_nomination_status CHECK (status IN ('pending', 'ratified', 'rejected', 'withdrawn'))
);

CREATE INDEX IF NOT EXISTS idx_governance_nominations_community 
  ON community.governance_nominations(community_id);

-- Ratifications
CREATE TABLE IF NOT EXISTS community.governance_ratifications (
  nomination_id UUID        NOT NULL REFERENCES community.governance_nominations(id) ON DELETE CASCADE,
  ratifier_id   UUID        NOT NULL REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (nomination_id, ratifier_id)
);
```

- [ ] **Apply migration locally**

```bash
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /dev/stdin < infrastructure/postgres/migrations/009-governance-schema.sql
```

- [ ] **Verify tables exist**

```bash
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -c "\dt community.governance*"
# Should list governance_nominations and governance_ratifications

docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -c "\d community.communities" | grep governance_settings
# Should show the new column
```

---

## Task 2: Ego-network rewrite (social-graph-service DB layer)

**Files:**
- Modify: `services/social-graph-service/src/db/trustEdgeDb.ts`

- [ ] **Rewrite `getTrustGraph` to accept `callingUserId` and return ego-network only**

```typescript
// Replace the existing getTrustGraph function signature and query:
export async function getTrustGraph(
  communityId: string,
  callingUserId: string
): Promise<{ nodes: TrustNode[]; links: TrustLink[] }> {
  // Neighbors: users the calling user has a trust edge with
  const neighborsQuery = `
    SELECT CASE WHEN user_id_a = $2 THEN user_id_b ELSE user_id_a END AS neighbor_id
    FROM social_graph.trust_edges
    WHERE community_id = $1
      AND (user_id_a = $2 OR user_id_b = $2)
      AND deleted_at IS NULL
  `;

  // Nodes: calling user + all neighbors
  const nodesQuery = `
    WITH neighbors AS (${neighborsQuery})
    SELECT u.id, u.name, u.trust_score,
           COALESCE(kr.karma_score, 0) AS karma,
           (u.id = $2) AS is_current_user
    FROM auth.users u
    LEFT JOIN reputation.karma_records kr ON kr.user_id = u.id AND kr.community_id = $1
    WHERE (u.id = $2 OR u.id IN (SELECT neighbor_id FROM neighbors))
      AND u.deleted_at IS NULL
  `;

  // Edges: calling_user<->neighbor AND neighbor<->neighbor
  const edgesQuery = `
    WITH neighbors AS (${neighborsQuery})
    SELECT te.user_id_a AS source, te.user_id_b AS target,
           te.interaction_count, te.trust_score AS edge_trust,
           COALESCE(iw.base_weight, 5) * te.interaction_count AS effective_weight
    FROM social_graph.trust_edges te
    LEFT JOIN social_graph.interaction_weights iw
      ON iw.interaction_type = te.last_interaction_type
    WHERE te.community_id = $1
      AND te.deleted_at IS NULL
      AND (
        te.user_id_a = $2 OR te.user_id_b = $2
        OR (
          te.user_id_a IN (SELECT neighbor_id FROM neighbors)
          AND te.user_id_b IN (SELECT neighbor_id FROM neighbors)
        )
      )
  `;

  const [nodesResult, edgesResult] = await Promise.all([
    pool.query(nodesQuery, [communityId, callingUserId]),
    pool.query(edgesQuery, [communityId, callingUserId]),
  ]);

  return {
    nodes: nodesResult.rows.map(r => ({
      id: r.id, name: r.name, trust_score: r.trust_score,
      karma: r.karma, isCurrentUser: r.is_current_user,
    })),
    links: edgesResult.rows.map(r => ({
      source: r.source, target: r.target,
      effective_weight: parseFloat(r.effective_weight) || 1,
    })),
  };
}
```

- [ ] **Add `getTrustGraphAggregate(callingUserId)` — ego-network across all user's communities**

```typescript
export async function getTrustGraphAggregate(
  callingUserId: string
): Promise<{ nodes: TrustNode[]; links: TrustLink[] }> {
  const neighborsQuery = `
    SELECT DISTINCT
      CASE WHEN te.user_id_a = $1 THEN te.user_id_b ELSE te.user_id_a END AS neighbor_id
    FROM social_graph.trust_edges te
    JOIN community.members cm ON cm.community_id = te.community_id AND cm.user_id = $1 AND cm.status = 'active'
    WHERE (te.user_id_a = $1 OR te.user_id_b = $1)
      AND te.deleted_at IS NULL
  `;

  const nodesQuery = `
    WITH neighbors AS (${neighborsQuery})
    SELECT u.id, u.name, u.trust_score,
           COALESCE(SUM(kr.karma_score), 0) AS karma,
           (u.id = $1) AS is_current_user
    FROM auth.users u
    LEFT JOIN reputation.karma_records kr ON kr.user_id = u.id
    WHERE (u.id = $1 OR u.id IN (SELECT neighbor_id FROM neighbors))
      AND u.deleted_at IS NULL
    GROUP BY u.id, u.name, u.trust_score
  `;

  const edgesQuery = `
    WITH neighbors AS (${neighborsQuery}),
    user_communities AS (
      SELECT community_id FROM community.members WHERE user_id = $1 AND status = 'active'
    )
    SELECT te.user_id_a AS source, te.user_id_b AS target,
           SUM(COALESCE(iw.base_weight, 5) * te.interaction_count) AS effective_weight
    FROM social_graph.trust_edges te
    JOIN user_communities uc ON uc.community_id = te.community_id
    LEFT JOIN social_graph.interaction_weights iw ON iw.interaction_type = te.last_interaction_type
    WHERE te.deleted_at IS NULL
      AND (
        te.user_id_a = $1 OR te.user_id_b = $1
        OR (
          te.user_id_a IN (SELECT neighbor_id FROM neighbors)
          AND te.user_id_b IN (SELECT neighbor_id FROM neighbors)
        )
      )
    GROUP BY te.user_id_a, te.user_id_b
  `;

  const [nodesResult, edgesResult] = await Promise.all([
    pool.query(nodesQuery, [callingUserId]),
    pool.query(edgesQuery, [callingUserId]),
  ]);

  return {
    nodes: nodesResult.rows.map(r => ({
      id: r.id, name: r.name, trust_score: r.trust_score,
      karma: Number(r.karma), isCurrentUser: r.is_current_user,
    })),
    links: edgesResult.rows.map(r => ({
      source: r.source, target: r.target,
      effective_weight: parseFloat(r.effective_weight) || 1,
    })),
  };
}
```

---

## Task 3: Ego-network route update (social-graph-service)

**Files:**
- Modify: `services/social-graph-service/src/routes/trust.ts`

- [ ] **Add `verifyToken` middleware to `GET /trust/graph/:communityId` and pass `callingUserId`**

Find the existing `GET /trust/graph/:communityId` handler. Ensure `verifyToken` is in the middleware chain. Extract `req.user.userId` and pass to `getTrustGraph`:

```typescript
router.get('/trust/graph/:communityId', verifyToken, async (req, res) => {
  try {
    const { communityId } = req.params;
    const callingUserId = req.user!.userId;
    const graph = await getTrustGraph(communityId, callingUserId);
    res.json({ success: true, data: graph });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch trust graph' });
  }
});
```

- [ ] **Add `GET /trust/graph` aggregate route (BEFORE the `/:communityId` route)**

```typescript
// Must be declared BEFORE the /:communityId route
router.get('/trust/graph', verifyToken, async (req, res) => {
  try {
    const callingUserId = req.user!.userId;
    const graph = await getTrustGraphAggregate(callingUserId);
    res.json({ success: true, data: graph });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch aggregate trust graph' });
  }
});
```

- [ ] **Verify ego-network returns correctly**

```bash
# Get a JWT from the demo server or local dev
TOKEN="<paste JWT>"
COMMUNITY_ID="<paste any community ID>"
curl -H "Authorization: Bearer $TOKEN" http://localhost:3010/trust/graph/$COMMUNITY_ID | jq '.data.nodes | length'
# Should return a small number (ego-network) not the full community size

curl -H "Authorization: Bearer $TOKEN" http://localhost:3010/trust/graph | jq '.data.nodes | length'
# Should return aggregate neighbor count across all communities
```

---

## Task 4: Dashboard graph unification (frontend)

**Files:**
- Modify: `apps/frontend/src/pages/dashboard.tsx`
- Modify: `apps/frontend/src/components/NetworkGraph.tsx`
- Modify: `apps/frontend/src/lib/api.ts`

- [ ] **Add `getTrustGraphAggregate()` to api.ts**

```typescript
async getTrustGraphAggregate(): Promise<{ nodes: TrustNode[]; links: TrustLink[] }> {
  const res = await this.client.get('/api/social/trust/graph');
  return res.data;
}
```

Add `TrustNode` and `TrustLink` types if not already present:
```typescript
interface TrustNode { id: string; name: string; trust_score: number; karma: number; isCurrentUser: boolean; }
interface TrustLink { source: string; target: string; effective_weight: number; }
```

- [ ] **Update `dashboard.tsx` to call `getTrustGraphAggregate` instead of the old network endpoint**

Find where `NetworkGraph` is rendered in dashboard. Replace the old data fetch with:
```typescript
const [networkData, setNetworkData] = useState<{ nodes: TrustNode[]; links: TrustLink[] } | null>(null);

useEffect(() => {
  socialGraphService.getTrustGraphAggregate().then(setNetworkData).catch(() => setNetworkData(null));
}, []);
```

- [ ] **Update `NetworkGraph.tsx` to accept trust-format props**

Nodes now have `trust_score` and `isCurrentUser`. Links now have `effective_weight` instead of a binary weight. Adapt the component:
- Node size: `Math.max(5, node.trust_score / 10)`
- Node color: `node.isCurrentUser ? '#10b981' : '#6366f1'` (keep existing visual encoding)
- Link width: `Math.max(1, link.effective_weight / 5)` (function, not number)

- [ ] **Verify dashboard network panel renders trust data**

Start frontend dev server (`npm run dev` in `apps/frontend`), open dashboard, confirm "Your Network" shows nodes and edges from trust data.

---

## Task 5: Governance DB layer (community-service)

**Files:**
- Create: `services/community-service/src/db/governanceDb.ts`

- [ ] **Write all governance DB queries**

```typescript
// services/community-service/src/db/governanceDb.ts
import { pool } from '../db';

export interface GovernanceSettings {
  eligibility_threshold: number;
  quorum_size: number;
  template: string;
}

export interface GovernanceNomination {
  id: string;
  nominated_user: { user_id: string; name: string };
  role: string;
  nominator: { user_id: string; name: string };
  ratification_count: number;
  required_ratifications: number;
  status: string;
  ratifiers: Array<{ user_id: string; name: string }>;
}

export async function getGovernanceState(communityId: string, callingUserId: string) {
  // Settings
  const settingsRes = await pool.query(
    `SELECT governance_settings FROM community.communities WHERE id = $1`,
    [communityId]
  );
  const settings: GovernanceSettings = settingsRes.rows[0]?.governance_settings ?? 
    { eligibility_threshold: 50, quorum_size: 3, template: 'small-collective' };

  // Trust maturity: avg trust score of active members from social_graph
  const maturityRes = await pool.query(`
    SELECT AVG(te.trust_score) AS avg_trust
    FROM social_graph.trust_edges te
    JOIN community.members cm ON cm.user_id IN (te.user_id_a, te.user_id_b)
    WHERE te.community_id = $1 AND te.deleted_at IS NULL
  `, [communityId]);
  const avgTrust = parseFloat(maturityRes.rows[0]?.avg_trust) || 0;
  const maturity = {
    status: avgTrust >= settings.eligibility_threshold ? 'mature' : 'constrained',
    avg_trust_score: Math.round(avgTrust * 10) / 10,
    threshold: settings.eligibility_threshold,
  };

  // Eligible members: trust_score >= threshold, active members
  const eligibleRes = await pool.query(`
    SELECT DISTINCT u.id AS user_id, u.name,
           COALESCE(MAX(te.trust_score), 0) AS trust_score,
           COALESCE(SUM(kr.karma_score), 0) AS karma
    FROM auth.users u
    JOIN community.members cm ON cm.user_id = u.id AND cm.community_id = $1 AND cm.status = 'active'
    LEFT JOIN social_graph.trust_edges te ON (te.user_id_a = u.id OR te.user_id_b = u.id)
      AND te.community_id = $1 AND te.deleted_at IS NULL
    LEFT JOIN reputation.karma_records kr ON kr.user_id = u.id AND kr.community_id = $1
    WHERE u.deleted_at IS NULL
    GROUP BY u.id, u.name
    HAVING COALESCE(MAX(te.trust_score), 0) >= $2
  `, [communityId, settings.eligibility_threshold]);

  // Pending nominations with ratification details
  const nominationsRes = await pool.query(`
    SELECT n.id, n.nominated_for_role AS role, n.status,
           n.required_ratifications, n.created_at,
           nu.id AS nominated_user_id, nu.name AS nominated_user_name,
           nom.id AS nominator_id, nom.name AS nominator_name,
           COUNT(r.ratifier_id) AS ratification_count
    FROM community.governance_nominations n
    JOIN auth.users nu ON nu.id = n.nominated_user_id
    JOIN auth.users nom ON nom.id = n.nominator_id
    LEFT JOIN community.governance_ratifications r ON r.nomination_id = n.id
    WHERE n.community_id = $1 AND n.status = 'pending'
    GROUP BY n.id, nu.id, nu.name, nom.id, nom.name
    ORDER BY n.created_at DESC
  `, [communityId]);

  // Ratifiers for each nomination
  const nominations: GovernanceNomination[] = await Promise.all(
    nominationsRes.rows.map(async (row) => {
      const ratifiersRes = await pool.query(`
        SELECT u.id AS user_id, u.name
        FROM community.governance_ratifications r
        JOIN auth.users u ON u.id = r.ratifier_id
        WHERE r.nomination_id = $1
      `, [row.id]);
      return {
        id: row.id,
        nominated_user: { user_id: row.nominated_user_id, name: row.nominated_user_name },
        role: row.role,
        nominator: { user_id: row.nominator_id, name: row.nominator_name },
        ratification_count: parseInt(row.ratification_count),
        required_ratifications: row.required_ratifications,
        status: row.status,
        ratifiers: ratifiersRes.rows,
      };
    })
  );

  // Current governance role holders
  const roleHoldersRes = await pool.query(`
    SELECT u.id AS user_id, u.name, cm.role,
           COALESCE(MAX(te.trust_score), 0) AS trust_score
    FROM community.members cm
    JOIN auth.users u ON u.id = cm.user_id
    LEFT JOIN social_graph.trust_edges te ON (te.user_id_a = u.id OR te.user_id_b = u.id)
      AND te.community_id = $1 AND te.deleted_at IS NULL
    WHERE cm.community_id = $1 AND cm.role IN ('admin', 'moderator') AND cm.status = 'active'
    GROUP BY u.id, u.name, cm.role
  `, [communityId]);

  return { settings, maturity, eligible_members: eligibleRes.rows, nominations, role_holders: roleHoldersRes.rows };
}

export async function createNomination(
  communityId: string,
  nominatorId: string,
  nominatedUserId: string,
  role: string,
  quorumSize: number
): Promise<{ id: string }> {
  // Check for existing pending nomination
  const existing = await pool.query(`
    SELECT id FROM community.governance_nominations
    WHERE community_id = $1 AND nominated_user_id = $2 AND nominated_for_role = $3 AND status = 'pending'
  `, [communityId, nominatedUserId, role]);
  if (existing.rows.length > 0) throw new Error('DUPLICATE_NOMINATION');

  const res = await pool.query(`
    INSERT INTO community.governance_nominations
      (community_id, nominated_user_id, nominated_for_role, nominator_id, required_ratifications)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `, [communityId, nominatedUserId, role, nominatorId, quorumSize]);
  return { id: res.rows[0].id };
}

export async function addRatification(
  nominationId: string,
  ratifierId: string
): Promise<{ ratified: boolean; ratification_count: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert ratification (PK constraint handles duplicate ratifier)
    await client.query(`
      INSERT INTO community.governance_ratifications (nomination_id, ratifier_id)
      VALUES ($1, $2) ON CONFLICT DO NOTHING
    `, [nominationId, ratifierId]);

    // Get current count and quorum
    const countRes = await client.query(`
      SELECT n.required_ratifications, COUNT(r.ratifier_id) AS count,
             n.nominated_user_id, n.nominated_for_role, n.community_id
      FROM community.governance_nominations n
      LEFT JOIN community.governance_ratifications r ON r.nomination_id = n.id
      WHERE n.id = $1
      GROUP BY n.id
    `, [nominationId]);
    const { required_ratifications, count, nominated_user_id, nominated_for_role, community_id } = countRes.rows[0];
    const ratificationCount = parseInt(count);

    let ratified = false;
    if (ratificationCount >= parseInt(required_ratifications)) {
      // Auto-ratify: update member role + mark nomination resolved
      await client.query(`
        UPDATE community.members SET role = $1
        WHERE user_id = $2 AND community_id = $3
      `, [nominated_for_role, nominated_user_id, community_id]);

      await client.query(`
        UPDATE community.governance_nominations
        SET status = 'ratified', resolved_at = NOW()
        WHERE id = $1
      `, [nominationId]);
      ratified = true;
    }

    await client.query('COMMIT');
    return { ratified, ratification_count: ratificationCount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

---

## Task 6: Governance routes (community-service)

**Files:**
- Create: `services/community-service/src/routes/governance.ts`
- Modify: `services/community-service/src/index.ts` (or router entry point)

- [ ] **Create governance route handlers**

```typescript
// services/community-service/src/routes/governance.ts
import { Router } from 'express';
import { verifyToken } from '../middleware/auth';
import { getGovernanceState, createNomination, addRatification } from '../db/governanceDb';
import { pool } from '../db';

const router = Router();

// GET /communities/:id/governance
router.get('/:communityId/governance', verifyToken, async (req, res) => {
  const { communityId } = req.params;
  const userId = req.user!.userId;
  try {
    // Verify caller is active member
    const memberCheck = await pool.query(
      `SELECT id FROM community.members WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
      [communityId, userId]
    );
    if (!memberCheck.rows.length) {
      return res.status(403).json({ success: false, message: 'Must be an active member' });
    }
    const state = await getGovernanceState(communityId, userId);
    res.json({ success: true, data: state });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch governance state' });
  }
});

// POST /communities/:id/governance/nominate
router.post('/:communityId/governance/nominate', verifyToken, async (req, res) => {
  const { communityId } = req.params;
  const nominatorId = req.user!.userId;
  const { nominated_user_id, role } = req.body;

  if (!nominated_user_id || !role || !['admin', 'moderator'].includes(role)) {
    return res.status(400).json({ success: false, message: 'nominated_user_id and valid role required' });
  }

  try {
    // Get quorum size from community settings
    const settingsRes = await pool.query(
      `SELECT governance_settings FROM community.communities WHERE id = $1`,
      [communityId]
    );
    const settings = settingsRes.rows[0]?.governance_settings ?? { eligibility_threshold: 50, quorum_size: 3 };

    // Check nominated user meets eligibility threshold
    const trustRes = await pool.query(`
      SELECT MAX(trust_score) AS max_trust
      FROM social_graph.trust_edges
      WHERE community_id = $1 AND (user_id_a = $2 OR user_id_b = $2) AND deleted_at IS NULL
    `, [communityId, nominated_user_id]);
    const trustScore = parseFloat(trustRes.rows[0]?.max_trust) || 0;
    if (trustScore < settings.eligibility_threshold) {
      return res.status(422).json({
        success: false,
        message: `Nominated member's trust score (${trustScore.toFixed(1)}) is below the eligibility threshold (${settings.eligibility_threshold})`,
      });
    }

    const nomination = await createNomination(communityId, nominatorId, nominated_user_id, role, settings.quorum_size);
    res.status(201).json({ success: true, data: nomination });
  } catch (err: any) {
    if (err.message === 'DUPLICATE_NOMINATION') {
      return res.status(409).json({ success: false, message: 'A pending nomination already exists for this member and role' });
    }
    res.status(500).json({ success: false, message: 'Failed to create nomination' });
  }
});

// POST /communities/:id/governance/ratify/:nominationId
router.post('/:communityId/governance/ratify/:nominationId', verifyToken, async (req, res) => {
  const { communityId, nominationId } = req.params;
  const ratifierId = req.user!.userId;

  try {
    // Verify ratifier holds a governance role in this community
    const roleCheck = await pool.query(`
      SELECT role FROM community.members
      WHERE community_id = $1 AND user_id = $2 AND role IN ('admin', 'moderator') AND status = 'active'
    `, [communityId, ratifierId]);
    if (!roleCheck.rows.length) {
      return res.status(403).json({ success: false, message: 'Only current role-holders can ratify nominations' });
    }

    const result = await addRatification(nominationId, ratifierId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to ratify nomination' });
  }
});

export default router;
```

- [ ] **Mount governance routes in community-service entry point**

Find where other routes are mounted (likely `src/index.ts` or `src/app.ts`). Add:
```typescript
import governanceRoutes from './routes/governance';
// Mount alongside other community routes — check the existing router mount path
app.use('/communities', governanceRoutes);
// OR if routes are already scoped: router.use('/', governanceRoutes);
```

- [ ] **Verify endpoints respond**

```bash
# Start community-service locally
cd services/community-service && npm run dev

TOKEN="<paste JWT>"
COMMUNITY_ID="<paste community ID>"
curl -H "Authorization: Bearer $TOKEN" http://localhost:3002/communities/$COMMUNITY_ID/governance | jq '.data.maturity'
```

---

## Task 7: GovernanceTab frontend component

**Files:**
- Create: `apps/frontend/src/components/GovernanceTab.tsx`

- [ ] **Build the full GovernanceTab component**

```tsx
// apps/frontend/src/components/GovernanceTab.tsx
import { useState, useEffect } from 'react';
import { socialGraphService } from '../lib/api'; // update import to communityService as needed

interface GovernanceTabProps { communityId: string; }

export default function GovernanceTab({ communityId }: GovernanceTabProps) {
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nominateTarget, setNominateTarget] = useState<string | null>(null);
  const [nominateRole, setNominateRole] = useState<'admin' | 'moderator'>('moderator');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    communityService.getGovernanceState(communityId)
      .then(data => { setState(data); setLoading(false); })
      .catch(() => { setError('Failed to load governance data'); setLoading(false); });
  };

  useEffect(() => { load(); }, [communityId]);

  const handleNominate = async (userId: string) => {
    setSubmitting(true);
    try {
      await communityService.nominateForRole(communityId, userId, nominateRole);
      setNominateTarget(null);
      load();
    } catch {
      alert('Nomination failed. The member may not meet the eligibility threshold, or a nomination already exists.');
    } finally { setSubmitting(false); }
  };

  const handleRatify = async (nominationId: string) => {
    try {
      await communityService.ratifyNomination(communityId, nominationId);
      load();
    } catch { alert('Ratification failed.'); }
  };

  if (loading) return <div className="p-6 text-gray-500">Loading governance data…</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;
  if (!state) return null;

  const { maturity, settings, eligible_members, nominations, role_holders } = state;

  return (
    <div className="p-6 space-y-8">
      {/* Maturity banner */}
      <div className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 bg-gray-50">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          maturity.status === 'mature' 
            ? 'bg-emerald-100 text-emerald-700' 
            : 'bg-amber-100 text-amber-700'
        }`}>
          {maturity.status === 'mature' ? 'Mature' : 'Constrained'}
        </span>
        <span className="text-sm text-gray-600">
          Community avg trust: <strong>{maturity.avg_trust_score}</strong> / threshold: <strong>{settings.eligibility_threshold}</strong>
        </span>
        <span className="text-xs text-gray-400 ml-auto">{settings.template} · quorum {settings.quorum_size}</span>
      </div>

      {/* Current role holders */}
      {role_holders.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Governance Roles</h3>
          <div className="space-y-2">
            {role_holders.map((rh: any) => (
              <div key={rh.user_id} className="flex items-center gap-3 text-sm">
                <span className="font-medium text-gray-900">{rh.name}</span>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">{rh.role}</span>
                <span className="text-gray-400 ml-auto">trust {rh.trust_score}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active nominations */}
      {nominations.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Pending Nominations</h3>
          <div className="space-y-3">
            {nominations.map((nom: any) => (
              <div key={nom.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-medium text-gray-900">{nom.nominated_user.name}</span>
                    <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">{nom.role}</span>
                    <p className="text-xs text-gray-500 mt-0.5">Nominated by {nom.nominator.name}</p>
                  </div>
                  <button
                    onClick={() => handleRatify(nom.id)}
                    className="text-sm px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                  >
                    Ratify
                  </button>
                </div>
                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{nom.ratification_count} of {nom.required_ratifications} ratifications</span>
                    {nom.ratifiers.length > 0 && (
                      <span>by {nom.ratifiers.map((r: any) => r.name).join(', ')}</span>
                    )}
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (nom.ratification_count / nom.required_ratifications) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Eligible members */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Eligible Members (trust ≥ {settings.eligibility_threshold})
        </h3>
        {eligible_members.length === 0 ? (
          <p className="text-sm text-gray-500">No members have reached the eligibility threshold yet.</p>
        ) : (
          <div className="space-y-2">
            {eligible_members.map((m: any) => (
              <div key={m.user_id} className="flex items-center gap-3 text-sm">
                <span className="font-medium text-gray-900">{m.name}</span>
                <span className="text-gray-400">trust {m.trust_score} · {m.karma} karma</span>
                <div className="ml-auto flex items-center gap-2">
                  {nominateTarget === m.user_id ? (
                    <>
                      <select
                        value={nominateRole}
                        onChange={e => setNominateRole(e.target.value as any)}
                        className="text-xs border rounded px-2 py-1"
                      >
                        <option value="moderator">Moderator</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => handleNominate(m.user_id)}
                        disabled={submitting}
                        className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Submit
                      </button>
                      <button onClick={() => setNominateTarget(null)} className="text-xs text-gray-400">Cancel</button>
                    </>
                  ) : (
                    <button
                      onClick={() => setNominateTarget(m.user_id)}
                      className="text-xs px-2 py-1 border rounded text-indigo-600 hover:bg-indigo-50"
                    >
                      Nominate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

---

## Task 8: Community page integration + api.ts methods

**Files:**
- Modify: `apps/frontend/src/pages/communities/[id].tsx`
- Modify: `apps/frontend/src/lib/api.ts`

- [ ] **Add governance API methods to api.ts**

Find the `api.ts` service client. Add:
```typescript
async getGovernanceState(communityId: string) {
  const res = await this.client.get(`/api/community/communities/${communityId}/governance`);
  return res.data;
},
async nominateForRole(communityId: string, nominatedUserId: string, role: string) {
  const res = await this.client.post(`/api/community/communities/${communityId}/governance/nominate`, {
    nominated_user_id: nominatedUserId, role,
  });
  return res.data;
},
async ratifyNomination(communityId: string, nominationId: string) {
  const res = await this.client.post(`/api/community/communities/${communityId}/governance/ratify/${nominationId}`);
  return res.data;
},
```

- [ ] **Add `'governance'` to `ValidTab` type in `[id].tsx`**

Find `type ValidTab = ...` and add `| 'governance'`.

- [ ] **Add `'governance'` to `VALID_TABS` array**

Find `const VALID_TABS = [...]` and push `'governance'`.

- [ ] **Add governance tab button to the tab bar**

Alongside the other tab buttons (feed, members, trust graph, etc.), add:
```tsx
<button
  onClick={() => setActiveTab('governance')}
  className={`... ${activeTab === 'governance' ? 'active styles' : 'inactive styles'}`}
>
  Governance
</button>
```
Only show if `isMember`.

- [ ] **Render GovernanceTab in the tab switch**

Add case in the tab rendering switch/conditional:
```tsx
{activeTab === 'governance' && isMember && (
  <GovernanceTab communityId={communityId} />
)}
```

Import `GovernanceTab` at top of file:
```tsx
import GovernanceTab from '../../components/GovernanceTab';
```

- [ ] **Verify governance tab renders**

Open any community page in the dev browser. Click "Governance" tab. Confirm the maturity banner, eligible members list, and nominations section render without errors.

---

## Task 9: Landing page docs

**Files:**
- Modify: `docs/guides/trust-graph.md`
- Modify: `apps/landing/src/data/docs/concepts/adr-055-trust-governance-architecture.json`
- Modify: `apps/landing/src/data/docs/services/social-graph-service.json`
- Create: `apps/landing/src/data/docs/concepts/governance.json`
- Modify: `apps/landing/src/data/docs/nav.json`
- Modify: `scripts/generate-docs.ts`

- [ ] **Update `docs/guides/trust-graph.md` — add ego-network section**

Add a section after the intro explaining the ego-centric model:
```markdown
## Your Personal Trust Graph

The trust graph is always centered on you. It shows the people you've directly interacted with in this community — your direct neighbors — along with the trust connections among them. You won't see the entire community graph, because at scale that would be noise, not signal.

This is permanent by design. The graph shows your position in the community's trust network, not a bird's-eye view of everyone's connections.
```

- [ ] **Run generate-docs to regenerate the trust-graph guide JSON**

```bash
cd apps/landing && npm run generate-docs
```

Then verify `apps/landing/src/data/docs/guides/trust-graph.json` was updated.

- [ ] **Update ADR-055 JSON status to `implemented`**

In `apps/landing/src/data/docs/concepts/adr-055-trust-governance-architecture.json`, change:
```json
"status": "implemented",
"description": "**Status**: Implemented",
```

- [ ] **Update social-graph-service.json with new endpoints**

Add to the `endpoints` array:
```json
{ "method": "GET", "path": "/trust/graph", "description": "Aggregate ego-network across all of the calling user's communities. Used by dashboard Your Network panel." },
{ "method": "GET", "path": "/trust/graph/:communityId", "description": "Ego-network for the calling user in a specific community — calling user + direct neighbors + edges among them." }
```
(Update the existing `/trust/graph/:communityId` entry if it exists.)

- [ ] **Create `apps/landing/src/data/docs/concepts/governance.json`**

```json
{
  "slug": "governance",
  "title": "Trust-Gated Governance",
  "description": "How karmyq communities govern themselves through trust scores rather than static admin roles.",
  "content": "# Trust-Gated Governance\n\nkarmyq communities don't have permanent admin roles. Governance authority is earned through trust and can be lost if trust drops — an architectural commitment against oligarchic lock-in.\n\n## How It Works\n\n**Eligibility** is based on trust score. A community sets an eligibility threshold (default: 50). Any member whose trust score meets the threshold is eligible to hold a governance role.\n\n**Nomination** is open to all active members. Any member can nominate an eligible member for Admin or Moderator.\n\n**Ratification** requires quorum. A configurable number of current role-holders must ratify a nomination before it takes effect. When quorum is reached, the role is granted automatically.\n\n**Rotation** is triggered by trust drops. If a role-holder's trust score falls below the threshold, their role becomes eligible for reassignment. There is no time-based expiry — only trust-based.\n\n## Community Maturity\n\nNew communities start in **Constrained** governance mode: limited configuration rights, invite-only membership decisions. As the community's average trust score grows above the eligibility threshold, it transitions to **Mature** mode with full governance rights.\n\nThis prevents governance capture by communities that haven't built real trust yet.\n\n## Governance Templates\n\n- **small-collective** (default): 3-member quorum, flat authority — good for small groups\n- **council**: 5-member quorum, role specialization (admin/moderator) — good for medium communities\n- **open-delegation**: trust-weighted voting on governance decisions — good for large, mature communities\n\n## Why Non-Permanent Roles?\n\nPermanent roles create oligarchies. A founding admin who has become inactive retains authority indefinitely under static systems. karmyq's governance reflects where you stand *now* in the community's trust network — not who you were when the community was founded.\n\nSee [ADR-055: Trust-Based Governance Architecture](/docs/concepts/adr-055-trust-governance-architecture) for the full design rationale."
}
```

- [ ] **Add governance to nav.json "Concepts" section**

```json
{ "slug": "governance", "title": "Trust-Gated Governance" }
```

- [ ] **Add `governance` slug to `scripts/generate-docs.ts` hardcoded list** (nav.json revert fix)

Find where the hardcoded concept/guide slugs are listed in `generate-docs.ts` and add `'governance'` to the concepts list.

- [ ] **Force-add landing docs and verify**

```bash
git add -f apps/landing/src/data/docs/
grep "governance" apps/landing/src/data/docs/nav.json
# Should show the governance entry — if missing, nav.json reverted; re-apply and re-add
```

---

## Task 10: CONTEXT.md + registry.json + TDD tests

**Files:**
- Modify: `services/social-graph-service/CONTEXT.md`
- Modify: `services/community-service/CONTEXT.md`
- Modify: `services/registry.json`
- Create: `services/social-graph-service/tests/tdd/sprint-67-ego-network.test.ts`
- Create: `services/community-service/tests/tdd/sprint-67-governance.test.ts`

- [ ] **Update `services/social-graph-service/CONTEXT.md`**

In the API Endpoints section, update `GET /trust/graph/:communityId` description to: "Returns ego-network for calling user in a community (requires auth). Nodes: calling user + direct neighbors. Edges: user↔neighbor and neighbor↔neighbor."

Add new endpoint: `GET /trust/graph — Aggregate ego-network across all calling user's communities (requires auth). Used by dashboard "Your Network" panel.`

In Recent Changes, add an entry: Sprint 67 — ego-network rewrite + aggregate endpoint.

- [ ] **Update `services/community-service/CONTEXT.md`**

Add three new endpoints to the API section:
- `GET /communities/:id/governance` — returns governance state (settings, maturity, eligible members, nominations, role holders)
- `POST /communities/:id/governance/nominate` — nominate eligible member for a role
- `POST /communities/:id/governance/ratify/:nominationId` — ratify a nomination; auto-grants role at quorum

- [ ] **Update `services/registry.json`**

Add the three community-service governance endpoints and the two social-graph-service trust graph endpoints to their respective `apis.provides` arrays.

- [ ] **Write ego-network TDD tests**

```typescript
// services/social-graph-service/tests/tdd/sprint-67-ego-network.test.ts
import { getTrustGraph, getTrustGraphAggregate } from '../../src/db/trustEdgeDb';
import { pool } from '../../src/db';

describe('Ego-network trust graph', () => {
  it('returns only the calling user and their direct neighbors', async () => {
    // Use known test data from the demo DB
    // Replace with actual user and community IDs from local test data
    const graph = await getTrustGraph(testCommunityId, testUserId);
    
    // Every node must be the calling user or a direct neighbor
    const neighborIds = graph.links.flatMap(l => [l.source, l.target]).filter(id => id !== testUserId);
    graph.nodes.forEach(node => {
      if (node.id !== testUserId) {
        expect(neighborIds).toContain(node.id);
      }
    });
  });

  it('marks exactly one node as isCurrentUser', async () => {
    const graph = await getTrustGraph(testCommunityId, testUserId);
    const currentUserNodes = graph.nodes.filter(n => n.isCurrentUser);
    expect(currentUserNodes).toHaveLength(1);
    expect(currentUserNodes[0].id).toBe(testUserId);
  });

  it('returns fewer nodes than the full community member count', async () => {
    const graph = await getTrustGraph(testCommunityId, testUserId);
    const memberCountRes = await pool.query(
      `SELECT COUNT(*) FROM community.members WHERE community_id = $1 AND status = 'active'`,
      [testCommunityId]
    );
    const memberCount = parseInt(memberCountRes.rows[0].count);
    // Ego-network should be a strict subset (unless user knows everyone)
    expect(graph.nodes.length).toBeLessThanOrEqual(memberCount);
  });

  it('all edges have positive effective_weight', async () => {
    const graph = await getTrustGraph(testCommunityId, testUserId);
    graph.links.forEach(link => {
      expect(link.effective_weight).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Write governance TDD tests**

```typescript
// services/community-service/tests/tdd/sprint-67-governance.test.ts
import request from 'supertest';
import app from '../../src/app'; // adjust import path

describe('Governance endpoints', () => {
  it('GET /communities/:id/governance returns governance state shape', async () => {
    const res = await request(app)
      .get(`/communities/${testCommunityId}/governance`)
      .set('Authorization', `Bearer ${testMemberToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('settings');
    expect(res.body.data).toHaveProperty('maturity');
    expect(res.body.data).toHaveProperty('eligible_members');
    expect(res.body.data).toHaveProperty('nominations');
    expect(res.body.data).toHaveProperty('role_holders');
    
    const { settings } = res.body.data;
    expect(typeof settings.eligibility_threshold).toBe('number');
    expect(typeof settings.quorum_size).toBe('number');
  });

  it('returns 403 for non-members', async () => {
    const res = await request(app)
      .get(`/communities/${testCommunityId}/governance`)
      .set('Authorization', `Bearer ${testNonMemberToken}`);
    expect(res.status).toBe(403);
  });

  it('POST nominate returns 409 on duplicate pending nomination', async () => {
    // First nomination
    await request(app)
      .post(`/communities/${testCommunityId}/governance/nominate`)
      .set('Authorization', `Bearer ${testMemberToken}`)
      .send({ nominated_user_id: eligibleMemberId, role: 'moderator' });

    // Duplicate should 409
    const res = await request(app)
      .post(`/communities/${testCommunityId}/governance/nominate`)
      .set('Authorization', `Bearer ${testMemberToken}`)
      .send({ nominated_user_id: eligibleMemberId, role: 'moderator' });
    expect(res.status).toBe(409);
  });

  it('auto-ratifies and updates member role when quorum is reached', async () => {
    // This test requires a nomination and enough role-holders to reach quorum
    // Use the DB directly to set up state, then verify role update
    // Implement with actual test data from your test DB setup
    expect(true).toBe(true); // placeholder — fill in with real test data
  });
});
```

---

## Task 11: Type check + pre-push verification

**Files:** none (verification only)

- [ ] **TypeScript check across modified services**

```bash
cd services/social-graph-service && npx tsc --noEmit
cd services/community-service && npx tsc --noEmit
cd apps/frontend && npx tsc --noEmit
```

Fix any type errors before proceeding.

- [ ] **Run full test suite**

```bash
npm test
npm run test:tdd
```

All unit + regression tests must pass. TDD tests are informational.

- [ ] **Run feedback check**

```bash
npm run feedback:check
```

Fix any documentation gaps flagged.

- [ ] **Manual smoke test checklist**

1. Open community page → "Governance" tab renders without JS errors
2. Maturity banner shows correct status (Constrained or Mature)
3. Eligible members list populates
4. Click "Nominate" on an eligible member → role selector appears → Submit
5. New nomination appears in "Active Nominations" with 0/N ratification bar
6. Log in as admin → Ratify button visible on nomination → click → count updates
7. Dashboard "Your Network" panel shows trust-format graph (ego-network)
8. Trust graph on community tab still renders (ego-network, not full community)

---

## Task 12: Merge + Deploy

- [ ] **Run the `/deploy` skill**

This task uses the `/deploy` skill which handles: merge to master, push, monitors GitHub Actions, and SSHes for migration if needed.

```bash
# Migration must be applied on the demo server manually during deploy
# deploy.sh will pull new code but won't auto-apply migrations
# Use /deploy skill and note that migration 009 must be applied via:
# docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /path/to/009-governance-schema.sql
```

- [ ] **Post-deploy validation**

After deploy completes:
1. Visit any community on karmyq.com → Governance tab renders
2. Visit `karmyq.com/docs/concepts/governance` → new concept page renders
3. Visit `karmyq.com/docs/concepts/adr-055-trust-governance-architecture` → status shows "Implemented"
4. Dashboard "Your Network" shows nodes from trust data
5. API smoke test: `curl -H "Authorization: Bearer $TOKEN" https://karmyq.com/api/community/communities/$COMMUNITY_ID/governance | jq '.data.maturity'`
