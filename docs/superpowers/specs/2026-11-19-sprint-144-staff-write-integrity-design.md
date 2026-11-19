# Sprint 144: Staff Membership Write Integrity — Design Spec

**Date**: 2026-11-19
**Status**: Approved by the maintainer, 2026-11-19 (planning chat; decisions 1–6). Codex plan review round 1
(11 findings, all verified) is integrated, and the maintainer decided 7–9 on its three open points the same day.
Round 2 (8 findings, all verified) is integrated with decisions 10–11.
Planning defaults D1–D8 are this chat's choices within that approval; a reviewer may challenge them.
**Version**: v11.116.0 → **v11.117.0** (provisional; the maintainer allocates the version and the merge slot at
merge time, re-derived from `origin/master`)
**Sprint Branch**: `agent/claude/sprint-144-planning`, cut from `origin/master` `a2746057`. It is reused as the
execution branch, and it carries the Sprint 143 post-merge record, which rides with this product PR.

---

## Overview

Staff membership writes in community-service break three invariants the product depends on.

1. **Only staff with the right power change a membership.** `PUT /communities/:communityId/members/:userId`
   lets a moderator make *any* status change (`services/community-service/src/routes/members.ts:325-333`). A
   moderator can therefore deactivate a non-last admin, or reactivate an inactive row whose stored role is
   `admin` and so restore an admin (BUG-105). The last-admin guard compares PostgreSQL's canonical `user_id` with
   the raw path parameter in JavaScript (`members.ts:379`). An uppercase UUID skips the guard, so the sole admin
   can be demoted or deactivated (BUG-104). The handler writes any `role`/`status` string it receives
   (`members.ts:347-354`). `communities.members` has no CHECK constraint on either column
   (`infrastructure/postgres/init.sql:1350-1359`).
2. **A community's member count is its number of active members.** `communities.communities.current_members` is
   a denormalized cache that five code paths in two services each adjust by hand:
   - join (`members.ts:144`);
   - staff add (`members.ts:263-268`);
   - DELETE (`members.ts:474-475`);
   - the duplicate-create join (`services/community-service/src/routes/communities.ts:455-460`);
   - social-graph invitation accept (`services/social-graph-service/src/routes/invitations.ts:162-167`). It
     increments even when its `ON CONFLICT DO NOTHING` insert was a no-op.

   Staff approval (`PUT … {status:'active'}`, the web Approve button at
   `apps/frontend/src/components/community/tabs/ActiveTab.tsx:53-61`) never increments at all (BUG-103). This
   would be the third repair. `20260605-fusion-member-count-backfill.sql` (Sprint 86) and
   `20260613-demo-data-quality-repair.sql` (Sprint 97) already recounted the column. The drifted value is
   user-visible: the community hero shows "N neighbours · room for M more" and disables Join when full
   (`apps/frontend/src/components/community/CommunityHero.tsx:35-38`).
3. **Capacity holds.** The join route reads `current_members` (`members.ts:106-115`) outside the transaction
   that writes the member row (`members.ts:130-146`), so two concurrent joins can both pass the check. Approval
   ignores capacity entirely. `services/community-service/CONTEXT.md:1554-1557` claims capacity "cannot be
   bypassed in code (database constraint)". No such constraint exists (`init.sql:1013-1014`).

The web app has two gaps on the same surface. The Reject button calls `removeMember`
(`ActiveTab.tsx:63-71` → `apps/frontend/src/lib/api.ts:240-241`), the admin-only DELETE (`members.ts:442-455`),
so moderators shown the button get 403. A pending applicant sees a static "⏳ Join Request Pending" badge
(`CommunityHero.tsx:82-86`) and cannot withdraw. The API already accepts that withdrawal: a self-DELETE of a
pending row records `left` (`services/community-service/src/utils/memberLifecycle.ts:12-18`).

**Solution.** A database trigger becomes the only writer of `current_members` (ADR-106). A second trigger, the
column guard, ignores every other write to the column. Writers present and future, in either service, are
therefore correct by construction. That includes old binaries still serving while a deploy runs, and old
binaries after a rollback. A one-time recount repairs the stored drift.

The staff PUT becomes an explicit transition table. Each transition names who may perform it, what it does to the
role, and whether it admits someone. Staff "reactivation" lifts a block instead of re-adding the person. Admitting
paths enforce capacity atomically by re-reading the count after their write, inside the same transaction.
Request-supplied UUIDs on the member routes are canonicalized once at parse and never compared raw.

The web Reject moves to the PUT, and pending applicants get **Cancel request**. A Next.js security patch rides as
the PR's first commit.

### Core principle: Derive what can be derived; authorize each transition, not each caller

A count that can be computed from rows is computed by the database, not remembered by every writer. A staff
power is defined per state transition, so adding a role or a status forces the question "who may do this?" in
one table instead of in scattered `if` branches. Staff never return someone who left, was removed or was rejected:
that person rejoins by their own action. Two documented exceptions remain outside this sprint (decision 10): admin
direct-add (BUG-107) and the structural fission/fusion moves.

---

## Multi-sprint arc

### Sprint 142 — Proportional ratification (complete, v11.115.0, deployed 2026-11-15)
### Sprint 143 — Nomination lifecycle + member rejoin (complete, #340 `a2746057`, v11.116.0, deployed 2026-11-19)
Split self-leave (`left`) from staff removal (`inactive`) and made DELETE/self-rejoin counter-correct. It logged
BUG-103/104/105 for the staff PUT and left them out of scope by maintainer choice.

### Sprint 144 — Staff membership write integrity (this sprint)

### Later (not planned; maintainer decision required)
- BUG-106: invitation acceptance ignores capacity and silently no-ops on an existing row (logged 2026-11-19).
- BUG-107: admin direct-add makes an arbitrary user active without their consent (logged 2026-11-19, decision 10).
- Role rotation, revocation, delegation and opposition votes (ADR-055 "non-permanent roles").
- A DB CHECK on `members.role`/`members.status`. It needs a demo read first, because legacy values are unmeasured;
  the column comment names an `invited` status (`init.sql:1365`), and a request-service integration test writes
  `removed` (`services/request-service/tests/integration/sprint-125-provider-reach-gate.integration.test.ts:295`).
- Notifications to an applicant on approval or rejection (no event or template exists today).
- Removing the fission/fusion recompute statements, which the column guard turns into no-ops (D7).

---

## Maintainer decisions (2026-11-19)

1. **Scope:** staff-write integrity (BUG-103, BUG-104, BUG-105, PUT value validation) plus the web **Cancel
   request** control.
2. **Next.js advisories:** dependency work is authorized. It is bundled as the PR's **first commit**, as an
   in-place lock splice proven by strict `npm ci`, `npm ls` and the audit gate. The PR must merge by
   **2026-12-01** (Dependabot #185 opened 2026-11-17 and #186 opened 2026-11-18; MEDIUM ≤ 2-week SLA).
   Dependabot PR #339 is not used. Closing it after the merge is the maintainer's call.
3. **Stored drift:** a recount migration. Choosing it authorizes exactly one demo write, the converging recount,
   applied through the normal deploy migration path (`scripts/deploy.sh:150-155` → `scripts/apply-migrations.sh`).
   No other demo data operation is authorized, including reads.
4. **Moderators:** approve and reject only (`pending → active`, `pending → inactive`). Every other staff
   transition is admin-only.
5. **Counter ownership:** a DB trigger owns `current_members`. Every hand-written `±1` write is removed. Capacity
   stays in the application but becomes atomic: admitting paths re-check after their write and roll back with
   `COMMUNITY_FULL`. Fission and fusion behavior is unchanged.
6. **ADR-106 allocated:** "Database-owned community member count". Status Proposed → Accepted at PR open →
   Implemented after deploy.

Added after plan review round 1:

7. **Cutover: a column guard** (Codex F2). A `BEFORE INSERT OR UPDATE OF current_members` trigger on
   `communities.communities` forces an inserted count to `0` and ignores any later change not made by the sync
   trigger or the recount function. Old containers that keep serving between the migration (`deploy.sh:154`) and
   the restart (`deploy.sh:225`) cannot double-count. Neither can old containers left serving after a failed image
   build (`deploy.sh:208-219`), or binaries rolled back while the trigger stays installed: their `±1` writes become
   no-ops.
8. **Staff "reactivate" lifts the block** (Codex F3). An admin PUT moves `inactive → left`. The person then
   decides whether to rejoin through the normal join route (public: active; private: a new pending request).
   Staff can no longer return anyone who left or was removed or rejected; the exceptions are named in decision 10.
   This also closes the path where an admin DELETE (`left → inactive`, which Sprint 143 keeps on purpose; Sprint 143 spec `:172-173`)
   followed by a reactivation would force a departed member back in. No web or mobile screen offers reactivation
   today; it is API-only.
9. **Real-DB evidence: a disposable PostgreSQL container** on the demo host over SSH, with no demo data access, as
   Sprint 143 had (Codex F8, F9). Red→green runs locally. The PR opens only at the end of execution. There is no
   draft-PR exception to the stop-after-PR-creation rule.

Added after plan review round 2:

10. **Staff direct-add is a documented exception** (Codex round 2, R1). `POST /communities/:communityId/members`
    (`members.ts:176-291`, admin-only since BUG-061) inserts an arbitrary user as `active` without their consent
    (`members.ts:254-260`). No web, mobile or simulation screen calls it: `addMember` (`api.ts:233-234`) is unused.
    The full-stack test fixtures (`tests/fixtures/index.ts:309`, `:402`) and the Sprint 132 security tests do use
    it. It stays, with canonical ids and the capacity post-check. Decision 8's guarantee covers *returning*
    members (left, removed, rejected) and names direct-add and fission/fusion as exceptions. The consent gap is
    logged as **BUG-107** for a later sprint.
11. **Verification scope** (Codex round 2, R6). The disposable container runs the in-process database suites
    (Sprint 142/143/144 style). About 38 of the 43 root integration files need running services or Redis
    (for example `tests/integration/event-driven-flow.integration.test.ts:46`, `:54`, and
    `tests/integration/sprint-133-endorsement-trust.integration.test.ts:162`). Those run in PR CI, and the next
    chat reads that result and fixes forward (stop-after-PR rule). No isolated full test stack is authorized.

### Planning defaults (this chat's choices; listed so a reviewer can challenge them)

- **D1 — One change per request.** A staff PUT body carries exactly one of `role` or `status`. Both, neither, or
  unknown keys besides the ignored legacy `admin_user_id` return 400 `VALIDATION_ERROR`. The web app never sends
  both (`ActiveTab.tsx:46`, `:56`).
- **D2 — Staff actions never leave a staff role behind on a returning row.** Approve and lift-the-block both write
  `role='member'` in the same statement. This matches Sprint 143's rejoin rule (`members.ts:133-136`), which also
  resets the role.
- **D3 — `left` belongs to the member.** Staff PUT never changes a `left` row (409 `MEMBER_MUST_REJOIN`). Staff
  write `left` in exactly one case, lifting a block (`inactive → left`, decision 8), which hands the decision back
  to the person. Staff never write `pending`. Staff DELETE of a `left` row still blocks the person (Sprint 143),
  and lifting reverses it.
- **D4 — Retries are 409.** A transition to the row's current state (approve an active row, same role) returns 409
  `INVALID_MEMBERSHIP_TRANSITION`, matching Sprint 143's "409 for retries". A `left` target is the one exception:
  every request against it, including `left → left`, returns D3's `MEMBER_MUST_REJOIN` (Codex round 2, R2).
- **D5 — Error envelope.** Rewritten handlers use the ADR-074 helpers already imported in `members.ts`
  (`sendError`, `sendConflict`, `sendForbidden`, `sendNotFound`, `sendValidationError`, `sendInternalError`).
  Unexpected PUT and POST failures stop leaking `error.message` (`members.ts:285-289`, `:414-418`), like Sprint
  143's DELETE. Status codes stay as clients expect: last admin 400 (code `LAST_ADMIN`), full 400
  (`COMMUNITY_FULL`, as join uses at `members.ts:114`).
- **D6 — No event changes.** `user_joined_community` and `user_left_community` are in `UNCONSUMED_EVENTS`
  (`packages/shared/events/routes.ts:50`). Moving Reject from DELETE to PUT drops a `user_left_community` that
  nothing consumes. The PUT publishes nothing new.
- **D7 — Fission and fusion keep their recompute statements.** Their `SET current_members = (SELECT count(*) …)`
  (`fissionService.ts:287-295`, `fusionService.ts:94-102`) do not set the sync flag, so the column guard turns them
  into no-ops. The trigger has already produced the same value. Removing them would mean changing
  `sprint-78-fission-execute` and `sprint-86-fusion-member-count`, which assert those statements, so it is
  deferred (*Later*). Fusion can exceed `max_members` today (no capacity check in `fusionService.ts`); that is
  unchanged.
- **D8 — BUG-106 stays open.** Social-graph's invitation accept loses only its manual increment, which the column
  guard would ignore anyway. Its capacity and existing-row gaps are logged as BUG-106, not fixed.

---

## New Concepts

### The staff transition table (`PUT /communities/:communityId/members/:userId`)

Status changes (`{ "status": … }`, value ∈ `{active, inactive, left}`):

| Stored → requested | Allowed caller | Role effect | Admits? (capacity re-check) | Counter (trigger) |
|---|---|---|---|---|
| `pending` → `active` (approve) | active admin **or** moderator | set `member` (D2) | yes | +1 |
| `pending` → `inactive` (reject) | active admin **or** moderator | unchanged | no | 0 |
| `active` → `inactive` (deactivate) | active admin only; last-admin guard | unchanged | no | −1 |
| `inactive` → `left` (lift the block; decision 8) | active admin only | set `member` (D2) | no: the person rejoins through `POST /join`, which applies access rules and capacity | 0 |
| `inactive` → `active` | — | — | — | 409 `INVALID_MEMBERSHIP_TRANSITION` (message: lift the block; the person rejoins) |
| `active`/`pending` → `left` | — | — | — | 409 `INVALID_MEMBERSHIP_TRANSITION` (only the member leaves) |
| `left` → anything, including `left` (checked before D4) | — | — | — | 409 `MEMBER_MUST_REJOIN` (D3) |
| `X` → `X` (any other same state) | — | — | — | 409 `INVALID_MEMBERSHIP_TRANSITION` (D4) |
| any → `pending` or any other string | — | — | — | 400 `VALIDATION_ERROR` |

Role changes (`{ "role": … }`): `role ∈ {member, moderator, admin}`, **active admin caller only**, **active
target only** (otherwise 409 `INVALID_MEMBERSHIP_TRANSITION`). Same-role is 409 (D4). Demoting the sole active
admin is 400 `LAST_ADMIN`. A moderator sending `role` is 403 (unchanged behavior, now with a code).

Authorization reads the caller's **live** role inside the transaction (ADR-102). A caller who is not an active
admin or moderator gets 403. A missing target row gets 404. A moderator attempting an admin-only transition gets
403 `FORBIDDEN`.

The table lives in one pure module, `services/community-service/src/utils/staffTransitions.ts`. Its function
`planStaffChange(callerRole, target, body)` returns an operation or a refusal; the route only executes that plan.
`memberLifecycle.ts` keeps the self-service rules. The two modules stay separate because they answer different
questions: what *I* may do to my own membership, and what *staff* may do to someone else's.

### Canonical request UUIDs

`services/community-service/src/utils/uuid.ts` exports one `UUID_RE` and `canonicalUuid(value): string | null`,
which returns the lowercase form or `null`. The member routes canonicalize every request-supplied id they compare
in JavaScript: path `:communityId`/`:userId` on PUT and DELETE, and body `user_id` on staff add. A malformed id
returns 400 `VALIDATION_ERROR` before any SQL runs; today it reaches PostgreSQL and surfaces as a 500. JWT ids are
issued from database values, which PostgreSQL renders lowercase, and are compared as issued. `liveRole.ts:14` and
`governance.ts:7` drop their duplicate regexes and import the shared one. That is consolidation, not a fix.

Inventory (2026-11-19, corrected by Codex F11):

| Site | Compares | Failure mode today | Sprint 144 |
|---|---|---|---|
| `members.ts:379` (PUT) | DB `user_id` vs raw path id | **fails open**: guard skipped (BUG-104) | canonicalize |
| `members.ts:440` (DELETE) | raw path id vs JWT id | fails closed: self-leave treated as staff removal → 403 | canonicalize |
| `members.ts:465`, `:469` (DELETE) | DB `user_id` vs raw path id | fails closed: 404 | canonicalize |
| `governanceDb.ts:241` (nominate) | DB `user_id` vs nominee id | none: already lowercased at `governanceDb.ts:227-229` | regex consolidation only |
| `links.ts:56` | body target id vs path id (self-link) | app validation bypass; the DB CHECK `community_links_check` (`init.sql:1202`) still refuses the row | out of scope, not authorization |
| `fusions.ts:113` | path id vs DB party ids | fails closed: 403 | out of scope |
| `splits.ts:79` | DB `community_id` vs path id | fails closed: 404 | out of scope |

Task 2 re-runs the inventory against the live tree, without truncation, and records it in the ledger. A new
fail-open authorization site joins this sprint's scope; anything else is recorded.

### Database-owned member count (ADR-106)

**The sync trigger.** A trigger on `communities.members` keeps `communities.communities.current_members` equal to
the number of rows with `status = 'active'`:

- `AFTER INSERT` and `AFTER DELETE`, plus `AFTER UPDATE OF status, community_id` with a `WHEN` clause that skips
  rows whose status and community are unchanged. A role-only update (governance grant, `governanceDb.ts:374`)
  does not fire it.
- The delta is `(NEW is active ? +1 : 0) − (OLD is active ? 1 : 0)` on the row's one community. `NULL` status
  counts as not active.
- **Membership rows never move between communities.** The function raises on a `community_id` change. No writer
  does that today. The application's `UPDATE communities.members` statements are `governanceDb.ts:374` (role),
  `members.ts:133-136` (rejoin status/role), `members.ts:384-390` (staff PUT) and `members.ts:472` (departure
  status), and none sets `community_id`. Fission and fusion insert new rows. So every firing touches at most one
  community row (none for a non-active → non-active change), and no two-community lock order exists (Codex F4;
  round 2, R8).
- It never clamps. A negative result would expose a bug instead of hiding it.

**The column guard (decision 7).** A `BEFORE INSERT OR UPDATE OF current_members` trigger on
`communities.communities`:

- on INSERT, forces `NEW.current_members := 0`. A new community has no member rows yet, so `0` is always true;
- on UPDATE, keeps `OLD.current_members` unless the transaction-local setting `karmyq.member_count_sync` is
  `'on'`.

The sync function sets that flag to `'on'` immediately around its own `UPDATE` and restores the prior value before
returning. The recount function does the same. An application write later in the same transaction, such as old
join code's `+1` after its member INSERT, therefore finds the flag off and is ignored. Operators repair through
`communities.recount_current_members(p_community_id uuid DEFAULT NULL)`, never through a direct `UPDATE`, which
the guard ignores.

The guard is a correctness fence against stray application writes, not a privilege boundary. Any session that can
run SQL can also set the flag; that session could already write any column.

**Capacity** is not in the trigger (decision 5, D7). Instead,
`services/community-service/src/database/memberCapacity.ts` exports `assertWithinCapacity(q, communityId)`. It
runs **after** an admitting write inside the same `withTransaction`. It reads `current_members, max_members` and
throws `CommunityFullError` when `current_members > max_members`. `withTransaction` rolls back on any throw
(`services/community-service/src/database/db.ts:45-62`), so the member write and the trigger's increment are
undone together.

This is atomic without a new lock. The trigger's `UPDATE` holds the community row lock until commit, so concurrent
admitters serialize on that row. Under READ COMMITTED the second re-reads the first's committed count and its
post-check fails. Lock order stays member row(s) → that one community row everywhere, as join and DELETE already
do (`members.ts:130-146`, `:458-476`).

Admitting paths in community-service, each wrapped in one transaction with the post-check:

1. self-join to `active` (public), including a `left` rejoin;
2. staff add, `POST /communities/:communityId/members`;
3. PUT approve;
4. duplicate-create join, `communities.ts:448-461`.

Lifting a block admits nobody (decision 8). Private pending joins admit nobody and skip the check. The pre-write
"Community is full" fast path in join may stay as a friendly early refusal, but the post-check is authoritative.

---

## Data Model

One new migration, `infrastructure/postgres/migrations/20261119-community-member-count-trigger.sql`. It has no
top-level `BEGIN`/`COMMIT`/`LOCK` (gotcha `docs/gotchas/migration-appliers-disagree-on-transaction-wrapping.md`).
The functions are created at top level with `CREATE OR REPLACE`. Trigger installation, the lock fence and the
recount sit in one `DO $migration$ … $migration$;` block, which is atomic under both appliers. It must be
rerunnable, because CI replays it over an `init.sql` that already contains it.

```sql
-- Sprint 144 (ADR-106): the database owns communities.current_members.

CREATE OR REPLACE FUNCTION communities.sync_current_members() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE prev text := current_setting('karmyq.member_count_sync', true);
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.community_id IS DISTINCT FROM OLD.community_id THEN
    RAISE EXCEPTION 'communities.members.community_id is immutable (ADR-106)' USING ERRCODE = 'check_violation';
  END IF;
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
  -- Fence member writers for the rest of the caller's transaction (no concurrent delta can be lost).
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
  -- Fail fast rather than queue behind live traffic; a failed migration rolls the deploy back (deploy.sh:157-162).
  PERFORM set_config('lock_timeout', '10s', true);
  LOCK TABLE communities.members IN SHARE ROW EXCLUSIVE MODE;

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

  -- Converging recount (third time: S86, S97). Rerun is a no-op.
  PERFORM communities.recount_current_members();
END
$migration$;

COMMENT ON COLUMN communities.communities.current_members IS
  'Count of active communities.members rows, maintained by trigger members_sync_current_members_* and protected by communities_guard_current_members (ADR-106). Application writes are ignored; repair with communities.recount_current_members().';
```

The SQL above is the design intent. The `migration-validator` agent and plan review may tighten it. Task 5 proves
on both appliers:

- `LOCK TABLE` inside the `DO` block and inside `recount_current_members` (the gotcha bans only a top-level one);
- `set_config('lock_timeout', …, true)`;
- `AFTER`-trigger `RETURN NULL`;
- that flag restoration really closes the guard for a later statement in the same transaction.

`init.sql` is regenerated from the migration chain, never hand-edited (`infrastructure/claude.md:15-30`). Its
spliced curated seed data must still produce correct counts on a fresh boot under the guard.

No other schema change. In particular there is no CHECK on `members.role`/`members.status` (see *Later*).

### Writers that change because the trigger now counts

| Writer | Today | After |
|---|---|---|
| Community create, `communities.ts:538-542` | `INSERT … current_members = 1`, then creator INSERT | insert `0` (the guard forces it anyway); the creator row's trigger makes it `1`. The response re-reads the count |
| Duplicate-create join, `communities.ts:455-460` | `+1` if inserted | delete the `+1`; re-read the count for the response (no in-memory self-referential arithmetic); one transaction with the capacity post-check |
| Join, `members.ts:143-145` | `+1` if active | delete; add the post-check |
| Staff add, `members.ts:262-268` | `+1` | delete; wrap in a transaction with the post-check |
| DELETE, `members.ts:474-476` | `−1` if active | delete (the trigger decrements) |
| Invitation accept, `invitations.ts:162-167` (social-graph) | `+1` unconditionally | delete (BUG-106 stays open) |
| Fission/fusion recompute | exact recompute | unchanged, now a guarded no-op (D7) |
| `infrastructure/postgres/seed-e2e.sql:85`, `:114` | explicit `current_members` then member rows | seed `0` for honesty (the guard ignores the value anyway) |
| `tests/fixtures/*.sql` and the fixture generators (`tests/fixtures/generate-*.ts`) | explicit counts, after a paired `TRUNCATE` of `members` and `communities` | values are ignored by the guard; the trigger counts the member rows. The paired TRUNCATE leaves no stale count |
| Simulation curated baseline, `services/simulation-service/src/fixtures/curatedDemo/baselineWriter.ts:130-150` | inserts communities at the default `0`, then members: the count stays wrong | unchanged code; counts become correct |
| `scripts/archive/seeding/seed-test-data.js:278` (active recount) and `scripts/archive/seeding/generate-realistic-data.ts:430` (counts **all** statuses) | deprecated tooling (`scripts/archive/README.md`) | excluded and unchanged; the guard ignores both writes, so the all-status count cannot corrupt the column (Codex F10) |

A new root regression gate keeps application code free of counter arithmetic (Codex F6). It flags any assignment
to `current_members`, with or without a table alias, whose right-hand side references `current_members`. That
covers every operand order and wrapper: `current_members + 1`, `c.current_members - 1`, `1 + current_members`,
`GREATEST(0, current_members - 1)`, and `+=`/`-=`. It scans `services/*/src`, `apps/*/src` and `packages/*/src`,
SQL and JavaScript alike. It allows a converging recompute whose right-hand side is a `count(*)` subquery that does
not reference `current_members`. Each form has a negative fixture, and both existing recomputes have positive
fixtures. The gate is hygiene: with the guard, an application delta is already a no-op.

---

## API Endpoints

| Method | Path | Change | Auth | Body | Response |
|---|---|---|---|---|---|
| PUT | `/communities/:communityId/members/:userId` | Rewritten as the transition table. Canonical UUIDs. Exactly one of `role`/`status`. Moderators approve/reject only. `status:'left'` on an inactive row lifts the block (admin). Approve resets the role to `member` and re-checks capacity. ADR-074 errors | JWT; live admin/moderator | `{ "status": "active" \| "inactive" \| "left" }` **or** `{ "role": "member" \| "moderator" \| "admin" }` | 200 `{success, data: memberRow, message}`; 400 `VALIDATION_ERROR` / `LAST_ADMIN` / `COMMUNITY_FULL`; 403 `FORBIDDEN`; 404 `NOT_FOUND`; 409 `INVALID_MEMBERSHIP_TRANSITION` / `MEMBER_MUST_REJOIN`; 500 `INTERNAL_ERROR` (no raw detail) |
| DELETE | `/communities/:communityId/members/:userId` | Canonical UUIDs (a self-leave with an uppercase id is self-leave). The `−1` write is removed (trigger). Staff DELETE on a `left` row still blocks (Sprint 143) | JWT | — | unchanged contract |
| POST | `/communities/:communityId/join` | The `+1` is removed (trigger). Atomic capacity post-check for active admission | JWT | unchanged | unchanged, including 400 `COMMUNITY_FULL` |
| POST | `/communities/:communityId/members` | Canonical body `user_id`. One transaction with the post-check. The `+1` is removed. No raw `error.message`. Stays a documented consent exception (decision 10, BUG-107) | JWT; live admin | unchanged | unchanged plus 400 `COMMUNITY_FULL` under a race; 500 `INTERNAL_ERROR` |
| POST | `/communities` | Insert `current_members = 0`; the response carries the post-trigger count. The duplicate-create join gets the post-check | JWT | unchanged | unchanged |
| POST | `/invitations/accept` (social-graph) | The manual `+1` is removed | JWT | unchanged | unchanged |

No new endpoint. **Cancel request** reuses the self-DELETE that Sprint 143 already supports for a pending row.

---

## Frontend Changes

- `apps/frontend/src/components/community/tabs/ActiveTab.tsx` — `handleRejectMember` calls
  `communityService.updateMember(communityId, userId, { status: 'inactive' })` instead of `removeMember`. The
  Approve and Reject buttons stay shown to admins and moderators (`ActiveTab.tsx:122`). The Role select and the
  Remove button are already admin-only (`ActiveTab.tsx:236`, `:252`); keep them so. Stop sending the ignored
  `admin_user_id` from both PUT callers (`:46`, `:56`), and narrow the `updateMember` type in `api.ts:236-237` to
  match.
- `apps/frontend/src/components/community/CommunityHero.tsx` — the pending badge gains a **Cancel request**
  button through a new optional `onCancelRequest` prop.
- `apps/frontend/src/pages/communities/[id].tsx` — `handleCancelRequest` confirms ("Cancel your join request?"),
  calls the existing `communityService.leaveCommunity(communityId, currentUser.id)` (`api.ts:263-264`), refetches,
  and reports errors from `err.response?.data?.message`. A pending self-leave returns no token (CONTEXT.md DELETE
  section), so nothing is persisted.
- No lift-the-block control. Reactivation was API-only before this sprint and stays API-only (decision 8).
- The hero's count now reads truthful data. No code change is needed there.

---

## User Guide & Doc Updates

- `docs/guides/admin-community-guide.md` (published as `admin-community`, `scripts/generate-docs.ts:327`):
  - *Leaving, removal and rejection* (`:76-84`): "A current community admin or moderator must reactivate that
    membership" becomes: an admin can lift the block, and the person then rejoins themselves (public: right away;
    private: a new request). Staff cannot make someone a member again without that person's action. Someone who
    left rejoins themselves; staff cannot restore them.
  - New subsection *Approving and rejecting join requests*: moderators can approve or reject pending requests;
    removing members, lifting a block, and role changes are admin powers. Approval counts toward the member cap
    and fails when the community is full.
- `docs/guides/finding-communities-guide.md`, *Leaving and rejoining* (`:15-24`):
  - add cancelling a pending join request, and that a cancelled request can be re-sent like any rejoin;
  - change "ask … staff … restore your membership" to: ask an admin to lift the block, then rejoin.
- Governance restoration text (Codex round 2, R3) changes in both places:
  - `docs/concepts/governance.md:21`: "If an original voter rejoins or a steward reactivates them, their existing
    vote counts again. Removed and rejected members need staff reactivation".
  - `docs/guides/admin-community-guide.md:100-102`: the same claim.

  Both become: an original voter's existing vote counts again when they rejoin; for a removed or rejected voter,
  an admin first lifts the block, and the vote counts again once that person rejoins. Read the rest of
  `governance.md` for moderator-power text as well.
- `apps/frontend/src/lib/onboarding/workflows.ts`: read for any admin/moderator approval step. Update only if one
  describes moderator power, rejection or restoration. Record the result either way.
- `docs/guides/community-admin-guide.md` is an unpublished duplicate (absent from `scripts/generate-docs.ts`). Only
  check it for contradictions; do not expand it.
- ADR-106 `docs/adr/ADR-106-database-owned-member-count.md`, indexed in `docs/adr/README.md`, with its slug in the
  `— Community & Scale —` group of `ADR_GROUPS` (`scripts/generate-docs.ts:500-507`). Then regenerate the landing
  docs.
- `services/community-service/CONTEXT.md`:
  - PUT/DELETE/join/staff-add sections; the join section's `MEMBERSHIP_RESTORE_REQUIRES_STAFF` text now points to
    lifting the block;
  - replace the false "database constraint" claim (`:1554-1567`) and the stale last-admin sample (`:1569-1590`);
  - the *Sprint 25 — Moderator support* line (`:840`);
  - a Recent Changes entry.
- `services/social-graph-service/CONTEXT.md`: invitation accept no longer writes the counter; BUG-106 pointer.
- `services/registry.json`: PUT member description; social-graph invitation note if it mentions the count.
- `docs/BUGS.md`: BUG-103/104/105 → fixed (Sprint 144), BUG-106 open.
- `infrastructure/claude.md`: migration count line (`:23`) if it is re-counted.

---

## Critical Implementation Notes

1. **First commit = the Next.js splice, nothing else.** Root lock nodes `node_modules/next`, `node_modules/@next/env`
   and the 8 `node_modules/@next/swc-*` go 16.4.2 → **16.4.6**: `version`, `resolved` and `integrity`, from
   registry metadata. The `node_modules/next` node's own exact references change too (Codex F1):
   `dependencies["@next/env"]` (`package-lock.json:18665`) and the eight `optionalDependencies` `@next/swc-*`
   (from `:18679`) go `16.4.2` → `16.4.6`.

   Registry metadata read 2026-11-19: 16.4.6 is `latest`. Its `dependencies` equal 16.4.2's except `@next/env`.
   Its `optionalDependencies` are the eight SWC packages at 16.4.6 plus an unchanged `sharp ^0.35.5`. Its
   `peerDependencies` and `engines` (`node >=20.9.0`) equal the lock node's.

   Keep every `libc` field (4 swc nodes carry one). Declared ranges go `^16.4.2` → `^16.4.6` in
   `apps/frontend/package.json:24`, `apps/landing/package.json:18` and those workspaces' `packages[...]` entries in
   the lock. `postcss` stays governed by the root override `"postcss": "^8.5.25"`, so no nested postcss node is
   added. `next` stays at the root because `eslint-config-next` requires its bundled parser from there (#339's
   failure).

   Prove the splice with strict `npx npm@11.19.0 ci`, an `npm ls --all` problem list identical to master's
   (BUG-047's `picomatch` line is pre-existing), the ADR-059 audit gate at 0 high/critical with #185/#186's GHSAs
   gone, and `tests/regression/sprint-122-lint-config-gate.test.ts` green. Never execute a downloaded tarball.
   Never use `npm install --workspace`, `npm dedupe` or a lock regen. Use a script file with match-count guards
   for the splice.
2. **The counter is no longer settable, so fixtures must create rows.** Under the column guard, a community INSERT
   stores `0` and any `UPDATE … current_members` outside the sync path is ignored. A test that "sets" a count, or
   needs a full community, must create the active rows or lower `max_members`. Inventory every such site before
   implementing. Known sites:
   - `tests/integration/sprint-143-governance-lifecycle.integration.test.ts:48`, which also sets counts at
     `:652`, `:666` and `:689`;
   - `tests/integration/social-graph.test.ts:152-188`;
   - `tests/integration/sprint-142-governance-quorum.integration.test.ts`;
   - `tests/integration/sprint-134-pr-l2-health.integration.test.ts`;
   - `infrastructure/postgres/seed-e2e.sql:85`, `:114`;
   - the `tests/fixtures/` seeds.

   Fix each fixture to state the truth. Never weaken an assertion to make it pass.

   **One controlled-corruption exception (Codex round 2, R4).** `tests/integration/sprint-134-pr-l2-health.integration.test.ts`
   deliberately stores wrong cached counts (`:53-55`) to prove that health metrics read live rows, not the cache
   (`:175-181` asserts a cached `0` for a community whose live data yields 24 participants). Keep that scenario. Write the corrupt values inside
   a helper that sets `karmyq.member_count_sync` to `'on'` for that one statement and restores it, the same way the
   recount tests seed drift. Keep the exact assertions, and recount or clean up afterwards.
3. **Existing regressions change for three separate reasons; inventory each separately (Codex F5).**
   - **(a) UUID fixtures.** `sprint-93-members-delete-jwt` (`/comm-1/members/victim`, `:91`),
     `sprint-132-body-identity` (`'admin-user'`, `'attacker-user'`, `:48-51`), `sprint-92-last-admin-guard`, and any
     other route test Task 2 finds, use non-UUID ids that the new validation rejects. Replace them with valid UUIDs
     and keep every exact authorization, bound-identity and no-write assertion. Never change an expected 403 into
     a 400.
   - **(b) Transaction wrapping.** Staff add and the duplicate-create join now run inside `withTransaction`. Tests
     that mock only `query` (`sprint-77-idempotent-create`, and any other Task 2 finds) must also mock the
     transaction client, as `sprint-92` and `sprint-93` already do. `sprint-132-body-identity` already mocks
     `withTransaction` (`:32`), so it needs (a) only.
   - **(c) Counter mocks.** `sprint-77`'s `UPDATE … current_members` mock (`:75`) becomes dead; delete it.
     `sprint-133-member-email-admin-only`'s `current_members: 3` (`:62`) is a GET fixture and is unrelated; no
     change. `sprint-78-fission-execute` and `sprint-86-fusion-member-count` assert the recompute that stays (D7),
     and must stay unchanged and green.

   Each changed regression file states its reason in its header.
4. **Capacity is checked after the write, never only before.** `assertWithinCapacity` runs inside the same
   `withTransaction`, after the member write, and throws to roll back. A returned sentinel would commit
   (`db.ts:51-53`). The admitting paths are join-to-active, staff add, PUT approve and the duplicate-create join;
   lifting a block admits nobody. The real-DB race test must show two concurrent admissions into a community with
   one free slot produce exactly one 200 and one 400 `COMMUNITY_FULL`, and a final count of `max_members`.
5. **Lock order is member row(s) → that one community row.** Membership rows never move between communities (the
   sync trigger raises on a `community_id` change), so each firing locks at most one community row (Codex F4;
   round 2, R8). Do
   not add a `SELECT … FOR UPDATE` on the community row before member locks: that inverts join/DELETE's order and
   can deadlock with the trigger. Governance keeps nomination → memberships (Sprint 143). Its role-only update does
   not fire the trigger.
6. **The PUT locks and reads in one transaction.** It locks the target plus active admins in the existing
   user-ID-ordered statement (`members.ts:371-376`), reads the caller's live role and the target's stored
   status/role, plans the change with `planStaffChange`, then writes. The caller's role is read inside the
   transaction (ADR-102). Today's pre-transaction read (`members.ts:310-314`) allows a demoted moderator to race
   a write.
7. **Canonicalize at parse, compare canonical.** The member routes run every request-supplied id they compare in
   JS through `canonicalUuid`. A malformed id is 400 before SQL. JWT ids are compared as issued. Do not fix BUG-104
   by casting inside SQL alone: the JS comparison is the bypass. Governance already lowercases
   (`governanceDb.ts:227-229`); importing the shared regex there is consolidation.
8. **The migration must hold on both appliers.**
   - No top-level `BEGIN`/`COMMIT`/`LOCK`.
   - Rerunnable, with a zero-drift normalized dump.
   - `lock_timeout` set locally so a busy table fails the migration (deploy rolls back, `deploy.sh:157-162`)
     instead of stalling it.
   - Run the `migration-validator` agent before committing it.
   - Regenerate `init.sql` through `gh workflow run regenerate-init-sql.yml --ref agent/claude/sprint-144-planning`
     (no local Docker), and commit the artifact only while the branch's pre-migration `init.sql` equals master's.
   - A fresh boot from the regenerated `init.sql` must show correct counts for its spliced seed data.
9. **RLS is not the isolation proof.** CI and the default service DB role bypass RLS (gotcha
   `database-roles-bypass-rls-so-rls-is-not-an-isolation-proof.md`). The triggers run as the invoking role, the
   same exposure as today's application `UPDATE`. Do not add `SECURITY DEFINER` without an ADR-106 note explaining
   why.
10. **Recount authorization is exactly one write.** Deploying the migration is the authorized demo write. Do not
    read or measure demo drift before or after without separate authorization. `scripts/audit-demo-data.sql`
    query 1 is the measurement to hand the maintainer if they want one. Any later repair uses
    `communities.recount_current_members()`, never a direct `UPDATE`, which the guard ignores.
11. **Real-DB evidence comes from a disposable container (decisions 9, 11).** Use a disposable PostgreSQL container
    on the demo host over an SSH tunnel, with no demo database access, as Sprint 143 did. Load the branch's schema
    (`init.sql`, then the migration chain).
    - **Red first for changed behavior only (Codex round 2, R5).** Each real-DB case that tests new behavior must
      fail before its implementation and pass after. Baseline cases that already hold, such as the `xmin`
      no-write checks or the invitation `+1` after the guard exists, are recorded as expected-green both times.
      The static gate's red result is what proves the removal of already-neutralized arithmetic.
    - **Scope.** The container runs the in-process database suites only. The services/Redis suites run in PR CI,
      which the next chat reads (decision 11).
    - Remove the container, scratch and tunnel afterwards, and record the role flags.
    - If the permission classifier blocks the SSH command, try once and hand the setup command to the maintainer;
      do not reroute.
    - The PR opens only at the end of execution, as the chat's last action; there is no draft-PR exception.
12. **Do not reopen settled decisions.** Decisions 1–11 are the maintainer's: scope, the Next.js bundling, the
    recount, moderator powers, trigger ownership, ADR-106, the column guard, lift-the-block reactivation, the
    disposable container, the direct-add exception and the verification scope. Planning defaults D1–D8 may be
    challenged in review.
13. **Flag discipline.** The sync and recount functions set `karmyq.member_count_sync` to `'on'` only around their
    own `UPDATE`, and restore the prior value before returning. Leaving it on would let a later application delta
    in the same transaction through the guard. A real-DB test proves that an application `UPDATE … current_members
    + 1` issued after a member INSERT in the same transaction is ignored.
14. **Prove "the trigger did not write" with the row version, not the count (Codex F7).** A role-only update and
    a same-status update must leave the community row's `xmin` unchanged. Count equality proves nothing: an
    accidental active→active firing would do −1 then +1 and still take the community row lock.
