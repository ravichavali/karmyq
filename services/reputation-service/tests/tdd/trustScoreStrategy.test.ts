import { computeTrustScore } from '../../src/services/trustScoreStrategy';

describe('computeTrustScore', () => {
  describe('base score', () => {
    it('returns 50 with no karma and no feedback', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: null })).toBe(50);
    });
  });

  describe('karma contribution (0–40)', () => {
    it('adds karma contribution: floor(karma/10), capped at 40', () => {
      expect(computeTrustScore({ total_karma: 10, interactions_completed: 1, avg_feedback_score: null })).toBe(51);
      expect(computeTrustScore({ total_karma: 50, interactions_completed: 5, avg_feedback_score: null })).toBe(55);
      expect(computeTrustScore({ total_karma: 100, interactions_completed: 10, avg_feedback_score: null })).toBe(60);
      expect(computeTrustScore({ total_karma: 200, interactions_completed: 10, avg_feedback_score: null })).toBe(70);
      expect(computeTrustScore({ total_karma: 400, interactions_completed: 10, avg_feedback_score: null })).toBe(90);
    });

    it('caps karma contribution at 40 (score max 90 with no feedback)', () => {
      expect(computeTrustScore({ total_karma: 400, interactions_completed: 20, avg_feedback_score: null })).toBe(90);
      expect(computeTrustScore({ total_karma: 1000, interactions_completed: 50, avg_feedback_score: null })).toBe(90);
      expect(computeTrustScore({ total_karma: 99999, interactions_completed: 100, avg_feedback_score: null })).toBe(90);
    });
  });

  describe('feedback contribution (0–10)', () => {
    it('adds 0 when avg_feedback_score is null', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: null })).toBe(50);
    });

    it('adds 10 for perfect feedback (5.0)', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: 5.0 })).toBe(60);
    });

    it('adds 5 for mid feedback (2.5)', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: 2.5 })).toBe(55);
    });

    it('adds 6 for 3.0 feedback', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: 3.0 })).toBe(56);
    });

    it('adds 0 for 0.0 feedback', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: 0.0 })).toBe(50);
    });
  });

  describe('combined signals', () => {
    it('reaches 100 with max karma and perfect feedback', () => {
      expect(computeTrustScore({ total_karma: 400, interactions_completed: 10, avg_feedback_score: 5.0 })).toBe(100);
    });

    it('moderate karma + mid feedback', () => {
      // karma=50 → floor(50/10)=5, feedback=3.0 → round((3/5)*10)=6 → 50+5+6=61
      expect(computeTrustScore({ total_karma: 50, interactions_completed: 5, avg_feedback_score: 3.0 })).toBe(61);
    });

    it('never exceeds 100', () => {
      expect(computeTrustScore({ total_karma: 99999, interactions_completed: 999, avg_feedback_score: 5.0 })).toBe(100);
    });

    it('never goes below 50 with valid inputs', () => {
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: 0.0 })).toBeGreaterThanOrEqual(50);
      expect(computeTrustScore({ total_karma: 0, interactions_completed: 0, avg_feedback_score: null })).toBeGreaterThanOrEqual(50);
    });
  });
});
