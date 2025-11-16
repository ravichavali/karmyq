import { query } from '../database/db';
import { logger } from './logger';

/**
 * Record user activity for reputation decay tracking
 * @param userId - User performing the activity
 * @param communityId - Community context
 * @param activityType - Type of activity (complete_request, complete_offer, etc.)
 * @param relatedEntityId - Optional ID of related entity (match_id, request_id, etc.)
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
      logger.warn('No community settings found, skipping activity tracking', { communityId });
      return;
    }

    const activityTypes = settingsResult.rows[0].activity_types || [];

    // Check if this activity type counts
    if (!activityTypes.includes(activityType)) {
      logger.debug('Activity type not tracked for this community', { activityType, communityId });
      return;
    }

    // Log the activity
    await query(
      `INSERT INTO reputation.activity_log (user_id, community_id, activity_type, related_entity_id)
       VALUES ($1, $2, $3, $4)`,
      [userId, communityId, activityType, relatedEntityId || null]
    );

    // Update last_activity_at in trust_scores
    await query(
      `UPDATE reputation.trust_scores
       SET last_activity_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND community_id = $2`,
      [userId, communityId]
    );

    logger.info('Activity recorded', { userId, communityId, activityType, relatedEntityId });
  } catch (error) {
    logger.error('Error recording activity', { error, userId, communityId, activityType });
    // Don't throw - activity logging shouldn't break the main flow
  }
}

/**
 * Activity types that can be tracked
 */
export enum ActivityType {
  COMPLETE_REQUEST = 'complete_request',
  COMPLETE_OFFER = 'complete_offer',
  POST_REQUEST = 'post_request',
  POST_OFFER = 'post_offer',
  JOIN_COMMUNITY = 'join_community',
}
