import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../database/db';
import { publishEvent } from '../events/publisher';
import { JWTPayload } from '@karmyq/shared/middleware/auth';
import {
  sendSuccess,
  sendValidationError,
  sendUnauthorized,
  sendConflict,
  sendInternalError,
  HTTP_STATUS
} from '@karmyq/shared/utils/response';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

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
      return sendValidationError(res, 'Email, name, and password are required', undefined, { requestId: req.id });
    }

    if (password.length < 8) {
      req.logger?.warn('Registration attempt with weak password', { email });
      return sendValidationError(res, 'Password must be at least 8 characters', undefined, { requestId: req.id });
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM auth.users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      req.logger?.warn('Registration attempt with existing email', { email });
      return sendConflict(res, 'User with this email already exists', { email }, { requestId: req.id });
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

    // Create session (same as login)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await query(
      'INSERT INTO auth.sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    timer?.();
    req.logger?.info('User registered successfully', {
      userId: user.id,
      email: user.email
    });

    sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.created_at,
        communities: [] // New user has no communities
      },
      token
    }, HTTP_STATUS.CREATED, { requestId: req.id });
  } catch (error: any) {
    req.logger?.error('Registration failed', error instanceof Error ? error : new Error(String(error)), {
      email: req.body?.email
    });
    sendInternalError(res, 'Failed to register user', error, { requestId: req.id });
  }
});

// POST /auth/login - Login user
router.post('/login', async (req: any, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      req.logger?.warn('Login attempt with missing credentials');
      return sendValidationError(res, 'Email and password are required', undefined, { requestId: req.id });
    }

    const timer = req.logger?.timer('user_login');

    // Find user
    const result = await query(
      'SELECT id, email, name, password_hash, created_at FROM auth.users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      req.logger?.warn('Login attempt with unknown email', { email });
      return sendUnauthorized(res, 'Invalid email or password', { requestId: req.id });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      req.logger?.warn('Login attempt with incorrect password', {
        userId: user.id,
        email
      });
      return sendUnauthorized(res, 'Invalid email or password', { requestId: req.id });
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

    sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.created_at,
        communities // Include communities in response
      },
      token
    }, HTTP_STATUS.OK, { requestId: req.id });
  } catch (error: any) {
    req.logger?.error('Login failed', error instanceof Error ? error : new Error(String(error)), {
      email: req.body?.email
    });
    sendInternalError(res, 'Failed to login', error, { requestId: req.id });
  }
});

// POST /auth/logout - Logout user
router.post('/logout', async (req: any, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      await query('DELETE FROM auth.sessions WHERE token = $1', [token]);
    }

    sendSuccess(res, { message: 'Logged out successfully' }, HTTP_STATUS.OK, { requestId: req.id });
  } catch (error) {
    console.error('Logout error:', error);
    sendInternalError(res, 'Failed to logout', error instanceof Error ? error : undefined, { requestId: req.id });
  }
});

// GET /auth/verify - Verify token
router.get('/verify', async (req: any, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return sendUnauthorized(res, 'No token provided', { requestId: req.id });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Check if session exists
    const session = await query(
      'SELECT * FROM auth.sessions WHERE token = $1 AND expires_at > NOW()',
      [token]
    );

    if (session.rows.length === 0) {
      return sendUnauthorized(res, 'Invalid or expired token', { requestId: req.id });
    }

    // Return full JWT payload including communities
    sendSuccess(res, {
      valid: true,
      userId: decoded.userId,
      email: decoded.email,
      communities: decoded.communities || [],
      currentCommunityId: decoded.currentCommunityId
    }, HTTP_STATUS.OK, { requestId: req.id });
  } catch (error) {
    sendUnauthorized(res, 'Invalid token', { requestId: req.id });
  }
});

// POST /auth/refresh - Refresh JWT with updated communities
router.post('/refresh', async (req: any, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return sendUnauthorized(res, 'No token provided', { requestId: req.id });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Check if session exists
    const session = await query(
      'SELECT * FROM auth.sessions WHERE token = $1 AND expires_at > NOW()',
      [token]
    );

    if (session.rows.length === 0) {
      return sendUnauthorized(res, 'Invalid or expired token', { requestId: req.id });
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

    sendSuccess(res, {
      token: newToken,
      communities
    }, HTTP_STATUS.OK, { requestId: req.id });
  } catch (error: any) {
    req.logger?.error('Token refresh failed', error instanceof Error ? error : new Error(String(error)));
    sendUnauthorized(res, 'Failed to refresh token', { requestId: req.id });
  }
});

export default router;
