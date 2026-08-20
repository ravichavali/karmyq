import { query } from '../database/db';
import { logger } from '../utils/logger';

/**
 * Reputation Decay Job
 * Updates trust scores based on time-based karma decay
 * Runs once daily
 */

export async function updateDecayedTrustScores(): Promise<void> {
  logger.info('Starting reputation decay job');

  try {
    // Get all user-community combinations with trust scores
    const trustScores = await query(
      `SELECT
        ts.id,
        ts.user_id,
        ts.community_id,
        ts.score as current_score,
        ts.last_activity_at
       FROM reputation.trust_scores ts
       ORDER BY ts.community_id, ts.user_id`
    );

    if (!trustScores.rows.length) {
      logger.info('No trust scores to update');
      return;
    }

    let updatedCount = 0;
    let unchangedCount = 0;

    for (const row of trustScores.rows) {
      const { id, user_id, community_id, current_score } = row;

      // Calculate decayed karma using the database function
      const decayedResult = await query(
        `SELECT reputation.calculate_decayed_karma($1, $2) as decayed_karma`,
        [user_id, community_id]
      );

      const decayedKarma = decayedResult.rows[0]?.decayed_karma || 0;

      // Calculate new trust score (0-100 scale)
      // Simple formula: min(100, decayed_karma / 10)
      // Communities can customize this formula later
      const newScore = Math.min(100, Math.floor(decayedKarma / 10));

      // Only update if score changed
      if (newScore !== current_score) {
        await query(
          `UPDATE reputation.trust_scores
           SET score = $1, last_updated = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [newScore, id]
        );
        updatedCount++;

        logger.debug('Updated trust score', {
          user_id,
          community_id,
          old_score: current_score,
          new_score: newScore,
          decayed_karma: decayedKarma,
        });
      } else {
        unchangedCount++;
      }
    }

    logger.info(`Reputation decay job completed`, {
      total: trustScores.rows.length,
      updated: updatedCount,
      unchanged: unchangedCount,
    });
  } catch (error) {
    logger.error('Error in reputation decay job', { error });
    throw error;
  }
}

/**
 * Activity Tracker
 * Updates last_activity_at when users perform qualifying activities
 *
 * ⚠️ This duplicates `services/reputation-service/src/utils/activityTracker.ts` near-verbatim, and
 * currently has NO callers anywhere in the repo. It is kept conflict-safe in step with its twin so
 * it cannot corrupt decay input if it is ever wired up; if it is still unused next time someone
 * touches this file, delete it rather than maintaining two copies. The reputation-service version
 * additionally supports a supplied occurrence time and required-write semantics for Sprint 126
 * standing projection — a cross-service extraction into `packages/shared` would be the real fix.
 */
export async function recordActivity(
  userId: string,
  communityId: string,
  activityType: string,
  relatedEntityId?: string
): Promise<void> {
  try {
    // Check if this activity type is enabled for the community
    const settingsResult = await query(
      `SELECT activity_types
       FROM communities.settings
       WHERE community_id = $1`,
      [communityId]
    );

    if (!settingsResult.rows.length) {
      logger.warn('No community settings found', { communityId });
      return;
    }

    const activityTypes = settingsResult.rows[0].activity_types || [];

    // Check if this activity type counts
    if (!activityTypes.includes(activityType)) {
      logger.debug('Activity type not tracked', { activityType, communityId });
      return;
    }

    // Log the activity. ON CONFLICT DO NOTHING against uq_activity_match_projection (Sprint 126):
    // without it a repeat write raises 23505, and because the catch below deliberately swallows,
    // the failure would silently skip the last_activity_at refresh underneath — letting the decay
    // job decay a genuinely active member.
    await query(
      `INSERT INTO reputation.activity_log (user_id, community_id, activity_type, related_entity_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [userId, communityId, activityType, relatedEntityId]
    );

    // Update last_activity_at in trust_scores, never moving it backwards.
    await query(
      `UPDATE reputation.trust_scores
       SET last_activity_at = GREATEST(last_activity_at, CURRENT_TIMESTAMP)
       WHERE user_id = $1 AND community_id = $2`,
      [userId, communityId]
    );

    logger.debug('Recorded activity', { userId, communityId, activityType });
  } catch (error) {
    logger.error('Error recording activity', { error, userId, communityId, activityType });
    // Don't throw - activity logging shouldn't break the main flow
  }
}

/**
 * Clean up old activity logs (keep last 90 days)
 */
export async function cleanupActivityLogs(): Promise<void> {
  logger.info('Starting activity log cleanup');

  try {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 90); // Keep 90 days

    const result = await query(
      `DELETE FROM reputation.activity_log
       WHERE created_at <= $1
       RETURNING id`,
      [threshold.toISOString()]
    );

    logger.info(`Deleted ${result.rowCount} old activity log entries`);
  } catch (error) {
    logger.error('Error cleaning up activity logs', { error });
    throw error;
  }
}

/**
 * Generate reputation decay report
 * Shows communities with highest decay rates
 */
export async function generateDecayReport(): Promise<void> {
  logger.info('Generating reputation decay report');

  try {
    const report = await query(
      `SELECT
        c.id as community_id,
        c.name as community_name,
        COUNT(ts.id) as total_users,
        AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ts.last_activity_at)) / (30.44 * 24 * 60 * 60)) as avg_months_inactive,
        SUM(CASE WHEN ts.last_activity_at < CURRENT_TIMESTAMP - INTERVAL '6 months' THEN 1 ELSE 0 END) as inactive_6mo,
        SUM(CASE WHEN ts.last_activity_at < CURRENT_TIMESTAMP - INTERVAL '12 months' THEN 1 ELSE 0 END) as inactive_12mo,
        cs.reputation_half_life_months
       FROM communities.communities c
       JOIN reputation.trust_scores ts ON c.id = ts.community_id
       JOIN communities.settings cs ON c.id = cs.community_id
       GROUP BY c.id, c.name, cs.reputation_half_life_months
       ORDER BY avg_months_inactive DESC`
    );

    logger.info('Reputation Decay Report', {
      communities: report.rows.map((r) => ({
        community: r.community_name,
        total_users: parseInt(r.total_users),
        avg_months_inactive: parseFloat(r.avg_months_inactive).toFixed(2),
        inactive_6mo: parseInt(r.inactive_6mo),
        inactive_12mo: parseInt(r.inactive_12mo),
        half_life_months: r.reputation_half_life_months,
      })),
    });
  } catch (error) {
    logger.error('Error generating decay report', { error });
  }
}
