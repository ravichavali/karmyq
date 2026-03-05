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

export const completeMatchWorkflow: Workflow = async (context) => {
  const { session, sessionManager } = context;
  const client = sessionManager.getClient(session);

  console.log(`[${session.user.email}] Checking for matches to complete...`);

  try {
    // Fetch matches in both active and matched states
    const activeMatches = await sessionManager.executeAction(
      session,
      'getMatches',
      () => client.getMatches({ status: 'active' })
    );

    const matchedMatches = await sessionManager.executeAction(
      session,
      'getMatchesMatched',
      () => client.getMatches({ status: 'matched' })
    );

    const allActiveMatches = [
      ...(activeMatches || []),
      ...(matchedMatches || []),
    ];

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

      // 90% chance to complete each match
      if (Math.random() > 0.9) continue;

      await delay({ min: 5, max: 15, unit: 'seconds' });

      const isResponder = match.responder_id === session.user.id;

      // Generate feedback (responder rates the experience; requester just confirms done)
      const rating = Math.random() < 0.8 ? 5 : 4;
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
      const comment = rating >= 4 ? pickRandom(positiveComments) : pickRandom(neutralComments);

      const payload = isResponder ? { rating, comment } : {};

      const result = await sessionManager.executeAction(
        session,
        'completeMatch',
        () => client.completeMatch(match.id, payload)
      );

      if (result) {
        const role = isResponder ? 'helper' : 'requester';
        const fullyDone = result.fully_completed;
        console.log(
          `[${session.user.email}] Marked done as ${role} on match ${match.id}` +
          (fullyDone ? ' — BOTH SIDES DONE, karma awarded' : ' — waiting for other side')
        );
        completed++;
      }
    }

    if (completed > 0) {
      console.log(`[${session.user.email}] Completed ${completed} match sides this session`);
    }

  } catch (error: any) {
    console.error(`[${session.user.email}] Complete match workflow failed:`, error.message);
  }
};
