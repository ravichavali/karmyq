/**
 * KarmyQ Shared Middleware
 *
 * Multi-tenant authentication and authorization middleware.
 */

export {
  authMiddleware,
  optionalAuthMiddleware,
  verifyTokenWithRotation,
  isDemoReadOnlySession,
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

export {
  createRateLimiter,
  rateLimiters,
  globalRateLimiter,
  RateLimitPresets,
  RateLimitConfig,
} from './rateLimit';

export {
  validate,
  validateMultiple,
  commonValidators,
  paginationSchema,
  communityParamsSchema,
  userParamsSchema,
  z,
} from './validate';
