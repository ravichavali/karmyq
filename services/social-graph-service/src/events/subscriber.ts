import Queue from 'bull';
import { clearTrustPathCache } from '../services/pathComputation';
import { logger } from '../config/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const eventQueue = new Queue('karmyq-events', REDIS_URL);

export async function initEventSubscriber() {
  try {
    // When a match completes, the direct edge now exists — clear cached paths for these two users
    eventQueue.process('match_completed', async (job) => {
      logger.info('Processing match_completed event for trust path cache invalidation', job.data);

      const { payload } = job.data;
      const { requester_id, responder_id } = payload;

      try {
        await clearTrustPathCache(requester_id, responder_id);
        logger.info('✅ Trust path cache cleared for completed match', { requester_id, responder_id });
      } catch (error) {
        logger.error('❌ Failed to clear trust path cache', { requester_id, responder_id, error });
        throw error;
      }
    });

    logger.info('✅ Social graph event subscriber initialized');
  } catch (error) {
    logger.error('❌ Event subscriber initialization failed', { error });
    throw error;
  }
}

export default eventQueue;
