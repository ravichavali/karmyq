-- Sprint 144 (ADR-106): the database owns communities.communities.current_members.
--
-- A sync trigger on communities.members applies each row's active-delta to its one community; a column
-- guard on communities.communities ignores every other write to the column (old binaries during the
-- deploy window, a failed image build, a rollback); recount_current_members() converges stored drift.
-- Operators repair only through recount_current_members(), never with a direct UPDATE (the guard
-- ignores it).
--
-- Both appliers (gotcha migration-appliers-disagree-on-transaction-wrapping): no top-level
-- BEGIN/COMMIT/LOCK. The functions are top-level CREATE OR REPLACE; trigger installation, the writer
-- fence and the recount are one DO block, atomic under deploy's wrapper and CI's autocommit replay.
-- Rerunnable: CI replays this file over an init.sql that already contains it.

CREATE OR REPLACE FUNCTION communities.sync_current_members() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE prev text := current_setting('karmyq.member_count_sync', true);
BEGIN
  -- Membership rows never move between communities, so a firing touches at most one community row
  -- and no two-community lock order can exist.
  IF TG_OP = 'UPDATE' AND NEW.community_id IS DISTINCT FROM OLD.community_id THEN
    RAISE EXCEPTION 'communities.members.community_id is immutable (ADR-106)' USING ERRCODE = 'check_violation';
  END IF;
  -- The flag is on only around this function's own UPDATEs; the prior value is restored before
  -- returning, so a later application write in the same transaction still meets the guard.
  PERFORM set_config('karmyq.member_count_sync', 'on', true);
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.status = 'active' THEN
    UPDATE communities.communities SET current_members = current_members - 1 WHERE id = OLD.community_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.status = 'active' THEN
    UPDATE communities.communities SET current_members = current_members + 1 WHERE id = NEW.community_id;
  END IF;
  PERFORM set_config('karmyq.member_count_sync', COALESCE(prev, ''), true);
  RETURN NULL;
END
$fn$;

CREATE OR REPLACE FUNCTION communities.guard_current_members() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF COALESCE(current_setting('karmyq.member_count_sync', true), '') <> 'on' THEN
    IF TG_OP = 'INSERT' THEN
      -- A new community has no member rows yet; the creator's INSERT makes it 1.
      NEW.current_members := 0;
    ELSE
      NEW.current_members := OLD.current_members;
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;

CREATE OR REPLACE FUNCTION communities.recount_current_members(p_community_id uuid DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql AS $fn$
DECLARE prev text := current_setting('karmyq.member_count_sync', true); changed integer;
BEGIN
  -- Fence member writers for the rest of the caller's transaction, so no concurrent delta is lost.
  LOCK TABLE communities.members IN SHARE ROW EXCLUSIVE MODE;
  PERFORM set_config('karmyq.member_count_sync', 'on', true);
  UPDATE communities.communities c
  SET current_members = (SELECT count(*)::int FROM communities.members m
                         WHERE m.community_id = c.id AND m.status = 'active')
  WHERE (p_community_id IS NULL OR c.id = p_community_id)
    AND c.current_members IS DISTINCT FROM (SELECT count(*)::int FROM communities.members m
                                            WHERE m.community_id = c.id AND m.status = 'active');
  GET DIAGNOSTICS changed = ROW_COUNT;
  PERFORM set_config('karmyq.member_count_sync', COALESCE(prev, ''), true);
  RETURN changed;
END
$fn$;

DO $migration$
BEGIN
  -- Fail fast rather than queue behind live traffic; a failed migration rolls the deploy back.
  PERFORM set_config('lock_timeout', '10s', true);
  -- ACCESS EXCLUSIVE up front, in the application's member → community order. DROP TRIGGER needs it
  -- anyway; taking a weaker lock first and upgrading later would deadlock against an old-binary
  -- DELETE/PUT that holds FOR UPDATE row locks (ROW SHARE) and then asks for ROW EXCLUSIVE.
  LOCK TABLE communities.members, communities.communities IN ACCESS EXCLUSIVE MODE;

  DROP TRIGGER IF EXISTS communities_guard_current_members ON communities.communities;
  CREATE TRIGGER communities_guard_current_members
    BEFORE INSERT OR UPDATE OF current_members ON communities.communities
    FOR EACH ROW EXECUTE FUNCTION communities.guard_current_members();

  DROP TRIGGER IF EXISTS members_sync_current_members_ins_del ON communities.members;
  CREATE TRIGGER members_sync_current_members_ins_del
    AFTER INSERT OR DELETE ON communities.members
    FOR EACH ROW EXECUTE FUNCTION communities.sync_current_members();

  DROP TRIGGER IF EXISTS members_sync_current_members_upd ON communities.members;
  CREATE TRIGGER members_sync_current_members_upd
    AFTER UPDATE OF status, community_id ON communities.members
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.community_id IS DISTINCT FROM NEW.community_id)
    EXECUTE FUNCTION communities.sync_current_members();

  -- Converging recount (the third: Sprint 86, Sprint 97). A rerun changes no row.
  PERFORM communities.recount_current_members();
END
$migration$;

COMMENT ON COLUMN communities.communities.current_members IS
  'Count of active communities.members rows, maintained by trigger members_sync_current_members_* and protected by communities_guard_current_members (ADR-106). Application writes are ignored; repair with communities.recount_current_members().';
