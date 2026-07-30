import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../database/db';
import { publishEvent } from '../events/publisher';
import { getActiveFusionProposalForCommunityRoute } from './fusions';
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
import { normalizeTags } from '../utils/tags';
import { RouteParams } from '@karmyq/shared/middleware/auth';

const router = Router();

/**
 * Build a fresh JWT carrying the user's current active community list.
 * Used after create and after idempotent-join so the caller can immediately
 * access the community without a 403 from a stale token.
 */
async function buildRefreshedToken(
  userId: string,
  email: string,
  currentCommunityId: string
): Promise<{ token: string; communities: Array<{ id: string; role: string; name: string }> }> {
  const memberCommunities = await query(
    `SELECT c.id, c.name, m.role
     FROM communities.communities c
     JOIN communities.members m ON m.community_id = c.id
     WHERE m.user_id = $1 AND m.status = 'active'
     ORDER BY c.name`,
    [userId]
  );
  const communities = memberCommunities.rows.map((row: any) => ({ id: row.id, role: row.role, name: row.name }));
  const token = jwt.sign(
    { userId, email, communities, currentCommunityId },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
  return { token, communities };
}

// GET /communities - Get all communities (with optional filters, search, and discovery modes)
router.get('/', async (req: any, res: Response) => {
  try {
    const {
      mode,
      lat,
      lng,
      tags: tagsParam,
      status = 'active',
      limit = 50,
      offset = 0,
      search = '',
      location = '',
      category = '',
      has_space = '',
      sort = 'newest'
    } = req.query;

    // Geography mode: ?mode=geography&lat=XX&lng=YY
    if (mode === 'geography') {
      if (lat == null || lng == null) {
        // Fall through to default alphabetical if lat/lng missing
      } else {
        const latNum = parseFloat(lat as string);
        const lngNum = parseFloat(lng as string);
        if (isNaN(latNum) || isNaN(lngNum)) {
          return res.status(400).json({ success: false, message: 'lat and lng must be valid numbers' });
        }
        const result = await query(
          `SELECT
            c.id, c.name, c.description, c.location, c.category,
            c.max_members, c.current_members, c.access_type,
            c.creator_id, c.status, c.created_at, c.updated_at,
            c.community_type,
            u.name as creator_name,
            COALESCE(ls.inner_circle, 0) as inner_circle_count,
            COALESCE(ls.active_community, 0) as active_community_count,
            COALESCE(ls.extended_network, 0) as extended_network_count,
            ROUND(SQRT(POWER(c.latitude - $1, 2) + POWER(c.longitude - $2, 2)) * 111, 1) AS distance_km
          FROM communities.communities c
          LEFT JOIN auth.users u ON c.creator_id = u.id
          LEFT JOIN LATERAL (
            SELECT
              COUNT(*) FILTER (WHERE calculate_community_layer(m.user_id, c.id) = 'inner_circle') as inner_circle,
              COUNT(*) FILTER (WHERE calculate_community_layer(m.user_id, c.id) = 'active_community') as active_community,
              COUNT(*) FILTER (WHERE calculate_community_layer(m.user_id, c.id) = 'extended_network') as extended_network
            FROM communities.members m
            WHERE m.community_id = c.id AND m.status = 'active'
          ) ls ON true
          WHERE c.status = 'active' AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
          ORDER BY POWER(c.latitude - $1, 2) + POWER(c.longitude - $2, 2) ASC`,
          [latNum, lngNum]
        );

        if (result.rows.length === 0) {
          // No communities have coordinates — fall back to all active communities
          const fallbackResult = await query(
            `SELECT
              c.id, c.name, c.description, c.location, c.category,
              c.max_members, c.current_members, c.access_type,
              c.creator_id, c.status, c.created_at, c.updated_at,
              c.community_type,
              u.name as creator_name,
              COALESCE(ls.inner_circle, 0) as inner_circle_count,
              COALESCE(ls.active_community, 0) as active_community_count,
              COALESCE(ls.extended_network, 0) as extended_network_count
            FROM communities.communities c
            LEFT JOIN auth.users u ON c.creator_id = u.id
            LEFT JOIN LATERAL (
              SELECT
                COUNT(*) FILTER (WHERE calculate_community_layer(m.user_id, c.id) = 'inner_circle') as inner_circle,
                COUNT(*) FILTER (WHERE calculate_community_layer(m.user_id, c.id) = 'active_community') as active_community,
                COUNT(*) FILTER (WHERE calculate_community_layer(m.user_id, c.id) = 'extended_network') as extended_network
              FROM communities.members m
              WHERE m.community_id = c.id AND m.status = 'active'
            ) ls ON true
            WHERE c.status = 'active'
            ORDER BY c.name ASC`,
            []
          );
          return sendSuccess(res, {
            communities: fallbackResult.rows,
            count: fallbackResult.rowCount,
            total: fallbackResult.rowCount,
            fallback: true,
          }, HTTP_STATUS.OK, { requestId: req.id });
        }

        return sendSuccess(res, {
          communities: result.rows,
          count: result.rowCount,
          total: result.rowCount,
        }, HTTP_STATUS.OK, { requestId: req.id });
      }
    }

    // Interests mode: ?mode=interests&tags=gardening,tech
    if (mode === 'interests' && tagsParam) {
      const tagArray = normalizeTags((tagsParam as string).split(','));
      if (tagArray.length > 0) {
        const result = await query(
          `SELECT
            c.id, c.name, c.description, c.location, c.category,
            c.max_members, c.current_members, c.access_type,
            c.creator_id, c.status, c.created_at, c.updated_at,
            c.community_type,
            u.name as creator_name,
            COALESCE(ls.inner_circle, 0) as inner_circle_count,
            COALESCE(ls.active_community, 0) as active_community_count,
            COALESCE(ls.extended_network, 0) as extended_network_count
          FROM communities.communities c
          LEFT JOIN auth.users u ON c.creator_id = u.id
          LEFT JOIN LATERAL (
            SELECT
              COUNT(*) FILTER (WHERE calculate_community_layer(m.user_id, c.id) = 'inner_circle') as inner_circle,
              COUNT(*) FILTER (WHERE calculate_community_layer(m.user_id, c.id) = 'active_community') as active_community,
              COUNT(*) FILTER (WHERE calculate_community_layer(m.user_id, c.id) = 'extended_network') as extended_network
            FROM communities.members m
            WHERE m.community_id = c.id AND m.status = 'active'
          ) ls ON true
          WHERE c.status = 'active' AND c.tags && $1
          ORDER BY c.name ASC`,
          [tagArray]
        );
        return sendSuccess(res, {
          communities: result.rows,
          count: result.rowCount,
          total: result.rowCount,
        }, HTTP_STATUS.OK, { requestId: req.id });
      }
    }

    // Default: alphabetical with existing filters
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
    } else if (sort === 'activity') {
      orderBy = 'COALESCE(ls.inner_circle, 0) DESC, COALESCE(ls.active_community, 0) DESC, c.current_members DESC, c.created_at DESC';
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
        c.community_type,
        u.name as creator_name,
        COALESCE(ls.inner_circle, 0) as inner_circle_count,
        COALESCE(ls.active_community, 0) as active_community_count,
        COALESCE(ls.extended_network, 0) as extended_network_count
      FROM communities.communities c
      LEFT JOIN auth.users u ON c.creator_id = u.id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE calculate_community_layer(m.user_id, c.id) = 'inner_circle') as inner_circle,
          COUNT(*) FILTER (WHERE calculate_community_layer(m.user_id, c.id) = 'active_community') as active_community,
          COUNT(*) FILTER (WHERE calculate_community_layer(m.user_id, c.id) = 'extended_network') as extended_network
        FROM communities.members m
        WHERE m.community_id = c.id AND m.status = 'active'
      ) ls ON true
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
    (req as any).logger?.error('Error fetching communities', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'GET /' });
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
        c.community_type,
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
    (req as any).logger?.error('Error fetching user communities', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'GET /my/communities' });
    sendInternalError(res, 'Failed to fetch user communities', error instanceof Error ? error : undefined, { requestId: (req as any).id });
  }
});

// GET /communities/tags - Get all distinct tags (must be before /:id to avoid capture)
router.get('/tags', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT DISTINCT UNNEST(tags) AS tag
      FROM communities.communities
      WHERE tags != '{}'
      ORDER BY tag ASC`,
      []
    );
    const tags = result.rows.map((row: any) => row.tag);
    sendSuccess(res, { tags }, HTTP_STATUS.OK, { requestId: (req as any).id });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching tags', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'GET /tags' });
    sendInternalError(res, 'Failed to fetch tags', error instanceof Error ? error : undefined, { requestId: (req as any).id });
  }
});

// GET /communities/:id - Get specific community with members
router.get('/:id', async (req: Request<RouteParams>, res: Response) => {
  try {
    const { id } = req.params;

    // Get community details
    const communityResult = await query(
      `SELECT
        c.id, c.name, c.description, c.location, c.category,
        c.max_members, c.current_members, c.access_type,
        c.creator_id, c.status, c.created_at, c.updated_at,
        c.community_type,
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

    // Size alert — computed from current_members, no background job needed
    const memberCount = community.current_members ?? 0;
    if (memberCount >= 140) community.size_alert = 'urgent_split';
    else if (memberCount >= 130) community.size_alert = 'recommend_split';
    else if (memberCount >= 120) community.size_alert = 'approaching';
    else community.size_alert = null;

    // Active split proposal (if any) — shown to members during voting phase
    const proposalRes = await query(
      `SELECT id, status, group_a_name, group_b_name FROM communities.split_proposals
       WHERE community_id = $1 AND status NOT IN ('executed', 'rejected')
       LIMIT 1`,
      [id]
    );
    community.active_split_proposal = proposalRes.rows[0] ?? null;

    community.active_fusion_proposal = await getActiveFusionProposalForCommunityRoute(id);

    sendSuccess(res, community, HTTP_STATUS.OK, { requestId: (req as any).id });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching community', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'GET /:id' });
    sendInternalError(res, 'Failed to fetch community', error instanceof Error ? error : undefined, { requestId: (req as any).id });
  }
});

// POST /communities - Create new community
// SECURITY: creator_id comes from verified JWT token, not from request body
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, location, category, max_members = 150, access_type = 'public', config, community_type = 'mutual_aid' } = req.body;
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

    // Validate access_type
    if (access_type && !['public', 'private'].includes(access_type)) {
      return sendValidationError(res, 'Access type must be either "public" or "private"', { requestId: (req as any).id });
    }

    // Validate community_type
    if (!['mutual_aid', 'group'].includes(community_type)) {
      return sendValidationError(res, 'community_type must be "mutual_aid" or "group"', { requestId: (req as any).id });
    }

    // Idempotent create (ADR-062): a community's identity is its case-insensitive,
    // trimmed (name, location) pair. If an active community with this identity
    // already exists, join it instead of minting a duplicate. The ORDER BY picks
    // the canonical (oldest) row, consistent with the dedup migration's survivor rule.
    const identityMatch = await query(
      `SELECT * FROM communities.communities
       WHERE status = 'active'
         AND LOWER(TRIM(name)) = LOWER(TRIM($1))
         AND LOWER(TRIM(COALESCE(location, ''))) = LOWER(TRIM(COALESCE($2, '')))
       ORDER BY created_at ASC, id ASC
       LIMIT 1`,
      [name, location ?? null]
    );

    if (identityMatch.rowCount && identityMatch.rowCount > 0) {
      const existing = identityMatch.rows[0];

      // Private communities require approval — don't auto-join, just point the caller at it.
      if (existing.access_type === 'private') {
        return sendSuccess(res, {
          community: existing,
          existing: true,
          joined: false,
          message: 'A private community with this name and location already exists. Request approval to join.',
        }, HTTP_STATUS.OK, { requestId: (req as any).id });
      }

      // Upsert the caller as a member; only bump the count if a new row was inserted.
      const joinResult = await query(
        `INSERT INTO communities.members (community_id, user_id, role, status)
         VALUES ($1, $2, 'member', 'active')
         ON CONFLICT (community_id, user_id) DO NOTHING`,
        [existing.id, creator_id]
      );
      if (joinResult.rowCount && joinResult.rowCount > 0) {
        await query(
          `UPDATE communities.communities SET current_members = current_members + 1 WHERE id = $1`,
          [existing.id]
        );
        existing.current_members = (existing.current_members ?? 0) + 1;
      }

      // Refresh JWT with the updated community list (mirrors the create path).
      const { token: joinToken, communities: joinCommunities } =
        await buildRefreshedToken((req as any).user.userId, (req as any).user.email, existing.id);
      // Reflect the caller's actual role (ON CONFLICT DO NOTHING preserves a prior
      // admin/member role rather than demoting a re-joining admin to 'member').
      const callerRole = joinCommunities.find((c) => c.id === existing.id)?.role ?? 'member';

      return sendSuccess(res, {
        community: { ...existing, role: callerRole },
        existing: true,
        joined: true,
        token: joinToken,
      }, HTTP_STATUS.OK, { requestId: (req as any).id });
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
        (name, description, location, category, max_members, current_members, access_type, creator_id, community_type, status)
      VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8, 'active')
      RETURNING *`,
      [name, description, location, category, max_members, access_type, creator_id, community_type]
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

    // Refresh JWT token with updated community list
    // This prevents 403 errors when creator tries to access the new community immediately
    const { token: newToken } = await buildRefreshedToken(creator_id, (req as any).user.email, community.id);

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
      community: {
        ...community,
        role: 'admin',
      },
      existing: false,
      config: communityConfig,
      token: newToken, // Include refreshed JWT token
    }, HTTP_STATUS.CREATED, { requestId: (req as any).id });
  } catch (error: any) {
    (req as any).logger?.error('Error creating community', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'POST /' });
    sendInternalError(res, 'Failed to create community', error instanceof Error ? error : undefined, { requestId: (req as any).id });
  }
});

// PUT /communities/:id/tags - Update community interest tags
router.put('/:id/tags', async (req: Request, res: Response) => {
  try {
    const { id: communityId } = req.params;
    const { tags } = req.body;
    const user = (req as any).user;

    // Auth check: caller must be admin of this community (via JWT communities field)
    const memberships: Array<{ id: string; name: string; role: string }> = user?.communities ?? [];
    const isAdmin = memberships.some((m) => m.id === communityId && m.role === 'admin');
    if (!isAdmin) {
      return sendForbidden(res, 'Only community admins can update tags', { requestId: (req as any).id });
    }

    // Validate: tags must be an array
    if (!Array.isArray(tags)) {
      return sendValidationError(res, 'tags must be an array', { requestId: (req as any).id });
    }

    // Normalize
    const normalizedTags = normalizeTags(tags);

    // Validate limits
    if (normalizedTags.length > 20) {
      return res.status(400).json({ success: false, message: 'Maximum 20 tags allowed' });
    }
    if (normalizedTags.some((t: string) => t.length > 50)) {
      return res.status(400).json({ success: false, message: 'Each tag must be 50 characters or fewer' });
    }

    // Update
    const result = await query(
      `UPDATE communities.communities
       SET tags = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [normalizedTags, communityId]
    );

    if (result.rowCount === 0) {
      return sendNotFound(res, 'Community not found', { requestId: (req as any).id });
    }

    sendSuccess(res, { community: result.rows[0] }, HTTP_STATUS.OK, { requestId: (req as any).id });
  } catch (error: any) {
    (req as any).logger?.error('Error updating community tags', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'PUT /:id/tags' });
    sendInternalError(res, 'Failed to update community tags', error instanceof Error ? error : undefined, { requestId: (req as any).id });
  }
});

// PUT /communities/:id/location - Update community lat/lng coordinates
router.put('/:id/location', async (req: Request, res: Response) => {
  try {
    const { id: communityId } = req.params;
    const { lat, lng } = req.body;
    const user = (req as any).user;

    // Auth check: caller must be admin of this community (via JWT communities field)
    const memberships: Array<{ id: string; name: string; role: string }> = user?.communities ?? [];
    const isAdmin = memberships.some((m) => m.id === communityId && m.role === 'admin');
    if (!isAdmin) {
      return sendForbidden(res, 'Only community admins can update location', { requestId: (req as any).id });
    }

    // Validate: lat/lng are numbers in valid ranges
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return sendValidationError(res, 'lat and lng must be numbers', { requestId: (req as any).id });
    }
    if (lat < -90 || lat > 90) {
      return sendValidationError(res, 'lat must be between -90 and 90', { requestId: (req as any).id });
    }
    if (lng < -180 || lng > 180) {
      return sendValidationError(res, 'lng must be between -180 and 180', { requestId: (req as any).id });
    }

    // Update
    const result = await query(
      `UPDATE communities.communities
       SET latitude = $1, longitude = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [lat, lng, communityId]
    );

    if (result.rowCount === 0) {
      return sendNotFound(res, 'Community not found', { requestId: (req as any).id });
    }

    sendSuccess(res, { community: result.rows[0] }, HTTP_STATUS.OK, { requestId: (req as any).id });
  } catch (error: any) {
    (req as any).logger?.error('Error updating community location', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'PUT /:id/location' });
    sendInternalError(res, 'Failed to update community location', error instanceof Error ? error : undefined, { requestId: (req as any).id });
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
    (req as any).logger?.error('Error updating community', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'PUT /:id' });
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
    (req as any).logger?.error('Error archiving community', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'DELETE /:id' });
    sendInternalError(res, 'Failed to archive community', error instanceof Error ? error : undefined, { requestId: (req as any).id });
  }
});

export default router;
