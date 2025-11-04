import { Router, Request, Response } from 'express';
import { query } from '../database/db';
import { publishEvent } from '../events/publisher';

const router = Router();

// GET /communities - Get all communities (with optional filters)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status = 'active', limit = 50, offset = 0 } = req.query;

    const result = await query(
      `SELECT
        c.id, c.name, c.description, c.max_members, c.current_members,
        c.creator_id, c.status, c.created_at, c.updated_at,
        u.name as creator_name
      FROM communities.communities c
      LEFT JOIN auth.users u ON c.creator_id = u.id
      WHERE c.status = $1
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    });
  } catch (error: any) {
    console.error('Error fetching communities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch communities',
      error: error.message,
    });
  }
});

// GET /communities/:id - Get specific community with members
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get community details
    const communityResult = await query(
      `SELECT
        c.id, c.name, c.description, c.max_members, c.current_members,
        c.creator_id, c.status, c.created_at, c.updated_at,
        u.name as creator_name
      FROM communities.communities c
      LEFT JOIN auth.users u ON c.creator_id = u.id
      WHERE c.id = $1`,
      [id]
    );

    if (communityResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    // Get members
    const membersResult = await query(
      `SELECT
        m.id, m.user_id, m.role, m.status, m.joined_at,
        u.name as user_name, u.email as user_email
      FROM communities.members m
      LEFT JOIN auth.users u ON m.user_id = u.id
      WHERE m.community_id = $1 AND m.status = 'active'
      ORDER BY m.joined_at ASC`,
      [id]
    );

    const community = communityResult.rows[0];
    community.members = membersResult.rows;

    res.json({
      success: true,
      data: community,
    });
  } catch (error: any) {
    console.error('Error fetching community:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch community',
      error: error.message,
    });
  }
});

// POST /communities - Create new community
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, max_members = 150, creator_id } = req.body;

    // Validation
    if (!name || !creator_id) {
      return res.status(400).json({
        success: false,
        message: 'Name and creator_id are required',
      });
    }

    if (name.length < 3 || name.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'Community name must be between 3 and 255 characters',
      });
    }

    if (max_members < 1 || max_members > 150) {
      return res.status(400).json({
        success: false,
        message: 'Max members must be between 1 and 150 (Dunbar\'s number)',
      });
    }

    // Create community
    const result = await query(
      `INSERT INTO communities.communities
        (name, description, max_members, current_members, creator_id, status)
      VALUES ($1, $2, $3, 1, $4, 'active')
      RETURNING *`,
      [name, description, max_members, creator_id]
    );

    const community = result.rows[0];

    // Add creator as first member with admin role
    await query(
      `INSERT INTO communities.members
        (community_id, user_id, role, status)
      VALUES ($1, $2, 'admin', 'active')`,
      [community.id, creator_id]
    );

    // Publish event
    await publishEvent('community_created', {
      community_id: community.id,
      creator_id,
      name,
    });

    res.status(201).json({
      success: true,
      data: community,
      message: 'Community created successfully',
    });
  } catch (error: any) {
    console.error('Error creating community:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create community',
      error: error.message,
    });
  }
});

// PUT /communities/:id - Update community
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, max_members, status, user_id } = req.body;

    // Check if user is admin of this community
    const memberCheck = await query(
      `SELECT role FROM communities.members
       WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
      [id, user_id]
    );

    if (memberCheck.rowCount === 0 || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only community admins can update community details',
      });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (max_members !== undefined) {
      updates.push(`max_members = $${paramCount++}`);
      values.push(max_members);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await query(
      `UPDATE communities.communities
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Community updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating community:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update community',
      error: error.message,
    });
  }
});

// DELETE /communities/:id - Archive community (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    // Check if user is admin
    const memberCheck = await query(
      `SELECT role FROM communities.members
       WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
      [id, user_id]
    );

    if (memberCheck.rowCount === 0 || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only community admins can archive the community',
      });
    }

    // Archive community
    const result = await query(
      `UPDATE communities.communities
       SET status = 'archived', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    // Publish event
    await publishEvent('community_archived', {
      community_id: id,
      archived_by: user_id,
    });

    res.json({
      success: true,
      message: 'Community archived successfully',
    });
  } catch (error: any) {
    console.error('Error archiving community:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to archive community',
      error: error.message,
    });
  }
});

export default router;
