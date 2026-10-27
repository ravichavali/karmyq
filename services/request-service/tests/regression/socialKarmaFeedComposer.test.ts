import { SocialKarmaFeedComposer } from '../../src/services/feed/socialKarmaFeedComposer';
import { query } from '../../src/database/db';

jest.mock('../../src/database/db');

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('SocialKarmaFeedComposer - Community Health Summary', () => {
  let composer: SocialKarmaFeedComposer;

  beforeEach(() => {
    jest.clearAllMocks();
    composer = new SocialKarmaFeedComposer();
  });

  it('preserves the existing activity and density weights with zero quality', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'comm-1', name: 'Test Community' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [{
          total_matches_completed: 25,
          total_active_helpers: 10,
          network_density: 0.5,
          growth_rate_matches: 10,
        }],
        rowCount: 1,
      } as any);

    const summary = await composer.getCommunityHealthSummary('comm-1');

    expect(summary).not.toBeNull();
    expect(summary!.networkStrength).toBeCloseTo(30, 1);
    expect(summary!.networkStrengthLabel).toBe('Developing');
    expect(summary!.trendDirection).toBe('growing');
  });

  it('caps the activity score at 100', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'comm-1', name: 'Very Active Community' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [{
          total_matches_completed: 60,
          total_active_helpers: 20,
          network_density: 0.5,
          growth_rate_matches: 5,
        }],
        rowCount: 1,
      } as any);

    const summary = await composer.getCommunityHealthSummary('comm-1');

    expect(summary!.networkStrength).toBeCloseTo(50, 1);
    expect(summary!.trendDirection).toBe('stable');
  });

  it.each([
    ['Strong', 50, 1, 60],
    ['Growing', 50, 0.5, 50],
    ['Developing', 25, 0.5, 30],
    ['Building', 2, 0.02, 2],
  ])('returns "%s" for its score range', async (label, matches, density, expectedScore) => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'comm-1', name: `${label} Community` }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [{
          total_matches_completed: matches,
          total_active_helpers: 10,
          network_density: density,
          growth_rate_matches: 0,
        }],
        rowCount: 1,
      } as any);

    const summary = await composer.getCommunityHealthSummary('comm-1');

    expect(summary!.networkStrength).toBeCloseTo(expectedScore as number, 1);
    expect(summary!.networkStrengthLabel).toBe(label);
  });

  it.each([
    [8, 'growing'],
    [5, 'stable'],
    [2, 'stable'],
    [-5, 'stable'],
    [-8, 'declining'],
  ] as const)('maps growth rate %s to %s', async (growthRate, trendDirection) => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'comm-1', name: 'Trend Community' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [{
          total_matches_completed: 20,
          total_active_helpers: 10,
          network_density: 0.3,
          growth_rate_matches: growthRate,
        }],
        rowCount: 1,
      } as any);

    const summary = await composer.getCommunityHealthSummary('comm-1');

    expect(summary!.trendDirection).toBe(trendDirection);
  });

  it('returns default health values when a community has no metrics yet', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'comm-new', name: 'New Community' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const summary = await composer.getCommunityHealthSummary('comm-new');

    expect(summary).toMatchObject({
      communityId: 'comm-new',
      communityName: 'New Community',
      networkStrength: 0,
      networkStrengthLabel: 'Building',
      totalMatches: 0,
      activeHelpers: 0,
      growthRate: 0,
      trendDirection: 'stable',
    });
  });

  it('returns null for a missing community', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    } as any);

    await expect(composer.getCommunityHealthSummary('missing')).resolves.toBeNull();
  });

  it('rounds network strength and growth rate to one decimal place', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'comm-1', name: 'Rounded Community' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [{
          total_matches_completed: 17,
          total_active_helpers: 8,
          network_density: 0.333,
          growth_rate_matches: 4.567,
        }],
        rowCount: 1,
      } as any);

    const summary = await composer.getCommunityHealthSummary('comm-1');

    expect(summary!.networkStrength).toBeCloseTo(20.3, 1);
    expect(summary!.growthRate).toBeCloseTo(4.6, 1);
  });
});
