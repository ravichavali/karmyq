/**
 * Create collective workflow
 *
 * Providers organize into collectives and link them to the
 * PDX Service Providers Network community for discovery.
 */

import { Workflow } from '../types';
import { delay } from '../utils';

export const createCollectiveWorkflow: Workflow = async (context) => {
  const { session, sessionManager } = context;
  const client = sessionManager.getClient(session);
  const firstName = session.user.name.split(' ')[0] || session.user.name;

  console.log(`[${session.user.email}] Considering creating a collective...`);

  try {
    // Must have provider profiles to create a collective
    const myProfiles = await sessionManager.executeAction(
      session,
      'getMyProviderProfiles',
      () => client.getMyProviderProfiles()
    );

    if (!myProfiles || myProfiles.length === 0) {
      console.log(`[${session.user.email}] No provider profiles — skipping collective creation`);
      return;
    }

    // Skip if already in a collective (as creator)
    const myCollectives = await sessionManager.executeAction(
      session,
      'getMyCollectives',
      () => client.getMyCollectives()
    );

    if (myCollectives && myCollectives.length > 0) {
      console.log(`[${session.user.email}] Already in a collective — skipping`);
      return;
    }

    // Build collective from provider service types
    const serviceTypes: string[] = Array.from(new Set<string>(myProfiles.map((p: any) => p.service_type as string)));
    const primaryType = serviceTypes[0];
    const collectiveName = `${firstName}'s ${primaryType.charAt(0).toUpperCase() + primaryType.slice(1)} Collective`;

    // Simulate thinking time
    await delay({ min: 10, max: 20, unit: 'seconds' });

    const collective = await sessionManager.executeAction(
      session,
      'createCollective',
      () => client.createCollective({
        name: collectiveName,
        service_types: serviceTypes,
        description: `A collective of ${primaryType} providers serving the Portland community.`,
      })
    );

    if (!collective) {
      return;
    }

    console.log(`[${session.user.email}] Created collective: "${collectiveName}"`);

    // Find PDX Service Providers Network and link
    const allCommunities = await sessionManager.executeAction(
      session,
      'discoverCommunities',
      async () => {
        const response = await client.client.get('/communities', { params: { limit: 20 } });
        const communities = response.data.data?.communities || response.data.communities || response.data.data || response.data || [];
        return Array.isArray(communities) ? communities : [];
      }
    );

    const providerCommunity = (allCommunities || []).find((c: any) =>
      c.name === 'PDX Service Providers Network'
    );

    if (providerCommunity) {
      await delay({ min: 3, max: 8, unit: 'seconds' });
      await sessionManager.executeAction(
        session,
        'linkCollectiveToCommunity',
        () => client.linkCollectiveToCommunity(collective.id, providerCommunity.id)
      );
      console.log(`[${session.user.email}] Linked collective to PDX Service Providers Network`);
    }

  } catch (error: any) {
    console.error(`[${session.user.email}] Create collective workflow failed:`, error.message);
  }
};
