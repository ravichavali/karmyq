import express, { Request, Response } from 'express';
import { pool } from '../index';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '@karmyq/shared/middleware/auth';

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
    logger.error('Error generating invitation code', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to generate invitation code',
    });
  }
});

// GET /invitations/validate/:code - Validate invitation code (public endpoint)
router.get('/validate/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Invitation code required',
      });
    }

    // Find the invitation
    const invitationResult = await pool.query(
      `SELECT
         ui.id,
         ui.inviter_id,
         ui.community_id,
         ui.invitation_accepted_at,
         u.name as inviter_name,
         c.name as community_name
       FROM auth.user_invitations ui
       JOIN auth.users u ON ui.inviter_id = u.id
       LEFT JOIN community.communities c ON ui.community_id = c.id
       WHERE ui.invitation_code = $1`,
      [code]
    );

    if (invitationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid invitation code',
      });
    }

    const invitation = invitationResult.rows[0];

    // Check if already accepted
    if (invitation.invitation_accepted_at) {
      return res.status(400).json({
        success: false,
        message: 'This invitation code has already been used',
      });
    }

    logger.info('Invitation validated', {
      invitationCode: code,
      inviterId: invitation.inviter_id,
      communityId: invitation.community_id,
    });

    res.json({
      success: true,
      data: {
        inviter_name: invitation.inviter_name,
        community_id: invitation.community_id,
        community_name: invitation.community_name || 'Karmyq Community',
      },
    });
  } catch (error) {
    logger.error('Error validating invitation', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to validate invitation code',
    });
  }
});

// POST /invitations/accept - Accept an invitation code during signup
router.post('/accept', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { invitation_code } = req.body;

    if (!userId || !invitation_code) {
      return res.status(400).json({
        success: false,
        message: 'User ID and invitation code required',
      });
    }

    // Find the invitation
    const invitationResult = await pool.query(
      `SELECT id, inviter_id, community_id, invitation_accepted_at
       FROM auth.user_invitations
       WHERE invitation_code = $1`,
      [invitation_code]
    );

    if (invitationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid invitation code',
      });
    }

    const invitation = invitationResult.rows[0];

    // Check if already accepted by someone else
    if (invitation.invitation_accepted_at) {
      return res.status(400).json({
        success: false,
        message: 'This invitation code has already been used',
      });
    }

    // Update invitation with invitee and acceptance timestamp
    await pool.query(
      `UPDATE auth.user_invitations
       SET invitee_id = $1,
           invitation_accepted_at = NOW()
       WHERE id = $2`,
      [userId, invitation.id]
    );

    // Update user's invited_by field
    await pool.query(
      `UPDATE auth.users
       SET invited_by = $1,
           invitation_accepted_at = NOW()
       WHERE id = $2`,
      [invitation.inviter_id, userId]
    );

    logger.info('Invitation accepted', {
      inviterId: invitation.inviter_id,
      inviteeId: userId,
      communityId: invitation.community_id,
      invitationCode: invitation_code,
    });

    res.json({
      success: true,
      data: {
        inviter_id: invitation.inviter_id,
        community_id: invitation.community_id,
        accepted_at: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error accepting invitation', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to accept invitation',
    });
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
         u.name as invitee_name,
         COALESCE((
           SELECT SUM(points)
           FROM reputation.karma_records
           WHERE user_id = u.id AND community_id = ui.community_id
         ), 0) as invitee_karma
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
          invitee: row.invitee_id ? {
            id: row.invitee_id,
            name: row.invitee_name,
            karma: row.invitee_karma,
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
    logger.error('Error fetching invitations', { error });
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

    const statsResult = await pool.query(
      `SELECT
         total_invitations_sent,
         total_invitations_accepted,
         acceptance_rate,
         avg_invitee_karma,
         avg_invitee_trust_score,
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
          avg_invitee_karma: 0,
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
    logger.error('Error fetching inviter stats', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inviter stats',
    });
  }
});

export default router;
