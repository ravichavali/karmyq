/**
 * Community Configuration Routes
 *
 * Endpoints for managing community configurations, templates, and copying configs.
 * Phase 1: Founder-only configuration updates.
 */

import { Router, Request, Response } from 'express';
import { query } from '../database/db';
import {
  validateCommunityConfig,
  mergeAndValidateConfig,
  getDefaultConfig,
  CommunityConfig,
} from '../services/config-validator';
import { publishEvent } from '../events/publisher';

const router = Router();

/**
 * GET /communities/:id/config
 * Get community configuration
 */
router.get('/:id/config', async (req: Request, res: Response) => {
  try {
    const { id: communityId } = req.params;

    // Get community config
    const configResult = await query(
      `SELECT
        id,
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
        template_source,
        created_at,
        updated_at
      FROM communities.community_configs
      WHERE community_id = $1`,
      [communityId]
    );

    if (configResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Community configuration not found',
      });
    }

    const config = configResult.rows[0];

    // Convert decimal fields to floats
    config.trust_depth_weight = parseFloat(config.trust_depth_weight);
    config.trust_breadth_weight = parseFloat(config.trust_breadth_weight);

    res.json({
      success: true,
      data: {
        community_id: config.community_id,
        config,
        template_source: config.template_source,
      },
    });
  } catch (error: any) {
    console.error('Error fetching community config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch community configuration',
      error: error.message,
    });
  }
});

/**
 * PUT /communities/:id/config
 * Update community configuration (founder only for Phase 1)
 */
router.put('/:id/config', async (req: Request, res: Response) => {
  try {
    const { id: communityId } = req.params;
    const userId = (req as any).user?.userId;
    const configUpdates = req.body.config_updates || req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Verify user is the founder/creator of this community
    const communityCheck = await query(
      `SELECT creator_id FROM communities.communities
       WHERE id = $1`,
      [communityId]
    );

    if (communityCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    if (communityCheck.rows[0].creator_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the community founder can update configuration (Phase 1)',
      });
    }

    // Get existing config
    const existingConfigResult = await query(
      `SELECT * FROM communities.community_configs
       WHERE community_id = $1`,
      [communityId]
    );

    if (existingConfigResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Community configuration not found',
      });
    }

    const existingConfig = existingConfigResult.rows[0];

    // Convert decimal fields to floats
    existingConfig.trust_depth_weight = parseFloat(existingConfig.trust_depth_weight);
    existingConfig.trust_breadth_weight = parseFloat(existingConfig.trust_breadth_weight);

    // Merge and validate
    const validation = mergeAndValidateConfig(existingConfig, configUpdates);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid configuration',
        errors: validation.errors,
      });
    }

    const mergedConfig = validation.config!;

    // Update config in database
    const updateResult = await query(
      `UPDATE communities.community_configs
       SET
         member_cap = $1,
         visibility_mode = $2,
         outsider_response_allowed = $3,
         enabled_request_types = $4,
         karma_split_helper = $5,
         karma_split_requestor = $6,
         base_karma_pool_per_request = $7,
         karma_decay_half_life_days = $8,
         trust_depth_weight = $9,
         trust_breadth_weight = $10,
         trust_decay_half_life_days = $11,
         trust_path_max_hops = $12,
         min_interactions_for_trust = $13,
         request_approval_required = $14,
         new_member_karma_lockout_days = $15,
         join_approval_required = $16,
         joining_counts_as_interaction = $17,
         updated_at = CURRENT_TIMESTAMP
       WHERE community_id = $18
       RETURNING *`,
      [
        mergedConfig.member_cap,
        mergedConfig.visibility_mode,
        mergedConfig.outsider_response_allowed,
        JSON.stringify(mergedConfig.enabled_request_types),
        mergedConfig.karma_split_helper,
        mergedConfig.karma_split_requestor,
        mergedConfig.base_karma_pool_per_request,
        mergedConfig.karma_decay_half_life_days,
        mergedConfig.trust_depth_weight,
        mergedConfig.trust_breadth_weight,
        mergedConfig.trust_decay_half_life_days,
        mergedConfig.trust_path_max_hops,
        mergedConfig.min_interactions_for_trust,
        mergedConfig.request_approval_required,
        mergedConfig.new_member_karma_lockout_days,
        mergedConfig.join_approval_required,
        mergedConfig.joining_counts_as_interaction,
        communityId,
      ]
    );

    // Publish event
    await publishEvent('community.config.updated', {
      community_id: communityId,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    });

    res.json({
      success: true,
      data: {
        community_id: communityId,
        config: updateResult.rows[0],
      },
      message: 'Community configuration updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating community config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update community configuration',
      error: error.message,
    });
  }
});

/**
 * GET /config-templates
 * Browse available configuration templates
 */
router.get('/config-templates', async (req: Request, res: Response) => {
  try {
    const { sort_by = 'usage', public_only = 'true' } = req.query;

    let orderBy = 'usage_count DESC';
    if (sort_by === 'name') {
      orderBy = 'name ASC';
    } else if (sort_by === 'created_at') {
      orderBy = 'created_at DESC';
    }

    const publicFilter = public_only === 'true' ? 'WHERE is_public = true' : '';

    const result = await query(
      `SELECT
        id,
        name,
        description,
        config_json,
        usage_count,
        created_at
      FROM communities.config_templates
      ${publicFilter}
      ORDER BY ${orderBy}`,
      []
    );

    // Add config preview for browsing
    const templates = result.rows.map(template => {
      const config = template.config_json;
      return {
        id: template.id,
        name: template.name,
        description: template.description,
        usage_count: template.usage_count,
        config_preview: {
          karma_split: `${config.karma_split_helper}/${config.karma_split_requestor}`,
          trust_model: config.trust_depth_weight > config.trust_breadth_weight ? 'depth-focused' : 'balanced',
          visibility: config.visibility_mode,
          member_cap: config.member_cap,
        },
        full_config: config,
        created_at: template.created_at,
      };
    });

    res.json({
      success: true,
      data: {
        templates,
      },
    });
  } catch (error: any) {
    console.error('Error fetching config templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch configuration templates',
      error: error.message,
    });
  }
});

/**
 * POST /communities/:id/config/copy-from/:source_community_id
 * Copy configuration from another community
 */
router.post('/:id/config/copy-from/:source_community_id', async (req: Request, res: Response) => {
  try {
    const { id: communityId, source_community_id: sourceId } = req.params;
    const userId = (req as any).user?.userId;
    const { include_request_types = false } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Verify user is the founder of the target community
    const targetCommunityCheck = await query(
      `SELECT creator_id FROM communities.communities
       WHERE id = $1`,
      [communityId]
    );

    if (targetCommunityCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Target community not found',
      });
    }

    if (targetCommunityCheck.rows[0].creator_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the community founder can update configuration',
      });
    }

    // Get source community config
    const sourceConfigResult = await query(
      `SELECT cc.*, c.visibility_mode as community_visibility
       FROM communities.community_configs cc
       JOIN communities.communities c ON cc.community_id = c.id
       WHERE cc.community_id = $1`,
      [sourceId]
    );

    if (sourceConfigResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Source community configuration not found',
      });
    }

    const sourceConfig = sourceConfigResult.rows[0];

    // Check if source community is public OR user is a member
    if (sourceConfig.community_visibility !== 'public') {
      const memberCheck = await query(
        `SELECT id FROM communities.members
         WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
        [sourceId, userId]
      );

      if (memberCheck.rowCount === 0) {
        return res.status(403).json({
          success: false,
          message: 'Cannot copy configuration from private community unless you are a member',
        });
      }
    }

    // Prepare config to copy (optionally exclude request types)
    const configToCopy: any = {
      member_cap: sourceConfig.member_cap,
      visibility_mode: sourceConfig.visibility_mode,
      outsider_response_allowed: sourceConfig.outsider_response_allowed,
      karma_split_helper: sourceConfig.karma_split_helper,
      karma_split_requestor: sourceConfig.karma_split_requestor,
      base_karma_pool_per_request: sourceConfig.base_karma_pool_per_request,
      karma_decay_half_life_days: sourceConfig.karma_decay_half_life_days,
      trust_depth_weight: parseFloat(sourceConfig.trust_depth_weight),
      trust_breadth_weight: parseFloat(sourceConfig.trust_breadth_weight),
      trust_decay_half_life_days: sourceConfig.trust_decay_half_life_days,
      trust_path_max_hops: sourceConfig.trust_path_max_hops,
      min_interactions_for_trust: sourceConfig.min_interactions_for_trust,
      request_approval_required: sourceConfig.request_approval_required,
      new_member_karma_lockout_days: sourceConfig.new_member_karma_lockout_days,
      join_approval_required: sourceConfig.join_approval_required,
      joining_counts_as_interaction: sourceConfig.joining_counts_as_interaction,
    };

    if (include_request_types) {
      configToCopy.enabled_request_types = sourceConfig.enabled_request_types;
    }

    // Update target community config
    const updateResult = await query(
      `UPDATE communities.community_configs
       SET
         member_cap = $1,
         visibility_mode = $2,
         outsider_response_allowed = $3,
         ${include_request_types ? 'enabled_request_types = $4,' : ''}
         karma_split_helper = $${include_request_types ? 5 : 4},
         karma_split_requestor = $${include_request_types ? 6 : 5},
         base_karma_pool_per_request = $${include_request_types ? 7 : 6},
         karma_decay_half_life_days = $${include_request_types ? 8 : 7},
         trust_depth_weight = $${include_request_types ? 9 : 8},
         trust_breadth_weight = $${include_request_types ? 10 : 9},
         trust_decay_half_life_days = $${include_request_types ? 11 : 10},
         trust_path_max_hops = $${include_request_types ? 12 : 11},
         min_interactions_for_trust = $${include_request_types ? 13 : 12},
         request_approval_required = $${include_request_types ? 14 : 13},
         new_member_karma_lockout_days = $${include_request_types ? 15 : 14},
         join_approval_required = $${include_request_types ? 16 : 15},
         joining_counts_as_interaction = $${include_request_types ? 17 : 16},
         updated_at = CURRENT_TIMESTAMP
       WHERE community_id = $${include_request_types ? 18 : 17}
       RETURNING *`,
      include_request_types
        ? [
            configToCopy.member_cap,
            configToCopy.visibility_mode,
            configToCopy.outsider_response_allowed,
            JSON.stringify(configToCopy.enabled_request_types),
            configToCopy.karma_split_helper,
            configToCopy.karma_split_requestor,
            configToCopy.base_karma_pool_per_request,
            configToCopy.karma_decay_half_life_days,
            configToCopy.trust_depth_weight,
            configToCopy.trust_breadth_weight,
            configToCopy.trust_decay_half_life_days,
            configToCopy.trust_path_max_hops,
            configToCopy.min_interactions_for_trust,
            configToCopy.request_approval_required,
            configToCopy.new_member_karma_lockout_days,
            configToCopy.join_approval_required,
            configToCopy.joining_counts_as_interaction,
            communityId,
          ]
        : [
            configToCopy.member_cap,
            configToCopy.visibility_mode,
            configToCopy.outsider_response_allowed,
            configToCopy.karma_split_helper,
            configToCopy.karma_split_requestor,
            configToCopy.base_karma_pool_per_request,
            configToCopy.karma_decay_half_life_days,
            configToCopy.trust_depth_weight,
            configToCopy.trust_breadth_weight,
            configToCopy.trust_decay_half_life_days,
            configToCopy.trust_path_max_hops,
            configToCopy.min_interactions_for_trust,
            configToCopy.request_approval_required,
            configToCopy.new_member_karma_lockout_days,
            configToCopy.join_approval_required,
            configToCopy.joining_counts_as_interaction,
            communityId,
          ]
    );

    res.json({
      success: true,
      data: {
        community_id: communityId,
        config: updateResult.rows[0],
        copied_from: sourceId,
      },
      message: 'Configuration copied successfully',
    });
  } catch (error: any) {
    console.error('Error copying community config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to copy community configuration',
      error: error.message,
    });
  }
});

/**
 * GET /communities/configs/public
 * Browse configurations from thriving communities
 */
router.get('/configs/public', async (req: Request, res: Response) => {
  try {
    const { min_members = 0 } = req.query;

    const result = await query(
      `SELECT
        c.id as community_id,
        c.name,
        c.current_members as member_count,
        cc.*
      FROM communities.communities c
      JOIN communities.community_configs cc ON c.id = cc.community_id
      WHERE c.status = 'active'
        AND c.current_members >= $1
        AND (cc.visibility_mode = 'public' OR cc.visibility_mode = 'hybrid')
      ORDER BY c.current_members DESC
      LIMIT 20`,
      [min_members]
    );

    const communities = result.rows.map(row => ({
      community_id: row.community_id,
      name: row.name,
      member_count: row.member_count,
      config: {
        member_cap: row.member_cap,
        visibility_mode: row.visibility_mode,
        outsider_response_allowed: row.outsider_response_allowed,
        enabled_request_types: row.enabled_request_types,
        karma_split_helper: row.karma_split_helper,
        karma_split_requestor: row.karma_split_requestor,
        base_karma_pool_per_request: row.base_karma_pool_per_request,
        karma_decay_half_life_days: row.karma_decay_half_life_days,
        trust_depth_weight: parseFloat(row.trust_depth_weight),
        trust_breadth_weight: parseFloat(row.trust_breadth_weight),
        trust_decay_half_life_days: row.trust_decay_half_life_days,
        trust_path_max_hops: row.trust_path_max_hops,
        min_interactions_for_trust: row.min_interactions_for_trust,
        request_approval_required: row.request_approval_required,
        new_member_karma_lockout_days: row.new_member_karma_lockout_days,
        join_approval_required: row.join_approval_required,
        joining_counts_as_interaction: row.joining_counts_as_interaction,
      },
    }));

    res.json({
      success: true,
      data: {
        communities,
      },
    });
  } catch (error: any) {
    console.error('Error fetching public community configs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch public community configurations',
      error: error.message,
    });
  }
});

export default router;
