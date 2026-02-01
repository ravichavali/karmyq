/**
 * Authentication Flow Integration Test
 *
 * Tests the complete authentication workflow:
 * 1. User registration
 * 2. User login
 * 3. Authenticated requests
 *
 * This test verifies service-to-service communication and database operations.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_change_me';
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://karmyq_test:test_password@localhost:5433/karmyq_test';

describe('Authentication Flow', () => {
  let pool: Pool;
  let testUserId: string;
  let authToken: string;

  const testUser = {
    email: `test-${Date.now()}@karmyq.test`,
    password: 'SecurePassword123!',
    name: `Test User ${Date.now()}`,
  };

  beforeAll(async () => {
    // Connect to test database for cleanup
    pool = new Pool({ connectionString: DATABASE_URL });
  });

  afterAll(async () => {
    // Cleanup: Delete test user from database
    if (testUserId) {
      await pool.query('DELETE FROM auth.users WHERE id = $1', [testUserId]);
    }
    await pool.end();
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const response = await request(AUTH_SERVICE_URL)
        .post('/auth/register')
        .send({
          email: testUser.email,
          password: testUser.password,
          name: testUser.name,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user.name).toBe(testUser.name);

      // Save user ID and token for subsequent tests
      testUserId = response.body.data.user.id;
      authToken = response.body.data.token;

      // Verify token is valid JWT
      const decoded = jwt.verify(authToken, JWT_SECRET) as any;
      expect(decoded.userId).toBe(testUserId);
      expect(decoded.email).toBe(testUser.email);
    });

    it('should not register duplicate email', async () => {
      const response = await request(AUTH_SERVICE_URL)
        .post('/auth/register')
        .send({
          email: testUser.email, // Same email as before
          password: 'DifferentPassword123!',
          name: `different-${Date.now()}`,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/email.*exists|already.*registered/i);
    });

    it('should validate password strength', async () => {
      const response = await request(AUTH_SERVICE_URL)
        .post('/auth/register')
        .send({
          email: `weak-${Date.now()}@karmyq.test`,
          password: '123', // Weak password
          name: `weakuser-${Date.now()}`,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/password/i);
    });
  });

  describe('User Login', () => {
    it('should login with correct credentials', async () => {
      const response = await request(AUTH_SERVICE_URL)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe(testUser.email);

      // Verify new token is valid
      const newToken = response.body.data.token;
      const decoded = jwt.verify(newToken, JWT_SECRET) as any;
      expect(decoded.userId).toBe(testUserId);
    });

    it('should reject invalid password', async () => {
      const response = await request(AUTH_SERVICE_URL)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/invalid.*credentials|incorrect.*password/i);
    });

    it('should reject non-existent email', async () => {
      const response = await request(AUTH_SERVICE_URL)
        .post('/auth/login')
        .send({
          email: 'nonexistent@karmyq.test',
          password: 'SomePassword123!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/invalid.*credentials|user.*not.*found/i);
    });
  });

  describe('Authenticated Requests', () => {
    it('should access protected endpoint with valid token', async () => {
      const response = await request(AUTH_SERVICE_URL)
        .get('/auth/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testUserId);
      expect(response.body.data.email).toBe(testUser.email);
    });

    it('should reject request without token', async () => {
      const response = await request(AUTH_SERVICE_URL)
        .get('/auth/users/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/token|unauthorized|authentication/i);
    });

    it('should reject request with invalid token', async () => {
      const response = await request(AUTH_SERVICE_URL)
        .get('/auth/users/me')
        .set('Authorization', 'Bearer invalid-token-here')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/token|invalid|unauthorized/i);
    });

    it('should reject request with expired token', async () => {
      // Create expired token (expired 1 hour ago)
      const expiredToken = jwt.sign(
        { userId: testUserId, email: testUser.email },
        JWT_SECRET,
        { expiresIn: '-1h' }
      );

      const response = await request(AUTH_SERVICE_URL)
        .get('/auth/users/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/expired|token/i);
    });
  });

  describe('Database Persistence', () => {
    it('should persist user data in database', async () => {
      const result = await pool.query(
        'SELECT id, email, name FROM auth.users WHERE id = $1',
        [testUserId]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].email).toBe(testUser.email);
      expect(result.rows[0].name).toBe(testUser.name);
    });

    it('should not store password in plain text', async () => {
      const result = await pool.query(
        'SELECT password_hash FROM auth.users WHERE id = $1',
        [testUserId]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].password_hash).not.toBe(testUser.password);
      expect(result.rows[0].password_hash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
    });
  });
});
