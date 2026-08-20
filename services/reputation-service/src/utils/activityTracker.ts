import { query } from '../database/db';
import { createLogger } from '@karmyq/shared/utils/logger';

const logger = createLogger('reputation-service');

export interface RecordActivityOptions {
  /**
   * When this activity actually happened. Historical replay MUST pass the match's real
   * `completed_at`; stamping a replayed row with the current time makes decay and recent-activity
   * output falsely rich. Defaults to now for live callers.
   */
  occurredAt?: Date;
  /**
   * When true, a failed write rethrows so the caller's transaction rolls back. Standing projection
   * needs this: a match whose karma landed but whose activity did not is a partial projection, and
   * the unique projection indexes would make the retry a no-op on the rows that did land.
   * Ordinary callers leave it false — activity logging must not break the main flow.
   */
  required?: boolean;
}

/**
 * Record user activity for reputation decay tracking
 * @param userId - User performing the activity
 * @param communityId - Community context
 * @param activityType - Type of activity (complete_request, complete_offer, etc.)
 * @param relatedEntityId - Optional ID of related entity (match_id, request_id, etc.)
 * @param options - Occurrence time and failure semantics (see RecordActivityOptions)
 */
export async function recordActivity(
  userId: string,
  communityId: string,
  activityType: string,
  relatedEntityId?: string,
  options: RecordActivityOptions = {}
): Promise<void> {
  const occurredAt = options.occurredAt ?? new Date();

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

    // Log the activity. ON CONFLICT DO NOTHING against uq_activity_match_projection makes
    // replaying an already-projected match a no-op rather than a 23505.
    await query(
      `INSERT INTO reputation.activity_log (user_id, community_id, activity_type, related_entity_id, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [userId, communityId, activityType, relatedEntityId || null, occurredAt]
    );

    // Advance last_activity_at, never move it backwards: replaying old history must not make a
    // recently active member look stale to the decay job. GREATEST ignores a NULL existing value.
    await query(
      `UPDATE reputation.trust_scores
       SET last_activity_at = GREATEST(last_activity_at, $3::timestamp)
       WHERE user_id = $1 AND community_id = $2`,
      [userId, communityId, occurredAt]
    );

    logger.info('Activity recorded', { userId, communityId, activityType, relatedEntityId });
  } catch (error) {
    logger.error('Error recording activity', error as Error, { userId, communityId, activityType });
    if (options.required) throw error;
    // Otherwise don't throw - activity logging shouldn't break the main flow
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
