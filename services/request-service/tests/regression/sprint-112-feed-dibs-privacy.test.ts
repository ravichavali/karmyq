/**
 * Sprint 112 PR A — Feed + dibs disclosure contract tests (ADR-082).
 *
 * Cross-agent review found two request-service leaks the original inventory missed: the curated feed
 * returned the requester's exact karma/trust, and the dibs candidate spread an ordinary neighbor's
 * trustScore. This suite locks the dibs-candidate projection with a NON-ZERO sentinel; the curated
 * feed's requester karma/trust removal is additionally covered by the disclosure-gate fixture scan.
 */
// The dibs route applies the real authMiddleware per-route; mock it to a pass-through that sets the
// caller identity (the GET handler reads req.user.userId).
jest.mock('@karmyq/shared/middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { userId: '11111111-1111-1111-1111-111111111111', email: 'c@test.com', communities: [] };
    next();
  },
}));

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: { query: (...a: any[]) => mockQuery(...a), connect: jest.fn() },
  query: (...a: any[]) => mockQuery(...a),
  withTransaction: (fn: any) => fn((...a: any[]) => mockQuery(...a)),
}));
jest.mock('../../src/events/publisher', () => ({ publishEvent: jest.fn() }));

const mockGetMutualAidBestCandidate = jest.fn();
const mockGetBestCandidate = jest.fn();
jest.mock('../../src/services/dibsScoringService', () => ({
  getBestCandidate: (...a: any[]) => mockGetBestCandidate(...a),
  getMutualAidBestCandidate: (...a: any[]) => mockGetMutualAidBestCandidate(...a),
}));
jest.mock('../../src/services/dibsReason', () => ({ deriveDibsReason: () => 'trusted_neighbor' }));
jest.mock('../../src/db/dibsDb', () => ({
  deriveSimilarityKey: () => 'tools',
  getRelationshipContext: jest.fn().mockResolvedValue({ priorCompletedMatches: 2, lastInteractionAt: null, similarCategory: true }),
}));

import express from 'express';
import request from 'supertest';
import dibsRouter from '../../src/routes/dibs';

const CALLER = '11111111-1111-1111-1111-111111111111';
const NEIGHBOR = '22222222-2222-2222-2222-222222222222';
const SENTINEL_TRUST = 827;

function app() {
  const a = express();
  a.use(express.json());
  a.use((req: any, _res: any, next: any) => { req.user = { userId: CALLER, email: 'c@test.com', communities: [] }; next(); });
  a.use('/requests', dibsRouter);
  return a;
}

beforeEach(() => {
  jest.clearAllMocks();
  // trustPath enrichment is a non-fatal fetch — make it fail so the handler skips it.
  (global as any).fetch = jest.fn().mockRejectedValue(new Error('no social-graph in test'));
});

describe('GET /requests/:id/dibs-candidate — ADR-082', () => {
  it('omits an ordinary neighbor candidate\'s exact trustScore', async () => {
    mockQuery
      // 1. fetch the request (caller is the requester)
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'req-1', requester_id: CALLER, request_type: 'borrow', category: 'tools', payload: {} }] })
      // 2. request_communities
      .mockResolvedValueOnce({ rows: [{ community_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc' }] });
    mockGetMutualAidBestCandidate.mockResolvedValue({
      providerId: 'p1',
      providerUserId: NEIGHBOR,
      displayName: 'Sam',
      trustScore: SENTINEL_TRUST, // sentinel — must NOT appear in the response
      priorInteractions: 2,
      similarPriorInteractions: 1,
      trustGraphConnection: 'direct',
      isAvailable: true,
      kind: 'neighbor',
    });

    const res = await request(app()).get('/requests/req-1/dibs-candidate');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeTruthy();
    // The candidate identity + relationship structure survive…
    expect(res.body.data.providerUserId).toBe(NEIGHBOR);
    expect(res.body.data.priorInteractions).toBe(2);
    // …but the neighbor's exact reputation does not, at any depth.
    expect(JSON.stringify(res.body.data)).not.toMatch(/trustScore|"trust_score"|827/);
  });
});
