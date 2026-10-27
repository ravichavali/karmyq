-- Sprint 134 PR L2: BUG-068's only writer/event was retired in PR L.
-- These interaction-rating fields are unrelated to the live private feedback.feedback ratings.
-- All runtime readers are removed in the same release. No CASCADE: unexpected dependents must fail.
DROP TABLE IF EXISTS requests.interaction_feedback;

ALTER TABLE reputation.trust_scores
  DROP COLUMN IF EXISTS avg_helpfulness,
  DROP COLUMN IF EXISTS avg_responsiveness,
  DROP COLUMN IF EXISTS avg_clarity,
  DROP COLUMN IF EXISTS total_feedback_received;

ALTER TABLE reputation.community_health_metrics
  DROP COLUMN IF EXISTS avg_helpfulness,
  DROP COLUMN IF EXISTS avg_responsiveness,
  DROP COLUMN IF EXISTS avg_clarity;

-- BUG-070: the first working nightly run can exceed the legacy typmods. All-time matches per
-- member can reach 10+, and growth from a small prior snapshot can reach 1000%+. Preserve scales
-- while allowing the full ratios/percentage growth derivable from the INTEGER snapshot counters.
ALTER TABLE reputation.community_health_metrics
  ALTER COLUMN network_density TYPE NUMERIC(20,4),
  ALTER COLUMN growth_rate_matches TYPE NUMERIC(20,2),
  ALTER COLUMN growth_rate_participants TYPE NUMERIC(20,2);

ALTER TABLE communities.health_summary
  ALTER COLUMN trend_percentage TYPE NUMERIC(20,2);
