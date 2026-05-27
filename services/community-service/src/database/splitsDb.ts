import pool from './db';

export async function getProposal(splitId: string) {
  const res = await pool.query(
    `SELECT * FROM communities.split_proposals WHERE id = $1`,
    [splitId]
  );
  return res.rows[0] ?? null;
}

export async function getActiveSplitProposal(communityId: string) {
  const res = await pool.query(
    `SELECT id, status, group_a_name, group_b_name, rationale, voting_ends_at, created_at
     FROM communities.split_proposals
     WHERE community_id = $1 AND status NOT IN ('executed', 'rejected')
     LIMIT 1`,
    [communityId]
  );
  return res.rows[0] ?? null;
}

export async function getAssignments(splitId: string) {
  const res = await pool.query(
    `SELECT sma.user_id, sma.assigned_to, sma.cluster_suggestion, sma.admin_overridden,
            u.name as user_name
     FROM communities.split_member_assignments sma
     JOIN auth.users u ON u.id = sma.user_id
     WHERE sma.proposal_id = $1
     ORDER BY u.name ASC`,
    [splitId]
  );
  return res.rows;
}

export async function getVotes(splitId: string) {
  const res = await pool.query(
    `SELECT user_id, vote, prestige_weight, voted_at
     FROM communities.split_votes
     WHERE proposal_id = $1`,
    [splitId]
  );
  return res.rows;
}

export async function insertProposal(data: {
  communityId: string;
  proposedBy: string;
  splitType: string;
  rationale: string;
  groupAName: string;
  groupBName: string;
}) {
  const res = await pool.query(
    `INSERT INTO communities.split_proposals
       (community_id, proposed_by, split_type, rationale, group_a_name, group_b_name)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.communityId, data.proposedBy, data.splitType, data.rationale, data.groupAName, data.groupBName]
  );
  return res.rows[0];
}

export async function insertAssignments(
  proposalId: string,
  assignments: Array<{ userId: string; assignedTo: string; clusterSuggestion: string }>
) {
  if (!assignments.length) return;
  const values = assignments.map((_a, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`).join(', ');
  const params: any[] = [proposalId];
  for (const a of assignments) {
    params.push(a.userId, a.assignedTo, a.clusterSuggestion);
  }
  await pool.query(
    `INSERT INTO communities.split_member_assignments (proposal_id, user_id, assigned_to, cluster_suggestion)
     VALUES ${values}`,
    params
  );
}

export async function updateAssignments(
  proposalId: string,
  changes: Array<{ userId: string; assignedTo: string }>
) {
  for (const change of changes) {
    await pool.query(
      `UPDATE communities.split_member_assignments
       SET assigned_to = $1, admin_overridden = TRUE
       WHERE proposal_id = $2 AND user_id = $3`,
      [change.assignedTo, proposalId, change.userId]
    );
  }
}

export async function insertVote(
  proposalId: string,
  userId: string,
  vote: string,
  prestigeWeight: number
) {
  const res = await pool.query(
    `INSERT INTO communities.split_votes (proposal_id, user_id, vote, prestige_weight)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (proposal_id, user_id) DO UPDATE
       SET vote = EXCLUDED.vote, prestige_weight = EXCLUDED.prestige_weight, voted_at = NOW()
     RETURNING *`,
    [proposalId, userId, vote, prestigeWeight]
  );
  return res.rows[0];
}

export async function updateProposalStatus(
  splitId: string,
  status: string,
  extra?: Record<string, any>
) {
  const setClauses = ['status = $2'];
  const params: any[] = [splitId, status];

  if (extra?.voting_ends_at) {
    params.push(extra.voting_ends_at);
    setClauses.push(`voting_ends_at = $${params.length}`);
  }
  if (extra?.executed_at) {
    params.push(extra.executed_at);
    setClauses.push(`executed_at = $${params.length}`);
  }
  if (extra?.child_community_a_id) {
    params.push(extra.child_community_a_id);
    setClauses.push(`child_community_a_id = $${params.length}`);
  }
  if (extra?.child_community_b_id) {
    params.push(extra.child_community_b_id);
    setClauses.push(`child_community_b_id = $${params.length}`);
  }

  const res = await pool.query(
    `UPDATE communities.split_proposals SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  return res.rows[0];
}
