/**
 * Complete match workflow
 *
 * Handles two-phase completion: both the requester and the responder
 * must call /complete for karma to be awarded (match_completed event fires
 * only when both requester_done_at and responder_done_at are set).
 *
 * This workflow detects the user's role on each match and calls /complete
 * from whichever side they are on.
 */

import { Workflow } from '../types';
import { delay, pickRandom } from '../utils';
import { ApiClient } from '../api-client';

/**
 * After the requester marks a match done, check if the responder is a provider.
 * If so, submit a star review — this is how avg_stars gets populated on
 * reputation.provider_trust_scores (ADR-042, Sprint 28).
 */
async function submitProviderReviewIfApplicable(
  client: ApiClient,
  session: { user: { id: string; email: string } },
  match: any
): Promise<void> {
  try {
    // Look up provider profiles for the responder (helper)
    const responderProfiles = await client.getProvidersByUser(match.responder_id);
    if (!responderProfiles || responderProfiles.length === 0) return;

    // Use the first active provider profile; log but don't throw on failure
    const provider = responderProfiles[0];

    const stars = Math.random() < 0.8 ? 5 : 4;
    const positiveComments = [
      'Very helpful, thank you!',
      'Great experience, highly recommend!',
      'Quick and professional, thank you so much!',
      'Exactly what I needed, thanks!',
      "Couldn't have done it without your help!",
      'Amazing! Thank you for your time and effort.',
      'Very kind and helpful person!',
      'Perfect, thank you!',
    ];
    const neutralComments = ['Thanks for the help', 'Got the job done', 'Appreciated', 'Good'];
    const reviewText = stars >= 4 ? pickRandom(positiveComments) : pickRandom(neutralComments);

    await client.submitProviderReview(provider.id, match.id, stars, reviewText);

    console.log(
      `[${session.user.email}] Submitted ${stars}★ review for provider "${provider.display_name}" (${provider.id})`
    );
  } catch (err: any) {
    // 409 = already reviewed this match; safe to ignore
    if (err?.response?.status !== 409) {
      console.warn(`[${session.user.email}] Could not submit provider review:`, err?.message);
    }
  }
}

export const completeMatchWorkflow: Workflow = async (context) => {
  const { session, sessionManager } = context;
  const client = sessionManager.getClient(session);

  console.log(`[${session.user.email}] Checking for matches to complete...`);

  try {
    // Fetch matches in 'matched' state (the only valid in-progress status)
    const matchedMatches = await sessionManager.executeAction(
      session,
      'getMatchesMatched',
      () => client.getMatches({ status: 'matched' })
    );

    const allActiveMatches = matchedMatches || [];

    if (allActiveMatches.length === 0) {
      console.log(`[${session.user.email}] No active matches to complete`);
      return;
    }

    // Filter to matches where this user hasn't yet marked done on their side
    // and is not both requester AND responder (self-match guard)
    const completable = allActiveMatches.filter((m: any) => {
      if (m.responder_id === m.requester_id) return false; // self-match, skip
      const isRequester = m.requester_id === session.user.id;
      const isResponder = m.responder_id === session.user.id;
      if (!isRequester && !isResponder) return false;
      if (isRequester && m.requester_done_at) return false; // already done on my side
      if (isResponder && m.responder_done_at) return false; // already done on my side
      return true;
    });

    if (completable.length === 0) {
      console.log(`[${session.user.email}] No completable matches (already marked done or not a participant)`);
      return;
    }

    console.log(`[${session.user.email}] Found ${completable.length} completable matches`);

    let completed = 0;
    const maxCompletions = 3;

    for (const match of completable) {
      if (completed >= maxCompletions) break;

      // 50% chance to complete each match (was 10% — increased to generate completions)
      if (Math.random() > 0.5) continue;

      await delay({ min: 5, max: 15, unit: 'seconds' });

      const isResponder = match.responder_id === session.user.id;
      const isRequester = match.requester_id === session.user.id;

      const result = await sessionManager.executeAction(
        session,
        'completeMatch',
        () => client.completeMatch(match.id, session.user.id)
      );

      if (result) {
        const role = isResponder ? 'helper' : 'requester';
        const fullyDone = result.fully_completed;
        console.log(
          `[${session.user.email}] Marked done as ${role} on match ${match.id}` +
          (fullyDone ? ' — BOTH SIDES DONE, karma awarded' : ' — waiting for other side')
        );
        completed++;

        // When the requester marks done, submit a provider review for the helper
        // (if the helper is a registered provider). This is how avg_stars gets populated.
        if (isRequester) {
          await submitProviderReviewIfApplicable(client, session, match);
        }
      }
    }

    if (completed > 0) {
      console.log(`[${session.user.email}] Completed ${completed} match sides this session`);
    }

  } catch (error: any) {
    console.error(`[${session.user.email}] Complete match workflow failed:`, error.message);
  }
};
