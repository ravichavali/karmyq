import axios from 'axios';
import { createPool } from '../fixtures';

const pool = createPool();

const SOCIAL_GRAPH_API_URL = process.env.SOCIAL_GRAPH_API_URL || 'http://localhost:3010';

describe('Social Graph Service - Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let communityId: string;
  let inviteeUserId: string;
  let invitationCode: string;

  beforeAll(async () => {
    // Cleanup any orphaned test data from previous failed runs (respect FK constraints)
    await pool.query(`DELETE FROM communities.communities WHERE creator_id IN (SELECT id FROM auth.users WHERE email IN ('testuser@example.com', 'invitee@example.com', 'newinvitee@example.com'))`);
    await pool.query(`DELETE FROM auth.users WHERE email IN ('testuser@example.com', 'invitee@example.com', 'newinvitee@example.com')`);

    // Create test users and community
    const userResult = await pool.query(
      `INSERT INTO auth.users (name, email, password_hash)
       VALUES ('Test User', 'testuser@example.com', 'hash123')
       RETURNING id`
    );
    userId = userResult.rows[0].id;

    const inviteeResult = await pool.query(
      `INSERT INTO auth.users (name, email, password_hash)
       VALUES ('Test Invitee', 'invitee@example.com', 'hash456')
       RETURNING id`
    );
    inviteeUserId = inviteeResult.rows[0].id;

    const communityResult = await pool.query(
      `INSERT INTO communities.communities (name, description, creator_id)
       VALUES ('Test Community', 'Test community for social graph', $1)
       RETURNING id`,
      [userId]
    );
    communityId = communityResult.rows[0].id;

    // Add users to community
    await pool.query(
      `INSERT INTO communities.members (community_id, user_id, role)
       VALUES ($1, $2, 'admin'), ($1, $3, 'member')`,
      [communityId, userId, inviteeUserId]
    );

    // Generate auth token
    const jwt = require('jsonwebtoken');
    authToken = jwt.sign(
      { userId, communityMemberships: [{ communityId, role: 'admin' }] },
      process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production'
    );
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM auth.user_invitations WHERE inviter_id = $1 OR invitee_id = $2', [userId, inviteeUserId]);
    await pool.query('DELETE FROM auth.social_distances WHERE user_a_id = $1 OR user_b_id = $1', [userId]);
    await pool.query('DELETE FROM communities.members WHERE community_id = $1', [communityId]);
    await pool.query('DELETE FROM communities.communities WHERE id = $1', [communityId]);
    await pool.query('DELETE FROM auth.users WHERE id IN ($1, $2)', [userId, inviteeUserId]);

    // Close pool connection
    await pool.end();
  });

  describe('Invitation Code Generation', () => {
    it('should generate invitation code successfully', async () => {
      const response = await axios.post(
        `${SOCIAL_GRAPH_API_URL}/invitations/generate`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'X-Community-ID': communityId,
          },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.code).toMatch(/^KARMYQ-/);
      expect(response.data.data.url).toContain(response.data.data.code);

      // Save for later tests
      invitationCode = response.data.data.code;
    });

    it('should require authentication', async () => {
      try {
        await axios.post(`${SOCIAL_GRAPH_API_URL}/invitations/generate`);
        fail('Should have thrown 401 error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('Invitation Acceptance', () => {
    it('should accept invitation code', async () => {
      // Generate invitee token
      const jwt = require('jsonwebtoken');
      const inviteeToken = jwt.sign(
        { userId: inviteeUserId, communityMemberships: [{ communityId, role: 'member' }] },
        process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production'
      );

      const response = await axios.post(
        `${SOCIAL_GRAPH_API_URL}/invitations/accept`,
        { invitation_code: invitationCode },
        {
          headers: {
            Authorization: `Bearer ${inviteeToken}`,
            'X-Community-ID': communityId,
          },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.inviter_id).toBe(userId);
    });

    it('should add user to community on invitation acceptance', async () => {
      // Create a new user who hasn't been added to community yet
      const newUserResult = await pool.query(
        `INSERT INTO auth.users (name, email, password_hash)
         VALUES ('New Invitee', 'newinvitee@example.com', 'hash999')
         RETURNING id`
      );
      const newUserId = newUserResult.rows[0].id;

      // Generate a fresh invitation code
      const jwt = require('jsonwebtoken');
      const freshInviteResponse = await axios.post(
        `${SOCIAL_GRAPH_API_URL}/invitations/generate`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'X-Community-ID': communityId,
          },
        }
      );
      const freshCode = freshInviteResponse.data.data.code;

      // Get initial member count
      const beforeResult = await pool.query(
        'SELECT current_members FROM communities.communities WHERE id = $1',
        [communityId]
      );
      const memberCountBefore = beforeResult.rows[0].current_members;

      // Accept invitation
      const newUserToken = jwt.sign(
        { userId: newUserId, communityMemberships: [] }, // Empty initially
        process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production'
      );

      await axios.post(
        `${SOCIAL_GRAPH_API_URL}/invitations/accept`,
        { invitation_code: freshCode },
        {
          headers: {
            Authorization: `Bearer ${newUserToken}`,
            'X-Community-ID': communityId,
          },
        }
      );

      // Verify user was added to community
      const membershipResult = await pool.query(
        `SELECT role FROM communities.members
         WHERE community_id = $1 AND user_id = $2`,
        [communityId, newUserId]
      );
      expect(membershipResult.rows.length).toBe(1);
      expect(membershipResult.rows[0].role).toBe('member');

      // Verify member count was incremented
      const afterResult = await pool.query(
        'SELECT current_members FROM communities.communities WHERE id = $1',
        [communityId]
      );
      const memberCountAfter = afterResult.rows[0].current_members;
      expect(memberCountAfter).toBe(memberCountBefore + 1);

      // Cleanup
      await pool.query('DELETE FROM auth.user_invitations WHERE invitee_id = $1', [newUserId]);
      await pool.query('DELETE FROM communities.members WHERE user_id = $1', [newUserId]);
      await pool.query('DELETE FROM auth.users WHERE id = $1', [newUserId]);
    });

    it('should reject invalid invitation code', async () => {
      const jwt = require('jsonwebtoken');
      const inviteeToken = jwt.sign(
        { userId: inviteeUserId, communityMemberships: [{ communityId, role: 'member' }] },
        process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production'
      );

      try {
        await axios.post(
          `${SOCIAL_GRAPH_API_URL}/invitations/accept`,
          { invitation_code: 'INVALID-CODE-123' },
          {
            headers: {
              Authorization: `Bearer ${inviteeToken}`,
              'X-Community-ID': communityId,
            },
          }
        );
        fail('Should have thrown 404 error');
      } catch (error: any) {
        expect(error.response.status).toBe(404);
      }
    });

    it('should reject already-used invitation code', async () => {
      const jwt = require('jsonwebtoken');
      const anotherUserResult = await pool.query(
        `INSERT INTO auth.users (name, email, password_hash)
         VALUES ('Another User', 'another@example.com', 'hash789')
         RETURNING id`
      );
      const anotherUserId = anotherUserResult.rows[0].id;

      await pool.query(
        `INSERT INTO communities.members (community_id, user_id, role)
         VALUES ($1, $2, 'member')`,
        [communityId, anotherUserId]
      );

      const anotherUserToken = jwt.sign(
        { userId: anotherUserId, communityMemberships: [{ communityId, role: 'member' }] },
        process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production'
      );

      try {
        await axios.post(
          `${SOCIAL_GRAPH_API_URL}/invitations/accept`,
          { invitation_code: invitationCode },
          {
            headers: {
              Authorization: `Bearer ${anotherUserToken}`,
              'X-Community-ID': communityId,
            },
          }
        );
        fail('Should have thrown 400 error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toContain('already been used');
      } finally {
        // Cleanup
        await pool.query('DELETE FROM communities.members WHERE user_id = $1', [anotherUserId]);
        await pool.query('DELETE FROM auth.users WHERE id = $1', [anotherUserId]);
      }
    });
  });

  describe('Trust Path Computation', () => {
    it('should compute 1-degree path (direct invite)', async () => {
      const response = await axios.get(
        `${SOCIAL_GRAPH_API_URL}/paths/${inviteeUserId}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'X-Community-ID': communityId,
          },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.degrees_of_separation).toBe(1);
      expect(response.data.data.path).toHaveLength(2);
      expect(response.data.data.path[0].id).toBe(userId);
      expect(response.data.data.path[1].id).toBe(inviteeUserId);
    });

    it('should cache computed paths', async () => {
      // Clear cache for this path to ensure fresh computation
      await pool.query(
        'DELETE FROM auth.social_distances WHERE user_a_id = $1 AND user_b_id = $2 AND community_id = $3',
        [userId, inviteeUserId, communityId]
      );

      // First request - should compute
      const response1 = await axios.get(
        `${SOCIAL_GRAPH_API_URL}/paths/${inviteeUserId}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'X-Community-ID': communityId,
          },
        }
      );

      expect(response1.data.data.cached).toBe(false);

      // Second request - should be cached
      const response2 = await axios.get(
        `${SOCIAL_GRAPH_API_URL}/paths/${inviteeUserId}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'X-Community-ID': communityId,
          },
        }
      );

      expect(response2.data.data.cached).toBe(true);
      expect(response2.data.data.degrees_of_separation).toBe(response1.data.data.degrees_of_separation);
    });

    it('should reject path to self', async () => {
      try {
        await axios.get(
          `${SOCIAL_GRAPH_API_URL}/paths/${userId}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
              'X-Community-ID': communityId,
            },
          }
        );
        fail('Should have thrown 400 error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toContain('yourself');
      }
    });
  });

  describe('Batch Path Computation', () => {
    it('should compute paths for multiple users', async () => {
      const response = await axios.post(
        `${SOCIAL_GRAPH_API_URL}/paths/batch`,
        { target_user_ids: [inviteeUserId] },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'X-Community-ID': communityId,
          },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveLength(1);
      expect(response.data.data[0].target_user_id).toBe(inviteeUserId);
      expect(response.data.data[0].degrees_of_separation).toBe(1);
    });

    it('should handle empty user list', async () => {
      try {
        await axios.post(
          `${SOCIAL_GRAPH_API_URL}/paths/batch`,
          { target_user_ids: [] },
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
              'X-Community-ID': communityId,
            },
          }
        );
        fail('Should have thrown 400 error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });
  });

  describe('Invitation History', () => {
    it('should return invitation history', async () => {
      const response = await axios.get(
        `${SOCIAL_GRAPH_API_URL}/invitations`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'X-Community-ID': communityId,
          },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.sent).toBeDefined();
      expect(response.data.data.sent.length).toBeGreaterThan(0);
      expect(response.data.data.sent[0].invitee).toBeDefined();
      expect(response.data.data.sent[0].invitee.id).toBe(inviteeUserId);
    });
  });

  describe('Inviter Statistics', () => {
    it('should return inviter statistics', async () => {
      const response = await axios.get(
        `${SOCIAL_GRAPH_API_URL}/invitations/stats`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'X-Community-ID': communityId,
          },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.total_invitations_sent).toBeGreaterThanOrEqual(1);
      expect(response.data.data.total_invitations_accepted).toBeGreaterThanOrEqual(1);
    });
  });
});
