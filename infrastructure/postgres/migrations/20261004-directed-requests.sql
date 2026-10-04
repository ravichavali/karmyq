-- Sprint 132 PR C / ADR-099. is_directed remains true after target deletion: fail closed.
ALTER TABLE requests.help_requests
  ADD COLUMN IF NOT EXISTS is_directed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS directed_to_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS directed_to_community_id UUID NULL REFERENCES communities.communities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inventory_item_id UUID NULL REFERENCES inventory.items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_help_requests_directed_user
  ON requests.help_requests(directed_to_user_id) WHERE is_directed;
CREATE INDEX IF NOT EXISTS idx_help_requests_directed_community
  ON requests.help_requests(directed_to_community_id) WHERE is_directed;
