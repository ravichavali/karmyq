import express from 'express';
import { query } from '../database/db';
import { authMiddleware, AuthenticatedRequest } from '@karmyq/shared/middleware';
import {
  sendSuccess,
  sendNotFound,
  sendForbidden,
  sendValidationError,
  sendInternalError,
  HTTP_STATUS
} from '@karmyq/shared/utils/response';

const router = express.Router();

// GET /users/:userId - Get user profile
router.get('/:userId', async (req: any, res) => {
  try {
    const { userId } = req.params;

    const result = await query(
      'SELECT id, email, name, bio, avatar_url, created_at, updated_at FROM auth.users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return sendNotFound(res, 'User', { requestId: req.id });
    }

    sendSuccess(res, result.rows[0], HTTP_STATUS.OK, { requestId: req.id });
  } catch (error) {
    console.error('Error fetching user:', error);
    sendInternalError(res, 'Failed to fetch user', error instanceof Error ? error : undefined, { requestId: req.id });
  }
});

// PUT /users/:userId - Update user profile
router.put('/:userId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const { name, bio, avatar_url } = req.body;

    // Check if user is updating their own profile
    if (req.user.userId !== userId) {
      return sendForbidden(res, 'You can only update your own profile', { requestId: (req as any).id });
    }

    const result = await query(
      `UPDATE auth.users
       SET name = COALESCE($1, name),
           bio = COALESCE($2, bio),
           avatar_url = COALESCE($3, avatar_url),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, email, name, bio, avatar_url, created_at, updated_at`,
      [name, bio, avatar_url, userId]
    );

    if (result.rows.length === 0) {
      return sendNotFound(res, 'User', { requestId: (req as any).id });
    }

    sendSuccess(res, result.rows[0], HTTP_STATUS.OK, { requestId: (req as any).id });
  } catch (error) {
    console.error('Error updating user:', error);
    sendInternalError(res, 'Failed to update user', error instanceof Error ? error : undefined, { requestId: (req as any).id });
  }
});

// GET /users/:userId/skills - Get user's skills
router.get('/:userId/skills', async (req: any, res) => {
  try {
    const { userId } = req.params;

    const result = await query(
      'SELECT id, skill, created_at FROM auth.user_skills WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    sendSuccess(res, result.rows, HTTP_STATUS.OK, { requestId: req.id });
  } catch (error) {
    console.error('Error fetching user skills:', error);
    sendInternalError(res, 'Failed to fetch user skills', error instanceof Error ? error : undefined, { requestId: req.id });
  }
});

// POST /users/:userId/skills - Add a skill to user
router.post('/:userId/skills', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const { skill } = req.body;

    // Check if user is updating their own skills
    if (req.user.userId !== userId) {
      return sendForbidden(res, 'You can only update your own skills', { requestId: (req as any).id });
    }

    if (!skill) {
      return sendValidationError(res, 'Skill is required', undefined, { requestId: (req as any).id });
    }

    const result = await query(
      `INSERT INTO auth.user_skills (user_id, skill)
       VALUES ($1, $2)
       ON CONFLICT (user_id, skill) DO NOTHING
       RETURNING id, skill, created_at`,
      [userId, skill]
    );

    if (result.rows.length === 0) {
      return sendValidationError(res, 'Skill already exists', undefined, { requestId: (req as any).id });
    }

    sendSuccess(res, result.rows[0], HTTP_STATUS.CREATED, { requestId: (req as any).id });
  } catch (error) {
    console.error('Error adding skill:', error);
    sendInternalError(res, 'Failed to add skill', error instanceof Error ? error : undefined, { requestId: (req as any).id });
  }
});

// DELETE /users/:userId/skills/:skillId - Remove a skill from user
router.delete('/:userId/skills/:skillId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, skillId } = req.params;

    // Check if user is updating their own skills
    if (req.user.userId !== userId) {
      return sendForbidden(res, 'You can only update your own skills', { requestId: (req as any).id });
    }

    const result = await query(
      'DELETE FROM auth.user_skills WHERE id = $1 AND user_id = $2 RETURNING id',
      [skillId, userId]
    );

    if (result.rows.length === 0) {
      return sendNotFound(res, 'Skill', { requestId: (req as any).id });
    }

    sendSuccess(res, { message: 'Skill removed successfully' }, HTTP_STATUS.OK, { requestId: (req as any).id });
  } catch (error) {
    console.error('Error removing skill:', error);
    sendInternalError(res, 'Failed to remove skill', error instanceof Error ? error : undefined, { requestId: (req as any).id });
  }
});

// GET /users/me/settings - Get current user's privacy settings
// Implements opt-in karma display (Migration 010, Fractal Karma & Trust)
router.get('/me/settings', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user.userId;

    const result = await query(
      `SELECT user_id, show_my_karma_to_me, created_at, updated_at
       FROM auth.user_privacy_settings
       WHERE user_id = $1`,
      [userId]
    );

    // If no settings exist yet, return defaults
    if (result.rows.length === 0) {
      return sendSuccess(res, {
        user_id: userId,
        show_my_karma_to_me: false,
        created_at: null,
        updated_at: null
      }, HTTP_STATUS.OK, { requestId: (req as any).id });
    }

    sendSuccess(res, result.rows[0], HTTP_STATUS.OK, { requestId: (req as any).id });
  } catch (error) {
    console.error('Error fetching privacy settings:', error);
    sendInternalError(res, 'Failed to fetch privacy settings', error instanceof Error ? error : undefined, { requestId: (req as any).id });
  }
});

// PATCH /users/me/settings - Update current user's privacy settings
// Implements opt-in karma display (Migration 010, Fractal Karma & Trust)
router.patch('/me/settings', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user.userId;
    const { show_my_karma_to_me } = req.body;

    if (typeof show_my_karma_to_me !== 'boolean') {
      return sendValidationError(res, 'show_my_karma_to_me must be a boolean', undefined, { requestId: (req as any).id });
    }

    const result = await query(
      `INSERT INTO auth.user_privacy_settings (user_id, show_my_karma_to_me, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id)
       DO UPDATE SET
         show_my_karma_to_me = $2,
         updated_at = CURRENT_TIMESTAMP
       RETURNING user_id, show_my_karma_to_me, created_at, updated_at`,
      [userId, show_my_karma_to_me]
    );

    sendSuccess(res, result.rows[0], HTTP_STATUS.OK, { requestId: (req as any).id });
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    sendInternalError(res, 'Failed to update privacy settings', error instanceof Error ? error : undefined, { requestId: (req as any).id });
  }
});

export default router;
