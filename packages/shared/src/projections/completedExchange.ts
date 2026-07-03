/**
 * Sprint 117 — Fixture-only completed-exchange projection.
 *
 * Demo history declares completed exchanges, never raw trust edges or exact scores. These pure,
 * timestamp-aware rules rebuild the trust/connection/karma projection from that history in
 * chronological order, so aging, stability, and karma emerge from the same arithmetic the live
 * platform uses. A cross-workspace equivalence test locks `rawWeight` to production
 * `computeRawWeight` and `allocationsByMatch` to production `allocateKarma` for completed-only
 * input. This module is fixture-only: it is never imported by a live event handler and never
 * changes production reputation behaviour.
 */

export interface CompletedExchangeEvent {
  key: string;
  requesterId: string;
  helperId: string;
  communityId: string;
  completedAt: Date;
  requestType: string;
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

export interface ProjectedKarmaRecord {
  userId: string;
  communityId: string;
  points: number;
  reason: string;
  relatedEntityId: string;
  createdAt: Date;
}

export interface CommunityAllocation {
  community_id: string;
  helperPoints: number;
  requesterPoints: number;
}

export interface CompletedExchangeProjection {
  trustEdges: ProjectedTrustEdge[];
  connections: ProjectedConnection[];
  karmaRecords: ProjectedKarmaRecord[];
  allocationsByMatch: CommunityAllocation[][];
}

/** Helper-side cumulative milestones (completed-help count → bonus points). */
const HELP_MILESTONES: ReadonlyArray<{ count: number; points: number; reason: string }> = [
  { count: 1, points: 15, reason: 'first_help_bonus' },
  { count: 5, points: 25, reason: 'milestone_help_5' },
  { count: 10, points: 50, reason: 'milestone_help_10' },
  { count: 25, points: 100, reason: 'milestone_help_25' },
];

function normalizePair(userA: string, userB: string): { a: string; b: string } {
  return userA < userB ? { a: userA, b: userB } : { a: userB, b: userA };
}

/**
 * Fixture copy of production `allocateKarma` (ADR-032). Divides a fixed pool equally across the
 * shared communities, applies each community's helper/requester split, and uses largest-remainder
 * rounding so integer awards sum exactly to the pool. Held identical to production by the
 * equivalence test — change both together.
 */
function allocateKarmaFixture(
  configs: CommunityProjectionConfig[],
  totalPool: number,
): CommunityAllocation[] {
  if (configs.length === 0) return [];
  const basePoolPerCommunity = totalPool / configs.length;

  const exact = configs.map(config => ({
    community_id: config.community_id,
    helperExact: basePoolPerCommunity * (config.karma_split_helper / 100),
    requesterExact: basePoolPerCommunity * (config.karma_split_requestor / 100),
  }));

  type RoundEntry = { community_id: string; role: 'helper' | 'requester'; floored: number; remainder: number };
  const entries: RoundEntry[] = exact.flatMap(e => [
    { community_id: e.community_id, role: 'helper' as const, floored: Math.floor(e.helperExact), remainder: e.helperExact - Math.floor(e.helperExact) },
    { community_id: e.community_id, role: 'requester' as const, floored: Math.floor(e.requesterExact), remainder: e.requesterExact - Math.floor(e.requesterExact) },
  ]);

  const adjustedTotal = exact.reduce((sum, e) => sum + e.helperExact + e.requesterExact, 0);
  const totalFloored = entries.reduce((sum, e) => sum + e.floored, 0);
  let remainder = Math.round(adjustedTotal - totalFloored);

  entries.sort((a, b) => b.remainder - a.remainder);
  const awarded = new Map<string, number>();
  for (const entry of entries) {
    awarded.set(`${entry.community_id}:${entry.role}`, entry.floored + (remainder > 0 ? 1 : 0));
    if (remainder > 0) remainder--;
  }

  return configs.map(config => ({
    community_id: config.community_id,
    helperPoints: awarded.get(`${config.community_id}:helper`) ?? 0,
    requesterPoints: awarded.get(`${config.community_id}:requester`) ?? 0,
  }));
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
  const ordered = [...events].sort(
    (a, b) => a.completedAt.getTime() - b.completedAt.getTime() || a.key.localeCompare(b.key),
  );

  const weightByCommunity = new Map(config.communityConfigs.map(c => [c.community_id, c.matchCompletedWeight]));
  const edges = new Map<string, ProjectedTrustEdge>();
  const connections = new Map<string, ProjectedConnection>();
  const karmaRecords: ProjectedKarmaRecord[] = [];
  const allocationsByMatch: CommunityAllocation[][] = [];
  const helperCompletedCount = new Map<string, number>();

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

    // Karma allocation across shared communities (identical to production allocateKarma).
    const allocations = allocateKarmaFixture(config.communityConfigs, config.basePool);
    allocationsByMatch.push(allocations);
    for (const allocation of allocations) {
      karmaRecords.push({
        userId: event.helperId,
        communityId: allocation.community_id,
        points: allocation.helperPoints,
        reason: 'help_provided',
        relatedEntityId: event.key,
        createdAt: event.completedAt,
      });
      karmaRecords.push({
        userId: event.requesterId,
        communityId: allocation.community_id,
        points: allocation.requesterPoints,
        reason: 'help_received',
        relatedEntityId: event.key,
        createdAt: event.completedAt,
      });
    }

    // Helper-side cumulative milestone bonuses, awarded in the exchange's community.
    const nextCount = (helperCompletedCount.get(event.helperId) ?? 0) + 1;
    helperCompletedCount.set(event.helperId, nextCount);
    const milestone = HELP_MILESTONES.find(m => m.count === nextCount);
    if (milestone) {
      karmaRecords.push({
        userId: event.helperId,
        communityId: event.communityId,
        points: milestone.points,
        reason: milestone.reason,
        relatedEntityId: event.key,
        createdAt: event.completedAt,
      });
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
