/**
 * Sprint 133 PR V: BUG-065 (GET /requests lists exactly what GET /requests/:id would open) and BUG-064 (standing
 * offers readable by their offerer and live members of their community only; a foreign offer is indistinguishable
 * from a missing one). Community reads decide membership from communities.members, never the JWT claim.
 * Real JWT/service/SQL paths; unavailable infrastructure fails, including under CI.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { createPool, ServiceUrls } from '../fixtures';

describe('Sprint 133 PR V request and offer read boundary (BUG-065, BUG-064)', () => {
  const pool = createPool();
  // R requester (C); O item owner, the directed target (C); M member (C); S member of SISTER (linked to C);
  // X member of OTHER; H completed a match on a C ask, then left C; P pre-selected provider, member of FAR only;
  // L left C but still carries C in the JWT claim.
  const R = randomUUID(), O = randomUUID(), M = randomUUID(), S = randomUUID(), X = randomUUID(),
    H = randomUUID(), P = randomUUID(), L = randomUUID();
  const C = randomUUID(), OTHER = randomUUID(), SISTER = randomUUID(), FAR = randomUUID();
  const users = [R, O, M, S, X, H, P, L];
  const viewers: Record<string, string> = { R, O, M, S, X, H, P, L };
  const claims: Record<string, Array<{ id: string; name: string; role: string }>> = {
    [L]: [{ id: C, name: 'Boundary C', role: 'member' }],
  };
  const token = (id: string) => jwt.sign({ userId: id, email: `${id}@karmyq.test`, communities: claims[id] ?? [] },
    process.env.JWT_SECRET || 'dev-secret-key');
  const api = (id: string, method: 'get' | 'post' | 'put' | 'delete', url: string) =>
    request(ServiceUrls.REQUEST)[method](url).set('Authorization', `Bearer ${token(id)}`);

  const asks: Record<string, string> = {};
  let offerId: string;

  const insertAsk = async (scope: string, extra: { expired?: boolean; preferredProviderId?: string } = {}) => {
    const row = (await pool.query(`INSERT INTO requests.help_requests
      (requester_id,title,description,category,request_type,visibility_scope,expired,preferred_provider_id)
      VALUES ($1,'Boundary fixture','Fixture','generic','generic',$2,$3,$4) RETURNING id`,
    [R, scope, extra.expired ?? false, extra.preferredProviderId ?? null])).rows[0];
    await pool.query('INSERT INTO requests.request_communities(request_id,community_id) VALUES ($1,$2)', [row.id, C]);
    return row.id as string;
  };
  const listIds = async (viewer: string, qs: string) => {
    const res = await api(viewer, 'get', `/requests?${qs}`);
    expect(res.status).toBe(200);
    return new Set<string>(res.body.data.requests.map((r: { id: string }) => r.id));
  };

  beforeAll(async () => {
    await pool.query('SELECT 1'); expect((await request(ServiceUrls.REQUEST).get('/health')).status).toBe(200);
    for (const id of users) await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)', [id, 'Boundary fixture', `${id}@karmyq.test`, 'not-a-login']);
    for (const id of [C, OTHER, SISTER, FAR]) await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4)', [id, `Boundary ${id}`, 'Fixture', R]);
    const join = (user: string, community: string) => pool.query(
      "INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'member','active')", [user, community]);
    for (const id of [R, O, M, H, L]) await join(id, C);
    await join(S, SISTER); await join(X, OTHER); await join(P, FAR);
    await pool.query(`INSERT INTO communities.community_links(community_a_id,community_b_id,link_type,show_in_sister_feeds,status)
      VALUES ($1,$2,'sister',TRUE,'active')`, [C, SISTER]);
    const provider = (await pool.query(`INSERT INTO requests.provider_profiles(user_id,service_type,display_name)
      VALUES ($1,'generic','Boundary provider') RETURNING id`, [P])).rows[0].id;

    asks.community = await insertAsk('community');
    asks.trust = await insertAsk('trust_network');
    asks.platform = await insertAsk('platform');
    asks.expired = await insertAsk('community', { expired: true });
    asks.engaged = await insertAsk('community');
    asks.preferred = await insertAsk('community', { preferredProviderId: provider });
    asks.helped = await insertAsk('community');

    const item = await api(O, 'post', '/requests/inventory/items').send({ name: 'Ladder', category: 'tools', condition: 'good' });
    expect(item.status).toBe(201);
    expect((await api(O, 'put', `/requests/inventory/items/${item.body.data.id}/shares`).send({ community_ids: [C] })).status).toBe(200);
    const borrow = await api(R, 'post', `/requests/inventory/items/${item.body.data.id}/borrow`)
      .send({ community_id: C, duration_days: 3, description: 'Private ask' });
    expect(borrow.status).toBe(201); asks.directed = borrow.body.data.id;

    await pool.query("INSERT INTO requests.matches(request_id,responder_id,status) VALUES ($1,$2,'proposed')", [asks.engaged, M]);
    await pool.query("INSERT INTO requests.matches(request_id,responder_id,status,completed_at) VALUES ($1,$2,'completed',NOW())", [asks.helped, H]);
    await pool.query("UPDATE communities.members SET status='left' WHERE user_id=ANY($1::uuid[]) AND community_id=$2", [[H, L], C]);

    offerId = (await pool.query(`INSERT INTO requests.help_offers(community_id,offerer_id,title,description,category,status)
      VALUES ($1,$2,'Boundary offer','Fixture','generic','active') RETURNING id`, [C, M])).rows[0].id;
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM requests.matches WHERE request_id IN (SELECT id FROM requests.help_requests WHERE requester_id=ANY($1::uuid[])) OR responder_id=ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM inventory.borrow_notification_outbox WHERE request_id IN (SELECT id FROM requests.help_requests WHERE requester_id=ANY($1::uuid[]))', [users]);
      await pool.query('DELETE FROM requests.help_offers WHERE offerer_id=ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM requests.help_requests WHERE requester_id=ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM inventory.items WHERE owner_user_id=ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM requests.provider_profiles WHERE user_id=ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM notifications.notifications WHERE user_id=ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM communities.community_links WHERE community_a_id=ANY($1::uuid[]) OR community_b_id=ANY($1::uuid[])', [[C, OTHER, SISTER, FAR]]);
      await pool.query('DELETE FROM communities.communities WHERE id=ANY($1::uuid[])', [[C, OTHER, SISTER, FAR]]);
      await pool.query('DELETE FROM auth.users WHERE id=ANY($1::uuid[])', [users]);
    } finally { await pool.end(); }
  });

  // The list legitimately differs from the detail route in exactly these three ways (plan Critical Note 4).
  const exception = (viewer: string, ask: string): string | null =>
    ask === 'expired' ? 'list drops expired rows'
      : ask === 'directed' ? 'browse never lists directed asks'
        : ask === 'engaged' && viewer === 'M' ? "BUG-002: the viewer's own live proposed match"
          : null;

  it('lists exactly the asks each viewer could open, except the named exceptions (by identity)', async () => {
    const mismatches: string[] = [];
    let inside = 0, outside = 0;
    for (const [vName, viewer] of Object.entries(viewers)) {
      const listed = await listIds(viewer, `community_id=${C}&limit=200`);
      for (const [aName, ask] of Object.entries(asks)) {
        const detail = (await api(viewer, 'get', `/requests/${ask}`)).status;
        const expected = detail === 200 && exception(vName, aName) === null;
        if (detail === 200) inside++; else outside++;
        if (listed.has(ask) !== expected) mismatches.push(`${vName}/${aName}: detail=${detail} listed=${listed.has(ask)}`);
      }
    }
    expect(mismatches).toEqual([]);
    // The matrix must exercise both sides of the boundary, or parity proves nothing.
    expect(inside).toBeGreaterThan(0);
    expect(outside).toBeGreaterThan(0);
  });

  it('omits a community ask from an outsider list (BUG-065) but shows it to a sister-community member', async () => {
    const outsider = await listIds(X, `community_id=${C}&limit=200`);
    expect(outsider.has(asks.community)).toBe(false);
    expect([...outsider].sort()).toEqual([asks.trust, asks.platform].sort());
    expect((await listIds(S, `community_id=${C}&limit=200`)).has(asks.community)).toBe(true);
  });

  it('keeps the asks a departed helper and a pre-selected provider are entitled to, and nothing else community-scoped', async () => {
    const helper = await listIds(H, `community_id=${C}&limit=200`);
    expect(helper.has(asks.helped)).toBe(true);
    expect(helper.has(asks.community)).toBe(false);
    const provider = await listIds(P, `community_id=${C}&limit=200`);
    expect(provider.has(asks.preferred)).toBe(true);
    expect(provider.has(asks.community)).toBe(false);
  });

  it('drops every community-scope ask for a member who left, whatever their token still claims', async () => {
    const left = await listIds(L, `community_id=${C}&limit=200`);
    for (const name of ['community', 'engaged', 'preferred', 'helped']) expect(left.has(asks[name])).toBe(false);
  });

  it('gates a spoofed requester_id filter: an outsider sees only the requester asks they could open', async () => {
    const spoofed = await listIds(X, `requester_id=${R}&limit=200`);
    expect([...spoofed].sort()).toEqual([asks.trust, asks.platform].sort());
  });

  it('decides community reads from live membership, not the JWT claim', async () => {
    const routes = [
      `/requests/community/${C}/pulse`,
      `/requests/community/${C}/open-asks`,
      `/requests/curated?view=community&community_id=${C}`,
      `/requests/retention-policy?communityId=${C}`,
    ];
    for (const url of routes) {
      const stale = await api(L, 'get', url);
      expect({ url, status: stale.status, error: stale.body.error }).toEqual({ url, status: 403, error: 'NOT_A_MEMBER' });
      // M's token claims no community at all: only the live row admits them.
      expect({ url, status: (await api(M, 'get', url)).status }).toEqual({ url, status: 200 });
    }
  });

  it('shows a standing offer to its community members and hides it from an outsider like an absent id', async () => {
    for (const viewer of [M, R]) {
      const list = await api(viewer, 'get', '/offers');
      expect(list.status).toBe(200);
      expect(list.body.data.offers.map((o: { id: string }) => o.id)).toContain(offerId);
      expect((await api(viewer, 'get', `/offers/${offerId}`)).status).toBe(200);
    }
    const outsiderList = await api(X, 'get', '/offers');
    expect(outsiderList.body.data.offers.map((o: { id: string }) => o.id)).not.toContain(offerId);
    const narrowed = await api(X, 'get', `/offers?community_id=${C}`);
    expect(narrowed.status).toBe(200);
    expect(narrowed.body.data.offers).toEqual([]);
    const foreign = await api(X, 'get', `/offers/${offerId}`);
    const absent = await api(X, 'get', `/offers/${randomUUID()}`);
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual(absent.body);
  });

  it('answers a foreign offer exactly like a missing one on every write route', async () => {
    const missing = randomUUID();
    const pairs: Array<[string, (id: string) => request.Test]> = [
      ['PUT /offers/:id', (id) => api(X, 'put', `/offers/${id}`).send({ title: 'Hijack' })],
      ['DELETE /offers/:id', (id) => api(X, 'delete', `/offers/${id}`)],
      ['PUT /offers/:id/privacy', (id) => api(X, 'put', `/offers/${id}/privacy`).send({ is_public: true })],
      ['POST /matches', (id) => api(X, 'post', '/matches').send({ request_id: asks.platform, offer_id: id })],
    ];
    for (const [route, call] of pairs) {
      const foreign = await call(offerId);
      const absent = await call(missing);
      expect({ route, status: foreign.status, body: foreign.body }).toEqual({ route, status: absent.status, body: absent.body });
      expect({ route, status: foreign.status }).toEqual({ route, status: 404 });
    }
    const offer = (await pool.query('SELECT title, status, is_public FROM requests.help_offers WHERE id=$1', [offerId])).rows[0];
    expect(offer).toEqual({ title: 'Boundary offer', status: 'active', is_public: false });
    expect((await pool.query('SELECT 1 FROM requests.matches WHERE responder_id=$1', [X])).rowCount).toBe(0);
  });

  it('keeps an offer visible to its author after they leave the community', async () => {
    await pool.query("UPDATE communities.members SET status='left' WHERE user_id=$1 AND community_id=$2", [M, C]);
    const list = await api(M, 'get', '/offers');
    expect(list.body.data.offers.map((o: { id: string }) => o.id)).toContain(offerId);
    expect((await api(M, 'get', `/offers/${offerId}`)).status).toBe(200);
  });
});
