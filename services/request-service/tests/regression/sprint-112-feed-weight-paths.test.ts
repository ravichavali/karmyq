/**
 * Sprint 112 PR A — feed ranking call-site weight proof (ADR-082).
 *
 * The sibling suite (sprint-112-feed-dibs-privacy) proves the OUTWARD response carries no requester
 * reputation, and the unit suite proves RANKING_DEFAULT_WEIGHTS is itself normalized + requester-trust
 * free. Neither proves that the ACTUAL handler call sites pass that vector. This suite closes that gap:
 * a controlled calculateFeedScore mock encodes the requester-trust WEIGHT each branch passes into the
 * returned score (weight 0 → above threshold, included; weight > 0 → below threshold, excluded). It then
 * drives both reputation-free ranking branches — the unconfigured-community path AND the
 * sister-community path — and asserts the requests survive the server-fixed minScore. If either call
 * site reverted to raw DEFAULT_FEED_WEIGHTS (feed_weight_requester_trust 0.15), the score would drop
 * below the threshold and those requests would vanish, failing the test.
 *
 * NOTE: the root jest config sets resetMocks:true, which wipes a jest.fn's implementation before each
 * test — so the controlled scorer implementation is (re)installed in beforeEach, not the mock factory.
 */
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

// Mock only the final composite scorer; every other export (DEFAULT_FEED_WEIGHTS used to build
// RANKING_DEFAULT_WEIGHTS at module load, the signal scorers, calculateMatchScore) stays real via the
// spread. The implementation is set in beforeEach (resetMocks:true clears it otherwise).
jest.mock('@karmyq/shared/matching', () => {
  const actual = jest.requireActual('@karmyq/shared/matching');
  return { __esModule: true, ...actual, calculateFeedScore: jest.fn() };
});

import express from 'express';
import request from 'supertest';
import { calculateFeedScore } from '@karmyq/shared/matching';
import requestsRouter from '../../src/routes/requests';

const feedScoreMock = calculateFeedScore as unknown as jest.Mock;

const CALLER = '11111111-1111-1111-1111-111111111111';
const REQUESTER = '33333333-3333-3333-3333-333333333333';
const COMMUNITY = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const SISTER = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

function curatedApp() {
  const a = express();
  a.use(express.json());
  a.use((req: any, _res: any, next: any) => {
    req.user = { userId: CALLER, email: 'c@test.com', communities: [{ id: COMMUNITY, role: 'member' }] };
    req.logger = { error: () => {} };
    next();
  });
  a.use('/requests', requestsRouter);
  return a;
}

// Substring-keyed query mock. `configRow=null` exercises the UNCONFIGURED ranking branch (handler falls
// back to RANKING_DEFAULT_WEIGHTS). The sister-link row drives the sister branch under
// includeSisterCommunities. The feed query yields one request from the home community and one from the
// sister, so BOTH ranking call sites run in a single request.
const makeCuratedMock = (configRow: Record<string, unknown> | null = null) => (sql: string) => {
  if (/FROM auth\.users WHERE id/.test(sql)) {
    return Promise.resolve({ rowCount: 1, rows: [{ id: CALLER, name: 'Caller' }] });
  }
  if (/community_configs cc/.test(sql)) {
    return Promise.resolve({ rowCount: configRow ? 1 : 0, rows: configRow ? [configRow] : [] });
  }
  if (/community_links cl/.test(sql)) {
    return Promise.resolve({ rowCount: 1, rows: [{ sister_community_id: SISTER, trust_carry_factor: 0.4 }] });
  }
  if (/user_request_preferences/.test(sql)) {
    return Promise.resolve({ rowCount: 1, rows: [{ request_type: 'generic', subscribed: true }] });
  }
  if (/FROM requests\.help_requests r/.test(sql)) {
    const rows = [
      {
        id: 'req-home', requester_id: REQUESTER, request_type: 'generic', title: 'Home need',
        description: 'help', urgency: 'low', payload: {}, status: 'open', created_at: new Date().toISOString(),
        community_ids: COMMUNITY, in_user_community: true, visibility_scope: 'community', visibility_max_degrees: 3,
      },
      {
        id: 'req-sister', requester_id: REQUESTER, request_type: 'generic', title: 'Sister need',
        description: 'help', urgency: 'low', payload: {}, status: 'open', created_at: new Date().toISOString(),
        community_ids: SISTER, in_user_community: false, visibility_scope: 'community', visibility_max_degrees: 3,
      },
    ];
    return Promise.resolve({ rowCount: rows.length, rows });
  }
  return Promise.resolve({ rowCount: 0, rows: [] });
};

beforeEach(() => {
  jest.clearAllMocks();
  // resetMocks:true wipes the implementation each test — reinstall the weight-encoding scorer.
  // The reputation-free vector forces feed_weight_requester_trust to exactly 0 → score 90 (> default
  // threshold 30). A regressed call site passing raw DEFAULT_FEED_WEIGHTS carries 0.15 → score 5 (< 30).
  feedScoreMock.mockImplementation((_input: any, weights: any) => {
    const requesterTrustWeight = Number(weights?.feed_weight_requester_trust ?? 0);
    return { score: requesterTrustWeight === 0 ? 90 : 5, breakdown: {}, weights };
  });
  (global as any).fetch = jest.fn().mockRejectedValue(new Error('no social-graph in test'));
});

describe('GET /requests/curated — both ranking branches use the reputation-free weight vector (ADR-082)', () => {
  it('unconfigured + sister requests survive the server-fixed threshold (requester_trust weight=0 on both paths)', async () => {
    mockQuery.mockImplementation(makeCuratedMock(null) as any); // unconfigured → RANKING_DEFAULT_WEIGHTS fallback
    const res = await request(curatedApp())
      .get(`/requests/curated?view=home&community_id=${COMMUNITY}&includeSisterCommunities=true`);

    expect(res.status).toBe(200);
    // Both call sites ran (home + sister request), and each was passed a requester-trust weight of 0.
    expect(feedScoreMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    for (const call of feedScoreMock.mock.calls) {
      expect(Number((call[1] as Record<string, number>).feed_weight_requester_trust)).toBe(0);
    }

    const ids = (res.body.data?.items ?? []).filter((i: any) => i.kind === 'request').map((i: any) => i.data.request_id);
    // Both branches scored 90 (weight 0) → above the default minScore 30 → both present. A call site that
    // reverted to raw DEFAULT_FEED_WEIGHTS would score 5 → below 30 → the request would be dropped here.
    expect(ids).toContain('req-home');
    expect(ids).toContain('req-sister');
  });
});
