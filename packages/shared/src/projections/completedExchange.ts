/**
 * Sprint 117 — Fixture-only completed-exchange projection.
 *
 * Demo history declares completed exchanges, never raw trust edges or exact scores. These pure,
 * timestamp-aware rules rebuild the trust/connection/karma projection from that history in
 * chronological order, so aging, stability, and karma emerge from the same arithmetic the live
 * platform uses. A cross-workspace equivalence test locks `rawWeight` to production
 * `computeRawWeight`.
 *
 * Sprint 126 (ADR-096): karma, milestones, community selection and the award cap are no longer
 * reimplemented here — they are delegated to the canonical policy in `completedMatchStanding.ts`,
 * the same one live delivery and historical replay use. Before that, this module's private copies
 * had drifted on all four axes (snake_case reasons the trust calculator cannot read, a 1/5/10/25
 * milestone schedule counted platform-wide rather than per community, and an uncapped allocation
 * across every configured community regardless of where the request was posted), which is why the
 * curated demo looked populated in storage while scoring nothing.
 *
 * Still fixture-only: never imported by a live event handler, and it writes no production state.
 * What it no longer is, is a second definition of the rules.
 */

import {
  planCompletedMatchStanding,
  compareReplayKeys,
  COMPLETED_MATCH_REASONS,
  type CommunityAllocation,
  type PlannedStandingKarmaRow,
  type StandingCommunityCandidate,
} from './completedMatchStanding';

export interface CompletedExchangeEvent {
  key: string;
  requesterId: string;
  helperId: string;
  communityId: string;
  completedAt: Date;
  requestType: string;
  /**
   * Communities this exchange's request reached, i.e. the candidates karma may be awarded in.
   * Defaults to `[communityId]` — a manifest that declares one community means one community, and
   * inventing cross-posting would fabricate reach the demo history never had.
   */
  eligibleCommunityIds?: string[];
}

export interface CommunityProjectionConfig {
  community_id: string;
  matchCompletedWeight: number;
  karma_split_helper: number;
  karma_split_requestor: number;
}

export interface CompletedExchangeProjectionConfig {
  /** Per-completed-interaction stability multiplier (trust_decay_config.stability_growth_rate). */
  stabilityGrowthRate: number;
  /** Fixed karma pool per completed request (config default: 100). */
  basePool: number;
  communityConfigs: CommunityProjectionConfig[];
}

export interface ProjectedTrustEdge {
  userIdA: string;
  userIdB: string;
  communityId: string;
  matchCompletedCount: number;
  rawWeight: number;
  stability: number;
  firstInteractionAt: Date;
  lastInteractionAt: Date;
}

export interface ProjectedConnection {
  userAId: string;
  userBId: string;
  type: 'exchange';
  firstConnectedAt: Date;
  lastInteractionAt: Date;
}

/**
 * Sprint 126: the same shape the canonical policy plans, so the fixture cannot describe a karma row
 * the live path could not produce.
 */
export type ProjectedKarmaRecord = PlannedStandingKarmaRow;

export interface CompletedExchangeProjection {
  trustEdges: ProjectedTrustEdge[];
  connections: ProjectedConnection[];
  karmaRecords: ProjectedKarmaRecord[];
  allocationsByMatch: CommunityAllocation[][];
}

function normalizePair(userA: string, userB: string): { a: string; b: string } {
  return userA < userB ? { a: userA, b: userB } : { a: userB, b: userA };
}

/**
 * Project completed exchanges into trust edges, connections, and karma records. Events are sorted
 * chronologically (then by key) before projecting so ages, stability, and karma timestamps are
 * deterministic regardless of input order.
 */
export function projectCompletedExchanges(
  events: CompletedExchangeEvent[],
  config: CompletedExchangeProjectionConfig,
): CompletedExchangeProjection {
  // compareReplayKeys, not a local re-statement: the fixture and the live projector must agree on
  // replay order, and localeCompare's collation is locale/ICU-dependent where the canonical
  // comparison is code-unit.
  const ordered = [...events].sort((a, b) =>
    compareReplayKeys(
      { completedAt: a.completedAt, matchId: a.key },
      { completedAt: b.completedAt, matchId: b.key },
    ),
  );

  const weightByCommunity = new Map(config.communityConfigs.map(c => [c.community_id, c.matchCompletedWeight]));
  const edges = new Map<string, ProjectedTrustEdge>();
  const connections = new Map<string, ProjectedConnection>();
  const karmaRecords: ProjectedKarmaRecord[] = [];
  const allocationsByMatch: CommunityAllocation[][] = [];
  const configByCommunity = new Map(config.communityConfigs.map(c => [c.community_id, c]));
  // As-of accumulators keyed by `${helperId}:${communityId}`. Because events are projected oldest
  // first and these are updated only AFTER planning an event, reading them yields exactly the
  // strictly-before history the canonical policy expects — the same boundary the live projector
  // gets from SQL.
  const priorHelperKarma = new Map<string, number>();
  const priorHelperHelps = new Map<string, number>();

  for (const event of ordered) {
    const { a, b } = normalizePair(event.requesterId, event.helperId);

    // Trust edge, scoped to the exchange's community.
    const edgeKey = `${a}:${b}:${event.communityId}`;
    const existing = edges.get(edgeKey);
    if (existing) {
      existing.matchCompletedCount += 1;
      existing.stability *= 1 + config.stabilityGrowthRate;
      existing.lastInteractionAt = event.completedAt;
      existing.rawWeight = existing.matchCompletedCount * (weightByCommunity.get(event.communityId) ?? 1);
    } else {
      const weight = weightByCommunity.get(event.communityId) ?? 1;
      edges.set(edgeKey, {
        userIdA: a,
        userIdB: b,
        communityId: event.communityId,
        matchCompletedCount: 1,
        rawWeight: 1 * weight,
        stability: 1 * (1 + config.stabilityGrowthRate),
        firstInteractionAt: event.completedAt,
        lastInteractionAt: event.completedAt,
      });
    }

    // Platform-wide connection (community-agnostic pair).
    const connKey = `${a}:${b}`;
    const conn = connections.get(connKey);
    if (conn) {
      conn.lastInteractionAt = event.completedAt;
    } else {
      connections.set(connKey, {
        userAId: a,
        userBId: b,
        type: 'exchange',
        firstConnectedAt: event.completedAt,
        lastInteractionAt: event.completedAt,
      });
    }

    // Karma, milestones, community selection and the cap all come from the canonical policy —
    // Sprint 126 removed the fixture's own copies, which had drifted to snake_case reasons, a
    // 1/5/10/25 milestone schedule counted platform-wide, and an uncapped allocation across every
    // configured community regardless of where the request was actually posted.
    const eligible = event.eligibleCommunityIds ?? [event.communityId];
    const candidates: StandingCommunityCandidate[] = eligible
      .map(id => configByCommunity.get(id))
      .filter((c): c is CommunityProjectionConfig => c !== undefined)
      .map(c => ({
        community_id: c.community_id,
        karma_split_helper: c.karma_split_helper,
        karma_split_requestor: c.karma_split_requestor,
        priorHelperKarma: priorHelperKarma.get(`${event.helperId}:${c.community_id}`) ?? 0,
        helperHelpCountThroughAsOf:
          (priorHelperHelps.get(`${event.helperId}:${c.community_id}`) ?? 0) + 1,
      }));

    const plan = planCompletedMatchStanding(
      {
        matchId: event.key,
        requesterId: event.requesterId,
        helperId: event.helperId,
        requestType: event.requestType,
        occurredAt: event.completedAt,
        candidates,
      },
      config.basePool,
    );

    allocationsByMatch.push(plan.allocations);
    karmaRecords.push(...plan.rows);

    // Advance the as-of accumulators only now, so the next event sees this one as history.
    //
    // Accumulate for EVERY participant, not just this event's helper: a user who was the requester
    // here may be the helper of a later exchange, and their 'Received help' points count toward
    // priorHelperKarma there. The SQL projector's prior-karma LATERAL sums ALL canonical reasons for
    // the user, so restricting this to the helper is a fourth drift axis in the module whose whole
    // purpose is that there is only one definition.
    for (const row of plan.rows) {
      const accKey = `${row.userId}:${row.communityId}`;
      priorHelperKarma.set(accKey, (priorHelperKarma.get(accKey) ?? 0) + row.points);
      if (row.reason === COMPLETED_MATCH_REASONS.provided) {
        priorHelperHelps.set(accKey, (priorHelperHelps.get(accKey) ?? 0) + 1);
      }
    }
  }

  karmaRecords.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());


  return {
    trustEdges: [...edges.values()],
    connections: [...connections.values()],
    karmaRecords,
    allocationsByMatch,
  };
}
