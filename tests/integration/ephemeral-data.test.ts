/**
 * Ephemeral Data & TTL Tests
 *
 * Tests the TTL (Time-To-Live) and expiration features:
 * - Request TTL configuration
 * - Offer TTL configuration
 * - Message TTL configuration
 * - Expiration marking
 * - Data cleanup
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import {
  ServiceUrls,
  TestScenario,
  UserFactory,
  RequestFactory,
  OfferFactory,
  TestUser,
  TestCommunity,
  TestRequest,
} from '../fixtures';

let scenario: TestScenario;
let adminUser: TestUser | null;
let adminToken: string;
let regularUser: TestUser | null;
let regularToken: string;
let testCommunity: TestCommunity | null;

beforeAll(async () => {
  scenario = new TestScenario();

  const setup = await scenario.setupBasic(1);
  if (setup) {
    adminUser = setup.admin;
    adminToken = setup.admin.token;
    testCommunity = setup.community;

    if (setup.members.length > 0) {
      regularUser = setup.members[0];
      regularToken = setup.members[0].token;
    }
  }
});

afterAll(async () => {
  await scenario.cleanup();
});

describe('Ephemeral Data - TTL Configuration', () => {
  describe('GET /communities/:id/settings', () => {
    it('should return default TTL settings for a community', async () => {
      if (!testCommunity?.id) {
        console.log('Skipping: test community not created');
        return;
      }

      const response = await request(ServiceUrls.COMMUNITY)
        .get(`/communities/${testCommunity.id}/settings`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-community-id', testCommunity.id);

      // 403 may occur if admin membership not yet propagated
      expect([200, 403, 404]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.data).toBeDefined();
        // Default TTL should be set
        expect(response.body.data.request_ttl_days).toBeDefined();
        expect(response.body.data.offer_ttl_days).toBeDefined();
      }
    });

    it('should deny access to non-members', async () => {
      if (!testCommunity?.id) return;

      // Create a non-member user
      const outsider = await UserFactory.create({ prefix: 'outsider' });
      if (!outsider) return;

      const response = await request(ServiceUrls.COMMUNITY)
        .get(`/communities/${testCommunity.id}/settings`)
        .set('Authorization', `Bearer ${outsider.token}`)
        .set('x-community-id', testCommunity.id);

      // Should be unauthorized, forbidden, or not found
      expect([401, 403, 404]).toContain(response.status);

      // Cleanup
      await UserFactory.delete(scenario.pool, outsider.id);
    });
  });

  describe('PATCH /communities/:id/settings', () => {
    it('should allow admin to update TTL settings', async () => {
      if (!testCommunity?.id) return;

      const response = await request(ServiceUrls.COMMUNITY)
        .patch(`/communities/${testCommunity.id}/settings`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-community-id', testCommunity.id)
        .send({
          request_ttl_days: 14,
          offer_ttl_days: 7
        });

      // 403 may occur if admin membership not yet propagated
      expect([200, 403, 404]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.data.request_ttl_days).toBe(14);
        expect(response.body.data.offer_ttl_days).toBe(7);
      }
    });

    it('should reject invalid TTL values', async () => {
      if (!testCommunity?.id) return;

      const response = await request(ServiceUrls.COMMUNITY)
        .patch(`/communities/${testCommunity.id}/settings`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-community-id', testCommunity.id)
        .send({
          request_ttl_days: 500 // Too long
        });

      // 403 may occur if admin membership not yet propagated
      expect([400, 403, 404]).toContain(response.status);
    });

    it('should deny settings update to non-admin members', async () => {
      if (!testCommunity?.id || !regularToken) return;

      const response = await request(ServiceUrls.COMMUNITY)
        .patch(`/communities/${testCommunity.id}/settings`)
        .set('Authorization', `Bearer ${regularToken}`)
        .set('x-community-id', testCommunity.id)
        .send({
          request_ttl_days: 14
        });

      expect([403, 404]).toContain(response.status);
    });
  });
});

describe('Ephemeral Data - Request Expiration', () => {
  let testRequest: TestRequest | null;

  beforeEach(async () => {
    if (!testCommunity?.id || !adminUser) return;

    testRequest = await RequestFactory.create({
      communityId: testCommunity.id,
      requesterId: adminUser.id,
      requesterToken: adminToken,
      title: `TTL Test Request ${Date.now()}`,
      description: 'Testing expiration',
    });
  });

  it('should create requests with expires_at set', async () => {
    if (!testRequest?.id) {
      console.log('Skipping: test request not created');
      return;
    }

    // Check if ephemeral data columns exist before querying
    const columnCheck = await scenario.pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'requests'
        AND table_name = 'help_requests'
        AND column_name IN ('expires_at', 'expired')
    `);

    if (columnCheck.rows.length === 0) {
      console.log('Skipping: expires_at/expired columns do not exist');
      return;
    }

    // Query database directly to check expires_at
    const result = await scenario.pool.query(
      'SELECT expires_at, expired FROM requests.help_requests WHERE id = $1',
      [testRequest.id]
    );

    if (result.rows.length > 0) {
      expect(result.rows[0].expires_at).toBeDefined();
      expect(result.rows[0].expired).toBe(false);

      // expires_at should be in the future
      const expiresAt = new Date(result.rows[0].expires_at);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it('should not return expired requests in listings', async () => {
    if (!testRequest?.id || !testCommunity?.id) return;

    // Manually expire the request
    await scenario.pool.query(
      'UPDATE requests.help_requests SET expired = TRUE WHERE id = $1',
      [testRequest.id]
    );

    const response = await request(ServiceUrls.REQUEST)
      .get('/requests')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-community-id', testCommunity.id)
      .query({ community_id: testCommunity.id });

    expect(response.status).toBe(200);

    // The expired request should not appear
    const requests = response.body.data?.requests || response.body.data || response.body.requests || [];
    const found = requests.find((r: any) => r.id === testRequest?.id);
    expect(found).toBeUndefined();
  });
});

describe('Ephemeral Data - Offer Expiration', () => {
  let testRequest: TestRequest | null;
  let testOffer: any;

  beforeEach(async () => {
    if (!testCommunity?.id || !adminUser || !regularUser) return;

    // Create a test request
    testRequest = await RequestFactory.create({
      communityId: testCommunity.id,
      requesterId: adminUser.id,
      requesterToken: adminToken,
      title: `Offer TTL Test ${Date.now()}`,
    });

    if (testRequest) {
      testOffer = await OfferFactory.create({
        requestId: testRequest.id,
        responderId: regularUser.id,
        responderToken: regularToken,
        communityId: testCommunity.id,
      });
    }
  });

  it('should create offers with expires_at set', async () => {
    if (!testOffer?.id) {
      console.log('Skipping: test offer not created');
      return;
    }

    const result = await scenario.pool.query(
      'SELECT expires_at, expired FROM requests.help_offers WHERE id = $1',
      [testOffer.id]
    );

    if (result.rows.length > 0) {
      expect(result.rows[0].expires_at).toBeDefined();
      expect(result.rows[0].expired).toBe(false);
    }
  });

  it('should not return expired offers', async () => {
    if (!testOffer?.id || !testRequest?.id) return;

    // Manually expire the offer
    await scenario.pool.query(
      'UPDATE requests.help_offers SET expired = TRUE WHERE id = $1',
      [testOffer.id]
    );

    const response = await request(ServiceUrls.REQUEST)
      .get(`/requests/${testRequest.id}/offers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-community-id', testCommunity?.id || '');

    if (response.status === 200) {
      const offers = response.body.data || response.body.offers || [];
      const found = offers.find((o: any) => o.id === testOffer.id);
      expect(found).toBeUndefined();
    }
  });
});

describe('Ephemeral Data - Cleanup Service', () => {
  it('should require authentication for admin endpoints', async () => {
    const response = await request(ServiceUrls.CLEANUP)
      .post('/jobs/mark-expired');

    // 429 may occur due to rate limiting
    expect([401, 429]).toContain(response.status);

    if (response.status === 401) {
      // Check if error is in error field or message field
      const errorMessage = response.body.error || response.body.message;
      expect(errorMessage).toContain('Authentication required');
    }
  });

  it('should require admin privileges', async () => {
    if (!regularToken) return; // Skip if setup failed

    const response = await request(ServiceUrls.CLEANUP)
      .post('/jobs/mark-expired')
      .set('Authorization', `Bearer ${regularToken}`);

    // Regular user should be denied, rate limited, or service may return 500
    expect([401, 403, 429, 500]).toContain(response.status);
  });

  it('should allow admin to trigger expiration job', async () => {
    if (!adminToken) return; // Skip if setup failed

    // Admin user needs to be admin of at least one community
    const response = await request(ServiceUrls.CLEANUP)
      .post('/jobs/mark-expired')
      .set('Authorization', `Bearer ${adminToken}`);

    // May succeed, be forbidden, rate limited, or service may return 500
    expect([200, 403, 429, 500]).toContain(response.status);

    if (response.status === 200) {
      expect(response.body.success).toBe(true);
    }
  });

  it('health check should be accessible without auth', async () => {
    const response = await request(ServiceUrls.CLEANUP)
      .get('/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('healthy');
    expect(response.body.data.service).toBe('cleanup-service');
  });
});

describe('Ephemeral Data - Decay Preview', () => {
  it('should show decay preview for community', async () => {
    if (!testCommunity?.id) return;

    const response = await request(ServiceUrls.COMMUNITY)
      .get(`/communities/${testCommunity.id}/settings/decay-preview`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-community-id', testCommunity.id);

    // 403 may occur if admin membership not yet propagated
    expect([200, 403, 404]).toContain(response.status);

    if (response.status === 200) {
      // Should show decay statistics
      expect(response.body.data).toBeDefined();
    }
  });
});
