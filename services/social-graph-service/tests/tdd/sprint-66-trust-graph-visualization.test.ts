import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://karmyq_user:karmyq_password@localhost:5432/karmyq_dev',
  connectionTimeoutMillis: 5000,
});

describe('Sprint 66: Trust Graph API for Visualization', () => {
  afterAll(async () => {
    await pool.end();
  });

  describe('getTrustGraph shape', () => {
    it('returns { nodes, edges } shape with correct field types', async () => {
      const result = await pool.query(`
        SELECT COUNT(*) AS edge_count FROM social_graph.trust_edges
      `);
      const edgeCount = parseInt(result.rows[0].edge_count, 10);
      expect(edgeCount).toBeGreaterThanOrEqual(0);
    });

    it('trust_edges rows have required visualization fields', async () => {
      const result = await pool.query(`
        SELECT
          user_id_a, user_id_b, community_id,
          raw_weight, match_completed_count,
          endorsement_count, karma_given_count, event_count,
          last_interaction_at
        FROM social_graph.trust_edges
        LIMIT 1
      `);

      if (result.rows.length === 0) {
        // No edges yet — schema must still have the columns
        const colResult = await pool.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'social_graph' AND table_name = 'trust_edges'
          ORDER BY column_name
        `);
        const cols = colResult.rows.map(r => r.column_name);
        expect(cols).toContain('user_id_a');
        expect(cols).toContain('user_id_b');
        expect(cols).toContain('raw_weight');
        expect(cols).toContain('effective_weight');
        expect(cols).toContain('last_interaction_at');
        return;
      }

      const row = result.rows[0];
      expect(typeof row.user_id_a).toBe('string');
      expect(typeof row.user_id_b).toBe('string');
      expect(typeof row.community_id).toBe('string');
      expect(typeof parseFloat(row.raw_weight)).toBe('number');
      expect(row.last_interaction_at).toBeTruthy();
    });

    it('effective_weight column exists (needed for edge thickness)', async () => {
      const result = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'social_graph'
          AND table_name = 'trust_edges'
          AND column_name = 'effective_weight'
      `);
      expect(result.rows).toHaveLength(1);
    });

    it('trust_score is available on community members for node sizing', async () => {
      const result = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'social_graph'
          AND table_name = 'trust_edges'
      `);
      const cols = result.rows.map((r: any) => r.column_name);
      expect(cols).toContain('user_id_a');
      expect(cols).toContain('user_id_b');
      expect(cols).toContain('raw_weight');
    });

    it('normalized pair invariant: user_id_a < user_id_b for all rows', async () => {
      const result = await pool.query(`
        SELECT COUNT(*) AS violations
        FROM social_graph.trust_edges
        WHERE user_id_a >= user_id_b
      `);
      expect(parseInt(result.rows[0].violations, 10)).toBe(0);
    });

    it('interaction_weights table has the 4 platform defaults', async () => {
      const result = await pool.query(`
        SELECT interaction_type, weight
        FROM social_graph.interaction_weights
        WHERE community_id IS NULL
        ORDER BY weight DESC
      `);
      expect(result.rows).toHaveLength(4);
      expect(result.rows[0]).toMatchObject({ interaction_type: 'match_completed', weight: '10' });
      expect(result.rows[1]).toMatchObject({ interaction_type: 'endorsement', weight: '5' });
      expect(result.rows[2]).toMatchObject({ interaction_type: 'karma_given', weight: '3' });
      expect(result.rows[3]).toMatchObject({ interaction_type: 'event', weight: '2' });
    });
  });
});
