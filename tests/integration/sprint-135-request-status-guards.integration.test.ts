/**
 * Sprint 135 (BUG-075, BUG-078): every request-status writer guards its own row and derives the request's status
 * (services/request-service/src/db/requestStatus.ts). Real JWT, request service over HTTP, real PostgreSQL. Missing
 * infrastructure is a failure, never a skip.
 *
 * Proofs, writer by writer:
 * - a refusal writes nothing;
 * - a success leaves the ask in its derived status (a completed or cancelled ask stays so; a withdrawn offer stays
 *   withdrawn);
 * - four races show the guard is under the lock, not in a read before it. While a second client holds an uncommitted
 *   change, the HTTP call waits on that lock (pg_blocking_pids, never a sleep) and is refused after the commit.
 * Every case except the named positive controls fails against the pre-Sprint-135 code.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import Queue from 'bull';
import { randomUUID } from 'crypto';
import { createPool, ServiceUrls } from '../fixtures';

describe('Sprint 135 request status guards', () => {
  const pool = createPool();
  // R requester; H, H2, H3 helpers; A community admin; P provider. All active members of Cm.
  const R = randomUUID(), H = randomUUID(), H2 = randomUUID(), H3 = randomUUID(), A = randomUUID(), P = randomUUID();
  const users = [R, H, H2, H3, A, P];
  const Cm = randomUUID();
  let providerProfile = '';
  const asks: string[] = [];
  const offers: string[] = [];
  const completions: string[] = [];
  const redis = process.env.REDIS_URL || 'redis://localhost:6380';
  const reputationJobs = new Queue('karmyq-completion-reputation', redis);
  const communityEvolution = new Queue('karmyq-community-evolution', redis);

  const bearer = (id: string) => `Bearer ${jwt.sign({ userId: id, email: `${id}@karmyq.test`, communities: [] }, process.env.JWT_SECRET || 'dev-secret-key')}`;
  // `.then` starts the request, so a race case can hold it in flight.
  const call = (method: 'put' | 'post' | 'delete', path: string, as: string, body: object = {}) =>
    request(ServiceUrls.REQUEST)[method](path).set('Authorization', bearer(as)).send(body).then((res) => res);
  const accept = (m: string) => call('put', `/matches/${m}/accept`, R);
  const reject = (m: string, as = H) => call('put', `/matches/${m}/reject`, as);
  const complete = (m: string, as: string) => call('put', `/matches/${m}/complete`, as);
  const propose = (q: string) => call('post', `/requests/${q}/propose-match`, A, { user_id: H });
  const sendDibs = (q: string) => call('post', `/requests/${q}/dibs`, R, { provider_user_id: H });
  const acceptDibs = (d: string) => call('put', `/requests/dibs/${d}/accept`, H);
  const declineDibs = (d: string) => call('put', `/requests/dibs/${d}/decline`, H);
  const acceptProviderOffer = (o: string) => call('put', `/requests/offers/${o}/accept`, R);
  const editAsk = (q: string, body: object) => call('put', `/requests/${q}`, R, body);
  const cancelAsk = (q: string) => call('delete', `/requests/${q}`, R);

  // Status parameters are INSERT values cast to varchar; nothing here compares a parameter with requests.matches.status.
  async function ask(status: string): Promise<string> {
    const id = randomUUID();
    await pool.query(`INSERT INTO requests.help_requests
      (id,requester_id,title,description,category,request_type,visibility_scope,status)
      VALUES ($1,$2,'Sprint 135 ask','Fixture','generic','generic','community',$3::varchar)`, [id, R, status]);
    await pool.query('INSERT INTO requests.request_communities(request_id,community_id) VALUES ($1,$2)', [id, Cm]);
    asks.push(id);
    return id;
  }
  async function offer(owner: string, status: string): Promise<string> {
    const id = randomUUID();
    await pool.query(`INSERT INTO requests.help_offers (id,community_id,offerer_id,title,description,category,status)
      VALUES ($1,$2,$3,'Sprint 135 offer','Fixture','generic',$4::varchar)`, [id, Cm, owner, status]);
    offers.push(id);
    return id;
  }
  async function match(requestId: string, responder: string, status: string,
    opts: { offerId?: string; requesterDone?: boolean } = {}): Promise<string> {
    const { rows } = await pool.query(`INSERT INTO requests.matches
      (request_id,responder_id,offer_id,status,requester_done_at,completed_at)
      VALUES ($1,$2,$3,$4::varchar,CASE WHEN $5::boolean THEN CURRENT_TIMESTAMP END,
              CASE WHEN $4::varchar = 'completed' THEN CURRENT_TIMESTAMP END) RETURNING id`,
    [requestId, responder, opts.offerId ?? null, status, opts.requesterDone ?? false]);
    return rows[0].id;
  }
  async function dibs(requestId: string, provider = H): Promise<string> {
    const { rows } = await pool.query(`INSERT INTO requests.dibs (request_id,requester_id,provider_user_id,expires_at)
      VALUES ($1,$2,$3,NOW() + INTERVAL '1 day') RETURNING id`, [requestId, R, provider]);
    return rows[0].id;
  }
  async function providerOffer(requestId: string): Promise<string> {
    const { rows } = await pool.query(`INSERT INTO provider.offers (provider_id,provider_user_id,request_id,price,note)
      VALUES ($1,$2,$3,10,'Sprint 135 provider offer') RETURNING id`, [providerProfile, P, requestId]);
    return rows[0].id;
  }
  const one = async (sql: string, id: string) => (await pool.query(sql, [id])).rows[0];
  const askStatus = async (id: string) => (await one('SELECT status FROM requests.help_requests WHERE id = $1', id)).status;
  const matchRow = (id: string) => one('SELECT * FROM requests.matches WHERE id = $1', id);
  const offerStatus = async (id: string) => (await one('SELECT status FROM requests.help_offers WHERE id = $1', id)).status;
  const dibsStatus = async (id: string) => (await one('SELECT status FROM requests.dibs WHERE id = $1', id)).status;
  const providerOfferStatus = async (id: string) => (await one('SELECT status FROM provider.offers WHERE id = $1', id)).status;
  const matchesOn = async (requestId: string) => (await pool.query(
    'SELECT responder_id, status, admin_proposed FROM requests.matches WHERE request_id = $1', [requestId])).rows;

  // Holds `holderSql` on one row in an open transaction, starts `pending`, proves it waits on that row's lock
  // (pg_blocking_pids, not a sleep), then commits and returns the call's response.
  async function whileHeld(holderSql: string, rowId: string, pending: () => Promise<request.Response>) {
    const holder = await pool.connect();
    try {
      await holder.query('BEGIN');
      const { pid } = (await holder.query('SELECT pg_backend_pid() AS pid')).rows[0];
      await holder.query(holderSql, [rowId]);
      const inFlight = pending();
      inFlight.catch(() => undefined); // if expect(waiting) throws below, a late rejection must not outlive the test
      let waiting = false;
      for (const deadline = Date.now() + 10_000; !waiting && Date.now() < deadline;) {
        const blocked = await pool.query(
          'SELECT 1 FROM pg_locks l WHERE NOT l.granted AND $1::int = ANY(pg_blocking_pids(l.pid))', [pid]);
        waiting = (blocked.rowCount ?? 0) > 0;
        if (!waiting) await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(waiting).toBe(true);
      await holder.query('COMMIT');
      return await inFlight;
    } catch (err) {
      await holder.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      holder.release();
    }
  }

  // What a concurrent accept leaves behind, held uncommitted by whileHeld: the request row locked and 'matched', plus a
  // matched exchange by H2. Preconditions read the DERIVED status, so the stored column alone would not do: without the
  // exchange the ask still derives 'open'.
  const concurrentAccept = `WITH accepted AS (
      INSERT INTO requests.matches (request_id, responder_id, status) VALUES ($1, '${H2}', 'matched')
    ) UPDATE requests.help_requests SET status = 'matched' WHERE id = $1`;

  // An HTTP completion publishes match_completed, and reputation-service awards karma asynchronously. Wait for each
  // completion's job, so no karma row lands after the community is gone.
  async function settled(matchId: string) {
    for (const deadline = Date.now() + 20_000; Date.now() < deadline;) {
      const job = await reputationJobs.getJob(`completion-${matchId}`);
      if (job && ((await job.getState()) === 'completed' || job.attemptsMade > 0)) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  beforeAll(async () => {
    await pool.query('SELECT 1');
    expect((await request(ServiceUrls.REQUEST).get('/health')).status).toBe(200);
    for (const id of users) {
      await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)',
        [id, `Sprint 135 ${id.slice(0, 8)}`, `${id}@karmyq.test`, 'not-a-login']);
    }
    await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4)',
      [Cm, `Sprint 135 ${Cm}`, 'Fixture', R]);
    for (const id of users) {
      await pool.query(`INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,$3::varchar,'active')`,
        [id, Cm, id === A ? 'admin' : 'member']);
    }
    providerProfile = (await pool.query(`INSERT INTO requests.provider_profiles (user_id,service_type,display_name)
      VALUES ($1,'generic','Sprint 135 provider') RETURNING id`, [P])).rows[0].id;
    // One completed exchange between R and H makes H an eligible mutual-aid dibs nominee.
    await match(await ask('completed'), H, 'completed');
  });

  afterAll(async () => {
    try {
      for (const m of completions) await settled(m);
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
      await reputationJobs.close();
      await communityEvolution.close();
      await pool.end();
    }
  }, 90_000);

  describe('accept (BUG-075, BUG-078 #1)', () => {
    it('matches an open ask, rejects the other proposals and frees only the offers they still hold', async () => {
      const q = await ask('open');
      const o1 = await offer(H, 'matched'), o2 = await offer(H2, 'matched'), o3 = await offer(H3, 'withdrawn');
      const m1 = await match(q, H, 'proposed', { offerId: o1 });
      const m2 = await match(q, H2, 'proposed', { offerId: o2 });
      const m3 = await match(q, H3, 'proposed', { offerId: o3 });
      expect((await accept(m1)).status).toBe(200);
      expect([(await matchRow(m1)).status, (await matchRow(m2)).status, (await matchRow(m3)).status])
        .toEqual(['matched', 'rejected', 'rejected']);
      expect([await offerStatus(o1), await offerStatus(o2), await offerStatus(o3)]).toEqual(['matched', 'active', 'withdrawn']);
      expect(await askStatus(q)).toBe('matched');
    });

    it.each(['dibs_pending', 'completed', 'cancelled'])('refuses a %s ask with 409 REQUEST_NOT_OPEN and writes nothing', async (status) => {
      const q = await ask(status);
      const m = await match(q, H, 'proposed');
      const res = await accept(m);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, message: 'This request is no longer open', error: 'REQUEST_NOT_OPEN' });
      expect((await matchRow(m)).status).toBe('proposed');
      expect(await askStatus(q)).toBe(status);
    });

    it('refuses an accept that waited on a concurrent cancel of the ask', async () => {
      const q = await ask('open');
      const m = await match(q, H, 'proposed');
      const res = await whileHeld("UPDATE requests.help_requests SET status = 'cancelled' WHERE id = $1", q, () => accept(m));
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('REQUEST_NOT_OPEN');
      expect((await matchRow(m)).status).toBe('proposed');
      expect(await askStatus(q)).toBe('cancelled');
    });

    it('refuses a new helper on an ask stored open that already holds a completed exchange (the 2026-10-29 demo shape)', async () => {
      const q = await ask('open');
      await match(q, H2, 'completed');
      const m = await match(q, H, 'proposed');
      const res = await accept(m);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('REQUEST_NOT_OPEN');
      expect((await matchRow(m)).status).toBe('proposed');
      expect(await askStatus(q)).toBe('open');   // a refusal writes nothing, not even a correction
    });
  });

  describe('reject (BUG-075, BUG-078 #1)', () => {
    it.each([
      ['completed', async (q: string): Promise<void> => { await match(q, H2, 'completed'); }],
      ['dibs_pending', async (q: string): Promise<void> => { await dibs(q, H2); }],
      ['cancelled', async (_q: string): Promise<void> => undefined],
    ] as const)('leaves a %s ask as it is when a proposal on it is withdrawn', async (status, backing) => {
      const q = await ask(status);
      await backing(q);
      const o = await offer(H, 'matched');
      const m = await match(q, H, 'proposed', { offerId: o });
      expect((await reject(m)).status).toBe(200);
      expect((await matchRow(m)).status).toBe('rejected');
      expect(await offerStatus(o)).toBe('active');
      expect(await askStatus(q)).toBe(status);
    });

    it('declining a proposal never revives an offer the helper withdrew', async () => {
      const q = await ask('open');
      const o = await offer(H, 'withdrawn');
      const m = await match(q, H, 'proposed', { offerId: o });
      expect((await reject(m, R)).status).toBe(200);
      expect(await offerStatus(o)).toBe('withdrawn');
      expect(await askStatus(q)).toBe('open');
    });
  });

  describe('complete (BUG-078 #2, #3)', () => {
    it('completes the exchange but leaves a cancelled ask cancelled', async () => {
      const q = await ask('cancelled');
      const m = await match(q, H, 'matched', { requesterDone: true });
      const res = await complete(m, H);
      completions.push(m);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ fully_completed: true, waiting_for: null });
      expect((await matchRow(m)).status).toBe('completed');
      expect(await askStatus(q)).toBe('cancelled');
    });

    it('keeps the ask matched while a second helper is still matched', async () => {
      const q = await ask('matched');
      await match(q, H2, 'matched');
      const m = await match(q, H, 'matched', { requesterDone: true });
      const res = await complete(m, H);
      completions.push(m);
      expect(res.body.data).toEqual({ fully_completed: true, waiting_for: null });
      expect(await askStatus(q)).toBe('matched');
    });

    // Positive control: the old code also closes this ask.
    it('closes the ask as completed when its only exchange completes', async () => {
      const q = await ask('matched');
      const m = await match(q, H, 'matched', { requesterDone: true });
      const res = await complete(m, H);
      completions.push(m);
      expect(res.body.data).toEqual({ fully_completed: true, waiting_for: null });
      expect(await askStatus(q)).toBe('completed');
    });

    it("a repeat mark keeps the first mark's time", async () => {
      const q = await ask('matched');
      const m = await match(q, H, 'matched');
      expect((await complete(m, R)).body.data).toEqual({ fully_completed: false, waiting_for: 'helper' });
      const first = (await matchRow(m)).requester_done_at;
      expect((await complete(m, R)).body.data).toEqual({ fully_completed: false, waiting_for: 'helper' });
      expect((await matchRow(m)).requester_done_at).toEqual(first);
    });
  });

  describe('propose-match (BUG-075)', () => {
    // Positive control.
    it('proposes a member on an open ask', async () => {
      const q = await ask('open');
      expect((await propose(q)).status).toBe(201);
      expect(await matchesOn(q)).toEqual([{ responder_id: H, status: 'proposed', admin_proposed: true }]);
    });

    it.each(['dibs_pending', 'matched', 'completed', 'cancelled'])('refuses a %s ask with 409 REQUEST_NOT_OPEN and inserts nothing', async (status) => {
      const q = await ask(status);
      const res = await propose(q);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, message: 'This request is no longer open', error: 'REQUEST_NOT_OPEN' });
      expect(await matchesOn(q)).toEqual([]);
    });

    it('refuses a proposal that waited on a concurrent match of the ask', async () => {
      const q = await ask('open');
      const res = await whileHeld(concurrentAccept, q, () => propose(q));
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('REQUEST_NOT_OPEN');
      expect(await matchesOn(q)).toEqual([{ responder_id: H2, status: 'matched', admin_proposed: false }]);
    });

    it('refuses a proposal on an ask stored open that already holds a completed exchange', async () => {
      const q = await ask('open');
      await match(q, H2, 'completed');
      const res = await propose(q);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('REQUEST_NOT_OPEN');
      expect(await matchesOn(q)).toEqual([{ responder_id: H2, status: 'completed', admin_proposed: false }]);
    });
  });

  describe('dibs (BUG-075)', () => {
    // Positive control.
    it('sends a dibs on an open ask and derives dibs_pending', async () => {
      const q = await ask('open');
      const res = await sendDibs(q);
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('pending');
      expect(await askStatus(q)).toBe('dibs_pending');
    });

    it('refuses a dibs that waited on a concurrent match of the ask, and writes no dibs', async () => {
      const q = await ask('open');
      const res = await whileHeld(concurrentAccept, q, () => sendDibs(q));
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, message: 'Request is not available for dibs', error: 'REQUEST_NOT_OPEN' });
      expect((await pool.query('SELECT 1 FROM requests.dibs WHERE request_id = $1', [q])).rowCount).toBe(0);
      expect(await askStatus(q)).toBe('matched');
    });

    it('a dibs accept matches the ask and closes a stale proposal', async () => {
      const q = await ask('dibs_pending');
      const d = await dibs(q);
      const o = await offer(H2, 'matched');
      const stale = await match(q, H2, 'proposed', { offerId: o });
      expect((await acceptDibs(d)).status).toBe(200);
      expect(await dibsStatus(d)).toBe('accepted');
      const rows = await matchesOn(q);
      expect(rows).toHaveLength(2);
      expect(rows).toEqual(expect.arrayContaining([{ responder_id: H, status: 'matched', admin_proposed: false }]));
      expect((await matchRow(stale)).status).toBe('rejected');
      expect(await offerStatus(o)).toBe('active');
      expect(await askStatus(q)).toBe('matched');
    });

    it('a dibs accept on an ask the requester cancelled answers 409 and changes nothing', async () => {
      const q = await ask('cancelled');
      const d = await dibs(q);
      const res = await acceptDibs(d);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, message: 'This request is no longer waiting on your dibs', error: 'REQUEST_NOT_OPEN' });
      expect(await dibsStatus(d)).toBe('pending');
      expect(await matchesOn(q)).toEqual([]);
      expect(await askStatus(q)).toBe('cancelled');
    });

    it('a dibs accept that waited on a concurrent decline answers 409 INVALID_STATE and inserts no match', async () => {
      const q = await ask('dibs_pending');
      const d = await dibs(q);
      const res = await whileHeld("UPDATE requests.dibs SET status = 'declined' WHERE id = $1", d, () => acceptDibs(d));
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, message: 'Dibs is no longer pending', error: 'INVALID_STATE' });
      expect(await dibsStatus(d)).toBe('declined');
      expect(await matchesOn(q)).toEqual([]);
    });

    // Positive control.
    it('a dibs decline reopens an ask that waited only on it', async () => {
      const q = await ask('dibs_pending');
      const d = await dibs(q);
      expect((await declineDibs(d)).status).toBe(200);
      expect(await dibsStatus(d)).toBe('declined');
      expect(await askStatus(q)).toBe('open');
    });

    it('a dibs decline leaves a cancelled ask cancelled', async () => {
      const q = await ask('cancelled');
      const d = await dibs(q);
      expect((await declineDibs(d)).status).toBe(200);
      expect(await dibsStatus(d)).toBe('declined');
      expect(await askStatus(q)).toBe('cancelled');
    });
  });

  describe('provider-offer accept (BUG-075)', () => {
    it('accepts on an open ask in one transaction and closes the other proposals', async () => {
      const q = await ask('open');
      const po = await providerOffer(q);
      const o = await offer(H, 'matched');
      const proposal = await match(q, H, 'proposed', { offerId: o });
      expect((await acceptProviderOffer(po)).status).toBe(200);
      expect(await providerOfferStatus(po)).toBe('accepted');
      expect((await matchesOn(q)).filter((m: any) => m.responder_id === P))
        .toEqual([{ responder_id: P, status: 'matched', admin_proposed: false }]);
      expect((await matchRow(proposal)).status).toBe('rejected');
      expect(await offerStatus(o)).toBe('active');
      expect(await askStatus(q)).toBe('matched');
    });

    it.each(['dibs_pending', 'matched', 'completed', 'cancelled'])('refuses a %s ask with 409 REQUEST_NOT_OPEN and writes nothing', async (status) => {
      const q = await ask(status);
      const po = await providerOffer(q);
      const res = await acceptProviderOffer(po);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, message: 'This request is no longer open', error: 'REQUEST_NOT_OPEN' });
      expect(await providerOfferStatus(po)).toBe('pending');
      expect(await matchesOn(q)).toEqual([]);
      expect(await askStatus(q)).toBe(status);
    });

    it('a second provider offer on the same ask is refused once the first is accepted', async () => {
      const q = await ask('open');
      const first = await providerOffer(q), second = await providerOffer(q);
      expect((await acceptProviderOffer(first)).status).toBe(200);
      const res = await acceptProviderOffer(second);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('REQUEST_NOT_OPEN');
      expect(await providerOfferStatus(second)).toBe('pending');
      expect((await matchesOn(q)).filter((m: any) => m.status === 'matched')).toHaveLength(1);
    });
  });

  describe('request edit and cancel (BUG-075)', () => {
    it('an edit cannot set a status', async () => {
      const q = await ask('completed');
      const res = await editAsk(q, { status: 'open' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: "A request's status changes through its exchanges, not an edit", error: 'STATUS_NOT_EDITABLE' });
      expect(await askStatus(q)).toBe('completed');
    });

    // Positive control.
    it('an edit of other fields still works and leaves the status alone', async () => {
      const q = await ask('open');
      expect((await editAsk(q, { title: 'Sprint 135 edited' })).status).toBe(200);
      expect(await one('SELECT title, status FROM requests.help_requests WHERE id = $1', q))
        .toEqual({ title: 'Sprint 135 edited', status: 'open' });
    });

    it('cancelling an open ask rejects its proposals and frees the offers they hold', async () => {
      const q = await ask('open');
      const o = await offer(H, 'matched');
      const m = await match(q, H, 'proposed', { offerId: o });
      const res = await cancelAsk(q);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, message: 'Request cancelled successfully' });
      expect(await askStatus(q)).toBe('cancelled');
      expect((await matchRow(m)).status).toBe('rejected');
      expect(await offerStatus(o)).toBe('active');
    });

    it('an ask with an exchange in progress cannot be cancelled', async () => {
      const q = await ask('matched');
      const m = await match(q, H, 'matched');
      const res = await cancelAsk(q);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, message: 'This request has an exchange in progress, so it cannot be cancelled', error: 'REQUEST_HAS_ACTIVE_EXCHANGE' });
      expect(await askStatus(q)).toBe('matched');
      expect((await matchRow(m)).status).toBe('matched');
    });

    it.each(['completed', 'cancelled'])('a %s ask cannot be cancelled', async (status) => {
      const q = await ask(status);
      const res = await cancelAsk(q);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, message: 'Only an open request can be cancelled', error: 'REQUEST_NOT_CANCELLABLE' });
      expect(await askStatus(q)).toBe(status);
    });

    it('cancelling an ask expires its pending dibs, which then cannot be accepted', async () => {
      const q = await ask('dibs_pending');
      const d = await dibs(q);
      expect((await cancelAsk(q)).status).toBe(200);
      expect(await askStatus(q)).toBe('cancelled');
      expect(await dibsStatus(d)).toBe('expired');
      const res = await acceptDibs(d);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('INVALID_STATE');
      expect(await matchesOn(q)).toEqual([]);
    });
  });
});
