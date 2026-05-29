import { SimulatedUser } from '../types';
import { ApiClient } from '../api-client';

/**
 * Community Builder: nominate a community member for 'moderator' role.
 * Skips if there's already a pending nomination to avoid spam.
 * Nomination will be rejected by the API if the nominee doesn't meet
 * the trust eligibility threshold (default: 50) — we catch that gracefully.
 */
export async function nominateMemberWorkflow(user: SimulatedUser, client: ApiClient): Promise<void> {
  const communities = await client.getCommunities().catch(() => []);
  if (!communities.length) return;

  const community = communities[Math.floor(Math.random() * communities.length)];

  const govState = await client.getGovernanceState(community.id).catch(() => null);
  if (!govState) return;

  // Skip if there's already a pending nomination
  if (govState.nominations?.some((n: any) => n.status === 'pending')) return;

  const members = await client.getCommunityMembers(community.id).catch(() => []);
  const candidates = members.filter((m: any) => m.user_id !== user.id && m.role === 'member');
  if (!candidates.length) return;

  const nominee = candidates[Math.floor(Math.random() * candidates.length)];
  await client.nominateMember(community.id, nominee.user_id, 'moderator').catch(() => null);
}

/**
 * Any active member: ratify pending nominations (not their own).
 */
export async function ratifyNominationWorkflow(user: SimulatedUser, client: ApiClient): Promise<void> {
  const communities = await client.getCommunities().catch(() => []);
  for (const community of communities.slice(0, 3)) {
    const govState = await client.getGovernanceState(community.id).catch(() => null);
    if (!govState?.nominations) continue;
    for (const nomination of govState.nominations.filter((n: any) => n.status === 'pending')) {
      if (nomination.nominated_user_id === user.id) continue;
      await client.ratifyNomination(community.id, nomination.id).catch(() => null);
    }
  }
}
