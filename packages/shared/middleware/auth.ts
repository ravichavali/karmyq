import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Enhanced JWT Payload with multi-community support
 */
export interface JWTPayload {
  userId: string;
  email: string;
  communities: Array<{
    id: string;
    role: 'admin' | 'member';
    name: string;
  }>;
  currentCommunityId?: string; // Last active community
  iat?: number;
  exp?: number;
}

/**
 * Extended Express Request with user context
 */
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

/**
 * Authentication Middleware
 *
 * Verifies JWT token and attaches user information to request.
 * Does NOT verify community access - that's done by tenant middleware.
 *
 * Usage:
 *   app.use(authMiddleware);
 *
 * Token Format:
 *   Authorization: Bearer <jwt-token>
 */
export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Attach user to request
    req.user = decoded;

    // Continue to next middleware
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        error: 'Token expired',
        message: 'Your session has expired. Please log in again.',
      });
      return;
    }

    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'Authentication token is invalid',
      });
      return;
    }

    // Log unexpected errors
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      message: 'An error occurred during authentication',
    });
  }
}

/**
 * Optional Authentication Middleware
 *
 * Same as authMiddleware but allows requests without tokens.
 * Useful for endpoints that work differently for authenticated vs anonymous users.
 *
 * Usage:
 *   app.use(optionalAuthMiddleware);
 */
export function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    // No token? That's okay, continue without user context
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const JWT_SECRET = process.env.JWT_SECRET;

    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    req.user = decoded;

    next();
  } catch (error) {
    // Token verification failed, but that's okay for optional auth
    // Continue without user context
    next();
  }
}
