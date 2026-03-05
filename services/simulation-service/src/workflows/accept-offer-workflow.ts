/**
 * Accept offer workflow
 *
 * The critical piece for correlated demo data.
 * Requester checks for proposed matches on their requests and accepts them.
 * Flow: request created → helper offers (proposed match) → requester ACCEPTS → match is active
 */

import { Workflow } from '../types';
import { delay } from '../utils';

/**
 * User checks for proposed matches where they are the requester, and accepts them
 */
export const acceptOfferWorkflow: Workflow = async (context) => {
  const { session, sessionManager } = context;
  const client = sessionManager.getClient(session);

  console.log(`[${session.user.email}] Checking for proposed matches to accept...`);

  try {
    // Get all proposed matches
    const proposedMatches = await sessionManager.executeAction(
      session,
      'getProposedMatches',
      () => client.getMatches({ status: 'proposed' })
    );

    if (!proposedMatches || proposedMatches.length === 0) {
      console.log(`[${session.user.email}] No proposed matches found`);
      return;
    }

    // Filter to matches where this user is the requester (and not also the responder — self-match guard)
    const myMatches = proposedMatches.filter(
      (m: any) => m.requester_id === session.user.id && m.responder_id !== session.user.id
    );

    if (myMatches.length === 0) {
      console.log(`[${session.user.email}] No proposed matches for my requests`);
      return;
    }

    console.log(`[${session.user.email}] Found ${myMatches.length} proposed matches for my requests`);

    // Process matches (accept up to 3 per session)
    let accepted = 0;
    const maxAccepts = 3;

    for (const match of myMatches) {
      if (accepted >= maxAccepts) break;

      // 85% chance to accept each proposed match
      if (Math.random() > 0.85) {
        console.log(`[${session.user.email}] Decided to wait on match for: "${match.request_title}"`);
        continue;
      }

      // Simulate reviewing the offer
      await delay({ min: 5, max: 15, unit: 'seconds' });

      const result = await sessionManager.executeAction(
        session,
        'acceptMatch',
        () => client.acceptMatch(match.id, session.user.id)
      );

      if (result) {
        console.log(`[${session.user.email}] Accepted help from ${match.responder_name || 'someone'} on: "${match.request_title}"`);
        accepted++;
      }
    }

    if (accepted > 0) {
      console.log(`[${session.user.email}] Accepted ${accepted} matches this session`);
    }

  } catch (error: any) {
    console.error(`[${session.user.email}] Accept offer workflow failed:`, error.message);
  }
};
