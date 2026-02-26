import { query } from './db';

export async function insertFeedback(
  fromUserId: string,
  toUserId: string,
  matchId: string,
  communityId: string,
  rating: number,
): Promise<void> {
  await query(
    `INSERT INTO feedback.feedback (from_user_id, to_user_id, request_match_id, community_id, rating)
     VALUES ($1, $2, $3, $4, $5)`,
    [fromUserId, toUserId, matchId, communityId, rating],
  );
}

export async function hasSubmittedFeedback(fromUserId: string, matchId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM feedback.feedback WHERE from_user_id = $1 AND request_match_id = $2 LIMIT 1`,
    [fromUserId, matchId],
  );
  return result.rows.length > 0;
}

export async function getAvgFeedback(toUserId: string): Promise<number | null> {
  const result = await query(
    `SELECT AVG(rating)::NUMERIC(3,2) AS avg_rating FROM feedback.feedback WHERE to_user_id = $1`,
    [toUserId],
  );
  const avg = result.rows[0]?.avg_rating;
  return avg !== null && avg !== undefined ? parseFloat(avg) : null;
}

/**
 * Returns a blended feedback average for trust score computation:
 *   blend = localWeight × (avg in this community) + globalWeight × (avg across all communities)
 *
 * Weights default to 70/30 — local context matters more, but character is portable.
 *
 * Edge cases:
 *   - Both sides have data  → weighted blend
 *   - Only one side has data → use that side directly (no penalizing for lack of cross-community data)
 *   - No feedback at all    → null (quality_score = 0 in the trust formula)
 */
export async function getBlendedAvgFeedback(
  toUserId: string,
  communityId: string,
  localWeight = 0.7,
  globalWeight = 0.3,
): Promise<number | null> {
  const result = await query(
    `SELECT
       AVG(CASE WHEN community_id = $2 THEN rating END)::NUMERIC(3,2) AS local_avg,
       AVG(rating)::NUMERIC(3,2) AS global_avg
     FROM feedback.feedback
     WHERE to_user_id = $1`,
    [toUserId, communityId],
  );
  const row = result.rows[0];
  const local = row?.local_avg != null ? parseFloat(row.local_avg) : null;
  const global_ = row?.global_avg != null ? parseFloat(row.global_avg) : null;

  if (local == null && global_ == null) return null;
  if (local != null && global_ != null) return local * localWeight + global_ * globalWeight;
  return local ?? global_!;
}
