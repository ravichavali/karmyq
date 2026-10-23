/**
 * Sprint 134 PR K (BUG-069, ADR-102): request-service admin gates re-derive the caller's role from
 * communities.members. Every token here CLAIMS admin of C, so a 403 proves the claim no longer grants
 * anything; the positive rows send an EMPTY claim, so passing proves the gate reads the row.
 *
 * Real app and middleware; the PostgreSQL boundary is mocked, and so is the live-role module for the
 * route rows (its SQL is proven against the real schema in
 * tests/integration/sprint-134-pr-k-live-admin-role.integration.test.ts). The helper's own cases run
 * against the real module.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockQuery = jest.fn();
process.env.JWT_SECRET = 'sprint-134-pr-k-test-secret';
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: {
    query: (...args: any[]) => mockQuery(...args),
    connect: async () => ({ query: (...args: any[]) => mockQuery(...args), release: () => {} }),
  },
  query: (...args: any[]) => mockQuery(...args),
  withTransaction: (fn: any) => fn((...args: any[]) => mockQuery(...args)),
  initDatabase: jest.fn(),
}));
// Automock: every export is a jest.fn (the helper's own cases use jest.requireActual).
jest.mock('../../src/db/liveRole');

import * as liveRole from '../../src/db/liveRole';

const actual = jest.requireActual('../../src/db/liveRole') as typeof liveRole;
const mocked = liveRole as jest.Mocked<typeof liveRole>;

const U = '10000000-0000-4000-8000-000000000001';
const C = '20000000-0000-4000-8000-000000000001';
const REQ = '30000000-0000-4000-8000-000000000001';
const COLLECTIVE = '40000000-0000-4000-8000-000000000001';
const OTHER = '10000000-0000-4000-8000-000000000002';

const STALE_ADMIN = [{ id: C, name: 'Claimed', role: 'admin' }];
const token = (communities: unknown[]) =>
  jwt.sign({ userId: U, email: 'u@test.example', communities }, process.env.JWT_SECRET!);

let app: any;
beforeAll(async () => {
  app = (await import('../../src/index')).default;
});
// The root jest config resets every mock before each test (resetMocks).
beforeEach(() => {
  // The only rows a gated route needs before its gate: "the request exists".
  mockQuery.mockImplementation(async (sql: string) =>
    /^\s*SELECT id FROM requests\.help_requests/.test(sql) ? { rows: [{ id: REQ }], rowCount: 1 } : { rows: [], rowCount: 0 });
});

const writes = () => mockQuery.mock.calls.map(([sql]) => String(sql)).filter((sql) => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql));
const send = (method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, body: object | undefined, claim: unknown[]) => {
  const r = request(app)[method](path).set('Authorization', `Bearer ${token(claim)}`);
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
  it("reads an active row whose role is NULL as 'member' (the column default), not as no membership", async () => {
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
  it('hasLiveRoleInRequestCommunities joins the request communities with exact params', async () => {
    expect(await actual.hasLiveRoleInRequestCommunities(REQ, U, ['admin', 'moderator'])).toBe(false);
    expect(mockQuery.mock.calls[0][0]).toMatch(/requests\.request_communities rc\s+JOIN communities\.members m/);
    expect(mockQuery.mock.calls[0][0]).toMatch(/m\.status = 'active' AND m\.role = ANY\(\$3::text\[\]\)/);
    expect(mockQuery.mock.calls[0][1]).toEqual([REQ, U, ['admin', 'moderator']]);
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });
    expect(await actual.hasLiveRoleInRequestCommunities(REQ, U, ['admin'])).toBe(true);
  });
  it.each([['not-a-uuid', U], [REQ, undefined]])('hasLiveRoleInRequestCommunities is false without a query for (%p, %p)', async (r, u) => {
    expect(await actual.hasLiveRoleInRequestCommunities(r, u, ['admin'])).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe('requireAdmin: /admin/schemas', () => {
  it('refuses a stale admin claim when no live admin row exists anywhere', async () => {
    mocked.isLiveAdminOfAnyCommunity.mockResolvedValue(false);
    const res = await send('get', '/admin/schemas', undefined, STALE_ADMIN);
    expect(res.status).toBe(403);
    expect(mocked.isLiveAdminOfAnyCommunity).toHaveBeenCalledWith(U);
    expect(mockQuery).not.toHaveBeenCalled();
  });
  it('admits a live admin whose claim is empty', async () => {
    mocked.isLiveAdminOfAnyCommunity.mockResolvedValue(true);
    expect((await send('get', '/admin/schemas', undefined, [])).status).toBe(200);
  });
});

describe('admin actions on a request (requireAdmin mount + per-request gate)', () => {
  const routes: Array<[method: 'post' | 'delete' | 'patch', path: string, body: object | undefined, liveStatus: number]> = [
    ['post', `/requests/${REQ}/boost`, undefined, 200],
    ['delete', `/requests/${REQ}/boost`, undefined, 200],
    ['post', `/requests/${REQ}/propose-match`, { user_id: OTHER }, 400], // stops at "proposed user is not a member"
    ['patch', `/requests/${REQ}/urgent`, { urgent: true }, 200],
  ];

  it.each(routes)('%s %s: the mount refuses a stale claim with no live admin row', async (method, path, body) => {
    mocked.isLiveAdminOfAnyCommunity.mockResolvedValue(false);
    const res = await send(method, path, body, STALE_ADMIN);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Admin access required');
    expect(mocked.hasLiveRoleInRequestCommunities).not.toHaveBeenCalled();
    expect(writes()).toEqual([]);
  });
  it.each(routes)("%s %s: the handler refuses an admin elsewhere who is not admin/mod of the request's community", async (method, path, body) => {
    mocked.isLiveAdminOfAnyCommunity.mockResolvedValue(true);
    mocked.hasLiveRoleInRequestCommunities.mockResolvedValue(false);
    const res = await send(method, path, body, STALE_ADMIN);
    expect(res.status).toBe(403);
    expect(mocked.hasLiveRoleInRequestCommunities).toHaveBeenCalledWith(REQ, U, ['admin', 'moderator']);
    expect(writes()).toEqual([]);
  });
  it.each(routes)('%s %s: a live admin/mod with an empty claim passes both gates', async (method, path, body, liveStatus) => {
    mocked.isLiveAdminOfAnyCommunity.mockResolvedValue(true);
    mocked.hasLiveRoleInRequestCommunities.mockResolvedValue(true);
    expect((await send(method, path, body, [])).status).toBe(liveStatus);
  });
});

describe('BUG-071: requester-offer routes sit before the admin-actions mount', () => {
  // A requester who administers nothing: requireAdmin would refuse them if these routes fell through to it.
  beforeEach(() => mocked.isLiveAdminOfAnyCommunity.mockResolvedValue(false));
  const member = [{ id: C, name: 'Member', role: 'member' }];

  it('GET /requests/:id/offers reaches the owner check (the request is theirs, no offers yet)', async () => {
    const res = await send('get', `/requests/${REQ}/offers`, undefined, member);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(mocked.isLiveAdminOfAnyCommunity).not.toHaveBeenCalled();
  });
  it.each(['accept', 'decline'])('PUT /requests/offers/:id/%s reaches the offer lookup (no pending offer → 404)', async (action) => {
    const res = await send('put', `/requests/offers/${COLLECTIVE}/${action}`, undefined, member);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
    expect(mocked.isLiveAdminOfAnyCommunity).not.toHaveBeenCalled();
  });
  it('the admin chain covers only the admin-action routes: an unmatched /requests path is a plain 404', async () => {
    const res = await send('post', `/requests/${REQ}/not-a-route`, {}, member);
    expect(res.status).toBe(404);
    expect(mocked.isLiveAdminOfAnyCommunity).not.toHaveBeenCalled();
  });
});

describe('collective <-> community links (collective admin OR live community admin)', () => {
  const routes: Array<[method: 'post' | 'delete', path: string, body: object | undefined, liveStatus: number]> = [
    ['post', `/collectives/${COLLECTIVE}/communities`, { community_id: C }, 201],
    ['delete', `/collectives/${COLLECTIVE}/communities/${C}`, undefined, 200],
  ];

  it.each(routes)('%s %s: refuses a stale community-admin claim', async (method, path, body) => {
    mocked.isLiveAdmin.mockResolvedValue(false);
    const res = await send(method, path, body, STALE_ADMIN);
    expect(res.status).toBe(403);
    expect(mocked.isLiveAdmin).toHaveBeenCalledWith(C, U);
    expect(writes()).toEqual([]);
  });
  it.each(routes)('%s %s: admits a live community admin with an empty claim', async (method, path, body, liveStatus) => {
    mocked.isLiveAdmin.mockResolvedValue(true);
    expect((await send(method, path, body, [])).status).toBe(liveStatus);
  });
});
