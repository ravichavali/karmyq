# Sprint 131 — Maintenance Backlog — Handoff

**Date**: 2026-09-20

**Outcome**: PR A **shipped v11.56.0** ([#249](https://github.com/ravichavali/karmyq/pull/249), `d35a3fad`). PR B **shipped v11.57.0** —
[#250](https://github.com/ravichavali/karmyq/pull/250) merged as `d2edb286` (2026-09-17T13:00:59Z, admin merge on explicit
maintainer authorization), deployed, health-verified and smoke-checked. PR B2 **shipped v11.58.0** —
[#251](https://github.com/ravichavali/karmyq/pull/251) merged as `1e1916ee` (2026-09-18T01:55:41Z, maintainer merged),
deployed, health-verified and smoke-checked. PR B3 **shipped v11.59.0** — [#252](https://github.com/ravichavali/karmyq/pull/252)
merged as `238c9009` (2026-09-19), deployed, health-verified and smoke-checked; issue #248 closed. **Next is PR D1
(dotenv 17) — open as [#253](https://github.com/ravichavali/karmyq/pull/253), in review.** PR C rollout approval deferred.

The maintainer handed these planning files to Codex and authorized edits. This handoff carries
session state, not reservations inferred from branch-local text.

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-131-d1-dotenv` (PR D1). PR A (#249), PR B (#250), PR B2 (#251) and PR B3 (#252) branches are merged — do not commit on them |
| **Base** | `origin/master` at `238c9009` (PR B3 merge), fetched 2026-09-19; v11.59.0 |
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
| B | BUG-034 messaging coverage + PR B runtime declarations (spec scope) + BUG-036 Docker readiness | **Shipped** — #250 merged `d2edb286`, v11.57.0, deployed + smoke-checked 2026-09-17 |
| B2 | BUG-046 declare missing imports in 8 services + generalize the declarations gate | **Shipped** — #251 merged `1e1916ee`, v11.58.0, deployed + smoke-checked 2026-09-18. Repo-wide declarations gate is live and blocking |
| B3 | Expo SDK drift catch-up (#248): align `apps/mobile` to Expo's live SDK 57 patch pins | **Shipped** — #252 merged `238c9009`, v11.59.0, deployed + smoke-checked 2026-09-19; **#248 closed**. 7 declared packages moved, not the 4 originally scoped: Expo published a coordinated patch wave mid-PR (see *Expo's map is a moving target* below) |
| **D1** | **dotenv 16.6.1 → 17.4.2 (#226)** | **Open as [#253](https://github.com/ravichavali/karmyq/pull/253), in review** on `agent/claude/sprint-131-d1-dotenv` (from `238c9009`), v11.60.0. Takes Dependabot #226's bump (it auto-rebased onto B2 and moved all 9 declaring workspaces itself) **plus** `{ quiet: true }` at all 14 call sites — dotenv 17 flipped the `quiet` default and otherwise logs a random promo line on every service boot. New blocking gate `sprint-131-dotenv-quiet`. **#226 CLOSED as superseded on 2026-09-20** — #253 contains its commit |
| D2–D7 | node-cron, express-rate-limit, expo-server-sdk, node-fetch, zod, next | One major per PR, after D1 |
| C | BUG-033 discovery and approved promotions | Task 8 inventory allowed; Tasks 10–13 blocked on rollout approval |

Do not hold the other nine PRs while waiting for C. If C resumes after the upgrades, repeat its
inventory against the then-current base. BUG-033 remains open until actually delivered.

## Links

- **Spec**: [Sprint 131 design](../../docs/superpowers/specs/2026-09-15-sprint-131-maintenance-design.md)
- **Plan**: [Sprint 131 implementation](../../docs/superpowers/plans/2026-09-15-sprint-131-maintenance.md)
- **PR B2 focused plan**: [Every workspace declares what it imports (BUG-046)](../../docs/superpowers/plans/2026-09-17-sprint-131-pr-b2-undeclared-imports.md)
- **PR B focused plan**: [Messaging coverage + Docker readiness (BUG-034, BUG-036)](../../docs/superpowers/plans/2026-09-16-sprint-131-pr-b-test-readiness.md)
- **PR A focused plan**: [Expected missing community config (BUG-045)](../../docs/superpowers/plans/2026-09-15-sprint-131-pr-a-community-config.md)
- **Sprint 131 PR A**: [#249](https://github.com/ravichavali/karmyq/pull/249) (merged `d35a3fad` 2026-09-16; [CI/CD run 35134858026](https://github.com/ravichavali/karmyq/actions/runs/35134858026)).
- **Sprint 130 archive**: [v11.55.0](archive/2026-09-15-sprint-130-maintenance-SHIPPED-v11.55.0.md)

## Quick Start

1. Confirm current branch, clean handoff and live state with `git status --short`, `gh pr list`
   and `git log --oneline origin/master -3`.
2. Work on `agent/claude/sprint-131-d1-dotenv`, based on `origin/master` `238c9009` (v11.59.0).
   The PR A (#249), PR B (#250), PR B2 (#251) and PR B3 (#252) branches are merged; never commit on them.
3. Read the linked spec and sprint plan. **PR A, B, B2 and B3 are shipped — do not reopen or re-execute their plans.**
4. D1 has no focused plan: it takes Dependabot #226 plus the `quiet` fix, scoped by the D1 row above.
5. For each later PR, create its focused plan and branch from newly deployed `origin/master`.
   One merge/deploy/health verification at a time.

**B2 and B3 SHIPPED** — #251 merged `1e1916ee` (v11.58.0) and #252 merged `238c9009` (v11.59.0), both deployed with all
services healthy, no rollback, smoke-checked live. The repo-wide declarations gate is blocking on every push, and #248 is
closed.

**Next unchecked action: #253 (D1) — CI green on the new head, then merge authorization → deploy → smoke.**

Review history on #253, three rounds, all findings fixed and each proven closed by injection rather than asserted:

1. Round 1 (`ebb06407`, 4 findings): `{ quiet: false }` passed a gate named "is quiet" (dotenv runs the value through
   `parseBoolean`, so `0`/`undefined`/`null`/`'false'` are all falsy and all still print); three binding forms were
   discovered but unresolvable (`require('dotenv').config()`, `import dotenv = require(...)`, block-scoped require); the
   identity pin covered only `services/`; a "four files" miscount.
2. Round 2 (`38b2848a`, 2 findings): a **trailing spread** could override `quiet: true`, because the check took the FIRST
   `quiet` and JS is last-one-wins; and the discovery **prefilter was a second, weaker parser** in front of the AST,
   skipping `from\n'dotenv'` and `require( 'dotenv' )`. It now matches the bare word and lets the AST decide.
3. Round 3 (2026-09-20, 1 finding): **computed property keys were skipped entirely**, so
   `dotenv.config({ quiet: true, ['qui' + 'et']: false })` passed all nine assertions while dotenv 17.4.2 logs — verified
   both halves. An unresolvable computed key now invalidates the proof exactly as a spread does; a statically-readable
   `['quiet']` is treated as the plain name, and a later explicit `quiet: true` restores it. Injected into the real
   auth-service call site: gate goes red on that exact line. Gate is now **10/10**.

Codex reviewed `38b2848a`: 20 checks pass / 1 skipped (Deploy to Demo), Test Docker Build included — the earlier
frontend-install `ECONNRESET` was a network abort, not a regression, and passed on re-run.
Codex re-reviewed `b5670cef` on 2026-09-20: **no remaining code findings**. Fresh dotenv + declarations
suites passed **20/20** (dotenv gate **10/10**); ten independent option-order probes passed, covering computed
keys, spreads, getters, methods and shorthand. The round-3 computed-key finding is closed
(`tests/regression/sprint-131-dotenv-quiet.test.ts:171-187`). GitHub CI was still running on that exact head
at review time; #226 was confirmed CLOSED. Recommendation: merge after that head's CI passes and the
maintainer authorizes it. **No merge performed; CI completion remains pending.**
**#226 CLOSED as superseded on 2026-09-20**, by Codex on the maintainer's explicit request (GitHub closedAt
`2026-09-20T22:50:40Z`). No merge or deployment was performed. After D1 review/merge/deploy/smoke, continue D2–D7.

⚠️ **Expo's map is a moving target — re-check at merge time on any future Expo PR.** Mid-PR, Expo published a coordinated
SDK 57 patch wave: all four originally-scoped pins went one patch further behind *and* three more packages
(`expo-router`, `expo-constants`, `@expo/metro-runtime`) joined the drift, ~10h after the first check. Measured cadence is a
**median ~70–100h between releases per package**, so there is roughly a 3-day window to land a catch-up PR — it is not a
minutes-scale treadmill, but a PR left open for days WILL go stale. If `expo install --check` is red again at merge time,
re-run the splice against the then-current versions rather than merging a stale one. This is the same "remote mutable
authority" trap ADR-094 exists for.

⚠️ **D1 (dotenv 16→17, #226) now behaves differently because of B2.** A root-only bump will turn the declarations gate **red**
in all eight services that declare `dotenv ^16.3.1`, plus `tests` and `simulation-service` (`^16.3.0`). That is intended: bump
root **and** every declaring workspace in the same PR. The same applies to any later root major (ioredis, bcryptjs, zod, next).
Claude holds the dependency lane. (The gate uses a TypeScript **AST walk**, not `ts.preProcessFile` — an earlier line here
misattributed it; `preProcessFile` was rejected in plan review round 2 because it misses `require()` in a template interpolation.)

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
- **B2 scope widened (maintainer, 2026-09-17, planning chat):** re-measured with `ts.preProcessFile` over every
  tracked JS/TS file (64 gaps; BUGS.md's 8-service table confirmed exactly). Two questions answered:
  (1) "Include in B2" — `packages/shared` compiled runtime also declares `jsonwebtoken`/`bull` (deps) and `pg`
  (peer: type-only `Pool`, same contract as Express); its build-excluded `api/` files (ADR-028) are the only
  allowlist entries. (2) "Gate it and fix all now" — test/tooling imports must be declared too (deps or
  devDeps), and B2 fixes today's test-scope gaps (notification/reputation/social-graph, frontend, tests workspace).
- **BUG-046 scheduled (maintainer, 2026-09-16):** 8 services also import undeclared packages. One dependency PR
  (B2) fixes all of them before D1; PR B stays messaging-only. **BUG-047** (pre-existing `npm ls` picomatch
  ELSPROBLEMS) logged for triage.
- **Lanes/stages/provenance work is Sprint 132 (maintainer, 2026-09-16):** its spec, plan and handoff live on the
  pushed branch `lane/lanes-provenance` (`.claude/handoff/lane-lanes-provenance.md`). The execute stage is available.
- **Dependabot majors not rolled into B (maintainer, 2026-09-16):** asked whether the ~10 open Dependabot PRs
  should join PR B; answered no — all are majors, 0 open Dependabot security alerts; one major per PR after B and B2.
  #243 (bcryptjs 2→3, auth password hashing) **deferred to Sprint 132** ("Let's defer #243 to sprint 132", maintainer, 2026-09-17).
- **Expo SDK drift (observed 2026-09-17, not scheduled):** the daily `expo-sdk-drift.yml` run is red and issue #248 is open.
  Cause is patch lag only: expo 57.0.22→~57.0.23, expo-image-picker/expo-location 57.0.17→~57.0.18,
  expo-notifications 57.0.18→~57.0.19 (jest/@types/jest 30 are registered divergences). 0 open Dependabot alerts;
  changelogs not read, so "no security content" is UNVERIFIED. **Decided (maintainer, 2026-09-17):** "I also want to get
  the expo drift handled in a small PR after b2" → PR B3.
- **New proposals triaged (2026-09-16):** #244 (`@eslint/js` 9→10) and #245 (ioredis 5→6) are
  **deferred to Sprint 132** by maintainer decision — they are majors that appeared after Sprint 131's
  scope was approved. #243 (bcryptjs, a major) joined them on 2026-09-17. Recorded in `docs/IDEAS.md` [2026-09-16] so
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

PR B2 merge, deploy and smoke, 2026-09-18 (maintainer merged; Claude verified):

- [#251](https://github.com/ravichavali/karmyq/pull/251) **MERGED** as `1e1916ee` at 2026-09-18T01:55:41Z; `origin/master`
  now `1e1916ee`, version **11.58.0**.
- [CI/CD run 35297292440](https://github.com/ravichavali/karmyq/actions/runs/35297292440): conclusion **success**, every job
  success including Code Scanning Gate, Security Audit, Integration Tests, all 7 image builds and **Deploy to Demo**.
  Deploy log: each of the 9 services `✅ … is healthy`, `✅ All services healthy`, `🎉 Demo Deployment Successful`, **no rollback**.
- Smoke (Node fetch, Windows): `POST https://karmyq.com/api/auth/login` as maria.reyes → **200, success true**, token issued;
  `GET /api/conversations` → **200, success true** (0 conversations); `GET /api/requests?limit=5&offset=0` → **200, success true**.
  Two authenticated reads, no demo data written. ⚠️ The sim password is **`password123`** — a wrong guess returns a 401 with a
  correct ADR-074 envelope, which looks like a routing pass but proves nothing.

PR B2 CI evidence, 2026-09-17 — [#251](https://github.com/ravichavali/karmyq/pull/251), head `371cd375`
([run 35268575872](https://github.com/ravichavali/karmyq/actions/runs/35268575872)). **20 checks pass, 1 skipping**
(Deploy to Demo, skipped on PRs). Confirmed from job logs, not ticks:

- **Strict lock acceptance on Linux:** `npm ci` → `added 1703 packages, and audited 1722 packages in 26s`, no npm error.
  The hand-spliced lockfile is accepted on a clean Linux install, not just on this Windows box.
- **The gate runs and passes in CI:** `PASS regression/sprint-131-workspace-declarations.test.ts (20.859 s)`; root regression
  totals 37 suites / 343 tests. No reference to the deleted messaging gate anywhere in the run.
- **Lint & Type Check**, **Integration Tests**, **Test Frontend**, **Test Auth Service**, **Test Docker Build** — all pass.
- **Images build against the changed manifests:** all 7 `Build Docker Images` jobs pass (auth-service `DONE`, no npm error),
  plus Build Landing Page. This is the real proof that `--omit=dev` images still resolve every runtime declaration.
- **Security Audit (ADR-059)** and **Code Scanning Gate (ADR-060)** pass; **CodeQL** pass; **pr-contract** pass. No new
  advisory, as expected — no resolved version changed.

**Next: merge authorization.** Per CLAUDE.md the agent cannot self-merge; ask the maintainer, confirm no master deploy is in
flight, then `gh pr merge 251 --squash --admin`, watch the master run through Deploy to Demo, smoke
`POST https://karmyq.com/api/auth/login`, and update this handoff. After that: **B3** (Expo drift #248 — re-run
`npx expo install --check` first), then **D1**.

PR B2 execution, 2026-09-17 (Claude, `superpowers:executing-plans`; 8 commits, `0edd49ad`…`98c911b0`, base `d2edb286`):

- **Gate red then green.** Red at the planned counts exactly: 2 failed / 6 passed, **95 runtime + 94 dev** violations, with
  `simulation-service: bcryptjs` correctly in the runtime list and no `@/` alias leaking. After the 8 services: **3 runtime / 14 dev**.
  After shared/frontend/tests: **8/8 green**. Final gate is **10/10** (two checks added mid-PR, below).
- **Every assertion proven able to fail.** 12 injections, each reverted: runtime scope, type-query, dev scope, devDep≠runtime,
  range, stale allowlist, discovery, root-bump stranding, realistic de-hoist, stale divergence allowlist, lock/manifest drift,
  and a service satisfying a runtime import with a peer.
- **Lockfile.** 1845 nodes before and after; **0 added, 0 removed, 0 version/resolved/integrity changes**; every host
  `registry.npmjs.org`. Diff confined to the 11 workspace nodes. Strict `npx -y npm@11.19.0 ci` **exit 0 twice**, lock untouched
  both times. `npm ls --all` dependency problems **unchanged** from the BUG-047 baseline (3 invalid + 1 missing).
- **Turbo** now orders `@karmyq/tests#build <- ["@karmyq/shared#build"]` (was `[]`).
- **Full suite** `npm test -- --concurrency=1 --force`: **exit 0, 27/27 tasks**. Landing churn was timestamp/HEAD-sha only
  (verified by normalizing before discarding) and was reverted; only content JSONs committed. No promoter moves.

**Mid-PR correction (process review, and the most important thing in this PR).** The first draft claimed range satisfaction
would force a D-series root bump. It does not: when a root bump strands a workspace range, npm nests a satisfying older copy,
so the check reads the nested node and stays green. The repo already held the counterexample — root hoists
`express-rate-limit@8.5.2` while `packages/shared` and `services/geocoding-service` run a nested `7.5.1`, gate green. A second
check was added (root's **hoisted** version must satisfy every range a workspace declares) with a 3-entry
`DIVERGENCE_ALLOWLIST` and a stale-entry test. Proven by injection: with `dotenv@17.4.2` hoisted and `16.6.1` nested under all
nine declarers, **the satisfaction check stays green and only the new check goes red**. All nine doc sites were corrected.

**SDLC gates (all four, calibrated high):**

- **`/simplify`** (4 agents): found the root cause — `scripts/update-service-deps.js` deleted a hardcoded `HOISTED_DEPS` list
  from every service manifest, i.e. the machine that produced BUG-046. Deleted (nothing invoked it). Gate cleanups: 30
  `git ls-files` spawns → 1 (~1.2s, independently verified to select the same 987 files), visitor simplified, diagnostic
  mirror-drift message, two corrected comments. Three deeper findings **deferred with reasons** to `docs/IDEAS.md` [2026-09-17]:
  `scripts/` is outside root `workspaces` so the gate cannot see it; the three dead `packages/shared/api/` files whose deletion
  would remove the `ALLOWLIST`; and root's now-mostly-importer-free `dependencies` block. Each breaks a B2 invariant.
- **`/code-review high`**: 6 findings. Fixed 2 in the gate — a `peerDependency` no longer satisfies runtime for a service or app
  (with `legacy-peer-deps=true` npm installs no peer, so that was BUG-046 again; peers count only for `packages/*`), and
  `DEV_ONLY` widened to the 7 build-tooling configs. 2 were the version bump and stale handoff, both fixed here. 2 are recorded
  in the gate header as deliberate limits (type-only imports count as runtime; only static specifiers are seen).
- **`/security-review`**: **0 findings**, independently re-verified (no new lock nodes or artifacts, `@karmyq/shared "*"`
  resolves to the local `link: true` workspace and is `private`, the gate only parses and never evaluates scanned content,
  `tracked()` uses `execFileSync` with no attacker-influenceable argument).
- **Version**: `origin/master` `d2edb286` = 11.57.0 → root `package.json` **11.58.0**. The lockfile's root `version` is stale at
  11.52.0 repo-wide and was deliberately not touched (PR B set the same precedent).


PR B2 plan review round 3, 2026-09-17 (reviewer; one P2 finding, CONFIRMED and fixed):

- **Type queries bypassed the walker.** `ts.isImportTypeNode` was unhandled, so `type T = import('pkg').X`,
  `typeof import('pkg')` and a type query nested in a generic all returned nothing (reproduced). The gate now handles
  it, with three added regression cases. Repo impact today is nil — no tracked file uses a type-position `import()` —
  so the counts are unchanged: **95 runtime / 94 dev** red, **2 failed / 6 passed of 8**. Injecting
  `type Leak = import("left-pad").Foo;` into messaging `src/index.ts` now yields exactly
  `services/messaging-service: left-pad (src/index.ts)`; reverted.
- Reviewer re-verified the plan end to end: 95/94 before declarations, 8/8 after (in memory), template-require injection
  fails correctly, and the normalized `npm ls` comparison keeps new dependency problems while ignoring log timestamps.
- Cleanup applied: stale `7/7` in a commit template, and two descriptions still crediting the pre-processor.
- **Counts note:** the three type-query cases joined the existing import-forms test, so the suite is still **8 tests**.

PR B2 plan review round 2, 2026-09-17 (reviewer; two P2 findings, both CONFIRMED and fixed):

- **Scanner could miss imports.** `ts.preProcessFile` returns `[]` for `require()` inside a template interpolation
  (reproduced). Repo-wide impact today is nil — only 4 missed literals, all aliases, relative paths or builtins — but the
  gate is now a real AST walk (`ts.createSourceFile` + `forEachChild`), a strict superset over this repo (1021 files,
  ~1.4s). Added a regression test with 10 import forms, including the template and JSX cases and two negatives.
  Re-ran the gate: **2 failed / 6 passed**, still 95 runtime / 94 dev; the template-require injection is now caught.
- **`npm ls` comparison was self-inconsistent.** Two consecutive runs on the unchanged tree differed only in the
  timestamped `…-debug-0.log` path. The plan now compares normalized dependency problems
  (`code|invalid|missing|extraneous|peer dep`). Also corrected: the BUG-047 baseline is **not** picomatch alone — it is
  3 `invalid` (picomatch, color-string, ms) + 1 `missing` (@react-native/metro-config, required by react-native-worklets).
- Reviewer confirmed the planned declarations clear the scanner's violations in memory; strict install is still unverified.

PR B2 plan review, 2026-09-17 (non-author reviewer; no branch edits):

- Verdict: **approve with minor corrections**. Independently verified root ranges and all 13 lock resolutions, shared's import
  sites (publisher.ts:10, auth.ts:103, type-only `Pool` at dbContext.ts:2), `legacy-peer-deps`, discovery anchors, splice
  arithmetic (42 + 7 declarations), subsumption of the messaging gate, base `d2edb286`. Did not re-run the red gate.
- Applied (Claude, each re-measured first): (1) drift count: "eleven" is correct on the basis deps+devDeps vs root
  deps+devDeps; twelve counting shared's `peerDependencies.express`. Basis now stated. (2) shared's tsconfig excludes
  **three** `api/` files (`tsconfig.json:25-27`), two allowlisted; fixed in scope section, commit text and CONTEXT template.
  (3) testing-guide section now says the range check covers every existing declaration. (4) `pg` peer covers the runtime
  package only; `Pool` types come from `@types/pg`. Stated in scope section and shared CONTEXT template.
- **Next:** execute the plan in a fresh chat from Task 1.

PR B merge, deploy and smoke, 2026-09-17 (Claude; focused plan Task 7 Step 7):

- Before merge: no master run in flight, `origin/master` `d35a3fad`, #250 the only open non-Dependabot PR; checks 20 pass /
  1 skipping on head `7cbad640`. Maintainer: "I authorize merge". `gh pr merge 250 --squash --admin` → MERGED `d2edb286`.
- [CI/CD run 35224474048](https://github.com/ravichavali/karmyq/actions/runs/35224474048): conclusion **success**, every job
  success including Code Scanning Gate and **Deploy to Demo** ("All critical services healthy", `DEPLOYMENT SUCCESSFUL`,
  no rollback); post-deploy health step: all 9 services healthy.
- Smoke (Node fetch, Windows): `POST https://karmyq.com/api/auth/login` as maria.reyes → 200; `GET /api/conversations`
  with that token → **200, success true**, 0 conversations (route/auth path proven; no conversation data exercised).
  No demo data read or modified beyond the member's own session.

PR B Task 7 gates and close-out, 2026-09-16 (Claude, executing-plans):

- `/simplify`: committed `ace904bd`; its altitude finding (maintainer-approved) replaced the polling script with compose
  healthchecks + `up --wait` (`ae2024a7`).
- `/code-review high`: one finding (in-container healthchecks can't see a broken `ports:` mapping) fixed in `4f5591b8`
  (runner-side curls after the wait; gate 8/8 with both breakage proofs). Re-run on the final diff: **0 findings**.
- `/security-review`: **0 findings** (no new triggers/untrusted expressions in workflows; no `ports:` change; `$(hostname)`
  not attacker-controlled; the eight messaging declarations already resolve from registry.npmjs.org in the lock, no new nodes).
- Full `npm test -- --concurrency=1 --force`: **exit 0, Tasks 27/27**; `karmyq-messaging-service:test` ran
  `tests/regression/messageService.test.ts` — **6 passed / 6**. No promoter moves. Landing churn was timestamp/sha only
  (`architecture.json` generated time, `build.json` sha/dates) and was reverted.
- `npm run type-check --workspace=services/messaging-service`: exit 0.
- Version: `origin/master` `d35a3fad` = 11.56.0 → root `package.json` **11.57.0**.
- Pushed `ead6d983` (pre-push hook ran, 128s, exit 0); opened [#250](https://github.com/ravichavali/karmyq/pull/250).
  All checks pass on that head (Deploy to Demo skipped on PR). Confirmed from logs, not ticks:
  - [CI run 35186279944](https://github.com/ravichavali/karmyq/actions/runs/35186279944) Test Backend Services:
    `PASS messaging-service tests/regression/messageService.test.ts`, **6 passed / 6**.
  - [Tests run 35186279956](https://github.com/ravichavali/karmyq/actions/runs/35186279956) Test Docker Build, **run attempt 1**:
    `up -d --wait --wait-timeout 300 auth-service frontend` → frontend Healthy 05:38:13Z, auth-service Healthy 05:38:17Z;
    "Check published ports from the runner" (curl :3001/health, :3000/) succeeded, no `##[error]`.
  - Integration Tests: the wait on the 8 healthchecked test services reached request-service Healthy 05:42:21Z;
    integration tests ran and the job passed. No `##[error]` in either Docker job.

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
