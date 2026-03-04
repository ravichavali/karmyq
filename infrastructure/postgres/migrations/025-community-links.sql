-- Migration 025: Community Links (Sprint 15 - Fractal Community Model Phase 1)
-- Creates the community_links table enabling voluntary linking between communities.
-- Supports sister, parent_child, and split_origin relationships with configurable
-- trust carry factors and optional sister feed inclusion.

BEGIN;

CREATE TABLE IF NOT EXISTS communities.community_links (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_a_id      UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  community_b_id      UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  link_type           TEXT NOT NULL CHECK (link_type IN ('sister', 'parent_child', 'split_origin')),
  trust_carry_factor  NUMERIC(3,2) NOT NULL DEFAULT 0.40
                        CHECK (trust_carry_factor >= 0.00 AND trust_carry_factor <= 1.00),
  show_in_sister_feeds BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_admin_a  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_admin_b  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'active', 'inactive')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate links between the same two communities
  UNIQUE (community_a_id, community_b_id),
  -- Prevent self-links
  CHECK (community_a_id <> community_b_id)
);

-- Indexes for efficient lookup from either side
CREATE INDEX IF NOT EXISTS idx_community_links_a
  ON communities.community_links(community_a_id);

CREATE INDEX IF NOT EXISTS idx_community_links_b
  ON communities.community_links(community_b_id);

CREATE INDEX IF NOT EXISTS idx_community_links_status
  ON communities.community_links(status);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION communities.update_community_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER community_links_updated_at
  BEFORE UPDATE ON communities.community_links
  FOR EACH ROW
  EXECUTE FUNCTION communities.update_community_links_updated_at();

COMMIT;
