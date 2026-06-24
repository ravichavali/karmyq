import express, { Request, Response } from 'express';
import { pool } from '../config/database';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '@karmyq/shared/middleware/auth';
import { sendValidationError } from '@karmyq/shared';
import { computeTrustPath, TrustPath } from '../services/pathComputation';
import { resolveCommunityContext } from '../services/communityContext';

import { projectPathNodes } from '../services/disclosureProjection';

const router = express.Router();

// GET /paths/:targetUserId - Get shortest path between current user and target user
router.get('/:targetUserId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const targetUserId = req.params.targetUserId;

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

    // Resolve community context. The exchange-path TOPOLOGY is platform-wide; communityId
    // is used only for karma/trust-score and cache keying. Never pass the literal string
    // 'platform' into the UUID community_id column (BUG-098-002) — a missing context falls
    // back to a labeled platform scope keyed by a sentinel UUID.
    const resolved = resolveCommunityContext(
      req.headers['x-community-id'] as string | undefined,
      req.user?.currentCommunityId
    );
    if (!resolved.ok) {
      return sendValidationError(res, resolved.reason);
    }
    const { communityId, scope } = resolved.context;

    // Check if path is already cached and not expired
    const cacheResult = await pool.query(
      `SELECT
         degrees_of_separation,
         shortest_path,
         path_trust_score,
         connection_type,
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
        connectionType: cached.connection_type,
      });

      // Sprint 112 (ADR-082): outward responses omit the numeric path trust_score. The internal
      // path_trust_score stays cached for feed ranking; members get degrees + topology + scope.
      return res.json({
        success: true,
        data: {
          degrees_of_separation: cached.degrees_of_separation,
          path: projectPathNodes(cached.shortest_path),
          connection_type: cached.connection_type || 'exchange',
          scope,
          cached: true,
          computed_at: cached.computed_at,
        },
      });
    }

    // Compute path — tries exchange, then community membership, then invitation chain
    logger.info('Computing trust path', {
      currentUserId,
      targetUserId,
      communityId,
    });

    const path = await computeTrustPath(currentUserId, targetUserId, communityId);

    if (!path) {
      return res.json({
        success: true,
        data: {
          degrees_of_separation: null,
          path: null,
          connection_type: null,
          scope,
          message: 'No connection found',
        },
      });
    }

    // Cache the computed path
    await pool.query(
      `INSERT INTO auth.social_distances
       (user_a_id, user_b_id, community_id, degrees_of_separation, shortest_path, path_trust_score, connection_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_a_id, user_b_id, community_id) DO UPDATE
       SET degrees_of_separation = EXCLUDED.degrees_of_separation,
           shortest_path = EXCLUDED.shortest_path,
           path_trust_score = EXCLUDED.path_trust_score,
           connection_type = EXCLUDED.connection_type,
           computed_at = NOW(),
           expires_at = NOW() + INTERVAL '7 days'`,
      [
        currentUserId,
        targetUserId,
        communityId,
        path.degrees,
        JSON.stringify(path.path),
        path.trustScore,
        path.connectionType,
      ]
    );

    logger.info('Trust path computed and cached', {
      currentUserId,
      targetUserId,
      communityId,
      degrees: path.degrees,
      connectionType: path.connectionType,
      trustScore: path.trustScore,
    });

    res.json({
      success: true,
      data: {
        degrees_of_separation: path.degrees,
        path: path.path,
        connection_type: path.connectionType,
        community_name: path.communityName,
        scope,
        cached: false,
      },
    });
  } catch (error) {
    logger.error('Error computing path', error instanceof Error ? error : undefined);
    res.status(500).json({
      success: false,
      message: 'Failed to compute path',
    });
  }
});

// POST /paths/batch - Get paths for multiple target users (for feed ranking)
router.post('/batch', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
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

    // Same community-context semantics as GET /paths/:targetUserId (see resolver docs).
    const resolved = resolveCommunityContext(
      req.headers['x-community-id'] as string | undefined,
      req.user?.currentCommunityId
    );
    if (!resolved.ok) {
      return sendValidationError(res, resolved.reason);
    }
    const { communityId, scope } = resolved.context;

    // Limit to 50 users for performance
    const limitedTargets = target_user_ids.slice(0, 50);

    // Check cache first for all users
    const cacheResult = await pool.query(
      `SELECT
         user_b_id,
         degrees_of_separation,
         shortest_path,
         path_trust_score,
         connection_type
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
          connectionType: row.connection_type || 'exchange',
        },
      ])
    );

    // Compute missing paths. Sprint 112 (ADR-082): outward results omit the numeric path trust_score
    // (the request-service feed ranks on degrees only); path_trust_score stays cached internally.
    const results: Array<{
      target_user_id: string;
      degrees_of_separation: number | null;
      connection_type: string | null;
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
          connection_type: cached.connectionType,
          cached: true,
        });
      } else {
        const path = await computeTrustPath(currentUserId, targetUserId, communityId);

        if (path) {
          await pool.query(
            `INSERT INTO auth.social_distances
             (user_a_id, user_b_id, community_id, degrees_of_separation, shortest_path, path_trust_score, connection_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (user_a_id, user_b_id, community_id) DO UPDATE
             SET degrees_of_separation = EXCLUDED.degrees_of_separation,
                 shortest_path = EXCLUDED.shortest_path,
                 path_trust_score = EXCLUDED.path_trust_score,
                 connection_type = EXCLUDED.connection_type,
                 computed_at = NOW(),
                 expires_at = NOW() + INTERVAL '7 days'`,
            [
              currentUserId,
              targetUserId,
              communityId,
              path.degrees,
              JSON.stringify(path.path),
              path.trustScore,
              path.connectionType,
            ]
          );

          results.push({
            target_user_id: targetUserId,
            degrees_of_separation: path.degrees,
            connection_type: path.connectionType,
            cached: false,
          });
        } else {
          results.push({
            target_user_id: targetUserId,
            degrees_of_separation: null,
            connection_type: null,
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
      scope,
    });
  } catch (error) {
    logger.error('Error computing batch paths', error instanceof Error ? error : undefined);
    res.status(500).json({
      success: false,
      message: 'Failed to compute batch paths',
    });
  }
});

export default router;
