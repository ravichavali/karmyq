-- Migration: 20260311-network-cohesion-metrics
-- Adds network cohesion metrics and trust trend columns to reputation.community_trust_scores
-- Sprint 22: Network cohesion scoring

ALTER TABLE reputation.community_trust_scores
  ADD COLUMN IF NOT EXISTS previous_score INTEGER,
  ADD COLUMN IF NOT EXISTS previous_calculated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS network_cohesion_score INTEGER,
  ADD COLUMN IF NOT EXISTS network_reciprocity NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS network_density NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS network_clustering NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS network_avg_path_length NUMERIC(4,2);
