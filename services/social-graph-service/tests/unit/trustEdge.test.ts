/**
 * Unit tests for trust edge pure functions.
 * No DB, no mocks needed — testing deterministic math.
 */

import { normalizePair, computeRawWeight, InteractionCounts, InteractionWeights } from '../../src/database/trustEdgeDb';
import { computeEffectiveWeight } from '../../src/services/trustEdgeService';

const HALF_LIFE_MS = 6 * 30 * 24 * 60 * 60 * 1000;

// --- normalizePair ---

describe('normalizePair', () => {
  it('normalizes pair so user_id_a < user_id_b lexicographically', () => {
    const bigger = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const smaller = '00000000-0000-0000-0000-000000000001';
    const { userIdA, userIdB } = normalizePair(bigger, smaller);
    expect(userIdA).toBe(smaller);
    expect(userIdB).toBe(bigger);
  });

  it('returns unchanged when already normalized', () => {
    const a = '00000000-0000-0000-0000-000000000001';
    const b = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const { userIdA, userIdB } = normalizePair(a, b);
    expect(userIdA).toBe(a);
    expect(userIdB).toBe(b);
  });

  it('produces the same output regardless of argument order', () => {
    const x = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const y = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const forward = normalizePair(x, y);
    const backward = normalizePair(y, x);
    expect(forward.userIdA).toBe(backward.userIdA);
    expect(forward.userIdB).toBe(backward.userIdB);
  });
});

// --- computeEffectiveWeight decay formula ---

describe('computeEffectiveWeight', () => {
  it('returns full raw_weight for brand-new interaction (age ≈ 0)', () => {
    const now = new Date();
    expect(computeEffectiveWeight(100, now)).toBeCloseTo(100, 5);
  });

  it('returns exactly half raw_weight at 6-month half-life', () => {
    const sixMonthsAgo = new Date(Date.now() - HALF_LIFE_MS);
    expect(computeEffectiveWeight(100, sixMonthsAgo)).toBeCloseTo(50, 1);
  });

  it('returns quarter raw_weight at 12 months (two half-lives)', () => {
    const twelveMonthsAgo = new Date(Date.now() - 2 * HALF_LIFE_MS);
    expect(computeEffectiveWeight(100, twelveMonthsAgo)).toBeCloseTo(25, 1);
  });

  it('returns 0 for raw_weight of 0 regardless of age', () => {
    const old = new Date(Date.now() - 5 * HALF_LIFE_MS);
    expect(computeEffectiveWeight(0, old)).toBe(0);
  });

  it('effective_weight is always <= raw_weight', () => {
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = computeEffectiveWeight(80, oneMonthAgo);
    expect(result).toBeLessThanOrEqual(80);
    expect(result).toBeGreaterThan(0);
  });
});

// --- computeRawWeight ---

describe('computeRawWeight', () => {
  const platformWeights: InteractionWeights = {
    match_completed: 10,
    endorsement: 5,
    karma_given: 3,
    event: 2,
  };

  it('computes raw_weight correctly using platform default weights', () => {
    const counts: InteractionCounts = {
      match_completed: 2,
      endorsement: 1,
      karma_given: 0,
      event: 3,
    };
    // 2×10 + 1×5 + 0×3 + 3×2 = 31
    expect(computeRawWeight(counts, platformWeights)).toBe(31);
  });

  it('uses community-specific weight override when provided', () => {
    const counts: InteractionCounts = {
      match_completed: 1,
      endorsement: 0,
      karma_given: 0,
      event: 0,
    };
    const customWeights: InteractionWeights = {
      match_completed: 15,
      endorsement: 5,
      karma_given: 3,
      event: 2,
    };
    expect(computeRawWeight(counts, customWeights)).toBe(15);
  });

  it('returns 0 for all-zero counts', () => {
    const zeroCounts: InteractionCounts = {
      match_completed: 0,
      endorsement: 0,
      karma_given: 0,
      event: 0,
    };
    expect(computeRawWeight(zeroCounts, platformWeights)).toBe(0);
  });

  it('counts each type independently', () => {
    const counts: InteractionCounts = {
      match_completed: 0,
      endorsement: 0,
      karma_given: 0,
      event: 5,
    };
    // 5×2 = 10
    expect(computeRawWeight(counts, platformWeights)).toBe(10);
  });
});
