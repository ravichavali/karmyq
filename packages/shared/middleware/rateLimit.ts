import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response } from 'express';

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
 */
export function createRateLimiter(config: RateLimitConfig = {}): RateLimitRequestHandler {
  const {
    windowMs = RateLimitPresets.standard.windowMs,
    max = RateLimitPresets.standard.max,
    message = RateLimitPresets.standard.message,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = config;

  return rateLimit({
    windowMs,
    max,
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
    handler: (req: Request, res: Response) => {
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
