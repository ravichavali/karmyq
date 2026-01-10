import { query } from '../database/db';
import { recordActivity, ActivityType } from '../utils/activityTracker';

interface MatchCompletionData {
  match_id: string;
  request_id: string;
  requester_id: string;
  responder_id: string;
}

// Karma points configuration
const KARMA_CONFIG = {
  HELP_PROVIDED: 10,    // Points for providing help
  HELP_RECEIVED: 5,     // Points for successfully receiving help
  FIRST_HELP: 15,       // Bonus for first time helping in a community
  MILESTONE_10: 25,     // Bonus for 10 completed exchanges
  MILESTONE_50: 50,     // Bonus for 50 completed exchanges
  MILESTONE_100: 100,   // Bonus for 100 completed exchanges
};

export async function awardKarmaForCompletedMatch(data: MatchCompletionData) {
  const { match_id, request_id, requester_id, responder_id } = data;

  // Get community_id from the request
  const requestResult = await query(
    `SELECT community_id FROM requests.help_requests WHERE id = $1`,
    [request_id]
  );

  if (requestResult.rowCount === 0) {
    throw new Error('Request not found');
  }

  const community_id = requestResult.rows[0].community_id;

  // Award karma to responder (helper)
  const helperKarma = KARMA_CONFIG.HELP_PROVIDED;
  await recordKarma({
    user_id: responder_id,
    community_id,
    points: helperKarma,
    reason: 'Provided help',
    related_entity_id: match_id,
  });

  // Award karma to requester
  const requesterKarma = KARMA_CONFIG.HELP_RECEIVED;
  await recordKarma({
    user_id: requester_id,
    community_id,
    points: requesterKarma,
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
    // This is their first help in this community
    await recordKarma({
      user_id: responder_id,
      community_id,
      points: KARMA_CONFIG.FIRST_HELP,
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
      points: KARMA_CONFIG.MILESTONE_10,
      reason: '10 exchanges milestone',
      related_entity_id: match_id,
    });
  } else if (totalHelps === 50) {
    await recordKarma({
      user_id: responder_id,
      community_id,
      points: KARMA_CONFIG.MILESTONE_50,
      reason: '50 exchanges milestone',
      related_entity_id: match_id,
    });
  } else if (totalHelps === 100) {
    await recordKarma({
      user_id: responder_id,
      community_id,
      points: KARMA_CONFIG.MILESTONE_100,
      reason: '100 exchanges milestone',
      related_entity_id: match_id,
    });
  }

  // Update trust scores for both users
  await updateTrustScore(responder_id, community_id);
  await updateTrustScore(requester_id, community_id);

  // Track activity for reputation decay (resets last_activity_at)
  await recordActivity(responder_id, community_id, ActivityType.COMPLETE_REQUEST, match_id);
  await recordActivity(requester_id, community_id, ActivityType.COMPLETE_OFFER, match_id);

  console.log(`Karma awarded: ${helperKarma}pts to helper, ${requesterKarma}pts to requester`);
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
  // Calculate stats
  const stats = await query(
    `SELECT
       COUNT(CASE WHEN reason = 'Provided help' THEN 1 END) as offers_accepted,
       COUNT(CASE WHEN reason = 'Received help' THEN 1 END) as requests_completed
     FROM reputation.karma_records
     WHERE user_id = $1 AND community_id = $2`,
    [user_id, community_id]
  );

  const { offers_accepted, requests_completed } = stats.rows[0];

  // Calculate total karma for this user in this community
  const karmaResult = await query(
    `SELECT SUM(points) as total_karma
     FROM reputation.karma_records
     WHERE user_id = $1 AND community_id = $2`,
    [user_id, community_id]
  );

  const total_karma = parseInt(karmaResult.rows[0].total_karma || 0);

  // Calculate trust score (50 base + karma contribution)
  // Score ranges from 0-100
  const karma_contribution = Math.min(50, Math.floor(total_karma / 10));
  const score = 50 + karma_contribution;

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
  const result = await query(
    `SELECT
       user_id,
       community_id,
       score,
       requests_completed,
       offers_accepted,
       avg_helpfulness,
       avg_responsiveness,
       avg_clarity,
       total_feedback_received,
       last_updated
     FROM reputation.trust_scores
     WHERE user_id = $1 AND community_id = $2`,
    [user_id, community_id]
  );

  return result.rows[0] || {
    user_id,
    community_id,
    score: 50, // Default score
    requests_completed: 0,
    offers_accepted: 0,
    avg_helpfulness: 0,
    avg_responsiveness: 0,
    avg_clarity: 0,
    total_feedback_received: 0,
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
