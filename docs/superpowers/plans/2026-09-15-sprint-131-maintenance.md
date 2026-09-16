# Sprint 131: Maintenance Backlog — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans, or subagent-driven-development when
> explicitly delegated. This document plans the sprint; execute each PR in its own fresh chat.

**Goal:** Resolve BUG-045/034/036 and the seven major dependency proposals; prepare BUG-033 for
a separately approved rollout.

**Architecture:** Preserve API contracts. Repair caller behavior, establish messaging test coverage
and direct dependencies, harden CI readiness, and isolate promoter rollout from those changes.

**Tech Stack:** canonical stack in `CLAUDE.md` → System Architecture; re-read versions at execution.
**Spec:** [design spec](../specs/2026-09-15-sprint-131-maintenance-design.md).

## File map

| PR | Files | Responsibility |
|---|---|---|
| A | `apps/frontend/src/hooks/useCommunityData.ts`; new `apps/frontend/tests/tdd/sprint-131-community-config-empty-state.test.tsx` → regression | Expected config absence |
| A | Sprint 131 spec/plan/handoff; preserved Sprint 130 archive | Planning ownership and close-out |
| B | `.github/workflows/test.yml`; new `tests/regression/sprint-131-ci-readiness-workflow.test.ts` | Bounded readiness, including failed/slow requests |
| B | New `services/messaging-service/jest.config.js`; new `services/messaging-service/tests/tdd/messageService.test.ts` → regression | Actual service-function tests, isolated from infrastructure |
| B | `services/messaging-service/package.json`, `package-lock.json` | Test tools, missing direct runtime dependencies, scripts |
| B | `tests/regression/sprint-122-tier-parity.test.ts` | Assert messaging has discovered blocking tests |
| C, conditional | `scripts/promote-tdd-tests.js`; new `tests/regression/sprint-131-promoter-file-types.test.ts`; approved service/app test moves | Four suffixes and reviewed promotion |
| D1–D7 | Actual importer manifests and their owned lockfiles | One major upgrade per PR |
| Each | `docs/BUGS.md`, affected context/registry, source guides, root version, handoff | Accurate release evidence |

No Expo workflow change is scheduled. `scripts/claude.md` is not a required suffix-description fix:
its current text says `tests/tdd/*`. C updates ADR-088 and BUG-033 instead.

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

## Execution conventions and release gates

All commands below start at the repository root unless a code block explicitly changes location.
`npm exec --workspace=<path> -- ...` anchors Jest to the intended workspace. It does not install
dependencies for this plan; use the existing checkout and the authorized strict install step.

For **every PR**, including each D PR, run this release checklist before requesting merge:

- [ ] Read local context and scoped gotchas; verify tests exercise both success and failure paths.
- [ ] Update the listed source docs, context and registry; regenerate landing docs from sources if affected.
- [ ] `/simplify`: inspect the complete diff and record applied changes or a justified no-change result.
- [ ] `/code-review`: a non-author reviews correctness; resolve findings and record verification.
- [ ] `/security-review`: inspect changed trust boundaries, input handling and dependency behavior;
  record findings and justifications.
- [ ] Run the actual unit/regression suite and applicable type/build checks. For example, root
  `npm test -- --concurrency=1 --force` runs Turbo serially **and then posttest**. In C it is allowed
  only after rollout approval. Inspect and preserve only intended promotions and generated changes.
- [ ] Run `npm run feedback:check` against the staged diff; also manually inspect required doc coverage.
- [ ] Run the pre-commit-check skill before committing. Use exact file paths, not broad staging.
- [ ] Derive the version from refreshed `origin/master` at merge time; record it without reserving later values.
- [ ] Open one PR using every section of `.github/pull_request_template.md` (Lane: codex).
  Contributor Codex does not self-merge. Claude validates readiness; the maintainer authorizes each merge.
- [ ] Wait for all required checks on the actual head, no master deployment in flight, and explicit authorization.
- [ ] Use the deploy skill; watch the **Deploy to Demo job**, then perform login/demo-session and scope-specific
  smoke checks. The next PR starts after this deployment and health verification.
- [ ] Reconcile the handoff and current PR state. Record any deferred scope rather than declaring it finished.

PR CodeQL results are incremental; an empty PR result set does not prove existing master alerts closed.
Verify existing alert closure after the master scan on the merge commit when applicable.

## Task 1: Preserve planning work on its owning branch

**Files:** spec, plan, CURRENT_HANDOFF, preserved Sprint 130 archive.

- [x] Fetch master and verify Sprint 130 PR #242 merged as `9fae79f4`.
- [x] Create `agent/codex/sprint-131-maintenance` from `origin/master` **before committing** the WIP.
  The staged archive rename and untracked planning documents travel with the switch.
- [x] Finish this planning revision, run its pre-commit checks, then commit all four documentation paths
  on this branch. Do not commit on `feature/sprint-130-security`.
- If a future checkout cannot carry WIP across a switch, stop and preserve a named backup first;
  never discard it, and never silently strand it in a commit on the old branch.
- [x] Hand off a clean tree. Reuse this branch for A; later PRs branch from newly deployed master.

**Verification:**

```bash
git branch --show-current
git status --short
git diff --cached --name-status
git merge-base --is-ancestor origin/master HEAD
```

Expected branch: `agent/codex/sprint-131-maintenance`; archive contents and all planning files present.

## Task 2: PR A — red tests for BUG-045

**Files:** create `apps/frontend/tests/tdd/sprint-131-community-config-empty-state.test.tsx`.

- [ ] Read `apps/frontend/claude.md`, `tests/claude.md`, the actual hook and the existing Sprint 129 hook tests.
- [ ] Mock API/network collaborators, not `useCommunityData`. Supply an Axios-like rejection
  `{ response: { status: 404 } }`.
- [ ] Assert `config === null` and no `Failed to load configuration` log on 404.
- [ ] Load a config first, then reject a refetch with 404; assert the old config is cleared.
- [ ] Assert 500 and network failures retain the application error log. Preserve current successful response shape.
- [ ] Confirm discovery, then confirm assertion failures before implementation. Record failing case names.

```bash
npm exec --workspace=apps/frontend -- jest --runTestsByPath tests/tdd/sprint-131-community-config-empty-state.test.tsx --listTests --runInBand
npm exec --workspace=apps/frontend -- jest --runTestsByPath tests/tdd/sprint-131-community-config-empty-state.test.tsx --runInBand
```

Discovery must name that exact file. “No tests found”, import failures and mock-setup exceptions do not count as red.

## Task 3: PR A — handle expected absence and promote tests

**Files:** hook and the Task 2 test.

- [ ] In `fetchConfig`'s catch, use this narrow branch before the existing error log:

```typescript
if (err?.response?.status === 404) {
  setConfig(null)
  return
}
```

- [ ] Preserve the rest of the hook's error behavior. Audit norms/stats against their route sources;
  do not broaden suppression based on route names or status alone.
- [ ] Run Task 2 green, then move the file manually to `tests/regression/`.
- [ ] Verify the promoted file through the workspace config and search for stale references.

```bash
npm exec --workspace=apps/frontend -- jest --runTestsByPath tests/regression/sprint-131-community-config-empty-state.test.tsx --runInBand
npm run test:regression --workspace=apps/frontend
```

## Task 4: PR A — docs, release gates and browser evidence

**Files:** `docs/BUGS.md`, verified frontend context/guide targets, handoff.

- [ ] Update BUG-045 with the exact resolution: application logging suppressed for expected 404;
  browser network diagnostics can remain because the 404 contract is preserved.
- [ ] Read `apps/frontend/CONTEXT.md` before editing it; update only relevant facts. Locate any guide
  describing missing/default configuration before deciding whether it needs changes.
- [ ] Complete the release checklist above and merge/deploy through the authorized roles.
- [ ] Browser-check the community named in BUG-045: expected missing config produces its default/null UI
  and no `Failed to load configuration` application log. Record network 404 diagnostics separately.
  Continue to prove unexpected failures log in tests; do not induce server failures on the demo.

## Task 5: PR B — Docker readiness red test and bounded implementation

**Files:** new `tests/regression/sprint-131-ci-readiness-workflow.test.ts`;
`.github/workflows/test.yml`.

- [ ] Read `tests/claude.md` and `infrastructure/claude.md` if container configuration changes are needed.
  Reuse the existing YAML parsing style; no package addition is needed merely to parse YAML.
- [ ] Assert the job waits for BOTH `http://localhost:3001/health` and `http://localhost:3000`.
- [ ] Test immediate success, delayed success, and exhausted attempts using controlled HTTP outcomes.
  Prove the failure step still collects compose logs. Do not rely only on text matching.
- [ ] Run discovery and red assertions before editing the workflow:

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-131-ci-readiness-workflow.test.ts --listTests --runInBand
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-131-ci-readiness-workflow.test.ts --runInBand
```

- [ ] Replace the fixed sleep/one-shot checks with a bounded loop. For example, 30 attempts,
  5 seconds between failed attempts and `curl --connect-timeout 2 --max-time 5` on each URL:
  require both calls to succeed in the same attempt; exit 1 after exhaustion. The upper bound
  includes both HTTP durations, not just sleeps. These curl commands run in Linux CI, not local PowerShell.
- [ ] Re-run the same test green; verify the exit status is propagated rather than masked by a pipe.

## Task 6: PR B — messaging declarations, harness and real TDD coverage

**Files:** `services/messaging-service/package.json`, `package-lock.json`;
new local `jest.config.js`; new `tests/tdd/messageService.test.ts`.

- [ ] Confirm Codex still holds the dependency lane. Read messaging local README/CONTEXT and
  notification's Jest config/manifests; do not launch a second dependency task.
- [ ] Audit direct imports and declare baseline-compatible `cors`, `dotenv`, `express`,
  `jsonwebtoken`, `pg`, plus any additional missing import discovered. Read root and lock entries
  before choosing exact declaration ranges; do not major-upgrade these in B.
- [ ] Declare `jest`, `ts-jest`, `@types/jest` using the currently verified house versions. Splice
  workspace and affected lock nodes surgically. Prove strict `npx -y npm@11.19.0 ci`, with no unrelated lock churn.
- [ ] Add a local config covering all four tiers and `setupFilesAfterEnv: []`. Suggested script shapes:

```json
{
  "test": "npm run test:unit && npm run test:regression",
  "test:unit": "jest --testPathPatterns=tests/unit/ --passWithNoTests",
  "test:regression": "jest --testPathPatterns=tests/regression/",
  "test:tdd": "jest --testPathPatterns=tests/tdd/"
}
```

An empty unit tier is allowed. The new regression suite and its TDD predecessor must not use
`--passWithNoTests` to hide a missing file.

- [ ] Mock `src/database/db`; install mock implementations in `beforeEach` because the inherited
  config resets mocks. Test the real service functions. Minimum four named cases:
  1. `getMessages` denies a nonparticipant before issuing the messages query.
  2. Authorized `getMessages` reverses descending rows to chronological order, using the exact
     conversation id, limit and offset in the query.
  3. `sendMessage` denies a nonparticipant without an insert.
  4. Authorized send performs participant check, insert, conversation timestamp update and sender lookup;
     assert parameters, call order and returned message/sender.
- [ ] This is characterization of existing behavior: green on first run is possible. Prove each
  authorization/order assertion can fail with a temporary targeted mutation, then restore it.
- [ ] Run TDD explicitly before promotion; require the intended file and at least four executed,
  passing tests, with zero failed/pending tests in this new suite:

```bash
npm exec --workspace=services/messaging-service -- jest --runTestsByPath tests/tdd/messageService.test.ts --listTests --runInBand
npm run test:tdd --workspace=services/messaging-service -- --runInBand --json
```

Read Jest's `numTotalTests`, `numPassedTests`, `numFailedTests` and `numPendingTests`; no-test success
or an import failure does not satisfy this step. Capture the report if needed without piping away the exit code.

- [ ] Move the green file to `tests/regression/messageService.test.ts`; verify it executes there:

```bash
npm exec --workspace=services/messaging-service -- jest --runTestsByPath tests/regression/messageService.test.ts --listTests --runInBand
npm run test --workspace=services/messaging-service
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-122-tier-parity.test.ts --runInBand
```

Do not invoke the global promoter just to move this one suite.

## Task 7: PR B — explicit tier guarantee, docs and release

**Files:** `tests/regression/sprint-122-tier-parity.test.ts`, messaging context/registry,
`docs/guides/testing-guide.md`, `docs/BUGS.md`, handoff.

- [ ] Add explicit messaging assertions: a Jest-backed `test` script exists, its blocking files are
  nonempty, and Jest discovers the promoted suite. Preserve the generic allowance for genuinely empty
  tiers/workspaces; there is no named messaging exemption to delete.
- [ ] Prove the new assertion fails if messaging's test script or promoted suite disappears; restore it.
- [ ] Update BUG-034/036, dependency/context documentation and the testing guide. Regenerate landing docs.
- [ ] Complete all release gates. Confirm messaging tests are in the CI test run and the Docker
  readiness job succeeds without a rerun. D1 cannot start until B has deployed successfully.

## Task 8: PR C — read-only inventory and rollout decision

**Files:** no production edits or test moves; record evidence in handoff/PR C focused plan.

- [ ] Inventory actual TDD files in every service/app, not just frontend. Current frontend baseline:
  76 files (74 .tsx, 2 .ts); current green count is unknown.
- [ ] Run each suite with its workspace's Jest config directly, saving JSON results and exit codes.
  Do not use root `npm test`, `posttest`, or `promote-tdd-tests.js` for this inventory.
- [ ] Record suite identity, discovered/executed tests, pass/fail/pending counts, total runtime,
  destination path and basename collisions. Also note shared setup assumptions that may fail after a move.
- [ ] Present the exact proposed all-workspace move set and resulting blocking-test/runtime change.
  The July 442-test figure is not current evidence.
- [ ] **Stop the rollout here until the maintainer approves that set.** This is the user's explicit
  2026-09-15 decision. Tasks 10–13 are conditional. D1–D7 may proceed independently via Task 9.
- [ ] If dependencies or master move before C resumes, rerun the inventory against C's actual base.

## Task 9: PR D1–D7 — one major upgrade at a time

**Files:** actual importer manifests, owned lockfiles, source/config migrations as required,
root version, context/registry and handoff.

- [ ] Create a focused per-PR plan in a fresh chat before each major upgrade. Read the live
  Dependabot diff, declared peers/engines and actual imports; do not assume only manifests change.
- [ ] Resolve undeclared importers before bumping. B has already declared messaging's runtime imports.
- [ ] Apply surgical manifest/lock edits. No `npm install --workspace`, dedupe or lock regeneration.
- [ ] Prove strict `npx -y npm@11.19.0 ci`; compare distinct invalid package identities to the
  baseline, not `grep -c invalid`. Check standalone nested project locks separately.
- [ ] Run the focused validation below plus full tests and all three review gates.
- [ ] Version from current master at merge time. One authorized merge, deployment and health
  verification before starting the next. Close the superseded Dependabot PR with the implementation link.
- [ ] If migration is unsuitable, obtain maintainer agreement and record a deferral; do not hide it as completed.

| Sequence | Proposal | Required proof |
|---|---|---|
| D1 | #226 dotenv | Real importers, including messaging after B; startup/environment-loading behavior |
| D2 | #228 node-cron | Cleanup/reputation scheduler construction, lifecycle, callbacks |
| D3 | #224 express-rate-limit | Shared/root/geocoding consumers, middleware and types |
| D4 | #230 expo-server-sdk | Notification push send payload and response handling |
| D5 | #225 node-fetch | CommonJS/ESM boundary, geocoding startup and regression tests |
| D6 | #227 zod | Shared schema semantics, all consumer types, full suite |
| D7 | #229 next | Frontend + landing production builds and runtime/browser checks |

## Task 10: PR C — approved matcher implementation and fixture tests

**Prerequisite:** Task 8's rollout approval is recorded; otherwise do not execute.

**Files:** `scripts/promote-tdd-tests.js`;
new `tests/regression/sprint-131-promoter-file-types.test.ts`.

- [ ] Read `scripts/claude.md`. Test discovery using isolated temporary directories containing
  `a.test.ts`, `b.test.tsx`, `c.test.js`, `d.test.jsx`, nested suites and excluded names.
- [ ] Make the existing discovery helper callable by the test without invoking the production mover;
  merely importing the script must not promote anything. Use exact sorted file identities in assertions.
- [ ] Prove the new suffix assertions fail against the old matcher; modify discovery to accept
  `/\.test\.[jt]sx?$/` while preserving existing directory exclusions.
- [ ] Verify excluded suffixes stay excluded and destination-collision handling follows the approved inventory.
  Do not overwrite a pre-existing regression file.

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-131-promoter-file-types.test.ts --listTests --runInBand
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-131-promoter-file-types.test.ts --runInBand
```

## Task 11: PR C — approved promotions and blocking-suite proof

**Files:** only approved TDD → regression moves, plus necessary relative-import fixes.

- [ ] Reconcile the current pass set with the approved list before running the mover. A newly green
  unreviewed suite or unexpected destination is a scope change, not an automatic addition.
- [ ] Run the promoter only within the approved rollout window; review every move against the list.
  Keep matcher and moves separately reviewable within the same PR.
- [ ] Resolve authorized path/import fixes. Run all promoted tests together in their blocking tiers,
  not only individually; then run the forced full suite.
- [ ] Recheck the working tree after root `posttest`. Unexpected moves must be resolved before
  committing. Do not claim the rollout ready while silently discarding recurring automatic moves.
- [ ] Prove a broken promoted test fails the blocking command; restore and rerun green.

## Task 12: PR C — docs and feedback loop

**Files:** BUG-033, ADR-088, testing guide, changed workspace contexts/registry where applicable.

- [ ] Append the rollout decision and measured counts to ADR-088, retaining the historical Sprint 122
  explanation. Close BUG-033 only once its actual rollout is delivered.
- [ ] Explain all four supported suffixes and blocking-tier behavior in the testing guide.
- [ ] Regenerate landing docs from sources; keep content and remove timestamp/HEAD churn.
- [ ] Run `npm run feedback:check` with staged changes and scoped gotcha checks; manually check moved-file
  references across the repo. `scripts/claude.md` changes only if its actual wording requires one.

## Task 13: PR C — quality gates and conditional release

- [ ] `/simplify`: assess the matcher and move mechanics; record disposition.
- [ ] `/code-review` at high effort: review the approved move set, collisions, discoveries, test
  runtime and proof that promoted tests block. Record fixes and verification.
- [ ] `/security-review`: inspect test-runner execution, file paths and any shell invocation changes;
  use argv rather than shell interpolation if execution code changes.
- [ ] Run forced unit/regression coverage and relevant type/build checks; complete the common release checklist.
- [ ] Obtain explicit merge authorization, deploy and verify health. Approval of the move set is not
  itself merge authorization.

## Task 14: Reconcile each release and close only completed scope

**Files:** CURRENT_HANDOFF and each PR's source documentation.

- [ ] Reconcile live PRs, master version, deployments and alert counts after every release.
- [ ] Record implemented vs deferred scope. If C remains unapproved, keep BUG-033 open and state
  “promoter rollout pending”; only Claude marks the sprint complete under the project role rules.
- [ ] Archive the final handoff on the next sprint branch, never through a docs-only master push.
  Carry demo-story expiry (2026-11-12) and BUG-041 recheck (2026-11-14).

```bash
git diff --check
git status --short
gh pr list --state open
git log --oneline origin/master -3
```
