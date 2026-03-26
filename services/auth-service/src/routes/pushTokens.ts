import { Router, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from '@karmyq/shared/middleware';
import { query } from '../database/db';

const router = Router();

// POST /auth/push-tokens — register a device push token for the current user
router.post('/push-tokens', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { expo_push_token, platform } = req.body;
  const userId = req.user.userId;

  if (!expo_push_token) {
    return res.status(400).json({ success: false, message: 'expo_push_token required', error: 'MISSING_FIELDS' });
  }

  try {
    await query(
      `INSERT INTO auth.device_push_tokens (user_id, expo_push_token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, expo_push_token) DO UPDATE SET updated_at = NOW()`,
      [userId, expo_push_token, platform ?? null]
    );
    res.json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
});

// DELETE /auth/push-tokens/:token — remove a device push token for the current user
router.delete('/push-tokens/:token', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user.userId;
  try {
    await query(
      `DELETE FROM auth.device_push_tokens
       WHERE user_id = $1 AND expo_push_token = $2`,
      [userId, req.params.token]
    );
    res.json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
});

export default router;
