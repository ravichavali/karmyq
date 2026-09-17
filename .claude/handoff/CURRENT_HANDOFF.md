# Sprint 131 — Maintenance Backlog — Handoff

**Date**: 2026-09-16

**Outcome**: PR A **shipped v11.56.0** — [#249](https://github.com/ravichavali/karmyq/pull/249) merged
as `d35a3fad` (2026-09-16T18:30:39Z), deployed and health-verified, live check passed. Codex reviewed
it with no actionable issues. PR B is next on `agent/codex/sprint-131-test-readiness`; its focused
plan is written and reviewed (Kimi, approve with two minor corrections, applied). PR C rollout approval deferred.

The maintainer handed these planning files to Codex and authorized edits. This handoff carries
session state, not reservations inferred from branch-local text.

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/codex/sprint-131-test-readiness` (PR B). PR A's `agent/codex/sprint-131-maintenance` is merged — do not commit on it |
| **Base** | `origin/master` at `d35a3fadd0912ab0ef076eb16c6fd1f23df80acd` (PR A merge), fetched 2026-09-16; v11.56.0 |
| **Active editor** | Claude executed PR A (2026-09-16); planning was authored by Codex under maintainer transfer |
| **Reviewer role** | A non-author reviews the completed diff; reviewers do not co-edit |
| **Owned paths now** | Sprint 131 spec/plan, CURRENT_HANDOFF, preserved Sprint 130 archive |
| **Owned implementation paths** | Per-PR file map in the plan; no implementation in this planning session |
| **Shared resources needed** | Dependency/lockfile lane held by **Claude** since 2026-09-16 (was Codex from 2026-09-15), including messaging declarations. No ADR allocation or demo data operation planned. Version comes from master at merge time; merges need per-PR maintainer authorization. |

## Goal and arc

Sprint 130 shipped v11.55.0. Sprint 131 addresses BUG-045/034/036 and the seven major proposals
#224–#230, and prepares BUG-033 for a separately approved rollout. There are **nine planned PRs
plus one conditional promoter PR**, not ten preallocated version slots.

| PR | Scope | State / next action |
|---|---|---|
| A | BUG-045 expected missing config + planning/archive | **Shipped** — #249 merged `d35a3fad`, v11.56.0, deployed + live-verified 2026-09-16 |
| B | BUG-034 messaging coverage + PR B runtime declarations (spec scope) + BUG-036 Docker readiness | **In progress.** Tasks 1–6 and `/simplify` committed on `agent/codex/sprint-131-test-readiness` (unpushed); next `/code-review high`, `/security-review`, then Task 7. B must precede D1 |
| B2 | BUG-046 declare missing imports in 8 services + generalize the declarations gate | **New (maintainer, 2026-09-16).** One dependency PR after B, **before D1**. Needs its own focused plan; dependency lane (Claude) |
| D1–D7 | dotenv, node-cron, express-rate-limit, expo-server-sdk, node-fetch, zod, next | One major per PR, after B **and B2** |
| C | BUG-033 discovery and approved promotions | Task 8 inventory allowed; Tasks 10–13 blocked on rollout approval |

Do not hold the other nine PRs while waiting for C. If C resumes after the upgrades, repeat its
inventory against the then-current base. BUG-033 remains open until actually delivered.

## Links

- **Spec**: [Sprint 131 design](../../docs/superpowers/specs/2026-09-15-sprint-131-maintenance-design.md)
- **Plan**: [Sprint 131 implementation](../../docs/superpowers/plans/2026-09-15-sprint-131-maintenance.md)
- **PR B focused plan**: [Messaging coverage + Docker readiness (BUG-034, BUG-036)](../../docs/superpowers/plans/2026-09-16-sprint-131-pr-b-test-readiness.md)
- **PR A focused plan**: [Expected missing community config (BUG-045)](../../docs/superpowers/plans/2026-09-15-sprint-131-pr-a-community-config.md)
- **Sprint 131 PR A**: [#249](https://github.com/ravichavali/karmyq/pull/249) (merged `d35a3fad` 2026-09-16; [CI/CD run 35134858026](https://github.com/ravichavali/karmyq/actions/runs/35134858026)).
- **Sprint 130 archive**: [v11.55.0](archive/2026-09-15-sprint-130-maintenance-SHIPPED-v11.55.0.md)

## Quick Start

1. Confirm current branch, clean handoff and live state with `git status --short`, `gh pr list`
   and `git log --oneline origin/master -3`.
2. Work on `agent/codex/sprint-131-test-readiness`, cut from deployed `origin/master` `d35a3fad`.
   `agent/codex/sprint-131-maintenance` is merged (#249); never commit on it.
3. Read the linked spec, sprint plan and the **PR B focused plan**. PR A is complete — do not reopen it.
4. The PR B plan is reviewed and corrected. Start a fresh execution chat and invoke
   `superpowers:subagent-driven-development` (or `superpowers:executing-plans`) on it directly.
   There is no `/execute-plan` slash command. Tests precede behavior changes.
5. For each later PR, create its focused plan and branch from newly deployed `origin/master`.
   One merge/deploy/health verification at a time.

**Next unchecked task**: PR B Task 7 Step 1 — `/code-review high` then `/security-review` on the branch diff (`/simplify` done), then Task 7 Steps 2–6.
Claude holds the dependency lane and executes B, including its messaging declarations and lockfile splice.

## Blockers and decisions

- **Dependency lane → Claude (2026-09-16):** “yes and you own this lane now. The execute plan command
  implicitly gives ownership of the lane. review doesn't” (maintainer). Rule: executing a plan transfers the lane to the executor; reviewing does not. Covers B's
  runtime/test declarations and D1–D7 while Claude executes them. Superseded: “Codex holds the
  implementation dependency lane” (maintainer, 2026-09-15). Codex's #249 review did not hold the lane.
- **Promoter approval deferred:** “Plan the fix, but defer rollout approval” (maintainer,
  2026-09-15). Do not broaden the matcher or trigger mass moves until the actual inventory and
  proposed move list are approved. Root `posttest` makes a matcher-only commit a rollout risk.
- **Expo reporting deferred:** no standalone Expo PR in Sprint 131. Existing emitted report/close
  states are mutually exclusive; the follow-up concerns failures before outputs are available.
  This is not the resolved BUG-035. The spec preserves the observation for later scheduling.
- **BUG-045 boundary:** suppress the application log on expected 404 and clear config; the browser's
  HTTP failure diagnostic can remain. No API contract change and no blanket console-silence claim.
- **Risk split:** messaging/CI readiness ship before major upgrades; mass promotion has its own PR.
  Major upgrades stay separate because their runtime and migration risks differ.
- **BUG-036 approach changed (maintainer, 2026-09-16):** "I am okay with your recommendations". The `/simplify`
  altitude finding replaced PR B's Node polling script (`scripts/wait-for-http.js`) with compose healthchecks
  (`auth-service`, `frontend` probing `$(hostname)`) plus `docker compose up -d --wait --wait-timeout 300 <named>`.
  It covers both `test.yml` Test Docker Build and `ci.yml` Integration Tests (the same `sleep 30` race). Proof comes
  from the PR's own CI runs, not local tests (no Docker on this box). Healthcheck interval is 30s because the base
  compose also runs on the demo host (disk 88% full).
- **BUG-046 scheduled (maintainer, 2026-09-16):** 8 services also import undeclared packages. One dependency PR
  (B2) fixes all of them before D1; PR B stays messaging-only. **BUG-047** (pre-existing `npm ls` picomatch
  ELSPROBLEMS) logged for triage.
- **Lanes/stages/provenance work is Sprint 132 (maintainer, 2026-09-16):** its spec, plan and handoff live on the
  pushed branch `lane/lanes-provenance` (`.claude/handoff/lane-lanes-provenance.md`). The execute stage is available.
- **New proposals triaged (2026-09-16):** #244 (`@eslint/js` 9→10) and #245 (ioredis 5→6) are
  **deferred to Sprint 132** by maintainer decision — they are majors that appeared after Sprint 131's
  scope was approved. #243 (bcryptjs) remains untriaged. Recorded in `docs/IDEAS.md` [2026-09-16] so
  the decision outlives this handoff's archival. Sprint 131's D-series is unchanged: #224, #225, #226,
  #228, #230, plus #247/#246 which superseded the closed #227/#229.
- **No rollout or merge authorization is implied by planning ownership.**

## Review corrections applied

- All root-regression probes use the tests workspace and verify actual discovery.
- Messaging's TDD run and nonzero case count precede promotion; blocking discovery is asserted.
- Every B manifest change includes a surgical lock update and strict install.
- All missing direct messaging runtime imports are declared before D1; future importer audits
  distinguish actual source imports from current manifest declarers.
- The branch was created before committing; the staged Sprint 130 archive was preserved.
- Numeric version reservations were removed, and the release count reflects deferred C.
- BUG-033 counts were remeasured as 74 .tsx + 2 .ts; current green counts remain unverified.
- ADR-088 and BUG-033 are the suffix-documentation targets; scripts/claude.md does not contain the
  claimed .ts-only wording.
- The tier gate has a generic empty-workspace allowance, not a named messaging exemption.
- The handoff now names ownership, base, shared-resource allocation, next task and verification.

## Verification references

PR B plan review, 2026-09-16 (Kimi, reviewer role; no branch edits):

- Verdict: approve with two minor corrections. It fact-checked the plan's load-bearing claims
  (messageService SQL/params, the 8-line lock splice, root range overlap, Sprint 122 gate lines,
  test.yml docker-build lines 108-139, compose 127.0.0.1 ports, BUGS.md:560/615).
- Applied: (1) swapped `scripts/generate-docs.ts` citation (`GUIDE_ORDER` is :315, service CONTEXT read is :120);
  (2) the runtime declarations are no longer attributed to BUG-034, whose report covers only zero tests.
  They are labelled Sprint 131 PR B spec scope in the test, the commit and the close-out.
- Also applied (Claude, not raised by either reviewer): Task 1 timing tests hardened for Turbo
  parallel load in CI. Non-hang cases use a 5000ms timeout; the hang case keeps a 1000ms floor with no
  ceiling and asserts at least one hit rather than an exact count.

PR A merge, deploy and live check, 2026-09-16 (Claude; focused plan Task 3 Step 7):

- `gh pr view 249`: state MERGED, merge commit `d35a3fadd0912ab0ef076eb16c6fd1f23df80acd`,
  mergedAt 2026-09-16T18:30:39Z. `origin/master` `package.json` = 11.56.0.
- [CI/CD run 35134858026](https://github.com/ravichavali/karmyq/actions/runs/35134858026) on
  `d35a3fad`: completed / **success**; all 14 jobs success, including Code Scanning Gate (ADR-060)
  and **Deploy to Demo**. Deploy log: `DEPLOYMENT SUCCESSFUL`, "All critical services healthy",
  no rollback; post-deploy health step reported all 9 services healthy (3001–3006, 3008–3010).
  Observed in the same log: demo root filesystem **88.2% of 44.07GB** used, and "System restart
  required" — not acted on; worth watching before the D-series image builds.
- Live, Playwright at 1440×900, logged in as `maria.reyes@test.karmyq.com` via `POST /api/auth/login`,
  `/communities/7f48de77-e6cc-5eba-819b-cb6f50d3c662` (title "Portland Mutual Aid Network"):
  `GET …/config` → **404** (the community still has no config row, so the fixture still proves the
  absence case); norms/settings/curated/pulse → 200. Console (debug level): 4 messages, 1 error —
  the browser's own `Failed to load resource … 404 … /config`. **No `Failed to load configuration`
  entry.** Because the 404 still occurs, the missing log proves the deployed bundle is the new code.
  The page rendered normally (headings: community name, "This week in the neighbourhood", "Ways
  neighbours can help here", "No open requests right now"); snapshot contained no error text.
  No demo data was read or modified outside the member's own UI session.

Codex review, 2026-09-16, PR [#249](https://github.com/ravichavali/karmyq/pull/249), head `de7aacc35f2e0640181d80d43bf6ed695454c17c`:

- No actionable correctness or security findings in PR A. Checked the hook, config route,
  interceptor, config consumers, five-case regression, documentation and focused plan.
- Fresh frontend Jest unit + regression run: **42 suites / 405 tests passed**, exit 0.
  Separate uncached BUG-045 regression run: **5 tests passed**, exit 0. That run emitted a
  nonblocking duplicate-package warning from the existing `.next/standalone` build output.
- Frontend `tsc --noEmit --incremental false`: exit 0. Branch whitespace check passed;
  scoped gotcha check found none. Application files remained unchanged during review.
- Live PR checks passed on the reviewed head; deployment is skipped on the PR run.
  GitHub reports `REVIEW_REQUIRED`, with no submitted reviews; master protection requires one
  approving review. This local assessment does not satisfy that GitHub gate.
- At review time, `gh pr list`, PR state and local git log showed #249 open and `origin/master`
  at `9fae79f4`. **Superseded:** #249 merged afterwards as `d35a3fad` with no submitted GitHub
  review (merge under maintainer authorization), then deployed — see *PR A merge, deploy and live check*.

PR A execution, 2026-09-16 (Claude, superpowers:subagent-driven-development then executing-plans):

- TDD red against the unchanged hook: `tests/tdd/sprint-131-community-config-empty-state.test.tsx`
  discovered (1 path); **2 failed / 3 passed** — "treats an expected 404…" failed on
  `consoleError` not-called, "clears a previously loaded config…" failed on `config` toBeNull.
  Green after the `fetchConfig` 404 branch: **5 passed**. Moved by hand to `tests/regression/`;
  listing names the regression path; frontend `test:regression` 37 suites / 343 tests.
- Drift gate 41/41; staged `feedback:check` clean; scoped gotcha check: none; process-reviewer PASS;
  task review spec ✅ / quality Approved. Doc coverage: no guide, onboarding, landing, registry or
  ADR change needed (no endpoint/schema/event/dependency change).
- Gates on the branch diff: `/simplify` (4 angles) — one minor (inert mock entries in the test,
  plan-mandated) left as-is; `/code-review medium` 0 findings (noted: a proxy-level 404 would also
  be silenced — misconfiguration only); `/security-review` 0 findings (404 is only the no-row path;
  401/403 untouched; `config` consumers are display-only).
- Frontend `npx tsc --noEmit` exit 0. Pre-push hook ran the suite on push (exit 0, ~79s).
- Full `npm test -- --concurrency=1` exit 0 twice (26/26 Turbo tasks; frontend a cache miss on
  the first run); git status identical before/after — no promoter moves, no landing churn.
- Version: `origin/master` still `9fae79f4` at 11.55.0 → root `package.json` 11.56.0. The lockfile's
  root `version` field (11.52.0) was already stale and is left untouched (dependency-lane rules).

Plan review, 2026-09-16:

- Reviewed focused plan commit `e2c03a56`; prior sprint planning is committed as `b47c0fe6`.
  Extracted its literal five-case test into a temporary review file and ran it against the unchanged
  hook: 2 failed / 3 passed. The initial 404 case fails on logging; the stale-config case first
  fails on `config` still holding the old object. Corrected the plan's assertion-level red expectations.
- Reproduced `git mv` rejecting that untracked test. The plan now uses a checked filesystem move;
  the temporary review test was removed. No application implementation was made.
- Corrected pre-commit sequencing, restoration of unintended promotions, attribution, and handoff
  ordering. A remains the next task until review, merge, deployment and health verification finish;
  no future PR number or verification date is invented. BUG-045 retains its caller-only boundary.
- Live `gh pr list` / `git log origin/master` reconciliation: master remains `9fae79f4`, no Sprint 131
  implementation PR exists. #227 and #229 are closed; current zod/next proposals are #247/#246.
  #224/#225/#226/#228/#230 remain open. New #243–#245 proposals are outside the approved sprint
  scope pending triage; their existence does not transfer the Codex dependency lane. D plans must
  refresh proposal IDs before execution; the sprint tables retain their dated baseline IDs.
- Corrected-plan verification passed: local links, temporary-probe cleanup and staged whitespace;
  required process review and `feedback:check`; full `npm test -- --concurrency=1` exited 0
  (26/26 Turbo tasks successful, 25 cached; fresh tests-workspace run: 41 suites / 908 tests).
  Existing worker-teardown warning was nonblocking. No generated changes or promotions occurred.

Observed 2026-09-15:

- GitHub [#242](https://github.com/ravichavali/karmyq/pull/242): merged as `9fae79f4`.
  [CI run 35029504300](https://github.com/ravichavali/karmyq/actions/runs/35029504300):
  success, including **Deploy to Demo**. Open code-scanning alerts = 0; open Dependabot security
  alerts = 0; #239 closed. Seven major dependency PRs #224–#230 remain open.
- `git diff HEAD origin/master --stat` was empty before the branch switch; the staged rename and
  planning files survived intact. New branch base is `9fae79f4`.
- Root Jest probe for `tests/regression/sprint-122-tier-parity.test.ts`: discovery `[]`;
  actual run exits 1 with “No tests found”. Running discovery from `tests/` finds exactly that file.
- Read-only frontend TDD inventory: 76 files, 74 .tsx + 2 .ts. No bulk test promotion performed.
- Scoped gotcha check for the planning/handoff files: no scoped gotchas.
- Document checks passed: local links resolve, all 13 critical notes match across spec/plan/handoff,
  task numbering is consistent, and `git diff --cached --check` passes.
- Required process review and `npm run feedback:check` passed. Full `npm test -- --concurrency=1`
  exited 0: Turbo 26/26 tasks successful (25 cached). Fresh tests-workspace execution passed
  10 unit suites / 101 tests and 31 regression suites / 807 tests. Other task results were cached.
  A nonblocking Jest worker-teardown warning remained; no test-generated file changes or promotions occurred.
- The initial sandbox run failed on Git ownership, shell and network restrictions. The successful
  run used elevation and a process-local PATH with Git `usr/bin` before Git `bin`, preserving shell
  fixture stubs. No global Git configuration, test code or application behavior changed.

## Persistent obligations

- Demo stories expire **2026-11-12**; BUG-041 recheck is due **2026-11-14**.
- No docs-only master push; preserve the Sprint 130 archive in PR A.
- CodeQL PR scans are incremental; master rescans establish closure of existing master alerts.
- Windows: use Node for JSON/HTTP probes; no local Docker. Demo data operations require separate
  explicit authorization, and none are planned here.
- Root tests can promote unrelated TDD files and regenerate landing timestamps; inspect the tree
  after verification and preserve only intended changes.
- Contributor agents never self-merge; only Claude marks the sprint complete after actual delivery.

## Critical Implementation Notes

1. Planning and PR A lived on `agent/codex/sprint-131-maintenance` (merged as #249), created from `origin/master` before committing the carried WIP and Sprint 130 archive. Never commit Sprint 131 work on the merged Sprint 130 branch.
2. Codex held the implementation dependency/lockfile lane by the maintainer's 2026-09-15 decision, including messaging declarations. **Amended 2026-09-16:** Claude holds it now; executing a plan transfers the lane to the executor; reviewing does not (maintainer). The spec and sprint plan keep the original wording as history.
3. BUG-033 rollout approval is **deferred**. Inventory is read-only. Do not enable the wider matcher, run a mass promotion, or merge PR C before the maintainer approves the freshly measured promotion set.
4. Root `package.json:17` runs the promoter as `posttest`. A matcher-only change can therefore trigger mass moves through `npm test`; a separate commit alone does not isolate rollout.
5. Root regression commands must use the tests workspace: `npm exec --workspace=tests -- jest --runTestsByPath regression/<file>.test.ts --runInBand`. Prove discovery and an assertion failure; a configuration error or zero-test exit is not TDD red.
6. Messaging tests run explicitly in `tests/tdd/` before promotion. Verify at least the four specified cases executed, then move them to `regression/` and prove the blocking command discovers the file.
7. BUG-045 acceptance is no application `Failed to load configuration` log for HTTP 404, with `config === null`. The browser may still report the preserved HTTP 404; do not claim a silent Network/Console panel.
8. Do not edit `apps/frontend/src/lib/api.ts` or change the config endpoint's 404 contract. Keep non-404 failures observable.
9. Fix messaging's undeclared runtime imports before D1. All manifest edits include a surgical lockfile update and strict `npx -y npm@11.19.0 ci`; never workspace install, dedupe, or scratch lockfile regeneration.
10. A and B precede D1-D7. PR C is independent and can ship after its approval; it does not block the major upgrades. There are nine planned deploys plus one conditional promoter deploy. No numeric release slots are reserved: derive each version from current `origin/master` at merge time.
11. Every PR runs tests, `/simplify`, `/code-review`, and `/security-review`, then waits for explicit maintainer merge authorization and the preceding deploy's health verification.
12. Expo workflow reporting is deferred outside Sprint 131. Its existing report/close outputs are mutually exclusive; the follow-up concerns failures before outputs are produced. Do not reopen the resolved BUG-035.
13. Use the machine's shell correctly. On this Windows checkout use Node for JSON/HTTP probes, preserve exit codes, and keep every test command anchored to its workspace.
