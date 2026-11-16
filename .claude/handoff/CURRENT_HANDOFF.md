# Sprint 143 — Governance nomination lifecycle + member rejoin — Handoff

**Date**: 2026-11-15
**Outcome**: **planned and review-clean; ready for execution.** Codex's plan review rounds 1 and 2 are
integrated. The spec and plan are committed on this branch. No product code has changed yet. Sprint 142 (PR #338, v11.115.0) is shipped and verified; its record
is [archived](archive/2026-11-15-sprint-142-governance-quorum-COMPLETE-v11.115.0.md).

**Sprint goal:** pending nominations close by nominator withdrawal, nominee decline or 30-day expiry, and members
who left can rejoin without a 500 and without regaining their old role.

> State between sessions only. Branch-local, so it reserves nothing; see `.claude/handoff/README.md` →
> *Parallel development rules* for how contended resources are allocated.

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-143-planning` (reused task branch) |
| **Base** | `origin/master` at `1692a560` (fetched 2026-11-15; no open PRs observed) |
| **Active editor** | The executing agent (next chat) |
| **Reviewer role** | A non-author (Codex) reviews the plan read-only; findings go back to the author to integrate. Reviewers do not co-edit |
| **Owned paths** | The plan's *File map* (community-service governance + members routes, one migration + regenerated `init.sql`, GovernanceTab, CommunityHero/community page, governance and leave/rejoin docs, CONTEXT/registry/BUGS) |
| **Shared resources** | **Allocated (2026-11-15):** SSH to karmyq.com for a *disposable* Postgres container only. **Not allocated:** merge slot, version bump, ADR numbers, dependency lane, any demo data operation, the demo platform-admin grant and its 200 smoke check |

## Links

- **Spec**: [docs/superpowers/specs/2026-11-15-sprint-143-governance-nomination-lifecycle-design.md](../../docs/superpowers/specs/2026-11-15-sprint-143-governance-nomination-lifecycle-design.md)
- **Plan**: [docs/superpowers/plans/2026-11-15-sprint-143-governance-nomination-lifecycle.md](../../docs/superpowers/plans/2026-11-15-sprint-143-governance-nomination-lifecycle.md)
- **Prior arc**: [Sprint 142 spec](../../docs/superpowers/specs/2026-11-12-sprint-142-governance-quorum-design.md),
  [ADR-055](../../docs/adr/ADR-055-trust-governance-architecture.md) (Implemented; this sprint adds a dated amendment, no new ADR)
- **PR**: none yet.

## Quick Start

1. Read this handoff.
2. Reuse the existing task branch `agent/claude/sprint-143-planning` (`git switch agent/claude/sprint-143-planning`).
   Then `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`; if master moved past `1692a560`,
   merge `origin/master` (merge commit, never rebase). Never branch off a stale local master.
3. **Both rounds of the non-author plan review are integrated** (see *Plan review log*). No further plan review
   is pending before Task 1.
4. Open the plan: `docs/superpowers/plans/2026-11-15-sprint-143-governance-nomination-lifecycle.md`.
5. Invoke `superpowers:subagent-driven-development` directly (or `superpowers:executing-plans`, preferred in this
   shared working tree with one editor). There is no `/execute-plan` slash command; superpowers removed it as a
   deprecated stub.

**Next step**: Plan **Task 1** in a fresh execution chat.

**This branch's first commit `3e63ca9f` is Sprint 142's post-merge record.** It must never reach master on its own
(no docs-only master push). It rides with this sprint's product PR, and the PR body says so.

## Multi-sprint arc

- **Sprint 142 (complete, v11.115.0):** proportional equal-vote ratification, frozen electorate, atomic grant.
- **Sprint 143 (this):** the nomination lifecycle (withdraw, decline, 30-day expiry) plus BUG-102 rejoin and a web
  Leave control.
- **Later (unplanned; maintainer decision):** rotation, revocation, delegation, opposition votes.

## Maintainer decisions (2026-11-15, planning chat)

1. **Withdrawal:** the nominator may withdraw and the nominee may decline a pending nomination. Admins get no
   close power (no incumbent veto).
2. **Expiry:** one fixed platform-wide 30-day window, recorded on each nomination at creation; no per-community
   policy editor.
3. **BUG-102:** distinguish a self-leave from an admin removal. A member who left rejoins like a new joiner (public →
   active, private → pending) with the role reset to `member`; a removed member gets 409 and only staff can
   reactivate.
4. **Ineligible nominee:** no departure hook in `members.ts`. The nomination stays pending, cannot finalize, expires
   on schedule, and GET shows voters a plain "nominee no longer eligible" state.
5. **Design approved as summarized:** withdraw/decline endpoints; lazy 30-day expiry via a DB-default `expires_at`;
   new `declined`/`expired` statuses; GET flags. A self-leave writes member status `left`, which can self-rejoin
   with the role reset to `member`; `inactive` (admin removal) stays staff-only; ADR-055 amendment, no new number.
6. **Rejected join applicants** are staff-only, like a removal (one rule, fail closed).
7. **Real-DB proof:** root `tests/integration/` in CI on the PR, **plus** the maintainer re-authorized SSH to
   karmyq.com for a disposable Postgres container (never the demo application DB), as in Sprint 142.
8. **Scope expansion approved: a web "Leave community" control.** The web app had none
   (`communityService.leaveCommunity`, `apps/frontend/src/lib/api.ts:263`, has no callers), so without it the
   self-leave → rejoin path was API-only. Self-leave also reissues the JWT, as join does.

**Design details the author added; the reviewer should check them hardest.** These are proposals inside the
approved design, not separate maintainer decisions:
- The DB guard function also refuses ballots and a `ratified` transition on an expired nomination, so a rolled-back
  binary fails closed.
- `can_ratify` mirrors the POST exactly, including the `count + 1 ≥ R` ineligible case.
- A self-DELETE of a non-active row is refused, which closes the removed-member `inactive` → `left` loophole.
- DELETE decrements `current_members` only for an active row (the BUG-103 statements this sprint already edits).
- A concurrent first-join 23505 maps to 409.
- DELETE locks its target and every active admin in one `user_id`-ordered statement (review round 1, finding 7).

## Plan review log

**Round 1: Codex, read-only, at `246f958a` (2026-11-15).** Eight findings. The author verified each against
source, and all eight held. They are integrated in the commit after `246f958a`:

| # | Finding | Verdict and evidence | Where it landed |
|---|---|---|---|
| 1 | The backfill DDL covers every v1 row, but the acceptance text said resolved rows keep NULL | CONFIRMED: the CHECK requires expiry on every v1 row | Spec DDL comment and acceptance; plan Task 9; note 4 |
| 2 | Replay fixtures seed NULL-expiry v1 rows that the CHECK rejects; moving only `expires_at` into the past breaks `expires_at > created_at` | CONFIRMED | Plan Task 9 restores the pre-Sprint-143 shape inside the rollback transaction; Task 4 moves both timestamps |
| 3 | Postgres alone cannot run the whole integration tier, and Task 4's teardown contradicted Tasks 5–9 | CONFIRMED (`auth-flow.integration.test.ts:48`; `ci.yml:296-306`, `:340`) | Focused Sprint 142/143 runs locally, the whole tier in CI; one container for Tasks 4–9; note 11 |
| 4 | `can_ratify: false` does not always mean a refused POST: an already-voted viewer gets the idempotent 200 | CONFIRMED (`governanceDb.ts:274-275`; Sprint 142 test `:296-297`) | Spec acceptance; plan Task 5 asserts no new ballot or finalization; note 9 |
| 5 | The `nominee_eligible` instructions omitted the active-membership and `canElevateRole` predicates | CONFIRMED (`governanceDb.ts:283-292`) | Spec definition; plan Task 5; note 9 |
| 6 | Sprint 142's exact-equality assertions break on the new fields | CONFIRMED (`:207`, `:219`, `:313`, `:452`, `:458`; `:343` and `:447` use `toMatchObject` and survive) | Plan file map; Tasks 4 and 5 extend them with exact values |
| 7 | DELETE locking target-then-admins can deadlock two admins who leave at once | CONFIRMED by tracing the lock sequence (`members.ts:492-518`), not yet run against a DB; plan Task 6 adds the race | One `user_id`-ordered lock statement (spec lock-order section, plan Task 6); note 1 |
| 8 | The Sprint 120 sentinel test is not regeneration proof | CONFIRMED (`sprint-120-init-sql-drift-gate.test.ts:8-32`) | Plan Task 1 names the drift check and byte comparison; Tasks 13 and 14 track them; note 12 |

**Round 2: Codex, read-only, at `6f8c7bf1` (2026-11-15).** No new blocking defects. The four requested checks
held: the ordered DELETE lock, the Task 9 shape restore, the focused command and the `init.sql` evidence chain.
Two clarifications, both CONFIRMED, are integrated in the commit after `6f8c7bf1`:

| # | Clarification | Evidence | Where it landed |
|---|---|---|---|
| R2-1 | The combined DELETE lock result always contains the target, so the last-admin guard must filter to active admins | `members.ts:513-520` counts a result that holds active admins only | Spec lock-order step 2 and acceptance; plan Task 6 (the filter, plus a no-active-admin leave case) |
| R2-2 | The `DATABASE_URL`-only claim is verified for the Sprint 142 file but only planned for the Sprint 143 file, and the scratch-DB case needs `CREATE DATABASE` | `sprint-142-governance-quorum.integration.test.ts:15`, `:117`; `tests/integration/setup.ts:46-48` | Plan Task 4; handoff facts. Plan Task 9 also issues `ROLLBACK` in `finally` (`:83-86`) |

## ⚠️ Critical implementation notes (verbatim from the spec)

1. **Lock order is nomination → membership everywhere.** Creation must close an expired slot *before* its
   membership locks. Members routes never lock nominations. Every multi-row membership lock is one statement
   ordered by `user_id`, as creation's and ratification's already are; DELETE locks its target and every active
   admin that way.
2. **Expiry uses the DB clock.** Use `expires_at <= now()` in SQL inside the transaction, never JS time. Write
   `resolved_at = expires_at` for an expired close.
3. **An expired close must commit before the 409.** `governanceTransaction` rolls back on any throw, so return a
   result and refuse after `COMMIT`.
4. **Migration order matters.** Run `ADD COLUMN` (no default), then `SET DEFAULT`, then backfill **every** v1 row
   (pending and resolved, since the CHECK requires it), then the CHECKs. Legacy rows (NULL policy version) keep
   NULL. Adding the column *with* a volatile default stamps every historical row with now()+30d.
5. **One `DO` block.** No top-level `BEGIN`/`COMMIT`/`LOCK`; rerunnable with zero drift. `CREATE OR REPLACE` the
   guard function with the Sprint 142 body plus the expiry checks. Never drop the guards in the live DB.
6. **A self-DELETE of a non-active row must be refused.** Otherwise a removed member can convert `inactive` →
   `left` and rejoin.
7. **Rejoin always resets the role to `member`.** It never restores a stored role. Only the staff PUT
   reactivates `inactive` rows.
8. **Decrement `current_members` only for a row that was `active`.** Increment it only on an active rejoin, in
   the same transaction. Other drift is BUG-103.
9. **`can_ratify` must mirror the POST exactly**, including the `count + 1 ≥ R` ineligible case. `false` means
   the POST changes nothing: it is refused, or, for an already-voted viewer, it is Sprint 142's idempotent 200
   with no new ballot. `nominee_eligible` needs all three finalization predicates (active membership,
   `canElevateRole`, trust threshold). It is a coarse boolean; no score or threshold leaves the API (ADR-082).
10. **Isolation comes from explicit predicates.** Use `community_id` predicates on every read and write and
    test them with a foreign community. CI's DB role bypasses RLS
    (`docs/gotchas/database-roles-bypass-rls-so-rls-is-not-an-isolation-proof.md`).
11. **Real-DB runs use a disposable container only.** They run on karmyq.com over SSH (decision 7) or in CI.
    The container runs only the DB-backed Sprint 142/143 files; the whole tier also needs the services and
    Redis, so CI proves it. Nothing touches the demo application DB. No platform grant, demo data operation, merge, deploy, version
    bump, dependency edit or new ADR number is authorized.
12. **`init.sql` and landing JSON are generated.** Regenerate them from source and revert unrelated churn. The
    Sprint 120 sentinel test cannot prove a regeneration; the PR's `regenerate-init-sql.yml` run (drift check
    plus the independent-base byte comparison) does.

## Blockers and pending authorizations

- **Pending authorization — the demo platform-admin grant (ADR-105 §6).** Rollout is fail-closed: until the grant,
  nobody on the demo can edit request-type schemas or trust questions, or run the provider-trust backfill.
  - The maintainer chooses the account, never a simulation persona with shared credentials.
  - It runs as DB user `karmyq_prod`, with explicit per-operation authorization, and is repeated after every curated
    demo reset.
  - Then finish the smoke test: the granted account gets 200 on `GET /api/admin/schemas`, and
    `GET /api/users/me/platform-role` returns `platformAdmin: true` for it.
- **Version and merge slot unallocated.** Both block merge readiness, not execution.
- **Init.sql regeneration route** (plan Task 1): workflow dispatch, valid while the branch's `init.sql` equals
  master's, or the authorized disposable container. Whether the pre-push drift gate blocks a migration-only push
  is **UNVERIFIED**; the plan checks it before pushing. Neither route's artifact is proof by itself; the proof is
  the PR's `regenerate-init-sql.yml` drift check and byte comparison (plan Task 1).

## Facts found while planning (verified 2026-11-15 at `3e63ca9f`)

- Leave, admin kick and join-request rejection all write `status='inactive'` and keep the role
  (`services/community-service/src/routes/members.ts:524-537`; the frontend's reject and remove both call DELETE,
  `apps/frontend/src/components/community/tabs/ActiveTab.tsx:66,77`).
- Mobile's leave calls `POST /communities/:id/leave` (`apps/mobile/services/api.ts:64`). No such route exists. This
  is mobile-revival debt, out of scope.
- The curated demo already uses member status `'left'` (`services/simulation-service/src/fixtures/curatedDemo/types.ts:40`).
- **BUG-103 logged** (`docs/BUGS.md`): `current_members` drifts. DELETE decrements unconditionally, and the staff
  PUT never adjusts the counter. Sprint 143 corrects only the DELETE and rejoin statements.
- Verified while integrating review round 1 (at `246f958a`):
  - The nominations guard trigger fires only on `INSERT OR UPDATE OF status`
    (`infrastructure/postgres/migrations/20261112-governance-quorum.sql:61-63`), so the `expires_at` backfill
    and the timestamp-moving fixtures need no protocol marker.
  - Creation and ratification already lock memberships in one `user_id`-ordered statement
    (`services/community-service/src/database/governanceDb.ts:212-213`, `:266-270`); DELETE was the outlier.
  - Verified: the Sprint 142 integration file needs only `DATABASE_URL` supplied
    (`services/community-service/src/database/db.ts:9-14`; publisher mocked at its `:15`; `JWT_SECRET` defaulted
    by `tests/integration/setup.ts:46-48`). Its scratch-DB case (`:117`) also needs a role that may
    `CREATE DATABASE`.
  - Planned, PLAUSIBLE until the file exists: the Sprint 143 file has the same needs only if it follows that
    pattern (plan Task 4).
  - DELETE's 500 body returns the raw `error.message` (`members.ts:563-567`) instead of an ADR-074 code, as do
    other handlers in the file (`:67`, `:321`, `:451`). This is out of scope; it is flagged for Task 12's
    `/security-review`, which decides whether the rewritten DELETE carries the fix.

## Sprint 142 follow-ups (out of scope unless a plan names them)

- **Deferred Minor — now IN Sprint 143 scope:** the `not_in_electorate` copy fix.
- **BUG-102 — now IN Sprint 143 scope.**
- **Governance policy gaps.** Withdrawal and expiry are now **in Sprint 143 scope**. Rotation, revocation and
  delegation remain absent. Persona-heavy demo communities may never reach quorum, because simulation governance
  stays disabled (ADR-103).
- **Unmeasured:** how many legacy pending nominations the Sprint 142 migration withdrew on the demo. Measuring it
  needs a demo DB read, which is not authorized.
- **RLS reality vs CLAUDE.md:** `docs/gotchas/database-roles-bypass-rls-so-rls-is-not-an-isolation-proof.md`
  records that the CI role (and the default service role) bypasses RLS, and that `dbContextMiddleware` sets
  transaction-local context on a separate pooled query. CLAUDE.md → *Database* still says a query that skips
  `setDbContext` "sees nothing". Correcting the global rule is a maintainer decision; the live demo role's flags are
  UNVERIFIED.

## Deferred minors (from Sprint 141's gates; detail in the PR #337 body)

- A second `GET /users/me/platform-role` from `CommunityConfigEditor` on the Profile tab, including in read-only
  mode.
- The 401 bodies in `requirePlatformAdmin` and the trust-question gate lack an ADR-074 `error` code (the
  pre-existing `verifyToken` shape, `483ae889`).
- If the platform-admin lookup throws, the trust-question router gate's error reaches the app-level handler: still a
  logged 500, but without the route-tagged message.
- `requirePlatformAdmin` / `requireAnyCommunityAdmin` could share a factory.
- No test pins `platformRoleService.get` to `/users/me/platform-role`. A wrong path would fail closed.
- ADR-102:47 and ADR-032:415 still use the pre-Sprint-141 names. They are dated records.

## Carried follow-ups (out of scope unless a plan names them)

- **From Sprint 143 planning:**
  - the staff member PUT writes `status`/`role` without an allowlist (`members.ts:328-454`);
  - no web control to cancel one's own pending join request (the API supports it after Sprint 143);
  - no notifications for withdraw, decline or expiry.
- **From Sprint 141:** `tests/e2e/admin/schema-management.spec.ts` (not in CI) needs a platform-admin fixture;
  `apps/frontend/tests/tdd/SchemaManagerNav.test.tsx` asserts a creator sees the link (inline stub, spec-deferred;
  retiring it needs maintainer approval); two IDEAS entries (2026-11-12): community-owned custom request types and
  folding the founding-circle reviewer allowlist into `auth.platform_admins`.
- **CodeQL:** read open master alerts after every merge; don't predict them from the diff (Sprint 141 datapoint
  #632). Sprint 142's master analysis re-raised nothing (observed 2026-11-15).
- **ADR-103 is still Proposed.** It needs the maintainer-run deploy-time demo check
  (`docs/adr/ADR-103-authenticated-listings-and-simulation-containment.md:85-87`), then a flip on a product branch.
- **The landing docs test dirties the tree on a Turbo cache miss.** It needs an output-dir option in
  `scripts/generate-docs.ts`. On this box `architecture.json`'s `dependencyGraph` field also churns (it mirrors the
  untracked, locally generated `services/dependency-graph.md`). The committed `build.json` stays frozen at
  `a8e78603` because every record restores it as churn; whether the deployed landing shows those values is
  UNVERIFIED.
- No relocation pointer gate for the root `claude.md` `→ *Heading*` pointers.
- The landing **prebuild** claim is UNVERIFIED (`apps/claude.md:46,49,53`, `scripts/claude.md:54`, the
  landing-docs gotcha). It never runs under `ignore-scripts`.
- The migration-validator schema list is stale (`.claude/agents/migration-validator.md:12-24`).
- BUG-101 (dead Edit/Write hook handlers), `docs/BUGS.md`.
- #335 item 6, the remaining half: session/service deduplication of the context reminder.
- Sprint 140 PR B: unplanned and decision-gated (required-CI integration execution, the per-suite WIP ledger,
  including `admin-schemas-api`).
- Expo SDK drift: #329 open; re-check deepmerge alert #178 at the next Expo SDK move or by **2026-12-01**.
- **Later product candidates:** the exchange back-out control (IDEAS 2026-10-29) and the mobile revival (it now also
  inherits mobile's dead `POST /communities/:id/leave`).
- **Git Bash trap:** a `node` argument starting with `//` is rewritten by MSYS path conversion, and so is
  `git show <rev>:<path>`. Export `MSYS_NO_PATHCONV=1`, or put replacements in a script file.

## Verification references

- **Sprint 142 deploy:** master CI/CD run [43734484275](https://github.com/ravichavali/karmyq/actions/runs/43734484275)
  attempt 1, `success`, 14/14 jobs including Deploy to Demo; 9/9 services healthy, no rollback (observed
  2026-11-15). Smoke-test detail is in the archive.
- Security state observed 2026-11-15 after the merge: 0 open code-scanning alerts on master.
- Planning commit: docs only (spec, plan, handoff, BUG-103). See its commit message for the root-gate result.

⚠️ GitHub status goes stale. Re-derive PR and deploy state before trusting anything above.
