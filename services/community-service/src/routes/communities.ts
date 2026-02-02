import { Router, Request, Response } from 'express';
import { query } from '../database/db';
import { publishEvent } from '../events/publisher';
import {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
  sendUnauthorized,
  sendForbidden,
  sendConflict,
  sendInternalError,
  HTTP_STATUS
} from '@karmyq/shared/utils/response';

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
      return sendValidationError(res, 'user_id is required', { requestId: (req as any).id });
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

    sendSuccess(res, {
      communities: result.rows,
      count: result.rowCount,
      total: result.rowCount,
    }, HTTP_STATUS.OK, { requestId: (req as any).id });
  } catch (error: any) {
    console.error('Error fetching user communities:', error);
    sendInternalError(res, 'Failed to fetch user communities', error instanceof Error ? error : undefined, { requestId: (req as any).id });
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
      return sendNotFound(res, 'Community not found', { requestId: (req as any).id });
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

    sendSuccess(res, community, HTTP_STATUS.OK, { requestId: (req as any).id });
  } catch (error: any) {
    console.error('Error fetching community:', error);
    sendInternalError(res, 'Failed to fetch community', error instanceof Error ? error : undefined, { requestId: (req as any).id });
  }
});

// POST /communities - Create new community
// SECURITY: creator_id comes from verified JWT token, not from request body
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, location, category, max_members = 150, config } = req.body;
    // SECURITY: Always use verified userId from JWT, never trust client-provided creator_id
    const creator_id = (req as any).user?.userId;

    // Validation
    if (!creator_id) {
      return sendUnauthorized(res, 'Authentication required', { requestId: (req as any).id });
    }

    if (!name) {
      return sendValidationError(res, 'Name is required', { requestId: (req as any).id });
    }

    if (name.length < 3 || name.length > 255) {
      return sendValidationError(res, 'Community name must be between 3 and 255 characters', { requestId: (req as any).id });
    }

    if (max_members < 1 || max_members > 150) {
      return sendValidationError(res, 'Max members must be between 1 and 150 (Dunbar\'s number)', { requestId: (req as any).id });
    }

    // Determine configuration to use
    let communityConfig: any = null;
    let templateSource: string | null = null;

    if (config) {
      if (config.template_id) {
        // Use template
        const templateResult = await query(
          `SELECT config_json, name FROM communities.config_templates WHERE id = $1`,
          [config.template_id]
        );

        if (templateResult.rowCount === 0) {
          return sendValidationError(res, 'Template not found', { requestId: (req as any).id });
        }

        communityConfig = templateResult.rows[0].config_json;
        templateSource = templateResult.rows[0].name;

        // Increment template usage count
        await query(
          `UPDATE communities.config_templates SET usage_count = usage_count + 1 WHERE id = $1`,
          [config.template_id]
        );
      } else if (config.custom_config) {
        // Use custom config - validate it first
        const { validateCommunityConfig } = require('../services/config-validator');
        const validation = validateCommunityConfig(config.custom_config);

        if (!validation.isValid) {
          return res.status(400).json({
            success: false,
            message: 'Invalid configuration',
            errors: validation.errors,
          });
        }

        communityConfig = config.custom_config;
      }
    }

    // If no config provided, use "Cohousing Default" template
    if (!communityConfig) {
      const defaultTemplate = await query(
        `SELECT config_json, name FROM communities.config_templates WHERE name = 'Cohousing Default'`,
        []
      );

      if (defaultTemplate.rowCount > 0) {
        communityConfig = defaultTemplate.rows[0].config_json;
        templateSource = defaultTemplate.rows[0].name;
      } else {
        // Fallback to hardcoded default if template not found
        const { getDefaultConfig } = require('../services/config-validator');
        communityConfig = getDefaultConfig();
      }
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

    // Create community configuration
    await query(
      `INSERT INTO communities.community_configs
        (
          community_id,
          member_cap,
          visibility_mode,
          outsider_response_allowed,
          enabled_request_types,
          karma_split_helper,
          karma_split_requestor,
          base_karma_pool_per_request,
          karma_decay_half_life_days,
          trust_depth_weight,
          trust_breadth_weight,
          trust_decay_half_life_days,
          trust_path_max_hops,
          min_interactions_for_trust,
          request_approval_required,
          new_member_karma_lockout_days,
          join_approval_required,
          joining_counts_as_interaction,
          template_source
        )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        community.id,
        communityConfig.member_cap,
        communityConfig.visibility_mode,
        communityConfig.outsider_response_allowed,
        JSON.stringify(communityConfig.enabled_request_types),
        communityConfig.karma_split_helper,
        communityConfig.karma_split_requestor,
        communityConfig.base_karma_pool_per_request,
        communityConfig.karma_decay_half_life_days,
        communityConfig.trust_depth_weight,
        communityConfig.trust_breadth_weight,
        communityConfig.trust_decay_half_life_days,
        communityConfig.trust_path_max_hops,
        communityConfig.min_interactions_for_trust,
        communityConfig.request_approval_required,
        communityConfig.new_member_karma_lockout_days,
        communityConfig.join_approval_required,
        communityConfig.joining_counts_as_interaction,
        templateSource,
      ]
    );

    // Add creator as first member with admin role
    await query(
      `INSERT INTO communities.members
        (community_id, user_id, role, status)
      VALUES ($1, $2, 'admin', 'active')`,
      [community.id, creator_id]
    );

    // Publish events
    await publishEvent('community_created', {
      community_id: community.id,
      creator_id,
      name,
    });

    await publishEvent('community.config.created', {
      community_id: community.id,
      creator_id,
      template_source: templateSource,
      created_at: new Date().toISOString(),
    });

    sendSuccess(res, {
      ...community,
      config: communityConfig,
    }, HTTP_STATUS.CREATED, { requestId: (req as any).id });
  } catch (error: any) {
    console.error('Error creating community:', error);
    sendInternalError(res, 'Failed to create community', error instanceof Error ? error : undefined, { requestId: (req as any).id });
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
      return sendForbidden(res, 'Only community admins can update community details', { requestId: (req as any).id });
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
      return sendNotFound(res, 'Community not found', { requestId: (req as any).id });
    }

    sendSuccess(res, result.rows[0], HTTP_STATUS.OK, { requestId: (req as any).id });
  } catch (error: any) {
    console.error('Error updating community:', error);
    sendInternalError(res, 'Failed to update community', error instanceof Error ? error : undefined, { requestId: (req as any).id });
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
      return sendForbidden(res, 'Only community admins can archive the community', { requestId: (req as any).id });
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
      return sendNotFound(res, 'Community not found', { requestId: (req as any).id });
    }

    // Publish event
    await publishEvent('community_archived', {
      community_id: id,
      archived_by: user_id,
    });

    sendSuccess(res, { message: 'Community archived successfully' }, HTTP_STATUS.OK, { requestId: (req as any).id });
  } catch (error: any) {
    console.error('Error archiving community:', error);
    sendInternalError(res, 'Failed to archive community', error instanceof Error ? error : undefined, { requestId: (req as any).id });
  }
});

export default router;
