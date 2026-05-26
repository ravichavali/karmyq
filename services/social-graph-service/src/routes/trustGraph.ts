import { Router, Request, Response } from 'express';
import { getTrustGraphForCommunity, getTrustGraphAggregate } from '../services/trustEdgeService';
import { getTrustEdge } from '../database/trustEdgeDb';
import { computeEffectiveWeight } from '../services/trustEdgeService';
import { logger } from '../config/logger';
import { pool } from '../config/database';

const router = Router();

// GET /trust/graph — aggregate ego-network across all of the calling user's communities
// MUST be declared before /:communityId to avoid param matching
router.get('/graph', async (req: Request, res: Response) => {
  try {
    const callingUserId = (req as any).user?.userId;
    const graph = await getTrustGraphAggregate(callingUserId);
    res.json({ success: true, data: graph });
  } catch (error) {
    logger.error('Error fetching aggregate trust graph', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: 'Failed to fetch aggregate trust graph' });
  }
});

// GET /trust/graph/:communityId — ego-network for calling user in a specific community
router.get('/graph/:communityId', async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const callingUserId = (req as any).user?.userId;

    // Verify caller is a member of the community
    const memberCheck = await pool.query(
      `SELECT 1 FROM communities.members
       WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
      [communityId, callingUserId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Not a member of this community',
      });
    }

    const graph = await getTrustGraphForCommunity(communityId, callingUserId);

    res.json({
      success: true,
      data: graph,
    });
  } catch (error) {
    logger.error('Error fetching trust graph', error instanceof Error ? error : undefined);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trust graph',
    });
  }
});

// GET /trust/edge?userA=X&userB=Y&communityId=Z — single edge lookup
router.get('/edge', async (req: Request, res: Response) => {
  try {
    const { userA, userB, communityId } = req.query as {
      userA: string;
      userB: string;
      communityId: string;
    };

    if (!userA || !userB || !communityId) {
      return res.status(400).json({
        success: false,
        message: 'userA, userB, and communityId are required',
      });
    }

    const edge = await getTrustEdge(userA, userB, communityId);

    if (!edge) {
      return res.json({ success: true, data: null });
    }

    res.json({
      success: true,
      data: {
        source: edge.user_id_a,
        target: edge.user_id_b,
        raw_weight: edge.raw_weight,
        effective_weight: computeEffectiveWeight(edge.raw_weight, edge.last_interaction_at),
        match_completed_count: edge.match_completed_count,
        endorsement_count: edge.endorsement_count,
        karma_given_count: edge.karma_given_count,
        event_count: edge.event_count,
        last_interaction_at: edge.last_interaction_at,
      },
    });
  } catch (error) {
    logger.error('Error fetching trust edge', error instanceof Error ? error : undefined);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trust edge',
    });
  }
});

export default router;
