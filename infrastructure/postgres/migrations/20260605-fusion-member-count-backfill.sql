-- Sprint 86 follow-up: recompute communities.current_members from actual membership
--
-- `current_members` is a denormalized counter on communities.communities (incremented/
-- decremented on join/leave). The fusion path (executeFusion) created merged communities
-- without setting it and never recomputed it after migrating members, so merged communities
-- rendered "0 members" in the header while the member list showed everyone (the split path
-- already recomputes — fissionService). The code fix lands alongside this; this one-time
-- repair fixes communities that already drifted (from past fusions, pre-fix splits, or
-- ordinary join/leave counter drift).
--
-- Safe + idempotent: current_members is a cache of count(active members), so recomputing it
-- from the source of truth can only converge it to the correct value. Scoped to live
-- communities (status NOT IN split/merged history states is irrelevant — the count is still
-- correct for them too, so we recompute all rows). Re-running is a no-op.

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
