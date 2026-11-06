/**
 * Sprint 137 (BUG-088..091): exchange integrity. Real JWT, request service over HTTP, cleanup-service's expiration job run
 * directly, real PostgreSQL. Missing infrastructure is a failure, never a skip.
 *
 * Proofs (spec docs/superpowers/specs/2026-11-04-sprint-137-exchange-integrity-design.md, "Tests"):
 * - D1, BUG-088. One markExpiredData() run over four asks. A flagged ask has three proposals: one holds a matched offer,
 *   one's offer was withdrawn, one has no offer. All three are rejected, the held offer is active again, and the
 *   withdrawn offer's row is not written. Its unexpired twin and a flagged ask the requester cancelled are untouched.
 *   An ask past expires_at that the sweep had not flagged is flagged and released in the same run. The flagged ask's
 *   own row is not written at all: updated_at is identical before and after, and so are its ctid and xmin (D writes
 *   no help_requests row, so the hard-delete clock does not move).
 * - The D1 race. A second client holds the requester's uncommitted cancel of a flagged ask. The sweep's D1 lock
 *   statement waits on it (pg_blocking_pids, never a sleep). After the commit the sweep skips the ask: its proposal and
 *   its offer are unchanged, row version included.
 * - Shared offers (decision 10, Codex finding 1). The fixtures are inserted with SQL, since after B1 no route can build
 *   them: one matched offer backs two matches on two asks. Each release path ends its own reference: D1 (via
 *   markExpiredData), match reject, match cancel, and closeProposals (via match accept). Each leaves the offer
 *   unwritten while the other reference is proposed, matched or completed. Then the last reference ends and the
 *   offer is freed:
 *   - a proposal, ended by the path under test (match cancel cannot end a proposal, so reject, which shares its
 *     releaseOffer);
 *   - a matched exchange, ended by match cancel;
 *   - a completed exchange, which never ends at runtime: the offer stays matched through another sweep. Only once a
 *     fixture delete cascades the completed match away does the next sweep's D2 free it.
 * - D2. A matched offer with no match row is freed, and so is one whose only matches are rejected or cancelled. An
 *   offer backing a completed, proposed or matched match is not written.
 * - I1 snapshot barriers (CI-only). The shipped D2 statement, run by releaseExpiredHolds(), is paused after its
 *   statement snapshot is taken and before any row is updated. Two cases:
 *   1. While it is paused, the owner's PUT /offers/:id title edit commits a new version of its stranded offer. Resumed,
 *      it skips that version (0 freed); a fresh sweep then frees it (1 freed).
 *   2. While it is paused, a second sweep frees the stranded unexpired offer (1 freed), and a real POST /matches
 *      re-holds it from active and commits a proposal. Resumed, the delayed D2 skips the newer version (0 freed): the
 *      offer stays matched and the proposal stays proposed.
 *   Case 1 also proves the barrier pauses after snapshot acquisition. Had the delayed statement taken its snapshot
 *   after the resume, it would have seen the edited version with nothing holding it, and freed it. So case 2's pass is
 *   down to the version predicate, not to a late snapshot that sees the new proposal.
 * - B, BUG-089. PUT /offers/:id with a status answers 400 STATUS_NOT_EDITABLE and leaves the row unwritten. POST
 *   /matches with an offer the sweep flagged answers 400 from the fast path. With an offer past expires_at that the
 *   sweep has not flagged, it answers 400 at the hold, because the fast path reads only the flag. Both write no
 *   proposal and leave the offer active and unwritten. An unexpired offer is still held (positive control).
 * - C, BUG-090. POST /providers/offers on an ask past expires_at but not flagged answers 409 REQUEST_NOT_OPEN at the
 *   lock, with no provider.offers row. While a second client holds an uncommitted cancel, the submit waits on the
 *   request lock (pg_blocking_pids), then answers 409 and writes nothing. The unexpired twin answers 201.
 * - A, BUG-091. PUT /requests/:id answers 409 REQUEST_CLOSED for a completed ask (title unchanged) and a cancelled ask.
 *   Two forgotten asks answer 409 with their sentinel intact:
 *   - one whose rows derive to completed, refused by the derived-status check;
 *   - one whose rows derive to open (stored 'completed', no completed match), refused only by the UPDATE's
 *     content_forgotten_at IS NULL.
 *   Open and matched asks answer 200 and are edited.
 *
 * The I1 barrier, and which backend runs D2. releaseExpiredHolds() runs D2 through cleanup-service's query(), which is
 * pool.query() on cleanup-service's own pg Pool (services/cleanup-service/src/database/db.ts). Production code is
 * untouched; the test only uses that pool's public API.
 * - The waiter's pid. The coordinator checks a client out of that same pool, records pg_backend_pid(), and releases
 *   it. pg-pool 3.14 keeps idle clients in a LIFO stack: release pushes (node_modules/pg-pool/index.js:427), checkout
 *   pops (:158). releaseExpiredHolds() runs its statements one at a time: the candidate read, any D1 transaction,
 *   then D2. Nothing else uses the pool meanwhile, so every one of those checkouts takes that same client, and D2 runs
 *   on the recorded pid.
 * - The gate. A fixture-only BEFORE UPDATE ... FOR EACH STATEMENT trigger on requests.help_offers runs a function that
 *   blocks only when two things hold:
 *   - pg_backend_pid() is the recorded pid;
 *   - the client's statement (current_query()) is D2: it names visible_offer and, unlike D1's copy, has no "o.id IN".
 *   It then takes pg_advisory_xact_lock_shared on a key the coordinator holds exclusively. A statement-level BEFORE
 *   trigger fires in ExecModifyTable, after the portal has pushed the statement snapshot and before the first row is
 *   fetched. The function's own PERFORM takes its own snapshot and does not replace the outer statement's. (This is
 *   PostgreSQL 15 source reasoning, as in spec B5. It is checked only when CI runs this file, and I1 case 1 is the
 *   check: see above.)
 * - Everything else bypasses it: the second sweep, which the paused one forces onto another pooled client, and
 *   request-service's backends (title edit, hold). The test proves it: those calls complete while the waiter is still
 *   blocked, and the coordinator blocks exactly one pid, the waiter.
 * - Cleanup. The function and trigger are created per case under random names. The finally block releases the
 *   coordinator's advisory lock first, then waits for the delayed sweep to finish, then drops the trigger and the
 *   function. A DROP TRIGGER issued while the waiter still held its lock on help_offers would wait on it.
 * - Fail-closed. If the pin missed, or D2's text stopped matching, nothing pauses, and the wait proof fails instead of
 *   passing.
 * - Exact counts. Each I1 case first runs one sweep to drain stranded offers left by other fixtures, so the counts
 *   above are exact. Tests run serially (jest.integration.config.js, maxWorkers 1).
 *
 * Fails before (all REASONED, none run: there is no PostgreSQL on the Windows box, and CI runs this file only against
 * the fixed code). Production code before Sprint 137 is f19ca413 (v11.109.0).
 * - D1: markExpiredData only flagged. The proposals stay proposed and the held offers stay matched.
 * - The D1 race: a release without the re-check under the lock rejects the proposal of an ask that is now cancelled.
 * - Shared offers:
 *   - match reject, match cancel and closeProposals freed the offer of the match they ended whatever else held it, so
 *     it turns active while the other reference lives;
 *   - D1 did not exist, so its shared cases fail the rejection assertion.
 * - D2's frees: no sweep freed a stranded offer.
 * - I1 cases: against D2 without the CTID predicate, the statement as first planned, EvalPlanQual rechecks the newer
 *   version. It is still matched, and the anti-join keeps the old snapshot, so it frees it: 1 freed, and the offer is
 *   active under the new proposal.
 * - B:
 *   - PUT wrote any status (200, offer active);
 *   - findOwnOffer did not read the flag and the hold had no expiry arms, so both expired cases answered 201 with a
 *     proposal.
 * - C:
 *   - the fast path read only the flag and the insert ran on the pool (201);
 *   - in the race the insert's foreign-key check takes FOR KEY SHARE, which the cancel's FOR NO KEY UPDATE does not
 *     block, so it never waits, and the wait proof fails.
 * - A: PUT edited an ask in any status (200, and the forgotten sentinel overwritten).
 * - Positive controls pass before too: the twins, the kept offers, the open and matched edits, and the unexpired hold.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { createPool, ServiceUrls } from '../fixtures';
// D's cases run cleanup-service's job directly, as sprint-136-request-followups runs its retention job.
import cleanupPool from '../../services/cleanup-service/src/database/db';
import { markExpiredData, releaseExpiredHolds } from '../../services/cleanup-service/src/jobs/expirationJob';

describe('Sprint 137 exchange integrity', () => {
  const pool = createPool();
  // R requester; H, H2, H3 helpers; P provider. All active members of Cm.
  const R = randomUUID(), H = randomUUID(), H2 = randomUUID(), H3 = randomUUID(), P = randomUUID();
  const users = [R, H, H2, H3, P];
  const Cm = randomUUID();
  let providerProfile = '';
  const asks: string[] = [];
  const offers: string[] = [];

  const bearer = (id: string) => `Bearer ${jwt.sign({ userId: id, email: `${id}@karmyq.test`, communities: [] }, process.env.JWT_SECRET || 'dev-secret-key')}`;
  // `.then` starts the request, so a race case can hold it in flight.
  const call = (method: 'put' | 'post' | 'delete', path: string, as: string, body: object = {}) =>
    request(ServiceUrls.REQUEST)[method](path).set('Authorization', bearer(as)).send(body).then((res) => res);
  const offerHelp = (q: string, offerId: string) => call('post', '/matches', H, { request_id: q, offer_id: offerId });
  const accept = (m: string) => call('put', `/matches/${m}/accept`, R);
  const reject = (m: string) => call('put', `/matches/${m}/reject`, H);
  const cancelMatch = (m: string) => call('delete', `/matches/${m}`, H);
  const editOffer = (o: string, body: object) => call('put', `/offers/${o}`, H, body);
  const submitProviderOffer = (q: string) => call('post', '/providers/offers', P, { request_id: q, price: 10, note: 'Sprint 137 provider offer' });
  const editAsk = (q: string, title: string) => call('put', `/requests/${q}`, R, { title });
  /** Status and body together, so a CI failure prints the body that came back. */
  const answer = (res: request.Response) => ({ status: res.status, body: res.body });

  const REJECTED = { success: true, message: 'Match rejected successfully' };
  const CANCELLED = { success: true, message: 'Match cancelled successfully' };
  const OFFER_NOT_ACTIVE = { success: false, message: 'Offer is not active', error: 'OFFER_NOT_ACTIVE' };
  const STATUS_NOT_EDITABLE = { success: false, message: "An offer's status changes through its exchanges, not an edit", error: 'STATUS_NOT_EDITABLE' };
  const PROVIDER_NOT_OPEN = { success: false, message: 'This request is no longer open', error: 'REQUEST_NOT_OPEN' };
  const REQUEST_CLOSED = { success: false, message: "A completed or cancelled request can't be edited", error: 'REQUEST_CLOSED' };
  /** The requester's cancel, held uncommitted by a second client in the race cases (as Sprint 136's race does). */
  const UNCOMMITTED_CANCEL = "UPDATE requests.help_requests SET status = 'cancelled' WHERE id = $1";

  type Expiry = 'flagged' | 'past' | 'future';
  /**
   * An ask, created and last updated two days ago. 'flagged' is what the sweep leaves (expired = TRUE, expires_at past);
   * 'past' is past its expiry before the sweep runs (expired = FALSE, expires_at past); 'future' is the unexpired twin. The
   * one-day margins hold whatever the session time zone: markExpiredData compares expires_at, a timestamp without time
   * zone, to a UTC ISO string. Status parameters are cast to varchar.
   */
  async function ask(expiry: Expiry, status = 'open'): Promise<string> {
    const id = randomUUID();
    await pool.query(`INSERT INTO requests.help_requests
      (id,requester_id,title,description,category,request_type,visibility_scope,status,expired,expires_at,created_at,updated_at)
      VALUES ($1,$2,'Sprint 137 ask','Fixture','generic','generic','community',$3::varchar,$4::boolean,
              CASE WHEN $5::text = 'future' THEN NOW() + INTERVAL '1 day' ELSE NOW() - INTERVAL '1 day' END,
              NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days')`,
    [id, R, status, expiry === 'flagged', expiry]);
    await pool.query('INSERT INTO requests.request_communities(request_id,community_id) VALUES ($1,$2)', [id, Cm]);
    asks.push(id);
    return id;
  }
  type OfferExpiry = 'unexpired' | 'past' | 'flagged';
  /** A standing offer. 'flagged' is what the sweep leaves; 'past' is past expires_at before the sweep runs. */
  async function offer(owner: string, status: string, expiry: OfferExpiry = 'unexpired'): Promise<string> {
    const id = randomUUID();
    await pool.query(`INSERT INTO requests.help_offers (id,community_id,offerer_id,title,description,category,status,expired,expires_at)
      VALUES ($1,$2,$3,'Sprint 137 offer','Fixture','generic',$4::varchar,$5::boolean,
              CASE WHEN $6::text = 'unexpired' THEN NOW() + INTERVAL '30 days' ELSE NOW() - INTERVAL '1 day' END)`,
    [id, Cm, owner, status, expiry === 'flagged', expiry]);
    offers.push(id);
    return id;
  }
  async function match(requestId: string, responder: string, status: string, offerId: string | null = null): Promise<string> {
    const { rows } = await pool.query(`INSERT INTO requests.matches (request_id,responder_id,offer_id,status,completed_at)
      VALUES ($1,$2,$3,$4::varchar,CASE WHEN $4::varchar = 'completed' THEN CURRENT_TIMESTAMP END) RETURNING id`,
    [requestId, responder, offerId, status]);
    return rows[0].id;
  }
  /** A forgotten ask, as memoryRetentionJob leaves it: sentinel text and content_forgotten_at stamped. */
  async function forget(id: string): Promise<void> {
    await pool.query(`UPDATE requests.help_requests SET title = '[forgotten]', description = '[forgotten]', payload = '{}'::jsonb,
      content_forgotten_at = NOW() WHERE id = $1`, [id]);
  }

  // `version` is the physical row version: an UPDATE of the row changes it, a row lock (FOR UPDATE, FOR KEY SHARE) does
  // not. Equal versions before and after prove a statement did not write the row.
  const VERSION = `ctid::text || '@' || xmin::text AS version`;
  const one = async (sql: string, id: string) => (await pool.query(sql, [id])).rows[0];
  const askRow = (id: string) =>
    one(`SELECT status, expired, title, description, updated_at::text AS updated_at, ${VERSION} FROM requests.help_requests WHERE id = $1`, id);
  const offerRow = (id: string) =>
    one(`SELECT status, title, updated_at::text AS updated_at, ${VERSION} FROM requests.help_offers WHERE id = $1`, id);
  const matchRow = (id: string) =>
    one(`SELECT status, offer_id, updated_at::text AS updated_at, ${VERSION} FROM requests.matches WHERE id = $1`, id);
  const offerStatus = async (id: string) => (await offerRow(id)).status;
  const matchStatus = async (id: string) => (await matchRow(id)).status;
  const matchesOn = async (requestId: string) => (await pool.query(
    'SELECT id, responder_id, status, offer_id FROM requests.matches WHERE request_id = $1 ORDER BY id', [requestId])).rows;
  const providerOffersOn = async (requestId: string) => (await pool.query(
    'SELECT id, status FROM provider.offers WHERE request_id = $1 ORDER BY id', [requestId])).rows;

  /**
   * The sessions waiting on the holder, with the statement each is running: blocked by it directly, or blocked by a pid
   * it blocks (the tuple-lock queue, Sprint 136 note 14).
   */
  async function waitingOn(holderPid: number): Promise<Array<{ pid: number; query: string }>> {
    const { rows } = await pool.query(
      `WITH w AS (SELECT DISTINCT l.pid, pg_blocking_pids(l.pid) AS blockers FROM pg_locks l WHERE NOT l.granted)
       SELECT w.pid, a.query FROM w JOIN pg_stat_activity a ON a.pid = w.pid
       WHERE $1::int = ANY(w.blockers)
          OR EXISTS (SELECT 1 FROM w w2 WHERE w2.pid = ANY(w.blockers) AND $1::int = ANY(w2.blockers))
       ORDER BY w.pid`, [holderPid]);
    return rows;
  }
  /** Polls pg_locks against a deadline, never a fixed sleep, until exactly `n` sessions wait on the holder. */
  async function untilWaiting(holderPid: number, n: number) {
    let waiting: Array<{ pid: number; query: string }> = [];
    for (const deadline = Date.now() + 10_000; waiting.length < n && Date.now() < deadline;) {
      waiting = await waitingOn(holderPid);
      if (waiting.length < n) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(waiting).toHaveLength(n);
    return waiting;
  }
  /**
   * Holds `holderSql` on one row in an open transaction and starts `pending`. Proves exactly one session then waits on
   * the holder, then commits. Returns what `pending` resolved to and the statement that waited.
   */
  async function whileHeld<T>(holderSql: string, rowId: string, pending: () => Promise<T>): Promise<{ result: T; waited: string }> {
    const holder = await pool.connect();
    try {
      await holder.query('BEGIN');
      const pid = Number((await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
      await holder.query(holderSql, [rowId]);
      const inFlight = pending();
      inFlight.catch(() => undefined); // a late rejection must not outlive a failed wait proof
      const [waiter] = await untilWaiting(pid, 1);
      await holder.query('COMMIT');
      return { result: await inFlight, waited: waiter.query };
    } catch (err) {
      await holder.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      holder.release();
    }
  }

  /** The waiter's state, polled until the coordinator blocks it (pg_blocking_pids) or a deadline passes. */
  async function pausedOn(waiterPid: number, coordinatorPid: number) {
    let row: { blocked: boolean; wait_event_type: string | null; wait_event: string | null; query: string } | undefined;
    for (const deadline = Date.now() + 10_000; Date.now() < deadline;) {
      row = (await pool.query(
        `SELECT $2::int = ANY(pg_blocking_pids($1::int)) AS blocked, wait_event_type, wait_event, query
           FROM pg_stat_activity WHERE pid = $1`, [waiterPid, coordinatorPid])).rows[0];
      if (row?.blocked) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return row;
  }
  type SweepCounts = Awaited<ReturnType<typeof releaseExpiredHolds>>;
  /**
   * Runs the shipped releaseExpiredHolds() on a pinned cleanup-pool backend and pauses its D2 statement at the fixture
   * barrier (header: "The I1 barrier"). Runs `during` while D2 is paused, proves it is still paused, then resumes it and
   * returns its counts. The trigger, the function and the coordinator's lock never outlive the case.
   */
  async function withPausedSweep(during: () => Promise<void>): Promise<SweepCounts> {
    const tag = randomUUID().replace(/-/g, '').slice(0, 12);
    const fn = `requests.s137_d2_barrier_${tag}`, trigger = `s137_d2_barrier_${tag}`;
    const key = Number.parseInt(tag.slice(0, 11), 16);
    // Pin: the pool's most recently released client runs every statement of the next releaseExpiredHolds().
    const pinned = await cleanupPool.connect();
    let waiterPid = 0;
    try {
      waiterPid = Number((await pinned.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
    } finally {
      pinned.release();
    }
    expect(Number.isInteger(waiterPid) && waiterPid > 0).toBe(true);
    const coordinator = await pool.connect();
    let delayed: Promise<SweepCounts> | undefined;
    try {
      const coordinatorPid = Number((await coordinator.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
      await coordinator.query('SELECT pg_advisory_lock($1::bigint)', [key]);
      // The lock is held before the barrier exists, so the barrier is never armed without it.
      await pool.query(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $barrier$
        BEGIN
          IF pg_backend_pid() = ${waiterPid}
             AND strpos(current_query(), 'visible_offer') > 0 AND strpos(current_query(), 'o.id IN') = 0 THEN
            PERFORM pg_advisory_xact_lock_shared(${key});
          END IF;
          RETURN NULL;
        END $barrier$`);
      await pool.query(`CREATE TRIGGER ${trigger} BEFORE UPDATE ON requests.help_offers
        FOR EACH STATEMENT EXECUTE FUNCTION ${fn}()`);

      let settled = false;
      delayed = releaseExpiredHolds();
      delayed.then(() => { settled = true; }, () => { settled = true; });

      // The paused statement is the shipped D2, on the pinned backend, waiting on the coordinator's advisory lock.
      const paused = await pausedOn(waiterPid, coordinatorPid);
      expect(paused).toMatchObject({ blocked: true, wait_event_type: 'Lock', wait_event: 'advisory' });
      expect(paused!.query).toMatch(/^UPDATE requests\.help_offers o SET status = 'active'/);
      expect(paused!.query).toContain('visible_offer');
      expect(paused!.query).not.toContain('o.id IN');
      expect(settled).toBe(false);

      await during();

      // Every intervening writer bypassed the barrier: they completed, the delayed D2 is still paused, and the
      // coordinator blocks exactly one session, the waiter.
      expect(await pausedOn(waiterPid, coordinatorPid)).toMatchObject({ blocked: true });
      expect((await waitingOn(coordinatorPid)).map((w) => w.pid)).toEqual([waiterPid]);
      expect(settled).toBe(false);

      await coordinator.query('SELECT pg_advisory_unlock($1::bigint)', [key]);
      return await delayed;
    } finally {
      await coordinator.query('SELECT pg_advisory_unlock_all()').catch(() => undefined);
      coordinator.release();
      // Resumed first: a DROP TRIGGER would wait on the paused statement's lock on help_offers.
      await delayed?.catch(() => undefined);
      await pool.query(`DROP TRIGGER IF EXISTS ${trigger} ON requests.help_offers`);
      await pool.query(`DROP FUNCTION IF EXISTS ${fn}()`);
    }
  }

  beforeAll(async () => {
    await pool.query('SELECT 1');
    expect((await request(ServiceUrls.REQUEST).get('/health')).status).toBe(200);
    for (const id of users) {
      await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)',
        [id, `Sprint 137 ${id.slice(0, 8)}`, `${id}@karmyq.test`, 'not-a-login']);
    }
    await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4)',
      [Cm, `Sprint 137 ${Cm}`, 'Fixture', R]);
    for (const id of users) {
      await pool.query(`INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'member','active')`, [id, Cm]);
    }
    providerProfile = (await pool.query(`INSERT INTO requests.provider_profiles (user_id,service_type,display_name)
      VALUES ($1,'generic','Sprint 137 provider') RETURNING id`, [P])).rows[0].id;
  });

  afterAll(async () => {
    try {
      // Children before parents. Route side effects (provider offers, feed events, notifications) are keyed on our
      // asks and users; matches cascade from their asks too, but go first so no offer is still referenced.
      await pool.query('DELETE FROM provider.offers WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM requests.matches WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM requests.feed_events WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM notifications.notifications WHERE user_id = ANY($1::uuid[])', [users]);
      // help_offers.community_id and offerer_id have no ON DELETE CASCADE: clear them before the community and users.
      await pool.query('DELETE FROM requests.help_offers WHERE id = ANY($1::uuid[])', [offers]);
      await pool.query('DELETE FROM requests.request_communities WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM requests.help_requests WHERE id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM communities.members WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM communities.communities WHERE id = $1', [Cm]);
      // Cascades the provider profile and anything else keyed on the user.
      await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [users]);
    } finally {
      await cleanupPool.end();
      await pool.end();
    }
  }, 90_000);

  describe("D1: the sweep closes an expired ask's proposals and frees what they held (BUG-088)", () => {
    // One markExpiredData() run over every fixture below; each test reads one part of its outcome.
    const f: Record<string, string> = {};
    const before: Record<string, any> = {};
    beforeAll(async () => {
      f.flagged = await ask('flagged');
      f.heldOffer = await offer(H, 'matched');
      f.withdrawnOffer = await offer(H2, 'withdrawn');
      f.pHeld = await match(f.flagged, H, 'proposed', f.heldOffer);
      f.pWithdrawn = await match(f.flagged, H2, 'proposed', f.withdrawnOffer);
      f.pBare = await match(f.flagged, H3, 'proposed');
      f.twin = await ask('future');
      f.twinOffer = await offer(H, 'matched');
      f.pTwin = await match(f.twin, H, 'proposed', f.twinOffer);
      // Flagged while open, then cancelled: only its status keeps it out of the candidates.
      f.cancelled = await ask('flagged', 'cancelled');
      f.cancelledOffer = await offer(H, 'matched');
      f.pCancelled = await match(f.cancelled, H, 'proposed', f.cancelledOffer);
      f.past = await ask('past');
      f.pastOffer = await offer(H, 'matched');
      f.pPast = await match(f.past, H, 'proposed', f.pastOffer);
      for (const k of ['flagged', 'twin', 'cancelled']) before[k] = await askRow(f[k]);
      for (const k of ['withdrawnOffer', 'twinOffer', 'cancelledOffer']) before[k] = await offerRow(f[k]);
      for (const k of ['pTwin', 'pCancelled']) before[k] = await matchRow(f[k]);
      await markExpiredData();
    });

    it('rejects all three proposals on the flagged ask, frees the held offer and leaves the withdrawn one unwritten', async () => {
      expect([await matchStatus(f.pHeld), await matchStatus(f.pWithdrawn), await matchStatus(f.pBare)])
        .toEqual(['rejected', 'rejected', 'rejected']);
      expect(await offerStatus(f.heldOffer)).toBe('active');
      expect(await offerRow(f.withdrawnOffer)).toEqual(before.withdrawnOffer);
      expect(before.withdrawnOffer.status).toBe('withdrawn');
    });

    it("does not write the flagged ask's row: updated_at, and the row version, are identical before and after", async () => {
      const after = await askRow(f.flagged);
      expect(after.updated_at).toBe(before.flagged.updated_at);
      expect(after).toEqual(before.flagged);
      expect(after).toMatchObject({ status: 'open', expired: true });
    });

    it("leaves the unexpired twin's proposal, offer and row untouched", async () => {
      expect(await matchRow(f.pTwin)).toEqual(before.pTwin);
      expect(before.pTwin.status).toBe('proposed');
      expect(await offerRow(f.twinOffer)).toEqual(before.twinOffer);
      expect(await askRow(f.twin)).toEqual(before.twin);
    });

    it('leaves a flagged ask the requester cancelled untouched', async () => {
      expect(await matchRow(f.pCancelled)).toEqual(before.pCancelled);
      expect(await offerRow(f.cancelledOffer)).toEqual(before.cancelledOffer);
      expect(before.cancelledOffer.status).toBe('matched');
      expect(await askRow(f.cancelled)).toEqual(before.cancelled);
    });

    it('flags an ask past expires_at that the sweep had not flagged, and releases it in the same run', async () => {
      expect(await askRow(f.past)).toMatchObject({ status: 'open', expired: true });
      expect(await matchStatus(f.pPast)).toBe('rejected');
      expect(await offerStatus(f.pastOffer)).toBe('active');
    });
  });

  describe('the D1 race', () => {
    it("waits on the requester's uncommitted cancel, then skips the cancelled ask and writes nothing for it", async () => {
      const q = await ask('flagged');
      const o = await offer(H, 'matched');
      const p = await match(q, H, 'proposed', o);
      const beforeAsk = await askRow(q), beforeMatch = await matchRow(p), beforeOffer = await offerRow(o);
      const { waited } = await whileHeld(UNCOMMITTED_CANCEL, q, () => markExpiredData());
      // The statement that waited is D1's lock, not the flag statement (this ask was already flagged).
      expect(waited).toContain("FROM requests.help_requests WHERE id = $1 AND expired = TRUE AND status = 'open' FOR UPDATE");
      expect(await askRow(q)).toMatchObject({ status: 'cancelled', expired: true, updated_at: beforeAsk.updated_at });
      expect(await matchRow(p)).toEqual(beforeMatch);
      expect(await offerRow(o)).toEqual(beforeOffer);
    });
  });

  describe('a shared offer is freed only by its last reference (decision 10)', () => {
    type Other = 'proposed' | 'matched' | 'completed';
    interface ReleasePath {
      /** Makes the first reference to `o` and ends it through this path; returns it and the status it must reach. */
      releaseFirst: (o: string) => Promise<{ first: string; status: string }>;
      /** Ends the other reference, proposal `m2` on `q2`, through this path. */
      endProposal: (q2: string, m2: string) => Promise<void>;
    }
    const expectAccepted = (res: request.Response, m: string) => expect(answer(res)).toMatchObject(
      { status: 200, body: { success: true, message: 'Match accepted successfully', data: { id: m, status: 'matched' } } });
    const releasePaths: Array<[string, ReleasePath]> = [
      ['D1, the expiration sweep', {
        releaseFirst: async (o) => {
          const first = await match(await ask('flagged'), H, 'proposed', o);
          await markExpiredData();
          return { first, status: 'rejected' };
        },
        // The ask passes its expiry; the next sweep flags it and its D1 closes the proposal.
        endProposal: async (q2) => {
          await pool.query("UPDATE requests.help_requests SET expires_at = NOW() - INTERVAL '1 day' WHERE id = $1", [q2]);
          await markExpiredData();
        },
      }],
      ['match reject', {
        releaseFirst: async (o) => {
          const first = await match(await ask('future'), H, 'proposed', o);
          expect(answer(await reject(first))).toEqual({ status: 200, body: REJECTED });
          return { first, status: 'rejected' };
        },
        endProposal: async (_q2, m2) => { expect(answer(await reject(m2))).toEqual({ status: 200, body: REJECTED }); },
      }],
      ['match cancel', {
        releaseFirst: async (o) => {
          const first = await match(await ask('future', 'matched'), H, 'matched', o);
          expect(answer(await cancelMatch(first))).toEqual({ status: 200, body: CANCELLED });
          return { first, status: 'cancelled' };
        },
        // Cancel cannot end a proposal; reject frees through the same releaseOffer.
        endProposal: async (_q2, m2) => { expect(answer(await reject(m2))).toEqual({ status: 200, body: REJECTED }); },
      }],
      ['closeProposals, through match accept', {
        releaseFirst: async (o) => {
          const q1 = await ask('future');
          const first = await match(q1, H, 'proposed', o);
          const chosen = await match(q1, H2, 'proposed');
          expectAccepted(await accept(chosen), chosen);
          return { first, status: 'rejected' };
        },
        endProposal: async (q2) => {
          const chosen = await match(q2, H2, 'proposed');
          expectAccepted(await accept(chosen), chosen);
        },
      }],
    ];

    describe.each<[string, ReleasePath]>(releasePaths)('%s', (_name, path) => {
      it.each<Other>(['proposed', 'matched', 'completed'])(
        'leaves the offer matched while its other reference is %s, and the end of the last reference frees it', async (other) => {
          // Fixture-only state (BUG-089 legacy rows): one matched offer backing two matches on two asks.
          const o = await offer(H, 'matched');
          const q2 = await ask('future', other === 'proposed' ? 'open' : other);
          const m2 = await match(q2, H, other, o);
          const held = await offerRow(o);

          const { first, status } = await path.releaseFirst(o);
          expect(await matchStatus(first)).toBe(status);
          expect(await offerRow(o)).toEqual(held); // not written: still matched, same version, same updated_at
          expect(await matchStatus(m2)).toBe(other);

          if (other === 'proposed') {
            await path.endProposal(q2, m2);
            expect(await matchStatus(m2)).toBe('rejected');
          } else if (other === 'matched') {
            expect(answer(await cancelMatch(m2))).toEqual({ status: 200, body: CANCELLED });
            expect(await matchStatus(m2)).toBe('cancelled');
          } else {
            // A completed exchange is final: another sweep (D1 and D2) leaves the offer as it was.
            await markExpiredData();
            expect(await offerRow(o)).toEqual(held);
            // Only a cascade removes a completed match. Once it is gone, the next sweep's D2 frees the offer.
            await pool.query('DELETE FROM requests.help_requests WHERE id = $1', [q2]);
            expect(await matchesOn(q2)).toEqual([]);
            await markExpiredData();
          }
          expect(await offerStatus(o)).toBe('active');
        });
    });
  });

  describe('D2: the sweep frees stranded holds (BUG-088)', () => {
    it('frees a matched offer that no match row references', async () => {
      const o = await offer(H, 'matched');
      await markExpiredData();
      expect(await offerStatus(o)).toBe('active');
    });

    it('frees a matched offer whose only matches are rejected or cancelled', async () => {
      const o = await offer(H, 'matched');
      await match(await ask('future'), H, 'rejected', o);
      await match(await ask('future'), H, 'cancelled', o);
      await markExpiredData();
      expect(await offerStatus(o)).toBe('active');
    });

    it.each(['completed', 'proposed', 'matched'])('does not write an offer that backs a %s match', async (status) => {
      const o = await offer(H, 'matched');
      await match(await ask('future', status === 'proposed' ? 'open' : status), H, status, o);
      const held = await offerRow(o);
      await markExpiredData();
      expect(await offerRow(o)).toEqual(held);
    });

    describe('I1: a delayed D2 frees only the offer version its snapshot saw (CI-only snapshot barrier)', () => {
      const RENAMED = 'Sprint 137 offer, renamed while D2 was paused';

      it('skips an offer whose metadata changed while it was paused; the next sweep frees it', async () => {
        await releaseExpiredHolds(); // drain stranded offers left by other fixtures, so the counts below are exact
        const o = await offer(H, 'matched'); // stranded: no match references it
        const delayed = await withPausedSweep(async () => {
          expect(answer(await editOffer(o, { title: RENAMED }))).toMatchObject(
            { status: 200, body: { success: true, message: 'Offer updated successfully', data: { id: o, status: 'matched', title: RENAMED } } });
        });
        expect(delayed.strandedOffersFreed).toBe(0);
        expect(await offerRow(o)).toMatchObject({ status: 'matched', title: RENAMED });
        const fresh = await releaseExpiredHolds();
        expect(fresh.strandedOffersFreed).toBe(1);
        expect(await offerStatus(o)).toBe('active');
      });

      it('skips an offer another sweep freed and POST /matches re-held; the new hold and its proposal survive', async () => {
        await releaseExpiredHolds(); // drain, as above
        const q = await ask('future');
        const o = await offer(H, 'matched'); // stranded and unexpired, so the hold can take it again
        let proposal = '';
        const delayed = await withPausedSweep(async () => {
          // A second sweep on another pooled backend bypasses the barrier and frees the offer.
          expect((await releaseExpiredHolds()).strandedOffersFreed).toBe(1);
          expect(await offerStatus(o)).toBe('active');
          // The real hold re-takes it from active and commits a proposal.
          const res = await offerHelp(q, o);
          expect(answer(res)).toMatchObject({ status: 201, body: { success: true, data: { request_id: q, offer_id: o, responder_id: H, status: 'proposed' } } });
          proposal = res.body.data.id;
          expect(await offerStatus(o)).toBe('matched');
        });
        expect(delayed.strandedOffersFreed).toBe(0);
        expect(await offerStatus(o)).toBe('matched');
        expect(await matchesOn(q)).toEqual([{ id: proposal, responder_id: H, status: 'proposed', offer_id: o }]);
        expect((await askRow(q)).status).toBe('open');
      });
    });
  });

  describe("B: an offer's status follows its exchanges (BUG-089)", () => {
    it('PUT /offers/:id with a status answers 400 STATUS_NOT_EDITABLE and writes nothing', async () => {
      const o = await offer(H, 'matched');
      const before = await offerRow(o);
      expect(answer(await editOffer(o, { status: 'active', title: 'Sprint 137 edited' }))).toEqual({ status: 400, body: STATUS_NOT_EDITABLE });
      expect(await offerRow(o)).toEqual(before);
    });

    it('POST /matches with an offer the sweep flagged answers 400 OFFER_NOT_ACTIVE and writes nothing', async () => {
      const q = await ask('future');
      const o = await offer(H, 'active', 'flagged');
      const before = await offerRow(o);
      expect(answer(await offerHelp(q, o))).toEqual({ status: 400, body: OFFER_NOT_ACTIVE });
      expect(await matchesOn(q)).toEqual([]);
      expect(await offerRow(o)).toEqual(before);
    });

    // The fast path reads only the flag (findOwnOffer), so this offer reaches the hold, whose clock arm refuses it.
    it('POST /matches with an offer past expires_at that the sweep has not flagged answers 400 at the hold, with no proposal', async () => {
      const q = await ask('future');
      const o = await offer(H, 'active', 'past');
      const before = await offerRow(o);
      expect(answer(await offerHelp(q, o))).toEqual({ status: 400, body: OFFER_NOT_ACTIVE });
      expect(await matchesOn(q)).toEqual([]);
      expect(await offerRow(o)).toEqual(before);
      expect(before).toMatchObject({ status: 'active' });
    });

    it('POST /matches holds an unexpired active offer (positive control)', async () => {
      const q = await ask('future');
      const o = await offer(H, 'active');
      const res = await offerHelp(q, o);
      expect(res.status).toBe(201);
      expect(await matchesOn(q)).toEqual([{ id: res.body.data.id, responder_id: H, status: 'proposed', offer_id: o }]);
      expect(await offerStatus(o)).toBe('matched');
    });
  });

  describe('C: a provider offer is written under the request lock (BUG-090)', () => {
    it('an ask past expires_at that the sweep has not flagged answers 409 REQUEST_NOT_OPEN, with no provider offer', async () => {
      const q = await ask('past');
      expect(answer(await submitProviderOffer(q))).toEqual({ status: 409, body: PROVIDER_NOT_OPEN });
      expect(await providerOffersOn(q)).toEqual([]);
    });

    it('a submit that waited on a concurrent cancel answers 409 and writes no provider offer', async () => {
      const q = await ask('future');
      const { result, waited } = await whileHeld(UNCOMMITTED_CANCEL, q, () => submitProviderOffer(q));
      // The statement that waited is the request lock (requestStatus.ts LOCK_REQUEST), not the fast path's read.
      expect(waited).toContain('FROM requests.help_requests WHERE id = $1 FOR UPDATE');
      expect(answer(result)).toEqual({ status: 409, body: PROVIDER_NOT_OPEN });
      expect(await providerOffersOn(q)).toEqual([]);
      expect((await askRow(q)).status).toBe('cancelled');
    });

    it('the unexpired twin answers 201 with one pending provider offer', async () => {
      const q = await ask('future');
      const res = await submitProviderOffer(q);
      expect(answer(res)).toMatchObject({ status: 201, body: { success: true,
        data: { request_id: q, provider_id: providerProfile, provider_user_id: P, status: 'pending', note: 'Sprint 137 provider offer' } } });
      expect(await providerOffersOn(q)).toEqual([{ id: res.body.data.id, status: 'pending' }]);
    });
  });

  describe("A: a completed or cancelled ask can't be edited (BUG-091)", () => {
    it('a completed ask answers 409 REQUEST_CLOSED and its title is unchanged', async () => {
      const q = await ask('future', 'completed');
      await match(q, H, 'completed');
      const before = await askRow(q);
      expect(answer(await editAsk(q, 'Sprint 137 edited'))).toEqual({ status: 409, body: REQUEST_CLOSED });
      expect(await askRow(q)).toEqual(before);
      expect(before.title).toBe('Sprint 137 ask');
    });

    it('a cancelled ask answers 409 REQUEST_CLOSED and is not written', async () => {
      const q = await ask('future', 'cancelled');
      const before = await askRow(q);
      expect(answer(await editAsk(q, 'Sprint 137 edited'))).toEqual({ status: 409, body: REQUEST_CLOSED });
      expect(await askRow(q)).toEqual(before);
    });

    it('a forgotten ask answers 409 REQUEST_CLOSED and its sentinel stays', async () => {
      const q = await ask('future', 'completed');
      await match(q, H, 'completed');
      await forget(q);
      const before = await askRow(q);
      expect(answer(await editAsk(q, 'Sprint 137 edited'))).toEqual({ status: 409, body: REQUEST_CLOSED });
      expect(await askRow(q)).toEqual(before);
      expect(before).toMatchObject({ title: '[forgotten]', description: '[forgotten]' });
    });

    // Stored 'completed' with no completed match derives to 'open', so the status check passes. Only the UPDATE's
    // content_forgotten_at IS NULL refuses it: spec A step 3, the backstop if a later change forgets another kind of ask.
    it("a forgotten ask whose rows derive to open is refused by the UPDATE's guard, and its sentinel stays", async () => {
      const q = await ask('future', 'completed');
      await forget(q);
      const before = await askRow(q);
      expect(answer(await editAsk(q, 'Sprint 137 edited'))).toEqual({ status: 409, body: REQUEST_CLOSED });
      expect(await askRow(q)).toEqual(before);
      expect(before).toMatchObject({ title: '[forgotten]', description: '[forgotten]' });
    });

    // A matched ask needs a matched match: the status check reads the derived status, not the column.
    it.each<[string, string | null]>([['open', null], ['matched', 'matched']])('an %s ask answers 200 and is edited', async (status, matchOnAsk) => {
      const q = await ask('future', status);
      if (matchOnAsk) await match(q, H, matchOnAsk);
      const title = `Sprint 137 edited while ${status}`;
      expect(answer(await editAsk(q, title))).toMatchObject(
        { status: 200, body: { success: true, message: 'Request updated successfully', data: { id: q, title } } });
      expect((await askRow(q)).title).toBe(title);
    });
  });
});
