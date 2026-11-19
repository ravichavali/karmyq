# Sprint 144: Staff Membership Write Integrity — Design Spec

**Date**: 2026-11-19
**Status**: Approved by the maintainer, 2026-11-19 (planning chat; decisions 1–6 below). Planning defaults D1–D8
are this chat's choices within that approval; a reviewer may challenge them.
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

**Solution.** A database trigger becomes the only writer of `current_members`, so every writer, present or
future, in either service, is correct by construction (ADR-106). A one-time recount repairs the stored drift. The
staff PUT becomes an explicit transition table. Each transition names who may perform it, what it does to the
role, and whether it admits someone. Admitting paths enforce capacity atomically by re-reading the count after
their write, inside the same transaction. Request-supplied UUIDs are canonicalized once at parse and never
compared raw. The web Reject moves to the PUT, and pending applicants get **Cancel request**. A Next.js security
patch rides as the PR's first commit.

### Core principle: Derive what can be derived; authorize each transition, not each caller

A count that can be computed from rows is computed by the database, not remembered by every writer. A staff
power is defined per state transition, so adding a role or a status forces the question "who may do this?" in
one table instead of in scattered `if` branches.

---

## Multi-sprint arc

### Sprint 142 — Proportional ratification (complete, v11.115.0, deployed 2026-11-15)
### Sprint 143 — Nomination lifecycle + member rejoin (complete, #340 `a2746057`, v11.116.0, deployed 2026-11-19)
Split self-leave (`left`) from staff removal (`inactive`) and made DELETE/self-rejoin counter-correct. It logged
BUG-103/104/105 for the staff PUT and left them out of scope by maintainer choice.

### Sprint 144 — Staff membership write integrity (this sprint)

### Later (not planned; maintainer decision required)
- BUG-106: invitation acceptance ignores capacity and silently no-ops on an existing row (logged 2026-11-19).
- Role rotation, revocation, delegation and opposition votes (ADR-055 "non-permanent roles").
- A DB CHECK on `members.role`/`members.status`. It needs a demo read first, because legacy values are unmeasured;
  the column comment names an `invited` status (`init.sql:1365`).
- Notifications to an applicant on approval or rejection (no event or template exists today).

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

### Planning defaults (this chat's choices; listed so a reviewer can challenge them)

- **D1 — One change per request.** A staff PUT body carries exactly one of `role` or `status`. Both, neither, or
  unknown keys besides the ignored legacy `admin_user_id` return 400 `VALIDATION_ERROR`. The web app never sends
  both (`ActiveTab.tsx:46`, `:56`).
- **D2 — Admission resets the role.** Approve and reactivate both write `role='member'` in the same statement, so
  no admitting transition can restore a stored staff role. This matches Sprint 143's rejoin rule
  (`members.ts:133-136`).
- **D3 — `left` belongs to the member.** Staff cannot change a `left` row (409 `MEMBER_MUST_REJOIN`); the person
  rejoins themselves. Staff can never write `left` or `pending` (400). This keeps Sprint 143's consent principle.
- **D4 — Retries are 409.** A transition to the row's current state (approve an active row, same role) returns 409
  `INVALID_MEMBERSHIP_TRANSITION`, matching Sprint 143's "409 for retries".
- **D5 — Error envelope.** Rewritten handlers use the ADR-074 helpers already imported in `members.ts`
  (`sendError`, `sendConflict`, `sendForbidden`, `sendNotFound`, `sendValidationError`, `sendInternalError`).
  Unexpected PUT and POST failures stop leaking `error.message` (`members.ts:286-289`, `:414-418`), like Sprint
  143's DELETE. Status codes stay as clients expect: last admin 400 (code `LAST_ADMIN`), full 400
  (`COMMUNITY_FULL`, as join uses at `members.ts:114`).
- **D6 — No event changes.** `user_joined_community` and `user_left_community` are in `UNCONSUMED_EVENTS`
  (`packages/shared/events/routes.ts:50`). Moving Reject from DELETE to PUT drops a `user_left_community` that
  nothing consumes. The PUT publishes nothing new.
- **D7 — Fission and fusion keep their recompute.** Their `SET current_members = (SELECT count(*) …)` statements
  (`fissionService.ts:287-295`, `fusionService.ts:94-102`) converge to the trigger's value and stay. Only `±1`
  delta writes are forbidden. Fusion can exceed `max_members` today (no capacity check in `fusionService.ts`);
  that is unchanged.
- **D8 — BUG-106 stays open.** Social-graph's invitation accept loses only its manual increment, which the trigger
  would otherwise double. Its capacity and existing-row gaps are logged as BUG-106, not fixed.

---

## New Concepts

### The staff transition table (`PUT /communities/:communityId/members/:userId`)

Status changes (`{ "status": … }`):

| Stored → requested | Allowed caller | Role effect | Admits? (capacity re-check) | Counter (trigger) |
|---|---|---|---|---|
| `pending` → `active` (approve) | active admin **or** moderator | set `member` (D2) | yes | +1 |
| `pending` → `inactive` (reject) | active admin **or** moderator | unchanged | no | 0 |
| `active` → `inactive` (deactivate) | active admin only; last-admin guard | unchanged | no | −1 |
| `inactive` → `active` (reactivate) | active admin only | set `member` (D2) | yes | +1 |
| `left` → anything | — | — | — | 409 `MEMBER_MUST_REJOIN` (D3) |
| `X` → `X` | — | — | — | 409 `INVALID_MEMBERSHIP_TRANSITION` (D4) |
| any → `left` / `pending` / other string | — | — | — | 400 `VALIDATION_ERROR` |

Role changes (`{ "role": … }`): `role ∈ {member, moderator, admin}`, **active admin caller only**, **active
target only** (otherwise 409 `INVALID_MEMBERSHIP_TRANSITION`). Same-role is 409 (D4). Demoting the sole active
admin is 400 `LAST_ADMIN`. A moderator sending `role` is 403 (unchanged behavior, now with a code).

Authorization reads the caller's **live** role inside the transaction (ADR-102). A caller who is not an active
admin or moderator gets 403. A missing target row gets 404.

The table lives in one pure module, `services/community-service/src/utils/staffTransitions.ts`. Its function
`planStaffChange(callerRole, target, body)` returns an operation or a refusal; the route only executes that plan.
`memberLifecycle.ts` keeps the self-service rules. The two modules stay separate because they answer different
questions: what *I* may do to my own membership, and what *staff* may do to someone else's.

### Canonical request UUIDs

`services/community-service/src/utils/uuid.ts` exports one `UUID_RE` and `canonicalUuid(value): string | null`,
which returns the lowercase form or `null`. Every request-supplied id that the code compares in JavaScript
(path `:userId`/`:communityId` on member PUT/DELETE, body `user_id` on staff add, the governance nominee id) is
canonicalized once at parse. A malformed id returns 400 `VALIDATION_ERROR` before any SQL runs. Today a
malformed id reaches PostgreSQL and surfaces as a 500. The JWT caller id is canonicalized the same way.
`liveRole.ts:14` and `governance.ts:7` drop their duplicate regexes and import the shared one.

Inventory (2026-11-19, `members.ts`, `governanceDb.ts`):

| Site | Compares | Failure mode today | Sprint 144 |
|---|---|---|---|
| `members.ts:379` (PUT) | DB `user_id` vs raw path id | **fails open**: guard skipped (BUG-104) | canonicalize |
| `members.ts:440` (DELETE) | raw path id vs JWT id | fails closed: self-leave treated as staff removal → 403 | canonicalize |
| `members.ts:465`, `:469` (DELETE) | DB `user_id` vs raw path id | fails closed: 404 | canonicalize |
| `governanceDb.ts:241` (nominate) | DB `user_id` vs body nominee id that passed the `/i` regex at `governance.ts:7-8` | fails closed (nominee "not found") | canonicalize |

Every other JS id comparison in community-service is between two JWT- or DB-derived values, which PostgreSQL
already renders lowercase. Task 3 re-runs the inventory against the live tree, without truncation, and records it
in the ledger.

### Database-owned member count (ADR-106)

A trigger on `communities.members` keeps `communities.communities.current_members` equal to the number of rows with
`status = 'active'`:

- `AFTER INSERT` and `AFTER DELETE`, plus `AFTER UPDATE OF status, community_id` with a `WHEN` clause that skips
  rows whose status and community are unchanged. A role-only update (governance grant, `governanceDb.ts:374`)
  does not fire it.
- The delta is `(NEW is active ? +1 : 0) − (OLD is active ? 1 : 0)`, applied per community. A `community_id`
  change decrements the old community and increments the new one. `NULL` status counts as not active.
- It never clamps. A negative result would expose a bug instead of hiding it.

Capacity is not in the trigger (decision 5, D7). Instead,
`services/community-service/src/database/memberCapacity.ts` exports `assertWithinCapacity(q, communityId)`. It
runs **after** an admitting write inside the same `withTransaction`. It reads `current_members, max_members` and
throws `CommunityFullError` when `current_members > max_members`. `withTransaction` rolls back on any throw
(`services/community-service/src/database/db.ts:45-62`), so the member write and the trigger's increment are
undone together. This is atomic without a new lock. The trigger's `UPDATE` holds the community row lock until
commit, so concurrent admitters serialize on that row. Under READ COMMITTED the second re-reads the first's
committed count and its post-check fails. Lock order stays member row(s) → community row everywhere, as join and
DELETE already do (`members.ts:130-146`, `:458-476`).

Admitting paths in community-service, each wrapped in one transaction with the post-check:

1. self-join to `active` (public), including a `left` rejoin;
2. staff add, `POST /communities/:communityId/members`;
3. PUT approve;
4. PUT reactivate;
5. duplicate-create join, `communities.ts:448-461`.

Private pending joins admit nobody and skip the check. The pre-write "Community is full" fast path in join may stay
as a friendly early refusal, but the post-check is authoritative.

---

## Data Model

One new migration, `infrastructure/postgres/migrations/20261119-community-member-count-trigger.sql`. It has no
`BEGIN`/`COMMIT` (gotcha `docs/gotchas/migration-appliers-disagree-on-transaction-wrapping.md`), and the atomic
part sits in one `DO $migration$ … $migration$;` block. It must be rerunnable, because CI replays it over an
`init.sql` that already contains it.

```sql
-- Sprint 144 (ADR-106): the database owns communities.current_members.
CREATE OR REPLACE FUNCTION communities.sync_current_members() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.status = 'active' THEN
    UPDATE communities.communities SET current_members = current_members - 1 WHERE id = OLD.community_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.status = 'active' THEN
    UPDATE communities.communities SET current_members = current_members + 1 WHERE id = NEW.community_id;
  END IF;
  RETURN NULL;
END
$fn$;

DO $migration$
BEGIN
  -- Fence member writers so no write lands between trigger install and recount (deploy: held to COMMIT).
  LOCK TABLE communities.members IN SHARE ROW EXCLUSIVE MODE;

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

  -- Converging recount (third time: S86, S97). Pure cache of count(active members); rerun is a no-op.
  UPDATE communities.communities c SET current_members = COALESCE(sub.cnt, 0)
  FROM (
    SELECT c2.id, (SELECT count(*)::int FROM communities.members m
                   WHERE m.community_id = c2.id AND m.status = 'active') AS cnt
    FROM communities.communities c2
  ) sub
  WHERE c.id = sub.id AND c.current_members IS DISTINCT FROM sub.cnt;
END
$migration$;

COMMENT ON COLUMN communities.communities.current_members IS
  'Count of active communities.members rows, maintained by trigger members_sync_current_members_* (ADR-106). Never write deltas from application code.';
```

The SQL above is the design intent. The `migration-validator` agent and plan review may tighten it. Two checks in
particular:

- `LOCK TABLE` inside a `DO` block is legal and satisfies the gotcha, which bans only a top-level one. Prove it on
  both appliers.
- The function `RETURN NULL` is correct for an `AFTER` row trigger.

`init.sql` is regenerated from the migration chain, never hand-edited (`infrastructure/claude.md:15-30`).

No other schema change. In particular there is no CHECK on `members.role`/`members.status` (see *Later*).

### Writers that change because the trigger now counts

| Writer | Today | After |
|---|---|---|
| Community create, `communities.ts:538-542` | `INSERT … current_members = 1`, then creator INSERT | insert `0`; the creator row's trigger makes it `1`. The response re-reads the count |
| Duplicate-create join, `communities.ts:455-460` | `+1` if inserted | delete the `+1`; keep the in-memory response adjustment or re-read; add the capacity post-check |
| Join, `members.ts:143-145` | `+1` if active | delete; add the post-check |
| Staff add, `members.ts:262-268` | `+1` | delete; wrap in a transaction with the post-check |
| DELETE, `members.ts:474-476` | `−1` if active | delete (the trigger decrements) |
| Invitation accept, `invitations.ts:162-167` (social-graph) | `+1` unconditionally | delete (BUG-106 stays open) |
| Fission/fusion recompute | exact recompute | unchanged (D7) |
| `infrastructure/postgres/seed-e2e.sql:85`, `:114` | explicit `current_members` then member rows | seed `0` (the trigger counts the member rows) |
| Simulation curated baseline, `services/simulation-service/src/fixtures/curatedDemo/baselineWriter.ts:130-150` | inserts communities at the default `0`, then members: the count stays wrong | unchanged code; counts become correct |

A new root regression gate fails on any `current_members = current_members ±` or `current_members±` delta in
`services/*/src`, `apps/*/src` and `packages/*/src`. Converging recomputes and reads stay allowed. A negative
fixture proves the gate can fail.

---

## API Endpoints

| Method | Path | Change | Auth | Body | Response |
|---|---|---|---|---|---|
| PUT | `/communities/:communityId/members/:userId` | Rewritten as the transition table. Canonical UUIDs. Exactly one of `role`/`status`. Moderators approve/reject only. Approve and reactivate reset the role to `member` and re-check capacity. ADR-074 errors | JWT; live admin/moderator | `{ "status": "active" \| "inactive" }` **or** `{ "role": "member" \| "moderator" \| "admin" }` | 200 `{success, data: memberRow, message}`; 400 `VALIDATION_ERROR` / `LAST_ADMIN` / `COMMUNITY_FULL`; 403 `FORBIDDEN`; 404 `NOT_FOUND`; 409 `INVALID_MEMBERSHIP_TRANSITION` / `MEMBER_MUST_REJOIN`; 500 `INTERNAL_ERROR` (no raw detail) |
| DELETE | `/communities/:communityId/members/:userId` | Canonical UUIDs (a self-leave with an uppercase id is self-leave). The `−1` write is removed (trigger) | JWT | — | unchanged contract |
| POST | `/communities/:communityId/join` | The `+1` is removed (trigger). Atomic capacity post-check for active admission | JWT | unchanged | unchanged, including 400 `COMMUNITY_FULL` |
| POST | `/communities/:communityId/members` | Canonical body `user_id`. One transaction with the post-check. The `+1` is removed. No raw `error.message` | JWT; live admin | unchanged | unchanged plus 400 `COMMUNITY_FULL` under a race; 500 `INTERNAL_ERROR` |
| POST | `/communities` | Insert `current_members = 0`; the response carries the post-trigger count. The duplicate-create join gets the post-check | JWT | unchanged | unchanged |
| POST | `/communities/:communityId/governance/nominate` | Canonical nominee id | JWT | unchanged | unchanged |
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
- The hero's count now reads truthful data. No code change is needed there.

---

## User Guide & Doc Updates

- `docs/guides/admin-community-guide.md` (published as `admin-community`, `scripts/generate-docs.ts:327`):
  - *Leaving, removal and rejection* (`:76-84`): "A current community admin or moderator must reactivate that
    membership" becomes admin-only. Reactivation returns the person as an ordinary member. Someone who left
    rejoins themselves; staff cannot restore them.
  - New subsection *Approving and rejecting join requests*: moderators can approve or reject pending requests;
    removing members, reactivating, and role changes are admin powers. Approval counts toward the member cap and
    fails when the community is full.
- `docs/guides/finding-communities-guide.md`, *Leaving and rejoining* (`:15-24`): add cancelling a pending join
  request, and that a cancelled request can be re-sent like any rejoin.
- `docs/concepts/governance.md`: read first. Update only if it describes moderator powers that change.
- `apps/frontend/src/lib/onboarding/workflows.ts`: read for any admin/moderator approval step. Update only if one
  describes moderator power or rejection. Record the result either way.
- `docs/guides/community-admin-guide.md` is an unpublished duplicate (absent from `scripts/generate-docs.ts`). Only
  check it for contradictions; do not expand it.
- ADR-106 `docs/adr/ADR-106-database-owned-member-count.md`, indexed in `docs/adr/README.md`, with its slug in the
  `— Community & Scale —` group of `ADR_GROUPS` (`scripts/generate-docs.ts:500-507`). Then regenerate the landing
  docs.
- `services/community-service/CONTEXT.md`: PUT/DELETE/join/staff-add sections; replace the false "database
  constraint" claim (`:1554-1567`) and the stale last-admin sample (`:1569-1590`); the *Sprint 25 — Moderator
  support* line (`:840`); a Recent Changes entry.
- `services/social-graph-service/CONTEXT.md`: invitation accept no longer writes the counter; BUG-106 pointer.
- `services/registry.json`: PUT member description; social-graph invitation note if it mentions the count.
- `docs/BUGS.md`: BUG-103/104/105 → fixed (Sprint 144), BUG-106 open.
- `infrastructure/claude.md`: migration count line (`:23`) if it is re-counted.

---

## Critical Implementation Notes

1. **First commit = the Next.js splice, nothing else.** Root lock nodes `node_modules/next`, `node_modules/@next/env`
   and the 8 `node_modules/@next/swc-*` go 16.4.2 → **16.4.6**: `version`, `resolved` and `integrity` only, from
   registry metadata. 16.4.6 is `latest` on 2026-11-19, and its dependency map equals 16.4.2's except `@next/env`.
   Keep every `libc` field (4 swc nodes carry one). Declared ranges go `^16.4.2` → `^16.4.6` in
   `apps/frontend/package.json:24`, `apps/landing/package.json:18` and those workspaces' `packages[...]` entries in
   the lock. `postcss` stays governed by the root override `"postcss": "^8.5.25"`, so no nested postcss node is
   added. Prove the splice with strict `npx npm@11.19.0 ci`, an `npm ls --all` problem list identical to master's
   (BUG-047's `picomatch` line is pre-existing), the ADR-059 audit gate at 0 high/critical with #185/#186's GHSAs
   gone, and `tests/regression/sprint-122-lint-config-gate.test.ts` green. Never execute a downloaded tarball.
   Never use `npm install --workspace`, `npm dedupe` or a lock regen. Use a script file with match-count guards
   for the splice.
2. **The trigger changes every fixture's arithmetic.** Any test or seed that inserts a community with a non-zero
   `current_members` and then inserts active member rows now gets the sum. Inventory every such site before
   implementing. Known sites:
   - `tests/integration/sprint-143-governance-lifecycle.integration.test.ts:48`, which also sets counts at
     `:652`, `:666` and `:689`;
   - `tests/integration/social-graph.test.ts:152-188`;
   - `tests/integration/sprint-142-governance-quorum.integration.test.ts`;
   - `tests/integration/sprint-134-pr-l2-health.integration.test.ts`;
   - `infrastructure/postgres/seed-e2e.sql:85`, `:114`.

   Fix each fixture to state the truth: seed `0` and let the trigger count, or assert deltas. Never weaken an
   assertion to make it pass.
3. **Mocked-SQL regressions assert the old mechanism.** `sprint-77-idempotent-create`, `sprint-93-members-delete-jwt`,
   `sprint-132-body-identity` and `sprint-133-member-email-admin-only` (community-service `tests/regression/`) mock
   `UPDATE … current_members` or assume a creation count of `1`. Changing a regression test needs a written reason
   in its header ("counter moved to the DB trigger, ADR-106; real-DB proof in
   `tests/integration/sprint-144-staff-write-integrity.integration.test.ts`"). `sprint-78-fission-execute` and
   `sprint-86-fusion-member-count` assert the converging recompute, which stays (D7). They must stay unchanged and
   green.
4. **Capacity is checked after the write, never only before.** `assertWithinCapacity` runs inside the same
   `withTransaction`, after the member write, and throws to roll back. A returned sentinel would commit
   (`db.ts:51-53`). The real-DB race test must show two concurrent admissions into a community with one free slot
   produce exactly one 200 and one 400 `COMMUNITY_FULL`, and a final count of `max_members`.
5. **Lock order is member row(s) → community row**, everywhere. Do not add a `SELECT … FOR UPDATE` on the community
   row before member locks: that inverts join/DELETE's order and can deadlock with the trigger. Governance keeps
   nomination → memberships (Sprint 143). Its role-only update does not fire the trigger.
6. **The PUT locks and reads in one transaction.** It locks the target plus active admins in the existing
   user-ID-ordered statement (`members.ts:371-376`), reads the caller's live role and the target's stored
   status/role, plans the change with `planStaffChange`, then writes. The caller's role is read inside the
   transaction (ADR-102). Today's pre-transaction read (`members.ts:310-314`) allows a demoted moderator to race
   a write.
7. **Canonicalize at parse, compare canonical.** Reuse `canonicalUuid` for every request-supplied id compared in
   JS. A malformed id is 400 before SQL. Do not fix BUG-104 by casting inside SQL alone: the JS comparison is the
   bypass.
8. **The migration must hold on both appliers.** No top-level `BEGIN`/`COMMIT`/`LOCK`. It must be rerunnable with a
   zero-drift normalized dump. Run the `migration-validator` agent before committing it. Regenerate `init.sql`
   through `gh workflow run regenerate-init-sql.yml --ref agent/claude/sprint-144-planning` (no local Docker) and
   commit the artifact only while the branch's pre-migration `init.sql` equals master's.
9. **RLS is not the isolation proof.** CI and the default service DB role bypass RLS (gotcha
   `database-roles-bypass-rls-so-rls-is-not-an-isolation-proof.md`). The trigger's `UPDATE` runs as the invoking
   role, the same exposure as today's application `UPDATE`. Do not add `SECURITY DEFINER` without an ADR-106 note
   explaining why.
10. **Recount authorization is exactly one write.** Deploying the migration is the authorized demo write. Do not
    read or measure demo drift before or after without separate authorization. `scripts/audit-demo-data.sql`
    query 1 is the measurement to hand the maintainer if they want one.
11. **Real-DB proof runs in CI.** CI runs `tests/integration` only on PRs and master pushes
    (`.github/workflows/ci.yml:3-7`). A disposable PostgreSQL container on the demo host is **not** allocated.
    Ask the maintainer at Task 1 if local iteration is wanted; otherwise open the PR as a draft once the migration
    and trigger tests exist, and treat CI as the real-DB arbiter.
12. **Do not reopen settled decisions.** Moderator powers, trigger ownership, the recount, ADR-106 and the bundling
    of the Next.js fix are maintainer decisions (1–6). Planning defaults D1–D8 may be challenged in review.
