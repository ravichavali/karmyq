import { Request, Response, NextFunction } from 'express';
import { sendUnauthorized, sendInternalError } from '@karmyq/shared/utils/response';
import type { JWTPayload } from '@karmyq/shared/middleware';
import { verifyTokenWithRotation } from '@karmyq/shared/middleware/auth';

export interface SSEAuthenticatedRequest extends Request {
  user?: JWTPayload;
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
