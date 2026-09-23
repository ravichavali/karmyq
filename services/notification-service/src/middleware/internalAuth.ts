import { createHash, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

function safeEqual(configured: string, supplied: string): boolean {
  const configuredDigest = createHash('sha256').update(configured, 'utf8').digest();
  const suppliedDigest = createHash('sha256').update(supplied, 'utf8').digest();
  return timingSafeEqual(configuredDigest, suppliedDigest);
}

/**
 * Fail-closed service authentication (BUG-051).
 *
 * An unconfigured secret makes the route UNAVAILABLE, never open. This route is mounted ahead of
 * `authMiddleware` and nginx proxies it publicly, so the header is its only credential: a guard
 * that skipped the check when `INTERNAL_SECRET` was unset would leave it anonymous to the
 * internet. Digests are compared with `timingSafeEqual`, and neither secret is ever logged.
 *
 * Mirrors social-graph-service's `internalAuth`; keep the two in step.
 */
export function internalAuth(req: Request, res: Response, next: NextFunction) {
  const configured = process.env.INTERNAL_SECRET;
  if (!configured) {
    return res.status(503).json({
      success: false,
      message: 'Internal route unavailable',
      error: 'SERVICE_UNAVAILABLE',
    });
  }

  const supplied = req.header('x-internal-secret') ?? '';
  if (!safeEqual(configured, supplied)) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden',
      error: 'FORBIDDEN',
    });
  }

  next();
}
