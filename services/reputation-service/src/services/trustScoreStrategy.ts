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
 * Current formula (interim — ADR-037 replaces this with a full multi-signal model):
 *
 *   interaction_score = min(60, floor(log2(interactions_completed + 1) × 15))  → 0–60 pts
 *   quality_score     = round((avg_feedback / 5) × 30)                          → 0–30 pts
 *   karma_bonus       = min(10, floor(total_karma / 100))                        → 0–10 pts
 *   score             = max(0, min(100, interaction_score + quality_score + karma_bonus))
 *
 * Rationale:
 *   - Interactions are the primary signal (60%). Logarithmic scale rewards consistent
 *     engagement while preventing gaming through bulk low-quality interactions.
 *     Caps at ~16 completed interactions.
 *   - Quality (feedback) is secondary (30%). Meaningful once there are enough
 *     interactions to trust the signal.
 *   - Karma is a small bonus (10%). Participation still rewarded, but it no longer
 *     dominates — need 1000 karma to max this out.
 *
 * Approximate tier milestones:
 *   1 interaction, no feedback      →  15  (New)
 *   3 interactions, 4-star avg      →  54  (Building)
 *   5 interactions, 4-star avg      →  62  (Reliable)
 *   10 interactions, 4-star avg     →  75  (Reliable)
 *   16+ interactions, 5-star avg    →  90  (Trusted)
 *   16+ interactions, 5-star + 1000 karma → 100 (Trusted max)
 *
 * When avg_feedback_score is null (no feedback received yet), quality_score = 0.
 */
export function computeTrustScore(inputs: TrustScoreInputs): number {
  const interactionScore = Math.min(
    60,
    Math.floor(Math.log2(inputs.interactions_completed + 1) * 15)
  );

  const qualityScore =
    inputs.avg_feedback_score != null
      ? Math.round((inputs.avg_feedback_score / 5) * 30)
      : 0;

  const karmaBonus = Math.min(10, Math.floor(inputs.total_karma / 100));

  return Math.max(0, Math.min(100, interactionScore + qualityScore + karmaBonus));
}
