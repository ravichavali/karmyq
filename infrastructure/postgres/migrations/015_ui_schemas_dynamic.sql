-- Migration: 015_ui_schemas_dynamic.sql
-- Description: Server-Driven UI - Database-driven request type schemas
-- Date: 2026-02-15
-- ADR: ADR-032-server-driven-ui-dynamic-schemas.md

-- Enable UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Table 1: UI Schemas
-- Stores UI schema definitions for request types (both built-in and custom)
-- =============================================================================

CREATE TABLE IF NOT EXISTS requests.ui_schemas (
  -- Identity
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) UNIQUE NOT NULL,  -- 'ride', 'service', 'dogwalking', etc.
  version INTEGER NOT NULL DEFAULT 1,

  -- Metadata
  label VARCHAR(100) NOT NULL,       -- Human-readable name: "Ride Share", "Dog Walking"
  icon VARCHAR(10) NOT NULL,         -- Emoji or icon identifier: "🚗", "🐕"
  color VARCHAR(20) NOT NULL,        -- Theme color: 'blue', 'green', 'purple', etc.
  description TEXT NOT NULL,         -- Tooltip/help text

  -- Schema Definition (JSONB for flexibility)
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of UISection objects
  summary JSONB,                     -- UISummaryConfig object (optional)

  -- Status & Publishing
  status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- 'draft', 'published', 'archived'
  published_at TIMESTAMP,            -- When it was published (null if draft)

  -- A/B Testing Support
  variant VARCHAR(50),               -- 'control', 'variant_a', 'variant_b', etc.
  rollout_percentage INTEGER DEFAULT 100,  -- 0-100, for gradual rollouts

  -- Audit Trail
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT valid_rollout CHECK (rollout_percentage BETWEEN 0 AND 100),
  CONSTRAINT unique_type_variant UNIQUE (type, variant),
  CONSTRAINT check_sections_is_array CHECK (jsonb_typeof(sections) = 'array')
);

-- Indexes for fast lookups
CREATE INDEX idx_ui_schemas_status ON requests.ui_schemas(status);
CREATE INDEX idx_ui_schemas_type_status ON requests.ui_schemas(type, status);
CREATE INDEX idx_ui_schemas_published ON requests.ui_schemas(type, status)
  WHERE status = 'published';

-- GIN index for JSONB queries (enables fast field-level searches)
CREATE INDEX idx_ui_schemas_sections_gin ON requests.ui_schemas USING GIN (sections);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ui_schemas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ui_schemas_updated_at
  BEFORE UPDATE ON requests.ui_schemas
  FOR EACH ROW
  EXECUTE FUNCTION update_ui_schemas_updated_at();

-- =============================================================================
-- Table 2: UI Schema Version History
-- Stores complete snapshots of schemas for rollback capability
-- =============================================================================

CREATE TABLE IF NOT EXISTS requests.ui_schema_versions (
  -- Identity
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schema_id UUID NOT NULL REFERENCES requests.ui_schemas(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,

  -- Snapshot of complete schema at this version
  schema_snapshot JSONB NOT NULL,    -- Complete UISchema object as JSON

  -- Change tracking
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  change_description TEXT,           -- Optional description of changes
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT unique_schema_version UNIQUE (schema_id, version)
);

-- Index for fast version lookups
CREATE INDEX idx_ui_schema_versions_schema_id ON requests.ui_schema_versions(schema_id);
CREATE INDEX idx_ui_schema_versions_created_at ON requests.ui_schema_versions(created_at DESC);

-- =============================================================================
-- Table 3: Validation Rules
-- Stores JSON Schema validation rules for custom request types
-- =============================================================================

CREATE TABLE IF NOT EXISTS requests.validation_rules (
  -- Identity
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL REFERENCES requests.ui_schemas(type) ON DELETE CASCADE,

  -- Validation Schema (JSON Schema format)
  -- Used for custom types that don't have Zod schemas in code
  validation_schema JSONB NOT NULL,  -- JSON Schema definition

  -- Metadata
  version INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- 'active', 'inactive'

  -- Examples (for admin UI testing)
  example_valid_payload JSONB,       -- Example of valid payload
  example_invalid_payload JSONB,     -- Example of invalid payload (for testing)

  -- Audit Trail
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT valid_validation_status CHECK (status IN ('active', 'inactive')),
  CONSTRAINT unique_active_validation UNIQUE (type, status) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT check_validation_schema_is_object CHECK (jsonb_typeof(validation_schema) = 'object')
);

-- Index for fast validation rule lookups
CREATE INDEX idx_validation_rules_type ON requests.validation_rules(type);
CREATE INDEX idx_validation_rules_status ON requests.validation_rules(status);
CREATE INDEX idx_validation_rules_type_active ON requests.validation_rules(type, status)
  WHERE status = 'active';

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_validation_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validation_rules_updated_at
  BEFORE UPDATE ON requests.validation_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_validation_rules_updated_at();

-- =============================================================================
-- Helper Function: Create Version History Entry
-- Automatically creates version history when schema is published
-- =============================================================================

CREATE OR REPLACE FUNCTION create_schema_version_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create version history when publishing
  IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
    INSERT INTO requests.ui_schema_versions (
      schema_id,
      version,
      schema_snapshot,
      changed_by
    ) VALUES (
      NEW.id,
      NEW.version,
      jsonb_build_object(
        'type', NEW.type,
        'version', NEW.version,
        'label', NEW.label,
        'icon', NEW.icon,
        'color', NEW.color,
        'description', NEW.description,
        'sections', NEW.sections,
        'summary', NEW.summary,
        'variant', NEW.variant
      ),
      NEW.updated_by
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_schema_version_history
  AFTER INSERT OR UPDATE ON requests.ui_schemas
  FOR EACH ROW
  EXECUTE FUNCTION create_schema_version_history();

-- =============================================================================
-- Comments for Documentation
-- =============================================================================

COMMENT ON TABLE requests.ui_schemas IS 'Server-driven UI schemas for request types. Supports both built-in (ride, service) and custom (dogwalking, tutoring) types.';
COMMENT ON COLUMN requests.ui_schemas.type IS 'Unique identifier for request type. Must match request_type_enum for built-in types.';
COMMENT ON COLUMN requests.ui_schemas.sections IS 'JSONB array of UISection objects defining form structure.';
COMMENT ON COLUMN requests.ui_schemas.variant IS 'A/B test variant identifier. Multiple variants can exist for same type.';
COMMENT ON COLUMN requests.ui_schemas.rollout_percentage IS 'Percentage of users who see this variant (0-100). Used for gradual rollouts.';

COMMENT ON TABLE requests.ui_schema_versions IS 'Complete version history for UI schemas. Enables rollback to previous versions.';
COMMENT ON COLUMN requests.ui_schema_versions.schema_snapshot IS 'Complete UISchema object at this version.';

COMMENT ON TABLE requests.validation_rules IS 'JSON Schema validation rules for custom request types. Built-in types use Zod schemas in code.';
COMMENT ON COLUMN requests.validation_rules.validation_schema IS 'JSON Schema format validation rules.';

-- =============================================================================
-- Grant Permissions
-- =============================================================================

-- Note: karmyq_user role already has ALL PRIVILEGES on all tables from init.sql
-- No service-specific roles (request_service, auth_service, etc.) exist in the database
-- The ui_schemas table uses auth.users (created_by, updated_by) for audit trails
-- All services connect as karmyq_user and have full access to all tables

-- GRANT statements omitted since karmyq_user already has ALL PRIVILEGES
-- Future enhancement: If service-specific roles are added, uncomment below:

-- -- Request service needs full access to schemas
-- GRANT SELECT, INSERT, UPDATE, DELETE ON requests.ui_schemas TO request_service;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON requests.ui_schema_versions TO request_service;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON requests.validation_rules TO request_service;
--
-- -- Other services only need read access to published schemas
-- GRANT SELECT ON requests.ui_schemas TO auth_service, community_service, reputation_service,
--   notification_service, messaging_service, feed_service, social_graph_service;
