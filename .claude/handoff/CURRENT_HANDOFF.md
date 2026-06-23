# Sprint 109 - Geocoding Cache Hardening & Dependency Hygiene - MERGED (v11.17.0)

> **STATUS (2026-06-22):** Sprint 109 is **merged to `master`** as
> `a62322b7 Sprint 109: Geocoding cache hardening and dependency hygiene (#111)`. Working tree is
> clean. **No sprint is currently in flight.**
>
> **Next session:** run sprint planning. Known candidate carried in memory:
> header de-congestion (`project_header_decongestion_next_sprint` — S107 added the
> `--measure-chrome` mechanism; verify the topbar actually adopts it). Below this status block is the
> archived Sprint 109 record (kept for reference until the next sprint's handoff replaces it).

---

## Quick Start

Sprint 109 is **merged** (#111) — there is no in-flight work. Next session:

1. **Run sprint planning** (use the `sprint-planning` skill) to choose and scope the next sprint.
2. Top carried candidate: **header de-congestion** — see `project_header_decongestion_next_sprint`
   in memory. S107 added the `--measure-chrome: 72rem` mechanism; first verify whether the topbar
   (`apps/frontend/src/components/Layout.tsx`) actually adopts it before scoping.
3. Other deferred items in "Carry-Forward / Known Issues" below (member forget/export,
   cleanup-service replacement, mobile parity).
4. The Sprint 109 record below this section is **archived for reference** until the next sprint's
   handoff replaces it.

---

## Sprint Goal

Keep `geocoding-service` as Karmyq's shared geocoding cache and public-API policy boundary, then harden
its tests, response contract, docs, and dependency posture.

---

## Design Decision

The maintainer chose **not** to decommission `geocoding-service`. The backend exists for a real reason:
it reduces repeated public Nominatim hits through shared PostgreSQL caching, centralizes app-wide
external API throttling, and allows provider switching without a frontend release. Sprint 109 is a
hardening sprint, not a service-count-reduction sprint.

Official Nominatim policy context checked during planning:

- Public `nominatim.openstreetmap.org` has an app-wide maximum of 1 request/second.
- Apps should cache results.
- Apps should be able to switch providers when asked.
- Client-side autocomplete against the public API is not acceptable as a primary design.

Therefore frontend must remain local-cache-first and backend-cache-second; direct public Nominatim
fallback stays last-resort only.

---

## Planning Artifacts

- Spec: `docs/superpowers/specs/2026-06-22-sprint-109-geocoding-cache-hardening-design.md`
- Plan: `docs/superpowers/plans/2026-06-22-sprint-109-geocoding-cache-hardening.md`

---

## Execution Results

- Retained `geocoding-service` and extracted testable modules:
  `src/geocodingApp.js`, `src/geocodingService.js`, and `src/response.js`.
- Added geocoding unit/regression scripts and tests with mocked DB/fetch; tests do not call public
  Nominatim.
- Added outbound Nominatim throttling around cache misses and preserved inbound rate limits.
- Converted application routes to ADR-074 envelopes while keeping `/health` flat.
- Updated frontend geocoding so backend `/search` is tried before direct public fallback; backend
  timeouts now use local caches only instead of silently bypassing the policy boundary.
- Post-review fix: widened frontend/backend geocoding validation for common real-address punctuation
  and accents (`'`, `#`, `/`, Unicode letters) while still rejecting script/control-style input.
- Post-review decision: resolved backend `/search` responses, including 429/500-style non-ok
  responses, remain policy-boundary answers and do not fall through to direct public Nominatim; this
  is covered by frontend regression tests.
- Updated geocoding docs, service registry, ADR-071 follow-up, new ADR-080, landing generated docs,
  Dockerfile, and root version `11.17.0`.
- Dependency hygiene: exact `js-yaml@4.2.0` override reduced npm audit moderates from 21 to 3;
  high/critical remain clean. Remaining moderates are the known Expo/tar chain.

## Verification

- PASS: `npm --workspace=geocoding-service test` (including post-review address validation cases).
- PASS: `npm test -- geocoding.test.ts` from `apps/frontend`.
- PASS: `npx jest tests/tdd/geocoding.test.ts --runInBand` from `apps/frontend` (including
  post-review punctuation/accent and 429 boundary cases).
- PASS: `npx tsc --noEmit -p apps/frontend/tsconfig.json`.
- PASS: `npm test` at repo root (`26 successful, 26 total`).
- PASS: `npm run feedback:check` (with existing Windows warning reading user-level git ignore).
- PASS: `npm audit --package-lock-only --audit-level=high`.
- PASS: `npm run analyze:services` (with existing version-drift warning).
- EXPECTED FAIL: root `npm run test:tdd` still cannot find a `test:tdd` task in every Turbo project.
- EXPECTED FAIL: full frontend `npm --workspace=karmyq-frontend run test:tdd -- geocoding.test.ts`
  still runs the whole frontend TDD suite and hits pre-existing unrelated trust/provider failures;
  focused `geocoding.test.ts` passes.
- EXPECTED FAIL: root `npx tsc --noEmit` prints TypeScript help because the repo has no root
  `tsconfig.json`; frontend project TypeScript passes.

---

## In Scope

1. **Keep and harden geocoding-service** — retain `/search`, `/cache`, `/stats`, `/cleanup`, and `/health`.
2. **Central outbound throttling** — inbound `express-rate-limit` is not enough; outbound Nominatim calls
   need an app-process throttle.
3. **ADR-074-style route envelopes** — keep `/health` flat for infrastructure compatibility; use
   `{ success, data, message, error }` for application routes.
4. **Real test coverage** — add package scripts plus unit/regression tests with mocked DB/fetch.
5. **Frontend boundary regression** — prove frontend tries backend geocoding cache before any direct
   external fallback.
6. **Docs and registry drift fix** — service docs currently claim no frontend consumer and Redis
   dependency; correct to frontend consumer + PostgreSQL.
7. **ADR-080** — record why geocoding-service is retained as an external API policy boundary and update
   ADR-071 follow-up.
8. **Dependency hygiene** — keep high/critical audit clean; triage moderate alerts without risky major
   Expo/Jest churn.

## Out of Scope

- Deleting or folding `geocoding-service`.
- Member forget/export controls.
- Cleanup-service replacement.
- Paid provider migration (Mapbox/Google/etc.).
- Self-hosting Nominatim.
- Reverse geocoding.
- Address-book product work.
- Major Expo/Jest migration solely for moderate audit alerts.

---

## Critical Implementation Notes

1. **Do not decommission `geocoding-service`.** The backend is retained as the shared cache and external
   API policy boundary.
2. **Do not make browser-to-Nominatim the primary autocomplete path.** Direct external calls stay a
   last-resort fallback after local caches and backend cache fail.
3. **Respect the Nominatim policy.** Centralize outbound Nominatim calls, send a real Karmyq
   `User-Agent`, cache results, and throttle app-wide external requests to at most one request per
   second per process.
4. **Per-client HTTP rate limits are not enough.** `express-rate-limit` limits inbound callers; add a
   separate outbound throttle around `callNominatimAPI`, and make the throttle resilient so one rejected
   external call cannot poison the queue for future cache misses.
5. **Response envelopes should match ADR-074.** Keep `/health` compatible, but use
   `{ success, data, message, error }` for API and error responses.
6. **Fix documentation drift.** The service is not "no dependents" in practice: frontend geocoding
   consumes it. It uses PostgreSQL, not Redis.
7. **Add test scripts before relying on tests.** `services/geocoding-service/package.json` currently has
   no `test`, `test:unit`, or `test:regression` scripts.
8. **Mock external calls in tests.** Tests must not call public Nominatim. Use mocked `fetch` and mocked
   `pool.query`.
9. **Do not take risky dependency majors.** Moderate audit cleanup is bounded; Expo/Jest major churn is
   out of scope unless proven safe.
10. **Update ADR-071/ADR-080 coherently.** ADR-071's geocoding follow-up should point to ADR-080's
    decision to retain and harden the service.
11. **Update the Docker image when extracting `src/`.** The current Dockerfile copies only `index.js`;
    after extraction it must copy `services/geocoding-service/src/` into both build and production
    stages, or the deployed container will fail with `Cannot find module './src/geocodingApp'`.
12. **Do not add already-hoisted test dev dependencies to the service package.** Add scripts only unless
    verification proves `jest` or `supertest` cannot resolve from the root install.
13. **Backend timeout must not bypass the policy boundary.** Frontend timeouts from `/search` should not
    silently fall through to direct browser-to-Nominatim calls; add the regression test from the plan.

---

## Carry-Forward / Known Issues

- **Member forget/export** privacy follow-on remains open and intentionally out of Sprint 109.
- **Dibs server-side relationship routing** appears substantially implemented by ADR-072/S93; revisit only
  if a fresh defect appears.
- **Cleanup-service replacement** remains deferred because it owns non-trivial scheduled retention/memory
  jobs.
- **request-forgery FP on `apps/frontend/src/lib/api.ts`** — known/recurring; dismiss as FP if it recurs.
- **Moderate dependency alerts**: execution baseline showed `high:0`, `critical:0`, `moderate:21`.
  Sprint 109 safely added exact `js-yaml@4.2.0` override and refreshed the lock in place, reducing
  moderates to 3. Remaining alerts are the `tar` -> `@expo/cli` -> `expo` chain; keep exact `tar`
  override and carry forward unless a safe non-major Expo path is proven.
- **Pre-existing security drift:** Dependabot/CodeQL alerts follow ADR-059/ADR-060 SLA.
- **Pre-existing test drift:** root Turbo test targets can cache or skip changed-package coverage; run
  `npm --workspace=geocoding-service test` and focused frontend tests directly.

---

## Multi-Sprint Arc

- **S100 (done):** Pulse Truth & Actionability (ADR-078).
- **S101 (done):** Actionability & State Truth.
- **S102 (done):** Visible Memory + Re-warm First Step (v11.11.0).
- **S103 (done):** Governance + Intake Clarity (v11.12.0).
- **S104 (done):** UI Facelift Research (ADR-079 Proposed, no deploy).
- **S105 (done):** UI Facelift Implementation (v11.13.0).
- **S106 (done):** Post-Facelift Correctness & Link-Up Clarity (v11.14.0/.1).
- **S107 (done):** App Shell Clarity & Commitment Truth (v11.15.0).
- **S108 (done):** Responder Home Actionability & Decision Truth (v11.16.0).
- **S109 (done):** Geocoding Cache Hardening & Dependency Hygiene (v11.17.0, #111).
- **Deferred:** member forget/export; cleanup-service replacement; mobile parity.

---

## Persistent Context

### Active Session (update on every role handoff)

- **Driving agent:** _(none — between sprints; tree clean as of 2026-06-22 #111 merge)_
- **Phase:** _(plan / code / review — n/a)_
- **Branch + files in flight:** _(none)_

> Keep this stanza current. Claude + Codex share ONE working tree (two VS Code sessions, same
> folder, time-sliced — see AGENTS.md "Same-machine reality"). The clash safeguard is: one agent
> edits at a time, and **the active agent commits or stashes before handing the session over**, so
> the next agent starts from a clean tree. Never edit/commit on top of the other agent's
> uncommitted WIP.

### Multi-agent PR process - live on master

- `.github/pull_request_template.md` = the cross-agent PR contract.
- Master branch protection requires CI checks, 1 approving review, and Admin merge authority.
- Agents do not self-merge or push directly to `master`.
- Every task = one branch = one PR.
- When using `gh pr create`, manually copy `.github/pull_request_template.md` into the PR body.
- Cross-agent review protocol: the agent that did not author a plan/PR/branch/commit reviews it when
  two models are available.

### Architecture Gotchas

- **Frontend is Pages Router** (`apps/frontend/src/pages`), not App Router.
- **category vs request_type seam:** `help_requests.category` is mixed-vocab (enum on new rows, skill
  tokens on old/seed/sim rows). Never pass `category` where `request_type` (the enum) is expected.
- **Feed query surfaces:** browsable-request filtering lives in multiple places; the feed ranker
  projection (`basicFeedRanker.ts`) is a separate seam. Change all relevant sites.
- **`admin_proposed` discriminator:** `requests.matches.admin_proposed` distinguishes a member's
  self-offer (FALSE, requester owes) from an admin/matchmaker proposal (TRUE, responder owes).
- **Design token system:** CSS-variable backed, in `apps/frontend/src/styles/globals.css` +
  `apps/frontend/tailwind.config.js`; per-community skins via `ThemeContext`/`ThemeProvider`.
- **Landing page docs:** `apps/landing/src/data/docs/` is gitignored - `git add -f` when generated
  docs must be committed. Generated by `scripts/generate-docs.ts`; edit sources, never generated JSON.
- **ADR numbering:** Sprint 109 creates ADR-080; next free after this sprint = **081**.
- **JWT field** is `communities`, not `communityMemberships`.
- **Schema is `communities.communities`** (plural schema name); auth tables are `auth.*`.
- **API response unwrap:** `createApiClient` interceptor already unwraps - use `res.data`, not
  `res.data.data`.
- **Error contract (ADR-074):** `{ success:false, message:string, error:string }`.
- **trust_edges_live is a VIEW:** never INSERT/UPDATE it.
- **`git add` on CLAUDE.md:** tracked as lowercase `claude.md`.
- **Solo dev - no worktrees:** work directly on feature branches.
- **request-service serves the feed** (`/requests/feed`); there is no feed-service.
- **geocoding-service stays separate in Sprint 109:** it is the backend cache and external geocoder
  policy boundary.

### Workflow Gotchas

- Every sprint runs testing, `/simplify`, `/code-review`, and `/security-review`.
- Every sprint updates docs and landing docs.
- No docs-only push to `master`; master push triggers a full deploy.
- nginx.conf changes take effect on the next deploy (deploy.sh copies + reloads).
- `nav.json` silently reverts - always grep-verify after editing.
- Widely-rendered components using `useRouter` need the global `apps/frontend/jest.setup.js` router
  mock.
- Root Turbo `test:unit`/`test:regression` can exit before tests (missing target in one workspace);
  run changed-package unit/regression targets directly.
- DB-backed TDD tests need a reachable local Postgres and may need to seed `creator_id`.
- `npm audit --package-lock-only --audit-level=high` may need network/escalated shell; CI ADR-059 gate
  remains authoritative.

### Demo / Deploy Drift Watch

`karmyq.org` / demo live content has drifted from `master` before. Confirm the latest deploy
succeeded and live content matches `master` before judging by live content. Demo tester:
`maria.reyes@test.karmyq.com` / `password123`.
