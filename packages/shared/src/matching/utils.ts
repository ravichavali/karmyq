/**
 * Matching Utility Functions
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate match score based on distance
 * - Within 5km: 100 points
 * - 5-10km: 80 points
 * - 10-20km: 60 points
 * - 20-50km: 40 points
 * - 50km+: 20 points
 */
export function scoreByDistance(distanceKm: number): number {
  if (distanceKm <= 5) return 100;
  if (distanceKm <= 10) return 80;
  if (distanceKm <= 20) return 60;
  if (distanceKm <= 50) return 40;
  return 20;
}

/**
 * Calculate skill match score
 * Returns percentage of required skills that user has
 */
export function scoreBySkills(
  requiredSkills: string[],
  userSkills: string[]
): { score: number; matched: string[]; missing: string[] } {
  if (requiredSkills.length === 0) {
    return { score: 100, matched: [], missing: [] };
  }

  const matched = requiredSkills.filter((skill) =>
    userSkills.some((userSkill) =>
      userSkill.toLowerCase().includes(skill.toLowerCase())
    )
  );

  const missing = requiredSkills.filter((skill) => !matched.includes(skill));
  const score = (matched.length / requiredSkills.length) * 100;

  return { score, matched, missing };
}

/**
 * Calculate schedule compatibility score
 * Checks if user is available on the required days/times
 */
export function scoreBySchedule(
  requiredDays: string[],
  requiredTime: string,
  userAvailability?: { days: string[]; timeOfDay: string[] }
): number {
  if (!userAvailability) return 50; // Neutral if no availability data

  let score = 0;

  // Check day compatibility (60% weight)
  if (requiredDays.length > 0 && userAvailability.days.length > 0) {
    const matchingDays = requiredDays.filter((day) =>
      userAvailability.days.includes(day)
    );
    score += (matchingDays.length / requiredDays.length) * 60;
  } else {
    score += 30; // Neutral
  }

  // Check time compatibility (40% weight)
  if (userAvailability.timeOfDay.includes(requiredTime)) {
    score += 40;
  } else if (userAvailability.timeOfDay.includes('flexible')) {
    score += 30;
  } else {
    score += 10;
  }

  return score;
}

/**
 * Apply urgency bonus
 * High urgency requests get priority in matching
 */
export function applyUrgencyBonus(urgency: string, baseScore: number): number {
  // Canonical urgency scale (Sprint 85 / ADR-066): urgent > high > medium > low.
  const bonuses = {
    urgent: 20,
    high: 15,
    medium: 5,
    low: 0,
  };

  return baseScore + (bonuses[urgency as keyof typeof bonuses] || 0);
}

// ============= Feed Scoring (ADR-031) =============

import type { FeedScoringWeights, FeedScoreInput, FeedScoreResult, TierResolutionInput, VisibilityScope } from './types';

/** Default feed scoring weights (used when no community config exists, ADR-038) */
export const DEFAULT_FEED_WEIGHTS: FeedScoringWeights = {
  feed_weight_skill_match: 0.25,
  feed_weight_trust_distance: 0.20,
  feed_weight_community_relevance: 0.15,
  feed_weight_urgency: 0.10,
  feed_weight_requester_trust: 0.15,
  feed_weight_prior_interaction: 0.10,
  feed_weight_recency: 0.05,
};

/**
 * Calculate weighted feed score from individual signal scores.
 *
 * Formula: score = Σ(signal × weight) across all 7 signals.
 *
 * All input scores are 0-100. Weights come from community config (must sum to 1.0 ± 0.01).
 * Output is 0-100.
 */
export function calculateFeedScore(
  input: FeedScoreInput,
  weights: FeedScoringWeights = DEFAULT_FEED_WEIGHTS
): FeedScoreResult {
  // Validate weight sum
  const weightSum =
    weights.feed_weight_skill_match +
    weights.feed_weight_trust_distance +
    weights.feed_weight_community_relevance +
    weights.feed_weight_urgency +
    weights.feed_weight_requester_trust +
    weights.feed_weight_prior_interaction +
    weights.feed_weight_recency;
  if (Math.abs(weightSum - 1.0) > 0.01) {
    throw new Error(`Feed weights must sum to 1.0 (got ${weightSum.toFixed(4)})`);
  }

  // Clamp all inputs to 0-100
  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  const skill = clamp(input.skillMatchScore);
  const trust = clamp(input.trustDistanceScore);
  const community = clamp(input.communityRelevanceScore);
  const urgency = clamp(input.urgencyScore);
  const requesterTrust = clamp(input.requesterTrustScore);
  const priorInteraction = clamp(input.priorInteractionScore);
  const recency = clamp(input.recencyScore);

  const score =
    skill * weights.feed_weight_skill_match +
    trust * weights.feed_weight_trust_distance +
    community * weights.feed_weight_community_relevance +
    urgency * weights.feed_weight_urgency +
    requesterTrust * weights.feed_weight_requester_trust +
    priorInteraction * weights.feed_weight_prior_interaction +
    recency * weights.feed_weight_recency;

  return {
    score: Math.round(score * 100) / 100,
    breakdown: {
      skillMatch: { raw: skill, weighted: Math.round(skill * weights.feed_weight_skill_match * 100) / 100 },
      trustDistance: { raw: trust, weighted: Math.round(trust * weights.feed_weight_trust_distance * 100) / 100 },
      communityRelevance: { raw: community, weighted: Math.round(community * weights.feed_weight_community_relevance * 100) / 100 },
      urgency: { raw: urgency, weighted: Math.round(urgency * weights.feed_weight_urgency * 100) / 100 },
      requesterTrust: { raw: requesterTrust, weighted: Math.round(requesterTrust * weights.feed_weight_requester_trust * 100) / 100 },
      priorInteraction: { raw: priorInteraction, weighted: Math.round(priorInteraction * weights.feed_weight_prior_interaction * 100) / 100 },
      recency: { raw: recency, weighted: Math.round(recency * weights.feed_weight_recency * 100) / 100 },
    },
    weights,
  };
}

/**
 * Score urgency as a 0-100 value (for feed scoring).
 * Different from applyUrgencyBonus which adds a bonus to an existing score.
 */
export function scoreUrgency(urgency: string): number {
  // Canonical urgency scale (Sprint 85 / ADR-066): urgent is the top tier (it replaces the
  // retired 'critical') and must score STRICTLY above high — the curated home feed ranks on this
  // composite signal, not the urgency_priority CASE, so a tie would erase urgent's advantage.
  const scores: Record<string, number> = {
    urgent: 100,
    high: 80,
    medium: 60,
    low: 30,
  };
  return scores[urgency] ?? 30;
}

/**
 * Score community relevance based on whether the request type matches
 * the community's enabled request types.
 *
 * @param requestType - The request's type (e.g. 'service', 'ride', 'generic')
 * @param enabledTypes - Community's enabled_request_types from config
 * @returns 0-100 score
 */
export function scoreCommunityRelevance(
  requestType: string,
  enabledTypes: Array<{ name: string; karma_multiplier?: number }> | null | undefined
): number {
  // No community types configured → neutral (all types welcome)
  if (!enabledTypes || enabledTypes.length === 0) {
    return 50;
  }

  // Check if request type matches any enabled type (case-insensitive)
  const match = enabledTypes.find(
    (t) => t.name.toLowerCase() === requestType.toLowerCase()
  );

  if (match) {
    // Matched — boost by karma_multiplier if available (1.0 = 80, 1.5 = 100, 0.5 = 60)
    const multiplier = match.karma_multiplier ?? 1.0;
    return Math.min(100, Math.round(60 + multiplier * 20));
  }

  // Request type not in community's enabled types → low relevance
  return 20;
}

/**
 * Convert trust path degrees of separation to a 0-100 score.
 *
 * Closer connections = higher trust score:
 * - 1 degree (direct connection): 100
 * - 2 degrees: 75
 * - 3 degrees: 50
 * - 4 degrees: 25
 * - null/unconnected: 10 (still gives some baseline chance)
 *
 * @param degrees - Degrees of separation (1-4, or null if unconnected)
 * @returns 0-100 trust distance score
 */
export function scoreTrustDistance(degrees: number | null | undefined): number {
  if (degrees == null) return 10;

  const scores: Record<number, number> = {
    1: 100,
    2: 75,
    3: 50,
    4: 25,
  };

  return scores[degrees] ?? 10;
}

/**
 * Score request freshness based on age in days.
 * Newer requests score higher to surface timely needs.
 */
export function scoreRecency(createdAt: Date | string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 1) return 100;
  if (ageDays <= 3) return 85;
  if (ageDays <= 7) return 70;
  if (ageDays <= 14) return 50;
  if (ageDays <= 30) return 30;
  return 15;
}

// ============= Multi-Tier Visibility (ADR-022) =============

/** Valid visibility scopes */
export const VALID_VISIBILITY_SCOPES: VisibilityScope[] = ['community', 'trust_network', 'platform'];

/** Default user feed preferences */
export const DEFAULT_FEED_PREFERENCES = {
  feed_show_trust_network: true,
  feed_trust_network_max_degrees: 3,
  feed_show_platform: false,
  feed_platform_categories: ['digital', 'questions'],
};

/**
 * Determine which tier a request belongs to for the current user.
 *
 * Priority: community > trust_network > platform > null (filtered out).
 *
 * - Community tier: Request is in one of user's communities (always shown).
 * - Trust network tier: Request has `trust_network` or `platform` scope,
 *   user has trust path within degree limits, and user has trust network enabled.
 * - Platform tier: Request has `platform` scope and user has platform enabled.
 *
 * @returns The source tier, or null if the request should be filtered out.
 */
export function resolveSourceTier(input: TierResolutionInput): VisibilityScope | null {
  // Tier 1: Community — always shown
  if (input.inUserCommunity) {
    return 'community';
  }

  // Tier 2: Trust network — wider scope + trust path within limits
  if (
    input.feedPrefs.feed_show_trust_network &&
    input.visibilityScope !== 'community' &&
    input.trustDegrees !== null &&
    input.trustDegrees <= Math.min(
      input.visibilityMaxDegrees,
      input.feedPrefs.feed_trust_network_max_degrees
    )
  ) {
    return 'trust_network';
  }

  // Tier 3: Platform — opt-in
  if (
    input.feedPrefs.feed_show_platform &&
    input.visibilityScope === 'platform'
  ) {
    return 'platform';
  }

  // Does not qualify for any tier
  return null;
}
