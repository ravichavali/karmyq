import { query } from './db';

export interface WeightedFeedbackRow {
  rating: number | string;
  community_id: string;
  created_at: Date | string;
}

/** Pure ADR-039 weighting shared by live score refresh and standing-backfill dry-run. */
export function calculateWeightedAvgFeedback(
  rows: readonly WeightedFeedbackRow[],
  communityId: string,
  nowMs = Date.now(),
  halfLifeMonths = 6,
  localWeight = 0.7,
  globalWeight = 0.3,
): number | null {
  if (rows.length === 0) return null;

  const monthMs = 30 * 24 * 60 * 60 * 1000;
  let localWeightSum = 0;
  let localWeightedSum = 0;
  let globalWeightSum = 0;
  let globalWeightedSum = 0;

  for (const row of rows) {
    const ageMonths = (nowMs - new Date(row.created_at).getTime()) / monthMs;
    const weight = Math.max(0.1, Math.pow(0.5, ageMonths / halfLifeMonths));
    const rating = Number.parseFloat(String(row.rating));

    globalWeightSum += weight;
    globalWeightedSum += rating * weight;
    if (row.community_id === communityId) {
      localWeightSum += weight;
      localWeightedSum += rating * weight;
    }
  }

  const local = localWeightSum > 0 ? localWeightedSum / localWeightSum : null;
  const globalAverage = globalWeightSum > 0 ? globalWeightedSum / globalWeightSum : null;
  if (local == null && globalAverage == null) return null;
  if (local != null && globalAverage != null) {
    return local * localWeight + globalAverage * globalWeight;
  }
  return local ?? globalAverage;
}

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

/** The two participants of a match, its lifecycle status, and the communities its request is posted
 *  to (BUG-013 rating-write hardening — the attribution community must be one of these). */
export interface MatchParticipation {
  requesterId: string;
  responderId: string;
  status: string;
  communityIds: string[];
}

/**
 * Look up a match's participants (requester via the help request, responder directly), its status,
 * and the communities the underlying request is posted to, so the rating write path can reject
 * non-participants, ratings on not-yet-completed matches, and feedback attributed to a community the
 * match was never posted to. Returns null when the match does not exist. Cross-schema read (shared DB).
 */
export async function getMatchParticipation(matchId: string): Promise<MatchParticipation | null> {
  const result = await query(
    `SELECT hr.requester_id, m.responder_id, m.status,
            COALESCE(
              ARRAY_AGG(DISTINCT rc.community_id::text) FILTER (WHERE rc.community_id IS NOT NULL),
              ARRAY[]::text[]
            ) AS community_ids
     FROM requests.matches m
     JOIN requests.help_requests hr ON hr.id = m.request_id
     LEFT JOIN requests.request_communities rc ON rc.request_id = hr.id
     WHERE m.id = $1
     GROUP BY hr.requester_id, m.responder_id, m.status`,
    [matchId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    requesterId: row.requester_id,
    responderId: row.responder_id,
    status: row.status,
    communityIds: row.community_ids ?? [],
  };
}

export async function hasSubmittedFeedback(fromUserId: string, matchId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM feedback.feedback WHERE from_user_id = $1 AND request_match_id = $2 LIMIT 1`,
    [fromUserId, matchId],
  );
  return result.rows.length > 0;
}

/**
 * Returns a recency-weighted blended feedback average for trust score computation (ADR-039).
 *
 * Weighting: each rating is weighted by age using a 6-month half-life:
 *   weight = max(0.1, 0.5 ^ (age_months / halfLifeMonths))
 *
 * A minimum weight of 0.1 ensures old feedback never fully disappears — sparse history
 * still carries a reduced signal rather than being dropped entirely.
 *
 * Blending: 70% local (same community) + 30% cross-community, matching getBlendedAvgFeedback().
 * If only one side has data, that side is used directly (no penalty for lack of cross-community data).
 *
 * Returns null if no feedback exists at all.
 */
export async function getWeightedAvgFeedback(
  toUserId: string,
  communityId: string,
  halfLifeMonths = 6,
  localWeight = 0.7,
  globalWeight = 0.3,
): Promise<number | null> {
  const result = await query(
    `SELECT rating, community_id, created_at
     FROM feedback.feedback
     WHERE to_user_id = $1
     ORDER BY created_at DESC`,
    [toUserId],
  );
  return calculateWeightedAvgFeedback(
    result.rows as WeightedFeedbackRow[],
    communityId,
    Date.now(),
    halfLifeMonths,
    localWeight,
    globalWeight,
  );
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
