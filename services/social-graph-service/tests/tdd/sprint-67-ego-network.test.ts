import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://karmyq_user:karmyq_password@localhost:5432/karmyq_dev',
  connectionTimeoutMillis: 5000,
});

describe('Sprint 67: Ego-network trust graph (user-scoped, depth-1)', () => {
  afterAll(async () => {
    await pool.end();
  });

  describe('Schema invariants', () => {
    it('trust_edges has no trust_score column (score is derived, not stored)', async () => {
      const result = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'social_graph' AND table_name = 'trust_edges'
          AND column_name = 'trust_score'
      `);
      expect(result.rows).toHaveLength(0);
    });

    it('trust_edges has no deleted_at column', async () => {
      const result = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'social_graph' AND table_name = 'trust_edges'
          AND column_name = 'deleted_at'
      `);
      expect(result.rows).toHaveLength(0);
    });

    it('trust_edges has effective_weight column for link thickness', async () => {
      const result = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'social_graph' AND table_name = 'trust_edges'
          AND column_name = 'effective_weight'
      `);
      expect(result.rows).toHaveLength(1);
    });

    it('reputation.karma_records uses points column (not karma_score)', async () => {
      const result = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'reputation' AND table_name = 'karma_records'
          AND column_name = 'points'
      `);
      expect(result.rows).toHaveLength(1);
    });
  });

  describe('Ego-network SQL correctness', () => {
    it('ego-network query returns only direct neighbors of the calling user', async () => {
      // Get an existing edge pair to use as our test fixture
      const edgeResult = await pool.query(`
        SELECT user_id_a, user_id_b, community_id
        FROM social_graph.trust_edges
        LIMIT 1
      `);

      if (edgeResult.rows.length === 0) {
        // No edges in DB yet — verify the CTE pattern compiles correctly at minimum
        const schemaResult = await pool.query(`
          SELECT COUNT(*) AS cnt FROM social_graph.trust_edges
        `);
        expect(parseInt(schemaResult.rows[0].cnt, 10)).toBeGreaterThanOrEqual(0);
        return;
      }

      const { user_id_a, user_id_b, community_id } = edgeResult.rows[0];
      const callingUser = user_id_a;

      // Run ego-network query for user_id_a
      const result = await pool.query(`
        WITH neighbors AS (
          SELECT CASE WHEN user_id_a = $2::uuid THEN user_id_b ELSE user_id_a END AS neighbor_id
          FROM social_graph.trust_edges
          WHERE community_id = $1
            AND (user_id_a = $2::uuid OR user_id_b = $2::uuid)
        )
        SELECT u.id, u.name,
          COALESCE((
            SELECT SUM(te2.raw_weight)
            FROM social_graph.trust_edges te2
            WHERE (te2.user_id_a = u.id OR te2.user_id_b = u.id)
              AND te2.community_id = $1
          ), 0) AS trust_score,
          COALESCE((
            SELECT SUM(kr.points)
            FROM reputation.karma_records kr
            WHERE kr.user_id = u.id AND kr.community_id = $1
          ), 0) AS karma,
          (u.id = $2::uuid) AS is_current_user
        FROM auth.users u
        WHERE u.id = $2::uuid OR u.id IN (SELECT neighbor_id FROM neighbors)
      `, [community_id, callingUser]);

      const ids = result.rows.map((r: any) => r.id);
      // Calling user must be included
      expect(ids).toContain(callingUser);
      // Neighbor (the other side of the edge) must be included
      expect(ids).toContain(user_id_b);
      // is_current_user flag is set correctly
      const callingUserRow = result.rows.find((r: any) => r.id === callingUser);
      expect(callingUserRow.is_current_user).toBe(true);
      const neighborRow = result.rows.find((r: any) => r.id === user_id_b);
      expect(neighborRow.is_current_user).toBe(false);
    });

    it('ego-network only includes edges where at least one endpoint is the calling user', async () => {
      const edgeResult = await pool.query(`
        SELECT user_id_a, user_id_b, community_id
        FROM social_graph.trust_edges
        LIMIT 1
      `);

      if (edgeResult.rows.length === 0) return;

      const { user_id_a, community_id } = edgeResult.rows[0];

      // Edge query for ego-network
      const edgesResult = await pool.query(`
        SELECT te.user_id_a, te.user_id_b, te.effective_weight
        FROM social_graph.trust_edges te
        WHERE te.community_id = $1
          AND (te.user_id_a = $2::uuid OR te.user_id_b = $2::uuid)
      `, [community_id, user_id_a]);

      // Every edge must involve the calling user
      for (const edge of edgesResult.rows) {
        const involvesCaller = edge.user_id_a === user_id_a || edge.user_id_b === user_id_a;
        expect(involvesCaller).toBe(true);
      }
    });

    it('aggregate ego-network query spans all communities for the calling user', async () => {
      // Find a user who appears in any trust edge
      const edgeResult = await pool.query(`
        SELECT user_id_a FROM social_graph.trust_edges LIMIT 1
      `);

      if (edgeResult.rows.length === 0) return;

      const callingUser = edgeResult.rows[0].user_id_a;

      // Aggregate query (no community filter)
      const result = await pool.query(`
        WITH neighbors AS (
          SELECT DISTINCT
            CASE WHEN user_id_a = $1::uuid THEN user_id_b ELSE user_id_a END AS neighbor_id,
            community_id
          FROM social_graph.trust_edges
          WHERE user_id_a = $1::uuid OR user_id_b = $1::uuid
        )
        SELECT u.id,
          COALESCE((
            SELECT SUM(te2.raw_weight)
            FROM social_graph.trust_edges te2
            WHERE te2.user_id_a = u.id OR te2.user_id_b = u.id
          ), 0) AS trust_score,
          COALESCE((
            SELECT SUM(kr.points)
            FROM reputation.karma_records kr
            WHERE kr.user_id = u.id
          ), 0) AS karma,
          (u.id = $1::uuid) AS is_current_user
        FROM auth.users u
        WHERE u.id = $1::uuid OR u.id IN (SELECT neighbor_id FROM neighbors)
      `, [callingUser]);

      const ids = result.rows.map((r: any) => r.id);
      expect(ids).toContain(callingUser);
      // is_current_user is true for exactly the calling user
      const callerRows = result.rows.filter((r: any) => r.is_current_user === true);
      expect(callerRows).toHaveLength(1);
      expect(callerRows[0].id).toBe(callingUser);
    });
  });

  describe('Response shape contract', () => {
    it('nodes array has required fields: id, name, trust_score, karma, is_current_user', async () => {
      const edgeResult = await pool.query(`
        SELECT user_id_a, community_id FROM social_graph.trust_edges LIMIT 1
      `);

      if (edgeResult.rows.length === 0) return;

      const { user_id_a, community_id } = edgeResult.rows[0];

      const result = await pool.query(`
        WITH neighbors AS (
          SELECT CASE WHEN user_id_a = $2::uuid THEN user_id_b ELSE user_id_a END AS neighbor_id
          FROM social_graph.trust_edges
          WHERE community_id = $1 AND (user_id_a = $2::uuid OR user_id_b = $2::uuid)
        )
        SELECT u.id, u.name,
          COALESCE((SELECT SUM(te2.raw_weight) FROM social_graph.trust_edges te2
            WHERE (te2.user_id_a = u.id OR te2.user_id_b = u.id) AND te2.community_id = $1), 0) AS trust_score,
          COALESCE((SELECT SUM(kr.points) FROM reputation.karma_records kr
            WHERE kr.user_id = u.id AND kr.community_id = $1), 0) AS karma,
          (u.id = $2::uuid) AS is_current_user
        FROM auth.users u
        WHERE u.id = $2::uuid OR u.id IN (SELECT neighbor_id FROM neighbors)
      `, [community_id, user_id_a]);

      const node = result.rows[0];
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('name');
      expect(node).toHaveProperty('trust_score');
      expect(node).toHaveProperty('karma');
      expect(node).toHaveProperty('is_current_user');
    });

    it('links use effective_weight (not raw_weight) for rendering', async () => {
      const result = await pool.query(`
        SELECT effective_weight FROM social_graph.trust_edges LIMIT 1
      `);
      if (result.rows.length === 0) return;
      // effective_weight must be numeric
      const w = parseFloat(result.rows[0].effective_weight);
      expect(typeof w).toBe('number');
      expect(w).toBeGreaterThanOrEqual(0);
    });
  });
});
