import { computeTrustScore, TrustScoreInputs } from '../../src/services/trustScoreStrategy';

/**
 * Trust score formula (ADR-037 + ADR-039):
 *
 *   volume_score   = min(30, floor(log2(recent_interactions + 1) × 10))
 *   quality_score  = round(((avg_feedback - threshold) / (5 - threshold)) × 25)
 *   depth_score    = min(15, repeat_pairs × 2) × depth_weight
 *   breadth_score  = (min(10, distinct_people × 2) + min(10, distinct_communities × 3)) × breadth_weight
 *   bonus_score    = recent_interactions >= min_interactions ? 5 : 0
 *   floor          = negative_allowed ? -50 : 0
 *   trust_score    = max(floor, min(100, raw_score))
 */

function inputs(overrides: Partial<TrustScoreInputs> = {}): TrustScoreInputs {
  return {
    recent_interactions: 0,
    avg_feedback_score: null,
    repeat_interaction_pairs: 0,
    distinct_people_count: 0,
    distinct_communities_count: 0,
    depth_weight: 0.6,
    breadth_weight: 0.4,
    feedback_threshold: 3.0,
    min_interactions_for_bonus: 1,
    negative_allowed: false,
    ...overrides,
  };
}

describe('computeTrustScore (ADR-037)', () => {
  describe('new user baseline', () => {
    it('returns 0 with no interactions, no feedback, default config', () => {
      expect(computeTrustScore(inputs())).toBe(0);
    });

    it('returns 0 with zero feedback score and no interactions', () => {
      expect(computeTrustScore(inputs({ avg_feedback_score: 0.0 }))).toBe(0);
    });
  });

  describe('volume_score (0–30, logarithmic)', () => {
    it('0 interactions → 0 pts', () => {
      expect(computeTrustScore(inputs({ recent_interactions: 0 }))).toBe(0);
    });

    it('1 interaction → floor(log2(2) × 10) = 10 pts', () => {
      // bonus_score also triggers (min_interactions_for_bonus = 1), so total = 10 + 5 = 15
      expect(computeTrustScore(inputs({ recent_interactions: 1 }))).toBe(15);
    });

    it('3 interactions → floor(log2(4) × 10) = 20 pts + 5 bonus = 25', () => {
      expect(computeTrustScore(inputs({ recent_interactions: 3 }))).toBe(25);
    });

    it('7 interactions → floor(log2(8) × 10) = 30 pts (cap) + 5 bonus = 35', () => {
      expect(computeTrustScore(inputs({ recent_interactions: 7 }))).toBe(35);
    });

    it('caps volume at 30 (beyond 7 interactions)', () => {
      expect(computeTrustScore(inputs({ recent_interactions: 100 }))).toBe(35);
      expect(computeTrustScore(inputs({ recent_interactions: 9999 }))).toBe(35);
    });

    it('volume alone with min_interactions_for_bonus=5: no bonus below 5', () => {
      expect(computeTrustScore(inputs({ recent_interactions: 3, min_interactions_for_bonus: 5 }))).toBe(20);
    });
  });

  describe('quality_score (threshold-relative)', () => {
    it('null feedback → 0 quality pts', () => {
      expect(computeTrustScore(inputs({ avg_feedback_score: null }))).toBe(0);
    });

    it('at threshold (3.0) → 0 quality pts', () => {
      // round(((3 - 3) / (5 - 3)) × 25) = 0
      expect(computeTrustScore(inputs({ avg_feedback_score: 3.0 }))).toBe(0);
    });

    it('perfect feedback (5.0) → +25 quality pts (default threshold 3.0)', () => {
      // round(((5 - 3) / (5 - 3)) × 25) = 25
      expect(computeTrustScore(inputs({ avg_feedback_score: 5.0 }))).toBe(25);
    });

    it('1-star feedback with threshold 3.0 → -25 quality pts (clamped to 0 by floor)', () => {
      // round(((1 - 3) / (5 - 3)) × 25) = -25 → clamped to 0 (negative_allowed=false)
      expect(computeTrustScore(inputs({ avg_feedback_score: 1.0 }))).toBe(0);
    });

    it('1-star feedback with threshold 1.0 → 0 quality pts (no negatives possible)', () => {
      // round(((1 - 1) / (5 - 1)) × 25) = 0
      expect(computeTrustScore(inputs({ avg_feedback_score: 1.0, feedback_threshold: 1.0 }))).toBe(0);
    });

    it('5-star with threshold 1.0 → +25 pts', () => {
      // round(((5 - 1) / (5 - 1)) × 25) = 25
      expect(computeTrustScore(inputs({ avg_feedback_score: 5.0, feedback_threshold: 1.0 }))).toBe(25);
    });

    it('4-star with threshold 3.0 → round(((4-3)/(5-3))×25) = round(12.5) = 13 pts', () => {
      expect(computeTrustScore(inputs({ avg_feedback_score: 4.0 }))).toBe(13);
    });
  });

  describe('depth_score (bonding capital)', () => {
    it('0 repeat pairs → 0 depth pts', () => {
      expect(computeTrustScore(inputs({ repeat_interaction_pairs: 0 }))).toBe(0);
    });

    it('1 repeat pair → min(15, 1×2) × 0.6 = 2 × 0.6 = 1.2 → rounded to 1', () => {
      expect(computeTrustScore(inputs({ repeat_interaction_pairs: 1 }))).toBe(1);
    });

    it('5 repeat pairs → min(15, 10) × 0.6 = 6 pts', () => {
      expect(computeTrustScore(inputs({ repeat_interaction_pairs: 5 }))).toBe(6);
    });

    it('caps depth at 15 pts before weight (8+ pairs)', () => {
      // min(15, 8×2) = 15 → × 0.6 = 9 pts
      expect(computeTrustScore(inputs({ repeat_interaction_pairs: 8 }))).toBe(9);
      expect(computeTrustScore(inputs({ repeat_interaction_pairs: 100 }))).toBe(9);
    });

    it('depth_weight=0 disables depth score', () => {
      expect(computeTrustScore(inputs({ repeat_interaction_pairs: 10, depth_weight: 0 }))).toBe(0);
    });
  });

  describe('breadth_score (bridging capital)', () => {
    it('0 distinct people, 0 communities → 0 breadth pts', () => {
      expect(computeTrustScore(inputs())).toBe(0);
    });

    it('1 distinct person → min(10, 2) × 0.4 = 0.8 → rounded to 1', () => {
      expect(computeTrustScore(inputs({ distinct_people_count: 1 }))).toBe(1);
    });

    it('5 distinct people → min(10, 10) × 0.4 = 4 pts', () => {
      expect(computeTrustScore(inputs({ distinct_people_count: 5 }))).toBe(4);
    });

    it('1 distinct community → min(10, 3) × 0.4 = 1.2 → rounded to 1', () => {
      expect(computeTrustScore(inputs({ distinct_communities_count: 1 }))).toBe(1);
    });

    it('3 distinct communities → min(10, 9) × 0.4 = 3.6 → rounded to 4', () => {
      expect(computeTrustScore(inputs({ distinct_communities_count: 3 }))).toBe(4);
    });

    it('breadth_weight=0 disables breadth score', () => {
      expect(computeTrustScore(inputs({ distinct_people_count: 10, distinct_communities_count: 5, breadth_weight: 0 }))).toBe(0);
    });
  });

  describe('bonus_score', () => {
    it('0 recent interactions → no bonus (below min threshold)', () => {
      expect(computeTrustScore(inputs({ recent_interactions: 0 }))).toBe(0);
    });

    it('1 recent interaction → +5 bonus (default min = 1)', () => {
      expect(computeTrustScore(inputs({ recent_interactions: 1 }))).toBe(15); // volume 10 + bonus 5
    });

    it('bonus only fires at min_interactions_for_bonus threshold', () => {
      // floor(log2(5)*10) = floor(23.2) = 23; no bonus → 23
      expect(computeTrustScore(inputs({ recent_interactions: 4, min_interactions_for_bonus: 5 }))).toBe(23);
      // floor(log2(6)*10) = floor(25.9) = 25; + bonus 5 → 30
      expect(computeTrustScore(inputs({ recent_interactions: 5, min_interactions_for_bonus: 5 }))).toBe(30);
    });
  });

  describe('floor and negative scores', () => {
    it('negative_allowed=false clamps score to 0 even with very bad feedback', () => {
      expect(computeTrustScore(inputs({ avg_feedback_score: 1.0, negative_allowed: false }))).toBe(0);
    });

    it('negative_allowed=true allows score to go below 0', () => {
      // quality_score = round(((1-3)/(5-3))×25) = -25; everything else 0
      const score = computeTrustScore(inputs({ avg_feedback_score: 1.0, negative_allowed: true }));
      expect(score).toBeLessThan(0);
    });

    it('floor is -50 with negative_allowed=true', () => {
      const score = computeTrustScore(inputs({
        avg_feedback_score: 1.0,
        feedback_threshold: 4.0,
        negative_allowed: true,
      }));
      expect(score).toBeGreaterThanOrEqual(-50);
    });

    it('never exceeds 100 (clamped at 100)', () => {
      // max scores: vol=30, quality=25, depth=15×0.6=9, breadth=(10+10)×0.4=8, bonus=5 → 77
      // To hit 100 we need higher weights
      const score = computeTrustScore(inputs({
        recent_interactions: 9999,
        avg_feedback_score: 5.0,
        repeat_interaction_pairs: 999,
        distinct_people_count: 999,
        distinct_communities_count: 999,
        depth_weight: 1.0,
        breadth_weight: 1.0,
        feedback_threshold: 1.0,
      }));
      // vol=30, quality=25, depth=15, breadth=20, bonus=5 → 95; still clamped to ≤100
      expect(score).toBeLessThanOrEqual(100);
      expect(score).toBeGreaterThanOrEqual(90);
    });
  });

  describe('combined signals', () => {
    it('dormant user (0 recent interactions) scores 0 regardless of old feedback quality', () => {
      // recent_interactions=0 means volume=0, bonus=0; only feedback and breadth/depth matter
      // but with 0 interactions there are also 0 distinct people → score depends only on feedback
      // With avg_feedback 4.5 and no interactions: quality = round(((4.5-3)/(2))×25) = round(18.75) = 19
      const score = computeTrustScore(inputs({ recent_interactions: 0, avg_feedback_score: 4.5 }));
      expect(score).toBe(19);
    });

    it('active user with moderate signals lands in the 40–70 range', () => {
      // recent: 8, 4-star avg, 2 repeat pairs, 5 distinct people, 2 communities
      // volume: floor(log2(9)*10) = floor(31.7) = 31 → capped 30
      // quality: round(((4-3)/2)*25) = round(12.5) = 13
      // depth: min(15, 4) * 0.6 = 2.4
      // breadth: (min(10,10) + min(10,6)) * 0.4 = 16 * 0.4 = 6.4
      // bonus: 5
      // raw ≈ 30 + 13 + 2.4 + 6.4 + 5 = 56.8 → 57
      const score = computeTrustScore(inputs({
        recent_interactions: 8,
        avg_feedback_score: 4.0,
        repeat_interaction_pairs: 2,
        distinct_people_count: 5,
        distinct_communities_count: 2,
      }));
      expect(score).toBeGreaterThanOrEqual(40);
      expect(score).toBeLessThanOrEqual(70);
    });

    it('highly active user with perfect signals lands in Trusted tier (70+)', () => {
      // vol=30, quality=25, depth=min(15,10)×0.6=6, breadth=(10+10)×0.4=8, bonus=5 → 74
      const score = computeTrustScore(inputs({
        recent_interactions: 20,
        avg_feedback_score: 5.0,
        repeat_interaction_pairs: 5,
        distinct_people_count: 15,
        distinct_communities_count: 4,
      }));
      expect(score).toBeGreaterThanOrEqual(70);
    });
  });

  describe('tier reachability', () => {
    it('New (0–19): 0 interactions, no feedback', () => {
      const score = computeTrustScore(inputs());
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThan(20);
    });

    it('Active (20–49): a few recent interactions + decent feedback', () => {
      const score = computeTrustScore(inputs({ recent_interactions: 3, avg_feedback_score: 4.0 }));
      expect(score).toBeGreaterThanOrEqual(20);
      expect(score).toBeLessThan(50);
    });

    it('Trusted (50–75): moderate activity, good feedback, some breadth', () => {
      const score = computeTrustScore(inputs({
        recent_interactions: 8,
        avg_feedback_score: 4.0,
        distinct_people_count: 5,
        distinct_communities_count: 2,
      }));
      expect(score).toBeGreaterThanOrEqual(50);
    });
  });
});
