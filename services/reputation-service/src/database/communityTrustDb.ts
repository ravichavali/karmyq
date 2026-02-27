import { query } from './db';

export interface CommunityTrustScore {
  community_id: string;
  score: number;
  member_quality_score: number;
  bonding_score: number;
  bridging_score: number;
  active_member_count: number;
  last_calculated: string;
}

export async function getCommunityTrustScore(community_id: string): Promise<CommunityTrustScore | null> {
  const result = await query(
    `SELECT community_id, score, member_quality_score, bonding_score, bridging_score,
            active_member_count, last_calculated
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
