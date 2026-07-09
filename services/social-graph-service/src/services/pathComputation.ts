import { pool } from '../config/database';
import { logger } from '../config/logger';
import { getTrustEdge } from '../database/trustEdgeDb';
import { computeEffectiveWeight } from './trustEdgeService';

export interface TrustPath {
  degrees: number;
  userIds: string[];
  path: Array<{
    id: string;
    name: string;
    exchanged_at?: string;
  }>;
  trustScore: number;
  connectionType: 'exchange' | 'community_member' | 'invitation_chain';
  communityName?: string; // For community_member paths
}

interface GraphNode {
  userId: string;
  distance: number;
  parent: string | null;
}

/**
 * Compute shortest path between two users using BFS over live trust edges.
 * Max depth: 3 degrees of separation.
 *
 * Returns null if no path found within 3 degrees
 */
export async function computeShortestPath(
  sourceUserId: string,
  targetUserId: string,
  communityId: string
): Promise<TrustPath | null> {
  const MAX_DEPTH = 3;

  // Sprint 118 (BUG-028): the adjacency is the SAME edge set the belonging graph discloses —
  // decay-adjusted `trust_edges_live` with both endpoints active members of the edge's community
  // (mirrors getTrustNeighborhood's links query). Raw all-time `requests.matches` diverged: a
  // completed match whose trust edge never existed (legacy seeds) or has decayed away produced a
  // "connected" badge the graph couldn't substantiate. Topology stays platform-wide (union across
  // communities, ADR-077); DISTINCT collapses a pair's per-community edges to one hop.
  const graphResult = await pool.query(
    `SELECT DISTINCT tel.user_id_a AS user_a, tel.user_id_b AS user_b
     FROM social_graph.trust_edges_live tel
     JOIN communities.members ma
       ON ma.user_id = tel.user_id_a AND ma.community_id = tel.community_id AND ma.status = 'active'
     JOIN communities.members mb
       ON mb.user_id = tel.user_id_b AND mb.community_id = tel.community_id AND mb.status = 'active'`,
    []
  );

  // Build bidirectional graph (exchanges create trust in both directions)
  const graph = new Map<string, Set<string>>();

  for (const edge of graphResult.rows) {
    const { user_a, user_b } = edge;

    // Add forward edge
    if (!graph.has(user_a)) {
      graph.set(user_a, new Set());
    }
    graph.get(user_a)!.add(user_b);

    // Add backward edge
    if (!graph.has(user_b)) {
      graph.set(user_b, new Set());
    }
    graph.get(user_b)!.add(user_a);
  }

  // BFS from source
  const queue: GraphNode[] = [{ userId: sourceUserId, distance: 0, parent: null }];
  const visited = new Map<string, GraphNode>();
  visited.set(sourceUserId, { userId: sourceUserId, distance: 0, parent: null });

  let found = false;
  let meetingPoint: string | null = null;

  while (queue.length > 0 && !found) {
    const current = queue.shift()!;

    // Check if we've reached the target BEFORE the depth gate — a target discovered at exactly
    // MAX_DEPTH is a valid 3° connection (the pre-Sprint-118 order silently dropped it).
    if (current.userId === targetUserId) {
      found = true;
      meetingPoint = targetUserId;
      break;
    }

    // Stop expanding past max depth
    if (current.distance >= MAX_DEPTH) {
      continue;
    }

    // Explore neighbors
    const neighbors = graph.get(current.userId) || new Set();

    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        const neighborNode: GraphNode = {
          userId: neighborId,
          distance: current.distance + 1,
          parent: current.userId,
        };

        visited.set(neighborId, neighborNode);
        queue.push(neighborNode);
      }
    }
  }

  if (!found || !meetingPoint) {
    logger.debug('No path found within 3 degrees', {
      sourceUserId,
      targetUserId,
      communityId,
    });
    return null;
  }

  // Reconstruct path from source to target
  const pathUserIds: string[] = [];
  let currentId: string | null = meetingPoint;

  while (currentId !== null) {
    pathUserIds.unshift(currentId);
    const node = visited.get(currentId);
    currentId = node?.parent || null;
  }

  const degrees = pathUserIds.length - 1;

  // Sprint 112 (ADR-082): fetch only identity for path nodes. Intermediate-node karma was an
  // exact reputation leak and is never used for ranking (trustScore is edge-weight derived).
  const userDetailsResult = await pool.query(
    `SELECT u.id, u.name FROM auth.users u WHERE u.id = ANY($1)`,
    [pathUserIds]
  );

  const userDetailsMap = new Map<string, { name: string }>(
    userDetailsResult.rows.map(row => [row.id, { name: row.name }])
  );

  // Fetch exchange timestamps for path edges
  const exchangeTimestamps = new Map<string, string>();

  for (let i = 0; i < pathUserIds.length - 1; i++) {
    const userA = pathUserIds[i];
    const userB = pathUserIds[i + 1];

    const exchangeResult = await pool.query(
      `SELECT m.completed_at
       FROM requests.matches m
       JOIN requests.help_requests hr ON hr.id = m.request_id
       WHERE ((hr.requester_id = $1 AND m.responder_id = $2)
           OR (hr.requester_id = $2 AND m.responder_id = $1))
         AND m.status = 'completed'
       LIMIT 1`,
      [userA, userB]
    );

    if (exchangeResult.rows.length > 0) {
      exchangeTimestamps.set(`${userA}-${userB}`, exchangeResult.rows[0].completed_at);
    }
  }

  // Build path with user details
  const path = pathUserIds.map((userId, index) => {
    const details = userDetailsMap.get(userId);
    const obj: {
      id: string;
      name: string;
      exchanged_at?: string;
    } = {
      id: userId,
      name: details?.name || 'Unknown',
    };

    if (index > 0) {
      const prevUserId = pathUserIds[index - 1];
      obj.exchanged_at = exchangeTimestamps.get(`${prevUserId}-${userId}`);
    }

    return obj;
  });

  // Calculate trust score: sum of effective_weight for each edge along the path.
  // Falls back to 0 per edge if trust_edges table not populated yet.
  let trustScore = 0;
  for (let i = 0; i < pathUserIds.length - 1; i++) {
    try {
      const edgeRow = await getTrustEdge(pathUserIds[i], pathUserIds[i + 1], communityId);
      if (edgeRow) {
        trustScore += computeEffectiveWeight(edgeRow.raw_weight, edgeRow.last_interaction_at);
      }
    } catch {
      // Trust edge not found or table not yet available — contribute 0
    }
  }

  logger.info('Path computed successfully', {
    sourceUserId,
    targetUserId,
    communityId,
    degrees,
    trustScore,
  });

  return {
    degrees,
    userIds: pathUserIds,
    path,
    trustScore,
    connectionType: 'exchange',
  };
}

/**
 * Compute trust path via shared community membership.
 * Returns a 2° path through the community admin, or 1° if one user IS the admin.
 * Returns null if users share no community.
 */
export async function computeCommunityPath(
  sourceUserId: string,
  targetUserId: string
): Promise<TrustPath | null> {
  const result = await pool.query(
    `SELECT cm1.community_id,
            c.name as community_name,
            COALESCE(
              (SELECT cm.user_id FROM communities.members cm
               WHERE cm.community_id = cm1.community_id AND cm.role = 'admin'
               ORDER BY cm.joined_at LIMIT 1),
              c.creator_id
            ) as admin_id
     FROM communities.members cm1
     JOIN communities.members cm2 ON cm2.community_id = cm1.community_id
     JOIN communities.communities c ON c.id = cm1.community_id
     WHERE cm1.user_id = $1 AND cm2.user_id = $2
       AND cm1.status = 'active' AND cm2.status = 'active'
     LIMIT 1`,
    [sourceUserId, targetUserId]
  );

  if (result.rows.length === 0) return null;

  const { admin_id, community_name } = result.rows[0];

  // Fetch user names
  const userIds = [sourceUserId, targetUserId, admin_id].filter(
    (id, idx, arr) => arr.indexOf(id) === idx
  );
  const usersResult = await pool.query(
    `SELECT id, name FROM auth.users WHERE id = ANY($1)`,
    [userIds]
  );
  const nameMap = new Map(usersResult.rows.map(r => [r.id, r.name]));

  // If one of the users IS the admin, it's a 1° connection
  if (admin_id === sourceUserId || admin_id === targetUserId) {
    const pathUserIds = [sourceUserId, targetUserId];
    return {
      degrees: 1,
      userIds: pathUserIds,
      path: pathUserIds.map(id => ({ id, name: nameMap.get(id) || 'Unknown' })),
      trustScore: 0,
      connectionType: 'community_member',
      communityName: community_name,
    };
  }

  const pathUserIds = [sourceUserId, admin_id, targetUserId];
  return {
    degrees: 2,
    userIds: pathUserIds,
    path: pathUserIds.map(id => ({ id, name: nameMap.get(id) || 'Unknown' })),
    trustScore: 0,
    connectionType: 'community_member',
    communityName: community_name,
  };
}

/**
 * Compute trust path via invitation lineage (who invited whom).
 * BFS through accepted invitations up to 3 degrees.
 * Returns null if no invitation chain exists within 3°.
 */
export async function computeInvitationPath(
  sourceUserId: string,
  targetUserId: string
): Promise<TrustPath | null> {
  const MAX_DEPTH = 3;

  // Build invitation adjacency list (bidirectional — inviting someone creates a bond in both directions)
  const graphResult = await pool.query(
    `SELECT inviter_id as user_a, invitee_id as user_b
     FROM auth.user_invitations
     WHERE invitation_accepted_at IS NOT NULL AND invitee_id IS NOT NULL`
  );

  const graph = new Map<string, Set<string>>();
  for (const edge of graphResult.rows) {
    const { user_a, user_b } = edge;
    if (!graph.has(user_a)) graph.set(user_a, new Set());
    if (!graph.has(user_b)) graph.set(user_b, new Set());
    graph.get(user_a)!.add(user_b);
    graph.get(user_b)!.add(user_a);
  }

  // BFS
  const queue: Array<{ userId: string; distance: number; parent: string | null }> = [
    { userId: sourceUserId, distance: 0, parent: null },
  ];
  const visited = new Map<string, { userId: string; distance: number; parent: string | null }>();
  visited.set(sourceUserId, { userId: sourceUserId, distance: 0, parent: null });

  let found = false;

  while (queue.length > 0 && !found) {
    const current = queue.shift()!;
    // Target check before the depth gate — same ordering fix as computeShortestPath (Sprint 118):
    // a target popped at exactly MAX_DEPTH is a valid 3° chain.
    if (current.userId === targetUserId) { found = true; break; }
    if (current.distance >= MAX_DEPTH) continue;

    for (const neighborId of (graph.get(current.userId) || new Set())) {
      if (!visited.has(neighborId)) {
        const node = { userId: neighborId, distance: current.distance + 1, parent: current.userId };
        visited.set(neighborId, node);
        queue.push(node);
      }
    }
  }

  if (!found) return null;

  // Reconstruct path
  const pathUserIds: string[] = [];
  let currentId: string | null = targetUserId;
  while (currentId !== null) {
    pathUserIds.unshift(currentId);
    const node = visited.get(currentId);
    currentId = node?.parent || null;
  }

  const usersResult = await pool.query(
    `SELECT id, name FROM auth.users WHERE id = ANY($1)`,
    [pathUserIds]
  );
  const nameMap = new Map(usersResult.rows.map(r => [r.id, r.name]));

  return {
    degrees: pathUserIds.length - 1,
    userIds: pathUserIds,
    path: pathUserIds.map(id => ({ id, name: nameMap.get(id) || 'Unknown' })),
    trustScore: 0,
    connectionType: 'invitation_chain',
  };
}

/**
 * Compute the strongest available trust path between two users.
 * Tries exchange graph first (strongest), then community membership,
 * then invitation lineage. Returns null if no connection found.
 */
export async function computeTrustPath(
  sourceUserId: string,
  targetUserId: string,
  communityId: string
): Promise<TrustPath | null> {
  const exchangePath = await computeShortestPath(sourceUserId, targetUserId, communityId);
  if (exchangePath) return exchangePath; // connectionType: 'exchange' already set

  const communityPath = await computeCommunityPath(sourceUserId, targetUserId);
  if (communityPath) return communityPath;

  return computeInvitationPath(sourceUserId, targetUserId);
}

/**
 * Clear cached trust paths for two users after a completed exchange.
 * Called when a match completes — the direct edge now exists, so cached
 * paths (which may show longer indirect routes) are stale.
 */
export async function clearTrustPathCache(userA: string, userB: string): Promise<void> {
  await pool.query(
    `DELETE FROM auth.social_distances
     WHERE (user_a_id = $1 AND user_b_id = $2)
        OR (user_a_id = $2 AND user_b_id = $1)`,
    [userA, userB]
  );

  logger.info('Cleared trust path cache', { userA, userB });
}

/**
 * Compute paths for all community members (background job)
 * This is computationally expensive, use sparingly
 */
export async function precomputeAllPaths(communityId: string): Promise<number> {
  const start = Date.now();

  // Get all community members
  const membersResult = await pool.query(
    `SELECT user_id
     FROM communities.members
     WHERE community_id = $1`,
    [communityId]
  );

  const memberIds = membersResult.rows.map(row => row.user_id);
  let computedCount = 0;

  // Compute paths for all pairs
  for (let i = 0; i < memberIds.length; i++) {
    for (let j = i + 1; j < memberIds.length; j++) {
      const userA = memberIds[i];
      const userB = memberIds[j];

      const path = await computeShortestPath(userA, userB, communityId);

      if (path) {
        // Cache the path
        await pool.query(
          `INSERT INTO auth.social_distances
           (user_a_id, user_b_id, community_id, degrees_of_separation, shortest_path, path_trust_score)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_a_id, user_b_id, community_id) DO UPDATE
           SET degrees_of_separation = EXCLUDED.degrees_of_separation,
               shortest_path = EXCLUDED.shortest_path,
               path_trust_score = EXCLUDED.path_trust_score,
               computed_at = NOW(),
               expires_at = NOW() + INTERVAL '7 days'`,
          [
            userA,
            userB,
            communityId,
            path.degrees,
            JSON.stringify(path.userIds),
            path.trustScore,
          ]
        );

        computedCount++;
      }
    }
  }

  const duration = Date.now() - start;

  logger.info('Precomputed all paths for community', {
    communityId,
    memberCount: memberIds.length,
    computedPaths: computedCount,
    durationMs: duration,
  });

  return computedCount;
}
