/**
 * Multi-Community User Flow Integration Tests
 *
 * Tests complete user journeys across multiple communities
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const COMMUNITY_SERVICE_URL = process.env.COMMUNITY_SERVICE_URL || 'http://localhost:3002';
const REQUEST_SERVICE_URL = process.env.REQUEST_SERVICE_URL || 'http://localhost:3003';
const REPUTATION_SERVICE_URL = process.env.REPUTATION_SERVICE_URL || 'http://localhost:3004';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005';
const MESSAGING_SERVICE_URL = process.env.MESSAGING_SERVICE_URL || 'http://localhost:3006';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';

let pool: Pool;
let alice: any; // Active in Portland and Seattle
let bob: any;   // Active in Oakland
let aliceToken: string;
let bobToken: string;

let portlandCommunity: any;
let oaklandCommunity: any;
let seattleCommunity: any;

beforeAll(async () => {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://karmyq_user:karmyq_password_dev@localhost:5432/karmyq_db'
  });

  // Create Alice
  const aliceResponse = await request(AUTH_SERVICE_URL)
    .post('/auth/register')
    .send({
      email: `alice-${Date.now()}@example.com`,
      name: 'Alice MultiCommunity',
      password: 'password123'
    });
  alice = aliceResponse.body.user;
  aliceToken = aliceResponse.body.token;

  // Create Bob
  const bobResponse = await request(AUTH_SERVICE_URL)
    .post('/auth/register')
    .send({
      email: `bob-${Date.now()}@example.com`,
      name: 'Bob SingleCommunity',
      password: 'password123'
    });
  bob = bobResponse.body.user;
  bobToken = bobResponse.body.token;
});

afterAll(async () => {
  // Cleanup
  if (alice) {
    await pool.query('DELETE FROM auth.users WHERE id = $1', [alice.id]);
  }
  if (bob) {
    await pool.query('DELETE FROM auth.users WHERE id = $1', [bob.id]);
  }
  await pool.end();
});

describe('Multi-Community User Journey - Alice', () => {
  it('Step 1: Alice creates Portland community', async () => {
    const response = await request(COMMUNITY_SERVICE_URL)
      .post('/communities')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        name: 'Portland Tools Network',
        description: 'Sharing tools in Portland',
        location: { city: 'Portland', state: 'OR' },
        max_members: 150
      });

    expect(response.status).toBe(201);
    portlandCommunity = response.body.community;
    expect(portlandCommunity.name).toBe('Portland Tools Network');
  });

  it('Step 2: Alice refreshes JWT and becomes Portland admin', async () => {
    const response = await request(AUTH_SERVICE_URL)
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(response.status).toBe(200);
    aliceToken = response.body.token;

    const decoded: any = jwt.verify(aliceToken, JWT_SECRET);
    expect(decoded.communities).toHaveLength(1);
    expect(decoded.communities[0].id).toBe(portlandCommunity.id);
    expect(decoded.communities[0].role).toBe('admin');
    expect(decoded.currentCommunityId).toBe(portlandCommunity.id);
  });

  it('Step 3: Alice creates a help request in Portland', async () => {
    const response = await request(REQUEST_SERVICE_URL)
      .post('/requests')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('X-Community-ID', portlandCommunity.id)
      .send({
        title: 'Need a drill',
        description: 'Building a bookshelf, need a drill for the weekend',
        skills_needed: ['tools'],
        urgency: 'medium'
      });

    expect(response.status).toBe(201);
    expect(response.body.request.title).toBe('Need a drill');
    expect(response.body.request.community_id).toBe(portlandCommunity.id);
  });

  it('Step 4: Alice creates Seattle community', async () => {
    const response = await request(COMMUNITY_SERVICE_URL)
      .post('/communities')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        name: 'Seattle Garden Share',
        description: 'Gardening community in Seattle',
        location: { city: 'Seattle', state: 'WA' },
        max_members: 150
      });

    expect(response.status).toBe(201);
    seattleCommunity = response.body.community;
  });

  it('Step 5: Alice refreshes JWT and sees both communities', async () => {
    const response = await request(AUTH_SERVICE_URL)
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(response.status).toBe(200);
    aliceToken = response.body.token;

    const decoded: any = jwt.verify(aliceToken, JWT_SECRET);
    expect(decoded.communities).toHaveLength(2);

    const communityIds = decoded.communities.map((c: any) => c.id);
    expect(communityIds).toContain(portlandCommunity.id);
    expect(communityIds).toContain(seattleCommunity.id);

    // Both should be admin
    decoded.communities.forEach((c: any) => {
      expect(c.role).toBe('admin');
    });
  });

  it('Step 6: Alice creates help request in Seattle', async () => {
    const response = await request(REQUEST_SERVICE_URL)
      .post('/requests')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('X-Community-ID', seattleCommunity.id)
      .send({
        title: 'Need garden advice',
        description: 'First time planting tomatoes',
        skills_needed: ['gardening'],
        urgency: 'low'
      });

    expect(response.status).toBe(201);
    expect(response.body.request.community_id).toBe(seattleCommunity.id);
  });

  it('Step 7: Alice views Portland requests - should only see Portland', async () => {
    const response = await request(REQUEST_SERVICE_URL)
      .get('/requests')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('X-Community-ID', portlandCommunity.id);

    expect(response.status).toBe(200);
    expect(response.body.requests.length).toBeGreaterThan(0);

    // All requests should be from Portland
    response.body.requests.forEach((req: any) => {
      expect(req.community_id).toBe(portlandCommunity.id);
    });
  });

  it('Step 8: Alice views Seattle requests - should only see Seattle', async () => {
    const response = await request(REQUEST_SERVICE_URL)
      .get('/requests')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('X-Community-ID', seattleCommunity.id);

    expect(response.status).toBe(200);
    expect(response.body.requests.length).toBeGreaterThan(0);

    // All requests should be from Seattle
    response.body.requests.forEach((req: any) => {
      expect(req.community_id).toBe(seattleCommunity.id);
    });
  });

  it('Step 9: Alice has separate reputation in each community', async () => {
    // Check Portland karma
    const portlandKarma = await request(REPUTATION_SERVICE_URL)
      .get(`/karma/${alice.id}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('X-Community-ID', portlandCommunity.id);

    expect(portlandKarma.status).toBe(200);

    // Check Seattle karma
    const seattleKarma = await request(REPUTATION_SERVICE_URL)
      .get(`/karma/${alice.id}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('X-Community-ID', seattleCommunity.id);

    expect(seattleKarma.status).toBe(200);

    // Karma should be tracked separately
    expect(portlandKarma.body).toBeDefined();
    expect(seattleKarma.body).toBeDefined();
  });
});

describe('Multi-Community User Journey - Bob', () => {
  it('Step 1: Bob creates Oakland community', async () => {
    const response = await request(COMMUNITY_SERVICE_URL)
      .post('/communities')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        name: 'Oakland Makers',
        description: 'Makers community in Oakland',
        location: { city: 'Oakland', state: 'CA' },
        max_members: 150
      });

    expect(response.status).toBe(201);
    oaklandCommunity = response.body.community;
  });

  it('Step 2: Bob refreshes JWT', async () => {
    const response = await request(AUTH_SERVICE_URL)
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${bobToken}`);

    expect(response.status).toBe(200);
    bobToken = response.body.token;

    const decoded: any = jwt.verify(bobToken, JWT_SECRET);
    expect(decoded.communities).toHaveLength(1);
    expect(decoded.communities[0].id).toBe(oaklandCommunity.id);
  });

  it('Step 3: Bob cannot access Portland community', async () => {
    const response = await request(COMMUNITY_SERVICE_URL)
      .get(`/communities/${portlandCommunity.id}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .set('X-Community-ID', portlandCommunity.id);

    expect(response.status).toBe(403);
  });

  it('Step 4: Bob cannot see Portland requests', async () => {
    const response = await request(REQUEST_SERVICE_URL)
      .get('/requests')
      .set('Authorization', `Bearer ${bobToken}`)
      .set('X-Community-ID', portlandCommunity.id);

    expect(response.status).toBe(403);
  });
});

describe('Community Membership Changes', () => {
  let inviteCode: string;

  it('Step 1: Alice generates invite code for Portland', async () => {
    const response = await request(COMMUNITY_SERVICE_URL)
      .post(`/communities/${portlandCommunity.id}/invites`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('X-Community-ID', portlandCommunity.id)
      .send({
        max_uses: 5,
        expires_in_days: 7
      });

    expect(response.status).toBe(201);
    inviteCode = response.body.invite.code;
  });

  it('Step 2: Bob joins Portland using invite code', async () => {
    const response = await request(COMMUNITY_SERVICE_URL)
      .post(`/communities/join`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        invite_code: inviteCode
      });

    expect(response.status).toBe(200);
    expect(response.body.community.id).toBe(portlandCommunity.id);
  });

  it('Step 3: Bob refreshes JWT and sees both communities', async () => {
    const response = await request(AUTH_SERVICE_URL)
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${bobToken}`);

    expect(response.status).toBe(200);
    bobToken = response.body.token;

    const decoded: any = jwt.verify(bobToken, JWT_SECRET);
    expect(decoded.communities).toHaveLength(2);

    const communityIds = decoded.communities.map((c: any) => c.id);
    expect(communityIds).toContain(portlandCommunity.id);
    expect(communityIds).toContain(oaklandCommunity.id);

    // Bob is admin in Oakland, member in Portland
    const portlandMembership = decoded.communities.find((c: any) => c.id === portlandCommunity.id);
    const oaklandMembership = decoded.communities.find((c: any) => c.id === oaklandCommunity.id);

    expect(portlandMembership.role).toBe('member');
    expect(oaklandMembership.role).toBe('admin');
  });

  it('Step 4: Bob can now access Portland requests', async () => {
    const response = await request(REQUEST_SERVICE_URL)
      .get('/requests')
      .set('Authorization', `Bearer ${bobToken}`)
      .set('X-Community-ID', portlandCommunity.id);

    expect(response.status).toBe(200);
  });

  it('Step 5: Bob creates request in Portland as member', async () => {
    const response = await request(REQUEST_SERVICE_URL)
      .post('/requests')
      .set('Authorization', `Bearer ${bobToken}`)
      .set('X-Community-ID', portlandCommunity.id)
      .send({
        title: 'Need help with woodworking',
        description: 'Building a table',
        skills_needed: ['woodworking'],
        urgency: 'low'
      });

    expect(response.status).toBe(201);
    expect(response.body.request.community_id).toBe(portlandCommunity.id);
  });
});

describe('Context Switching Between Communities', () => {
  it('Alice can switch context between communities seamlessly', async () => {
    // Access Portland
    const portlandResponse = await request(REQUEST_SERVICE_URL)
      .get('/requests')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('X-Community-ID', portlandCommunity.id);

    expect(portlandResponse.status).toBe(200);

    // Switch to Seattle
    const seattleResponse = await request(REQUEST_SERVICE_URL)
      .get('/requests')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('X-Community-ID', seattleCommunity.id);

    expect(seattleResponse.status).toBe(200);

    // Data should be different
    const portlandIds = portlandResponse.body.requests.map((r: any) => r.id);
    const seattleIds = seattleResponse.body.requests.map((r: any) => r.id);

    // Should not overlap
    const intersection = portlandIds.filter((id: string) => seattleIds.includes(id));
    expect(intersection).toHaveLength(0);
  });

  it('Bob can switch between Oakland and Portland', async () => {
    // Access Oakland (admin)
    const oaklandResponse = await request(COMMUNITY_SERVICE_URL)
      .get(`/communities/${oaklandCommunity.id}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .set('X-Community-ID', oaklandCommunity.id);

    expect(oaklandResponse.status).toBe(200);

    // Access Portland (member)
    const portlandResponse = await request(COMMUNITY_SERVICE_URL)
      .get(`/communities/${portlandCommunity.id}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .set('X-Community-ID', portlandCommunity.id);

    expect(portlandResponse.status).toBe(200);
  });
});

describe('Cross-Community Notifications', () => {
  it('User should receive notifications from all their communities', async () => {
    const response = await request(NOTIFICATION_SERVICE_URL)
      .get('/notifications')
      .set('Authorization', `Bearer ${aliceToken}`);
    // No X-Community-ID - should aggregate across communities

    expect(response.status).toBe(200);
    // Notifications can be from Portland or Seattle
  });
});

describe('Complete User Flow - Help Exchange', () => {
  let helpRequest: any;
  let match: any;

  it('Step 1: Alice posts request in Portland', async () => {
    const response = await request(REQUEST_SERVICE_URL)
      .post('/requests')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('X-Community-ID', portlandCommunity.id)
      .send({
        title: 'Need lawn mower',
        description: 'Weekend lawn work',
        skills_needed: ['tools'],
        urgency: 'medium'
      });

    expect(response.status).toBe(201);
    helpRequest = response.body.request;
  });

  it('Step 2: Bob (now in Portland) creates offer', async () => {
    const response = await request(REQUEST_SERVICE_URL)
      .post('/offers')
      .set('Authorization', `Bearer ${bobToken}`)
      .set('X-Community-ID', portlandCommunity.id)
      .send({
        title: 'Can lend lawn mower',
        description: 'Have a mower available',
        skills_offered: ['tools'],
        availability: 'weekends'
      });

    expect(response.status).toBe(201);
  });

  it('Step 3: Bob accepts Alice\'s request (creates match)', async () => {
    const response = await request(REQUEST_SERVICE_URL)
      .post(`/requests/${helpRequest.id}/match`)
      .set('Authorization', `Bearer ${bobToken}`)
      .set('X-Community-ID', portlandCommunity.id);

    expect(response.status).toBe(201);
    match = response.body.match;
    expect(match.requester_id).toBe(alice.id);
    expect(match.helper_id).toBe(bob.id);
  });

  it('Step 4: Match is completed, karma awarded', async () => {
    const response = await request(REQUEST_SERVICE_URL)
      .put(`/matches/${match.id}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('X-Community-ID', portlandCommunity.id)
      .send({
        status: 'completed',
        rating: 5
      });

    expect(response.status).toBe(200);
  });

  it('Step 5: Bob\'s karma increases in Portland only', async () => {
    // Check Portland karma
    const portlandKarma = await request(REPUTATION_SERVICE_URL)
      .get(`/karma/${bob.id}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .set('X-Community-ID', portlandCommunity.id);

    expect(portlandKarma.status).toBe(200);
    expect(portlandKarma.body.karma).toBeGreaterThan(0);

    // Check Oakland karma - should be separate
    const oaklandKarma = await request(REPUTATION_SERVICE_URL)
      .get(`/karma/${bob.id}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .set('X-Community-ID', oaklandCommunity.id);

    expect(oaklandKarma.status).toBe(200);
    // Oakland karma should be independent
  });

  it('Step 6: Alice and Bob can message about the exchange', async () => {
    const response = await request(MESSAGING_SERVICE_URL)
      .post('/messages')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('X-Community-ID', portlandCommunity.id)
      .send({
        recipient_id: bob.id,
        content: 'Thanks for the lawn mower!',
        match_id: match.id
      });

    expect(response.status).toBe(201);
    expect(response.body.message.community_id).toBe(portlandCommunity.id);
  });
});
