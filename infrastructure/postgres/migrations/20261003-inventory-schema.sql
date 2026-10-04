-- Sprint 132 PR B / ADR-099: private-until-shared inventory catalog.
-- Application SQL enforces audience; owner-role connections bypass ordinary RLS.
CREATE SCHEMA IF NOT EXISTS inventory;

CREATE TABLE IF NOT EXISTS inventory.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_community_id UUID NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  category VARCHAR(30) NOT NULL CHECK (category IN ('tools','electronics','kitchen','books','sports','camping','party','other')),
  condition VARCHAR(20) NULL CHECK (condition IN ('fair','good','like_new','new')),
  status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available','unavailable')),
  -- Creator is attribution, not ownership. Supported user deletion must retain community property.
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT items_exactly_one_owner CHECK ((owner_user_id IS NULL) <> (owner_community_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_items_owner_user ON inventory.items(owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_items_owner_community ON inventory.items(owner_community_id) WHERE owner_community_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS inventory.item_shares (
  item_id UUID NOT NULL REFERENCES inventory.items(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (item_id, community_id)
);
CREATE INDEX IF NOT EXISTS idx_item_shares_community ON inventory.item_shares(community_id);
