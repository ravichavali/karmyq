# Sprint 131 — Maintenance Backlog — Handoff

**Date**: 2026-09-15

**Outcome**: Planning revised; implementation not started. PR C rollout approval deferred.

The maintainer handed these planning files to Codex and authorized edits. This handoff carries
session state, not reservations inferred from branch-local text.

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/codex/sprint-131-maintenance` (planning + PR A) |
| **Base** | `origin/master` at `9fae79f461a909a7337859825f57c678a990d1bc`, fetched 2026-09-15; v11.55.0 |
| **Active editor** | Codex; planning ownership explicitly transferred by the maintainer |
| **Reviewer role** | A non-author reviews the completed diff; reviewers do not co-edit |
| **Owned paths now** | Sprint 131 spec/plan, CURRENT_HANDOFF, preserved Sprint 130 archive |
| **Owned implementation paths** | Per-PR file map in the plan; no implementation in this planning session |
| **Shared resources needed** | Dependency/lockfile lane explicitly allocated to **Codex**, including messaging declarations (2026-09-15). No ADR allocation or demo data operation planned. Version comes from master at merge time; merges need per-PR maintainer authorization. |

## Goal and arc

Sprint 130 shipped v11.55.0. Sprint 131 addresses BUG-045/034/036 and the seven major proposals
#224–#230, and prepares BUG-033 for a separately approved rollout. There are **nine planned PRs
plus one conditional promoter PR**, not ten preallocated version slots.

| PR | Scope | State / next action |
|---|---|---|
| A | BUG-045 expected missing config + planning/archive | Next implementation: Task 2 after planning commit |
| B | BUG-034 messaging coverage/declarations + BUG-036 Docker readiness | After A deploys; B must precede D1 |
| D1–D7 | dotenv, node-cron, express-rate-limit, expo-server-sdk, node-fetch, zod, next | One major per PR, after B |
| C | BUG-033 discovery and approved promotions | Task 8 inventory allowed; Tasks 10–13 blocked on rollout approval |

Do not hold the other nine PRs while waiting for C. If C resumes after the upgrades, repeat its
inventory against the then-current base. BUG-033 remains open until actually delivered.

## Links

- **Spec**: [Sprint 131 design](../../docs/superpowers/specs/2026-09-15-sprint-131-maintenance-design.md)
- **Plan**: [Sprint 131 implementation](../../docs/superpowers/plans/2026-09-15-sprint-131-maintenance.md)
- **PR A focused plan**: [Expected missing community config (BUG-045)](../../docs/superpowers/plans/2026-09-15-sprint-131-pr-a-community-config.md)
- **Sprint 131 PR**: none opened in this planning session.
- **Sprint 130 archive**: [v11.55.0](archive/2026-09-15-sprint-130-maintenance-SHIPPED-v11.55.0.md)

## Quick Start

1. Confirm current branch, clean handoff and live state with `git status --short`, `gh pr list`
   and `git log --oneline origin/master -3`.
2. Reuse `agent/codex/sprint-131-maintenance`; it already carries the revised planning and the Sprint
   130 archive moved from the old branch. Do not create a branch from local master or commit on
   the merged Sprint 130 branch.
3. Read the linked spec and plan. Task 1's planning validation is complete; confirm its commit in the log.
4. Start a fresh PR A execution chat and run `/execute-plan` using executing-plans, or explicitly
   delegated subagent-driven development. Start at Task 2; tests precede behavior changes.
5. For each later PR, create its focused plan and branch from newly deployed `origin/master`.
   One merge/deploy/health verification at a time.

**Next unchecked task**: PR A focused plan, Task 1 Step 1 — read `apps/frontend/claude.md`,
`tests/claude.md` and `apps/frontend/tests/regression/sprint-129-community-trust-empty-state.test.tsx`,
then write `apps/frontend/tests/tdd/sprint-131-community-config-empty-state.test.tsx` red.

## Blockers and decisions

- **Dependency lane allocated:** “Codex holds the implementation dependency lane” (maintainer,
  2026-09-15). Includes B's runtime/test declarations as well as D1–D7.
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

1. Planning belongs on `agent/codex/sprint-131-maintenance`, created from `origin/master` before committing the carried WIP and Sprint 130 archive. Never commit Sprint 131 work on the merged Sprint 130 branch.
2. Codex holds the implementation dependency/lockfile lane by the maintainer's 2026-09-15 decision, including messaging declarations. This is explicit allocation, not a reservation inferred from this handoff.
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
