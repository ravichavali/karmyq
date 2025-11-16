import { query } from '../database/db';
import { logger } from '../utils/logger';

/**
 * Expiration Job
 * Marks expired data as expired (soft delete)
 * Runs every hour
 */

export async function markExpiredData(): Promise<void> {
  logger.info('Starting expiration job');

  try {
    const now = new Date().toISOString();
    let totalExpired = 0;

    // Mark expired help requests
    const requests = await query(
      `UPDATE requests.help_requests
       SET expired = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE expires_at <= $1 AND expired = FALSE AND status IN ('open', 'pending')
       RETURNING id`,
      [now]
    );
    logger.info(`Marked ${requests.rowCount} help requests as expired`);
    totalExpired += requests.rowCount || 0;

    // Mark expired help offers
    const offers = await query(
      `UPDATE requests.help_offers
       SET expired = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE expires_at <= $1 AND expired = FALSE AND status = 'active'
       RETURNING id`,
      [now]
    );
    logger.info(`Marked ${offers.rowCount} help offers as expired`);
    totalExpired += offers.rowCount || 0;

    // Mark expired messages
    const messages = await query(
      `UPDATE messaging.messages
       SET expired = TRUE
       WHERE expires_at <= $1 AND expired = FALSE
       RETURNING id`,
      [now]
    );
    logger.info(`Marked ${messages.rowCount} messages as expired`);
    totalExpired += messages.rowCount || 0;

    // Mark expired notifications
    const notifications = await query(
      `UPDATE notifications.notifications
       SET expired = TRUE
       WHERE expires_at <= $1 AND expired = FALSE
       RETURNING id`,
      [now]
    );
    logger.info(`Marked ${notifications.rowCount} notifications as expired`);
    totalExpired += notifications.rowCount || 0;

    logger.info(`Expiration job completed: ${totalExpired} items marked as expired`);
  } catch (error) {
    logger.error('Error in expiration job', { error });
    throw error;
  }
}

/**
 * Hard Delete Job
 * Permanently deletes data that has been marked expired for > 7 days
 * Runs once daily
 */
export async function hardDeleteExpiredData(): Promise<void> {
  logger.info('Starting hard delete job');

  try {
    const deleteThreshold = new Date();
    deleteThreshold.setDate(deleteThreshold.getDate() - 7); // 7 days grace period
    const threshold = deleteThreshold.toISOString();

    let totalDeleted = 0;

    // Delete old expired help requests
    const requests = await query(
      `DELETE FROM requests.help_requests
       WHERE expired = TRUE AND updated_at <= $1
       RETURNING id`,
      [threshold]
    );
    logger.info(`Permanently deleted ${requests.rowCount} expired help requests`);
    totalDeleted += requests.rowCount || 0;

    // Delete old expired help offers
    const offers = await query(
      `DELETE FROM requests.help_offers
       WHERE expired = TRUE AND updated_at <= $1
       RETURNING id`,
      [threshold]
    );
    logger.info(`Permanently deleted ${offers.rowCount} expired help offers`);
    totalDeleted += offers.rowCount || 0;

    // Delete old expired messages
    const messages = await query(
      `DELETE FROM messaging.messages
       WHERE expired = TRUE AND created_at <= $1
       RETURNING id`,
      [threshold]
    );
    logger.info(`Permanently deleted ${messages.rowCount} expired messages`);
    totalDeleted += messages.rowCount || 0;

    // Delete old expired notifications
    const notifications = await query(
      `DELETE FROM notifications.notifications
       WHERE expired = TRUE AND created_at <= $1
       RETURNING id`,
      [threshold]
    );
    logger.info(`Permanently deleted ${notifications.rowCount} expired notifications`);
    totalDeleted += notifications.rowCount || 0;

    logger.info(`Hard delete job completed: ${totalDeleted} items permanently deleted`);
  } catch (error) {
    logger.error('Error in hard delete job', { error });
    throw error;
  }
}

/**
 * Batch delete with progress logging
 * For very large datasets, delete in batches to avoid long locks
 */
export async function batchHardDelete(
  table: string,
  batchSize: number = 1000
): Promise<number> {
  const deleteThreshold = new Date();
  deleteThreshold.setDate(deleteThreshold.getDate() - 7);
  const threshold = deleteThreshold.toISOString();

  let totalDeleted = 0;
  let batchDeleted = 0;

  do {
    const result = await query(
      `DELETE FROM ${table}
       WHERE id IN (
         SELECT id FROM ${table}
         WHERE expired = TRUE AND updated_at <= $1
         LIMIT $2
       )
       RETURNING id`,
      [threshold, batchSize]
    );

    batchDeleted = result.rowCount || 0;
    totalDeleted += batchDeleted;

    if (batchDeleted > 0) {
      logger.info(`Batch deleted ${batchDeleted} from ${table}, total: ${totalDeleted}`);
    }
  } while (batchDeleted === batchSize);

  return totalDeleted;
}
