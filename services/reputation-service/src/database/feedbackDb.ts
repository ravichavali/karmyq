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
