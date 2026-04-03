/**
 * Feed Scoring Tests (ADR-031, extended in ADR-038)
 *
 * Tests for community-configurable feed scoring:
 * - calculateFeedScore: weighted composite scoring (7 signals)
 * - scoreRecency: time-decay of request age
 * - scoreUrgency: urgency level to 0-100
 * - scoreCommunityRelevance: request type vs community enabled types
 * - scoreTrustDistance: degrees of separation to 0-100
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateFeedScore,
  scoreRecency,
  scoreUrgency,
  scoreCommunityRelevance,
  scoreTrustDistance,
  resolveSourceTier,
  DEFAULT_FEED_WEIGHTS,
  DEFAULT_FEED_PREFERENCES,
  VALID_VISIBILITY_SCOPES,
} from '../utils';
import type { FeedScoringWeights, FeedScoreInput, TierResolutionInput, UserFeedPreferences } from '../types';

// Shared 7-field input for calculateFeedScore tests
const defaultInput: FeedScoreInput = {
  skillMatchScore: 80,
  trustDistanceScore: 50,
  communityRelevanceScore: 70,
  urgencyScore: 60,
  requesterTrustScore: 50,
  priorInteractionScore: 0,
  recencyScore: 100,
};

describe('calculateFeedScore', () => {
  it('calculates weighted score with default weights', () => {
    const result = calculateFeedScore(defaultInput);

    // 80*0.25 + 50*0.20 + 70*0.15 + 60*0.10 + 50*0.15 + 0*0.15 + 100*0.05
    // = 20 + 10 + 10.5 + 6 + 7.5 + 0 + 5 = 59
    expect(result.score).toBe(59);
    expect(result.weights).toEqual(DEFAULT_FEED_WEIGHTS);
  });

  it('returns breakdown with raw and weighted values for all 7 signals', () => {
    const result = calculateFeedScore(defaultInput);

    expect(result.breakdown.skillMatch.raw).toBe(80);
    expect(result.breakdown.skillMatch.weighted).toBe(20);        // 80 * 0.25
    expect(result.breakdown.trustDistance.raw).toBe(50);
    expect(result.breakdown.trustDistance.weighted).toBe(10);     // 50 * 0.20
    expect(result.breakdown.communityRelevance.raw).toBe(70);
    expect(result.breakdown.communityRelevance.weighted).toBe(10.5); // 70 * 0.15
    expect(result.breakdown.urgency.raw).toBe(60);
    expect(result.breakdown.urgency.weighted).toBe(6);            // 60 * 0.10
    expect(result.breakdown.requesterTrust.raw).toBe(50);
    expect(result.breakdown.requesterTrust.weighted).toBe(7.5);   // 50 * 0.15
    expect(result.breakdown.priorInteraction.raw).toBe(0);
    expect(result.breakdown.priorInteraction.weighted).toBe(0);   // 0 * 0.15
    expect(result.breakdown.recency.raw).toBe(100);
    expect(result.breakdown.recency.weighted).toBe(5);            // 100 * 0.05
  });

  it('uses custom community weights', () => {
    const trustFocused: FeedScoringWeights = {
      feed_weight_skill_match: 0.20,
      feed_weight_trust_distance: 0.50,
      feed_weight_community_relevance: 0.10,
      feed_weight_urgency: 0.05,
      feed_weight_requester_trust: 0.05,
      feed_weight_prior_interaction: 0.05,
      feed_weight_recency: 0.05,
    };

    const result = calculateFeedScore(defaultInput, trustFocused);

    // 80*0.20 + 50*0.50 + 70*0.10 + 60*0.05 + 50*0.05 + 0*0.05 + 100*0.05
    // = 16 + 25 + 7 + 3 + 2.5 + 0 + 5 = 58.5
    expect(result.score).toBe(58.5);
    expect(result.weights).toEqual(trustFocused);
  });

  it('clamps input scores to 0-100', () => {
    const result = calculateFeedScore({
      skillMatchScore: 150,   // over 100 → clamped to 100
      trustDistanceScore: -10, // under 0 → clamped to 0
      communityRelevanceScore: 50,
      urgencyScore: 50,
      requesterTrustScore: 50,
      priorInteractionScore: 50,
      recencyScore: 50,
    });

    // 100*0.25 + 0*0.20 + 50*0.15 + 50*0.10 + 50*0.15 + 50*0.10 + 50*0.05
    // = 25 + 0 + 7.5 + 5 + 7.5 + 5 + 2.5 = 52.5
    expect(result.score).toBe(52.5);
    expect(result.breakdown.skillMatch.raw).toBe(100);
    expect(result.breakdown.trustDistance.raw).toBe(0);
  });

  it('returns 0 for all-zero inputs', () => {
    const result = calculateFeedScore({
      skillMatchScore: 0,
      trustDistanceScore: 0,
      communityRelevanceScore: 0,
      urgencyScore: 0,
      requesterTrustScore: 0,
      priorInteractionScore: 0,
      recencyScore: 0,
    });

    expect(result.score).toBe(0);
  });

  it('returns 100 for all-perfect inputs', () => {
    const result = calculateFeedScore({
      skillMatchScore: 100,
      trustDistanceScore: 100,
      communityRelevanceScore: 100,
      urgencyScore: 100,
      requesterTrustScore: 100,
      priorInteractionScore: 100,
      recencyScore: 100,
    });

    expect(result.score).toBe(100);
  });

  it('handles skill-only community (skill weight = 1.0)', () => {
    const skillOnly: FeedScoringWeights = {
      feed_weight_skill_match: 1.0,
      feed_weight_trust_distance: 0.0,
      feed_weight_community_relevance: 0.0,
      feed_weight_urgency: 0.0,
      feed_weight_requester_trust: 0.0,
      feed_weight_prior_interaction: 0.0,
      feed_weight_recency: 0.0,
    };

    const result = calculateFeedScore(defaultInput, skillOnly);
    expect(result.score).toBe(80); // Just the skill score
  });
});

describe('calculateFeedScore — weight-sum validation', () => {
  const validInput: FeedScoreInput = {
    skillMatchScore: 50, trustDistanceScore: 50, communityRelevanceScore: 50,
    urgencyScore: 50, requesterTrustScore: 50, priorInteractionScore: 50, recencyScore: 50,
  };

  it('throws when weights sum to 0.90', () => {
    const badWeights: FeedScoringWeights = {
      feed_weight_skill_match: 0.20,
      feed_weight_trust_distance: 0.20,
      feed_weight_community_relevance: 0.15,
      feed_weight_urgency: 0.10,
      feed_weight_requester_trust: 0.10,
      feed_weight_prior_interaction: 0.10,
      feed_weight_recency: 0.05,
      // sum = 0.90
    };
    expect(() => calculateFeedScore(validInput, badWeights)).toThrow('Feed weights must sum to 1.0');
  });

  it('does not throw when weights sum to exactly 1.00', () => {
    expect(() => calculateFeedScore(validInput, DEFAULT_FEED_WEIGHTS)).not.toThrow();
  });

  it('does not throw when weights sum to 1.005 (within tolerance)', () => {
    const nearlyOne: FeedScoringWeights = {
      feed_weight_skill_match: 0.25,
      feed_weight_trust_distance: 0.20,
      feed_weight_community_relevance: 0.15,
      feed_weight_urgency: 0.10,
      feed_weight_requester_trust: 0.15,
      feed_weight_prior_interaction: 0.15,
      feed_weight_recency: 0.005,
      // sum = 1.005 → within ±0.01
    };
    expect(() => calculateFeedScore(validInput, nearlyOne)).not.toThrow();
  });
});

describe('scoreRecency', () => {
  function daysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  it('scores 6 hours old as 100', () => {
    expect(scoreRecency(new Date(Date.now() - 6 * 60 * 60 * 1000))).toBe(100);
  });

  it('scores 2 days old as 85', () => {
    expect(scoreRecency(daysAgo(2))).toBe(85);
  });

  it('scores 5 days old as 70', () => {
    expect(scoreRecency(daysAgo(5))).toBe(70);
  });

  it('scores 10 days old as 50', () => {
    expect(scoreRecency(daysAgo(10))).toBe(50);
  });

  it('scores 20 days old as 30', () => {
    expect(scoreRecency(daysAgo(20))).toBe(30);
  });

  it('scores 45 days old as 15', () => {
    expect(scoreRecency(daysAgo(45))).toBe(15);
  });

  it('accepts string dates', () => {
    expect(scoreRecency(new Date().toISOString())).toBe(100);
  });
});

describe('calculateFeedScore — new signals in breakdown', () => {
  it('includes requesterTrust, priorInteraction, recency in breakdown', () => {
    const result = calculateFeedScore({
      skillMatchScore: 50,
      trustDistanceScore: 50,
      communityRelevanceScore: 50,
      urgencyScore: 50,
      requesterTrustScore: 80,
      priorInteractionScore: 100,
      recencyScore: 85,
    });

    expect(result.breakdown).toHaveProperty('requesterTrust');
    expect(result.breakdown).toHaveProperty('priorInteraction');
    expect(result.breakdown).toHaveProperty('recency');
    expect(result.breakdown.requesterTrust.raw).toBe(80);
    expect(result.breakdown.priorInteraction.raw).toBe(100);
    expect(result.breakdown.recency.raw).toBe(85);
  });

  it('requests from prior exchange partners score higher than strangers', () => {
    const base = {
      skillMatchScore: 50, trustDistanceScore: 50,
      communityRelevanceScore: 50, urgencyScore: 50,
      requesterTrustScore: 50, recencyScore: 50,
    };

    const priorExchange = calculateFeedScore({ ...base, priorInteractionScore: 100 });
    const stranger = calculateFeedScore({ ...base, priorInteractionScore: 0 });

    expect(priorExchange.score).toBeGreaterThan(stranger.score);
    // diff = (100 - 0) * 0.10 = 10
    expect(priorExchange.score - stranger.score).toBe(10);
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
    const base = {
      skillMatchScore: 50, communityRelevanceScore: 50,
      urgencyScore: 50, requesterTrustScore: 50,
      priorInteractionScore: 0, recencyScore: 50,
    };

    const directResult = calculateFeedScore({
      ...base,
      trustDistanceScore: scoreTrustDistance(1), // 100
    });

    const unconnectedResult = calculateFeedScore({
      ...base,
      trustDistanceScore: scoreTrustDistance(null), // 10
    });

    expect(directResult.score).toBeGreaterThan(unconnectedResult.score);
    // With default weights (trust_distance=0.20): diff = (100-10) * 0.20 = 18
    expect(directResult.score - unconnectedResult.score).toBe(18);
  });
});

describe('DEFAULT_FEED_WEIGHTS', () => {
  it('sums to 1.0 across all 7 signals', () => {
    const sum =
      DEFAULT_FEED_WEIGHTS.feed_weight_skill_match +
      DEFAULT_FEED_WEIGHTS.feed_weight_trust_distance +
      DEFAULT_FEED_WEIGHTS.feed_weight_community_relevance +
      DEFAULT_FEED_WEIGHTS.feed_weight_urgency +
      DEFAULT_FEED_WEIGHTS.feed_weight_requester_trust +
      DEFAULT_FEED_WEIGHTS.feed_weight_prior_interaction +
      DEFAULT_FEED_WEIGHTS.feed_weight_recency;

    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });

  it('has the expected 7 weight fields', () => {
    expect(DEFAULT_FEED_WEIGHTS).toHaveProperty('feed_weight_skill_match', 0.25);
    expect(DEFAULT_FEED_WEIGHTS).toHaveProperty('feed_weight_trust_distance', 0.20);
    expect(DEFAULT_FEED_WEIGHTS).toHaveProperty('feed_weight_community_relevance', 0.15);
    expect(DEFAULT_FEED_WEIGHTS).toHaveProperty('feed_weight_urgency', 0.10);
    expect(DEFAULT_FEED_WEIGHTS).toHaveProperty('feed_weight_requester_trust', 0.15);
    expect(DEFAULT_FEED_WEIGHTS).toHaveProperty('feed_weight_prior_interaction', 0.10);
    expect(DEFAULT_FEED_WEIGHTS).toHaveProperty('feed_weight_recency', 0.05);
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
    expect(resolveSourceTier({
      inUserCommunity: false,
      visibilityScope: 'trust_network',
      visibilityMaxDegrees: 2,
      trustDegrees: 3,
      feedPrefs: defaultPrefs,
    })).toBeNull();
  });

  it('respects user feed_trust_network_max_degrees preference', () => {
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
    expect(resolveSourceTier({
      inUserCommunity: false,
      visibilityScope: 'trust_network',
      visibilityMaxDegrees: 4,
      trustDegrees: 3,
      feedPrefs: defaultPrefs,
    })).toBe('trust_network');

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
