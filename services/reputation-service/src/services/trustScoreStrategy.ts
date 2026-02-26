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
 * Current formula (interim — ADR-037 replaces this with a multi-signal model):
 *   karma_contribution  = min(80, floor(total_karma / 10) × 2)  → 0–80 pts
 *   feedback_contribution = round((avg_feedback / 5) × 20)       → 0–20 pts
 *   score = max(0, min(100, karma_contribution + feedback_contribution))
 *
 * Range: 0 (new user) → 100 (max karma + perfect feedback)
 * Approximate milestones:
 *   ~200 karma, no feedback   → ~40  (Building tier)
 *   ~200 karma, good feedback → ~55  (Reliable tier)
 *   ~400 karma, good feedback → ~95+ (Trusted tier)
 *
 * New users start at 0, not an artificial 50 — the tiers New/Building/Reliable/Trusted
 * are all reachable from below.
 *
 * When avg_feedback_score is null (no feedback received yet), it contributes 0.
 */
export function computeTrustScore(inputs: TrustScoreInputs): number {
  const karmaContribution = Math.min(80, Math.floor(inputs.total_karma / 10) * 2);

  const feedbackContribution =
    inputs.avg_feedback_score != null
      ? Math.round((inputs.avg_feedback_score / 5) * 20)
      : 0;

  return Math.max(0, Math.min(100, karmaContribution + feedbackContribution));
}
