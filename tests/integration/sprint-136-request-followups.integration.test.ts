/**
 * Sprint 136 (BUG-085, BUG-084): an expired ask takes no new commitment, and POST /matches writes its proposal under the
 * request lock. Real JWT, request service over HTTP, real PostgreSQL. Missing infrastructure is a failure, never a skip.
 *
 * Proofs:
 * - Expired refusals. For each of the five writers that start a commitment, an ask the sweep flagged (expired = TRUE)
 *   and an ask past expires_at that it has not flagged yet are both refused with REQUEST_NOT_OPEN, writing nothing.
 *   POST /matches answers the flagged ask from its unchanged fast path (400); every other case reaches the lock (409).
 *   Each writer still succeeds on an unexpired twin, and cancel and reject still close an expired ask.
 * - The POST /matches race. While a second client holds an uncommitted cancel of the ask, POST /matches waits on the
 *   request lock (pg_blocking_pids, never a sleep), then answers 409 and writes no proposal. Against b9682c34 it fails:
 *   that POST takes no request lock, so it never waits (the cancel's row lock does not block its foreign-key check) and
 *   strands a proposal on a cancelled ask.
 * - The offer guard race. Two POST /matches with the same offer on two open asks both wait on a held offer row. After the
 *   holder commits, exactly one wins and the other answers 400 OFFER_NOT_ACTIVE. Against b9682c34 it fails: both wait at
 *   the match INSERT's foreign-key check (matches_offer_id_fkey), then both write, so two proposals hold one offer.
 * The b9682c34 claims are reasoned from PostgreSQL's row-lock conflict table, not run (no local PostgreSQL on the
 * planning box); CI runs this file against the fixed code.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import Queue from 'bull';
import { randomUUID } from 'crypto';
import { createPool, ServiceUrls } from '../fixtures';

describe('Sprint 136 request follow-ups', () => {
  const pool = createPool();
  // R requester; H, H2 helpers; A community admin; P provider. All active members of Cm.
  const R = randomUUID(), H = randomUUID(), H2 = randomUUID(), A = randomUUID(), P = randomUUID();
  const users = [R, H, H2, A, P];
  const Cm = randomUUID();
  let providerProfile = '';
  const asks: string[] = [];
  const offers: string[] = [];
  const redis = process.env.REDIS_URL || 'redis://localhost:6380';
  const communityEvolution = new Queue('karmyq-community-evolution', redis);

  const bearer = (id: string) => `Bearer ${jwt.sign({ userId: id, email: `${id}@karmyq.test`, communities: [] }, process.env.JWT_SECRET || 'dev-secret-key')}`;
  // `.then` starts the request, so a race case can hold it in flight.
  const call = (method: 'put' | 'post' | 'delete', path: string, as: string, body: object = {}) =>
    request(ServiceUrls.REQUEST)[method](path).set('Authorization', bearer(as)).send(body).then((res) => res);
  const offerHelp = (q: string, offerId?: string, as = H) => call('post', '/matches', as, offerId ? { request_id: q, offer_id: offerId } : { request_id: q });
  const accept = (m: string) => call('put', `/matches/${m}/accept`, R);
  const reject = (m: string) => call('put', `/matches/${m}/reject`, H);
  const propose = (q: string) => call('post', `/requests/${q}/propose-match`, A, { user_id: H });
  const sendDibs = (q: string) => call('post', `/requests/${q}/dibs`, R, { provider_user_id: H });
  const acceptProviderOffer = (o: string) => call('put', `/requests/offers/${o}/accept`, R);
  const cancelAsk = (q: string) => call('delete', `/requests/${q}`, R);

  type Expiry = 'flagged' | 'past' | 'future';
  /**
   * An open ask. 'flagged' is what the sweep leaves (expired = TRUE, expires_at past); 'past' is the hour before the sweep
   * runs (expired = FALSE, expires_at past); 'future' is the unexpired twin. Status parameters are cast to varchar.
   */
  async function ask(expiry: Expiry, status = 'open'): Promise<string> {
    const id = randomUUID();
    await pool.query(`INSERT INTO requests.help_requests
      (id,requester_id,title,description,category,request_type,visibility_scope,status,expired,expires_at)
      VALUES ($1,$2,'Sprint 136 ask','Fixture','generic','generic','community',$3::varchar,$4::boolean,
              CASE WHEN $5::text = 'future' THEN NOW() + INTERVAL '1 day' ELSE NOW() - INTERVAL '1 hour' END)`,
    [id, R, status, expiry === 'flagged', expiry]);
    await pool.query('INSERT INTO requests.request_communities(request_id,community_id) VALUES ($1,$2)', [id, Cm]);
    asks.push(id);
    return id;
  }
  async function offer(owner: string, status: string): Promise<string> {
    const id = randomUUID();
    await pool.query(`INSERT INTO requests.help_offers (id,community_id,offerer_id,title,description,category,status)
      VALUES ($1,$2,$3,'Sprint 136 offer','Fixture','generic',$4::varchar)`, [id, Cm, owner, status]);
    offers.push(id);
    return id;
  }
  async function match(requestId: string, responder: string, status: string, offerId: string | null = null): Promise<string> {
    const { rows } = await pool.query(`INSERT INTO requests.matches (request_id,responder_id,offer_id,status,completed_at)
      VALUES ($1,$2,$3,$4::varchar,CASE WHEN $4::varchar = 'completed' THEN CURRENT_TIMESTAMP END) RETURNING id`,
    [requestId, responder, offerId, status]);
    return rows[0].id;
  }
  async function providerOffer(requestId: string): Promise<string> {
    const { rows } = await pool.query(`INSERT INTO provider.offers (provider_id,provider_user_id,request_id,price,note)
      VALUES ($1,$2,$3,10,'Sprint 136 provider offer') RETURNING id`, [providerProfile, P, requestId]);
    return rows[0].id;
  }
  const one = async (sql: string, id: string) => (await pool.query(sql, [id])).rows[0];
  const askStatus = async (id: string) => (await one('SELECT status FROM requests.help_requests WHERE id = $1', id)).status;
  const offerStatus = async (id: string) => (await one('SELECT status FROM requests.help_offers WHERE id = $1', id)).status;
  /** Everything a commitment writer could write for an ask: its matches, dibs and provider offers, plus one help offer. */
  async function footprint(requestId: string, helpOfferId?: string) {
    const q = (sql: string) => pool.query(sql, [requestId]).then((r) => r.rows);
    return {
      matches: await q('SELECT id, responder_id, status, offer_id FROM requests.matches WHERE request_id = $1 ORDER BY id'),
      dibs: await q('SELECT id, status FROM requests.dibs WHERE request_id = $1 ORDER BY id'),
      providerOffers: await q('SELECT id, status FROM provider.offers WHERE request_id = $1 ORDER BY id'),
      helpOffer: helpOfferId ? await offerStatus(helpOfferId) : null,
      ask: await one('SELECT status, expired FROM requests.help_requests WHERE id = $1', requestId),
    };
  }

  /** Waiters on the holder: blocked by it directly, or blocked by a pid it blocks (the tuple-lock queue, note 14). */
  async function waitersOn(holderPid: number): Promise<number> {
    const { rows } = await pool.query(
      `WITH w AS (SELECT DISTINCT l.pid, pg_blocking_pids(l.pid) AS blockers FROM pg_locks l WHERE NOT l.granted)
       SELECT count(*)::int AS n FROM w
       WHERE $1::int = ANY(w.blockers)
          OR EXISTS (SELECT 1 FROM w w2 WHERE w2.pid = ANY(w.blockers) AND $1::int = ANY(w2.blockers))`, [holderPid]);
    return rows[0].n;
  }

  /**
   * Holds `holderSql` on one row in an open transaction, starts every pending call, proves `expectWaiters` of them wait
   * on that row (pg_locks, polled against a deadline, never a fixed sleep), then commits and returns the responses.
   */
  async function whileHeld(holderSql: string, rowId: string, pending: Array<() => Promise<request.Response>>, expectWaiters = pending.length) {
    const holder = await pool.connect();
    try {
      await holder.query('BEGIN');
      const { pid } = (await holder.query('SELECT pg_backend_pid() AS pid')).rows[0];
      await holder.query(holderSql, [rowId]);
      const inFlight = pending.map((p) => p());
      inFlight.forEach((f) => f.catch(() => undefined)); // a late rejection must not outlive a failed wait proof
      let waiting = 0;
      for (const deadline = Date.now() + 10_000; waiting < expectWaiters && Date.now() < deadline;) {
        waiting = await waitersOn(pid);
        if (waiting < expectWaiters) await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(waiting).toBe(expectWaiters);
      await holder.query('COMMIT');
      return await Promise.all(inFlight);
    } catch (err) {
      await holder.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      holder.release();
    }
  }

  beforeAll(async () => {
    await pool.query('SELECT 1');
    expect((await request(ServiceUrls.REQUEST).get('/health')).status).toBe(200);
    for (const id of users) {
      await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)',
        [id, `Sprint 136 ${id.slice(0, 8)}`, `${id}@karmyq.test`, 'not-a-login']);
    }
    await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4)',
      [Cm, `Sprint 136 ${Cm}`, 'Fixture', R]);
    for (const id of users) {
      await pool.query(`INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,$3::varchar,'active')`,
        [id, Cm, id === A ? 'admin' : 'member']);
    }
    providerProfile = (await pool.query(`INSERT INTO requests.provider_profiles (user_id,service_type,display_name)
      VALUES ($1,'generic','Sprint 136 provider') RETURNING id`, [P])).rows[0].id;
    // One completed exchange between R and H makes H an eligible mutual-aid dibs nominee.
    await match(await ask('future', 'completed'), H, 'completed');
  });

  afterAll(async () => {
    try {
      await (await communityEvolution.getJob(Cm))?.remove().catch(() => undefined);
      await pool.query('DELETE FROM requests.dibs WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM provider.offers WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM requests.matches WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM requests.feed_events WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM notifications.notifications WHERE user_id = ANY($1::uuid[])', [users]);
      // karma_records.community_id has no ON DELETE CASCADE: clear it before the community.
      await pool.query('DELETE FROM reputation.karma_records WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM reputation.trust_scores WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM social_graph.trust_edges WHERE user_id_a = ANY($1::uuid[]) OR user_id_b = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM requests.help_offers WHERE id = ANY($1::uuid[])', [offers]);
      await pool.query('DELETE FROM requests.request_communities WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM requests.help_requests WHERE id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM communities.members WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM communities.communities WHERE id = $1', [Cm]);
      // Cascades provider_profiles, badges, notifications and the rest keyed on the user.
      await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [users]);
    } finally {
      await communityEvolution.close();
      await pool.end();
    }
  }, 90_000);

  describe('an expired ask takes no new commitment (BUG-085)', () => {
    const NOT_OPEN = { success: false, message: 'This request is no longer open', error: 'REQUEST_NOT_OPEN' };

    describe('POST /matches (a member offers to help)', () => {
      it('refuses an ask the sweep flagged from its fast path: 400, writing nothing', async () => {
        const q = await ask('flagged');
        const o = await offer(H, 'active');
        const before = await footprint(q, o);
        const res = await offerHelp(q, o);
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ success: false, message: 'Request is not open', error: 'REQUEST_NOT_OPEN' });
        expect(await footprint(q, o)).toEqual(before);
      });

      // Fails against b9682c34, which accepts it: its reachability read sees only the flag.
      it('refuses an ask past expires_at that the sweep has not flagged, at the lock: 409, writing nothing', async () => {
        const q = await ask('past');
        const o = await offer(H, 'active');
        const before = await footprint(q, o);
        const res = await offerHelp(q, o);
        expect(res.status).toBe(409);
        expect(res.body).toEqual({ success: false, message: 'Request is not open', error: 'REQUEST_NOT_OPEN' });
        expect(await footprint(q, o)).toEqual(before);
      });

      it('offers on the unexpired twin (positive control)', async () => {
        const q = await ask('future');
        const o = await offer(H, 'active');
        const res = await offerHelp(q, o);
        expect(res.status).toBe(201);
        expect((await footprint(q, o)).matches).toEqual([{ id: res.body.data.id, responder_id: H, status: 'proposed', offer_id: o }]);
        expect(await offerStatus(o)).toBe('matched');
      });
    });

    describe.each<[string, Expiry]>([['flagged', 'flagged'], ['past expires_at, not flagged', 'past']])('an ask %s', (_label, expiry) => {
      it('admin propose-match answers 409 REQUEST_NOT_OPEN and writes nothing', async () => {
        const q = await ask(expiry);
        const before = await footprint(q);
        const res = await propose(q);
        expect(res.status).toBe(409);
        expect(res.body).toEqual(NOT_OPEN);
        expect(await footprint(q)).toEqual(before);
      });

      it('match accept answers 409 REQUEST_NOT_OPEN and writes nothing', async () => {
        const q = await ask(expiry);
        const o = await offer(H, 'matched');
        const m = await match(q, H, 'proposed', o);
        const before = await footprint(q, o);
        const res = await accept(m);
        expect(res.status).toBe(409);
        expect(res.body).toEqual(NOT_OPEN);
        expect(await footprint(q, o)).toEqual(before);
      });

      it('dibs create answers 409 REQUEST_NOT_OPEN and writes nothing', async () => {
        const q = await ask(expiry);
        const before = await footprint(q);
        const res = await sendDibs(q);
        expect(res.status).toBe(409);
        expect(res.body).toEqual({ success: false, message: 'Request is not available for dibs', error: 'REQUEST_NOT_OPEN' });
        expect(await footprint(q)).toEqual(before);
      });

      it('provider-offer accept answers 409 REQUEST_NOT_OPEN and writes nothing', async () => {
        const q = await ask(expiry);
        await providerOffer(q);
        const before = await footprint(q);
        const res = await acceptProviderOffer(before.providerOffers[0].id);
        expect(res.status).toBe(409);
        expect(res.body).toEqual(NOT_OPEN);
        expect(await footprint(q)).toEqual(before);
      });

      it('the requester can still cancel it', async () => {
        const q = await ask(expiry);
        const res = await cancelAsk(q);
        expect(res.status).toBe(200);
        expect(await askStatus(q)).toBe('cancelled');
      });

      it('a helper can still withdraw a proposal on it (match reject)', async () => {
        const q = await ask(expiry);
        const o = await offer(H, 'matched');
        const m = await match(q, H, 'proposed', o);
        const res = await reject(m);
        expect(res.status).toBe(200);
        expect((await footprint(q, o)).matches).toEqual([{ id: m, responder_id: H, status: 'rejected', offer_id: o }]);
        expect(await offerStatus(o)).toBe('active');
      });
    });

    describe('the unexpired twin (positive controls)', () => {
      it('admin propose-match proposes', async () => {
        const q = await ask('future');
        expect((await propose(q)).status).toBe(201);
      });
      it('match accept matches', async () => {
        const q = await ask('future');
        const m = await match(q, H, 'proposed');
        expect((await accept(m)).status).toBe(200);
        expect(await askStatus(q)).toBe('matched');
      });
      it('dibs create sends the dibs', async () => {
        const q = await ask('future');
        expect((await sendDibs(q)).status).toBe(201);
        expect(await askStatus(q)).toBe('dibs_pending');
      });
      it('provider-offer accept accepts', async () => {
        const q = await ask('future');
        expect((await acceptProviderOffer(await providerOffer(q))).status).toBe(200);
        expect(await askStatus(q)).toBe('matched');
      });
    });
  });

  describe('POST /matches runs under the request lock (BUG-084)', () => {
    it('an offer that waited on a concurrent cancel answers 409 and writes no proposal; the offer stays active', async () => {
      const q = await ask('future');
      const o = await offer(H, 'active');
      const [res] = await whileHeld("UPDATE requests.help_requests SET status = 'cancelled' WHERE id = $1", q, [() => offerHelp(q, o)]);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, message: 'Request is not open', error: 'REQUEST_NOT_OPEN' });
      expect((await footprint(q, o)).matches).toEqual([]);
      expect(await offerStatus(o)).toBe('active');
      expect(await askStatus(q)).toBe('cancelled');
    });

    it('two offers of one offer on two asks, both waiting on the held offer row: exactly one wins', async () => {
      const q1 = await ask('future'), q2 = await ask('future');
      const o = await offer(H, 'active');
      // findOwnOffer is a plain SELECT (helpOffersDb.ts), so both calls pass the fast path and reach the offer write.
      const responses = await whileHeld('SELECT id FROM requests.help_offers WHERE id = $1 FOR UPDATE', o,
        [() => offerHelp(q1, o), () => offerHelp(q2, o)]);
      const codes = responses.map((r) => r.status).sort();
      expect(codes).toEqual([201, 400]);
      expect(responses.find((r) => r.status === 400)!.body).toEqual({ success: false, message: 'Offer is not active', error: 'OFFER_NOT_ACTIVE' });
      expect(await offerStatus(o)).toBe('matched');
      const holding = await pool.query("SELECT request_id FROM requests.matches WHERE offer_id = $1 AND status = 'proposed'", [o]);
      expect(holding.rowCount).toBe(1);
    });

    it('a second offer by the same helper on the same ask is refused with 409 ALREADY_OFFERED', async () => {
      const q = await ask('future');
      expect((await offerHelp(q)).status).toBe(201);
      const res = await offerHelp(q);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('ALREADY_OFFERED');
      expect((await footprint(q)).matches).toHaveLength(1);
    });
  });
});
