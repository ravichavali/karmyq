import { Router, Request, Response } from 'express';
import { getUserKarma, getUserTrustScore, getCommunityLeaderboard } from '../services/karmaService';
import { query } from '../database/db';

const router = Router();

// GET /reputation/karma/:userId - Get user's karma
router.get('/karma/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { community_id } = req.query;

    const karma = await getUserKarma(userId, community_id as string);

    // Calculate total across all communities
    const total = karma.reduce((sum, k) => sum + parseInt(k.total_karma), 0);

    res.json({
      success: true,
      data: {
        user_id: userId,
        total_karma: total,
        by_community: karma,
      },
    });
  } catch (error: any) {
    console.error('Error fetching karma:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch karma',
      error: error.message,
    });
  }
});

// GET /reputation/trust/:userId/:communityId - Get user's trust score in a community
router.get('/trust/:userId/:communityId', async (req: Request, res: Response) => {
  try {
    const { userId, communityId } = req.params;

    const trustScore = await getUserTrustScore(userId, communityId);

    res.json({
      success: true,
      data: trustScore,
    });
  } catch (error: any) {
    console.error('Error fetching trust score:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trust score',
      error: error.message,
    });
  }
});

// GET /reputation/leaderboard/:communityId - Get community leaderboard
router.get('/leaderboard/:communityId', async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const { limit = 10 } = req.query;

    const leaderboard = await getCommunityLeaderboard(communityId, parseInt(limit as string));

    res.json({
      success: true,
      data: leaderboard,
    });
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard',
      error: error.message,
    });
  }
});

// GET /reputation/history/:userId - Get karma transaction history
router.get('/history/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { community_id, limit = 50, offset = 0 } = req.query;

    let queryText = `
      SELECT
        kr.id,
        kr.points,
        kr.reason,
        kr.related_entity_id,
        kr.created_at,
        kr.community_id,
        c.name as community_name
      FROM reputation.karma_records kr
      LEFT JOIN communities.communities c ON kr.community_id = c.id
      WHERE kr.user_id = $1
    `;

    const params: any[] = [userId];
    let paramCount = 2;

    if (community_id) {
      queryText += ` AND kr.community_id = $${paramCount}`;
      params.push(community_id);
      paramCount++;
    }

    queryText += ` ORDER BY kr.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    });
  } catch (error: any) {
    console.error('Error fetching karma history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch karma history',
      error: error.message,
    });
  }
});

// GET /reputation/badges/:userId - Get user's badges
router.get('/badges/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const result = await query(
      `SELECT * FROM reputation.badges
       WHERE user_id = $1
       ORDER BY earned_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    console.error('Error fetching badges:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch badges',
      error: error.message,
    });
  }
});

export default router;
