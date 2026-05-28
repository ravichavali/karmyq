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
    `SELECT * FROM communities.fusion_votes
     WHERE proposal_id = $1 AND community_id = $2`,
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
