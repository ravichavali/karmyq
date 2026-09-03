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
 * @returns how many activity rows were written (0 when the type is not tracked, or on a replay
 *          that the projection identity already covers)
 */
export async function recordActivity(
  userId: string,
  communityId: string,
  activityType: string,
  relatedEntityId?: string,
  options: RecordActivityOptions = {}
): Promise<number> {
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
      return 0;
    }

    const activityTypes = settingsResult.rows[0].activity_types || [];

    // Check if this activity type counts
    if (!activityTypes.includes(activityType)) {
      logger.debug('Activity type not tracked for this community', { activityType, communityId });
      return 0;
    }

    // Log the activity. ON CONFLICT DO NOTHING against uq_activity_match_projection makes
    // replaying an already-projected match a no-op rather than a 23505.
    const inserted = await query(
      `INSERT INTO reputation.activity_log (user_id, community_id, activity_type, related_entity_id, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [userId, communityId, activityType, relatedEntityId || null, occurredAt]
    );

    // Advance last_activity_at, never move it backwards: replaying old history must not make a
    // recently active member look stale to the decay job.
    //
    // UPSERT, not UPDATE. A bare UPDATE matches zero rows when the pair has no trust_scores row yet
    // — which is every pair during a backfill of a table that starts empty. updateTrustScore would
    // then INSERT the row moments later with last_activity_at defaulting to CURRENT_TIMESTAMP,
    // stamping an eight-month-old exchange as happening today. That is exactly the falsely-fresh
    // history `occurredAt` exists to prevent, arriving through the back door.
    //
    // score is omitted deliberately: it defaults to 0 (Sprint 126), and updateTrustScore computes
    // the real value afterwards.
    await query(
      `INSERT INTO reputation.trust_scores (user_id, community_id, last_activity_at)
       VALUES ($1, $2, $3::timestamp)
       ON CONFLICT (user_id, community_id) DO UPDATE
         SET last_activity_at = GREATEST(
               reputation.trust_scores.last_activity_at, EXCLUDED.last_activity_at)`,
      [userId, communityId, occurredAt]
    );

    logger.info('Activity recorded', { userId, communityId, activityType, relatedEntityId });
    return inserted.rowCount ?? 0;
  } catch (error) {
    logger.error('Error recording activity', error as Error, { userId, communityId, activityType });
    if (options.required) throw error;
    // Otherwise don't throw - activity logging shouldn't break the main flow
    return 0;
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
