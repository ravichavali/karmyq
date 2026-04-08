/**
 * Create community workflow
 *
 * Uses realistic community templates from realistic-data.ts
 * to create new communities for the platform.
 */

import { Workflow } from '../types';
import { delay, pickRandom } from '../utils';
import { COMMUNITIES, GROUP_COMMUNITIES } from '../data/realistic-data';

/**
 * User creates a new community from a realistic template
 */
export const createCommunityWorkflow: Workflow = async (context) => {
  const { session, sessionManager } = context;
  const client = sessionManager.getClient(session);

  console.log(`[${session.user.email}] Considering creating a community...`);

  try {
    // Check how many communities already exist - cap at 10
    const existing = await sessionManager.executeAction(
      session,
      'discoverCommunities',
      () => client.discoverCommunities({ limit: 11 })
    );

    if (existing && existing.length >= 15) {
      console.log(`[${session.user.email}] Already ${existing.length} communities, skipping creation`);
      return;
    }

    // Pick a random community template — 3:1 weight toward mutual aid communities
    const weightedPool = [...COMMUNITIES, ...COMMUNITIES, ...COMMUNITIES, ...GROUP_COMMUNITIES];
    const template = pickRandom(weightedPool);

    const communityName = template.name;

    // Simulate thinking about community details
    await delay({ min: 10, max: 25, unit: 'seconds' });

    // Create the community
    const community = await sessionManager.executeAction(
      session,
      'createCommunity',
      () => client.createCommunity({
        name: communityName,
        description: template.description,
        location: template.location,
        category: template.category,
        access_type: 'public',
        community_type: (template as any).community_type ?? 'mutual_aid',
      })
    );

    if (community) {
      console.log(`[${session.user.email}] Created community: "${communityName}"`);
    }

  } catch (error: any) {
    console.error(`[${session.user.email}] Create community workflow failed:`, error.message);
  }
};
