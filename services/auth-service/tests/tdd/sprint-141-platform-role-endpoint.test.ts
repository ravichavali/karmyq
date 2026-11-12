/**
 * Sprint 141 (BUG-073, ADR-105): `GET /users/me/platform-role` tells the caller whether THEY are a platform admin, read
 * live from `auth.platform_admins` for the verified JWT's `userId`. The frontend uses it as a hint to show the
 * platform admin UI; the gated services re-check on every request, so this endpoint grants nothing by itself.
 *
 * Real router and auth middleware; the PostgreSQL boundary is mocked.
 */
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...args: unknown[]) => mockQuery(...args) }));
import users from '../../src/routes/users';

const SELF = '11111111-1111-4111-8111-111111111111';
const C = '22222222-2222-4222-8222-222222222222';
/** The claim says admin of C, and carries no platform field: the answer must come from the table alone. */
const token = () => jwt.sign({ userId: SELF, email: 'self@example.test', communities: [{ id: C, name: 'Mine', role: 'admin' }] },
  process.env.JWT_SECRET!);
const app = express();
app.use(express.json());
app.use('/users', users);
beforeEach(() => mockQuery.mockReset());

const PLATFORM_ROLE_SQL = 'SELECT 1 FROM auth.platform_admins WHERE user_id = $1 LIMIT 1';

describe('GET /users/me/platform-role (Sprint 141)', () => {
  it('a granted caller → 200 { platformAdmin: true }, read for the token userId with the exact SQL', async () => {
    mockQuery.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
    const res = await request(app).get('/users/me/platform-role').set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ platformAdmin: true });
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toBe(PLATFORM_ROLE_SQL);
    expect(mockQuery.mock.calls[0][1]).toEqual([SELF]);
  });

  it('a caller with no grant (a community admin by claim) → 200 { platformAdmin: false }', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    const res = await request(app).get('/users/me/platform-role').set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ platformAdmin: false });
    expect(mockQuery.mock.calls[0][1]).toEqual([SELF]);
  });

  it('no token → 401, and no query', async () => {
    const res = await request(app).get('/users/me/platform-role');
    expect(res.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('a failed lookup → 500, never a platformAdmin answer', async () => {
    mockQuery.mockRejectedValue(new Error('connection refused'));
    const res = await request(app).get('/users/me/platform-role').set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.data).toBeUndefined();
  });

  it('does not collide with GET /users/:userId (no profile query for "me")', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    await request(app).get('/users/me/platform-role').set('Authorization', `Bearer ${token()}`);
    expect(mockQuery.mock.calls.map(([sql]) => String(sql))).toEqual([PLATFORM_ROLE_SQL]);
  });
});
