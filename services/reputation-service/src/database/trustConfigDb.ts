import { query } from './db';

export interface CommunityTrustConfig {
  depth_weight: number;
  breadth_weight: number;
  feedback_threshold: number;
  min_interactions_for_bonus: number;
  negative_allowed: boolean;
  // Carry model (ADR-038)
  carry_enabled: boolean;
  carry_factor: number;
  carry_cap: number;
}

export const TRUST_CONFIG_DEFAULTS: CommunityTrustConfig = {
  depth_weight: 0.6,
  breadth_weight: 0.4,
  feedback_threshold: 3.0,
  min_interactions_for_bonus: 1,
  negative_allowed: false,
  carry_enabled: true,
  carry_factor: 0.40,
  carry_cap: 59,
};

/**
 * Get community trust configuration from community_configs (ADR-037).
 * Falls back to defaults if no config row exists.
 */
export async function getCommunityTrustConfig(community_id: string): Promise<CommunityTrustConfig> {
  const result = await query(
    `SELECT
       trust_depth_weight,
       trust_breadth_weight,
       trust_feedback_threshold,
       min_interactions_for_trust,
       trust_negative_allowed,
       trust_carry_enabled,
       trust_carry_factor,
       trust_carry_cap
     FROM communities.community_configs
     WHERE community_id = $1`,
    [community_id],
  );

  if (result.rowCount === 0) return TRUST_CONFIG_DEFAULTS;

  const row = result.rows[0];
  return {
    depth_weight: row.trust_depth_weight ?? TRUST_CONFIG_DEFAULTS.depth_weight,
    breadth_weight: row.trust_breadth_weight ?? TRUST_CONFIG_DEFAULTS.breadth_weight,
    feedback_threshold: row.trust_feedback_threshold != null
      ? parseFloat(row.trust_feedback_threshold)
      : TRUST_CONFIG_DEFAULTS.feedback_threshold,
    min_interactions_for_bonus: row.min_interactions_for_trust ?? TRUST_CONFIG_DEFAULTS.min_interactions_for_bonus,
    negative_allowed: row.trust_negative_allowed ?? TRUST_CONFIG_DEFAULTS.negative_allowed,
    carry_enabled: row.trust_carry_enabled ?? TRUST_CONFIG_DEFAULTS.carry_enabled,
    carry_factor: row.trust_carry_factor != null
      ? parseFloat(row.trust_carry_factor)
      : TRUST_CONFIG_DEFAULTS.carry_factor,
    carry_cap: row.trust_carry_cap ?? TRUST_CONFIG_DEFAULTS.carry_cap,
  };
}
