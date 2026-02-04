-- Migration 012: Backfill Community Configurations for Existing Communities
--
-- This migration adds default configurations for all active communities that don't have
-- a config record. Uses the "Cohousing Default" template as the baseline.
--
-- Background: When the Community Configuration System (Migration 011) was deployed,
-- existing communities were not automatically given configs, resulting in blank
-- configuration displays on community pages.
--
-- Date: 2026-02-04

-- ============= BACKFILL COMMUNITY CONFIGS =============
-- Insert default config for all active communities without one
-- Uses the balanced "Cohousing Default" template values

INSERT INTO communities.community_configs (
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
SELECT
    c.id AS community_id,
    150 AS member_cap,
    'public' AS visibility_mode,
    true AS outsider_response_allowed,
    '[
        {"name": "meal_share", "description": "Share meals or cooking", "karma_multiplier": 1.0},
        {"name": "tool_borrow", "description": "Borrow tools or equipment", "karma_multiplier": 0.8},
        {"name": "ride_share", "description": "Share rides or transportation", "karma_multiplier": 1.2},
        {"name": "childcare", "description": "Help with childcare or babysitting", "karma_multiplier": 1.5}
    ]'::jsonb AS enabled_request_types,
    60 AS karma_split_helper,
    40 AS karma_split_requestor,
    100 AS base_karma_pool_per_request,
    0 AS karma_decay_half_life_days,
    0.6 AS trust_depth_weight,
    0.4 AS trust_breadth_weight,
    180 AS trust_decay_half_life_days,
    3 AS trust_path_max_hops,
    1 AS min_interactions_for_trust,
    false AS request_approval_required,
    0 AS new_member_karma_lockout_days,
    true AS join_approval_required,
    true AS joining_counts_as_interaction,
    'Cohousing Default (Auto-backfilled)' AS template_source
FROM communities.communities c
LEFT JOIN communities.community_configs cc ON c.id = cc.community_id
WHERE c.status = 'active'
  AND cc.id IS NULL;

-- ============= VERIFICATION QUERY =============
-- Run this to verify the backfill worked:
-- SELECT COUNT(*) FROM communities.communities c
-- LEFT JOIN communities.community_configs cc ON c.id = cc.community_id
-- WHERE c.status = 'active' AND cc.id IS NULL;
-- Expected result: 0 communities without configs

-- ============= MIGRATION COMPLETE =============
