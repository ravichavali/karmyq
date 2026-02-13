/**
 * Feed Scoring Tests (ADR-031)
 *
 * Tests for community-configurable feed scoring:
 * - calculateFeedScore: weighted composite scoring
 * - scoreUrgency: urgency level to 0-100
 * - scoreCommunityRelevance: request type vs community enabled types
 * - scoreTrustDistance: degrees of separation to 0-100
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateFeedScore,
  scoreUrgency,
  scoreCommunityRelevance,
  scoreTrustDistance,
  resolveSourceTier,
  DEFAULT_FEED_WEIGHTS,
  DEFAULT_FEED_PREFERENCES,
  VALID_VISIBILITY_SCOPES,
} from '../utils';
import type { FeedScoringWeights, FeedScoreInput, TierResolutionInput, UserFeedPreferences } from '../types';

describe('calculateFeedScore', () => {
  const defaultInput: FeedScoreInput = {
    skillMatchScore: 80,
    trustDistanceScore: 50,
    communityRelevanceScore: 70,
    urgencyScore: 60,
  };

  it('calculates weighted score with default weights', () => {
    const result = calculateFeedScore(defaultInput);

    // 80*0.40 + 50*0.25 + 70*0.20 + 60*0.15
    // = 32 + 12.5 + 14 + 9 = 67.5
    expect(result.score).toBe(67.5);
    expect(result.weights).toEqual(DEFAULT_FEED_WEIGHTS);
  });

  it('returns breakdown with raw and weighted values', () => {
    const result = calculateFeedScore(defaultInput);

    expect(result.breakdown.skillMatch.raw).toBe(80);
    expect(result.breakdown.skillMatch.weighted).toBe(32); // 80 * 0.40
    expect(result.breakdown.trustDistance.raw).toBe(50);
    expect(result.breakdown.trustDistance.weighted).toBe(12.5); // 50 * 0.25
    expect(result.breakdown.communityRelevance.raw).toBe(70);
    expect(result.breakdown.communityRelevance.weighted).toBe(14); // 70 * 0.20
    expect(result.breakdown.urgency.raw).toBe(60);
    expect(result.breakdown.urgency.weighted).toBe(9); // 60 * 0.15
  });

  it('uses custom community weights', () => {
    const trustFocused: FeedScoringWeights = {
      feed_weight_skill_match: 0.20,
      feed_weight_trust_distance: 0.50,
      feed_weight_community_relevance: 0.15,
      feed_weight_urgency: 0.15,
    };

    const result = calculateFeedScore(defaultInput, trustFocused);

    // 80*0.20 + 50*0.50 + 70*0.15 + 60*0.15
    // = 16 + 25 + 10.5 + 9 = 60.5
    expect(result.score).toBe(60.5);
    expect(result.weights).toEqual(trustFocused);
  });

  it('clamps input scores to 0-100', () => {
    const result = calculateFeedScore({
      skillMatchScore: 150, // over 100
      trustDistanceScore: -10, // under 0
      communityRelevanceScore: 50,
      urgencyScore: 50,
    });

    // 100*0.40 + 0*0.25 + 50*0.20 + 50*0.15
    // = 40 + 0 + 10 + 7.5 = 57.5
    expect(result.score).toBe(57.5);
    expect(result.breakdown.skillMatch.raw).toBe(100);
    expect(result.breakdown.trustDistance.raw).toBe(0);
  });

  it('returns 0 for all-zero inputs', () => {
    const result = calculateFeedScore({
      skillMatchScore: 0,
      trustDistanceScore: 0,
      communityRelevanceScore: 0,
      urgencyScore: 0,
    });

    expect(result.score).toBe(0);
  });

  it('returns 100 for all-perfect inputs', () => {
    const result = calculateFeedScore({
      skillMatchScore: 100,
      trustDistanceScore: 100,
      communityRelevanceScore: 100,
      urgencyScore: 100,
    });

    expect(result.score).toBe(100);
  });

  it('handles skill-only community (skill weight = 1.0)', () => {
    const skillOnly: FeedScoringWeights = {
      feed_weight_skill_match: 1.0,
      feed_weight_trust_distance: 0.0,
      feed_weight_community_relevance: 0.0,
      feed_weight_urgency: 0.0,
    };

    const result = calculateFeedScore(defaultInput, skillOnly);
    expect(result.score).toBe(80); // Just the skill score
  });
});

describe('scoreUrgency', () => {
  it('scores high urgency as 100', () => {
    expect(scoreUrgency('high')).toBe(100);
  });

  it('scores medium urgency as 60', () => {
    expect(scoreUrgency('medium')).toBe(60);
  });

  it('scores low urgency as 30', () => {
    expect(scoreUrgency('low')).toBe(30);
  });

  it('defaults unknown urgency to 30', () => {
    expect(scoreUrgency('unknown')).toBe(30);
    expect(scoreUrgency('')).toBe(30);
  });
});

describe('scoreCommunityRelevance', () => {
  const enabledTypes = [
    { name: 'meal_share', karma_multiplier: 1.0 },
    { name: 'ride_share', karma_multiplier: 1.2 },
    { name: 'childcare', karma_multiplier: 1.5 },
  ];

  it('returns 50 (neutral) when no types configured', () => {
    expect(scoreCommunityRelevance('generic', null)).toBe(50);
    expect(scoreCommunityRelevance('generic', undefined)).toBe(50);
    expect(scoreCommunityRelevance('generic', [])).toBe(50);
  });

  it('scores matching type with 1.0 multiplier as 80', () => {
    expect(scoreCommunityRelevance('meal_share', enabledTypes)).toBe(80);
  });

  it('boosts score for high karma_multiplier types', () => {
    // ride_share has 1.2 multiplier → 60 + 1.2*20 = 84
    expect(scoreCommunityRelevance('ride_share', enabledTypes)).toBe(84);
    // childcare has 1.5 multiplier → 60 + 1.5*20 = 90
    expect(scoreCommunityRelevance('childcare', enabledTypes)).toBe(90);
  });

  it('caps at 100 for very high multipliers', () => {
    const types = [{ name: 'emergency', karma_multiplier: 2.5 }];
    // 60 + 2.5*20 = 110 → capped at 100
    expect(scoreCommunityRelevance('emergency', types)).toBe(100);
  });

  it('returns 20 for non-matching type when types are configured', () => {
    expect(scoreCommunityRelevance('generic', enabledTypes)).toBe(20);
    expect(scoreCommunityRelevance('service', enabledTypes)).toBe(20);
  });

  it('is case-insensitive', () => {
    expect(scoreCommunityRelevance('Meal_Share', enabledTypes)).toBe(80);
    expect(scoreCommunityRelevance('RIDE_SHARE', enabledTypes)).toBe(84);
  });

  it('uses default multiplier of 1.0 when not specified', () => {
    const noMultiplier = [{ name: 'custom_type' }];
    expect(scoreCommunityRelevance('custom_type', noMultiplier)).toBe(80);
  });
});

describe('scoreTrustDistance', () => {
  it('scores 1 degree (direct connection) as 100', () => {
    expect(scoreTrustDistance(1)).toBe(100);
  });

  it('scores 2 degrees as 75', () => {
    expect(scoreTrustDistance(2)).toBe(75);
  });

  it('scores 3 degrees as 50', () => {
    expect(scoreTrustDistance(3)).toBe(50);
  });

  it('scores 4 degrees as 25', () => {
    expect(scoreTrustDistance(4)).toBe(25);
  });

  it('scores null (unconnected) as 10', () => {
    expect(scoreTrustDistance(null)).toBe(10);
  });

  it('scores undefined (no data) as 10', () => {
    expect(scoreTrustDistance(undefined)).toBe(10);
  });

  it('scores unknown degrees as 10', () => {
    expect(scoreTrustDistance(5)).toBe(10);
    expect(scoreTrustDistance(0)).toBe(10);
  });

  it('integrates with calculateFeedScore correctly', () => {
    // Direct connection (degree 1) should score higher than unconnected
    const directResult = calculateFeedScore({
      skillMatchScore: 50,
      trustDistanceScore: scoreTrustDistance(1), // 100
      communityRelevanceScore: 50,
      urgencyScore: 50,
    });

    const unconnectedResult = calculateFeedScore({
      skillMatchScore: 50,
      trustDistanceScore: scoreTrustDistance(null), // 10
      communityRelevanceScore: 50,
      urgencyScore: 50,
    });

    expect(directResult.score).toBeGreaterThan(unconnectedResult.score);
    // With default weights (trust=0.25): diff = (100-10) * 0.25 = 22.5
    expect(directResult.score - unconnectedResult.score).toBe(22.5);
  });
});

describe('DEFAULT_FEED_WEIGHTS', () => {
  it('sums to 1.0', () => {
    const sum =
      DEFAULT_FEED_WEIGHTS.feed_weight_skill_match +
      DEFAULT_FEED_WEIGHTS.feed_weight_trust_distance +
      DEFAULT_FEED_WEIGHTS.feed_weight_community_relevance +
      DEFAULT_FEED_WEIGHTS.feed_weight_urgency;

    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });
});

describe('resolveSourceTier (ADR-022)', () => {
  const defaultPrefs: UserFeedPreferences = {
    feed_show_trust_network: true,
    feed_trust_network_max_degrees: 3,
    feed_show_platform: false,
    feed_platform_categories: ['digital', 'questions'],
  };

  it('returns community for requests in user community', () => {
    expect(resolveSourceTier({
      inUserCommunity: true,
      visibilityScope: 'community',
      visibilityMaxDegrees: 3,
      trustDegrees: null,
      feedPrefs: defaultPrefs,
    })).toBe('community');
  });

  it('returns community even if request has wider scope', () => {
    // Community membership takes priority over trust_network/platform scope
    expect(resolveSourceTier({
      inUserCommunity: true,
      visibilityScope: 'trust_network',
      visibilityMaxDegrees: 3,
      trustDegrees: 1,
      feedPrefs: defaultPrefs,
    })).toBe('community');

    expect(resolveSourceTier({
      inUserCommunity: true,
      visibilityScope: 'platform',
      visibilityMaxDegrees: 3,
      trustDegrees: null,
      feedPrefs: defaultPrefs,
    })).toBe('community');
  });

  it('returns trust_network for requests within trust degrees', () => {
    expect(resolveSourceTier({
      inUserCommunity: false,
      visibilityScope: 'trust_network',
      visibilityMaxDegrees: 3,
      trustDegrees: 2,
      feedPrefs: defaultPrefs,
    })).toBe('trust_network');
  });

  it('respects visibility_max_degrees on the request', () => {
    // Request allows max 2 degrees, user is 3 degrees away
    expect(resolveSourceTier({
      inUserCommunity: false,
      visibilityScope: 'trust_network',
      visibilityMaxDegrees: 2,
      trustDegrees: 3,
      feedPrefs: defaultPrefs,
    })).toBeNull();
  });

  it('respects user feed_trust_network_max_degrees preference', () => {
    // User limits to 1 degree, but requester is 2 degrees away
    const strictPrefs: UserFeedPreferences = {
      ...defaultPrefs,
      feed_trust_network_max_degrees: 1,
    };

    expect(resolveSourceTier({
      inUserCommunity: false,
      visibilityScope: 'trust_network',
      visibilityMaxDegrees: 3,
      trustDegrees: 2,
      feedPrefs: strictPrefs,
    })).toBeNull();
  });

  it('uses min of request max_degrees and user max_degrees', () => {
    // Request allows 4, user allows 3, trust is 3 → should be OK
    expect(resolveSourceTier({
      inUserCommunity: false,
      visibilityScope: 'trust_network',
      visibilityMaxDegrees: 4,
      trustDegrees: 3,
      feedPrefs: defaultPrefs,
    })).toBe('trust_network');

    // Request allows 2, user allows 3, trust is 3 → filtered (request limit)
    expect(resolveSourceTier({
      inUserCommunity: false,
      visibilityScope: 'trust_network',
      visibilityMaxDegrees: 2,
      trustDegrees: 3,
      feedPrefs: defaultPrefs,
    })).toBeNull();
  });

  it('returns null for trust_network requests when no trust path exists', () => {
    expect(resolveSourceTier({
      inUserCommunity: false,
      visibilityScope: 'trust_network',
      visibilityMaxDegrees: 3,
      trustDegrees: null,
      feedPrefs: defaultPrefs,
    })).toBeNull();
  });

  it('returns null when user has trust_network disabled', () => {
    const noTrustPrefs: UserFeedPreferences = {
      ...defaultPrefs,
      feed_show_trust_network: false,
    };

    expect(resolveSourceTier({
      inUserCommunity: false,
      visibilityScope: 'trust_network',
      visibilityMaxDegrees: 3,
      trustDegrees: 2,
      feedPrefs: noTrustPrefs,
    })).toBeNull();
  });

  it('returns platform for platform-scoped requests when user opts in', () => {
    const platformPrefs: UserFeedPreferences = {
      ...defaultPrefs,
      feed_show_platform: true,
    };

    expect(resolveSourceTier({
      inUserCommunity: false,
      visibilityScope: 'platform',
      visibilityMaxDegrees: 3,
      trustDegrees: null,
      feedPrefs: platformPrefs,
    })).toBe('platform');
  });

  it('returns null for platform requests when user has not opted in', () => {
    // Default prefs have feed_show_platform: false
    expect(resolveSourceTier({
      inUserCommunity: false,
      visibilityScope: 'platform',
      visibilityMaxDegrees: 3,
      trustDegrees: null,
      feedPrefs: defaultPrefs,
    })).toBeNull();
  });

  it('prefers trust_network over platform when both qualify', () => {
    const allEnabledPrefs: UserFeedPreferences = {
      ...defaultPrefs,
      feed_show_platform: true,
    };

    // Platform-scoped request, but user has trust path → trust_network tier
    expect(resolveSourceTier({
      inUserCommunity: false,
      visibilityScope: 'platform',
      visibilityMaxDegrees: 3,
      trustDegrees: 2,
      feedPrefs: allEnabledPrefs,
    })).toBe('trust_network');
  });

  it('returns null for community-scoped requests not in user community', () => {
    expect(resolveSourceTier({
      inUserCommunity: false,
      visibilityScope: 'community',
      visibilityMaxDegrees: 3,
      trustDegrees: 1,
      feedPrefs: defaultPrefs,
    })).toBeNull();
  });
});

describe('DEFAULT_FEED_PREFERENCES', () => {
  it('has expected default values', () => {
    expect(DEFAULT_FEED_PREFERENCES.feed_show_trust_network).toBe(true);
    expect(DEFAULT_FEED_PREFERENCES.feed_trust_network_max_degrees).toBe(3);
    expect(DEFAULT_FEED_PREFERENCES.feed_show_platform).toBe(false);
    expect(DEFAULT_FEED_PREFERENCES.feed_platform_categories).toEqual(['digital', 'questions']);
  });
});

describe('VALID_VISIBILITY_SCOPES', () => {
  it('contains exactly three scopes', () => {
    expect(VALID_VISIBILITY_SCOPES).toEqual(['community', 'trust_network', 'platform']);
  });
});
