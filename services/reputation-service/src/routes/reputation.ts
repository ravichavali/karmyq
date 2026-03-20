import { Router, Request, Response } from 'express';
import { getUserKarma, getUserKarmaWithDecay, getUserTrustScore, getOverallTrustScore, getCommunityLeaderboard, updateTrustScore } from '../services/karmaService';
import { getCommunityTrustScore, } from '../database/communityTrustDb';
import { calculateCommunityTrustScore } from '../services/communityTrustService';
import { getUserBadges } from '../services/badgeService';
import { query } from '../database/db';
import { insertFeedback, hasSubmittedFeedback } from '../database/feedbackDb';
import { authMiddleware, AuthenticatedRequest } from '@karmyq/shared/middleware/auth';
import {
  evaluateUserEvolution,
  getUserEffectiveParams,
  EVOLUTION_SIGNALS,
} from '../services/trustEvolutionService';
import {
  getUserTrustConfig,
  upsertUserTrustConfig,
  getEvolutionLog,
  getCommunityEvolutionConfig,
  updateCommunityEvolutionConfig,
  getEvolutionOptInRate,
  isCrossCommunityParticipant,
} from '../database/trustEvolutionDb';
import {
  getCommunityEvolutionHistory,
  getCommunityEvolutionSummary,
} from '../database/communityEvolutionDb';

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

// GET /reputation/trust/:userId - Get user's overall (weighted average) trust score across all communities
router.get('/trust/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const result = await getOverallTrustScore(userId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error fetching overall trust score:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch overall trust score',
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

// GET /reputation/community-trust/:communityId - Get community trust score (ADR-040)
router.get('/community-trust/:communityId', async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const { recalculate } = req.query;

    // Allow forcing a recalculation via query param (e.g. for admin use)
    if (recalculate === 'true') {
      await calculateCommunityTrustScore(communityId);
    }

    const trustScore = await getCommunityTrustScore(communityId);

    if (!trustScore) {
      // No score yet — calculate on demand
      await calculateCommunityTrustScore(communityId);
      const freshScore = await getCommunityTrustScore(communityId);
      return res.json({ success: true, data: freshScore });
    }

    res.json({ success: true, data: trustScore });
  } catch (error: any) {
    console.error('Error fetching community trust score:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch community trust score',
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

// POST /reputation/feedback - Submit private feedback rating after a completed match
// Ratings are internal trust signals — never exposed to users (ADR-036)
router.post('/feedback', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fromUserId = req.user?.userId;
    if (!fromUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { match_id, to_user_id, community_id, rating } = req.body;

    if (!match_id || !to_user_id || !community_id) {
      return res.status(400).json({ success: false, message: 'match_id, to_user_id, and community_id are required' });
    }

    const ratingNum = parseInt(rating, 10);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ success: false, message: 'rating must be an integer between 1 and 5' });
    }

    // Prevent double-submission
    const alreadySubmitted = await hasSubmittedFeedback(fromUserId, match_id);
    if (alreadySubmitted) {
      return res.status(409).json({ success: false, message: 'Feedback already submitted for this match' });
    }

    // Store feedback
    await insertFeedback(fromUserId, to_user_id, match_id, community_id, ratingNum);

    // Recompute trust score for the rated user (full ADR-037 formula)
    const score = await updateTrustScore(to_user_id, community_id);

    // Sprint 30: Evolution signal for cross-community feedback
    try {
      const crossComm = await isCrossCommunityParticipant(fromUserId, community_id);
      if (crossComm && (ratingNum >= 4 || ratingNum <= 2)) {
        const signal = ratingNum >= 4
          ? EVOLUTION_SIGNALS.CROSS_COMMUNITY_POSITIVE_FEEDBACK
          : EVOLUTION_SIGNALS.CROSS_COMMUNITY_NEGATIVE_FEEDBACK;
        // Use match_id as triggerEventId — insertFeedback returns void (no feedback row ID)
        await evaluateUserEvolution(to_user_id, community_id, signal, { triggerEventId: match_id });
      }
    } catch (evolutionErr) {
      console.error('[trust-evolution] Error in feedback evolution:', evolutionErr);
    }

    res.json({ success: true, data: { score } });
  } catch (error: any) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ success: false, message: 'Failed to submit feedback', error: error.message });
  }
});

// GET /reputation/users/:userId/badges - Get prestige badges for a user (public)
router.get('/users/:userId/badges', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const badges = await getUserBadges(userId);
    res.json({ success: true, data: badges });
  } catch (error: any) {
    console.error('Error fetching badges:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch badges', error: error.message });
  }
});

// ─── Trust Evolution Routes (Sprint 30) ───────────────────────────────────────

// GET /reputation/trust-config/:userId/:communityId/history
// Auth: self OR community admin
// NOTE: Registered BEFORE /trust-config/:userId/:communityId to avoid route shadowing
router.get('/trust-config/:userId/:communityId/history', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, communityId } = req.params;
    const memberships = req.user?.communities ?? [];
    const isSelf = req.user?.userId === userId;
    const isAdmin = memberships.some((m: any) => m.id === communityId && m.role === 'admin');
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 100);
    const offset = parseInt(req.query.offset as string || '0', 10);
    const history = await getEvolutionLog(userId, communityId, limit, offset);
    return res.json({ success: true, data: history });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /reputation/trust-config/:userId/:communityId
// Auth: self OR community admin
router.get('/trust-config/:userId/:communityId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, communityId } = req.params;
    const memberships = req.user?.communities ?? [];
    const isSelf = req.user?.userId === userId;
    const isAdmin = memberships.some((m: any) => m.id === communityId && m.role === 'admin');
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const [userConfig, effectiveParams, communityEvolution] = await Promise.all([
      getUserTrustConfig(userId, communityId),
      getUserEffectiveParams(userId, communityId),
      getCommunityEvolutionConfig(communityId),
    ]);
    return res.json({
      success: true,
      data: {
        user_config: userConfig,
        effective_params: effectiveParams,
        community_evolution_enabled: communityEvolution.community_evolution_enabled,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /reputation/trust-config/:userId/:communityId
// Auth: self only
router.put('/trust-config/:userId/:communityId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, communityId } = req.params;
    if (req.user?.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const { evolution_enabled } = req.body;
    if (typeof evolution_enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'evolution_enabled must be a boolean' });
    }
    await upsertUserTrustConfig(userId, communityId, { evolution_enabled });
    return res.json({ success: true, data: { evolution_enabled } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /reputation/communities/:communityId/trust-evolution
// Auth: community admin only
router.get('/communities/:communityId/trust-evolution', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communityId } = req.params;
    const memberships = req.user?.communities ?? [];
    const isAdmin = memberships.some((m: any) => m.id === communityId && m.role === 'admin');
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const [config, optInRate] = await Promise.all([
      getCommunityEvolutionConfig(communityId),
      getEvolutionOptInRate(communityId),
    ]);
    return res.json({
      success: true,
      data: { ...config, opted_in_rate: optInRate },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /reputation/communities/:communityId/trust-evolution
// Auth: community admin only
router.put('/communities/:communityId/trust-evolution', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communityId } = req.params;
    const memberships = req.user?.communities ?? [];
    const isAdmin = memberships.some((m: any) => m.id === communityId && m.role === 'admin');
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const { community_evolution_enabled, cross_community_prior } = req.body;
    const patch: { community_evolution_enabled?: boolean; cross_community_prior?: number } = {};
    if (typeof community_evolution_enabled === 'boolean') patch.community_evolution_enabled = community_evolution_enabled;
    if (typeof cross_community_prior === 'number') {
      if (cross_community_prior < 0.05 || cross_community_prior > 0.95) {
        return res.status(400).json({ success: false, message: 'cross_community_prior must be between 0.05 and 0.95' });
      }
      patch.cross_community_prior = cross_community_prior;
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }
    await updateCommunityEvolutionConfig(communityId, patch);
    return res.json({ success: true, data: patch });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /reputation/community/:communityId/evolution/history
router.get('/community/:communityId/evolution/history', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communityId } = req.params;
    const memberships = req.user?.communities ?? [];
    const isAdmin = memberships.some((m: any) => m.id === communityId && m.role === 'admin');
    if (!isAdmin) return res.status(403).json({ success: false, message: 'Admin only' });

    const limit = Math.min(parseInt((req.query.limit as string) ?? '50', 10), 100);
    const offset = parseInt((req.query.offset as string) ?? '0', 10);
    const history = await getCommunityEvolutionHistory(communityId, limit, offset);
    return res.json({ success: true, data: history });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /reputation/community/:communityId/evolution/summary
router.get('/community/:communityId/evolution/summary', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communityId } = req.params;
    const memberships = req.user?.communities ?? [];
    const isAdmin = memberships.some((m: any) => m.id === communityId && m.role === 'admin');
    if (!isAdmin) return res.status(403).json({ success: false, message: 'Admin only' });

    const summary = await getCommunityEvolutionSummary(communityId);
    return res.json({ success: true, data: summary });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /reputation/community/:communityId/evolution/toggle
router.put('/community/:communityId/evolution/toggle', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communityId } = req.params;
    const memberships = req.user?.communities ?? [];
    const isAdmin = memberships.some((m: any) => m.id === communityId && m.role === 'admin');
    if (!isAdmin) return res.status(403).json({ success: false, message: 'Admin only' });

    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'enabled (boolean) required' });
    }
    await updateCommunityEvolutionConfig(communityId, { community_evolution_enabled: enabled });
    return res.json({ success: true, data: { community_evolution_enabled: enabled } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
