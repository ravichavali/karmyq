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
  stability: number;
  last_interaction_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface TrustEdgeLiveRow extends TrustEdgeRow {
  current_weight: number;
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
  raw_weight: number;
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

  // Fetch stability growth rate for this community (fall back to global)
  const configResult = await pool.query(
    `SELECT stability_growth_rate FROM social_graph.trust_decay_config
     WHERE community_id = $1 OR community_id IS NULL
     ORDER BY community_id NULLS LAST
     LIMIT 1`,
    [communityId]
  );
  const growthRate = configResult.rows.length > 0
    ? configResult.rows[0].stability_growth_rate
    : 0.20;

  await pool.query(
    `UPDATE social_graph.trust_edges
     SET raw_weight = $1,
         stability  = stability * $2,
         updated_at = NOW()
     WHERE user_id_a = $3 AND user_id_b = $4 AND community_id = $5`,
    [rawWeight, 1 + growthRate, userIdA, userIdB, communityId]
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
        SELECT SUM(tel.current_weight) FROM social_graph.trust_edges_live tel
        WHERE (tel.user_id_a = u.id OR tel.user_id_b = u.id) AND tel.community_id = $1
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
           te.raw_weight,
           te.current_weight AS effective_weight
    FROM social_graph.trust_edges_live te
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
      raw_weight: parseFloat(r.raw_weight) || 0,
      effective_weight: parseFloat(r.effective_weight) || 0,
    })),
  };
}

// Full community graph: top 149 members by trust score UNION the calling user
// (always included), plus every edge between that member set. Reads from the
// trust_edges_live VIEW for decay-adjusted current_weight.
export async function getFullCommunityGraph(
  communityId: string,
  callingUserId: string
): Promise<{ nodes: TrustNode[]; links: TrustLink[] }> {
  const memberCTE = `
    WITH active_members AS (
      SELECT user_id FROM communities.members
      WHERE community_id = $1 AND status = 'active'
    ),
    member_scores AS (
      SELECT am.user_id, COALESCE(SUM(tel.current_weight), 0) AS trust_score
      FROM active_members am
      LEFT JOIN social_graph.trust_edges_live tel
        ON (tel.user_id_a = am.user_id OR tel.user_id_b = am.user_id)
        AND tel.community_id = $1
      GROUP BY am.user_id
    ),
    top_members AS (
      (SELECT user_id FROM member_scores ORDER BY trust_score DESC LIMIT 149)
      UNION
      (SELECT $2::uuid)
    )
  `;

  const nodesQuery = `
    ${memberCTE}
    SELECT u.id, u.name,
      COALESCE(ms.trust_score, 0) AS trust_score,
      COALESCE((
        SELECT SUM(kr.points) FROM reputation.karma_records kr
        WHERE kr.user_id = u.id AND kr.community_id = $1
      ), 0) AS karma,
      (u.id = $2::uuid) AS is_current_user
    FROM top_members tm
    JOIN auth.users u ON u.id = tm.user_id
    LEFT JOIN member_scores ms ON ms.user_id = tm.user_id
  `;

  const edgesQuery = `
    ${memberCTE}
    SELECT tel.user_id_a AS source, tel.user_id_b AS target,
           tel.raw_weight, tel.current_weight AS effective_weight
    FROM social_graph.trust_edges_live tel
    WHERE tel.community_id = $1
      AND tel.user_id_a IN (SELECT user_id FROM top_members)
      AND tel.user_id_b IN (SELECT user_id FROM top_members)
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
      raw_weight: parseFloat(r.raw_weight) || 0,
      effective_weight: parseFloat(r.effective_weight) || 0,
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
        SELECT SUM(tel.current_weight) FROM social_graph.trust_edges_live tel
        WHERE (tel.user_id_a = u.id OR tel.user_id_b = u.id)
          AND tel.community_id IN (${userCommunitiesCTE})
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
           SUM(te.raw_weight) AS raw_weight,
           SUM(te.current_weight) AS effective_weight
    FROM social_graph.trust_edges_live te
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
      raw_weight: parseFloat(r.raw_weight) || 0,
      effective_weight: parseFloat(r.effective_weight) || 0,
    })),
  };
}

// Ego-network for centerUserId, limited to communities both callingUserId and centerUserId share.
export async function getTrustGraphAggregateForCenter(
  callingUserId: string,
  centerUserId: string
): Promise<{ nodes: TrustNode[]; links: TrustLink[] }> {
  const sharedCommunitiesCTE = `
    SELECT m1.community_id
    FROM communities.members m1
    JOIN communities.members m2 ON m2.community_id = m1.community_id
    WHERE m1.user_id = $1::uuid AND m1.status = 'active'
      AND m2.user_id = $2::uuid AND m2.status = 'active'
  `;

  const neighborsCTE = `
    SELECT DISTINCT CASE WHEN te.user_id_a = $2::uuid THEN te.user_id_b ELSE te.user_id_a END AS neighbor_id
    FROM social_graph.trust_edges te
    WHERE te.community_id IN (${sharedCommunitiesCTE})
      AND (te.user_id_a = $2::uuid OR te.user_id_b = $2::uuid)
  `;

  const nodesQuery = `
    WITH shared AS (${sharedCommunitiesCTE}),
         neighbors AS (${neighborsCTE})
    SELECT u.id, u.name,
      COALESCE((
        SELECT SUM(tel.current_weight) FROM social_graph.trust_edges_live tel
        WHERE (tel.user_id_a = u.id OR tel.user_id_b = u.id)
          AND tel.community_id IN (SELECT community_id FROM shared)
      ), 0) AS trust_score,
      COALESCE((
        SELECT SUM(kr.points) FROM reputation.karma_records kr WHERE kr.user_id = u.id
      ), 0) AS karma,
      (u.id = $2::uuid) AS is_current_user
    FROM auth.users u
    WHERE u.id = $2::uuid
       OR u.id IN (SELECT neighbor_id FROM neighbors)
  `;

  const edgesQuery = `
    WITH shared AS (${sharedCommunitiesCTE}),
         neighbors AS (${neighborsCTE})
    SELECT te.user_id_a AS source, te.user_id_b AS target,
           SUM(te.raw_weight) AS raw_weight,
           SUM(te.current_weight) AS effective_weight
    FROM social_graph.trust_edges_live te
    WHERE te.community_id IN (SELECT community_id FROM shared)
      AND (
        te.user_id_a = $2::uuid OR te.user_id_b = $2::uuid
        OR (
          te.user_id_a IN (SELECT neighbor_id FROM neighbors)
          AND te.user_id_b IN (SELECT neighbor_id FROM neighbors)
        )
      )
    GROUP BY te.user_id_a, te.user_id_b
  `;

  const [nodesResult, edgesResult] = await Promise.all([
    pool.query(nodesQuery, [callingUserId, centerUserId]),
    pool.query(edgesQuery, [callingUserId, centerUserId]),
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
      raw_weight: parseFloat(r.raw_weight) || 0,
      effective_weight: parseFloat(r.effective_weight) || 0,
    })),
  };
}

export interface CommunityDepthNode {
  id: string;
  name: string;
  member_count: number;
  status: string;
  is_member: boolean;
}

export interface CommunityDepthLink {
  source: string;
  target: string;
  weight: number;
  type: 'organic' | 'fission';
}

// Inter-community depth graph for a user: their active communities plus any
// community reachable by an inter-community edge (organic trust or fission
// lineage). Organic links come from social_graph.community_trust_edges
// (undirected); fission links come from executed communities.split_proposals
// (directed parent→child). The node set is intentionally widened beyond the
// user's own communities so a member of a child community still sees its parent
// and sibling — otherwise lineage would be invisible after a split archives the
// parent. Links are emitted only between communities in the resolved node set.
export async function getCommunityDepthGraph(
  callingUserId: string
): Promise<{ nodes: CommunityDepthNode[]; links: CommunityDepthLink[] }> {
  // seed = the caller's active communities; reachable = seed ∪ edge/lineage neighbors.
  const nodesQuery = `
    WITH seed AS (
      SELECT c.id
      FROM communities.communities c
      INNER JOIN communities.members m ON m.community_id = c.id
      WHERE m.user_id = $1 AND m.status = 'active'
    ),
    reachable AS (
      SELECT id FROM seed
      UNION
      SELECT cte.community_id_a FROM social_graph.community_trust_edges cte
        WHERE cte.community_id_b IN (SELECT id FROM seed)
      UNION
      SELECT cte.community_id_b FROM social_graph.community_trust_edges cte
        WHERE cte.community_id_a IN (SELECT id FROM seed)
      UNION
      SELECT sp.community_id FROM communities.split_proposals sp
        WHERE sp.status = 'executed'
          AND (sp.child_community_a_id IN (SELECT id FROM seed)
               OR sp.child_community_b_id IN (SELECT id FROM seed))
      UNION
      SELECT sp.child_community_a_id FROM communities.split_proposals sp
        WHERE sp.status = 'executed' AND sp.community_id IN (SELECT id FROM seed)
          AND sp.child_community_a_id IS NOT NULL
      UNION
      SELECT sp.child_community_b_id FROM communities.split_proposals sp
        WHERE sp.status = 'executed' AND sp.community_id IN (SELECT id FROM seed)
          AND sp.child_community_b_id IS NOT NULL
    )
    SELECT c.id, c.name, c.current_members AS member_count, c.status,
           (c.id IN (SELECT id FROM seed)) AS is_member
    FROM communities.communities c
    WHERE c.id IN (SELECT id FROM reachable)
  `;

  const nodesResult = await pool.query(nodesQuery, [callingUserId]);
  if (nodesResult.rows.length === 0) {
    return { nodes: [], links: [] };
  }

  const nodes: CommunityDepthNode[] = nodesResult.rows.map(r => ({
    id: r.id,
    name: r.name,
    member_count: parseInt(r.member_count, 10) || 0,
    status: r.status,
    is_member: !!r.is_member,
  }));
  const nodeIds = nodes.map(n => n.id);
  const idSet = new Set(nodeIds);

  const organicQuery = `
    SELECT cte.community_id_a AS source, cte.community_id_b AS target, cte.weight AS weight
    FROM social_graph.community_trust_edges cte
    WHERE cte.community_id_a = ANY($1::uuid[]) AND cte.community_id_b = ANY($1::uuid[])
  `;

  // Only executed splits carry lineage; parent must be in the node set.
  const fissionQuery = `
    SELECT sp.community_id AS parent,
           sp.child_community_a_id AS child_a,
           sp.child_community_b_id AS child_b
    FROM communities.split_proposals sp
    WHERE sp.status = 'executed' AND sp.community_id = ANY($1::uuid[])
  `;

  const [organicResult, fissionResult] = await Promise.all([
    pool.query(organicQuery, [nodeIds]),
    pool.query(fissionQuery, [nodeIds]),
  ]);

  const links: CommunityDepthLink[] = [];

  // organicQuery already constrains both endpoints to nodeIds via `= ANY($1)`.
  for (const r of organicResult.rows) {
    links.push({
      source: r.source,
      target: r.target,
      weight: parseFloat(r.weight) || 0,
      type: 'organic',
    });
  }

  // fissionQuery constrains the parent to nodeIds; only the child needs checking.
  for (const r of fissionResult.rows) {
    for (const child of [r.child_a, r.child_b]) {
      if (child && idSet.has(child)) {
        links.push({ source: r.parent, target: child, weight: 1, type: 'fission' });
      }
    }
  }

  return { nodes, links };
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
