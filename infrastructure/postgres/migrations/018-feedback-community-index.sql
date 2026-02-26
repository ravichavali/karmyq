-- Migration 018: Composite index for community-scoped feedback queries
--
-- getBlendedAvgFeedback() now filters by (to_user_id, community_id) for the
-- local average component. The existing single-column idx_feedback_to_user
-- index is sufficient for the global average scan, but a composite index
-- avoids a second full table scan for the community filter.

CREATE INDEX IF NOT EXISTS idx_feedback_to_user_community
  ON feedback.feedback (to_user_id, community_id);
