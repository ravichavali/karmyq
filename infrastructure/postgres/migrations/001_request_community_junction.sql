-- Migration: Refactor requests to use junction table
-- Date: 2025-01-29
-- Purpose: Fix duplicate request issue by separating requests from communities

BEGIN;

-- Step 1: Create new junction table for request-community relationships
CREATE TABLE IF NOT EXISTS requests.request_communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL,
    community_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    CONSTRAINT fk_request FOREIGN KEY (request_id) REFERENCES requests.help_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_community FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE,

    -- Ensure no duplicate request-community pairs
    CONSTRAINT unique_request_community UNIQUE (request_id, community_id)
);

-- Create indexes for efficient lookups
CREATE INDEX idx_request_communities_request ON requests.request_communities(request_id);
CREATE INDEX idx_request_communities_community ON requests.request_communities(community_id);

-- Step 2: Migrate existing data
-- Group duplicate requests and create junction table entries
INSERT INTO requests.request_communities (request_id, community_id, created_at)
SELECT DISTINCT ON (description, requester_id, FLOOR(EXTRACT(EPOCH FROM created_at) / 5))
    id as request_id,
    community_id,
    created_at
FROM requests.help_requests
WHERE community_id IS NOT NULL
ORDER BY description, requester_id, FLOOR(EXTRACT(EPOCH FROM created_at) / 5), created_at;

-- Step 3: Handle duplicates - consolidate matches to the first request in each group
-- For each group of duplicates, move all matches to the canonical (first) request
WITH duplicate_groups AS (
    SELECT
        id,
        description,
        requester_id,
        FLOOR(EXTRACT(EPOCH FROM created_at) / 5) as time_bucket,
        created_at,
        FIRST_VALUE(id) OVER (
            PARTITION BY description, requester_id, FLOOR(EXTRACT(EPOCH FROM created_at) / 5)
            ORDER BY created_at
        ) as canonical_id
    FROM requests.help_requests
)
UPDATE requests.matches m
SET request_id = dg.canonical_id
FROM duplicate_groups dg
WHERE m.request_id = dg.id
  AND dg.id != dg.canonical_id;

-- Step 4: Delete duplicate requests (keep only the first one from each group)
WITH duplicate_groups AS (
    SELECT
        id,
        description,
        requester_id,
        FLOOR(EXTRACT(EPOCH FROM created_at) / 5) as time_bucket,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY description, requester_id, FLOOR(EXTRACT(EPOCH FROM created_at) / 5)
            ORDER BY created_at
        ) as rn
    FROM requests.help_requests
)
DELETE FROM requests.help_requests
WHERE id IN (
    SELECT id FROM duplicate_groups WHERE rn > 1
);

-- Step 5: Make community_id nullable (we'll eventually remove it)
ALTER TABLE requests.help_requests
    ALTER COLUMN community_id DROP NOT NULL;

-- Add comment explaining the new structure
COMMENT ON TABLE requests.request_communities IS
    'Junction table linking help requests to communities. Allows a single request to be posted to multiple communities without duplication.';

COMMIT;
