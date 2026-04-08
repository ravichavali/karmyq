/**
 * Schedule Activity workflow
 * COMMUNITY_BUILDER creates activities in group communities they admin
 */

import { Workflow } from '../types';
import { pickRandom } from '../utils';
import { ACTIVITY_TEMPLATES } from '../data/realistic-data';

export const scheduleActivityWorkflow: Workflow = async (context) => {
  const { session, sessionManager } = context;
  const client = sessionManager.getClient(session);

  console.log(`[${session.user.email}] Considering scheduling an activity...`);

  try {
    // Fetch user's communities to find one they admin
    const myCommunities: any[] = await sessionManager.executeAction(
      session,
      'getMyCommunities',
      () => client.getCommunities(session.user.id)
    ) ?? [];

    const adminCommunity = myCommunities.find((c: any) => c.role === 'admin');
    if (!adminCommunity) {
      console.log(`[${session.user.email}] No admin community found, skipping schedule`);
      return;
    }

    // Fetch community detail to verify it's a group type
    const communityDetail = await sessionManager.executeAction(
      session,
      'getCommunity',
      () => client.getCommunity(adminCommunity.id)
    );

    if (!communityDetail || communityDetail.community_type !== 'group') {
      console.log(`[${session.user.email}] Community is not group type, skipping schedule`);
      return;
    }

    // Pick activity template based on community's defaultActivityType
    const activityType: string = communityDetail.defaultActivityType ?? 'social';
    const templates = ACTIVITY_TEMPLATES[activityType] ?? ACTIVITY_TEMPLATES['social'];
    const template = pickRandom(templates);

    // Schedule 2-10 days from now at a reasonable hour (9am-3pm)
    const daysAhead = Math.floor(Math.random() * 9) + 2;
    const scheduledAt = new Date(Date.now() + daysAhead * 86400000);
    scheduledAt.setHours(9 + Math.floor(Math.random() * 6), 0, 0, 0);

    await sessionManager.executeAction(
      session,
      'createActivity',
      () => client.createActivity(adminCommunity.id, {
        title: template.title,
        description: template.description,
        activity_type: activityType,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: template.duration_minutes,
        max_participants: 8 + Math.floor(Math.random() * 13), // 8-20
      })
    );

    console.log(`[${session.user.email}] Scheduled activity: "${template.title}" in "${adminCommunity.name}"`);

  } catch (error: any) {
    console.error(`[${session.user.email}] Schedule activity workflow failed:`, error.message);
  }
};
