/**
 * Admin Authentication Middleware
 *
 * Verifies JWT token and checks for admin role.
 * Protects admin-only routes.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  userId: string;
  email: string;
  role?: string;
  communities?: Array<{ id: string; name: string; role: string }>;
  communityMemberships?: Array<{ id: string; name: string; role: string }>; // legacy alias
}

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
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as JWTPayload | undefined;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Check if user has admin role in any community
  // JWT uses 'communities' field; support legacy 'communityMemberships' alias too
  const memberships = user.communities ?? user.communityMemberships ?? [];
  const isAdmin = user.role === 'admin' ||
    memberships.some(m => m.role === 'admin');

  if (!isAdmin) {
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
