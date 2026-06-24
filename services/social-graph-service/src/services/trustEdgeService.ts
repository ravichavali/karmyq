import { pool } from '../config/database';
import {
  upsertTrustEdge,
  upsertCommunityTrustEdge,
  getTrustGraph,
  getTrustGraphAggregate,
  TrustNode,
  TrustLink,
} from '../database/trustEdgeDb';

const HALF_LIFE_MS = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months

export function computeEffectiveWeight(rawWeight: number, lastInteractionAt: Date): number {
  const ageMs = Date.now() - lastInteractionAt.getTime();
  return rawWeight * Math.pow(0.5, ageMs / HALF_LIFE_MS);
}

export async function processMatchCompleted(params: {
  requesterId: string;
  responderId: string;
  communityId: string;
}): Promise<void> {
  const { requesterId, responderId, communityId } = params;

  await upsertTrustEdge({
    userA: requesterId,
    userB: responderId,
    communityId,
    interactionType: 'match_completed',
  });

  // If the users belong to different primary communities, also update community-community edge
  const primaryCommResult = await pool.query(
    `SELECT user_id, community_id
     FROM communities.members
     WHERE user_id = ANY($1) AND status = 'active'
     ORDER BY joined_at ASC`,
    [[requesterId, responderId]]
  );

  const communityByUser = new Map<string, string>();
  for (const row of primaryCommResult.rows) {
    if (!communityByUser.has(row.user_id)) {
      communityByUser.set(row.user_id, row.community_id);
    }
  }

  const requesterCommunity = communityByUser.get(requesterId);
  const responderCommunity = communityByUser.get(responderId);

  if (
    requesterCommunity &&
    responderCommunity &&
    requesterCommunity !== responderCommunity
  ) {
    await upsertCommunityTrustEdge(requesterCommunity, responderCommunity);
  }
}

/**
 * Sprint 100 / ADR-078 — reconcile a completed match's community trust edges from the request's
 * communities, NOT the event payload's `community_id`.
 *
 * The `match_completed` payload historically carried no `community_id` (the request-service publisher
 * omits it), so the old subscriber only ever created a trust edge when that field happened to be
 * present — which was never. The result: completed exchanges that the community pulse counts, but
 * "How we're connected" shows no edge for. The source of truth for which communities an exchange
 * belongs to is `requests.request_communities` (a request can be cross-posted to several). We derive
 * the community set from there and upsert a per-community trust edge for each, independent of the
 * payload. Returns the community ids reconciled (for logging / backfill accounting).
 */
export async function reconcileMatchCompletedCommunities(params: {
  requestId: string;
  requesterId: string;
  responderId: string;
}): Promise<string[]> {
  const { requestId, requesterId, responderId } = params;

  const commRes = await pool.query(
    `SELECT community_id FROM requests.request_communities WHERE request_id = $1`,
    [requestId]
  );
  const communityIds: string[] = commRes.rows.map((r: { community_id: string }) => r.community_id);

  for (const communityId of communityIds) {
    await processMatchCompleted({ requesterId, responderId, communityId });
  }

  return communityIds;
}

export async function getTrustGraphForCommunity(
  communityId: string,
  centerUserId: string,
  callingUserId: string = centerUserId
): Promise<{ nodes: TrustNode[]; links: TrustLink[] }> {
  return getTrustGraph(communityId, centerUserId, callingUserId);
}

export { getTrustGraphAggregate };
