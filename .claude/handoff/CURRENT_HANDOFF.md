# Sprint 122 — Dependency Wave + Test-Tier Truth — PR 1 AWAITING MERGE AUTHORIZATION

> ## ⏸️ CURRENT STATE (2026-07-30): PR #180 is open, 19/20 checks green, **NOT merged.**
>
> **Blocked on two maintainer actions, both requiring explicit authorization:**
>
> 1. **Dismiss one CodeQL alert** — `js/missing-rate-limiting` (high) at
>    `services/request-service/src/routes/admin-schemas.ts:501`. **Verified false positive.**
>    CodeQL counts it as "new" only because this PR touched line 501, and the change there is the
>    one-word annotation `req: Request` → `req: Request<RouteParams>`. The route is protected by
>    **three** layers the rule cannot see (it only inspects the handler's own chain, not mount-level
>    `app.use`): `app.use(globalRateLimiter)` at `index.ts:59`, `rateLimiters.standard` on the
>    `/admin/schemas` mount at `index.ts:86`, and `...adminAuth` at `index.ts:87`. The real gate,
>    `Code Scanning Gate (ADR-060)`, **passed**.
> 2. **Authorize the squash merge** — `gh pr merge 180 --squash --admin`. Never self-merged.
>
> Everything else is done: Tasks 0–10 complete and verified. **Tasks 11 (merge) and 12 (deploy +
> live smoke test) remain.**
>
> **PR:** https://github.com/ravichavali/karmyq/pull/180 · branch `deps/sprint-122-pr1-express`
> · commits `7a980a89` (express 5) + `9f53db3e` (req.body fix)
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

## Quick Start

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
| **1** | **express 4 → 5** (`^5.2.1`, `@types/express ^5.0.6`) | #34 | **v11.36.0** | **HIGH** | **NEXT** |
| **2** | **test-tier truthfulness** — turbo inputs, promote-tdd walk, `passWithNoTests`, lint print-config gate, SDK-alignment gate, **ADR-088** | — | **v11.37.0** | **HIGH** | planned |
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
