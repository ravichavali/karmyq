import { query } from './db';

export interface CommunityTrustScore {
  community_id: string;
  score: number;
  member_quality_score: number;
  bonding_score: number;
  bridging_score: number;
  active_member_count: number;
  last_calculated: string;
  previous_score: number | null;
  previous_calculated_at: string | null;
  network_cohesion_score: number | null;
  network_reciprocity: number | null;
  network_density: number | null;
  network_clustering: number | null;
  network_avg_path_length: number | null;
}

export async function getCommunityTrustScore(community_id: string): Promise<CommunityTrustScore | null> {
  const result = await query(
    `SELECT community_id, score, member_quality_score, bonding_score, bridging_score,
            active_member_count, last_calculated,
            previous_score, previous_calculated_at,
            network_cohesion_score, network_reciprocity, network_density,
            network_clustering, network_avg_path_length
     FROM reputation.community_trust_scores
     WHERE community_id = $1`,
    [community_id]
  );
  if (result.rows.length === 0) return null;
  const r = result.rows[0];
  return {
    community_id: r.community_id,
    score: parseInt(r.score),
    member_quality_score: parseInt(r.member_quality_score),
    bonding_score: parseInt(r.bonding_score),
    bridging_score: parseInt(r.bridging_score),
    active_member_count: parseInt(r.active_member_count),
    last_calculated: r.last_calculated,
    previous_score: r.previous_score != null ? parseInt(r.previous_score) : null,
    previous_calculated_at: r.previous_calculated_at ?? null,
    network_cohesion_score: r.network_cohesion_score != null ? parseInt(r.network_cohesion_score) : null,
    network_reciprocity: r.network_reciprocity != null ? parseFloat(r.network_reciprocity) : null,
    network_density: r.network_density != null ? parseFloat(r.network_density) : null,
    network_clustering: r.network_clustering != null ? parseFloat(r.network_clustering) : null,
    network_avg_path_length: r.network_avg_path_length != null ? parseFloat(r.network_avg_path_length) : null,
  };
}

export async function upsertCommunityTrustScore(
  community_id: string,
  data: {
    score: number;
    member_quality_score: number;
    bonding_score: number;
    bridging_score: number;
    active_member_count: number;
  }
): Promise<void> {
  await query(
    `INSERT INTO reputation.community_trust_scores
       (community_id, score, member_quality_score, bonding_score, bridging_score, active_member_count, last_calculated)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (community_id) DO UPDATE SET
       score = EXCLUDED.score,
       member_quality_score = EXCLUDED.member_quality_score,
       bonding_score = EXCLUDED.bonding_score,
       bridging_score = EXCLUDED.bridging_score,
       active_member_count = EXCLUDED.active_member_count,
       last_calculated = NOW()`,
    [community_id, data.score, data.member_quality_score, data.bonding_score, data.bridging_score, data.active_member_count]
  );
}

export async function preservePreviousScore(community_id: string): Promise<void> {
  await query(
    `UPDATE reputation.community_trust_scores
     SET previous_score = score,
         previous_calculated_at = last_calculated
     WHERE community_id = $1`,
    [community_id]
  );
}

export async function upsertNetworkCohesionMetrics(
  community_id: string,
  data: {
    network_cohesion_score: number;
    network_reciprocity: number;
    network_density: number;
    network_clustering: number;
    network_avg_path_length: number;
  }
): Promise<void> {
  const result = await query(
    `UPDATE reputation.community_trust_scores
     SET network_cohesion_score = $2,
         network_reciprocity = $3,
         network_density = $4,
         network_clustering = $5,
         network_avg_path_length = $6
     WHERE community_id = $1`,
    [
      community_id,
      data.network_cohesion_score,
      data.network_reciprocity,
      data.network_density,
      data.network_clustering,
      data.network_avg_path_length,
    ]
  );
  if (result.rowCount === 0) {
    console.warn(`upsertNetworkCohesionMetrics: no row found for community ${community_id}`);
  }
}
