import express from 'express';
import { query } from '../database/db';
import { authMiddleware, AuthenticatedRequest } from '../../shared/middleware';

const router = express.Router();

// GET /users/:userId - Get user profile
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await query(
      'SELECT id, email, name, bio, avatar_url, created_at, updated_at FROM auth.users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PUT /users/:userId - Update user profile
router.put('/:userId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const { name, bio, avatar_url } = req.body;

    // Check if user is updating their own profile
    if (req.user.userId !== userId) {
      return res.status(403).json({ error: 'You can only update your own profile' });
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
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// GET /users/:userId/skills - Get user's skills
router.get('/:userId/skills', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await query(
      'SELECT id, skill, created_at FROM auth.user_skills WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching user skills:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user skills'
    });
  }
});

// POST /users/:userId/skills - Add a skill to user
router.post('/:userId/skills', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const { skill } = req.body;

    // Check if user is updating their own skills
    if (req.user.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only update your own skills'
      });
    }

    if (!skill) {
      return res.status(400).json({
        success: false,
        error: 'Skill is required'
      });
    }

    const result = await query(
      `INSERT INTO auth.user_skills (user_id, skill)
       VALUES ($1, $2)
       ON CONFLICT (user_id, skill) DO NOTHING
       RETURNING id, skill, created_at`,
      [userId, skill]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Skill already exists'
      });
    }

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding skill:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add skill'
    });
  }
});

// DELETE /users/:userId/skills/:skillId - Remove a skill from user
router.delete('/:userId/skills/:skillId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, skillId } = req.params;

    // Check if user is updating their own skills
    if (req.user.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only update your own skills'
      });
    }

    const result = await query(
      'DELETE FROM auth.user_skills WHERE id = $1 AND user_id = $2 RETURNING id',
      [skillId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Skill not found'
      });
    }

    res.json({
      success: true,
      message: 'Skill removed successfully'
    });
  } catch (error) {
    console.error('Error removing skill:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove skill'
    });
  }
});

export default router;
