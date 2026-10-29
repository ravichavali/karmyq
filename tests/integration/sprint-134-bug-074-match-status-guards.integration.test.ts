/**
 * Sprint 134 BUG-074: DELETE /matches/:id cancels only an exchange in progress, and PUT /matches/:id/complete
 * records a mark only on one. Real JWT, request service over HTTP, real PostgreSQL. Missing infrastructure is
 * a failure, never a skip.
 *
 * Proofs: (1) the cancel matrix: only 'matched' cancels, every other status is a 409 that writes nothing;
 * (2) the ask and offer end states after a cancel, including asks that are not 'matched' (left as they are);
 * (3) the complete refusals; (4) the guard is in the write: while a second client holds an uncommitted
 * completion (or cancel) on the row, the HTTP call waits on the row lock and, after the commit, is refused
 * or (for a completion behind a completion) answered with the idempotent 200 without re-stamping or
 * re-publishing. A check made only before the transaction reads the old committed 'matched' row and then
 * overwrites the commit, so all three race cases fail against it.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { createPool, ServiceUrls } from '../fixtures';

describe('Sprint 134 BUG-074 match status guards', () => {
  const pool = createPool();
  // R requester; H helper; H2 second helper; X same-community member with no part in any match.
  const R = randomUUID(), H = randomUUID(), H2 = randomUUID(), X = randomUUID();
  const users = [R, H, H2, X];
  const Cm = randomUUID();
  const asks: string[] = [];
  const offers: string[] = [];

  const bearer = (id: string) => `Bearer ${jwt.sign({ userId: id, email: `${id}@karmyq.test`, communities: [] }, process.env.JWT_SECRET || 'dev-secret-key')}`;
  // `.then` starts the request, so a race case can hold it in flight.
  const cancel = (as: string, matchId: string) => request(ServiceUrls.REQUEST).delete(`/matches/${matchId}`)
    .set('Authorization', bearer(as)).then((res) => res);
  const complete = (as: string, matchId: string) => request(ServiceUrls.REQUEST).put(`/matches/${matchId}/complete`)
    .set('Authorization', bearer(as)).send({}).then((res) => res);

  // One ask per case, so no case reads another's rows. Status parameters are INSERT values cast to varchar;
  // nothing here compares a parameter with requests.matches.status.
  async function ask(status: string): Promise<string> {
    const id = randomUUID();
    await pool.query(`INSERT INTO requests.help_requests
      (id,requester_id,title,description,category,request_type,visibility_scope,status)
      VALUES ($1,$2,'BUG-074 ask','Fixture','generic','generic','community',$3::varchar)`, [id, R, status]);
    await pool.query('INSERT INTO requests.request_communities(request_id,community_id) VALUES ($1,$2)', [id, Cm]);
    asks.push(id);
    return id;
  }
  async function offer(status: string): Promise<string> {
    const id = randomUUID();
    await pool.query(`INSERT INTO requests.help_offers (id,community_id,offerer_id,title,description,category,status)
      VALUES ($1,$2,$3,'BUG-074 offer','Fixture','generic',$4::varchar)`, [id, Cm, H, status]);
    offers.push(id);
    return id;
  }
  async function match(requestId: string, responder: string, status: string,
    opts: { offerId?: string; requesterDone?: boolean } = {}): Promise<string> {
    const { rows } = await pool.query(`INSERT INTO requests.matches (request_id,responder_id,offer_id,status,requester_done_at)
      VALUES ($1,$2,$3,$4::varchar,CASE WHEN $5::boolean THEN CURRENT_TIMESTAMP END) RETURNING id`,
      [requestId, responder, opts.offerId ?? null, status, opts.requesterDone ?? false]);
    return rows[0].id;
  }
  const matchRow = async (id: string) => (await pool.query('SELECT * FROM requests.matches WHERE id = $1', [id])).rows[0];
  const askStatus = async (id: string) => (await pool.query('SELECT status FROM requests.help_requests WHERE id = $1', [id])).rows[0].status;
  const offerStatus = async (id: string) => (await pool.query('SELECT status FROM requests.help_offers WHERE id = $1', [id])).rows[0].status;

  // Holds `holderSql` on the match row in an open transaction, starts `call`, proves the call is waiting on that
  // row lock (pg_blocking_pids, not a sleep), then commits and returns the call's response.
  async function whileHeld(holderSql: string, matchId: string, call: () => Promise<request.Response>) {
    const holder = await pool.connect();
    try {
      await holder.query('BEGIN');
      const { pid } = (await holder.query('SELECT pg_backend_pid() AS pid')).rows[0];
      await holder.query(holderSql, [matchId]);
      const pending = call();
      let waiting = false;
      for (const deadline = Date.now() + 10_000; !waiting && Date.now() < deadline;) {
        const blocked = await pool.query(
          'SELECT 1 FROM pg_locks l WHERE NOT l.granted AND $1::int = ANY(pg_blocking_pids(l.pid))', [pid]);
        waiting = (blocked.rowCount ?? 0) > 0;
        if (!waiting) await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(waiting).toBe(true);
      await holder.query('COMMIT');
      return await pending;
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
        [id, `BUG-074 ${id.slice(0, 8)}`, `${id}@karmyq.test`, 'not-a-login']);
    }
    await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4)',
      [Cm, `BUG-074 ${Cm}`, 'Fixture', R]);
    for (const id of users) {
      await pool.query("INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'member','active')", [id, Cm]);
    }
  });

  afterAll(async () => {
    try {
      // Matches first: a retried match_completed job (BUG-077 makes every one fail after karma, so Bull retries)
      // needs the match row to re-award karma, and a re-inserted karma row would block the community delete.
      // A completion exists here only if a guard failed; clearing its effects lets a red run still clean up.
      await pool.query('DELETE FROM requests.matches WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM requests.feed_events WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM notifications.notifications WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM reputation.karma_records WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM reputation.trust_scores WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM social_graph.trust_edges WHERE user_id_a = ANY($1::uuid[]) OR user_id_b = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM requests.help_offers WHERE id = ANY($1::uuid[])', [offers]);
      await pool.query('DELETE FROM requests.request_communities WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM requests.help_requests WHERE id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM communities.members WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM communities.communities WHERE id = $1', [Cm]);
      await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [users]);
    } finally { await pool.end(); }
  });

  describe('cancel matrix', () => {
    it('cancels an exchange in progress: match cancelled, ask reopened, offer freed', async () => {
      const q = await ask('matched');
      const o = await offer('matched');
      const m = await match(q, H, 'matched', { offerId: o });
      const res = await cancel(H, m);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, message: 'Match cancelled successfully' });
      expect((await matchRow(m)).status).toBe('cancelled');
      expect(await askStatus(q)).toBe('open');
      expect(await offerStatus(o)).toBe('active');
    });

    it.each(['proposed', 'completed', 'rejected', 'cancelled'])(
      'refuses a %s match with 409 MATCH_NOT_CANCELLABLE and writes nothing', async (status) => {
        // A second helper is matched, so an unguarded cancel's reopen would show on the ask.
        const q = await ask('matched');
        await match(q, H2, 'matched');
        const o = await offer('matched');
        const m = await match(q, H, status, { offerId: o });
        const res = await cancel(R, m);
        expect(res.status).toBe(409);
        expect(res.body).toEqual({
          success: false, message: 'Only an exchange in progress can be cancelled', error: 'MATCH_NOT_CANCELLABLE',
        });
        expect((await matchRow(m)).status).toBe(status);
        expect(await askStatus(q)).toBe('matched');
        expect(await offerStatus(o)).toBe('matched');
      });

    it('answers a member who is not a participant with 404 and writes nothing', async () => {
      const q = await ask('matched');
      const m = await match(q, H, 'matched');
      expect((await cancel(X, m)).status).toBe(404);
      expect((await matchRow(m)).status).toBe('matched');
      expect(await askStatus(q)).toBe('matched');
    });
  });

  describe('the ask and offer after a cancel', () => {
    it('keeps the ask matched while another helper is still matched', async () => {
      const q = await ask('matched');
      await match(q, H2, 'matched');
      const m = await match(q, H, 'matched');
      expect((await cancel(R, m)).status).toBe(200);
      expect(await askStatus(q)).toBe('matched');
    });

    it('closes the ask as completed when a completed exchange remains', async () => {
      const q = await ask('matched');
      await match(q, H2, 'completed');
      const m = await match(q, H, 'matched');
      expect((await cancel(R, m)).status).toBe(200);
      expect(await askStatus(q)).toBe('completed');
    });

    // Only a 'matched' ask changes. 'open' is a preservation check that cannot fail against the old code
    // (which also writes 'open'); the other three each fail against it.
    it.each(['open', 'dibs_pending', 'completed', 'cancelled'])(
      'leaves a %s ask as it is when its matched exchange is cancelled', async (status) => {
        const q = await ask(status);
        const m = await match(q, H, 'matched');
        expect((await cancel(H, m)).status).toBe(200);
        expect((await matchRow(m)).status).toBe('cancelled');
        expect(await askStatus(q)).toBe(status);
      });

    it('leaves a withdrawn offer withdrawn', async () => {
      const q = await ask('matched');
      const o = await offer('withdrawn');
      const m = await match(q, H, 'matched', { offerId: o });
      expect((await cancel(H, m)).status).toBe(200);
      expect(await offerStatus(o)).toBe('withdrawn');
      expect(await askStatus(q)).toBe('open');
    });
  });

  describe('complete', () => {
    it.each(['proposed', 'rejected', 'cancelled'])(
      'refuses a mark on a %s match with 409 MATCH_NOT_COMPLETABLE and stamps nothing', async (status) => {
        const q = await ask('open');
        const m = await match(q, H, status);
        const res = await complete(R, m);
        expect(res.status).toBe(409);
        expect(res.body).toEqual({
          success: false, message: 'Only an exchange in progress can be marked done', error: 'MATCH_NOT_COMPLETABLE',
        });
        const after = await matchRow(m);
        expect(after.status).toBe(status);
        expect(after.requester_done_at).toBeNull();
      });

    it('still records a first mark on an exchange in progress', async () => {
      const q = await ask('matched');
      const m = await match(q, H, 'matched');
      const res = await complete(R, m);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ fully_completed: false, waiting_for: 'helper' });
      const after = await matchRow(m);
      expect(after.status).toBe('matched');
      expect(after.requester_done_at).not.toBeNull();
    });

    it('keeps the idempotent 200 for an already-completed match and stamps nothing', async () => {
      const q = await ask('completed');
      const m = await match(q, H, 'completed');
      const res = await complete(R, m);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ fully_completed: true, waiting_for: null });
      expect((await matchRow(m)).requester_done_at).toBeNull();
    });
  });

  describe('the guard is in the write, not in the read before it', () => {
    it('refuses a cancel that waited on a concurrent completion; the completion stands', async () => {
      const q = await ask('matched');
      const m = await match(q, H, 'matched', { requesterDone: true });
      const res = await whileHeld(
        "UPDATE requests.matches SET status = 'completed', responder_done_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP WHERE id = $1",
        m, () => cancel(R, m));
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('MATCH_NOT_CANCELLABLE');
      expect((await matchRow(m)).status).toBe('completed');
      expect(await askStatus(q)).toBe('matched');
    });

    it('refuses a final mark that waited on a concurrent cancel; nothing is completed', async () => {
      const q = await ask('matched');
      const m = await match(q, H, 'matched', { requesterDone: true });
      const res = await whileHeld("UPDATE requests.matches SET status = 'cancelled' WHERE id = $1", m, () => complete(H, m));
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('MATCH_NOT_COMPLETABLE');
      const after = await matchRow(m);
      expect(after.status).toBe('cancelled');
      expect(after.responder_done_at).toBeNull();
      expect(after.completed_at).toBeNull();
      expect(await askStatus(q)).toBe('matched');
    });

    it('answers a final mark that waited on a concurrent completion with the idempotent 200: no re-stamp, no second publication', async () => {
      const q = await ask('matched');
      const m = await match(q, H, 'matched', { requesterDone: true });
      const before = (await pool.query('SELECT requester_done_at::text AS r FROM requests.matches WHERE id = $1', [m])).rows[0].r;
      // The holder completes the match with fixed literal times (the column is `timestamp without time zone`)
      // and publishes nothing, so any match_completed effect for `m` below can only come from the HTTP call.
      const res = await whileHeld(
        "UPDATE requests.matches SET status = 'completed', responder_done_at = TIMESTAMP '2026-10-01 10:00:00', completed_at = TIMESTAMP '2026-10-01 10:00:00' WHERE id = $1",
        m, () => complete(H, m));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true, data: { fully_completed: true, waiting_for: null }, message: 'Match already completed',
      });
      const after = (await pool.query(`SELECT status, requester_done_at::text AS r,
          responder_done_at = TIMESTAMP '2026-10-01 10:00:00' AS done_kept,
          completed_at = TIMESTAMP '2026-10-01 10:00:00' AS completed_kept
        FROM requests.matches WHERE id = $1`, [m])).rows[0];
      expect(after).toEqual({ status: 'completed', r: before, done_kept: true, completed_kept: true });

      // Positive control: a genuine two-party completion published AFTER the race on the same transport.
      // Once its effects land, a publication by the race call (enqueued earlier) would have landed too.
      const cq = await ask('matched');
      const cm = await match(cq, H2, 'matched');
      expect((await complete(H2, cm)).status).toBe(200);
      expect((await complete(R, cm)).body.data.fully_completed).toBe(true);
      const count = async (sql: string, id: string) => Number((await pool.query(sql, [id])).rows[0].count);
      const effectsOf = async (matchId: string, askId: string) => ({
        karma: await count('SELECT COUNT(*) FROM reputation.karma_records WHERE related_entity_id = $1', matchId),
        notified: await count("SELECT COUNT(*) FROM notifications.notifications WHERE type = 'match_completed' AND data->>'match_id' = $1", matchId),
        feed: await count("SELECT COUNT(*) FROM requests.feed_events WHERE request_id = $1 AND event_type = 'match_completed'", askId),
      });
      let control = await effectsOf(cm, cq);
      for (let retry = 0; retry < 40 && !(control.karma > 0 && control.notified > 0 && control.feed > 0); retry++) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        control = await effectsOf(cm, cq);
      }
      expect(control.karma).toBeGreaterThan(0);
      expect(control.notified).toBeGreaterThan(0);
      expect(control.feed).toBeGreaterThan(0);
      expect(await effectsOf(m, q)).toEqual({ karma: 0, notified: 0, feed: 0 });
    });
  });
});
