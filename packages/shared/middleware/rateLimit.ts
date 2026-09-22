import rateLimit, { ipKeyGenerator, RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { ERROR_CODES } from '../utils/response';

/**
 * Rate Limit Configuration Options
 */
export interface RateLimitConfig {
  windowMs?: number; // Time window in milliseconds
  max?: number; // Max requests per window
  message?: string; // Error message
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Environment-based rate limiting configuration
 *
 * Set these environment variables to control rate limiting:
 * - RATE_LIMIT_DISABLED=true - Completely disable rate limiting (for testing)
 * - RATE_LIMIT_MULTIPLIER=10 - Multiply all limits by this factor (e.g., 10x for load testing)
 * - NODE_ENV=test - Automatically increases limits 10x
 */
const isRateLimitDisabled = process.env.RATE_LIMIT_DISABLED === 'true';
const rateLimitMultiplier = parseFloat(process.env.RATE_LIMIT_MULTIPLIER || '1') ||
  (process.env.NODE_ENV === 'test' ? 10 : 1);

/**
 * No-op middleware when rate limiting is disabled
 */
const noOpMiddleware = (_req: Request, _res: Response, next: NextFunction) => next();

/**
 * Default rate limit configurations for different endpoint types
 *
 * Production-ready limits designed for scalability:
 * - Read operations: Higher limits (users browse/search frequently)
 * - Write operations: Moderate limits (prevent spam/abuse)
 * - Auth operations: Strict limits (prevent brute force)
 */
export const RateLimitPresets = {
  // Strict limit for auth endpoints (login, register)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per 15 minutes per IP
    message: 'Too many authentication attempts, please try again later',
  },
  // Standard write operations (POST/PUT/DELETE)
  standard: {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 write operations per minute per key (per IP today — see ADR-098)
    message: 'Too many requests, please slow down',
  },
  // Read-heavy endpoints (GET - lists, searches)
  readHeavy: {
    windowMs: 60 * 1000, // 1 minute
    max: 300, // 300 read operations per minute per key (per IP today — see ADR-098)
    message: 'Too many requests, please slow down',
  },
  // Detail/single resource reads (GET - specific items)
  readLight: {
    windowMs: 60 * 1000, // 1 minute
    max: 500, // 500 single-item reads per minute per key (per IP today — see ADR-098)
    message: 'Too many requests, please slow down',
  },
  // Very strict limit for sensitive operations
  strict: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 requests per hour per key (per IP today — see ADR-098)
    message: 'Rate limit exceeded for this operation',
  },
  // Legacy: Relaxed (deprecated - use readHeavy instead)
  relaxed: {
    windowMs: 60 * 1000, // 1 minute
    max: 300, // 300 requests per minute
    message: 'Too many requests, please slow down',
  },
} as const;

/**
 * Create a rate limiter with custom configuration
 * Respects environment variables for testing/load testing scenarios
 */
export function createRateLimiter(config: RateLimitConfig = {}): RateLimitRequestHandler {
  // Return no-op middleware if rate limiting is disabled
  if (isRateLimitDisabled) {
    return noOpMiddleware as unknown as RateLimitRequestHandler;
  }

  const {
    windowMs = RateLimitPresets.standard.windowMs,
    max = RateLimitPresets.standard.max,
    message = RateLimitPresets.standard.message,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = config;

  // Apply multiplier to max requests (useful for testing)
  const effectiveMax = Math.ceil(max * rateLimitMultiplier);

  // Canonical error body, shared by the static `message` option and the dynamic handler
  // so the two 429 payloads can never drift apart.
  const rateLimitBody = { success: false, message, error: ERROR_CODES.RATE_LIMIT_EXCEEDED };

  return rateLimit({
    windowMs,
    max: effectiveMax,
    message: rateLimitBody,
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    skipSuccessfulRequests,
    skipFailedRequests,
    // Use the user ID when the request is authenticated, otherwise the client IP.
    //
    // BUG-049: this used to return `undefined` for anonymous requests, on the
    // assumption that express-rate-limit would fall back to its IP-based default.
    // It does not — it calls `store.increment(undefined)`, so every anonymous
    // caller shared ONE bucket. `ipKeyGenerator` is the library's own helper; it
    // returns IPv4 unchanged and narrows IPv6 to a /56 so a single host cannot
    // rotate addresses inside its own prefix.
    //
    // `req.ip` is only the real client when the service sets `trust proxy` (ADR-098). It is
    // undefined only when the socket has no remote address, and `'unknown'` is then a single
    // fail-closed bucket rather than an escape from limiting.
    keyGenerator: (req: Request) => {
      const userId = (req as any).user?.userId;
      if (userId) {
        return `user:${userId}`;
      }
      return ipKeyGenerator(req.ip ?? 'unknown');
    },
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        ...rateLimitBody,
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
}

/**
 * Pre-configured rate limiters for common use cases
 *
 * Usage:
 * - auth: Login, register, password reset
 * - standard: Write operations (POST/PUT/DELETE)
 * - readHeavy: List endpoints (GET /communities, /requests)
 * - readLight: Detail endpoints (GET /communities/:id)
 * - strict: Sensitive operations (delete account, admin actions)
 */
export const rateLimiters = {
  auth: createRateLimiter(RateLimitPresets.auth),
  standard: createRateLimiter(RateLimitPresets.standard),
  readHeavy: createRateLimiter(RateLimitPresets.readHeavy),
  readLight: createRateLimiter(RateLimitPresets.readLight),
  strict: createRateLimiter(RateLimitPresets.strict),
  // Legacy
  relaxed: createRateLimiter(RateLimitPresets.relaxed),
};

/**
 * Global rate limiter for all API requests
 * Apply this at the app level for basic protection
 */
export const globalRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute per key (per IP today — see ADR-098)
  message: 'Too many requests from this source',
});
