import { query } from '../database/db';
import { generateNotification, NotificationType } from '../templates/notificationTemplates';
import { EventEmitter } from 'events';

// Event emitter for real-time notifications (SSE)
export const notificationEmitter = new EventEmitter();

interface CreateNotificationParams {
  user_id: string;
  type: NotificationType;
  data: any;
}

interface UserPreferences {
  in_app_enabled: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
}

// Create a notification
export async function createNotification(params: CreateNotificationParams) {
  const { user_id, type, data } = params;

  // Check user preferences
  const shouldSend = await shouldSendNotification(user_id, type);
  if (!shouldSend.in_app_enabled) {
    console.log(`Notification ${type} skipped for user ${user_id} (disabled in preferences)`);
    return null;
  }

  // Generate notification from template
  const notification = generateNotification(type, data);

  // Insert into database
  const result = await query(
    `INSERT INTO notifications.notifications
     (user_id, type, title, body, data, action_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      user_id,
      notification.type,
      notification.title,
      notification.body,
      JSON.stringify(notification.data),
      notification.action_url,
    ]
  );

  const createdNotification = result.rows[0];

  // Emit real-time event for SSE
  notificationEmitter.emit('notification', {
    user_id,
    notification: createdNotification,
  });

  console.log(`✅ Notification created: ${type} for user ${user_id}`);

  return createdNotification;
}

// Check if notification should be sent based on preferences
async function shouldSendNotification(
  user_id: string,
  event_type: NotificationType
): Promise<UserPreferences> {
  // First check global preferences
  const globalPrefs = await query(
    `SELECT in_app_enabled, push_enabled, email_enabled
     FROM notifications.global_preferences
     WHERE user_id = $1`,
    [user_id]
  );

  // If no global preferences exist, create defaults
  if (globalPrefs.rows.length === 0) {
    await query(
      `INSERT INTO notifications.global_preferences (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [user_id]
    );
    return { in_app_enabled: true, push_enabled: true, email_enabled: false };
  }

  // Check event-specific preferences
  const eventPrefs = await query(
    `SELECT in_app_enabled, push_enabled, email_enabled
     FROM notifications.preferences
     WHERE user_id = $1 AND event_type = $2 AND community_id IS NULL`,
    [user_id, event_type]
  );

  if (eventPrefs.rows.length > 0) {
    return eventPrefs.rows[0];
  }

  // Fall back to global preferences
  return globalPrefs.rows[0];
}

// Get user's notifications
export async function getUserNotifications(user_id: string, limit: number = 50, offset: number = 0) {
  const result = await query(
    `SELECT * FROM notifications.notifications
     WHERE user_id = $1 AND expired = FALSE
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [user_id, limit, offset]
  );

  return result.rows;
}

// Get unread count
export async function getUnreadCount(user_id: string) {
  const result = await query(
    `SELECT COUNT(*) as count
     FROM notifications.notifications
     WHERE user_id = $1 AND read = FALSE AND expired = FALSE`,
    [user_id]
  );

  return parseInt(result.rows[0].count);
}

// Mark notification as read
export async function markAsRead(notification_id: string, user_id: string) {
  const result = await query(
    `UPDATE notifications.notifications
     SET read = TRUE, read_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [notification_id, user_id]
  );

  return result.rows[0];
}

// Mark all as read
export async function markAllAsRead(user_id: string) {
  const result = await query(
    `UPDATE notifications.notifications
     SET read = TRUE, read_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND read = FALSE
     RETURNING COUNT(*) as count`,
    [user_id]
  );

  return result.rowCount;
}

// Delete notification
export async function deleteNotification(notification_id: string, user_id: string) {
  const result = await query(
    `DELETE FROM notifications.notifications
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [notification_id, user_id]
  );

  return result.rows[0];
}

// Get user preferences
export async function getUserPreferences(user_id: string) {
  const globalPrefs = await query(
    `SELECT * FROM notifications.global_preferences
     WHERE user_id = $1`,
    [user_id]
  );

  const eventPrefs = await query(
    `SELECT * FROM notifications.preferences
     WHERE user_id = $1`,
    [user_id]
  );

  return {
    global: globalPrefs.rows[0] || null,
    events: eventPrefs.rows,
  };
}

// Update global preferences
export async function updateGlobalPreferences(user_id: string, preferences: Partial<UserPreferences>) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (preferences.in_app_enabled !== undefined) {
    fields.push(`in_app_enabled = $${paramIndex++}`);
    values.push(preferences.in_app_enabled);
  }
  if (preferences.push_enabled !== undefined) {
    fields.push(`push_enabled = $${paramIndex++}`);
    values.push(preferences.push_enabled);
  }
  if (preferences.email_enabled !== undefined) {
    fields.push(`email_enabled = $${paramIndex++}`);
    values.push(preferences.email_enabled);
  }

  values.push(user_id);

  const result = await query(
    `INSERT INTO notifications.global_preferences (user_id, in_app_enabled, push_enabled, email_enabled)
     VALUES ($${paramIndex}, ${preferences.in_app_enabled !== undefined ? `$1` : 'TRUE'}, ${preferences.push_enabled !== undefined ? `$${preferences.in_app_enabled !== undefined ? 2 : 1}` : 'TRUE'}, ${preferences.email_enabled !== undefined ? `$${paramIndex - 1}` : 'FALSE'})
     ON CONFLICT (user_id)
     DO UPDATE SET ${fields.join(', ')}
     RETURNING *`,
    values
  );

  return result.rows[0];
}

// Update event-specific preferences
export async function updateEventPreferences(
  user_id: string,
  event_type: NotificationType,
  preferences: Partial<UserPreferences>
) {
  const result = await query(
    `INSERT INTO notifications.preferences (user_id, event_type, in_app_enabled, push_enabled, email_enabled)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, community_id, event_type)
     WHERE community_id IS NULL
     DO UPDATE SET
       in_app_enabled = COALESCE($3, notifications.preferences.in_app_enabled),
       push_enabled = COALESCE($4, notifications.preferences.push_enabled),
       email_enabled = COALESCE($5, notifications.preferences.email_enabled)
     RETURNING *`,
    [
      user_id,
      event_type,
      preferences.in_app_enabled,
      preferences.push_enabled,
      preferences.email_enabled,
    ]
  );

  return result.rows[0];
}
