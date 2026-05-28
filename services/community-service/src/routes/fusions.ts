import { Router, Response } from 'express';
import pool from '../database/db';
import { publishEvent } from '../events/publisher';
import { executeFusion } from '../services/fusionService';
import {
  insertFusionProposal,
  getFusionProposal,
  getActiveFusionProposalForCommunity,
  updateFusionProposalStatus,
  insertFusionVote,
  getFusionVotesForCommunity,
  getFusionMemberCount,
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

  // Guard: check for active proposal involving either community
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
