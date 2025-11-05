import Queue from 'bull';
import { awardKarmaForCompletedMatch } from '../services/karmaService';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Event queue - must match the queue name used by publishers
const eventQueue = new Queue('karmyq-events', REDIS_URL);

export async function initEventSubscriber() {
  try {
    // Process match_completed events
    eventQueue.process('match_completed', async (job) => {
      console.log('Processing match_completed event:', job.data);

      // Extract payload from the event wrapper
      const { payload } = job.data;
      const { match_id, request_id, requester_id, responder_id } = payload;

      try {
        // Award karma to both parties
        await awardKarmaForCompletedMatch({
          match_id,
          request_id,
          requester_id,
          responder_id,
        });

        console.log('✅ Karma awarded for match:', match_id);
      } catch (error) {
        console.error('❌ Failed to award karma for match:', match_id, error);
        throw error; // Will retry based on Bull's retry settings
      }
    });

    console.log('✅ Event subscriber initialized');
  } catch (error) {
    console.error('❌ Event subscriber initialization failed:', error);
    throw error;
  }
}

export default eventQueue;
