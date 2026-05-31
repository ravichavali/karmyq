import { getPool } from '../db-user-loader';
import { ApiClient } from '../api-client';
import { SimulatedUser } from '../types';

function pickVote(): 'yes' | 'abstain' | 'no' {
  const r = Math.random();
  return r < 0.80 ? 'yes' : r < 0.95 ? 'abstain' : 'no';
}

export async function voteOnGovernanceWorkflow(user: SimulatedUser, client: ApiClient): Promise<void> {
  const pool = getPool();

  const memberRes = await pool.query(
    `SELECT community_id, role FROM communities.members WHERE user_id = $1 AND status = 'active'`,
    [user.id]
  );
  const communityIds: string[] = memberRes.rows.map((r: any) => r.community_id);
  if (!communityIds.length) return;
  const adminCommunityIds: string[] = memberRes.rows
    .filter((r: any) => r.role === 'admin')
    .map((r: any) => r.community_id);

  // As an admin, execute any split proposal the community has already voted to
  // 'approved'. Voting auto-approves at quorum (splits.ts), but execution is a
  // separate admin action — without this the over-cap community never actually
  // splits. This closes the autonomous fission loop (ADR-057 / Sprint 78).
  if (adminCommunityIds.length) {
    const approvedRes = await pool.query(
      `SELECT id, community_id FROM communities.split_proposals
       WHERE status = 'approved' AND community_id = ANY($1)`,
      [adminCommunityIds]
    );
    for (const p of approvedRes.rows) {
      await client.executeSplit(p.community_id, p.id).catch(() => null);
    }
  }

  // Vote on active split proposals
  const splitRes = await pool.query(
    `SELECT id, community_id FROM communities.split_proposals WHERE status = 'voting' AND community_id = ANY($1)`,
    [communityIds]
  );
  for (const p of splitRes.rows) {
    const voted = await pool.query(
      `SELECT 1 FROM communities.split_votes WHERE proposal_id = $1 AND user_id = $2`,
      [p.id, user.id]
    );
    if (!voted.rows.length) {
      await client.voteOnSplit(p.community_id, p.id, pickVote()).catch(() => null);
    }
  }

  // Vote on active fusion proposals
  const fusionRes = await pool.query(
    `SELECT id, community_a_id, community_b_id FROM communities.fusion_proposals
     WHERE status = 'voting' AND (community_a_id = ANY($1) OR community_b_id = ANY($1))`,
    [communityIds]
  );
  for (const p of fusionRes.rows) {
    const communityId = communityIds.includes(p.community_a_id) ? p.community_a_id : p.community_b_id;
    const voted = await pool.query(
      `SELECT 1 FROM communities.fusion_votes WHERE proposal_id = $1 AND user_id = $2`,
      [p.id, user.id]
    );
    if (!voted.rows.length) {
      await client.voteOnFusion(communityId, p.id, pickVote()).catch(() => null);
    }
  }
}
