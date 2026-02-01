/**
 * Community Flow Integration Test
 *
 * Tests the complete community workflow:
 * 1. Create community (requires auth)
 * 2. Join community
 * 3. List community members
 * 4. Verify JWT includes community memberships
 *
 * This test verifies integration between auth-service and community-service.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const COMMUNITY_SERVICE_URL = process.env.COMMUNITY_SERVICE_URL || 'http://localhost:3002';
const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_change_me';
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://karmyq_test:test_password@localhost:5433/karmyq_test';

describe('Community Flow', () => {
  let pool: Pool;
  let testUserId: string;
  let authToken: string;
  let testCommunityId: string;
  let secondUserId: string;
  let secondUserToken: string;

  const testUser = {
    email: `creator-${Date.now()}@karmyq.test`,
    password: 'SecurePassword123!',
    username: `creator-${Date.now()}`,
  };

  const secondUser = {
    email: `joiner-${Date.now()}@karmyq.test`,
    password: 'SecurePassword123!',
    username: `joiner-${Date.now()}`,
  };

  const testCommunity = {
    name: `Test Community ${Date.now()}`,
    description: 'A test community for integration testing',
    location: 'Test City',
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });

    // Register first user (community creator)
    const user1Response = await request(AUTH_SERVICE_URL)
      .post('/auth/register')
      .send(testUser);

    testUserId = user1Response.body.data.user.id;
    authToken = user1Response.body.data.token;

    // Register second user (will join community)
    const user2Response = await request(AUTH_SERVICE_URL)
      .post('/auth/register')
      .send(secondUser);

    secondUserId = user2Response.body.data.user.id;
    secondUserToken = user2Response.body.data.token;
  });

  afterAll(async () => {
    // Cleanup in reverse order (foreign key constraints)
    if (testCommunityId) {
      await pool.query('DELETE FROM community.members WHERE community_id = $1', [testCommunityId]);
      await pool.query('DELETE FROM community.communities WHERE id = $1', [testCommunityId]);
    }
    if (testUserId) {
      await pool.query('DELETE FROM auth.users WHERE id = $1', [testUserId]);
    }
    if (secondUserId) {
      await pool.query('DELETE FROM auth.users WHERE id = $1', [secondUserId]);
    }
    await pool.end();
  });

  describe('Create Community', () => {
    it('should create community with authenticated user', async () => {
      const response = await request(COMMUNITY_SERVICE_URL)
        .post('/communities')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testCommunity)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(testCommunity.name);
      expect(response.body.data.description).toBe(testCommunity.description);

      testCommunityId = response.body.data.id;
    });

    it('should reject community creation without auth', async () => {
      const response = await request(COMMUNITY_SERVICE_URL)
        .post('/communities')
        .send({
          name: `Unauthorized Community ${Date.now()}`,
          description: 'Should fail',
          location: 'Nowhere',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should automatically add creator as admin member', async () => {
      const result = await pool.query(
        'SELECT user_id, role FROM community.members WHERE community_id = $1 AND user_id = $2',
        [testCommunityId, testUserId]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].role).toBe('admin');
    });
  });

  describe('Join Community', () => {
    it('should allow user to join community', async () => {
      const response = await request(COMMUNITY_SERVICE_URL)
        .post(`/communities/${testCommunityId}/join`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toMatch(/joined|successfully/i);
    });

    it('should verify member in database', async () => {
      const result = await pool.query(
        'SELECT user_id, role FROM community.members WHERE community_id = $1 AND user_id = $2',
        [testCommunityId, secondUserId]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].role).toBe('member');
    });

    it('should not allow duplicate joins', async () => {
      const response = await request(COMMUNITY_SERVICE_URL)
        .post(`/communities/${testCommunityId}/join`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/already.*member/i);
    });

    it('should reject join without auth', async () => {
      const response = await request(COMMUNITY_SERVICE_URL)
        .post(`/communities/${testCommunityId}/join`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('List Members', () => {
    it('should list all community members', async () => {
      const response = await request(COMMUNITY_SERVICE_URL)
        .get(`/communities/${testCommunityId}/members`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(2); // Creator + joiner

      // Find creator and joiner in member list
      const creator = response.body.data.find((m: any) => m.user_id === testUserId);
      const joiner = response.body.data.find((m: any) => m.user_id === secondUserId);

      expect(creator).toBeDefined();
      expect(creator.role).toBe('admin');
      expect(joiner).toBeDefined();
      expect(joiner.role).toBe('member');
    });

    it('should allow non-members to view members (public community)', async () => {
      // Create a third user who is not a member
      const thirdUser = {
        email: `viewer-${Date.now()}@karmyq.test`,
        password: 'SecurePassword123!',
        username: `viewer-${Date.now()}`,
      };

      const viewerResponse = await request(AUTH_SERVICE_URL)
        .post('/auth/register')
        .send(thirdUser);

      const viewerToken = viewerResponse.body.data.token;
      const viewerId = viewerResponse.body.data.user.id;

      const response = await request(COMMUNITY_SERVICE_URL)
        .get(`/communities/${testCommunityId}/members`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);

      // Cleanup viewer
      await pool.query('DELETE FROM auth.users WHERE id = $1', [viewerId]);
    });
  });

  describe('JWT Community Memberships', () => {
    it('should include community memberships in JWT after joining', async () => {
      // User logs in after joining community
      const loginResponse = await request(AUTH_SERVICE_URL)
        .post('/auth/login')
        .send({
          email: secondUser.email,
          password: secondUser.password,
        })
        .expect(200);

      const newToken = loginResponse.body.data.token;
      const decoded = jwt.verify(newToken, JWT_SECRET) as any;

      expect(decoded).toHaveProperty('communityMemberships');
      expect(decoded.communityMemberships).toBeInstanceOf(Array);

      // Find the test community in memberships
      const membership = decoded.communityMemberships.find(
        (m: any) => m.id === testCommunityId
      );

      expect(membership).toBeDefined();
      expect(membership.name).toBe(testCommunity.name);
      expect(membership.role).toBe('member');
    });

    it('should include admin role in JWT for community creator', async () => {
      const loginResponse = await request(AUTH_SERVICE_URL)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      const newToken = loginResponse.body.data.token;
      const decoded = jwt.verify(newToken, JWT_SECRET) as any;

      const membership = decoded.communityMemberships.find(
        (m: any) => m.id === testCommunityId
      );

      expect(membership).toBeDefined();
      expect(membership.role).toBe('admin');
    });
  });

  describe('Cross-Service Integration', () => {
    it('should verify auth-service validates tokens from community-service', async () => {
      // Get user profile using token
      const response = await request(AUTH_SERVICE_URL)
        .get('/auth/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testUserId);
    });

    it('should verify community-service rejects invalid auth tokens', async () => {
      const response = await request(COMMUNITY_SERVICE_URL)
        .post(`/communities/${testCommunityId}/join`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
