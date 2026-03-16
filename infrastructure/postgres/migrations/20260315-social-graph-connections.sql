-- infrastructure/postgres/migrations/20260315-social-graph-connections.sql

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS social_graph;

-- Create connections materialized table
CREATE TABLE IF NOT EXISTS social_graph.connections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                TEXT NOT NULL CHECK (type IN ('exchange', 'community')),
  first_connected_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index for normalized pair deduplication (expressions not allowed in inline UNIQUE constraint)
CREATE UNIQUE INDEX IF NOT EXISTS connections_normalized_pair
  ON social_graph.connections (
    LEAST(user_a_id::text, user_b_id::text),
    GREATEST(user_a_id::text, user_b_id::text)
  );

-- Indexes for neighbor lookup queries (WHERE user_a_id = $1 OR user_b_id = $1)
CREATE INDEX IF NOT EXISTS connections_user_a_idx ON social_graph.connections (user_a_id);
CREATE INDEX IF NOT EXISTS connections_user_b_idx ON social_graph.connections (user_b_id);

-- Backfill from existing completed matches
INSERT INTO social_graph.connections (user_a_id, user_b_id, type, first_connected_at, last_interaction_at)
SELECT
  LEAST(requester_id::text, responder_id::text)::uuid,
  GREATEST(requester_id::text, responder_id::text)::uuid,
  'exchange',
  MIN(updated_at),
  MAX(updated_at)
FROM requests.matches
WHERE status = 'completed'
  AND requester_id IS NOT NULL
  AND responder_id IS NOT NULL
GROUP BY
  LEAST(requester_id::text, responder_id::text),
  GREATEST(requester_id::text, responder_id::text)
ON CONFLICT (
  LEAST(user_a_id::text, user_b_id::text),
  GREATEST(user_a_id::text, user_b_id::text)
) DO NOTHING;
