import { Router, Request, Response } from 'express';
import { query } from '../database/db';
import { BasicFeedRanker } from '../services/feed/basicFeedRanker';
import { SocialKarmaFeedComposer } from '../services/feed/socialKarmaFeedComposer';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email?: string;
    communities?: Array<{ id: string; name: string; role: string }>;
  };
  logger?: {
    error: (message: string, error?: unknown, meta?: Record<string, unknown>) => void;
  };
}

const router = Router();
const basicFeedRanker = new BasicFeedRanker();
const socialKarmaComposer = new SocialKarmaFeedComposer();

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const limit = parseInt(req.query.limit as string, 10) || 20;
    const feed = await basicFeedRanker.generateFeed(userId, limit, req.headers.authorization);

    return res.json({
      success: true,
      data: {
        items: feed,
        count: feed.length,
      },
    });
  } catch (error) {
    req.logger?.error('Error generating feed', error);
    return res.status(500).json({ success: false, error: 'Failed to generate feed' });
  }
});

router.post('/dismiss/:itemId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { itemId } = req.params;
    const parts = itemId.split('_');
    const itemType = parts.slice(0, -1).join('_');
    const itemIdPart = parts[parts.length - 1];

    await query(
      `INSERT INTO feed.dismissed_items (user_id, item_type, item_id, dismissed_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, item_type, item_id)
       DO UPDATE SET dismissed_at = NOW()`,
      [userId, itemType, itemIdPart]
    );

    return res.json({ success: true, message: 'Item dismissed' });
  } catch (error) {
    req.logger?.error('Error dismissing feed item', error);
    return res.status(500).json({ success: false, error: 'Failed to dismiss item' });
  }
});

router.get('/preferences', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const result = await query('SELECT * FROM feed.preferences WHERE user_id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          user_id: userId,
          show_community_activity: true,
          show_open_requests: true,
          show_completed_exchanges: false,
          suggest_adjacent_requests: true,
          exploration_level: 'balanced',
          show_explanations: true,
          show_broader_stories: true,
          allow_public_featuring: true,
        },
      });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    req.logger?.error('Error fetching feed preferences', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch preferences' });
  }
});

router.put('/preferences', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const {
      show_community_activity = true,
      show_open_requests = true,
      show_completed_exchanges = false,
      suggest_adjacent_requests = true,
      exploration_level = 'balanced',
      show_explanations = true,
      show_broader_stories = true,
      allow_public_featuring = true,
    } = req.body;

    const result = await query(
      `INSERT INTO feed.preferences (
        user_id, show_community_activity, show_open_requests, show_completed_exchanges,
        suggest_adjacent_requests, exploration_level, show_explanations,
        show_broader_stories, allow_public_featuring, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        show_community_activity = $2,
        show_open_requests = $3,
        show_completed_exchanges = $4,
        suggest_adjacent_requests = $5,
        exploration_level = $6,
        show_explanations = $7,
        show_broader_stories = $8,
        allow_public_featuring = $9,
        updated_at = NOW()
      RETURNING *`,
      [
        userId,
        show_community_activity,
        show_open_requests,
        show_completed_exchanges,
        suggest_adjacent_requests,
        exploration_level,
        show_explanations,
        show_broader_stories,
        allow_public_featuring,
      ]
    );

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    req.logger?.error('Error updating feed preferences', error);
    return res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
});

router.get('/community-health', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const communityId = req.query.community_id as string;
    if (!communityId) {
      return res.status(400).json({ success: false, error: 'community_id required' });
    }

    const healthSummary = await socialKarmaComposer.getCommunityHealthSummary(communityId);
    if (!healthSummary) {
      return res.status(404).json({ success: false, error: 'Community not found' });
    }

    return res.json({ success: true, data: healthSummary });
  } catch (error) {
    req.logger?.error('Error fetching community health', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch community health' });
  }
});

export default router;
