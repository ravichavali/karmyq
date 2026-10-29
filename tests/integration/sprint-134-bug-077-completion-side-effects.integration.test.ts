/**
 * Sprint 134 BUG-077 / BUG-079: a completed exchange's reputation job succeeds on its first attempt and runs every live
 * side effect. Real JWT, request and reputation services over HTTP, real PostgreSQL and Bull. Missing infrastructure is
 * a failure, never a skip.
 *
 * Proofs: (1) a two-party completion's karmyq-completion-reputation job completes with no failed attempt, writes the
 * helper's first_helper badge with its display name, and nudges the helper's depth weight 0.60 → 0.61 (trust evolution
 * ran; before BUG-079 the nudge was NaN and its write was rejected); (2) a badge insert that fails no longer fails the
 * job: it still completes on its first attempt and trust evolution still runs; (3) one badge check over 100 completed
 * exchanges with 10 people writes all five Phase 1 badge types with their names, and a second check writes nothing.
 *
 * Before the fix every reputation job failed on reputation.badges.name NOT NULL (the 2025 table that migration 024's
 * CREATE TABLE IF NOT EXISTS never replaced), so (1) and (2) read a failed attempt and (3) throws.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import Queue from 'bull';
import { randomUUID } from 'crypto';
import { createPool, ServiceUrls } from '../fixtures';

describe('Sprint 134 BUG-077 completion side effects', () => {
  const pool = createPool();
  // R requester; H helper (case 1); H2 helper whose badge insert is made to fail (case 2); H5 helper for the direct
  // five-badge check, with ten requesters P.
  const R = randomUUID(), H = randomUUID(), H2 = randomUUID(), H5 = randomUUID();
  const P = Array.from({ length: 10 }, () => randomUUID());
  const users = [R, H, H2, H5, ...P];
  const Cm = randomUUID();
  const redis = process.env.REDIS_URL || 'redis://localhost:6380';
  const reputationJobs = new Queue('karmyq-completion-reputation', redis);
  const communityEvolution = new Queue('karmyq-community-evolution', redis);

  const bearer = (id: string) => `Bearer ${jwt.sign({ userId: id, email: `${id}@karmyq.test`, communities: [] }, process.env.JWT_SECRET || 'dev-secret-key')}`;
  const complete = (as: string, matchId: string) => request(ServiceUrls.REQUEST).put(`/matches/${matchId}/complete`)
    .set('Authorization', bearer(as)).send({});

  // Status parameters are INSERT values cast to varchar; nothing compares a parameter with requests.matches.status.
  async function ask(status: string): Promise<string> {
    const id = randomUUID();
    await pool.query(`INSERT INTO requests.help_requests
      (id,requester_id,title,description,category,request_type,visibility_scope,status)
      VALUES ($1,$2,'BUG-077 ask','Fixture','generic','generic','community',$3::varchar)`, [id, R, status]);
    await pool.query('INSERT INTO requests.request_communities(request_id,community_id) VALUES ($1,$2)', [id, Cm]);
    return id;
  }
  async function match(requestId: string, responder: string, status: string): Promise<string> {
    const { rows } = await pool.query(`INSERT INTO requests.matches (request_id,responder_id,status,completed_at)
      VALUES ($1,$2,$3::varchar,CASE WHEN $3::varchar = 'completed' THEN CURRENT_TIMESTAMP END) RETURNING id`,
    [requestId, responder, status]);
    return rows[0].id;
  }

  // Opts `helper` into trust evolution in Cm the way the app does (PUT trust-config creates the member's row; without
  // one a member is not eligible) and seeds two earlier completed exchanges with R, so the HTTP completion is the pair's
  // third and fires repeat_interaction_same_person (subscriber.ts: repeatCount >= 3).
  async function preparedHelper(helper: string) {
    const optIn = await request(ServiceUrls.REPUTATION).put(`/reputation/trust-config/${helper}/${Cm}`)
      .set('Authorization', bearer(helper)).send({ evolution_enabled: true });
    expect(optIn.status).toBe(200);
    for (let i = 0; i < 2; i++) await match(await ask('completed'), helper, 'completed');
  }

  async function completeOverHttp(helper: string): Promise<string> {
    const m = await match(await ask('matched'), helper, 'matched');
    expect((await complete(helper, m)).status).toBe(200);
    const last = await complete(R, m);
    expect(last.status).toBe(200);
    expect(last.body.data).toEqual({ fully_completed: true, waiting_for: null });
    return m;
  }

  // The reputation job for a completion is `completion-<match id>` (request-service completionEvents.ts). Bull counts
  // only failed attempts (lib/job.js _saveAttempt), so a first-try success reads attemptsMade 0 and no stack trace.
  // Returns at the first failed attempt, so a red run shows its failedReason instead of timing out.
  async function reputationJob(matchId: string) {
    for (const deadline = Date.now() + 20_000; Date.now() < deadline;) {
      const job = await reputationJobs.getJob(`completion-${matchId}`);
      if (job) {
        const state = await job.getState();
        if (state === 'completed' || job.attemptsMade > 0) {
          return { state, attemptsMade: job.attemptsMade, failedReason: job.failedReason ?? null, stacktrace: job.stacktrace };
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`reputation job for match ${matchId} neither completed nor failed within 20 s`);
  }
  const FIRST_TRY = { state: 'completed', attemptsMade: 0, failedReason: null, stacktrace: [] };

  const evolutionLog = async (helper: string) => (await pool.query(`SELECT parameter, old_value::text AS old_value,
      new_value::text AS new_value, trigger_signal, trigger_event_id
    FROM reputation.user_trust_evolution_log WHERE user_id = $1 AND community_id = $2`, [helper, Cm])).rows;

  beforeAll(async () => {
    await pool.query('SELECT 1');
    expect((await request(ServiceUrls.REQUEST).get('/health')).status).toBe(200);
    expect((await request(ServiceUrls.REPUTATION).get('/health')).status).toBe(200);
    for (const id of users) {
      await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)',
        [id, `BUG-077 ${id.slice(0, 8)}`, `${id}@karmyq.test`, 'not-a-login']);
    }
    await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4)',
      [Cm, `BUG-077 ${Cm}`, 'Fixture', R]);
    // No trigger creates a config row, and without one community evolution reads as disabled. Defaults:
    // community_evolution_enabled true, trust_depth_weight 0.60.
    await pool.query('INSERT INTO communities.community_configs(community_id) VALUES ($1)', [Cm]);
    for (const id of [R, H, H2]) {
      await pool.query("INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'member','active')", [id, Cm]);
    }
  });

  afterAll(async () => {
    try {
      // The delayed community-evolution check queued by case 1 and 2 (jobId = the community id).
      await (await communityEvolution.getJob(Cm))?.remove().catch(() => undefined);
      const byRequester = 'SELECT id FROM requests.help_requests WHERE requester_id = ANY($1::uuid[])';
      await pool.query(`DELETE FROM requests.matches WHERE request_id IN (${byRequester})`, [users]);
      await pool.query(`DELETE FROM requests.feed_events WHERE request_id IN (${byRequester})`, [users]);
      await pool.query('DELETE FROM notifications.notifications WHERE user_id = ANY($1::uuid[])', [users]);
      // karma_records.community_id has no ON DELETE CASCADE: clear it before the community.
      await pool.query('DELETE FROM reputation.karma_records WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM reputation.trust_scores WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM social_graph.trust_edges WHERE user_id_a = ANY($1::uuid[]) OR user_id_b = ANY($1::uuid[])', [users]);
      await pool.query(`DELETE FROM requests.request_communities WHERE request_id IN (${byRequester})`, [users]);
      await pool.query('DELETE FROM requests.help_requests WHERE requester_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM communities.members WHERE user_id = ANY($1::uuid[])', [users]);
      // Cascades community_configs, user_trust_configs and the evolution log.
      await pool.query('DELETE FROM communities.communities WHERE id = $1', [Cm]);
      // Cascades badges, activity_log and the rest keyed on the user.
      await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [users]);
    } finally {
      await reputationJobs.close();
      await communityEvolution.close();
      await pool.end();
      // Case 3 imported the service's own pool.
      const servicePool = (await import('../../services/reputation-service/src/database/db')).default;
      await servicePool.end().catch(() => undefined);
    }
  });

  it('completes the reputation job on its first attempt, awards first_helper with its name, and runs trust evolution', async () => {
    await preparedHelper(H);
    const m = await completeOverHttp(H);

    expect(await reputationJob(m)).toEqual(FIRST_TRY);
    // Positive control: karma, which commits first, landed for this match.
    expect(Number((await pool.query('SELECT COUNT(*) FROM reputation.karma_records WHERE related_entity_id = $1', [m])).rows[0].count))
      .toBeGreaterThan(0);
    // Three completed exchanges as helper with one person: only first_helper qualifies. Badges go to the helper only.
    expect((await pool.query('SELECT badge_type, name, community_id FROM reputation.badges WHERE user_id = $1', [H])).rows)
      .toEqual([{ badge_type: 'first_helper', name: 'First help given', community_id: null }]);
    expect((await pool.query('SELECT badge_type FROM reputation.badges WHERE user_id = $1', [R])).rows).toEqual([]);
    // Trust evolution ran: the pair's third exchange nudged depth weight from the community default.
    expect(await evolutionLog(H)).toEqual([{
      parameter: 'depth_weight', old_value: '0.60', new_value: '0.61',
      trigger_signal: 'repeat_interaction_same_person', trigger_event_id: m,
    }]);
    expect((await pool.query('SELECT depth_weight::text AS depth_weight FROM reputation.user_trust_configs WHERE user_id = $1 AND community_id = $2', [H, Cm])).rows)
      .toEqual([{ depth_weight: '0.61' }]);
  });

  it('a failing badge insert no longer fails the job; trust evolution still runs', async () => {
    await preparedHelper(H2);
    const suffix = H2.replace(/-/g, '');
    const fn = `reputation.reject_badge_${suffix}`, trigger = `reject_badge_${suffix}`;
    try {
      await pool.query(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.user_id = '${H2}' THEN RAISE EXCEPTION 'injected badge failure'; END IF; RETURN NEW; END $$`);
      await pool.query(`CREATE TRIGGER ${trigger} BEFORE INSERT ON reputation.badges FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
      const m = await completeOverHttp(H2);

      expect(await reputationJob(m)).toEqual(FIRST_TRY);
      expect((await pool.query('SELECT badge_type FROM reputation.badges WHERE user_id = $1', [H2])).rows).toEqual([]);
      expect(await evolutionLog(H2)).toEqual([{
        parameter: 'depth_weight', old_value: '0.60', new_value: '0.61',
        trigger_signal: 'repeat_interaction_same_person', trigger_event_id: m,
      }]);
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${trigger} ON reputation.badges`);
      await pool.query(`DROP FUNCTION IF EXISTS ${fn}()`);
    }
  });

  it('one badge check writes every Phase 1 badge type with its name; a second check writes nothing', async () => {
    // 100 completed exchanges as H5's helper, 10 with each of P: crosses milestone_100 and connector (10 people) at once.
    // request_type and visibility_scope are enums: a text literal in a SELECT list will not assign to them, so they keep
    // their defaults ('generic', 'community').
    await pool.query(`WITH history AS (
        INSERT INTO requests.help_requests (requester_id,title,description,category,status)
        SELECT ($1::uuid[])[1 + (g % 10)], 'BUG-077 history', 'Fixture', 'generic', 'completed'
        FROM generate_series(0, 99) AS g
        RETURNING id)
      INSERT INTO requests.matches (request_id,responder_id,status,completed_at)
      SELECT id, $2, 'completed', CURRENT_TIMESTAMP FROM history`, [P, H5]);
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://karmyq_test:test_password@localhost:5433/karmyq_test';
    const { checkAndAwardBadges } = await import('../../services/reputation-service/src/services/badgeService');
    const badges = async () => (await pool.query(
      'SELECT badge_type, name FROM reputation.badges WHERE user_id = $1 ORDER BY badge_type COLLATE "C"', [H5])).rows;
    const all = [
      { badge_type: 'connector', name: 'Helped 10 different people' },
      { badge_type: 'first_helper', name: 'First help given' },
      { badge_type: 'milestone_10', name: 'Helped 10 times' },
      { badge_type: 'milestone_100', name: 'Helped 100 times' },
      { badge_type: 'milestone_50', name: 'Helped 50 times' },
    ];

    expect((await checkAndAwardBadges(H5)).sort()).toEqual(all.map((b) => b.badge_type));
    expect(await badges()).toEqual(all);

    expect(await checkAndAwardBadges(H5)).toEqual([]);
    expect(await badges()).toEqual(all);
  });
});
