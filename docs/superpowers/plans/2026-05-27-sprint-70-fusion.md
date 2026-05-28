# Sprint 70: Fusion Mechanism — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the fusion mechanism — two community admins bilaterally propose a merger, each community's members vote independently, and on approval a new merged community is created inheriting all members, trust edges (×0.70), and karma records.

**Architecture:** New `fusions.ts` route + `fusionService.ts` in community-service, mirroring the fission pattern. New `FusionTab.tsx` on the community page. Two new DB tables (`fusion_proposals`, `fusion_votes`) plus an ALTER to `community_links` to support `fusion_origin` link type.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create

| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260527-fusion.sql` | DB migration: new tables + link_type constraint |
| `services/community-service/src/routes/fusions.ts` | All fusion API routes |
| `services/community-service/src/database/fusionsDb.ts` | DB helper functions for fusion tables |
| `services/community-service/src/services/fusionService.ts` | `executeFusion` transactional logic |
| `apps/frontend/src/components/community/tabs/FusionTab.tsx` | Fusion tab UI |
| `apps/frontend/src/components/FusionProposalModal.tsx` | Proposal creation modal |
| `docs/adr/ADR-058-fusion-mechanism.md` | Source ADR |
| `apps/landing/src/data/docs/concepts/adr-058-fusion-mechanism.json` | Landing page ADR |
| `apps/landing/src/data/docs/guides/fusion.json` | User guide |
| `services/community-service/tests/tdd/sprint-70-fusion.test.ts` | TDD integration test |

### Existing files to modify

| File | Change |
|------|--------|
| `services/community-service/src/index.ts` | Mount fusions router |
| `services/community-service/src/routes/communities.ts` | Include `active_fusion_proposal` in GET /communities/:id |
| `apps/frontend/src/lib/api.ts` | Add fusion API methods to communityService |
| `apps/frontend/src/pages/communities/[id].tsx` | Add 'fusion' ValidTab, import FusionTab |
| `apps/landing/src/data/docs/nav.json` | Add fusion guide + ADR-058 entries |
| `scripts/generate-docs.ts` | Add fusion + ADR-058 slugs to hardcoded list |
| `services/community-service/CONTEXT.md` | Document new endpoints |
| `services/registry.json` | Add fusion endpoints + events |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **trust_edges normalized constraint**: `social_graph.trust_edges` requires `user_id_a::text < user_id_b::text`. When inserting copied edges, always sort: `const [a, b] = [uid1, uid2].sort()`.

2. **community_links UNIQUE constraint**: Existing UNIQUE(community_a_id, community_b_id) — fusion_origin links must be (merged, A) and (merged, B), NOT (A, B).

3. **No UNIQUE constraint on fusion_proposals**: Guard "active proposal" via query, not DB constraint. A community can be party to multiple proposals (as A in one, B in another).

4. **trust_carry_factor 0.70**: Applied to `raw_weight` when copying trust edges into merged. Applies to both A-internal and B-internal edges. No cross-community trust edges exist in the data model.

5. **nav.json revert bug**: `scripts/generate-docs.ts` regenerates nav.json on build. Add new slugs to the hardcoded slug list inside that script or entries vanish on next build.

6. **Landing page docs gitignore**: Always `git add -f apps/landing/src/data/docs/` when staging.

7. **Admin A or B can start-vote / execute**: Check `isAdmin(req, communityAId) || isAdmin(req, communityBId)`.

8. **`active_fusion_proposal`**: Community GET endpoint needs it so the tab badge works. Follow same pattern as `getActiveSplitProposalForCommunity` in splits.ts.

9. **JWT field**: `user.communities ?? []` — never `communityMemberships`.

10. **API response unwrap**: `createApiClient` interceptor already unwraps envelope — use `res.data`, not `res.data.data`.

---

## Task 1: Feature branch + DB migration

**Files:**
- Create: `infrastructure/postgres/migrations/20260527-fusion.sql`

- [ ] **Create branch**

```bash
git checkout -b feature/sprint-70-fusion
```

- [ ] **Write migration**

```sql
-- Sprint 70: Fusion Mechanism
-- Adds fusion_proposals + fusion_votes tables, extends community_links link_type

-- 1. Extend community_links to support fusion_origin
ALTER TABLE communities.community_links DROP CONSTRAINT IF EXISTS community_links_link_type_check;
ALTER TABLE communities.community_links ADD CONSTRAINT community_links_link_type_check
  CHECK (link_type IN ('sister', 'parent_child', 'split_origin', 'fusion_origin'));

-- 2. Fusion proposals
CREATE TABLE IF NOT EXISTS communities.fusion_proposals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_a_id        UUID NOT NULL REFERENCES communities.communities(id),
  community_b_id        UUID NOT NULL REFERENCES communities.communities(id),
  proposed_by           UUID NOT NULL REFERENCES auth.users(id),
  merged_community_name TEXT NOT NULL,
  rationale             TEXT,
  status                TEXT NOT NULL DEFAULT 'pending_acceptance'
                          CHECK (status IN (
                            'pending_acceptance', 'discussion', 'voting',
                            'approved', 'rejected', 'executed'
                          )),
  quorum_pct            INTEGER NOT NULL DEFAULT 60,
  approval_pct          INTEGER NOT NULL DEFAULT 60,
  accepted_by           UUID REFERENCES auth.users(id),
  voting_ends_at        TIMESTAMPTZ,
  executed_at           TIMESTAMPTZ,
  merged_community_id   UUID REFERENCES communities.communities(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  CHECK (community_a_id <> community_b_id)
);

-- 3. Fusion votes (community-scoped so parallel tallies work)
CREATE TABLE IF NOT EXISTS communities.fusion_votes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     UUID NOT NULL REFERENCES communities.fusion_proposals(id) ON DELETE CASCADE,
  community_id    UUID NOT NULL REFERENCES communities.communities(id),
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  vote            TEXT NOT NULL CHECK (vote IN ('yes', 'no', 'abstain')),
  prestige_weight NUMERIC(8,2) NOT NULL DEFAULT 1.0,
  voted_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (proposal_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_fusion_proposals_a ON communities.fusion_proposals(community_a_id);
CREATE INDEX IF NOT EXISTS idx_fusion_proposals_b ON communities.fusion_proposals(community_b_id);
CREATE INDEX IF NOT EXISTS idx_fusion_votes_proposal ON communities.fusion_votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_fusion_votes_community ON communities.fusion_votes(proposal_id, community_id);
```

- [ ] **Run migration on local DB**

```bash
node infrastructure/postgres/run-migration.js infrastructure/postgres/migrations/20260527-fusion.sql
# or: psql -U postgres -d karmyq -f infrastructure/postgres/migrations/20260527-fusion.sql
```

- [ ] **Verify tables exist**

```bash
psql -U postgres -d karmyq -c "\dt communities.fusion*"
```

---

## Task 2: DB helper layer (`fusionDb.ts`)

**Files:**
- Create: `services/community-service/src/database/fusionsDb.ts`

- [ ] **Write fusionsDb.ts** with these functions:

```typescript
import pool from './db';

export async function insertFusionProposal(opts: {
  communityAId: string;
  communityBId: string;
  proposedBy: string;
  mergedCommunityName: string;
  rationale?: string;
}) {
  const res = await pool.query(
    `INSERT INTO communities.fusion_proposals
       (community_a_id, community_b_id, proposed_by, merged_community_name, rationale)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [opts.communityAId, opts.communityBId, opts.proposedBy, opts.mergedCommunityName, opts.rationale ?? '']
  );
  return res.rows[0];
}

export async function getFusionProposal(proposalId: string) {
  const res = await pool.query(
    `SELECT * FROM communities.fusion_proposals WHERE id = $1`,
    [proposalId]
  );
  return res.rows[0] ?? null;
}

export async function getActiveFusionProposalForCommunity(communityId: string) {
  const res = await pool.query(
    `SELECT * FROM communities.fusion_proposals
     WHERE (community_a_id = $1 OR community_b_id = $1)
       AND status NOT IN ('rejected', 'executed')
     ORDER BY created_at DESC LIMIT 1`,
    [communityId]
  );
  return res.rows[0] ?? null;
}

export async function updateFusionProposalStatus(
  proposalId: string,
  status: string,
  extras: Record<string, unknown> = {}
) {
  const setClauses = ['status = $2'];
  const values: unknown[] = [proposalId, status];
  let i = 3;
  for (const [key, val] of Object.entries(extras)) {
    setClauses.push(`${key} = $${i++}`);
    values.push(val);
  }
  const res = await pool.query(
    `UPDATE communities.fusion_proposals SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    values
  );
  return res.rows[0];
}

export async function insertFusionVote(
  proposalId: string,
  communityId: string,
  userId: string,
  vote: string,
  prestigeWeight: number
) {
  const res = await pool.query(
    `INSERT INTO communities.fusion_votes (proposal_id, community_id, user_id, vote, prestige_weight)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (proposal_id, user_id) DO UPDATE SET vote = $4, prestige_weight = $5
     RETURNING *`,
    [proposalId, communityId, userId, vote, prestigeWeight]
  );
  return res.rows[0];
}

export async function getFusionVotesForCommunity(proposalId: string, communityId: string) {
  const res = await pool.query(
    `SELECT fv.*, m.user_id AS member_check
     FROM communities.fusion_votes fv
     WHERE fv.proposal_id = $1 AND fv.community_id = $2`,
    [proposalId, communityId]
  );
  return res.rows;
}

export async function getFusionMemberCount(communityId: string) {
  const res = await pool.query(
    `SELECT COUNT(*) AS cnt FROM communities.members
     WHERE community_id = $1 AND status = 'active'`,
    [communityId]
  );
  return parseInt(res.rows[0].cnt, 10);
}
```

---

## Task 3: Fusion execution service (`fusionService.ts`)

**Files:**
- Create: `services/community-service/src/services/fusionService.ts`

- [ ] **Write fusionService.ts**

```typescript
import { Pool } from 'pg';

const TRUST_CARRY_FACTOR = 0.70;

export async function executeFusion(proposalId: string, adminId: string, pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock and validate proposal
    const proposalRes = await client.query(
      `SELECT * FROM communities.fusion_proposals WHERE id = $1 FOR UPDATE`,
      [proposalId]
    );
    const proposal = proposalRes.rows[0];
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.status !== 'approved') throw new Error('Proposal must be in approved status');

    const { community_a_id: aId, community_b_id: bId } = proposal;

    // 2. Get community A attributes for merged community
    const parentRes = await client.query(
      `SELECT description, location, category, community_type, access_type FROM communities.communities WHERE id = $1`,
      [aId]
    );
    const parent = parentRes.rows[0];

    // 3. Create merged community
    const mergedRes = await client.query(
      `INSERT INTO communities.communities
         (name, description, location, category, community_type, access_type, creator_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active') RETURNING id`,
      [proposal.merged_community_name, parent.description, parent.location, parent.category,
       parent.community_type, parent.access_type, adminId]
    );
    const mergedId = mergedRes.rows[0].id;

    // 4. Collect all active members from both communities
    const membersRes = await client.query(
      `SELECT DISTINCT user_id FROM communities.members
       WHERE community_id = ANY($1) AND status = 'active'`,
      [[aId, bId]]
    );
    const memberIds: string[] = membersRes.rows.map((r: any) => r.user_id);

    // 5. Add all members to merged community
    for (const uid of memberIds) {
      await client.query(
        `INSERT INTO communities.members (community_id, user_id, role, status)
         VALUES ($1, $2, 'member', 'active')
         ON CONFLICT (community_id, user_id) DO NOTHING`,
        [mergedId, uid]
      );
    }

    // 6. Copy trust edges (with carry factor, maintaining normalization constraint)
    const edgesRes = await client.query(
      `SELECT user_id_a, user_id_b, raw_weight
       FROM social_graph.trust_edges
       WHERE community_id = ANY($1)`,
      [[aId, bId]]
    );
    for (const edge of edgesRes.rows) {
      const [ua, ub] = [edge.user_id_a, edge.user_id_b].sort(); // enforce normalization
      await client.query(
        `INSERT INTO social_graph.trust_edges
           (user_id_a, user_id_b, community_id, raw_weight, last_interaction_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id_a, user_id_b, community_id) DO NOTHING`,
        [ua, ub, mergedId, Math.round(parseFloat(edge.raw_weight) * TRUST_CARRY_FACTOR * 100) / 100]
      );
    }

    // 7. Copy karma records from both communities
    await client.query(
      `INSERT INTO reputation.karma_records (user_id, community_id, points, reason, related_entity_id, created_at)
       SELECT user_id, $1, points, reason, related_entity_id, created_at
       FROM reputation.karma_records
       WHERE community_id = ANY($2)`,
      [mergedId, [aId, bId]]
    );

    // 8. Create fusion_origin community_links (merged↔A and merged↔B)
    await client.query(
      `INSERT INTO communities.community_links
         (community_a_id, community_b_id, link_type, trust_carry_factor, created_by_admin_a, created_by_admin_b, status)
       VALUES ($1, $2, 'fusion_origin', $3, $4, $4, 'active')`,
      [mergedId, aId, TRUST_CARRY_FACTOR, adminId]
    );
    await client.query(
      `INSERT INTO communities.community_links
         (community_a_id, community_b_id, link_type, trust_carry_factor, created_by_admin_a, created_by_admin_b, status)
       VALUES ($1, $2, 'fusion_origin', $3, $4, $4, 'active')`,
      [mergedId, bId, TRUST_CARRY_FACTOR, adminId]
    );

    // 9. Mark proposal executed
    await client.query(
      `UPDATE communities.fusion_proposals
       SET status = 'executed', executed_at = NOW(), merged_community_id = $1
       WHERE id = $2`,
      [mergedId, proposalId]
    );

    // 10. Archive both parent communities
    await client.query(
      `UPDATE communities.communities SET status = 'merged' WHERE id = ANY($1)`,
      [[aId, bId]]
    );

    await client.query('COMMIT');
    return { mergedId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

- [ ] **Verify TypeScript compiles** (no errors yet from fusionService.ts):

```bash
cd services/community-service && npx tsc --noEmit
```

---

## Task 4: Fusion API routes (`fusions.ts`)

**Files:**
- Create: `services/community-service/src/routes/fusions.ts`

- [ ] **Write fusions.ts** with all 7 endpoints (create, accept, reject, get, start-vote, vote, execute)

Key route patterns to follow (mirrors splits.ts):

```typescript
import { Router, Response } from 'express';
import pool from '../database/db';
import { publishEvent } from '../events/publisher';
import { executeFusion } from '../services/fusionService';
import {
  insertFusionProposal, getFusionProposal, getActiveFusionProposalForCommunity,
  updateFusionProposalStatus, insertFusionVote, getFusionVotesForCommunity, getFusionMemberCount,
} from '../database/fusionsDb';

const router = Router();

function isAdmin(req: any, communityId: string): boolean {
  const memberships = req.user?.communities ?? [];
  return memberships.some((m: any) => m.id === communityId && m.role === 'admin');
}

async function isMember(userId: string, communityId: string): Promise<boolean> {
  const res = await pool.query(
    `SELECT id FROM communities.members WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
    [communityId, userId]
  );
  return res.rows.length > 0;
}

function computeTally(votes: any[], totalMembers: number, quorumPct: number, approvalPct: number) {
  const votedCount = votes.length;
  const weightedYes = votes.filter((v) => v.vote === 'yes').reduce((s, v) => s + parseFloat(v.prestige_weight), 0);
  const weightedTotal = votes.reduce((s, v) => s + parseFloat(v.prestige_weight), 0);
  return {
    total_members: totalMembers,
    voted_count: votedCount,
    quorum_pct: quorumPct,
    approval_pct: approvalPct,
    weighted_yes: weightedYes,
    weighted_total: weightedTotal,
    approval_ratio: weightedTotal > 0 ? Math.round((weightedYes / weightedTotal) * 100) : 0,
    quorum_ratio: totalMembers > 0 ? Math.round((votedCount / totalMembers) * 100) : 0,
  };
}

// POST /:communityId/fusions — Admin A creates proposal
router.post('/:communityId/fusions', async (req: any, res: Response) => {
  const { communityId } = req.params;
  const userId = req.user?.userId;

  if (!isAdmin(req, communityId)) return res.status(403).json({ success: false, message: 'Admin only' });

  const { target_community_id, merged_community_name, rationale } = req.body;
  if (!target_community_id || !merged_community_name) {
    return res.status(400).json({ success: false, message: 'target_community_id and merged_community_name are required' });
  }

  // Guard: check for active proposal involving this community pair
  const existingA = await getActiveFusionProposalForCommunity(communityId);
  const existingB = await getActiveFusionProposalForCommunity(target_community_id);
  if (existingA || existingB) {
    return res.status(409).json({ success: false, message: 'An active fusion proposal already exists for one of these communities' });
  }

  try {
    const proposal = await insertFusionProposal({
      communityAId: communityId,
      communityBId: target_community_id,
      proposedBy: userId,
      mergedCommunityName: merged_community_name,
      rationale,
    });
    res.status(201).json({ success: true, data: { proposal } });
  } catch (err) {
    console.error('[fusions] create error:', err);
    res.status(500).json({ success: false, message: 'Failed to create fusion proposal' });
  }
});

// POST /:communityId/fusions/:fusionId/accept — Admin B accepts
router.post('/:communityId/fusions/:fusionId/accept', async (req: any, res: Response) => {
  const { fusionId } = req.params;
  const userId = req.user?.userId;

  const proposal = await getFusionProposal(fusionId);
  if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found' });
  if (!isAdmin(req, proposal.community_b_id)) return res.status(403).json({ success: false, message: 'Admin of target community only' });
  if (proposal.status !== 'pending_acceptance') return res.status(422).json({ success: false, message: 'Proposal must be in pending_acceptance status' });

  try {
    const updated = await updateFusionProposalStatus(fusionId, 'discussion', { accepted_by: userId });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to accept proposal' });
  }
});

// POST /:communityId/fusions/:fusionId/reject — Admin B rejects
router.post('/:communityId/fusions/:fusionId/reject', async (req: any, res: Response) => {
  const { fusionId } = req.params;

  const proposal = await getFusionProposal(fusionId);
  if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found' });
  if (!isAdmin(req, proposal.community_b_id)) return res.status(403).json({ success: false, message: 'Admin of target community only' });
  if (proposal.status !== 'pending_acceptance') return res.status(422).json({ success: false, message: 'Proposal must be in pending_acceptance status' });

  try {
    const updated = await updateFusionProposalStatus(fusionId, 'rejected');
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reject proposal' });
  }
});

// GET /:communityId/fusions/:fusionId — proposal detail + both tallies
router.get('/:communityId/fusions/:fusionId', async (req: any, res: Response) => {
  const { communityId, fusionId } = req.params;
  const userId = req.user?.userId;

  const proposal = await getFusionProposal(fusionId);
  if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found' });

  const isPartyA = communityId === proposal.community_a_id;
  const isPartyB = communityId === proposal.community_b_id;
  if (!isPartyA && !isPartyB) return res.status(403).json({ success: false, message: 'Not a party to this proposal' });

  const inCommunity = isPartyA ? proposal.community_a_id : proposal.community_b_id;
  if (!(await isMember(userId, inCommunity))) return res.status(403).json({ success: false, message: 'Must be an active member' });

  try {
    const [votesA, votesB, membersA, membersB] = await Promise.all([
      getFusionVotesForCommunity(fusionId, proposal.community_a_id),
      getFusionVotesForCommunity(fusionId, proposal.community_b_id),
      getFusionMemberCount(proposal.community_a_id),
      getFusionMemberCount(proposal.community_b_id),
    ]);

    const myVote = (isPartyA ? votesA : votesB).find((v: any) => v.user_id === userId)?.vote ?? null;

    res.json({
      success: true,
      data: {
        proposal,
        vote_tally_a: computeTally(votesA, membersA, proposal.quorum_pct, proposal.approval_pct),
        vote_tally_b: computeTally(votesB, membersB, proposal.quorum_pct, proposal.approval_pct),
        my_vote: myVote,
        my_community: isPartyA ? 'a' : 'b',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch fusion proposal' });
  }
});

// POST /:communityId/fusions/:fusionId/start-vote — either admin starts voting
router.post('/:communityId/fusions/:fusionId/start-vote', async (req: any, res: Response) => {
  const { fusionId } = req.params;

  const proposal = await getFusionProposal(fusionId);
  if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found' });
  if (!isAdmin(req, proposal.community_a_id) && !isAdmin(req, proposal.community_b_id)) {
    return res.status(403).json({ success: false, message: 'Admin of either community required' });
  }
  if (proposal.status !== 'discussion') return res.status(422).json({ success: false, message: 'Proposal must be in discussion status' });

  const votingEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const updated = await updateFusionProposalStatus(fusionId, 'voting', { voting_ends_at: votingEndsAt });

  publishEvent('fusion_vote_started', {
    proposal_id: fusionId,
    community_a_id: proposal.community_a_id,
    community_b_id: proposal.community_b_id,
    merged_community_name: proposal.merged_community_name,
    voting_ends_at: votingEndsAt,
  }).catch((err: any) => console.error('[fusions] fusion_vote_started publish failed:', err));

  res.json({ success: true, data: updated });
});

// POST /:communityId/fusions/:fusionId/vote — member casts vote
router.post('/:communityId/fusions/:fusionId/vote', async (req: any, res: Response) => {
  const { communityId, fusionId } = req.params;
  const userId = req.user?.userId;

  const proposal = await getFusionProposal(fusionId);
  if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found' });

  const isPartyA = communityId === proposal.community_a_id;
  const isPartyB = communityId === proposal.community_b_id;
  if (!isPartyA && !isPartyB) return res.status(403).json({ success: false, message: 'Not a party to this proposal' });
  if (!(await isMember(userId, communityId))) return res.status(403).json({ success: false, message: 'Must be an active member' });
  if (proposal.status !== 'voting') return res.status(422).json({ success: false, message: 'Voting is not open' });

  const { vote } = req.body;
  if (!['yes', 'no', 'abstain'].includes(vote)) return res.status(400).json({ success: false, message: 'vote must be yes, no, or abstain' });

  try {
    const trustRes = await pool.query(
      `SELECT COALESCE(SUM(raw_weight), 0) AS trust_score
       FROM social_graph.trust_edges
       WHERE community_id = $1 AND (user_id_a = $2 OR user_id_b = $2)`,
      [communityId, userId]
    );
    const prestigeWeight = Math.max(1.0, parseFloat(trustRes.rows[0]?.trust_score) || 1.0);

    await insertFusionVote(fusionId, communityId, userId, vote, prestigeWeight);

    // Auto-approve: check if both community tallies now pass
    const [votesA, votesB, membersA, membersB] = await Promise.all([
      getFusionVotesForCommunity(fusionId, proposal.community_a_id),
      getFusionVotesForCommunity(fusionId, proposal.community_b_id),
      getFusionMemberCount(proposal.community_a_id),
      getFusionMemberCount(proposal.community_b_id),
    ]);

    const passes = (votes: any[], totalMembers: number) => {
      const votedCount = votes.length;
      const weightedYes = votes.filter((v) => v.vote === 'yes').reduce((s, v) => s + parseFloat(v.prestige_weight), 0);
      const weightedTotal = votes.reduce((s, v) => s + parseFloat(v.prestige_weight), 0);
      return (
        totalMembers > 0 && (votedCount / totalMembers) * 100 >= proposal.quorum_pct &&
        weightedTotal > 0 && (weightedYes / weightedTotal) * 100 >= proposal.approval_pct
      );
    };

    if (passes(votesA, membersA) && passes(votesB, membersB)) {
      await updateFusionProposalStatus(fusionId, 'approved');
    }

    res.json({ success: true, data: { vote, prestige_weight: prestigeWeight } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to cast vote' });
  }
});

// POST /:communityId/fusions/:fusionId/execute — execute approved fusion
router.post('/:communityId/fusions/:fusionId/execute', async (req: any, res: Response) => {
  const { fusionId } = req.params;
  const userId = req.user?.userId;

  const proposal = await getFusionProposal(fusionId);
  if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found' });
  if (!isAdmin(req, proposal.community_a_id) && !isAdmin(req, proposal.community_b_id)) {
    return res.status(403).json({ success: false, message: 'Admin of either community required' });
  }

  try {
    const { mergedId } = await executeFusion(fusionId, userId, pool);
    res.json({ success: true, data: { merged_community_id: mergedId } });
  } catch (err: any) {
    if (err.message === 'Proposal must be in approved status') {
      return res.status(422).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: 'Failed to execute fusion' });
  }
});

export async function getActiveFusionProposalForCommunityRoute(communityId: string) {
  return getActiveFusionProposalForCommunity(communityId);
}

export default router;
```

---

## Task 5: Wire fusions into community-service + expose `active_fusion_proposal`

**Files:**
- Modify: `services/community-service/src/index.ts`
- Modify: `services/community-service/src/routes/communities.ts`
- Modify: `apps/frontend/src/lib/api.ts`

- [ ] **Register fusions router in index.ts** (after the splits router import/use):

```typescript
import fusionsRouter from './routes/fusions';
// ...
app.use('/communities', fusionsRouter);
```

- [ ] **Update community GET endpoint in communities.ts** to include `active_fusion_proposal`:

Add after the `active_split_proposal` fetch:
```typescript
import { getActiveFusionProposalForCommunityRoute } from './fusions';
// ...
const [activeSplitProposal, activeFusionProposal] = await Promise.all([
  getActiveSplitProposalForCommunity(communityId),
  getActiveFusionProposalForCommunityRoute(communityId),
]);
// Include in response:
// active_split_proposal: activeSplitProposal,
// active_fusion_proposal: activeFusionProposal,
```

- [ ] **Add fusion API methods to `apps/frontend/src/lib/api.ts`** in `communityService`:

```typescript
// Fusion
createFusionProposal: (communityId: string, body: { target_community_id: string; merged_community_name: string; rationale?: string }) =>
  apiClient.post(`/api/communities/${communityId}/fusions`, body),
getFusionProposal: (communityId: string, fusionId: string) =>
  apiClient.get(`/api/communities/${communityId}/fusions/${fusionId}`),
acceptFusionProposal: (communityId: string, fusionId: string) =>
  apiClient.post(`/api/communities/${communityId}/fusions/${fusionId}/accept`),
rejectFusionProposal: (communityId: string, fusionId: string) =>
  apiClient.post(`/api/communities/${communityId}/fusions/${fusionId}/reject`),
startFusionVote: (communityId: string, fusionId: string) =>
  apiClient.post(`/api/communities/${communityId}/fusions/${fusionId}/start-vote`),
castFusionVote: (communityId: string, fusionId: string, vote: string) =>
  apiClient.post(`/api/communities/${communityId}/fusions/${fusionId}/vote`, { vote }),
executeFusion: (communityId: string, fusionId: string) =>
  apiClient.post(`/api/communities/${communityId}/fusions/${fusionId}/execute`),
```

- [ ] **Add `active_fusion_proposal` to the Community type** in frontend (wherever Community is typed)

- [ ] **TypeScript check**:

```bash
cd services/community-service && npx tsc --noEmit
```

---

## Task 6: FusionProposalModal + FusionTab components

**Files:**
- Create: `apps/frontend/src/components/FusionProposalModal.tsx`
- Create: `apps/frontend/src/components/community/tabs/FusionTab.tsx`

- [ ] **Write FusionProposalModal.tsx** — form with fields:
  - Target community ID (text input with label "Target Community ID")
  - Merged community name (text input)
  - Rationale (optional textarea)
  - Submit / Cancel buttons

- [ ] **Write FusionTab.tsx** — views by status:

```typescript
interface Props {
  community: Community
  currentUserId: string
  isAdmin: boolean
  onRefresh: () => void
}
```

Views:
- **No active proposal (Admin)**: "Propose Fusion" button → opens FusionProposalModal
- **No active proposal (Member)**: "No active fusion proposal."
- **pending_acceptance, my_community=a**: "Waiting for the target community admin to accept..."
- **pending_acceptance, my_community=b, isAdmin**: Accept / Reject buttons + proposal summary
- **discussion**: Proposal summary + "Start Vote" button (admin only)
- **voting**: Vote tally for own community (bar chart), vote buttons (hidden if already voted), other community tally read-only, voting deadline
- **approved**: "Both communities approved. Execute merger." button (admin only)
- **executed**: "Communities merged. [View merged community]" link using `proposal.merged_community_id`

- [ ] **Build check**:

```bash
cd apps/frontend && npx tsc --noEmit
```

---

## Task 7: Wire FusionTab into community page

**Files:**
- Modify: `apps/frontend/src/pages/communities/[id].tsx`

- [ ] **Add 'fusion' to ValidTab type**:

```typescript
type ValidTab = 'overview' | 'people' | 'requests' | 'providers' | 'settings' | 'activities' | 'trust' | 'governance' | 'fission' | 'fusion'
const VALID_TABS: ValidTab[] = [..., 'fusion']
```

- [ ] **Import FusionTab**:

```typescript
import FusionTab from '@/components/community/tabs/FusionTab'
```

- [ ] **Add tab button** in the nav (after fission):

```tsx
<button onClick={() => setActiveTab('fusion')} className={tabBtnClass('fusion')}>
  Fusion
  {community.active_fusion_proposal && <span className="ml-1 text-xs text-amber-600">●</span>}
</button>
```

- [ ] **Render FusionTab** in the tab panel area (after the fission panel):

```tsx
{activeTab === 'fusion' && (
  <FusionTab
    community={community}
    currentUserId={currentUserId}
    isAdmin={isAdmin}
    onRefresh={refetchCommunity}
  />
)}
```

- [ ] **Final frontend build check**:

```bash
cd apps/frontend && npx tsc --noEmit && npm run build 2>&1 | tail -20
```

---

## Task 8: Notification service — fusion events

**Files:**
- Modify: `services/notification-service/src/subscriber.ts`
- Modify: `services/notification-service/src/notificationTemplates.ts`

- [ ] **Add `fusion_vote_started` to `NotificationType` union** in notificationTemplates.ts

- [ ] **Add template for `fusion_vote_started`**:

```typescript
fusion_vote_started: {
  title: 'Fusion Vote Open',
  body: (data: any) => `Your community is voting on merging with another community to form "${data.merged_community_name}". Vote before ${new Date(data.voting_ends_at).toLocaleDateString()}.`,
  link: (data: any) => `/communities/${data.community_a_id}?tab=fusion`,
},
```

Since fusion involves two communities, emit two notifications — one for community A members and one for community B members. The subscriber should fire for both `community_a_id` and `community_b_id`.

- [ ] **Handle `fusion_vote_started` in subscriber.ts**:

```typescript
case 'fusion_vote_started':
  // Notify A members
  await notifyAllCommunityMembers(data.community_a_id, 'fusion_vote_started', data);
  // Notify B members (same event, link points to B's fusion tab)
  await notifyAllCommunityMembers(data.community_b_id, 'fusion_vote_started', {
    ...data, community_a_id: data.community_b_id,
  });
  break;
```

- [ ] **TypeScript check**:

```bash
cd services/notification-service && npx tsc --noEmit
```

---

## Task 9: User guide + landing page docs + ADR

**Files:**
- Create: `docs/adr/ADR-058-fusion-mechanism.md`
- Create: `apps/landing/src/data/docs/concepts/adr-058-fusion-mechanism.json`
- Create: `apps/landing/src/data/docs/guides/fusion.json`
- Modify: `apps/landing/src/data/docs/nav.json`
- Modify: `scripts/generate-docs.ts`

- [ ] **Write `docs/adr/ADR-058-fusion-mechanism.md`**

```markdown
# ADR-058: Fusion Mechanism

**Status**: Implemented
**Date**: 2026-05-27
**Deciders**: Ravi Chavali

## Context

Fission (ADR-057) allows a community to split into two. Fusion is the symmetric inverse — two communities voluntarily merge into one. Both mechanisms complete the community lifecycle toolkit in the v10.0 Trust Network arc.

## Decision

Fusion is bilateral and consensual at every step:
1. **Proposal**: Admin A initiates, naming the merged community.
2. **Acceptance**: Admin B accepts or rejects.
3. **Parallel vote**: Each community votes independently; both must pass 60% quorum + 60% approval.
4. **Execution**: Either admin executes. A new merged community is created.

On execution: all active members are added to the merged community; trust edges from both originals are copied with 0.70 carry factor; karma records from both are copied. Original communities receive `status='merged'`. Two `fusion_origin` community_links are created (merged↔A, merged↔B).

## Trust Carry Factor (0.70)

Fission uses 0.40 — low, because the split severs relationships. Fusion uses 0.70 — higher, because the merge is consensual and the member base is actively choosing to come together. Trust history should be preserved with high fidelity.

## Rationale

- Bilateral consent ensures no community is absorbed against its will.
- Parallel votes preserve each community's democratic sovereignty.
- New merged community (rather than absorption) is symmetric with fission and avoids privileging one community's identity over the other.
- Trust and karma inheritance reduces the activation energy for fusion, making it a viable governance tool rather than a last resort.
```

- [ ] **Write `apps/landing/src/data/docs/concepts/adr-058-fusion-mechanism.json`**

Use the JSON format from CLAUDE.md:
```json
{
  "slug": "adr-058-fusion-mechanism",
  "number": "058",
  "title": "ADR-058: Fusion Mechanism",
  "status": "implemented",
  "description": "**Status**: Implemented",
  "content": "...(full markdown from the ADR)...",
  "filename": "ADR-058-fusion-mechanism.md"
}
```

- [ ] **Write `apps/landing/src/data/docs/guides/fusion.json`**

```json
{
  "slug": "fusion",
  "title": "Community Fusion",
  "description": "How two Karmyq communities can propose, vote on, and execute a merger into a single new community.",
  "content": "# Community Fusion\n\n..."
}
```

Content should cover: who can propose, acceptance flow, parallel vote, execution, what members see, what happens to trust and karma, the merged community.

- [ ] **Add slugs to the hardcoded list in `scripts/generate-docs.ts`** (prevents nav.json from reverting on build)

- [ ] **Add entries to `apps/landing/src/data/docs/nav.json`**:
  - Under "User Guides": `{ "title": "Community Fusion", "slug": "fusion" }`
  - Under "Architecture Decisions": `{ "title": "ADR-058: Fusion Mechanism", "slug": "adr-058-fusion-mechanism" }`

- [ ] **Verify nav.json still has the entries after grep**:

```bash
grep -n "fusion\|adr-058" apps/landing/src/data/docs/nav.json
```

- [ ] **Stage landing page docs** (they're in .gitignore):

```bash
git add -f apps/landing/src/data/docs/
```

---

## Task 10: CONTEXT.md + registry.json + TDD integration test

**Files:**
- Modify: `services/community-service/CONTEXT.md`
- Modify: `services/registry.json`
- Create: `services/community-service/tests/tdd/sprint-70-fusion.test.ts`

- [ ] **Update `services/community-service/CONTEXT.md`** — add fusion endpoints to "API Endpoints" section and `fusion_proposals` / `fusion_votes` to "Database Schema"

- [ ] **Update `services/registry.json`** — add fusion endpoints and `fusion_vote_started` event

- [ ] **Write TDD test** at `services/community-service/tests/tdd/sprint-70-fusion.test.ts`

Test the following against a real DB connection:
1. Create a fusion proposal — verify proposal row created with status='pending_acceptance'
2. Admin B accept — verify status='discussion'
3. Admin B reject (separate proposal) — verify status='rejected'
4. Start vote — verify status='voting', voting_ends_at set
5. Cast votes from both communities until both pass threshold — verify status auto-advances to 'approved'
6. Execute fusion — verify: merged community exists, both originals status='merged', members migrated, trust edges copied with 0.70 factor, karma records copied, fusion_origin links created

- [ ] **Run TDD test**:

```bash
cd services/community-service && npm run test:tdd 2>&1 | tail -30
```

- [ ] **Run feedback:check**:

```bash
npm run feedback:check
```

---

## Task 11: Type check + pre-push verification

- [ ] **Full type check across all touched services**:

```bash
cd services/community-service && npx tsc --noEmit
cd apps/frontend && npx tsc --noEmit
cd services/notification-service && npx tsc --noEmit
```

- [ ] **Run unit + regression tests**:

```bash
npm test
```

- [ ] **Run TDD tests**:

```bash
npm run test:tdd 2>&1 | grep -E "PASS|FAIL|sprint-70"
```

- [ ] **Run feedback check**:

```bash
npm run feedback:check
```

- [ ] **Verify nav.json fusion entries still present** (guards against revert bug):

```bash
grep -n "fusion\|adr-058" apps/landing/src/data/docs/nav.json
```

- [ ] **Commit all changes**:

```bash
git add claude.md services/ apps/ docs/ infrastructure/ scripts/
git add -f apps/landing/src/data/docs/
git commit -m "feat(fusion): Sprint 70 — community fusion mechanism"
```

---

## Task 12: Merge + Deploy

Use the `/deploy` skill.

- [ ] **Merge to master**:

```bash
git checkout master
git merge feature/sprint-70-fusion
git push origin master
```

- [ ] **Monitor GitHub Actions** — watch for green on the CI pipeline

- [ ] **Run migration on demo server** (SSH required — migration must run manually):

```bash
ssh ubuntu@karmyq.com
cd ~/karmyq
psql $DATABASE_URL -f infrastructure/postgres/migrations/20260527-fusion.sql
```

- [ ] **Smoke test on karmyq.com**:
  - Log in as two admins in different communities
  - Admin A: navigate to a community → Fusion tab → Propose Fusion
  - Admin B: navigate to their community → Fusion tab → Accept
  - Start Vote → both admins vote yes → confirm auto-approval → Execute
  - Verify merged community appears and originals show status='merged'

- [ ] **Update handoff** to reflect Sprint 70 complete and Sprint 71 (Polish) as next
