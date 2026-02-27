-- Migration 019: Trust Config Fields for ADR-037 Multi-Signal Formula
-- Date: 2026-02-27
-- ADR: ADR-037 (multi-signal trust score), ADR-039 (decay consistency)
--
-- Adds two new community config fields needed by the ADR-037 formula:
--   trust_feedback_threshold  — star rating at which quality score is exactly zero (default 3.0)
--   trust_negative_allowed    — whether bad actors can score below 0 (default false)
--
-- Also drops the trust_weights_sum constraint because ADR-037 specifies that
-- trust_depth_weight and trust_breadth_weight are independent scaling factors
-- (they need not sum to 1.0 — each scales a separate sub-score independently).

ALTER TABLE communities.community_configs
  ADD COLUMN IF NOT EXISTS trust_feedback_threshold DECIMAL(3,1) DEFAULT 3.0
    CHECK (trust_feedback_threshold BETWEEN 1.0 AND 4.9),
  ADD COLUMN IF NOT EXISTS trust_negative_allowed BOOLEAN DEFAULT FALSE;

-- Drop the old sum-to-1.0 constraint (was: depth_weight + breadth_weight = 1.0)
ALTER TABLE communities.community_configs
  DROP CONSTRAINT IF EXISTS trust_weights_sum;
