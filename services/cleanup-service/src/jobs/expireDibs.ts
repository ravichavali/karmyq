import Queue from 'bull';
import { logger } from '../utils/logger';
import pool from '../database/db';

let eventQueue: Queue.Queue | null = null;

function getQueue(): Queue.Queue {
  if (!eventQueue) {
    eventQueue = new Queue('karmyq-events', process.env.REDIS_URL || 'redis://localhost:6379');
  }
  return eventQueue;
}

/**
 * Dibs Expiry Job
 * Runs every 5 minutes. Finds pending dibs records where expires_at < NOW(),
 * marks them as expired, resets the request status to 'open' for public broadcast,
 * and publishes a dibs_expired event so the notification service can alert the requester.
 */
export async function expireDibs(): Promise<number> {
  logger.info('Starting dibs expiry job');

  try {
    // Find all pending dibs records that have expired
    const result = await pool.query(`
      SELECT d.id, d.request_id, d.provider_user_id
      FROM requests.dibs d
      WHERE d.status = 'pending' AND d.expires_at <= NOW()
    `);

    if (result.rows.length === 0) {
      logger.info('No expired dibs to process');
      return 0;
    }

    logger.info(`Expiring ${result.rows.length} dibs record(s)`);
    const queue = getQueue();
    let expiredCount = 0;

    for (const dibs of result.rows) {
      try {
        // Update dibs status to expired
        await pool.query(
          `UPDATE requests.dibs
           SET status = 'expired', updated_at = NOW()
           WHERE id = $1`,
          [dibs.id]
        );

        // Reset request status back to open for public broadcast
        await pool.query(
          `UPDATE requests.help_requests
           SET status = 'open', updated_at = NOW()
           WHERE id = $1`,
          [dibs.request_id]
        );

        // Publish event for notification service
        await queue.add('dibs_expired', {
          eventType: 'dibs_expired',
          payload: {
            dibs_id: dibs.id,
            request_id: dibs.request_id,
            provider_user_id: dibs.provider_user_id,
          },
          timestamp: new Date().toISOString(),
          source: 'cleanup-service',
        });

        logger.info('Expired dibs record', {
          dibs_id: dibs.id,
          request_id: dibs.request_id,
          provider_user_id: dibs.provider_user_id,
        });

        expiredCount++;
      } catch (error) {
        logger.error('Failed to expire dibs record', {
          dibs_id: dibs.id,
          request_id: dibs.request_id,
          error,
        });
      }
    }

    logger.info(`Successfully expired ${expiredCount} dibs record(s)`);
    return expiredCount;
  } catch (error) {
    logger.error('Dibs expiry job failed', { error });
    return 0;
  }
}
