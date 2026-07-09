import express from 'express';
import request from 'supertest';
import { query } from '../../src/database/db';
import feedRouter from '../../src/routes/feed';

jest.mock('../../src/database/db', () => ({ query: jest.fn() }));

jest.mock('../../src/services/feed/basicFeedRanker', () => ({
  __mockGenerateFeed: jest.fn(),
  BasicFeedRanker: jest.fn().mockImplementation(() => ({
    generateFeed: jest.requireMock('../../src/services/feed/basicFeedRanker').__mockGenerateFeed,
  })),
}));

jest.mock('../../src/services/feed/socialKarmaFeedComposer', () => ({
  __mockGetCommunityHealthSummary: jest.fn(),
  SocialKarmaFeedComposer: jest.fn().mockImplementation(() => ({
    getCommunityHealthSummary: jest.requireMock('../../src/services/feed/socialKarmaFeedComposer').__mockGetCommunityHealthSummary,
  })),
}));

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockGenerateFeed = jest.requireMock('../../src/services/feed/basicFeedRanker')
  .__mockGenerateFeed as jest.Mock;
const mockGetCommunityHealthSummary = jest.requireMock('../../src/services/feed/socialKarmaFeedComposer')
  .__mockGetCommunityHealthSummary as jest.Mock;

function buildApp(userId = 'viewer-1') {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = {
      userId,
      email: 'viewer@example.com',
      communities: [{ id: 'community-1', name: 'Community 1', role: 'member' }],
    };
    next();
  });
  app.use('/requests/feed', feedRouter);
  return app;
}

describe('Sprint 91: request-service feed router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /requests/feed returns ranked items with the legacy feed contract', async () => {
    const item = {
      id: 'open_request_req-1',
      type: 'open_request',
      priority: 0.9,
      created_at: '2026-06-07T12:00:00.000Z',
      data: { request_id: 'req-1', title: 'Need a ladder' },
    };
    mockGenerateFeed.mockResolvedValueOnce([item]);

    const res = await request(buildApp()).get('/requests/feed?limit=5');

    expect(res.status).toBe(200);
    expect(mockGenerateFeed).toHaveBeenCalledWith('viewer-1', 5, undefined);
    expect(res.body).toEqual({
      success: true,
      data: { items: [item], count: 1 },
    });
  });

  it('GET /requests/feed/preferences returns default preferences when no row exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const res = await request(buildApp()).get('/requests/feed/preferences');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      show_community_activity: true,
      show_open_requests: true,
      suggest_adjacent_requests: true,
      exploration_level: 'balanced',
    });
  });

  it('PUT /requests/feed/preferences round-trips the updated row', async () => {
    const row = {
      user_id: 'viewer-1',
      show_community_activity: false,
      show_open_requests: true,
      show_completed_exchanges: false,
      suggest_adjacent_requests: false,
      exploration_level: 'conservative',
      show_explanations: true,
      show_broader_stories: false,
      allow_public_featuring: true,
    };
    mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);

    const res = await request(buildApp())
      .put('/requests/feed/preferences')
      .send({
        show_community_activity: false,
        suggest_adjacent_requests: false,
        exploration_level: 'conservative',
        show_broader_stories: false,
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: row });
  });

  it('POST /requests/feed/dismiss/:itemId stores the parsed item type and id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const res = await request(buildApp()).post('/requests/feed/dismiss/open_request_req-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Item dismissed' });
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO feed.dismissed_items'), [
      'viewer-1',
      'open_request',
      'req-1',
    ]);
  });

  it('GET /requests/feed/community-health returns the health summary', async () => {
    const health = {
      communityId: 'community-1',
      communityName: 'Community 1',
      networkStrength: 62,
      networkStrengthLabel: 'Strong',
    };
    mockGetCommunityHealthSummary.mockResolvedValueOnce(health);

    const res = await request(buildApp()).get('/requests/feed/community-health?community_id=community-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: health });
  });

  it('dropped legacy feed endpoints are not mounted', async () => {
    const app = buildApp();

    await expect(request(app).get('/requests/feed/requests')).resolves.toHaveProperty('status', 404);
    await expect(request(app).get('/requests/feed/milestones')).resolves.toHaveProperty('status', 404);
    await expect(request(app).get('/requests/feed/featured-stories')).resolves.toHaveProperty('status', 404);
    await expect(request(app).get('/requests/feed/mixed')).resolves.toHaveProperty('status', 404);
  });
});
