/**
 * Browse providers workflow
 *
 * Users discover available service providers, optionally
 * filtered by a random service type.
 */

import { Workflow } from '../types';
import { delay, pickRandom } from '../utils';

const SERVICE_TYPES = ['ride', 'tradesperson', 'tutor', 'other'];

export const browseProvidersWorkflow: Workflow = async (context) => {
  const { session, sessionManager } = context;
  const client = sessionManager.getClient(session);

  console.log(`[${session.user.email}] Browsing service providers...`);

  try {
    // Randomly filter by service type or browse all
    const filterType = Math.random() > 0.5 ? pickRandom(SERVICE_TYPES) : undefined;

    const providers = await sessionManager.executeAction(
      session,
      'browseProviders',
      () => client.getProviders(filterType)
    );

    const count = Array.isArray(providers) ? providers.length : 0;
    const filterLabel = filterType ? ` (${filterType})` : '';
    console.log(`[${session.user.email}] Browsed ${count} providers${filterLabel}`);

    // Simulate reading time
    if (count > 0) {
      await delay({ min: 5, max: 20, unit: 'seconds' });
    }

  } catch (error: any) {
    console.error(`[${session.user.email}] Browse providers workflow failed:`, error.message);
  }
};
