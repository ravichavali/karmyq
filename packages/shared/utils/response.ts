/**
 * Standardized API Response Utilities
 *
 * Provides consistent response formatting across all Karmyq services.
 * Version: 6.1.0
 */

import { Response } from 'express';
import { randomUUID } from 'crypto';

/**
 * Standard success response format
 */
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Paginated response format
 */
export interface ApiPaginatedResponse<T = any> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Standard error response format
 */
export interface ApiErrorResponse {
  success: false;
  message: string;
  error: string;
  details?: any;
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Options for response formatting
 */
export interface ResponseOptions {
  requestId?: string;
  includeTimestamp?: boolean;
}

/**
 * Send a successful response
 *
 * @param res - Express response object
 * @param data - Response data
 * @param statusCode - HTTP status code (default: 200)
 * @param options - Additional options
 *
 * @example
 * sendSuccess(res, { user: { id: '123', name: 'Alice' } });
 *
 * @example
 * sendSuccess(res, users, 201, { requestId: req.id });
 */
export function sendSuccess<T = any>(
  res: Response,
  data: T,
  statusCode: number = 200,
  options: ResponseOptions = {}
): void {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
  };

  if (options.includeTimestamp !== false) {
    response.meta = {
      timestamp: new Date().toISOString(),
      ...(options.requestId && { requestId: options.requestId }),
    };
  }

  res.status(statusCode).json(response);
}

/**
 * Send a paginated response
 *
 * @param res - Express response object
 * @param data - Array of items
 * @param pagination - Pagination metadata
 * @param statusCode - HTTP status code (default: 200)
 * @param options - Additional options
 *
 * @example
 * sendPaginated(res, users, {
 *   page: 1,
 *   limit: 20,
 *   total: 100
 * });
 */
export function sendPaginated<T = any>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  statusCode: number = 200,
  options: ResponseOptions = {}
): void {
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const hasNext = pagination.page < totalPages;
  const hasPrev = pagination.page > 1;

  const response: ApiPaginatedResponse<T> = {
    success: true,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages,
      hasNext,
      hasPrev,
    },
  };

  if (options.includeTimestamp !== false) {
    response.meta = {
      timestamp: new Date().toISOString(),
      ...(options.requestId && { requestId: options.requestId }),
    };
  }

  res.status(statusCode).json(response);
}

/**
 * Send an error response
 *
 * @param res - Express response object
 * @param code - Error code (e.g., 'VALIDATION_ERROR', 'NOT_FOUND')
 * @param message - Human-readable error message
 * @param statusCode - HTTP status code (default: 400)
 * @param details - Additional error details (optional)
 * @param options - Additional options
 *
 * @example
 * sendError(res, 'VALIDATION_ERROR', 'Email is required', 400);
 *
 * @example
 * sendError(res, 'NOT_FOUND', 'User not found', 404, { userId: '123' });
 */
export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode: number = 400,
  details?: any,
  options: ResponseOptions = {}
): void {
  const response: ApiErrorResponse = {
    success: false,
    message,
    error: code,
    ...(details != null && { details }),
  };

  if (options.includeTimestamp !== false) {
    response.meta = {
      timestamp: new Date().toISOString(),
      ...(options.requestId && { requestId: options.requestId }),
    };
  }

  res.status(statusCode).json(response);
}

/**
 * Send a validation error response
 *
 * @param res - Express response object
 * @param message - Validation error message
 * @param details - Validation error details (e.g., field errors)
 * @param options - Additional options
 *
 * @example
 * sendValidationError(res, 'Invalid input', {
 *   email: 'Email is required',
 *   password: 'Password must be at least 8 characters'
 * });
 */
export function sendValidationError(
  res: Response,
  message: string,
  details?: any,
  options: ResponseOptions = {}
): void {
  sendError(res, 'VALIDATION_ERROR', message, 400, details, options);
}

/**
 * Send a not found error response
 *
 * @param res - Express response object
 * @param resource - Resource name (e.g., 'User', 'Community')
 * @param options - Additional options
 *
 * @example
 * sendNotFound(res, 'User');
 */
export function sendNotFound(
  res: Response,
  resource: string,
  options: ResponseOptions = {}
): void {
  sendError(res, 'NOT_FOUND', `${resource} not found`, 404, undefined, options);
}

/**
 * Send an unauthorized error response
 *
 * @param res - Express response object
 * @param message - Error message (default: 'Unauthorized')
 * @param options - Additional options
 *
 * @example
 * sendUnauthorized(res);
 *
 * @example
 * sendUnauthorized(res, 'Invalid token');
 */
export function sendUnauthorized(
  res: Response,
  message: string = 'Unauthorized',
  options: ResponseOptions = {}
): void {
  sendError(res, 'UNAUTHORIZED', message, 401, undefined, options);
}

/**
 * Send a forbidden error response
 *
 * @param res - Express response object
 * @param message - Error message (default: 'Forbidden')
 * @param options - Additional options
 *
 * @example
 * sendForbidden(res);
 *
 * @example
 * sendForbidden(res, 'You do not have permission to perform this action');
 */
export function sendForbidden(
  res: Response,
  message: string = 'Forbidden',
  options: ResponseOptions = {}
): void {
  sendError(res, 'FORBIDDEN', message, 403, undefined, options);
}

/**
 * Send a conflict error response
 *
 * @param res - Express response object
 * @param message - Error message
 * @param details - Conflict details (optional)
 * @param options - Additional options
 *
 * @example
 * sendConflict(res, 'Email already exists', { email: 'user@example.com' });
 */
export function sendConflict(
  res: Response,
  message: string,
  details?: any,
  options: ResponseOptions = {}
): void {
  sendError(res, 'CONFLICT', message, 409, details, options);
}

/**
 * Send an internal server error response
 *
 * @param res - Express response object
 * @param message - Error message (default: 'Internal server error')
 * @param error - Original error object (for stack trace in dev)
 * @param options - Additional options
 *
 * @example
 * try {
 *   // ... code
 * } catch (error) {
 *   sendInternalError(res, 'Database error', error);
 * }
 */
export function sendInternalError(
  res: Response,
  message: string = 'Internal server error',
  error?: Error,
  options: ResponseOptions = {}
): void {
  const response: ApiErrorResponse = {
    success: false,
    message,
    error: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && error && {
      details: { stack: error.stack },
    }),
  };

  if (options.includeTimestamp !== false) {
    response.meta = {
      timestamp: new Date().toISOString(),
      ...(options.requestId && { requestId: options.requestId }),
    };
  }

  res.status(500).json(response);
}

/**
 * Middleware to add request ID to all responses
 *
 * @example
 * app.use(requestIdMiddleware);
 */
export function requestIdMiddleware(req: any, res: any, next: any): void {
  req.id = randomUUID();
  next();
}

/**
 * Error codes used across the application
 */
export const ERROR_CODES = {
  // Client errors (4xx)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  BAD_REQUEST: 'BAD_REQUEST',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Client errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,

  // Server errors
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Re-export schema validation functions (v9.0)
 * This allows services to import both response utilities and validation from one place
 */
export { validateRequest } from '../src/schemas';
