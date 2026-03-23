-- Sprint 36: Add geographic coordinates and interest tags to communities
-- Migration: 20260322-community-tags-geo.sql

ALTER TABLE communities.communities
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_communities_location_geo
  ON communities.communities (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_communities_tags
  ON communities.communities USING GIN (tags);
