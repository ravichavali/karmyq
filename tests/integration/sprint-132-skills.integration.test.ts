/** PR A: execute the migration and resolver against PostgreSQL, without SQL emulation. */
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { createPool } from '../fixtures';
import authPool from '../../services/auth-service/src/database/db';
import { resolveSkillSlug } from '../../services/auth-service/src/services/skillVocabulary';

const migration = readFileSync(join(__dirname, '../../infrastructure/postgres/migrations/20260930-skill-vocabulary.sql'), 'utf8');

describe('Sprint 132 PR A: skill preservation and real SQL resolution', () => {
  const pool = createPool();
  let client: PoolClient | undefined;
  let userId: string;

  beforeAll(async () => {
    // Fail rather than skip if CI's PostgreSQL prerequisite is unavailable.
    await pool.query('SELECT 1');
  });

  beforeEach(async () => {
    client = await pool.connect();
    await client.query('BEGIN');
    userId = randomUUID();
    await client.query(
      'INSERT INTO auth.users (id, name, email, password_hash) VALUES ($1, $2, $3, $4)',
      [userId, 'Skills fixture', `${userId}@skills.karmyq.test`, 'not-a-login-fixture'],
    );
  });

  afterEach(async () => {
    if (!client) return;
    try { await client.query('ROLLBACK'); } finally { client.release(); client = undefined; }
  });

  afterAll(async () => {
    await Promise.all([pool.end(), authPool.end()]);
  });

  it('preserves known and custom legacy skills in the sole active skill store', async () => {
    await client!.query(
      "INSERT INTO auth.user_skills (user_id, skill) VALUES ($1, 'carpentry'), ($1, 'painting'), ($1, 'event_planning')",
      [userId],
    );
    await client!.query(migration);
    const tags = await client!.query(
      "SELECT tag_value, skill_slug FROM auth.user_tags WHERE user_id = $1 AND tag_type = 'skill' ORDER BY tag_value COLLATE \"C\"",
      [userId],
    );
    expect(tags.rows).toEqual([
      { tag_value: 'Carpentry', skill_slug: 'carpentry' },
      { tag_value: 'event_planning', skill_slug: null },
      { tag_value: 'painting', skill_slug: null },
    ]);
    const legacy = await client!.query('SELECT count(*)::int AS count FROM auth.user_skills WHERE user_id = $1', [userId]);
    expect(legacy.rows).toEqual([{ count: 3 }]);
  });

  it('normalizes existing skill tags like new tags while leaving interests unresolved', async () => {
    await client!.query(
      "INSERT INTO auth.user_tags (user_id, tag_type, tag_value) VALUES ($1, 'skill', $2), ($1, 'skill', $3), ($1, 'interest', 'Carpentry')",
      [userId, '  Spanish   tutoring  ', '\tpet\tcare\t'],
    );
    await client!.query(migration);
    const tags = await client!.query('SELECT tag_type, tag_value, skill_slug FROM auth.user_tags WHERE user_id = $1 ORDER BY tag_type, tag_value COLLATE "C"', [userId]);
    expect(tags.rows).toEqual([
      { tag_type: 'interest', tag_value: 'Carpentry', skill_slug: null },
      { tag_type: 'skill', tag_value: '\tpet\tcare\t', skill_slug: 'pet_care' },
      { tag_type: 'skill', tag_value: '  Spanish   tutoring  ', skill_slug: 'tutoring' },
    ]);
  });

  it('keeps exact tag collisions and migration reruns idempotent', async () => {
    await client!.query("INSERT INTO auth.user_tags (user_id, tag_type, tag_value) VALUES ($1, 'skill', 'Carpentry')", [userId]);
    await client!.query("INSERT INTO auth.user_skills (user_id, skill) VALUES ($1, 'carpentry'), ($1, 'Carpentry'), ($1, 'Spanish   tutoring'), ($1, 'painting')", [userId]);
    await client!.query(migration);
    const first = await client!.query('SELECT id, tag_value, skill_slug FROM auth.user_tags WHERE user_id = $1 ORDER BY tag_value COLLATE "C"', [userId]);
    expect(first.rows.map(({ tag_value, skill_slug }) => ({ tag_value, skill_slug }))).toEqual([
      { tag_value: 'Carpentry', skill_slug: 'carpentry' },
      { tag_value: 'Tutoring', skill_slug: 'tutoring' },
      { tag_value: 'painting', skill_slug: null },
    ]);
    await client!.query(migration);
    const second = await client!.query('SELECT id, tag_value, skill_slug FROM auth.user_tags WHERE user_id = $1 ORDER BY tag_value COLLATE "C"', [userId]);
    expect(second.rows).toEqual(first.rows);
  });

  it.each([
    ['Carpentry', 'carpentry'],
    ['\tpet\tcare\t', 'pet_care'],
    ['Spanish   tutoring', 'tutoring'],
    ['tech_support', 'tech_support'],
    ['carp', null],
    ['underwater basket', null],
  ])('resolves %j to %j with the production SQL', async (text, slug) => {
    expect(await resolveSkillSlug(text)).toBe(slug);
  });
});
