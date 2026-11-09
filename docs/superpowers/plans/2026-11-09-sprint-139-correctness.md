# Sprint 139 Correctness Bundle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> superpowers:subagent-driven-development is available if the maintainer selects that method. Steps use checkbox syntax.

**Goal:** Fix BUG-097, BUG-076, BUG-092, BUG-080, BUG-081 and BUG-082 in one bundled PR.

**Architecture:** Correct existing SQL predicates, database/cache value conversion and test orchestration in place.
Use existing loggers and amend existing ADRs; introduce no schema, endpoint, event consumer or dependency.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*; do not copy version floors here.

**Spec:** [Sprint 139 design](../specs/2026-11-09-sprint-139-correctness-design.md), including its acceptance table.

**Branch:** `agent/claude/sprint-139-planning`. Base origin/master `74c5a8e5`, v11.111.0; prior branch
documentation commit `377efa5a`. No PR was open at planning. Provisional execution version v11.112.0;
re-derive at merge time. Planning does not bump it.

**Approval boundary:** scope and completion-rate denominator are agreed. The complete design/plan still needs
maintainer decisions **1 and 7** from the spec's decision section, followed by full design approval before
implementation. Page repair/expiry response fields and refresh policy are not authorized by silence; amend
the corresponding tasks before Task 1 once selected. Execute in the next chat; stop after opening one PR. Task 15 is a
separate, unauthorized future operation. Do not infer authorization from this checklist.

## Global Constraints

- One editor, existing branch, no worktrees, no rebase/force-push or direct master push.
- No dependency work, new ADR number, dismissal, merge or demo-host operation without a separate explicit ask.
- #329 stays open. Re-check #178 at the next Expo SDK move or by 2026-12-01.
- No runtime backfill or automatic refresh trigger is added. Existing provider scores repair on next completion
  or a separately authorized use of the existing admin backfill.
- Source docs are authored; landing docs are regenerated. Keep substantive output, remove metadata-only churn.
- Amend ADR-015/042/029/088 rather than allocating an ADR number.

## File Map

### New files

| File | Responsibility |
|---|---|
| `tests/regression/sprint-139-tdd-boundaries.test.ts` | Actual Jest/Turbo discovery and isolated negative fixtures for BUG-092/076 |
| `tests/regression/sprint-139-prepush-tdd-report.test.ts` | Installed source hook pass/failure/nonblocking contracts |
| `services/request-service/tests/tdd/sprint-139-offer-visibility.test.ts` | Offer query/HTTP contract; becomes regression |
| `services/reputation-service/tests/tdd/sprint-139-provider-completion.test.ts` | Both metric entry points and real score behavior; becomes regression |
| `services/reputation-service/tests/tdd/sprint-139-trust-numeric.test.ts` | Readers, cache and numeric API contracts; becomes regression |
| `services/{auth,community,request,reputation,notification}-service/tests/tdd/sprint-139-query-logging.test.ts` | Five files: actual wrapper/logger behavior; become regression |
| `tests/integration/sprint-139-offer-visibility.integration.test.ts` | Real audience/status/expiry and hold refusal |
| `tests/integration/sprint-139-trust-correctness.integration.test.ts` | Real SQL rates, numeric reads and protected HTTP contracts |

The five logging file paths expand to auth-service, community-service, request-service, reputation-service
and notification-service; they do not create a shared runtime helper.

### Existing files

| File | Change |
|---|---|
| `services/cleanup-service/package.json`, `jest.config.js`; same two simulation-service files | Script-only tier selection; explicit discovery |
| `services/simulation-service/tests/tdd/sprint-134-demo-env-file.test.ts` → same workspace `tests/regression/` | Preserve all 17 currently blocking tests when WIP stops blocking |
| `turbo.json`, root `package.json` | Register uncached `test:tdd` with build prerequisites; continue all WIP reports |
| `scripts/git-hooks/pre-push` | Capture npm output/status in a unique retained temp log; show tail and path |
| `services/request-service/src/routes/offers.ts` | Viewer/status-scoped expiry only |
| `services/reputation-service/src/services/providerTrustService.ts` | One shared completion-rate reader, both callers |
| `services/reputation-service/src/database/trustConfigDb.ts`, `trustEvolutionDb.ts` | Numeric conversion, NULL/default preservation |
| `services/reputation-service/src/services/effectiveParamsCache.ts` | Legacy cache normalization and invalid-cache fallback |
| `services/{auth,community,request,reputation,notification}-service/src/database/db.ts` | Five debug logging replacements |
| `services/request-service/tests/regression/sprint-138-reusable-offers.test.ts` | Adapt list-only SQL assertions; keep all release tests |
| `tests/integration/sprint-138-reusable-offers.integration.test.ts` | Existing non-owner expiry coverage stays unchanged; run as a control |
| `services/reputation-service/tests/regression/providerTrustScore.test.ts` | Adjust aggregate aliases/mocks; preserve real implementation coverage |
| `tests/unit/reputation/provider-completion-rate.test.ts` | Update actual subscriber-export caller's terminal-count mocks and descriptions with the source change |
| `tests/regression/sprint-122-tier-parity.test.ts` | Update obsolete comments about cleanup/simulation; retain coverage assertions |
| Seven affected services' `CONTEXT.md` (auth/community/request/reputation/notification/cleanup/simulation) | Per-service notes with source commits |
| `services/registry.json` | Existing offer/trust contract descriptions; no new edges |
| Four guide/concept files, four ADRs, hook/script docs | Exact list in Task 10 |
| `apps/landing/src/data/docs/**` | Regenerated substantive output only |
| Root `package.json`, `package-lock.json` | Three root version fields only; no resolution changes |
| `docs/BUGS.md`, `.claude/handoff/CURRENT_HANDOFF.md` | Proven fixes and cross-session state |

## Review Focus

1. An expiry OR escaping the audience check could expose private offers: Task 5 and Task 9 test former/pending/foreign members across statuses.
2. The Sprint 138 service test would remain falsely green because the expiry fragments still occur inside the new OR: Task 5 rewrites its grouping assertions; the integration test already uses non-owner R and stays correct.
3. A numeric conversion can erase NULL inheritance or zero, or return stale string cache data: Task 7 covers each path explicitly.
4. A WIP failure can cancel other reports or accidentally block a push: Task 3 runs multi-workspace fixtures and the installed hook with controlled exits.
5. Fixing only one provider path or duplicating the formula in tests gives false confidence: Task 6/9 call both real public entry points and assert persisted rate and score.

## ⚠️ Critical Implementation Notes (read before Task 2)

1. Reuse `agent/claude/sprint-139-planning`; one editor, no worktrees, rebase, force-push or master push.
2. Planning/review chats change documents only. Resolve review decisions 1 and 7 and obtain full design approval before implementation in the next chat.
3. Preserve offer audience outside the expiry OR; owner visibility never grants permission to hold an expired offer.
4. Completion rate is completed / (completed + cancelled), rounded to two decimals; ongoing and legacy accepted rows are excluded. The proposed completion-only refresh still needs decision 7; no demo backfill is authorized.
5. Normalize DB/cache numbers with strict decimal-string validation; preserve NULL inheritance and community zero, use legal user overrides, and retain disclosure guards.
6. Fix the source pre-push hook, then reinstall it. Capture true TDD exit status in a unique retained temp log; show its last 20 lines and path. WIP failures never block required-green pushes.
7. Register uncached Turbo TDD execution with build prerequisites; prove clean-output imports, discovery and failure propagation against real tools.
8. SQL success logging moves to existing debug loggers in all five affected services; transactions, errors and parameters are unchanged. Amend existing ADRs; allocate no new number.
9. New service tests begin in their own tdd tier; root invariant gates are the exception. Preserve simulation's 17-test protection suite in regression; reconcile promoter moves and landing churn after every full test run.
10. No dependency work, merges, dismissals or demo-host operations without separate explicit authorization. #329 stays open; #178 is due by 2026-12-01.
11. Regenerate landing docs from source and remove only generated metadata noise. Re-derive the version from origin/master at merge time.
12. Execution runs testing, /simplify, /code-review and /security-review, updates the handoff, pushes one PR and stops at PR creation.

## After every full test run (including every pre-commit-check)

Root `package.json:17` wires the repo-wide promoter as `posttest`; lifecycle execution depends on local
`ignore-scripts` configuration (true when reviewed). Do not assume it cannot run. Before a full run,
snapshot source bytes and locations of all current service/app TDD files and landing output; then:

1. Inspect `git status --short` immediately after `npm test`, even when it fails.
2. Restore unintended promotions of these unrelated passing files to their original tdd locations/bytes:
   `services/auth-service/tests/tdd/sprint-129-demo-session-selfcheck.test.ts`,
   `services/auth-service/tests/tdd/sprint-129-demo-session-logging.test.ts`,
   `services/reputation-service/tests/tdd/sprint-125-provider-reputation-auth.test.ts`, and
   `services/request-service/tests/tdd/sprint-125-provider-auth-gate.test.ts`. Apply the same snapshot check
   to any additional unrelated promotion; never rely on this list being exhaustive forever.
3. During execution retain the deliberate simulation `sprint-134-demo-env-file` promotion and all green
   Sprint 139 promotions. During the planning-only commit retain no promotions at all. Record new actual
   test paths in the execution ledger and use those paths in later commands.
4. Restore only landing timestamp/HEAD metadata churn, preserving intentional source-derived doc changes.
   Restore from the pre-run byte snapshot, not HEAD over uncommitted edits. Validate each source/destination
   identity before moving/removing an accidental promoted copy; never delete by a broad glob.
5. Recheck the final staged paths and `git diff --check` before committing. Task 11 verifies that all
   intended green tests are now in regression; if lifecycle hooks were suppressed, promote them explicitly.

This policy is part of every task below, including abbreviated verification/commit steps.

## Task 1: Preflight and first failing tier-boundary proof

**Files:** Create `tests/regression/sprint-139-tdd-boundaries.test.ts`; later version-only edits to root manifests.

**Interfaces:** Consumes real workspace manifests/configs, Jest CLI and Turbo CLI. Produces root invariant proofs;
no runtime interface.

- [ ] Read CLAUDE.md, handoff, both planning documents, `tests/claude.md`, `scripts/claude.md`; run `uname -s`
  using Git Bash on Windows. Fetch origin; confirm branch and clean tree, `gh pr list`, `gh issue view 329`,
  `git log --oneline origin/master -3`. If master moved, obtain explicit authorization for a merge commit;
  never rebase or implement atop another editor's WIP.
- [ ] Read every changed service's `.claude/README.md` and relevant CONTEXT sections, plus applicable gotchas
  via `node scripts/gotcha-check.js --for <owned paths>`. Verify each file in this map still exists; search
  for an existing Sprint 139 test before creating it.
- [ ] Baseline `npm test`; record failures with raw exit codes. Real PostgreSQL is CI-only on Windows;
  do not open an SSH tunnel or operate on the demo. Check the installed hook path with `git config --get core.hooksPath`.
- [ ] Write the tier gate using the existing workspace-discovery helper and Jest CLI execution pattern in
  `sprint-122-tier-parity.test.ts`: resolve the two real default scripts and ask Jest `--listTests`, then
  compare exact source identities. Require every unit/regression file, no tdd/integration. Explicit TDD
  scripts must discover every actual WIP file. In temp workspace copies add marker files for all four tiers.
- [ ] Run it red against the two bare-Jest scripts. Negative proof: a red tdd marker currently causes the
  default service test to fail. Do not commit this new blocking gate until Task 2 makes it green.

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-139-tdd-boundaries.test.ts --runInBand --no-cache
```

Expected now: assertion failure on WIP/default selection, not import/compile failure. Keep the red gate
uncommitted through Task 2. Version bump happens only after baseline, using three root fields and no other lock edits.

## Task 2: Isolate cleanup and simulation WIP tiers (BUG-092)

**Files:** Both services' `package.json`, `jest.config.js`, `CONTEXT.md`; Task 1 gate; tier-parity comments;
simulation `tests/tdd/sprint-134-demo-env-file.test.ts` → `tests/regression/sprint-134-demo-env-file.test.ts`.

**Interfaces:** Produces the exact four scripts in spec B. Default `test` means unit + regression only.

- [ ] First run simulation's current demo-env-file suite explicitly: require all 17 existing tests green,
  then move that exact file to regression. It has blocked pushes since #313; the tier correction must not
  silently remove that protection. Verify default `npm test` discovers and runs the same 17 tests. Change
  only the file's location (relative import depth is unchanged); do not broaden unrelated promotions.
- [ ] Apply spec B's script values to both services. Explicitly match unit/regression/tdd TS tests in both
  configs; remove cleanup's inherited broad test patterns. Do not add dependencies or resolve the lockfile.
- [ ] Extend the temp fixture gate: failing WIP + passing blocking markers → default exit 0; explicit TDD
  → nonzero; either failing unit or regression marker → default nonzero. Assert marker names prove actual execution.
  Test commands come from the live manifests, not a separately hand-written script map.
- [ ] Run the gate green and the existing tier-coverage gate. Check actual services with `npm test` in each
  workspace and `npm run test:tdd -- --listTests` (discovery only for potentially red existing WIP).
- [ ] Extend the gate to require the promoted demo-env-file suite in simulation's default blocking list,
  not only generic marker coverage. A negative fixture returning it to WIP must fail this protection check.
- [ ] Add CONTEXT notes, update obsolete tier-parity comments, run pre-commit-check and commit Tasks 1–2 together.

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-139-tdd-boundaries.test.ts regression/sprint-122-tier-parity.test.ts --runInBand --no-cache
npm test --workspace=services/cleanup-service
npm test --workspace=services/simulation-service
```

Expected: required suites and gate exit 0, fixture WIP fails only when explicitly selected.

## Task 3: Run and report actual TDD outcomes (BUG-076)

**Files:** `turbo.json`, root `package.json`, `scripts/git-hooks/pre-push`; new hook gate; Task 1 gate;
`scripts/git-hooks/README.md`, `scripts/claude.md`.

**Interfaces:** Root `test:tdd` runs every discoverable workspace TDD task uncached after its build;
the hook converts nonzero WIP results into a warning with a bounded display and a retained unique log.

- [ ] Write the failing installed-hook fixture first, following `sprint-131-prepush-test-runner.test.ts:348`
  and `sprint-123-git-hooks-installed.test.ts`. Copy source hooks into a temp repo, install them using the
  real installer, and push only to a temporary local bare remote. Fake only subprocess npm/node outcomes.
- [ ] Assert these exact outcomes: required=0/TDD=0 → exit 0 + success; required=0/TDD=1 → exit 0 + warning
  and no TDD-success text; missing task (nonzero diagnostic) → same warning; required=1 → nonzero push,
  no final required-green message. Test the real hook content, not a reproduction in a test string.
- [ ] Make the fake WIP command write at least 100 uniquely numbered lines plus a known final diagnostic.
  Assert only its last 20 lines appear in hook output, the reported log path exists and contains all 100+
  lines, the printed status is the original npm status, and two runs produce different paths. Test mktemp
  failure and tail-display failure: no false success or required-green push rejection. Retain fixture logs
  only until their temp test repository is cleaned up; real hook logs remain available to the developer.
- [ ] Extend the boundary gate with actual Turbo `--dry-run=json` discovery and a temporary two-workspace
  execution. Workspace A writes a marker then fails, B writes a different marker and succeeds; both run
  under `--continue=always`, aggregate exits nonzero. Dry-run task graph must include build prerequisites;
  a clean-output fixture resolves a real shared logger import after build. A failing build fixture still
  allows other reports and makes the aggregate nonzero; record that build failure rather than claiming
  a pure test failure. A subsequent successful run executes TDD tasks again (uncached).
- [ ] Register `test:tdd` as `cache: false`, `outputs: []`, `dependsOn: ["build"]` (same prerequisite as test);
  update root script to `turbo run test:tdd --continue=always`. Capture npm output in a `mktemp` log under
  the OS temp directory in an if block; preserve its status before running tail. Print the last 20 lines,
  full log path and status, retain the log, and make log-creation/display errors warning-only. Do not change
  shell-wide error semantics or pipe npm into tail.
- [ ] Verify fixtures green, then run the root TDD command once. Record known unrelated WIP reds honestly;
  expected WIP failures are not a requirement to fix or hide them. Reinstall this clone's hooks with
  `npm run hooks:install`, verify installed bytes/path against source, and commit after pre-commit-check.

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-139-prepush-tdd-report.test.ts regression/sprint-139-tdd-boundaries.test.ts regression/sprint-123-git-hooks-installed.test.ts regression/sprint-131-prepush-test-runner.test.ts --runInBand --no-cache
npm run test:tdd
npm run hooks:install
```

Expected: gates exit 0; root TDD actually discovers/runs tasks and accurately reports aggregate status.

## Task 4: Red service contracts before source changes

**Files:** The eight new service test files in File Map (three behavior suites and five query-logging suites).

**Interfaces:** Tests consume existing exports/routes; no new runtime interface is required yet. Task 6's
new rate reader and Task 7's cache normalizer remain internal helpers.

- [ ] Write offer route tests with SQL/parameter capture using the Sprint 138 harness. Distinct owner/member/
  outsider identities must exercise the audience + expiry grouping. Exact expected predicate is spec A;
  SQL capture proves query construction, not query execution. Task 9 supplies execution evidence.
- [ ] Write provider tests calling `updateProviderCompletionRate`, `backfillAllProviderTrustScores` and real
  `recalculateProviderTrustScore`, mocking only DB I/O. Assert terminal status selection, per-responder
  params, 66.67 and resulting score 80, no-profile/zero outcomes and active profile filtering. Do not copy
  the trust formula into a test helper.
- [ ] Write numeric reader/cache/API tests against production modules. Use pg-like strings and numeric
  inputs; test NULL, zero, missing row, legacy cached strings and all malformed cases from spec D. Stub
  only SQL/Redis transports and route authentication/live membership; keep authorization denial assertions.
- [ ] In each of the five services, write the logging suite with mocked pg and the real shared logger;
  isolate imports after setting/resetting LOG_LEVEL. Assert default/info silence, debug message and service,
  unchanged SQL/parameter references, result identity, unchanged rejection identity. Reputation also covers
  query inside withTransaction using the checked-out client, never the pool.
- [ ] Run each new suite explicitly `--runInBand --no-cache`; record meaningful red assertions before any
  source edit. Existing resetMocks means mock implementations are installed in beforeEach. Use `export {}`
  if a test otherwise becomes a TS global script. Keep all new service tests in their own tdd directory.
- [ ] Commit service WIP tests only after pre-commit-check confirms unit/regression remain green; the TDD
  tier now reports only. Follow the after-every-full-run policy; root posttest can promote passing files.
  Retain intended Sprint 139 promotions as they happen and adjust subsequent suite paths accordingly.

Example (repeat with each exact new file):

```bash
npm exec --workspace=services/request-service -- jest --runTestsByPath tests/tdd/sprint-139-offer-visibility.test.ts --runInBand --no-cache
npm exec --workspace=services/reputation-service -- jest --runTestsByPath tests/tdd/sprint-139-provider-completion.test.ts tests/tdd/sprint-139-trust-numeric.test.ts tests/tdd/sprint-139-query-logging.test.ts --runInBand --no-cache
```

Expected: spec-related failures; no false red due to missing tools/imports/DB.

## Task 5: Scope expiry by status and ownership (BUG-097)

**Files:** `services/request-service/src/routes/offers.ts`, its CONTEXT; new offer suite;
existing Sprint 138 service list assertions. Existing root integration coverage is a control, not a rewrite.

**Interfaces:** GET `/offers` keeps its params/defaults and envelope; adds only spec A's visibility predicate.

- [ ] Apply spec A's exact SQL to the list route, keeping the existing audience clause as an outer AND.
  Keep binding `$2` as viewer id, and retain limit/offset/type/community parameter numbering.
- [ ] Rewrite the Sprint 138 service test's misleading “filters flagged and elapsed offers” cases at
  `sprint-138-reusable-offers.test.ts:206`–210. Checking only `toContain` for the two expiry fragments is
  insufficient: both fragments survive within the new OR. Assert the normalized complete WHERE grouping,
  including the outer audience AND, status bypass and owner bypass; rename the withdrawn case to describe
  expiry bypass. Mutate the actual query grouping in a byte-backed temporary test cycle and require this
  assertion to fail. Retain all release/reuse/expiry-flag/index proofs unchanged.
- [ ] Leave Sprint 138's root integration list test unchanged: `listOffers(R)` at :322 already uses the
  current-member requester, while H owns the offers (:49–50, :69). Run it as a control; add new owner and
  non-active cases in Sprint 139's integration suite instead.
- [ ] Assert status filter remains effective, `expired = NULL` and `expires_at = NULL` work, owner branch
  cannot expose someone else's offer, membership removal denies, and all optional params still bind correctly.
- [ ] Verify new and Sprint 138 suites green; run existing offer-audience regression coverage located by
  searching `offerReadableSql`, BUG-064 and `/offers`. Document read-only visibility change and commit.

```bash
npm exec --workspace=services/request-service -- jest --runTestsByPath tests/tdd/sprint-139-offer-visibility.test.ts tests/regression/sprint-138-reusable-offers.test.ts --runInBand --no-cache
```

## Task 6: Share the terminal-outcome rate calculation (BUG-080)

**Files:** `services/reputation-service/src/services/providerTrustService.ts`, its CONTEXT; new completion
suite; existing service `tests/regression/providerTrustScore.test.ts` and root
`tests/unit/reputation/provider-completion-rate.test.ts`.

**Interfaces:** Add internal `readProviderCompletionRate(userId: string): Promise<number>`; public signatures
`updateProviderCompletionRate(userId: string): Promise<void>` and `backfillAllProviderTrustScores(): Promise<number>` stay.

- [ ] Implement one SQL aggregate for completed and terminal matches by responder id; return spec C's rate.
  Both public paths call it. Keep active-profile selection, parameterized user scope, score formula and
  existing error/isolation behavior. Do not call one public loop from another or create recursive recalculation.
- [ ] Update misleading comments/aggregate aliases and old mocks using `accepted_matches`. Preserve the
  existing `recalculateProviderTrustScore` contract, including stored completion/response metrics on review.
  Root `tests/unit/reputation/provider-completion-rate.test.ts` also imports the real subscriber export
  and supplies `accepted_matches`; change those mocks/descriptions to terminal outcomes in the same commit.
  Re-run a repo-wide `accepted_matches` search to ensure no live consumer/test contract was missed.
- [ ] Make tests prove no terminal → 0, completed-only → 100, cancelled-only → 0, 2/3 → 66.67, irrelevant
  statuses ignored, inactive profiles excluded and all active profiles updated. A different responder's
  history cannot contribute. Final upsert must store score 80 for the spec's 5-star fixture.
- [ ] Run new + existing actual-module tests green, note refresh lag and no automatic repair in CONTEXT,
  then pre-commit-check and commit. No HTTP backfill or host commands.

```bash
npm exec --workspace=services/reputation-service -- jest --runTestsByPath tests/tdd/sprint-139-provider-completion.test.ts tests/regression/providerTrustScore.test.ts --runInBand --no-cache
npm exec --workspace=tests -- jest --runTestsByPath unit/reputation/provider-completion-rate.test.ts --runInBand --no-cache
```

## Task 7: Normalize DB and legacy cached trust values (BUG-081)

**Files:** `trustConfigDb.ts`, `trustEvolutionDb.ts`, `effectiveParamsCache.ts`, reputation CONTEXT;
new numeric suite. All source paths are under reputation-service as in File Map.

**Interfaces:** Existing reader signatures remain; internal cache normalizer returns
`{ depth_weight: number; breadth_weight: number; cross_community_prior: number } | null`.

- [ ] Normalize community depth/breadth with null-aware defaults; user depth/breadth as number or NULL;
  user and community cross-community priors as numbers. Preserve no-row, boolean and identity semantics.
- [ ] Normalize valid numeric cache values on read, including old string-valued JSON, without requiring
  host invalidation. Invalid cached structure/values fall through to DB and existing setex; normalize
  only the three contract fields. Do not change the key, TTL, invalidation API or Redis retry policy.
- [ ] Require exact numeric values: `'0.60'` → 0.6, `'0.00'` → 0, NULL override → NULL, no row → existing
  fallback. Cache tests include malformed JSON, missing fields, NULL, boolean, arrays, blank/nonnumeric
  strings, nonfinite numbers, Redis get failure and Redis setex failure. Require the exact decimal-string
  rule `^-?\d+(\.\d+)?$` with no trimming: reject hex, exponent, padded, plus-prefixed, `.6` and `1.` strings.
  Zero fixtures belong to community weights only; legal user overrides are 0.10–0.90 or NULL, prior 0.05–0.95.
  Query correct user/community ids.
- [ ] Both numeric API routes exercise the actual readers/cache (mock transports only); assert
  `typeof value === 'number'` plus exact values, self/member enforcement, same denial body across reasons.
  Check the sibling community evolution GET's numeric prior too. Leave BUG-079 conversion defense intact.
- [ ] Run new and existing evolution tests green; search frontend/mobile/request/simulation consumers for
  assumptions about string wire types; document results without expanding into unrelated UI changes.
  Pre-commit-check and commit.

```bash
npm exec --workspace=services/reputation-service -- jest --runTestsByPath tests/tdd/sprint-139-trust-numeric.test.ts tests/regression/sprint-134-bug-079-evolution-numeric.test.ts --runInBand --no-cache
```

## Task 8: Quiet successful SQL queries at default level (BUG-082)

**Files:** Five db wrappers and their five CONTEXT notes/logging suites; cleanup is a reference only.

**Interfaces:** Existing `query(text: string, params?: any[])` and transaction exports stay unchanged;
use `createLogger('<actual-service-name>')` from the existing shared logger subpath.

- [ ] Search all services/apps/shared/simulation for `Executed query` and equivalent unconditional query
  output. Expected five unconditional wrappers plus cleanup's existing debug implementation. Investigate
  any additional equivalent before claiming complete coverage; do not alter unrelated request logs.
- [ ] Replace those five success logs with spec E's debug call. Keep success metadata and avoid parameters;
  retain connection/failure/rollback logging and reputation's AsyncLocalStorage executor.
- [ ] Run each service's logging test with the actual shared logger. Default/info must emit no query record,
  debug emits one structured record with correct service/text/rows/duration. Assert no params in metadata.
  Rejected query keeps the same Error; init failure still logs and rejects; rollback logging is preserved.
- [ ] Each service already declares shared and uses its logger subpath at entry: verify manifests, do not
  add packages. Pre-commit-check and commit all five equivalent fixes with CONTEXT notes together.

Example (repeat for auth/community/request/reputation/notification):

```bash
npm exec --workspace=services/auth-service -- jest --runTestsByPath tests/tdd/sprint-139-query-logging.test.ts --runInBand --no-cache
```

## Task 9: Prove offer and trust contracts with real SQL

**Files:** Two new root integration suites; old Sprint 138 integration list test remains an unchanged control.

**Interfaces:** Existing HTTP service URLs/JWT fixture pattern, real service modules/pg, isolated UUID rows.
No new shared helper or production API. Read `tests/claude.md` and existing Sprint 134/138 integration setup.

- [ ] Offers: create owner, current, pending, former and unrelated users; table-driven rows for active/matched
  statuses with flag-only, clock-only, NULL/future expiry. Assert exact offer IDs by viewer/filter. Test
  equality to a fixed SQL transaction timestamp in an isolated predicate execution, with before/after
  controls; use safely elapsed timestamps in HTTP tests to avoid wall-clock races.
- [ ] Verify a visible owner's expired active offer still fails real `POST /matches` with `400 OFFER_NOT_ACTIVE`;
  no new match or hold is written. Reuse the existing valid/open ask fixtures and the real JWT caller.
- [ ] Trust: create responder H with two completed, one cancelled and proposed/matched/rejected/legacy
  accepted matches, unrelated responder controls, multiple active profiles and one inactive profile.
  Call real `updateProviderCompletionRate(H)`, assert both active rates 66.67 and scores 80 with 5-star/zero-response
  fixtures. Exercise real backfill inside reputation's real `withTransaction` context, assert the owned
  results using its exported `query` on that same connection, then force a sentinel rollback. Its global
  scan may temporarily write other fixture scores; the rollback must restore all writes, including those
  unrelated scores. Never assert global update count or leave other tests' scores changed. Assert the
  sentinel is the only swallowed error and verify fixture scores outside the transaction afterward.
- [ ] Add only-cancelled/no-terminal/no-profile cases and direct NUMERIC reader `typeof` assertions; exercise
  numeric HTTP routes with self/current membership and denial controls. Legacy cache-hit behavior stays
  covered by Task 7's deterministic transport tests; do not flush shared Redis.
- [ ] NUMERIC zero integration fixture: community depth or breadth only. Use valid nonzero user overrides
  (0.10–0.90) and NULL inheritance, and legal prior values (0.05–0.95). Do not insert zero user overrides
  into a table whose CHECK would reject the fixture before the implementation is exercised.
- [ ] Teardown only owned fixtures and close every directly imported pool/cache client. Missing infra fails.
  On Windows record these cases as CI-only; never invent a local pass. Get red proof on a temporary byte-copy
  mutation or isolated source snapshot when a disposable DB is available; label unrun pre-fix reasoning as reasoned.

```bash
npm exec --workspace=tests -- jest --config jest.integration.config.js --runTestsByPath integration/sprint-139-offer-visibility.integration.test.ts integration/sprint-139-trust-correctness.integration.test.ts --runInBand
```

Expected on configured disposable stack: both suites pass; unchanged expiry eligibility and audience controls
pass. Without a DB this command must fail, not skip. CI runs integration via `.github/workflows/ci.yml:323`–339.

## Task 10: Guides, landing sources and existing ADR amendments

**Files:** `docs/guides/fulfilling-requests-guide.md`, `using-service-providers-guide.md`, `testing-guide.md`;
`docs/concepts/observability.md`; ADR-015, ADR-042, ADR-029, ADR-088; `scripts/git-hooks/README.md`,
`scripts/claude.md`; generated landing output.

- [ ] Apply the spec's exact documentation list. Explain owner versus neighbour discovery, expired hold
  refusal, terminal denominator and refresh lag, truthful WIP status and debug logging. Do not promise
  cancellation refresh, fault attribution or a now-active response-rate tracker.
- [ ] Amend ADR-042's denominator and existing trigger description; ADR-015 documents default/info versus
  debug success logging across five services. ADR-029/088 clarify the repaired reporting/tier behavior.
  Keep existing numbers and indexes; add no new decision file.
- [ ] Fix adjacent hook-install statements: .npmrc disables automatic lifecycle installation, and active
  hooks may live under core.hooksPath. Verify against installer source; don't claim .git/hooks unconditionally.
- [ ] Read `apps/claude.md` and `scripts/claude.md`; run existing landing `generate-docs`. All amended pages
  already exist; verify nav/index entries remain, and add no hand-edited generated page.
- [ ] Inspect output, retaining source-derived changes and reverting only generated timestamp/HEAD noise.
  Run doc-context drift directly, pre-commit-check, then commit docs and substantive generated output.

```bash
npm run generate-docs --workspace=apps/landing
npm exec --workspace=tests -- jest --runTestsByPath regression/doc-context-drift-gate.test.ts --runInBand --no-cache
```

## Task 11: Consolidate context, registry and blocking regression coverage

**Files:** Seven service CONTEXT files, `services/registry.json`, `docs/BUGS.md`; move the eight new service
tests from tdd to the same workspace's regression directory, preserving basenames.

- [ ] Check every changed service has a contemporaneous CONTEXT note and correct Known Issues/Recent Fixes
  entries; amend earlier notes as needed. Registry edits describe the changed list and trust contracts only.
- [ ] Verify every green Sprint 139 test and simulation's protection suite is in its blocking regression
  tier. Some may already have moved via root posttest; individually promote any remaining green files
  when lifecycle scripts were disabled. Follow the full-run snapshot policy to undo unrelated moves.
  Confirm old paths are gone and grep whole repo for orphaned references, including this plan's execution
  ledger. Plan paths remain historical instructions; handoff next steps point to current paths.
- [ ] Update the six BUGS entries as fixed on branch, with exact tests and pending deploy status; do not claim
  deployed. Document refresh lag and that no demo backfill was run. Keep other open bugs unchanged.
- [ ] Check no dependency graph regeneration is necessary (no dependency/event edges changed). Review the
  staged diff before feedback:check because it only sees staged files. Run changed workspace unit/regression
  suites and root tests directly; commit after pre-commit-check.

```bash
npm run feedback:check
npm test --workspace=tests
git diff --check
```

## Task 12: Four SDLC gates on the final branch diff

**Files:** Entire diff against origin/master; findings recorded in the PR validation ledger/handoff.

- [ ] **Testing:** Verify every acceptance row maps to a test, meaningful red/green evidence exists, all
  promoted tests run in blocking suites, root gates run uncached and CI-only cases are explicitly labeled.
  Verification: run promoted suites and inspect exact results/exit codes, not Turbo's task names alone.
- [ ] **/simplify:** One calibrated whole-PR pass. Avoid new frameworks or broad refactors for these six fixes.
  Verification: record findings and dispositions, resolve needless duplication in the rate calculation.
- [ ] **/code-review:** High effort because this crosses auth-adjacent offer visibility, trust values,
  hook execution and five services. Use a reviewer who did not author the implementation when available.
  Verification: inspect the complete diff and test evidence; fix unresolved High/Medium findings.
- [ ] **/security-review:** Review expiry OR grouping, protected numeric routes, test subprocess argv/temp
  cleanup, SQL logging and error preservation. No dismissal API or alert exemption changes.
  Verification: record concrete findings and evidence; justify false positives in writing.
- [ ] Re-run checks affected by review fixes; staged feedback and root gates before every subsequent push.
  The full SDLC gate record belongs to the implementation PR, not this planning commit.

## Task 13: Final type checks and pre-push verification

**Files:** All changed workspaces; root version fields; regenerated docs.

- [ ] Run `tsc --noEmit` in all five logging services plus cleanup and simulation. Use configured workspace
  commands, not a root tsconfig that omits services. No dependency installation is authorized to repair an environment.
- [ ] Run `npm test` and root `npm test --workspace=tests`; record raw failing suite/exit status if any.
  Run real integration on an available disposable stack or leave the CI evidence explicitly pending.
- [ ] Verify exact root version change and lockfile diff: only root version fields, no dependency graph change.
  `git diff --check`; no accidentally promoted WIP, scratch fixture, or generated metadata churn.
- [ ] Verify installed hooks match source and the new WIP command produces accurate messages. Separate WIP
  failures from required checks in the validation ledger. Run pre-commit-check for any remaining commit.

```bash
npm exec --workspace=services/reputation-service -- tsc --noEmit
npm exec --workspace=services/request-service -- tsc --noEmit
npm exec --workspace=services/auth-service -- tsc --noEmit
npm exec --workspace=services/community-service -- tsc --noEmit
npm exec --workspace=services/notification-service -- tsc --noEmit
npm exec --workspace=services/cleanup-service -- tsc --noEmit
npm exec --workspace=services/simulation-service -- tsc --noEmit
npm test
npm test --workspace=tests
npm run feedback:check
git diff --check
```

## Task 14: Handoff, push and one PR — execution stops here

**Files:** `.claude/handoff/CURRENT_HANDOFF.md`, filled `.github/pull_request_template.md` body.

- [ ] Reconcile `gh pr list`, branch and master log. Use update-handoff; name the exact tested commit and
  subsequent docs-only commits, remaining CI evidence and all still-pending authorizations. Do not mark sprint complete.
- [ ] Read pre-commit-check, invoke process-reviewer, run required checks and commit. Push this branch with
  real hooks; inspect their output. Never bypass them or push to another agent's branch.
- [ ] Open one PR with every template section filled, explicitly stating all six bugs were bundled and
  that deployment does not backfill provider metrics. Link spec, plan, red/green ledger, root suite results,
  CI-only integration evidence still pending, and unchanged #329/#178 obligations.
- [ ] Stop immediately after PR creation. No CI watch, merge ask or host operation in the execution chat.
  Final next-chat prompt targets independent review of the PR, with CI run conclusions and actual job counts
  to be checked before any future merge readiness claim.

## Task 15: Merge and deploy — NOT AUTHORIZED, separate future chat

**Files:** None until explicit authorization and gates green.

- [ ] Only after a separate maintainer merge authorization: follow deploy/ship skills, re-derive version,
  serialize the merge/deploy slot and validate every run's conclusion plus created job count.
- [ ] Any demo-host read/write or provider backfill needs separate per-operation authorization. The old optional
  “Released expired holds” log read is also not authorized. No dismissal or dependency action is implied.
- [ ] Reconcile and archive the handoff only after merge and verified deploy, following orchestrator authority.

## Planning review ledger

- Scope: maintainer selected all six bugs; terminal-outcome denominator explicitly selected in chat.
- Builder check: fresh read-only reviewer reported “nothing important left”; no verified contradiction found.
- Full design approval: **pending decisions 1 and 7**. The maintainer reviewed the documents and requested
  these corrections; do not interpret that as accepting the page/response or refresh-policy choices.
- Planning verification blocker **resolved**: full host `npm test` exited 0 (preserved `S139_FULL_TEST_EXIT=0`),
  27/27 Turbo tasks succeeded (26 cached), root regression 43/43 suites and 992/992 tests passed. Code HEAD
  `377efa5a` plus planning documents; subsequent changes only update these Markdown docs. Snapshot comparison
  across 387 TDD/promotion-target/landing paths found no changes to restore. Feedback/whitespace checks pass.
- This planning-review chat changes only spec, plan and handoff and stops after their commit. No Task 1 work.

### Relayed review: verbatim findings, evidence and disposition

| # | Finding (quoted) | Verdict / evidence | Planning correction and proof boundary |
|---|---|---|---|
| 1 | “The only web page that uses `GET /offers` looks broken, so the BUG-097 fix would change nothing anyone can see.” | CONFIRMED source mismatch: `apps/frontend/src/pages/offers/index.tsx:43`–44; `src/lib/api.ts:81`–91; payload at `services/request-service/src/routes/offers.ts:69`–73 | Bundle/defer decision pending; browser symptom not re-run. No frontend/API expansion assumed. |
| 2 | “The BUG-092 fix silently stops one passing test from blocking pushes.” | CONFIRMED: simulation `tests/tdd/sprint-134-demo-env-file.test.ts`, default includes tdd | Task 2 explicitly moves the 17-test protection suite and proves blocking discovery. Move belongs to execution. |
| 3 | “Root `npm test` already promotes every passing tdd file.” | PARTIAL: `package.json:17`, promoter :99–115 register a broad lifecycle; local ignore-scripts=true suppressed it in this host pass | Snapshot/reconcile after every full run; named unrelated exclusions; Task 11 verifies actual promotions. |
| 4 | “The plan gets a Sprint 138 test wrong, and misses a test that becomes falsely green.” | CONFIRMED: root integration :322 uses non-owner R; service regression :206–210 checks fragments only | Preserve integration control; rewrite grouping assertions with negative mutation proof in Task 5. |
| 5 | “`test:tdd` should depend on `build`, like `test` does.” | CONFIRMED: shared `package.json:14`–17 exports dist; reputation mapper :36 is bare-package-only | Build prerequisite and clean-output/failing-build fixtures in Task 3. |
| 6 | “Removing `\| tail -20` floods every push.” | CONFIRMED unbounded-output design; reviewer's measured volume not re-measured here | Retained unique temp log + last 20 lines/path; true exit status and bounded-output tests in Task 3. |
| 7 | “Completion rates would only ever be stale in the provider's favour.” | CONFIRMED cancellation-only indefinite staleness: reputation `src/events/subscriber.ts:74`–79; request `src/routes/matches.ts:731`–734 | Explicit acceptance or alternative refresh policy required; denominator approval does not approve lag. |
| 8 | “Define what counts as a valid numeric string in the cache.” | CONFIRMED ambiguity in previous spec wording | Exact decimal regex/no trimming and negative lexical cases in spec D / Task 7. |
| 9 | “Say why the spec doesn't use the existing logger helper.” | CONFIRMED: shared `utils/logger.ts:194`–200 truncates SQL/emits two records and no automatic row count | Spec E records why a single debug call preserves the intended metadata. |
| 10 | “A zero user override can't happen.” | CONFIRMED: `infrastructure/postgres/init.sql:2275`–2286 | Community-only zero; legal user overrides/NULL in Task 7/9 fixtures. |

Additional completeness correction: root `tests/unit/reputation/provider-completion-rate.test.ts:67`–110
also supplies the renamed aggregate aliases; Task 6 includes that suite in the same source/test commit.

Document corrections are verified by source inspection and consistency checks; their future implementation
tests, mutation proofs and browser symptom checks have not run. Do not report these bugs fixed yet.
