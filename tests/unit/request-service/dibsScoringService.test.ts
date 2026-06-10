// tests/unit/request-service/dibsScoringService.test.ts
/**
 * Sprint 42 — Dibs Scoring Algorithm Unit Tests
 *
 * Tests the scoring formula and eligibility gates for dibs candidate selection.
 *
 * Formula: score = trustScore * 0.50 + min(priorInteractions, 3) * 11.67 + trustGraphBonus
 * trustGraphBonus: 15 if direct exchange connection, 10 if indirect, 0 otherwise
 *
 * Eligibility gates (applied before scoring):
 *   - priorInteractions >= 1 (at least one completed interaction with requester)
 *   - is_available = true (provider must be on-duty)
 *
 * NOTE: These tests import from the expected implementation path.
 * The module does not exist yet — tests will FAIL until Task 3 implements it.
 * That is expected TDD behavior.
 */

// The module path where the scoring service will be implemented
// (relative to tests/, resolving to services/request-service/src/services/)
jest.mock('../../../services/request-service/src/database/db', () => ({
  query: jest.fn(),
}));

import {
  scoreCandidate,
  filterEligibleCandidates,
  selectTopCandidate,
} from '../../../services/request-service/src/services/dibsScoringService';

// ── Fixtures ──────────────────────────────────────────────────────────────────

interface Dibs_Candidate {
  providerId: string;
  providerUserId: string;
  displayName: string;
  trustScore: number;
  priorInteractions: number;
  trustGraphConnection: 'direct' | 'indirect' | 'none';
  isAvailable: boolean;
  // Sprint 92 (ADR-072): RawCandidate gained a facet discriminator and a similar-task
  // count. similarPriorInteractions=0 keeps every score expectation below unchanged
  // (the similarity term contributes 0).
  kind: 'neighbor' | 'provider';
  similarPriorInteractions: number;
}

const baseCandidate: Dibs_Candidate = {
  providerId: 'prov-1',
  providerUserId: 'user-prov-1',
  displayName: 'Test Provider',
  trustScore: 60,
  priorInteractions: 2,
  trustGraphConnection: 'none',
  isAvailable: true,
  kind: 'provider',
  similarPriorInteractions: 0,
};

// ── scoreCandidate ─────────────────────────────────────────────────────────────

describe('scoreCandidate', () => {
  it('scores trust score at 50% weight', () => {
    // trustScore=80, priorInteractions=1, trustGraphBonus=0
    // score = 80 * 0.50 + 1 * 11.67 + 0 = 40 + 11.67 = 51.67
    const score = scoreCandidate({ ...baseCandidate, trustScore: 80, priorInteractions: 1, trustGraphConnection: 'none' });
    expect(score).toBeCloseTo(51.67, 1);
  });

  it('caps prior interactions at 3', () => {
    // priorInteractions=5 → capped at 3 → 3 * 11.67 = 35.01
    // trustScore=50, trustGraphBonus=0
    // score = 50 * 0.50 + 3 * 11.67 + 0 = 25 + 35.01 = 60.01
    const scoreCapped = scoreCandidate({ ...baseCandidate, trustScore: 50, priorInteractions: 5, trustGraphConnection: 'none' });
    const scoreAtThree = scoreCandidate({ ...baseCandidate, trustScore: 50, priorInteractions: 3, trustGraphConnection: 'none' });
    expect(scoreCapped).toBeCloseTo(scoreAtThree, 5);
  });

  it('prior interactions at exactly 3 not capped further', () => {
    // priorInteractions=3 → 3 * 11.67 = 35.01; trustScore=40, no graph bonus
    // score = 40 * 0.50 + 3 * 11.67 + 0 = 20 + 35.01 = 55.01
    const score = scoreCandidate({ ...baseCandidate, trustScore: 40, priorInteractions: 3, trustGraphConnection: 'none' });
    expect(score).toBeCloseTo(55.01, 1);
  });

  it('adds 15pts for direct exchange connection', () => {
    // trustScore=60, priorInteractions=2, trustGraphBonus=15
    // score = 60 * 0.50 + 2 * 11.67 + 15 = 30 + 23.34 + 15 = 68.34
    const score = scoreCandidate({ ...baseCandidate, trustScore: 60, priorInteractions: 2, trustGraphConnection: 'direct' });
    expect(score).toBeCloseTo(68.34, 1);
  });

  it('adds 10pts for indirect connection', () => {
    // trustScore=60, priorInteractions=2, trustGraphBonus=10
    // score = 60 * 0.50 + 2 * 11.67 + 10 = 30 + 23.34 + 10 = 63.34
    const score = scoreCandidate({ ...baseCandidate, trustScore: 60, priorInteractions: 2, trustGraphConnection: 'indirect' });
    expect(score).toBeCloseTo(63.34, 1);
  });

  it('adds 0pts when no trust graph connection', () => {
    // trustScore=60, priorInteractions=2, trustGraphBonus=0
    // score = 60 * 0.50 + 2 * 11.67 + 0 = 30 + 23.34 = 53.34
    const score = scoreCandidate({ ...baseCandidate, trustScore: 60, priorInteractions: 2, trustGraphConnection: 'none' });
    expect(score).toBeCloseTo(53.34, 1);
  });

  it('direct connection outscores indirect by exactly 5pts (all else equal)', () => {
    const scoreDirect = scoreCandidate({ ...baseCandidate, trustGraphConnection: 'direct' });
    const scoreIndirect = scoreCandidate({ ...baseCandidate, trustGraphConnection: 'indirect' });
    expect(scoreDirect - scoreIndirect).toBeCloseTo(5, 5);
  });

  it('indirect connection outscores no-connection by exactly 10pts (all else equal)', () => {
    const scoreIndirect = scoreCandidate({ ...baseCandidate, trustGraphConnection: 'indirect' });
    const scoreNone = scoreCandidate({ ...baseCandidate, trustGraphConnection: 'none' });
    expect(scoreIndirect - scoreNone).toBeCloseTo(10, 5);
  });
});

// ── filterEligibleCandidates ──────────────────────────────────────────────────

describe('filterEligibleCandidates', () => {
  it('excludes providers with zero prior interactions', () => {
    const candidates: Dibs_Candidate[] = [
      { ...baseCandidate, providerId: 'p1', priorInteractions: 0 },
      { ...baseCandidate, providerId: 'p2', priorInteractions: 1 },
    ];
    const eligible = filterEligibleCandidates(candidates);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].providerId).toBe('p2');
  });

  it('excludes off-duty providers (isAvailable = false)', () => {
    const candidates: Dibs_Candidate[] = [
      { ...baseCandidate, providerId: 'p1', isAvailable: false, priorInteractions: 3 },
      { ...baseCandidate, providerId: 'p2', isAvailable: true, priorInteractions: 2 },
    ];
    const eligible = filterEligibleCandidates(candidates);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].providerId).toBe('p2');
  });

  it('excludes both: off-duty AND zero-interactions', () => {
    const candidates: Dibs_Candidate[] = [
      { ...baseCandidate, providerId: 'off-duty', isAvailable: false, priorInteractions: 5 },
      { ...baseCandidate, providerId: 'no-prior', isAvailable: true, priorInteractions: 0 },
      { ...baseCandidate, providerId: 'eligible', isAvailable: true, priorInteractions: 1 },
    ];
    const eligible = filterEligibleCandidates(candidates);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].providerId).toBe('eligible');
  });

  it('returns empty array when no eligible candidates', () => {
    const candidates: Dibs_Candidate[] = [
      { ...baseCandidate, isAvailable: false, priorInteractions: 0 },
    ];
    const eligible = filterEligibleCandidates(candidates);
    expect(eligible).toHaveLength(0);
  });

  it('returns all when all candidates are eligible', () => {
    const candidates: Dibs_Candidate[] = [
      { ...baseCandidate, providerId: 'p1', isAvailable: true, priorInteractions: 1 },
      { ...baseCandidate, providerId: 'p2', isAvailable: true, priorInteractions: 3 },
    ];
    const eligible = filterEligibleCandidates(candidates);
    expect(eligible).toHaveLength(2);
  });
});

// ── selectTopCandidate ────────────────────────────────────────────────────────

describe('selectTopCandidate', () => {
  it('returns null when no eligible candidates exist', () => {
    const top = selectTopCandidate([]);
    expect(top).toBeNull();
  });

  it('returns the single candidate when only one is eligible', () => {
    const top = selectTopCandidate([baseCandidate]);
    expect(top).not.toBeNull();
    expect(top!.providerId).toBe('prov-1');
  });

  it('returns the highest-scored candidate', () => {
    const candidates: Dibs_Candidate[] = [
      // lower score: trustScore=40, priorInteractions=1, none → 40*0.5 + 11.67 + 0 = 31.67
      { ...baseCandidate, providerId: 'low', trustScore: 40, priorInteractions: 1, trustGraphConnection: 'none' },
      // higher score: trustScore=80, priorInteractions=3, direct → 80*0.5 + 35.01 + 15 = 90.01
      { ...baseCandidate, providerId: 'high', trustScore: 80, priorInteractions: 3, trustGraphConnection: 'direct' },
    ];
    const top = selectTopCandidate(candidates);
    expect(top!.providerId).toBe('high');
  });

  it('excludes ineligible candidates before scoring', () => {
    const candidates: Dibs_Candidate[] = [
      // highest raw score but off-duty — should be excluded
      { ...baseCandidate, providerId: 'off-duty-high', trustScore: 100, priorInteractions: 3, trustGraphConnection: 'direct', isAvailable: false },
      // lower score but eligible
      { ...baseCandidate, providerId: 'eligible-lower', trustScore: 50, priorInteractions: 1, trustGraphConnection: 'none', isAvailable: true },
    ];
    const top = selectTopCandidate(candidates);
    expect(top!.providerId).toBe('eligible-lower');
  });

  it('returns null when all candidates are ineligible', () => {
    const candidates: Dibs_Candidate[] = [
      { ...baseCandidate, isAvailable: false },
      { ...baseCandidate, priorInteractions: 0 },
    ];
    const top = selectTopCandidate(candidates);
    expect(top).toBeNull();
  });
});
