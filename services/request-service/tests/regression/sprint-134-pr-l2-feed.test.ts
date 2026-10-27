import { SocialKarmaFeedComposer } from '../../src/services/feed/socialKarmaFeedComposer';
import { query } from '../../src/database/db';
jest.mock('../../src/database/db');
const mockQuery = query as jest.MockedFunction<typeof query>;

it.each([50, 75])('caps density 12 with %s completed matches at 60 / Strong', async (matches) => {
  mockQuery.mockResolvedValueOnce({ rows: [{ id: 'C', name: 'Community' }], rowCount: 1 } as any)
    .mockResolvedValueOnce({ rows: [{ total_matches_completed: matches, total_active_helpers: 24,
      network_density: '12.0000', growth_rate_matches: '1100.00' }], rowCount: 1 } as any);
  const summary = await new SocialKarmaFeedComposer().getCommunityHealthSummary('C');
  expect(summary?.networkStrength).toBe(60);
  expect(summary?.networkStrengthLabel).toBe('Strong');
});

it('keeps feed strength at 30 when retired ratings appear in a stale row', async () => {
  mockQuery.mockResolvedValueOnce({ rows: [{ id: 'C', name: 'Community' }], rowCount: 1 } as any)
    .mockResolvedValueOnce({ rows: [{ total_matches_completed: 25, total_active_helpers: 10,
      network_density: '0.5000', growth_rate_matches: '10.00',
      avg_helpfulness: 5, avg_responsiveness: 5, avg_clarity: 5 }], rowCount: 1 } as any);
  expect(await new SocialKarmaFeedComposer().getCommunityHealthSummary('C')).toEqual({
    communityId: 'C', communityName: 'Community', networkStrength: 30, networkStrengthLabel: 'Developing',
    totalMatches: 25, activeHelpers: 10, growthRate: 10, trendDirection: 'growing',
  });
});
