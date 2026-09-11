import { COMPLETED_MATCH_REASONS } from '@karmyq/shared';

/**
 * Pure preview metrics over a PROJECTED canonical karma state (Sprint 128, PR C).
 *
 * The backfill preflight used to derive its trust inputs from the replayed match list, which is a
 * different thing from the karma rows the writer will actually read. The visible symptom was a
 * membership with no LOCAL history scoring 0 in the report and 1 once the writer ran: breadth is
 * global, so activity in any other community still contributes, and the report was dropping it.
 *
 * These functions therefore reproduce the live writer's SQL, not the replay's membership map:
 *
 *   distinct_communities  GLOBAL. `WHERE user_id = $1` with no community and no match predicate
 *                         (`database/trustMetricsDb.ts:26-32`).
 *   recent_interactions   LOCAL row count for `user_id AND community_id` with
 *                         `created_at >= now - 365d`, multiplicity retained, no join
 *                         (`services/karmaService.ts:26-34`).
 *   distinct_people       `me` is filtered to the local community; `other` is NOT. The join is on
 *                         `related_entity_id`, so a NULL match identity never joins
 *                         (`database/trustMetricsDb.ts:36-47`).
 *   repeat_pairs          Same join, counterparties reached through >= 2 DISTINCT match ids
 *                         (`database/trustMetricsDb.ts:50-66`).
 *
 * ⚠️ All four SQL predicates name exactly ('Provided help', 'Received help'). That is NARROWER than
 * the backfill's `CANONICAL_REASONS`, which also contains the first-help and milestone reasons.
 * Reusing the wider set here would let a milestone row count as an interaction and act as a join
 * partner, inflating breadth and depth against a writer that ignores it.
 *
 * Build the index ONCE per projected dataset, then answer every membership from it:
 * `computePreviewMetrics` does map lookups plus a binary search, never a rescan of the rows.
 */

/** The karma-row shape both the stored snapshot and the planned projection can be expressed in. */
export interface PreviewKarmaRow {
  user_id: string;
  community_id: string;
  reason: string;
  related_entity_id: string | null;
  created_at: Date | string;
}

export interface PreviewMetrics {
  recentInteractions: number;
  repeatPairs: number;
  distinctPeople: number;
  distinctCommunities: number;
}

export interface PreviewPairEntry {
  /** Ascending, multiplicity retained — the writer COUNTs rows, it does not dedupe them. */
  readonly canonicalTimestamps: readonly number[];
  readonly repeatPairs: number;
  readonly distinctPeople: number;
}

export interface PreviewIndex {
  readonly byPair: ReadonlyMap<string, PreviewPairEntry>;
  readonly communitiesByUser: ReadonlyMap<string, number>;
}

/**
 * Exactly the two reasons the live metric SQL names.
 *
 * ⚠️ This derivation runs ONE way. It keeps the preview in step with the PROJECTOR, which writes
 * these reasons from the same constant — it does not protect the preview from the WRITER, whose
 * four SQL sites hardcode the literals `IN ('Provided help', 'Received help')`. Renaming
 * `COMPLETED_MATCH_REASONS.provided` would move the projector and this filter while leaving that
 * SQL matching a string nothing writes any more. See the scoped entry in `docs/gotchas/`.
 */
const INTERACTION_REASONS: ReadonlySet<string> = new Set<string>([
  COMPLETED_MATCH_REASONS.provided,
  COMPLETED_MATCH_REASONS.received,
]);

/** The writer's recency window (`karmaService.ts:23`). Exported so a test can prove they agree. */
export const RECENT_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

const pairKey = (userId: string, communityId: string): string => `${userId}|${communityId}`;

/** Get-or-create, so the four accumulator maps below do not each restate the same six lines. */
function addTo<T>(map: Map<string, Set<T>>, key: string, value: T): void {
  let set = map.get(key);
  if (!set) {
    set = new Set<T>();
    map.set(key, set);
  }
  set.add(value);
}

/** Index of the first element >= target in an ascending array. */
function lowerBound(sorted: readonly number[], target: number): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (sorted[mid] < target) low = mid + 1;
    else high = mid;
  }
  return low;
}

/**
 * Materialize every metric input from a projected karma row set.
 *
 * Nothing here retains the input array: after this returns, the rows may be discarded or revoked.
 */
export function buildPreviewIndex(rows: readonly PreviewKarmaRow[]): PreviewIndex {
  const communitiesByUserSet = new Map<string, Set<string>>();
  /** user|community -> that membership's own user id, local timestamps, and local match ids (`me`). */
  const localByPair = new Map<string, { userId: string; timestamps: number[]; matchIds: Set<string> }>();
  /** match id -> every user with an interaction row for it, in ANY community (`other` is unfiltered). */
  const usersByMatch = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!INTERACTION_REASONS.has(row.reason)) continue;

    const userId = String(row.user_id);
    const communityId = String(row.community_id);
    const key = pairKey(userId, communityId);

    addTo(communitiesByUserSet, userId, communityId);

    let local = localByPair.get(key);
    if (!local) {
      local = { userId, timestamps: [], matchIds: new Set<string>() };
      localByPair.set(key, local);
    }
    local.timestamps.push(new Date(row.created_at).getTime());

    // NULL match identity: `other.related_entity_id = me.related_entity_id` is never true for NULL,
    // so such a row participates in neither side of the counterparty join.
    if (row.related_entity_id != null) {
      const matchId = String(row.related_entity_id);
      addTo(usersByMatch, matchId, userId);
      local.matchIds.add(matchId);
    }
  }

  const byPair = new Map<string, PreviewPairEntry>();

  for (const [key, { userId, timestamps, matchIds }] of localByPair) {
    timestamps.sort((a, b) => a - b);

    // counterparty -> how many DISTINCT match ids link them to me in this community, which is the
    // SQL's COUNT(DISTINCT me.related_entity_id). `matchIds` and `participants` are both Sets, so
    // each (counterparty, match) pair is visited exactly once and a plain counter is exact.
    //
    // Cost note: this is Σ over my matches of their participant count. For a real match that is 2,
    // so the whole build stays linear in interaction rows. It is NOT structurally capped at 2 the
    // way the old replay-derived version was — a normalized legacy row can carry a related_entity_id
    // that is a request id rather than a match id, and every helper on that request then shares it.
    // Bounded by real data, and it is exactly the fan-out the live SQL join computes.
    const matchCountByCounterpart = new Map<string, number>();
    for (const matchId of matchIds) {
      const participants = usersByMatch.get(matchId);
      if (!participants) continue;
      for (const other of participants) {
        if (other === userId) continue;
        matchCountByCounterpart.set(other, (matchCountByCounterpart.get(other) ?? 0) + 1);
      }
    }

    let repeatPairs = 0;
    for (const count of matchCountByCounterpart.values()) {
      if (count >= 2) repeatPairs += 1;
    }

    byPair.set(key, {
      canonicalTimestamps: timestamps,
      repeatPairs,
      distinctPeople: matchCountByCounterpart.size,
    });
  }

  const communitiesByUser = new Map<string, number>();
  for (const [userId, communities] of communitiesByUserSet) {
    communitiesByUser.set(userId, communities.size);
  }

  return { byPair, communitiesByUser };
}

/**
 * Metrics for one membership at one instant.
 *
 * Breadth is read from `communitiesByUser` independently of whether the membership has any local
 * history — that independence IS the fix. A membership with no local rows still carries the user's
 * global community count, exactly as `SELECT COUNT(DISTINCT community_id) ... WHERE user_id = $1`
 * does, so it scores 1 rather than 0 under the default 0.4 breadth weight.
 */
export function computePreviewMetrics(
  index: PreviewIndex,
  userId: string,
  communityId: string,
  nowMs: number,
): PreviewMetrics {
  const entry = index.byPair.get(pairKey(userId, communityId));
  const distinctCommunities = index.communitiesByUser.get(userId) ?? 0;

  if (!entry) {
    return { recentInteractions: 0, repeatPairs: 0, distinctPeople: 0, distinctCommunities };
  }

  const boundary = nowMs - RECENT_WINDOW_MS;
  const timestamps = entry.canonicalTimestamps;
  // `created_at >= $3` is inclusive, so the boundary instant itself counts.
  const recentInteractions = timestamps.length - lowerBound(timestamps, boundary);

  return {
    recentInteractions,
    repeatPairs: entry.repeatPairs,
    distinctPeople: entry.distinctPeople,
    distinctCommunities,
  };
}
