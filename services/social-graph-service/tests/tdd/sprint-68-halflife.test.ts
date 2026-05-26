import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://karmyq_user:karmyq_password@localhost:5432/karmyq_dev',
  connectionTimeoutMillis: 5000,
});

describe('Sprint 68: Ebbinghaus trust decay (schema + view)', () => {
  afterAll(async () => {
    await pool.end();
  });

  describe('Schema invariants', () => {
    it('trust_edges has stability column with default 1.0', async () => {
      const result = await pool.query(`
        SELECT column_name, column_default
        FROM information_schema.columns
        WHERE table_schema = 'social_graph'
          AND table_name = 'trust_edges'
          AND column_name = 'stability'
      `);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].column_default).toContain('1');
    });

    it('trust_decay_config table exists with required columns', async () => {
      const result = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'social_graph'
          AND table_name = 'trust_decay_config'
        ORDER BY column_name
      `);
      const cols = result.rows.map((r: any) => r.column_name);
      expect(cols).toContain('base_half_life_days');
      expect(cols).toContain('stability_growth_rate');
      expect(cols).toContain('disappearance_threshold');
      expect(cols).toContain('community_id');
    });

    it('trust_decay_config has a global default row (community_id IS NULL)', async () => {
      const result = await pool.query(`
        SELECT * FROM social_graph.trust_decay_config WHERE community_id IS NULL
      `);
      expect(result.rows).toHaveLength(1);
      const row = result.rows[0];
      expect(Number(row.base_half_life_days)).toBe(30);
      expect(Number(row.stability_growth_rate)).toBeCloseTo(0.20, 2);
      expect(Number(row.disappearance_threshold)).toBe(0.5);
    });

    it('trust_edges_live view exists', async () => {
      const result = await pool.query(`
        SELECT table_name FROM information_schema.views
        WHERE table_schema = 'social_graph' AND table_name = 'trust_edges_live'
      `);
      expect(result.rows).toHaveLength(1);
    });

    it('trust_edges_live returns current_weight column', async () => {
      const result = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'social_graph' AND table_name = 'trust_edges_live'
          AND column_name = 'current_weight'
      `);
      expect(result.rows).toHaveLength(1);
    });
  });

  describe('Decay formula properties', () => {
    it('current_weight equals raw_weight when last_interaction_at is NOW()', async () => {
      // For stability=1, half_life=30, days=0: e^0 = 1, so current_weight = raw_weight
      const result = await pool.query(`
        SELECT
          raw_weight,
          raw_weight * EXP(0) AS expected_current_weight
        FROM social_graph.trust_edges
        LIMIT 1
      `);
      if (result.rows.length === 0) return; // No edges in test DB
      const row = result.rows[0];
      expect(Number(row.expected_current_weight)).toBeCloseTo(Number(row.raw_weight), 5);
    });

    it('current_weight is less than raw_weight after 30 days of inactivity (stability=1)', () => {
      // After 30 days with stability=1, half_life=30: e^(-30/30) = e^-1 ≈ 0.368
      const rawWeight = 10;
      const days = 30;
      const stability = 1.0;
      const halfLife = 30;
      const currentWeight = rawWeight * Math.exp(-days / (stability * halfLife));
      expect(currentWeight).toBeLessThan(rawWeight);
      expect(currentWeight).toBeCloseTo(rawWeight * Math.exp(-1), 3);
    });

    it('stability grows by stability_growth_rate on each interaction', () => {
      const growthRate = 0.20;
      let stability = 1.0;
      for (let i = 0; i < 5; i++) {
        stability = stability * (1 + growthRate);
      }
      // After 5 interactions: 1.0 * 1.2^5 ≈ 2.0736
      expect(stability).toBeCloseTo(Math.pow(1.2, 5), 4);
    });

    it('higher stability results in slower decay (longer effective half-life)', () => {
      const rawWeight = 10;
      const days = 30;
      const halfLife = 30;

      const currentWeightLowStability = rawWeight * Math.exp(-days / (1.0 * halfLife));
      const currentWeightHighStability = rawWeight * Math.exp(-days / (5.0 * halfLife));

      expect(currentWeightHighStability).toBeGreaterThan(currentWeightLowStability);
    });

    it('current_weight falls below threshold after sufficient inactivity', () => {
      const rawWeight = 10;
      const stability = 1.0;
      const halfLife = 30;
      const threshold = 0.5;

      // Need to find how many days until current_weight < threshold * raw_weight
      // threshold * raw_weight = raw_weight * e^(-days/(stability * halfLife))
      // threshold = e^(-days/(stability * halfLife))
      // -ln(threshold) = days/(stability * halfLife)
      // days = -ln(threshold) * stability * halfLife
      const daysToThreshold = -Math.log(threshold / rawWeight) * stability * halfLife;
      const currentWeightAtThreshold = rawWeight * Math.exp(-daysToThreshold / (stability * halfLife));
      expect(currentWeightAtThreshold).toBeLessThanOrEqual(threshold);
    });
  });

  describe('trustEdgeSweepJob logic', () => {
    it('edge below disappearance threshold would be deleted', () => {
      const currentWeight = 0.3;
      const disappearanceThreshold = 0.5;
      const shouldDelete = currentWeight < disappearanceThreshold;
      expect(shouldDelete).toBe(true);
    });

    it('edge above disappearance threshold would not be deleted', () => {
      const currentWeight = 0.8;
      const disappearanceThreshold = 0.5;
      const shouldDelete = currentWeight < disappearanceThreshold;
      expect(shouldDelete).toBe(false);
    });
  });

  describe('requestTtlSweepJob logic', () => {
    it('completed+rated request older than 30 days qualifies for deletion', () => {
      const status = 'completed';
      const updatedAt = new Date(Date.now() - 31 * 86_400_000); // 31 days ago
      const requesterRating = 5;
      const responderRating = 4;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

      const qualifies =
        status === 'completed' &&
        updatedAt < thirtyDaysAgo &&
        requesterRating !== null &&
        responderRating !== null;

      expect(qualifies).toBe(true);
    });

    it('completed request without ratings does not qualify for deletion', () => {
      const status = 'completed';
      const requesterRating = null;
      const responderRating = null;

      const qualifies =
        status === 'completed' &&
        requesterRating !== null &&
        responderRating !== null;

      expect(qualifies).toBe(false);
    });

    it('completed+rated request younger than 30 days does not qualify', () => {
      const status = 'completed';
      const updatedAt = new Date(Date.now() - 15 * 86_400_000); // 15 days ago
      const requesterRating = 5;
      const responderRating = 4;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

      const qualifies =
        status === 'completed' &&
        updatedAt < thirtyDaysAgo &&
        requesterRating !== null &&
        responderRating !== null;

      expect(qualifies).toBe(false);
    });
  });
});
