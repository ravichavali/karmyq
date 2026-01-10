/**
 * Browse requests workflow
 */

import { Workflow } from '../types';
import { delay, randomInt } from '../utils';

/**
 * User browses available requests
 */
export const browseWorkflow: Workflow = async (context) => {
  const { session, sessionManager } = context;
  const client = sessionManager.getClient(session);

  console.log(`[${session.user.email}] Browsing requests...`);

  try {
    // Get requests from API
    const requests = await sessionManager.executeAction(
      session,
      'browseRequests',
      () => client.browseRequests({ limit: 10 })
    );

    if (!requests || requests.length === 0) {
      console.log(`[${session.user.email}] No requests found`);
      return;
    }

    console.log(`[${session.user.email}] Found ${requests.length} requests`);

    // Simulate reading through requests
    const numToView = randomInt(3, Math.min(requests.length, 8));

    for (let i = 0; i < numToView; i++) {
      // Random delay between viewing each request (5-15 seconds)
      await delay({ min: 5, max: 15, unit: 'seconds' });
    }

    console.log(`[${session.user.email}] Browsed ${numToView} requests`);

  } catch (error: any) {
    console.error(`[${session.user.email}] Browse workflow failed:`, error.message);
  }
};
