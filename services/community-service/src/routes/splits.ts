import { Router, Response } from 'express';
import pool from '../database/db';
import {
  getProposal,
  getActiveSplitProposal,
  getAssignments,
  getVotes,
  insertProposal,
  insertAssignments,
  updateAssignments,
  insertVote,
  updateProposalStatus,
} from '../database/splitsDb';
import { clusterCommunityMembers, executeSplit } from '../services/fissionService';

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

// POST /communities/:communityId/splits — admin creates proposal + seeds member assignments
router.post('/:communityId/splits', async (req: any, res: Response) => {
  const { communityId } = req.params;
  const userId = req.user?.userId;

  if (!isAdmin(req, communityId)) {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }

  const { group_a_name, group_b_name, rationale } = req.body;
  if (!group_a_name || !group_b_name) {
    return res.status(400).json({ success: false, message: 'group_a_name and group_b_name are required' });
  }

  try {
    const proposal = await insertProposal({
      communityId,
      proposedBy: userId,
      splitType: 'admin_initiated',
      rationale: rationale ?? '',
      groupAName: group_a_name,
      groupBName: group_b_name,
    });

    const { groupA, groupB } = await clusterCommunityMembers(communityId, pool);
    const assignments = [
      ...groupA.map((uid) => ({ userId: uid, assignedTo: 'group_a', clusterSuggestion: 'group_a' })),
      ...groupB.map((uid) => ({ userId: uid, assignedTo: 'group_b', clusterSuggestion: 'group_b' })),
    ];
    await insertAssignments(proposal.id, assignments);

    res.status(201).json({ success: true, data: { proposal, assignments } });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'An active split proposal already exists for this community' });
    }
    console.error('[splits] createSplitProposal error:', err);
    res.status(500).json({ success: false, message: 'Failed to create split proposal' });
  }
});

// GET /communities/:communityId/splits/:splitId — get proposal detail + assignments + vote tally
router.get('/:communityId/splits/:splitId', async (req: any, res: Response) => {
  const { communityId, splitId } = req.params;
  const userId = req.user?.userId;

  if (!(await isMember(userId, communityId))) {
    return res.status(403).json({ success: false, message: 'Must be an active member' });
  }

  try {
    const [proposal, assignments, votes] = await Promise.all([
      getProposal(splitId),
      getAssignments(splitId),
      getVotes(splitId),
    ]);

    if (!proposal || proposal.community_id !== communityId) {
      return res.status(404).json({ success: false, message: 'Split proposal not found' });
    }

    const totalMembers = assignments.length;
    const votedCount = votes.length;
    const weightedYes = votes.filter((v: any) => v.vote === 'yes').reduce((s: number, v: any) => s + parseFloat(v.prestige_weight), 0);
    const weightedTotal = votes.reduce((s: number, v: any) => s + parseFloat(v.prestige_weight), 0);

    res.json({
      success: true,
      data: {
        proposal,
        assignments,
        vote_tally: {
          total_members: totalMembers,
          voted_count: votedCount,
          quorum_pct: proposal.quorum_pct,
          approval_pct: proposal.approval_pct,
          weighted_yes: weightedYes,
          weighted_total: weightedTotal,
          approval_ratio: weightedTotal > 0 ? Math.round((weightedYes / weightedTotal) * 100) : 0,
          quorum_ratio: totalMembers > 0 ? Math.round((votedCount / totalMembers) * 100) : 0,
        },
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch split proposal' });
  }
});

// PUT /communities/:communityId/splits/:splitId/assignments — admin bulk-update
router.put('/:communityId/splits/:splitId/assignments', async (req: any, res: Response) => {
  const { communityId, splitId } = req.params;

  if (!isAdmin(req, communityId)) {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }

  const changes: Array<{ userId: string; assignedTo: string }> = req.body;
  if (!Array.isArray(changes)) {
    return res.status(400).json({ success: false, message: 'Body must be an array of {userId, assignedTo}' });
  }

  try {
    await updateAssignments(splitId, changes);
    const updated = await getAssignments(splitId);
    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update assignments' });
  }
});

// POST /communities/:communityId/splits/:splitId/start-vote — transition discussion → voting
router.post('/:communityId/splits/:splitId/start-vote', async (req: any, res: Response) => {
  const { communityId, splitId } = req.params;

  if (!isAdmin(req, communityId)) {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }

  try {
    const proposal = await getProposal(splitId);
    if (!proposal || proposal.community_id !== communityId) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }
    if (proposal.status !== 'discussion') {
      return res.status(422).json({ success: false, message: 'Proposal must be in discussion status' });
    }

    // Voting window: 7 days
    const votingEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const updated = await updateProposalStatus(splitId, 'voting', { voting_ends_at: votingEndsAt });
    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to start vote' });
  }
});

// POST /communities/:communityId/splits/:splitId/vote — member casts vote
router.post('/:communityId/splits/:splitId/vote', async (req: any, res: Response) => {
  const { communityId, splitId } = req.params;
  const userId = req.user?.userId;

  if (!(await isMember(userId, communityId))) {
    return res.status(403).json({ success: false, message: 'Must be an active member' });
  }

  const { vote } = req.body;
  if (!['yes', 'no', 'abstain'].includes(vote)) {
    return res.status(400).json({ success: false, message: 'vote must be yes, no, or abstain' });
  }

  try {
    const proposal = await getProposal(splitId);
    if (!proposal || proposal.community_id !== communityId) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }
    if (proposal.status !== 'voting') {
      return res.status(422).json({ success: false, message: 'Voting is not open for this proposal' });
    }

    // Prestige weight = community-scoped trust score
    const trustRes = await pool.query(
      `SELECT COALESCE(SUM(raw_weight), 0) AS trust_score
       FROM social_graph.trust_edges
       WHERE community_id = $1 AND (user_id_a = $2 OR user_id_b = $2)`,
      [communityId, userId]
    );
    const prestigeWeight = Math.max(1.0, parseFloat(trustRes.rows[0]?.trust_score) || 1.0);

    await insertVote(splitId, userId, vote, prestigeWeight);

    // Auto-approve if quorum + approval thresholds met
    const votes = await getVotes(splitId);
    const assignments = await getAssignments(splitId);
    const totalMembers = assignments.length;
    const votedCount = votes.length;
    const weightedYes = votes.filter((v: any) => v.vote === 'yes').reduce((s: number, v: any) => s + parseFloat(v.prestige_weight), 0);
    const weightedTotal = votes.reduce((s: number, v: any) => s + parseFloat(v.prestige_weight), 0);
    const quorumMet = totalMembers > 0 && (votedCount / totalMembers) * 100 >= proposal.quorum_pct;
    const approvalMet = weightedTotal > 0 && (weightedYes / weightedTotal) * 100 >= proposal.approval_pct;

    if (quorumMet && approvalMet) {
      await updateProposalStatus(splitId, 'approved');
    }

    res.json({ success: true, data: { vote, prestige_weight: prestigeWeight } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to cast vote' });
  }
});

// POST /communities/:communityId/splits/:splitId/execute — admin executes approved split
router.post('/:communityId/splits/:splitId/execute', async (req: any, res: Response) => {
  const { communityId, splitId } = req.params;
  const userId = req.user?.userId;

  if (!isAdmin(req, communityId)) {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }

  try {
    const { childAId, childBId } = await executeSplit(splitId, userId, pool);
    res.json({ success: true, data: { child_community_a_id: childAId, child_community_b_id: childBId } });
  } catch (err: any) {
    if (err.message === 'Proposal must be in approved status') {
      return res.status(422).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: 'Failed to execute split' });
  }
});

// Also expose the active proposal for a community (used by GET /communities/:id)
export async function getActiveSplitProposalForCommunity(communityId: string) {
  return getActiveSplitProposal(communityId);
}

export default router;
