# Sprint 122: Dependency Wave + Test-Tier Truth — Design Spec

**Date**: 2026-07-29
**Status**: Approved
**Version**: v11.35.1 → v11.41.0 (six PRs, one version each)
**Sprint Branches**: one per PR, `deps/sprint-122-pr{N}-{slug}` / `chore/sprint-122-pr2-test-truth`

---

## Overview

Sprint 121 resolved 17 of its original 18-PR dependency triage and shipped a hotfix, but the last
item — **express 4 → 5** — never landed. Meanwhile a fresh wave of **8 Dependabot PRs** arrived on
2026-07-29. Sprint 122 absorbs the express migration as its first PR, then works the new wave as
individually-scoped migrations rather than merges, holding three platform majors out of scope.

It also fixes something the last two sprints kept tripping over. `turbo.json`'s `test` task hashes
`src/**` and `test/**` (singular), so `@karmyq/mobile#test` and `@karmyq/tests#test` each hash
**exactly one input — `package.json`**. Once those caches are warm, editing a test or the code it
covers never invalidates them, and root `npm test` reports a green that proves nothing. That is the
mechanical root cause of the "Turbo cache hides cross-workspace failures" gotcha that has been
worked around by hand for several sprints. Two adjacent defects sit in the same layer:
`scripts/promote-tdd-tests.js` declares `APPS_DIR` but never walks it, so an `apps/*/tests/tdd/`
test blocks pushes forever and never promotes; and `apps/mobile/jest.config.js` still carries
`passWithNoTests: true`, which would silently mask a `testMatch` mistake that drops the whole suite.

Fixing the verification machinery matters more than any single bump in this sprint, because every
remaining PR's safety argument rests on "the tests were green."

### Core Principle: A green suite must mean the code was actually tested

A cache key that omits the files under test does not make the suite fast — it makes it decorative.
Every claim this sprint makes about a dependency being safe must trace back to a run that could
have failed.

---

## Multi-Sprint Arc

### Sprint 120 — true scores, one seed path, five-second clarity (complete)

### Sprint 121 — original 18-PR dependency triage (complete except express)
PRs 1–5 shipped + the v11.35.1 landing-font hotfix. **17 of 18 resolved.** #34 (express) carries
into this sprint by maintainer decision (2026-07-29), so S121 archives as
*"resolved 17 of the original 18-PR triage; express carried to Sprint 122."*

### Sprint 122 — this sprint
express 5 · test-tier truthfulness gates · the 8-PR Dependabot wave triaged into 4 PRs + 3 closures.

### Sprint 123 — candidates (not committed)
Either the **platform floor** arc that this sprint's three closures imply — move the 9 backends off
`node:18-alpine`, then `@types/node` 26, then TypeScript 7, then ESLint 10, in that dependency order
— or the **deferred UX audit findings** (R-9 above-the-fold, R-10 sparse-member first run, R-12
graph label legibility at 375px) plus the seven surfaces the five-second pass never reached. Five
consecutive infrastructure sprints is a real cost; the UX arc is the counterweight.

---

## New Concepts

**Test-tier truthfulness.** A test task's cache key must include every file that can change its
result. Operationally: `turbo.json`'s `test` task gets `$TURBO_DEFAULT$` in `inputs`, and any
workspace whose code lives outside `src/` stops being invisible to the hasher.

**Config-verified dependency alignment.** For the Expo surface, `npx expo install --check` is the
arbiter of what version a package should be at — not the Dependabot bump table. Sprint 121 PR 4
established this the hard way; this sprint's PR 3 wants to move three packages *away* from their
SDK-pinned versions, so the check is what decides.

**Closure without suppression.** A held platform major is closed with written rationale and **no
Dependabot ignore rule**, so a future sprint that deliberately raises the floor gets the PR re-raised
rather than silently suppressed. Sprint 121 set this precedent with ts-jest, and it paid off — see
Critical Note 4.

---

## Data Model

**No schema changes this sprint.** No migration is added to
`infrastructure/postgres/migrations/`, no table is created or altered, and
`infrastructure/postgres/init.sql` is untouched. Stated explicitly so no implementer goes looking.

---

## API Endpoints

**No new or removed endpoints.** Express 5 changes the *semantics* underneath the existing 197 route
literals, which is the risk PR 1 manages:

| Area | Express 4 behaviour | Express 5 behaviour | Contract that must survive |
|---|---|---|---|
| Async handler rejection | unhandled → hangs or crashes unless wrapped | forwarded to the error middleware automatically | ADR-074 error envelope `{ success:false, message, error }` |
| `req.query` | writable property | **getter** (assignment throws in strict mode) | no assignment sites exist (verified) |
| `res.status(code)` with invalid code | coerced | throws `RangeError` | all status codes are literals |
| Route path syntax | `path-to-regexp` 0.x | `path-to-regexp` 8 (`*` → `/*splat`, `:p?` → `{/:p}`) | **zero affected paths (verified)** |
| Body parsing | `body-parser` 1.x | `body-parser` **2.x** | see Critical Note 1 — an override blocks this |

Health endpoints and the nginx `/api/{prefix}` routing are unchanged. **There are 9 `/health`
endpoints, not 10:** `services/registry.json` lists 10 services, but `simulation-service` has
`"health_check": null`, is dev-only, and contains no Express usage. Every "all services" criterion in
this sprint means **the 9 registry entries with a non-null `health_check`** — auth (3001), community
(3002), request (3003), reputation (3004), notification (3005), messaging (3006), cleanup (3008),
geocoding (3009), social-graph (3010).

---

## Frontend Changes

| Surface | Change | PR |
|---|---|---|
| `apps/frontend`, `apps/landing` | `react`/`react-dom` 19.2.3 → 19.2.8; `framer-motion`/`motion` 12.42.2 → 12.43.0; `postcss` ^8.5.18 → ^8.5.25; `eslint-config-next` 16.2.9 → 16.2.12 | 3 |
| `apps/mobile` | Expo patch line (`expo` 57.0.8 → 57.0.9 and 6 `expo-*` siblings), `react-native` 0.86.0 → 0.86.2, `react-native-maps` 1.27.2 → 1.29.0, `react-native-safe-area-context` ~5.7.0 → 5.8.0, `react-native-reanimated` 4.5.0 → 4.5.3, `react-native-worklets` 0.10.0 → 0.11.3 | 3 |
| `apps/mobile/store/auth.ts` | `zustand` 4 → 5 — the **only** zustand consumer in the repo | 6 |
| `apps/frontend` test tier | `jest` 29.7.0 → 30.4.2 (+ `jest-environment-jsdom` in lockstep) | 4 |

No component is added, no page is added, no conditional render changes. The UI-change coverage
table in CLAUDE.md therefore applies only through regression: the existing suites must stay green,
and the `apps/landing` production build must still succeed (it builds **on the demo server**, where
a failure only logs a warning).

---

## User Guide & Doc Updates

Every sprint ships docs. This one is infrastructure-heavy, so the docs are developer-facing plus
two genuine drift repairs:

| Doc | Change | PR |
|---|---|---|
| **`docs/adr/ADR-088-test-tier-truthfulness.md`** (new) | Why cache keys must cover the files under test; the `$TURBO_DEFAULT$` decision; the two new blocking gates (lint print-config, Expo SDK alignment); why `passWithNoTests` is removed. Status **Proposed → Implemented** on deploy. | 2 |
| `docs/adr/README.md` | Index ADR-088 (the doc-context drift gate blocks if unindexed) | 2 |
| `apps/landing/src/data/docs/concepts/adr-088-test-tier-truthfulness.json` + `nav.json` | Landing entry — `{ slug, number, title, status, description, content, filename }`. **Grep-verify `nav.json` after the regen; it silently reverts.** | 2 |
| **`docs/guides/`** — testing/verification guide | New section: what each tier means, why workspace suites are run directly, and what changed now that caching is honest. This is the user guide for this sprint's behaviour change. | 2 |
| `apps/landing/src/data/docs/concepts/adr-059-dependency-security-gate.json` | **Carry-forward drift repair.** Genuinely stale against `docs/adr/ADR-059.md` (missing the Sprint 120 "2026-07-21 advisory refresh" section). PR 4 of Sprint 121 regenerated it and reverted as out-of-scope, so **any landing regen re-dirties it** until fixed. Fix it here. | 2 |
| `CLAUDE.md` § System Architecture | **Drift repair:** the tech-stack line says **"Next.js 14"** while both apps run `^15.5.21`. Also confirm the Express reference survives the 4 → 5 move. | 1 |
| `docs/ARCHITECTURE.md` | Express 5 + the dependency baseline; regenerate `apps/landing/src/data/docs/architecture.json` from it | 1 |
| `packages/shared/CONTEXT.md` | `@types/express` 4 → 5 changes the exported middleware signatures (`Request`/`Response` generics); note the express-rate-limit major split | 1 |
| `services/*/CONTEXT.md` + `services/registry.json` | Dependency deltas per changed service; `npm run analyze:services` after | 1, 3–6 |
| `docs/IDEAS.md` | Record the three closed platform majors as the **Sprint 123 "platform floor" candidate**, in dependency order (runtime floor → @types/node → TS → ESLint) | 3 |

---

## Plan of Record — 6 PRs, 3 closures

| PR | Scope | Closes | Version | `/code-review` |
|---|---|---|---|---|
| **1** | **express 4 → 5** (`^5.2.1` + `@types/express` `^5.0.6`) | #34 | **v11.36.0** | **HIGH** |
| **2** | **test-tier truthfulness** — turbo inputs, promote-tdd walk, `passWithNoTests`, lint print-config gate, SDK-alignment gate, ADR-088 | — | **v11.37.0** | **HIGH** |
| **3** | **consolidated safe groups** — production-deps + dev-deps · ⚠️ **NOT execution-ready: 3 maintainer decisions open (D-1…D-3, see the plan)** | **#179**, **#178** | **v11.38.0** | MEDIUM |
| **4** | **jest 29 → 30** across 11 workspaces | #173 | **v11.39.0** | **HIGH** |
| **5** | **redis (node-redis) 4 → 6** | #169 | **v11.40.0** | MEDIUM |
| **6** | **zustand 4 → 5** (mobile only) | #172 | **v11.41.0** | MEDIUM |
| — | closed, held with rationale, **no ignore rule** | #170 eslint 10, #168 typescript 7, #171 @types/node 26 | — | — |

**Accounting:** 1 carried from S121 (#34) + 2 in PR 3 (#179, #178) + 1 in PR 4 (#173) + 1 in PR 5
(#169) + 1 in PR 6 (#172) + 3 closed (#170, #168, #171) = **9 open PRs, all assigned.**

**Ordering note.** Test-infra-first was considered and rejected: express verification is done by
running the affected service suites **directly**, which bypasses Turbo entirely, so the cache bug
does not degrade PR 1's evidence. Express is also already scoped, branched and version-decided from
Sprint 121. PR 2 lands immediately after, before the four bump PRs whose entire safety argument
*is* a cached test run.

**Consolidation option.** PRs 5 and 6 have non-overlapping blast radii (one backend file vs one
mobile file) and could ship as a single deploy if the maintainer prefers fewer master pushes. Kept
separate here because redis is a live-service runtime major and squash-merge makes a combined PR
un-revertible in halves.

**Version discipline.** Every PR's version is set **here, before implementation** — Sprint 121 PR 3
shipped without a bump precisely because it was left "TBD," and the fix had to be smuggled into the
next PR.

---

## Critical Implementation Notes

These are verified facts from recon on 2026-07-29, not triage assumptions. Several contradict the
roster notes in Sprint 121's handoff — where they do, **this document is correct**.

1. **⚠️ `overrides.body-parser: "1.20.6"` will break express 5.** express `5.2.1` depends on
   `body-parser ^2.2.1`, but the root override is **unscoped**, so it forces `1.20.6` tree-wide —
   into express 5's own tree. Express 5 calls body-parser 2's API. Convert the override to a
   range-scoped selector (the shape already used for `ws@8.0.0 - 8.20.0`, `form-data@4.0.0 - 4.0.5`,
   `sharp@<0.35.0`), or drop it once nothing resolves body-parser 1. **Prove it with
   `npm ls body-parser`** — express 5's tree must show 2.x. This is the single most likely way to
   ship an express 5 that builds green and drops every request body.

2. **⚠️ `overrides.react` / `overrides.react-dom` are pinned to exactly `19.2.3`.** #179 wants
   19.2.8. A workspace-only bump throws `EOVERRIDE: Override for react@19.2.3 conflicts with direct
   dependency`. The root override, the root's own devDependency, and both apps' declarations must
   move together — Sprint 121 PR 4 hit this exact wall. Afterwards `npx expo install --check` must
   still exit 0 (SDK 57 pins 19.2.3, so this deliberately moves *ahead* of the SDK).

3. **⚠️ #179 reverses three deliberate Sprint 121 PR 4 decisions.** Do not accept the table:
   - `react-native-safe-area-context` was aligned **DOWN** to `~5.7.0` on purpose (the 5.8.0 pin
     dated to the original scaffold and the package has **zero** importers in mobile source).
     #179 pushes it back to 5.8.0.
   - `react-native-maps` was deliberately left at `1.27.2` because **SDK 57 pins exactly that**.
     #179 wants 1.29.0.
   - `react` was pinned **exactly** 19.2.3 to match SDK 57 and satisfy `expo install --check`.
   Re-decide each against `npx expo install --check`, and record the decision. Aligning with the
   SDK and aligning with Dependabot are now in conflict; the SDK check is the arbiter.

4. **`ts-jest` in #178 is Sprint 121 PR 2's trap — but re-test before repeating the exclusion.**
   Root `overrides.ts-jest: "29.4.6"` contradicts #178's `^29.4.12` ranges, so taking them blind
   leaves every manifest declaring a range the override contradicts. **The original blocker was
   specific:** 29.4.11+ stopped merging the project tsconfig's `moduleResolution: node16` into the
   root jest inline tsconfig → **TS2307 on the `@karmyq/shared/schemas/ui` subpath in
   request-service tests**. Sprint 121 closed #163 *without* a Dependabot ignore rule exactly so a
   fixed version could be re-raised — this is that PR. **Try 29.4.12, run the request-service
   suite, and if TS2307 is gone take the ranges and delete the override.** Only fall back to
   excluding ts-jest from #178 if the regression persists.

5. **jest 30 is peer-compatible with the pinned ts-jest — the roster's concern does not apply.**
   Verified: installed `ts-jest@29.4.6` declares `jest: "^29.0.0 || ^30.0.0"` (and the same dual
   range for `@jest/transform`, `@jest/types`, `babel-jest`, `jest-util`). PR 4's real risks are
   elsewhere: `jest-environment-jsdom` must move to 30 in lockstep with `apps/frontend`, jest 30
   changes fake-timer and `testEnvironment` defaults, and `expect` type signatures shift. #173
   touches **11 workspaces** (`apps/frontend`, `apps/mobile`, `packages/shared`, 6 services,
   `tests`, root) — the entire test tier is the blast radius, which is why it reviews at HIGH.

6. **✅ Express 5's most common migration blocker is ABSENT here — verified, not assumed.** All
   **197 unique route path literals** across `services/`, `packages/` and `apps/frontend` contain
   **zero** `*`, `?`, `(` or `)`, so `path-to-regexp` 8's syntax break does not apply. Also zero
   occurrences repo-wide of `req.query =` assignment, `req.param(`, `res.sendfile`, `app.del(`, and
   `res.json(status, body)`. The remaining risk is **runtime semantics** — automatic async-rejection
   forwarding and `res.status()` throwing on invalid codes — not syntax.

7. **⚠️ `packages/shared` DOES declare Express — as a PEER, and it must move.**
   `packages/shared/package.json` carries `"peerDependencies": { "express": "^4.18.0" }`. Bumping the
   provider to Express 5 without moving this leaves `@karmyq/shared` — consumed by **6 services and
   `apps/frontend`** — declaring a contract nothing in the repo satisfies.
   **Decision: set it to `^5.0.0`, not a dual `^4.18.0 || ^5.0.0` range.** The repo has exactly one
   Express provider (the root production dependency), so after PR 1 no build, test or image exercises
   Express 4 anywhere; a dual range would advertise support that is never verified — the same class of
   decorative claim this sprint exists to remove. A dual range is acceptable only if actually
   **verified** by running `packages/shared`'s suite against both majors.
   *(Pre-existing, out of scope: `apps/frontend` consumes `@karmyq/shared` without providing Express
   at all, so this peer is already unsatisfied there; `.npmrc`'s `legacy-peer-deps=true` silences it.)*

8. **The rest of the express surface, corrected against Sprint 121's Critical Note 5.** Verified:
   - **Root `package.json` declares `express ^4.18.2` as a PRODUCTION dependency.** That is how all
     9 Express backends get it: their Dockerfiles copy the root manifest and run
     `npm install --omit=dev`.
   - `packages/shared`'s five middleware files
     (`packages/shared/middleware/{auth,dbContext,rateLimit,tenant,validate}.ts` — note: **outside
     `src/`**) import `Request`/`Response`/`NextFunction` as types only; the package also declares
     `@types/express ^4.17.21` (dev) and `express-rate-limit ^7.1.5` (prod).
   - **`services/geocoding-service/src` is plain JavaScript** (`geocodingApp.js`,
     `geocodingService.js`, `response.js`) and declares `express` directly, so it gets **no `tsc`
     coverage**. It is **not** untested, though —
     `services/geocoding-service/tests/regression/geocodingRoutes.test.js` already mounts the real
     `createApp` through supertest and asserts the ADR-074 envelope. **The gap is type coverage, not
     test coverage**, so the work is to extend that suite rather than write a new one.
   - **⚠️ `geocodingApp.js` has NO express error middleware** — every route try/catches internally and
     responds via `sendError`. So no test may claim that an async rejection reaches an error handler in
     *that* service; check for an error middleware before writing any such test elsewhere.
   - **111 source files import from `'express'`**, overwhelmingly for types.

9. **`express-rate-limit` is split across majors and express 5 does not force the alignment.** Root
   declares `^8.2.2`; `packages/shared` declares `^7.1.5`. Verified peers: v8 wants
   `express: ">= 4.11"`, v7.1.5 wants `express: "4 || 5 || ^5.0.0-beta.1"` — **both accept
   express 5**. Note the split, do **not** fix it inside PR 1. (`packages/shared` also declares
   `zod ^3.22.4` against root's `^4.1.12` — same class of pre-existing split, same answer:
   out of scope, worth its own pass.)

10. **turbo `test` inputs are `src/**/*.ts(x)` + `test/**/*.ts(x)` — singular `test`.** Confirmed
   from `turbo.json`. `apps/mobile` has neither directory (its code is in `app/`, `services/`,
   `components/`, `hooks/`, `store/`, `utils/`; its tests in `tests/`, **plural**), so
   `@karmyq/mobile#test` and `@karmyq/tests#test` each hash **exactly one input: `package.json`**.
   Fix: add `$TURBO_DEFAULT$` to the task's `inputs`. **Expect the first honest run to surface
   pre-existing failures** — that is the point, but it must not turn PR 2 into a bug-fixing sprint.
   Log what it finds to `docs/BUGS.md` and fix only what the diff itself broke.

11. **`scripts/promote-tdd-tests.js` declares `APPS_DIR` (line 18) and never walks it** — only
    `SERVICES_DIR` (lines 63, 65, 73, 75). An `apps/*/tests/tdd/` test therefore blocks pushes
    forever and never promotes. This is why Sprint 121 PR 4 had to put a mobile test in
    `tests/unit/` instead. Fix the walk to cover both roots.

12. **`redis` (node-redis) has exactly ONE importer** — `services/messaging-service/src/config/redis.ts`
    (`import { createClient } from 'redis'`). Installed at 4.7.1 via the **root** prod declaration
    `redis: "^4.6.11"`; **`messaging-service` does not declare it**, which violates the standing
    "declare what you import" rule. PR 5 bumps the root declaration to 6 **and** adds the
    declaration to `messaging-service`. `ioredis` (`^5.11.1`, used by Bull) is a *different*
    package and is not in scope. node-redis 5 and 6 are both majors: `createClient` options and the
    `RESP3`/type surface changed — read the v5 **and** v6 migration notes, not just v6's.

13. **`zustand` is mobile-only** — declared solely in `apps/mobile/package.json`, imported by
    exactly one file, `apps/mobile/store/auth.ts`. The Sprint 121 roster's "frontend state" is
    **wrong**. `apps/mobile` is not deployed to the demo, making PR 6 the lowest-risk PR of the six.

14. **`npm audit` is currently `found 0 vulnerabilities`.** That is the baseline. Sprint 121 saw
    **four** advisories publish mid-flight; the signature is `Security Audit` and
    `sprint-75-security-gate` going red **together** on a diff that touches no dependencies. Check
    for a new advisory before debugging anything, remediate with a surgical in-place bump, and
    **re-check the gate immediately before merging, not just when CI last ran.** Note #179's axios
    1.19.0 raises the `form-data` floor for GHSA-hmw2-7cc7-3qxx — root already overrides
    `form-data@4.0.0 - 4.0.5` → `4.0.6`, so this is belt-and-braces, not a live finding.

15. **Standing mechanics** (unchanged, all load-bearing): surgical in-place lockfile bumps only —
    never `npm dedupe`, never a scratch regen on Windows, never a root **prod** dep added to force
    hoisting; run the **edge-vs-node** check before any multi-workspace bump and diff against
    `origin/master` so the ~26 deliberate `overrides` mismatches don't drown the real finding;
    branch off `origin/master`, never local master; **explicit admin authorization for every
    squash merge**; no docs-only master pushes; TDD tests start in the changed workspace's
    `tests/tdd/`; run cross-workspace suites directly (`cd tests && npx jest regression/<file>`);
    `npm test` regenerates landing docs, so revert timestamp/HEAD-sha churn before committing;
    grep-verify `nav.json` after any landing regen.

16. **A green pipeline is not the bar, and neither is a rendered page.** Every PR ends with two
    verifications: the master **`CI/CD Pipeline`** run (a merge fans out into three runs — `Tests`,
    `CodeQL`, `CI/CD Pipeline` — and **only the last has a `Deploy to Demo` job**) reaching
    `Deploy to Demo` = success with no rollback, **then** a live smoke test. Sprint 121 PR 5 passed
    20/20 checks, a successful deploy, a live smoke test *and* a computed-style A/B against
    production, and still shipped a broken font — because an unloaded font computes an identical
    `font-family`. **Assert on built artifacts for anything to do with asset loading.**

17. **⚠️ `package-lock.json`'s version field is ALREADY drifted, and the naive task order re-breaks
    it.** The manifest reads `11.35.1` while the lock records **`11.34.0`** in *both* `.version` and
    `.packages[""].version` — Sprint 121's PR 5 and hotfix never carried their bumps into the lock.
    Consequence for every PR this sprint: **bump the version BEFORE the lockfile resolution**, so one
    `npm install --package-lock-only` lands it in all three places, and **assert all three
    afterwards**. Bumping the manifest after the lock work (the obvious ordering) silently recreates
    the drift. PR 1 closes the existing gap as a side effect of doing the order right.

18. **There are 9 Express backends, not 10** — see § API Endpoints. `simulation-service` is dev-only
    with `"health_check": null` and no Express usage, so it is outside every express-migration and
    health-verification criterion.

19. **⚠️ `npm install --package-lock-only` does NOT install anything.** It is the only sanctioned way
    to *write* the lockfile (Note 15 bans `npm dedupe` and scratch regens), but it leaves
    `node_modules` untouched. Every dependency PR this sprint must **materialize the tree afterwards
    with `npm ci`** — which installs strictly from the stabilized lock, does not regenerate it, and
    fails loudly if manifest and lock disagree. Skipping it means `npm ls` reports a mismatch and any
    test asserting the new major still loads the old one.

20. **⚠️ Express's request prototype chain is 3 deep — assert on `express.request`, not
    `Object.getPrototypeOf(req)`.** Measured on the installed Express 4.22.2: the incoming request's
    immediate prototype is `app.request` (created per-app via `Object.create`), whose prototype is the
    shared `express.request` object where the `query` accessor is defined. `app.request` owns **no**
    `query` descriptor, so a descriptor assertion one level up returns `undefined` **even on a correct
    Express 5 install** — a test written that way fails for the wrong reason. Same measurement gives
    the clean Express 4/5 discriminator: on 4, `query` is an **own, writable** property of the request
    itself (depth 0) and `express.request` owns nothing; Express 5 inverts both halves.

21. **⚠️ New sprint tests start in the changed workspace's `tests/tdd/`, always** (CLAUDE.md), and
    this sprint has a concrete reason beyond policy: the express 5 contract assertions are *designed*
    to be red before the bump, so staging them in `regression/` would block every push until the bump
    lands. Promote after green. Note `scripts/promote-tdd-tests.js` walks only `services/`, so a
    `tests/`-workspace file is promoted by hand — and a `services/*` staging file must be **deleted**
    once its cases are folded into an existing suite, or the script will promote it as a duplicate.

22. **Verification commands must fail loudly.** A PowerShell pipeline "succeeds" even when the native
    command inside it exited nonzero, so `npx jest 2>&1 | Select-Object -Last 4` prints a failure and
    execution carries on. Capture `$LASTEXITCODE` immediately after the native command and throw on
    nonzero — with a deliberate **baseline mode** for the tiers that are red on master by design.

23. **Gate calibration** (standing since S120): all four gates run every PR; effort scales with the
    diff. `/code-review` **HIGH** for PRs 1, 2 and 4; **MEDIUM** for 3, 5, 6. One `/simplify` pass
    per PR (per-task only on PR 2, which is the only PR writing real new logic).

---

## Definition of Done

- [ ] All 9 open PRs dispositioned: 6 merged-and-deployed, 3 closed with written rationale and no ignore rule
- [ ] PR 3's three open decisions (D-1 react, D-2 safe-area-context, D-3 react-native-maps) recorded in the plan before it starts
- [ ] Demo runs **v11.41.0**, verified by `CI/CD Pipeline` → `Deploy to Demo` success **and** a live smoke test
- [ ] All **9** deployed backends healthy (the non-null `health_check` registry entries; `simulation-service` is excluded by design)
- [ ] `package.json`, `package-lock.json` `.version` and `.packages[""].version` all agree — the pre-existing `11.34.0` drift is closed
- [ ] `packages/shared`'s `peerDependencies.express` matches the provider Express major
- [ ] `npm test` is trustworthy: `turbo run test --dry` shows every workspace hashing its real sources
- [ ] Two new blocking gates green: lint print-config per workspace, Expo SDK alignment
- [ ] ADR-088 written, indexed, published to landing, and flipped to **Implemented**
- [ ] `npm audit` = 0 vulnerabilities at the final merge
- [ ] Sprint 121 archived with the corrected completion statement (17 of 18; express carried)
- [ ] Handoff updated after every PR, not just at sprint end
