/**
 * Sprint 138 (BUG-093..096): reusable standing offers. Real JWT, request service over HTTP, cleanup-service's expiration
 * job run directly, real PostgreSQL. Missing infrastructure is a failure, never a skip.
 *
 * Proofs (spec docs/superpowers/specs/2026-11-06-sprint-138-reusable-standing-offers-design.md, "Tests"):
 * - A, BUG-093. Completion goes through both real HTTP done marks (PUT /matches/:id/complete, helper then requester).
 *   The first mark frees nothing: the offer row is not written (same row version). The final mark frees it, unflagged.
 * - Reuse. One offer backs a real POST /matches on a first ask (held), the requester accepts, both marks free it; the
 *   same offer then backs a POST /matches on a second ask (held again), and that exchange's marks free it again. Both
 *   matches end completed and still reference the offer.
 * - A legacy shared offer (BUG-089 let one offer back several matches; the rows are inserted with SQL, since no route
 *   builds them now). Completing one exchange over HTTP leaves the offer unwritten while the other match is proposed
 *   or matched. Ending that one (reject, or cancel) frees it.
 * - History (decision 3). A matched offer whose only match is completed, inserted with SQL since no route builds it
 *   now: markExpiredData()'s D2 frees it, unflagged.
 * - B, BUG-094. An offer past expires_at that no sweep had flagged is freed with expired = TRUE by the release itself,
 *   read back right after the call: by the final done mark, by match reject, and by D2. The D2 case calls
 *   releaseExpiredHolds(), which runs no hourly flag (that flag only touches active offers anyway), so only D2's own
 *   SET can be the reason.
 * - C, BUG-096. GET /offers hides an offer flagged expired whose expires_at is still ahead (only the flag hides it),
 *   hides an unflagged offer whose expires_at has passed (only the clock hides it), and lists an unexpired one.
 * - D, BUG-095. pg_indexes has idx_matches_offer_id on requests.matches: btree (offer_id) WHERE (offer_id IS NOT NULL).
 *
 * D2 is a global sweep over the shared CI database, so every assertion reads only rows this file created. The CI test
 * stack runs no cleanup-service, so no hourly flag runs between a call and its read-back.
 *
 * Fails before (REASONED, none run: there is no PostgreSQL on the Windows box, and CI runs this file only against the
 * fixed code). Production code before Sprint 138 is v11.110.0 (Sprint 137).
 * - Completion never released the offer, and every release counted a completed match as a hold. The final mark, the
 *   reuse case's first exchange (its second POST /matches then answers 400 OFFER_NOT_ACTIVE), the legacy shared offer
 *   after its other match ends, and the history sweep all leave the offer matched.
 * - B: every release set the status only, so the reject case reads expired FALSE; the completion and D2 cases do not
 *   free the offer at all.
 * - C: GET /offers filtered on status only, so it lists both expired offers.
 * - D: no such index, so zero rows.
 * - Positive controls pass before too: the first mark, the legacy shared offer staying matched while the other match
 *   lives, and the unexpired offer listed.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import Queue from 'bull';
import { randomUUID } from 'crypto';
import { createPool, ServiceUrls } from '../fixtures';
// The sweep cases run cleanup-service's job directly, as sprint-137-exchange-integrity does.
import cleanupPool from '../../services/cleanup-service/src/database/db';
import { markExpiredData, releaseExpiredHolds } from '../../services/cleanup-service/src/jobs/expirationJob';

describe('Sprint 138 reusable standing offers', () => {
  const pool = createPool();
  // R requester; H helper, who owns every offer. Both active members of Cm.
  const R = randomUUID(), H = randomUUID();
  const users = [R, H];
  const Cm = randomUUID();
  const asks: string[] = [];
  const offers: string[] = [];
  const completions: string[] = [];
  const redis = process.env.REDIS_URL || 'redis://localhost:6380';
  const reputationJobs = new Queue('karmyq-completion-reputation', redis);
  const communityEvolution = new Queue('karmyq-community-evolution', redis);

  const bearer = (id: string) => `Bearer ${jwt.sign({ userId: id, email: `${id}@karmyq.test`, communities: [] }, process.env.JWT_SECRET || 'dev-secret-key')}`;
  const call = (method: 'put' | 'post' | 'delete', path: string, as: string, body: object = {}) =>
    request(ServiceUrls.REQUEST)[method](path).set('Authorization', bearer(as)).send(body).then((res) => res);
  const offerHelp = (q: string, offerId: string) => call('post', '/matches', H, { request_id: q, offer_id: offerId });
  const accept = (m: string) => call('put', `/matches/${m}/accept`, R);
  const reject = (m: string) => call('put', `/matches/${m}/reject`, H);
  const cancelMatch = (m: string) => call('delete', `/matches/${m}`, H);
  const markDone = (m: string, as: string) => call('put', `/matches/${m}/complete`, as);
  const listOffers = (as: string) =>
    request(ServiceUrls.REQUEST).get(`/offers?community_id=${Cm}`).set('Authorization', bearer(as)).then((res) => res);
  /** Status and body together, so a CI failure prints the body that came back. */
  const answer = (res: request.Response) => ({ status: res.status, body: res.body });

  const REJECTED = { success: true, message: 'Match rejected successfully' };
  const CANCELLED = { success: true, message: 'Match cancelled successfully' };
  // matches.ts PUT /:id/complete: the helper's mark comes first, so the exchange then waits for the requester.
  const RECORDED = {
    success: true,
    data: { fully_completed: false, waiting_for: 'requester' },
    message: 'Your completion recorded — waiting for the other party',
  };
  const COMPLETED = { success: true, data: { fully_completed: true, waiting_for: null }, message: 'Match completed successfully' };

  /** An unexpired ask in Cm (expires_at a day ahead). Status parameters are cast to varchar. */
  async function ask(status = 'open'): Promise<string> {
    const id = randomUUID();
    await pool.query(`INSERT INTO requests.help_requests
      (id,requester_id,title,description,category,request_type,visibility_scope,status,expired,expires_at)
      VALUES ($1,$2,'Sprint 138 ask','Fixture','generic','generic','community',$3::varchar,FALSE,NOW() + INTERVAL '1 day')`,
    [id, R, status]);
    await pool.query('INSERT INTO requests.request_communities(request_id,community_id) VALUES ($1,$2)', [id, Cm]);
    asks.push(id);
    return id;
  }
  /**
   * H's standing offer in Cm. expires_at is 30 days ahead, or, with `past`, a day behind: the one-day margin holds
   * whatever the session time zone, since expires_at is a timestamp without time zone (Sprint 137's convention).
   * `flagged` sets the expired column as the hourly sweep would.
   */
  async function offer(status: string, opts: { past?: boolean; flagged?: boolean } = {}): Promise<string> {
    const id = randomUUID();
    await pool.query(`INSERT INTO requests.help_offers (id,community_id,offerer_id,title,description,category,status,expired,expires_at)
      VALUES ($1,$2,$3,'Sprint 138 offer','Fixture','generic',$4::varchar,$5::boolean,
              CASE WHEN $6::boolean THEN NOW() - INTERVAL '1 day' ELSE NOW() + INTERVAL '30 days' END)`,
    [id, Cm, H, status, opts.flagged ?? false, opts.past ?? false]);
    offers.push(id);
    return id;
  }
  async function match(requestId: string, responder: string, status: string, offerId: string | null = null): Promise<string> {
    const { rows } = await pool.query(`INSERT INTO requests.matches (request_id,responder_id,offer_id,status,completed_at)
      VALUES ($1,$2,$3,$4::varchar,CASE WHEN $4::varchar = 'completed' THEN CURRENT_TIMESTAMP END) RETURNING id`,
    [requestId, responder, offerId, status]);
    return rows[0].id;
  }

  // `version` is the physical row version: an UPDATE of the row changes it. Equal rows before and after prove a
  // statement did not write the offer.
  const VERSION = `ctid::text || '@' || xmin::text AS version`;
  const one = async (sql: string, id: string) => (await pool.query(sql, [id])).rows[0];
  const offerRow = (id: string) =>
    one(`SELECT status, expired, updated_at::text AS updated_at, ${VERSION} FROM requests.help_offers WHERE id = $1`, id);
  /** The offer's status and expired flag, read back right after a call. */
  const offerState = async (id: string) => {
    const { status, expired } = await offerRow(id);
    return { status, expired };
  };
  const matchStatus = async (id: string) => (await one('SELECT status FROM requests.matches WHERE id = $1', id)).status;
  const askStatus = async (id: string) => (await one('SELECT status FROM requests.help_requests WHERE id = $1', id)).status;
  /** Every match that references the offer, in completion order. */
  const matchesOf = async (offerId: string) => (await pool.query(
    'SELECT id, request_id, status FROM requests.matches WHERE offer_id = $1 ORDER BY completed_at, id', [offerId])).rows;

  /** The helper's done mark, the first one: the exchange is not finished yet. */
  async function firstMark(m: string) {
    expect(answer(await markDone(m, H))).toEqual({ status: 200, body: RECORDED });
  }
  /** The requester's done mark, the final one: the exchange completes. */
  async function finalMark(m: string) {
    completions.push(m); // before the call, so afterAll waits on its reputation job even if the assertion fails
    expect(answer(await markDone(m, R))).toEqual({ status: 200, body: COMPLETED });
  }
  async function bothMarks(m: string) {
    await firstMark(m);
    await finalMark(m);
  }
  /** A real POST /matches with the offer, which holds it, then the requester's accept. Returns the match. */
  async function holdAndAccept(q: string, o: string): Promise<string> {
    const res = await offerHelp(q, o);
    expect(answer(res)).toMatchObject({ status: 201, body: { success: true, data: { request_id: q, offer_id: o, responder_id: H, status: 'proposed' } } });
    const m: string = res.body.data.id;
    expect(await offerState(o)).toEqual({ status: 'matched', expired: false });
    expect(answer(await accept(m))).toMatchObject(
      { status: 200, body: { success: true, message: 'Match accepted successfully', data: { id: m, status: 'matched' } } });
    return m;
  }

  // An HTTP completion publishes match_completed, and reputation-service awards karma asynchronously. Wait for each
  // completion's job, so no karma row lands after the community is gone (Sprint 135's pattern).
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
        [id, `Sprint 138 ${id.slice(0, 8)}`, `${id}@karmyq.test`, 'not-a-login']);
    }
    await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4)',
      [Cm, `Sprint 138 ${Cm}`, 'Fixture', R]);
    for (const id of users) {
      await pool.query(`INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'member','active')`, [id, Cm]);
    }
  });

  afterAll(async () => {
    try {
      for (const m of completions) await settled(m);
      await (await communityEvolution.getJob(Cm))?.remove().catch(() => undefined);
      // Children before parents. Route side effects (feed events, notifications, karma, trust) are keyed on our asks and
      // users; matches cascade from their asks too, but go first so no offer is still referenced.
      await pool.query('DELETE FROM requests.matches WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM requests.feed_events WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM notifications.notifications WHERE user_id = ANY($1::uuid[])', [users]);
      // karma_records.community_id and trust_scores.community_id have no ON DELETE CASCADE: clear them before the community.
      await pool.query('DELETE FROM reputation.karma_records WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM reputation.trust_scores WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM social_graph.trust_edges WHERE user_id_a = ANY($1::uuid[]) OR user_id_b = ANY($1::uuid[])', [users]);
      // help_offers.community_id and offerer_id have no ON DELETE CASCADE: clear them before the community and users.
      await pool.query('DELETE FROM requests.help_offers WHERE id = ANY($1::uuid[])', [offers]);
      await pool.query('DELETE FROM requests.request_communities WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM requests.help_requests WHERE id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM communities.members WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM communities.communities WHERE id = $1', [Cm]);
      // Cascades notifications, badges and the rest keyed on the user.
      await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [users]);
    } finally {
      await reputationJobs.close();
      await communityEvolution.close();
      await cleanupPool.end();
      await pool.end();
    }
  }, 180_000);

  describe('A: completing an exchange frees its standing offer (BUG-093)', () => {
    it('the first done mark frees nothing; the final mark frees the offer', async () => {
      const q = await ask('matched');
      const o = await offer('matched');
      const m = await match(q, H, 'matched', o);
      const held = await offerRow(o);
      expect(held).toMatchObject({ status: 'matched', expired: false });

      await firstMark(m);
      expect(await matchStatus(m)).toBe('matched');
      expect(await offerRow(o)).toEqual(held); // not written: same version, same updated_at

      await finalMark(m);
      expect(await matchStatus(m)).toBe('completed');
      expect(await offerState(o)).toEqual({ status: 'active', expired: false });
      expect(await askStatus(q)).toBe('completed');
    });

    it('the freed offer backs a new exchange on another ask and is freed again: one offer, two completed matches', async () => {
      const o = await offer('active');
      const q1 = await ask(), q2 = await ask();

      const m1 = await holdAndAccept(q1, o);
      await bothMarks(m1);
      expect(await offerState(o)).toEqual({ status: 'active', expired: false });

      const m2 = await holdAndAccept(q2, o);
      await bothMarks(m2);
      expect(await offerState(o)).toEqual({ status: 'active', expired: false });

      expect(await matchesOf(o)).toEqual([
        { id: m1, request_id: q1, status: 'completed' },
        { id: m2, request_id: q2, status: 'completed' },
      ]);
    });
  });

  describe('a legacy shared offer is freed only when its last live exchange ends (BUG-089 rows)', () => {
    it.each<'proposed' | 'matched'>(['proposed', 'matched'])(
      'completing one exchange leaves the offer matched while the other is %s; ending that one frees it', async (other) => {
        // Fixture-only state, as Sprint 137 inserts it: one matched offer backing two matches on two asks.
        const o = await offer('matched');
        const m1 = await match(await ask('matched'), H, 'matched', o);
        const m2 = await match(await ask(other === 'proposed' ? 'open' : 'matched'), H, other, o);
        const held = await offerRow(o);

        await bothMarks(m1);
        expect(await matchStatus(m1)).toBe('completed');
        expect(await offerRow(o)).toEqual(held); // the completion's release skipped it: still matched, same version

        if (other === 'proposed') {
          expect(answer(await reject(m2))).toEqual({ status: 200, body: REJECTED });
          expect(await matchStatus(m2)).toBe('rejected');
        } else {
          expect(answer(await cancelMatch(m2))).toEqual({ status: 200, body: CANCELLED });
          expect(await matchStatus(m2)).toBe('cancelled');
        }
        expect(await offerState(o)).toEqual({ status: 'active', expired: false });
      });
  });

  describe('history: the sweep frees an offer that only completed exchanges reference (decision 3)', () => {
    it("markExpiredData()'s D2 frees a matched offer whose only match is completed, unflagged", async () => {
      // What a completion before Sprint 138 left behind; no route builds it now.
      const o = await offer('matched');
      const m = await match(await ask('completed'), H, 'completed', o);
      await markExpiredData();
      expect(await offerState(o)).toEqual({ status: 'active', expired: false });
      expect(await one('SELECT status, offer_id FROM requests.matches WHERE id = $1', m)).toEqual({ status: 'completed', offer_id: o });
    });
  });

  describe('B: an offer freed past its expiry is flagged by the release itself (BUG-094)', () => {
    it('the final done mark frees it with expired = TRUE', async () => {
      const q = await ask('matched');
      const o = await offer('matched', { past: true });
      const m = await match(q, H, 'matched', o);
      expect(await offerState(o)).toEqual({ status: 'matched', expired: false });

      await firstMark(m);
      expect(await offerState(o)).toEqual({ status: 'matched', expired: false });

      await finalMark(m);
      expect(await offerState(o)).toEqual({ status: 'active', expired: true });
    });

    it('match reject frees it with expired = TRUE', async () => {
      const o = await offer('matched', { past: true });
      const m = await match(await ask(), H, 'proposed', o);
      expect(await offerState(o)).toEqual({ status: 'matched', expired: false });

      expect(answer(await reject(m))).toEqual({ status: 200, body: REJECTED });
      expect(await matchStatus(m)).toBe('rejected');
      expect(await offerState(o)).toEqual({ status: 'active', expired: true });
    });

    it('D2, run by releaseExpiredHolds() with no hourly flag before it, frees it with expired = TRUE', async () => {
      const o = await offer('matched', { past: true });
      await match(await ask('completed'), H, 'completed', o);
      expect(await offerState(o)).toEqual({ status: 'matched', expired: false });

      await releaseExpiredHolds();
      expect(await offerState(o)).toEqual({ status: 'active', expired: true });
    });
  });

  describe('C: GET /offers lists only unexpired offers (BUG-096)', () => {
    it('hides an offer flagged expired and an unflagged one past expires_at, and lists an unexpired one', async () => {
      const flagged = await offer('active', { flagged: true }); // expires_at still 30 days ahead: only the flag hides it
      const past = await offer('active', { past: true }); // not flagged: only the clock hides it
      const live = await offer('active');

      const res = await listOffers(R);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const fixtures = new Set([flagged, past, live]);
      expect(res.body.data.offers.map((o: { id: string }) => o.id).filter((id: string) => fixtures.has(id))).toEqual([live]);
    });
  });

  describe('D: the offer-release lookup is indexed (BUG-095)', () => {
    it('idx_matches_offer_id exists on requests.matches with its partial definition', async () => {
      const { rows } = await pool.query(`SELECT tablename, indexdef FROM pg_indexes
        WHERE schemaname = 'requests' AND indexname = 'idx_matches_offer_id'`);
      expect(rows).toHaveLength(1);
      expect(rows[0].tablename).toBe('matches');
      expect(rows[0].indexdef).toContain('USING btree (offer_id)');
      expect(rows[0].indexdef).toContain('WHERE (offer_id IS NOT NULL)');
    });
  });
});
