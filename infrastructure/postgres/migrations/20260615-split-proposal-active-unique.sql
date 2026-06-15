-- Sprint 100 (BUG-010 / G2): a community could only ever be split ONCE.
--
-- communities.split_proposals had `UNIQUE (community_id, status)` (constraint
-- split_proposals_community_id_status_key, from 20260527-fission.sql). That permits at most ONE
-- proposal per status per community for ALL time — including the terminal 'executed' status. So once
-- a community has one executed split, executeSplit's final step
--   UPDATE communities.split_proposals SET status = 'executed' WHERE id = $proposal
-- (community-service/src/services/fissionService.ts) collides with the existing (community_id,
-- 'executed') row → 23505 unique_violation → the whole transaction rolls back → the API returns
-- 500 "Failed to execute split". A community that grew past the Dunbar cap again after a prior
-- split/merge therefore could never be split a second time.
--
-- Live repro: community 446c2c65-64e1-4e8e-9d87-54671939a4da ("Marin Mutual Aid") had one 'executed'
-- proposal (2026-06-01) and one 'approved' proposal (2026-06-08) that could never execute.
--
-- Fix: the constraint should guard only AGAINST two concurrent in-flight proposals, not against
-- historical terminal ones. Replace the full unique constraint with a PARTIAL unique index over the
-- ACTIVE statuses only. This:
--   • still blocks a second active proposal while one is in flight (preserves the create-409),
--   • matches getActiveSplitProposal's existing `status NOT IN ('executed','rejected')` predicate,
--   • allows any number of terminal ('executed'/'rejected') proposals over time → a community can be
--     split again after a prior split/merge.
--
-- Idempotent: safe to re-run (IF EXISTS / IF NOT EXISTS).

ALTER TABLE communities.split_proposals
  DROP CONSTRAINT IF EXISTS split_proposals_community_id_status_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_split_proposals_active_per_community
  ON communities.split_proposals (community_id)
  WHERE status NOT IN ('executed', 'rejected');
