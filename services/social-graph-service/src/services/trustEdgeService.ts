import { pool } from '../config/database';
import {
  upsertTrustEdge,
  upsertCommunityTrustEdge,
  getTrustGraph,
  GraphNode,
  GraphEdge,
  TrustEdgeRow,
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

export async function getTrustGraphForCommunity(communityId: string): Promise<{
  nodes: GraphNode[];
  edges: GraphEdge[];
}> {
  const { nodes, edges: rawEdges } = await getTrustGraph(communityId);

  const edges: GraphEdge[] = rawEdges.map((edge: TrustEdgeRow) => ({
    source: edge.user_id_a,
    target: edge.user_id_b,
    raw_weight: edge.raw_weight,
    effective_weight: computeEffectiveWeight(edge.raw_weight, edge.last_interaction_at),
    match_completed_count: edge.match_completed_count,
    endorsement_count: edge.endorsement_count,
    karma_given_count: edge.karma_given_count,
    event_count: edge.event_count,
    last_interaction_at: edge.last_interaction_at,
  }));

  return { nodes, edges };
}
