import Queue from 'bull';
import { awardKarmaForCompletedMatch } from '../services/karmaService';
import { query } from '../database/db';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Event queue - must match the queue name used by publishers
const eventQueue = new Queue('karmyq-events', REDIS_URL);

/**
 * After a match completes, recalculate completion_rate for the provider (if any).
 * completion_rate = completed_matches / accepted_matches on provider_trust_scores.
 * Cross-schema query: requests.provider_profiles → reputation.provider_trust_scores.
 */
export async function updateProviderCompletionRate(user_id: string): Promise<void> {
  // Look up the provider profile — user may have multiple service types
  const profileResult = await query(
    `SELECT id FROM requests.provider_profiles WHERE user_id = $1 AND is_active = TRUE`,
    [user_id]
  );

  if (profileResult.rowCount === 0) return; // not a provider

  for (const { id: provider_id } of profileResult.rows) {
    // Count accepted matches (offer accepted by provider) and completed matches
    const statsResult = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('accepted', 'completed')) AS accepted_matches,
         COUNT(*) FILTER (WHERE status = 'completed') AS completed_matches
       FROM requests.matches
       WHERE responder_id = $1`,
      [user_id]
    );

    const { accepted_matches, completed_matches } = statsResult.rows[0];
    const accepted = parseInt(accepted_matches) || 0;
    const completed = parseInt(completed_matches) || 0;
    const completion_rate = accepted > 0 ? parseFloat(((completed / accepted) * 100).toFixed(2)) : 0;

    // Upsert trust score row, then recompute overall trust_score
    // Formula: 60% avg_stars + 30% completion_rate + 10% response_rate (ADR-042)
    await query(
      `INSERT INTO reputation.provider_trust_scores (provider_id, completion_rate, last_calculated)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (provider_id) DO UPDATE SET
         completion_rate = $2,
         trust_score = LEAST(100, ROUND(
           (reputation.provider_trust_scores.avg_stars / 5.0 * 100 * 0.6) +
           ($2 * 0.3) +
           (reputation.provider_trust_scores.response_rate * 0.1)
         )::INTEGER),
         last_calculated = CURRENT_TIMESTAMP`,
      [provider_id, completion_rate]
    );

    console.log(`✅ Provider completion_rate updated: provider=${provider_id} rate=${completion_rate}%`);
  }
}

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
