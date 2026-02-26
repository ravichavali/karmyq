import { computeTrustScore } from '../../src/services/trustScoreStrategy';

/**
 * Trust score formula (interim, pending ADR-037):
 *   interaction_score = min(60, floor(log2(interactions + 1) × 15))  → 0–60 pts
 *   quality_score     = round((avg_feedback / 5) × 30)                → 0–30 pts
 *   karma_bonus       = min(10, floor(karma / 100))                   → 0–10 pts
 *   score             = max(0, min(100, all three))
 */
describe('computeTrustScore', () => {
  describe('new user baseline', () => {
    it('returns 0 with 0 interactions, no feedback, 0 karma', () => {
      // log2(0+1) = 0 → interaction_score = 0
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: null })).toBe(0);
    });

    it('returns 0 with zero feedback score, no karma, no interactions', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: 0.0 })).toBe(0);
    });
  });

  describe('interaction score (0–60, logarithmic)', () => {
    it('1 interaction → floor(log2(2) × 15) = floor(15) = 15', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 1, avg_feedback_score: null })).toBe(15);
    });

    it('3 interactions → floor(log2(4) × 15) = floor(30) = 30', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 3, avg_feedback_score: null })).toBe(30);
    });

    it('7 interactions → floor(log2(8) × 15) = floor(45) = 45', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 7, avg_feedback_score: null })).toBe(45);
    });

    it('15 interactions → floor(log2(16) × 15) = floor(60) = 60', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 15, avg_feedback_score: null })).toBe(60);
    });

    it('caps interaction score at 60 beyond 15 interactions', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 100, avg_feedback_score: null })).toBe(60);
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 9999, avg_feedback_score: null })).toBe(60);
    });
  });

  describe('quality score (0–30, from feedback)', () => {
    it('adds 0 when avg_feedback_score is null', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: null })).toBe(0);
    });

    it('adds 30 for perfect feedback (5.0)', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: 5.0 })).toBe(30);
    });

    it('adds 15 for mid feedback (2.5) → round(2.5/5 × 30) = 15', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: 2.5 })).toBe(15);
    });

    it('adds 18 for 3.0 feedback → round(3/5 × 30) = 18', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: 3.0 })).toBe(18);
    });

    it('adds 24 for 4.0 feedback → round(4/5 × 30) = 24', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: 4.0 })).toBe(24);
    });
  });

  describe('karma bonus (0–10)', () => {
    it('adds 0 for < 100 karma', () => {
      expect(computeTrustScore({ total_karma: 99, interactions_completed: 0, avg_feedback_score: null })).toBe(0);
    });

    it('adds 1 for 100 karma', () => {
      expect(computeTrustScore({ total_karma: 100, interactions_completed: 0, avg_feedback_score: null })).toBe(1);
    });

    it('adds 5 for 500 karma', () => {
      expect(computeTrustScore({ total_karma: 500, interactions_completed: 0, avg_feedback_score: null })).toBe(5);
    });

    it('caps karma bonus at 10 (1000+ karma)', () => {
      expect(computeTrustScore({ total_karma: 1000, interactions_completed: 0, avg_feedback_score: null })).toBe(10);
      expect(computeTrustScore({ total_karma: 99999, interactions_completed: 0, avg_feedback_score: null })).toBe(10);
    });
  });

  describe('combined signals', () => {
    it('reaches 100 with 15+ interactions, perfect feedback, 1000+ karma', () => {
      // 60 + 30 + 10 = 100
      expect(computeTrustScore({ total_karma: 1000, interactions_completed: 15, avg_feedback_score: 5.0 })).toBe(100);
    });

    it('3 interactions + 4-star → Building tier (54)', () => {
      // interaction: floor(log2(4)*15)=30; quality: round(4/5*30)=24; karma: 0 → 54
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 3, avg_feedback_score: 4.0 })).toBe(54);
    });

    it('5 interactions + 4-star → Reliable tier (62)', () => {
      // interaction: floor(log2(6)*15)=floor(38.7)=38; quality: 24; karma: 0 → 62
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 5, avg_feedback_score: 4.0 })).toBe(62);
    });

    it('10 interactions + 4-star → Reliable tier (75)', () => {
      // interaction: floor(log2(11)*15)=floor(51.9)=51; quality: 24; karma: 0 → 75
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 10, avg_feedback_score: 4.0 })).toBe(75);
    });

    it('never exceeds 100', () => {
      expect(computeTrustScore({ total_karma: 99999, interactions_completed: 9999, avg_feedback_score: 5.0 })).toBe(100);
    });

    it('never goes below 0', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: 0.0 })).toBe(0);
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: null })).toBe(0);
    });
  });

  describe('tier reachability', () => {
    it('New tier (0–39): 1 interaction with no feedback', () => {
      const score = computeTrustScore({ total_karma: 0, interactions_completed: 1, avg_feedback_score: null });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThan(40);
    });

    it('Building tier (40–59): reachable with a few interactions + decent feedback', () => {
      const score = computeTrustScore({ total_karma: 0, interactions_completed: 3, avg_feedback_score: 4.0 });
      expect(score).toBeGreaterThanOrEqual(40);
      expect(score).toBeLessThan(60);
    });

    it('Reliable tier (60–79): reachable with moderate interactions + good feedback', () => {
      const score = computeTrustScore({ total_karma: 0, interactions_completed: 5, avg_feedback_score: 4.0 });
      expect(score).toBeGreaterThanOrEqual(60);
      expect(score).toBeLessThan(80);
    });

    it('Trusted tier (80–100): reachable with many interactions + good feedback', () => {
      const score = computeTrustScore({ total_karma: 0, interactions_completed: 15, avg_feedback_score: 4.0 });
      expect(score).toBeGreaterThanOrEqual(80);
    });
  });
});
