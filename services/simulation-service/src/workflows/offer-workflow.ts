/**
 * Offer help workflow
 */

import { Workflow } from '../types';
import { delay, pickRandom, OFFER_MESSAGES } from '../utils';

/**
 * User offers help on a request
 */
export const offerHelpWorkflow: Workflow = async (context) => {
  const { session, sessionManager } = context;
  const client = sessionManager.getClient(session);

  console.log(`[${session.user.email}] Offering help...`);

  try {
    // Browse available requests
    const requests = await sessionManager.executeAction(
      session,
      'browseRequests',
      () => client.browseRequests({ limit: 10 })
    );

    if (!requests || requests.length === 0) {
      console.log(`[${session.user.email}] No requests to offer help on`);
      return;
    }

    // Pick a random request (simulate choosing one that looks interesting)
    await delay({ min: 5, max: 20, unit: 'seconds' });

    const request = pickRandom(requests) as any;

    // Read the request details
    await delay({ min: 3, max: 10, unit: 'seconds' });

    // Decide whether to offer help (70% chance)
    if (Math.random() > 0.7) {
      console.log(`[${session.user.email}] Decided not to offer help on this request`);
      return;
    }

    // Compose offer message (simulate thinking)
    await delay({ min: 5, max: 15, unit: 'seconds' });

    const message = pickRandom(OFFER_MESSAGES);

    // Create the offer
    const offer = await sessionManager.executeAction(
      session,
      'createOffer',
      () => client.createOffer(request.id, message)
    );

    if (offer) {
      console.log(`[${session.user.email}] Offered help on request: "${request.title}"`);
    }

  } catch (error: any) {
    console.error(`[${session.user.email}] Offer help workflow failed:`, error.message);
  }
};
