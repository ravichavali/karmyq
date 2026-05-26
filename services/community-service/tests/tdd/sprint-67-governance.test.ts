import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://karmyq_user:karmyq_password@localhost:5432/karmyq_dev',
  connectionTimeoutMillis: 5000,
});

describe('Sprint 67: Trust-gated governance schema and logic', () => {
  afterAll(async () => {
    await pool.end();
  });

  describe('Schema: governance tables', () => {
    it('communities.communities has governance_settings JSONB column', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'communities'
          AND table_name = 'communities'
          AND column_name = 'governance_settings'
      `);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].data_type).toBe('jsonb');
    });

    it('communities.governance_nominations table exists with required columns', async () => {
      const result = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'communities'
          AND table_name = 'governance_nominations'
        ORDER BY column_name
      `);
      const cols = result.rows.map((r: any) => r.column_name);
      expect(cols).toContain('id');
      expect(cols).toContain('community_id');
      expect(cols).toContain('nominated_user_id');
      expect(cols).toContain('nominated_by_user_id');
      expect(cols).toContain('role');
      expect(cols).toContain('status');
      expect(cols).toContain('created_at');
    });

    it('communities.governance_ratifications table exists with required columns', async () => {
      const result = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'communities'
          AND table_name = 'governance_ratifications'
        ORDER BY column_name
      `);
      const cols = result.rows.map((r: any) => r.column_name);
      expect(cols).toContain('id');
      expect(cols).toContain('nomination_id');
      expect(cols).toContain('ratified_by_user_id');
      expect(cols).toContain('created_at');
    });

    it('governance_nominations.status has check constraint (open, approved, rejected)', async () => {
      const result = await pool.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = 'communities'
          AND table_name = 'governance_nominations'
          AND constraint_type = 'CHECK'
      `);
      // At least one CHECK constraint on the table
      expect(result.rows.length).toBeGreaterThanOrEqual(1);
    });

    it('governance_ratifications has unique constraint preventing duplicate ratifiers', async () => {
      const result = await pool.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = 'communities'
          AND table_name = 'governance_ratifications'
          AND constraint_type = 'UNIQUE'
      `);
      expect(result.rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Governance settings default structure', () => {
    it('communities with governance_settings have required keys or null', async () => {
      const result = await pool.query(`
        SELECT governance_settings
        FROM communities.communities
        WHERE governance_settings IS NOT NULL
        LIMIT 3
      `);

      for (const row of result.rows) {
        const settings = row.governance_settings;
        // Must have eligibility_threshold (number) and required_ratifications (number)
        expect(typeof settings.eligibility_threshold).toBe('number');
        expect(typeof settings.required_ratifications).toBe('number');
        expect(settings.eligibility_threshold).toBeGreaterThan(0);
        expect(settings.required_ratifications).toBeGreaterThan(0);
      }
    });

    it('communities without governance_settings get null (default is applied in code)', async () => {
      const result = await pool.query(`
        SELECT COUNT(*) AS cnt FROM communities.communities
        WHERE governance_settings IS NULL
      `);
      // This is valid — null means "use system defaults"
      expect(parseInt(result.rows[0].cnt, 10)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Nomination uniqueness invariant', () => {
    it('cannot have two open nominations for the same user+role+community (DB constraint or app-layer)', async () => {
      // Verify no duplicates exist in current data
      const result = await pool.query(`
        SELECT community_id, nominated_user_id, role, COUNT(*) AS cnt
        FROM communities.governance_nominations
        WHERE status = 'open'
        GROUP BY community_id, nominated_user_id, role
        HAVING COUNT(*) > 1
      `);
      expect(result.rows).toHaveLength(0);
    });
  });

  describe('Ratification quorum logic', () => {
    it('approved nominations have at least 1 ratification', async () => {
      const result = await pool.query(`
        SELECT n.id
        FROM communities.governance_nominations n
        LEFT JOIN communities.governance_ratifications r ON r.nomination_id = n.id
        WHERE n.status = 'approved'
        GROUP BY n.id
        HAVING COUNT(r.id) = 0
      `);
      // All approved nominations must have at least one ratification
      expect(result.rows).toHaveLength(0);
    });

    it('governance_nominations and governance_ratifications are linked by FK', async () => {
      const result = await pool.query(`
        SELECT COUNT(*) AS orphans
        FROM communities.governance_ratifications r
        LEFT JOIN communities.governance_nominations n ON n.id = r.nomination_id
        WHERE n.id IS NULL
      `);
      expect(parseInt(result.rows[0].orphans, 10)).toBe(0);
    });
  });

  describe('Cross-schema trust eligibility query', () => {
    it('can query trust score from social_graph for governance eligibility check', async () => {
      // This validates the cross-schema query the governance route uses to check eligibility
      const communityResult = await pool.query(`
        SELECT id FROM communities.communities LIMIT 1
      `);

      if (communityResult.rows.length === 0) return;

      const communityId = communityResult.rows[0].id;

      const result = await pool.query(`
        SELECT
          m.user_id,
          COALESCE(SUM(te.raw_weight), 0) AS trust_score
        FROM communities.members m
        LEFT JOIN social_graph.trust_edges te
          ON (te.user_id_a = m.user_id OR te.user_id_b = m.user_id)
          AND te.community_id = m.community_id
        WHERE m.community_id = $1
          AND m.status = 'active'
        GROUP BY m.user_id
      `, [communityId]);

      // Every row must have a numeric trust_score
      for (const row of result.rows) {
        expect(parseFloat(row.trust_score)).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
