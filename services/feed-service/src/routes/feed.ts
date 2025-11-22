import { Router, Request, Response } from 'express';
import { FeedComposer } from '../services/feedComposer';
import { query } from '../database/db';

// AuthenticatedRequest type - matches the shared middleware
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    communities?: Array<{ id: string; name: string; role: string }>;
  };
  logger?: {
    info: (msg: string, ctx?: Record<string, unknown>) => void;
    error: (msg: string, err?: Error, ctx?: Record<string, unknown>) => void;
  };
}

const router = Router();
const feedComposer = new FeedComposer();

/**
 * GET /feed
 * Get personalized feed for user
 * SECURITY: userId comes from verified JWT token via authMiddleware
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    req.logger?.info('Fetching feed', { userId, limit });

    // TODO: Fix feed composer to match actual database schema
    // For now, return empty feed to prevent frontend crashes
    const feed: any[] = [];

    res.json({
      success: true,
      data: {
        items: feed,
        count: feed.length
      }
    });
  } catch (error) {
    (req as AuthenticatedRequest).logger?.error('Error fetching feed', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feed',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

/**
 * GET /feed/requests
 * Get just open requests (for quick browse)
 * SECURITY: userId comes from verified JWT token via authMiddleware
 */
router.get('/requests', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const communityId = req.query.community_id;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    let queryText = `
      SELECT
        r.id as request_id,
        r.title,
        r.description,
        r.user_id as author_id,
        u.name as author_name,
        r.community_id,
        c.name as community_name,
        r.urgency,
        r.expected_duration,
        r.created_at,
        r.required_skills,
        COUNT(DISTINCT m.id) as offers_count
      FROM requests.requests r
      JOIN auth.users u ON r.user_id = u.id
      JOIN community.communities c ON r.community_id = c.id
      LEFT JOIN requests.matches m ON r.id = m.request_id AND m.status = 'proposed'
      WHERE r.status = 'open'
        AND r.user_id != $1
        AND NOT EXISTS (
          SELECT 1 FROM requests.matches m2
          WHERE m2.request_id = r.id AND m2.status IN ('accepted', 'completed')
        )
    `;

    const params: any[] = [userId];

    if (communityId) {
      queryText += ` AND r.community_id = $${params.length + 1}`;
      params.push(communityId);
    } else {
      // Only from user's communities
      queryText += `
        AND r.community_id IN (
          SELECT community_id FROM communities.members WHERE user_id = $${params.length + 1}
        )
      `;
      params.push(userId);
    }

    queryText += `
      GROUP BY r.id, u.name, c.name
      ORDER BY
        CASE r.urgency
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        r.created_at DESC
      LIMIT $${params.length + 1}
    `;
    params.push(limit);

    const result = await query(queryText, params);

    res.json({
      success: true,
      data: {
        requests: result.rows,
        count: result.rows.length
      }
    });
  } catch (error) {
    (req as AuthenticatedRequest).logger?.error('Error fetching requests', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requests',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

/**
 * POST /feed/dismiss/:itemId
 * Dismiss a feed item
 * SECURITY: userId comes from verified JWT token via authMiddleware
 */
router.post('/dismiss/:itemId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { itemId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Parse item ID (format: "type_id")
    const parts = itemId.split('_');
    const itemType = parts.slice(0, -1).join('_');
    const itemIdValue = parts[parts.length - 1];

    await query(`
      INSERT INTO feed.dismissed_items (user_id, item_type, item_id, dismissed_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id, item_type, item_id)
      DO UPDATE SET dismissed_at = NOW()
    `, [userId, itemType, itemIdValue]);

    req.logger?.info('Feed item dismissed', { userId, itemId });

    res.json({
      success: true,
      message: 'Item dismissed'
    });
  } catch (error) {
    (req as AuthenticatedRequest).logger?.error('Error dismissing item', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      message: 'Failed to dismiss item',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

/**
 * GET /feed/preferences
 * Get user's feed preferences
 * SECURITY: userId comes from verified JWT token via authMiddleware
 */
router.get('/preferences', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const result = await query(`
      SELECT * FROM feed.preferences WHERE user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      // Return defaults
      return res.json({
        success: true,
        data: {
          show_community_activity: true,
          show_open_requests: true,
          show_completed_exchanges: false,
          suggest_adjacent_requests: true,
          exploration_level: 'balanced',
          show_explanations: true,
          show_broader_stories: true,
          allow_public_featuring: true
        }
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    (req as AuthenticatedRequest).logger?.error('Error fetching preferences', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      message: 'Failed to fetch preferences',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

/**
 * PUT /feed/preferences
 * Update user's feed preferences
 * SECURITY: userId comes from verified JWT token via authMiddleware
 */
router.put('/preferences', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const preferences = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const result = await query(`
      INSERT INTO feed.preferences (
        user_id,
        show_community_activity,
        show_open_requests,
        show_completed_exchanges,
        suggest_adjacent_requests,
        exploration_level,
        show_explanations,
        show_broader_stories,
        allow_public_featuring
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id)
      DO UPDATE SET
        show_community_activity = EXCLUDED.show_community_activity,
        show_open_requests = EXCLUDED.show_open_requests,
        show_completed_exchanges = EXCLUDED.show_completed_exchanges,
        suggest_adjacent_requests = EXCLUDED.suggest_adjacent_requests,
        exploration_level = EXCLUDED.exploration_level,
        show_explanations = EXCLUDED.show_explanations,
        show_broader_stories = EXCLUDED.show_broader_stories,
        allow_public_featuring = EXCLUDED.allow_public_featuring,
        updated_at = NOW()
      RETURNING *
    `, [
      userId,
      preferences.show_community_activity ?? true,
      preferences.show_open_requests ?? true,
      preferences.show_completed_exchanges ?? false,
      preferences.suggest_adjacent_requests ?? true,
      preferences.exploration_level ?? 'balanced',
      preferences.show_explanations ?? true,
      preferences.show_broader_stories ?? true,
      preferences.allow_public_featuring ?? true
    ]);

    req.logger?.info('Feed preferences updated', { userId });

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    (req as AuthenticatedRequest).logger?.error('Error updating preferences', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

export default router;
