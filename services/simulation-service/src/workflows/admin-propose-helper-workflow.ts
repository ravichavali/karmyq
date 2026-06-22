/**
 * Admin Propose Helper workflow (Sprint 108)
 *
 * A community admin/steward suggests an eligible member as the helper on an open request in a
 * community they administer, creating an `admin_proposed = TRUE` match. This exercises the
 * responder-decision path end-to-end: the suggested member then owes an accept/decline (surfaced on
 * Home as the SuggestedAsHelperPanel preview and actioned in the Helping DecisionBand).
 *
 * Eligibility mirrors POST /requests/:id/propose-match: the proposed user must be an active member of
 * the request's community, must not be the requester, and must not already hold a proposed match on
 * that request. The endpoint enforces all of this too, so any 400/403/409 is handled gracefully.
 */

import { Workflow } from '../types';
import { pickRandom } from '../utils';

export const adminProposeHelperWorkflow: Workflow = async (context) => {
  const { session, sessionManager } = context;
  const client = sessionManager.getClient(session);

  console.log(`[${session.user.email}] Considering proposing a helper as admin...`);

  try {
    // Find a community this user administers (admin or moderator/steward).
    const myCommunities: any[] = await sessionManager.executeAction(
      session,
      'getMyCommunities',
      () => client.getCommunities(session.user.id)
    ) ?? [];

    const adminCommunities = myCommunities.filter(
      (c: any) => c.role === 'admin' || c.role === 'moderator'
    );
    if (adminCommunities.length === 0) {
      console.log(`[${session.user.email}] Not an admin/steward of any community, skipping propose`);
      return;
    }
    const community = pickRandom(adminCommunities) as any;

    // Open requests in that community (community_ids is a comma-separated list on each request).
    const requests: any[] = await sessionManager.executeAction(
      session,
      'browseRequestsForPropose',
      () => client.browseRequests({ limit: 30, status: 'open' })
    ) ?? [];
    const communityRequests = requests.filter((r: any) =>
      (r.community_ids || '').split(',').filter(Boolean).includes(community.id) &&
      r.status === 'open'
    );
    if (communityRequests.length === 0) {
      console.log(`[${session.user.email}] No open requests in "${community.name}", skipping propose`);
      return;
    }
    const request = pickRandom(communityRequests) as any;

    // Eligible members: active and not the requester. A member who already holds a proposed match on
    // this request is rejected by the endpoint with a 409, which the propose call below handles.
    const members: any[] = await sessionManager.executeAction(
      session,
      'getCommunityMembersForPropose',
      () => client.getCommunityMembers(community.id)
    ) ?? [];
    const candidates = members.filter(
      (m: any) => m.status === 'active' && m.user_id !== request.requester_id
    );
    if (candidates.length === 0) {
      console.log(`[${session.user.email}] No eligible members to propose for "${request.title}"`);
      return;
    }
    const candidate = pickRandom(candidates) as any;

    try {
      const match = await sessionManager.executeAction(
        session,
        'proposeMatch',
        () => client.proposeMatch(request.id, candidate.user_id)
      );
      if (match) {
        console.log(`[${session.user.email}] Proposed ${candidate.user_id} as helper on "${request.title}"`);
      }
    } catch (err: any) {
      // 400 (not a member) / 403 (lost admin) / 409 (already proposed) are expected races — skip.
      const status = err?.response?.status;
      console.log(`[${session.user.email}] Propose skipped (${status ?? 'error'})`);
    }
  } catch (error: any) {
    console.error(`[${session.user.email}] Admin propose helper workflow failed:`, error.message);
  }
};
