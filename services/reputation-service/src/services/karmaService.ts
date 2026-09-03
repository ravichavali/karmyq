import { query } from '../database/db';
import { computeTrustScore } from './trustScoreStrategy';
import { getWeightedAvgFeedback } from '../database/feedbackDb';
import { getTrustMetrics } from '../database/trustMetricsDb';
import { getMaxOtherCommunityScore } from '../database/trustCarryDb';
import { getCommunityTrustConfig } from '../database/trustConfigDb';
import { getCachedEffectiveParams } from './effectiveParamsCache';

/**
 * Karma reads and the ADR-037 trust-score cache.
 *
 * Sprint 126 (ADR-096) moved the completed-match WRITE path out of this file into
 * `standingProjector.ts`, which projects one match atomically through the canonical policy in
 * `@karmyq/shared`. Removed with it: the local `KARMA_DEFAULTS` milestone/pool constants and a
 * second `MAX_COMMUNITIES_PER_KARMA_AWARD`, which duplicated the shared ones byte-for-byte and
 * were free to drift because nothing could fail if they did.
 *
 * `updateTrustScore` stays here and is deliberately present-state: unlike every projection
 * predicate, this cache is supposed to reflect the world as it is now.
 */

export async function updateTrustScore(user_id: string, community_id: string) {
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

  const [trustConfig, avg_feedback_score, trustMetrics, effectiveParams] = await Promise.all([
    getCommunityTrustConfig(community_id),
    getWeightedAvgFeedback(user_id, community_id),
    getTrustMetrics(user_id, community_id),
    getCachedEffectiveParams(user_id, community_id),
  ]);

  const score = computeTrustScore({
    recent_interactions: parseInt(recent_interactions),
    avg_feedback_score,
    repeat_interaction_pairs: trustMetrics.repeat_interaction_pairs,
    distinct_people_count: trustMetrics.distinct_people_count,
    distinct_communities_count: trustMetrics.distinct_communities_count,
    depth_weight: effectiveParams.depth_weight,      // evolved (Sprint 32)
    breadth_weight: effectiveParams.breadth_weight,  // evolved (Sprint 32)
    feedback_threshold: trustConfig.feedback_threshold,          // community policy
    min_interactions_for_bonus: trustConfig.min_interactions_for_bonus, // community policy
    negative_allowed: trustConfig.negative_allowed,              // community policy
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

export async function getOverallTrustScore(user_id: string): Promise<{
  overall_score: number;
  community_breakdown: Array<{ community_id: string; community_name: string; score: number; recent_interactions: number }>;
}> {
  const TWELVE_MONTHS_AGO = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all community trust scores + recent interaction counts for the user
  const result = await query(
    `SELECT
       ts.community_id,
       c.name as community_name,
       ts.score,
       COALESCE(kr.recent_interactions, 0) as recent_interactions
     FROM reputation.trust_scores ts
     JOIN communities.communities c ON ts.community_id = c.id
     LEFT JOIN (
       SELECT community_id, COUNT(*) as recent_interactions
       FROM reputation.karma_records
       WHERE user_id = $1
         AND reason IN ('Provided help', 'Received help')
         AND created_at >= $2
       GROUP BY community_id
     ) kr ON ts.community_id = kr.community_id
     WHERE ts.user_id = $1`,
    [user_id, TWELVE_MONTHS_AGO]
  );

  const rows = result.rows;
  if (rows.length === 0) {
    return { overall_score: 0, community_breakdown: [] };
  }

  // Weighted average: weight each community's score by its recent interaction count
  const totalInteractions = rows.reduce((sum: number, r: any) => sum + parseInt(r.recent_interactions), 0);
  let overall_score: number;
  if (totalInteractions === 0) {
    // Fall back to simple average when no recent activity
    overall_score = Math.round(rows.reduce((sum: number, r: any) => sum + parseInt(r.score), 0) / rows.length);
  } else {
    const weightedSum = rows.reduce((sum: number, r: any) => sum + parseInt(r.score) * parseInt(r.recent_interactions), 0);
    overall_score = Math.round(weightedSum / totalInteractions);
  }

  return {
    overall_score: Math.max(0, Math.min(100, overall_score)),
    community_breakdown: rows.map((r: any) => ({
      community_id: r.community_id,
      community_name: r.community_name,
      score: parseInt(r.score),
      recent_interactions: parseInt(r.recent_interactions),
    })),
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
