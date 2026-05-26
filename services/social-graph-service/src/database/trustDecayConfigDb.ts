import { pool } from '../config/database';

export interface DecayConfig {
  communityId: string | null;
  baseHalfLifeDays: number;
  stabilityGrowthRate: number;
  disappearanceThreshold: number;
}

export async function getDecayConfig(communityId: string): Promise<DecayConfig> {
  const result = await pool.query(
    `SELECT * FROM social_graph.trust_decay_config
     WHERE community_id = $1 OR community_id IS NULL
     ORDER BY community_id NULLS LAST
     LIMIT 1`,
    [communityId]
  );
  const row = result.rows[0];
  return {
    communityId: row.community_id,
    baseHalfLifeDays: row.base_half_life_days,
    stabilityGrowthRate: row.stability_growth_rate,
    disappearanceThreshold: row.disappearance_threshold,
  };
}

export async function getGlobalDecayConfig(): Promise<DecayConfig> {
  const result = await pool.query(
    `SELECT * FROM social_graph.trust_decay_config
     WHERE community_id IS NULL
     LIMIT 1`
  );
  const row = result.rows[0];
  return {
    communityId: null,
    baseHalfLifeDays: row?.base_half_life_days ?? 30.0,
    stabilityGrowthRate: row?.stability_growth_rate ?? 0.20,
    disappearanceThreshold: row?.disappearance_threshold ?? 0.5,
  };
}

export async function upsertDecayConfig(
  communityId: string | null,
  params: Partial<Omit<DecayConfig, 'communityId'>>
): Promise<DecayConfig> {
  const existing = communityId
    ? await pool.query(
        `SELECT * FROM social_graph.trust_decay_config WHERE community_id = $1`,
        [communityId]
      )
    : await pool.query(
        `SELECT * FROM social_graph.trust_decay_config WHERE community_id IS NULL`
      );

  const current = existing.rows[0] ?? {};
  const baseHalfLifeDays = params.baseHalfLifeDays ?? current.base_half_life_days ?? 30.0;
  const stabilityGrowthRate = params.stabilityGrowthRate ?? current.stability_growth_rate ?? 0.20;
  const disappearanceThreshold = params.disappearanceThreshold ?? current.disappearance_threshold ?? 0.5;

  const result = await pool.query(
    `INSERT INTO social_graph.trust_decay_config
       (community_id, base_half_life_days, stability_growth_rate, disappearance_threshold)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (community_id) DO UPDATE SET
       base_half_life_days     = EXCLUDED.base_half_life_days,
       stability_growth_rate   = EXCLUDED.stability_growth_rate,
       disappearance_threshold = EXCLUDED.disappearance_threshold,
       updated_at              = NOW()
     RETURNING *`,
    [communityId, baseHalfLifeDays, stabilityGrowthRate, disappearanceThreshold]
  );

  const row = result.rows[0];
  return {
    communityId: row.community_id,
    baseHalfLifeDays: row.base_half_life_days,
    stabilityGrowthRate: row.stability_growth_rate,
    disappearanceThreshold: row.disappearance_threshold,
  };
}
