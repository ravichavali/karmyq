/**
 * Create request workflow - uses polymorphic request types
 */

import { Workflow } from '../types';
import { delay, pickRandom } from '../utils';
import { generateRandomRequest } from '../data/realistic-data';

/**
 * User creates a help request using one of the 5 polymorphic types
 */
export const createRequestWorkflow: Workflow = async (context) => {
  const { session, sessionManager } = context;
  const client = sessionManager.getClient(session);

  console.log(`[${session.user.email}] Creating a request...`);

  try {
    // Get user's communities
    const communities = await sessionManager.executeAction(
      session,
      'getCommunities',
      () => client.getCommunities(session.user.id)
    );

    if (!communities || communities.length === 0) {
      console.log(`[${session.user.email}] No communities to post to`);
      return;
    }

    // Pick a random community
    const community = pickRandom(communities) as any;

    // Think about what to request (simulate typing)
    await delay({ min: 10, max: 30, unit: 'seconds' });

    // Generate a random polymorphic request
    const generated = generateRandomRequest();

    const requestData: any = {
      community_id: community.id,
      title: generated.title,
      description: generated.description,
      urgency: generated.urgency,
      request_type: generated.request_type
    };

    // Add payload for non-generic request types
    if (generated.payload) {
      requestData.payload = generated.payload;
    }

    // Create the request
    const request = await sessionManager.executeAction(
      session,
      'createRequest',
      () => client.createRequest(requestData)
    );

    if (request) {
      console.log(`[${session.user.email}] Created ${generated.request_type} request: "${generated.title}"`);
    }

  } catch (error: any) {
    console.error(`[${session.user.email}] Create request workflow failed:`, error.message);
  }
};
