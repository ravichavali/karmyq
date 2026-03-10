/**
 * Offer help workflow
 *
 * User browses open requests and offers to help by creating a proposed match.
 * This is the key step that feeds into the accept → complete → rate pipeline.
 */

import { Workflow } from '../types';
import { delay, pickRandom } from '../utils';

/**
 * User offers help on a request by creating a proposed match
 */
export const offerHelpWorkflow: Workflow = async (context) => {
  const { session, sessionManager } = context;
  const client = sessionManager.getClient(session);

  console.log(`[${session.user.email}] Looking for requests to help with...`);

  // Mapping from provider service_type to request_type preferences
  const PROVIDER_REQUEST_TYPE_MAP: Record<string, string[]> = {
    ride: ['ride'],
    tradesperson: ['service'],
    tutor: ['service'],
    other: [],
  };

  try {
    // Browse available requests
    const requests = await sessionManager.executeAction(
      session,
      'browseRequests',
      () => client.browseRequests({ limit: 20 })
    );

    if (!requests || requests.length === 0) {
      console.log(`[${session.user.email}] No requests available`);
      return;
    }

    // Fetch user's existing matches to avoid duplicate offers
    const myMatches = await sessionManager.executeAction(
      session,
      'getMyMatches',
      () => client.getMatches()
    );
    const alreadyOfferedIds = new Set(
      (Array.isArray(myMatches) ? myMatches : []).map((m: any) => m.request_id as string)
    );

    // Filter out own requests, already-offered requests, and closed requests
    const baseEligible = requests.filter(
      (r: any) =>
        r.requester_id !== session.user.id &&
        r.status === 'open' &&
        !alreadyOfferedIds.has(r.id)
    );

    if (baseEligible.length === 0) {
      console.log(`[${session.user.email}] No eligible requests to offer on`);
      return;
    }

    // Providers prefer requests matching their service type
    let otherRequests = baseEligible;
    const myProfiles = await sessionManager.executeAction(
      session,
      'getMyProviderProfilesForOffer',
      () => client.getMyProviderProfiles()
    );

    if (myProfiles && myProfiles.length > 0) {
      const preferredTypes = new Set(
        myProfiles.flatMap((p: any) => PROVIDER_REQUEST_TYPE_MAP[p.service_type as string] ?? [])
      );
      if (preferredTypes.size > 0) {
        const preferred = baseEligible.filter((r: any) => preferredTypes.has(r.request_type));
        if (preferred.length > 0) {
          otherRequests = preferred;
        }
      }
    }

    // Pick a random request (simulate choosing one that looks interesting)
    await delay({ min: 5, max: 20, unit: 'seconds' });

    const request = pickRandom(otherRequests) as any;

    // Read the request details
    await delay({ min: 3, max: 10, unit: 'seconds' });

    // Decide whether to offer help (80% chance)
    if (Math.random() > 0.8) {
      console.log(`[${session.user.email}] Decided not to help with: "${request.title}"`);
      return;
    }

    // Offer help by creating a proposed match
    await delay({ min: 5, max: 15, unit: 'seconds' });

    const match = await sessionManager.executeAction(
      session,
      'offerHelp',
      () => client.offerHelp(request.id, session.user.id)
    );

    if (match) {
      console.log(`[${session.user.email}] Offered help on: "${request.title}" (match ${match.id})`);
    }

  } catch (error: any) {
    console.error(`[${session.user.email}] Offer help workflow failed:`, error.message);
  }
};
