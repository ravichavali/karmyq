/**
 * Sprint 144 — staff membership routes, mocked-route contract (BUG-104, BUG-105).
 *
 * Request-supplied UUIDs are canonicalized at parse (src/utils/uuid.ts). PostgreSQL matches an
 * uppercase uuid literal in SQL, but returns lowercase values, so a JS comparison between the raw
 * path id and a DB row misses. The mock below behaves like PostgreSQL in exactly that respect: it
 * matches ids case-insensitively in WHERE clauses and returns lowercase ids.
 */

process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockQuery = jest.fn();
const mockTxQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: { query: jest.fn(), connect: jest.fn() },
  initDatabase: jest.fn().mockResolvedValue(undefined),
  query: (...args: any[]) => mockQuery(...args),
  // The transaction gets its own client so a test can prove which SQL ran inside it.
  withTransaction: (fn: any) => fn((...args: any[]) => mockTxQuery(...args)),
}));

jest.mock('../../src/events/publisher', () => ({
  initEventPublisher: jest.fn().mockResolvedValue(undefined),
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

import app from '../../src/index';

const SECRET = 'test-secret';
const COMMUNITY = 'cccccccc-0000-4000-8000-00000000000c';
const ADMIN = 'aaaaaaaa-0000-4000-8000-00000000000a';
const MEMBER = 'bbbbbbbb-0000-4000-8000-00000000000b';

const tokenFor = (userId: string) =>
  jwt.sign({ userId, email: `${userId}@test.invalid`, communities: [] }, SECRET);

type Row = { user_id: string; role: string; status: string };
let members: Record<string, Row>;
let writes: Array<{ sql: string; params: any[] }>;
let capacity = { current_members: 2, max_members: 150 };

/** A PostgreSQL-like membership store: case-insensitive uuid match, lowercase values out. */
function installDb(rows: Row[]) {
  members = Object.fromEntries(rows.map((row) => [row.user_id, { ...row }]));
  writes = [];
  const handler = async (sql: string, params: any[] = []) => {
    const s = String(sql);
    const id = (value: any) => String(value).toLowerCase();
    if (/FROM communities\.members/i.test(s) && /FOR UPDATE/i.test(s)) {
      const target = id(params[1]);
      const locked = Object.values(members)
        .filter((row) => row.user_id === target || (row.role === 'admin' && row.status === 'active'))
        .sort((a, b) => a.user_id.localeCompare(b.user_id));
      return { rows: locked.map((row) => ({ ...row })), rowCount: locked.length };
    }
    if (/SELECT role FROM communities\.members/i.test(s)) {
      const row = members[id(params[1])];
      return row && row.status === 'active' ? { rows: [{ role: row.role }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    if (/SELECT id, status FROM communities\.members/i.test(s)) {
      const row = members[id(params[1])];
      return row ? { rows: [{ id: 'm-' + row.user_id, status: row.status }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    if (/SELECT current_members, max_members FROM communities\.communities/i.test(s)) {
      return { rows: [capacity], rowCount: 1 };
    }
    if (/FROM communities\.communities/i.test(s) && /max_members/i.test(s)) {
      return { rows: [{ id: COMMUNITY, max_members: 150, current_members: 2, status: 'active', access_type: 'public' }], rowCount: 1 };
    }
    if (/^\s*INSERT INTO communities\.members/i.test(s)) {
      writes.push({ sql: s, params });
      const row = { user_id: id(params[1]), role: params[2], status: 'active' };
      members[row.user_id] = row;
      return { rows: [{ community_id: params[0], ...row }], rowCount: 1 };
    }
    if (/^\s*UPDATE communities\.members/i.test(s)) {
      writes.push({ sql: s, params });
      const row = members[id(params[1])];
      if (row && /SET status=\$3/i.test(s)) row.status = params[2];
      // The PUT's plan-driven SET list: `status = $n`, `role = $n`.
      if (row) for (const [, column, n] of s.matchAll(/\b(status|role) = \$(\d+)/g)) (row as any)[column] = params[Number(n) - 1];
      return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
    }
    if (/^\s*UPDATE communities\.communities/i.test(s)) {
      writes.push({ sql: s, params });
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };
  mockQuery.mockImplementation(handler);
  mockTxQuery.mockImplementation(handler);
}

const del = (caller: string, communityId: string, userId: string) => request(app)
  .delete(`/communities/${communityId}/members/${userId}`)
  .set('Authorization', `Bearer ${tokenFor(caller)}`);

beforeEach(() => {
  mockQuery.mockReset();
  mockTxQuery.mockReset();
});

describe('Sprint 144 DELETE /communities/:communityId/members/:userId canonical ids', () => {
  it('treats an uppercase spelling of the caller\'s own id as self-leave', async () => {
    installDb([
      { user_id: ADMIN, role: 'admin', status: 'active' },
      { user_id: MEMBER, role: 'member', status: 'active' },
    ]);
    const res = await del(MEMBER, COMMUNITY, MEMBER.toUpperCase());
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Left community successfully');
    expect(members[MEMBER].status).toBe('left');
    // Self-leave never needs the caller's staff role.
    expect(mockQuery.mock.calls.some(([sql]) => /SELECT role FROM communities\.members/i.test(sql))).toBe(false);
  });

  it('finds an uppercase target for an admin removal and writes the canonical id', async () => {
    installDb([
      { user_id: ADMIN, role: 'admin', status: 'active' },
      { user_id: MEMBER, role: 'member', status: 'active' },
    ]);
    const res = await del(ADMIN, COMMUNITY.toUpperCase(), MEMBER.toUpperCase());
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Member removed successfully');
    expect(members[MEMBER].status).toBe('inactive');
    const memberWrite = writes.find((w) => /UPDATE communities\.members/i.test(w.sql));
    expect(memberWrite?.params).toEqual([COMMUNITY, MEMBER, 'inactive']);
  });

  it.each([
    ['a malformed member id', COMMUNITY, 'not-a-uuid'],
    ['a malformed community id', 'comm-1', MEMBER],
    ['a padded member id', COMMUNITY, `${MEMBER}%20`],
  ])('returns 400 VALIDATION_ERROR for %s before any SQL', async (_label, communityId, userId) => {
    installDb([{ user_id: ADMIN, role: 'admin', status: 'active' }]);
    const res = await del(ADMIN, communityId, userId);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: 'VALIDATION_ERROR' });
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockTxQuery).not.toHaveBeenCalled();
  });
});

const MOD = 'eeeeeeee-0000-4000-8000-00000000000e';
const APPLICANT = 'ffffffff-0000-4000-8000-00000000000f';
const put = (caller: string, communityId: string, userId: string, body: unknown) => request(app)
  .put(`/communities/${communityId}/members/${userId}`)
  .set('Authorization', `Bearer ${tokenFor(caller)}`)
  .send(body as object);
const txSql = () => mockTxQuery.mock.calls.map(([sql]) => String(sql));
const memberWrites = () => writes.filter((w) => /UPDATE communities\.members/i.test(w.sql));
const staffed = (extra: Row[] = []) => installDb([
  { user_id: ADMIN, role: 'admin', status: 'active' },
  { user_id: MOD, role: 'moderator', status: 'active' },
  { user_id: MEMBER, role: 'member', status: 'active' },
  ...extra,
]);

describe('Sprint 144 PUT /communities/:communityId/members/:userId (transition table)', () => {
  beforeEach(() => { capacity = { current_members: 2, max_members: 150 }; });

  it.each([
    ['a malformed target id', COMMUNITY, 'u2'],
    ['a malformed community id', 'comm-1', MEMBER],
  ])('returns 400 VALIDATION_ERROR for %s before any SQL', async (_label, communityId, userId) => {
    staffed();
    const res = await put(ADMIN, communityId, userId, { role: 'moderator' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: 'VALIDATION_ERROR' });
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockTxQuery).not.toHaveBeenCalled();
  });

  it.each([
    ['both keys', { role: 'member', status: 'active' }],
    ['neither key', {}],
    ['an unknown key', { status: 'active', joined_at: '2000-01-01' }],
    ['status pending', { status: 'pending' }],
    ['an unknown role', { role: 'owner' }],
  ])('returns 400 VALIDATION_ERROR for a body with %s before any SQL', async (_label, body) => {
    staffed();
    const res = await put(ADMIN, COMMUNITY, MEMBER, body);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: 'VALIDATION_ERROR' });
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockTxQuery).not.toHaveBeenCalled();
  });

  it.each([
    ['an active member', MEMBER],
    ['a non-member', NEWCOMER_ID()],
  ])('returns 403 FORBIDDEN to %s, with no write', async (_label, caller) => {
    staffed([{ user_id: APPLICANT, role: 'member', status: 'pending' }]);
    const res = await put(caller, COMMUNITY, APPLICANT, { status: 'active' });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, error: 'FORBIDDEN' });
    expect(memberWrites()).toEqual([]);
  });

  it('returns 404 NOT_FOUND to staff for a missing target', async () => {
    staffed();
    const res = await put(ADMIN, COMMUNITY, APPLICANT, { status: 'active' });
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: 'NOT_FOUND' });
    expect(memberWrites()).toEqual([]);
  });

  it.each([
    ['deactivate an active member', MEMBER, { status: 'inactive' }, null],
    ['lift a block on a stored admin', APPLICANT, { status: 'left' }, { user_id: APPLICANT, role: 'admin', status: 'inactive' }],
    ['reactivate a stored admin', APPLICANT, { status: 'active' }, { user_id: APPLICANT, role: 'admin', status: 'inactive' }],
    ['change a role', MEMBER, { role: 'moderator' }, null],
  ])('returns 403 FORBIDDEN to a moderator trying to %s (BUG-105), with no write', async (_label, target, body, extra) => {
    staffed(extra ? [extra as Row] : []);
    const before = { ...members[target] };
    const res = await put(MOD, COMMUNITY, target, body);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(members[target]).toEqual(before);
    expect(memberWrites()).toEqual([]);
  });

  it('lets a moderator approve, writing status active and role member, then re-checking capacity', async () => {
    staffed([{ user_id: APPLICANT, role: 'admin', status: 'pending' }]);
    const res = await put(MOD, COMMUNITY, APPLICANT, { status: 'active' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ user_id: APPLICANT, status: 'active', role: 'member' });
    expect(memberWrites()).toHaveLength(1);
    expect(memberWrites()[0].params).toEqual([COMMUNITY, APPLICANT, 'active', 'member']);
    const sql = txSql();
    expect(sql.findIndex((s) => /SELECT current_members, max_members/i.test(s)))
      .toBeGreaterThan(sql.findIndex((s) => /UPDATE communities\.members/i.test(s)));
  });

  it('lets a moderator reject, writing status inactive and leaving the role', async () => {
    staffed([{ user_id: APPLICANT, role: 'member', status: 'pending' }]);
    const res = await put(MOD, COMMUNITY, APPLICANT, { status: 'inactive' });
    expect(res.status).toBe(200);
    expect(memberWrites().map((w) => w.params)).toEqual([[COMMUNITY, APPLICANT, 'inactive']]);
    expect(txSql().some((s) => /SELECT current_members, max_members/i.test(s))).toBe(false);
  });

  it('lets an admin lift a block, writing status left and role member, admitting nobody', async () => {
    staffed([{ user_id: APPLICANT, role: 'admin', status: 'inactive' }]);
    const res = await put(ADMIN, COMMUNITY, APPLICANT, { status: 'left' });
    expect(res.status).toBe(200);
    expect(members[APPLICANT]).toEqual({ user_id: APPLICANT, role: 'member', status: 'left' });
    expect(memberWrites().map((w) => w.params)).toEqual([[COMMUNITY, APPLICANT, 'left', 'member']]);
    expect(txSql().some((s) => /SELECT current_members, max_members/i.test(s))).toBe(false);
  });

  it('refuses inactive → active with 409 INVALID_MEMBERSHIP_TRANSITION', async () => {
    staffed([{ user_id: APPLICANT, role: 'member', status: 'inactive' }]);
    const res = await put(ADMIN, COMMUNITY, APPLICANT, { status: 'active' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('INVALID_MEMBERSHIP_TRANSITION');
    expect(members[APPLICANT].status).toBe('inactive');
  });

  it('refuses any request against a left row with 409 MEMBER_MUST_REJOIN', async () => {
    staffed([{ user_id: APPLICANT, role: 'member', status: 'left' }]);
    for (const body of [{ status: 'active' }, { status: 'left' }, { role: 'admin' }]) {
      const res = await put(ADMIN, COMMUNITY, APPLICANT, body);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('MEMBER_MUST_REJOIN');
    }
    expect(memberWrites()).toEqual([]);
  });

  it.each([
    ['demotion', { role: 'member' }],
    ['deactivation', { status: 'inactive' }],
  ])('refuses the sole admin\'s %s through an uppercase id with 400 LAST_ADMIN (BUG-104)', async (_label, body) => {
    installDb([
      { user_id: ADMIN, role: 'admin', status: 'active' },
      { user_id: MEMBER, role: 'member', status: 'active' },
    ]);
    const res = await put(ADMIN, COMMUNITY.toUpperCase(), ADMIN.toUpperCase(), body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('LAST_ADMIN');
    expect(members[ADMIN]).toEqual({ user_id: ADMIN, role: 'admin', status: 'active' });
  });

  it('refuses an approve that overfills the community with 400 COMMUNITY_FULL, checking after the UPDATE', async () => {
    staffed([{ user_id: APPLICANT, role: 'member', status: 'pending' }]);
    capacity = { current_members: 4, max_members: 3 };
    const res = await put(ADMIN, COMMUNITY, APPLICANT, { status: 'active' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: 'COMMUNITY_FULL' });
    const sql = txSql();
    expect(sql.findIndex((s) => /SELECT current_members, max_members/i.test(s)))
      .toBeGreaterThan(sql.findIndex((s) => /UPDATE communities\.members/i.test(s)));
  });

  it('answers an unexpected database error with 500 INTERNAL_ERROR and no raw detail', async () => {
    staffed();
    mockTxQuery.mockRejectedValue(new Error('secret: relation communities.members does not exist'));
    const res = await put(ADMIN, COMMUNITY, MEMBER, { role: 'moderator' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toMatch(/secret|relation|does not exist/);
  });

  it('runs lock, caller-role read, plan and write on the one transaction client, in that order', async () => {
    staffed();
    const res = await put(ADMIN, COMMUNITY, MEMBER, { role: 'moderator' });
    expect(res.status).toBe(200);
    expect(mockQuery).not.toHaveBeenCalled();
    const sql = txSql();
    expect(sql).toHaveLength(3);
    expect(sql[0]).toMatch(/user_id=\$2 OR \(role='admin' AND status='active'\)\)\s+ORDER BY user_id FOR UPDATE/);
    expect(mockTxQuery.mock.calls[0][1]).toEqual([COMMUNITY, MEMBER]);
    expect(sql[1]).toMatch(/SELECT role FROM communities\.members\s+WHERE community_id = \$1 AND user_id = \$2 AND status = 'active'/);
    expect(mockTxQuery.mock.calls[1][1]).toEqual([COMMUNITY, ADMIN]);
    expect(sql[2]).toMatch(/^\s*UPDATE communities\.members/);
    expect(mockTxQuery.mock.calls[2][1]).toEqual([COMMUNITY, MEMBER, 'moderator']);
  });
});

describe('Sprint 144 POST /communities/:communityId/join from a blocked row', () => {
  it('tells the person to ask an admin to lift the block, since staff no longer reactivate (decision 8)', async () => {
    installDb([
      { user_id: ADMIN, role: 'admin', status: 'active' },
      { user_id: APPLICANT, role: 'member', status: 'inactive' },
    ]);
    const res = await request(app).post(`/communities/${COMMUNITY}/join`)
      .set('Authorization', `Bearer ${tokenFor(APPLICANT)}`).send({});
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, error: 'MEMBERSHIP_RESTORE_REQUIRES_STAFF' });
    expect(res.body.message).toBe('Ask a community admin to lift the block; then you can rejoin');
  });
});

function NEWCOMER_ID() {
  return '99999999-0000-4000-8000-000000000099';
}

const NEWCOMER = 'dddddddd-0000-4000-8000-00000000000d';
const add = (caller: string, body: any) => request(app)
  .post(`/communities/${COMMUNITY}/members`)
  .set('Authorization', `Bearer ${tokenFor(caller)}`)
  .send(body);

describe('Sprint 144 POST /communities/:communityId/members canonical body user_id', () => {
  it('inserts the canonical id when the body spells it in uppercase', async () => {
    installDb([{ user_id: ADMIN, role: 'admin', status: 'active' }]);
    const res = await add(ADMIN, { user_id: NEWCOMER.toUpperCase() });
    expect(res.status).toBe(201);
    const insert = writes.find((w) => /INSERT INTO communities\.members/i.test(w.sql));
    expect(insert?.params.slice(0, 2)).toEqual([COMMUNITY, NEWCOMER]);
  });

  it('refuses an uppercase spelling of an existing member as already a member', async () => {
    installDb([
      { user_id: ADMIN, role: 'admin', status: 'active' },
      { user_id: MEMBER, role: 'member', status: 'active' },
    ]);
    const res = await add(ADMIN, { user_id: MEMBER.toUpperCase() });
    expect(res.status).toBe(400);
    expect(writes.some((w) => /INSERT INTO communities\.members/i.test(w.sql))).toBe(false);
  });

  it.each([
    ['a malformed id', 'newbie-user', 'user_id must be a valid UUID'],
    ['a non-string id', 42, 'user_id must be a valid UUID'],
    ['a missing id', undefined, 'user_id is required'],
  ])('returns 400 VALIDATION_ERROR for %s before any SQL', async (_label, userId, message) => {
    installDb([{ user_id: ADMIN, role: 'admin', status: 'active' }]);
    const res = await add(ADMIN, { user_id: userId });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: 'VALIDATION_ERROR', message });
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockTxQuery).not.toHaveBeenCalled();
  });
});
