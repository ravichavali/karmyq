/** Real SQL only. CI's Integration Tests job is the arbiter on Windows (no local Docker).
 * The same calculation entry used by the scheduler runs in a rolled-back transaction; other communities are
 * temporarily inactive only in that transaction, so cron cannot rewrite unrelated fixtures.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { createPool, ServiceUrls } from '../fixtures';
import reputationPool, { query, withTransaction } from '../../services/reputation-service/src/database/db';
import { initEventPublisher } from '../../services/reputation-service/src/events/publisher';
import { manualCalculateHealthMetrics } from '../../services/reputation-service/src/cron/healthMetricsCalculator';
import { calculateCommunityHealthMetrics } from '../../services/reputation-service/src/services/healthMetricsService';

describe('Sprint 134 L2 nightly health + HTTP fallback against migrated SQL (BUG-070)', () => {
  const pool = createPool();
  const largeParticipants = Array.from({ length: 24 }, () => randomUUID());
  const users = [...Array.from({ length: 7 }, () => randomUUID()), ...largeParticipants];
  const [A, B, H, J, K, FORMER, OUTSIDER] = users;
  const C = randomUUID(), D = randomUUID(), EMPTY = randomUUID(), SMALL = randomUUID();
  const DENSE = randomUUID(), GROWTH = randomUUID();
  const communities = [C, D, EMPTY, SMALL, DENSE, GROWTH];
  const asks: string[] = [];
  const api = (community: string, user = A) => request(ServiceUrls.REPUTATION)
    .get(`/reputation/community-health/${community}`)
    .set('Authorization', `Bearer ${jwt.sign({ userId: user, email: `${user}@karmyq.test`,
      communities: [{ id: C, name: 'L2', role: 'admin' }] }, process.env.JWT_SECRET || 'dev-secret-key')}`);
  const addMatch = async (requester: string, helper: string, targets: string[], status = 'completed') => {
    const ask = (await pool.query(`INSERT INTO requests.help_requests(requester_id,title,description,category)
      VALUES ($1,'Health fixture','L2 integration','generic') RETURNING id`, [requester])).rows[0].id;
    asks.push(ask);
    for (const community of targets) await pool.query(
      'INSERT INTO requests.request_communities(request_id,community_id) VALUES ($1,$2)', [ask, community]);
    await pool.query(`INSERT INTO requests.matches(request_id,responder_id,status,completed_at)
      VALUES ($1,$2,$3::varchar,CASE WHEN $3::varchar='completed' THEN NOW() ELSE NULL END)`, [ask, helper, status]);
  };

  beforeAll(async () => {
    await pool.query('SELECT 1');
    expect((await request(ServiceUrls.REPUTATION).get('/health')).status).toBe(200);
    await initEventPublisher();
    for (const user of users) await pool.query(
      'INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)',
      [user, 'L2 member', `${user}@karmyq.test`, 'not-a-login']);
    for (const community of communities) {
      await pool.query('INSERT INTO communities.communities(id,name,creator_id) VALUES ($1,$2,$3)', [community, `L2 ${community}`, A]);
      const members = community === SMALL ? [A] : [A, B, H, J, K,
        ...([DENSE, GROWTH].includes(community) ? largeParticipants : [])];
      for (const user of members) await pool.query(`INSERT INTO communities.members(community_id,user_id,role,status)
        VALUES ($1,$2,'member','active')`, [community, user]);
    }
    await pool.query(`INSERT INTO communities.members(community_id,user_id,role,status) VALUES ($1,$2,'admin','left')`, [C, FORMER]);
    // Cached member count can be zero even when live membership passes the disclosure check.
    await pool.query(`UPDATE communities.communities
      SET current_members=CASE WHEN id=$1 THEN 10 WHEN id=$2 THEN 24 ELSE 0 END
      WHERE id=ANY($3::uuid[])`, [C, GROWTH, communities]);
    await addMatch(A, H, [C]);
    await addMatch(A, J, [C, D]);
    await addMatch(B, H, [C]);
    await addMatch(B, J, [C], 'proposed');
    await addMatch(K, J, [D]);
    for (let pair = 0; pair < 12; pair++) {
      await addMatch(largeParticipants[pair * 2], largeParticipants[pair * 2 + 1], [DENSE]);
      await addMatch(largeParticipants[pair * 2], largeParticipants[pair * 2 + 1], [GROWTH]);
    }
    await pool.query(`INSERT INTO reputation.community_health_metrics
      (community_id,snapshot_date,total_matches_completed,unique_participant_count)
      VALUES ($1,CURRENT_DATE-7,1,1)`, [GROWTH]);
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM reputation.community_health_metrics WHERE community_id=ANY($1::uuid[])', [communities]);
      await pool.query('DELETE FROM reputation.community_trust_scores WHERE community_id=ANY($1::uuid[])', [communities]);
      await pool.query('DELETE FROM reputation.milestone_events WHERE community_id=ANY($1::uuid[])', [communities]);
      await pool.query('DELETE FROM communities.health_summary WHERE community_id=ANY($1::uuid[])', [communities]);
      await pool.query('DELETE FROM requests.matches WHERE request_id=ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM requests.request_communities WHERE request_id=ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM requests.help_requests WHERE id=ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM communities.members WHERE community_id=ANY($1::uuid[])', [communities]);
      await pool.query('DELETE FROM communities.communities WHERE id=ANY($1::uuid[])', [communities]);
      await pool.query('DELETE FROM auth.users WHERE id=ANY($1::uuid[])', [users]);
    } finally { await pool.end(); await reputationPool.end(); }
  });

  const expectedCurrent = {
    total_matches_completed: 3, total_active_requesters: 2, total_active_helpers: 2,
    unique_participants: 4, network_density: 0.3, network_strength: 20,
  };

  const assertEveryCommunitySnapshot = async () => {
    const snapshots = (await query(`SELECT community_id,total_matches_completed
      FROM reputation.community_health_metrics WHERE community_id=ANY($1::uuid[])
      AND snapshot_date=CURRENT_DATE`, [communities])).rows;
    expect(snapshots.sort((a, b) => a.community_id.localeCompare(b.community_id))).toEqual([
      { community_id: C, total_matches_completed: 3 }, { community_id: D, total_matches_completed: 2 },
      { community_id: EMPTY, total_matches_completed: 0 }, { community_id: SMALL, total_matches_completed: 0 },
      { community_id: DENSE, total_matches_completed: 12 }, { community_id: GROWTH, total_matches_completed: 12 },
    ].sort((a, b) => a.community_id.localeCompare(b.community_id)));
  };

  const withNightlyRun = async (check: () => Promise<void>) => {
    const rollback = new Error('rollback L2 cron fixture');
    await expect(withTransaction(async () => {
      await query("UPDATE communities.communities SET status='inactive' WHERE NOT (id=ANY($1::uuid[]))", [communities]);
      await manualCalculateHealthMetrics();
      await check();
      await assertEveryCommunitySnapshot();
      throw rollback;
    })).rejects.toBe(rollback);
  };

  it('removes only the retired feedback data from the migrated schema', async () => {
    const retired = await pool.query(`SELECT table_schema,table_name,column_name FROM information_schema.columns
      WHERE (table_schema='requests' AND table_name='interaction_feedback') OR
      (table_schema='reputation' AND table_name IN ('trust_scores','community_health_metrics') AND
       column_name IN ('avg_helpfulness','avg_responsiveness','avg_clarity','total_feedback_received'))`);
    expect(retired.rows).toEqual([]);
    expect((await pool.query("SELECT to_regclass('feedback.feedback')::text AS live")).rows).toEqual([{ live: 'feedback.feedback' }]);
    expect((await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='reputation'
      AND table_name='trust_scores' AND column_name='average_feedback'`)).rows).toEqual([{ column_name: 'average_feedback' }]);
  });

  it('widens density and every growth/cache percentage while retaining decimal scales', async () => {
    const columns = (await pool.query(`SELECT table_schema,table_name,column_name,numeric_precision,numeric_scale
      FROM information_schema.columns WHERE
      (table_schema='reputation' AND table_name='community_health_metrics'
        AND column_name IN ('network_density','growth_rate_matches','growth_rate_participants')) OR
      (table_schema='communities' AND table_name='health_summary' AND column_name='trend_percentage')
      ORDER BY table_schema,table_name,column_name`)).rows;
    expect(columns).toEqual([
      { table_schema: 'communities', table_name: 'health_summary', column_name: 'trend_percentage', numeric_precision: 20, numeric_scale: 2 },
      { table_schema: 'reputation', table_name: 'community_health_metrics', column_name: 'growth_rate_matches', numeric_precision: 20, numeric_scale: 2 },
      { table_schema: 'reputation', table_name: 'community_health_metrics', column_name: 'growth_rate_participants', numeric_precision: 20, numeric_scale: 2 },
      { table_schema: 'reputation', table_name: 'community_health_metrics', column_name: 'network_density', numeric_precision: 20, numeric_scale: 4 },
    ]);
  });

  it('fallback counts C-only and C+D once each, excluding D-only and noncompleted matches', async () => {
    const response = await api(C);
    expect(response.status).toBe(200);
    expect(response.body.data.current).toEqual(expectedCurrent);
    expect((await api(D)).body.data.current).toEqual({
      total_matches_completed: 2, total_active_requesters: 2, total_active_helpers: 1,
      unique_participants: 3, network_density: 2, network_strength: 42.22,
    });
  });

  it('empty fallback stays finite with a zero cached member count', async () => {
    const response = await api(EMPTY);
    expect(response.status).toBe(200);
    expect(response.body.data.current).toEqual({ total_matches_completed: 0, total_active_requesters: 0,
      total_active_helpers: 0, unique_participants: 0, network_density: 0, network_strength: 0 });
  });

  it('preserves indistinguishable aggregate denials for former/nonmembers and small cohorts', async () => {
    const denied = await Promise.all([api(C, FORMER), api(C, OUTSIDER), api(SMALL), api(randomUUID())]);
    for (const response of denied) {
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ success: false, message: 'Community aggregate not available', error: 'AGGREGATE_NOT_AVAILABLE' });
    }
  });

  it('runs the shared nightly calculation entry, storing exact snapshot/cache and rolling back unrelated effects', async () => {
    await withNightlyRun(async () => {
      const snapshot = (await query(`SELECT total_matches_completed,total_active_requesters,total_active_helpers,
        unique_participant_count,network_density,growth_rate_matches FROM reputation.community_health_metrics
        WHERE community_id=$1 AND snapshot_date=CURRENT_DATE`, [C])).rows;
      expect(snapshot).toEqual([{ total_matches_completed: 3, total_active_requesters: 2, total_active_helpers: 2,
        unique_participant_count: 4, network_density: '0.3000', growth_rate_matches: '0.00' }]);
      expect((await query('SELECT total_exchanges,active_members,network_strength FROM communities.health_summary WHERE community_id=$1', [C])).rows)
        .toEqual([{ total_exchanges: 3, active_members: 4, network_strength: '20.00' }]);
    });
  });

  it('nightly writes density 12 with zero cached members and still snapshots every other community', async () => {
    expect((await pool.query('SELECT current_members FROM communities.communities WHERE id=$1', [DENSE])).rows)
      .toEqual([{ current_members: 0 }]);
    await withNightlyRun(async () => {
      expect((await query(`SELECT total_matches_completed,unique_participant_count,network_density
        FROM reputation.community_health_metrics WHERE community_id=$1 AND snapshot_date=CURRENT_DATE`, [DENSE])).rows)
        .toEqual([{ total_matches_completed: 12, unique_participant_count: 24, network_density: '12.0000' }]);
      expect((await query('SELECT total_exchanges,network_strength FROM communities.health_summary WHERE community_id=$1', [DENSE])).rows)
        .toEqual([{ total_exchanges: 12, network_strength: '40.00' }]);
    });
  });

  it('nightly writes growth above 1000 percent to snapshot and cache and still snapshots every other community', async () => {
    await withNightlyRun(async () => {
      expect((await query(`SELECT total_matches_completed,unique_participant_count,growth_rate_matches,growth_rate_participants
        FROM reputation.community_health_metrics WHERE community_id=$1 AND snapshot_date=CURRENT_DATE`, [GROWTH])).rows)
        .toEqual([{ total_matches_completed: 12, unique_participant_count: 24,
          growth_rate_matches: '1100.00', growth_rate_participants: '2300.00' }]);
      expect((await query('SELECT trend_direction,trend_percentage FROM communities.health_summary WHERE community_id=$1', [GROWTH])).rows)
        .toEqual([{ trend_direction: 'growing', trend_percentage: '1100.00' }]);
    });
  });

  it('upserts one snapshot per day and serves its numeric strings with exact seven-day growth', async () => {
    await pool.query(`INSERT INTO reputation.community_health_metrics(community_id,snapshot_date,total_matches_completed,unique_participant_count)
      VALUES ($1,CURRENT_DATE-7,2,2)`, [C]);
    await calculateCommunityHealthMetrics(C);
    await calculateCommunityHealthMetrics(C);
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM reputation.community_health_metrics WHERE community_id=$1 AND snapshot_date=CURRENT_DATE', [C])).rows)
      .toEqual([{ n: 1 }]);
    const response = await api(C);
    expect(response.status).toBe(200);
    expect(response.body.data.current).toEqual(expectedCurrent);
    expect(response.body.data.trend).toEqual({ matches_growth: 50, participants_growth: 100, direction: 'growing' });
  });
});
