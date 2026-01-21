/**
 * Create request workflow
 */

import { Workflow } from '../types';
import { delay, pickRandom, REQUEST_TITLES } from '../utils';

/**
 * User creates a help request
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

    // Generate request data
    const title = pickRandom(REQUEST_TITLES);
    const descriptions = [
      `I could really use some help with this. Let me know if you're available!`,
      `Would appreciate any assistance with this. Thanks in advance!`,
      `Looking for someone who can help out. Happy to return the favor!`,
      `Need help with this soon. Please reach out if you can assist.`,
      `This would be a huge help if anyone is available. Thanks!`
    ];

    const categories = ['transportation', 'moving_help', 'childcare', 'tech_help', 'home_repair', 'other'];
    const urgencies = ['low', 'medium', 'high'];

    const requestData = {
      community_id: community.id,
      title,
      description: pickRandom(descriptions),
      category: pickRandom(categories),
      urgency: pickRandom(urgencies)
    };

    // Create the request
    const request = await sessionManager.executeAction(
      session,
      'createRequest',
      () => client.createRequest(requestData)
    );

    if (request) {
      console.log(`[${session.user.email}] Created request: "${title}"`);
    }

  } catch (error: any) {
    console.error(`[${session.user.email}] Create request workflow failed:`, error.message);
  }
};
