/**
 * Sprint 112 PR A — Reputation disclosure boundary contract tests (ADR-082).
 *
 * Owns the cross-user denial, canonical self summary, and ADR-074 envelope assertions for
 * reputation-service. The disclosure CI gate references this file as the contract owner for every
 * reputation-service inventory entry.
 *
 * Core rule under test: a path parameter NEVER grants access to another member's metrics. The
 * authenticated identity always comes from the verified JWT; cross-user reads return
 * 404 REPUTATION_NOT_FOUND (not 403 — we do not confirm that a user has reputation data).
 */
import express from 'express';
import request from 'supertest';
import {
  SelfCommunityReputationSchema,
  assertNoForbiddenReputationKeys,
} from '@karmyq/shared';

// Controllable identity for the mocked auth middleware.
let currentUser: any = null;
jest.mock('@karmyq/shared/middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = currentUser;
    next();
  },
}));

// DB layer under test control — getActiveMembership (disclosureAuth) runs through this.
const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...a: any[]) => mockQuery(...a) }));

// karmaService composition inputs are mocked; disclosureAuth assembles them for real.
const mockGetKarmaWithDecay = jest.fn();
const mockGetTrustScore = jest.fn();
jest.mock('../../src/services/karmaService', () => ({
  getUserKarma: jest.fn(),
  getUserKarmaWithDecay: (...a: any[]) => mockGetKarmaWithDecay(...a),
  getUserTrustScore: (...a: any[]) => mockGetTrustScore(...a),
  getOverallTrustScore: jest.fn(),
  getCommunityLeaderboard: jest.fn(),
  updateTrustScore: jest.fn(),
}));
jest.mock('../../src/database/communityTrustDb', () => ({ getCommunityTrustScore: jest.fn() }));
jest.mock('../../src/services/communityTrustService', () => ({ calculateCommunityTrustScore: jest.fn() }));
jest.mock('../../src/services/badgeService', () => ({ getUserBadges: jest.fn() }));
jest.mock('../../src/services/trustEvolutionService', () => ({
  evaluateUserEvolution: jest.fn(),
  getUserEffectiveParams: jest.fn(),
  EVOLUTION_SIGNALS: {},
}));
jest.mock('../../src/database/trustEvolutionDb', () => ({
  getUserTrustConfig: jest.fn(),
  upsertUserTrustConfig: jest.fn(),
  getEvolutionLog: jest.fn(),
  getCommunityEvolutionConfig: jest.fn(),
  updateCommunityEvolutionConfig: jest.fn(),
  getEvolutionOptInRate: jest.fn(),
  isCrossCommunityParticipant: jest.fn(),
  getGlobalEvolutionPreference: jest.fn(),
  upsertGlobalEvolutionPreference: jest.fn(),
}));
jest.mock('../../src/services/effectiveParamsCache', () => ({ getCachedEffectiveParams: jest.fn() }));
jest.mock('../../src/database/communityEvolutionDb', () => ({
  getCommunityEvolutionHistory: jest.fn(),
  getCommunityEvolutionSummary: jest.fn(),
}));

import reputationRouter from '../../src/routes/reputation';
import healthRouter from '../../src/routes/health';

const SELF = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const COMMUNITY = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function app() {
  const a = express();
  a.use(express.json());
  // healthRouter relies on mount-level auth (no per-route authMiddleware), so set req.user here.
  const inject = (req: any, _res: any, next: any) => { req.user = currentUser; next(); };
  a.use('/reputation', inject, reputationRouter);
  a.use('/reputation', inject, healthRouter);
  return a;
}

// A denial must be EXACTLY the ADR-074 envelope: { success:false, message:string, error:string }.
function expectAdr074(body: any, code: string) {
  expect(body.success).toBe(false);
  expect(typeof body.message).toBe('string');
  expect(body.error).toBe(code);
  expect(Object.keys(body).sort()).toEqual(['error', 'message', 'success']);
}

beforeEach(() => {
  jest.clearAllMocks();
  currentUser = { userId: SELF, email: 's@example.com', communities: [{ id: COMMUNITY, role: 'member' }] };
});

describe('GET /reputation/me/community-summary — canonical self summary', () => {
  beforeEach(() => {
    mockQuery.mockResolvedValue({ rows: [{ community_id: COMMUNITY, community_name: 'Maplewood', role: 'member' }] });
    mockGetTrustScore.mockResolvedValue({ user_id: SELF, community_id: COMMUNITY, score: 27, requests_completed: 1, offers_accepted: 2, avg_feedback_score: 4.5 });
    mockGetKarmaWithDecay.mockResolvedValue({ karma: 40, trend: 'stable', recent_helps: 2, recent_requests: 1, last_updated: new Date('2026-06-24T00:00:00.000Z') });
  });

  it('returns a schema-valid scoped summary for the authenticated caller', async () => {
    const res = await request(app()).get(`/reputation/me/community-summary?community_id=${COMMUNITY}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(() => SelfCommunityReputationSchema.parse(res.body.data)).not.toThrow();
    expect(res.body.data.reputation.score).toBe(27);
    expect(res.body.data.reputation.tier).toBe('active');
    expect(res.body.data.karma.current).toBe(40);
    expect(res.body.data.karma.trend).toBe('stable');
    expect(res.body.data.karma.half_life_days).toBe(180);
    expect(res.body.data.activity).toEqual({ recent_helps: 2, recent_requests: 1, window_days: 30 });
    expect(res.body.data.scope).toEqual({ type: 'community', community_id: COMMUNITY, community_name: 'Maplewood' });
  });

  it('400 INVALID_COMMUNITY_ID when community_id is missing or malformed', async () => {
    const missing = await request(app()).get('/reputation/me/community-summary');
    expect(missing.status).toBe(400);
    expectAdr074(missing.body, 'INVALID_COMMUNITY_ID');

    const malformed = await request(app()).get('/reputation/me/community-summary?community_id=not-a-uuid');
    expect(malformed.status).toBe(400);
    expectAdr074(malformed.body, 'INVALID_COMMUNITY_ID');
  });

  it('404 REPUTATION_NOT_FOUND when the caller is not an active member', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app()).get(`/reputation/me/community-summary?community_id=${COMMUNITY}`);
    expect(res.status).toBe(404);
    expectAdr074(res.body, 'REPUTATION_NOT_FOUND');
  });
});

describe('compatibility endpoints — self-only, cross-user returns 404 REPUTATION_NOT_FOUND', () => {
  // Every row carries 4 elements (payload may be null) so jest.each provides exactly the callback's
  // arity and does NOT inject its `done` callback into the payload slot.
  const crossUserCases: Array<[string, 'get' | 'put', string, any]> = [
    ['karma', 'get', `/reputation/karma/${OTHER}`, null],
    ['overall trust', 'get', `/reputation/trust/${OTHER}`, null],
    ['community trust', 'get', `/reputation/trust/${OTHER}/${COMMUNITY}`, null],
    ['history', 'get', `/reputation/history/${OTHER}`, null],
    ['badges', 'get', `/reputation/badges/${OTHER}`, null],
    ['user badges', 'get', `/reputation/users/${OTHER}/badges`, null],
    ['trust-config', 'get', `/reputation/trust-config/${OTHER}/${COMMUNITY}`, null],
    ['trust-config history', 'get', `/reputation/trust-config/${OTHER}/${COMMUNITY}/history`, null],
    ['trust-config put', 'put', `/reputation/trust-config/${OTHER}/${COMMUNITY}`, { evolution_enabled: true }],
    ['effective-params', 'get', `/reputation/users/${OTHER}/effective-params?communityId=${COMMUNITY}`, null],
    ['evolution-global get', 'get', `/reputation/users/${OTHER}/evolution-global`, null],
    ['evolution-global put', 'put', `/reputation/users/${OTHER}/evolution-global`, { global_evolution_enabled: true }],
  ];

  it.each(crossUserCases)('%s cross-user read is 404 REPUTATION_NOT_FOUND', async (_label, method, url, payload) => {
    const req = request(app())[method](url);
    const res = await (payload ? req.send(payload) : req);
    expect(res.status).toBe(404);
    expectAdr074(res.body, 'REPUTATION_NOT_FOUND');
    // No DB or service work should happen for a cross-user probe.
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockGetTrustScore).not.toHaveBeenCalled();
  });

  it('does NOT grant an admin exception on trust-config reads', async () => {
    // Caller is an admin of the community but is NOT the subject user.
    currentUser = { userId: SELF, communities: [{ id: COMMUNITY, role: 'admin' }] };
    const res = await request(app()).get(`/reputation/trust-config/${OTHER}/${COMMUNITY}`);
    expect(res.status).toBe(404);
    expectAdr074(res.body, 'REPUTATION_NOT_FOUND');
  });

  // Self identity is necessary but NOT sufficient — community-scoped self reads also require an
  // ACTIVE membership (ADR-082). A self caller who is not an active member of the community gets 404.
  const selfButInactiveCases: Array<[string, 'get' | 'put', string, any]> = [
    ['trust/:userId/:communityId', 'get', `/reputation/trust/${SELF}/${COMMUNITY}`, null],
    ['trust-config', 'get', `/reputation/trust-config/${SELF}/${COMMUNITY}`, null],
    ['trust-config history', 'get', `/reputation/trust-config/${SELF}/${COMMUNITY}/history`, null],
    ['trust-config put', 'put', `/reputation/trust-config/${SELF}/${COMMUNITY}`, { evolution_enabled: true }],
    ['effective-params', 'get', `/reputation/users/${SELF}/effective-params?communityId=${COMMUNITY}`, null],
  ];
  it.each(selfButInactiveCases)('%s for a self caller who is not an active member -> 404', async (_l, method, url, payload) => {
    mockQuery.mockResolvedValue({ rows: [] }); // getActiveMembership -> not a member
    const req = request(app())[method](url);
    const res = await (payload ? req.send(payload) : req);
    expect(res.status).toBe(404);
    expectAdr074(res.body, 'REPUTATION_NOT_FOUND');
  });
});

describe('GET /reputation/leaderboard/:communityId — retired', () => {
  it('410 REPUTATION_LEADERBOARD_RETIRED with no ranked rows', async () => {
    const res = await request(app()).get(`/reputation/leaderboard/${COMMUNITY}`);
    expect(res.status).toBe(410);
    expectAdr074(res.body, 'REPUTATION_LEADERBOARD_RETIRED');
    expect(res.body).not.toHaveProperty('data');
  });
});

describe('community aggregates — active member + >=5-member cohort (Task 4)', () => {
  const member = { rows: [{ community_id: COMMUNITY, role: 'member', community_name: 'Maplewood' }] };

  it('community-trust: non-member -> 404 AGGREGATE_NOT_AVAILABLE', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // getActiveMembership -> none
    const res = await request(app()).get(`/reputation/community-trust/${COMMUNITY}`);
    expect(res.status).toBe(404);
    expectAdr074(res.body, 'AGGREGATE_NOT_AVAILABLE');
  });

  it('community-trust: cohort of 4 is suppressed -> 404 AGGREGATE_NOT_AVAILABLE', async () => {
    mockQuery
      .mockResolvedValueOnce(member) // membership
      .mockResolvedValueOnce({ rows: [{ n: 4 }] }); // cohort < 5
    const res = await request(app()).get(`/reputation/community-trust/${COMMUNITY}`);
    expect(res.status).toBe(404);
    expectAdr074(res.body, 'AGGREGATE_NOT_AVAILABLE');
  });

  it('community-trust: member + cohort of 5 succeeds', async () => {
    const { getCommunityTrustScore } = require('../../src/database/communityTrustDb');
    getCommunityTrustScore.mockResolvedValue({ community_id: COMMUNITY, score: 62 });
    mockQuery
      .mockResolvedValueOnce(member) // membership
      .mockResolvedValueOnce({ rows: [{ n: 5 }] }); // cohort >= 5
    const res = await request(app()).get(`/reputation/community-trust/${COMMUNITY}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it.each([
    ['community-health', `/reputation/community-health/${COMMUNITY}`],
    ['milestones', `/reputation/milestones/${COMMUNITY}`],
    ['network-metrics', `/reputation/network-metrics/${COMMUNITY}`],
  ])('%s: non-member -> 404 AGGREGATE_NOT_AVAILABLE', async (_label, url) => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // getActiveMembership -> none
    const res = await request(app()).get(url);
    expect(res.status).toBe(404);
    expectAdr074(res.body, 'AGGREGATE_NOT_AVAILABLE');
  });
});

describe('self reads still work for the caller', () => {
  it('GET /reputation/users/:userId/evolution-global succeeds for self', async () => {
    const { getGlobalEvolutionPreference } = require('../../src/database/trustEvolutionDb');
    getGlobalEvolutionPreference.mockResolvedValue(true);
    const res = await request(app()).get(`/reputation/users/${SELF}/evolution-global`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    assertNoForbiddenReputationKeys(res.body.data);
  });
});
