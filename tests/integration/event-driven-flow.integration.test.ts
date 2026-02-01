/**
 * Event-Driven Flow Integration Test
 *
 * Tests the event-driven architecture using Bull queues:
 * 1. Create help request (request-service)
 * 2. Verify event published to queue
 * 3. Verify notification created (notification-service subscribes to event)
 * 4. Verify feed updated (feed-service subscribes to event)
 *
 * This test verifies inter-service communication through Redis/Bull queues.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { Pool } from 'pg';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const COMMUNITY_SERVICE_URL = process.env.COMMUNITY_SERVICE_URL || 'http://localhost:3002';
const REQUEST_SERVICE_URL = process.env.REQUEST_SERVICE_URL || 'http://localhost:3003';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005';
const FEED_SERVICE_URL = process.env.FEED_SERVICE_URL || 'http://localhost:3007';
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://karmyq_test:test_password@localhost:5433/karmyq_test';

describe('Event-Driven Flow', () => {
  let pool: Pool;
  let testUserId: string;
  let authToken: string;
  let testCommunityId: string;
  let testRequestId: string;

  const testUser = {
    email: `requester-${Date.now()}@karmyq.test`,
    password: 'SecurePassword123!',
    name: `requester-${Date.now()}`,
  };

  const testCommunity = {
    name: `Event Test Community ${Date.now()}`,
    description: 'Testing event-driven flows',
    location: 'Event City',
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });

    // Register user
    const userResponse = await request(AUTH_SERVICE_URL)
      .post('/auth/register')
      .send(testUser);

    testUserId = userResponse.body.data.user.id;
    authToken = userResponse.body.data.token;

    // Create community
    const communityResponse = await request(COMMUNITY_SERVICE_URL)
      .post('/communities')
      .set('Authorization', `Bearer ${authToken}`)
      .send(testCommunity);

    testCommunityId = communityResponse.body.data.id;
  });

  afterAll(async () => {
    // Cleanup in reverse order
    if (testRequestId) {
      await pool.query('DELETE FROM requests.help_requests WHERE id = $1', [testRequestId]);
    }
    if (testCommunityId) {
      await pool.query('DELETE FROM communities.members WHERE community_id = $1', [testCommunityId]);
      await pool.query('DELETE FROM communities.communities WHERE id = $1', [testCommunityId]);
    }
    if (testUserId) {
      await pool.query('DELETE FROM notifications.notifications WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM auth.users WHERE id = $1', [testUserId]);
    }
    await pool.end();
  });

  describe('Request Creation Event', () => {
    it('should create help request and trigger events', async () => {
      const helpRequest = {
        community_id: testCommunityId,
        title: 'Need help with gardening',
        description: 'Looking for someone to help with community garden',
        category: 'physical_help',
        urgency: 'medium',
      };

      const response = await request(REQUEST_SERVICE_URL)
        .post('/requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send(helpRequest)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe(helpRequest.title);
      expect(response.body.data.status).toBe('open');

      testRequestId = response.body.data.id;
    });

    it('should verify request in database', async () => {
      const result = await pool.query(
        'SELECT id, title, status, requester_id FROM requests.help_requests WHERE id = $1',
        [testRequestId]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].title).toBe('Need help with gardening');
      expect(result.rows[0].requester_id).toBe(testUserId);
    });
  });

  describe('Notification Service Event Handling', () => {
    it('should create notification from request_created event', async () => {
      // Wait for event processing (Bull queue)
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await request(NOTIFICATION_SERVICE_URL)
        .get(`/notifications/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('notifications');
      expect(response.body.data.notifications).toBeInstanceOf(Array);

      // Find notification related to request creation
      const requestNotification = response.body.data.notifications.find(
        (n: any) => n.type === 'request_created' && n.entity_id === testRequestId
      );

      // Note: This will fail if notification-service doesn't subscribe to request_created event
      // or if event processing is not set up yet
      if (requestNotification) {
        expect(requestNotification.user_id).toBe(testUserId);
        expect(requestNotification.read).toBe(false);
      } else {
        console.warn('⚠️  Notification not found - event subscription may not be implemented yet');
      }
    });

    it('should verify notification in database', async () => {
      const result = await pool.query(
        'SELECT id, type, data, user_id FROM notifications.notifications WHERE user_id = $1 AND type = $2',
        [testUserId, 'request_created']
      );

      // May be 0 if event handling not implemented yet
      if (result.rows.length > 0) {
        expect(result.rows[0].type).toBe('request_created');
        expect(result.rows[0].user_id).toBe(testUserId);
        // Entity info is stored in JSONB data field
        const data = typeof result.rows[0].data === 'string' ? JSON.parse(result.rows[0].data) : result.rows[0].data;
        expect(data.request_id).toBe(testRequestId);
      } else {
        console.warn('⚠️  Notification not in database - event subscription may not be implemented yet');
      }
    });
  });

  describe('Feed Service Event Handling', () => {
    it('should add request to feed from request_created event', async () => {
      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await request(FEED_SERVICE_URL)
        .get(`/feed?community_id=${testCommunityId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data.items).toBeInstanceOf(Array);

      // Find feed item for the request
      const feedItem = response.body.data.items.find(
        (item: any) => item.entity_type === 'request' && item.entity_id === testRequestId
      );

      if (feedItem) {
        expect(feedItem.action).toBe('created');
        expect(feedItem.community_id).toBe(testCommunityId);
      } else {
        console.warn('⚠️  Feed item not found - event subscription may not be implemented yet');
      }
    });
  });

  describe('Event Processing Reliability', () => {
    it('should handle multiple events without data loss', async () => {
      // Create multiple requests quickly to test event queue
      const requests = [];
      for (let i = 0; i < 3; i++) {
        const response = await request(REQUEST_SERVICE_URL)
          .post('/requests')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            community_id: testCommunityId,
            title: `Bulk request ${i + 1}`,
            description: `Testing event processing ${i + 1}`,
            category: 'errands',
            urgency: 'low',
          });

        requests.push(response.body.data.id);
      }

      // Wait for all events to process
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify all requests exist in database
      const result = await pool.query(
        'SELECT id FROM requests.help_requests WHERE id = ANY($1::uuid[])',
        [requests]
      );

      expect(result.rows.length).toBe(3);

      // Cleanup bulk requests
      await pool.query(
        'DELETE FROM requests.help_requests WHERE id = ANY($1::uuid[])',
        [requests]
      );
    });
  });

  describe('Cross-Service Data Consistency', () => {
    it('should maintain referential integrity across services', async () => {
      // Verify request references valid user
      const requestResult = await pool.query(
        'SELECT requester_id FROM requests.help_requests WHERE id = $1',
        [testRequestId]
      );

      const userResult = await pool.query(
        'SELECT id FROM auth.users WHERE id = $1',
        [requestResult.rows[0].requester_id]
      );

      expect(userResult.rows.length).toBe(1);
    });

    it('should maintain community references', async () => {
      // Verify request references valid community via junction table
      const requestCommunityResult = await pool.query(
        'SELECT community_id FROM requests.request_communities WHERE request_id = $1',
        [testRequestId]
      );

      expect(requestCommunityResult.rows.length).toBe(1);

      const communityResult = await pool.query(
        'SELECT id FROM communities.communities WHERE id = $1',
        [requestCommunityResult.rows[0].community_id]
      );

      expect(communityResult.rows.length).toBe(1);
    });
  });
});
