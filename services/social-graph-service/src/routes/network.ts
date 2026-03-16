import express, { Response } from 'express';
import { pool } from '../config/database';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '@karmyq/shared/middleware/auth';

const router = express.Router();

const NODE_CAP = 150;

// GET /network — returns current user's local network graph
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    // 1. Exchange connections from materialized table
    const exchangeResult = await pool.query(
      `SELECT
         CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END AS connected_user_id,
         'exchange' AS edge_type,
         last_interaction_at
       FROM social_graph.connections
       WHERE (user_a_id = $1 OR user_b_id = $1)
         AND type = 'exchange'
       ORDER BY last_interaction_at DESC`,
      [userId]
    );

    // 2. Community co-members (live)
    const communityResult = await pool.query(
      `SELECT DISTINCT m2.user_id AS connected_user_id,
         'community' AS edge_type,
         m2.joined_at AS last_interaction_at
       FROM communities.members m1
       JOIN communities.members m2
         ON m1.community_id = m2.community_id
         AND m2.user_id != $1
       WHERE m1.user_id = $1`,
      [userId]
    );

    // 3. Merge: exchange takes precedence, deduplicate, cap at NODE_CAP
    const exchangeIds = new Set(exchangeResult.rows.map((r: any) => r.connected_user_id));
    const communityRows = communityResult.rows.filter(
      (r: any) => !exchangeIds.has(r.connected_user_id)
    );

    const merged = [...exchangeResult.rows, ...communityRows].slice(0, NODE_CAP);

    // 4. Fetch display names + provider IDs for all users (connections + center node)
    const allIds = [userId, ...merged.map((r: any) => r.connected_user_id)];
    const usersResult = await pool.query(
      `SELECT u.id, u.name, pp.id AS provider_id
       FROM auth.users u
       LEFT JOIN requests.provider_profiles pp ON pp.user_id = u.id
       WHERE u.id = ANY($1)`,
      [allIds]
    );

    const userMap = new Map(usersResult.rows.map((u: any) => [u.id, u]));

    // 5. Build response
    const nodes: Array<{ id: string; name: string; provider_id: string | null }> = [];
    const edges: Array<{ source: string; target: string; type: string }> = [];

    // Center node first
    const centerUser = userMap.get(userId);
    if (centerUser) {
      nodes.push({ id: centerUser.id, name: centerUser.name, provider_id: centerUser.provider_id ?? null });
    }

    // Connected nodes + edges
    for (const row of merged) {
      const user = userMap.get(row.connected_user_id);
      if (!user) continue;
      nodes.push({ id: user.id, name: user.name, provider_id: user.provider_id ?? null });
      edges.push({ source: userId, target: user.id, type: row.edge_type });
    }

    logger.info('GET /network response', { userId, nodeCount: nodes.length, edgeCount: edges.length });

    return res.json({ success: true, data: { nodes, edges } });
  } catch (error) {
    logger.error('GET /network error', { userId, error });
    return res.status(500).json({ success: false, message: 'Failed to fetch network' });
  }
});

export default router;
