/**
 * Join community workflow
 *
 * Users discover and join communities to participate in the platform.
 * This is typically the first action a new user takes.
 */

import { Workflow } from '../types';
import { delay, randomInt } from '../utils';

/**
 * User discovers communities and joins one or more
 */
export const joinCommunityWorkflow: Workflow = async (context) => {
  const { session, sessionManager } = context;
  const client = sessionManager.getClient(session);

  console.log(`[${session.user.email}] Discovering communities...`);

  try {
    // First check if user already has communities
    const myCommunities = await sessionManager.executeAction(
      session,
      'getMyCommunities',
      () => client.getCommunities()
    );

    if (myCommunities && myCommunities.length > 0) {
      console.log(`[${session.user.email}] Already member of ${myCommunities.length} communities`);
      return;
    }

    // Discover available communities
    const allCommunities = await sessionManager.executeAction(
      session,
      'discoverCommunities',
      async () => {
        // Use the communities API to discover all available communities
        const response = await client.client.get('/communities', {
          params: {
            limit: 20
          }
        });
        // Handle various response formats
        // API returns: { success: true, data: { communities: [...], count: N, total: N } }
        const communities = response.data.data?.communities || response.data.communities || response.data.data || response.data || [];
        // Ensure it's an array
        return Array.isArray(communities) ? communities : [];
      }
    );

    if (!allCommunities || allCommunities.length === 0) {
      console.log(`[${session.user.email}] No communities available to join`);
      return;
    }

    console.log(`[${session.user.email}] Found ${allCommunities.length} communities`);

    // Filter out full communities
    const availableCommunities = allCommunities.filter((c: any) =>
      c.current_members < c.max_members
    );

    if (availableCommunities.length === 0) {
      console.log(`[${session.user.email}] All communities are full`);
      return;
    }

    // Decide how many communities to join (1-3)
    const numToJoin = randomInt(1, Math.min(3, availableCommunities.length));

    // Shuffle and pick communities
    const shuffled = availableCommunities.sort(() => Math.random() - 0.5);
    const communitiesToJoin = shuffled.slice(0, numToJoin);

    // Join each community
    for (const community of communitiesToJoin) {
      // Think about it (simulate reading community details)
      await delay({ min: 5, max: 15, unit: 'seconds' });

      const joined = await sessionManager.executeAction(
        session,
        'joinCommunity',
        async () => {
          const response = await client.client.post(
            `/communities/${community.id}/join`,
            { user_id: session.user.id }
          );
          return response.data.data;
        }
      );

      if (joined) {
        const status = community.access_type === 'private' ? 'pending approval' : 'joined';
        console.log(`[${session.user.email}] ${status === 'joined' ? 'Joined' : 'Requested to join'} community: ${community.name}`);
      }

      // Wait a bit between joins
      if (communitiesToJoin.indexOf(community) < communitiesToJoin.length - 1) {
        await delay({ min: 5, max: 10, unit: 'seconds' });
      }
    }

    console.log(`[${session.user.email}] Finished joining ${numToJoin} communities`);

  } catch (error: any) {
    console.error(`[${session.user.email}] Join community workflow failed:`, error.message);
  }
};
