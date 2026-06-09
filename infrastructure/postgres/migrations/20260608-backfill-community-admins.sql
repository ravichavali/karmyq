-- 20260608-backfill-community-admins.sql
-- BUG-001 (Sprint 92): backfill an admin for any community that has zero active admins.
--
-- The create path already inserts the creator as 'admin' (communities create handler),
-- so adminless communities come from data — sim-seeded communities, or the last admin
-- leaving / being demoted before the last-admin guard existed. This repair promotes a
-- successor for every community that currently has no active admin.
--
-- Idempotent & safe:
--   * Only touches communities with ZERO active admins (NOT EXISTS guard) — re-running
--     is a no-op once each community has an admin.
--   * Cross-schema safe (communities + auth): only members already joined to the
--     community are promoted; no rows are inserted.
--   * Prefers the creator (communities.communities.creator_id) when still an active
--     member; otherwise the earliest-joined active member.

BEGIN;

-- Step 1 — promote the original creator if they are still an active member.
UPDATE communities.members mem
SET role = 'admin'
FROM communities.communities c
WHERE mem.community_id = c.id
  AND mem.user_id = c.creator_id
  AND mem.status = 'active'
  AND mem.role <> 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM communities.members a
    WHERE a.community_id = c.id
      AND a.role = 'admin'
      AND a.status = 'active'
  );

-- Step 2 — for communities STILL adminless (creator gone or inactive), promote the
-- earliest-joined active member as the successor.
WITH adminless AS (
  SELECT c.id AS community_id
  FROM communities.communities c
  WHERE NOT EXISTS (
    SELECT 1 FROM communities.members a
    WHERE a.community_id = c.id
      AND a.role = 'admin'
      AND a.status = 'active'
  )
),
successor AS (
  SELECT DISTINCT ON (m.community_id) m.community_id, m.user_id
  FROM communities.members m
  JOIN adminless al ON al.community_id = m.community_id
  WHERE m.status = 'active'
  ORDER BY m.community_id, m.joined_at ASC, m.user_id ASC
)
UPDATE communities.members mem
SET role = 'admin'
FROM successor s
WHERE mem.community_id = s.community_id
  AND mem.user_id = s.user_id;

COMMIT;
