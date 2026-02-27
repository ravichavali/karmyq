/**
 * Trust Score Strategy (ADR-037)
 *
 * Multi-signal trust formula based on Putnam's bonding/bridging capital framework.
 * Replaces the interim karma-heavy model (ADR-035 trust portion).
 *
 * All time-sensitive inputs are pre-computed by the caller with ADR-039 decay applied:
 *   - recent_interactions: last 12 months only (sliding window)
 *   - avg_feedback_score:  recency-weighted blend (6-month half-life)
 *
 * Karma is no longer a trust input. Trust is earned through the nature and
 * recency of interactions, not accumulated currency.
 */

export interface TrustScoreInputs {
  // Volume (ADR-039: last 12 months only)
  recent_interactions: number;

  // Quality (ADR-039: recency-weighted blended avg, 6-month half-life; null if no feedback yet)
  avg_feedback_score: number | null;

  // Depth — bonding capital (repeat counterparties, unique pairs seen 2+ times)
  repeat_interaction_pairs: number;

  // Breadth — bridging capital
  distinct_people_count: number;
  distinct_communities_count: number;

  // Community configuration
  depth_weight: number;               // 0.0–1.0, scales depth_score (default 0.6)
  breadth_weight: number;             // 0.0–1.0, scales breadth_score (default 0.4)
  feedback_threshold: number;         // 1.0–4.9, star rating at which quality = 0 (default 3.0)
  min_interactions_for_bonus: number; // interaction count to earn the 5pt bonus (default 1)
  negative_allowed: boolean;          // whether trust can go below 0 (default false)
}

/**
 * Compute a trust score from multi-factor inputs (ADR-037).
 *
 * Formula breakdown:
 *
 *   volume_score   = min(30, floor(log2(recent_interactions + 1) × 10))   → 0–30 pts
 *     - Logarithmic: each additional interaction contributes less
 *     - 0 interactions → 0, 1 → 10, 3 → 16, 7 → 22, 15+ → 30
 *
 *   quality_score  = round(((avg - threshold) / (5 - threshold)) × 25)    → varies
 *     - Null feedback → 0 (no signal yet)
 *     - At threshold → 0, perfect (5★) → +25, below threshold → negative
 *
 *   depth_score    = min(15, repeat_pairs × 2) × depth_weight             → 0–15 pts (scaled)
 *     - Bonding capital: trusted relationships within community
 *
 *   breadth_score  = (min(10, distinct_people × 2) + min(10, distinct_communities × 3)) × breadth_weight
 *                                                                           → 0–20 pts (scaled)
 *     - Bridging capital: ability to help across diverse contexts
 *
 *   bonus_score    = recent_interactions >= min_interactions ? 5 : 0       → 0–5 pts
 *     - Signals "has crossed the community's minimum trust threshold"
 *
 *   floor = negative_allowed ? -50 : 0
 *   trust_score = max(floor, min(100, raw_score))
 *
 * Score tiers:
 *   -50–0    Known bad actor (punitive communities only)
 *   0        Unknown / no history
 *   1–20     New participant, early interactions
 *   20–50    Active participant, established in community
 *   50–75    Trusted member, broad or deep track record
 *   75–100   Highly trusted, diverse + high-quality contributions
 */
export function computeTrustScore(inputs: TrustScoreInputs): number {
  const {
    recent_interactions,
    avg_feedback_score,
    repeat_interaction_pairs,
    distinct_people_count,
    distinct_communities_count,
    depth_weight,
    breadth_weight,
    feedback_threshold,
    min_interactions_for_bonus,
    negative_allowed,
  } = inputs;

  // Volume: logarithmic scale, caps at 30
  const volumeScore = Math.min(
    30,
    Math.floor(Math.log2(recent_interactions + 1) * 10),
  );

  // Quality: threshold-relative; null → 0
  const qualityScore =
    avg_feedback_score != null
      ? Math.round(((avg_feedback_score - feedback_threshold) / (5 - feedback_threshold)) * 25)
      : 0;

  // Depth: bonding capital (repeat pairs), scaled by community config
  const depthScore = Math.min(15, repeat_interaction_pairs * 2) * depth_weight;

  // Breadth: bridging capital (distinct people + communities), scaled by community config
  const breadthScore =
    (Math.min(10, distinct_people_count * 2) + Math.min(10, distinct_communities_count * 3)) *
    breadth_weight;

  // Bonus: crossed minimum interaction threshold
  const bonusScore = recent_interactions >= min_interactions_for_bonus ? 5 : 0;

  const rawScore = volumeScore + qualityScore + depthScore + breadthScore + bonusScore;
  const floor = negative_allowed ? -50 : 0;

  return Math.max(floor, Math.min(100, Math.round(rawScore)));
}
