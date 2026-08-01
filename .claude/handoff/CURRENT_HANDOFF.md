# Sprint 122 — Dependency Wave + Test-Tier Truth — PR 1 SHIPPED · PR 2 BUILT & REVIEWED, AWAITING MERGE AUTHORIZATION

> ## ⏸️ PR 2 (2026-07-31): **BUILT AND REVIEWED, NOT MERGED — held at maintainer request.**
>
> **PR #183** → https://github.com/ravichavali/karmyq/pull/183
> Branch `deps/sprint-122-pr2-test-truth` · **v11.37.0** · review rounds 1–2 applied
>
> **For the current head, commit count and CI status, read the PR — not this file.** A sha written
> here goes stale on the next commit, and it did three times during this PR's review rounds. Run
> `gh pr view 183 --json headRefOid,state` and `gh pr checks 183`.
>
> **Nothing is decaying.** The branch is fully pushed (`git status -sb` shows no ahead/behind).
> Resume by reviewing the PR and either
> authorizing `gh pr merge --squash --admin` (needs EXPLICIT authorization, every time) or asking
> for changes. **Do not re-run the build; it is done.**
>
> ### What it does — four ways a green result could be produced without evidence
>
> | Defect | Measured before | After |
> |---|---|---|
> | `turbo.json` hashed `test/**` (**singular**); every workspace uses `tests/` (**plural**) — so **no `#test` task hashed any test file, jest config or setup file**. Editing a test replayed a cached pass monorepo-wide. | `karmyq-auth-service#test` hashed 15 inputs: `package.json` + 14 `src/**`, zero tests. Three tasks hashed exactly **one** file. | `$TURBO_DEFAULT$`. auth 15→38, mobile 1→50, geocoding 1→13, `tests` 1→138, frontend 225→377, landing 32→202. |
> | `scripts/promote-tdd-tests.js` declared `APPS_DIR`, never walked it. Runs as `posttest` on every `npm test`. | `apps/landing`'s `sprint-99` test was **passing and stranded** in `tdd/`. | Testable `collectTddTargets()`; **5 tests promoted** (4 frontend, 1 landing). |
> | `apps/mobile` set `passWithNoTests: true` under "until we write mobile tests". | A regression test existed there, passing **2/2**. | Flag removed; coverage asserted instead. |
> | CI runs lint as `npm run lint --if-present \|\| echo` — a config that throws on load yields a **green job**. | Never verified. | `--print-config` gate over all 4 configs (112/112/442/89 rules). |
>
> Plus **D-4** (`apps/mobile` joins CI's blocking type-check — its `tsc` is 0 errors for the first
> time) and **D-5** (dead root-level `mobile/` scaffold deleted — Expo SDK 50 / RN 0.73, not an npm
> workspace, so nothing installed, audited, built or tested it).
>
> **Zero runtime code touched** — verified by path filter: nothing under `services/`, `apps/*/src`,
> `infrastructure/`, `packages/shared/src|middleware`.
>
> ### Decisions taken this PR (do not re-debate)
>
> | # | Decision |
> |---|---|
> | **D-4** | CI type-checks `apps/mobile`, blocking. Overrides the standing "don't chase mobile green as a gate." |
> | **D-5** | Root-level `mobile/` scaffold deleted. |
> | **D-6** | The TDD promoter's `.ts`-only file filter is **NOT** extended in PR 2. `apps/frontend/tests/tdd/` holds **72 `.test.tsx` vs 2 `.test.ts`**; **67 of 74** suites pass and would promote — ~442 tests into the blocking tier in one change. Logged **BUG-033**. ADR-088 states the limitation rather than claiming the promoter is fixed. |
> | — | `--passWithNoTests` deliberately **not** bulk-deleted. It is in 10 workspaces and **ADR-029 explicitly justifies it** for legitimately-empty tiers. ADR-088 **amends** ADR-029 and asserts tier *coverage* instead. |
> | — | `@karmyq/tests#test` is **uncached** (`cache: false`): its gates audit *other* workspaces, so package-local `$TURBO_DEFAULT$` inputs cannot see what they check and a warm cache would replay them instead of running them. |
>
> ### Two things CI/review caught that local work did not
>
> 1. **A Critical that would have gone red on the first push.** `tests/unit/promote-tdd-targets.test.ts`
>    asserted `apps/landing/tests/tdd/` exists — but this PR's own promotion left that directory
>    **empty with zero tracked files**, and git does not track empty directories. A fresh clone (CI)
>    would fail on a **blocking** tier for a reason unrelated to the code — this PR's exact theme.
>    All ten `services/*/tests/tdd/` carry a `.gitkeep`; that one did not. Fixed with a `.gitkeep`
>    **and** by re-anchoring the assertion on `apps/frontend` (74 tracked files).
> 2. **CodeQL #571, `js/command-line-injection`, CRITICAL** at the tier gate's
>    `execSync(\`npx jest ${jestArgs} …\`)` — args read from workspace `package.json` into a shell
>    string. My own `/security-review` had looked at that line and waved it past as "repo-controlled,
>    low risk." **Fixed, not dismissed:** argv arrays + `execFileSync(process.execPath, [JEST_BIN, …])`,
>    no shell anywhere. Note `npx.cmd` is NOT a valid shortcut — Node 24 on Windows refuses to spawn
>    a `.cmd` without a shell (CVE-2024-27980 fix), which reintroduces the string-building.
>
> ### Maintainer review round 1 (2026-07-31) — 2 Important + 1 Minor, all correct, all fixed (`a53af273`)
>
> Each was **reproduced before being fixed**, and each fix proven non-vacuous.
>
> 1. **The Expo gate allowed MIXED SDK generations.** `sdkMajor >= 57` was a *floor* while
>    `SDK_PINNED` is a frozen SDK-57 matrix — so moving the whole expo family to 58 while
>    `react-native` stayed on its 57 pin passed **both** assertions. My first simulation went red
>    only on the **lockfile** assertion, which a real bump PR clears with `npm install` — false
>    comfort. Fixed with an exact `SDK_MAJOR = 57` constant beside `SDK_PINNED`, so an SDK
>    migration must edit both together. Rejected `expo install --check` as a blocking test
>    (network/CLI fragility is why the committed shadow exists) and per-major pin sets (YAGNI).
> 2. **CI's "Run TypeScript type check" step was checking almost nothing.** `--if-present` silently
>    passes when a script is absent — and **three of its four workspaces (`packages/shared`,
>    `auth-service`, `community-service`) declared no `type-check` script at all.** The step had
>    been green while checking only `apps/mobile`, added a day earlier by D-4. All three verified
>    tsc-clean at 0 errors → scripts added, `--if-present` dropped from all four,
>    and `tests/regression/sprint-122-ci-type-check-gate.test.ts` now asserts the invariant both
>    ways. **I had deferred this as minor M-7 reasoning "pre-existing convention, fix all four
>    together" — without ever checking whether the other three had the script. The convention I
>    deferred to was covering an empty step.**
> 3. **`testing-guide.md`** claimed every workspace stores tests under `tests/`. `packages/shared`
>    colocates at `src/**/__tests__`; the `tests` workspace keeps tiers at its own root. Both now
>    documented, with how the gates reach each.
>
> ### Maintainer review round 2 (2026-07-31) — 1 Important, fixed
>
> **The new CI type-check gate asserted a COUNT, not an identity.** It required
> `invocations.length >= 4` and that each named workspace declared the script — so replacing
> `apps/mobile` with a **duplicate `packages/shared`** passed 3/3 while mobile went unchecked
> (reproduced). This is the same count-vs-identity mistake the lint-config gate made and had to be
> fixed for, repeated in a gate written *after* that fix. Rewritten to pin the **exact, unique**
> workspace roster, scope parsing to the named step (so an invocation moved elsewhere cannot satisfy
> it), and reject `--if-present`, `||` suppression and `continue-on-error`. Proven against **six**
> bypass shapes — duplicate substitution, dropped workspace, `--if-present`, `|| true`,
> `continue-on-error`, and relocation out of the step — with the baseline green either side.
>
> Also corrected stale docs the reviewer flagged: this handoff had claimed the `--if-present`
> silent-pass was still deferred, and the PR description still quoted the obsolete mobile
> invocation and old suite counts.
>
> ### Verification state
>
> - **CI status: run `gh pr checks 183`. Do not trust any sha or verdict recorded in this file** —
>   it goes stale on the next commit and did so repeatedly during review. What the full green run
>   covers when it passes: **Integration Tests** (the tier that caught PR 1's real 500), Lint &
>   Type Check (now genuinely type-checking all four workspaces, not just `apps/mobile`), all 7
>   Docker builds, Security Audit, ADR-060 gate, CodeQL. `Deploy to Demo` shows `skipping` on a PR —
>   that is correct, it only runs on master.
> - Honest local full run, cache defeated (`turbo run test --force --concurrency=1`): **exit 0, 26/26
>   tasks**. `tests` workspace **25 suites / 346 tests**.
> - **All five gates proven non-vacuous by injection**, several in workspaces different from the
>   author's, each restored byte-identical. Non-vacuity was **re-proved after** the CodeQL fix changed
>   how `listed()` invokes jest.
> - `/simplify`, `/security-review`, `feedback:check` ("No context updates needed") all run.
>   `/code-review` = 11 per-task reviews + a whole-branch review (1 Critical, 2 Important, 7 Minor;
>   all fixed and re-reviewed).
>
> ### Owed after merge (do NOT push these to master separately)
>
> - **ADR-088 is `Proposed`.** Flip to **Implemented** on deploy — carry that edit into **PR 3's
>   branch**, never a docs-only master push (every master push is a full deploy → demo 502s).
> - Deferred, non-blocking, all logged: `promote-tdd-tests.js:47` has the same shell-string shape
>   CodeQL did *not* flag (left alone — it runs as `posttest`, risk > the unraised alert);
>   a new-service scaffold will trip the turbo gate with a bare task-id array and no guidance;
>   colocated `src/**/__tests__` tests in `apps/frontend` would never run under `npm test` (zero
>   exist today). **The `--if-present` silent-pass is FIXED, not deferred** — see review round 1
>   above; all four type-check invocations now run without it and a gate pins the roster.
>
> ### Observation for the maintainer (not caused by this PR)
>
> `password123` appears in **81 files on master** — landing docs, Maestro configs, `DATA_FLOWS.md`.
> CLAUDE.md says "never commit passwords." The demo persona credential is effectively public
> already; the rule and the practice disagree. Worth a deliberate decision rather than more drift.

> ## ✅ PR 1 COMPLETE (2026-07-30): express 4 → 5 merged, deployed and verified live at v11.36.0.
>
> **PR #180 squash-merged** as `46b2982c` at 19:48:26Z (explicit maintainer authorization).
> **#34 auto-closed.** All 20 checks green. `CI/CD Pipeline` run **30576415715** reached
> **`Deploy to Demo` = success with no rollback**; its internal sweep reported **all 9 backends
> healthy**.
>
> CodeQL alert **#570** (`js/missing-rate-limiting`, high) dismissed as **false positive** with
> justification: the rule inspects only the handler's own chain, not mount-level `app.use`, so it
> could not see `globalRateLimiter` (`request-service/src/index.ts:59`), `rateLimiters.standard`, or
> `adminAuth` (both on the `/admin/schemas` mount, `index.ts:86-87`). It was flagged only because
> this PR retyped that line to `Request<RouteParams>`; the route itself never changed.
>
> ### Live smoke test — PASSED (all legs)
>
> `POST /api/auth/login` is the ideal body-parser probe: credentials arrive **only** via the parsed
> JSON body, so a 200 with a token proves the whole chain through nginx.
>
> | Leg | Result |
> |---|---|
> | Happy path — `maria.reyes@test.karmyq.com` | **200**, `success:true`, token returned, JWT carries `communities[]` (6) |
> | Error path — wrong password | **401** `{success:false, message:"Invalid email or password", error:"UNAUTHORIZED"}` — ADR-074 intact, **no stack trace or internal detail leaked** |
> | **Bodyless POST** (the regression this PR fixed) | **400 `VALIDATION_ERROR`, not a 500** — the fix is confirmed working in production |
> | `req.query` getter under real traffic | `requests?limit&offset`, `notifications/:userId?limit&offset`, `reputation/karma/:userId?community_id`, `communities/my/communities?user_id` all **200** with success envelopes |
>
> **Note for future smoke tests:** `/health` endpoints are **not reachable through nginx** — the
> routers mount at `/auth`, `/communities`, … while `/health` sits at the service root, so
> `/api/{prefix}/health` 404s or hits an authenticated route. The CI deploy job's internal
> `localhost:PORT/health` sweep is the authoritative health check. Also: `/communities/my` is **not**
> a route (`/:id` captures `"my"` and the non-UUID lookup 500s from that handler's own catch — a
> pre-existing input-validation gap, identical under Express 4); the real route is
> **`/my/communities`, and it requires a `user_id` query param.**
>
> ### ⚠️ The finding that matters most from this PR
>
> **CI integration tests caught a real 500 that every unit and regression tier missed.**
> body-parser 2 leaves `req.body` **undefined** when no body is sent, where body-parser 1 gave `{}`.
> **76 handlers across 7 services** do `const { x } = req.body`, which throws a `TypeError` on a
> bodyless request that the route's own catch converts to a **500**.
> `POST /communities/:id/join` sends no body — that is how it surfaced.
> Fixed once via `normalizeRequestBody` (`packages/shared/middleware/bodyDefaults.ts`), mounted
> after `express.json()` in all 8 shared-consuming services, with an inline equivalent in the
> plain-JS geocoding-service. **Why local tiers were green:** every existing POST test sends a
> body, so nothing reproduced a bodyless request. Both levels now pin it.
>
> ### PR 2 inherits, unchanged
>
> `ADR-088` is still the next free number — **PR 1 deliberately created no ADR** (rationale below).
> The stale `adr-059-*.json` landing artifact is still PR 2's to repair; it re-dirties on any regen.
> New for PR 2's backlog: **`messaging-service` has zero test files and no `test` scripts** — a
> Critical service with no coverage; log to `docs/BUGS.md`.



> **SPRINT 121 IS ARCHIVED (2026-07-29)** to
> `.claude/handoff/archive/2026-07-29-sprint-121-dependency-backlog-17-OF-18-EXPRESS-CARRIED.md`.
> Its honest completion statement: **"resolved 17 of the original 18-PR triage; express (#34)
> carried to Sprint 122 by maintainer decision."** PRs 1–5 plus the v11.35.1 landing-font hotfix all
> shipped, deployed and were verified live. **Demo runs v11.35.1** (`e187c5d6`).
>
> **Sprint 122 planning is COMPLETE. Nothing is implemented yet.** No code has changed on any
> branch; the working tree carries only the two untracked `.github/` files that were never mine.

## Quick Start — resume here

**PR 2 is built and green. The only open action is your review of PR #183.**

1. Review https://github.com/ravichavali/karmyq/pull/183 (22 commits, 51 files, all 20 checks green).
2. Then either:
   - **Authorize the merge** — `gh pr merge --squash --admin` needs **EXPLICIT** authorization every
     time; never self-merge. After merging: confirm the master **`CI/CD Pipeline`** run reaches
     `Deploy to Demo` = success **with no rollback** and its internal sweep reports all **9** backends
     healthy, then smoke-test for **v11.37.0**. This PR changes no runtime code, so the smoke test
     confirms a clean deploy, not new behavior.
   - **Or ask for changes** — the deferred items are listed above under "Owed after merge".
3. **Then PR 3** — ⚠️ still **NOT execution-ready**: D-1/D-2/D-3 are open (below). Note PR 2 now makes
   those decisions *mechanical*: `SDK_PINNED` in `tests/regression/sprint-122-expo-sdk-alignment.test.ts`
   freezes `react`, `react-dom`, `react-native`, `react-native-maps`, `react-native-safe-area-context`
   (plus 6 more SDK-managed packages), so moving any of them **requires editing that map with a written
   reason** and `npx expo install --check` must still exit 0. That is deliberate — it forces the
   re-decision to be explicit and reviewable. Verified: injecting D-2's actual proposal
   (`~5.7.0`→`5.8.0`) turns the gate red.

**Plan file (complete, executed):** [`docs/superpowers/plans/2026-07-30-sprint-122-pr2-test-tier-truthfulness.md`](../../docs/superpowers/plans/2026-07-30-sprint-122-pr2-test-tier-truthfulness.md)
**Execution ledger (every finding, ruling and verification):** `.superpowers/sdd/2026-07-30-sprint-122-pr2-test-tier-truthfulness/progress.md` *(git-ignored; local only)*

### Maintainer decisions taken 2026-07-30

| # | Decision | Answer |
|---|---|---|
| **D-4** | Should CI type-check `apps/mobile`? (`ci.yml:66-68` lists only shared/auth/community; mobile `tsc` is 0 errors for the first time) | **YES — blocking gate.** Overrides the standing "don't chase mobile green as a gate." Plan Task 8. |
| **D-5** | Delete the stray root-level `mobile/` scaffold (12 tracked files, Expo SDK 50 / RN 0.73 / React 18, not an npm workspace, unreferenced outside `docs/archive/`)? | **YES — delete in PR 2.** Plan Task 9. |

### Recon corrections to the Plan of Record's PR 2 outline

- **The turbo bug is monorepo-wide, not two workspaces.** `turbo.json:16` says `test/**` (singular);
  every workspace uses `tests/` (plural), so **no `#test` task hashes any test file, jest config or
  setup file** — `karmyq-auth-service#test` hashes 15 inputs, all `src/**` + `package.json`. Editing
  a test replays a cached pass everywhere. Critical Note 9 named mobile and tests as the one-input
  tasks; **`geocoding-service#test` is a third.**
- **`apps/landing/tests/tdd/sprint-99-network-visualization.test.ts` is PASSING and un-promoted** —
  the live fingerprint of the `promote-tdd-tests.js` `APPS_DIR` bug, and PR 2's proof-of-fix.
- **Do NOT bulk-delete `--passWithNoTests`.** It appears in 8 services + `apps/frontend` + `tests`,
  generated by `scripts/add-tdd-scripts.js:17-19` and **explicitly justified in ADR-029**. The plan
  installs a stronger gate instead: per workspace and tier, jest must *list* exactly the test files
  on disk. Only `apps/mobile`'s `passWithNoTests: true` is removed — its comment ("until we write
  mobile tests") is false; a regression test exists and passes 2/2.
- **`@expo/vector-icons` is `^15.0.2`** — independently versioned, so the SDK-alignment gate needs a
  named exception with a reason, plus a stale-exemption assertion.
- **`nav.json` is GENERATED** from `ADR_GROUPS` in `scripts/generate-docs.ts:433` (written at line
  623). Edit the table, never the JSON.
- **Version drift is already repaired** — manifest and both lock sites all read `11.36.0`.

1. ~~Start a fresh chat~~ — plan written in the PR 1 follow-on chat; execution may continue there.
2. **Branch off `origin/master`** (now at `46b2982c`, demo running **v11.36.0**) — never local master.
3. ~~Write the PR 2 plan file first~~ — **done**, see above.
4. **`ADR-088` is still the next free number** — PR 1 deliberately created none.
5. **Budget for discovery.** Fixing `turbo.json`'s `test` inputs makes the cache honest for the
   first time; expect pre-existing failures to surface. Log them to `docs/BUGS.md` and fix only
   what the diff broke — do not let PR 2 become a bug-fixing sprint.
6. **New for PR 2's backlog, found in PR 1:** `messaging-service` contains **zero test files** and
   declares **no `test` scripts** ("14 files checked, 0 matches") — a Critical service with no
   coverage at all, which is why `tsc` was its only Express 5 signal. Log to `docs/BUGS.md`.
7. **Two verification traps PR 1 hit — do not repeat them:**
   - `npx jest unit regression` is an **imprecise positional pattern**: jest matches it against the
     full path and **"comm-unit-y" contains `unit`**, so it silently pulls in DB-dependent
     `integration/` suites and WIP `tdd/` suites. Use `--testPathPattern='(unit|regression)/'`.
   - Root Turbo on Windows fails `npm test` intermittently on a **different service each run with
     no assertion output** — parallel-execution contention, not your diff. Confirm with
     `npx turbo run test --force --concurrency=1` (passes 26/26) or by running the workspace
     directly. Linux CI is unaffected.

## Historical Quick Start (PR 1 — complete, kept for reference)

1. Read this handoff, then the spec and plan below. **The Plan of Record table is authoritative.**
2. Check out the branch — **`deps/sprint-122-pr1-express` ALREADY EXISTS and carries this planning
   commit. Check it out; do not re-cut it.** It was created from `deps/sprint-121-pr6-express`'s tip,
   so it retains that branch's two `docs(handoff)` commits (which were **never** on master) plus the
   Sprint 122 spec/plan/handoff. Its code tree is identical to `origin/master` (`e187c5d6`) — the
   only deltas are documentation.

```powershell
git fetch origin
git checkout deps/sprint-122-pr1-express
git log --oneline -3        # planning commits on top of ab8d9d3d
git diff --stat origin/master -- ':!*.md' ':!.claude'   # must print nothing: no code delta yet
```

   `deps/sprint-121-pr6-express` is superseded but **PR 1 does not delete it** — its commits are
   reachable from this branch, so there is nothing to rescue and nothing to gain from a destructive
   side action mid-migration.

3. Open the plan: [`docs/superpowers/plans/2026-07-29-sprint-122-dependency-wave-test-truth.md`](../../docs/superpowers/plans/2026-07-29-sprint-122-dependency-wave-test-truth.md)
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development). **Tasks 0–12 are PR 1
   (express 4 → 5, v11.36.0).** PRs 2–6 get their own plan files and their own chats.
   **Task 0 is the PowerShell helper preamble — paste it first**, or every later verification can
   silently walk past a failing command (Critical Note 21).
5. **Read Critical Notes 1 and 7 before typing anything.** `overrides.body-parser: "1.20.6"` will
   break express 5 and is the one defect here that can ship green; and `packages/shared` declares
   Express as a **peer** that must move with it.
   **PR 1, 2, 4, 5, 6 are execution-ready. ⚠️ PR 3 is NOT** — three maintainer decisions (D-1 react
   19.2.8, D-2 safe-area-context 5.8.0, D-3 react-native-maps 1.29.0) are open, because #179 wants to
   move three packages away from the versions S121 PR 4 deliberately chose. Record them in the plan
   before starting PR 3.
6. Every merge needs **EXPLICIT admin authorization** (`gh pr merge --squash --admin`), every time.
   Never self-merge.
7. **A green pipeline is not the bar, and neither is a rendered page.** Confirm the master
   **`CI/CD Pipeline`** run reached `Deploy to Demo` = success with no rollback, **then** smoke-test
   the live site. S121 PR 5 passed 20/20 checks, a deploy, a live smoke test *and* a computed-style
   A/B against production, and still shipped a broken font.

## PR 1 Execution Log (in progress)

**Task 0 — helpers wired.** Captured in `scratchpad/s122-helpers.ps1` and dot-sourced per command
(each tool invocation is a fresh shell, so the plan's interactive paste would not persist). Needs
`powershell -ExecutionPolicy Bypass`; scripts are disabled on this box by default. All five
behaviours confirmed: `OK` on success, **throws** on failure with the exit code, location restored
by the `finally`, `Measure-Baseline` records nonzero without throwing, `Invoke-InDir` returns
`Int32`.

**Task 1 — baselines captured on express 4.22.2 (pre-bump).**

| Workspace | `npx jest` (all tiers) | Blocking tier (`unit`+`regression`) | `tsc --noEmit` |
|---|---|---|---|
| `tests` (root) | — | **0** — 286/286 pass | — |
| auth-service | 0 — 68/68 | 0 | 0 |
| community-service | **1** — 13 failed / 144 | **0** — 131/131 | 0 |
| request-service | **1** — 73 failed / 475 | **0** — 393 pass, 1 skip | 0 |
| reputation-service | 0 — 137 pass, 11 skip, 3 todo | 0 | 0 |
| notification-service | 0 — 52/52 | 0 | 0 |
| messaging-service | **1** — ⚠️ **0 tests exist** | n/a | 0 |
| social-graph-service | **1** — 22 failed / 200 | **0** — 166 pass, 3 todo | 0 |
| cleanup-service | 0 — 32 pass, 7 skip | 0 | 0 |
| geocoding-service | 0 — 9/9 | 0 | — (plain JS) |
| packages/shared | — | — | 0 |

- **Every blocking tier is green and all 9 TS workspaces are tsc-clean at 0 errors.** The three red
  `npx jest` runs are red *only* in `tests/integration/` (needs a DB — Docker unavailable locally)
  and `tests/tdd/` (WIP by design). Any tsc error or blocking-tier failure later in this PR is
  unambiguously mine.
- `npm audit --audit-level=moderate` → **`found 0 vulnerabilities`** (Note 8 baseline holds).
- Installed express **4.22.2**; lock version drift confirmed: manifest `11.35.1` vs lock
  `.version`/`.packages[""].version` both **`11.34.0`** (Critical Note 15/6).

**Two plan defects found and corrected during Task 1** (both would have blocked or falsified later
verification):

1. **⚠️ The plan's `npx jest unit regression` is an imprecise positional pattern.** Jest treats the
   args as regexes against the full path, and **"comm-unit-y" contains the substring `unit`** — so
   it silently pulled in 2 `integration/` suites (which cannot pass without a DB) and 5 `tdd/`
   suites, reporting `48 failed / 411` and exit 1. Task 6's *verify* block uses the same command and
   would have thrown for reasons unrelated to express. **Use the workspace's own precise scoping**
   (`--testPathPattern='(unit|regression)/'`, matching its `test:unit`/`test:regression` scripts),
   which reports the true blocking tier: **286/286, exit 0**. The plan's "expect 278/278" is stale
   by 8.
2. **⚠️ `messaging-service` declares no `test` scripts at all and contains zero test files**
   ("14 files checked, 0 matches"), so bare `npx jest` exits 1 there on an empty run — not a
   failure, an absence. A Critical service with no tests means express 5's `messaging` surface has
   no local coverage; its `tsc` clean at 0 errors is the only signal. **Logged for `docs/BUGS.md`;
   out of PR 1's scope to fix.**

**Tasks 2–7 — the express 5 work.** Type fallout was far larger than the plan's "expect few or
none": **83 errors** (82 × TS2345, 1 × TS2339), all from `@types/express` 5 typing route params as
`string | string[]`. Fixed by narrowing, never widening — **zero `as any` in the diff**. One change
to `AuthenticatedRequest extends Request<RouteParams>` cleared 51 of 83; the other 24 are handlers
on bare `Request`, annotated individually. The invariant is **enforced** by
`tests/regression/sprint-122-express5-route-params.test.ts`, proven non-vacuous by injecting a
wildcard, a repeatable param and a legacy optional group and confirming it caught all three.

**Task 9 — gates, run inline per Critical Note 22.**
- **`/simplify`** found the real defect behind my first attempt: I had duplicated `RouteParams`
  into messaging- and notification-service with the justification "these services don't declare
  `@karmyq/shared`". **That justification was wrong** — both import it extensively
  (`messaging-service/src/index.ts:12` even imports `AuthenticatedRequest` from it). The honest fix
  was at a deeper altitude: **three** services (messaging, notification, **cleanup**) import the
  package without declaring it — a live "declare what you import" violation and the reason Turbo
  had no build-order edge to them. All three now declare it; the three duplicate definitions
  collapsed to one. `cleanup-service` also carried a stale comment claiming it "doesn't use shared
  package" while importing `createLogger` from it.
- **`/code-review` HIGH** — all 7 services with an error middleware register it **after** all
  routes (verified by line number) and emit the ADR-074 envelope with stack traces gated behind
  `NODE_ENV === 'development'`. The 2 without one (geocoding, cleanup) try/catch inside every async
  handler. Zero unbounded `res.status()` args, zero `req.query` assignments, zero legacy APIs.
  `apps/frontend` imports only `@karmyq/shared/schemas/*`, never the express-typed `middleware/*`,
  so `@types/express` 5 cannot ripple there.
- **`/security-review`** — lockfile delta (51 added + 11 changed) is clean: every package
  `registry.npmjs.org` + integrity + no install script. The 4 install-script packages in the tree
  are pre-existing and neutralized by ADR-061's `ignore-scripts=true`.

**Task 8 — two dispositions recorded, both deliberate:**

1. **PR 1 owes NO ADR (maintainer decision, 2026-07-30). `ADR-088` stays reserved for PR 2.**
   `feedback:check` advises "Consider creating ADR" because the diff touches 9 services, and
   CLAUDE.md's letter is "cross-service change (3+ services) → ADR". Rationale for declining:
   bumping Express is maintenance, not a new architectural decision — the repo already decided to
   use Express. The two genuinely *new* contracts are the **`RouteParams` convention** and the
   choice of a **single `^5.0.0` peer range over a dual `^4.18.0 || ^5.0.0`**; both are
   shared-package contracts, which CLAUDE.md routes to `packages/shared/CONTEXT.md`, where both are
   now documented with rationale. Renumbering the planned ADR-088 would invalidate PR 2's plan for
   no gain.
2. **`services/registry.json` needs no edit** despite `feedback:check` asking for one. Its
   `dependencies` field records **service and infrastructure** dependencies, not npm packages —
   nothing in it moves for an Express bump. Confirmed empirically: `npm run analyze:services`
   regenerated `dependency-graph.md` / `impact-analysis.md` / `version-drift.md` with **no diff**.
   No endpoint, payload, status code or event contract changed either, so every service's
   "API Endpoints" section is still accurate.

## Sprint Goal

Ship express 4 → 5, make the test tier's cache keys honest, and disposition all 9 open dependency
PRs — 6 merged and deployed, 3 closed with written rationale.

## Documents

| Artifact | Path |
|---|---|
| Design spec | [`docs/superpowers/specs/2026-07-29-sprint-122-dependency-wave-test-truth-design.md`](../../docs/superpowers/specs/2026-07-29-sprint-122-dependency-wave-test-truth-design.md) |
| Implementation plan (PR 1 in full; PRs 2–6 outlined) | [`docs/superpowers/plans/2026-07-29-sprint-122-dependency-wave-test-truth.md`](../../docs/superpowers/plans/2026-07-29-sprint-122-dependency-wave-test-truth.md) |
| Sprint 121 archive | `.claude/handoff/archive/2026-07-29-sprint-121-dependency-backlog-17-OF-18-EXPRESS-CARRIED.md` |

## Multi-Sprint Arc

- **S120** — true scores, one seed path, five-second clarity (complete)
- **S121** — original 18-PR dependency triage (17 of 18; express carried here)
- **S122 — this sprint** — express 5 · test-tier truthfulness · the 8-PR Dependabot wave
- **S123 candidates (not committed)** — either the **platform floor** arc this sprint's three
  closures imply (move the 9 backends off `node:18-alpine` → `@types/node` 26 → TypeScript 7 →
  ESLint 10, in that order), or the **deferred UX audit findings** (R-9 above-the-fold, R-10 sparse-
  member first run, R-12 graph label legibility at 375px) plus the seven surfaces the five-second
  pass never reached. Five consecutive infrastructure sprints is a real cost; the UX arc is the
  counterweight.

## Plan of Record — 6 PRs, 3 closures

| PR | Scope | Closes | Version | `/code-review` | Status |
|---|---|---|---|---|---|
| **1** | **express 4 → 5** (`^5.2.1`, `@types/express ^5.0.6`) | #34 ✅ | **v11.36.0** | **HIGH** | ✅ **SHIPPED** — merged `46b2982c`, deployed, verified live |
| **2** | **test-tier truthfulness** — turbo inputs, promote-tdd walk, `passWithNoTests`, lint print-config gate, SDK-alignment gate, **ADR-088** | — | **v11.37.0** | **HIGH** | ⏸️ **BUILT, 20/20 GREEN — PR #183 awaiting merge review** |
| **3** | **consolidated safe groups** | **#179**, **#178** | **v11.38.0** | MEDIUM | ⚠️ **NOT ready — 3 decisions open** |
| **4** | **jest 29 → 30** (11 workspaces) | #173 | **v11.39.0** | **HIGH** | planned |
| **5** | **redis (node-redis) 4 → 6** | #169 | **v11.40.0** | MEDIUM | planned |
| **6** | **zustand 4 → 5** (mobile only) | #172 | **v11.41.0** | MEDIUM | planned |
| — | closed, held with rationale, **no ignore rule** | #170 eslint 10, #168 typescript 7, #171 @types/node 26 | — | — | planned |

**Accounting:** 1 carried from S121 (#34) + 2 in PR 3 + 1 in PR 4 + 1 in PR 5 + 1 in PR 6 + 3 closed
= **9 open PRs, all assigned.** Every version is set **now, before implementation** — S121 PR 3
shipped without a bump precisely because it was left "TBD."

**⚠️ Grouped Dependabot PR numbers churn.** #176/#167 were already replaced by **#179**/**#178**.
Match on *what a PR bumps*, not its number, and re-list with `gh pr list` at the start of each PR.

**Ordering rationale.** Test-infra-first was considered and rejected: express verification runs the
affected suites **directly**, bypassing Turbo, so the cache bug does not degrade PR 1's evidence.
PR 2 then lands before the four bump PRs whose entire safety argument *is* a cached test run.

**Consolidation option.** PRs 5 and 6 have non-overlapping blast radii (one backend file vs one
mobile file) and could ship as one deploy if fewer master pushes are preferred. Kept separate
because redis is a live-service runtime major and squash-merge makes a combined PR un-revertible in
halves.

## Critical Implementation Notes

Verified by recon on 2026-07-29. **Several contradict S121's roster notes — where they do, these are
correct.** Full versions in the spec; notes 1, 3, 6, 7, 11 are the ones that change what you type.

1. **⚠️ `overrides.body-parser: "1.20.6"` will break express 5.** express `5.2.1` depends on
   `body-parser ^2.2.1`, but the root override is **unscoped**, so it forces `1.20.6` tree-wide —
   into express 5's own tree. Convert it to a range-scoped selector (the shape already used for
   `ws@8.0.0 - 8.20.0`, `form-data@4.0.0 - 4.0.5`, `sharp@<0.35.0`), or drop it once nothing resolves
   body-parser 1. **Prove it with `npm ls body-parser`.** Safety net: `express.json()` *is*
   body-parser and is called in all 9 service entrypoints plus **46 test files**, so the regression
   suites will catch this — rely on both, not either.
2. **⚠️ `overrides.react`/`react-dom` are pinned to exactly `19.2.3`; #179 wants 19.2.8.** A
   workspace-only bump throws `EOVERRIDE`. Root override + root devDep + both apps move together,
   and `npx expo install --check` must still exit 0 afterwards.
3. **⚠️ #179 reverses three deliberate S121 PR 4 decisions.** `react-native-safe-area-context` was
   aligned **DOWN** to `~5.7.0` on purpose (zero importers in mobile source);
   `react-native-maps` was **held** at `1.27.2` because SDK 57 pins it; `react` was pinned exactly.
   **`npx expo install --check` is the arbiter**, not the Dependabot table. Record each re-decision.
4. **`ts-jest` in #178: re-test, don't reflexively exclude.** Root `overrides.ts-jest: "29.4.6"`
   contradicts #178's `^29.4.12`. The original blocker was **TS2307 on the
   `@karmyq/shared/schemas/ui` subpath in request-service tests**, from 29.4.11+ dropping tsconfig
   `moduleResolution: node16` inheritance. S121 closed #163 **without** an ignore rule precisely so
   this could be retried. If 29.4.12 fixed it, take the ranges and **delete the override**.
5. **jest 30 is peer-compatible with the pinned ts-jest — the roster's concern does not apply.**
   Verified: `ts-jest@29.4.6` declares `jest: "^29.0.0 || ^30.0.0"`. PR 4's real risks are
   `jest-environment-jsdom` moving in lockstep, fake-timer/`testEnvironment` default changes, and
   `expect` type shifts.
6. **✅ Express 5's most common blocker is ABSENT — verified.** All **197 unique route path
   literals** across `services/`, `packages/`, `apps/frontend` contain **zero** `*`, `?`, `(`, `)`,
   so `path-to-regexp` 8's syntax break does not apply. Also zero repo-wide: `req.query =`,
   `req.param(`, `res.sendfile`, `app.del(`, `res.json(status, body)`, `req.host`,
   `res.redirect('back')`, `express.urlencoded`. Remaining risk is **runtime semantics**: async
   rejections now auto-forward to the error middleware (**the ADR-074 envelope must still be what
   comes out**), `res.status()` throws `RangeError` on out-of-range codes, `req.query` is a getter.
7. **⚠️ `packages/shared` DOES declare Express — as a PEER (`peerDependencies.express: "^4.18.0"`),
   and PR 1 must move it.** Leaving it makes `@karmyq/shared` — consumed by **6 services and
   `apps/frontend`** — declare a contract nothing in the repo satisfies. **Decision: `^5.0.0`**, not
   a dual range: the repo has exactly one Express provider, so a dual range would advertise support
   nothing verifies. *(Found by maintainer review of the first draft of this plan, which wrongly said
   shared does not declare express — the recon had printed only `dependencies`/`devDependencies`.)*
   The rest of the surface: root `package.json` declares `express ^4.18.2` as a **production** dep —
   that is how all 9 Express backends get it (Dockerfiles copy the root manifest,
   `npm install --omit=dev`); shared's five middleware files live at `packages/shared/middleware/`
   (**outside `src/`**), types only; **`services/geocoding-service/src` is plain JavaScript** with no
   `tsc` coverage — but it **is** tested (`tests/regression/geocodingRoutes.test.js` mounts the real
   app via supertest), so the gap is *type* coverage and the work is to **extend** that suite.
   **⚠️ `geocodingApp.js` has NO express error middleware** — routes try/catch internally and respond
   via `sendError`, so no test there may claim an async rejection reaches an error handler.
   111 source files import from `'express'`, overwhelmingly for types.
8. **`express-rate-limit` is split across majors and express 5 does not force alignment.** Root
   `^8.2.2` (peer `express: ">= 4.11"`), `packages/shared` `^7.1.5` (peer
   `express: "4 || 5 || ^5.0.0-beta.1"`) — both accept express 5. Note it; do **not** fix it in PR 1.
   (`packages/shared` also declares `zod ^3.22.4` vs root `^4.1.12` — same class, same answer.)
9. **turbo `test` inputs are `src/**` + `test/**` (singular).** `@karmyq/mobile#test` and
   `@karmyq/tests#test` each hash **exactly one input: `package.json`**. Fix in PR 2 with
   `$TURBO_DEFAULT$`. **Until then, run every workspace suite directly.** Expect the first honest run
   to surface pre-existing failures — log them to `docs/BUGS.md`; do not let PR 2 become a
   bug-fixing sprint.
10. **`scripts/promote-tdd-tests.js` declares `APPS_DIR` (line 18) and never walks it** (only
    `SERVICES_DIR`, lines 63/65/73/75), so an `apps/*/tests/tdd/` test blocks pushes forever.
11. **`redis` (node-redis) has exactly ONE importer** —
    `services/messaging-service/src/config/redis.ts` (`createClient`), resolved via the **root** prod
    declaration `redis: "^4.6.11"`. **messaging-service does not declare it** — a live "declare what
    you import" violation to fix in PR 5. `ioredis` (Bull's client) is a **different package**, not
    in scope. PR 5 crosses two majors (4→5→6): read the v5 **and** v6 migration notes.
12. **`zustand` is mobile-only** — `apps/mobile/package.json`, one importer
    (`apps/mobile/store/auth.ts`). S121's roster said "frontend state"; that is **wrong**. Mobile
    isn't deployed to the demo, making PR 6 the lowest-risk PR of the six.
13. **`npm audit` baseline is `found 0 vulnerabilities`.** **Advisories publish mid-flight** — four
    times across S120–121. Signature: `Security Audit` **and** `sprint-75-security-gate` red
    **together** on a diff touching no dependencies. Check for a new advisory before debugging;
    remediate with a surgical in-place bump; **re-check immediately before merging**, not just when
    CI last ran. (#179's axios 1.19.0 raises the `form-data` floor for GHSA-hmw2-7cc7-3qxx; root
    already overrides `form-data@4.0.0 - 4.0.5` → `4.0.6`, so it's belt-and-braces.)
14. **Standing mechanics:** surgical in-place lockfile bumps only — never `npm dedupe`, never a
    scratch regen on Windows, never a root **prod** dep added to force hoisting; run the
    **edge-vs-node** check before pushing and diff against `origin/master` so master's ~26
    deliberate `overrides` mismatches don't drown the real finding; only `npm ci` in CI catches
    half-resolution, so run `npm ci --dry-run` locally too; branch off `origin/master`, never local
    master; no docs-only master pushes; TDD tests start in the changed workspace's `tests/tdd/`;
    run cross-workspace suites directly (`cd tests && npx jest regression/<file>`); `npm test`
    regenerates landing docs, so revert timestamp/HEAD-sha churn before committing; grep-verify
    `nav.json` after any landing regen; `apps/landing/src/data/docs/` is gitignored but tracked, so
    regenerated artifacts need `git add -f`.
15. **⚠️ `package-lock.json`'s version is ALREADY drifted at `11.34.0`** while the manifest reads
    `11.35.1` (S121's PR 5 and hotfix never carried their bumps into the lock — both `.version` and
    `.packages[""].version`). **Bump the version BEFORE the lockfile resolution** in every PR this
    sprint, so one `npm install --package-lock-only` lands it in all three places, then **assert all
    three**. Bumping after the lock work silently recreates the drift.
16. **There are 9 Express backends, not 10.** `services/registry.json` lists 10, but
    `simulation-service` has `"health_check": null`, is dev-only and has no Express usage. Every "all
    services" check means the **9 non-null `health_check` entries**: auth 3001, community 3002,
    request 3003, reputation 3004, notification 3005, messaging 3006, cleanup 3008, geocoding 3009,
    social-graph 3010.
17. **All plan commands are PowerShell** (this repo's primary shell). Don't paste POSIX `for` loops,
    subshells, `tail`, `/dev/null` or `||` idioms into execution.
18. **⚠️ `npm install --package-lock-only` installs NOTHING.** It writes the lockfile only; the tree
    stays on the old major. **Materialize with `npm ci` afterwards** (installs from the stabilized
    lock, never regenerates it, and fails loudly on a manifest/lock disagreement). Skip it and
    `npm ls` reports a mismatch while any new-major test still loads the old one.
19. **⚠️ Express's request prototype chain is 3 deep** — incoming `req` → `app.request` →
    `express.request`. The `query` accessor lives on **`express.request`**; `app.request` owns nothing,
    so `Object.getOwnPropertyDescriptor(Object.getPrototypeOf(req),'query')` is `undefined` **even on a
    correct Express 5 install**. Measured on the installed 4.22.2, the discriminator is: Express 4 has
    `query` as an **own writable** property at depth 0 with nothing on `express.request`; Express 5
    inverts both. Assert on `express.request` (plus a chain walk).
20. **New sprint tests start in the changed workspace's `tests/tdd/`** — and here the express 5
    assertions are *designed* to be red pre-bump, so `regression/` would block every push. Promote
    after green. `scripts/promote-tdd-tests.js` walks only `services/`, so a `tests/`-workspace file is
    promoted by hand, and a `services/*` staging file must be **deleted** once folded into an existing
    suite or the script promotes it as a duplicate.
21. **Verification commands must fail loudly.** A PowerShell pipeline succeeds even when the native
    command in it exited nonzero — capture `$LASTEXITCODE` right after the command and throw, with an
    explicit baseline mode for the tiers that are red on master by design. The plan's Task 0 defines
    `Assert-Green` / `Measure-Baseline`; **paste it before anything else.**
22. **Gate calibration** (standing since S120): all four gates every PR, effort scaled to the diff.
    `/code-review` **HIGH** for PRs 1, 2, 4; **MEDIUM** for 3, 5, 6. One `/simplify` pass per PR
    (per-task only on PR 2, the only PR writing real new logic). Run gates **inline**, per the
    S121 PR 3/PR 5 precedent.

## Docs Owed This Sprint (mandatory — not optional on an infra sprint)

- **ADR-088 — test-tier truthfulness** (PR 2): new ADR + `docs/adr/README.md` index + landing
  `concepts/adr-088-*.json` + `nav.json` + a `docs/guides/` testing section. Flip **Proposed →
  Implemented** on deploy. **ADR-088 is the next free number** (highest existing: ADR-087).
- **CLAUDE.md drift repair** (PR 1): § System Architecture says **"Next.js 14"**; both apps run
  `^15.5.21`.
- **`docs/ARCHITECTURE.md`** + regenerated `apps/landing/src/data/docs/architecture.json` (PR 1).
- **`packages/shared/CONTEXT.md`** (PR 1): `@types/express` 5 middleware signatures; record the
  `express-rate-limit` 7/8 and `zod` 3/4 splits as known and out of scope.
- **Carry-forward drift repair** (PR 2): `apps/landing/src/data/docs/concepts/adr-059-*.json` is
  genuinely stale against `docs/adr/ADR-059.md` (missing the S120 "2026-07-21 advisory refresh"
  section). S121 PR 4 regenerated it and reverted as out-of-scope, so **any landing regen re-dirties
  it** until fixed.
- **`services/*/CONTEXT.md` + `services/registry.json`** per changed service, then
  `npm run analyze:services` (PRs 1, 3–6).
- **`docs/IDEAS.md`** (PR 3): record the three closed platform majors as the S123 "platform floor"
  candidate, in dependency order.

## Carry-Forward / Known State

- **Demo runs v11.35.1** (`e187c5d6`), verified live: `document.fonts.check('600 48px Fraunces')` is
  true and the headline measures 902px with Fraunces vs 1004px with Georgia-only.
- **S121 PR 4 follow-ups still open** (each verified real, each deliberately deferred):
  - `turbo.json` wrong `test` inputs → **PR 2 fixes this.**
  - `scripts/promote-tdd-tests.js` `APPS_DIR` never walked → **PR 2.**
  - `apps/mobile/jest.config.js` `passWithNoTests: true` with a now-false comment → **PR 2.**
  - Stale `adr-059-*.json` landing artifact → **PR 2.**
  - **CI never type-checks `apps/mobile`** (`ci.yml` enumerates only `packages/shared`,
    `auth-service`, `community-service`; mobile lint is `|| echo`). Mobile `tsc` is 0 errors for the
    first time, so this is newly possible — but the standing decision is "don't chase mobile green as
    a gate." **Ask before adding.**
  - `react-native-vector-icons` is dead weight (zero imports; Expo's metro aliases it to
    `@expo/vector-icons`) — dependency-pruning pass.
  - `app.json`'s plugin list is half-populated and duplicates permission strings with `infoPlist`;
    `apps/mobile/hooks/useExpoNotifications.ts` duplicates `services/notifications.ts`.
- **S121 PR 5 follow-ups still open:** the 42-line karmyq palette is duplicated across both apps'
  `globals.css` (a shared CSS import is risky because **landing builds on the demo server and a
  failed landing build only logs a warning**); 6 sites carry an explicit off-palette
  `border-gray-200` that ADR-079 would call drift; `@reference` in `karmyq-shell.css` could be
  removed entirely by `@import`ing it into `globals.css`.
- **`apps/frontend/.claude/README.md` and `apps/mobile/.claude/README.md` do not exist**, but
  `CLAUDE.md`'s bootstrap step points at both. The real files are `apps/*/claude.md`. The
  instruction is unsatisfiable as written — worth fixing in a docs pass.
- **Known flakes — do not debug these:** the Windows Turbo timeout flake (confirm by running the
  package directly; `community-service` runs 122/122 in 7.6s directly vs 162.8s under turbo), and
  the `feed-dibs` privacy timestamp flake whose digit regex false-fires on millisecond timestamps
  ~2/1000 runs. A lone CI red on either means **rerun**.
- **Credentials that work (2026-07-28):** `maria.reyes@` (degree 4), `takeshi.osei6315@` (2),
  `fatima.alhassan@` (1), `priya.sharma@` (0), all `password123`. The S89 account in memory
  (`aisha.white6964@`) **401s** — it did not survive the S117 curated reset. Find more by degree with
  `social_graph.trust_edges_live` (columns `user_id_a`/`user_id_b`, **not** `from_user_id`/`to_user_id`).
- **BUG-031 still live**: 33× 404 on `/api/reputation/community-trust/{id}` when loading
  `/communities`. Console-only noise, unfixed, out of scope.
- **BUG-030** live-repro confirmation still pending a maintainer pass (maria.reyes → Fatima Alhassan
  single + `/paths/batch` sweep).
- **S120 deferred UX findings** R-9/R-10/R-12 are in `docs/IDEAS.md`; seven surfaces went unaudited
  in the five-second pass (request detail, create-request wizard, community detail, profile,
  notifications, messaging, md→lg topbar). These are the S123 UX-arc candidate.
- **PLAUSIBLE pre-existing edge**: a localStorage communities snapshot can route a stale-snapshot
  member to `/welcome`. Deferred.
- **Deferred S119 follow-ups**: computeInvitationPath disclosure-gate question, api.ts interceptor
  `clearAuthSession` adoption, cold-cache batch enrichment.
- `curl -o /dev/null -w "%{http_code}"` returns `000` against karmyq.com from this Windows host (a
  schannel TLS-renegotiation quirk, not an outage) — read the response body instead.
- **Untracked in the working tree** (not from this sprint, not mine to commit):
  `.github/copilot-instructions.md`, `.github/instructions/`.
- **Housekeeping**: `git stash@{0}` (`sprint-120-pr153-artifact-wip`) is fully captured in merged
  commits — safe to drop. Two ancient v9.x stashes (`stash@{1}` S36, `stash@{2}` S34) are cruft.
- Docker unavailable locally; DB-backed assertions ride CI. Root Turbo on Windows can hit Jest
  temp-cache `EPERM` — rerun isolated with unique caches under `C:\tmp`; assertion failures are not
  cache races.

## Persistent Context

### Multi-Agent PR Process

- Admin owns scope approval, merge authority, and deploy authorization.
- Claude owns merge-readiness recommendation and is the only agent that marks a sprint complete.
- Contributor agents never self-merge; one branch/PR per task and no direct commits to `master`.
- Copy and fill `.github/pull_request_template.md` when using `gh pr create`.
- The non-authoring agent performs cross-agent review when available.
- Do not independently resolve cross-agent conflicts; pause for reassignment.

### Architecture Gotchas

- Frontend uses the Pages Router (`apps/frontend/src/pages`).
- API interceptor unwraps envelopes: callers consume `res.data`, not `res.data.data`.
- JWT membership field is `communities`, not `communityMemberships`.
- Authorization uses live membership lookup; JWT membership is only a hint.
- Community schema is `communities.*`; auth schema is `auth.*`.
- Error contract is `{ success:false, message:string, error:string }` (ADR-074).
- `social_graph.trust_edges_live` is read-only.
- Request-service owns `/requests/feed`; there is no feed-service.
- `category` and `request_type` are not interchangeable.
- Trust-path topology is platform-wide; strength is community-scoped (ADR-077).
- Reputation/relationship outward contracts remain governed by ADR-082/084.
- Root `CLAUDE.md` is tracked as lowercase `claude.md` on Windows.

### Workflow Gotchas

- TDD tests start in each changed workspace's `tests/tdd/`, then promote when green.
- Run focused workspace suites directly; Turbo can hide or invent cache-related failures.
- Every implementation task runs `/simplify`; every sprint runs `/code-review` and `/security-review`.
- Invoke `pre-commit-check` before every commit.
- Unit + regression must pass before push.
- Run the direct doc-context drift test after generated landing-doc changes.
- Do not create worktrees; this is a shared, time-sliced checkout.
- Do not make a docs-only follow-up push to `master`; every master push triggers a deploy.

### Demo / Deploy Drift Watch

Confirm GitHub Actions deploy succeeded and live content matches `master` before judging the result.
A merge fans out into three master runs — `Tests`, `CodeQL`, `CI/CD Pipeline` — and **only
`CI/CD Pipeline` has a `Deploy to Demo` job**. Demo persona credentials come from server environment
configuration; never commit passwords. Demo-server data ops use DB user `karmyq_prod`.
