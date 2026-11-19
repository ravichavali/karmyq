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
