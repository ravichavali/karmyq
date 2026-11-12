# Sprint 141 — Platform admin role (BUG-073) — Handoff

**Date**: 2026-11-12
**Outcome**: in progress. Planning is complete (spec + plan committed on this branch). Execution starts in the next
chat

> State between sessions only. The design lives in the spec and the steps in the plan. This file names the next
> unchecked task and the boundaries.

---

## Sprint goal

Close BUG-073: add an explicit, live-read **platform admin** role (`auth.platform_admins`), and re-gate the three
platform-wide surfaces on it without changing what community admins can do in their own communities. Those surfaces
are the `/admin/schemas` request-type catalog, the six trust-question writes and the provider-trust backfill.

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-141-planning` (planning and execution share it, per recent practice) |
| **Base** | `origin/master` at `06685ea4` (PR #336 merge; fetched 2026-11-12) |
| **Active editor** | Claude |
| **Reviewer role** | A non-author (Codex, by recent practice), on the PR. Reviewers read the diff and do not co-edit |
| **Owned paths** | The plan's *File Map*, plus `.claude/handoff/**`, the spec and the plan. The first commit, `444de72d`, also owns `docs/adr/{ADR-104-agent-process-economy.md,README.md}` and the generated ADR-104 landing data |
| **Shared resources** | **ADR-105** and a **minor version bump** (11.113.0 → 11.114.0, re-derived at merge), both allocated by the maintainer on 2026-11-12. **Not allocated**: merge slot, deploy, any demo data operation (including the post-deploy platform-admin grant) and any dependency change. Each needs explicit authorization |

## Links

- **Spec**: [docs/superpowers/specs/2026-11-12-sprint-141-platform-admin-role-design.md](../../docs/superpowers/specs/2026-11-12-sprint-141-platform-admin-role-design.md)
- **Plan**: [docs/superpowers/plans/2026-11-12-sprint-141-platform-admin-role.md](../../docs/superpowers/plans/2026-11-12-sprint-141-platform-admin-role.md)
- **Bug**: BUG-073 (`docs/BUGS.md`); the tabled feature is `docs/IDEAS.md` 2026-10-26 *architecture*
- **PR**: none yet
- **Previous handoff (PR #336)**: [archive](archive/2026-11-12-pr-336-usage-diet-COMPLETE.md)

## Quick Start

1. Read this handoff, then confirm live state: `git fetch origin`, `gh pr list`,
   `git log --oneline origin/master -3`, `git log --oneline origin/master..agent/claude/sprint-141-planning`.
2. Reuse the existing task branch: `git switch agent/claude/sprint-141-planning`. If master has moved past
   `06685ea4`, merge `origin/master` in with a merge commit. Never rebase, never force-push, and never branch off a
   stale local master.
3. Open the plan: `docs/superpowers/plans/2026-11-12-sprint-141-platform-admin-role.md`.
4. Invoke `superpowers:subagent-driven-development` directly (or `superpowers:executing-plans`). There is no
   `/execute-plan` slash command; superpowers removed it as a deprecated stub.

**Next unchecked task**: plan Task 1, *Preflight and baseline*. Then Task 2 (the migration, the table policy, and
`init.sql` through the `regenerate-init-sql.yml` workflow).

Tasks 1–12 end once the PR is open. Task 13 (merge, deploy, demo grant) is **not authorized**.

## Decisions (maintainer, 2026-11-12)

- **Scope**: the platform admin role is the BUG-073 fix. The maintainer chose it over the ratification quorum, the
  exchange back-out control and the mobile revival.
- **Designation**: an `auth.platform_admins` table (`user_id`, `granted_by`, `granted_at`, `note`), read live and
  granted only by operator SQL. There is no grant API.
- **Catalogs**: `requests.ui_schemas` and `communities.trust_questions` stay global and become platform-admin only.
  Community-owned custom request types are a later feature.
- **No ride-along**: the exchange back-out control stays in `docs/IDEAS.md`.
- **Allocations**: ADR-105 and a minor bump.
- **Branch**: the #336 post-merge records ride on this branch. **Don't open or merge a PR with only `444de72d`**:
  every master push deploys, and a docs-only one is forbidden.
- **ADR-103 is not flipped here.** Its §Consequences
  (`docs/adr/ADR-103-authenticated-listings-and-simulation-containment.md:85-87`) needs a deploy-time demo check,
  which the maintainer runs.

## Critical implementation notes (verbatim from the spec)

1. **Two independent roles.** A platform admin gets no community-scoped power, and a community admin (including a
   creator) gets no platform power. No gate may OR the two checks together.
2. **Live lookup, never a claim** (ADR-102). Add `isLivePlatformAdmin(userId)` to each gated service's live-role
   module:
   - `services/request-service/src/db/liveRole.ts`;
   - `services/community-service/src/utils/liveRole.ts`;
   - `services/reputation-service/src/utils/liveRole.ts`.

   The query is `SELECT 1 FROM auth.platform_admins WHERE user_id = $1 LIMIT 1`. An undefined user answers `false`
   without a query. The JWT payload is unchanged and gets no new claim.
   `tests/regression/sprint-134-pr-k-claim-gate.test.ts` derives helper names from these modules, so run it.
3. **Don't narrow the admin-actions prefilter.** Split request-service's middleware so `/admin/schemas` uses
   `platformAdminAuth` and the `/requests` admin-actions mount keeps the any-community check under its new name. The
   mount's `adminChainPaths` coverage (BUG-071) is unchanged.
4. **One 403 body** in all three services: `{ success: false, message: 'Platform admin access required', error:
   'PLATFORM_ADMIN_REQUIRED' }` (ADR-074 string code). It never reveals whether a user is a community admin.
5. **Migration discipline.**
   - Use `IF NOT EXISTS`, same-schema FKs only and no seed rows. The `migration-validator` agent reviews it before
     commit.
   - Regenerate `init.sql` through the `regenerate-init-sql.yml` workflow, because this box has no Docker. That's
     valid only while the branch's `init.sql` is byte-identical to `origin/master`'s, so check with
     `git hash-object` first.
   - Never hand-edit `init.sql`.
6. **Classify the table `reset`** in `tablePolicy.ts`. A curated demo reset removes all grants, and the docs say so.
7. **Fail-closed rollout.** After deploy, nobody can edit schemas or trust questions, or run the backfill, until an
   operator grants a platform admin.
   - The demo grant is a **separate demo data operation that needs the maintainer's explicit authorization**. It runs
     as DB user `karmyq_prod`, after the deploy is verified.
   - The maintainer chooses the account. Don't grant it to a simulation persona whose credentials are shared.
8. **The frontend is a hint, never the boundary.**
   - `usePlatformAdmin` fails closed on every error.
   - Admin pages fire no admin request before the check passes.
   - The API interceptor already unwraps the envelope, so read `res.data`, not `res.data.data`.
9. **Founding-circle is out of scope.** Leave `utils/admin-auth.ts` working for `pages/admin/founding-circle.tsx`; fix
   only its header comment.
10. **Tests.**
    - New tests start in each changed workspace's `tests/tdd/` and go RED before implementation.
    - Promote exact green files with `git mv`. Never run `scripts/promote-tdd-tests.js` directly.
    - Update the existing PR K live-role regression tests (request, community, reputation) and the root integration
      suite `tests/integration/sprint-134-pr-k-live-admin-role.integration.test.ts` to the new expectations, without
      weakening any assertion. The suite keeps its 31-route coverage.
    - Root integration runs only in CI on this Windows box (no local Docker), so record its result as CI-pending
      until the PR's run.
    - Run new suites with `--no-cache`.
    - Check every mocked SQL column against `init.sql`.
11. **Expect landing churn.** `npm test` can rewrite `architecture.json`, `build.json` and
    `concepts/adr-010-*.json`. Restore those three with the printed `--source=` command; keep the substantive
    ADR-105 output.
12. **License gate.** Paraphrase rather than quote phrases like "internal use only" in any new doc or UI copy
    (`docs/gotchas/license-gate-flags-claim-phrases-in-any-tracked-file.md`).

## Blockers

- None for execution. Merge, deploy and the demo grant are gated on later maintainer authorization (plan Task 13).

## Carried follow-ups (out of scope for Sprint 141 unless the plan names them)

- **ADR-103 is still Proposed** (`docs/adr/README.md:33`), though Sprint 140 PR A (#334, `24bed69b`) merged and its
  master CI/CD run 43103530588 succeeded on 2026-11-11, per its archive.
  - The ADR requires a check at deploy time that the demo is not producing simulated nominations or ratifications,
    and that the deployed artifact carries zero weights.
  - That is a demo-host read. Agent demo-host reads have been refused by the permission classifier, so the
    maintainer runs it.
  - Then flip ADR-103 to Implemented on a product branch.
- **The landing docs test dirties the tree on a Turbo cache miss.**
  - `apps/landing/tests/regression/docs-generation.test.ts:21-22` runs `npm run generate-docs` into the tracked
    `apps/landing/src/data/docs/`.
  - Fix forward: generate into a temp directory, which needs an output-dir option in `scripts/generate-docs.ts`.
    Don't weaken the dirty-tree check.
  - Seen again on 2026-11-12: the pre-commit check failed on exactly the three churn files, then passed after the
    printed restore.
- **No relocation pointer gate.** No test checks that each root `claude.md` pointer of the form
  `[file](file) → *Heading*` names a heading that exists. All four were checked by hand on 2026-11-11.
- **The prebuild claim is UNVERIFIED.** Three places say the landing **prebuild** regenerates the docs:
  - `apps/claude.md:46`, `:49` and `:53`;
  - `scripts/claude.md:54`;
  - the `landing-docs-are-generated-never-authored` gotcha.

  Memory records that the prebuild never runs under `ignore-scripts` (BUG-054; shown with a scratch package on
  2026-11-09).
- **The migration-validator schema list is stale.** `.claude/agents/migration-validator.md:12-20` names `community`
  and a nonexistent feed-service, and omits six schemas. The examples at `:22` and `:24` repeat
  `community.communities`. Sprint 141's Task 2 runs this agent, so judge its output against `infrastructure/claude.md`.
- **BUG-101** (dead Edit/Write hook handlers) is open at `docs/BUGS.md:2743`.
- #335 item 6, the remaining half: session/service deduplication of the context reminder.
- **Sprint 140 PR B** is unplanned and decision-gated. It covers required-CI integration execution and the per-suite
  repair, rewrite or retire ledger. It includes `admin-schemas-api`, which Sprint 141 leaves untouched.
- **Expo SDK drift.** Issue #329 is open, and the scheduled drift run comments on it (run 43253443885 on
  2026-11-12). The deepmerge alert #178 is re-checked at the next Expo SDK move or by **2026-12-01**.
- **Later product candidates** (not chosen 2026-11-12): the governance ratification quorum, the exchange back-out
  control (IDEAS 2026-10-29), and the mobile revival (IDEAS 2026-10-29 and 2026-11-03).

## Verification references

- PR #336 merge `06685ea4`: master CI/CD run [43262546443](https://github.com/ravichavali/karmyq/actions/runs/43262546443)
  concluded success, 14/14 jobs including Deploy to Demo. Observed with `gh run view` on 2026-11-12.
  - `https://karmyq.com/` returned 200, and `POST /api/auth/login` returned an ADR-074 `VALIDATION_ERROR` 400.
  - Details are in the [archive note](archive/2026-11-12-pr-336-usage-diet-COMPLETE.md).
- Security state observed 2026-11-12: 0 open code-scanning alerts on master and 0 open Dependabot alerts.
- The planning facts in the spec were read from the files on 2026-11-12, with a `file:line` for each. Execution
  re-reads them in plan Task 1, because the code may have moved.

⚠️ GitHub status goes stale. Re-derive PR and deploy state before trusting anything above.
