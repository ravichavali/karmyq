import Queue from 'bull';
import { awardKarmaForCompletedMatch } from '../services/karmaService';
import { checkAndAwardBadges } from '../services/badgeService';
import { updateProviderCompletionRate } from '../services/providerTrustService';
import { query } from '../database/db';
import {
  evaluateUserEvolution,
  EVOLUTION_SIGNALS,
} from '../services/trustEvolutionService';
import {
  isCrossCommunityParticipant,
  getDiverseCommunityCount,
} from '../database/trustEvolutionDb';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function getRepeatMatchCount(userA: string, userB: string): Promise<number> {
  const result = await query(
    `SELECT COUNT(*) AS cnt
     FROM requests.matches m
     JOIN requests.help_requests hr ON m.request_id = hr.id
     WHERE m.status = 'completed'
       AND ((m.responder_id = $1 AND hr.requester_id = $2)
            OR (m.responder_id = $2 AND hr.requester_id = $1))`,
    [userA, userB]
  );
  return parseInt(result.rows[0]?.cnt ?? '0', 10);
}

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

        // Sprint 30: Trust evolution signals — iterate per community
        // Wrapped in its own outer try/catch so a failure here never causes Bull
        // to retry the whole job (which would re-run karma awards already completed).
        try {
          // Query the same request_communities the karma service uses so evolution
          // is scoped to the correct community context for each match.
          const commResult = await query(
            `SELECT DISTINCT rc.community_id
             FROM requests.request_communities rc
             JOIN communities.members cm ON rc.community_id = cm.community_id
               AND cm.user_id = $1 AND cm.status = 'active'
             WHERE rc.request_id = $2`,
            [responder_id, request_id]
          );
          const communityIds: string[] = commResult.rows.map((r: { community_id: string }) => r.community_id);

          // Hoist invariant queries above the loop — results don't vary per community
          const repeatCount = await getRepeatMatchCount(responder_id, requester_id);
          const diverseCount = await getDiverseCommunityCount(responder_id, 30);

          for (const communityId of communityIds) {
            try {
              const isCrossComm = await isCrossCommunityParticipant(requester_id, communityId);
              if (isCrossComm) {
                await evaluateUserEvolution(
                  responder_id, communityId,
                  EVOLUTION_SIGNALS.CROSS_COMMUNITY_MATCH_COMPLETED,
                  { triggerEventId: match_id }
                );
              }
              // Repeat pair signal — checked once per match, community-scoped
              if (repeatCount >= 3) {
                await evaluateUserEvolution(
                  responder_id, communityId,
                  EVOLUTION_SIGNALS.REPEAT_INTERACTION_SAME_PERSON,
                  { triggerEventId: match_id }
                );
              }
              // Diverse communities signal — counts across all communities
              if (diverseCount >= 3) {
                await evaluateUserEvolution(
                  responder_id, communityId,
                  EVOLUTION_SIGNALS.DIVERSE_COMMUNITY_INTERACTIONS,
                  { triggerEventId: match_id }
                );
              }
            } catch (evolutionErr) {
              console.error('[trust-evolution] Error evaluating evolution signals:', evolutionErr);
              // Never rethrow — evolution errors must not fail match_completed processing
            }
          }
        } catch (evolutionOuterErr) {
          console.error('[trust-evolution] evolution section failed, skipping:', evolutionOuterErr);
          // Never rethrow — evolution is non-critical; karma was already awarded
        }
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
