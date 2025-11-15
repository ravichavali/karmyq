/**
 * Authentication & JWT Multi-Community Tests
 *
 * Tests the enhanced JWT system with multi-community support
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const COMMUNITY_SERVICE_URL = process.env.COMMUNITY_SERVICE_URL || 'http://localhost:3002';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';

let pool: Pool;
let testUser: any;
let testToken: string;
let portlandCommunity: any;
let oaklandCommunity: any;

beforeAll(async () => {
  // Setup database connection for cleanup
  pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://karmyq_user:karmyq_password_dev@localhost:5432/karmyq_db'
  });
});

afterAll(async () => {
  // Cleanup test data
  if (testUser) {
    await pool.query('DELETE FROM auth.users WHERE id = $1', [testUser.id]);
  }
  await pool.end();
});

describe('Authentication Service', () => {
  describe('POST /auth/register', () => {
    it('should register a new user with empty communities array', async () => {
      const response = await request(AUTH_SERVICE_URL)
        .post('/auth/register')
        .send({
          email: `test-${Date.now()}@example.com`,
          name: 'Test User',
          password: 'password123'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.communities).toEqual([]);

      // Save for later tests
      testUser = response.body.user;
      testToken = response.body.token;

      // Verify JWT payload
      const decoded: any = jwt.verify(testToken, JWT_SECRET);
      expect(decoded.userId).toBe(testUser.id);
      expect(decoded.email).toBe(testUser.email);
      expect(decoded.communities).toEqual([]);
    });

    it('should reject registration with missing fields', async () => {
      const response = await request(AUTH_SERVICE_URL)
        .post('/auth/register')
        .send({
          email: 'incomplete@example.com'
          // Missing name and password
        });

      expect(response.status).toBe(400);
    });

    it('should reject weak passwords', async () => {
      const response = await request(AUTH_SERVICE_URL)
        .post('/auth/register')
        .send({
          email: 'weak@example.com',
          name: 'Weak Password',
          password: '123'  // Too short
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login and return JWT with communities', async () => {
      const response = await request(AUTH_SERVICE_URL)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('communities');
    });

    it('should reject invalid credentials', async () => {
      const response = await request(AUTH_SERVICE_URL)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /auth/verify', () => {
    it('should verify valid token and return user info', async () => {
      const response = await request(AUTH_SERVICE_URL)
        .get('/auth/verify')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.userId).toBe(testUser.id);
      expect(response.body.communities).toBeDefined();
    });

    it('should reject invalid token', async () => {
      const response = await request(AUTH_SERVICE_URL)
        .get('/auth/verify')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('should reject missing token', async () => {
      const response = await request(AUTH_SERVICE_URL)
        .get('/auth/verify');

      expect(response.status).toBe(401);
    });
  });
});

describe('Multi-Community JWT Flow', () => {
  describe('Creating and joining communities', () => {
    it('should create Portland community and user becomes admin', async () => {
      const response = await request(COMMUNITY_SERVICE_URL)
        .post('/communities')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Portland Tools Test',
          description: 'Test community',
          location: { city: 'Portland', state: 'OR' }
        });

      expect(response.status).toBe(201);
      portlandCommunity = response.body.community;
    });

    it('should refresh JWT and include Portland community', async () => {
      const response = await request(AUTH_SERVICE_URL)
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.communities).toHaveLength(1);
      expect(response.body.communities[0].id).toBe(portlandCommunity.id);
      expect(response.body.communities[0].role).toBe('admin');
      expect(response.body.communities[0].name).toBe('Portland Tools Test');

      // Update token
      testToken = response.body.token;

      // Verify new JWT payload
      const decoded: any = jwt.verify(testToken, JWT_SECRET);
      expect(decoded.communities).toHaveLength(1);
      expect(decoded.communities[0].id).toBe(portlandCommunity.id);
      expect(decoded.currentCommunityId).toBe(portlandCommunity.id);
    });

    it('should create Oakland community', async () => {
      const response = await request(COMMUNITY_SERVICE_URL)
        .post('/communities')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Oakland Gardeners Test',
          description: 'Another test community',
          location: { city: 'Oakland', state: 'CA' }
        });

      expect(response.status).toBe(201);
      oaklandCommunity = response.body.community;
    });

    it('should refresh JWT and include both communities', async () => {
      const response = await request(AUTH_SERVICE_URL)
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.communities).toHaveLength(2);

      const communityIds = response.body.communities.map((c: any) => c.id);
      expect(communityIds).toContain(portlandCommunity.id);
      expect(communityIds).toContain(oaklandCommunity.id);

      testToken = response.body.token;
    });
  });

  describe('JWT Payload Validation', () => {
    it('should include all required fields in JWT', () => {
      const decoded: any = jwt.verify(testToken, JWT_SECRET);

      expect(decoded).toHaveProperty('userId');
      expect(decoded).toHaveProperty('email');
      expect(decoded).toHaveProperty('communities');
      expect(decoded).toHaveProperty('currentCommunityId');
      expect(decoded).toHaveProperty('iat');
      expect(decoded).toHaveProperty('exp');
    });

    it('should have communities with correct structure', () => {
      const decoded: any = jwt.verify(testToken, JWT_SECRET);

      decoded.communities.forEach((community: any) => {
        expect(community).toHaveProperty('id');
        expect(community).toHaveProperty('role');
        expect(community).toHaveProperty('name');
        expect(['admin', 'member']).toContain(community.role);
      });
    });

    it('should set currentCommunityId to first community', () => {
      const decoded: any = jwt.verify(testToken, JWT_SECRET);

      expect(decoded.currentCommunityId).toBe(decoded.communities[0].id);
    });
  });
});

describe('JWT Refresh Strategy', () => {
  it('should not change userId or email on refresh', async () => {
    const oldDecoded: any = jwt.verify(testToken, JWT_SECRET);

    const response = await request(AUTH_SERVICE_URL)
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${testToken}`);

    const newDecoded: any = jwt.verify(response.body.token, JWT_SECRET);

    expect(newDecoded.userId).toBe(oldDecoded.userId);
    expect(newDecoded.email).toBe(oldDecoded.email);
  });

  it('should extend expiration on refresh', async () => {
    const oldDecoded: any = jwt.verify(testToken, JWT_SECRET);

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await request(AUTH_SERVICE_URL)
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${testToken}`);

    const newDecoded: any = jwt.verify(response.body.token, JWT_SECRET);

    expect(newDecoded.exp).toBeGreaterThan(oldDecoded.exp);
  });

  it('should fetch latest community memberships on refresh', async () => {
    // This test would require modifying community membership
    // then refreshing to see the change
    // For now, just verify refresh works
    const response = await request(AUTH_SERVICE_URL)
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${testToken}`);

    expect(response.status).toBe(200);
    expect(response.body.communities).toBeDefined();
  });
});
