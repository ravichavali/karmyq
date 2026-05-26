import { pool } from '../config/database';

export interface TrustEdgeRow {
  id: string;
  user_id_a: string;
  user_id_b: string;
  community_id: string;
  match_completed_count: number;
  endorsement_count: number;
  karma_given_count: number;
  event_count: number;
  raw_weight: number;
  last_interaction_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface GraphNode {
  id: string;
  name: string;
  trust_score: number;
  karma: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  raw_weight: number;
  effective_weight: number;
  match_completed_count: number;
  endorsement_count: number;
  karma_given_count: number;
  event_count: number;
  last_interaction_at: Date;
}

export interface TrustNode {
  id: string;
  name: string;
  trust_score: number;
  karma: number;
  isCurrentUser: boolean;
}

export interface TrustLink {
  source: string;
  target: string;
  effective_weight: number;
}

export type InteractionType = 'match_completed' | 'endorsement' | 'karma_given' | 'event';

export interface InteractionCounts {
  match_completed: number;
  endorsement: number;
  karma_given: number;
  event: number;
}

export interface InteractionWeights {
  match_completed: number;
  endorsement: number;
  karma_given: number;
  event: number;
}

export function normalizePair(userA: string, userB: string): { userIdA: string; userIdB: string } {
  if (userA < userB) {
    return { userIdA: userA, userIdB: userB };
  }
  return { userIdA: userB, userIdB: userA };
}

export function computeRawWeight(counts: InteractionCounts, weights: InteractionWeights): number {
  return (
    counts.match_completed * weights.match_completed +
    counts.endorsement * weights.endorsement +
    counts.karma_given * weights.karma_given +
    counts.event * weights.event
  );
}

export async function getInteractionWeight(communityId: string, interactionType: string): Promise<number> {
  const result = await pool.query(
    `SELECT weight FROM social_graph.interaction_weights
     WHERE interaction_type = $1
       AND (community_id = $2 OR community_id IS NULL)
     ORDER BY community_id NULLS LAST
     LIMIT 1`,
    [interactionType, communityId]
  );
  return result.rows.length > 0 ? result.rows[0].weight : 1.0;
}

export async function getInteractionWeightsForCommunity(communityId: string): Promise<InteractionWeights> {
  const types: InteractionType[] = ['match_completed', 'endorsement', 'karma_given', 'event'];
  const weights: InteractionWeights = { match_completed: 1.0, endorsement: 1.0, karma_given: 1.0, event: 1.0 };

  for (const type of types) {
    weights[type] = await getInteractionWeight(communityId, type);
  }

  return weights;
}

export async function upsertTrustEdge(params: {
  userA: string;
  userB: string;
  communityId: string;
  interactionType: InteractionType;
}): Promise<void> {
  const { userA, userB, communityId, interactionType } = params;
  const { userIdA, userIdB } = normalizePair(userA, userB);

  const countColumn = `${interactionType}_count`;

  // Upsert the edge, incrementing the appropriate count column
  await pool.query(
    `INSERT INTO social_graph.trust_edges
       (user_id_a, user_id_b, community_id, ${countColumn}, raw_weight, last_interaction_at)
     VALUES ($1, $2, $3, 1, 0, NOW())
     ON CONFLICT (user_id_a, user_id_b, community_id) DO UPDATE SET
       ${countColumn}        = social_graph.trust_edges.${countColumn} + 1,
       last_interaction_at  = NOW(),
       updated_at           = NOW()`,
    [userIdA, userIdB, communityId]
  );

  // Fetch updated counts to recompute raw_weight
  const edgeResult = await pool.query(
    `SELECT match_completed_count, endorsement_count, karma_given_count, event_count
     FROM social_graph.trust_edges
     WHERE user_id_a = $1 AND user_id_b = $2 AND community_id = $3`,
    [userIdA, userIdB, communityId]
  );

  if (edgeResult.rows.length === 0) return;

  const row = edgeResult.rows[0];
  const counts: InteractionCounts = {
    match_completed: row.match_completed_count,
    endorsement: row.endorsement_count,
    karma_given: row.karma_given_count,
    event: row.event_count,
  };

  const interactionWeights = await getInteractionWeightsForCommunity(communityId);
  const rawWeight = computeRawWeight(counts, interactionWeights);

  await pool.query(
    `UPDATE social_graph.trust_edges
     SET raw_weight = $1, updated_at = NOW()
     WHERE user_id_a = $2 AND user_id_b = $3 AND community_id = $4`,
    [rawWeight, userIdA, userIdB, communityId]
  );
}

export async function getTrustEdge(userA: string, userB: string, communityId: string): Promise<TrustEdgeRow | null> {
  const { userIdA, userIdB } = normalizePair(userA, userB);
  const result = await pool.query(
    `SELECT * FROM social_graph.trust_edges
     WHERE user_id_a = $1 AND user_id_b = $2 AND community_id = $3`,
    [userIdA, userIdB, communityId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function getTrustGraph(
  communityId: string,
  callingUserId: string
): Promise<{ nodes: TrustNode[]; links: TrustLink[] }> {
  const neighborsCTE = `
    SELECT CASE WHEN user_id_a = $2::uuid THEN user_id_b ELSE user_id_a END AS neighbor_id
    FROM social_graph.trust_edges
    WHERE community_id = $1
      AND (user_id_a = $2::uuid OR user_id_b = $2::uuid)
  `;

  const nodesQuery = `
    WITH neighbors AS (${neighborsCTE})
    SELECT u.id, u.name,
      COALESCE((
        SELECT SUM(te2.raw_weight) FROM social_graph.trust_edges te2
        WHERE (te2.user_id_a = u.id OR te2.user_id_b = u.id) AND te2.community_id = $1
      ), 0) AS trust_score,
      COALESCE((
        SELECT SUM(kr.points) FROM reputation.karma_records kr
        WHERE kr.user_id = u.id AND kr.community_id = $1
      ), 0) AS karma,
      (u.id = $2::uuid) AS is_current_user
    FROM auth.users u
    WHERE u.id = $2::uuid
       OR u.id IN (SELECT neighbor_id FROM neighbors)
  `;

  const edgesQuery = `
    WITH neighbors AS (${neighborsCTE})
    SELECT te.user_id_a AS source, te.user_id_b AS target,
           te.raw_weight AS effective_weight
    FROM social_graph.trust_edges te
    WHERE te.community_id = $1
      AND (
        te.user_id_a = $2::uuid OR te.user_id_b = $2::uuid
        OR (
          te.user_id_a IN (SELECT neighbor_id FROM neighbors)
          AND te.user_id_b IN (SELECT neighbor_id FROM neighbors)
        )
      )
  `;

  const [nodesResult, edgesResult] = await Promise.all([
    pool.query(nodesQuery, [communityId, callingUserId]),
    pool.query(edgesQuery, [communityId, callingUserId]),
  ]);

  return {
    nodes: nodesResult.rows.map(r => ({
      id: r.id,
      name: r.name,
      trust_score: parseFloat(r.trust_score) || 0,
      karma: parseFloat(r.karma) || 0,
      isCurrentUser: r.is_current_user,
    })),
    links: edgesResult.rows.map(r => ({
      source: r.source,
      target: r.target,
      effective_weight: parseFloat(r.effective_weight) || 1,
    })),
  };
}

export async function getTrustGraphAggregate(
  callingUserId: string
): Promise<{ nodes: TrustNode[]; links: TrustLink[] }> {
  const userCommunitiesCTE = `
    SELECT community_id FROM communities.members WHERE user_id = $1 AND status = 'active'
  `;

  const neighborsCTE = `
    SELECT DISTINCT CASE WHEN te.user_id_a = $1::uuid THEN te.user_id_b ELSE te.user_id_a END AS neighbor_id
    FROM social_graph.trust_edges te
    WHERE te.community_id IN (${userCommunitiesCTE})
      AND (te.user_id_a = $1::uuid OR te.user_id_b = $1::uuid)
  `;

  const nodesQuery = `
    WITH neighbors AS (${neighborsCTE})
    SELECT u.id, u.name,
      COALESCE((
        SELECT SUM(te2.raw_weight) FROM social_graph.trust_edges te2
        WHERE (te2.user_id_a = u.id OR te2.user_id_b = u.id)
          AND te2.community_id IN (${userCommunitiesCTE})
      ), 0) AS trust_score,
      COALESCE((
        SELECT SUM(kr.points) FROM reputation.karma_records kr WHERE kr.user_id = u.id
      ), 0) AS karma,
      (u.id = $1::uuid) AS is_current_user
    FROM auth.users u
    WHERE u.id = $1::uuid
       OR u.id IN (SELECT neighbor_id FROM neighbors)
  `;

  const edgesQuery = `
    WITH neighbors AS (${neighborsCTE})
    SELECT te.user_id_a AS source, te.user_id_b AS target,
           SUM(te.raw_weight) AS effective_weight
    FROM social_graph.trust_edges te
    WHERE te.community_id IN (${userCommunitiesCTE})
      AND (
        te.user_id_a = $1::uuid OR te.user_id_b = $1::uuid
        OR (
          te.user_id_a IN (SELECT neighbor_id FROM neighbors)
          AND te.user_id_b IN (SELECT neighbor_id FROM neighbors)
        )
      )
    GROUP BY te.user_id_a, te.user_id_b
  `;

  const [nodesResult, edgesResult] = await Promise.all([
    pool.query(nodesQuery, [callingUserId]),
    pool.query(edgesQuery, [callingUserId]),
  ]);

  return {
    nodes: nodesResult.rows.map(r => ({
      id: r.id,
      name: r.name,
      trust_score: parseFloat(r.trust_score) || 0,
      karma: parseFloat(r.karma) || 0,
      isCurrentUser: r.is_current_user,
    })),
    links: edgesResult.rows.map(r => ({
      source: r.source,
      target: r.target,
      effective_weight: parseFloat(r.effective_weight) || 1,
    })),
  };
}

export async function upsertCommunityTrustEdge(communityA: string, communityB: string): Promise<void> {
  const commIdA = communityA < communityB ? communityA : communityB;
  const commIdB = communityA < communityB ? communityB : communityA;

  await pool.query(
    `INSERT INTO social_graph.community_trust_edges
       (community_id_a, community_id_b, cross_interaction_count, weight, last_interaction_at)
     VALUES ($1, $2, 1, 1.0, NOW())
     ON CONFLICT (community_id_a, community_id_b) DO UPDATE SET
       cross_interaction_count = social_graph.community_trust_edges.cross_interaction_count + 1,
       weight                  = social_graph.community_trust_edges.cross_interaction_count + 1,
       last_interaction_at     = NOW()`,
    [commIdA, commIdB]
  );
}
