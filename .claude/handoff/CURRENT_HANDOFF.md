# Sprint 144 — Staff membership write integrity — Handoff

**Date**: 2026-11-19
**Outcome**: **IMPLEMENTED; PR opening.** Tasks 1–13 of the plan are done on `agent/claude/sprint-144-planning`. The
validated implementation SHA is `91f1ada0`, the head before this handoff commit. The PR is opened from this
branch as the execution chat's last action. **Next: Task 14 (next chat)**: read the PR's real CI, fix forward, then
merge and deploy, each only on explicit maintainer authorization.

> State between sessions only. This branch-local file reserves no contended resource; see
> `.claude/handoff/README.md` → *Parallel development rules*.

## Ownership and live base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-144-planning` (planning + execution), pushed with upstream |
| **Base** | `origin/master` `a2746057` (Sprint 143 #340, v11.116.0), unchanged through execution (re-fetched 2026-11-19) |
| **PR** | opening from this branch; resolve the real number and head with `gh pr list --head agent/claude/sprint-144-planning` |
| **Spec** | `docs/superpowers/specs/2026-11-19-sprint-144-staff-write-integrity-design.md` (decisions 1–11, D1–D8, notes 1–14) |
| **Plan** | `docs/superpowers/plans/2026-11-19-sprint-144-staff-write-integrity.md` (Task 14 is next) |
| **Ledger** | `.superpowers/sdd/2026-11-19-sprint-144-staff-write-integrity/progress.md` (git-ignored, Windows box only; its essentials are copied below) |
| **Release** | provisional v11.117.0; the maintainer allocates the version and merge slot at merge time |
| **Dependency lane** | Claude (maintainer-designated); `next` 16.4.6 is the first commit (`2dd9f214`) |

Never rebase this branch.

## Quick Start (next chat = Task 14)

1. `git switch agent/claude/sprint-144-planning && git fetch origin && git log --oneline origin/master -3`. If master
   moved past `a2746057`, merge it with a merge commit (never rebase). Re-run the root gates afterwards.
2. `gh pr list --head agent/claude/sprint-144-planning --json number,headRefOid,state`. Then read the PR's **real**
   CI. `gh pr checks` alone is not evidence (`feedback_checks_list_hides_uncreated_jobs`). Check the run conclusion,
   the job count, and these jobs' own logs:
   - **Integration Tests**: suite/test counts. This is the first run of every services/Redis suite under the column
     guard (decision 11). The S126 backfill/schema, rls-policies and S134-L2 suites also run here first; they are
     DB-only but too slow over the SSH tunnel.
   - **Code Scanning Gate** + the analysis's check-run annotations.
   - **Regenerate and verify init.sql**: the byte comparison against the base.
3. Fix forward any red with `review-response`. Note 2's fixture rules apply: create rows or lower `max_members`, and
   never set a count. Update the PR's Validation ledger and this handoff.
4. List CodeQL annotations for the maintainer to dismiss in the UI (expected: `js/missing-rate-limiting` on the
   touched route lines in `members.ts`/`communities.ts` → `false positive`; test migration-reads → `used in tests`).
   Never dismiss them yourself.
5. Only on explicit maintainer authorization: version + merge slot (re-derive the bump from `origin/master`), merge
   (`--admin` needs its own yes), deploy watch, smoke, post-merge record on the NEXT branch (plan Task 14).

## What shipped on the branch (commits on `a2746057`)

| Commit | What |
|---|---|
| `2dd9f214` | **First commit:** `next` 16.4.6 lock splice for GHSA-mfr8-8qww-v76h / GHSA-vc7v-qv4w-wrv8 (Dependabot #185/#186); it also covers **#187** GHSA-vvgp-ww4w-46vf (opened 2026-11-19T23:59Z, `>=16.4.0 <=16.4.4`), confirmed by a fresh `npm audit` (total 0) on the branch |
| `a198b3a4` | `canonicalUuid` + DELETE/staff-POST canonical ids; note-3(a) UUID fixtures (sprint-92/93/132) |
| `f26507f4` | Pure staff transition table `planStaffChange` |
| `f6c29023`, `efa3deff` | Migration `20261119-community-member-count-trigger.sql` (sync trigger, column guard, recount; ADR-106) + workflow-regenerated `init.sql` |
| `d11ff8e1` | All five `±1` writers removed; atomic capacity post-check; fixtures; root delta gate (BUG-103) |
| `6a1ebb4e` | Staff PUT as the transition table (BUG-104, BUG-105, decision 8); Sprint 142 restoration cases rewritten |
| `35cea82c` | Web: Reject via PUT, Cancel request; join message now "Ask a community admin to lift the block; then you can rejoin" |
| `bb2b096b`, `6644453f` | ADR-106, guides, landing docs; CONTEXT, registry, BUGS; tdd → regression promotion |
| `32ba5b91`, `5dad8d8d`, `91f1ada0` | `/simplify`, `/code-review` and process-review fixes |

## Evidence (ledger summary)

- **Disposable PostgreSQL** (decision 9): container `karmyq-s144-disposable` (`postgres:15-alpine`) on the demo
  host.
  - Isolation: bound to 127.0.0.1:55432 on the default bridge, no volume except the branch `init.sql`, no demo
    database access. Reached over an SSH tunnel.
  - Role flags: `karmyq_test` **rolsuper=t, rolbypassrls=t**, so explicit community predicates provide isolation.
  - Teardown: the container, the host scratch and the tunnel were removed after the final runs (verified: 0 s144 containers remain, port 55432 refuses connections); no demo database was read or written.
- **Splice:**
  - strict `npx npm@11.19.0 ci` exit 0, "found 0 vulnerabilities";
  - `npm ls --all` problem list identical to master's (180 lines, version-normalized);
  - ADR-059 gate 0 high/critical; both GHSAs absent;
  - lint-config + workspace-declarations gates 15/15.
- **Migration, deploy applier:** `apply-migrations.sh` applied exactly one migration, including a rerun over existing
  objects.
- **Migration, CI applier:** `ci-apply-full-schema.sh --drift-check` showed zero drift on two isolated DBs, one of
  which took the CI autocommit path first with 0 ERROR lines.
- **Migration, review:** migration-validator found 0 BLOCKING. Its SHOULD-FIX (lock upgrade deadlock) is fixed:
  ACCESS EXCLUSIVE is taken up front, members then communities.
- **`init.sql` regeneration:**
  - workflow run 44620603831; artifact hash `d640dd5b` == committed blob;
  - the precondition held (branch `init.sql` == master's `f711ff94`);
  - fresh boot: 3 triggers, 0 communities, 0 drifted.
- **Red before green:** every new-behavior case was red first. Baselines were recorded as expected-green (note 11).
  Real-DB races are forced with row-lock barriers and exact waiter counts:
  - two joins into the last slot;
  - two staff adds into the last slot;
  - two approves into the last slot;
  - a PUT demotion committing during a moderator approve → 403;
  - a demotion committing during an admin DELETE → 403.
- **Final local suites (in-process DB):** S142 + S143 + S144 3 suites / 134 tests at `5dad8d8d`; S144 52/52 at
  `91f1ada0`.
- **Final unit + regression:**
  - community-service 9 + 32/525;
  - social-graph 12 + 26/184;
  - frontend 62 + 66/643;
  - root 101 + 50/1098;
  - `/pre-commit-check` run 1 on clean 91f1ada0 (cold Turbo, 18/27 cached) was red on @karmyq/tests#test with the suite unnamed (the script deletes its log); the same commit then passed standalone (root 101 + 1098), in a full warm npm test (27/27) and in run 2 (exit 0, tree clean). Treated as a load-dependent flake; PR CI is the arbiter.
- **Type-checks:** community-service, social-graph and frontend `tsc` all clean.
- **Not run locally** (decision 11): every services/Redis integration suite, plus S126 ×2, rls-policies and S134-L2
  (the S134-L2 fixture change gets its first real run in CI).

## Quality gates (Task 12)

- **`/simplify`** (4 reviewers): shared `lockTargetAndAdmins`, `getLiveRole(…, q)`, one `COMMUNITY_FULL_MESSAGE`,
  `TxQuery`, `isUuid`, `ROLES` reuse. Skips are recorded in the ledger.
- **`/code-review` high:** 10 candidates. 3 Important were fixed red → green:
  - DELETE re-reads the live role after its lock;
  - the PUT refuses non-staff with no lock;
  - `getLiveRole` is used for the early checks.
  The 7 minors are deferred (below).
- **`/security-review`:** no findings.
- **process-reviewer:** 1 BLOCKING (an evidence gap, resolved). 4 SHOULD-FIX fixed: the moderator outcomes docs, the
  guide claim, a test title, and the delta-gate scope (now whole workspace roots, proven able to fail outside
  `src/`). 3 NITs fixed.

## Rulings made during execution (each a deliberate deviation; cost if wrong)

1. **Moderator outcomes.**
   - The spec's table lists `inactive → active` as 409 for every caller. Decision 4 instead gives moderators 403 for
     any transition other than approve/reject, and Task 7's BUG-105 case requires 403. A `left` row and a same-state
     retry are still 409 for every caller and are checked first.
   - Cost if wrong: a moderator sees 403 instead of 409 on requests no screen sends.
2. **Validation before the caller check.** A malformed body or id is 400 before the caller check. A non-staff caller
   with a malformed body therefore gets 400, not 403 (spec: "400 before SQL").
3. **`planStaffChange` returns 404 `NOT_FOUND` for a null target.** The plan's shape omitted it.
4. **Unrecognized stored statuses** (NULL, `invited`, `removed`) refuse every staff change (fail-closed).
5. **Staff POST errors** use ADR-074 codes: NOT_FOUND, COMMUNITY_INACTIVE, COMMUNITY_FULL, ALREADY_MEMBER (including
   the 23505 race), INTERNAL_ERROR. The status codes are unchanged.
6. **The join's `MEMBERSHIP_RESTORE_REQUIRES_STAFF` message changed.** The old "Only community staff can restore
   this membership" became false under decision 8, and the page alerts it verbatim. The code is unchanged.
7. **The migration's lock** is ACCESS EXCLUSIVE up front on members, then communities (validator SHOULD-FIX). The
   spec's SQL had SHARE ROW EXCLUSIVE followed by an upgrade.
8. **The PUT reads the caller's role after the existing lock without adding the caller to the lock set.** Every staff
   demotion or removal locks the same admin rows. A lock-free early refusal runs before it (code review #3).
9. **`communities.ts:526`** now reads `rowCount ?? 0`. It was the only strict-mode error, surfaced by the first root
   test that imports this router.
10. **`assertWithinCapacity` returns the capacity row**, so the duplicate-create join can report the count.
11. **The delta gate scans whole workspace roots**, not just the spec's `src/` (process review #5).
12. **`updateMember`'s type** is `{ role } | { status }`.
13. **No ledger-only commits.** The ledger is git-ignored; this handoff and the PR body carry its essentials.
14. **`/code-review` high served as the whole-branch final review** (executing-plans).
15. **The in-process container set is S142/S143/S144.** The other DB-only suites go to PR CI.

## Task 2 inventories (from the git-ignored ledger)

- **Delta writers (exactly the spec's five, now removed):**
  - `members.ts`: join, staff add, DELETE;
  - `communities.ts`: the duplicate-create join (SQL plus JS arithmetic);
  - social-graph `invitations.ts`.
- **Writers that stay:** the converging recomputes in `fissionService.ts:289` and `fusionService.ts:96` (D7, guarded
  no-ops) and the archived seeders (excluded).
- **Fixtures:**
  - `tests/fixtures/*.sql` and the generators never set counts. They relied on the default 0, so their counts are
    now correct, and their TRUNCATEs are paired.
  - `init.sql`'s spliced seed has no communities.
- **UUID comparisons:** the only fail-open authorization site was `members.ts` PUT (BUG-104). DELETE was fail-closed.
  Governance, links, fusions and splits are fail-closed or DB-checked, so no new site joined the scope.
- **Callers:**
  - mobile reads the count only; its separate `POST /communities/:id/leave` stays revival debt;
  - simulation reads only;
  - `packages/shared/api/client.ts` `updateCommunityMember(…, { role?, status?, admin_user_id })` has **zero
    callers**. It is dead, and sending both keys would now be a 400.

## Deferred / follow-ups

- **Open bugs:**
  - BUG-106: invitation accept ignores capacity and silently no-ops on an existing row.
  - BUG-107: staff direct-add has no consent step (decision 10).
  - **BUG-108 (new)**: the duplicate-create join answers `joined: true` for a non-active existing row. This is
    pre-existing ADR-062 behavior; nobody is admitted.
- **Deferred code-review minors:**
  - **#2:** a multi-row member statement spanning communities (a user-deletion cascade) locks community rows in scan
    order and can deadlock. No product path issues one; ADR-106 now notes it.
  - **#5:** `assertWithinCapacity` with no community row is unreachable after a member INSERT (FK lock).
  - **#7:** `planStaffChange` re-validates the body.
  - **#8:** the recount takes a table-wide writer fence and counts twice.
  - **#9:** community create is not one transaction.
  - **#10:** the `validId = isUuid` alias.
- **`/simplify` skips:**
  - recount/trigger SQL tweaks (they would need another regen);
  - deleting the fission/fusion recompute (D7 *Later*);
  - staff POST's pre-SELECT;
  - a `router.param` refactor;
  - a shared join body for duplicate-create.
- **Carried from Sprint 143:**
  - rotation, revocation, delegation and opposition votes;
  - close/expiry notifications;
  - other legacy member-handler error envelopes;
  - the demo platform-admin grant and smoke check (separate authorization);
  - `deepmerge` #178 re-check by 2026-12-01 or at the next Expo SDK move.
- **Dependabot:** #339 (`next` 16.4.6, nests `next` under `apps/*` and fails the lint-config gate) is not used.
  Closing it after the merge is the maintainer's call. #185/#186/#187 should show `fixed` after deploy.

## At deploy (plan Task 14)

- **The one authorized demo write** is the recount inside `20261119-community-member-count-trigger.sql`, applied by
  `scripts/apply-migrations.sh`. The deploy log must show that file applied.
- **If the deploy fails after the migration**, the column guard keeps the old containers' counts exact. Record which
  step failed.
- **Do not read demo data.** That includes measuring drift with `scripts/audit-demo-data.sql` query 1. Any read
  needs a separate authorization.
- **Post-merge record, on the NEXT branch:**
  - ADR-106 → Implemented;
  - BUG-103/104/105 → fixed and deployed;
  - archive this handoff.
  No docs-only master push.

## Authorizations

- **Allocated (2026-11-19):**
  - `next` #185/#186 dependency work (done, first commit);
  - ADR-106 (written, Accepted);
  - the single recount write at deploy, through the migration;
  - the disposable container for the in-process DB suites (used; torn down).
- **Not allocated:**
  - the release version (v11.117.0 is provisional) and the merge slot;
  - merge and deploy, each needing its own explicit yes;
  - any demo DB read or other demo write;
  - a full services/Redis test stack;
  - the demo platform-admin grant;
  - CodeQL dismissals (maintainer, in the UI).
- **SLA:** merge by **2026-12-01** (MEDIUM advisories #185/#186; #187, opened 2026-11-19, is covered by the same splice and its SLA ends 2026-12-03).

⚠️ GitHub status goes stale. Re-derive PR, CI and deploy state before acting on this handoff.
