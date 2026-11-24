import express, { Response } from 'express';
import { pool } from '../config/database';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '@karmyq/shared/middleware/auth';
import { sendError, sendSuccess } from '@karmyq/shared';
import { acceptInvitation, InvitationAcceptanceError } from '../services/invitationAcceptance';
import { isUuid } from '../services/communityContext';

const router = express.Router();

// POST /invitations/generate - Generate invitation code
router.post('/generate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const communityId = req.headers['x-community-id'] as string || req.user?.currentCommunityId;

    if (!userId || !communityId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Get user's name for code generation
    const userResult = await pool.query(
      'SELECT name FROM auth.users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const userName = userResult.rows[0].name;
    const year = new Date().getFullYear();

    // Generate invitation code using database function
    const codeResult = await pool.query(
      'SELECT auth.generate_invitation_code($1, $2) as code',
      [userName, year]
    );

    const invitationCode = codeResult.rows[0].code;

    // Create invitation record (without invitee yet)
    const invitationResult = await pool.query(
      `INSERT INTO auth.user_invitations
       (inviter_id, invitee_id, community_id, invitation_code, invitation_method)
       VALUES ($1, NULL, $2, $3, 'link')
       ON CONFLICT (invitation_code) DO UPDATE SET invitation_code = EXCLUDED.invitation_code
       RETURNING id, invitation_code, invited_at`,
      [userId, communityId, invitationCode]
    );

    const invitation = invitationResult.rows[0];

    // Update inviter stats
    await pool.query(
      `INSERT INTO auth.inviter_stats (user_id, community_id, total_invitations_sent)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, community_id) DO UPDATE
       SET total_invitations_sent = auth.inviter_stats.total_invitations_sent + 1,
           last_computed = NOW()`,
      [userId, communityId]
    );

    logger.info('Invitation code generated', {
      userId,
      communityId,
      invitationCode,
    });

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    res.json({
      success: true,
      data: {
        code: invitationCode,
        url: `${baseUrl}/invite/${invitationCode}`,
        created_at: invitation.invited_at,
        expires_at: null, // No expiration for now
      },
    });
  } catch (error) {
    logger.error('Error generating invitation code', error instanceof Error ? error : undefined);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invitation code',
    });
  }
});

// Note: /invitations/validate/:code endpoint is defined in index.ts (public, before auth)
// This is necessary because validation must be accessible without authentication

// POST /invitations/accept - Accept an invitation code (Sprint 145, BUG-106; approved D1–D3).
// One transaction admits, consumes and attributes, or refuses with nothing persisted; an already-active
// invitee gets a no-write 200 with already_member: true and accepted_at: null. Contract:
// services/social-graph-service/CONTEXT.md and src/services/invitationAcceptance.ts.
router.post('/accept', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!isUuid(userId)) return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
  const invitationCode = req.body?.invitation_code;
  if (typeof invitationCode !== 'string' || invitationCode.trim() === '') {
    return sendError(res, 'VALIDATION_ERROR', 'invitation_code must be a non-empty string', 400);
  }

  try {
    const result = await acceptInvitation({ userId, invitationCode });
    return sendSuccess(res, result);
  } catch (error) {
    if (error instanceof InvitationAcceptanceError) return sendError(res, error.code, error.message, error.status);
    logger.error('Error accepting invitation', error instanceof Error ? error : new Error(String(error)),
      { route: 'POST /invitations/accept', userId });
    return sendError(res, 'INTERNAL_ERROR', 'Failed to accept invitation', 500);
  }
});

// GET /invitations - Get user's invitation history
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const communityId = req.headers['x-community-id'] as string || req.user?.currentCommunityId;

    if (!userId || !communityId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Get invitations sent by this user
    const sentResult = await pool.query(
      `SELECT
         ui.id,
         ui.invitation_code,
         ui.invited_at,
         ui.invitation_accepted_at,
         u.id as invitee_id,
         u.name as invitee_name
       FROM auth.user_invitations ui
       LEFT JOIN auth.users u ON ui.invitee_id = u.id
       WHERE ui.inviter_id = $1 AND ui.community_id = $2
       ORDER BY ui.invited_at DESC`,
      [userId, communityId]
    );

    // Get invitation received by this user
    const receivedResult = await pool.query(
      `SELECT
         ui.id,
         ui.invitation_code,
         ui.invited_at,
         ui.invitation_accepted_at,
         u.id as inviter_id,
         u.name as inviter_name
       FROM auth.user_invitations ui
       JOIN auth.users u ON ui.inviter_id = u.id
       WHERE ui.invitee_id = $1 AND ui.community_id = $2
       LIMIT 1`,
      [userId, communityId]
    );

    res.json({
      success: true,
      data: {
        sent: sentResult.rows.map(row => ({
          id: row.id,
          invitation_code: row.invitation_code,
          invited_at: row.invited_at,
          accepted_at: row.invitation_accepted_at,
          // Sprint 112 (ADR-082): invitee identity only — no invitee karma.
          invitee: row.invitee_id ? {
            id: row.invitee_id,
            name: row.invitee_name,
          } : null,
        })),
        received: receivedResult.rows.length > 0 ? {
          id: receivedResult.rows[0].id,
          invitation_code: receivedResult.rows[0].invitation_code,
          invited_at: receivedResult.rows[0].invited_at,
          accepted_at: receivedResult.rows[0].invitation_accepted_at,
          inviter: {
            id: receivedResult.rows[0].inviter_id,
            name: receivedResult.rows[0].inviter_name,
          },
        } : null,
      },
    });
  } catch (error) {
    logger.error('Error fetching invitations', error instanceof Error ? error : undefined);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invitations',
    });
  }
});

// GET /invitations/stats - Get inviter stats for current user
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const communityId = req.headers['x-community-id'] as string || req.user?.currentCommunityId;

    if (!userId || !communityId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Sprint 112 (ADR-082): inviter gamification stats omit avg_invitee_karma and
    // avg_invitee_trust_score — these are aggregates of OTHER members' exact reputation. Counts,
    // acceptance rate, network size, bridge score, and the inviter's own tier may remain.
    const statsResult = await pool.query(
      `SELECT
         total_invitations_sent,
         total_invitations_accepted,
         acceptance_rate,
         total_invitee_exchanges,
         total_network_size,
         bridge_score,
         inviter_tier,
         tier_updated_at
       FROM auth.inviter_stats
       WHERE user_id = $1 AND community_id = $2`,
      [userId, communityId]
    );

    if (statsResult.rows.length === 0) {
      // No stats yet, return defaults
      return res.json({
        success: true,
        data: {
          total_invitations_sent: 0,
          total_invitations_accepted: 0,
          acceptance_rate: 0,
          total_network_size: 0,
          inviter_tier: 'bronze',
        },
      });
    }

    res.json({
      success: true,
      data: statsResult.rows[0],
    });
  } catch (error) {
    logger.error('Error fetching inviter stats', error instanceof Error ? error : undefined);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inviter stats',
    });
  }
});

export default router;
