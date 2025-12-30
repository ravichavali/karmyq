import express, { Request, Response } from 'express';
import cors from 'cors';
import { authMiddleware } from '@karmyq/shared/middleware';
import { logger } from './config/logger';
import { pool } from './config/database';
import invitationRoutes from './routes/invitations';
import pathRoutes from './routes/paths';

const app = express();
const PORT = process.env.PORT || 3010;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Health check (unauthenticated)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'social-graph-service',
    port: PORT,
  });
});

// Public invitation validation endpoint (must be before authMiddleware)
app.get('/invitations/validate/:code', async (req: Request, res: Response) => {
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
       LEFT JOIN communities.communities c ON ui.community_id = c.id
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

// All routes require authentication (except public endpoints above)
app.use(authMiddleware);

// Routes
app.use('/invitations', invitationRoutes);
app.use('/paths', pathRoutes);

// Error handling
app.use((err: Error, req: Request, res: Response, next: Function) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Social Graph Service running on port ${PORT}`);
});

export default app;
