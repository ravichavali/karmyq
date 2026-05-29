import { SimulatedUser } from '../types';
import { ApiClient } from '../api-client';

/**
 * Requester side: call dibs on an open request by nominating a specific provider.
 * Requires prior completed interaction between requester and provider — most calls
 * will gracefully fail with 403; that's expected and handled.
 */
export async function callDibsWorkflow(user: SimulatedUser, client: ApiClient): Promise<void> {
  // Get user's own open requests
  const myRequests = await client.browseRequests({ requester_id: user.id, status: 'open' }).catch(() => []);
  if (!myRequests.length) return;

  // Get completed matches to find providers the user has already worked with
  const completedMatches = await client.getMatches({ status: 'completed' }).catch(() => []);
  const priorProviders = completedMatches
    .filter((m: any) => m.requester_id === user.id && m.responder_id)
    .map((m: any) => m.responder_id);

  if (!priorProviders.length) return; // no prior interaction — skip

  const request = myRequests[Math.floor(Math.random() * myRequests.length)];
  const providerUserId = priorProviders[Math.floor(Math.random() * priorProviders.length)];

  await client.callDibs(request.id, providerUserId).catch(() => null);
}

/**
 * Provider side: check pending dibs invitations and accept or decline.
 */
export async function respondToDibsWorkflow(_user: SimulatedUser, client: ApiClient): Promise<void> {
  const pendingDibs = await client.getPendingDibsForProvider().catch(() => []);
  for (const dibs of (pendingDibs || []).slice(0, 3)) {
    if (Math.random() < 0.70) {
      await client.acceptDibs(dibs.id).catch(() => null);
    } else {
      await client.declineDibs(dibs.id).catch(() => null);
    }
  }
}
