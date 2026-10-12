/**
 * Sprint 133 PR S — BUG-056: GET /requests/:id is gated by real SQL (own ∨ any-status match
 * responder ∨ reachability) and the stricter directed-audience predicate still applies.
 * Real JWT/service/SQL paths; unavailable infrastructure fails, including under CI.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { createPool, ServiceUrls } from '../fixtures';

describe('Sprint 133 PR S request detail visibility (BUG-056)', () => {
  const pool = createPool();
  // R requester; O item owner (directed target); M same-community member; X other-community user;
  // H helper who completed a match and then left the community.
  const R = randomUUID(), O = randomUUID(), M = randomUUID(), X = randomUUID(), H = randomUUID();
  const C = randomUUID(), OTHER = randomUUID();
  const users = [R, O, M, X, H];
  const api = (id: string, method: 'get' | 'post' | 'put', url: string) => request(ServiceUrls.REQUEST)[method](url)
    .set('Authorization', `Bearer ${jwt.sign({ userId: id, email: `${id}@karmyq.test`, communities: [] }, process.env.JWT_SECRET || 'dev-secret-key')}`);
  let communityAsk: string, platformAsk: string, directedAsk: string;

  const insertAsk = async (scope: string) => {
    const row = (await pool.query(`INSERT INTO requests.help_requests
      (requester_id,title,description,category,request_type,visibility_scope)
      VALUES ($1,'Detail fixture','Fixture','generic','generic',$2) RETURNING id`, [R, scope])).rows[0];
    await pool.query('INSERT INTO requests.request_communities(request_id,community_id) VALUES ($1,$2)', [row.id, C]);
    return row.id as string;
  };

  beforeAll(async () => {
    await pool.query('SELECT 1'); expect((await request(ServiceUrls.REQUEST).get('/health')).status).toBe(200);
    for (const id of users) await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)', [id, 'Detail fixture', `${id}@karmyq.test`, 'not-a-login']);
    for (const id of [C, OTHER]) await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4)', [id, `Detail ${id}`, 'Fixture', R]);
    for (const id of [R, O, M, H]) await pool.query("INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'member','active')", [id, C]);
    await pool.query("INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'member','active')", [X, OTHER]);

    communityAsk = await insertAsk('community');
    platformAsk = await insertAsk('platform');

    const item = await api(O, 'post', '/requests/inventory/items').send({ name: 'Ladder', category: 'tools', condition: 'good' });
    expect(item.status).toBe(201);
    expect((await api(O, 'put', `/requests/inventory/items/${item.body.data.id}/shares`).send({ community_ids: [C] })).status).toBe(200);
    const borrow = await api(R, 'post', `/requests/inventory/items/${item.body.data.id}/borrow`)
      .send({ community_id: C, duration_days: 3, description: 'Private ask' });
    expect(borrow.status).toBe(201); directedAsk = borrow.body.data.id;
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM requests.matches WHERE request_id IN (SELECT id FROM requests.help_requests WHERE requester_id=ANY($1::uuid[]))', [users]);
      await pool.query('DELETE FROM inventory.borrow_notification_outbox WHERE request_id IN (SELECT id FROM requests.help_requests WHERE requester_id=ANY($1::uuid[]))', [users]);
      await pool.query('DELETE FROM requests.help_requests WHERE requester_id=ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM inventory.items WHERE owner_user_id=ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM notifications.notifications WHERE user_id=ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM communities.communities WHERE id=ANY($1::uuid[])', [[C, OTHER]]);
      await pool.query('DELETE FROM auth.users WHERE id=ANY($1::uuid[])', [users]);
    } finally { await pool.end(); }
  });

  it('shows a community-scope request to a same-community member and hides it from an outsider like an absent id', async () => {
    const member = await api(M, 'get', `/requests/${communityAsk}`);
    expect(member.status).toBe(200);
    expect(member.body.data).not.toHaveProperty('requester_email');

    const outsider = await api(X, 'get', `/requests/${communityAsk}`);
    const absent = await api(X, 'get', `/requests/${randomUUID()}`);
    expect(outsider.status).toBe(404);
    expect(outsider.body).toEqual(absent.body);
  });

  it('shows a platform-scope request to any authenticated user', async () => {
    const res = await api(X, 'get', `/requests/${platformAsk}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(platformAsk);
  });

  it('keeps a directed ask hidden from a reachable same-community member outside its audience', async () => {
    expect((await api(M, 'get', `/requests/${directedAsk}`)).status).toBe(404);
    expect((await api(R, 'get', `/requests/${directedAsk}`)).status).toBe(200);
    expect((await api(O, 'get', `/requests/${directedAsk}`)).status).toBe(200);
  });

  it('keeps showing a request to a completed-match helper after they leave the community', async () => {
    await pool.query("INSERT INTO requests.matches(request_id,responder_id,status,completed_at) VALUES ($1,$2,'completed',NOW())", [communityAsk, H]);
    await pool.query("UPDATE communities.members SET status='left' WHERE user_id=$1 AND community_id=$2", [H, C]);
    const res = await api(H, 'get', `/requests/${communityAsk}`);
    expect(res.status).toBe(200);
    expect(res.body.data.viewer_relation).toBe('not_actionable');
  });
});
