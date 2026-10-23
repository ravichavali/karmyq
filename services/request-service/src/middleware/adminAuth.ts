/**
 * Admin Authentication Middleware
 *
 * Verifies JWT token and checks for admin role.
 * Protects admin-only routes.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { isDemoReadOnlySession } from '@karmyq/shared/middleware/auth';
import { isLiveAdminOfAnyCommunity } from '../db/liveRole';

interface JWTPayload {
  userId: string;
  email: string;
  sessionMode?: string;
  communities?: Array<{ id: string; name: string; role: string }>;
}

// HTTP methods a read-only demo session may use through this non-shared verifier.
const DEMO_READONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Verify JWT token middleware
 * Attaches user info to request object
 */
export function verifyToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'No authorization token provided'
    });
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : authHeader;

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET not configured');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    const decoded = jwt.verify(token, secret) as JWTPayload;

    // Read-only demo sessions cannot mutate through this non-shared verifier either
    // (Sprint 116, ADR-084).
    if (isDemoReadOnlySession(decoded) && !DEMO_READONLY_METHODS.has(req.method)) {
      return res.status(403).json({
        success: false,
        message: 'This demo session is read-only',
        error: 'FORBIDDEN',
      });
    }

    // Attach user info to request
    (req as any).user = decoded;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
}

/**
 * Require admin role middleware
 * Must be used after verifyToken
 *
 * Admits a LIVE admin of any community (BUG-069, ADR-102): the role comes from
 * communities.members, never the token's `communities` claim.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as JWTPayload | undefined;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (!(await isLiveAdminOfAnyCommunity(user.userId))) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  next();
}

/**
 * Combined middleware: verify token and require admin
 */
export const adminAuth = [verifyToken, requireAdmin];
