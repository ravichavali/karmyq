import { Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { TenantRequest } from './tenant';

/**
 * Database Context Middleware
 *
 * Sets PostgreSQL session variables for Row-Level Security (RLS).
 * Must be used AFTER authMiddleware and tenantMiddleware.
 *
 * Sets the following session variables:
 * - app.current_user_id: Current authenticated user's ID
 * - app.current_community_id: Current community context
 *
 * These variables are used by RLS policies to enforce tenant isolation.
 *
 * Usage:
 *   app.use(authMiddleware, tenantMiddleware, dbContextMiddleware(pool));
 *
 * @param pool - PostgreSQL connection pool
 */
export function dbContextMiddleware(pool: Pool) {
  return async (
    req: TenantRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Only set context if we have user and community
      if (req.user && req.communityId) {
        // Set session variables for RLS
        await pool.query(
          `SELECT
            set_config('app.current_user_id', $1, true) as user_id,
            set_config('app.current_community_id', $2, true) as community_id`,
          [req.user.userId, req.communityId]
        );

        // Note: The 'true' parameter makes these settings local to the current transaction
        // They will be reset after the request completes
      }

      next();
    } catch (error: any) {
      console.error('Database context error:', error);
      res.status(500).json({
        success: false,
        error: 'Database context failed',
        message: 'An error occurred while setting database context',
      });
    }
  };
}

/**
 * Get Current User ID from Session Variables
 *
 * Helper function to retrieve the current user ID from PostgreSQL session.
 * Useful for complex queries that need the user context.
 *
 * Usage:
 *   const userId = await getCurrentUserId(pool);
 */
export async function getCurrentUserId(pool: Pool): Promise<string | null> {
  try {
    const result = await pool.query(
      `SELECT current_setting('app.current_user_id', true) as user_id`
    );
    return result.rows[0]?.user_id || null;
  } catch (error) {
    return null;
  }
}

/**
 * Get Current Community ID from Session Variables
 *
 * Helper function to retrieve the current community ID from PostgreSQL session.
 *
 * Usage:
 *   const communityId = await getCurrentCommunityId(pool);
 */
export async function getCurrentCommunityId(pool: Pool): Promise<string | null> {
  try {
    const result = await pool.query(
      `SELECT current_setting('app.current_community_id', true) as community_id`
    );
    return result.rows[0]?.community_id || null;
  } catch (error) {
    return null;
  }
}

/**
 * Clear Database Context
 *
 * Clears the session variables. Useful for admin operations that need
 * to bypass RLS temporarily.
 *
 * ⚠️ USE WITH EXTREME CAUTION - This disables tenant isolation!
 *
 * Usage:
 *   await clearDbContext(pool);
 *   // Perform admin operation
 *   await setDbContext(pool, userId, communityId);
 */
export async function clearDbContext(pool: Pool): Promise<void> {
  await pool.query(`
    SELECT
      set_config('app.current_user_id', null, true),
      set_config('app.current_community_id', null, true)
  `);
}

/**
 * Set Database Context Manually
 *
 * Manually set the session variables. Useful for background jobs
 * that need to run in a specific tenant context.
 *
 * Usage:
 *   await setDbContext(pool, userId, communityId);
 */
export async function setDbContext(
  pool: Pool,
  userId: string,
  communityId: string
): Promise<void> {
  await pool.query(
    `SELECT
      set_config('app.current_user_id', $1, true),
      set_config('app.current_community_id', $2, true)`,
    [userId, communityId]
  );
}
