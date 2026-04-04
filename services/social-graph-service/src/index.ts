import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { authMiddleware, globalRateLimiter, rateLimiters } from '@karmyq/shared/middleware';
import { createLogger, requestLoggingMiddleware } from '@karmyq/shared/utils/logger';
import { logger } from './config/logger';
import { pool } from './config/database';
import invitationRoutes from './routes/invitations';
import pathRoutes from './routes/paths';
import networkRoutes from './routes/network';
import trustCardRoutes from './routes/trustCard';
import { initEventSubscriber } from './events/subscriber';

const app = express();
const PORT = process.env.PORT || 3010;
const sharedLogger = createLogger('social-graph-service');

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(requestLoggingMiddleware(sharedLogger));
app.use(globalRateLimiter);

// Health check (unauthenticated)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'social-graph-service',
    port: PORT,
  });
});

// Public invitation validation endpoint (must be before authMiddleware)
// Strict rate limiting to prevent brute-force enumeration of invitation codes
app.get('/invitations/validate/:code', rateLimiters.auth, async (req: Request, res: Response) => {
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
app.use('/invitations', rateLimiters.standard, invitationRoutes);
app.use('/paths', rateLimiters.readLight, pathRoutes);
app.use('/network', rateLimiters.readLight, networkRoutes);
app.use('/trust-card', rateLimiters.readLight, trustCardRoutes);

// Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
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
app.listen(PORT, async () => {
  logger.info(`Social Graph Service running on port ${PORT}`);
  await initEventSubscriber();
});

export default app;
