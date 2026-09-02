/**
 * Sprint 126 — standing projection schema foundation (integration).
 *
 * Proves the migration that Sprint 126's projector depends on actually holds in PostgreSQL 15:
 * zero-default standing, a NOT NULL score, and the two partial unique projection identities that
 * make replay idempotent. Idempotency cannot be asserted against a mock — `ON CONFLICT DO NOTHING`
 * only means anything if the underlying index rejects the duplicate — so this lives in the
 * integration tier, which runs against migrated Postgres in CI and gates the deploy.
 */

import { Pool } from 'pg';
import {
  KARMA_CARRY_IDENTITY_SQL,
  KARMA_CARRY_UNIDENTIFIED_SQL,
} from '../../services/community-service/src/services/fusionService';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://karmyq_test:test_password@localhost:5433/karmyq_test';

// Fixed ids keep cleanup deterministic and collision-free against seeded demo data.
const USER_A = '00000000-0126-4000-8000-000000000001';
const USER_B = '00000000-0126-4000-8000-000000000002';
const COMMUNITY = '00000000-0126-4000-8000-0000000000c1';
const MATCH = '00000000-0126-4000-8000-00000000a001';

// Fusion overlap fixture: two origin communities plus the merged target.
const ORIGIN_A = '00000000-0126-4000-8000-0000000000a1';
const ORIGIN_B = '00000000-0126-4000-8000-0000000000b1';
const MERGED = '00000000-0126-4000-8000-0000000000d1';

let pool: Pool;

async function seed(): Promise<void> {
  await pool.query(
    `INSERT INTO auth.users (id, email, name, password_hash)
     VALUES ($1, 's126a@test.local', 'S126 A', 'x'), ($2, 's126b@test.local', 'S126 B', 'x')
     ON CONFLICT (id) DO NOTHING`,
    [USER_A, USER_B]
  );
  await pool.query(
    `INSERT INTO communities.communities (id, name, creator_id)
     VALUES ($1, 'Sprint 126 Schema Fixture', $2),
            ($3, 'Sprint 126 Origin A', $2),
            ($4, 'Sprint 126 Origin B', $2),
            ($5, 'Sprint 126 Merged', $2)
     ON CONFLICT (id) DO NOTHING`,
    [COMMUNITY, USER_A, ORIGIN_A, ORIGIN_B, MERGED]
  );
}

const ALL_COMMUNITIES = [COMMUNITY, ORIGIN_A, ORIGIN_B, MERGED];

async function cleanupRows(): Promise<void> {
  await pool.query('DELETE FROM reputation.karma_records WHERE community_id = ANY($1::uuid[])', [
    ALL_COMMUNITIES,
  ]);
  await pool.query('DELETE FROM reputation.activity_log WHERE community_id = ANY($1::uuid[])', [
    ALL_COMMUNITIES,
  ]);
  await pool.query('DELETE FROM reputation.trust_scores WHERE community_id = ANY($1::uuid[])', [
    ALL_COMMUNITIES,
  ]);
}

/** Returns the PostgreSQL SQLSTATE for a statement expected to fail, or null if it succeeded. */
async function sqlstateOf(text: string, params: unknown[]): Promise<string | null> {
  try {
    await pool.query(text, params);
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? 'UNKNOWN';
  }
}

/**
 * The migration is NOT applied here.
 *
 * These tests assert the migration's EFFECTS against whatever schema the database already has: in
 * CI the full migration chain is replayed by `scripts/ci-apply-full-schema.sh` before this job, and
 * locally the scratch database is loaded from `init.sql`, which is generated from that same chain.
 *
 * An earlier version read the migration file and ran it through `pool.query` twice to prove
 * re-running was safe. That fed file contents into a query, which CodeQL correctly flags as
 * `js/sql-injection` (it cannot know the path is a repo constant) — and the idempotency claim it
 * made is already proved far more rigorously by `ci-apply-full-schema.sh --drift-check`, which
 * replays every migration and fails on any schema change. Removing it loses no coverage and removes
 * a finding rather than dismissing one.
 */
beforeAll(async () => {
  pool = new Pool({ connectionString: DATABASE_URL });
  await seed();
  await cleanupRows();
});

afterAll(async () => {
  if (!pool) return;
  await cleanupRows();
  await pool.query('DELETE FROM communities.communities WHERE id = ANY($1::uuid[])', [
    ALL_COMMUNITIES,
  ]);
  await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [[USER_A, USER_B]]);
  await pool.end();
});

describe('Sprint 126 trust_scores zero-standing default', () => {
  afterEach(cleanupRows);

  it('inserts 0 when score is omitted, so stored and missing standing agree', async () => {
    const result = await pool.query<{ score: number }>(
      `INSERT INTO reputation.trust_scores (user_id, community_id)
       VALUES ($1, $2) RETURNING score`,
      [USER_A, COMMUNITY]
    );
    expect(result.rows[0].score).toBe(0);
  });

  it('rejects an explicit NULL score with not_null_violation', async () => {
    const code = await sqlstateOf(
      `INSERT INTO reputation.trust_scores (user_id, community_id, score)
       VALUES ($1, $2, NULL)`,
      [USER_A, COMMUNITY]
    );
    expect(code).toBe('23502');
  });
});

describe('Sprint 126 projection identities', () => {
  afterEach(cleanupRows);

  it('indexes related_entity_id, which the trust calculator self-joins on', async () => {
    const result = await pool.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
       WHERE schemaname = 'reputation' AND indexname = 'idx_karma_related_entity'`,
    );
    // trustMetricsDb joins karma_records to itself on related_entity_id ("who else was awarded for
    // this match"). Without a leading index that is a hash/seq scan of the whole table on every
    // trust-score computation — live and during replay alike.
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].indexdef).toMatch(/related_entity_id/);
    expect(result.rows[0].indexdef).toMatch(/WHERE \(related_entity_id IS NOT NULL\)/);
  });

  it('creates both partial unique projection indexes', async () => {
    const result = await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'reputation'
         AND indexname IN ('uq_karma_match_projection', 'uq_activity_match_projection')
       ORDER BY indexname`
    );
    expect(result.rows.map((r) => r.indexname)).toEqual([
      'uq_activity_match_projection',
      'uq_karma_match_projection',
    ]);
  });

  it('rejects a duplicate karma projection identity with unique_violation', async () => {
    const insert = `INSERT INTO reputation.karma_records
        (user_id, community_id, points, reason, related_entity_id)
       VALUES ($1, $2, $3, 'Provided help', $4)`;
    await pool.query(insert, [USER_A, COMMUNITY, 15, MATCH]);

    const code = await sqlstateOf(insert, [USER_A, COMMUNITY, 15, MATCH]);
    expect(code).toBe('23505');
  });

  it('rejects a duplicate karma identity even when the points differ', async () => {
    const insert = `INSERT INTO reputation.karma_records
        (user_id, community_id, points, reason, related_entity_id)
       VALUES ($1, $2, $3, 'Provided help', $4)`;
    await pool.query(insert, [USER_A, COMMUNITY, 15, MATCH]);

    const code = await sqlstateOf(insert, [USER_A, COMMUNITY, 999, MATCH]);
    expect(code).toBe('23505');
  });

  it('still allows the same match to award both participants and both reasons', async () => {
    const insert = `INSERT INTO reputation.karma_records
        (user_id, community_id, points, reason, related_entity_id)
       VALUES ($1, $2, $3, $4, $5)`;
    await pool.query(insert, [USER_A, COMMUNITY, 15, 'Provided help', MATCH]);
    await pool.query(insert, [USER_B, COMMUNITY, 10, 'Received help', MATCH]);
    await pool.query(insert, [USER_A, COMMUNITY, 15, 'First help in community', MATCH]);

    const count = await pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM reputation.karma_records WHERE related_entity_id = $1',
      [MATCH]
    );
    expect(count.rows[0].count).toBe('3');
  });

  it('rejects a duplicate activity projection identity with unique_violation', async () => {
    const insert = `INSERT INTO reputation.activity_log
        (user_id, community_id, activity_type, related_entity_id)
       VALUES ($1, $2, 'help_provided', $3)`;
    await pool.query(insert, [USER_A, COMMUNITY, MATCH]);

    const code = await sqlstateOf(insert, [USER_A, COMMUNITY, MATCH]);
    expect(code).toBe('23505');
  });

  it('leaves rows with a null related_entity_id unrestricted (identity rows only)', async () => {
    const karma = `INSERT INTO reputation.karma_records
        (user_id, community_id, points, reason, related_entity_id)
       VALUES ($1, $2, 5, 'Manual adjustment', NULL)`;
    await pool.query(karma, [USER_A, COMMUNITY]);
    expect(await sqlstateOf(karma, [USER_A, COMMUNITY])).toBeNull();

    const activity = `INSERT INTO reputation.activity_log
        (user_id, community_id, activity_type, related_entity_id)
       VALUES ($1, $2, 'login', NULL)`;
    await pool.query(activity, [USER_A, COMMUNITY]);
    expect(await sqlstateOf(activity, [USER_A, COMMUNITY])).toBeNull();
  });
});

describe('Sprint 126 fusion karma carry under the projection index', () => {
  afterEach(cleanupRows);

  /**
   * Production splits ONE match's karma pool across up to three shared communities, so the same
   * user legitimately holds the same (reason, match) identity in two communities that later fuse.
   * This runs the exact SQL fusionService issues — imported, not retyped — so the assertion cannot
   * drift away from the shipped statement.
   */
  it('sums the points of an identity that existed in both origin communities', async () => {
    const insert = `INSERT INTO reputation.karma_records
        (user_id, community_id, points, reason, related_entity_id, created_at)
       VALUES ($1, $2, $3, 'Provided help', $4, $5)`;
    await pool.query(insert, [USER_A, ORIGIN_A, 6, MATCH, '2026-01-01T00:00:00Z']);
    await pool.query(insert, [USER_A, ORIGIN_B, 4, MATCH, '2026-02-01T00:00:00Z']);

    await pool.query(KARMA_CARRY_IDENTITY_SQL, [MERGED, [ORIGIN_A, ORIGIN_B]]);

    // created_at is `timestamp without time zone`; formatting in SQL keeps the assertion free of
    // the driver's local-timezone interpretation.
    const merged = await pool.query<{ points: number; created_at: string }>(
      `SELECT points, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
       FROM reputation.karma_records
       WHERE community_id = $1 AND related_entity_id = $2`,
      [MERGED, MATCH]
    );
    expect(merged.rows).toHaveLength(1);
    // 6 + 4 — not 6, and not 4. A bare ON CONFLICT DO NOTHING would keep one of them at random.
    expect(merged.rows[0].points).toBe(10);
    // Earliest timestamp survives, so the merged history is not backdated forward.
    expect(merged.rows[0].created_at).toBe('2026-01-01 00:00:00');
  });

  it('copies non-overlapping identities unchanged', async () => {
    const other = '00000000-0126-4000-8000-00000000a002';
    const insert = `INSERT INTO reputation.karma_records
        (user_id, community_id, points, reason, related_entity_id, created_at)
       VALUES ($1, $2, $3, 'Provided help', $4, '2026-03-01T00:00:00Z')`;
    await pool.query(insert, [USER_A, ORIGIN_A, 6, MATCH]);
    await pool.query(insert, [USER_B, ORIGIN_B, 7, other]);

    await pool.query(KARMA_CARRY_IDENTITY_SQL, [MERGED, [ORIGIN_A, ORIGIN_B]]);

    const merged = await pool.query<{ user_id: string; points: number }>(
      `SELECT user_id, points FROM reputation.karma_records
       WHERE community_id = $1 ORDER BY points`,
      [MERGED]
    );
    expect(merged.rows.map((r) => r.points)).toEqual([6, 7]);
  });

  it('keeps unidentified rows row-for-row instead of aggregating them', async () => {
    const insert = `INSERT INTO reputation.karma_records
        (user_id, community_id, points, reason, related_entity_id, created_at)
       VALUES ($1, $2, $3, 'Manual adjustment', NULL, '2026-03-01T00:00:00Z')`;
    await pool.query(insert, [USER_A, ORIGIN_A, 3]);
    await pool.query(insert, [USER_A, ORIGIN_A, 5]);

    await pool.query(KARMA_CARRY_UNIDENTIFIED_SQL, [MERGED, [ORIGIN_A, ORIGIN_B]]);

    const merged = await pool.query<{ points: number }>(
      `SELECT points FROM reputation.karma_records
       WHERE community_id = $1 AND related_entity_id IS NULL ORDER BY points`,
      [MERGED]
    );
    // Two distinct adjustments stay two rows — summing them into one 8 would erase real history.
    expect(merged.rows.map((r) => r.points)).toEqual([3, 5]);
  });

  it('is safe to re-run: a repeated carry adds nothing', async () => {
    const insert = `INSERT INTO reputation.karma_records
        (user_id, community_id, points, reason, related_entity_id, created_at)
       VALUES ($1, $2, 6, 'Provided help', $3, '2026-01-01T00:00:00Z')`;
    await pool.query(insert, [USER_A, ORIGIN_A, MATCH]);

    await pool.query(KARMA_CARRY_IDENTITY_SQL, [MERGED, [ORIGIN_A, ORIGIN_B]]);
    await pool.query(KARMA_CARRY_IDENTITY_SQL, [MERGED, [ORIGIN_A, ORIGIN_B]]);

    const count = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM reputation.karma_records WHERE community_id = $1`,
      [MERGED]
    );
    expect(count.rows[0].count).toBe('1');
  });
});
