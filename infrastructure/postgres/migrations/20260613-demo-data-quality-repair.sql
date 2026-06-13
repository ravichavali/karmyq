-- Sprint 97 (release readiness): re-recompute communities.current_members from active membership.
--
-- `current_members` is a denormalized cache of COUNT(active members) on communities.communities.
-- The Sprint 86 follow-up (20260605-fusion-member-count-backfill.sql) already recomputed it once,
-- but the Sprint 87 demo de-spam capped membership at the 150 Dunbar limit by trimming member rows
-- AFTER that backfill ran — so the counter drifted high again for the fission-parent communities.
-- The Sprint 97 demo audit (scripts/audit-demo-data.sql, finding 1) found 10 communities reporting
-- e.g. 284 members while holding 150 active rows; the community header lies about its size.
--
-- Migration runners only apply each file once, so re-running the 20260605 file is not an option —
-- this new dated file re-applies the same converging recompute.
--
-- Safe + idempotent: current_members is a pure cache of count(active members), so recomputing it
-- from the source of truth can only converge to the correct value. Runs over all rows (the count is
-- correct for active, split, and merged communities alike). Re-running is a no-op.

UPDATE communities.communities c
SET current_members = sub.cnt
FROM (
  SELECT cm.community_id, COUNT(*)::int AS cnt
  FROM communities.members cm
  WHERE cm.status = 'active'
  GROUP BY cm.community_id
) sub
WHERE c.id = sub.community_id
  AND c.current_members IS DISTINCT FROM sub.cnt;

-- Communities with zero active members (none in the grouped subquery above) must read 0,
-- not a stale positive count.
UPDATE communities.communities c
SET current_members = 0
WHERE c.current_members <> 0
  AND NOT EXISTS (
    SELECT 1 FROM communities.members cm
    WHERE cm.community_id = c.id AND cm.status = 'active'
  );
