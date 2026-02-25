import { Router, Request, Response } from 'express';
import { getUserKarma, getUserKarmaWithDecay, getUserTrustScore, getCommunityLeaderboard } from '../services/karmaService';
import { query } from '../database/db';
import { authMiddleware, AuthenticatedRequest } from '@karmyq/shared/middleware/auth';

const router = Router();

// GET /reputation/karma/:userId - Get user's karma
router.get('/karma/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { community_id } = req.query;

    const karma = await getUserKarma(userId, community_id as string);

    // Calculate total across all communities
    const total = karma.reduce((sum, k) => sum + parseInt(k.total_karma), 0);

    // Calculate breakdown by reason category
    let breakdownQuery = `
      SELECT
        SUM(CASE WHEN reason = 'Provided help' THEN points ELSE 0 END) as karma_from_giving,
        SUM(CASE WHEN reason = 'Received help' THEN points ELSE 0 END) as karma_from_receiving,
        SUM(CASE WHEN reason NOT IN ('Provided help', 'Received help') THEN points ELSE 0 END) as bonuses
      FROM reputation.karma_records
      WHERE user_id = $1
    `;
    const breakdownParams: any[] = [userId];
    if (community_id) {
      breakdownQuery += ' AND community_id = $2';
      breakdownParams.push(community_id);
    }
    const breakdownResult = await query(breakdownQuery, breakdownParams);
    const breakdown = breakdownResult.rows[0] || {};

    res.json({
      success: true,
      data: {
        user_id: userId,
        total_karma: total,
        karma_from_giving: parseInt(breakdown.karma_from_giving) || 0,
        karma_from_receiving: parseInt(breakdown.karma_from_receiving) || 0,
        bonuses: parseInt(breakdown.bonuses) || 0,
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

// GET /reputation/me/karma - Get current user's karma (authenticated, private)
// Implements minimal karma measurement with decay (ADR-011, Fractal Karma & Trust)
router.get('/me/karma', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { community_id } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!community_id) {
      return res.status(400).json({
        success: false,
        message: 'community_id query parameter required',
      });
    }

    // Calculate karma with decay
    const karmaData = await getUserKarmaWithDecay(userId, community_id as string);

    res.json({
      success: true,
      data: karmaData,
    });
  } catch (error: any) {
    console.error('Error fetching user karma:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch karma',
      error: error.message,
    });
  }
});

export default router;
