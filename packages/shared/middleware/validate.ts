import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';

/**
 * Validation target - which part of the request to validate
 */
export type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Validation middleware factory
 * Creates middleware that validates request data against a Zod schema
 *
 * @example
 * const createUserSchema = z.object({
 *   email: z.string().email(),
 *   name: z.string().min(2).max(100),
 *   password: z.string().min(8),
 * });
 *
 * router.post('/users', validate(createUserSchema), createUser);
 */
export function validate<T extends ZodSchema>(
  schema: T,
  target: ValidationTarget = 'body'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[target];
      const validated = await schema.parseAsync(data);

      // Replace request data with validated/transformed data
      req[target] = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Zod v4 uses 'issues', v3 uses 'errors' - support both
        const issues = (error as any).issues || (error as any).errors || [];
        const errors = issues.map((err: any) => ({
          field: err.path?.join('.') || '',
          message: err.message,
          code: err.code,
        }));

        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors,
        });
      }

      // Unexpected error
      console.error('Validation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal validation error',
      });
    }
  };
}

/**
 * Validate multiple targets at once
 *
 * @example
 * router.put('/users/:id',
 *   validateMultiple({
 *     params: z.object({ id: z.string().uuid() }),
 *     body: z.object({ name: z.string().optional() }),
 *   }),
 *   updateUser
 * );
 */
export function validateMultiple(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const errors: Array<{ target: string; field: string; message: string }> = [];

    for (const [target, schema] of Object.entries(schemas)) {
      if (!schema) continue;

      try {
        const data = req[target as ValidationTarget];
        const validated = await schema.parseAsync(data);
        req[target as ValidationTarget] = validated;
      } catch (error) {
        if (error instanceof ZodError) {
          // Zod v4 uses 'issues', v3 uses 'errors' - support both
          const issues = (error as any).issues || (error as any).errors || [];
          issues.forEach((err: any) => {
            errors.push({
              target,
              field: err.path?.join('.') || '',
              message: err.message,
            });
          });
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
    }

    next();
  };
}

// ============================================
// Common Zod Schemas for reuse across services
// ============================================

/**
 * Common field validators
 */
export const commonValidators = {
  uuid: z.string().uuid('Invalid UUID format'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  url: z.string().url('Invalid URL format').optional(),
};

/**
 * Pagination query schema
 */
export const paginationSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(parseInt(val, 10) || 20, 100) : 20)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(parseInt(val, 10) || 0, 0) : 0)),
});

/**
 * Community ID params schema
 */
export const communityParamsSchema = z.object({
  communityId: z.string().uuid('Invalid community ID'),
});

/**
 * User ID params schema
 */
export const userParamsSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

// Re-export Zod for convenience
export { z } from 'zod';
