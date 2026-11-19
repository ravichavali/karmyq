# ADR-106: Database-Owned Community Member Count

**Date**: 2026-11-19
**Status**: Accepted (Sprint 144; becomes Implemented when the migration is deployed)
**Sprint**: 144 (BUG-103, with BUG-104 and BUG-105 on the same staff-write surface)
**Deciders**: Maintainer (trigger ownership, the column guard, the recount write and this ADR number, allocated
2026-11-19); Claude (implementation)
**Related**: [ADR-102](ADR-102-live-membership-authorization.md) (authorization reads live membership),
[ADR-062](ADR-062-community-identity-idempotent-creation.md) (the duplicate-create join),
[ADR-018](ADR-018-community-splitting-mechanics.md) (fission/fusion), [ADR-087](ADR-087-one-seed-path-init-sql-regeneration.md)
(init.sql is generated), BUG-103, BUG-106

## Context

`communities.communities.current_members` is a cache of the number of active `communities.members` rows. People see
it: the community hero shows "N neighbours · room for M more" and disables Join when the community is full. Join
also reads it as the capacity check.

Five code paths in two services adjusted it by hand:

- join (`+1`);
- staff direct-add (`+1`);
- DELETE (`−1`);
- the duplicate-create join (`+1`);
- social-graph's invitation accept (`+1`, even when its `ON CONFLICT DO NOTHING` insert was a no-op).

Staff approval (`PUT … {status:'active'}`) never counted at all (BUG-103). Two migrations had already recounted
the column (Sprint 86, Sprint 97), and the drift kept coming back because every writer had to remember the
arithmetic.

Capacity was not atomic either. Join read the count outside the transaction that wrote the member row, so two
concurrent joins could both pass, and approval ignored capacity entirely. Community-service's CONTEXT claimed that
capacity "cannot be bypassed in code (database constraint)". No such constraint existed.

## Decision

**The database owns the column. Application code never writes it.**

### 1. A sync trigger is the only writer

`communities.sync_current_members()` runs on `communities.members`:

- `AFTER INSERT OR DELETE`;
- `AFTER UPDATE OF status, community_id`, with a `WHEN` clause that skips a row whose status and community did not
  change. A role-only update (a governance grant, a staff role change) does not fire it.

It applies the row's active-delta, `(NEW is active ? +1 : 0) − (OLD is active ? 1 : 0)`, to that row's one
community. A `NULL` status is not active. It never clamps: a negative count would expose a bug instead of hiding it.

**Membership rows never move between communities.** The function raises `check_violation` on a `community_id`
change. No writer does that today (fission and fusion insert new rows), so every firing touches at most one
community row and no two-community lock order exists.

### 2. A column guard ignores every other write

`communities.guard_current_members()` is a `BEFORE INSERT OR UPDATE OF current_members` trigger on
`communities.communities`:

- on INSERT, it forces `NEW.current_members := 0`, which is always true for a community with no member rows yet;
- on UPDATE, it keeps `OLD.current_members` unless the transaction-local setting `karmyq.member_count_sync` is `'on'`.

The guard exists because of the deploy window. `scripts/deploy.sh` applies migrations (`:154`) before it restarts
the services (`:225`), and a failed image build (`:208-219`) or a rollback leaves old binaries serving with the
trigger installed. Without the guard, an old join would do the trigger's `+1` and its own `+1`. With it, every old
`±1` is a no-op and the count stays exact whichever binaries are running.

### 3. Flag discipline

The sync function and the recount function set `karmyq.member_count_sync` to `'on'` only around their own
`UPDATE`, and restore the prior value before returning. Leaving it on would let a later application write in the
same transaction (old join code's `+1` after its member INSERT) through the guard. A real-database test proves that
write is ignored.

### 4. Recount, and the only repair path

`communities.recount_current_members(p_community_id uuid DEFAULT NULL)` takes `SHARE ROW EXCLUSIVE` on
`communities.members`, which fences member writers for the rest of the caller's transaction. It then sets every
drifted count, or the named community's count, to its active-row count, and returns the number of rows it changed.
The migration runs it once. This is the third repair and the one authorized demo write; a rerun changes no row.
Operators repair only through this function. A direct `UPDATE` of the column is ignored by the guard.

### 5. Capacity is re-checked after the write

`services/community-service/src/database/memberCapacity.ts` exports `assertWithinCapacity(q, communityId)`. Every
admitting path runs it **after** its member write, on the same `withTransaction` client:

- join to `active` (including a `left` rejoin);
- staff add;
- staff PUT approve;
- the duplicate-create join.

It throws `CommunityFullError` when `current_members > max_members`, so `withTransaction` rolls the member write
and the trigger's increment back together, and the route answers 400 `COMMUNITY_FULL`. No new lock is needed. The
trigger's `UPDATE` holds the community row lock until commit, so concurrent admitters serialize on it, and under
READ COMMITTED the second one re-reads the first one's committed count. Lock order stays member row(s) → that one
community row everywhere. The pre-write "is it full?" read stays as a friendly early refusal; the post-check is
authoritative.

### The migration

`infrastructure/postgres/migrations/20261119-community-member-count-trigger.sql` has no top-level
`BEGIN`/`COMMIT`/`LOCK`, because the two appliers disagree on transaction wrapping. The functions are top-level
`CREATE OR REPLACE`. Trigger installation and the recount are one `DO` block that sets `lock_timeout` to 10 s and
takes `ACCESS EXCLUSIVE` on members, then communities, up front. Taking the weaker lock first and upgrading for
`DROP TRIGGER` would deadlock against an old-binary DELETE or PUT that holds `FOR UPDATE` row locks and then asks
for `ROW EXCLUSIVE` (found by the migration-validator review). A busy table fails the migration, and the deploy
rolls back, instead of stalling it.

## Alternatives rejected

- **Fix each writer in the application.** That was tried twice (Sprints 86 and 97). Five writers in two services,
  plus every future one and every old binary, would each have to stay correct.
- **Capacity inside the trigger.** It would make fusion fail where it succeeds today (`fusionService.ts` has no
  capacity check, so a merged community can exceed `max_members`). That is a behavior change nobody decided.
- **Reorder `deploy.sh`** to restart before migrating. It only shrinks the window. A failed build and a rollback
  still leave old code with new schema.
- **Accept the window.** The count is user-visible and gates Join. A week of double counting after a failed build
  is a real bug.
- **A CHECK constraint** (`current_members <= max_members`). It does not keep the count true, it fails fusion, and
  a drifted count would turn into errors on unrelated writes.

## Consequences

- **Fixtures cannot set counts.** A test that needs a count, or a full community, creates the active rows or lowers
  `max_members`. The one deliberate corruption (the Sprint 134 L2 health test, which proves that health metrics read
  live rows rather than the cache) writes through the flag on one client in one transaction.
- **Operators repair only through `communities.recount_current_members()`.** Measuring demo drift
  (`scripts/audit-demo-data.sql` query 1) is a separate, authorized read.
- **Fission and fusion keep their recompute statements** (D7). They do not set the flag, so the guard turns them
  into no-ops; the trigger has already produced the same value. Removing them, and their two regression tests, is
  deferred.
- **The flag is a correctness fence, not a privilege boundary.** Any session that can run SQL can set it, and that
  session could already write any column.
- **The triggers run as the invoking role** (no `SECURITY DEFINER`). That is the same exposure as the application
  `UPDATE` they replace, and every service shares one database role. If a future role is subject to RLS on
  `communities.communities`, the `community_isolation` policy could silently filter the trigger's `UPDATE` and leave a
  count stale; such a role needs a policy that admits the sync, or the function needs a reviewed `SECURITY DEFINER`.
- **Staff direct-add stays a documented consent exception** (decision 10). It still activates a user directly and is
  admin-only and API-only. The consent gap is BUG-107.
- **BUG-106 is out of scope.** Invitation accept loses only its manual increment. It still ignores capacity and
  silently no-ops on an existing row.
- **A static gate** (`tests/regression/sprint-144-no-member-count-deltas.test.ts`) keeps self-referential
  arithmetic on the column out of `services/*/src`, `apps/*/src` and `packages/*/src`. With the guard such arithmetic
  would already be a no-op, so the gate is hygiene: it stops dead code from misleading the next reader.

## The rule

**Never write `communities.communities.current_members`.** Insert, update or delete `communities.members` rows; the
database counts them. Read the count for display and for the early refusal, and run `assertWithinCapacity` after any
write that admits someone.
