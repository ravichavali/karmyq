import { Router, Request, Response } from 'express';
import { query } from '../database/db';
import { publishEvent } from '../events/publisher';
import {
  sendSuccess,
  sendNotFound,
  sendValidationError,
  sendInternalError,
  HTTP_STATUS
} from '../../shared/utils/response';

const router = Router();

// GET /offers - Get all offers
router.get('/', async (req: Request, res: Response) => {
  try {
    const { community_id, status = 'active', type, limit = 50, offset = 0 } = req.query;

    let queryText = `
      SELECT
        o.id, o.community_id, o.offerer_id, o.title, o.description,
        o.category, o.status, o.created_at, o.updated_at,
        u.name as helper_name,
        c.name as community_name
      FROM requests.help_offers o
      LEFT JOIN auth.users u ON o.offerer_id = u.id
      LEFT JOIN communities.communities c ON o.community_id = c.id
      WHERE o.status = $1
    `;

    const params: any[] = [status];
    let paramCount = 2;

    if (community_id) {
      queryText += ` AND o.community_id = $${paramCount}`;
      params.push(community_id);
      paramCount++;
    }

    if (type) {
      queryText += ` AND o.category = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    queryText += ` ORDER BY o.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    sendSuccess(res, {
      offers: result.rows,
      count: result.rowCount,
      total: result.rowCount,
    }, HTTP_STATUS.OK, { requestId: (req as any).id });
  } catch (error: any) {
    console.error('Error fetching offers:', error);
    sendInternalError(res, 'Failed to fetch offers', error instanceof Error ? error : undefined, { requestId: (req as any).id });
  }
});

// GET /offers/:id - Get specific offer
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
        o.id, o.community_id, o.offerer_id, o.title, o.description,
        o.category, o.status, o.created_at, o.updated_at,
        u.name as helper_name, u.email as helper_email,
        c.name as community_name
      FROM requests.help_offers o
      LEFT JOIN auth.users u ON o.offerer_id = u.id
      LEFT JOIN communities.communities c ON o.community_id = c.id
      WHERE o.id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return sendNotFound(res, 'Offer not found', { requestId: (req as any).id });
    }

    sendSuccess(res, result.rows[0], HTTP_STATUS.OK, { requestId: (req as any).id });
  } catch (error: any) {
    console.error('Error fetching offer:', error);
    sendInternalError(res, 'Failed to fetch offer', error instanceof Error ? error : undefined, { requestId: (req as any).id });
  }
});

// POST /offers - Create new offer
router.post('/', async (req: Request, res: Response) => {
  try {
    const { community_id, offerer_id, title, description, type } = req.body;

    // Validation
    if (!community_id || !offerer_id || !title || !type) {
      return res.status(400).json({
        success: false,
        message: 'community_id, offerer_id, title, and type are required',
      });
    }

    // Verify user is a member of the community
    const memberCheck = await query(
      `SELECT id FROM communities.members
       WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
      [community_id, offerer_id]
    );

    if (memberCheck.rowCount === 0) {
      return res.status(403).json({
        success: false,
        message: 'Only community members can post offers',
      });
    }

    // Create offer
    const result = await query(
      `INSERT INTO requests.help_offers
        (community_id, offerer_id, title, description, category, status)
      VALUES ($1, $2, $3, $4, $5, 'active')
      RETURNING *`,
      [community_id, offerer_id, title, description, type]
    );

    const offer = result.rows[0];

    // Publish event
    await publishEvent('offer_created', {
      offer_id: offer.id,
      community_id,
      offerer_id,
      type,
    });

    res.status(201).json({
      success: true,
      data: offer,
      message: 'Offer created successfully',
    });
  } catch (error: any) {
    console.error('Error creating offer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create offer',
      error: error.message,
    });
  }
});

// PUT /offers/:id - Update offer
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, status, user_id } = req.body;

    // Check if user is the offerer
    const offerCheck = await query(
      `SELECT offerer_id FROM requests.help_offers WHERE id = $1`,
      [id]
    );

    if (offerCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found',
      });
    }

    if (offerCheck.rows[0].offerer_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'Only the offerer can update this offer',
      });
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await query(
      `UPDATE requests.help_offers
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Offer updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating offer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update offer',
      error: error.message,
    });
  }
});

// DELETE /offers/:id - Withdraw offer
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    // Check if user is the offerer
    const offerCheck = await query(
      `SELECT offerer_id FROM requests.help_offers WHERE id = $1`,
      [id]
    );

    if (offerCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found',
      });
    }

    if (offerCheck.rows[0].offerer_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'Only the offerer can withdraw this offer',
      });
    }

    // Withdraw offer
    await query(
      `UPDATE requests.help_offers
       SET status = 'withdrawn', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    // Publish event
    await publishEvent('offer_withdrawn', {
      offer_id: id,
      offerer_id: user_id,
    });

    res.json({
      success: true,
      message: 'Offer withdrawn successfully',
    });
  } catch (error: any) {
    console.error('Error withdrawing offer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to withdraw offer',
      error: error.message,
    });
  }
});

/**
 * PUT /offers/:id/privacy
 * Update privacy settings for an offer (Social Karma v2.0)
 */
router.put('/:id/privacy', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_public, offerer_visibility_consent } = req.body;
    const user_id = (req as any).user?.userId;

    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Check if user is the offerer
    const offerCheck = await query(
      `SELECT offerer_id FROM requests.help_offers WHERE id = $1`,
      [id]
    );

    if (offerCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found',
      });
    }

    if (offerCheck.rows[0].offerer_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'Only the offerer can update privacy settings',
      });
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (typeof is_public !== 'undefined') {
      updates.push(`is_public = $${paramCount++}`);
      values.push(is_public);
    }

    if (typeof offerer_visibility_consent !== 'undefined') {
      updates.push(`offerer_visibility_consent = $${paramCount++}`);
      values.push(offerer_visibility_consent);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No privacy settings provided to update',
      });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await query(
      `UPDATE requests.help_offers
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, is_public, offerer_visibility_consent`,
      values
    );

    // Publish privacy settings updated event
    await publishEvent('privacy_settings_updated', {
      entity_type: 'offer',
      entity_id: id,
      user_id,
      is_public,
      offerer_visibility_consent,
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Privacy settings updated',
    });
  } catch (error: any) {
    console.error('Error updating privacy settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update privacy settings',
      error: error.message,
    });
  }
});

export default router;
