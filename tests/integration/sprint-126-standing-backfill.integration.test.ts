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

/**
 * Close EVERY connection this suite caused to be opened, not just its own.
 *
 * Importing the backfill service pulls in reputation-service's module-level pg Pool and, through
 * `effectiveParamsCache`, a lazily-created ioredis client that reconnects indefinitely. Both keep
 * the Node event loop alive after the last assertion, so `jest` (which CI runs WITHOUT
 * `--forceExit`) hangs instead of exiting — the run sat for 25 minutes with every test already
 * passed. Running locally with `--forceExit`, as I had been, hides this completely.
 */
afterAll(async () => {
  if (!pool) return;
  await wipeWorld();
  await pool.query('DELETE FROM communities.communities WHERE id = ANY($1::uuid[])', [ALL_COMMUNITIES]);
  await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [ALL_USERS]);
  await pool.end();

  const servicePool = (await import('../../services/reputation-service/src/database/db')).default;
  await servicePool.end().catch(() => undefined);

  const { disconnectEffectiveParamsCache } = await import(
    '../../services/reputation-service/src/services/effectiveParamsCache'
  );
  await disconnectEffectiveParamsCache().catch(() => undefined);
});

beforeEach(async () => {
  await wipe();
});

/**
 * ONE module instance for the whole file — deliberately not `jest.resetModules()` per test.
 *
 * Resetting the registry gives every test a fresh `db.ts` (new pg Pool) and a fresh
 * `effectiveParamsCache` (new ioredis client, which reconnects indefinitely). Ten tests then leak
 * ten of each, none of them reachable from `afterAll` — a later import just builds an eleventh. The
 * suite passes and Jest never exits, which is what hung CI for 25 minutes with every test green.
 *
 * A single instance is also correct: these modules hold no per-test state beyond their connections,
 * and DATABASE_URL is set at the top of this file before the first import.
 */
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

  it('selects the three HIGHEST prior-karma communities, not the three lowest ids', async () => {
    // The existing cap test above leaves all four communities tied at zero prior karma, so
    // selection falls through to the community-id tie-break and the assertion cannot tell
    // "ranked by karma" from "ranked by id". Here the two orderings are deliberately OPPOSITE.
    //
    // Strictly-before history, built from real earlier matches:
    //   C4 -> 3 prior helps  (3x60 + 15 first-help = 195 karma)   <- largest id, most karma
    //   C3 -> 2 prior helps  (135)
    //   C2 -> 1 prior help   (75)
    //   C1 -> 0 prior helps  (0)                                  <- smallest id, no karma
    //
    // Ranking by id would pick C1, C2, C3. Ranking by prior karma picks C4, C3, C2 and drops C1.
    const earlier: Array<[string, string]> = [
      ['d1', C4], ['d2', C4], ['d3', C4],
      ['d4', C3], ['d5', C3],
      ['d6', C2],
    ];
    for (const [i, [match, community]] of earlier.entries()) {
      await seedMatch({
        matchId: U(match),
        requestId: U(`b${i + 1}`),
        communities: [community],
        completedAt: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
      });
    }
    // The match under test: eligible in ALL four, and last chronologically so every award above
    // counts as strictly-before history for it.
    const FINAL = U('d7');
    await seedMatch({
      matchId: FINAL,
      requestId: U('b7'),
      communities: ALL_COMMUNITIES,
      completedAt: new Date(Date.UTC(2026, 0, 7)).toISOString(),
    });

    await backfill().applyStandingBackfill({ batchSize: 10 });

    const finalRows = await pool.query<{ community_id: string; reason: string; points: number }>(
      `SELECT community_id, reason, points FROM reputation.karma_records
       WHERE related_entity_id = $1`,
      [FINAL],
    );

    const selected = [...new Set(finalRows.rows.map((r) => r.community_id))].sort();
    expect(selected).toEqual([C2, C3, C4].sort());

    // The lowest-karma community is excluded even though it has the SMALLEST id — which is the
    // whole point, and what the tied-at-zero test cannot show.
    expect(selected).not.toContain(C1);
    expect(selected).toHaveLength(3);

    // The fixed pool still holds: three communities award exactly 100 points between them.
    const pool100 = finalRows.rows
      .filter((r) => r.reason === 'Provided help' || r.reason === 'Received help')
      .reduce((sum, r) => sum + Number(r.points), 0);
    expect(pool100).toBe(100);
  }, 120000);

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

/**
 * Sprint 128 PR C — the preflight report must agree with what the writer actually stores.
 *
 * The mocked `updateTrustScore` in the service-level suite cannot prove this: it asserts the
 * preview against itself. Here `applyStandingBackfill` runs the real projector and the real
 * `karmaService.updateTrustScore`, so the buckets are compared against rows PostgreSQL holds.
 *
 * The defect this pins: breadth is global (`trustMetricsDb.ts:26-32` has no community predicate),
 * so a membership with no LOCAL history still scores 1 under the default 0.4 breadth weight. The
 * report derived its metrics from the replayed match list and reported those memberships as 0.
 */
describe('Sprint 128 — preview equals the real writer', () => {
  const FROZEN = new Date('2026-06-15T12:00:00.000Z');
  const COMPLETED = '2026-06-01T00:00:00.000Z';

  /** Fake ONLY Date. Real timers must keep running or pg and ioredis never settle. */
  const FAKE_DATE_ONLY = {
    doNotFake: [
      'hrtime', 'nextTick', 'performance', 'queueMicrotask',
      'requestAnimationFrame', 'cancelAnimationFrame',
      'requestIdleCallback', 'cancelIdleCallback',
      'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval',
      'setTimeout', 'clearTimeout',
    ] as const,
  };

  const scoreBucketOf = (score: number): string =>
    score <= 0 ? '0'
      : score < 20 ? '1-19'
        : score < 40 ? '20-39'
          : score < 60 ? '40-59'
            : score < 80 ? '60-79' : '80-100';

  /** Buckets recomputed from stored rows, deliberately not via the service's own helper. */
  async function storedScoreBuckets(): Promise<Record<string, number>> {
    const buckets: Record<string, number> = {
      '0': 0, '1-19': 0, '20-39': 0, '40-59': 0, '60-79': 0, '80-100': 0,
    };
    const rows = await pool.query(
      `SELECT score FROM reputation.trust_scores WHERE community_id = ANY($1::uuid[])`,
      [ALL_COMMUNITIES]);
    for (const row of rows.rows) buckets[scoreBucketOf(Number(row.score))] += 1;
    return buckets;
  }

  /**
   * Provider eligibility recomputed from STORED scores, running the service's OWN reach query.
   *
   * Deliberately not a re-typed copy of that SQL: a copy would drift the moment `PROVIDERS_QUERY`
   * changed, and it could never prove the filters anyway — it would only prove that two identical
   * strings agree. Running the real query means this asserts exactly what it can: that the score
   * lookup and the floor comparison match the writer. The filters themselves are proved
   * behaviourally by the inactive-membership test below, against real rows.
   */
  async function storedProviderEligibility(): Promise<Record<string, number>> {
    const { PROVIDERS_QUERY } = require('../../services/reputation-service/src/services/standingBackfillService');
    const pairs = await pool.query(PROVIDERS_QUERY);
    const scores = await pool.query(
      `SELECT user_id, community_id, score FROM reputation.trust_scores
       WHERE community_id = ANY($1::uuid[])`, [ALL_COMMUNITIES]);
    const byPair = new Map<string, number>();
    for (const row of scores.rows) byPair.set(`${row.user_id}|${row.community_id}`, Number(row.score));

    const counts: Record<string, number> = { '1': 0, '20': 0, '40': 0, '60': 0 };
    const seen = new Set<string>();
    for (const pair of pairs.rows) {
      // The real query is repo-wide; this fixture owns only these communities.
      if (!ALL_COMMUNITIES.includes(pair.community_id)) continue;
      const key = `${pair.provider_id}|${pair.community_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const score = byPair.get(`${pair.user_id}|${pair.community_id}`) ?? 0;
      for (const floor of [1, 20, 40, 60]) if (score >= floor) counts[String(floor)] += 1;
    }
    return counts;
  }

  /** A cold cache, so preview (which reads user_trust_configs directly) and the writer (which
   *  reads Redis) start from the same effective parameters. A warm STALE entry would legitimately
   *  move the writer's answer — that is a real property of the writer, not something to hide. */
  async function coldEffectiveParamsCache(): Promise<void> {
    const { invalidateEffectiveParamsCache } = await import(
      '../../services/reputation-service/src/services/effectiveParamsCache');
    for (const communityId of ALL_COMMUNITIES) {
      for (const userId of ALL_USERS) {
        await invalidateEffectiveParamsCache(userId, communityId);
      }
    }
  }

  beforeEach(() => {
    jest.useFakeTimers(FAKE_DATE_ONLY as never);
    jest.setSystemTime(FROZEN);
  });

  afterEach(async () => {
    jest.useRealTimers();
    await pool.query('DELETE FROM requests.provider_profiles WHERE user_id = ANY($1::uuid[])', [ALL_USERS]);
    await pool.query(
      `UPDATE communities.community_configs
       SET provider_services_enabled = FALSE, provider_services_list = '{}'::text[]
       WHERE community_id = ANY($1::uuid[])`, [ALL_COMMUNITIES]);
  });

  it('reports the same score buckets the writer then stores', async () => {
    // One match posted to C1 only. HELPER and REQUESTER are active members of C1..C4, so their
    // C2/C3/C4 memberships have global breadth and no local history — the divergent case.
    await seedMatch({ matchId: U('d1'), requestId: U('b1'), communities: [C1], completedAt: COMPLETED });
    await coldEffectiveParamsCache();

    const before = await fingerprint();
    const preview = await backfill().analyzeStandingBackfill();
    expect(await fingerprint()).toBe(before); // preview wrote nothing

    await backfill().applyStandingBackfill({ batchSize: 10 });

    expect(await storedScoreBuckets()).toEqual(preview.scoreBuckets);
    // And exactly, so a future regression cannot pass by making both sides equally wrong.
    expect(preview.scoreBuckets).toEqual({
      '0': 1, '1-19': 8, '20-39': 0, '40-59': 0, '60-79': 0, '80-100': 0,
    });
  }, 120000);

  it('stores 1 for the golden global-breadth membership and 0 for the golden idle one', async () => {
    await seedMatch({ matchId: U('d1'), requestId: U('b1'), communities: [C1], completedAt: COMPLETED });
    await coldEffectiveParamsCache();
    await backfill().applyStandingBackfill({ batchSize: 10 });

    const golden = await pool.query(
      `SELECT user_id, community_id, score FROM reputation.trust_scores
       WHERE (user_id = $1 AND community_id = $2) OR (user_id = $3 AND community_id = $4)
       ORDER BY score DESC`, [HELPER, C2, LONELY, C1]);

    // HELPER is active in C2 with no C2 history, but one community of canonical activity:
    // breadth = min(10, 1 * 3) * 0.4 = 1.2 → 1. LONELY has no history anywhere → 0.
    expect(golden.rows.map((r) => ({ ...r, score: Number(r.score) }))).toEqual([
      { user_id: HELPER, community_id: C2, score: 1 },
      { user_id: LONELY, community_id: C1, score: 0 },
    ]);
  }, 120000);

  it('reports the same provider-floor counts the real reach filters produce', async () => {
    await seedMatch({ matchId: U('d1'), requestId: U('b1'), communities: [C1], completedAt: COMPLETED });

    // C1 enabled with an empty allowlist (all service types); C2 enabled but restricted to 'ride';
    // C3 and C4 left disabled, which is the column default.
    await pool.query(
      `UPDATE communities.community_configs SET provider_services_enabled = TRUE
       WHERE community_id = ANY($1::uuid[])`, [[C1, C2]]);
    await pool.query(
      `UPDATE communities.community_configs SET provider_services_list = ARRAY['ride']::text[]
       WHERE community_id = $1`, [C2]);
    await pool.query(
      `INSERT INTO requests.provider_profiles (id, user_id, service_type, display_name, is_active)
       VALUES ($1, $2, 'ride',   'Helper Rides',   TRUE),
              ($3, $2, 'repair', 'Helper Repairs', TRUE),
              ($4, $5, 'ride',   'Requester Ride', FALSE),
              ($6, $7, 'ride',   'Lonely Ride',    TRUE)`,
      [U('f1'), HELPER, U('f2'), U('f3'), REQUESTER, U('f4'), LONELY]);
    await coldEffectiveParamsCache();

    const preview = await backfill().analyzeStandingBackfill();
    await backfill().applyStandingBackfill({ batchSize: 10 });

    // Surviving pairs: HELPER ride + HELPER repair in C1 (both 17), LONELY ride in C1 (0), and
    // HELPER ride in C2 (1) — repair is excluded there by the allowlist. REQUESTER's profile is
    // inactive; C3/C4 are disabled communities.
    expect(await storedProviderEligibility()).toEqual(preview.providerEligibility);
    expect(preview.providerEligibility).toEqual({ '1': 3, '20': 0, '40': 0, '60': 0 });
  }, 120000);

  it('drops a provider pair when the membership stops being active', async () => {
    await seedMatch({ matchId: U('d1'), requestId: U('b1'), communities: [C1], completedAt: COMPLETED });
    await pool.query(
      `UPDATE communities.community_configs SET provider_services_enabled = TRUE
       WHERE community_id = $1`, [C1]);
    await pool.query(
      `INSERT INTO requests.provider_profiles (id, user_id, service_type, display_name, is_active)
       VALUES ($1, $2, 'ride', 'Helper Rides', TRUE)`, [U('f1'), HELPER]);
    await coldEffectiveParamsCache();

    const active = await backfill().analyzeStandingBackfill();
    expect(active.providerEligibility['1']).toBe(1);

    await pool.query(
      `UPDATE communities.members SET status = 'inactive'
       WHERE user_id = $1 AND community_id = $2`, [HELPER, C1]);
    try {
      const inactive = await backfill().analyzeStandingBackfill();
      expect(inactive.providerEligibility).toEqual({ '1': 0, '20': 0, '40': 0, '60': 0 });
    } finally {
      await pool.query(
        `UPDATE communities.members SET status = 'active'
         WHERE user_id = $1 AND community_id = $2`, [HELPER, C1]);
    }
  }, 120000);

  /**
   * The equivalence oracle has to discriminate ALL FOUR metric semantics, not just the one that was
   * broken. A fixture with a single recent match in one community cannot tell a correct
   * implementation from one that community-filters the counterparty join, uses the wrong repeat
   * threshold, or gets the recency boundary wrong — every such variant produces the same numbers.
   * Then the only thing pinning those three is a hand-written expectation, which is a shadow map of
   * the SQL rather than an arbiter over it.
   *
   * So each dimension below is seeded to a value that DIFFERS from what the plausible wrong
   * implementation would produce, and the assertion is against what PostgreSQL actually stored.
   */
  it('discriminates every metric the writer computes, not only the one that was broken', async () => {
    const SYNTHETIC_PAIR = U('e1');   // shared entity id that is NOT a replayed match
    const SYNTHETIC_BONUS = U('e2');

    // repeat_pairs: the SAME counterparty across TWO matches. A wrong `>= 3` threshold gives 0.
    await seedMatch({ matchId: U('d1'), requestId: U('b1'), communities: [C1], completedAt: COMPLETED });
    await seedMatch({ matchId: U('d2'), requestId: U('b2'), communities: [C1], completedAt: '2026-05-01T00:00:00.000Z' });

    // recency boundary: a match completed well OUTSIDE the 365-day window. It still contributes
    // breadth and counterparties, but must NOT count as a recent interaction. An implementation
    // that forgot the window, or applied it to the wrong metric, disagrees here.
    await seedMatch({ matchId: U('d3'), requestId: U('b3'), communities: [C2], completedAt: '2024-01-01T00:00:00.000Z' });

    // `other` is NOT community-filtered: LONELY's canonical row sits in C3, a community LONELY is
    // not even a member of, sharing an entity id with a HELPER row in C1. The live SQL joins on
    // related_entity_id alone, so LONELY counts as HELPER's counterparty in C1. Add a community
    // predicate to that join and this pair vanishes.
    //
    // The entity id is deliberately NOT a replayed match, so these rows are outside the
    // UNEXPECTED_KARMA_PROJECTION check (which only inspects rows whose entity id replay owns).
    await pool.query(
      `INSERT INTO reputation.karma_records (user_id, community_id, points, reason, related_entity_id, created_at)
       VALUES ($1, $2, 60, 'Provided help', $3, $4), ($5, $6, 40, 'Received help', $3, $4)`,
      [HELPER, C1, SYNTHETIC_PAIR, COMPLETED, LONELY, C3]);

    // Canonical but NOT an interaction: a milestone row carrying an entity id, in a community that
    // appears nowhere else in HELPER's history. The writer's SQL names only the two interaction
    // reasons, so this must not lift breadth, volume, or counterparties. An implementation reusing
    // the wider CANONICAL_REASONS set would count C4 and diverge.
    await pool.query(
      `INSERT INTO reputation.karma_records (user_id, community_id, points, reason, related_entity_id, created_at)
       VALUES ($1, $2, 15, 'First help in community', $3, $4)`,
      [HELPER, C4, SYNTHETIC_BONUS, COMPLETED]);

    await coldEffectiveParamsCache();
    await backfill().applyStandingBackfill({ batchSize: 10 });

    // THE ORACLE — the TypeScript metric implementation against the SQL one, per membership, at
    // FULL RESOLUTION.
    //
    // Comparing score buckets is not good enough and it is worth recording why: an extra community
    // moves breadth by min(10, n*3) * 0.4, so a wrong metric shifts a score by ~1 and the pair stays
    // inside the same bucket. The original 0-versus-1 defect was caught by buckets only because
    // bucket '0' happens to be exactly `score <= 0`. Buckets round away precisely the differences
    // this test exists to find, so compare the four numbers themselves.
    const { buildPreviewIndex, computePreviewMetrics } =
      require('../../services/reputation-service/src/services/standingPreview');
    const { getTrustMetrics } = require('../../services/reputation-service/src/database/trustMetricsDb');

    // Every karma row in the database, unfiltered — global breadth and the counterparty join both
    // reach outside the local community, so narrowing this would hide the very semantics under test.
    const allRows = await pool.query(
      `SELECT user_id, community_id, reason, related_entity_id, created_at
       FROM reputation.karma_records`);
    const index = buildPreviewIndex(allRows.rows);

    const cutoff = new Date(FROZEN.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const pairs = await pool.query(
      `SELECT DISTINCT user_id, community_id FROM reputation.karma_records
       UNION
       SELECT user_id, community_id FROM communities.members
        WHERE community_id = ANY($1::uuid[]) AND status = 'active'`, [ALL_COMMUNITIES]);
    expect(pairs.rows.length).toBeGreaterThan(5);

    let sawRepeat = false;
    let sawCrossCommunityCounterparty = false;
    let sawStaleExcluded = false;
    let sawMilestoneExcluded = false;

    for (const { user_id, community_id } of pairs.rows) {
      const sql = await getTrustMetrics(user_id, community_id);
      const recent = await pool.query(
        `SELECT COUNT(*)::int AS c FROM reputation.karma_records
         WHERE user_id = $1 AND community_id = $2
           AND reason IN ('Provided help', 'Received help') AND created_at >= $3`,
        [user_id, community_id, cutoff]);
      const allTime = await pool.query(
        `SELECT COUNT(*)::int AS c FROM reputation.karma_records
         WHERE user_id = $1 AND community_id = $2
           AND reason IN ('Provided help', 'Received help')`, [user_id, community_id]);

      const ts = computePreviewMetrics(index, user_id, community_id, FROZEN.getTime());

      expect({ pair: `${user_id}|${community_id}`, ...ts }).toEqual({
        pair: `${user_id}|${community_id}`,
        recentInteractions: recent.rows[0].c,
        repeatPairs: sql.repeat_interaction_pairs,
        distinctPeople: sql.distinct_people_count,
        distinctCommunities: sql.distinct_communities_count,
      });

      if (sql.repeat_interaction_pairs > 0) sawRepeat = true;
      if (allTime.rows[0].c > recent.rows[0].c) sawStaleExcluded = true;
      if (user_id === HELPER && community_id === C1 && sql.distinct_people_count >= 2) {
        sawCrossCommunityCounterparty = true; // LONELY's row lives in C3, and still counts
      }
      if (user_id === HELPER && community_id === C4) {
        sawMilestoneExcluded = sql.distinct_people_count === 0 && recent.rows[0].c === 0;
      }
    }

    // The fixture must actually exercise all four dimensions, or the loop above proves nothing.
    // Each of these fails if a future edit degenerates the fixture back to the trivial case.
    expect(sawRepeat).toBe(true);
    expect(sawCrossCommunityCounterparty).toBe(true);
    expect(sawStaleExcluded).toBe(true);
    expect(sawMilestoneExcluded).toBe(true);
    // Breadth counts C1 and C2 for HELPER, and NOT C4, whose only row is the milestone.
    expect((await getTrustMetrics(HELPER, C1)).distinct_communities_count).toBe(2);
  }, 180000);

  it('is idempotent: a preview after apply converges with identical distributions', async () => {
    await seedMatch({ matchId: U('d1'), requestId: U('b1'), communities: [C1], completedAt: COMPLETED });
    await seedMatch({ matchId: U('d2'), requestId: U('b2'), communities: [C1, C2], completedAt: COMPLETED });
    await coldEffectiveParamsCache();

    const first = await backfill().analyzeStandingBackfill();
    await backfill().applyStandingBackfill({ batchSize: 10 });

    const afterApply = await fingerprint();
    const second = await backfill().analyzeStandingBackfill();

    expect(await fingerprint()).toBe(afterApply); // the second preview still writes nothing
    expect(second.converged).toBe(true);
    expect(second.predicted.karmaRows).toBe(0);
    // Same dataset, same frozen instant, same config → identical distributions, and no identity
    // projected twice.
    expect(second.scoreBuckets).toEqual(first.scoreBuckets);
    expect(second.interactionDepthBuckets).toEqual(first.interactionDepthBuckets);
    expect(second.interactionBreadthBuckets).toEqual(first.interactionBreadthBuckets);
    expect(await storedScoreBuckets()).toEqual(second.scoreBuckets);
  }, 180000);
});
