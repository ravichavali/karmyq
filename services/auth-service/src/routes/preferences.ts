/**
 * User Preferences Routes - Day 8
 *
 * Manages user preferences for request types and interests
 */

import { Router, Request, Response } from 'express';
import { query } from '../database/db';
import { authMiddleware } from '@karmyq/shared/middleware';

const router = Router();

/**
 * GET /preferences/request-types
 * Get user's current request type subscriptions
 */
router.get('/request-types', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Get user preferences
    const result = await query(
      `SELECT request_type, subscribed, updated_at
       FROM auth.user_request_preferences
       WHERE user_id = $1
       ORDER BY request_type`,
      [userId]
    );

    // If user has no preferences yet, return defaults (all subscribed)
    if (result.rowCount === 0) {
      const defaultPreferences = [
        { request_type: 'generic', subscribed: true },
        { request_type: 'ride', subscribed: true },
        { request_type: 'service', subscribed: true },
        { request_type: 'event', subscribed: true },
        { request_type: 'borrow', subscribed: true },
      ];

      return res.json({
        success: true,
        data: {
          preferences: defaultPreferences,
          isDefault: true,
        },
      });
    }

    res.json({
      success: true,
      data: {
        preferences: result.rows,
        isDefault: false,
      },
    });
  } catch (error: any) {
    console.error('Error fetching request type preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch preferences',
      error: error.message,
    });
  }
});

/**
 * POST /preferences/request-types
 * Update user's request type subscriptions
 */
router.post('/request-types', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { request_type, subscribed } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Validate input
    if (!request_type) {
      return res.status(400).json({
        success: false,
        message: 'request_type is required',
      });
    }

    if (typeof subscribed !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'subscribed must be a boolean',
      });
    }

    // Valid request types
    const validTypes = ['generic', 'ride', 'service', 'event', 'borrow'];
    if (!validTypes.includes(request_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid request_type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    // Upsert preference
    await query(
      `INSERT INTO auth.user_request_preferences (user_id, request_type, subscribed)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, request_type)
       DO UPDATE SET subscribed = $3, updated_at = CURRENT_TIMESTAMP`,
      [userId, request_type, subscribed]
    );

    res.json({
      success: true,
      data: {
        request_type,
        subscribed,
        message: `Successfully ${subscribed ? 'subscribed to' : 'unsubscribed from'} ${request_type} requests`,
      },
    });
  } catch (error: any) {
    console.error('Error updating request type preference:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preference',
      error: error.message,
    });
  }
});

/**
 * PUT /preferences/request-types/bulk
 * Update multiple request type subscriptions at once
 */
router.put('/request-types/bulk', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { preferences } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Validate input
    if (!Array.isArray(preferences)) {
      return res.status(400).json({
        success: false,
        message: 'preferences must be an array',
      });
    }

    // Start transaction
    const client = await query('BEGIN');

    try {
      // Update each preference
      for (const pref of preferences) {
        await query(
          `INSERT INTO auth.user_request_preferences (user_id, request_type, subscribed)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, request_type)
           DO UPDATE SET subscribed = $3, updated_at = CURRENT_TIMESTAMP`,
          [userId, pref.request_type, pref.subscribed]
        );
      }

      await query('COMMIT');

      res.json({
        success: true,
        data: {
          updated: preferences.length,
          message: 'Preferences updated successfully',
        },
      });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error: any) {
    console.error('Error bulk updating preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences',
      error: error.message,
    });
  }
});

/**
 * GET /preferences/interests
 * Get user's interests (service categories, item categories, etc.)
 */
router.get('/interests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const result = await query(
      `SELECT id, interest_type, interest_value, created_at
       FROM auth.user_interests
       WHERE user_id = $1
       ORDER BY interest_type, interest_value`,
      [userId]
    );

    // Group by interest_type for easier frontend consumption
    const grouped: Record<string, string[]> = {};
    result.rows.forEach((row: any) => {
      if (!grouped[row.interest_type]) {
        grouped[row.interest_type] = [];
      }
      grouped[row.interest_type].push(row.interest_value);
    });

    res.json({
      success: true,
      data: {
        interests: result.rows,
        grouped,
        count: result.rowCount,
      },
    });
  } catch (error: any) {
    console.error('Error fetching interests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch interests',
      error: error.message,
    });
  }
});

/**
 * POST /preferences/interests
 * Add a new interest
 */
router.post('/interests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { interest_type, interest_value } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Validate input
    if (!interest_type || !interest_value) {
      return res.status(400).json({
        success: false,
        message: 'interest_type and interest_value are required',
      });
    }

    // Valid interest types
    const validInterestTypes = ['service_category', 'item_category', 'event_type'];
    if (!validInterestTypes.includes(interest_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid interest_type. Must be one of: ${validInterestTypes.join(', ')}`,
      });
    }

    // Insert interest
    const result = await query(
      `INSERT INTO auth.user_interests (user_id, interest_type, interest_value)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, interest_type, interest_value) DO NOTHING
       RETURNING id`,
      [userId, interest_type, interest_value]
    );

    const isNew = result.rowCount > 0;

    res.json({
      success: true,
      data: {
        id: isNew ? result.rows[0].id : null,
        interest_type,
        interest_value,
        message: isNew ? 'Interest added successfully' : 'Interest already exists',
        isNew,
      },
    });
  } catch (error: any) {
    console.error('Error adding interest:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add interest',
      error: error.message,
    });
  }
});

/**
 * DELETE /preferences/interests/:id
 * Remove an interest
 */
router.delete('/interests/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Delete interest (ensure it belongs to the user)
    const result = await query(
      `DELETE FROM auth.user_interests
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Interest not found or does not belong to you',
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Interest removed successfully',
      },
    });
  } catch (error: any) {
    console.error('Error removing interest:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove interest',
      error: error.message,
    });
  }
});

export default router;
