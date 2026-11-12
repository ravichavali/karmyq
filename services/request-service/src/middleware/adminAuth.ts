/**
 * Admin Authentication Middleware
 *
 * Two independent roles (ADR-105), each read live (ADR-102), never OR-ed together:
 * - platformAdminAuth: a platform admin (auth.platform_admins) — the global request-type catalog (/admin/schemas).
 * - communityAdminAuth: an admin of SOME community — the admin-actions prefilter; handlers scope to the request.
 */

import { Request, Response, NextFunction, Router } from 'express';
import jwt from 'jsonwebtoken';
import { isDemoReadOnlySession } from '@karmyq/shared/middleware/auth';
import { isLiveAdminOfAnyCommunity, isLivePlatformAdmin } from '../db/liveRole';

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
 * Require an admin of ANY community. Must be used after verifyToken.
 *
 * The admin-actions prefilter: admits a LIVE admin of any community (BUG-069, ADR-102), read from
 * communities.members, never the token's `communities` claim. It grants no platform power (BUG-073).
 */
export async function requireAnyCommunityAdmin(req: Request, res: Response, next: NextFunction) {
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
 * Require a platform admin. Must be used after verifyToken.
 *
 * Admits a LIVE platform admin (auth.platform_admins, ADR-105). A community admin, including any community's
 * creator, is refused (BUG-073); the body never says whether the caller administers a community.
 */
export async function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as JWTPayload | undefined;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (!(await isLivePlatformAdmin(user.userId))) {
    return res.status(403).json({
      success: false,
      message: 'Platform admin access required',
      error: 'PLATFORM_ADMIN_REQUIRED'
    });
  }

  next();
}

/** Verify the token, then require an admin of any community (the admin-actions mount). */
export const communityAdminAuth = [verifyToken, requireAnyCommunityAdmin];

/** Verify the token, then require a platform admin (the /admin/schemas mount). */
export const platformAdminAuth = [verifyToken, requirePlatformAdmin];

/**
 * The paths an admin chain must cover: every route `router` defines, under `prefix`. Read from the
 * router itself so no second list can drift (BUG-071). Fails closed: a layer that is not a plain
 * string-path route (`router.use`, an array or RegExp path) throws at startup instead of being left
 * ungated.
 */
export function adminChainPaths(router: Router, prefix: string): string[] {
  const layers = router.stack as unknown as Array<{ route?: { path: unknown } }>;
  return [...new Set(layers.map((layer) => {
    if (!layer.route || typeof layer.route.path !== 'string') {
      throw new Error(`${prefix}: every admin router layer must be a plain string-path route, or the admin chain cannot cover it`);
    }
    return `${prefix}${layer.route.path}`;
  }))];
}
