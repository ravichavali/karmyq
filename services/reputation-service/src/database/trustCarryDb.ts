import { query } from './db';

/**
 * Returns the user's highest trust score across all their other active communities
 * (excluding the target community). Used as the source score for the carry model (ADR-038).
 *
 * Carry is one-hop only: we look at communities the user directly belongs to, not
 * trust paths or chains. This prevents manufactured trust via intermediary communities.
 *
 * Returns null if the user has no trust scores in any other community (brand new user).
 */
export async function getMaxOtherCommunityScore(
  userId: string,
  targetCommunityId: string,
): Promise<number | null> {
  const result = await query(
    `SELECT MAX(ts.score) AS max_other_score
     FROM reputation.trust_scores ts
     JOIN communities.members cm
       ON ts.user_id = cm.user_id
      AND ts.community_id = cm.community_id
     WHERE ts.user_id = $1
       AND ts.community_id != $2
       AND cm.status = 'active'`,
    [userId, targetCommunityId],
  );

  const val = result.rows[0]?.max_other_score;
  return val != null ? parseInt(val) : null;
}
