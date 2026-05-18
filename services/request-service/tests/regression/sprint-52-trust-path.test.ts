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
import { getMutualAidBestCandidate } from '../../src/services/dibsScoringService';

const mockQuery = query as jest.Mock;
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
    rows: [{ id: REQUEST_ID, requester_id: REQUESTER_ID, scheduled_for: null }],
  });
  // Second query: community IDs for the request
  mockQuery.mockResolvedValueOnce({
    rows: [{ community_id: 'community-1' }],
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
});
