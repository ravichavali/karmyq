/**
 * Sprint 126 (ADR-096) — the transactional completed-match standing projector.
 *
 * This is the ONE database adapter for the canonical policy in `@karmyq/shared`. Live event
 * delivery and historical operator replay both come through here, so a replayed match produces
 * exactly the rows the live path would have written at the time.
 *
 * Three properties it must hold, and how:
 *
 *  - **Atomic.** Every row for one match lands together or not at all, inside `withTransaction`.
 *    A partial projection is worse than none: the unique projection indexes would make the retry a
 *    no-op on the rows that already landed, so the match could never finish being awarded.
 *  - **Idempotent.** Writes are `ON CONFLICT DO NOTHING` against the projection identities, and a
 *    transaction-scoped advisory lock serialises concurrent delivery of the same match.
 *  - **As-of.** Community selection and milestone rank are functions of stored history as of this
 *    match, never of current table state. Replaying an old match must not see newer matches.
 *    `updateTrustScore` is the deliberate exception — that cache is supposed to reflect the present.
 */

import { query, withTransaction } from '../database/db';
import { recordActivity, ActivityType } from '../utils/activityTracker';
import { updateTrustScore } from './karmaService';
import {
  planCompletedMatchStanding,
  COMPLETED_MATCH_REASONS,
  DEFAULT_KARMA_POOL,
  type StandingCommunityCandidate,
} from '@karmyq/shared';

export interface CompletedMatchStandingInput {
  matchId: string;
  requestId: string;
  requesterId: string;
  helperId: string;
  requestType?: string;
  completedAt?: Date;
}

export interface StandingProjectionOptions {
  mode: 'live' | 'historical';
  /**
   * Live delivery may award in one request community when the membership intersection is empty
   * (a member left between the match and its completion). Historical replay must NOT: inventing a
   * community for an unattributable historical match is exactly the kind of fabrication this
   * sprint exists to avoid, so it fails closed and the preflight reports it as an anomaly.
   */
  allowRequestCommunityFallback?: boolean;
}

export interface StandingProjectionResult {
  matchId: string;
  communityIds: string[];
  insertedKarmaRows: number;
  insertedActivityRows: number;
}

/** The event payload shape the Bull subscriber delivers. */
export interface MatchCompletionData {
  match_id: string;
  request_id: string;
  requester_id: string;
  responder_id: string;
  request_type?: string;
  completed_at?: string | Date;
}

/** Reasons that count as canonical completed-match history for as-of aggregation. */
const CANONICAL_REASONS = Object.values(COMPLETED_MATCH_REASONS);

interface MatchFactsRow {
  request_id: string;
  requester_id: string;
  responder_id: string;
  status: string;
  completed_at: Date | null;
  request_type: string | null;
}

/**
 * Load the match's authoritative facts under a transaction-scoped advisory lock.
 *
 * The caller's claims about who participated are not trusted — an event payload is a message, and
 * the database is the record. Mismatches reject rather than project someone else's karma.
 */
async function loadMatchFacts(input: CompletedMatchStandingInput): Promise<MatchFactsRow> {
  // Serialises concurrent delivery of the SAME match without blocking any other match. Released
  // automatically at transaction end, so a crashed worker cannot strand it.
  await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [input.matchId]);

  const result = await query(
    `SELECT m.request_id, m.responder_id, m.status, m.completed_at,
            hr.requester_id, hr.request_type::text AS request_type
     FROM requests.matches m
     JOIN requests.help_requests hr ON hr.id = m.request_id
     WHERE m.id = $1`,
    [input.matchId]
  );

  const facts = result.rows[0] as MatchFactsRow | undefined;
  if (!facts) throw new Error(`Match not found: ${input.matchId}`);
  if (facts.status !== 'completed') {
    throw new Error(`Match ${input.matchId} is not completed (status: ${facts.status})`);
  }
  if (!facts.completed_at) {
    throw new Error(`Match ${input.matchId} is completed but has no completed_at`);
  }
  if (facts.request_id !== input.requestId) {
    throw new Error(`Match ${input.matchId} belongs to request ${facts.request_id}, not ${input.requestId}`);
  }
  if (facts.responder_id !== input.helperId) {
    throw new Error(`Match ${input.matchId} helper mismatch`);
  }
  if (facts.requester_id !== input.requesterId) {
    throw new Error(`Match ${input.matchId} requester mismatch`);
  }
  return facts;
}

/**
 * Communities where BOTH participants were active members and the request was posted, each carrying
 * its as-of aggregates.
 *
 * The two aggregates use the SAME strictly-before boundary, which is what makes them replay-stable:
 * the current match's own rows are never counted, so the answer does not change once they exist.
 * (Milestone rank is +1 on top — the rank this match earns is one past the history before it.)
 */
async function loadCandidates(
  input: CompletedMatchStandingInput,
  completedAt: Date
): Promise<StandingCommunityCandidate[]> {
  const result = await query(
    `SELECT rc.community_id,
            COALESCE(cc.karma_split_helper, 60)    AS karma_split_helper,
            COALESCE(cc.karma_split_requestor, 40) AS karma_split_requestor,
            cc.enabled_request_types               AS enabled_request_types,
            COALESCE(prior.total, 0)               AS prior_helper_karma,
            COALESCE(prior_helps.count, 0)         AS helper_helps_before
     FROM requests.request_communities rc
     JOIN communities.members cm_req ON cm_req.community_id = rc.community_id
       AND cm_req.user_id = $2 AND cm_req.status = 'active'
     JOIN communities.members cm_help ON cm_help.community_id = rc.community_id
       AND cm_help.user_id = $3 AND cm_help.status = 'active'
     LEFT JOIN communities.community_configs cc ON cc.community_id = rc.community_id
     LEFT JOIN LATERAL (
       SELECT SUM(kr.points) AS total
       FROM reputation.karma_records kr
       JOIN requests.matches src ON src.id = kr.related_entity_id
       WHERE kr.related_entity_id IS NOT NULL
         AND kr.user_id = $3 AND kr.community_id = rc.community_id
         AND kr.reason = ANY($4::text[])
         AND src.completed_at IS NOT NULL
         AND (src.completed_at < $5 OR (src.completed_at = $5 AND src.id < $6::uuid))
     ) prior ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS count
       FROM reputation.karma_records kr
       JOIN requests.matches src ON src.id = kr.related_entity_id
       WHERE kr.related_entity_id IS NOT NULL
         AND kr.user_id = $3 AND kr.community_id = rc.community_id
         AND kr.reason = $7
         AND src.completed_at IS NOT NULL
         AND (src.completed_at < $5 OR (src.completed_at = $5 AND src.id < $6::uuid))
     ) prior_helps ON TRUE
     WHERE rc.request_id = $1`,
    [
      input.requestId,
      input.requesterId,
      input.helperId,
      CANONICAL_REASONS,
      completedAt,
      input.matchId,
      COMPLETED_MATCH_REASONS.provided,
    ]
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    community_id: String(row.community_id),
    karma_split_helper: Number(row.karma_split_helper),
    karma_split_requestor: Number(row.karma_split_requestor),
    enabled_request_types: Array.isArray(row.enabled_request_types)
      ? (row.enabled_request_types as StandingCommunityCandidate['enabled_request_types'])
      : undefined,
    priorHelperKarma: Number(row.prior_helper_karma),
    helperHelpCountThroughAsOf: Number(row.helper_helps_before) + 1,
  }));
}

/**
 * The live-only fallback: one stable request community when the membership intersection is empty.
 * Ordered by id — the original bare `LIMIT 1` could pick a different community on each retry, which
 * under the projection indexes would award the same match twice in two different communities.
 *
 * It carries the SAME as-of aggregates as the normal path. Hardcoding rank 1 here (as this first
 * did) mints a "First help in community" bonus on every fallback award — including for a helper who
 * already has history in that community, because the projection identity is per-match and would
 * happily accept a second first-help row. That is a fabricated milestone, which is precisely what
 * this sprint exists to prevent.
 */
async function loadFallbackCandidate(
  input: CompletedMatchStandingInput,
  completedAt: Date
): Promise<StandingCommunityCandidate[]> {
  const result = await query(
    `SELECT rc.community_id,
            COALESCE(cc.karma_split_helper, 60)    AS karma_split_helper,
            COALESCE(cc.karma_split_requestor, 40) AS karma_split_requestor,
            cc.enabled_request_types               AS enabled_request_types,
            COALESCE(prior.total, 0)               AS prior_helper_karma,
            COALESCE(prior_helps.count, 0)         AS helper_helps_before
     FROM requests.request_communities rc
     LEFT JOIN communities.community_configs cc ON cc.community_id = rc.community_id
     LEFT JOIN LATERAL (
       SELECT SUM(kr.points) AS total
       FROM reputation.karma_records kr
       JOIN requests.matches src ON src.id = kr.related_entity_id
       WHERE kr.related_entity_id IS NOT NULL
         AND kr.user_id = $2 AND kr.community_id = rc.community_id
         AND kr.reason = ANY($3::text[])
         AND src.completed_at IS NOT NULL
         AND (src.completed_at < $4 OR (src.completed_at = $4 AND src.id < $5::uuid))
     ) prior ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS count
       FROM reputation.karma_records kr
       JOIN requests.matches src ON src.id = kr.related_entity_id
       WHERE kr.related_entity_id IS NOT NULL
         AND kr.user_id = $2 AND kr.community_id = rc.community_id
         AND kr.reason = $6
         AND src.completed_at IS NOT NULL
         AND (src.completed_at < $4 OR (src.completed_at = $4 AND src.id < $5::uuid))
     ) prior_helps ON TRUE
     WHERE rc.request_id = $1
     ORDER BY rc.community_id
     LIMIT 1`,
    [
      input.requestId,
      input.helperId,
      CANONICAL_REASONS,
      completedAt,
      input.matchId,
      COMPLETED_MATCH_REASONS.provided,
    ]
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    community_id: String(row.community_id),
    karma_split_helper: Number(row.karma_split_helper),
    karma_split_requestor: Number(row.karma_split_requestor),
    enabled_request_types: Array.isArray(row.enabled_request_types)
      ? (row.enabled_request_types as StandingCommunityCandidate['enabled_request_types'])
      : undefined,
    priorHelperKarma: Number(row.prior_helper_karma),
    helperHelpCountThroughAsOf: Number(row.helper_helps_before) + 1,
  }));
}

/**
 * Project one completed match's standing rows.
 *
 * Returns how many rows actually landed — 0 on both counts means the match was already projected,
 * which is a successful no-op, not a failure.
 */
export async function projectCompletedMatchStanding(
  input: CompletedMatchStandingInput,
  options: StandingProjectionOptions
): Promise<StandingProjectionResult> {
  if (!input.matchId || !input.requestId || !input.requesterId || !input.helperId) {
    throw new Error('projectCompletedMatchStanding requires matchId, requestId, requesterId and helperId');
  }

  return withTransaction(async () => {
    const facts = await loadMatchFacts(input);
    // Stored completion time is authoritative; a caller-supplied one is only a hint.
    const completedAt = facts.completed_at as Date;
    const requestType = input.requestType ?? facts.request_type ?? undefined;

    let candidates = await loadCandidates(input, completedAt);
    if (candidates.length === 0) {
      if (options.mode === 'historical' || !options.allowRequestCommunityFallback) {
        return { matchId: input.matchId, communityIds: [], insertedKarmaRows: 0, insertedActivityRows: 0 };
      }
      candidates = await loadFallbackCandidate(input, completedAt);
      if (candidates.length === 0) {
        throw new Error(`No communities found for request ${input.requestId}`);
      }
    }

    const plan = planCompletedMatchStanding(
      {
        matchId: input.matchId,
        requesterId: input.requesterId,
        helperId: input.helperId,
        requestType,
        occurredAt: completedAt,
        candidates,
      },
      DEFAULT_KARMA_POOL
    );

    let insertedKarmaRows = 0;
    for (const row of plan.rows) {
      const result = await query(
        `INSERT INTO reputation.karma_records
           (user_id, community_id, points, reason, related_entity_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [row.userId, row.communityId, row.points, row.reason, row.relatedEntityId, row.createdAt]
      );
      insertedKarmaRows += result.rowCount ?? 0;
    }

    let insertedActivityRows = 0;
    for (const communityId of plan.communityIds) {
      // required: true — a failed activity write must roll the whole match back rather than leave
      // karma without its decay-tracking counterpart.
      insertedActivityRows += await recordActivity(
        input.helperId, communityId, ActivityType.COMPLETE_REQUEST, input.matchId,
        { occurredAt: completedAt, required: true }
      );
      insertedActivityRows += await recordActivity(
        input.requesterId, communityId, ActivityType.COMPLETE_OFFER, input.matchId,
        { occurredAt: completedAt, required: true }
      );
    }

    // Present-state cache refresh, deliberately AFTER every as-of decision above.
    for (const communityId of plan.communityIds) {
      await updateTrustScore(input.helperId, communityId);
      await updateTrustScore(input.requesterId, communityId);
    }

    return {
      matchId: input.matchId,
      communityIds: plan.communityIds,
      insertedKarmaRows,
      insertedActivityRows,
    };
  });
}

/**
 * Compatibility wrapper for the Bull `match_completed` subscriber. The event payload shape is
 * unchanged; only the projection behind it is.
 */
export async function awardKarmaForCompletedMatch(
  data: MatchCompletionData
): Promise<StandingProjectionResult> {
  return projectCompletedMatchStanding(
    {
      matchId: data.match_id,
      requestId: data.request_id,
      requesterId: data.requester_id,
      helperId: data.responder_id,
      requestType: data.request_type,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
    },
    { mode: 'live', allowRequestCommunityFallback: true }
  );
}
