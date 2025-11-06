import { Router, Request, Response } from 'express';
import { query } from '../database/db';
import { publishEvent } from '../events/publisher';

const router = Router();

// GET /requests - Get all requests (with filters)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { community_id, status = 'open', type, limit = 50, offset = 0 } = req.query;

    let queryText = `
      SELECT
        r.id, r.community_id, r.requester_id, r.title, r.description,
        r.category, r.urgency, r.status, r.created_at, r.updated_at,
        u.name as requester_name,
        c.name as community_name
      FROM requests.help_requests r
      LEFT JOIN auth.users u ON r.requester_id = u.id
      LEFT JOIN communities.communities c ON r.community_id = c.id
      WHERE r.status = $1
    `;

    const params: any[] = [status];
    let paramCount = 2;

    if (community_id) {
      queryText += ` AND r.community_id = $${paramCount}`;
      params.push(community_id);
      paramCount++;
    }

    if (type) {
      queryText += ` AND r.category = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    queryText += ` ORDER BY r.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    });
  } catch (error: any) {
    console.error('Error fetching requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requests',
      error: error.message,
    });
  }
});

// GET /requests/matched/for-user - Get requests matching user's skills
router.get('/matched/for-user', async (req: Request, res: Response) => {
  try {
    const { user_id, limit = 10 } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required',
      });
    }

    // Get requests from user's communities that match their skills
    // Skills match is based on category mapping to skills
    const result = await query(
      `SELECT DISTINCT
        r.id, r.community_id, r.requester_id, r.title, r.description,
        r.category, r.urgency, r.status, r.created_at, r.updated_at,
        u.name as requester_name,
        c.name as community_name,
        CASE
          WHEN r.urgency = 'high' THEN 3
          WHEN r.urgency = 'medium' THEN 2
          ELSE 1
        END as urgency_priority
      FROM requests.help_requests r
      LEFT JOIN auth.users u ON r.requester_id = u.id
      LEFT JOIN communities.communities c ON r.community_id = c.id
      -- Only from communities the user is a member of
      INNER JOIN communities.members m ON r.community_id = m.community_id
      WHERE r.status = 'open'
        AND m.user_id = $1
        AND m.status = 'active'
        AND r.requester_id != $1
        AND EXISTS (
          -- Match request category to user skills
          SELECT 1 FROM auth.user_skills s
          WHERE s.user_id = $1
          AND (
            -- Direct category matches
            (r.category = 'transportation' AND s.skill = 'driving')
            OR (r.category = 'moving' AND s.skill IN ('moving', 'handyman'))
            OR (r.category = 'childcare' AND s.skill = 'childcare')
            OR (r.category = 'pet_care' AND s.skill = 'pet_care')
            OR (r.category = 'tech_support' AND s.skill IN ('tech_support', 'coding'))
            OR (r.category = 'home_repair' AND s.skill IN ('home_repair', 'handyman', 'electrical', 'plumbing', 'carpentry'))
            OR (r.category = 'gardening' AND s.skill = 'gardening')
            OR (r.category = 'cooking' AND s.skill IN ('cooking', 'baking'))
            OR (r.category = 'tutoring' AND s.skill = 'tutoring')
            OR (r.category = 'language' AND s.skill = 'languages')
            OR (r.category = 'professional_advice' AND s.skill = 'career_advice')
            OR (r.category = 'cleaning' AND s.skill IN ('cleaning', 'organizing'))
          )
        )
      ORDER BY urgency_priority DESC, r.created_at DESC
      LIMIT $2`,
      [user_id, limit]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    });
  } catch (error: any) {
    console.error('Error fetching matched requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch matched requests',
      error: error.message,
    });
  }
});

// GET /requests/:id - Get specific request
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
        r.id, r.community_id, r.requester_id, r.title, r.description,
        r.category, r.urgency, r.status, r.created_at, r.updated_at,
        u.name as requester_name, u.email as requester_email,
        c.name as community_name
      FROM requests.help_requests r
      LEFT JOIN auth.users u ON r.requester_id = u.id
      LEFT JOIN communities.communities c ON r.community_id = c.id
      WHERE r.id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error fetching request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch request',
      error: error.message,
    });
  }
});

// POST /requests - Create new help request
router.post('/', async (req: Request, res: Response) => {
  try {
    const { community_id, requester_id, title, description, type, urgency, location } = req.body;

    // Validation
    if (!community_id || !requester_id || !title || !type) {
      return res.status(400).json({
        success: false,
        message: 'community_id, requester_id, title, and type are required',
      });
    }

    // Verify user is a member of the community
    const memberCheck = await query(
      `SELECT id FROM communities.members
       WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
      [community_id, requester_id]
    );

    if (memberCheck.rowCount === 0) {
      return res.status(403).json({
        success: false,
        message: 'Only community members can post requests',
      });
    }

    // Create request
    const result = await query(
      `INSERT INTO requests.help_requests
        (community_id, requester_id, title, description, category, urgency, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'open')
      RETURNING *`,
      [community_id, requester_id, title, description, type, urgency || 'medium']
    );

    const request = result.rows[0];

    // Publish event
    await publishEvent('request_created', {
      request_id: request.id,
      community_id,
      requester_id,
      type,
      urgency: request.urgency,
    });

    res.status(201).json({
      success: true,
      data: request,
      message: 'Request created successfully',
    });
  } catch (error: any) {
    console.error('Error creating request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create request',
      error: error.message,
    });
  }
});

// PUT /requests/:id - Update request
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, status, urgency, user_id } = req.body;

    // Check if user is the requester
    const requestCheck = await query(
      `SELECT requester_id FROM requests.help_requests WHERE id = $1`,
      [id]
    );

    if (requestCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found',
      });
    }

    if (requestCheck.rows[0].requester_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'Only the requester can update this request',
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
    if (urgency !== undefined) {
      updates.push(`urgency = $${paramCount++}`);
      values.push(urgency);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await query(
      `UPDATE requests.help_requests
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    if (status === 'completed') {
      await publishEvent('request_completed', {
        request_id: id,
        requester_id: user_id,
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Request updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update request',
      error: error.message,
    });
  }
});

// DELETE /requests/:id - Cancel request
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    // Check if user is the requester
    const requestCheck = await query(
      `SELECT requester_id FROM requests.help_requests WHERE id = $1`,
      [id]
    );

    if (requestCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found',
      });
    }

    if (requestCheck.rows[0].requester_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'Only the requester can cancel this request',
      });
    }

    // Cancel request
    await query(
      `UPDATE requests.help_requests
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    // Publish event
    await publishEvent('request_cancelled', {
      request_id: id,
      requester_id: user_id,
    });

    res.json({
      success: true,
      message: 'Request cancelled successfully',
    });
  } catch (error: any) {
    console.error('Error cancelling request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel request',
      error: error.message,
    });
  }
});

export default router;
