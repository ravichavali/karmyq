import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const REQUEST_SERVICE_URL = process.env.REQUEST_SERVICE_URL || 'http://localhost:3003';
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://karmyq_test:test_password@localhost:5433/karmyq_test';

const pool = new Pool({ connectionString: DATABASE_URL });

let viewerId: string;
let requesterId: string;
let authToken: string;
let testCommunityId: string;
let testRequestId: string;

function signViewerToken() {
  authToken = jwt.sign(
    {
      userId: viewerId,
      email: `feed-viewer-${Date.now()}@example.com`,
      communities: [{ id: testCommunityId, name: 'Sprint 91 Feed Community', role: 'admin' }],
      currentCommunityId: testCommunityId,
    },
    process.env.JWT_SECRET || 'test_jwt_secret_change_me'
  );
}

beforeAll(async () => {
  const suffix = Date.now();

  const viewerResult = await pool.query(
    `INSERT INTO auth.users (name, email, password_hash)
     VALUES ($1, $2, '$2b$10$abcdefghijklmnopqrstuv')
     RETURNING id`,
    ['Sprint 91 Feed Viewer', `feed-viewer-${suffix}@example.com`]
  );
  viewerId = viewerResult.rows[0].id;

  const requesterResult = await pool.query(
    `INSERT INTO auth.users (name, email, password_hash)
     VALUES ($1, $2, '$2b$10$abcdefghijklmnopqrstuv')
     RETURNING id`,
    ['Sprint 91 Feed Requester', `feed-requester-${suffix}@example.com`]
  );
  requesterId = requesterResult.rows[0].id;

  const communityResult = await pool.query(
    `INSERT INTO communities.communities (name, description, creator_id)
     VALUES ($1, 'Sprint 91 request-service feed integration test', $2)
     RETURNING id`,
    [`Sprint 91 Feed Community ${suffix}`, viewerId]
  );
  testCommunityId = communityResult.rows[0].id;

  await pool.query(
    `INSERT INTO communities.members (community_id, user_id, role)
     VALUES ($1, $2, 'admin'), ($1, $3, 'member')
     ON CONFLICT (community_id, user_id) DO NOTHING`,
    [testCommunityId, viewerId, requesterId]
  );

  const requestResult = await pool.query(
    `INSERT INTO requests.help_requests
       (requester_id, request_type, category, title, description, status, urgency, payload)
     VALUES ($1, 'generic', 'errands', 'Sprint 91 feed request', 'Please help test feed consolidation', 'open', 'high', '{}')
     RETURNING id`,
    [requesterId]
  );
  testRequestId = requestResult.rows[0].id;

  await pool.query(
    `INSERT INTO requests.request_communities (request_id, community_id)
     VALUES ($1, $2)
     ON CONFLICT (request_id, community_id) DO NOTHING`,
    [testRequestId, testCommunityId]
  );

  await pool.query(
    `INSERT INTO reputation.community_health_metrics (
       community_id,
       total_matches_completed,
       total_active_helpers,
       network_density,
       avg_helpfulness,
       avg_responsiveness,
       avg_clarity,
       growth_rate_matches
     ) VALUES ($1, 25, 10, 0.5, 4, 4, 4, 10)
     ON CONFLICT (community_id, snapshot_date)
     DO UPDATE SET
       total_matches_completed = EXCLUDED.total_matches_completed,
       total_active_helpers = EXCLUDED.total_active_helpers,
       network_density = EXCLUDED.network_density,
       avg_helpfulness = EXCLUDED.avg_helpfulness,
       avg_responsiveness = EXCLUDED.avg_responsiveness,
       avg_clarity = EXCLUDED.avg_clarity,
       growth_rate_matches = EXCLUDED.growth_rate_matches`,
    [testCommunityId]
  );

  signViewerToken();
});

afterAll(async () => {
  try {
    if (viewerId) {
      await pool.query('DELETE FROM feed.dismissed_items WHERE user_id = $1', [viewerId]);
      await pool.query('DELETE FROM feed.preferences WHERE user_id = $1', [viewerId]);
    }
    if (testRequestId) {
      await pool.query('DELETE FROM requests.help_requests WHERE id = $1', [testRequestId]);
    }
    if (testCommunityId) {
      await pool.query('DELETE FROM reputation.community_health_metrics WHERE community_id = $1', [testCommunityId]);
      await pool.query('DELETE FROM communities.members WHERE community_id = $1', [testCommunityId]);
      await pool.query('DELETE FROM communities.communities WHERE id = $1', [testCommunityId]);
    }
    if (viewerId || requesterId) {
      await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [[viewerId, requesterId].filter(Boolean)]);
    }
  } finally {
    await pool.end();
  }
});

describe('Sprint 91 request-service feed integration', () => {
  it('serves the moved GET /requests/feed endpoint', async () => {
    const response = await request(REQUEST_SERVICE_URL)
      .get('/requests/feed?limit=10')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `open_request_${testRequestId}`,
          type: 'open_request',
        }),
      ])
    );
    expect(response.body.data.count).toBe(response.body.data.items.length);
  });

  it('round-trips preferences through request-service', async () => {
    const defaultResponse = await request(REQUEST_SERVICE_URL)
      .get('/requests/feed/preferences')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(defaultResponse.body.data).toMatchObject({
      show_open_requests: true,
      suggest_adjacent_requests: true,
      exploration_level: 'balanced',
    });

    const updatedResponse = await request(REQUEST_SERVICE_URL)
      .put('/requests/feed/preferences')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        show_community_activity: false,
        show_open_requests: true,
        suggest_adjacent_requests: false,
        exploration_level: 'conservative',
        show_broader_stories: false,
      })
      .expect(200);

    expect(updatedResponse.body.data).toMatchObject({
      user_id: viewerId,
      show_community_activity: false,
      suggest_adjacent_requests: false,
      exploration_level: 'conservative',
      show_broader_stories: false,
    });
  });

  it('dismisses a feed item and hides it from the feed', async () => {
    await request(REQUEST_SERVICE_URL)
      .post(`/requests/feed/dismiss/open_request_${testRequestId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const response = await request(REQUEST_SERVICE_URL)
      .get('/requests/feed?limit=10')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `open_request_${testRequestId}` }),
      ])
    );
  });

  it('serves community health through request-service', async () => {
    const response = await request(REQUEST_SERVICE_URL)
      .get(`/requests/feed/community-health?community_id=${testCommunityId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data).toMatchObject({
      communityId: testCommunityId,
      networkStrength: 62,
      networkStrengthLabel: 'Strong',
      trendDirection: 'growing',
    });
  });

  it('does not carry the four dead legacy feed endpoints forward', async () => {
    const paths = ['/requests', '/milestones', '/featured-stories', '/mixed'];

    for (const path of paths) {
      await request(REQUEST_SERVICE_URL)
        .get(`/requests/feed${path}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    }
  });
});
