# Sprint 143: Governance Nomination Lifecycle and Member Rejoin — Design Spec

**Date**: 2026-11-15
**Status**: Approved by the maintainer, 2026-11-15 (planning chat; decisions 1–8 below)
**Version**: v11.115.0 → **unallocated.** The maintainer allocates the release version at merge time, re-derived
from `origin/master`.
**Sprint Branch**: `agent/claude/sprint-143-planning` (reused task branch; it already carries the Sprint 142
post-merge record `3e63ca9f`, which rides with this product PR)

---

## Overview

Sprint 142 made ratification proportional and froze each nomination's electorate. It also left three gaps that
now block real use.

- **Nominations cannot end.** A nomination nobody votes on stays pending forever, and the partial unique index
  `governance_one_pending_role` then blocks any new nomination for the same nominee and role.
- **A stalled nomination can never finalize.** If the nominee leaves or loses eligibility while the
  nomination is pending, it stays pending with nothing to clear it.
- **Members who leave cannot come back.** The join route falls through to an `INSERT` that violates the
  `(community_id, user_id)` unique key and returns 500 (BUG-102).

This sprint gives each nomination a bounded life. The two parties to a nomination can end it early: the
nominator withdraws, or the nominee declines. Otherwise it expires 30 days after it opens. Expiry is enforced
lazily inside community-service and backed by the database guard. On the membership side, a self-leave and a
staff removal become different states. A member who left can rejoin like a new joiner, with their role reset to
`member`. A member removed or rejected by staff cannot let themselves back in. The web app also gets the
**Leave community** control it never had, so that path is reachable from the product.

### Core principle: Consent can be withdrawn by those who gave it; time closes the rest

Only the people a decision is about (the nominator and the nominee for a nomination, the member for their own
membership) can withdraw from it. Incumbents get no veto, and nothing stays open indefinitely.

---

## Multi-sprint arc

### Sprint 142 — Proportional ratification (complete, v11.115.0, deployed 2026-11-15)
Equal votes from a frozen electorate, `R = max(3, ceil(E/5))`, and an atomic grant. Its spec explicitly deferred
withdrawal and expiry (`docs/superpowers/specs/2026-11-12-sprint-142-governance-quorum-design.md:69`).

### Sprint 143 — Nomination lifecycle + member rejoin (this sprint)

### Later (not planned; maintainer decision required)
Role rotation, revocation, delegation, and opposition votes all remain out of scope. ADR-055's "Why Non-Permanent Roles?" intent is
still unimplemented (`docs/concepts/governance.md:48-50`).

---

## Maintainer decisions (2026-11-15)

1. **Withdrawal:** the nominator may withdraw and the nominee may decline a pending nomination. Admins get no
   close power.
2. **Expiry:** one fixed, platform-wide 30-day window, recorded on each nomination at creation. There is no
   per-community policy editor.
3. **BUG-102:** distinguish a self-leave from a staff removal. A member who left rejoins like a new joiner
   (public community → active, private → pending) with the role reset to `member`. A removed member gets 409, and
   only staff can reactivate them.
4. **Ineligible nominee:** there is no departure hook in `members.ts`. The nomination stays pending, cannot
   finalize, expires on schedule, and GET shows voters a plain "nominee no longer eligible" state.
5. **The design as summarized is approved.** That summary covers the withdraw and decline endpoints, lazy expiry
   through a DB-default `expires_at`, the new `declined`/`expired` statuses, and the GET flags. It also covers
   member status `left` for self-leave, `inactive` staying staff-only, and an amendment to ADR-055 rather than a
   new ADR.
6. **Rejected join applicants are staff-only**, like removed members: one rule that fails closed.
7. **Real-DB proof:** root `tests/integration/` runs in CI on the PR. In addition, the maintainer re-authorized
   SSH to karmyq.com to run the suite in a disposable Postgres container, never against the demo application
   database (the same arrangement as Sprint 142).
8. **Scope expansion:** a web **Leave community** control. Self-leave reissues the JWT, as join does.

---

## Verified baseline (read 2026-11-15 at `3e63ca9f`)

| Evidence | Current behavior |
|---|---|
| `infrastructure/postgres/migrations/009-governance-schema.sql:20` | `valid_nomination_status` allows only `pending`, `ratified`, `rejected`, `withdrawn`. |
| `infrastructure/postgres/migrations/20261112-governance-quorum.sql:26-28` | The partial unique `governance_one_pending_role` admits one pending nomination per `(community, nominee, role)`. |
| `20261112-governance-quorum.sql:36-57` | `require_governance_protocol_v1()` demands the transaction marker for ballot inserts, nomination inserts and transitions **to `ratified`** only. Transitions to other statuses pass without it. |
| `services/community-service/src/database/governanceDb.ts:157-174` | `governanceTransaction` sets the marker on the checked-out client, maps 40P01 → 503 `GOVERNANCE_RETRY` and the named 23505 → 409. Any thrown error rolls the whole transaction back. |
| `governanceDb.ts:208-237` | Creation locks the nominator's and the nominee's membership rows first (`FOR NO KEY UPDATE`, ordered), then inserts. It never touches existing nominations. |
| `governanceDb.ts:255-299` | Ratification locks the nomination row first (`FOR UPDATE`), then the membership rows. **Lock order: nomination → membership.** |
| `governanceDb.ts:116-122` | `ready_to_finalize` is computed from the ballot count alone, not from the nominee's eligibility, so GET can offer **Finalize** when the POST would return 422. |
| `governanceDb.ts:99` | GET lists `status = 'pending'` nominations with no time bound. |
| `services/community-service/src/routes/governance.ts:32-45` | The only routes are GET, nominate and ratify. Nothing in the governance path publishes an event (its imports, lines 1-4). |
| `services/community-service/src/routes/members.ts:108-133` | Join checks an existing row for `active`/`pending` only. Any other status falls through to `INSERT`, which hits `members_community_id_user_id_key` (`infrastructure/postgres/init.sql:3257`). That is BUG-102. |
| `members.ts:474, 524-537` | DELETE treats self-leave, admin kick and join-request rejection the same way: `status = 'inactive'`, the role is kept, and `current_members` is decremented **unconditionally**. It also does this for a row that is already inactive. |
| `members.ts:161-187` | Join reissues the JWT for an active join only. DELETE reissues nothing. |
| `members.ts:328-454` | The staff PUT writes `status` and `role` from the body without an allowlist and never adjusts `current_members` (BUG-103). |
| `apps/frontend/src/components/community/tabs/ActiveTab.tsx:66,77` | Admin reject and admin remove both call DELETE (`removeMember`). |
| `apps/frontend/src/lib/api.ts:263` | `communityService.leaveCommunity` (DELETE self) exists but has **no caller**. No web UI lets a member leave. |
| `apps/mobile/services/api.ts:64` | Mobile leave calls `POST /communities/:id/leave`, a route that does not exist. Out of scope (mobile revival). |
| `services/simulation-service/src/fixtures/curatedDemo/types.ts:40` | The curated demo already uses member status `'left'`. |
| `apps/frontend/src/components/GovernanceTab.tsx:25-29` | Has the `not_in_electorate` copy that the Sprint 142 deferred minor flagged. |
| `apps/frontend/src/components/community/CommunityHero.tsx:51-72` | Shows Join for non-members and a pending state, but offers no Leave. |
| `packages/shared/src/schemas/reputationDisclosure.ts:223-242` | The forbidden ordinary-member keys are metrics only. A boolean `nominee_eligible` is not among them. |

---

## Policy

### Nomination lifecycle

| Status | Set by | When |
|---|---|---|
| `pending` | creation | Open; counts toward the one-pending slot |
| `ratified` | final ballot | Quorum reached, nominee rechecked, role granted (unchanged from Sprint 142) |
| `withdrawn` | **nominator** | Any time while pending and unexpired. Rows with a NULL policy version are Sprint 142's legacy closes |
| `declined` | **nominee** | Any time while pending and unexpired, including at quorum |
| `expired` | the first write to touch the row after `expires_at` | 30 days after creation |
| `rejected` | — | Kept in the CHECK for history; nothing writes it (there are no opposition votes) |

- **Who can close a nomination.** The caller must be an active member of the path community, and must be the
  nominator (withdraw) or the nominee (decline). A self-nominated member may use either endpoint. Admins and
  moderators get no close power, by design.
- **Ballots.** Ballots are preserved on every close. A closed nomination is final, and a retry returns 409.
- **Expiry window.** `expires_at = created_at + interval '30 days'`, written by the column default. The app never
  computes it. Expiry is evaluated with the database clock (`now()` inside the transaction), never a JS `Date`.
- **Expiry is lazy.** No sweeper and no cleanup-service job is involved.
  - GET shows only `pending` rows with `expires_at > now()`.
  - Ratify, withdraw and decline on an expired pending row first mark it `expired` with
    `resolved_at = expires_at`, commit that close, and then return 409 `GOVERNANCE_NOMINATION_EXPIRED`.
  - Creation first closes an expired pending row that still holds the same `(community, nominee, role)` slot,
    then inserts.
- **Expiry is also enforced by the database.** The guard function refuses a ballot insert on an expired
  nomination and refuses a transition to `ratified` after `expires_at`. An old or rolled-back binary cannot
  ratify an expired nomination either; it fails closed, matching Sprint 142's rollback philosophy.
- **An ineligible nominee** is a nominee who is inactive, already holds the target role or a higher one, or is
  below the trust threshold. Such a nomination is not closed. GET reports a coarse `nominee_eligible: false`,
  and ballots that could not be recorded are not offered (next section). Trust can recover before expiry.

### Viewer actions mirror the POST

GET's `viewer.can_ratify` must be true exactly when the ratify POST would record a ballot or finalize:

| Viewer state | `nominee_eligible` | Result |
|---|---|---|
| nominee | any | reason `nominee`, `can_ratify` false, `can_decline` true |
| not in the snapshot | any | reason `not_in_electorate`, false |
| voted, count < R | any | reason `already_ratified`, false |
| voted, count ≥ R | true | reason `ready_to_finalize`, true |
| voted, count ≥ R | false | reason `nominee_ineligible`, false |
| not voted | true | reason `eligible`, true |
| not voted, count + 1 ≥ R | false | reason `nominee_ineligible`, false (this ballot would trigger the 422 rollback) |
| not voted, count + 1 < R | false | reason `eligible`, true (the ballot is recorded; Sprint 142 semantics) |

`viewer.can_withdraw` is true exactly for the nominator, and `viewer.can_decline` exactly for the nominee. The
nominator can hold both `can_ratify` and `can_withdraw`. `nominee_eligible` discloses nothing beyond the existing
`eligible_members` and `role_holders` lists (ADR-082 coarse eligibility).

### Membership departure and rejoin (BUG-102)

| Existing row status | Written by | Self-service join |
|---|---|---|
| none | — | `INSERT` as today. A concurrent duplicate's 23505 → 409 `CONFLICT`, not 500 |
| `active` | — | 409 `CONFLICT` (unchanged) |
| `pending` | — | 409 `CONFLICT` (unchanged) |
| **`left`** | DELETE by the member themself (leave, or cancelling their own pending request) | **Rejoin**: one conditional `UPDATE … WHERE status = 'left'` resets `role = 'member'`, sets the status by `access_type`, stores the new message and sets `joined_at = CURRENT_TIMESTAMP`. `current_members` is incremented only if the new status is `active`, in the same transaction. Same events and token reissue as a first join |
| `inactive` | DELETE by staff (removal or join rejection), the staff PUT, legacy rows | 409 `MEMBERSHIP_RESTORE_REQUIRES_STAFF`: "Ask a community admin to restore your membership." |
| anything else (`invited`, values the PUT wrote without validation) | — | Fail closed: the same 409 as `inactive` |

- **Existing `inactive` rows stay staff-only.** There is no way to tell which of them were self-leaves, so they
  fail closed. Today those users get a 500; after this sprint they get a clear 409.
- **DELETE by self.** Allowed only on an `active` or `pending` row, and writes `left`. On any other status it
  returns 409 `CONFLICT` and changes nothing. Without this rule, a removed member could self-DELETE their
  `inactive` row into `left` and then rejoin.
- **DELETE by an admin.** Writes `inactive` on any existing row, including a `left` row, so staff can still
  block a departed member's return.
- **Member count on DELETE.** `current_members` is decremented only when the row was `active`. The prior status
  is read under a row lock in the same transaction.
- **Token on self-leave.** A self-leave that ends an active membership reissues the JWT, using the same claim
  query as join (shared helper). The success envelope then carries `data.token`.
- **The last-admin guard** is unchanged: a sole admin cannot leave (400).
- **Staff reactivation.** The staff PUT is unchanged. It reactivates any status and keeps the stored role; that
  is a staff decision. It still does not adjust the counter (BUG-103, out of scope).
- **Governance interplay.**
  - A rejoined original voter counts again on a still-pending, unexpired nomination, under Sprint 142's
    live-tally rule.
  - A nominee who left and rejoins becomes eligible again if their trust qualifies; their role is now `member`.
  - Rejoin never restores a past role.

---

## Data model

There are no new tables. One new migration: `infrastructure/postgres/migrations/20261115-governance-nomination-lifecycle.sql`
(at implementation, confirm the name is unused and sorts after `20261112-governance-quorum.sql`; the applier
sorts by filename, `scripts/apply-migrations.sh:67`).

The governance changes are one `DO $migration$ … $migration$;` block with no top-level `BEGIN`, `COMMIT` or
`LOCK` (see `docs/gotchas/migration-appliers-disagree-on-transaction-wrapping.md`). Inside the block, in this
order:

```sql
ALTER TABLE communities.governance_nominations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
-- default AFTER the add, so existing rows are NOT stamped with now()+30d
ALTER TABLE communities.governance_nominations ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days');
UPDATE communities.governance_nominations SET expires_at = created_at + interval '30 days'
  WHERE quorum_policy_version = 1 AND expires_at IS NULL;   -- v1 rows only; legacy/history stay NULL
-- guarded by pg_constraint lookups, as in 20261112:
--   governance_expiry_metadata CHECK (quorum_policy_version IS NULL
--                                     OR (expires_at IS NOT NULL AND expires_at > created_at))
-- valid_nomination_status: DROP CONSTRAINT IF EXISTS, then re-ADD with
--   ('pending','ratified','rejected','withdrawn','declined','expired')
-- CREATE OR REPLACE FUNCTION communities.require_governance_protocol_v1(): the Sprint 142 body plus
--   ratifications INSERT: RAISE 'GOVERNANCE_NOMINATION_EXPIRED' (23514) if the nomination's expires_at <= now()
--   nominations UPDATE to 'ratified': RAISE the same if NEW.expires_at <= now()
```

After the block, a separate idempotent statement updates the member status comment:
`COMMENT ON COLUMN communities.members.status IS 'active: member; pending: awaiting approval; invited: has
invite; left: the member left and may self-rejoin; inactive: removed or rejected by staff (staff reactivation
only)'`.

- **No CHECK on `members.status`.** Existing demo values are unmeasured, and the PUT writes unvalidated strings.
- **Migration properties.**
  - Rerunnable over a regenerated `init.sql` with zero drift.
  - Old v11.115.0 writers stay compatible during the deploy window: their inserts receive the default, and their
    status transitions are unaffected.
  - The Sprint 142 protocol marker remains `'1'`, because the quorum policy is unchanged.
- **Generated artifacts.** Regenerate `init.sql` from the chain, never by hand. There are no table-policy changes,
  since no new table is added (`services/simulation-service/tests/regression/sprint-141-table-policy-covers-init-sql.test.ts`
  stays green).

---

## Transactions and lock order

**Every governance write locks the nomination before any membership row, the order ratification already uses.**

- **Withdraw / decline** (`governanceTransaction`):
  1. `SELECT … FROM governance_nominations WHERE id = $1 AND community_id = $2 FOR UPDATE`. Missing → 404.
  2. Read the caller's membership `FOR SHARE`. Not active → 403 `FORBIDDEN`.
  3. Party check: 403 `GOVERNANCE_NOT_NOMINATOR` or `GOVERNANCE_NOT_NOMINEE`.
  4. `status <> 'pending'` → 409 `GOVERNANCE_NOMINATION_CLOSED`.
  5. Expired → commit the close as `expired`, then 409 `GOVERNANCE_NOMINATION_EXPIRED`.
  6. Otherwise update to `withdrawn`/`declined` with `resolved_at = now()`.
- **Ratify** (Sprint 142 flow): after the nomination lock and the closed check, an expired row commits its
  `expired` close and returns 409 `GOVERNANCE_NOMINATION_EXPIRED` before any membership lock or ballot.
- **Create**: right after the community check and **before** the existing membership locks, run
  `UPDATE … SET status = 'expired', resolved_at = expires_at WHERE community_id = $1 AND nominated_user_id = $2
  AND nominated_for_role = $3 AND status = 'pending' AND expires_at <= now()`.
  - That keeps creation in nomination → membership order.
  - Taking the nomination lock after the membership locks would invert ratification's order and could
    deadlock at the expiry instant.
- **Commit-then-refuse.** Because `governanceTransaction` rolls back on any throw, the expired close must be
  returned as a result and turned into the 409 after `COMMIT`. A throw inside the transaction would roll back the
  close.
- **Members DELETE**: one transaction:
  1. Lock the target row (`FOR UPDATE`) and read its prior status.
  2. Apply the existing last-admin guard.
  3. Write `left` or `inactive`.
  4. Decrement `current_members` only if the prior status was `active`.
- **Members join**: the rejoin `UPDATE` (guarded by `WHERE status = 'left'`) and the counter increment share one
  transaction. A concurrent second rejoin matches zero rows, re-reads the row and returns 409.
- **Membership writes never touch nominations** (decision 4), so no new membership → nomination lock path
  exists.

---

## API endpoints

ADR-074 envelopes throughout. Paths are service paths behind `/api/communities`.

| Method / path | Auth / body | Result |
|---|---|---|
| POST `/communities/:communityId/governance/withdraw/:nominationId` **(new)** | Active nominator; empty body | 200 `{ id, status: 'withdrawn' }`; 403 `FORBIDDEN` / `GOVERNANCE_NOT_NOMINATOR`; 404; 409 `GOVERNANCE_NOMINATION_CLOSED` / `GOVERNANCE_NOMINATION_EXPIRED`; 503 `GOVERNANCE_RETRY` |
| POST `/communities/:communityId/governance/decline/:nominationId` **(new)** | Active nominee; empty body | 200 `{ id, status: 'declined' }`; 403 `FORBIDDEN` / `GOVERNANCE_NOT_NOMINEE`; otherwise the same as withdraw |
| POST `…/governance/ratify/:nominationId` | unchanged | adds 409 `GOVERNANCE_NOMINATION_EXPIRED` |
| POST `…/governance/nominate` | unchanged | reclaims an expired slot before inserting; the 201 body adds `expires_at` |
| GET `…/governance` | unchanged | each nomination adds `expires_at` (ISO) and `nominee_eligible`; `viewer` adds `can_withdraw`, `can_decline` and reason `nominee_ineligible`; expired rows are hidden |
| POST `/communities/:communityId/join` | unchanged | `left` → rejoin as above; `inactive` / unknown → 409 `MEMBERSHIP_RESTORE_REQUIRES_STAFF`; concurrent-insert 23505 → 409 `CONFLICT` |
| DELETE `/communities/:communityId/members/:userId` | unchanged auth | self → `left` (active or pending rows only, else 409); admin → `inactive`; counter only for an active row; a self-leave from active returns `data.token` |

All new routes validate the UUIDs before any query, derive identity only from the JWT `userId`, and log internal
failures without SQL, rosters or metrics (the existing `handle` wrapper, `governance.ts:21-30`). The
`/:communityId/governance` router middleware (`governance.ts:13-19`) already covers the new paths.

---

## Frontend changes

- **`apps/frontend/src/components/GovernanceTab.tsx`** (in place):
  - Types gain `expires_at`, `nominee_eligible`, `viewer.can_withdraw`, `viewer.can_decline` and reason
    `nominee_ineligible`.
  - Each card shows "Closes {date}".
  - **Withdraw nomination** for the nominator and **Decline** for the nominee, each with an inline
    confirm/cancel step that follows the existing nominate pattern (the action is irreversible). Both go through
    `perform`, so the existing refresh-on-success/error and busy guard apply.
  - When `nominee_eligible` is false, the card says "This nomination can't be finalized while the nominee isn't
    eligible. It closes on {date}."
  - Copy fix: `not_in_electorate` → "You were not an active member when this nomination opened."
- **`apps/frontend/src/lib/api.ts`**: add `communityService.withdrawNomination` and `declineNomination`, next to
  `ratifyNomination` (`api.ts:361-362`). Reuse the existing `leaveCommunity` (`api.ts:263`).
- **`CommunityHero.tsx` + `pages/communities/[id].tsx`: the Leave control.**
  - Active members get a **Leave community** control behind a confirmation.
  - On success, persist `data.token` the same way the page's join handler does (`[id].tsx:101-117`; extract a
    shared helper rather than copy it), then refetch.
  - The 400 last-admin message and the 409s show through the page's existing message path.
  - A removed member who presses Join sees the 409 message through the existing join error path (`[id].tsx:131-132`).
  - No other screen or redesign: existing layout and tokens only.

---

## User guide & doc updates

- **`docs/concepts/governance.md`**: replace "adds no expiry or withdrawal control" (line 25) and the
  time-based-expiry disclaimer (line 50) with the shipped lifecycle (withdraw, decline, 30-day expiry, the
  ineligible-nominee state). Do not imply rotation or revocation.
- **`docs/guides/admin-community-guide.md`**:
  - Stewardship section (lines 80-103): withdraw, decline and expiry, and the "can't be finalized" state.
  - Around line 70: leaving vs. removal vs. rejection. Removed and rejected members need staff reactivation,
    and a rejoin never restores a role.
- **`docs/guides/finding-communities-guide.md`**: a short "Leaving and rejoining" section covering the new Leave
  control, the rejoin behavior, and what a removed member sees.
- **`apps/frontend/src/lib/onboarding/workflows.ts:75`**: one added sentence: nominations close after 30 days,
  and the nominator can withdraw or the nominee can decline.
- **`docs/adr/ADR-055-trust-governance-architecture.md`**: a dated Sprint 143 amendment (lifecycle, lazy +
  DB-enforced expiry, lock order). Update the `docs/adr/README.md` index entry. **No new ADR number.** The
  membership rejoin rule is recorded in that amendment because it changes who counts in governance.
- **`services/community-service/CONTEXT.md`**: a Recent Changes entry, the schema section, and the join and DELETE
  endpoint docs (their `members.ts:43` / `:260` line references are stale; replace them with handler names).
  Add the new governance endpoints.
- **`services/registry.json`**: the two new endpoints, and updated descriptions for ratify, nominate, GET, join
  and DELETE.
- **`docs/BUGS.md`**: BUG-102 → fixed with the PR reference. BUG-103 stays open, with a note on which statements
  this sprint corrected.
- **`tests/fixtures/reputation-disclosure-inventory.json`**: if the GET governance `sample_response` includes
  nominations, add the new fields and keep it key-clean.
- **Landing**: regenerate from source with `npm run generate-docs --workspace=apps/landing` and revert the
  timestamp, HEAD-sha, `dependencyGraph` and ADR-010 churn.

---

## Validation and acceptance

New workspace tests start in each changed workspace's `tests/tdd/`, are run red before implementation, and are
promoted individually (no promoter sweep). Real-PostgreSQL proof goes in root
`tests/integration/sprint-143-governance-lifecycle.integration.test.ts`, which CI discovers. Following Sprint
142's pattern, it exercises the shipped DB functions and the real routers through supertest.

Proofs required:

- **Migration.**
  - Backfills only v1 pending rows; legacy and resolved rows keep NULL.
  - New inserts get exactly `created_at + 30 days`, and a v1 row cannot be stored without `expires_at`.
  - The status CHECK accepts `declined`/`expired` and rejects junk.
  - Replay is idempotent.
  - The DB guard refuses a ballot and a `ratified` transition on an expired row, even with the protocol marker set.
  - A Sprint 142-shaped insert (no `expires_at`) still succeeds.
- **Withdraw / decline.**
  - Each works only for its party.
  - Refused for admins who are neither party, for an inactive caller, and for a foreign community (404, nothing written).
  - Ballots survive the close, and retries return 409.
  - A self-nomination can use either endpoint.
- **Expiry.**
  - GET hides expired rows.
  - Ratify, withdraw and decline on an expired row return 409, and the `expired` close **is committed**, with
    `resolved_at = expires_at`.
  - Creation reclaims the expired slot.
- **Concurrency** (two connections):
  - Decline vs. final ratification: exactly one wins, and there is no grant after a decline.
  - Withdraw vs. ratification.
  - Creation reclaiming a slot vs. a ratification on that same expired row: no deadlock, or else the explicit
    503.
- **Viewer mirror.** Every row of the viewer table above, including that a `nominee_ineligible` viewer's POST is
  in fact refused, and that a `count + 1 < R` ballot with an ineligible nominee is recorded.
- **BUG-102.**
  - A left member rejoins a public community as an active `member` (from a stored `admin` role), and a private
    one as pending.
  - The counter goes up by exactly 1 for an active rejoin, and the token is reissued.
  - `inactive` and rejected rows get 409 `MEMBERSHIP_RESTORE_REQUIRES_STAFF`.
  - Self-DELETE of an `inactive` row is refused and the row stays `inactive`.
  - Self-cancel of a pending row → `left`.
  - Admin DELETE of a pending row leaves the counter unchanged.
  - Two concurrent rejoins → one 200, one 409; two concurrent first joins → one 200, one 409 (no 500).
  - A rejoined original voter counts again.
  - Real-DB evidence records `current_user`, `rolsuper` and `rolbypassrls`.
- **UI.**
  - The real `GovernanceTab` mounts and shows Withdraw/Decline only for their party; payloads go to the right
    paths; the expiry date, the ineligible notice and the copy fix render; refresh follows success and error.
  - The Leave control appears for active members only, then confirms, calls DELETE self, persists the token,
    and shows the last-admin message.
  - The existing Sprint 113 no-NaN and Sprint 142 regression tests stay green, with fixtures updated in place.
- **No regression.** The full Sprint 142 integration suite still passes against the new schema.

Run the following before the PR:

- unit + regression;
- type checks for community-service and frontend;
- the four SDLC gates and process-reviewer once;
- `/pre-commit-check` once.

---

## Out of scope (recorded follow-ups)

- **BUG-103:** counter drift on the staff PUT and any existing demo drift.
- **Staff PUT validation:** the PUT accepts any `status`/`role` string.
- **Mobile:** the dead `POST /communities/:id/leave` route (mobile revival).
- **Cancelling a pending request from the web UI** (the API supports it after this sprint).
- **Notifications** for withdraw, decline or expiry (governance publishes no events today).
- **Rotation, revocation and delegation.**
- **Unauthorized operations:**
  - the demo platform-admin grant and its 200 smoke check;
  - demo data operations, including measuring demo `inactive` rows or counter drift;
  - the version bump and the merge slot;
  - new ADR numbers and the dependency lane.

---

## Critical implementation notes

1. **Lock order is nomination → membership everywhere.** Creation must close an expired slot *before* its
   membership locks. Members routes never lock nominations.
2. **Expiry uses the DB clock.** Use `expires_at <= now()` in SQL inside the transaction, never JS time. Write
   `resolved_at = expires_at` for an expired close.
3. **An expired close must commit before the 409.** `governanceTransaction` rolls back on any throw, so return a
   result and refuse after `COMMIT`.
4. **Migration order matters.** Run `ADD COLUMN` (no default), then `SET DEFAULT`, then backfill v1 rows, then
   the CHECKs. Adding the column *with* a volatile default stamps every historical row with now()+30d.
5. **One `DO` block.** No top-level `BEGIN`/`COMMIT`/`LOCK`; rerunnable with zero drift. `CREATE OR REPLACE` the
   guard function with the Sprint 142 body plus the expiry checks. Never drop the guards in the live DB.
6. **A self-DELETE of a non-active row must be refused.** Otherwise a removed member can convert `inactive` →
   `left` and rejoin.
7. **Rejoin always resets the role to `member`.** It never restores a stored role. Only the staff PUT
   reactivates `inactive` rows.
8. **Decrement `current_members` only for a row that was `active`.** Increment it only on an active rejoin, in
   the same transaction. Other drift is BUG-103.
9. **`can_ratify` must mirror the POST exactly**, including the `count + 1 ≥ R` ineligible case.
   `nominee_eligible` is a coarse boolean; no score or threshold leaves the API (ADR-082).
10. **Isolation comes from explicit predicates.** Use `community_id` predicates on every read and write and
    test them with a foreign community. CI's DB role bypasses RLS
    (`docs/gotchas/database-roles-bypass-rls-so-rls-is-not-an-isolation-proof.md`).
11. **Real-DB runs use a disposable container only.** They run on karmyq.com over SSH (decision 7) or in CI.
    Nothing touches the demo application DB. No platform grant, demo data operation, merge, deploy, version
    bump, dependency edit or new ADR number is authorized.
12. **`init.sql` and landing JSON are generated.** Regenerate them from source and revert unrelated churn.
