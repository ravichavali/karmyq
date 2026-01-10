/**
 * Complete match workflow
 */

import { Workflow } from '../types';
import { delay, pickRandom, randomInt } from '../utils';

/**
 * User completes a match and provides feedback
 */
export const completeMatchWorkflow: Workflow = async (context) => {
  const { session, sessionManager } = context;
  const client = sessionManager.getClient(session);

  console.log(`[${session.user.email}] Checking for matches to complete...`);

  try {
    // Get active matches
    const matches = await sessionManager.executeAction(
      session,
      'getMatches',
      () => client.getMatches({ status: 'active' })
    );

    if (!matches || matches.length === 0) {
      console.log(`[${session.user.email}] No active matches to complete`);
      return;
    }

    console.log(`[${session.user.email}] Found ${matches.length} active matches`);

    // Only complete some matches (30% chance per match)
    for (const match of matches) {
      if (Math.random() > 0.3) {
        continue;
      }

      // Simulate time passing (the help was completed)
      await delay({ min: 5, max: 15, unit: 'seconds' });

      // Generate feedback
      const ratings = [4, 5]; // Mostly positive ratings (80% are 4-5 stars)
      if (Math.random() < 0.8) {
        ratings.push(5);
      }

      const rating = pickRandom(ratings);

      const positiveComments = [
        'Very helpful, thank you!',
        'Great experience, highly recommend!',
        'Quick and professional, thank you so much!',
        'Exactly what I needed, thanks!',
        'Couldn\'t have done it without your help!',
        'Amazing! Thank you for your time and effort.',
        'Very kind and helpful person!',
        'Perfect, thank you!'
      ];

      const neutralComments = [
        'Thanks for the help',
        'Got the job done',
        'Appreciated',
        'Good'
      ];

      const comment = rating >= 4 ? pickRandom(positiveComments) : pickRandom(neutralComments);

      // Complete the match
      const completed = await sessionManager.executeAction(
        session,
        'completeMatch',
        () => client.completeMatch(match.id, { rating, comment })
      );

      if (completed) {
        console.log(`[${session.user.email}] Completed match with ${rating} stars`);
      }

      // Only complete one match per session (realistic behavior)
      break;
    }

  } catch (error: any) {
    console.error(`[${session.user.email}] Complete match workflow failed:`, error.message);
  }
};
