import { SocialKarmaFeedComposer } from '../../src/services/feed/socialKarmaFeedComposer';
import { query } from '../../src/database/db';
jest.mock('../../src/database/db');
const mockQuery = query as jest.MockedFunction<typeof query>;

it.each([
  [25, '0.5000', 50, 0.4, 50, 'Growing'],
  [25, '1.0000', 80, 0.4, 72, 'Strong'],
  [50, '12.0000', 0, 0, 100, 'Thriving'],
  [50, '12.0000', 25, -1, 100, 'Thriving'],
  [50, '12.0000', 25, 2, 25, 'Developing'],
  [50, '12.0000', 25, NaN, 100, 'Thriving'],
] as const)('weights quality for %s matches and density %s: quality=%s weight=%s → %s/%s', async (matches, density, quality, weight, expected, label) => {
  mockQuery.mockResolvedValueOnce({ rows: [{ id: 'C', name: 'Community' }], rowCount: 1 } as any)
    .mockResolvedValueOnce({ rows: [{ total_matches_completed: matches, total_active_helpers: 24,
      network_density: density, growth_rate_matches: '0.00' }], rowCount: 1 } as any);
  const summary = await new SocialKarmaFeedComposer().getCommunityHealthSummary('C', quality, weight);
  expect(summary?.networkStrength).toBe(expected);
  expect(summary?.networkStrengthLabel).toBe(label);
});

it.each([50, 75])('caps density 12 with %s completed matches at 100 / Thriving when quality weight is zero', async (matches) => {
  mockQuery.mockResolvedValueOnce({ rows: [{ id: 'C', name: 'Community' }], rowCount: 1 } as any)
    .mockResolvedValueOnce({ rows: [{ total_matches_completed: matches, total_active_helpers: 24,
      network_density: '12.0000', growth_rate_matches: '1100.00' }], rowCount: 1 } as any);
  const summary = await new SocialKarmaFeedComposer().getCommunityHealthSummary('C');
  expect(summary?.networkStrength).toBe(100);
  expect(summary?.networkStrengthLabel).toBe('Thriving');
});

it('returns 50 / Growing at zero quality weight despite retired ratings in a stale row', async () => {
  mockQuery.mockResolvedValueOnce({ rows: [{ id: 'C', name: 'Community' }], rowCount: 1 } as any)
    .mockResolvedValueOnce({ rows: [{ total_matches_completed: 25, total_active_helpers: 10,
      network_density: '0.5000', growth_rate_matches: '10.00',
      avg_helpfulness: 5, avg_responsiveness: 5, avg_clarity: 5 }], rowCount: 1 } as any);
  expect(await new SocialKarmaFeedComposer().getCommunityHealthSummary('C')).toEqual({
    communityId: 'C', communityName: 'Community', networkStrength: 50, networkStrengthLabel: 'Growing',
    totalMatches: 25, activeHelpers: 10, growthRate: 10, trendDirection: 'growing',
  });
});
