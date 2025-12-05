import { Router, Request, Response } from 'express';
import { query } from '../database/db';
import { publishEvent } from '../events/publisher';
import {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
  sendForbidden,
  sendConflict,
  sendInternalError,
  HTTP_STATUS
} from '../../shared/utils/response';

const router = Router();

// GET /communities - Get all communities (with optional filters and search)
router.get('/', async (req: any, res: Response) => {
  try {
    const {
      status = 'active',
      limit = 50,
      offset = 0,
      search = '',
      location = '',
      category = '',
      has_space = '',
      sort = 'newest'
    } = req.query;

    // Build WHERE conditions dynamically
    const conditions: string[] = ['c.status = $1'];
    const params: any[] = [status];
    let paramCount = 2;

    // Search in name and description
    if (search) {
      conditions.push(`(c.name ILIKE $${paramCount} OR c.description ILIKE $${paramCount})`);
      params.push(`%${search}%`);
      paramCount++;
    }

    // Filter by location
    if (location) {
      conditions.push(`c.location ILIKE $${paramCount}`);
      params.push(`%${location}%`);
      paramCount++;
    }

    // Filter by category
    if (category) {
      conditions.push(`c.category = $${paramCount}`);
      params.push(category);
      paramCount++;
    }

    // Filter communities with available space
    if (has_space === 'true') {
      conditions.push('c.current_members < c.max_members');
    }

    // Determine sort order
    let orderBy = 'c.created_at DESC';
    if (sort === 'members') {
      orderBy = 'c.current_members DESC, c.created_at DESC';
    } else if (sort === 'alphabetical') {
      orderBy = 'c.name ASC';
    }

    // Add limit and offset to params
    params.push(limit, offset);

    const result = await query(
      `SELECT
        c.id, c.name, c.description, c.location, c.category,
        c.max_members, c.current_members, c.access_type,
        c.creator_id, c.status, c.created_at, c.updated_at,
        u.name as creator_name
      FROM communities.communities c
      LEFT JOIN auth.users u ON c.creator_id = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      params
    );

    sendSuccess(res, {
      communities: result.rows,
      count: result.rowCount,
      total: result.rowCount, // In production, you'd do a separate COUNT query
    }, HTTP_STATUS.OK, { requestId: req.id });
  } catch (error: any) {
    console.error('Error fetching communities:', error);
    sendInternalError(res, 'Failed to fetch communities', error, { requestId: req.id });
  }
});

// GET /communities/my - Get communities the user is a member of
router.get('/my/communities', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required',
      });
    }

    const result = await query(
      `SELECT
        c.id, c.name, c.description, c.location, c.category,
        c.max_members, c.current_members, c.access_type,
        c.creator_id, c.status, c.created_at, c.updated_at,
        u.name as creator_name,
        m.role, m.joined_at
      FROM communities.members m
      JOIN communities.communities c ON m.community_id = c.id
      LEFT JOIN auth.users u ON c.creator_id = u.id
      WHERE m.user_id = $1 AND m.status = 'active' AND c.status = 'active'
      ORDER BY m.joined_at DESC`,
      [user_id]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    });
  } catch (error: any) {
    console.error('Error fetching user communities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user communities',
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
        c.id, c.name, c.description, c.location, c.category,
        c.max_members, c.current_members, c.access_type,
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

    // Get members (include both active and pending for admin view)
    const membersResult = await query(
      `SELECT
        m.id, m.user_id, m.role, m.status, m.joined_at, m.join_request_message,
        u.name as user_name, u.email as user_email
      FROM communities.members m
      LEFT JOIN auth.users u ON m.user_id = u.id
      WHERE m.community_id = $1 AND m.status IN ('active', 'pending')
      ORDER BY m.status DESC, m.joined_at ASC`,
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
// SECURITY: creator_id comes from verified JWT token, not from request body
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, location, category, max_members = 150 } = req.body;
    // SECURITY: Always use verified userId from JWT, never trust client-provided creator_id
    const creator_id = (req as any).user?.userId;

    // Validation
    if (!creator_id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required',
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
        (name, description, location, category, max_members, current_members, creator_id, status)
      VALUES ($1, $2, $3, $4, $5, 1, $6, 'active')
      RETURNING *`,
      [name, description, location, category, max_members, creator_id]
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
    const { name, description, location, category, max_members, status, user_id } = req.body;

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
    if (location !== undefined) {
      updates.push(`location = $${paramCount++}`);
      values.push(location);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      values.push(category);
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
