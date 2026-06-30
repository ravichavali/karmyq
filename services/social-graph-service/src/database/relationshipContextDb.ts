import { pool } from '../config/database';

export interface PublicIdentity {
  id: string;
  name: string;
}

export interface CommunityIdentity {
  id: string;
  name: string;
}

/** Rich internal edge input. Numeric fields must be projected to qualitative bands before output. */
export interface InternalContextRow {
  sourceId: string;
  targetId: string;
  interactionCount: number;
  currentWeight: number;
  disappearanceThreshold: number;
}

const completedPairCte = `
  active_users AS (
    SELECT DISTINCT user_id
    FROM communities.members
    WHERE status = 'active'
  ),
  completed_pairs AS (
    SELECT LEAST(hr.requester_id, m.responder_id) AS source_id,
           GREATEST(hr.requester_id, m.responder_id) AS target_id,
           COUNT(DISTINCT m.id)::int AS completed_count
    FROM requests.matches m
    JOIN requests.help_requests hr ON hr.id = m.request_id
    JOIN active_users source_active ON source_active.user_id = hr.requester_id
    JOIN active_users target_active ON target_active.user_id = m.responder_id
    WHERE m.status = 'completed'
    GROUP BY LEAST(hr.requester_id, m.responder_id),
             GREATEST(hr.requester_id, m.responder_id)
  )
`;

function mapContextRows(rows: any[]): InternalContextRow[] {
  return rows.map(row => ({
    sourceId: row.source_id,
    targetId: row.target_id,
    interactionCount: Number(row.interaction_count) || 0,
    currentWeight: Number(row.current_weight) || 0,
    disappearanceThreshold: Number(row.disappearance_threshold) || 0.5,
  }));
}

async function getContextRows(whereClause: string, params: unknown[]): Promise<InternalContextRow[]> {
  const result = await pool.query(
    `WITH ${completedPairCte},
     selected_pairs AS (
       SELECT * FROM completed_pairs WHERE ${whereClause}
     ),
     trust_aggregate AS (
       SELECT tel.user_id_a AS source_id,
              tel.user_id_b AS target_id,
              SUM(
                tel.match_completed_count + tel.endorsement_count
                + tel.karma_given_count + tel.event_count
              )::int AS interaction_count,
              SUM(tel.current_weight) AS current_weight,
              SUM(COALESCE(specific.disappearance_threshold, global.disappearance_threshold, 0.5))
                AS disappearance_threshold
       FROM social_graph.trust_edges_live tel
       JOIN selected_pairs sp
         ON sp.source_id = tel.user_id_a AND sp.target_id = tel.user_id_b
       LEFT JOIN LATERAL (
         SELECT disappearance_threshold
         FROM social_graph.trust_decay_config
         WHERE community_id = tel.community_id
         LIMIT 1
       ) specific ON TRUE
       LEFT JOIN LATERAL (
         SELECT disappearance_threshold
         FROM social_graph.trust_decay_config
         WHERE community_id IS NULL
         ORDER BY created_at, id
         LIMIT 1
       ) global ON TRUE
       GROUP BY tel.user_id_a, tel.user_id_b
     )
     SELECT sp.source_id, sp.target_id,
            GREATEST(sp.completed_count, COALESCE(ta.interaction_count, 0)) AS interaction_count,
            COALESCE(ta.current_weight, 0) AS current_weight,
            COALESCE(ta.disappearance_threshold, 0.5) AS disappearance_threshold
     FROM selected_pairs sp
     LEFT JOIN trust_aggregate ta
       ON ta.source_id = sp.source_id AND ta.target_id = sp.target_id
     ORDER BY sp.source_id, sp.target_id`,
    params,
  );

  return mapContextRows(result.rows);
}

/** Completed-help connections one hop from either anchor, across the platform. */
export async function getPublicOneHop(userIds: [string, string]): Promise<InternalContextRow[]> {
  return getContextRows(
    '(source_id = ANY($1::uuid[]) OR target_id = ANY($1::uuid[]))',
    [userIds],
  );
}

/** Completed-help links between the retained projection nodes. */
export async function getContextLinks(userIds: string[]): Promise<InternalContextRow[]> {
  if (userIds.length < 2) return [];
  return getContextRows(
    '(source_id = ANY($1::uuid[]) AND target_id = ANY($1::uuid[]))',
    [userIds],
  );
}

/**
 * Platform-wide completed-help shortest path. Canonical endpoint ordering plus deterministic,
 * cycle-safe BFS makes reciprocal calls choose the same path; request visibility is intentionally
 * absent because request-service owns that separate decision.
 */
export async function getPlatformShortestPath(
  userIds: [string, string],
  maxDegrees = 6,
): Promise<string[] | null> {
  const [requestedSource, requestedTarget] = userIds;
  const [sourceId, targetId] = requestedSource < requestedTarget
    ? [requestedSource, requestedTarget]
    : [requestedTarget, requestedSource];
  if (sourceId === targetId) return [sourceId];

  const result = await pool.query(
    `WITH ${completedPairCte}
     SELECT source_id, target_id
     FROM completed_pairs
     ORDER BY source_id, target_id`,
    [],
  );

  const graph = new Map<string, string[]>();
  const addNeighbor = (id: string, neighborId: string) => {
    const neighbors = graph.get(id) ?? [];
    neighbors.push(neighborId);
    graph.set(id, neighbors);
  };
  for (const row of result.rows) {
    addNeighbor(row.source_id, row.target_id);
    addNeighbor(row.target_id, row.source_id);
  }
  for (const neighbors of graph.values()) neighbors.sort();

  const requestedDepth = Number.isFinite(maxDegrees) ? Math.floor(maxDegrees) : 6;
  const boundedDepth = Math.min(6, Math.max(1, requestedDepth));
  const queue: Array<{ id: string; depth: number }> = [{ id: sourceId, depth: 0 }];
  const parents = new Map<string, string | null>([[sourceId, null]]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current.id === targetId) break;
    if (current.depth >= boundedDepth) continue;
    for (const neighborId of graph.get(current.id) ?? []) {
      if (parents.has(neighborId)) continue;
      parents.set(neighborId, current.id);
      queue.push({ id: neighborId, depth: current.depth + 1 });
    }
  }
  if (!parents.has(targetId)) return null;

  const path: string[] = [];
  let currentId: string | null = targetId;
  while (currentId !== null) {
    path.unshift(currentId);
    currentId = parents.get(currentId) ?? null;
  }
  return requestedSource === sourceId ? path : path.reverse();
}

/**
 * Identity is visible for active members, plus the two request-service-authorized anchors. The
 * anchor exception never applies to surrounding/path people and therefore cannot become a browser.
 */
export async function getPublicIdentities(
  userIds: string[],
  authorizedAnchorIds: string[] = [],
): Promise<PublicIdentity[]> {
  if (userIds.length === 0) return [];
  const result = await pool.query(
    `SELECT u.id, u.name
     FROM auth.users u
     WHERE u.id = ANY($1::uuid[])
       AND (
         u.id = ANY($2::uuid[])
         OR EXISTS (
           SELECT 1 FROM communities.members m
           WHERE m.user_id = u.id AND m.status = 'active'
         )
       )
     ORDER BY u.id`,
    [userIds, authorizedAnchorIds],
  );
  return result.rows.map(row => ({ id: row.id, name: row.name }));
}

/** Active community affiliations for retained people; no membership or reputation metrics leave. */
export async function getVisibleCommunities(
  userIds: string[],
): Promise<Map<string, CommunityIdentity[]>> {
  const visible = new Map<string, CommunityIdentity[]>();
  userIds.forEach(id => visible.set(id, []));
  if (userIds.length === 0) return visible;

  const result = await pool.query(
    `SELECT m.user_id, c.id, c.name
     FROM communities.members m
     JOIN communities.communities c ON c.id = m.community_id
     WHERE m.user_id = ANY($1::uuid[]) AND m.status = 'active'
     ORDER BY m.user_id, LOWER(BTRIM(c.name)) COLLATE "C", c.id`,
    [userIds],
  );

  for (const row of result.rows) {
    visible.get(row.user_id)?.push({ id: row.id, name: row.name });
  }
  return visible;
}
