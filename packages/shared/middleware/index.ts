/**
 * KarmyQ Shared Middleware
 *
 * Multi-tenant authentication and authorization middleware.
 */

export {
  authMiddleware,
  optionalAuthMiddleware,
  JWTPayload,
  AuthenticatedRequest,
} from './auth';

export {
  tenantMiddleware,
  optionalTenantMiddleware,
  adminOnlyMiddleware,
  TenantRequest,
} from './tenant';

export {
  dbContextMiddleware,
  getCurrentUserId,
  getCurrentCommunityId,
  clearDbContext,
  setDbContext,
} from './dbContext';
