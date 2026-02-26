import { computeTrustScore } from '../../src/services/trustScoreStrategy';

/**
 * Trust score formula (interim, pending ADR-037):
 *   karma_contribution   = min(80, floor(karma/10) × 2)   → 0–80 pts
 *   feedback_contribution = round((avg/5) × 20)            → 0–20 pts
 *   score = max(0, min(100, karma + feedback))
 */
describe('computeTrustScore', () => {
  describe('new user baseline', () => {
    it('returns 0 with no karma and no feedback', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: null })).toBe(0);
    });

    it('returns 0 with zero feedback score and no karma', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: 0.0 })).toBe(0);
    });
  });

  describe('karma contribution (0–80)', () => {
    it('karma = 10 → floor(10/10)*2 = 2', () => {
      expect(computeTrustScore({ total_karma: 10, interactions_completed: 1, avg_feedback_score: null })).toBe(2);
    });

    it('karma = 50 → floor(50/10)*2 = 10', () => {
      expect(computeTrustScore({ total_karma: 50, interactions_completed: 5, avg_feedback_score: null })).toBe(10);
    });

    it('karma = 100 → floor(100/10)*2 = 20  (New tier ceiling)', () => {
      expect(computeTrustScore({ total_karma: 100, interactions_completed: 10, avg_feedback_score: null })).toBe(20);
    });

    it('karma = 200 → floor(200/10)*2 = 40  (Building tier)', () => {
      expect(computeTrustScore({ total_karma: 200, interactions_completed: 10, avg_feedback_score: null })).toBe(40);
    });

    it('karma = 400 → capped at 80  (Trusted without feedback)', () => {
      expect(computeTrustScore({ total_karma: 400, interactions_completed: 20, avg_feedback_score: null })).toBe(80);
    });

    it('caps karma contribution at 80', () => {
      expect(computeTrustScore({ total_karma: 1000, interactions_completed: 50, avg_feedback_score: null })).toBe(80);
      expect(computeTrustScore({ total_karma: 99999, interactions_completed: 100, avg_feedback_score: null })).toBe(80);
    });
  });

  describe('feedback contribution (0–20)', () => {
    it('adds 0 when avg_feedback_score is null', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: null })).toBe(0);
    });

    it('adds 20 for perfect feedback (5.0)', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: 5.0 })).toBe(20);
    });

    it('adds 10 for mid feedback (2.5)', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: 2.5 })).toBe(10);
    });

    it('adds 12 for 3.0 feedback → round(3/5 × 20) = 12', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: 3.0 })).toBe(12);
    });

    it('adds 16 for 4.0 feedback → round(4/5 × 20) = 16', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: 4.0 })).toBe(16);
    });
  });

  describe('combined signals', () => {
    it('reaches 100 with max karma (400) and perfect feedback (5.0)', () => {
      // 80 + 20 = 100
      expect(computeTrustScore({ total_karma: 400, interactions_completed: 10, avg_feedback_score: 5.0 })).toBe(100);
    });

    it('200 karma + 4-star feedback → Building/Reliable boundary', () => {
      // karma: min(80, 40) = 40; feedback: round(4/5 × 20) = 16 → 56
      expect(computeTrustScore({ total_karma: 200, interactions_completed: 5, avg_feedback_score: 4.0 })).toBe(56);
    });

    it('50 karma + 3-star feedback stays in New/Building range', () => {
      // karma: min(80, 10) = 10; feedback: round(3/5 × 20) = 12 → 22
      expect(computeTrustScore({ total_karma: 50, interactions_completed: 3, avg_feedback_score: 3.0 })).toBe(22);
    });

    it('never exceeds 100', () => {
      expect(computeTrustScore({ total_karma: 99999, interactions_completed: 999, avg_feedback_score: 5.0 })).toBe(100);
    });

    it('never goes below 0', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: 0.0 })).toBe(0);
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: null })).toBe(0);
    });
  });

  describe('tier reachability', () => {
    it('New tier (0–39): reachable at low karma with no feedback', () => {
      const score = computeTrustScore({ total_karma: 100, interactions_completed: 5, avg_feedback_score: null });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThan(40);
    });

    it('Building tier (40–59): reachable at moderate karma', () => {
      const score = computeTrustScore({ total_karma: 200, interactions_completed: 10, avg_feedback_score: null });
      expect(score).toBeGreaterThanOrEqual(40);
      expect(score).toBeLessThan(60);
    });

    it('Reliable tier (60–79): reachable at moderate karma + good feedback', () => {
      const score = computeTrustScore({ total_karma: 250, interactions_completed: 10, avg_feedback_score: 4.5 });
      expect(score).toBeGreaterThanOrEqual(60);
      expect(score).toBeLessThan(80);
    });

    it('Trusted tier (80–100): reachable at high karma', () => {
      const score = computeTrustScore({ total_karma: 400, interactions_completed: 20, avg_feedback_score: 4.0 });
      expect(score).toBeGreaterThanOrEqual(80);
    });
  });
});
