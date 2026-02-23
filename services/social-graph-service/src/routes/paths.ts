import express, { Request, Response } from 'express';
import { pool } from '../config/database';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '@karmyq/shared/middleware/auth';
import { computeShortestPath, TrustPath } from '../services/pathComputation';

const router = express.Router();

// GET /paths/:targetUserId - Get shortest path between current user and target user
router.get('/:targetUserId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const targetUserId = req.params.targetUserId;
    // communityId is used for karma lookup and cache keying only.
    // The exchange graph is platform-wide, so a missing communityId
    // still allows path computation (karma will default to 0).
    const communityId = req.headers['x-community-id'] as string
      || req.user?.currentCommunityId
      || 'platform';

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (currentUserId === targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot compute path to yourself',
      });
    }

    // Check if path is already cached and not expired
    const cacheResult = await pool.query(
      `SELECT
         degrees_of_separation,
         shortest_path,
         highest_trust_path,
         path_trust_score,
         computed_at
       FROM auth.social_distances
       WHERE user_a_id = $1
         AND user_b_id = $2
         AND community_id = $3
         AND expires_at > NOW()`,
      [currentUserId, targetUserId, communityId]
    );

    if (cacheResult.rows.length > 0) {
      const cached = cacheResult.rows[0];

      logger.info('Path retrieved from cache', {
        currentUserId,
        targetUserId,
        communityId,
        degrees: cached.degrees_of_separation,
      });

      return res.json({
        success: true,
        data: {
          degrees_of_separation: cached.degrees_of_separation,
          path: cached.shortest_path,
          trust_score: cached.path_trust_score,
          cached: true,
          computed_at: cached.computed_at,
        },
      });
    }

    // Compute path using BFS
    logger.info('Computing path using BFS', {
      currentUserId,
      targetUserId,
      communityId,
    });

    const path = await computeShortestPath(currentUserId, targetUserId, communityId);

    if (!path) {
      return res.json({
        success: true,
        data: {
          degrees_of_separation: null,
          path: null,
          message: 'No connection found (4+ degrees or unconnected)',
        },
      });
    }

    // Cache the computed path
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
        currentUserId,
        targetUserId,
        communityId,
        path.degrees,
        JSON.stringify(path.userIds),
        path.trustScore,
      ]
    );

    logger.info('Path computed and cached', {
      currentUserId,
      targetUserId,
      communityId,
      degrees: path.degrees,
      trustScore: path.trustScore,
    });

    res.json({
      success: true,
      data: {
        degrees_of_separation: path.degrees,
        path: path.path,
        trust_score: path.trustScore,
        cached: false,
      },
    });
  } catch (error) {
    logger.error('Error computing path', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to compute path',
    });
  }
});

// GET /paths/batch - Get paths for multiple target users (for feed ranking)
router.post('/batch', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const communityId = req.headers['x-community-id'] as string
      || req.user?.currentCommunityId
      || 'platform';
    const { target_user_ids } = req.body;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!Array.isArray(target_user_ids) || target_user_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'target_user_ids array required',
      });
    }

    // Limit to 50 users for performance
    const limitedTargets = target_user_ids.slice(0, 50);

    // Check cache first for all users
    const cacheResult = await pool.query(
      `SELECT
         user_b_id,
         degrees_of_separation,
         shortest_path,
         path_trust_score
       FROM auth.social_distances
       WHERE user_a_id = $1
         AND user_b_id = ANY($2)
         AND community_id = $3
         AND expires_at > NOW()`,
      [currentUserId, limitedTargets, communityId]
    );

    const cachedPaths = new Map(
      cacheResult.rows.map(row => [
        row.user_b_id,
        {
          degrees: row.degrees_of_separation,
          path: row.shortest_path,
          trustScore: row.path_trust_score,
        },
      ])
    );

    // Compute missing paths
    const results: Array<{
      target_user_id: string;
      degrees_of_separation: number | null;
      trust_score: number;
      cached: boolean;
    }> = [];

    for (const targetUserId of limitedTargets) {
      if (targetUserId === currentUserId) {
        continue;
      }

      const cached = cachedPaths.get(targetUserId);

      if (cached) {
        results.push({
          target_user_id: targetUserId,
          degrees_of_separation: cached.degrees,
          trust_score: cached.trustScore || 0,
          cached: true,
        });
      } else {
        // Compute path
        const path = await computeShortestPath(currentUserId, targetUserId, communityId);

        if (path) {
          // Cache it
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
              currentUserId,
              targetUserId,
              communityId,
              path.degrees,
              JSON.stringify(path.userIds),
              path.trustScore,
            ]
          );

          results.push({
            target_user_id: targetUserId,
            degrees_of_separation: path.degrees,
            trust_score: path.trustScore,
            cached: false,
          });
        } else {
          results.push({
            target_user_id: targetUserId,
            degrees_of_separation: null,
            trust_score: 0,
            cached: false,
          });
        }
      }
    }

    logger.info('Batch paths computed', {
      currentUserId,
      communityId,
      total: limitedTargets.length,
      cached: results.filter(r => r.cached).length,
      computed: results.filter(r => !r.cached).length,
    });

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error('Error computing batch paths', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to compute batch paths',
    });
  }
});

export default router;
