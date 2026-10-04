/** Audience truth through real service JWT verification and real PostgreSQL. No SQL emulation. */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { createPool, ServiceUrls } from '../fixtures';

describe('Sprint 132 PR B inventory audience (real database and service)', () => {
  const pool = createPool();
  const O = randomUUID(),
    M = randomUUID(),
    X = randomUUID(),
    A = randomUUID();
  const C1 = randomUUID(),
    C2 = randomUUID();
  const users = [O, M, X, A],
    communities = [C1, C2];
  const token = (id: string, claim: any[] = []) =>
    jwt.sign(
      { userId: id, email: `${id}@karmyq.test`, communities: claim },
      process.env.JWT_SECRET || 'dev-secret-key'
    );
  const api = (
    id: string,
    method: 'get' | 'post' | 'patch' | 'put' | 'delete',
    path: string,
    claim: any[] = []
  ) =>
    request(ServiceUrls.REQUEST)
      [method](`/requests/inventory${path}`)
      .set('Authorization', `Bearer ${token(id, claim)}`);
  let personal: string, communal: string;
  beforeAll(async () => {
    await pool.query('SELECT 1'); // Required prerequisite: throw on failure, including under CI.
    expect((await request(ServiceUrls.REQUEST).get('/health')).status).toBe(200);
    for (const id of users)
      await pool.query(
        'INSERT INTO auth.users (id,name,email,password_hash) VALUES ($1,$2,$3,$4)',
        [id, id === O ? 'Olivia' : 'Fixture', `${id}@karmyq.test`, 'not-a-login']
      );
    for (const id of communities)
      await pool.query(
        'INSERT INTO communities.communities (id,name,description,creator_id) VALUES ($1,$2,$3,$4)',
        [id, `Inventory ${id}`, 'Fixture', A]
      );
    for (const [user, community, role] of [
      [O, C1, 'member'],
      [M, C1, 'member'],
      [A, C1, 'admin'],
      [X, C2, 'member'],
    ]) {
      await pool.query(
        "INSERT INTO communities.members (user_id,community_id,role,status) VALUES ($1,$2,$3,'active')",
        [user, community, role]
      );
    }
  });
  beforeEach(async () => {
    await pool.query(
      'DELETE FROM inventory.items WHERE owner_user_id = ANY($1::uuid[]) OR owner_community_id = ANY($2::uuid[])',
      [users, communities]
    );
    await pool.query(
      "UPDATE communities.members SET status='active' WHERE user_id = ANY($1::uuid[])",
      [users]
    );
    const p = await api(O, 'post', '/items').send({
      name: 'Ladder',
      category: 'tools',
      condition: 'good',
    });
    expect(p.status).toBe(201);
    personal = p.body.data.id;
    const c = await api(A, 'post', '/items').send({
      name: 'Community tent',
      category: 'camping',
      owner_community_id: C1,
    });
    expect(c.status).toBe(201);
    communal = c.body.data.id;
  });
  afterAll(async () => {
    try {
      await pool.query(
        'DELETE FROM inventory.items WHERE owner_user_id = ANY($1::uuid[]) OR owner_community_id = ANY($2::uuid[])',
        [users, communities]
      );
      await pool.query('DELETE FROM communities.communities WHERE id = ANY($1::uuid[])', [
        communities,
      ]);
      await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [users]);
    } finally {
      await pool.end();
    }
  });
  async function share() {
    expect(
      (await api(O, 'put', `/items/${personal}/shares`).send({ community_ids: [C1] })).status
    ).toBe(200);
  }
  it('defaults personal items to owner-only access', async () => {
    expect((await api(O, 'get', `/items/${personal}`)).status).toBe(200);
    for (const id of [M, X, A])
      expect((await api(id, 'get', `/items/${personal}`)).status).toBe(404);
    expect((await api(O, 'get', '/mine')).body.data.items.map((i: any) => i.id)).toEqual([
      personal,
    ]);
  });
  it('shares only to active members of the chosen community', async () => {
    await share();
    expect((await api(M, 'get', `/items/${personal}`)).status).toBe(200);
    expect((await api(X, 'get', `/items/${personal}`)).status).toBe(404);
    await pool.query(
      "UPDATE communities.members SET status='left' WHERE user_id=$1 AND community_id=$2",
      [M, C1]
    );
    expect((await api(M, 'get', `/items/${personal}`)).status).toBe(404);
  });
  it('withdraws and restores a persisted share when the owner leaves and rejoins', async () => {
    await share();
    await pool.query(
      "UPDATE communities.members SET status='left' WHERE user_id=$1 AND community_id=$2",
      [O, C1]
    );
    expect((await api(M, 'get', `/items/${personal}`)).status).toBe(404);
    await pool.query(
      "UPDATE communities.members SET status='active' WHERE user_id=$1 AND community_id=$2",
      [O, C1]
    );
    expect((await api(M, 'get', `/items/${personal}`)).status).toBe(200);
  });
  it('hides unavailable personal items while retaining owner management', async () => {
    await share();
    expect(
      (await api(O, 'patch', `/items/${personal}`).send({ status: 'unavailable' })).status
    ).toBe(200);
    expect((await api(M, 'get', `/items/${personal}`)).status).toBe(404);
    expect((await api(O, 'get', `/items/${personal}`)).status).toBe(200);
  });
  it('allows community admins to manage and members only to read', async () => {
    expect((await api(M, 'get', `/items/${communal}`)).status).toBe(200);
    expect((await api(X, 'get', `/items/${communal}`)).status).toBe(404);
    expect((await api(A, 'patch', `/items/${communal}`).send({ name: 'Updated' })).status).toBe(
      200
    );
    expect((await api(M, 'patch', `/items/${communal}`).send({ name: 'Forbidden' })).status).toBe(
      403
    );
    expect((await api(M, 'delete', `/items/${communal}`)).status).toBe(403);
  });
  it('rejects invalid sharing atomically and rejects shares on community items', async () => {
    await share();
    expect(
      (await api(O, 'put', `/items/${personal}/shares`).send({ community_ids: [C2] })).status
    ).toBe(400);
    expect((await api(M, 'get', `/items/${personal}`)).status).toBe(200);
    expect(
      (await api(A, 'put', `/items/${communal}/shares`).send({ community_ids: [] })).status
    ).toBe(400);
    expect(
      (await api(O, 'put', `/items/${personal}/shares`).send({ community_ids: [] })).status
    ).toBe(200);
    expect((await api(M, 'get', `/items/${personal}`)).status).toBe(404);
  });
  it('returns exact audience-filtered community sections and denies outsiders', async () => {
    await share();
    expect((await api(X, 'get', `/community/${C1}`)).status).toBe(403);
    const data = (await api(M, 'get', `/community/${C1}`)).body.data;
    expect(data.community_owned.map((i: any) => i.id)).toEqual([communal]);
    expect(data.shared_by_members.map((i: any) => i.id)).toEqual([personal]);
    expect(data.shared_by_members[0].owner).toEqual({ id: O, name: 'Olivia' });
  });
  it('limits share metadata and applies membership in the chosen community even with another live share', async () => {
    try {
      await pool.query(
        "INSERT INTO communities.members (user_id,community_id,role,status) VALUES ($1,$2,'member','active')",
        [O, C2]
      );
      expect(
        (await api(O, 'put', `/items/${personal}/shares`).send({ community_ids: [C1, C2] })).status
      ).toBe(200);
      expect(
        (await api(M, 'get', `/items/${personal}`)).body.data.shared_with.map((c: any) => c.id)
      ).toEqual([C1]);
      await pool.query(
        "INSERT INTO communities.members (user_id,community_id,role,status) VALUES ($1,$2,'member','active')",
        [M, C2]
      );
      await pool.query(
        "UPDATE communities.members SET status='inactive' WHERE user_id=$1 AND community_id=$2",
        [O, C1]
      );
      expect((await api(M, 'get', `/community/${C1}`)).body.data.shared_by_members).toEqual([]);
      expect(
        (await api(M, 'get', `/community/${C2}`)).body.data.shared_by_members.map((i: any) => i.id)
      ).toEqual([personal]);
      expect((await api(M, 'get', `/items/${personal}`)).status).toBe(200);
      // The owner retains the full configured set; leaving suspends a share without deleting it.
      expect(
        (await api(O, 'get', '/mine')).body.data.items[0].shared_with.map((c: any) => c.id).sort()
      ).toEqual([C1, C2].sort());
    } finally {
      await pool.query(
        'DELETE FROM communities.members WHERE user_id=ANY($1::uuid[]) AND community_id=$2',
        [[O, M], C2]
      );
    }
  });
  it('rolls back the old share set when insertion fails after its deletion', async () => {
    await share();
    // Isolated trigger faults only this fixture item, exercising the real PostgreSQL transaction.
    const suffix = personal.replace(/-/g, '');
    const functionName = `inventory.s132_fail_${suffix}`,
      triggerName = `s132_fail_${suffix}`;
    try {
      await pool.query(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.item_id = '${personal}'::uuid THEN RAISE EXCEPTION 'Inventory rollback fixture'; END IF;
        RETURN NEW; END $$`);
      await pool.query(
        `CREATE TRIGGER ${triggerName} BEFORE INSERT ON inventory.item_shares FOR EACH ROW EXECUTE FUNCTION ${functionName}()`
      );
      expect(
        (await api(O, 'put', `/items/${personal}/shares`).send({ community_ids: [C1] })).status
      ).toBe(500);
      expect((await api(M, 'get', `/items/${personal}`)).status).toBe(200);
      expect(
        (
          await pool.query('SELECT community_id FROM inventory.item_shares WHERE item_id=$1', [
            personal,
          ])
        ).rows
      ).toEqual([{ community_id: C1 }]);
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${triggerName} ON inventory.item_shares`);
      await pool.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }
  });
  it('ignores stale admin claims for creation and management', async () => {
    const claim = [{ id: C1, name: 'C1', role: 'admin' }];
    expect(
      (
        await api(M, 'post', '/items', claim).send({
          name: 'Spoof',
          category: 'tools',
          owner_community_id: C1,
        })
      ).status
    ).toBe(403);
    expect(
      (await api(M, 'patch', `/items/${communal}`, claim).send({ name: 'Spoof' })).status
    ).toBe(403);
  });
  it('hides unavailable community property from ordinary members on both surfaces', async () => {
    expect(
      (await api(A, 'patch', `/items/${communal}`).send({ status: 'unavailable' })).status
    ).toBe(200);
    expect((await api(A, 'get', `/items/${communal}`)).status).toBe(200);
    expect(
      (await api(A, 'get', `/community/${C1}`)).body.data.community_owned.map((i: any) => i.id)
    ).toEqual([communal]);
    for (const id of [M, X]) expect((await api(id, 'get', `/items/${communal}`)).status).toBe(404);
    expect((await api(M, 'get', `/community/${C1}`)).body.data.community_owned).toEqual([]);
    expect((await api(A, 'patch', `/items/${communal}`).send({ status: 'available' })).status).toBe(
      200
    );
    expect((await api(M, 'get', `/items/${communal}`)).status).toBe(200);
    expect(
      (await api(M, 'get', `/community/${C1}`)).body.data.community_owned.map((i: any) => i.id)
    ).toEqual([communal]);
  });
  it('returns 404 for non-audience writes and removes an owned item', async () => {
    for (const method of ['patch', 'delete', 'put'] as const) {
      expect(
        (
          await api(X, method, `/items/${personal}${method === 'put' ? '/shares' : ''}`).send(
            method === 'put' ? { community_ids: [] } : { name: 'x' }
          )
        ).status
      ).toBe(404);
    }
    expect((await api(O, 'delete', `/items/${personal}`)).body.data).toEqual({ deleted: true });
    expect((await api(O, 'get', `/items/${personal}`)).status).toBe(404);
  });
  it('preserves community property when its creator is hard-deleted', async () => {
    const creator = randomUUID();
    await pool.query('INSERT INTO auth.users (id,name,email,password_hash) VALUES ($1,$2,$3,$4)', [
      creator,
      'Creator',
      `${creator}@karmyq.test`,
      'no-login',
    ]);
    await pool.query('UPDATE inventory.items SET created_by=$1 WHERE id=$2', [creator, communal]);
    await pool.query('DELETE FROM auth.users WHERE id=$1', [creator]);
    const res = await api(A, 'get', `/items/${communal}`);
    expect(res.status).toBe(200);
    expect(res.body.data.created_by).toBeNull();
  });
});
