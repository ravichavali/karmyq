/**
 * Matching System - Type-Specific Request Matching
 *
 * This module provides intelligent matching algorithms for connecting help requests
 * with potential helpers based on request type, location, skills, and availability.
 *
 * Each request type has a specialized matcher with custom weighting:
 * - Ride: Location (40%), Capacity (20%), Availability (20%), Preferences (20%)
 * - Service: Skills (50%), Skill Level (15%), Location (20%), Schedule (15%)
 * - Event: Location (35%), Schedule (40%), Role Match (15%), Preference (10%)
 * - Borrow: Item Availability (40%), Duration (25%), Location (20%), Condition (15%)
 * - Generic: Skills (40%), Location (30%), Availability (30%)
 *
 * Usage:
 * ```typescript
 * import { getMatcherForRequest, findMatches } from '@karmyq/shared/matching';
 *
 * const matcher = getMatcherForRequest('service');
 * const candidates = matcher.findCandidates(request, userProfiles);
 * ```
 */

// Export types (including FeedScoringWeights, FeedScoreInput, FeedScoreResult)
export * from './types';
// Export utils (including calculateFeedScore, scoreUrgency, scoreCommunityRelevance)
export * from './utils';

// Export matchers
export { RideMatcher } from './matchers/ride';
export { ServiceMatcher } from './matchers/service';
export { EventMatcher } from './matchers/event';
export { BorrowMatcher } from './matchers/borrow';
export { GenericMatcher } from './matchers/generic';

import { RequestMatcher, UserProfile, MatchCandidate } from './types';
import { RideMatcher } from './matchers/ride';
import { ServiceMatcher } from './matchers/service';
import { EventMatcher } from './matchers/event';
import { BorrowMatcher } from './matchers/borrow';
import { GenericMatcher } from './matchers/generic';
import type { CreateRequestInput } from '../schemas/requests';

/**
 * Matcher instances (singleton pattern for performance)
 */
const matchers = {
  ride: new RideMatcher(),
  service: new ServiceMatcher(),
  event: new EventMatcher(),
  borrow: new BorrowMatcher(),
  generic: new GenericMatcher(),
};

/**
 * Get the appropriate matcher for a request type
 *
 * @param requestType - The type of request ('ride', 'service', 'event', 'borrow', 'generic')
 * @returns The matcher instance for that request type
 *
 * @example
 * ```typescript
 * const matcher = getMatcherForRequest('service');
 * const score = matcher.calculateMatch(serviceRequest, userProfile);
 * ```
 */
export function getMatcherForRequest(
  requestType: CreateRequestInput['request_type']
): RequestMatcher {
  return matchers[requestType] || matchers.generic;
}

/**
 * Find matching candidates for a request
 *
 * Convenience function that automatically selects the right matcher
 * and returns ranked candidates.
 *
 * @param request - The request to match
 * @param users - Array of user profiles to match against
 * @returns Array of match candidates sorted by score (highest first)
 *
 * @example
 * ```typescript
 * const candidates = findMatches(request, allUsers);
 * console.log(`Found ${candidates.length} matches`);
 * console.log(`Best match: ${candidates[0].user.name} (score: ${candidates[0].matchScore.score})`);
 * ```
 */
export function findMatches(
  request: CreateRequestInput,
  users: UserProfile[]
): MatchCandidate[] {
  const matcher = getMatcherForRequest(request.request_type);
  return matcher.findCandidates(request, users);
}

/**
 * Calculate match score for a single user
 *
 * Useful for checking if a specific user is a good match for a request.
 *
 * @param request - The request to match
 * @param user - The user profile to score
 * @returns Match score with breakdown and reasons
 *
 * @example
 * ```typescript
 * const score = calculateMatchScore(request, userProfile);
 * if (score.score >= 70) {
 *   console.log('Excellent match!', score.reasons);
 * }
 * ```
 */
export function calculateMatchScore(
  request: CreateRequestInput,
  user: UserProfile
) {
  const matcher = getMatcherForRequest(request.request_type);
  return matcher.calculateMatch(request, user);
}
