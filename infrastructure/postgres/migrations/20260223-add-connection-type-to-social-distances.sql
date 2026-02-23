-- Migration: Add connection_type to auth.social_distances
-- Tracks whether a cached path is from exchange history, community membership, or invitation chain

ALTER TABLE auth.social_distances
ADD COLUMN IF NOT EXISTS connection_type VARCHAR(50) DEFAULT 'exchange';

-- Clear stale cache entries so they get recomputed with the new multi-layer logic
DELETE FROM auth.social_distances;
