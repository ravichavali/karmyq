/**
 * Matching Algorithm Types
 *
 * Defines the interface for type-specific matching algorithms
 * Each request type can have custom matching logic based on its payload
 */

export interface MatchScore {
  score: number; // 0-100, higher is better
  reasons: string[]; // Human-readable reasons for the match
  breakdown: {
    locationScore?: number;
    skillScore?: number;
    availabilityScore?: number;
    preferenceScore?: number;
    urgencyBonus?: number;
  };
}

export interface UserProfile {
  id: string;
  name: string;
  location?: {
    lat: number;
    lng: number;
  };
  skills: string[];
  availability?: {
    days: string[];
    timeOfDay: string[];
  };
  preferences?: {
    maxDistance?: number; // in km
    vehicleType?: string;
    certifications?: string[];
  };
}

export interface MatchCandidate {
  user: UserProfile;
  matchScore: MatchScore;
}

/**
 * Base matcher interface
 * Each request type implements this
 */
export interface RequestMatcher {
  calculateMatch(request: any, user: UserProfile): MatchScore;
  findCandidates(request: any, users: UserProfile[]): MatchCandidate[];
}

/**
 * Feed scoring weights from community config (ADR-031)
 * All weights must sum to 1.0
 */
export interface FeedScoringWeights {
  feed_weight_skill_match: number;
  feed_weight_trust_distance: number;
  feed_weight_community_relevance: number;
  feed_weight_urgency: number;
}

/**
 * Input signals for feed score calculation
 */
export interface FeedScoreInput {
  skillMatchScore: number;       // 0-100, from calculateMatchScore()
  trustDistanceScore: number;    // 0-100, from trust path (Phase 3, default 50)
  communityRelevanceScore: number; // 0-100, from community type matching
  urgencyScore: number;          // 0-100, from request urgency
}

/**
 * Result of feed score calculation
 */
export interface FeedScoreResult {
  score: number;        // 0-100, weighted composite
  breakdown: {
    skillMatch: { raw: number; weighted: number };
    trustDistance: { raw: number; weighted: number };
    communityRelevance: { raw: number; weighted: number };
    urgency: { raw: number; weighted: number };
  };
  weights: FeedScoringWeights;
}

/**
 * Visibility scope for multi-tier feed (ADR-022)
 */
export type VisibilityScope = 'community' | 'trust_network' | 'platform';

/**
 * User feed preferences for multi-tier visibility (ADR-022)
 */
export interface UserFeedPreferences {
  feed_show_trust_network: boolean;
  feed_trust_network_max_degrees: number;
  feed_show_platform: boolean;
  feed_platform_categories: string[];
}

/**
 * Input for resolving which tier a request belongs to
 */
export interface TierResolutionInput {
  inUserCommunity: boolean;
  visibilityScope: VisibilityScope;
  visibilityMaxDegrees: number;
  trustDegrees: number | null;
  feedPrefs: UserFeedPreferences;
}
