/**
 * Sprint 140 (BUG-100): GET /communities/my/communities lists the AUTHENTICATED caller's memberships. Real JWT,
 * community service over HTTP, real PostgreSQL. Missing infrastructure is a failure, never a skip.
 *
 * Two users with disjoint memberships:
 * - A is an active member of two active communities (joined at different times), a pending member of a third, a
 *   removed member of a fourth, and an active member of an archived community. Only the first two may be listed,
 *   newest-joined first.
 * - B is an active member of one community A does not belong to.
 *
 * Proofs: the legacy `user_id` query parameter is ignored whether omitted, A's own id or B's id — A always gets A's two
 * communities and never B's. B gets only B's. An unauthenticated request and a signed token without a user id are
 * both denied 401.
 *
 * Fails before (REASONED, not run: no PostgreSQL on the Windows box; CI runs this against the fixed code). Before
 * Sprint 140 the handler required `user_id` (omitted → 400) and bound it into the SQL, so A passing B's id received
 * B's community, and an id-less token with a `user_id` was answered 200. The own-id, pending/removed/archived and
 * unauthenticated cases are controls that pass before too.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { createPool, ServiceUrls } from '../fixtures';

describe('Sprint 140 membership listing identity (BUG-100)', () => {
  const pool = createPool();
  const A = randomUUID(), B = randomUUID();
  const users = [A, B];
  const ids: Record<string, string> = {
    aOlder: randomUUID(), aNewer: randomUUID(), aPending: randomUUID(), aRemoved: randomUUID(), aArchived: randomUUID(),
    bOnly: randomUUID(),
  };
  const communities = Object.values(ids);
  const secret = process.env.JWT_SECRET || 'dev-secret-key';

  const bearer = (payload: object) => `Bearer ${jwt.sign(payload, secret)}`;
  const asUser = (id: string) => bearer({ userId: id, email: `${id}@karmyq.test`, communities: [] });
  const list = (auth: string | null, userIdParam?: string) => {
    const req = request(ServiceUrls.COMMUNITY)
      .get(`/communities/my/communities${userIdParam ? `?user_id=${userIdParam}` : ''}`);
    return auth ? req.set('Authorization', auth) : req;
  };
  /** The fixture communities a caller is listed, by name, in response order. */
  async function listed(auth: string, userIdParam?: string): Promise<string[]> {
    const res = await list(auth, userIdParam);
    expect({ status: res.status, success: res.body.success }).toEqual({ status: 200, success: true });
    const byId = new Map(Object.entries(ids).map(([name, id]) => [id, name]));
    const names = res.body.data.communities.map((c: { id: string }) => byId.get(c.id)).filter(Boolean);
    expect(res.body.data.count).toBe(res.body.data.communities.length);
    return names;
  }

  beforeAll(async () => {
    await pool.query('SELECT 1');
    expect((await request(ServiceUrls.COMMUNITY).get('/health')).status).toBe(200);
    for (const id of users) {
      await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)',
        [id, `Sprint 140 ${id.slice(0, 8)}`, `${id}@karmyq.test`, 'not-a-login']);
    }
    for (const [name, id] of Object.entries(ids)) {
      await pool.query(
        'INSERT INTO communities.communities(id,name,description,creator_id,status) VALUES ($1,$2,$3,$4,$5)',
        [id, `Sprint 140 ${name} ${id.slice(0, 8)}`, 'Fixture', name === 'bOnly' ? B : A, name === 'aArchived' ? 'archived' : 'active']);
    }
    const membership: Array<[string, string, string, string]> = [
      [A, ids.aOlder, 'active', '2026-01-01T00:00:00Z'],
      [A, ids.aNewer, 'active', '2026-02-01T00:00:00Z'],
      [A, ids.aPending, 'pending', '2026-03-01T00:00:00Z'],
      [A, ids.aRemoved, 'removed', '2026-03-02T00:00:00Z'],
      [A, ids.aArchived, 'active', '2026-03-03T00:00:00Z'],
      [B, ids.bOnly, 'active', '2026-01-15T00:00:00Z'],
    ];
    for (const [user, community, status, joinedAt] of membership) {
      await pool.query(
        `INSERT INTO communities.members(user_id,community_id,role,status,joined_at) VALUES ($1,$2,'member',$3,$4)`,
        [user, community, status, joinedAt]);
    }
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM communities.members WHERE community_id = ANY($1::uuid[])', [communities]);
      await pool.query('DELETE FROM communities.communities WHERE id = ANY($1::uuid[])', [communities]);
      await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [users]);
    } finally {
      await pool.end();
    }
  }, 120_000);

  it.each([
    ['omitted', undefined],
    ['the caller\'s own id', 'A'],
    ['the other user\'s id', 'B'],
  ])('legacy user_id %s: A is listed exactly A\'s active memberships, newest first', async (_label, who) => {
    const param = who === 'A' ? A : who === 'B' ? B : undefined;
    expect(await listed(asUser(A), param)).toEqual(['aNewer', 'aOlder']);
  });

  it('B, asking with A\'s id, is listed only B\'s community', async () => {
    expect(await listed(asUser(B), A)).toEqual(['bOnly']);
    expect(await listed(asUser(B))).toEqual(['bOnly']);
  });

  it('an unauthenticated request is denied 401', async () => {
    const res = await list(null, A);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('a signed token without a user id is denied 401, even naming a real user', async () => {
    const res = await list(bearer({ email: 'nobody@karmyq.test', communities: [] }), A);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.data).toBeUndefined();
  });
});
