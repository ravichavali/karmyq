/**
 * Trust Score Strategy (ADR-032)
 *
 * Computes a user's trust score from available signals. The formula is
 * intentionally isolated here so it can be tuned — or replaced with a
 * more sophisticated model — without touching the service layer.
 *
 * Future inputs to wire in: direct_connection_count (social graph depth),
 * days_active_last_30 (recency), community_tenure_days (longevity).
 */

export interface TrustScoreInputs {
  // Active signals (used now)
  total_karma: number;
  interactions_completed: number;    // total exchanges as helper + requester
  avg_feedback_score: number | null; // avg of helpfulness/responsiveness/clarity ratings (0–5 scale), or null if no feedback yet

  // Future signals — pass undefined until wired from social-graph / analytics
  direct_connection_count?: number;  // # of mutual connections in community
  days_active_last_30?: number;      // recency: active days in last 30
  community_tenure_days?: number;    // how long the user has been a member
}

/**
 * Compute a trust score (0–100) from multi-factor inputs.
 *
 * Current formula:
 *   base = 50 (everyone starts here)
 *   karma_contribution = min(40, floor(total_karma / 10))   → 0–40 pts
 *   feedback_contribution = round((avg_feedback / 5) × 10) → 0–10 pts
 *   score = base + karma_contribution + feedback_contribution
 *
 * Range: 50 (no karma, no feedback) → 100 (max karma + perfect feedback)
 *
 * When avg_feedback_score is null (no feedback received yet), it contributes 0.
 */
export function computeTrustScore(inputs: TrustScoreInputs): number {
  const karmaContribution = Math.min(40, Math.floor(inputs.total_karma / 10));

  const feedbackContribution =
    inputs.avg_feedback_score != null
      ? Math.round((inputs.avg_feedback_score / 5) * 10)
      : 0;

  return 50 + karmaContribution + feedbackContribution;
}
