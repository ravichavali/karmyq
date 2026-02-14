-- Migration 011: Community Configuration System
-- Phase 1: Communities define their own rules for trust mechanics, karma distribution, and coordination patterns
--
-- This migration adds:
-- 1. community_configs table - comprehensive configuration for each community
-- 2. config_templates table - pre-made configuration templates that communities can use or copy
-- 3. Indexes for performance
--
-- Related: ADR-XXX (Community Configuration System)

-- ============= COMMUNITY CONFIGS TABLE =============
-- Stores comprehensive configuration for each community
CREATE TABLE IF NOT EXISTS communities.community_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE UNIQUE,

    -- Identity & Boundaries
    member_cap INTEGER DEFAULT 150 CHECK (member_cap BETWEEN 10 AND 150),
    visibility_mode VARCHAR(50) DEFAULT 'public' CHECK (visibility_mode IN ('public', 'members_only', 'hybrid')),
    outsider_response_allowed BOOLEAN DEFAULT FALSE,

    -- Request Types (community-defined taxonomy)
    -- Each type: {name: string, description: string, karma_multiplier: number (0.5-2.0)}
    enabled_request_types JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Karma Mechanics
    karma_split_helper INTEGER DEFAULT 60 CHECK (karma_split_helper BETWEEN 0 AND 100),
    karma_split_requestor INTEGER DEFAULT 40 CHECK (karma_split_requestor BETWEEN -50 AND 100),
    base_karma_pool_per_request INTEGER DEFAULT 100 CHECK (base_karma_pool_per_request BETWEEN 10 AND 1000),
    karma_decay_half_life_days INTEGER DEFAULT 0 CHECK (karma_decay_half_life_days BETWEEN 0 AND 365),

    -- Trust Mechanics
    trust_depth_weight DECIMAL(3,2) DEFAULT 0.60 CHECK (trust_depth_weight BETWEEN 0.0 AND 1.0),
    trust_breadth_weight DECIMAL(3,2) DEFAULT 0.40 CHECK (trust_breadth_weight BETWEEN 0.0 AND 1.0),
    trust_decay_half_life_days INTEGER DEFAULT 90 CHECK (trust_decay_half_life_days BETWEEN 30 AND 365),
    trust_path_max_hops INTEGER DEFAULT 3 CHECK (trust_path_max_hops BETWEEN 1 AND 5),
    min_interactions_for_trust INTEGER DEFAULT 1 CHECK (min_interactions_for_trust BETWEEN 1 AND 10),

    -- Community Onboarding
    request_approval_required BOOLEAN DEFAULT FALSE,
    new_member_karma_lockout_days INTEGER DEFAULT 0 CHECK (new_member_karma_lockout_days BETWEEN 0 AND 30),
    join_approval_required BOOLEAN DEFAULT TRUE,
    joining_counts_as_interaction BOOLEAN DEFAULT TRUE,

    -- Metadata
    template_source VARCHAR(255), -- which template was used (if any)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Validation constraint: trust weights must sum to 1.0
    CONSTRAINT trust_weights_sum CHECK (
        ABS((trust_depth_weight + trust_breadth_weight) - 1.0) < 0.01
    )
);

COMMENT ON TABLE communities.community_configs IS 'Comprehensive configuration for community trust, karma, and coordination mechanics';
COMMENT ON COLUMN communities.community_configs.enabled_request_types IS 'Community-defined request types with karma multipliers (JSONB array)';
COMMENT ON COLUMN communities.community_configs.karma_split_helper IS 'Percentage of karma pool awarded to helper (0-100)';
COMMENT ON COLUMN communities.community_configs.karma_split_requestor IS 'Percentage awarded to requestor (-50 to 100, can be negative)';
COMMENT ON COLUMN communities.community_configs.karma_decay_half_life_days IS '0 = no decay (bankable), >0 = decay with this half-life';
COMMENT ON COLUMN communities.community_configs.trust_depth_weight IS 'Weight given to repeated interactions with same people (0.0-1.0)';
COMMENT ON COLUMN communities.community_configs.trust_breadth_weight IS 'Weight given to network diversity (0.0-1.0, must sum to 1.0 with depth)';
COMMENT ON COLUMN communities.community_configs.visibility_mode IS 'public: anyone can see requests, members_only: only members, hybrid: public listings with member-only details';

-- ============= CONFIG TEMPLATES TABLE =============
-- Pre-made configuration templates for browsing and copying
CREATE TABLE IF NOT EXISTS communities.config_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    config_json JSONB NOT NULL, -- full config as JSON
    is_public BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE communities.config_templates IS 'Configuration templates that communities can browse and copy (evolutionary discovery)';
COMMENT ON COLUMN communities.config_templates.config_json IS 'Full configuration as JSON (matches community_configs structure)';
COMMENT ON COLUMN communities.config_templates.usage_count IS 'How many communities use this template (for sorting by popularity)';

-- ============= INDEXES =============
CREATE INDEX IF NOT EXISTS idx_community_configs_community_id ON communities.community_configs(community_id);
CREATE INDEX IF NOT EXISTS idx_community_configs_template_source ON communities.community_configs(template_source);
CREATE INDEX IF NOT EXISTS idx_config_templates_usage ON communities.config_templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_config_templates_is_public ON communities.config_templates(is_public);

-- ============= SEED DATA: 3 STARTER TEMPLATES =============

-- Template 1: "Cohousing Default"
-- High-trust, balanced participation, relationship-focused
INSERT INTO communities.config_templates (name, description, config_json) VALUES (
    'Cohousing Default',
    'High-trust, balanced participation, relationship-focused. Good for established communities like cohousing or intentional communities.',
    '{
        "member_cap": 150,
        "visibility_mode": "public",
        "outsider_response_allowed": true,
        "enabled_request_types": [
            {"name": "meal_share", "description": "Share meals or cooking", "karma_multiplier": 1.0},
            {"name": "tool_borrow", "description": "Borrow tools or equipment", "karma_multiplier": 0.8},
            {"name": "ride_share", "description": "Share rides or transportation", "karma_multiplier": 1.2},
            {"name": "childcare", "description": "Help with childcare or babysitting", "karma_multiplier": 1.5}
        ],
        "karma_split_helper": 60,
        "karma_split_requestor": 40,
        "base_karma_pool_per_request": 100,
        "karma_decay_half_life_days": 0,
        "trust_depth_weight": 0.6,
        "trust_breadth_weight": 0.4,
        "trust_decay_half_life_days": 180,
        "trust_path_max_hops": 3,
        "min_interactions_for_trust": 1,
        "request_approval_required": false,
        "new_member_karma_lockout_days": 0,
        "join_approval_required": true,
        "joining_counts_as_interaction": true
    }'::jsonb
) ON CONFLICT (name) DO NOTHING;

-- Template 2: "Neighborhood Cautious"
-- Boundary-conscious, helper-focused, gradual trust-building
INSERT INTO communities.config_templates (name, description, config_json) VALUES (
    'Neighborhood Cautious',
    'Boundary-conscious, helper-focused, gradual trust-building. Good for neighborhood groups that are just getting started.',
    '{
        "member_cap": 100,
        "visibility_mode": "members_only",
        "outsider_response_allowed": false,
        "enabled_request_types": [
            {"name": "skill_share", "description": "Share skills or expertise", "karma_multiplier": 1.0},
            {"name": "errand_help", "description": "Help with errands or tasks", "karma_multiplier": 0.9},
            {"name": "pet_sitting", "description": "Pet sitting or care", "karma_multiplier": 1.1}
        ],
        "karma_split_helper": 80,
        "karma_split_requestor": 20,
        "base_karma_pool_per_request": 100,
        "karma_decay_half_life_days": 0,
        "trust_depth_weight": 0.7,
        "trust_breadth_weight": 0.3,
        "trust_decay_half_life_days": 90,
        "trust_path_max_hops": 2,
        "min_interactions_for_trust": 3,
        "request_approval_required": true,
        "new_member_karma_lockout_days": 7,
        "join_approval_required": true,
        "joining_counts_as_interaction": false
    }'::jsonb
) ON CONFLICT (name) DO NOTHING;

-- Template 3: "Experimental Reciprocal"
-- Tests pure gift economy, rapid trust decay, encourages asking
INSERT INTO communities.config_templates (name, description, config_json) VALUES (
    'Experimental Reciprocal',
    'Experimental gift economy with equal karma split and rapid trust evolution. Good for small, experimental communities.',
    '{
        "member_cap": 50,
        "visibility_mode": "hybrid",
        "outsider_response_allowed": false,
        "enabled_request_types": [
            {"name": "general_help", "description": "General help or support", "karma_multiplier": 1.0}
        ],
        "karma_split_helper": 50,
        "karma_split_requestor": 50,
        "base_karma_pool_per_request": 100,
        "karma_decay_half_life_days": 0,
        "trust_depth_weight": 0.5,
        "trust_breadth_weight": 0.5,
        "trust_decay_half_life_days": 30,
        "trust_path_max_hops": 3,
        "min_interactions_for_trust": 1,
        "request_approval_required": false,
        "new_member_karma_lockout_days": 0,
        "join_approval_required": false,
        "joining_counts_as_interaction": true
    }'::jsonb
) ON CONFLICT (name) DO NOTHING;

-- ============= TRIGGER: Update updated_at on config changes =============
CREATE OR REPLACE FUNCTION communities.update_community_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_community_config_timestamp ON communities.community_configs;
CREATE TRIGGER update_community_config_timestamp
BEFORE UPDATE ON communities.community_configs
FOR EACH ROW
EXECUTE FUNCTION communities.update_community_config_timestamp();

-- ============= MIGRATION COMPLETE =============
-- To rollback:
-- DROP TRIGGER IF EXISTS update_community_config_timestamp ON communities.community_configs;
-- DROP FUNCTION IF EXISTS communities.update_community_config_timestamp();
-- DROP TABLE IF EXISTS communities.config_templates CASCADE;
-- DROP TABLE IF EXISTS communities.community_configs CASCADE;
