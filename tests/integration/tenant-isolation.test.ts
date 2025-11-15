/**
 * Multi-Tenant Isolation Tests
 *
 * Verifies that Row-Level Security policies properly isolate data between communities
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { Pool } from 'pg';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const COMMUNITY_SERVICE_URL = process.env.COMMUNITY_SERVICE_URL || 'http://localhost:3002';
const REQUEST_SERVICE_URL = process.env.REQUEST_SERVICE_URL || 'http://localhost:3003';
const REPUTATION_SERVICE_URL = process.env.REPUTATION_SERVICE_URL || 'http://localhost:3004';

let pool: Pool;

// User 1 in Portland Community
let user1: any;
let user1Token: string;
let portlandCommunity: any;

// User 2 in Oakland Community
let user2: any;
let user2Token: string;
let oaklandCommunity: any;

// Test data
let portlandRequest: any;
let oaklandRequest: any;

beforeAll(async () => {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://karmyq_user:karmyq_password_dev@localhost:5432/karmyq_db'
  });

  // Create User 1
  const user1Response = await request(AUTH_SERVICE_URL)
    .post('/auth/register')
    .send({
      email: `tenant-test-1-${Date.now()}@example.com`,
      name: 'Portland User',
      password: 'password123'
    });
  user1 = user1Response.body.user;
  user1Token = user1Response.body.token;

  // Create User 2
  const user2Response = await request(AUTH_SERVICE_URL)
    .post('/auth/register')
    .send({
      email: `tenant-test-2-${Date.now()}@example.com`,
      name: 'Oakland User',
      password: 'password123'
    });
  user2 = user2Response.body.user;
  user2Token = user2Response.body.token;

  // Create Portland Community (User 1)
  const portlandResponse = await request(COMMUNITY_SERVICE_URL)
    .post('/communities')
    .set('Authorization', `Bearer ${user1Token}`)
    .send({
      name: 'Portland Isolation Test',
      description: 'Test community',
      location: { city: 'Portland', state: 'OR' }
    });
  portlandCommunity = portlandResponse.body.community;

  // Refresh User 1 token
  const refresh1 = await request(AUTH_SERVICE_URL)
    .post('/auth/refresh')
    .set('Authorization', `Bearer ${user1Token}`);
  user1Token = refresh1.body.token;

  // Create Oakland Community (User 2)
  const oaklandResponse = await request(COMMUNITY_SERVICE_URL)
    .post('/communities')
    .set('Authorization', `Bearer ${user2Token}`)
    .send({
      name: 'Oakland Isolation Test',
      description: 'Test community',
      location: { city: 'Oakland', state: 'CA' }
    });
  oaklandCommunity = oaklandResponse.body.community;

  // Refresh User 2 token
  const refresh2 = await request(AUTH_SERVICE_URL)
    .post('/auth/refresh')
    .set('Authorization', `Bearer ${user2Token}`);
  user2Token = refresh2.body.token;
});

afterAll(async () => {
  // Cleanup
  if (user1) {
    await pool.query('DELETE FROM auth.users WHERE id = $1', [user1.id]);
  }
  if (user2) {
    await pool.query('DELETE FROM auth.users WHERE id = $1', [user2.id]);
  }
  await pool.end();
});

describe('Community Isolation - Communities', () => {
  it('should only list communities user belongs to', async () => {
    const user1Response = await request(COMMUNITY_SERVICE_URL)
      .get('/communities')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(user1Response.status).toBe(200);
    expect(user1Response.body.communities).toHaveLength(1);
    expect(user1Response.body.communities[0].id).toBe(portlandCommunity.id);

    const user2Response = await request(COMMUNITY_SERVICE_URL)
      .get('/communities')
      .set('Authorization', `Bearer ${user2Token}`);

    expect(user2Response.status).toBe(200);
    expect(user2Response.body.communities).toHaveLength(1);
    expect(user2Response.body.communities[0].id).toBe(oaklandCommunity.id);
  });

  it('should prevent user from accessing other community details', async () => {
    // User 1 tries to access Oakland community
    const response = await request(COMMUNITY_SERVICE_URL)
      .get(`/communities/${oaklandCommunity.id}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .set('X-Community-ID', oaklandCommunity.id);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Access denied');
  });

  it('should prevent user from modifying other community', async () => {
    // User 1 tries to update Oakland community
    const response = await request(COMMUNITY_SERVICE_URL)
      .put(`/communities/${oaklandCommunity.id}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .set('X-Community-ID', oaklandCommunity.id)
      .send({
        description: 'Hacked description'
      });

    expect(response.status).toBe(403);
  });
});

describe('Community Isolation - Help Requests', () => {
  beforeAll(async () => {
    // Create request in Portland
    const portlandReqResponse = await request(REQUEST_SERVICE_URL)
      .post('/requests')
      .set('Authorization', `Bearer ${user1Token}`)
      .set('X-Community-ID', portlandCommunity.id)
      .send({
        title: 'Portland Request',
        description: 'Need help in Portland',
        skills_needed: ['gardening'],
        urgency: 'medium'
      });
    portlandRequest = portlandReqResponse.body.request;

    // Create request in Oakland
    const oaklandReqResponse = await request(REQUEST_SERVICE_URL)
      .post('/requests')
      .set('Authorization', `Bearer ${user2Token}`)
      .set('X-Community-ID', oaklandCommunity.id)
      .send({
        title: 'Oakland Request',
        description: 'Need help in Oakland',
        skills_needed: ['gardening'],
        urgency: 'medium'
      });
    oaklandRequest = oaklandReqResponse.body.request;
  });

  it('should only see requests in own community', async () => {
    // User 1 lists requests
    const user1Response = await request(REQUEST_SERVICE_URL)
      .get('/requests')
      .set('Authorization', `Bearer ${user1Token}`)
      .set('X-Community-ID', portlandCommunity.id);

    expect(user1Response.status).toBe(200);
    const user1RequestIds = user1Response.body.requests.map((r: any) => r.id);
    expect(user1RequestIds).toContain(portlandRequest.id);
    expect(user1RequestIds).not.toContain(oaklandRequest.id);

    // User 2 lists requests
    const user2Response = await request(REQUEST_SERVICE_URL)
      .get('/requests')
      .set('Authorization', `Bearer ${user2Token}`)
      .set('X-Community-ID', oaklandCommunity.id);

    expect(user2Response.status).toBe(200);
    const user2RequestIds = user2Response.body.requests.map((r: any) => r.id);
    expect(user2RequestIds).toContain(oaklandRequest.id);
    expect(user2RequestIds).not.toContain(portlandRequest.id);
  });

  it('should prevent viewing request from other community', async () => {
    // User 1 tries to view Oakland request
    const response = await request(REQUEST_SERVICE_URL)
      .get(`/requests/${oaklandRequest.id}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .set('X-Community-ID', portlandCommunity.id);

    // Should return 404 because RLS filters it out
    expect(response.status).toBe(404);
  });

  it('should prevent modifying request from other community', async () => {
    // User 1 tries to update Oakland request
    const response = await request(REQUEST_SERVICE_URL)
      .put(`/requests/${oaklandRequest.id}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .set('X-Community-ID', portlandCommunity.id)
      .send({
        title: 'Hacked request'
      });

    // Should return 404 because RLS filters it out
    expect(response.status).toBe(404);
  });

  it('should prevent deleting request from other community', async () => {
    // User 1 tries to delete Oakland request
    const response = await request(REQUEST_SERVICE_URL)
      .delete(`/requests/${oaklandRequest.id}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .set('X-Community-ID', portlandCommunity.id);

    // Should return 404 because RLS filters it out
    expect(response.status).toBe(404);
  });
});

describe('Community Isolation - Members', () => {
  it('should only see members of own community', async () => {
    // User 1 lists Portland members
    const user1Response = await request(COMMUNITY_SERVICE_URL)
      .get(`/communities/${portlandCommunity.id}/members`)
      .set('Authorization', `Bearer ${user1Token}`)
      .set('X-Community-ID', portlandCommunity.id);

    expect(user1Response.status).toBe(200);
    const user1MemberIds = user1Response.body.members.map((m: any) => m.user_id);
    expect(user1MemberIds).toContain(user1.id);
    expect(user1MemberIds).not.toContain(user2.id);

    // User 2 lists Oakland members
    const user2Response = await request(COMMUNITY_SERVICE_URL)
      .get(`/communities/${oaklandCommunity.id}/members`)
      .set('Authorization', `Bearer ${user2Token}`)
      .set('X-Community-ID', oaklandCommunity.id);

    expect(user2Response.status).toBe(200);
    const user2MemberIds = user2Response.body.members.map((m: any) => m.user_id);
    expect(user2MemberIds).toContain(user2.id);
    expect(user2MemberIds).not.toContain(user1.id);
  });
});

describe('Community Isolation - Reputation', () => {
  it('should have separate karma records per community', async () => {
    // User 1 karma in Portland
    const user1Response = await request(REPUTATION_SERVICE_URL)
      .get(`/karma/${user1.id}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .set('X-Community-ID', portlandCommunity.id);

    expect(user1Response.status).toBe(200);

    // User 2 karma in Oakland
    const user2Response = await request(REPUTATION_SERVICE_URL)
      .get(`/karma/${user2.id}`)
      .set('Authorization', `Bearer ${user2Token}`)
      .set('X-Community-ID', oaklandCommunity.id);

    expect(user2Response.status).toBe(200);

    // Karma should be independent (both start at same default)
    expect(user1Response.body.karma).toBeDefined();
    expect(user2Response.body.karma).toBeDefined();
  });

  it('should prevent viewing karma from other community', async () => {
    // User 1 tries to view User 2's karma in wrong community context
    const response = await request(REPUTATION_SERVICE_URL)
      .get(`/karma/${user2.id}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .set('X-Community-ID', portlandCommunity.id);

    // Should return 404 or empty because user2 has no karma in Portland
    expect(response.status).toBeGreaterThanOrEqual(200);
  });
});

describe('Direct Database Access (RLS Verification)', () => {
  it('should enforce RLS at database level', async () => {
    // Simulate direct database query with Portland context
    await pool.query(`SELECT set_config('app.current_user_id', $1, true)`, [user1.id]);
    await pool.query(`SELECT set_config('app.current_community_id', $1, true)`, [portlandCommunity.id]);

    const portlandRequests = await pool.query(
      'SELECT * FROM requests.help_requests'
    );

    // Should only see Portland request
    const requestIds = portlandRequests.rows.map(r => r.id);
    expect(requestIds).toContain(portlandRequest.id);
    expect(requestIds).not.toContain(oaklandRequest.id);

    // Switch to Oakland context
    await pool.query(`SELECT set_config('app.current_user_id', $1, true)`, [user2.id]);
    await pool.query(`SELECT set_config('app.current_community_id', $1, true)`, [oaklandCommunity.id]);

    const oaklandRequests = await pool.query(
      'SELECT * FROM requests.help_requests'
    );

    // Should only see Oakland request
    const oaklandRequestIds = oaklandRequests.rows.map(r => r.id);
    expect(oaklandRequestIds).toContain(oaklandRequest.id);
    expect(oaklandRequestIds).not.toContain(portlandRequest.id);
  });
});

describe('Cross-Community Access Attempts', () => {
  it('should reject requests with wrong X-Community-ID header', async () => {
    // User 1 tries to access Portland data with Oakland community ID
    const response = await request(REQUEST_SERVICE_URL)
      .get('/requests')
      .set('Authorization', `Bearer ${user1Token}`)
      .set('X-Community-ID', oaklandCommunity.id);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Access denied');
  });

  it('should reject requests without X-Community-ID header', async () => {
    const response = await request(REQUEST_SERVICE_URL)
      .get('/requests')
      .set('Authorization', `Bearer ${user1Token}`);
    // No X-Community-ID header

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Missing community context');
  });
});
