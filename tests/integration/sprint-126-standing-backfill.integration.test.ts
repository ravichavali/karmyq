/**
 * Sprint 126 — the standing backfill, end to end against real PostgreSQL 15.
 *
 * This is the test the sprint rests on. Everything else about the backfill is provable with mocks —
 * argument parsing, report shape, which SQL string was emitted — but the three properties that
 * actually matter cannot be:
 *
 *   1. **Idempotency.** `ON CONFLICT DO NOTHING` means nothing unless a real unique index rejects
 *      the duplicate. A mocked pool asserts its own mock.
 *   2. **Resume safety.** An interrupted run must resume to the same result, and only a real
 *      database can be interrupted mid-batch and then read back.
 *   3. **Dry-run purity.** "Performs no writes" is a claim about a database, not about a function.
 *
 * Seeded shape: one helper across communities of 1 / 3 / 4 eligibility, two matches sharing a
 * completion timestamp, legacy curated fixture rows, and an active membership with no history at
 * all (which must end at a stored 0, not be skipped).
 */

import { Pool } from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://karmyq_test:test_password@localhost:5433/karmyq_test';

process.env.DATABASE_URL = DATABASE_URL;

const U = (n: string) => `00000000-1260-4000-8000-0000000000${n}`;
const HELPER = U('a1');
const REQUESTER = U('a2');
const LONELY = U('a3'); // active member, zero history
const C1 = U('c1');
const C2 = U('c2');
const C3 = U('c3');
const C4 = U('c4');
const ALL_COMMUNITIES = [C1, C2, C3, C4];
const ALL_USERS = [HELPER, REQUESTER, LONELY];

let pool: Pool;

/**
 * Per-test data only, in FK-safe order.
 *
 * The "world" — users, communities, configs, settings, and MEMBERSHIPS — is seeded once and left
 * alone. Deleting memberships here would make every match ineligible (both participants must be
 * active members of a request community), so the backfill would correctly predict zero writes and
 * every assertion below would fail for the wrong reason.
 */
async function wipe(): Promise<void> {
  await pool.query('DELETE FROM reputation.karma_records WHERE community_id = ANY($1::uuid[])', [ALL_COMMUNITIES]);
  await pool.query('DELETE FROM reputation.activity_log WHERE community_id = ANY($1::uuid[])', [ALL_COMMUNITIES]);
  await pool.query('DELETE FROM reputation.trust_scores WHERE community_id = ANY($1::uuid[])', [ALL_COMMUNITIES]);
  await pool.query('DELETE FROM requests.matches WHERE request_id IN (SELECT id FROM requests.help_requests WHERE requester_id = ANY($1::uuid[]))', [ALL_USERS]);
  await pool.query('DELETE FROM requests.request_communities WHERE community_id = ANY($1::uuid[])', [ALL_COMMUNITIES]);
  await pool.query('DELETE FROM requests.help_requests WHERE requester_id = ANY($1::uuid[])', [ALL_USERS]);
}

/** Full teardown, including the world. Only used in afterAll. */
async function wipeWorld(): Promise<void> {
  await wipe();
  await pool.query('DELETE FROM communities.members WHERE community_id = ANY($1::uuid[])', [ALL_COMMUNITIES]);
  await pool.query('DELETE FROM communities.settings WHERE community_id = ANY($1::uuid[])', [ALL_COMMUNITIES]);
  await pool.query('DELETE FROM communities.community_configs WHERE community_id = ANY($1::uuid[])', [ALL_COMMUNITIES]);
}

interface SeedMatch {
  matchId: string;
  requestId: string;
  communities: string[];
  completedAt: string;
  helper?: string;
  requester?: string;
}

async function seedMatch(m: SeedMatch): Promise<void> {
  const helper = m.helper ?? HELPER;
  const requester = m.requester ?? REQUESTER;
  await pool.query(
    `INSERT INTO requests.help_requests (id, requester_id, title, description, category, status, request_type)
     VALUES ($1, $2, 'seed', 'seed', 'general', 'completed', 'generic')`,
    [m.requestId, requester],
  );
  for (const communityId of m.communities) {
    await pool.query(
      'INSERT INTO requests.request_communities (request_id, community_id) VALUES ($1, $2)',
      [m.requestId, communityId],
    );
  }
  await pool.query(
    `INSERT INTO requests.matches (id, request_id, responder_id, status, completed_at)
     VALUES ($1, $2, $3, 'completed', $4)`,
    [m.matchId, m.requestId, helper, m.completedAt],
  );
}

/** Content fingerprint of every table the backfill may touch. */
async function fingerprint(): Promise<string> {
  const karma = await pool.query(
    `SELECT user_id, community_id, points, reason, related_entity_id, created_at
     FROM reputation.karma_records WHERE community_id = ANY($1::uuid[])
     ORDER BY related_entity_id, user_id, reason`, [ALL_COMMUNITIES]);
  const activity = await pool.query(
    `SELECT user_id, community_id, activity_type, related_entity_id, created_at
     FROM reputation.activity_log WHERE community_id = ANY($1::uuid[])
     ORDER BY related_entity_id, user_id, activity_type`, [ALL_COMMUNITIES]);
  const trust = await pool.query(
    `SELECT user_id, community_id, score, requests_completed, offers_accepted
     FROM reputation.trust_scores WHERE community_id = ANY($1::uuid[])
     ORDER BY community_id, user_id`, [ALL_COMMUNITIES]);
  return JSON.stringify({ karma: karma.rows, activity: activity.rows, trust: trust.rows });
}

async function karmaRows(): Promise<Array<Record<string, unknown>>> {
  const result = await pool.query(
    `SELECT user_id, community_id, points, reason, related_entity_id,
            to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
     FROM reputation.karma_records WHERE community_id = ANY($1::uuid[])
     ORDER BY created_at, community_id, reason`, [ALL_COMMUNITIES]);
  return result.rows;
}

async function seedWorld(): Promise<void> {
  await pool.query(
    `INSERT INTO auth.users (id, email, name, password_hash) VALUES
       ($1, 's126-helper@test.local', 'Helper', 'x'),
       ($2, 's126-requester@test.local', 'Requester', 'x'),
       ($3, 's126-lonely@test.local', 'Lonely', 'x')
     ON CONFLICT (id) DO NOTHING`, [HELPER, REQUESTER, LONELY]);

  for (const [i, id] of ALL_COMMUNITIES.entries()) {
    await pool.query(
      `INSERT INTO communities.communities (id, name, creator_id) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`, [id, `S126 Community ${i + 1}`, HELPER]);
    await pool.query(
      `INSERT INTO communities.community_configs (community_id, karma_split_helper, karma_split_requestor)
       VALUES ($1, 60, 40) ON CONFLICT DO NOTHING`, [id]);
    await pool.query(
      `INSERT INTO communities.settings (community_id, activity_types)
       VALUES ($1, '["complete_request","complete_offer"]'::jsonb) ON CONFLICT DO NOTHING`, [id]);
    for (const user of [HELPER, REQUESTER]) {
      await pool.query(
        `INSERT INTO communities.members (community_id, user_id, role, status)
         VALUES ($1, $2, 'member', 'active') ON CONFLICT DO NOTHING`, [id, user]);
    }
  }

  // An active member of C1 with no exchange history at all. Must be EVALUATED to a stored 0,
  // not silently skipped — a zero is a meaningful result, not a missing batch.
  await pool.query(
    `INSERT INTO communities.members (community_id, user_id, role, status)
     VALUES ($1, $2, 'member', 'active') ON CONFLICT DO NOTHING`, [C1, LONELY]);
}

// The migration is not applied here — see the note in the schema integration suite. CI replays the
// whole chain before this job; locally the scratch database is loaded from the generated init.sql.
beforeAll(async () => {
  pool = new Pool({ connectionString: DATABASE_URL });
  await seedWorld();
}, 60000);

afterAll(async () => {
  if (!pool) return;
  await wipeWorld();
  await pool.query('DELETE FROM communities.communities WHERE id = ANY($1::uuid[])', [ALL_COMMUNITIES]);
  await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [ALL_USERS]);
  await pool.end();
});

beforeEach(async () => {
  await wipe();
  jest.resetModules();
});

/** Fresh module instances per test so the pool picks up DATABASE_URL. */
function backfill() {
  return require('../../services/reputation-service/src/services/standingBackfillService');
}

describe('dry run is provably read-only', () => {
  it('changes nothing at all, on a database with real history', async () => {
    await seedMatch({ matchId: U('d1'), requestId: U('b1'), communities: [C1], completedAt: '2026-01-01T00:00:00Z' });
    await seedMatch({ matchId: U('d2'), requestId: U('b2'), communities: [C1, C2, C3], completedAt: '2026-02-01T00:00:00Z' });

    const before = await fingerprint();
    const report = await backfill().analyzeStandingBackfill();
    const after = await fingerprint();

    expect(after).toBe(before);
    expect(report.completedMatches).toBeGreaterThanOrEqual(2);
    expect(report.predicted.karmaRows).toBeGreaterThan(0);
  }, 60000);

  it('predicts what apply then actually writes', async () => {
    await seedMatch({ matchId: U('d1'), requestId: U('b1'), communities: [C1], completedAt: '2026-01-01T00:00:00Z' });

    const predicted = (await backfill().analyzeStandingBackfill()).predicted.karmaRows;
    await backfill().applyStandingBackfill({ batchSize: 10 });
    const actual = (await pool.query(
      'SELECT COUNT(*)::int AS c FROM reputation.karma_records WHERE community_id = ANY($1::uuid[])',
      [ALL_COMMUNITIES])).rows[0].c;

    // A preflight that cannot predict the write count is not a preflight.
    expect(actual).toBe(predicted);
  }, 60000);
});

describe('apply projects real history', () => {
  it('writes canonical rows at the matches real completion time', async () => {
    await seedMatch({ matchId: U('d1'), requestId: U('b1'), communities: [C1], completedAt: '2026-01-01T00:00:00Z' });
    await backfill().applyStandingBackfill({ batchSize: 10 });

    const rows = await karmaRows();
    // Sorted, because karmaRows() orders by (created_at, community_id, reason) and all three rows
    // share a timestamp and community — insertion order is not a property worth asserting.
    expect(rows.map(r => r.reason).sort()).toEqual([
      'First help in community', 'Provided help', 'Received help',
    ]);
    // Historical time is data. NOW() here would make decay and recent-activity output falsely rich.
    for (const row of rows) expect(row.created_at).toBe('2026-01-01 00:00:00');
  }, 60000);

  it('caps a 4-community match at three and keeps the pool fixed', async () => {
    await seedMatch({ matchId: U('d1'), requestId: U('b1'), communities: ALL_COMMUNITIES, completedAt: '2026-01-01T00:00:00Z' });
    await backfill().applyStandingBackfill({ batchSize: 10 });

    const rows = await karmaRows();
    const communities = new Set(rows.map(r => r.community_id));
    expect(communities.size).toBe(3);

    const pool100 = rows
      .filter(r => r.reason === 'Provided help' || r.reason === 'Received help')
      .reduce((sum, r) => sum + Number(r.points), 0);
    expect(pool100).toBe(100);
  }, 60000);

  it('orders matches sharing a timestamp deterministically by match id', async () => {
    // Both complete at the same instant; the milestone must land on the lower id.
    await seedMatch({ matchId: U('f1'), requestId: U('b1'), communities: [C1], completedAt: '2026-03-01T00:00:00Z' });
    await seedMatch({ matchId: U('f2'), requestId: U('b2'), communities: [C1], completedAt: '2026-03-01T00:00:00Z' });

    await backfill().applyStandingBackfill({ batchSize: 10 });

    const first = (await pool.query(
      `SELECT related_entity_id FROM reputation.karma_records
       WHERE reason = 'First help in community' AND community_id = $1`, [C1])).rows;
    expect(first).toHaveLength(1);
    expect(first[0].related_entity_id).toBe(U('f1'));
  }, 60000);

  it('evaluates an active membership with no history to a stored 0', async () => {
    await seedMatch({ matchId: U('d1'), requestId: U('b1'), communities: [C1], completedAt: '2026-01-01T00:00:00Z' });
    await backfill().applyStandingBackfill({ batchSize: 10 });

    const lonely = await pool.query(
      'SELECT score FROM reputation.trust_scores WHERE user_id = $1 AND community_id = $2',
      [LONELY, C1]);
    // Present and zero — not absent. A zero is a result, not a skipped batch.
    expect(lonely.rows).toHaveLength(1);
    expect(lonely.rows[0].score).toBe(0);
  }, 60000);
});

describe('idempotency and resume', () => {
  it('a second apply writes nothing', async () => {
    await seedMatch({ matchId: U('d1'), requestId: U('b1'), communities: [C1], completedAt: '2026-01-01T00:00:00Z' });
    await seedMatch({ matchId: U('d2'), requestId: U('b2'), communities: [C1, C2, C3], completedAt: '2026-02-01T00:00:00Z' });

    await backfill().applyStandingBackfill({ batchSize: 10 });
    const afterFirst = await fingerprint();

    const second = await backfill().applyStandingBackfill({ batchSize: 10 });
    const afterSecond = await fingerprint();

    // Byte-identical: not merely "no error", but no change to any row the backfill can touch.
    expect(afterSecond).toBe(afterFirst);
    expect(second.predicted.karmaRows).toBe(0);
  }, 90000);

  it('a second dry run predicts zero once applied', async () => {
    await seedMatch({ matchId: U('d1'), requestId: U('b1'), communities: [C1], completedAt: '2026-01-01T00:00:00Z' });
    await backfill().applyStandingBackfill({ batchSize: 10 });

    const report = await backfill().analyzeStandingBackfill();
    expect(report.predicted.karmaRows).toBe(0);
    expect(report.alreadyProjectedMatches).toBeGreaterThan(0);
  }, 60000);

  it('resuming an interrupted run reaches the same state as an uninterrupted one', async () => {
    for (const [i, id] of ['d1', 'd2', 'd3', 'd4'].entries()) {
      await seedMatch({
        matchId: U(id), requestId: U(`b${i + 1}`), communities: [C1],
        completedAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
      });
    }

    // Interrupt after the first batch by throwing out of the progress callback.
    let batches = 0;
    await expect(
      backfill().applyStandingBackfill({
        batchSize: 1,
        onProgress: () => { batches += 1; if (batches === 1) throw new Error('interrupted'); },
      }),
    ).rejects.toThrow('interrupted');

    const partial = (await pool.query(
      'SELECT COUNT(*)::int AS c FROM reputation.karma_records WHERE community_id = ANY($1::uuid[])',
      [ALL_COMMUNITIES])).rows[0].c;
    expect(partial).toBeGreaterThan(0); // committed work survived
    const interruptedState = await fingerprint();

    // Resume. There is no checkpoint file — the projection identities ARE the checkpoint.
    await backfill().applyStandingBackfill({ batchSize: 1 });
    const resumed = await fingerprint();
    expect(resumed).not.toBe(interruptedState);

    // Now compare against a clean uninterrupted run over identical history.
    const resumedRows = await karmaRows();
    await wipe();
    for (const [i, id] of ['d1', 'd2', 'd3', 'd4'].entries()) {
      await seedMatch({
        matchId: U(id), requestId: U(`b${i + 1}`), communities: [C1],
        completedAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
      });
    }
    await backfill().applyStandingBackfill({ batchSize: 100 });
    const uninterruptedRows = await karmaRows();

    // Same communities, same ranks, same points — interruption must not change the outcome.
    expect(resumedRows).toEqual(uninterruptedRows);
  }, 120000);
});

describe('legacy curated rows', () => {
  it('reprojects attributable fixture rows into canonical ones', async () => {
    await seedMatch({ matchId: U('d1'), requestId: U('b1'), communities: [C1], completedAt: '2026-01-01T00:00:00Z' });
    // A curated fixture row attributable to that match, in the vocabulary the trust calculator
    // cannot read.
    await pool.query(
      `INSERT INTO reputation.karma_records (user_id, community_id, points, reason, related_entity_id, created_at)
       VALUES ($1, $2, 60, 'help_provided', $3, '2026-01-01T00:00:00Z')`,
      [HELPER, C1, U('d1')]);

    const report = await backfill().analyzeStandingBackfill();
    expect(report.legacy.attributableRows).toBeGreaterThan(0);

    await backfill().applyStandingBackfill({ batchSize: 10 });

    const legacyLeft = await pool.query(
      `SELECT COUNT(*)::int AS c FROM reputation.karma_records
       WHERE community_id = $1 AND reason = 'help_provided'`, [C1]);
    expect(legacyLeft.rows[0].c).toBe(0);

    const canonical = await pool.query(
      `SELECT COUNT(*)::int AS c FROM reputation.karma_records
       WHERE community_id = $1 AND reason = 'Provided help'`, [C1]);
    expect(canonical.rows[0].c).toBe(1);
  }, 60000);
});
