/**
 * Sprint 139 (BUG-097): GET /offers scopes expiry by status and ownership. Real JWT, request service over HTTP, real
 * PostgreSQL. Missing infrastructure is a failure, never a skip.
 *
 * Proofs (spec docs/superpowers/specs/2026-11-09-sprint-139-correctness-design.md, section A table):
 * - Owner / active (and the default): every own active offer is listed, flagged or elapsed or neither.
 * - Another current member / active: flagged or elapsed offers are excluded; an unexpired one (NULL expiry included)
 *   is listed. The owner bypass is the caller's OWN offers only: a member never sees someone else's expired offer,
 *   and the owner never sees a member's expired offer.
 * - Owner or member / matched, withdrawn: listed whatever the expiry (history stays visible).
 * - Pending, former and unrelated users who are not the owner: nothing, for every status (the audience is an outer AND).
 * - Boundary: the spec predicate at a fixed transaction time — expires_at equal to NOW() is expired, one second later
 *   is not (before/after controls).
 * - Visibility is not eligibility: the owner's visible expired active offer (by flag, and by clock alone) still
 *   answers POST /matches with 400 OFFER_NOT_ACTIVE, and no match or hold is written.
 *
 * Sprint 138's C case (tests/integration/sprint-138-reusable-offers.integration.test.ts) lists as a non-owner member
 * and stays unchanged; it is this file's control for the non-owner row.
 *
 * Fails before (REASONED, not run: no PostgreSQL on the Windows box; CI runs this against the fixed code). Before
 * Sprint 139 every status and every viewer had flagged/elapsed offers filtered: the owner's expired active offers,
 * and the expired matched/withdrawn rows, are missing. The non-owner, audience, boundary and hold cases are controls
 * that pass before too.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { createPool, ServiceUrls } from '../fixtures';

describe('Sprint 139 offer visibility (BUG-097)', () => {
  const pool = createPool();
  // O owns the offers; M is a current member; R asks; P is pending; F is a former member; U is unrelated.
  const O = randomUUID(), M = randomUUID(), R = randomUUID(), P = randomUUID(), F = randomUUID(), U = randomUUID();
  const users = [O, M, R, P, F, U];
  const Cm = randomUUID();
  const asks: string[] = [];
  const offers: string[] = [];
  const ids: Record<string, string> = {};

  const bearer = (id: string) => `Bearer ${jwt.sign({ userId: id, email: `${id}@karmyq.test`, communities: [] }, process.env.JWT_SECRET || 'dev-secret-key')}`;
  const list = (as: string, status?: string) =>
    request(ServiceUrls.REQUEST)
      .get(`/offers?community_id=${Cm}&limit=200${status ? `&status=${status}` : ''}`)
      .set('Authorization', bearer(as));
  /** The fixture offers a caller sees, by name, sorted. */
  async function seen(as: string, status?: string): Promise<string[]> {
    const res = await list(as, status);
    expect({ status: res.status, success: res.body.success }).toEqual({ status: 200, success: true });
    const byId = new Map(Object.entries(ids).map(([name, id]) => [id, name]));
    return res.body.data.offers.map((o: { id: string }) => byId.get(o.id)).filter(Boolean).sort();
  }

  /**
   * expires: 'future' (+30 days), 'past' (-1 day: a day's margin holds whatever the session time zone, as expires_at is
   * a timestamp without time zone), or 'none' (NULL). flagged: the hourly sweep's expired column (NULL allowed).
   */
  async function offer(name: string, owner: string, status: string, expires: 'future' | 'past' | 'none', flagged: boolean | null) {
    const id = randomUUID();
    await pool.query(`INSERT INTO requests.help_offers (id,community_id,offerer_id,title,description,category,status,expired,expires_at)
      VALUES ($1,$2,$3,$4,'Fixture','generic',$5::varchar,$6::boolean,
              CASE $7::text WHEN 'future' THEN NOW() + INTERVAL '30 days' WHEN 'past' THEN NOW() - INTERVAL '1 day' END)`,
    [id, Cm, owner, `Sprint 139 ${name}`, status, flagged, expires]);
    offers.push(id);
    ids[name] = id;
    if (expires === 'none') {
      // requests.set_offer_expires_at() (BEFORE INSERT) replaces a NULL expires_at with created_at + 60 days, so a
      // NULL expiry exists only after an UPDATE; prove it really is NULL, or the IS NULL arm is never exercised.
      await pool.query('UPDATE requests.help_offers SET expires_at = NULL WHERE id = $1', [id]);
      const { rows } = await pool.query('SELECT expires_at FROM requests.help_offers WHERE id = $1', [id]);
      expect(rows[0].expires_at).toBeNull();
    }
    return id;
  }

  beforeAll(async () => {
    await pool.query('SELECT 1');
    expect((await request(ServiceUrls.REQUEST).get('/health')).status).toBe(200);
    for (const id of users) {
      await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)',
        [id, `Sprint 139 ${id.slice(0, 8)}`, `${id}@karmyq.test`, 'not-a-login']);
    }
    await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4)',
      [Cm, `Sprint 139 ${Cm}`, 'Fixture', O]);
    const membership: Array<[string, string]> = [[O, 'active'], [M, 'active'], [R, 'active'], [P, 'pending'], [F, 'removed']];
    for (const [id, status] of membership) {
      await pool.query(`INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'member',$3)`, [id, Cm, status]);
    }

    await offer('activeLive', O, 'active', 'future', false);
    await offer('activeNullExpiry', O, 'active', 'none', null);
    await offer('activeFlagged', O, 'active', 'future', true); // only the flag says expired
    await offer('activeElapsed', O, 'active', 'past', false); // only the clock says expired
    await offer('matchedExpired', O, 'matched', 'past', true);
    await offer('matchedLive', O, 'matched', 'future', false);
    await offer('withdrawnElapsed', O, 'withdrawn', 'past', null);
    await offer('memberExpired', M, 'active', 'past', true); // M's own expired offer: O must not see it
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM requests.matches WHERE request_id = ANY($1::uuid[]) OR offer_id = ANY($2::uuid[])', [asks, offers]);
      await pool.query('DELETE FROM requests.feed_events WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM notifications.notifications WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM requests.help_offers WHERE id = ANY($1::uuid[])', [offers]);
      await pool.query('DELETE FROM requests.request_communities WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM requests.help_requests WHERE id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM communities.members WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM communities.communities WHERE id = $1', [Cm]);
      await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [users]);
    } finally {
      await pool.end();
    }
  }, 120_000);

  describe('active (the default status)', () => {
    it('the owner sees every own active offer, expired or not, and not a member\'s expired offer', async () => {
      const ownActive = ['activeElapsed', 'activeFlagged', 'activeLive', 'activeNullExpiry'];
      expect(await seen(O)).toEqual(ownActive);
      expect(await seen(O, 'active')).toEqual(ownActive);
    });

    it('another current member sees only unexpired ones (NULL expiry included), plus their own expired offer', async () => {
      expect(await seen(M)).toEqual(['activeLive', 'activeNullExpiry', 'memberExpired']);
    });
  });

  describe('non-active statuses keep their history whatever the expiry', () => {
    it.each([[O], [M]])('matched and withdrawn lists are the same for %s', async (viewer) => {
      expect(await seen(viewer, 'matched')).toEqual(['matchedExpired', 'matchedLive']);
      expect(await seen(viewer, 'withdrawn')).toEqual(['withdrawnElapsed']);
    });

    it('the status filter still narrows: matched never lists an active or withdrawn offer', async () => {
      const matched = await seen(O, 'matched');
      expect(matched.some((n) => n.startsWith('active') || n.startsWith('withdrawn'))).toBe(false);
    });
  });

  describe('outside the audience, nothing — for every status', () => {
    it.each([
      ['pending', P],
      ['former', F],
      ['unrelated', U],
    ])('%s user', async (_l, viewer) => {
      for (const status of [undefined, 'active', 'matched', 'withdrawn']) {
        expect({ status, seen: await seen(viewer, status) }).toEqual({ status, seen: [] });
      }
    });

    it('a member removed after the fact loses even the history', async () => {
      await pool.query(`UPDATE communities.members SET status = 'removed' WHERE user_id = $1 AND community_id = $2`, [M, Cm]);
      try {
        expect(await seen(M, 'matched')).toEqual([]);
        expect(await seen(M)).toEqual(['memberExpired']); // their own offer: the audience's owner arm
      } finally {
        await pool.query(`UPDATE communities.members SET status = 'active' WHERE user_id = $1 AND community_id = $2`, [M, Cm]);
      }
    });
  });

  describe('the expiry comparison at a fixed transaction time', () => {
    it('expires_at equal to NOW() is expired; one second later is not; one second earlier is', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN'); // NOW() is fixed for the whole transaction
        const { rows } = await client.query(`
          WITH fixture(name, status, offerer_id, expired, expires_at) AS (VALUES
            ('equal',  'active', $1::uuid, FALSE, NOW()::timestamp),
            ('after',  'active', $1::uuid, FALSE, (NOW() + INTERVAL '1 second')::timestamp),
            ('before', 'active', $1::uuid, FALSE, (NOW() - INTERVAL '1 second')::timestamp))
          SELECT name FROM fixture o
          WHERE (o.status <> 'active' OR o.offerer_id = $2::uuid
                 OR (o.expired IS NOT TRUE AND (o.expires_at IS NULL OR o.expires_at > NOW())))
          ORDER BY name`, [O, M]);
        expect(rows.map((r: { name: string }) => r.name)).toEqual(['after']);
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    });
  });

  describe('visible is not eligible', () => {
    async function openAsk(): Promise<string> {
      const id = randomUUID();
      await pool.query(`INSERT INTO requests.help_requests
        (id,requester_id,title,description,category,request_type,visibility_scope,status,expired,expires_at)
        VALUES ($1,$2,'Sprint 139 ask','Fixture','generic','generic','community','open',FALSE,NOW() + INTERVAL '1 day')`, [id, R]);
      await pool.query('INSERT INTO requests.request_communities(request_id,community_id) VALUES ($1,$2)', [id, Cm]);
      asks.push(id);
      return id;
    }

    it.each([['activeFlagged'], ['activeElapsed']])('the owner\'s listed %s offer cannot back a new match', async (name) => {
      expect(await seen(O)).toContain(name);
      const q = await openAsk();
      const res = await request(ServiceUrls.REQUEST).post('/matches').set('Authorization', bearer(O)).send({ request_id: q, offer_id: ids[name] });
      expect({ status: res.status, body: res.body }).toEqual({
        status: 400,
        body: { success: false, message: 'Offer is not active', error: 'OFFER_NOT_ACTIVE' },
      });
      expect((await pool.query('SELECT count(*)::int AS n FROM requests.matches WHERE request_id = $1', [q])).rows[0].n).toBe(0);
      expect((await pool.query('SELECT status FROM requests.help_offers WHERE id = $1', [ids[name]])).rows[0].status).toBe('active');
    });
  });
});
