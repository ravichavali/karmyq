import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../database/db';
import { publishEvent } from '../events/publisher';
import { JWTPayload } from '../../shared/middleware/auth';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';
const SALT_ROUNDS = 10;

/**
 * Fetch user's community memberships
 */
async function getUserCommunities(userId: string) {
  const result = await query(
    `SELECT
      cm.community_id as id,
      cm.role,
      c.name
     FROM communities.members cm
     JOIN communities.communities c ON cm.community_id = c.id
     WHERE cm.user_id = $1 AND cm.status = 'active'
     ORDER BY cm.joined_at DESC`,
    [userId]
  );

  return result.rows.map(row => ({
    id: row.id,
    role: row.role,
    name: row.name,
  }));
}

/**
 * Generate JWT token with community memberships
 */
async function generateJWT(userId: string, email: string): Promise<string> {
  const communities = await getUserCommunities(userId);

  const payload: JWTPayload = {
    userId,
    email,
    communities,
    currentCommunityId: communities.length > 0 ? communities[0].id : undefined,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// POST /auth/register - Register new user
router.post('/register', async (req: any, res) => {
  try {
    const { email, name, password } = req.body;

    // Validation
    if (!email || !name || !password) {
      req.logger?.warn('Registration attempt with missing fields', { email, hasName: !!name });
      return res.status(400).json({ error: 'Email, name, and password are required' });
    }

    if (password.length < 8) {
      req.logger?.warn('Registration attempt with weak password', { email });
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM auth.users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      req.logger?.warn('Registration attempt with existing email', { email });
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const timer = req.logger?.timer('user_registration');
    const result = await query(
      `INSERT INTO auth.users (email, name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, created_at`,
      [email, name, passwordHash]
    );

    const user = result.rows[0];

    // Publish user_created event
    await publishEvent('user_created', {
      userId: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.created_at
    });
    req.logger?.event('user_created', { userId: user.id, email: user.email });

    // Generate JWT token with communities (new user has no communities yet)
    const token = await generateJWT(user.id, user.email);

    timer?.();
    req.logger?.info('User registered successfully', {
      userId: user.id,
      email: user.email
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.created_at,
        communities: [] // New user has no communities
      },
      token
    });
  } catch (error: any) {
    req.logger?.error('Registration failed', error instanceof Error ? error : new Error(String(error)), {
      email: req.body?.email
    });
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// POST /auth/login - Login user
router.post('/login', async (req: any, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      req.logger?.warn('Login attempt with missing credentials');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const timer = req.logger?.timer('user_login');

    // Find user
    const result = await query(
      'SELECT id, email, name, password_hash, created_at FROM auth.users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      req.logger?.warn('Login attempt with unknown email', { email });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      req.logger?.warn('Login attempt with incorrect password', {
        userId: user.id,
        email
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Fetch user's communities
    const communities = await getUserCommunities(user.id);

    // Generate JWT token with communities
    const token = await generateJWT(user.id, user.email);

    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await query(
      'INSERT INTO auth.sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    timer?.();
    req.logger?.info('User logged in successfully', {
      userId: user.id,
      email: user.email,
      communitiesCount: communities.length
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.created_at,
        communities // Include communities in response
      },
      token
    });
  } catch (error: any) {
    req.logger?.error('Login failed', error instanceof Error ? error : new Error(String(error)), {
      email: req.body?.email
    });
    res.status(500).json({ error: 'Failed to login' });
  }
});

// POST /auth/logout - Logout user
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      await query('DELETE FROM auth.sessions WHERE token = $1', [token]);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// GET /auth/verify - Verify token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Check if session exists
    const session = await query(
      'SELECT * FROM auth.sessions WHERE token = $1 AND expires_at > NOW()',
      [token]
    );

    if (session.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Return full JWT payload including communities
    res.json({
      valid: true,
      userId: decoded.userId,
      email: decoded.email,
      communities: decoded.communities || [],
      currentCommunityId: decoded.currentCommunityId
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// POST /auth/refresh - Refresh JWT with updated communities
router.post('/refresh', async (req: any, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Check if session exists
    const session = await query(
      'SELECT * FROM auth.sessions WHERE token = $1 AND expires_at > NOW()',
      [token]
    );

    if (session.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Generate new token with fresh community data
    const newToken = await generateJWT(decoded.userId, decoded.email);

    // Update session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await query(
      'UPDATE auth.sessions SET token = $1, expires_at = $2 WHERE user_id = $3',
      [newToken, expiresAt, decoded.userId]
    );

    // Fetch updated communities
    const communities = await getUserCommunities(decoded.userId);

    req.logger?.info('Token refreshed', {
      userId: decoded.userId,
      communitiesCount: communities.length
    });

    res.json({
      token: newToken,
      communities
    });
  } catch (error: any) {
    req.logger?.error('Token refresh failed', error instanceof Error ? error : new Error(String(error)));
    res.status(401).json({ error: 'Failed to refresh token' });
  }
});

export default router;
