import express from 'express';
import { query } from '../database/db';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';

// Middleware to verify JWT
const authenticateToken = (req: any, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

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
router.put('/:userId', authenticateToken, async (req: any, res) => {
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

export default router;
