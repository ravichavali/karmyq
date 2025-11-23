import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

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
 */
export const RateLimitPresets = {
  // Strict limit for auth endpoints (login, register)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per 15 minutes
    message: 'Too many authentication attempts, please try again later',
  },
  // Standard API limit
  standard: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: 'Too many requests, please slow down',
  },
  // Relaxed limit for read-heavy endpoints
  relaxed: {
    windowMs: 60 * 1000, // 1 minute
    max: 200, // 200 requests per minute
    message: 'Too many requests, please slow down',
  },
  // Very strict limit for sensitive operations
  strict: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 requests per hour
    message: 'Rate limit exceeded for this operation',
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

  return rateLimit({
    windowMs,
    max: effectiveMax,
    message: { success: false, error: message },
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    skipSuccessfulRequests,
    skipFailedRequests,
    keyGenerator: (req: Request) => {
      // Use user ID if authenticated, otherwise use IP
      const userId = (req as any).user?.userId;
      return userId || req.ip || 'unknown';
    },
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: message,
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
  auth: createRateLimiter(RateLimitPresets.auth),
  standard: createRateLimiter(RateLimitPresets.standard),
  relaxed: createRateLimiter(RateLimitPresets.relaxed),
  strict: createRateLimiter(RateLimitPresets.strict),
};

/**
 * Global rate limiter for all API requests
 * Apply this at the app level for basic protection
 */
export const globalRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute per IP/user
  message: 'Too many requests from this source',
});
