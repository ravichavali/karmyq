import {
  COMPLETED_MATCH_REASONS,
  DEFAULT_KARMA_POOL,
  compareReplayKeys,
  planCompletedMatchStanding,
  type CommunityKarmaConfig,
  type PlannedStandingKarmaRow,
  type StandingCommunityCandidate,
} from '@karmyq/shared';
import { query, withTransaction } from '../database/db';
import {
  calculateWeightedAvgFeedback,
  type WeightedFeedbackRow,
} from '../database/feedbackDb';
import { TRUST_CONFIG_DEFAULTS } from '../database/trustConfigDb';
import { computeTrustScore } from './trustScoreStrategy';
import { updateTrustScore } from './karmaService';
import { projectCompletedMatchStanding } from './standingProjector';

type ScoreBucket = '0' | '1-19' | '20-39' | '40-59' | '60-79' | '80-100';
type InteractionBucket = '0' | '1' | '2-3' | '4+';
type ProviderFloor = '1' | '20' | '40' | '60';

export interface StandingBackfillAnomaly {
  code: string;
  matchId?: string;
  detail: string;
}

export interface StandingBackfillReport {
  canApply: boolean;
  completedMatches: number;
  eligibleMatches: number;
  alreadyProjectedMatches: number;
  anomalies: StandingBackfillAnomaly[];
  activeMembershipPairs: number;
  sourcedPairs: number;
  zeroHistoryPairs: number;
  legacy: { attributableRows: number; unattributableRows: number; exactDuplicates: number };
  predicted: { karmaRows: number; activityRows: number; trustRowsEvaluated: number };
  scoreBuckets: Record<ScoreBucket, number>;
  interactionDepthBuckets: Record<InteractionBucket, number>;
  interactionBreadthBuckets: Record<InteractionBucket, number>;
  providerEligibility: Record<ProviderFloor, number>;
}

export interface StandingBackfillProgress {
  completedBatches: number;
  completedMatches: number;
  lastCommittedMatchId: string;
}

export interface StandingBackfillApplyOptions {
  batchSize?: number;
  onProgress?: (progress: StandingBackfillProgress) => void;
}

interface MatchRow {
  id: string;
  request_id: string | null;
  requester_id: string | null;
  responder_id: string | null;
  status: string;
  completed_at: Date | string | null;
  request_type: string | null;
  request_community_ids: string[] | null;
  eligible_community_ids: string[] | null;
}

interface CommunityConfigRow extends CommunityKarmaConfig {
  trust_depth_weight: number | string | null;
  trust_breadth_weight: number | string | null;
  trust_feedback_threshold: number | string | null;
  min_interactions_for_trust: number | string | null;
  trust_negative_allowed: boolean | null;
}

interface KarmaRow {
  id: string;
  user_id: string;
  community_id: string;
  points: number | string;
  reason: string;
  related_entity_id: string | null;
  created_at: Date | string;
}

interface ActivityRow {
  user_id: string;
  community_id: string;
  activity_type: string;
  related_entity_id: string | null;
  created_at: Date | string;
}

interface MembershipRow { user_id: string; community_id: string }
interface UserConfigRow {
  user_id: string;
  community_id: string;
  depth_weight: number | string | null;
  breadth_weight: number | string | null;
}
interface ProviderRow { provider_id: string; user_id: string; community_id: string }

interface BackfillSnapshot {
  matches: MatchRow[];
  configs: CommunityConfigRow[];
  karma: KarmaRow[];
  activities: ActivityRow[];
  memberships: MembershipRow[];
  feedback: Array<WeightedFeedbackRow & { to_user_id: string }>;
  userConfigs: UserConfigRow[];
  providers: ProviderRow[];
}

interface ReplayMatch {
  row: MatchRow;
  completedAt: Date;
  communityIds: string[];
  rows: PlannedStandingKarmaRow[];
}

const LEGACY_REASONS = new Set([
  'help_provided',
  'help_received',
  'first_help_bonus',
  'milestone_help_5',
  'milestone_help_10',
  'milestone_help_25',
]);
const CANONICAL_REASONS = new Set<string>(Object.values(COMPLETED_MATCH_REASONS));
const MATCHES_QUERY = `/* standing-backfill:matches */
  SELECT m.id, m.request_id, hr.requester_id, m.responder_id, m.status, m.completed_at,
         hr.request_type::text AS request_type,
         COALESCE(
           ARRAY_AGG(DISTINCT rc.community_id::text)
             FILTER (WHERE rc.community_id IS NOT NULL), ARRAY[]::text[]
         ) AS request_community_ids,
         COALESCE(
           ARRAY_AGG(DISTINCT rc.community_id::text)
             FILTER (WHERE req_member.user_id IS NOT NULL AND helper_member.user_id IS NOT NULL),
           ARRAY[]::text[]
         ) AS eligible_community_ids
  FROM requests.matches m
  LEFT JOIN requests.help_requests hr ON hr.id = m.request_id
  LEFT JOIN requests.request_communities rc ON rc.request_id = m.request_id
  LEFT JOIN communities.members req_member
    ON req_member.community_id = rc.community_id
   AND req_member.user_id = hr.requester_id AND req_member.status = 'active'
  LEFT JOIN communities.members helper_member
    ON helper_member.community_id = rc.community_id
   AND helper_member.user_id = m.responder_id AND helper_member.status = 'active'
  WHERE m.status = 'completed'
  GROUP BY m.id, m.request_id, hr.requester_id, m.responder_id, m.status, m.completed_at,
           hr.request_type
  ORDER BY m.completed_at NULLS LAST, m.id`;

const COMMUNITY_CONFIGS_QUERY = `/* standing-backfill:community-configs */
  SELECT community_id, karma_split_helper, karma_split_requestor,
         enabled_request_types,
         trust_depth_weight, trust_breadth_weight, trust_feedback_threshold,
         min_interactions_for_trust, trust_negative_allowed
  FROM communities.community_configs`;

const KARMA_QUERY = `/* standing-backfill:karma */
  SELECT id, user_id, community_id, points, reason, related_entity_id, created_at
  FROM reputation.karma_records
  ORDER BY created_at, id`;

const ACTIVITY_QUERY = `/* standing-backfill:activity */
  SELECT user_id, community_id, activity_type, related_entity_id, created_at
  FROM reputation.activity_log
  WHERE related_entity_id IS NOT NULL
  ORDER BY created_at, id`;

const MEMBERSHIPS_QUERY = `/* standing-backfill:memberships */
  SELECT user_id, community_id
  FROM communities.members
  WHERE status = 'active'
  ORDER BY community_id, user_id`;

const FEEDBACK_QUERY = `/* standing-backfill:feedback */
  SELECT to_user_id, community_id, rating, created_at
  FROM feedback.feedback
  ORDER BY to_user_id, created_at`;

const USER_CONFIGS_QUERY = `/* standing-backfill:user-configs */
  SELECT user_id, community_id, depth_weight, breadth_weight
  FROM reputation.user_trust_configs`;

const PROVIDERS_QUERY = `/* standing-backfill:providers */
  SELECT pp.id AS provider_id, pp.user_id, member.community_id
  FROM requests.provider_profiles pp
  JOIN communities.members member
    ON member.user_id = pp.user_id AND member.status = 'active'
  JOIN communities.community_configs config
    ON config.community_id = member.community_id
  WHERE pp.is_active = TRUE
    AND config.provider_services_enabled = TRUE
    AND (cardinality(config.provider_services_list) = 0
         OR pp.service_type = ANY(config.provider_services_list))
  ORDER BY member.community_id, pp.id`;

async function loadSnapshot(): Promise<BackfillSnapshot> {
  const [matches, configs, karma, activities, memberships, feedback, userConfigs, providers] =
    await Promise.all([
      query(MATCHES_QUERY),
      query(COMMUNITY_CONFIGS_QUERY),
      query(KARMA_QUERY),
      query(ACTIVITY_QUERY),
      query(MEMBERSHIPS_QUERY),
      query(FEEDBACK_QUERY),
      query(USER_CONFIGS_QUERY),
      query(PROVIDERS_QUERY),
    ]);

  return {
    matches: matches.rows as MatchRow[],
    configs: configs.rows as CommunityConfigRow[],
    karma: karma.rows as KarmaRow[],
    activities: activities.rows as ActivityRow[],
    memberships: memberships.rows as MembershipRow[],
    feedback: feedback.rows as BackfillSnapshot['feedback'],
    userConfigs: userConfigs.rows as UserConfigRow[],
    providers: providers.rows as ProviderRow[],
  };
}

function stringArray(value: string[] | null): string[] {
  return Array.isArray(value) ? value.map(String).sort() : [];
}

function sameInstant(left: Date | string, right: Date | string): boolean {
  return new Date(left).getTime() === new Date(right).getTime();
}

function karmaIdentity(row: Pick<KarmaRow, 'user_id' | 'community_id' | 'reason' | 'related_entity_id'>): string {
  return [row.user_id, row.community_id, row.reason, row.related_entity_id ?? ''].join('|');
}

function plannedKarmaIdentity(row: PlannedStandingKarmaRow): string {
  return [row.userId, row.communityId, row.reason, row.relatedEntityId].join('|');
}

function activityIdentity(row: Pick<ActivityRow, 'user_id' | 'community_id' | 'activity_type' | 'related_entity_id'>): string {
  return [row.user_id, row.community_id, row.activity_type, row.related_entity_id ?? ''].join('|');
}

function expectedActivityRows(replay: ReplayMatch): ActivityRow[] {
  const rows: ActivityRow[] = [];
  for (const communityId of replay.communityIds) {
    rows.push({
      user_id: String(replay.row.responder_id),
      community_id: communityId,
      activity_type: 'complete_request',
      related_entity_id: replay.row.id,
      created_at: replay.completedAt,
    });
    rows.push({
      user_id: String(replay.row.requester_id),
      community_id: communityId,
      activity_type: 'complete_offer',
      related_entity_id: replay.row.id,
      created_at: replay.completedAt,
    });
  }
  return rows;
}

function defaultConfig(communityId: string): CommunityConfigRow {
  return {
    community_id: communityId,
    karma_split_helper: 60,
    karma_split_requestor: 40,
    enabled_request_types: undefined,
    trust_depth_weight: TRUST_CONFIG_DEFAULTS.depth_weight,
    trust_breadth_weight: TRUST_CONFIG_DEFAULTS.breadth_weight,
    trust_feedback_threshold: TRUST_CONFIG_DEFAULTS.feedback_threshold,
    min_interactions_for_trust: TRUST_CONFIG_DEFAULTS.min_interactions_for_bonus,
    trust_negative_allowed: TRUST_CONFIG_DEFAULTS.negative_allowed,
  };
}

function replayMatches(
  snapshot: BackfillSnapshot,
  anomalies: StandingBackfillAnomaly[],
): ReplayMatch[] {
  const configs = new Map(snapshot.configs.map((config) => [String(config.community_id), config]));
  const canonicalLedger: PlannedStandingKarmaRow[] = [];
  const replayed: ReplayMatch[] = [];
  const ordered = [...snapshot.matches].sort((left, right) => {
    if (!left.completed_at) return right.completed_at ? 1 : String(left.id).localeCompare(String(right.id));
    if (!right.completed_at) return -1;
    return compareReplayKeys(
      { completedAt: new Date(left.completed_at), matchId: String(left.id) },
      { completedAt: new Date(right.completed_at), matchId: String(right.id) },
    );
  });

  for (const row of ordered) {
    const matchId = String(row.id);
    if (!row.request_id || !row.requester_id || !row.responder_id) {
      anomalies.push({
        code: 'MISSING_MATCH_PARTICIPANTS',
        matchId,
        detail: 'Completed match is missing its request, requester, or helper',
      });
      continue;
    }
    if (!row.completed_at) {
      anomalies.push({
        code: 'MISSING_COMPLETION_TIME',
        matchId,
        detail: 'Completed match has no completed_at timestamp',
      });
      continue;
    }

    const requestCommunities = stringArray(row.request_community_ids);
    if (requestCommunities.length === 0) {
      anomalies.push({
        code: 'NO_REQUEST_COMMUNITY',
        matchId,
        detail: 'Completed match request is not posted to any community',
      });
      continue;
    }
    const eligibleCommunities = stringArray(row.eligible_community_ids);
    if (eligibleCommunities.length === 0) {
      anomalies.push({
        code: 'NO_ELIGIBLE_COMMUNITY',
        matchId,
        detail: 'Completed match has no active shared request community',
      });
      continue;
    }

    const completedAt = new Date(row.completed_at);
    const candidates: StandingCommunityCandidate[] = eligibleCommunities.map((communityId) => {
      const config = configs.get(communityId) ?? defaultConfig(communityId);
      const priorRows = canonicalLedger.filter(
        (record) => record.userId === row.responder_id && record.communityId === communityId,
      );
      return {
        community_id: communityId,
        karma_split_helper: Number(config.karma_split_helper),
        karma_split_requestor: Number(config.karma_split_requestor),
        enabled_request_types: Array.isArray(config.enabled_request_types)
          ? config.enabled_request_types
          : undefined,
        priorHelperKarma: priorRows.reduce((sum, record) => sum + record.points, 0),
        helperHelpCountThroughAsOf:
          priorRows.filter((record) => record.reason === COMPLETED_MATCH_REASONS.provided).length + 1,
      };
    });

    const plan = planCompletedMatchStanding({
      matchId,
      requesterId: row.requester_id,
      helperId: row.responder_id,
      requestType: row.request_type ?? undefined,
      occurredAt: completedAt,
      candidates,
    }, DEFAULT_KARMA_POOL);
    canonicalLedger.push(...plan.rows);
    replayed.push({ row, completedAt, communityIds: plan.communityIds, rows: plan.rows });
  }

  return replayed;
}

function addDuplicateAnomalies(
  snapshot: BackfillSnapshot,
  anomalies: StandingBackfillAnomaly[],
): number {
  let duplicates = 0;
  const karmaGroups = new Map<string, KarmaRow[]>();
  for (const row of snapshot.karma) {
    if (!row.related_entity_id) continue;
    const key = karmaIdentity(row);
    const rows = karmaGroups.get(key) ?? [];
    rows.push(row);
    karmaGroups.set(key, rows);
  }
  for (const rows of karmaGroups.values()) {
    if (rows.length < 2) continue;
    duplicates += rows.length - 1;
    anomalies.push({
      code: 'DUPLICATE_KARMA_IDENTITY',
      matchId: rows[0].related_entity_id ?? undefined,
      detail: 'Stored karma contains a duplicate projection identity',
    });
  }

  const activityGroups = new Map<string, ActivityRow[]>();
  for (const row of snapshot.activities) {
    if (!row.related_entity_id) continue;
    const key = activityIdentity(row);
    const rows = activityGroups.get(key) ?? [];
    rows.push(row);
    activityGroups.set(key, rows);
  }
  for (const rows of activityGroups.values()) {
    if (rows.length < 2) continue;
    duplicates += rows.length - 1;
    anomalies.push({
      code: 'DUPLICATE_ACTIVITY_IDENTITY',
      matchId: rows[0].related_entity_id ?? undefined,
      detail: 'Stored activity contains a duplicate projection identity',
    });
  }
  return duplicates;
}

function compareStoredProjection(
  snapshot: BackfillSnapshot,
  replayed: ReplayMatch[],
  anomalies: StandingBackfillAnomaly[],
) {
  const storedKarma = new Map<string, KarmaRow[]>();
  for (const row of snapshot.karma) {
    const rows = storedKarma.get(karmaIdentity(row)) ?? [];
    rows.push(row);
    storedKarma.set(karmaIdentity(row), rows);
  }
  const storedActivity = new Map<string, ActivityRow[]>();
  for (const row of snapshot.activities) {
    const rows = storedActivity.get(activityIdentity(row)) ?? [];
    rows.push(row);
    storedActivity.set(activityIdentity(row), rows);
  }

  let predictedKarma = 0;
  let predictedActivity = 0;
  let alreadyProjectedMatches = 0;
  const expectedKarmaKeys = new Set<string>();

  for (const replay of replayed) {
    let complete = true;
    const hasAttributableLegacy = snapshot.karma.some(
      (row) => row.related_entity_id === replay.row.id && LEGACY_REASONS.has(row.reason),
    );
    if (hasAttributableLegacy) complete = false;

    for (const expected of replay.rows) {
      const key = plannedKarmaIdentity(expected);
      expectedKarmaKeys.add(key);
      const stored = storedKarma.get(key) ?? [];
      if (stored.length === 0) {
        predictedKarma += 1;
        complete = false;
        continue;
      }
      const row = stored[0];
      if (Number(row.points) !== expected.points || !sameInstant(row.created_at, expected.createdAt)) {
        complete = false;
        anomalies.push({
          code: 'CONFLICTING_KARMA_PROJECTION',
          matchId: replay.row.id,
          detail: `Stored projection differs from canonical replay for ${expected.userId}/${expected.communityId}/${expected.reason}`,
        });
      }
    }

    for (const expected of expectedActivityRows(replay)) {
      const stored = storedActivity.get(activityIdentity(expected)) ?? [];
      if (stored.length === 0) {
        predictedActivity += 1;
        complete = false;
      } else if (!sameInstant(stored[0].created_at, expected.created_at)) {
        complete = false;
        anomalies.push({
          code: 'CONFLICTING_ACTIVITY_PROJECTION',
          matchId: replay.row.id,
          detail: `Stored activity timestamp differs for ${expected.user_id}/${expected.community_id}/${expected.activity_type}`,
        });
      }
    }
    if (complete) alreadyProjectedMatches += 1;
  }

  const replayedIds = new Set(replayed.map((replay) => replay.row.id));
  for (const row of snapshot.karma) {
    if (!row.related_entity_id || !replayedIds.has(row.related_entity_id)) continue;
    if (!CANONICAL_REASONS.has(row.reason)) continue;
    const key = karmaIdentity(row);
    if (!expectedKarmaKeys.has(key)) {
      anomalies.push({
        code: 'UNEXPECTED_KARMA_PROJECTION',
        matchId: row.related_entity_id,
        detail: `Stored canonical row is not produced by replay for ${row.user_id}/${row.community_id}/${row.reason}`,
      });
    }
  }

  return { predictedKarma, predictedActivity, alreadyProjectedMatches };
}

interface InteractionMetrics {
  recentInteractions: number;
  repeatPairs: number;
  distinctPeople: number;
  distinctCommunities: number;
}

function interactionMetrics(
  replayed: ReplayMatch[],
  nowMs: number,
): Map<string, InteractionMetrics> {
  const pairMatches = new Map<string, Map<string, Set<string>>>();
  const recent = new Map<string, number>();
  const communities = new Map<string, Set<string>>();
  const recentBoundary = nowMs - 365 * 24 * 60 * 60 * 1000;

  const add = (userId: string, counterpartId: string, communityId: string, matchId: string, at: Date) => {
    const pairKey = `${userId}|${communityId}`;
    const counterparts = pairMatches.get(pairKey) ?? new Map<string, Set<string>>();
    const matches = counterparts.get(counterpartId) ?? new Set<string>();
    matches.add(matchId);
    counterparts.set(counterpartId, matches);
    pairMatches.set(pairKey, counterparts);
    const userCommunities = communities.get(userId) ?? new Set<string>();
    userCommunities.add(communityId);
    communities.set(userId, userCommunities);
    if (at.getTime() >= recentBoundary) recent.set(pairKey, (recent.get(pairKey) ?? 0) + 1);
  };

  for (const replay of replayed) {
    for (const communityId of replay.communityIds) {
      add(String(replay.row.responder_id), String(replay.row.requester_id), communityId, replay.row.id, replay.completedAt);
      add(String(replay.row.requester_id), String(replay.row.responder_id), communityId, replay.row.id, replay.completedAt);
    }
  }

  const output = new Map<string, InteractionMetrics>();
  for (const [pairKey, counterparts] of pairMatches) {
    const userId = pairKey.split('|')[0];
    output.set(pairKey, {
      recentInteractions: recent.get(pairKey) ?? 0,
      repeatPairs: [...counterparts.values()].filter((matches) => matches.size >= 2).length,
      distinctPeople: counterparts.size,
      distinctCommunities: communities.get(userId)?.size ?? 0,
    });
  }
  return output;
}

function scoreBucket(score: number): ScoreBucket {
  if (score <= 0) return '0';
  if (score < 20) return '1-19';
  if (score < 40) return '20-39';
  if (score < 60) return '40-59';
  if (score < 80) return '60-79';
  return '80-100';
}

function interactionBucket(value: number): InteractionBucket {
  if (value <= 0) return '0';
  if (value === 1) return '1';
  if (value <= 3) return '2-3';
  return '4+';
}

function calculateDistributions(snapshot: BackfillSnapshot, replayed: ReplayMatch[]) {
  const nowMs = Date.now();
  const metrics = interactionMetrics(replayed, nowMs);
  const configs = new Map(snapshot.configs.map((row) => [String(row.community_id), row]));
  const userConfigs = new Map(snapshot.userConfigs.map((row) => [`${row.user_id}|${row.community_id}`, row]));
  const feedbackByUser = new Map<string, BackfillSnapshot['feedback']>();
  for (const row of snapshot.feedback) {
    const rows = feedbackByUser.get(row.to_user_id) ?? [];
    rows.push(row);
    feedbackByUser.set(row.to_user_id, rows);
  }

  const scores = new Map<string, number>();
  const scoreBuckets: Record<ScoreBucket, number> = {
    '0': 0, '1-19': 0, '20-39': 0, '40-59': 0, '60-79': 0, '80-100': 0,
  };
  const interactionDepthBuckets: Record<InteractionBucket, number> = {
    '0': 0, '1': 0, '2-3': 0, '4+': 0,
  };
  const interactionBreadthBuckets: Record<InteractionBucket, number> = {
    '0': 0, '1': 0, '2-3': 0, '4+': 0,
  };
  let sourcedPairs = 0;

  for (const membership of snapshot.memberships) {
    const pairKey = `${membership.user_id}|${membership.community_id}`;
    const values = metrics.get(pairKey) ?? {
      recentInteractions: 0, repeatPairs: 0, distinctPeople: 0, distinctCommunities: 0,
    };
    if (values.recentInteractions > 0 || values.distinctPeople > 0) sourcedPairs += 1;
    const config = configs.get(membership.community_id) ?? defaultConfig(membership.community_id);
    const userConfig = userConfigs.get(pairKey);
    const score = computeTrustScore({
      recent_interactions: values.recentInteractions,
      avg_feedback_score: calculateWeightedAvgFeedback(
        feedbackByUser.get(membership.user_id) ?? [], membership.community_id, nowMs,
      ),
      repeat_interaction_pairs: values.repeatPairs,
      distinct_people_count: values.distinctPeople,
      distinct_communities_count: values.distinctCommunities,
      depth_weight: userConfig?.depth_weight != null
        ? Number(userConfig.depth_weight)
        : Number(config.trust_depth_weight ?? TRUST_CONFIG_DEFAULTS.depth_weight),
      breadth_weight: userConfig?.breadth_weight != null
        ? Number(userConfig.breadth_weight)
        : Number(config.trust_breadth_weight ?? TRUST_CONFIG_DEFAULTS.breadth_weight),
      feedback_threshold: Number(config.trust_feedback_threshold ?? TRUST_CONFIG_DEFAULTS.feedback_threshold),
      min_interactions_for_bonus: Number(
        config.min_interactions_for_trust ?? TRUST_CONFIG_DEFAULTS.min_interactions_for_bonus,
      ),
      negative_allowed: config.trust_negative_allowed ?? TRUST_CONFIG_DEFAULTS.negative_allowed,
    });
    scores.set(pairKey, score);
    scoreBuckets[scoreBucket(score)] += 1;
    interactionDepthBuckets[interactionBucket(values.repeatPairs)] += 1;
    interactionBreadthBuckets[interactionBucket(values.distinctPeople)] += 1;
  }

  const providerEligibility: Record<ProviderFloor, number> = { '1': 0, '20': 0, '40': 0, '60': 0 };
  const providers = new Map<string, ProviderRow>();
  for (const provider of snapshot.providers) {
    providers.set(`${provider.provider_id}|${provider.community_id}`, provider);
  }
  for (const provider of providers.values()) {
    const score = scores.get(`${provider.user_id}|${provider.community_id}`) ?? 0;
    for (const floor of [1, 20, 40, 60] as const) {
      if (score >= floor) providerEligibility[String(floor) as ProviderFloor] += 1;
    }
  }

  return { scores, scoreBuckets, interactionDepthBuckets, interactionBreadthBuckets, sourcedPairs, providerEligibility };
}

/**
 * Build the exact historical projection and score report using SELECTs only.
 *
 * This function deliberately does not open a transaction: PostgreSQL read-only statements plus a
 * pure in-memory replay make the no-write property inspectable and testable. Task 8 consumes the
 * report as its fail-closed precondition but performs mutation through a separate entry point.
 */
function analyzeSnapshot(snapshot: BackfillSnapshot): {
  report: StandingBackfillReport;
  replayed: ReplayMatch[];
} {
  const anomalies: StandingBackfillAnomaly[] = [];
  const replayed = replayMatches(snapshot, anomalies);
  const matchesById = new Map(
    snapshot.matches
      .filter((row) => row.completed_at)
      .map((row) => [String(row.id), row]),
  );

  let attributableRows = 0;
  let unattributableRows = 0;
  for (const row of snapshot.karma) {
    if (!LEGACY_REASONS.has(row.reason)) continue;
    if (row.related_entity_id && matchesById.has(row.related_entity_id)) attributableRows += 1;
    else unattributableRows += 1;
  }

  const exactDuplicates = addDuplicateAnomalies(snapshot, anomalies);
  const comparison = compareStoredProjection(snapshot, replayed, anomalies);
  const distributions = calculateDistributions(snapshot, replayed);
  const activeMembershipPairs = snapshot.memberships.length;

  return {
    report: {
      canApply: anomalies.length === 0,
      completedMatches: snapshot.matches.length,
      eligibleMatches: replayed.length,
      alreadyProjectedMatches: comparison.alreadyProjectedMatches,
      anomalies,
      activeMembershipPairs,
      sourcedPairs: distributions.sourcedPairs,
      zeroHistoryPairs: activeMembershipPairs - distributions.sourcedPairs,
      legacy: { attributableRows, unattributableRows, exactDuplicates },
      predicted: {
        karmaRows: comparison.predictedKarma,
        activityRows: comparison.predictedActivity,
        trustRowsEvaluated: activeMembershipPairs,
      },
      scoreBuckets: distributions.scoreBuckets,
      interactionDepthBuckets: distributions.interactionDepthBuckets,
      interactionBreadthBuckets: distributions.interactionBreadthBuckets,
      providerEligibility: distributions.providerEligibility,
    },
    replayed,
  };
}

export async function analyzeStandingBackfill(): Promise<StandingBackfillReport> {
  return analyzeSnapshot(await loadSnapshot()).report;
}

const NORMALIZED_LEGACY_REASONS: Readonly<Record<string, string>> = {
  help_provided: COMPLETED_MATCH_REASONS.provided,
  help_received: COMPLETED_MATCH_REASONS.received,
  first_help_bonus: COMPLETED_MATCH_REASONS.first,
};

async function normalizeUnattributableLegacy(
  snapshot: BackfillSnapshot,
): Promise<void> {
  const attributableMatchIds = new Set(
    snapshot.matches
      .filter((match) => match.completed_at != null)
      .map((match) => String(match.id)),
  );
  const rows = snapshot.karma.filter((row) =>
    NORMALIZED_LEGACY_REASONS[row.reason]
    && (!row.related_entity_id || !attributableMatchIds.has(row.related_entity_id)),
  );
  if (rows.length === 0) return;

  await withTransaction(async () => {
    for (const row of rows) {
      const normalizedReason = NORMALIZED_LEGACY_REASONS[row.reason];
      const collision = await query(
        `/* standing-backfill:legacy-collision */
         SELECT id, points, created_at
         FROM reputation.karma_records
         WHERE user_id = $1 AND community_id = $2 AND reason = $3
           AND related_entity_id IS NOT DISTINCT FROM $4::uuid
           AND id <> $5
         LIMIT 1`,
        [row.user_id, row.community_id, normalizedReason, row.related_entity_id, row.id],
      );
      const existing = collision.rows[0] as Pick<KarmaRow, 'id' | 'points' | 'created_at'> | undefined;
      if (existing) {
        if (Number(existing.points) !== Number(row.points) || !sameInstant(existing.created_at, row.created_at)) {
          throw new Error(`Legacy normalization collision for karma row ${row.id}`);
        }
        await query(
          `/* standing-backfill:normalize-legacy */
           DELETE FROM reputation.karma_records WHERE id = $1`,
          [row.id],
        );
        continue;
      }
      await query(
        `/* standing-backfill:normalize-legacy */
         UPDATE reputation.karma_records SET reason = $1 WHERE id = $2`,
        [normalizedReason, row.id],
      );
    }
  });
}

/** Apply only after a fresh, fail-closed preflight; database identities are the resume checkpoint. */
export async function applyStandingBackfill(
  options: StandingBackfillApplyOptions = {},
): Promise<StandingBackfillReport> {
  const batchSize = options.batchSize ?? 100;
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error('Standing backfill batchSize must be a positive integer');
  }

  const snapshot = await loadSnapshot();
  const preflight = analyzeSnapshot(snapshot);
  if (!preflight.report.canApply) {
    throw new Error(`Standing backfill preflight failed with ${preflight.report.anomalies.length} anomaly(s)`);
  }

  await normalizeUnattributableLegacy(snapshot);

  let completedMatches = 0;
  let completedBatches = 0;
  for (let offset = 0; offset < preflight.replayed.length; offset += batchSize) {
    const batch = preflight.replayed.slice(offset, offset + batchSize);
    for (const replay of batch) {
      await withTransaction(async () => {
        await query(
          `/* standing-backfill:delete-attributable-legacy */
           DELETE FROM reputation.karma_records
           WHERE related_entity_id = $1 AND reason = ANY($2::text[])`,
          [replay.row.id, [...LEGACY_REASONS]],
        );
        const projection = await projectCompletedMatchStanding({
          matchId: replay.row.id,
          requestId: String(replay.row.request_id),
          requesterId: String(replay.row.requester_id),
          helperId: String(replay.row.responder_id),
          requestType: replay.row.request_type ?? undefined,
          completedAt: replay.completedAt,
        }, { mode: 'historical', allowRequestCommunityFallback: false });
        const sameCommunities = projection.communityIds.length === replay.communityIds.length
          && projection.communityIds.every((communityId, index) => communityId === replay.communityIds[index]);
        if (!sameCommunities) {
          throw new Error(`Standing community set changed after preflight for match ${replay.row.id}`);
        }
      });
      completedMatches += 1;
    }
    completedBatches += 1;
    const last = batch[batch.length - 1];
    options.onProgress?.({
      completedBatches,
      completedMatches,
      lastCommittedMatchId: last.row.id,
    });
  }

  for (const membership of snapshot.memberships) {
    await updateTrustScore(membership.user_id, membership.community_id);
  }

  return analyzeStandingBackfill();
}
