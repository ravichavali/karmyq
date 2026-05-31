/**
 * Database-based user loader for simulation service.
 *
 * Queries the production database directly for random users and
 * generates JWT tokens, bypassing the login API entirely.
 */

import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

let pool: Pool;
let jwtSecret: string;

/**
 * Initialize the database connection pool
 */
export function initPool(databaseUrl: string, secret: string): void {
  pool = new Pool({ connectionString: databaseUrl });
  jwtSecret = secret;
}

/**
 * Close the database connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
  }
}

/**
 * Get the initialized pool for direct DB queries in workflows
 */
export function getPool(): Pool {
  return pool;
}

/**
 * SQL predicate selecting the simulation actor pool: only synthetic sim users
 * (@test.karmyq.com), and explicitly never the e2e/integration fixture accounts
 * (@karmyq.test). The positive domain filter already excludes the latter; the
 * NOT LIKE is defense-in-depth so the fixtures stay protected even if the
 * positive filter is ever loosened. Sending sim workflows to e2e accounts would
 * corrupt their state and flake the test suite.
 */
export const SIM_ACTOR_POOL_FILTER =
  "email LIKE '%@test.karmyq.com' AND email NOT LIKE '%@karmyq.test'";

interface DbUser {
  id: string;
  email: string;
  name: string;
}

interface CommunityMembership {
  id: string;
  role: string;
  name: string;
}

/**
 * Get a random user from the database
 */
export async function getRandomUser(): Promise<DbUser> {
  const result = await pool.query(
    `SELECT id, email, name FROM auth.users WHERE ${SIM_ACTOR_POOL_FILTER} ORDER BY RANDOM() LIMIT 1`
  );

  if (result.rows.length === 0) {
    throw new Error('No users found in database');
  }

  return result.rows[0];
}

/**
 * Get total count of simulated users (those with @test.karmyq.com emails)
 */
export async function getUserCount(): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM auth.users WHERE ${SIM_ACTOR_POOL_FILTER}`
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Check if a user with a given email already exists
 */
export async function userExistsByEmail(email: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT id FROM auth.users WHERE email = $1',
    [email]
  );
  return result.rows.length > 0;
}

/**
 * Get community memberships for a user (matches auth service format)
 */
async function getUserCommunities(userId: string): Promise<CommunityMembership[]> {
  const result = await pool.query(
    `SELECT
      cm.community_id as id,
      cm.role,
      c.name
     FROM communities.members cm
     JOIN communities.communities c ON cm.community_id = c.id
     WHERE cm.user_id = $1 AND cm.status = 'active'
     ORDER BY cm.joined_at DESC`,
    [userId]
  );

  return result.rows.map(row => ({
    id: row.id,
    role: row.role,
    name: row.name,
  }));
}

/**
 * Generate a JWT token for a user (same format as auth service)
 */
export async function generateToken(user: DbUser): Promise<string> {
  const communities = await getUserCommunities(user.id);

  const payload = {
    userId: user.id,
    email: user.email,
    communities,
    currentCommunityId: communities.length > 0 ? communities[0].id : undefined,
  };

  return jwt.sign(payload, jwtSecret, { expiresIn: '7d' });
}
