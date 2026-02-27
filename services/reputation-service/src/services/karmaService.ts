import { query } from '../database/db';
import { recordActivity, ActivityType } from '../utils/activityTracker';
import { allocateKarma, CommunityKarmaConfig } from './karmaAllocation';
import { computeTrustScore } from './trustScoreStrategy';
import { getWeightedAvgFeedback } from '../database/feedbackDb';
import { getTrustMetrics } from '../database/trustMetricsDb';
import { getMaxOtherCommunityScore } from '../database/trustCarryDb';

interface MatchCompletionData {
  match_id: string;
  request_id: string;
  requester_id: string;
  responder_id: string;
}

// Default karma points (used when community has no config)
const KARMA_DEFAULTS = {
  HELP_PROVIDED: 10,    // Points for providing help
  HELP_RECEIVED: 5,     // Points for successfully receiving help
  FIRST_HELP: 15,       // Bonus for first time helping in a community
  MILESTONE_10: 25,     // Bonus for 10 completed exchanges
  MILESTONE_50: 50,     // Bonus for 50 completed exchanges
  MILESTONE_100: 100,   // Bonus for 100 completed exchanges
  BASE_KARMA_POOL: 100, // Default base karma pool per request
};

// Max communities to award karma in per match (prevents excessive karma for users in many communities)
const MAX_COMMUNITIES_PER_KARMA_AWARD = 3;

/**
 * Get community's karma config (splits, base pool) from community_configs.
 * Falls back to defaults if no config exists.
 */
async function getCommunityKarmaConfig(community_id: string) {
  const result = await query(
    `SELECT karma_split_helper, karma_split_requestor, base_karma_pool_per_request
     FROM communities.community_configs
     WHERE community_id = $1`,
    [community_id]
  );

  if (result.rowCount === 0) {
    return {
      karma_split_helper: 60,
      karma_split_requestor: 40,
      base_karma_pool: KARMA_DEFAULTS.BASE_KARMA_POOL,
    };
  }

  const row = result.rows[0];
  return {
    karma_split_helper: row.karma_split_helper ?? 60,
    karma_split_requestor: row.karma_split_requestor ?? 40,
    base_karma_pool: row.base_karma_pool_per_request ?? KARMA_DEFAULTS.BASE_KARMA_POOL,
  };
}

interface CommunityTrustConfig {
  depth_weight: number;
  breadth_weight: number;
  feedback_threshold: number;
  min_interactions_for_bonus: number;
  negative_allowed: boolean;
  // Carry model (ADR-038)
  carry_enabled: boolean;
  carry_factor: number;
  carry_cap: number;
}

const TRUST_CONFIG_DEFAULTS: CommunityTrustConfig = {
  depth_weight: 0.6,
  breadth_weight: 0.4,
  feedback_threshold: 3.0,
  min_interactions_for_bonus: 1,
  negative_allowed: false,
  carry_enabled: true,
  carry_factor: 0.40,
  carry_cap: 59,
};

/**
 * Get community trust configuration from community_configs (ADR-037).
 * Falls back to defaults if no config row exists.
 */
async function getCommunityTrustConfig(community_id: string): Promise<CommunityTrustConfig> {
  const result = await query(
    `SELECT
       trust_depth_weight,
       trust_breadth_weight,
       trust_feedback_threshold,
       min_interactions_for_trust,
       trust_negative_allowed,
       trust_carry_enabled,
       trust_carry_factor,
       trust_carry_cap
     FROM communities.community_configs
     WHERE community_id = $1`,
    [community_id],
  );

  if (result.rowCount === 0) return TRUST_CONFIG_DEFAULTS;

  const row = result.rows[0];
  return {
    depth_weight: row.trust_depth_weight ?? TRUST_CONFIG_DEFAULTS.depth_weight,
    breadth_weight: row.trust_breadth_weight ?? TRUST_CONFIG_DEFAULTS.breadth_weight,
    feedback_threshold: row.trust_feedback_threshold != null
      ? parseFloat(row.trust_feedback_threshold)
      : TRUST_CONFIG_DEFAULTS.feedback_threshold,
    min_interactions_for_bonus: row.min_interactions_for_trust ?? TRUST_CONFIG_DEFAULTS.min_interactions_for_bonus,
    negative_allowed: row.trust_negative_allowed ?? TRUST_CONFIG_DEFAULTS.negative_allowed,
    carry_enabled: row.trust_carry_enabled ?? TRUST_CONFIG_DEFAULTS.carry_enabled,
    carry_factor: row.trust_carry_factor != null
      ? parseFloat(row.trust_carry_factor)
      : TRUST_CONFIG_DEFAULTS.carry_factor,
    carry_cap: row.trust_carry_cap ?? TRUST_CONFIG_DEFAULTS.carry_cap,
  };
}

/**
 * Find communities where BOTH requester and helper are active members,
 * intersected with the communities the request was posted to.
 * Returns up to MAX_COMMUNITIES_PER_KARMA_AWARD communities, prioritized by
 * the user's existing karma (rewards continued participation).
 */
async function getSharedRequestCommunities(
  request_id: string,
  requester_id: string,
  responder_id: string
): Promise<string[]> {
  const result = await query(
    `SELECT rc.community_id
     FROM requests.request_communities rc
     -- Both users must be active members of the community
     JOIN communities.members cm1 ON rc.community_id = cm1.community_id
       AND cm1.user_id = $2 AND cm1.status = 'active'
     JOIN communities.members cm2 ON rc.community_id = cm2.community_id
       AND cm2.user_id = $3 AND cm2.status = 'active'
     -- Order by responder's existing karma (highest first) for the cap
     LEFT JOIN (
       SELECT community_id, SUM(points) as total_karma
       FROM reputation.karma_records WHERE user_id = $3
       GROUP BY community_id
     ) kr ON kr.community_id = rc.community_id
     WHERE rc.request_id = $1
     ORDER BY COALESCE(kr.total_karma, 0) DESC
     LIMIT $4`,
    [request_id, requester_id, responder_id, MAX_COMMUNITIES_PER_KARMA_AWARD]
  );

  return result.rows.map(row => row.community_id);
}

/**
 * Award karma for a completed match (ADR-031: shared community model).
 *
 * Karma is awarded in all communities where BOTH requester and helper
 * are active members AND the request was posted to (via request_communities).
 * Capped at MAX_COMMUNITIES_PER_KARMA_AWARD to prevent inflation.
 *
 * Each community's config determines the helper/requester karma split.
 */
export async function awardKarmaForCompletedMatch(data: MatchCompletionData) {
  const { match_id, request_id, requester_id, responder_id } = data;

  // Find shared communities (request communities ∩ both users' memberships)
  const sharedCommunities = await getSharedRequestCommunities(request_id, requester_id, responder_id);

  if (sharedCommunities.length === 0) {
    // Fallback: get any community from the request (shouldn't happen in normal flow)
    const fallback = await query(
      `SELECT community_id FROM requests.request_communities WHERE request_id = $1 LIMIT 1`,
      [request_id]
    );
    if (fallback.rowCount === 0) {
      throw new Error(`No communities found for request ${request_id}`);
    }
    sharedCommunities.push(fallback.rows[0].community_id);
  }

  // Fetch all community configs upfront, then compute allocations once.
  // allocateKarma() divides a fixed pool across communities using each
  // community's split ratio, with largest-remainder rounding so the
  // integer awards always sum exactly to BASE_KARMA_POOL (no inflation).
  const communityConfigs: CommunityKarmaConfig[] = await Promise.all(
    sharedCommunities.map(async (id) => {
      const cfg = await getCommunityKarmaConfig(id);
      return { community_id: id, ...cfg };
    })
  );
  const allocations = allocateKarma(communityConfigs, KARMA_DEFAULTS.BASE_KARMA_POOL);

  let totalHelperKarma = 0;
  let totalRequesterKarma = 0;

  // Award karma in each shared community using pre-computed allocations
  for (const { community_id, helperPoints, requesterPoints } of allocations) {
    // Award karma to responder (helper)
    await recordKarma({
      user_id: responder_id,
      community_id,
      points: helperPoints,
      reason: 'Provided help',
      related_entity_id: match_id,
    });

    // Award karma to requester
    await recordKarma({
      user_id: requester_id,
      community_id,
      points: requesterPoints,
      reason: 'Received help',
      related_entity_id: match_id,
    });

    // Check for first help bonus (responder)
    const helperHistory = await query(
      `SELECT COUNT(*) as count FROM reputation.karma_records
       WHERE user_id = $1 AND community_id = $2 AND reason = 'Provided help'`,
      [responder_id, community_id]
    );

    if (parseInt(helperHistory.rows[0].count) === 1) {
      await recordKarma({
        user_id: responder_id,
        community_id,
        points: KARMA_DEFAULTS.FIRST_HELP,
        reason: 'First help in community',
        related_entity_id: match_id,
      });
    }

    // Check for milestone bonuses (responder)
    const totalHelps = parseInt(helperHistory.rows[0].count);
    if (totalHelps === 10) {
      await recordKarma({
        user_id: responder_id,
        community_id,
        points: KARMA_DEFAULTS.MILESTONE_10,
        reason: '10 exchanges milestone',
        related_entity_id: match_id,
      });
    } else if (totalHelps === 50) {
      await recordKarma({
        user_id: responder_id,
        community_id,
        points: KARMA_DEFAULTS.MILESTONE_50,
        reason: '50 exchanges milestone',
        related_entity_id: match_id,
      });
    } else if (totalHelps === 100) {
      await recordKarma({
        user_id: responder_id,
        community_id,
        points: KARMA_DEFAULTS.MILESTONE_100,
        reason: '100 exchanges milestone',
        related_entity_id: match_id,
      });
    }

    // Update trust scores in this community
    await updateTrustScore(responder_id, community_id);
    await updateTrustScore(requester_id, community_id);

    // Track activity for reputation decay
    await recordActivity(responder_id, community_id, ActivityType.COMPLETE_REQUEST, match_id);
    await recordActivity(requester_id, community_id, ActivityType.COMPLETE_OFFER, match_id);

    totalHelperKarma += helperPoints;
    totalRequesterKarma += requesterPoints;
  }

  console.log(
    `Karma awarded across ${sharedCommunities.length} communities: ` +
    `${totalHelperKarma}pts to helper, ${totalRequesterKarma}pts to requester`
  );
}

interface KarmaRecordData {
  user_id: string;
  community_id: string;
  points: number;
  reason: string;
  related_entity_id?: string;
}

async function recordKarma(data: KarmaRecordData) {
  const { user_id, community_id, points, reason, related_entity_id } = data;

  await query(
    `INSERT INTO reputation.karma_records
     (user_id, community_id, points, reason, related_entity_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [user_id, community_id, points, reason, related_entity_id || null]
  );
}

async function updateTrustScore(user_id: string, community_id: string) {
  const TWELVE_MONTHS_AGO = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

  // Count recent interactions (last 12 months) and all-time for the upsert counters
  const stats = await query(
    `SELECT
       COUNT(CASE WHEN reason = 'Provided help' THEN 1 END) as offers_accepted,
       COUNT(CASE WHEN reason = 'Received help' THEN 1 END) as requests_completed,
       COUNT(CASE WHEN reason IN ('Provided help', 'Received help') AND created_at >= $3 THEN 1 END) as recent_interactions
     FROM reputation.karma_records
     WHERE user_id = $1 AND community_id = $2`,
    [user_id, community_id, TWELVE_MONTHS_AGO]
  );

  const { offers_accepted, requests_completed, recent_interactions } = stats.rows[0];

  const [trustConfig, avg_feedback_score, trustMetrics] = await Promise.all([
    getCommunityTrustConfig(community_id),
    getWeightedAvgFeedback(user_id, community_id),
    getTrustMetrics(user_id, community_id),
  ]);

  const score = computeTrustScore({
    recent_interactions: parseInt(recent_interactions),
    avg_feedback_score,
    repeat_interaction_pairs: trustMetrics.repeat_interaction_pairs,
    distinct_people_count: trustMetrics.distinct_people_count,
    distinct_communities_count: trustMetrics.distinct_communities_count,
    depth_weight: trustConfig.depth_weight,
    breadth_weight: trustConfig.breadth_weight,
    feedback_threshold: trustConfig.feedback_threshold,
    min_interactions_for_bonus: trustConfig.min_interactions_for_bonus,
    negative_allowed: trustConfig.negative_allowed,
  });

  // Upsert trust score
  await query(
    `INSERT INTO reputation.trust_scores
     (user_id, community_id, score, requests_completed, offers_accepted, last_updated)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, community_id)
     DO UPDATE SET
       score = $3,
       requests_completed = $4,
       offers_accepted = $5,
       last_updated = CURRENT_TIMESTAMP`,
    [user_id, community_id, score, requests_completed, offers_accepted]
  );
}

/**
 * Calculate user karma with 6-month half-life decay (ADR-011)
 * @param user_id User ID
 * @param community_id Optional community filter
 * @returns Karma data with decay applied
 */
export async function getUserKarmaWithDecay(user_id: string, community_id: string) {
  // Get all karma records for user in community
  const result = await query(
    `SELECT points, created_at, reason
     FROM reputation.karma_records
     WHERE user_id = $1 AND community_id = $2
     ORDER BY created_at DESC`,
    [user_id, community_id]
  );

  const records = result.rows;

  if (records.length === 0) {
    return {
      karma: 0,
      trend: 'stable' as const,
      recent_helps: 0,
      recent_requests: 0,
      last_updated: new Date()
    };
  }

  // Apply exponential decay (6-month half-life)
  const HALF_LIFE_MS = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months in milliseconds
  const now = Date.now();

  let totalKarma = 0;
  let recentHelps = 0;
  let recentRequests = 0;
  const RECENT_THRESHOLD = 30 * 24 * 60 * 60 * 1000; // Last 30 days

  for (const record of records) {
    const age = now - new Date(record.created_at).getTime();
    const decayFactor = Math.pow(0.5, age / HALF_LIFE_MS);
    totalKarma += record.points * decayFactor;

    // Count recent activity (last 30 days, no decay)
    if (age < RECENT_THRESHOLD) {
      if (record.reason === 'Provided help') recentHelps++;
      if (record.reason === 'Received help') recentRequests++;
    }
  }

  // Calculate trend (compare karma from 7 days ago to now)
  const karmaOneWeekAgo = await calculateKarmaAtTime(user_id, community_id, Date.now() - 7 * 24 * 60 * 60 * 1000);
  const change = totalKarma - karmaOneWeekAgo;

  let trend: 'growing' | 'stable' | 'declining';
  if (change > 10) trend = 'growing';
  else if (change < -10) trend = 'declining';
  else trend = 'stable';

  return {
    karma: Math.round(totalKarma),
    trend,
    recent_helps: recentHelps,
    recent_requests: recentRequests,
    last_updated: new Date()
  };
}

/**
 * Calculate karma at a specific point in time (for trend calculation)
 */
async function calculateKarmaAtTime(user_id: string, community_id: string, timestamp: number): Promise<number> {
  const result = await query(
    `SELECT points, created_at
     FROM reputation.karma_records
     WHERE user_id = $1 AND community_id = $2`,
    [user_id, community_id]
  );

  const HALF_LIFE_MS = 6 * 30 * 24 * 60 * 60 * 1000;
  let totalKarma = 0;

  for (const record of result.rows) {
    const recordTime = new Date(record.created_at).getTime();
    if (recordTime <= timestamp) {
      const age = timestamp - recordTime;
      const decayFactor = Math.pow(0.5, age / HALF_LIFE_MS);
      totalKarma += record.points * decayFactor;
    }
  }

  return totalKarma;
}

// Keep original function for backward compatibility (no decay)
export async function getUserKarma(user_id: string, community_id?: string) {
  let queryText = `
    SELECT
      community_id,
      SUM(points) as total_karma,
      COUNT(*) as transaction_count
    FROM reputation.karma_records
    WHERE user_id = $1
  `;

  const params: any[] = [user_id];

  if (community_id) {
    queryText += ` AND community_id = $2`;
    params.push(community_id);
  }

  queryText += ` GROUP BY community_id ORDER BY total_karma DESC`;

  const result = await query(queryText, params);
  return result.rows;
}

export async function getUserTrustScore(user_id: string, community_id: string) {
  const TWELVE_MONTHS_AGO = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

  const statsResult = await query(
    `SELECT
       COUNT(CASE WHEN reason = 'Provided help' THEN 1 END) as offers_accepted,
       COUNT(CASE WHEN reason = 'Received help' THEN 1 END) as requests_completed,
       COUNT(CASE WHEN reason IN ('Provided help', 'Received help') AND created_at >= $3 THEN 1 END) as recent_interactions
     FROM reputation.karma_records
     WHERE user_id = $1 AND community_id = $2`,
    [user_id, community_id, TWELVE_MONTHS_AGO]
  );

  const statsRow = statsResult.rows[0];

  const [trustConfig, avg_feedback_score, trustMetrics] = await Promise.all([
    getCommunityTrustConfig(community_id),
    getWeightedAvgFeedback(user_id, community_id),
    getTrustMetrics(user_id, community_id),
  ]);

  const recentInteractions = parseInt(statsRow?.recent_interactions || 0);

  const local_score = computeTrustScore({
    recent_interactions: recentInteractions,
    avg_feedback_score,
    repeat_interaction_pairs: trustMetrics.repeat_interaction_pairs,
    distinct_people_count: trustMetrics.distinct_people_count,
    distinct_communities_count: trustMetrics.distinct_communities_count,
    depth_weight: trustConfig.depth_weight,
    breadth_weight: trustConfig.breadth_weight,
    feedback_threshold: trustConfig.feedback_threshold,
    min_interactions_for_bonus: trustConfig.min_interactions_for_bonus,
    negative_allowed: trustConfig.negative_allowed,
  });

  // ADR-038: Cross-community carry floor.
  // When the user has no recent interactions in this community (12-month window, ADR-039),
  // carry a decayed fraction of their best score elsewhere as a floor.
  // Once any local interaction is completed, the locally-earned score is used instead.
  let score = local_score;
  if (recentInteractions === 0 && trustConfig.carry_enabled) {
    const maxOther = await getMaxOtherCommunityScore(user_id, community_id);
    if (maxOther != null) {
      const carried = Math.min(trustConfig.carry_cap, Math.floor(maxOther * trustConfig.carry_factor));
      score = Math.max(local_score, carried);
    }
  }

  return {
    user_id,
    community_id,
    score,
    requests_completed: parseInt(statsRow?.requests_completed || 0),
    offers_accepted: parseInt(statsRow?.offers_accepted || 0),
    avg_feedback_score,
  };
}

export async function getCommunityLeaderboard(community_id: string, limit: number = 10) {
  const result = await query(
    `SELECT
       kr.user_id,
       u.name,
       ts.score as trust_score,
       SUM(kr.points) as total_karma,
       ts.requests_completed,
       ts.offers_accepted
     FROM reputation.karma_records kr
     LEFT JOIN auth.users u ON kr.user_id = u.id
     LEFT JOIN reputation.trust_scores ts ON kr.user_id = ts.user_id AND kr.community_id = ts.community_id
     WHERE kr.community_id = $1
     GROUP BY kr.user_id, u.name, ts.score, ts.requests_completed, ts.offers_accepted
     ORDER BY total_karma DESC
     LIMIT $2`,
    [community_id, limit]
  );

  return result.rows;
}
