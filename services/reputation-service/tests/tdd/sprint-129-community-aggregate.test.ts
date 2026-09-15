/**
 * Sprint 129 PR C — BUG-031: the /communities 404 storm (ADR-082).
 *
 * `/communities` asks for community-trust once per card, and every card the caller may not see used
 * to come back 404 — one console error per card. A denied aggregate is an ordinary empty state, so
 * it is now `200 { success: true, data: null }`.
 *
 * The privacy property that must survive: checkAggregateAccess denies an UNKNOWN community, a
 * NON-MEMBER, and an UNDERSIZED cohort alike, and the caller must never learn which. So the three
 * responses are compared to EACH OTHER, not merely each checked for 200. They must also match the
 * permitted-but-nothing-computed response, which the route already returned as `data: null` — a
 * denial must not be distinguishable from a real empty state.
 *
 * The DB is modelled as data rather than as a queue of canned rows, so "unknown" and "non-member"
 * are genuinely different situations underneath and only the route can make them look alike.
 */
import express from 'express';
import request from 'supertest';

const SELF = '11111111-1111-1111-1111-111111111111';
const UNKNOWN = '00000000-0000-0000-0000-000000000000';
const NOT_MINE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; // exists, 8 members, caller not one
const TOO_SMALL = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'; // caller is a member, cohort of 4
const MINE = 'cccccccc-cccc-cccc-cccc-cccccccccccc'; // caller is a member, cohort of 6
const MINE_UNSCORED = 'dddddddd-dddd-dddd-dddd-dddddddddddd'; // permitted, no score computable

const MEMBERS: Record<string, string[]> = {
  [NOT_MINE]: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8'],
  [TOO_SMALL]: [SELF, 'u2', 'u3', 'u4'],
  [MINE]: [SELF, 'u2', 'u3', 'u4', 'u5', 'u6'],
  [MINE_UNSCORED]: [SELF, 'u2', 'u3', 'u4', 'u5'],
};

// Answers exactly the two queries disclosureAuth issues; anything else is a test failure.
// Installed in beforeEach: the root jest config sets resetMocks, which wipes jest.fn implementations.
async function fakeQuery(sql: string, params: any[]) {
  if (/FROM communities\.members m\s+JOIN communities\.communities/.test(sql)) {
    const [userId, communityId] = params;
    const members = MEMBERS[communityId];
    return { rows: members?.includes(userId) ? [{ community_id: communityId, role: 'member', community_name: 'X' }] : [] };
  }
  if (/COUNT\(\*\)::int AS n FROM communities\.members/.test(sql)) {
    return { rows: [{ n: (MEMBERS[params[0]] ?? []).length }] };
  }
  throw new Error(`unexpected query: ${sql}`);
}
const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...a: [string, any[]]) => mockQuery(...a) }));

let currentUser: any = null;
jest.mock('@karmyq/shared/middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = currentUser;
    next();
  },
}));

const SCORE_ROW = { community_id: MINE, score: 62, member_quality_score: 30, bonding_score: 20 };
const mockGetCommunityTrustScore = jest.fn();
const mockCalculate = jest.fn();
jest.mock('../../src/database/communityTrustDb', () => ({
  getCommunityTrustScore: (id: string) => mockGetCommunityTrustScore(id),
}));
jest.mock('../../src/services/communityTrustService', () => ({
  calculateCommunityTrustScore: (id: string) => mockCalculate(id),
}));
jest.mock('../../src/services/karmaService', () => ({}));
jest.mock('../../src/services/badgeService', () => ({}));
jest.mock('../../src/services/trustEvolutionService', () => ({ EVOLUTION_SIGNALS: {} }));
jest.mock('../../src/database/trustEvolutionDb', () => ({}));
jest.mock('../../src/services/effectiveParamsCache', () => ({}));
jest.mock('../../src/database/communityEvolutionDb', () => ({}));
jest.mock('../../src/database/feedbackDb', () => ({}));

import reputationRouter from '../../src/routes/reputation';

function app() {
  const a = express();
  a.use('/reputation', reputationRouter);
  return a;
}

async function trust(communityId: string) {
  const res = await request(app()).get(`/reputation/community-trust/${communityId}`);
  return { status: res.status, contentType: res.headers['content-type'], body: res.body, text: res.text };
}

beforeEach(() => {
  mockQuery.mockImplementation(fakeQuery);
  mockGetCommunityTrustScore.mockImplementation(async (id: string) => (id === MINE ? SCORE_ROW : null));
  mockCalculate.mockResolvedValue(undefined);
  currentUser = { userId: SELF, email: 's@example.com', communities: [] };
});

describe('community-trust denial is an empty state, identical across every cause', () => {
  it('returns exactly 200 { success: true, data: null } for a denial', async () => {
    const res = await trust(NOT_MINE);
    expect(res.status).toBe(200);
    expect(res.text).toBe('{"success":true,"data":null}');
  });

  it('unknown community, non-member and undersized cohort are byte-identical', async () => {
    const unknown = await trust(UNKNOWN);
    const nonMember = await trust(NOT_MINE);
    const undersized = await trust(TOO_SMALL);

    expect(nonMember).toEqual(unknown);
    expect(undersized).toEqual(unknown);
  });

  it('a denial is indistinguishable from a permitted community with no computable score', async () => {
    const permittedEmpty = await trust(MINE_UNSCORED);
    const denied = await trust(TOO_SMALL);

    expect(permittedEmpty.status).toBe(200);
    expect(denied).toEqual(permittedEmpty);
  });

  it('never reads or computes an aggregate for a denied caller', async () => {
    await trust(UNKNOWN);
    await trust(NOT_MINE);
    await trust(TOO_SMALL);

    expect(mockGetCommunityTrustScore).not.toHaveBeenCalled();
    expect(mockCalculate).not.toHaveBeenCalled();
  });

  it('?recalculate=true does not let a denied caller trigger a computation', async () => {
    const res = await request(app()).get(`/reputation/community-trust/${NOT_MINE}?recalculate=true`);

    expect(res.text).toBe('{"success":true,"data":null}');
    expect(mockCalculate).not.toHaveBeenCalled();
  });
});

describe('a permitted caller is unchanged', () => {
  it('receives the stored aggregate row exactly', async () => {
    const res = await trust(MINE);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: SCORE_ROW });
    expect(mockCalculate).not.toHaveBeenCalled();
  });
});
