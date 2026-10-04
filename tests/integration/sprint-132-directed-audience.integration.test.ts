/** Real JWT/service/SQL/queue paths; unavailable infrastructure fails, including under CI. */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { createPool, ServiceUrls } from '../fixtures';
describe('Sprint 132 PR C directed borrow audience', () => {
  const pool = createPool();
  const R = randomUUID(), O = randomUUID(), M = randomUUID(), A = randomUUID();
  const C = randomUUID(), OTHER = randomUUID();
  const users = [R, O, M, A];
  const claims = [{ id: C, name: 'Directed fixture', role: 'member' }];
  const api = (id: string, method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string) => request(ServiceUrls.REQUEST)[method](url)
    .set('Authorization', `Bearer ${jwt.sign({ userId: id, email: `${id}@karmyq.test`, communities: claims.map(c => ({ ...c, role: id === A ? 'admin' : c.role })) }, process.env.JWT_SECRET || 'dev-secret-key')}`);
  let item: string, ask: string;
  const borrow = (id: string, selected = C) => api(R, 'post', `/requests/inventory/items/${id}/borrow`).send({ community_id: selected, duration_days: 3, description: 'Private painting job' });
  beforeAll(async () => {
    await pool.query('SELECT 1'); expect((await request(ServiceUrls.REQUEST).get('/health')).status).toBe(200);
    for (const id of users) await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)', [id, id === O ? 'Olivia' : 'Riley', `${id}@karmyq.test`, 'not-a-login']);
    for (const id of [C, OTHER]) await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4)', [id, `Directed ${id}`, 'Fixture', A]);
    for (const id of users) await pool.query("INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,$3,'active')", [id, C, id === A ? 'admin' : 'member']);
    await pool.query("INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'member','active')", [R, OTHER]);
  });
  beforeEach(async () => {
    await pool.query('DELETE FROM requests.matches WHERE request_id IN (SELECT id FROM requests.help_requests WHERE requester_id=ANY($1::uuid[]))', [users]);
    await pool.query('DELETE FROM requests.help_requests WHERE requester_id=ANY($1::uuid[])', [users]);
    await pool.query('DELETE FROM inventory.items WHERE owner_user_id=ANY($1::uuid[]) OR owner_community_id=$2', [users, C]);
    await pool.query("UPDATE communities.members SET status='active',role=CASE WHEN user_id=$1 THEN 'admin' ELSE 'member' END WHERE community_id=$2", [A, C]);
    const created = await api(O, 'post', '/requests/inventory/items').send({ name: 'Ladder', category: 'tools', condition: 'good' });
    expect(created.status).toBe(201); item = created.body.data.id;
    expect((await api(O, 'put', `/requests/inventory/items/${item}/shares`).send({ community_ids: [C] })).status).toBe(200);
    const res = await borrow(item); expect(res.status).toBe(201); ask = res.body.data.id;
  });
  afterAll(async () => {
    try {
      await pool.query('DELETE FROM requests.matches WHERE request_id IN (SELECT id FROM requests.help_requests WHERE requester_id=ANY($1::uuid[]))', [users]);
      await pool.query('DELETE FROM requests.help_requests WHERE requester_id=ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM inventory.items WHERE owner_user_id=ANY($1::uuid[]) OR owner_community_id=$2', [users, C]);
      await pool.query('DELETE FROM reputation.karma_records WHERE user_id=ANY($1::uuid[]) AND community_id=ANY($2::uuid[])', [users, [C, OTHER]]);
      await pool.query('DELETE FROM reputation.trust_scores WHERE user_id=ANY($1::uuid[]) AND community_id=ANY($2::uuid[])', [users, [C, OTHER]]);
      await pool.query('DELETE FROM communities.communities WHERE id=ANY($1::uuid[])', [[C, OTHER]]);
      await pool.query('DELETE FROM auth.users WHERE id=ANY($1::uuid[])', [users]);
    } finally { await pool.end(); }
  });
  const ownIds = async (userId: string, suffix = '') => (await api(userId, 'get', `/requests${suffix}`)).body.data.requests.map((r: any) => r.id);
  const incomingIds = async (userId: string) => {
    const res = await api(userId, 'get', '/requests/inventory/asks/incoming'); expect(res.status).toBe(200);
    return res.body.data.asks.map((r: any) => r.id);
  };
  it('persists exact directed flags/targets/payload and single attribution community', async () => {
    const row = (await pool.query('SELECT * FROM requests.help_requests WHERE id=$1', [ask])).rows[0];
    expect(row).toMatchObject({ is_directed: true, directed_to_user_id: O, directed_to_community_id: null, inventory_item_id: item, request_type: 'borrow', category: 'borrow', payload: { item_category: 'tools', duration_days: 3, condition_min: 'good' } });
    expect((await pool.query('SELECT community_id FROM requests.request_communities WHERE request_id=$1', [ask])).rows.map((r) => r.community_id)).toEqual([C]);
  });
  it.each(['feed', 'curated', `community/${C}/open-asks`, 'matched/for-user'])('excludes ask from %s for requester, recipient and third member', async (surface) => {
    for (const userId of [R, O, M]) {
      const res = await api(userId, 'get', `/requests/${surface}`); expect(res.status).toBe(200);
      const data = res.body.data; const rows = Array.isArray(data) ? data : data.items ?? data.requests ?? [];
      expect(rows.map((r: any) => r.id ?? r.request_id ?? r.data?.request_id)).not.toContain(ask);
      expect(JSON.stringify(data)).not.toContain('Private painting job');
      expect(JSON.stringify(data)).not.toContain(ask);
    }
  });
  it('admits own directed asks only with caller-equal requester_id', async () => {
    expect(await ownIds(R, `?requester_id=${R}`)).toEqual([ask]);
    expect(await ownIds(R)).not.toContain(ask);
    expect(await ownIds(M, `?requester_id=${R}`)).toEqual([]);
    expect(await ownIds(R, `?requester_id=${O}`)).toEqual([]);
  });
  it('allows R/O detail and hides it from M/A before content is returned', async () => {
    for (const id of [R, O]) {
      const res = await api(id, 'get', `/requests/${ask}`); expect(res.status).toBe(200);
      expect(res.body.data.directed_to).toEqual({ kind: 'user', id: O, name: 'Olivia' });
      expect(res.body.data.is_directed).toBe(true);
    }
    for (const id of [M, A]) {
      const res = await api(id, 'get', `/requests/${ask}`); expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain('Private painting job');
      expect((await api(id, 'get', `/requests/${ask}/relationship-context`)).status).toBe(404);
    }
  });
  it('returns incoming only to O, then moves it to O\'s participant matches after offering', async () => {
    expect(await incomingIds(O)).toEqual([ask]); expect(await incomingIds(R)).toEqual([]); expect(await incomingIds(M)).toEqual([]);
    const rejected = await api(M, 'post', '/matches').send({ request_id: ask });
    expect(rejected.status).toBe(403); expect(rejected.body.error).toBe('NOT_IN_AUDIENCE');
    const offer = await api(O, 'post', '/matches').send({ request_id: ask }); expect(offer.status).toBe(201);
    const matchId = offer.body.data.id;
    expect(await incomingIds(O)).toEqual([]);
    expect((await api(O, 'get', '/matches')).body.data.matches.map((m: any) => m.id)).toEqual([matchId]);
    expect((await api(M, 'get', `/matches?user_id=${O}`)).body.data.matches.map((m: any) => m.id)).toEqual([]);
    expect((await api(M, 'get', `/matches/${matchId}`)).status).toBe(404);
  });
  it('fails closed when personal target is cleared while preserving requester detail', async () => {
    await pool.query('UPDATE requests.help_requests SET directed_to_user_id=NULL WHERE id=$1', [ask]);
    expect((await api(R, 'get', `/requests/${ask}`)).status).toBe(200);
    for (const id of [O, M, A]) expect((await api(id, 'get', `/requests/${ask}`)).status).toBe(404);
    expect(await incomingIds(O)).toEqual([]);
  });
  it('uses current active admins for community asks, including after demotion or target deletion', async () => {
    const created = await api(A, 'post', '/requests/inventory/items').send({ name: 'Tent', category: 'camping', owner_community_id: C }); expect(created.status).toBe(201);
    const res = await borrow(created.body.data.id); expect(res.status).toBe(201); const communal = res.body.data.id;
    expect((await api(A, 'get', `/requests/${communal}`)).status).toBe(200);
    expect(await incomingIds(A)).toEqual([communal]); expect(await incomingIds(M)).toEqual([]);
    expect((await api(M, 'get', `/requests/${communal}`)).status).toBe(404);
    await pool.query("UPDATE communities.members SET role='member' WHERE user_id=$1 AND community_id=$2", [A, C]);
    expect((await api(A, 'get', `/requests/${communal}`)).status).toBe(404); expect(await incomingIds(A)).toEqual([]);
    await pool.query('UPDATE requests.help_requests SET directed_to_community_id=NULL WHERE id=$1', [communal]);
    expect((await api(R, 'get', `/requests/${communal}`)).status).toBe(200);
    expect((await api(M, 'get', `/requests/${communal}`)).status).toBe(404);
  });
  it('rejects a community unrelated to the item even when R is an active member there', async () => {
    expect((await borrow(item, OTHER)).status).toBe(404);
    await pool.query("UPDATE communities.members SET status='left' WHERE user_id=$1 AND community_id=$2", [O, C]);
    expect((await borrow(item)).status).toBe(404);
  });
  it('rolls back the directed row when its attribution junction fails', async () => {
    const before = (await pool.query('SELECT id FROM requests.help_requests WHERE requester_id=$1 ORDER BY id', [R])).rows;
    const suffix = R.replace(/-/g, '');
    const fn = `requests.reject_directed_${suffix}`, trigger = `reject_directed_${suffix}`;
    try {
      await pool.query(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF EXISTS (SELECT 1 FROM requests.help_requests WHERE id=NEW.request_id AND requester_id='${R}' AND is_directed)
        THEN RAISE EXCEPTION 'injected directed attribution failure'; END IF; RETURN NEW; END $$`);
      await pool.query(`CREATE TRIGGER ${trigger} BEFORE INSERT ON requests.request_communities FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
      expect((await borrow(item)).status).toBe(500);
      expect((await pool.query('SELECT id FROM requests.help_requests WHERE requester_id=$1 ORDER BY id', [R])).rows).toEqual(before);
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${trigger} ON requests.request_communities`);
      await pool.query(`DROP FUNCTION IF EXISTS ${fn}()`);
    }
  });
  it('removes expired/cancelled incoming asks without opening browse visibility', async () => {
    await pool.query("UPDATE requests.help_requests SET expired=true WHERE id=$1", [ask]); expect(await incomingIds(O)).toEqual([]);
    await pool.query("UPDATE requests.help_requests SET expired=false,status='cancelled' WHERE id=$1", [ask]); expect(await incomingIds(O)).toEqual([]);
  });
  it('blocks community admin actions and dibs on a directed ask', async () => {
    for (const path of ['boost', 'propose-match']) expect((await api(A, 'post', `/requests/${ask}/${path}`).send({ user_id: O })).status).toBe(404);
    expect((await api(R, 'get', `/requests/${ask}/dibs-candidate`)).status).toBe(404);
    expect((await api(A, 'patch', `/requests/${ask}/admin-triage`).send({ community_id: C, urgency: 'high', note: 'Private triage' })).status).toBe(404);
  });
  it('retains the normal two-party completion and real karma projection', async () => {
    const offer = await api(O, 'post', '/matches').send({ request_id: ask }); expect(offer.status).toBe(201); const matchId = offer.body.data.id;
    expect((await api(R, 'put', `/matches/${matchId}/accept`).send({})).status).toBe(200);
    expect((await api(O, 'put', `/matches/${matchId}/complete`).send({})).status).toBe(200);
    expect((await api(R, 'put', `/matches/${matchId}/complete`).send({})).status).toBe(200);
    let records: any[] = [];
    for (let retry = 0; retry < 40; retry++) {
      records = (await pool.query('SELECT user_id,community_id,reason,points FROM reputation.karma_records WHERE related_entity_id=$1', [matchId])).rows;
      if (records.length >= 3) break; await new Promise((resolve) => setTimeout(resolve, 250));
    }
    // Fresh helper, one community, canonical 100-point pool with default 60/40 split.
    expect(records).toHaveLength(3);
    expect(records).toEqual(expect.arrayContaining([
      { user_id: O, community_id: C, reason: 'Provided help', points: 60 },
      { user_id: R, community_id: C, reason: 'Received help', points: 40 },
      { user_id: O, community_id: C, reason: 'First help in community', points: 15 },
    ]));
    expect((await pool.query('SELECT status FROM requests.matches WHERE id=$1', [matchId])).rows[0].status).toBe('completed');
  });
});
