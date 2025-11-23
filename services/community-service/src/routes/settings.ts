import { Router, Request, Response } from 'express';
import { query } from '../database/db';

const router = Router();

/**
 * GET /communities/:communityId/settings
 * Get community TTL and decay settings
 */
router.get('/:communityId/settings', async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Verify user is a member of this community
    const memberCheck = await query(
      `SELECT role FROM communities.members
       WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
      [communityId, userId]
    );

    if (memberCheck.rowCount === 0) {
      return res.status(403).json({
        success: false,
        message: 'You must be a member of this community to view settings',
      });
    }

    // Get settings (will exist due to trigger on community creation)
    const result = await query(
      `SELECT
        s.id,
        s.community_id,
        s.request_ttl_days,
        s.offer_ttl_days,
        s.message_ttl_days,
        s.notification_ttl_days,
        s.reputation_half_life_months,
        s.activity_types,
        s.created_at,
        s.updated_at
      FROM communities.settings s
      WHERE s.community_id = $1`,
      [communityId]
    );

    if (result.rowCount === 0) {
      // Create default settings if they don't exist
      const createResult = await query(
        `INSERT INTO communities.settings (community_id)
         VALUES ($1)
         RETURNING *`,
        [communityId]
      );

      return res.json({
        success: true,
        data: createResult.rows[0],
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error fetching community settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch community settings',
      error: error.message,
    });
  }
});

/**
 * PATCH /communities/:communityId/settings
 * Update community TTL and decay settings (admin only)
 */
router.patch('/:communityId/settings', async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const userId = (req as any).user?.userId;
    const {
      request_ttl_days,
      offer_ttl_days,
      message_ttl_days,
      notification_ttl_days,
      reputation_half_life_months,
      activity_types,
    } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Verify user is an admin of this community
    const memberCheck = await query(
      `SELECT role FROM communities.members
       WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
      [communityId, userId]
    );

    if (memberCheck.rowCount === 0 || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only community admins can update settings',
      });
    }

    // Validate TTL values (must be positive and reasonable)
    const ttlFields = { request_ttl_days, offer_ttl_days, message_ttl_days, notification_ttl_days };
    for (const [field, value] of Object.entries(ttlFields)) {
      if (value !== undefined) {
        if (typeof value !== 'number' || value < 1 || value > 365) {
          return res.status(400).json({
            success: false,
            message: `${field} must be between 1 and 365 days`,
          });
        }
      }
    }

    // Validate reputation half life (1-24 months)
    if (reputation_half_life_months !== undefined) {
      if (typeof reputation_half_life_months !== 'number' ||
          reputation_half_life_months < 1 ||
          reputation_half_life_months > 24) {
        return res.status(400).json({
          success: false,
          message: 'reputation_half_life_months must be between 1 and 24',
        });
      }
    }

    // Validate activity types (must be valid array)
    if (activity_types !== undefined) {
      if (!Array.isArray(activity_types)) {
        return res.status(400).json({
          success: false,
          message: 'activity_types must be an array',
        });
      }
      const validTypes = ['complete_request', 'complete_offer', 'post_request', 'post_offer', 'join_community'];
      for (const type of activity_types) {
        if (!validTypes.includes(type)) {
          return res.status(400).json({
            success: false,
            message: `Invalid activity type: ${type}. Valid types: ${validTypes.join(', ')}`,
          });
        }
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (request_ttl_days !== undefined) {
      updates.push(`request_ttl_days = $${paramCount++}`);
      values.push(request_ttl_days);
    }
    if (offer_ttl_days !== undefined) {
      updates.push(`offer_ttl_days = $${paramCount++}`);
      values.push(offer_ttl_days);
    }
    if (message_ttl_days !== undefined) {
      updates.push(`message_ttl_days = $${paramCount++}`);
      values.push(message_ttl_days);
    }
    if (notification_ttl_days !== undefined) {
      updates.push(`notification_ttl_days = $${paramCount++}`);
      values.push(notification_ttl_days);
    }
    if (reputation_half_life_months !== undefined) {
      updates.push(`reputation_half_life_months = $${paramCount++}`);
      values.push(reputation_half_life_months);
    }
    if (activity_types !== undefined) {
      updates.push(`activity_types = $${paramCount++}`);
      values.push(JSON.stringify(activity_types));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    values.push(communityId);

    // Upsert settings
    const result = await query(
      `INSERT INTO communities.settings (community_id, ${updates.map(u => u.split(' = ')[0]).join(', ')})
       VALUES ($${paramCount}, ${values.slice(0, -1).map((_, i) => `$${i + 1}`).join(', ')})
       ON CONFLICT (community_id) DO UPDATE SET
       ${updates.join(', ')}
       RETURNING *`,
      values
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Community settings updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating community settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update community settings',
      error: error.message,
    });
  }
});

/**
 * GET /communities/:communityId/settings/decay-preview
 * Preview what the decay effect would be for different half-life values
 */
router.get('/:communityId/settings/decay-preview', async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const userId = (req as any).user?.userId;
    const { half_life_months = 6 } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Verify user is an admin of this community
    const memberCheck = await query(
      `SELECT role FROM communities.members
       WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
      [communityId, userId]
    );

    if (memberCheck.rowCount === 0 || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only community admins can view decay preview',
      });
    }

    const halfLife = parseInt(half_life_months as string, 10) || 6;

    // Calculate decay preview for different time periods
    const decayPreview = await query(
      `SELECT
        100 AS original_karma,
        ROUND(100 * reputation.calculate_decayed_karma(100, NOW() - INTERVAL '1 month', $1)) AS after_1_month,
        ROUND(100 * reputation.calculate_decayed_karma(100, NOW() - INTERVAL '3 months', $1)) AS after_3_months,
        ROUND(100 * reputation.calculate_decayed_karma(100, NOW() - INTERVAL '6 months', $1)) AS after_6_months,
        ROUND(100 * reputation.calculate_decayed_karma(100, NOW() - INTERVAL '12 months', $1)) AS after_12_months`,
      [halfLife]
    );

    res.json({
      success: true,
      data: {
        half_life_months: halfLife,
        decay_preview: decayPreview.rows[0],
        explanation: `With a ${halfLife}-month half-life, karma decays by 50% every ${halfLife} months of inactivity`,
      },
    });
  } catch (error: any) {
    console.error('Error generating decay preview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate decay preview',
      error: error.message,
    });
  }
});

export default router;
