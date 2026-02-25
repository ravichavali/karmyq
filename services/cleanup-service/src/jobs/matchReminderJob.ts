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
 * Match Reminder Job
 * Runs every 15 minutes. Finds accepted matches where the helper's departure time
 * (scheduled_at - travel_time_minutes) falls within the next 15 minutes,
 * then publishes a match_reminder event so the notification service can alert the helper.
 */
export async function sendMatchReminders(): Promise<void> {
  logger.info('Starting match reminder job');

  try {
    const result = await pool.query(`
      SELECT
        m.id,
        m.responder_id,
        m.requester_id,
        m.scheduled_at,
        m.travel_time_minutes,
        r.title,
        r.request_type,
        r.payload
      FROM requests.matches m
      JOIN requests.help_requests r ON m.request_id = r.id
      WHERE m.status = 'matched'
        AND m.scheduled_at IS NOT NULL
        AND m.scheduled_at > NOW()
        AND (m.scheduled_at - (m.travel_time_minutes || ' minutes')::INTERVAL)
            BETWEEN NOW() AND NOW() + INTERVAL '15 minutes'
    `);

    if (result.rows.length === 0) {
      logger.info('No match reminders to send');
      return;
    }

    logger.info(`Sending ${result.rows.length} match reminder(s)`);
    const queue = getQueue();

    for (const match of result.rows) {
      await queue.add('match_reminder', {
        eventType: 'match_reminder',
        payload: {
          match_id: match.id,
          responder_id: match.responder_id,
          requester_id: match.requester_id,
          request_title: match.title,
          request_type: match.request_type,
          scheduled_at: match.scheduled_at,
          travel_time_minutes: match.travel_time_minutes,
          payload: match.payload,
        },
        timestamp: new Date().toISOString(),
        source: 'cleanup-service',
      });

      logger.info('Published match_reminder event', {
        match_id: match.id,
        scheduled_at: match.scheduled_at,
        travel_time_minutes: match.travel_time_minutes,
      });
    }
  } catch (error) {
    logger.error('Match reminder job failed', { error });
  }
}
