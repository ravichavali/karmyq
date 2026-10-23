/**
 * Sprint 134 PR K (BUG-069, ADR-102): reputation-service admin gates re-derive the caller's role from
 * communities.members. Every stale-case caller CLAIMS admin of C, so a 403 proves the claim no longer
 * grants anything; the positive rows carry an EMPTY claim, so passing proves the gate reads the row.
 * The three admin-only reads are gated the same way as the writes (CLAUDE.md: visibility gates are live).
 *
 * Real routers; auth, the PostgreSQL boundary, the services behind each route and (for the route rows)
 * the live-role module are mocked (the sprint-112-reputation-boundary pattern). The helper's own cases run
 * against the real module; its SQL is proven in tests/integration/sprint-134-pr-k-live-admin-role.integration.test.ts.
 */
import express from 'express';
import request from 'supertest';

let currentUser: any = null;
jest.mock('@karmyq/shared/middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = currentUser;
    next();
  },
}));
const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...a: any[]) => mockQuery(...a) }));
jest.mock('../../src/services/karmaService', () => ({
  getUserKarma: jest.fn(), getUserKarmaWithDecay: jest.fn(), getUserTrustScore: jest.fn(),
  getOverallTrustScore: jest.fn(), updateTrustScore: jest.fn(),
}));
jest.mock('../../src/database/communityTrustDb', () => ({ getCommunityTrustScore: jest.fn() }));
jest.mock('../../src/services/communityTrustService', () => ({ calculateCommunityTrustScore: jest.fn() }));
jest.mock('../../src/services/badgeService', () => ({ getUserBadges: jest.fn() }));
jest.mock('../../src/services/trustEvolutionService', () => ({
  evaluateUserEvolution: jest.fn(), getUserEffectiveParams: jest.fn(), EVOLUTION_SIGNALS: [],
}));
jest.mock('../../src/database/trustEvolutionDb', () => ({
  getUserTrustConfig: jest.fn(), upsertUserTrustConfig: jest.fn(), getEvolutionLog: jest.fn(),
  getCommunityEvolutionConfig: jest.fn(async () => ({ community_evolution_enabled: true, cross_community_prior: 0.5 })),
  updateCommunityEvolutionConfig: jest.fn(), getEvolutionOptInRate: jest.fn(async () => 0.25),
  isCrossCommunityParticipant: jest.fn(), getGlobalEvolutionPreference: jest.fn(), upsertGlobalEvolutionPreference: jest.fn(),
}));
jest.mock('../../src/services/effectiveParamsCache', () => ({ getCachedEffectiveParams: jest.fn() }));
jest.mock('../../src/database/communityEvolutionDb', () => ({
  getCommunityEvolutionHistory: jest.fn(async () => []),
  getCommunityEvolutionSummary: jest.fn(async () => ({ total_evaluations: 0 })),
}));
jest.mock('../../src/services/providerTrustService', () => ({
  recalculateProviderTrustScore: jest.fn(), backfillAllProviderTrustScores: jest.fn(async () => 3),
}));
jest.mock('../../src/events/publisher', () => ({ publishEvent: jest.fn() }));
jest.mock('../../src/utils/liveRole', () => ({
  ...jest.requireActual('../../src/utils/liveRole'),
  getLiveRole: jest.fn(),
  isLiveAdmin: jest.fn(),
  isLiveAdminOfAnyCommunity: jest.fn(),
}));

import * as liveRole from '../../src/utils/liveRole';
import { updateCommunityEvolutionConfig } from '../../src/database/trustEvolutionDb';
import { backfillAllProviderTrustScores } from '../../src/services/providerTrustService';
import reputationRouter from '../../src/routes/reputation';
import providerReviewsRouter from '../../src/routes/providerReviews';

const actual = jest.requireActual('../../src/utils/liveRole') as typeof liveRole;
const mocked = liveRole as jest.Mocked<typeof liveRole>;

const U = '10000000-0000-4000-8000-000000000001';
const C = '20000000-0000-4000-8000-000000000001';
const STALE_ADMIN = { userId: U, email: 'u@test.example', communities: [{ id: C, name: 'C', role: 'admin' }] };
const EMPTY_CLAIM = { userId: U, email: 'u@test.example', communities: [] };

const app = express();
app.use(express.json());
app.use('/reputation', reputationRouter);
app.use('/reputation', providerReviewsRouter);

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  for (const fn of [mocked.getLiveRole, mocked.isLiveAdmin, mocked.isLiveAdminOfAnyCommunity]) fn.mockReset();
  (updateCommunityEvolutionConfig as jest.Mock).mockClear();
  (backfillAllProviderTrustScores as jest.Mock).mockClear();
});

type Method = 'get' | 'put' | 'post';
const send = (method: Method, path: string, body: object | undefined, user: object) => {
  currentUser = user;
  const r = request(app)[method](path);
  return body ? r.send(body) : r;
};

describe('liveRole helper (real module, pg mocked)', () => {
  it('reads the active row with exact params', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ role: 'moderator' }], rowCount: 1 });
    expect(await actual.getLiveRole(C, U)).toBe('moderator');
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toMatch(/FROM communities\.members\s+WHERE community_id = \$1 AND user_id = \$2 AND status = 'active'/);
    expect(mockQuery.mock.calls[0][1]).toEqual([C, U]);
  });
  it('answers null when there is no active row', async () => {
    expect(await actual.getLiveRole(C, U)).toBeNull();
  });
  it("reads an active row whose role is NULL as 'member' (the column default)", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ role: null }], rowCount: 1 });
    expect(await actual.getLiveRole(C, U)).toBe('member');
  });
  it.each([[undefined, U], ['not-a-uuid', U], [C, undefined]])('answers null without a query for (%p, %p)', async (c, u) => {
    expect(await actual.getLiveRole(c, u)).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
  });
  it('isLiveAdmin is false for a moderator and true for an admin', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ role: 'moderator' }], rowCount: 1 });
    expect(await actual.isLiveAdmin(C, U)).toBe(false);
    mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }], rowCount: 1 });
    expect(await actual.isLiveAdmin(C, U)).toBe(true);
  });
  it('isLiveAdminOfAnyCommunity passes [userId] and needs an active admin row', async () => {
    expect(await actual.isLiveAdminOfAnyCommunity(U)).toBe(false);
    expect(mockQuery.mock.calls[0][0]).toMatch(/WHERE user_id = \$1 AND status = 'active' AND role = 'admin'/);
    expect(mockQuery.mock.calls[0][1]).toEqual([U]);
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });
    expect(await actual.isLiveAdminOfAnyCommunity(U)).toBe(true);
  });
  it('isLiveAdminOfAnyCommunity is false without a query for no user', async () => {
    expect(await actual.isLiveAdminOfAnyCommunity(undefined)).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

// [method, path, body, live status]
const evolutionRoutes: Array<[Method, string, object | undefined, number]> = [
  ['get', `/reputation/communities/${C}/trust-evolution`, undefined, 200],
  ['put', `/reputation/communities/${C}/trust-evolution`, {}, 400], // stops at "No valid fields to update"
  ['get', `/reputation/community/${C}/evolution/history`, undefined, 200],
  ['get', `/reputation/community/${C}/evolution/summary`, undefined, 200],
  ['put', `/reputation/community/${C}/evolution/toggle`, {}, 400], // stops at "enabled (boolean) required"
];

describe('community evolution admin routes', () => {
  it.each(evolutionRoutes)('%s %s refuses a stale admin claim', async (method, path, body) => {
    mocked.isLiveAdmin.mockResolvedValue(false);
    const res = await send(method, path, body, STALE_ADMIN);
    expect(res.status).toBe(403);
    expect(mocked.isLiveAdmin.mock.calls).toEqual([[C, U]]);
    expect(updateCommunityEvolutionConfig).not.toHaveBeenCalled();
  });
  it.each(evolutionRoutes)('%s %s admits a live admin with an empty claim', async (method, path, body, live) => {
    mocked.isLiveAdmin.mockResolvedValue(true);
    expect((await send(method, path, body, EMPTY_CLAIM)).status).toBe(live);
  });
  it('PUT toggle by a live admin writes the flag', async () => {
    mocked.isLiveAdmin.mockResolvedValue(true);
    const res = await send('put', `/reputation/community/${C}/evolution/toggle`, { enabled: false }, EMPTY_CLAIM);
    expect(res.status).toBe(200);
    expect(updateCommunityEvolutionConfig).toHaveBeenCalledWith(C, { community_evolution_enabled: false });
  });
});

describe('POST /reputation/provider-trust/recalculate (admin of any community, live)', () => {
  it('refuses a stale admin claim and never runs the backfill', async () => {
    mocked.isLiveAdminOfAnyCommunity.mockResolvedValue(false);
    const res = await send('post', '/reputation/provider-trust/recalculate', undefined, STALE_ADMIN);
    expect(res.status).toBe(403);
    expect(mocked.isLiveAdminOfAnyCommunity.mock.calls).toEqual([[U]]);
    expect(backfillAllProviderTrustScores).not.toHaveBeenCalled();
  });
  it('runs the backfill for a live admin with an empty claim', async () => {
    mocked.isLiveAdminOfAnyCommunity.mockResolvedValue(true);
    (backfillAllProviderTrustScores as jest.Mock).mockResolvedValue(3); // per test: resetMocks wipes module-scope impls
    const res = await send('post', '/reputation/provider-trust/recalculate', undefined, EMPTY_CLAIM);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ updated: 3 });
  });
});
