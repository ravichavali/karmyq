import Queue from 'bull';
import { awardKarmaForCompletedMatch } from '../services/karmaService';
import { checkAndAwardBadges } from '../services/badgeService';
import { updateProviderCompletionRate } from '../services/providerTrustService';
import { query } from '../database/db';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Event queue - must match the queue name used by publishers
const eventQueue = new Queue('karmyq-events', REDIS_URL);

export { updateProviderCompletionRate };

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

        // Update provider completion_rate if responder is a registered provider
        await updateProviderCompletionRate(responder_id);

        // Check and award prestige badges to the helper
        await checkAndAwardBadges(responder_id);
      } catch (error) {
        console.error('❌ Failed to award karma for match:', match_id, error);
        throw error; // Will retry based on Bull's retry settings
      }
    });

    // Process interaction_feedback_submitted events
    eventQueue.process('interaction_feedback_submitted', async (job) => {
      console.log('Processing interaction_feedback_submitted event:', job.data);

      const { payload } = job.data;
      const { to_user_id, helpfulness, responsiveness, clarity, community_id } = payload;

      try {
        // Get current trust score for the user
        const trustScoreResult = await query(
          `SELECT id, avg_helpfulness, avg_responsiveness, avg_clarity, total_feedback_received
           FROM reputation.trust_scores
           WHERE user_id = $1 AND community_id = $2`,
          [to_user_id, community_id]
        );

        if (trustScoreResult.rowCount === 0) {
          console.log('No trust score found for user, skipping feedback update');
          return;
        }

        const trustScore = trustScoreResult.rows[0];
        const currentTotal = trustScore.total_feedback_received || 0;
        const newTotal = currentTotal + 1;

        // Calculate new averages (weighted by total feedback received)
        const newAvgHelpfulness = helpfulness
          ? ((trustScore.avg_helpfulness * currentTotal) + helpfulness) / newTotal
          : trustScore.avg_helpfulness;

        const newAvgResponsiveness = responsiveness
          ? ((trustScore.avg_responsiveness * currentTotal) + responsiveness) / newTotal
          : trustScore.avg_responsiveness;

        const newAvgClarity = clarity
          ? ((trustScore.avg_clarity * currentTotal) + clarity) / newTotal
          : trustScore.avg_clarity;

        // Update trust score with new interaction quality metrics
        await query(
          `UPDATE reputation.trust_scores
           SET avg_helpfulness = $1,
               avg_responsiveness = $2,
               avg_clarity = $3,
               total_feedback_received = $4,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $5`,
          [
            parseFloat(newAvgHelpfulness.toFixed(2)),
            parseFloat(newAvgResponsiveness.toFixed(2)),
            parseFloat(newAvgClarity.toFixed(2)),
            newTotal,
            trustScore.id
          ]
        );

        console.log('✅ Trust score updated with interaction feedback for user:', to_user_id);
      } catch (error) {
        console.error('❌ Failed to update trust score with feedback:', error);
        throw error;
      }
    });

    console.log('✅ Event subscriber initialized');
  } catch (error) {
    console.error('❌ Event subscriber initialization failed:', error);
    throw error;
  }
}

export default eventQueue;
