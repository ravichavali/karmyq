-- Migration: Add location and category fields to communities
-- Date: 2025-11-05

-- Add new columns
ALTER TABLE communities.communities
ADD COLUMN IF NOT EXISTS location VARCHAR(255),
ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_communities_location ON communities.communities(location);
CREATE INDEX IF NOT EXISTS idx_communities_category ON communities.communities(category);
CREATE INDEX IF NOT EXISTS idx_communities_status ON communities.communities(status);

-- Update existing communities with default values if needed
-- (Optional: you can set default categories based on existing data)
