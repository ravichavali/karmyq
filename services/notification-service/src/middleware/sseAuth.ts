import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendUnauthorized, sendInternalError } from '@karmyq/shared/utils/response';
import type { JWTPayload } from '@karmyq/shared/middleware';

export interface SSEAuthenticatedRequest extends Request {
  user?: JWTPayload;
}

function verifyTokenWithRotation(token: string): JWTPayload {
  const JWT_SECRET = process.env.JWT_SECRET;
  const JWT_SECRET_PREVIOUS = process.env.JWT_SECRET_PREVIOUS;

  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }

  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error: any) {
    if (JWT_SECRET_PREVIOUS && error.name === 'JsonWebTokenError') {
      try {
        return jwt.verify(token, JWT_SECRET_PREVIOUS) as JWTPayload;
      } catch {
        throw error;
      }
    }
    throw error;
  }
}

export function sseAuthMiddleware(
  req: SSEAuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    const queryToken = typeof req.query.access_token === 'string' ? req.query.access_token : undefined;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : queryToken;

    if (!token) {
      return sendUnauthorized(res, 'No authentication token provided', { requestId: (req as any).id });
    }

    req.user = verifyTokenWithRotation(token);
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return sendUnauthorized(res, 'Your session has expired. Please log in again.', { requestId: (req as any).id });
    }
    if (error.name === 'JsonWebTokenError') {
      return sendUnauthorized(res, 'Authentication token is invalid', { requestId: (req as any).id });
    }
    return sendInternalError(
      res,
      'An error occurred during authentication',
      error instanceof Error ? error : undefined,
      { requestId: (req as any).id }
    );
  }
}

