/**
 * Cross-workspace equivalence gate: the fixture-only completed-exchange projection must derive
 * the same raw weight and karma allocation as the live production functions for completed-only
 * history — without importing or mutating their runtime event handlers.
 *
 * Turbo does not track these cross-workspace source inputs, so run this test directly after any
 * change to production `computeRawWeight` or `allocateKarma`:
 *   npx jest tests/tdd/sprint-117-projection-equivalence.test.ts --runInBand --forceExit
 */

import { projectCompletedExchanges } from '../../packages/shared/src/projections/completedExchange';
import { computeRawWeight } from '../../services/social-graph-service/src/database/trustEdgeDb';
import {
  allocateCompletedMatchKarma,
  COMPLETED_MATCH_REASONS,
} from '../../packages/shared/src/projections/completedMatchStanding';

function communityProjectionConfig(
  id: string,
  matchCompletedWeight: number,
  helperSplit: number,
  requesterSplit: number,
) {
  return {
    community_id: id,
    matchCompletedWeight,
    karma_split_helper: helperSplit,
    karma_split_requestor: requesterSplit,
  };
}

function projectionConfig(overrides: {
  configs: Array<ReturnType<typeof communityProjectionConfig>>;
}) {
  return { stabilityGrowthRate: 0.1, basePool: 100, communityConfigs: overrides.configs };
}

function completedEvent(key: string, communityId: string, iso: string, eligibleCommunityIds?: string[]) {
  return {
    key,
    requesterId: 'user-r',
    helperId: 'user-h',
    communityId,
    completedAt: new Date(iso),
    requestType: 'generic',
    ...(eligibleCommunityIds ? { eligibleCommunityIds } : {}),
  };
}

function twoCompletedEvents(communityId: string) {
  return [
    completedEvent('exchange.1', communityId, '2026-01-01T00:00:00Z'),
    completedEvent('exchange.2', communityId, '2026-02-01T00:00:00Z'),
  ];
}

/** Adds the as-of fields the canonical allocator's candidate type carries; irrelevant to splits. */
function withAsOf(configs: Array<ReturnType<typeof communityProjectionConfig>>) {
  return configs.map(c => ({ ...c, priorHelperKarma: 0, helperHelpCountThroughAsOf: 1 }));
}

describe('Sprint 117 projection equivalence with production math', () => {
  it('matches production raw-weight and karma allocation for completed-only history', () => {
    const weights = { match_completed: 1.75, endorsement: 0.6, karma_given: 0.25, event: 0.1 };
    const configs = [communityProjectionConfig('community-a', weights.match_completed, 60, 40)];
    const projected = projectCompletedExchanges(twoCompletedEvents('community-a'), projectionConfig({ configs }));
    expect(projected.trustEdges[0].rawWeight).toBe(computeRawWeight({
      match_completed: 2, endorsement: 0, karma_given: 0, event: 0,
    }, weights));
    expect(projected.allocationsByMatch[0]).toEqual(
      allocateCompletedMatchKarma(withAsOf(configs), 100, 'generic'),
    );
  });

  it('pins largest-remainder rounding across two communities with unequal splits', () => {
    const configs = [
      communityProjectionConfig('community-a', 1.75, 60, 40),
      communityProjectionConfig('community-b', 1.5, 55, 45),
    ];
    // Sprint 126: the exchange must DECLARE the communities its request reached. Before that the
    // fixture allocated across every configured community regardless, which fabricated reach.
    const events = [
      completedEvent('exchange.multi', 'community-a', '2026-03-01T00:00:00Z', [
        'community-a',
        'community-b',
      ]),
    ];
    const projected = projectCompletedExchanges(events, projectionConfig({ configs }));
    expect(projected.allocationsByMatch[0]).toEqual(
      allocateCompletedMatchKarma(withAsOf(configs), 100, 'generic'),
    );
  });

  it('emits the canonical reason vocabulary the trust calculator reads', () => {
    const configs = [communityProjectionConfig('community-a', 1.75, 60, 40)];
    const projected = projectCompletedExchanges(
      [completedEvent('exchange.1', 'community-a', '2026-01-01T00:00:00Z')],
      projectionConfig({ configs }),
    );

    // updateTrustScore counts reason = 'Provided help' / 'Received help' in SQL. Any other label
    // is stored but invisible to standing — the defect Sprint 126 exists to remove.
    expect(projected.karmaRecords.map(r => r.reason)).toEqual([
      COMPLETED_MATCH_REASONS.provided,
      COMPLETED_MATCH_REASONS.received,
      COMPLETED_MATCH_REASONS.first,
    ]);
  });

  it('never awards more communities than the production cap', () => {
    const configs = ['a', 'b', 'c', 'd', 'e'].map(id =>
      communityProjectionConfig(`community-${id}`, 1.75, 60, 40),
    );
    const projected = projectCompletedExchanges(
      [
        completedEvent('exchange.wide', 'community-a', '2026-01-01T00:00:00Z',
          configs.map(c => c.community_id)),
      ],
      projectionConfig({ configs }),
    );

    expect(projected.allocationsByMatch[0]).toHaveLength(3);
  });
});
