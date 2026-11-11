/**
 * Sprint 140 — BUG-100: GET /communities/my/communities must list the AUTHENTICATED caller's
 * memberships, never whichever `user_id` the query string names.
 *
 * Before the fix the handler required `req.query.user_id` and bound it straight into the
 * membership SQL, so any signed-in user could read any other user's community list by passing
 * that user's id. The fix derives the id from the verified JWT (`req.user.userId`), ignores the
 * legacy query parameter whether it is omitted, the caller's own id or a foreign id, and denies a
 * token that carries no user id before touching the database.
 */

process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../../src/database/db', () => {
  const q = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  const mockPool = {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: jest.fn().mockResolvedValue({ release: jest.fn() }),
  };
  return {
    __esModule: true,
    default: mockPool,
    initDatabase: jest.fn().mockResolvedValue(undefined),
    query: q,
    withTransaction: (fn: any) => fn((...args: any[]) => q(...args)),
  };
});

jest.mock('../../src/events/publisher', () => ({
  initEventPublisher: jest.fn().mockResolvedValue(undefined),
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

import app from '../../src/index';
import { query } from '../../src/database/db';

const mockQuery = query as jest.MockedFunction<typeof query>;
const SECRET = 'test-secret';

const CALLER = '11111111-1111-4111-8111-111111111111';
const FOREIGN = '22222222-2222-4222-8222-222222222222';

/** Membership rows keyed by the user id the SQL binds, so a wrong bind returns the wrong person's rows. */
const ROWS_BY_USER: Record<string, any[]> = {
  [CALLER]: [{ id: 'c-caller', name: 'Caller Commons', role: 'member' }],
  [FOREIGN]: [{ id: 'c-foreign', name: 'Foreign Guild', role: 'admin' }],
};

const MEMBERSHIP_SQL = /FROM communities\.members m\s+JOIN communities\.communities c/;

const membershipCalls = () =>
  mockQuery.mock.calls.filter(([sql]) => MEMBERSHIP_SQL.test(String(sql)));

const tokenFor = (userId: string) =>
  jwt.sign({ userId, email: `${userId}@test.com`, communities: [] }, SECRET);

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation((sql: any, params?: any) => {
    if (MEMBERSHIP_SQL.test(String(sql))) {
      const rows = ROWS_BY_USER[(params || [])[0]] ?? [];
      return Promise.resolve({ rows, rowCount: rows.length } as any);
    }
    return Promise.resolve({ rows: [], rowCount: 0 } as any);
  });
});

describe('BUG-100: membership listing derives identity from the JWT', () => {
  it.each([
    ['omitted', undefined],
    ['the caller\'s own id', CALLER],
    ['a foreign id', FOREIGN],
  ])('legacy user_id %s → binds only the authenticated caller and returns only their rows', async (_label, userIdParam) => {
    const res = await request(app)
      .get('/communities/my/communities')
      .query(userIdParam ? { user_id: userIdParam } : {})
      .set('Authorization', `Bearer ${tokenFor(CALLER)}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      communities: ROWS_BY_USER[CALLER],
      count: 1,
      total: 1,
    });

    const calls = membershipCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toEqual([CALLER]);
  });

  it('keeps the active-membership / active-community filters and newest-joined ordering', async () => {
    await request(app)
      .get('/communities/my/communities')
      .set('Authorization', `Bearer ${tokenFor(CALLER)}`);

    const [sql] = membershipCalls()[0];
    expect(String(sql)).toMatch(/WHERE m\.user_id = \$1 AND m\.status = 'active' AND c\.status = 'active'/);
    expect(String(sql)).toMatch(/ORDER BY m\.joined_at DESC/);
  });

  it('a signed token without a user id is denied 401 before any membership query runs', async () => {
    const noIdentity = jwt.sign({ email: 'nobody@test.com', communities: [] }, SECRET);
    const res = await request(app)
      .get('/communities/my/communities')
      .query({ user_id: FOREIGN })
      .set('Authorization', `Bearer ${noIdentity}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(membershipCalls()).toEqual([]);
  });

  it('an unauthenticated request is denied 401 and never reaches the membership query', async () => {
    const res = await request(app)
      .get('/communities/my/communities')
      .query({ user_id: FOREIGN });

    expect(res.status).toBe(401);
    expect(membershipCalls()).toEqual([]);
  });
});
