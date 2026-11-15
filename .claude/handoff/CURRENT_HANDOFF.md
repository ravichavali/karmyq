# Sprint 143 — Governance nomination lifecycle + member rejoin — Handoff

**Date**: 2026-11-15
**Outcome**: **planned; awaiting a non-author plan review, then execution.** The spec and plan are committed on
this branch. No product code has changed yet. Sprint 142 (PR #338, v11.115.0) is shipped and verified; its record
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
| **Active editor** | None until the plan review lands. Then the executing agent |
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
3. **If the non-author plan review has not happened yet, that comes first**: a read-only review of the spec and
   plan, with findings returned to the author (see *Next step*).
4. Open the plan: `docs/superpowers/plans/2026-11-15-sprint-143-governance-nomination-lifecycle.md`.
5. Invoke `superpowers:subagent-driven-development` directly (or `superpowers:executing-plans`, preferred in this
   shared working tree with one editor). There is no `/execute-plan` slash command; superpowers removed it as a
   deprecated stub.

**Next step**: a non-author plan review (Codex) → the author integrates the findings → Plan **Task 1** in a fresh
execution chat.

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

## ⚠️ Critical implementation notes (verbatim from the spec)

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
  is **UNVERIFIED**; the plan checks it before pushing.

## Facts found while planning (verified 2026-11-15 at `3e63ca9f`)

- Leave, admin kick and join-request rejection all write `status='inactive'` and keep the role
  (`services/community-service/src/routes/members.ts:524-537`; the frontend's reject and remove both call DELETE,
  `apps/frontend/src/components/community/tabs/ActiveTab.tsx:66,77`).
- Mobile's leave calls `POST /communities/:id/leave` (`apps/mobile/services/api.ts:64`). No such route exists. This
  is mobile-revival debt, out of scope.
- The curated demo already uses member status `'left'` (`services/simulation-service/src/fixtures/curatedDemo/types.ts:40`).
- **BUG-103 logged** (`docs/BUGS.md`): `current_members` drifts. DELETE decrements unconditionally, and the staff
  PUT never adjusts the counter. Sprint 143 corrects only the DELETE and rejoin statements.

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
