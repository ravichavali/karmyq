/**
 * TDD Tests: Sprint 52 — Trust Path in Dibs Candidate (ADR-052 candidate)
 *
 * Verifies that GET /requests/:id/dibs-candidate attaches a trustPath from
 * the social-graph-service, and degrades gracefully when social-graph is
 * unreachable.
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

// Mock DB so no real database is required
jest.mock('../../src/database/db', () => ({
  query: jest.fn(),
  default: { connect: jest.fn() },
}));

// Mock scoring service so candidate selection is deterministic
jest.mock('../../src/services/dibsScoringService', () => ({
  getBestCandidate: jest.fn(),
  getMutualAidBestCandidate: jest.fn(),
}));

import { query } from '../../src/database/db';
import { getBestCandidate, getMutualAidBestCandidate } from '../../src/services/dibsScoringService';

const mockQuery = query as jest.Mock;
const mockGetBestCandidate = getBestCandidate as jest.Mock;
const mockGetMutualAidBestCandidate = getMutualAidBestCandidate as jest.Mock;

const REQUEST_ID = 'req-abc-123';
const REQUESTER_ID = 'user-requester';
const CANDIDATE_USER_ID = 'user-candidate';
const JWT_SECRET = 'test-secret';

function makeToken(userId = REQUESTER_ID) {
  return jwt.sign({ userId, email: 'test@example.com', communities: [] }, JWT_SECRET);
}

function buildApp() {
  const app = express();
  app.use(express.json());
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dibsRouter = require('../../src/routes/dibs').default;
  app.use('/requests', dibsRouter);
  return app;
}

const mockCandidate = {
  providerId: 'p1',
  providerUserId: CANDIDATE_USER_ID,
  displayName: 'Alice',
  trustScore: 75,
  priorInteractions: 2,
  trustGraphConnection: 'direct' as const,
  isAvailable: true,
  score: 85,
};

function seedRequestQuery() {
  // First query: find the request
  mockQuery.mockResolvedValueOnce({
    rowCount: 1,
    rows: [{ id: REQUEST_ID, requester_id: REQUESTER_ID, scheduled_for: null, request_type: 'generic', category: 'moving' }],
  });
  // Second query: community IDs for the request
  mockQuery.mockResolvedValueOnce({
    rows: [{ community_id: 'community-1' }],
  });
  // Third query: relationship context (ADR-072)
  mockQuery.mockResolvedValueOnce({
    rows: [{ prior_completed_matches: 0, last_interaction_at: null, similar_category: false }],
  });
}

describe('Sprint 52 — Trust Path in Dibs Candidate', () => {
  let app: express.Express;

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    app = buildApp();
  });

  beforeEach(() => {
    mockQuery.mockReset();
    mockGetMutualAidBestCandidate.mockReset();
    jest.restoreAllMocks();
  });

  it('returns 2-degree trust path when requester and candidate share a mutual exchange', async () => {
    seedRequestQuery();
    mockGetMutualAidBestCandidate.mockResolvedValueOnce(mockCandidate);

    const trustPathData = {
      degrees_of_separation: 2,
      path: [
        { id: REQUESTER_ID, name: 'You' },
        { id: 'user-jordan', name: 'Jordan' },
        { id: CANDIDATE_USER_ID, name: 'Alice' },
      ],
      connection_type: 'exchange',
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: trustPathData }),
    } as unknown as Response);

    const res = await request(app)
      .get(`/requests/${REQUEST_ID}/dibs-candidate`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.trustPath).toBeDefined();
    expect(res.body.data.trustPath.degrees_of_separation).toBe(2);
    expect(res.body.data.trustPath.path[1].name).toBe('Jordan');
  });

  it('returns 1-degree trust path for explore-tier direct connection', async () => {
    seedRequestQuery();
    mockGetMutualAidBestCandidate.mockResolvedValueOnce(mockCandidate);

    const trustPathData = {
      degrees_of_separation: 1,
      path: [
        { id: REQUESTER_ID, name: 'You' },
        { id: CANDIDATE_USER_ID, name: 'Alice' },
      ],
      connection_type: 'exchange',
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: trustPathData }),
    } as unknown as Response);

    const res = await request(app)
      .get(`/requests/${REQUEST_ID}/dibs-candidate`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.trustPath.degrees_of_separation).toBe(1);
    expect(res.body.data.trustPath.path).toHaveLength(2);
  });

  it('returns trustPath: null gracefully when social-graph is unreachable', async () => {
    seedRequestQuery();
    mockGetMutualAidBestCandidate.mockResolvedValueOnce(mockCandidate);

    global.fetch = jest.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await request(app)
      .get(`/requests/${REQUEST_ID}/dibs-candidate`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.displayName).toBe('Alice');
    expect(res.body.data.trustPath).toBeNull();
  });

  // BUG-007: GET derives provider-vs-neighbor from the PERSISTED request_type, never the
  // ?type= query string, so it can't disagree with the POST /dibs submit validation.
  describe('candidate facet derives from persisted request_type', () => {
    function seedRequest(request_type: string, rel = { prior_completed_matches: 0, last_interaction_at: null, similar_category: false }) {
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: REQUEST_ID, requester_id: REQUESTER_ID, scheduled_for: null, request_type, category: 'moving' }],
      });
      mockQuery.mockResolvedValueOnce({ rows: [{ community_id: 'community-1' }] });
      mockQuery.mockResolvedValueOnce({ rows: [rel] }); // relationship context
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true, json: async () => ({ success: true, data: null }),
      } as unknown as Response);
    }

    it('uses the provider pool for a persisted service request', async () => {
      seedRequest('service');
      mockGetBestCandidate.mockResolvedValueOnce(mockCandidate);

      const res = await request(app)
        .get(`/requests/${REQUEST_ID}/dibs-candidate`)
        .set('Authorization', `Bearer ${makeToken()}`);

      expect(res.status).toBe(200);
      expect(mockGetBestCandidate).toHaveBeenCalled();
      expect(mockGetMutualAidBestCandidate).not.toHaveBeenCalled();
    });

    it('uses the neighbour pool for a non-service request even when ?type=service is passed', async () => {
      seedRequest('generic');
      mockGetMutualAidBestCandidate.mockResolvedValueOnce(mockCandidate);

      const res = await request(app)
        .get(`/requests/${REQUEST_ID}/dibs-candidate?type=service`)
        .set('Authorization', `Bearer ${makeToken()}`);

      expect(res.status).toBe(200);
      expect(mockGetMutualAidBestCandidate).toHaveBeenCalled();
      expect(mockGetBestCandidate).not.toHaveBeenCalled();
    });
  });

  // ADR-072: server returns a relationship-routing judgment (reason + context).
  describe('server-computed reason + relationshipContext', () => {
    function seedRequest(request_type: string, rel: any) {
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: REQUEST_ID, requester_id: REQUESTER_ID, scheduled_for: null, request_type, category: 'moving' }],
      });
      mockQuery.mockResolvedValueOnce({ rows: [{ community_id: 'community-1' }] });
      mockQuery.mockResolvedValueOnce({ rows: [rel] });
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true, json: async () => ({ success: true, data: null }),
      } as unknown as Response);
    }

    it('neighbour with a prior similar completed match → prior_similar_success', async () => {
      seedRequest('generic', { prior_completed_matches: 2, last_interaction_at: '2026-05-01T00:00:00Z', similar_category: true });
      mockGetMutualAidBestCandidate.mockResolvedValueOnce({ ...mockCandidate, kind: 'neighbor' });

      const res = await request(app)
        .get(`/requests/${REQUEST_ID}/dibs-candidate`)
        .set('Authorization', `Bearer ${makeToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.reason).toBe('prior_similar_success');
      expect(res.body.data.relationshipContext.priorCompletedMatches).toBe(2);
      expect(res.body.data.relationshipContext.similarCategory).toBe(true);
      expect(res.body.data.relationshipContext.lastInteractionAt).toBe('2026-05-01T00:00:00.000Z');
    });

    it('neighbour worked-with-before but different category → trusted_neighbor', async () => {
      seedRequest('generic', { prior_completed_matches: 1, last_interaction_at: '2026-04-01T00:00:00Z', similar_category: false });
      mockGetMutualAidBestCandidate.mockResolvedValueOnce({ ...mockCandidate, kind: 'neighbor' });

      const res = await request(app)
        .get(`/requests/${REQUEST_ID}/dibs-candidate`)
        .set('Authorization', `Bearer ${makeToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.reason).toBe('trusted_neighbor');
    });

    it('service request → provider_match', async () => {
      seedRequest('service', { prior_completed_matches: 3, last_interaction_at: '2026-03-01T00:00:00Z', similar_category: true });
      mockGetBestCandidate.mockResolvedValueOnce({ ...mockCandidate, kind: 'provider' });

      const res = await request(app)
        .get(`/requests/${REQUEST_ID}/dibs-candidate`)
        .set('Authorization', `Bearer ${makeToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.reason).toBe('provider_match');
    });
  });
});
