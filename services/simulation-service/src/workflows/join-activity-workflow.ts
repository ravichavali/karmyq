/**
 * Join Activity workflow
 * Members discover open activities in their communities and join
 */

import { Workflow } from '../types';
import { pickRandom } from '../utils';

export const joinActivityWorkflow: Workflow = async (context) => {
  const { session, sessionManager } = context;
  const client = sessionManager.getClient(session);

  console.log(`[${session.user.email}] Looking for activities to join...`);

  try {
    const myCommunities: any[] = await sessionManager.executeAction(
      session,
      'getMyCommunities',
      () => client.getCommunities(session.user.id)
    ) ?? [];

    if (myCommunities.length === 0) {
      console.log(`[${session.user.email}] No communities, skipping join-activity`);
      return;
    }

    // Pick a random community and look for open activities
    const community: any = pickRandom(myCommunities);
    const activities: any[] = await sessionManager.executeAction(
      session,
      'getActivities',
      () => client.getActivities(community.id)
    ) ?? [];

    if (activities.length === 0) {
      console.log(`[${session.user.email}] No activities in "${community.name}"`);
      return;
    }

    // Find joinable activities (not already joined and not full)
    const joinable = activities.filter((a: any) =>
      !a.is_joined &&
      (!a.max_participants || a.current_participants < a.max_participants)
    );

    if (joinable.length === 0) {
      console.log(`[${session.user.email}] No joinable activities in "${community.name}"`);
      return;
    }

    const activity: any = pickRandom(joinable);

    await sessionManager.executeAction(
      session,
      'joinActivity',
      () => client.joinActivity(community.id, activity.id)
    );

    console.log(`[${session.user.email}] Joined activity: "${activity.title}" in "${community.name}"`);

  } catch (error: any) {
    // 409 Already Joined is expected and not a real error
    if (error?.response?.status === 409) {
      console.log(`[${session.user.email}] Already joined this activity`);
      return;
    }
    console.error(`[${session.user.email}] Join activity workflow failed:`, error.message);
  }
};
