import { Router, Response } from 'express';
import { query } from '../database/db';
import { publishEvent } from '../events/publisher';
import {
  sendSuccess,
  sendNotFound,
  sendForbidden,
  sendValidationError,
  sendInternalError,
  HTTP_STATUS,
} from '@karmyq/shared/utils/response';

const router = Router({ mergeParams: true }); // mergeParams: true to access :communityId from parent route

// Helper: verify membership and return role
async function getMembership(communityId: string, userId: string) {
  const result = await query(
    `SELECT role FROM communities.members WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
    [communityId, userId]
  );
  return result.rows[0] ?? null;
}

// GET /communities/:communityId/activities
// Returns upcoming open activities for this community with is_joined flag for the caller
router.get('/', async (req: any, res: Response) => {
  try {
    const { communityId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return sendForbidden(res, 'Authentication required', { requestId: req.id });
    }

    const membership = await getMembership(communityId, userId);
    if (!membership) {
      return sendForbidden(res, 'You are not a member of this community', { requestId: req.id });
    }

    const result = await query(
      `SELECT
         a.*,
         u.name AS created_by_name,
         EXISTS(
           SELECT 1 FROM communities.activity_participants ap
           WHERE ap.activity_id = a.id AND ap.user_id = $2
         ) AS is_joined
       FROM communities.activities a
       JOIN auth.users u ON u.id = a.created_by
       WHERE a.community_id = $1
         AND a.status = 'open'
         AND a.scheduled_at > NOW()
       ORDER BY a.scheduled_at ASC`,
      [communityId, userId]
    );

    sendSuccess(res, { activities: result.rows, count: result.rowCount }, HTTP_STATUS.OK, { requestId: req.id });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching activities', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'GET /activities' });
    sendInternalError(res, 'Failed to fetch activities', error instanceof Error ? error : undefined, { requestId: req.id });
  }
});

// POST /communities/:communityId/activities  (admin only)
router.post('/', async (req: any, res: Response) => {
  try {
    const { communityId } = req.params;
    const userId = req.user?.userId;
    const { title, activity_type, scheduled_at, description, duration_minutes, location, max_participants } = req.body;

    if (!userId) {
      return sendForbidden(res, 'Authentication required', { requestId: req.id });
    }

    const membership = await getMembership(communityId, userId);
    if (!membership) {
      return sendForbidden(res, 'You are not a member of this community', { requestId: req.id });
    }
    if (membership.role !== 'admin') {
      return sendForbidden(res, 'Only community admins can create activities', { requestId: req.id });
    }

    if (!title || !activity_type || !scheduled_at) {
      return sendValidationError(res, 'title, activity_type, and scheduled_at are required', { requestId: req.id });
    }

    const validActivityTypes = ['pickup_game', 'group_run', 'workout', 'social', 'other'];
    if (!validActivityTypes.includes(activity_type)) {
      return sendValidationError(res, `activity_type must be one of: ${validActivityTypes.join(', ')}`, { requestId: req.id });
    }

    const scheduledDate = new Date(scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      return sendValidationError(res, 'scheduled_at must be a valid ISO 8601 date', { requestId: req.id });
    }
    if (scheduledDate <= new Date()) {
      return sendValidationError(res, 'scheduled_at must be in the future', { requestId: req.id });
    }

    const result = await query(
      `INSERT INTO communities.activities
         (community_id, created_by, title, description, activity_type, scheduled_at, duration_minutes, location, max_participants)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [communityId, userId, title, description ?? null, activity_type, scheduled_at, duration_minutes ?? null, location ?? null, max_participants ?? null]
    );

    sendSuccess(res, { activity: result.rows[0] }, HTTP_STATUS.CREATED, { requestId: req.id });
  } catch (error: any) {
    (req as any).logger?.error('Error creating activity', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'POST /activities' });
    sendInternalError(res, 'Failed to create activity', error instanceof Error ? error : undefined, { requestId: req.id });
  }
});

// GET /communities/:communityId/activities/:activityId
router.get('/:activityId', async (req: any, res: Response) => {
  try {
    const { communityId, activityId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return sendForbidden(res, 'Authentication required', { requestId: req.id });
    }

    const membership = await getMembership(communityId, userId);
    if (!membership) {
      return sendForbidden(res, 'You are not a member of this community', { requestId: req.id });
    }

    const activityResult = await query(
      `SELECT a.*, u.name AS created_by_name
       FROM communities.activities a
       JOIN auth.users u ON u.id = a.created_by
       WHERE a.id = $1 AND a.community_id = $2`,
      [activityId, communityId]
    );

    if (activityResult.rowCount === 0) {
      return sendNotFound(res, 'Activity', { requestId: req.id });
    }

    const participantsResult = await query(
      `SELECT ap.user_id, ap.joined_at, u.name AS user_name
       FROM communities.activity_participants ap
       JOIN auth.users u ON u.id = ap.user_id
       WHERE ap.activity_id = $1
       ORDER BY ap.joined_at ASC`,
      [activityId]
    );

    const activity = activityResult.rows[0];
    activity.participants = participantsResult.rows;

    sendSuccess(res, activity, HTTP_STATUS.OK, { requestId: req.id });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching activity', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'GET /activities/:activityId' });
    sendInternalError(res, 'Failed to fetch activity', error instanceof Error ? error : undefined, { requestId: req.id });
  }
});

// POST /communities/:communityId/activities/:activityId/join
router.post('/:activityId/join', async (req: any, res: Response) => {
  try {
    const { communityId, activityId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return sendForbidden(res, 'Authentication required', { requestId: req.id });
    }

    const membership = await getMembership(communityId, userId);
    if (!membership) {
      return sendForbidden(res, 'You are not a member of this community', { requestId: req.id });
    }

    // Fetch activity to verify it exists, belongs to this community, and is open
    const activityResult = await query(
      `SELECT id, activity_type, scheduled_at, max_participants, current_participants, status
       FROM communities.activities
       WHERE id = $1 AND community_id = $2`,
      [activityId, communityId]
    );

    if (activityResult.rowCount === 0) {
      return sendNotFound(res, 'Activity', { requestId: req.id });
    }

    const activity = activityResult.rows[0];

    if (activity.status !== 'open') {
      return sendValidationError(res, 'Activity is not open for joining', { requestId: req.id });
    }

    // Step 1: Try to insert participant — ON CONFLICT DO NOTHING makes this idempotent
    const insertResult = await query(
      `INSERT INTO communities.activity_participants (activity_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (activity_id, user_id) DO NOTHING`,
      [activityId, userId]
    );

    if (!insertResult.rowCount || insertResult.rowCount === 0) {
      // Row already existed — user has already joined
      return res.status(409).json({ success: false, message: 'Already joined this activity', error: 'ALREADY_JOINED' });
    }

    // Step 2: Increment counter WITH capacity guard — prevents race condition where two
    // concurrent joins both passed the status check but only one slot remains
    const updateResult = await query(
      `UPDATE communities.activities
       SET current_participants = current_participants + 1
       WHERE id = $1
         AND (max_participants IS NULL OR current_participants < max_participants)
       RETURNING *`,
      [activityId]
    );

    if (!updateResult.rowCount || updateResult.rowCount === 0) {
      // Capacity was reached between our insert and this update — undo the insert
      await query(
        `DELETE FROM communities.activity_participants WHERE activity_id = $1 AND user_id = $2`,
        [activityId, userId]
      );
      return sendValidationError(res, 'Activity is full', { requestId: req.id });
    }

    // Emit event (karma this sprint = event emit only, no DB writes)
    await publishEvent('activity_joined', {
      activityId,
      userId,
      communityId,
      activityType: activity.activity_type,
      scheduledAt: activity.scheduled_at,
    });

    sendSuccess(res, { activity: updateResult.rows[0] }, HTTP_STATUS.OK, { requestId: req.id });
  } catch (error: any) {
    (req as any).logger?.error('Error joining activity', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'POST /activities/:activityId/join' });
    sendInternalError(res, 'Failed to join activity', error instanceof Error ? error : undefined, { requestId: req.id });
  }
});

// DELETE /communities/:communityId/activities/:activityId/leave
router.delete('/:activityId/leave', async (req: any, res: Response) => {
  try {
    const { communityId, activityId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return sendForbidden(res, 'Authentication required', { requestId: req.id });
    }

    const membership = await getMembership(communityId, userId);
    if (!membership) {
      return sendForbidden(res, 'You are not a member of this community', { requestId: req.id });
    }

    // Delete the participant record
    const deleteResult = await query(
      `DELETE FROM communities.activity_participants
       WHERE activity_id = $1 AND user_id = $2`,
      [activityId, userId]
    );

    // Decrement counter only if a row was actually deleted
    if (deleteResult.rowCount && deleteResult.rowCount > 0) {
      await query(
        `UPDATE communities.activities
         SET current_participants = GREATEST(0, current_participants - 1)
         WHERE id = $1`,
        [activityId]
      );
    }

    sendSuccess(res, { message: 'Left activity successfully' }, HTTP_STATUS.OK, { requestId: req.id });
  } catch (error: any) {
    (req as any).logger?.error('Error leaving activity', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'DELETE /activities/:activityId/leave' });
    sendInternalError(res, 'Failed to leave activity', error instanceof Error ? error : undefined, { requestId: req.id });
  }
});

export default router;
