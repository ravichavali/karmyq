/**
 * Sprint 126 (ADR-096) — the canonical completed-match standing policy.
 *
 * ONE definition of what a completed match does to standing, shared by live event delivery, the
 * curated fixture projection, and historical operator replay. Before this module those three
 * disagreed on four axes — reason labels, milestone schedule, milestone scope, and community
 * selection — so the curated demo looked populated in storage while being invisible to the trust
 * calculator, which only recognises the production vocabulary.
 *
 * Everything here is PURE: no database, no clock, no I/O. Callers supply the facts as of the match
 * being projected, and the same facts always produce the same plan. That is what makes replay
 * safe — an adapter can hand this function historical facts and get exactly the rows the live path
 * would have written at the time.
 *
 * ⚠️ Every predicate is as-of. Community selection and milestone rank are functions of stored
 * history as of the match plus the match itself — never of current table state. Reading "now" here
 * would make a replay's output depend on when it happened to run.
 */

export interface RequestTypeConfig {
  name: string;
  karma_multiplier?: number;
}

export interface CommunityKarmaConfig {
  community_id: string;
  karma_split_helper: number; // Percentage to the helper, e.g. 60
  karma_split_requestor: number; // Percentage to the requester, e.g. 40
  enabled_request_types?: RequestTypeConfig[];
}

export interface CommunityAllocation {
  community_id: string;
  helperPoints: number;
  requesterPoints: number;
}

/** Total ordering key for replay. Two matches never share one. */
export interface ReplayKey {
  completedAt: Date;
  matchId: string;
}

export interface StandingCommunityCandidate extends CommunityKarmaConfig {
  /**
   * The helper's canonical karma in this community from matches STRICTLY BEFORE the replay key.
   * Strictly-before, because including the current match would let a community's own award decide
   * whether that community was selected.
   */
  priorHelperKarma: number;
  /**
   * The helper's canonical 'Provided help' count in this community THROUGH the replay key —
   * inclusive of the match being projected, so the first exchange is 1. Milestone rank is inclusive
   * because the milestone is earned *by* this match.
   */
  helperHelpCountThroughAsOf: number;
}

export interface CompletedMatchStandingFacts {
  matchId: string;
  requesterId: string;
  helperId: string;
  requestType?: string;
  /** The match's real completion time. Historical rows must never be stamped with `NOW()`. */
  occurredAt: Date;
  candidates: StandingCommunityCandidate[];
}

export interface PlannedStandingKarmaRow {
  userId: string;
  communityId: string;
  points: number;
  reason: CompletedMatchReason;
  relatedEntityId: string;
  createdAt: Date;
}

export interface CompletedMatchStandingPlan {
  replayKey: ReplayKey;
  communityIds: string[];
  allocations: CommunityAllocation[];
  rows: PlannedStandingKarmaRow[];
}

/**
 * The canonical reason vocabulary. These exact strings are what the ADR-037 trust calculator reads
 * (`karmaService.updateTrustScore` counts `reason = 'Provided help'` / `'Received help'`), so they
 * are a data contract, not labels. The curated fixture's snake_case variants were invisible to it.
 */
export const COMPLETED_MATCH_REASONS = {
  provided: 'Provided help',
  received: 'Received help',
  first: 'First help in community',
  milestone10: '10 exchanges milestone',
  milestone50: '50 exchanges milestone',
  milestone100: '100 exchanges milestone',
} as const;

export type CompletedMatchReason =
  (typeof COMPLETED_MATCH_REASONS)[keyof typeof COMPLETED_MATCH_REASONS];

/**
 * Helper-side milestones, keyed by the helper's inclusive help count in ONE community.
 * At most one applies to any given match because the counts are distinct.
 */
export const COMPLETED_MATCH_MILESTONES: ReadonlyArray<{
  count: number;
  points: number;
  reason: CompletedMatchReason;
}> = [
  { count: 1, points: 15, reason: COMPLETED_MATCH_REASONS.first },
  { count: 10, points: 25, reason: COMPLETED_MATCH_REASONS.milestone10 },
  { count: 50, points: 50, reason: COMPLETED_MATCH_REASONS.milestone50 },
  { count: 100, points: 100, reason: COMPLETED_MATCH_REASONS.milestone100 },
];

/** Milestones indexed by count, so a lookup is O(1) rather than a rescan per community. */
const MILESTONE_BY_COUNT = new Map(COMPLETED_MATCH_MILESTONES.map((m) => [m.count, m]));

/** Karma is awarded in at most this many communities per match, to prevent inflation (ADR-031). */
export const MAX_COMMUNITIES_PER_KARMA_AWARD = 3;

/**
 * The fixed pool split across selected communities for one match (ADR-032).
 *
 * ⚠️ Known gap, pre-dating Sprint 126 and deliberately not changed by it: communities can set
 * `communities.community_configs.base_karma_pool_per_request` (admin-editable, CHECK BETWEEN 10 AND
 * 1000), and `karmaService` reads it — but the allocation has always been called with this flat
 * constant, so a community's configured pool is silently ignored. `totalPool` is a single scalar,
 * so this module cannot express a per-community pool either. Sprint 126 moves the behaviour without
 * changing it; closing the gap needs its own change.
 */
export const DEFAULT_KARMA_POOL = 100;

/** Code-unit ordering for ids. Deliberately NOT `localeCompare`, whose collation is locale- and
 * ICU-dependent — two tie-breaks that disagree would make replay order environment-sensitive. */
function compareIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Total order over replay keys: completion time, then match id.
 *
 * The id tie-break is not cosmetic. First-help and milestone outcomes depend on chronological rank,
 * so two matches sharing a completion timestamp must replay in a fixed order or the same history
 * could produce different bonuses on different runs.
 */
export function compareReplayKeys(left: ReplayKey, right: ReplayKey): number {
  return left.completedAt.getTime() - right.completedAt.getTime() || compareIds(left.matchId, right.matchId);
}

/**
 * The two as-of boundary rules, exported so every adapter shares ONE definition of them.
 *
 * `priorHelperKarma` is derived from history STRICTLY BEFORE the match; `helperHelpCountThroughAsOf`
 * counts history THROUGH it. Those are different predicates, and Sprint 126 derives them in two
 * places — SQL for live/historical replay, TypeScript for the curated fixture. No pure test can
 * compare a SQL derivation against a TS one, so the predicate itself must be canonical even where
 * the aggregation cannot be: use these as the oracle rather than restating the comparison.
 */
export function isStrictlyBefore(key: ReplayKey, asOf: ReplayKey): boolean {
  return compareReplayKeys(key, asOf) < 0;
}

export function isThrough(key: ReplayKey, asOf: ReplayKey): boolean {
  return compareReplayKeys(key, asOf) <= 0;
}

/**
 * Choose which communities a match awards karma in: the helper's most-invested communities first,
 * capped. Ties break on community id so selection is deterministic rather than
 * insertion-order-dependent.
 */
export function selectStandingCommunities(
  candidates: readonly StandingCommunityCandidate[],
  limit: number = MAX_COMMUNITIES_PER_KARMA_AWARD,
): StandingCommunityCandidate[] {
  // Copied before sorting: callers keep their array order (several build it once and reuse it).
  return [...candidates]
    .sort((a, b) => b.priorHelperKarma - a.priorHelperKarma || compareIds(a.community_id, b.community_id))
    .slice(0, limit);
}

function getRequestTypeMultiplier(config: CommunityKarmaConfig, requestType?: string): number {
  if (!requestType || !config.enabled_request_types?.length) return 1.0;
  const entry = config.enabled_request_types.find((t) => t.name === requestType);
  return entry?.karma_multiplier ?? 1.0;
}

/**
 * Allocate one fixed karma pool across the selected communities (ADR-032).
 *
 * The pool is divided equally, each community's split ratio decides the helper/requester share, and
 * largest-remainder rounding guarantees the integer awards sum EXACTLY to the pool — so being in
 * three communities never awards more total karma than being in one.
 *
 * This is the single implementation; `reputation-service/karmaAllocation.ts` re-exports it under
 * its historical `allocateKarma` name so existing importers keep working.
 */
export function allocateCompletedMatchKarma(
  configs: readonly CommunityKarmaConfig[],
  totalPool: number,
  requestType?: string,
): CommunityAllocation[] {
  if (configs.length === 0) return [];

  const basePoolPerCommunity = totalPool / configs.length;

  const exact = configs.map((config) => {
    const poolPerCommunity = basePoolPerCommunity * getRequestTypeMultiplier(config, requestType);
    return {
      community_id: config.community_id,
      helperExact: poolPerCommunity * (config.karma_split_helper / 100),
      requesterExact: poolPerCommunity * (config.karma_split_requestor / 100),
    };
  });

  type RoundEntry = {
    community_id: string;
    role: 'helper' | 'requester';
    floored: number;
    remainder: number;
  };

  const entries: RoundEntry[] = exact.flatMap((e) => [
    {
      community_id: e.community_id,
      role: 'helper' as const,
      floored: Math.floor(e.helperExact),
      remainder: e.helperExact - Math.floor(e.helperExact),
    },
    {
      community_id: e.community_id,
      role: 'requester' as const,
      floored: Math.floor(e.requesterExact),
      remainder: e.requesterExact - Math.floor(e.requesterExact),
    },
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

  return configs.map((config) => ({
    community_id: config.community_id,
    helperPoints: awarded.get(`${config.community_id}:helper`) ?? 0,
    requesterPoints: awarded.get(`${config.community_id}:requester`) ?? 0,
  }));
}

/**
 * Plan every standing row one completed match produces.
 *
 * Row order per community mirrors the live path: the helper's award, the requester's award, then
 * at most one helper milestone bonus.
 */
export function planCompletedMatchStanding(
  facts: CompletedMatchStandingFacts,
  totalPool: number = DEFAULT_KARMA_POOL,
): CompletedMatchStandingPlan {
  const selected = selectStandingCommunities(facts.candidates);
  // `allocateCompletedMatchKarma` ends in `configs.map(...)`, so allocations[i] is the allocation
  // for selected[i]. Looking the community back up by id would re-derive a correspondence that is
  // already index-exact — and would silently drop a milestone if the ids ever failed to match.
  const allocations = allocateCompletedMatchKarma(selected, totalPool, facts.requestType);

  const rows: PlannedStandingKarmaRow[] = [];
  for (const [index, allocation] of allocations.entries()) {
    const base = {
      communityId: allocation.community_id,
      relatedEntityId: facts.matchId,
      createdAt: facts.occurredAt,
    };

    rows.push({
      ...base,
      userId: facts.helperId,
      points: allocation.helperPoints,
      reason: COMPLETED_MATCH_REASONS.provided,
    });
    rows.push({
      ...base,
      userId: facts.requesterId,
      points: allocation.requesterPoints,
      reason: COMPLETED_MATCH_REASONS.received,
    });

    const milestone = MILESTONE_BY_COUNT.get(selected[index].helperHelpCountThroughAsOf);
    if (milestone) {
      rows.push({
        ...base,
        userId: facts.helperId,
        points: milestone.points,
        reason: milestone.reason,
      });
    }
  }

  return {
    replayKey: { completedAt: facts.occurredAt, matchId: facts.matchId },
    communityIds: selected.map((c) => c.community_id),
    allocations,
    rows,
  };
}
