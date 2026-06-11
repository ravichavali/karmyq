import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { sendError, sendForbidden, sendInternalError, sendUnauthorized } from '../utils/response';

/**
 * Extended Request with tenant context
 */
export interface TenantRequest extends AuthenticatedRequest {
  communityId?: string;
  communityRole?: 'admin' | 'member';
  communityName?: string;
}

/**
 * Tenant Context Middleware
 *
 * Verifies that the authenticated user has access to the requested community.
 * Must be used AFTER authMiddleware.
 *
 * Community ID can be specified via:
 * 1. Header: X-Community-ID
 * 2. Query param: community_id
 * 3. Body: community_id (for POST/PUT requests)
 *
 * Usage:
 *   app.use(authMiddleware, tenantMiddleware);
 *
 * Sets on request:
 *   - req.communityId
 *   - req.communityRole
 *   - req.communityName
 */
export function tenantMiddleware(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      sendUnauthorized(res, 'Authentication required');
      return;
    }

    // Extract community ID from header, query, body, or URL params
    const communityId =
      (req.headers['x-community-id'] as string) ||
      (req.query.community_id as string) ||
      req.body?.community_id ||
      (req.params as any)?.communityId ||
      (req.params as any)?.id; // Some routes use :id instead of :communityId

    if (!communityId) {
      sendError(
        res,
        'BAD_REQUEST',
        'Community ID must be provided via X-Community-ID header, query param, request body, or URL parameter',
        400
      );
      return;
    }

    // Verify user belongs to this community
    const userCommunity = req.user.communities.find(c => c.id === communityId);

    if (!userCommunity) {
      sendForbidden(res, 'You do not have access to this community');
      return;
    }

    // Set tenant context on request
    req.communityId = communityId;
    req.communityRole = userCommunity.role;
    req.communityName = userCommunity.name;

    // Continue to next middleware
    next();
  } catch (error: any) {
    console.error('Tenant context error:', error);
    sendInternalError(res, 'An error occurred while verifying community access', error as Error);
  }
}

/**
 * Optional Tenant Middleware
 *
 * Same as tenantMiddleware but allows requests without community context.
 * Useful for endpoints that can operate globally or per-community.
 *
 * Usage:
 *   app.use(authMiddleware, optionalTenantMiddleware);
 */
export function optionalTenantMiddleware(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    // No user? Skip tenant context
    if (!req.user) {
      return next();
    }

    // Extract community ID from header, query, body, or URL params
    const communityId =
      (req.headers['x-community-id'] as string) ||
      (req.query.community_id as string) ||
      req.body?.community_id ||
      (req.params as any)?.communityId ||
      (req.params as any)?.id; // Some routes use :id instead of :communityId

    // No community ID? That's okay for optional middleware
    if (!communityId) {
      return next();
    }

    // Verify user belongs to this community
    const userCommunity = req.user.communities.find(c => c.id === communityId);

    if (!userCommunity) {
      // User doesn't belong to community, but that's okay for optional
      return next();
    }

    // Set tenant context
    req.communityId = communityId;
    req.communityRole = userCommunity.role;
    req.communityName = userCommunity.name;

    next();
  } catch (error) {
    // Error in optional middleware? Just continue without context
    next();
  }
}

/**
 * Admin-Only Middleware
 *
 * Ensures the user is an admin of the current community.
 * Must be used AFTER tenantMiddleware.
 *
 * Usage:
 *   app.delete('/community/:id', authMiddleware, tenantMiddleware, adminOnlyMiddleware, handler);
 */
export function adminOnlyMiddleware(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.communityRole || req.communityRole !== 'admin') {
    sendForbidden(res, 'This action requires community admin privileges');
    return;
  }

  next();
}
