import { filterEligibleCandidates, scoreCandidate } from '../../src/services/dibsScoringService';
import type { RawCandidate } from '../../src/db/dibsDb';

const base: RawCandidate = {
  providerId: 'p1',
  providerUserId: 'u1',
  displayName: 'Alice',
  trustScore: 75,
  priorInteractions: 2,
  trustGraphConnection: 'direct',
  isAvailable: true,
  kind: 'provider',
};

describe('filterEligibleCandidates — explore/exploit two-tier', () => {
  it('returns exploit tier when prior interactions >= 1', () => {
    const candidates = [
      { ...base, priorInteractions: 2 },
      { ...base, providerId: 'p2', providerUserId: 'u2', priorInteractions: 0, trustGraphConnection: 'direct' as const },
    ];
    const result = filterEligibleCandidates(candidates);
    expect(result).toHaveLength(1);
    expect(result[0].priorInteractions).toBe(2);
  });

  it('falls back to explore tier when no exploit candidates exist', () => {
    const candidates = [
      { ...base, priorInteractions: 0, trustGraphConnection: 'direct' as const },
    ];
    const result = filterEligibleCandidates(candidates);
    expect(result).toHaveLength(1);
    expect(result[0].trustGraphConnection).toBe('direct');
  });

  it('excludes indirect-only zero-interaction candidates from explore tier', () => {
    const candidates = [
      { ...base, priorInteractions: 0, trustGraphConnection: 'indirect' as const },
    ];
    const result = filterEligibleCandidates(candidates);
    expect(result).toHaveLength(0);
  });

  it('excludes unavailable candidates from both tiers', () => {
    const candidates = [
      { ...base, priorInteractions: 0, trustGraphConnection: 'direct' as const, isAvailable: false },
    ];
    const result = filterEligibleCandidates(candidates);
    expect(result).toHaveLength(0);
  });
});

describe('scoreCandidate — trust score flows through formula', () => {
  it('uses real trust score (not hardcoded 50) in the formula', () => {
    const high = scoreCandidate({ ...base, trustScore: 80, priorInteractions: 1, trustGraphConnection: 'none' });
    const low = scoreCandidate({ ...base, trustScore: 20, priorInteractions: 1, trustGraphConnection: 'none' });
    expect(high).toBeGreaterThan(low);
  });

  it('explore candidate scores lower than exploit candidate with same trust score', () => {
    const exploit = scoreCandidate({ ...base, priorInteractions: 1, trustGraphConnection: 'direct' });
    const explore = scoreCandidate({ ...base, priorInteractions: 0, trustGraphConnection: 'direct' });
    expect(exploit).toBeGreaterThan(explore);
  });
});
