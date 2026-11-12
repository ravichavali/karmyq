/**
 * Sprint 141 (BUG-073, ADR-105): the request-type catalog (`requests.ui_schemas`, every route on
 * `adminSchemasRouter`) is platform-wide configuration, so it admits a live PLATFORM admin (a row in
 * `auth.platform_admins`) and nobody else. A community admin, including any community's creator, is refused.
 *
 * The admin-actions mount (boost, propose-match, urgent) keeps its any-community prefilter, renamed
 * `requireAnyCommunityAdmin`, with unchanged behavior: the two roles never stand in for each other.
 *
 * Real app and middleware; the PostgreSQL boundary is mocked, and so is the live-role module for the route
 * rows (its SQL is proven against the real schema in
 * tests/integration/sprint-134-pr-k-live-admin-role.integration.test.ts). The helper's own cases run against
 * the real module.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockQuery = jest.fn();
process.env.JWT_SECRET = 'sprint-141-platform-admin-test-secret';
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
import * as adminAuth from '../../src/middleware/adminAuth';
import adminSchemasRouter from '../../src/routes/admin-schemas';

const actual = jest.requireActual('../../src/db/liveRole') as typeof liveRole;
const mocked = liveRole as jest.Mocked<typeof liveRole>;

const U = '10000000-0000-4000-8000-000000000001';
const C = '20000000-0000-4000-8000-000000000001';
const REQ = '30000000-0000-4000-8000-000000000001';
const SCHEMA = '50000000-0000-4000-8000-000000000001';
const OTHER = '10000000-0000-4000-8000-000000000002';

/** The caller administers C, by claim AND by live row: everything a community admin can be. */
const ADMIN_OF_C = [{ id: C, name: 'Mine', role: 'admin' }];
const PLATFORM_ADMIN_REQUIRED = { success: false, message: 'Platform admin access required', error: 'PLATFORM_ADMIN_REQUIRED' };

const token = (communities: unknown[]) =>
  jwt.sign({ userId: U, email: 'u@test.example', communities }, process.env.JWT_SECRET!);

let app: any;
beforeAll(async () => {
  app = (await import('../../src/index')).default;
});
// The root jest config resets every mock before each test (resetMocks), so implementations are armed here.
beforeEach(() => {
  mockQuery.mockImplementation(async (sql: string) =>
    /^\s*SELECT id FROM requests\.help_requests/.test(sql) ? { rows: [{ id: REQ }], rowCount: 1 } : { rows: [], rowCount: 0 });
});

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
const send = (method: Method, path: string, body: object | undefined, claim: unknown[] | null) => {
  const r = request(app)[method](path);
  const authed = claim === null ? r : r.set('Authorization', `Bearer ${token(claim)}`);
  return body ? authed.send(body) : authed;
};
const writes = () => mockQuery.mock.calls.map(([sql]) => String(sql)).filter((sql) => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql));
const uiSchemaQueries = () => mockQuery.mock.calls.map(([sql]) => String(sql)).filter((sql) => /requests\.ui_schemas/.test(sql));

describe('isLivePlatformAdmin (real module, pg mocked)', () => {
  it('reads auth.platform_admins with the exact SQL and [userId]', async () => {
    expect(await actual.isLivePlatformAdmin(U)).toBe(false);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toBe('SELECT 1 FROM auth.platform_admins WHERE user_id = $1 LIMIT 1');
    expect(mockQuery.mock.calls[0][1]).toEqual([U]);
  });
  it('is true for one grant row', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });
    expect(await actual.isLivePlatformAdmin(U)).toBe(true);
  });
  it('is false without a query for no user', async () => {
    expect(await actual.isLivePlatformAdmin(undefined)).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe('middleware exports (the rename leaves no ambiguous name behind)', () => {
  it('platformAdminAuth is [verifyToken, requirePlatformAdmin]; communityAdminAuth is [verifyToken, requireAnyCommunityAdmin]', () => {
    expect(adminAuth.platformAdminAuth).toEqual([adminAuth.verifyToken, adminAuth.requirePlatformAdmin]);
    expect(adminAuth.communityAdminAuth).toEqual([adminAuth.verifyToken, adminAuth.requireAnyCommunityAdmin]);
  });
  it('the old names requireAdmin and adminAuth are gone', () => {
    const exported = adminAuth as unknown as Record<string, unknown>;
    expect(exported.requireAdmin).toBeUndefined();
    expect(exported.adminAuth).toBeUndefined();
  });
});

// Every route the router defines, read from the router itself (never a hand-kept path list).
const schemaRoutes = (adminSchemasRouter.stack as unknown as Array<{ route?: { path: string; methods: Record<string, boolean> } }>)
  .flatMap((layer) => (layer.route ? Object.keys(layer.route.methods).map((m) => [m as Method, layer.route!.path] as const) : []));
const concrete = (path: string) => `/admin/schemas${path.replace(':id', SCHEMA).replace(':version', '1')}`;

/** What each route answers once past the gate, with no rows in the database and an empty body. */
const PASSED_GATE_STATUS: Record<string, number> = {
  'post /': 400, // missing required fields
  'get /': 200, // empty list
  'get /:id': 404,
  'put /:id': 404,
  'post /:id/publish': 404,
  'post /:id/archive': 404,
  'get /:id/versions': 200, // empty history
  'post /:id/rollback/:version': 404,
  'post /:id/variants': 400, // missing required fields
};

describe('/admin/schemas admits platform admins only (BUG-073)', () => {
  it('the router defines exactly the 9 routes this table covers', () => {
    expect(schemaRoutes.map(([m, p]) => `${m} ${p}`).sort()).toEqual(Object.keys(PASSED_GATE_STATUS).sort());
  });

  it.each(schemaRoutes)('%s %s: a live community admin with no platform grant → 403, before any query', async (method, path) => {
    mocked.isLiveAdminOfAnyCommunity.mockResolvedValue(true);
    mocked.isLiveAdmin.mockResolvedValue(true);
    mocked.getLiveRole.mockResolvedValue('admin');
    mocked.hasLiveRoleInRequestCommunities.mockResolvedValue(true);
    mocked.isLivePlatformAdmin.mockResolvedValue(false);
    const res = await send(method, concrete(path), method === 'get' ? undefined : {}, ADMIN_OF_C);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(PLATFORM_ADMIN_REQUIRED);
    expect(mocked.isLivePlatformAdmin.mock.calls).toEqual([[U]]);
    // No OR with the community role: the community-admin check is never consulted.
    expect(mocked.isLiveAdminOfAnyCommunity).not.toHaveBeenCalled();
    expect(uiSchemaQueries()).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it.each(schemaRoutes)('%s %s: a platform admin with no community role and an empty claim passes the gate', async (method, path) => {
    mocked.isLiveAdminOfAnyCommunity.mockResolvedValue(false);
    mocked.isLivePlatformAdmin.mockResolvedValue(true);
    const res = await send(method, concrete(path), method === 'get' ? undefined : {}, []);
    expect(res.status).toBe(PASSED_GATE_STATUS[`${method} ${path}`]);
    expect(mocked.isLivePlatformAdmin.mock.calls).toEqual([[U]]);
    expect(mocked.isLiveAdminOfAnyCommunity).not.toHaveBeenCalled();
  });

  it('no token → 401, and no role is looked up', async () => {
    const res = await send('get', '/admin/schemas', undefined, null);
    expect(res.status).toBe(401);
    expect(mocked.isLivePlatformAdmin).not.toHaveBeenCalled();
  });
});

describe('admin actions keep the any-community prefilter (renamed, unchanged)', () => {
  const routes: Array<[method: Method, path: string, body: object | undefined, liveStatus: number]> = [
    ['post', `/requests/${REQ}/boost`, undefined, 200],
    ['delete', `/requests/${REQ}/boost`, undefined, 200],
    ['post', `/requests/${REQ}/propose-match`, { user_id: OTHER }, 400], // stops at "proposed user is not a member"
    ['patch', `/requests/${REQ}/urgent`, { urgent: true }, 200],
  ];

  it.each(routes)('%s %s: a live community admin still passes, and the platform check is never consulted', async (method, path, body, liveStatus) => {
    mocked.isLiveAdminOfAnyCommunity.mockResolvedValue(true);
    mocked.hasLiveRoleInRequestCommunities.mockResolvedValue(true);
    mocked.isLivePlatformAdmin.mockResolvedValue(false);
    expect((await send(method, path, body, [])).status).toBe(liveStatus);
    expect(mocked.isLivePlatformAdmin).not.toHaveBeenCalled();
  });

  it.each(routes)('%s %s: a platform admin with no community role gets the existing 403, nothing written', async (method, path, body) => {
    mocked.isLiveAdminOfAnyCommunity.mockResolvedValue(false);
    mocked.isLivePlatformAdmin.mockResolvedValue(true);
    const res = await send(method, path, body, []);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Admin access required');
    expect(mocked.hasLiveRoleInRequestCommunities).not.toHaveBeenCalled();
    expect(writes()).toEqual([]);
  });
});
