import { pool } from '../config/database';
import { logger } from '../config/logger';

export interface TrustPath {
  degrees: number;
  userIds: string[];
  path: Array<{
    id: string;
    name: string;
    karma?: number;
    exchanged_at?: string;
  }>;
  trustScore: number;
}

interface GraphNode {
  userId: string;
  distance: number;
  parent: string | null;
}

/**
 * Compute shortest path between two users using bidirectional BFS
 * Max depth: 4 degrees of separation
 *
 * Returns null if no path found within 4 degrees
 */
export async function computeShortestPath(
  sourceUserId: string,
  targetUserId: string,
  communityId: string
): Promise<TrustPath | null> {
  const MAX_DEPTH = 4;

  // Build adjacency list from completed exchanges (platform-wide, not community-scoped)
  // Trust paths emerge from actual exchanges, not invitation links
  const graphResult = await pool.query(
    `SELECT hr.requester_id as user_a, m.responder_id as user_b
     FROM requests.matches m
     JOIN requests.help_requests hr ON hr.id = m.request_id
     WHERE m.status = 'completed'`,
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

    // Stop if we've exceeded max depth
    if (current.distance >= MAX_DEPTH) {
      continue;
    }

    // Check if we've reached the target
    if (current.userId === targetUserId) {
      found = true;
      meetingPoint = targetUserId;
      break;
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
    logger.debug('No path found within 4 degrees', {
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

  // Fetch user details and karma for the path
  const userDetailsResult = await pool.query(
    `SELECT
       u.id,
       u.name,
       COALESCE((
         SELECT SUM(points)
         FROM reputation.karma_records
         WHERE user_id = u.id AND community_id = $1
       ), 0) as karma
     FROM auth.users u
     WHERE u.id = ANY($2)`,
    [communityId, pathUserIds]
  );

  const userDetailsMap = new Map(
    userDetailsResult.rows.map(row => [row.id, { name: row.name, karma: row.karma }])
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
      karma?: number;
      exchanged_at?: string;
    } = {
      id: userId,
      name: details?.name || 'Unknown',
    };

    if (index > 0) {
      const prevUserId = pathUserIds[index - 1];
      obj.exchanged_at = exchangeTimestamps.get(`${prevUserId}-${userId}`);
    }

    if (index > 0 && index < pathUserIds.length - 1) {
      // Only include karma for intermediate nodes (not source or target)
      obj.karma = details?.karma || 0;
    }

    return obj;
  });

  // Calculate trust score (sum of intermediate karma scores)
  const trustScore = pathUserIds
    .slice(1, -1) // Exclude source and target
    .reduce((sum, userId) => {
      const details = userDetailsMap.get(userId);
      return sum + (details?.karma || 0);
    }, 0);

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
  };
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
