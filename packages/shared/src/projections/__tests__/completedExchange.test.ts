import { projectCompletedExchanges } from '../completedExchange';

interface ConfigOverrides {
  growthRate?: number;
  matchCompletedWeight?: number;
  configs?: Array<{
    community_id: string;
    matchCompletedWeight: number;
    karma_split_helper: number;
    karma_split_requestor: number;
  }>;
}

function exchange(key: string, iso: string) {
  return {
    key,
    requesterId: 'user-requester',
    helperId: 'user-helper',
    communityId: 'community-a',
    completedAt: new Date(iso),
    requestType: 'generic',
  };
}

function projectionConfig(overrides: ConfigOverrides = {}) {
  const { growthRate = 0.1, matchCompletedWeight = 1, configs } = overrides;
  return {
    stabilityGrowthRate: growthRate,
    basePool: 100,
    communityConfigs: configs ?? [
      { community_id: 'community-a', matchCompletedWeight, karma_split_helper: 60, karma_split_requestor: 40 },
    ],
  };
}

describe('Sprint 117 completed-exchange projection', () => {
  it('derives count, stability, last interaction, and timestamped karma chronologically', () => {
    const result = projectCompletedExchanges([
      exchange('exchange.old', '2026-01-01T00:00:00Z'),
      exchange('exchange.new', '2026-06-29T00:00:00Z'),
    ], projectionConfig({ growthRate: 0.2, matchCompletedWeight: 1 }));
    expect(result.trustEdges[0]).toMatchObject({
      matchCompletedCount: 2,
      rawWeight: 2,
      stability: 1.44,
      lastInteractionAt: new Date('2026-06-29T00:00:00Z'),
    });
    expect(result.karmaRecords).toHaveLength(5); // two role awards per exchange + first-help bonus
    expect(result.karmaRecords[0].createdAt).toEqual(new Date('2026-01-01T00:00:00Z'));
  });

  it('sorts out-of-order exchanges before projecting so timestamps stay chronological', () => {
    const result = projectCompletedExchanges([
      exchange('exchange.new', '2026-06-29T00:00:00Z'),
      exchange('exchange.old', '2026-01-01T00:00:00Z'),
    ], projectionConfig({ growthRate: 0.2, matchCompletedWeight: 1 }));
    expect(result.trustEdges[0].firstInteractionAt).toEqual(new Date('2026-01-01T00:00:00Z'));
    expect(result.trustEdges[0].lastInteractionAt).toEqual(new Date('2026-06-29T00:00:00Z'));
    expect(result.karmaRecords[0].createdAt).toEqual(new Date('2026-01-01T00:00:00Z'));
  });
});
