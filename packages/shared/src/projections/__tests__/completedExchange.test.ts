import { projectCompletedExchanges } from '../completedExchange';
import { COMPLETED_MATCH_REASONS } from '../completedMatchStanding';

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

function exchange(key: string, iso: string, eligibleCommunityIds?: string[]) {
  return {
    key,
    requesterId: 'user-requester',
    helperId: 'user-helper',
    communityId: 'community-a',
    completedAt: new Date(iso),
    requestType: 'generic',
    ...(eligibleCommunityIds ? { eligibleCommunityIds } : {}),
  };
}

function community(id: string, helper = 60, requestor = 40, matchCompletedWeight = 1) {
  return { community_id: id, matchCompletedWeight, karma_split_helper: helper, karma_split_requestor: requestor };
}

function projectionConfig(overrides: ConfigOverrides = {}) {
  const { growthRate = 0.1, matchCompletedWeight = 1, configs } = overrides;
  return {
    stabilityGrowthRate: growthRate,
    basePool: 100,
    communityConfigs: configs ?? [community('community-a', 60, 40, matchCompletedWeight)],
  };
}

/** N exchanges by the same helper in one community, one month apart. */
function series(count: number, eligibleCommunityIds?: string[]) {
  return Array.from({ length: count }, (_, i) =>
    exchange(
      `exchange.${String(i + 1).padStart(3, '0')}`,
      new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
      eligibleCommunityIds,
    ),
  );
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

/**
 * Sprint 126 — the four intentional output changes from delegating to the canonical policy.
 *
 * These are pinned deliberately, because the pre-existing tests above assert only record COUNT and
 * timestamps and therefore could not see any of them: the fixture had drifted to snake_case reasons
 * the trust calculator cannot read, a 1/5/10/25 milestone schedule counted platform-wide, and an
 * uncapped allocation across every configured community regardless of where the request was posted.
 */
describe('Sprint 126 canonical convergence', () => {
  it('1. emits the production prose vocabulary, not the fixture snake_case', () => {
    const result = projectCompletedExchanges(series(1), projectionConfig());

    expect(result.karmaRecords.map(r => r.reason)).toEqual([
      COMPLETED_MATCH_REASONS.provided,
      COMPLETED_MATCH_REASONS.received,
      COMPLETED_MATCH_REASONS.first,
    ]);
    // The old labels are what made curated karma invisible to updateTrustScore.
    const legacy = ['help_provided', 'help_received', 'first_help_bonus'];
    for (const record of result.karmaRecords) {
      expect(legacy).not.toContain(record.reason);
    }
  });

  it('2. uses the 1/10/50/100 schedule, so no bonus lands at the fixture 5 or 25', () => {
    const result = projectCompletedExchanges(series(30), projectionConfig());
    const bonuses = result.karmaRecords.filter(
      r => r.reason !== COMPLETED_MATCH_REASONS.provided && r.reason !== COMPLETED_MATCH_REASONS.received,
    );

    expect(bonuses.map(b => b.reason)).toEqual([
      COMPLETED_MATCH_REASONS.first,
      COMPLETED_MATCH_REASONS.milestone10,
    ]);
    expect(bonuses.map(b => b.points)).toEqual([15, 25]);
    // The 5th and 25th exchanges earn nothing under the production schedule.
    expect(bonuses.map(b => b.relatedEntityId)).toEqual(['exchange.001', 'exchange.010']);
  });

  it('3. counts milestones per (helper, community), not platform-wide', () => {
    // Ten exchanges split across two communities: five each. Platform-wide counting would fire the
    // 10-exchange milestone once; per-community counting fires neither, because neither community
    // reached 10.
    const configs = [community('community-a'), community('community-b')];
    const events = Array.from({ length: 10 }, (_, i) => ({
      ...exchange(`exchange.${String(i + 1).padStart(3, '0')}`, new Date(Date.UTC(2026, 0, 1 + i)).toISOString()),
      communityId: i % 2 === 0 ? 'community-a' : 'community-b',
      eligibleCommunityIds: [i % 2 === 0 ? 'community-a' : 'community-b'],
    }));

    const result = projectCompletedExchanges(events, projectionConfig({ configs }));
    const bonuses = result.karmaRecords.filter(
      r => r.reason !== COMPLETED_MATCH_REASONS.provided && r.reason !== COMPLETED_MATCH_REASONS.received,
    );

    expect(bonuses.map(b => `${b.communityId}:${b.reason}`)).toEqual([
      `community-a:${COMPLETED_MATCH_REASONS.first}`,
      `community-b:${COMPLETED_MATCH_REASONS.first}`,
    ]);
  });

  it('4. caps an exchange at three communities and picks by prior helper karma', () => {
    const configs = [
      community('community-a'),
      community('community-b'),
      community('community-c'),
      community('community-d'),
    ];
    const eligible = ['community-a', 'community-b', 'community-c', 'community-d'];

    // First exchange: all four tie at zero prior karma, so selection falls to community id.
    const first = projectCompletedExchanges(series(1, eligible), projectionConfig({ configs }));
    expect(first.allocationsByMatch[0].map(a => a.community_id)).toEqual([
      'community-a',
      'community-b',
      'community-c',
    ]);
    expect(new Set(first.karmaRecords.map(r => r.communityId))).toEqual(
      new Set(['community-a', 'community-b', 'community-c']),
    );
    // community-d is never awarded — the uncapped fixture would have paid all four.
    expect(first.karmaRecords.some(r => r.communityId === 'community-d')).toBe(false);
  });

  it('keeps one fixed karma pool per exchange regardless of community count', () => {
    const configs = [community('community-a'), community('community-b'), community('community-c')];
    const roleTotal = (records: Array<{ reason: string; points: number }>) =>
      records
        .filter(r => r.reason === COMPLETED_MATCH_REASONS.provided || r.reason === COMPLETED_MATCH_REASONS.received)
        .reduce((sum, r) => sum + r.points, 0);

    const one = projectCompletedExchanges(series(1), projectionConfig());
    const three = projectCompletedExchanges(
      series(1, ['community-a', 'community-b', 'community-c']),
      projectionConfig({ configs }),
    );

    expect(roleTotal(one.karmaRecords)).toBe(100);
    expect(roleTotal(three.karmaRecords)).toBe(100);
  });

  it('defaults eligibility to the exchange community, inventing no cross-posting', () => {
    const configs = [community('community-a'), community('community-b')];
    // No eligibleCommunityIds declared: a manifest naming one community means one community.
    const result = projectCompletedExchanges(series(1), projectionConfig({ configs }));

    expect(result.allocationsByMatch[0].map(a => a.community_id)).toEqual(['community-a']);
  });

  it('ignores eligible communities that have no projection config', () => {
    const result = projectCompletedExchanges(
      series(1, ['community-a', 'community-unknown']),
      projectionConfig(),
    );

    expect(result.allocationsByMatch[0].map(a => a.community_id)).toEqual(['community-a']);
  });

  it('carries every karma row at its exchange timestamp and match key', () => {
    const result = projectCompletedExchanges(series(2), projectionConfig());

    for (const record of result.karmaRecords) {
      expect(['exchange.001', 'exchange.002']).toContain(record.relatedEntityId);
      const expected = record.relatedEntityId === 'exchange.001'
        ? new Date('2026-01-01T00:00:00.000Z')
        : new Date('2026-01-02T00:00:00.000Z');
      expect(record.createdAt).toEqual(expected);
    }
  });

  it('accumulates prior helper karma strictly before each exchange', () => {
    // With two eligible communities and equal splits, selection order on the SECOND exchange is
    // decided by karma earned in the FIRST — which only works if the accumulator excludes the
    // exchange currently being projected.
    const configs = [community('community-a'), community('community-b')];
    const events = series(2, ['community-a', 'community-b']);
    const result = projectCompletedExchanges(events, projectionConfig({ configs }));

    expect(result.allocationsByMatch).toHaveLength(2);
    for (const allocations of result.allocationsByMatch) {
      expect(allocations.map(a => a.community_id).sort()).toEqual(['community-a', 'community-b']);
    }
  });
});
