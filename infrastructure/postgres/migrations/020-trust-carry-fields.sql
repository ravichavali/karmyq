-- Migration 020: Cross-Community Trust Carry Fields (ADR-038)
-- Date: 2026-02-27
--
-- Adds carry model configuration to community_configs:
--   trust_carry_enabled  — whether carry applies at all (default true)
--   trust_carry_factor   — fraction of max other-community score to carry (default 0.40)
--   trust_carry_cap      — maximum carry score (default 59 = top of Building tier)
--
-- Carry only applies when a user has zero interactions in the last 12 months (ADR-039 alignment).
-- Once any local interaction is completed, the locally-earned score is used instead.

ALTER TABLE communities.community_configs
  ADD COLUMN IF NOT EXISTS trust_carry_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS trust_carry_factor DECIMAL(3,2) DEFAULT 0.40
    CHECK (trust_carry_factor BETWEEN 0.0 AND 1.0),
  ADD COLUMN IF NOT EXISTS trust_carry_cap INTEGER DEFAULT 59
    CHECK (trust_carry_cap BETWEEN 0 AND 100);
