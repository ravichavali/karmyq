import Queue from 'bull';
import { clearTrustPathCache } from '../services/pathComputation';
import { logger } from '../config/logger';
import { pool } from '../config/database';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const eventQueue = new Queue('karmyq-events', REDIS_URL);

export async function initEventSubscriber() {
  try {
    // When a match completes, the direct edge now exists — clear cached paths for these two users
    eventQueue.process('match_completed', async (job) => {
      logger.info('Processing match_completed event', job.data);

      const { payload } = job.data;
      const { requester_id, responder_id } = payload;

      try {
        // 1. Clear trust path cache (existing behavior — preserved)
        await clearTrustPathCache(requester_id, responder_id);
        logger.info('✅ Trust path cache cleared for completed match', { requester_id, responder_id });

        // 2. Upsert into social_graph.connections (Sprint 27)
        await pool.query(
          `INSERT INTO social_graph.connections
             (user_a_id, user_b_id, type, first_connected_at, last_interaction_at)
           VALUES (
             LEAST($1::text, $2::text)::uuid,
             GREATEST($1::text, $2::text)::uuid,
             'exchange',
             now(),
             now()
           )
           ON CONFLICT (
             LEAST(user_a_id::text, user_b_id::text),
             GREATEST(user_a_id::text, user_b_id::text)
           )
           DO UPDATE SET last_interaction_at = now()`,
          [requester_id, responder_id]
        );
        logger.info('✅ social_graph.connections upserted', { requester_id, responder_id });
      } catch (error) {
        logger.error('❌ Failed to process match_completed', error instanceof Error ? error : undefined, { requester_id, responder_id });
        throw error;
      }
    });

    logger.info('✅ Social graph event subscriber initialized');
  } catch (error) {
    logger.error('❌ Event subscriber initialization failed', error instanceof Error ? error : undefined);
    throw error;
  }
}

export default eventQueue;
