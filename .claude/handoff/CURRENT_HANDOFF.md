# Sprint 122 — Dependency Wave + Test-Tier Truth — PR 2 SHIPPED · PR 3 IS NEXT

> ## ✅ PR 2 COMPLETE (2026-08-03): test-tier truthfulness merged, deployed and verified live at v11.37.0.
>
> **PR #183 squash-merged** as `b4041506` at 16:16:48Z (explicit maintainer authorization).
> `CI/CD Pipeline` run **30831436854** reached **`Deploy to Demo` = success with no rollback**
> (16:26:45 → 16:33:46); its internal sweep reported **all 9 backends healthy**.
> Master is `b4041506`; manifest and lockfile both read **11.37.0**.
>
> ### Live smoke test — PASSED
>
> | Leg | Result |
> |---|---|
> | Happy path — `maria.reyes@test.karmyq.com` | **200**, `success:true`, JWT carries `communities[]` (6) |
> | Error path — wrong password | **401** ADR-074 envelope, `UNAUTHORIZED`, no stack trace or internal detail |
> | **Bodyless POST** (PR 1's regression) | **400 `VALIDATION_ERROR`, not 500** — still fixed |
> | Landing | serves HTML |
>
> This PR changed **no runtime code**, so the smoke test confirms a clean deploy rather than new
> behavior. Note `curl -o /dev/null -w` reports `0`/`000` from this Windows host (schannel TLS
> quirk, not an outage) — **read the response body instead**.
>
> ### What shipped
>
> Four mechanisms that let a green test result be produced without evidence, each repaired at
> source and locked behind a blocking gate, with **ADR-088** recording the principle:
> *a green test result must be evidence that the current code was tested.*
>
> | Defect | Before | After |
> |---|---|---|
> | `turbo.json` hashed `test/**` (**singular**) while every workspace uses `tests/` (**plural**) — **no `#test` task hashed any test file, jest config or setup file** | auth hashed 15 inputs (all `src/**`); mobile, `tests`, geocoding hashed **1** file each | `$TURBO_DEFAULT$`; auth 15→38, mobile 1→50, geocoding 1→13, `tests` 1→138, frontend 225→377, landing 32→202 |
> | `promote-tdd-tests.js` declared `APPS_DIR`, never walked it (runs as `posttest`) | `apps/landing`'s sprint-99 test passing and stranded | testable `collectTddTargets()`; **5 tests promoted** |
> | `apps/mobile` `passWithNoTests: true` under "until we write mobile tests" | a regression test existed, passing 2/2 | flag removed; tier **coverage** asserted |
> | lint runs `\|\| echo` in CI, so a config that throws on load yields a green job | never verified | `--print-config` gate over all 4 configs |
>
> Plus **D-4** (CI type-checks `apps/mobile`) and **D-5** (dead root `mobile/` scaffold deleted).
>
> ### Decisions on record — do not re-debate
>
> | # | Decision |
> |---|---|
> | **D-4** | CI type-checks `apps/mobile`, blocking. Overrode "don't chase mobile green as a gate." |
> | **D-5** | Root-level `mobile/` scaffold (Expo SDK 50, not a workspace) deleted. |
> | **D-6** | TDD promoter stays **`.ts`-only**. `apps/frontend/tests/tdd/` holds **72 `.test.tsx` vs 2 `.test.ts`**; 67 of 74 would promote (~442 tests into the blocking tier at once). **BUG-033**. ADR-088 states the limitation rather than claiming the promoter is fixed. |
> | — | `--passWithNoTests` **not** bulk-deleted — ADR-029 justifies it for empty tiers. ADR-088 **amends** ADR-029 and asserts coverage instead. |
> | — | `@karmyq/tests#test` is **uncached** (`cache: false`) — its gates audit *other* workspaces, so package-local inputs cannot see what they check and a warm cache would replay them. |
>
> ### ⚠️ The lesson that matters most from this PR
>
> **Four consecutive maintainer review rounds each found the same defect class in my gates:
> an assertion weaker than the property it claimed.**
>
> `count → identity` · `floor → exact` · `presence → blocking` · `truthiness → semantics`
>
> Concretely: the lint gate compared `PROBES` to a copy of itself; the Expo gate used
> `sdkMajor >= 57` beside a frozen SDK-57 matrix (so the whole family could move to 58); the CI
> gate asserted `invocations.length >= 4` (so a duplicate workspace hid a dropped one), then that
> the step's lines merely *existed* (`if: false` / `shell: bash {0}` / job `continue-on-error` all
> passed), then that each `type-check` script was merely *truthy* (`"echo skipped"` passed).
>
> **The code under test was correct every time. The assertions were the defect.** Root cause:
> I proved each gate non-vacuous against *the failure I had in mind when writing it* — which is by
> construction the one it already handled. One injection proves a gate isn't inert, not that it
> constrains the property. See `feedback_gates_assert_weaker_than_claimed` in memory.
>
> **Also caught by CI/review, not by me:** an empty `apps/landing/tests/tdd/` (git doesn't track
> empty dirs) would have turned a **blocking** tier red on first push; and CodeQL #571
> (`js/command-line-injection`, critical) on a shell string built from `package.json` scripts,
> which my own `/security-review` had waved past as "repo-controlled, low risk."
>
> ### 🔴 OWED — first actions in the next chat
>
> 1. **Flip ADR-088 `Proposed` → `Implemented`.** It is deployed. Master currently reads
>    `**Status**: Proposed` in `docs/adr/ADR-088-test-tier-truthfulness.md`, plus its
>    `docs/adr/README.md` index entry and the regenerated landing JSON.
>    **Carry this into PR 3's branch — never a docs-only master push** (every master push is a
>    full deploy → demo 502s).
> 2. Consider an adversarial sweep of the four other gates (turbo cache-key, tier-coverage,
>    lint-config, Expo SDK) for the same weaker-than-claimed class. Only the CI type-check gate
>    was hardened across four rounds; the others were each proven against a single injection.

> **SPRINT 121 IS ARCHIVED** to
> `.claude/handoff/archive/2026-07-29-sprint-121-dependency-backlog-17-OF-18-EXPRESS-CARRIED.md`.
> **PR 1 (express 4 → 5, v11.36.0, `46b2982c`)** shipped 2026-07-30 and is live.

## Quick Start — PR 3

1. **Start a fresh chat** (per-PR cadence). Branch off **`origin/master`** (now `b4041506`,
   demo running **v11.37.0**) — never local master.
2. **First: flip ADR-088 to Implemented** on PR 3's branch (see OWED above).
3. **⚠️ PR 3 is NOT execution-ready — three decisions are open (D-1/D-2/D-3, below).**
4. **PR 2 made those decisions mechanical.** `SDK_PINNED` in
   `tests/regression/sprint-122-expo-sdk-alignment.test.ts` freezes `react`, `react-dom`,
   `react-native`, `react-native-maps`, `react-native-safe-area-context` **plus six more**
   SDK-managed packages, and a separate `SDK_MAJOR = 57` constant pins the generation. Moving any
   of them **requires editing that file with a written reason**, and `npx expo install --check`
   must still exit 0. Verified: injecting D-2's actual proposal (`~5.7.0` → `5.8.0`) turns the
   gate red.
5. Read the sprint spec/plan: `docs/superpowers/specs|plans/2026-07-29-sprint-122-dependency-wave-test-truth*`.

## Sprint Goal

Ship express 4 → 5, make the test tier's cache keys honest, and disposition all 9 open dependency
PRs — 6 merged and deployed, 3 closed with written rationale.

## Plan of Record — 6 PRs, 3 closures

| PR | Scope | Closes | Version | Status |
|---|---|---|---|---|
| **1** | express 4 → 5 | #34 ✅ | v11.36.0 | ✅ **SHIPPED** `46b2982c` |
| **2** | test-tier truthfulness + **ADR-088** | — | **v11.37.0** | ✅ **SHIPPED** `b4041506`, deployed, verified live |
| **3** | consolidated safe groups | **#179**, **#178** | v11.38.0 | ⚠️ **NOT ready — D-1/D-2/D-3 open** |
| **4** | jest 29 → 30 | #173 | v11.39.0 | planned |
| **5** | redis (node-redis) 4 → 6 | #169 | v11.40.0 | planned |
| **6** | zustand 4 → 5 (mobile only) | #172 | v11.41.0 | planned |
| — | closed with rationale, **no ignore rule** | #170 eslint 10, #168 typescript 7, #171 @types/node 26 | — | planned |

**⚠️ Grouped Dependabot PR numbers churn** — match on *what a PR bumps*, not its number, and
re-list with `gh pr list` at the start of each PR.

## PR 3's open decisions

| # | Package | S121 PR 4 chose | #179 wants | Decision |
|---|---|---|---|---|
| D-1 | `react` / `react-dom` | exactly `19.2.3` (root `overrides` + root devDep + both apps) | `19.2.8` | **OPEN** |
| D-2 | `react-native-safe-area-context` | aligned **down** to `~5.7.0` (zero importers in mobile source) | `5.8.0` | **OPEN** |
| D-3 | `react-native-maps` | **held** at `1.27.2` (SDK 57 pins it) | `1.29.0` | **OPEN** |

- A workspace-only react bump throws `EOVERRIDE` — root override + root devDep + both apps move together.
- **`npx expo install --check` is the arbiter**, not the Dependabot table.
- `ts-jest` in #178: **re-test, don't reflexively exclude.** Root `overrides.ts-jest: "29.4.6"`
  contradicts #178's `^29.4.12`. The original blocker was TS2307 on the
  `@karmyq/shared/schemas/ui` subpath in request-service tests. #163 was closed **without** an
  ignore rule precisely so this could be retried; if 29.4.12 fixed it, take the ranges and
  **delete the override**.
- Close #170 / #168 / #171 with written rationale and **no ignore rule**; record them in
  `docs/IDEAS.md` as the S123 "platform floor" candidate, in dependency order:
  **runtime floor off `node:18-alpine` → @types/node 26 → TS 7 → ESLint 10.**

## Standing mechanics (carried forward)

- **Branch off `origin/master`, never local master.** Never force-push; never direct-push to master.
- **Every merge needs EXPLICIT authorization** (`gh pr merge --squash --admin`), every time.
- **No docs-only master pushes** — every master push is a full deploy.
- Surgical in-place lockfile bumps only; never `npm dedupe`, never a scratch regen on Windows.
  `npm install --package-lock-only` installs **nothing** — materialize with `npm ci`.
- **Bump the version BEFORE the lockfile resolution**, then assert all three sites
  (`package.json`, lock `.version`, lock `.packages[""].version`).
- **Advisories publish mid-flight** — re-run `npm audit` immediately before merging, not just when
  CI last ran. Signature: `Security Audit` **and** `sprint-75-security-gate` red together on a
  no-dependency diff.
- **Run cross-workspace suites directly** (`cd tests && npx jest regression/<file>`), not via Turbo.
- **`npx jest unit regression` is an imprecise positional pattern** ("comm-unit-y" contains `unit`).
  Use `--testPathPattern='(unit|regression)/'`.
- `npm test` regenerates landing docs — revert timestamp/HEAD-sha churn before committing.
  `apps/landing/src/data/docs/` is gitignored but tracked → `git add -f`.
- **`nav.json` is GENERATED** from `ADR_GROUPS` in `scripts/generate-docs.ts`. Never hand-edit it.
- **Do not record volatile values (head sha, commit counts, CI verdicts) in this file** — they went
  stale three times during PR 2's review. Use `gh pr view` / `gh pr checks`.
- **Known flakes — rerun, don't debug:** the Windows Turbo timeout flake (a different service each
  run, no assertion output) and the `feed-dibs` privacy timestamp flake (~2/1000).
- Docker unavailable locally; `integration/` tiers ride CI.
- **Credentials (2026-07-28):** `maria.reyes@` (degree 4), `takeshi.osei6315@` (2),
  `fatima.alhassan@` (1), `priya.sharma@` (0), all `password123`.
- **`/health` is not reachable through nginx** — routers mount at `/auth`, `/communities`, … while
  `/health` sits at the service root. The CI deploy job's internal sweep is authoritative.
  `/communities/my` is **not** a route; the real one is `/my/communities` with a `user_id` param.

## Known issues / carry-forward

- **BUG-033** — TDD promoter blind to `.test.tsx` (72 vs 2 in `apps/frontend/tests/tdd/`).
- **BUG-034** — `services/messaging-service`, a **Critical** service, has **zero** test files and no
  `test` script. A "every Critical service has tests" gate cannot land while it would be red.
- **BUG-031** — 33× 404 on `/api/reputation/community-trust/{id}` loading `/communities`.
  Console-only noise.
- **BUG-030** — live-repro confirmation still pending a maintainer pass.
- Deferred from PR 2's final review, non-blocking: `promote-tdd-tests.js:47` carries the same
  shell-string shape CodeQL did *not* flag (left alone — it runs as `posttest`); a new-service
  scaffold will trip the turbo gate with a bare task-id array and no guidance; colocated
  `src/**/__tests__` tests in `apps/frontend` would never run under `npm test` (zero exist today).
- **`password123` appears in 81 files on master** (landing docs, Maestro configs, `DATA_FLOWS.md`)
  while CLAUDE.md says "never commit passwords." The rule and the practice disagree — worth a
  deliberate decision rather than continued drift.
- S121 PR 4/PR 5 follow-ups still open: `react-native-vector-icons` is dead weight; `app.json`'s
  plugin list is half-populated; the 42-line karmyq palette is duplicated across both apps'
  `globals.css`; 6 sites carry off-palette `border-gray-200`.
- **`apps/frontend/.claude/README.md` and `apps/mobile/.claude/README.md` do not exist** though
  CLAUDE.md's bootstrap points at both. The real files are `apps/*/claude.md`.
- **Untracked, not mine to commit:** `.github/copilot-instructions.md`, `.github/instructions/`.

## Multi-Sprint Arc

- **S120** — true scores, one seed path, five-second clarity (complete)
- **S121** — original 18-PR dependency triage (17 of 18; express carried)
- **S122 — current** — express 5 ✅ · test-tier truthfulness ✅ · the Dependabot wave (PRs 3–6)
- **S123 candidates** — the **platform floor** arc the three closures imply (node:18-alpine →
  @types/node 26 → TS 7 → ESLint 10), or the **deferred UX audit findings** (R-9, R-10, R-12) plus
  the seven surfaces the five-second pass never reached. Five consecutive infrastructure sprints is
  a real cost; the UX arc is the counterweight.

## Persistent Context

### Architecture Gotchas

- Frontend uses the Pages Router (`apps/frontend/src/pages`).
- API interceptor unwraps envelopes: callers consume `res.data`, not `res.data.data`.
- JWT membership field is `communities`, not `communityMemberships`; authorization must re-derive
  membership from a **live lookup** — the claim is a login-time snapshot.
- Error contract is `{ success:false, message:string, error:string }` (ADR-074).
- `social_graph.trust_edges_live` is read-only (columns `user_id_a`/`user_id_b`).
- Request-service owns `/requests/feed`; there is no feed-service.
- `category` and `request_type` are not interchangeable.
- Root `CLAUDE.md` is tracked as lowercase `claude.md` on Windows.

### Multi-Agent PR Process

- Admin owns scope approval, merge authority, and deploy authorization.
- Contributor agents never self-merge; one branch/PR per task; no direct commits to `master`.
- Copy and fill `.github/pull_request_template.md` when using `gh pr create`.
- Demo-server data ops use DB user `karmyq_prod`.
