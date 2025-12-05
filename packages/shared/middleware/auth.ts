import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendUnauthorized, sendInternalError } from '../utils/response';

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
 * Verify JWT token with dual-key support for zero-downtime rotation
 *
 * During rotation, tokens signed with either the current or previous secret are valid.
 * This allows a grace period where old tokens continue working while new ones are issued.
 *
 * @param token - JWT token to verify
 * @returns Decoded JWT payload
 * @throws JsonWebTokenError if token is invalid with both keys
 */
function verifyTokenWithRotation(token: string): JWTPayload {
  const JWT_SECRET = process.env.JWT_SECRET;
  const JWT_SECRET_PREVIOUS = process.env.JWT_SECRET_PREVIOUS;

  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }

  // Try current secret first
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error: any) {
    // If we have a previous secret, try that (rotation grace period)
    if (JWT_SECRET_PREVIOUS && error.name === 'JsonWebTokenError') {
      try {
        const decoded = jwt.verify(token, JWT_SECRET_PREVIOUS) as JWTPayload;
        // Log that we're using the old secret (for monitoring)
        console.warn('Token verified with previous JWT secret (rotation grace period)');
        return decoded;
      } catch (previousError) {
        // Token invalid with both keys, throw original error
        throw error;
      }
    }
    // No previous secret or different error type, throw original error
    throw error;
  }
}

/**
 * Authentication Middleware
 *
 * Verifies JWT token and attaches user information to request.
 * Supports dual-key rotation for zero-downtime secret updates.
 * Does NOT verify community access - that's done by tenant middleware.
 *
 * Usage:
 *   app.use(authMiddleware);
 *
 * Token Format:
 *   Authorization: Bearer <jwt-token>
 *
 * Rotation Support:
 *   During rotation, both JWT_SECRET and JWT_SECRET_PREVIOUS are accepted.
 *   This allows a grace period where old tokens remain valid.
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
      return sendUnauthorized(res, 'No authentication token provided', { requestId: (req as any).id });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token with rotation support
    const decoded = verifyTokenWithRotation(token);

    // Attach user to request
    req.user = decoded;

    // Continue to next middleware
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return sendUnauthorized(res, 'Your session has expired. Please log in again.', { requestId: (req as any).id });
    }

    if (error.name === 'JsonWebTokenError') {
      return sendUnauthorized(res, 'Authentication token is invalid', { requestId: (req as any).id });
    }

    // Log unexpected errors
    console.error('Authentication error:', error);
    return sendInternalError(
      res,
      'An error occurred during authentication',
      error instanceof Error ? error : undefined,
      { requestId: (req as any).id }
    );
  }
}

/**
 * Optional Authentication Middleware
 *
 * Same as authMiddleware but allows requests without tokens.
 * Supports dual-key rotation for zero-downtime secret updates.
 * Useful for endpoints that work differently for authenticated vs anonymous users.
 *
 * Usage:
 *   app.use(optionalAuthMiddleware);
 */
export function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    // No token? That's okay, continue without user context
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    // Verify token with rotation support
    const decoded = verifyTokenWithRotation(token);
    req.user = decoded;

    next();
  } catch (error) {
    // Token verification failed, but that's okay for optional auth
    // Continue without user context
    next();
  }
}
