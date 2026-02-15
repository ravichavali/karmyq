/**
 * Test Setup Utilities
 *
 * Provides test helpers for database, app, and authentication
 */

import { Pool } from 'pg';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import schemasRouter from '../../src/routes/schemas';
import adminSchemasRouter from '../../src/routes/admin-schemas';
import { adminAuth } from '../../src/middleware/adminAuth';

// Test database pool
export function createTestPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://karmyq_user:karmyq_password@localhost:5432/karmyq_test',
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

// Test Express app
export function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Mount routes
  app.use('/schemas', schemasRouter);
  app.use('/admin/schemas', ...adminAuth, adminSchemasRouter);

  return app;
}

// Generate test JWT tokens
export function createAdminToken(): string {
  const secret = process.env.JWT_SECRET || 'test-secret';
  return jwt.sign(
    {
      userId: 'admin-user-id',
      email: 'admin@test.com',
      role: 'admin',
    },
    secret,
    { expiresIn: '1h' }
  );
}

export function createUserToken(): string {
  const secret = process.env.JWT_SECRET || 'test-secret';
  return jwt.sign(
    {
      userId: 'regular-user-id',
      email: 'user@test.com',
    },
    secret,
    { expiresIn: '1h' }
  );
}

// Clean up test data
export async function cleanupTestData(pool: Pool) {
  await pool.query('DELETE FROM requests.ui_schemas WHERE type LIKE $1', ['test_%']);
  await pool.query('DELETE FROM requests.ui_schema_versions WHERE schema_id NOT IN (SELECT id FROM requests.ui_schemas)');
}

// Seed test schema
export async function seedTestSchema(pool: Pool, type: string = 'ride') {
  const result = await pool.query(`
    INSERT INTO requests.ui_schemas (
      type, version, label, icon, color, description, sections, status, published_at
    ) VALUES ($1, 1, $2, '🚗', 'blue', 'Test schema', '[]'::jsonb, 'published', NOW())
    ON CONFLICT (type, variant) DO NOTHING
    RETURNING id
  `, [type, `Test ${type}`]);

  return result.rows[0]?.id;
}
