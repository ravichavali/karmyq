/**
 * Join collective workflow
 *
 * Providers find existing collectives matching their service type
 * and join one per session.
 */

import { Workflow } from '../types';
import { delay } from '../utils';

export const joinCollectiveWorkflow: Workflow = async (context) => {
  const { session, sessionManager } = context;
  const client = sessionManager.getClient(session);

  console.log(`[${session.user.email}] Looking for collectives to join...`);

  try {
    // Must have provider profiles
    const myProfiles = await sessionManager.executeAction(
      session,
      'getMyProviderProfiles',
      () => client.getMyProviderProfiles()
    );

    if (!myProfiles || myProfiles.length === 0) {
      console.log(`[${session.user.email}] No provider profiles — skipping collective join`);
      return;
    }

    const myServiceTypes = new Set(myProfiles.map((p: any) => p.service_type as string));

    // Get collectives already in
    const myCollectives = await sessionManager.executeAction(
      session,
      'getMyCollectives',
      () => client.getMyCollectives()
    );

    const myCollectiveIds = new Set((myCollectives || []).map((c: any) => c.id as string));

    // Find available collectives matching service type
    const allCollectives = await sessionManager.executeAction(
      session,
      'getCollectives',
      () => client.getCollectives()
    );

    const eligible = (allCollectives || []).filter((c: any) => {
      if (myCollectiveIds.has(c.id)) return false;
      const types: string[] = c.service_types || [];
      return types.some(t => myServiceTypes.has(t));
    });

    if (eligible.length === 0) {
      console.log(`[${session.user.email}] No matching collectives to join`);
      return;
    }

    const target = eligible[Math.floor(Math.random() * eligible.length)];

    await delay({ min: 5, max: 15, unit: 'seconds' });

    const result = await sessionManager.executeAction(
      session,
      'joinCollective',
      () => client.joinCollective(target.id)
    );

    if (result !== undefined) {
      console.log(`[${session.user.email}] Joined collective: "${target.name}"`);
    }

  } catch (error: any) {
    console.error(`[${session.user.email}] Join collective workflow failed:`, error.message);
  }
};
