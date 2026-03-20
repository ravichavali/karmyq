// tests/unit/reputation/communityEvolutionService.test.ts
import { computeAggregateDeltas, computeDampingFactor, shouldEvolveHops } from '../../../services/reputation-service/src/services/communityEvolutionService';

describe('computeAggregateDeltas', () => {
  it('returns median of member deltas', () => {
    const deltas = [+0.10, +0.05, +0.15, -0.02, +0.08];
    expect(computeAggregateDeltas(deltas)).toBeCloseTo(0.08, 2);
  });

  it('returns 0 for empty delta list', () => {
    expect(computeAggregateDeltas([])).toBe(0);
  });

  it('handles single member delta', () => {
    expect(computeAggregateDeltas([+0.12])).toBeCloseTo(0.12, 2);
  });

  it('handles all-negative deltas', () => {
    const deltas = [-0.10, -0.05, -0.08];
    expect(computeAggregateDeltas(deltas)).toBeCloseTo(-0.08, 2);
  });
});

describe('computeDampingFactor', () => {
  it('returns 1.0 when no previous rate (first cycle)', () => {
    expect(computeDampingFactor(null, 2.5)).toBe(1.0);
  });

  it('returns 1.0 when rate is stable (within 10%)', () => {
    expect(computeDampingFactor(2.5, 2.4)).toBe(1.0);
  });

  it('returns 0.5 when rate declines >10%', () => {
    // 2.5 → 2.0 is a 20% drop
    expect(computeDampingFactor(2.5, 2.0)).toBe(0.5);
  });

  it('returns 0.0 when rate declines >25%', () => {
    // 2.5 → 1.8 is a 28% drop
    expect(computeDampingFactor(2.5, 1.8)).toBe(0.0);
  });

  it('returns 1.0 when rate is improving', () => {
    expect(computeDampingFactor(2.0, 2.8)).toBe(1.0);
  });
});

describe('shouldEvolveHops', () => {
  it('returns false if fewer than 3 prior cycles', () => {
    const recentDeltas = [+0.03, +0.02]; // only 2
    expect(shouldEvolveHops(recentDeltas)).toBe(false);
  });

  it('returns true (positive) if last 3 cycles all positive', () => {
    const recentDeltas = [+0.03, +0.02, +0.04];
    expect(shouldEvolveHops(recentDeltas)).toBe(1);
  });

  it('returns true (negative) if last 3 cycles all negative', () => {
    const recentDeltas = [-0.03, -0.02, -0.04];
    expect(shouldEvolveHops(recentDeltas)).toBe(-1);
  });

  it('returns false if direction is mixed', () => {
    const recentDeltas = [+0.03, -0.02, +0.04];
    expect(shouldEvolveHops(recentDeltas)).toBe(false);
  });
});
