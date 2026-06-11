# Sprint 94 — Error Contract Cleanup — 🛠️ IMPLEMENTED, needs review/gates

> **▶ STATUS (2026-06-11):** Sprint 93 is **DONE** — PR [#80](https://github.com/ravichavali/karmyq/pull/80)
> **MERGED** (squash `1c843da`) + **DEPLOYED** (post-merge `CI/CD Pipeline` on master = success,
> 20m23s, 2026-06-11 13:43Z). Provider↔Community link-up (FULL F1+F2+F3 bounded), ADR-064
> members-DELETE JWT fix, login-401 crash defense, `community_connection` dibs reason — all shipped
> at v11.2.0. **Sprint 94 implementation is now in the working tree** on
> `feature/sprint-94-error-contract-cleanup` (cut from updated master `1c843da`). Plan authored by Codex, reviewed + approved by Claude
> (cross-agent). Version target **11.2.0 → 11.3.0**. Next free ADR = **074**.
>
> ⚠️ **S93 closeout still owed:** post-deploy smoke + human validation on the live demo were not
> recorded as passed. Confirm the provider link-up + carry-forward fixes work on karmyq.com before
> leaning on them.

**Sprint goal (one sentence):** Canonicalize API error responses as
`{ success:false, message:string, error:'ERROR_CODE' }` (the CLAUDE.md contract) by fixing the
shared `sendError`/helpers + 3 middleware (the OBJECT-shape outlier), keeping web clients dual-read
tolerant for one release — resolving the S93 IDEAS [2026-06-10] envelope follow-up at the source.

---

## Quick Start

1. Read this handoff.
2. Confirm you're on `feature/sprint-94-error-contract-cleanup` from master `1c843da` (already cut).
3. Open the S94 plan (Codex) + this handoff's review notes below.
4. Review Codex's implementation, run any environment-dependent gates, then open the Sprint 94 PR.

**Branch:** `feature/sprint-94-error-contract-cleanup` (working tree has Sprint 94 edits, from `1c843da`).

---

## Sprint 94 implementation status (Codex, 2026-06-11)

**Review update (Claude, 2026-06-11)**
- ✅ Implementation review passed: shared helper/middleware contract flip, frontend legacy dual-read,
  ADR/doc updates, and downstream `.error.code` / `.error.message` audits all verified.
- ✅ Claude independently ran the per-package typechecks Codex could not run from root:
  request-service, community-service, auth-service, and frontend `tsc --noEmit` all passed.
- ⚠️ Staging requirement: `apps/landing/src/data/docs/concepts/adr-074-canonical-error-response-contract.json`
  is generated, gitignored, and referenced by tracked landing nav/concept data. It must be staged with
  `git add -f` when preparing the PR, or the landing docs link will 404.
- ✅ `/simplify`, `/code-review`, and `/security-review` completed after Codex implementation.
  Claude made the resulting gate fixes in this same branch: migrated middleware literals to shared
  helpers, fixed `getErrorMessage` to prefer canonical top-level `message` over string error codes,
  added regression coverage, and confirmed `/security-review` had no findings.

**Implemented**
- `packages/shared/utils/response.ts` now emits canonical errors from `sendError` and wrappers:
  `{ success:false, message:string, error:string, details?, meta? }`. `sendInternalError` moves
  development stack traces to top-level `details.stack`.
- Shared `validate`, `tenant`, and `rateLimit` middleware now emit top-level `message` plus string
  `error` codes.
- Added shared helper/middleware contract tests under `packages/shared/src/**/__tests__/`.
- Updated old-object-shape assertions in:
  `services/auth-service/tests/regression/auth.routes.test.ts`,
  `services/auth-service/tests/unit/authMiddleware.test.ts`,
  `tests/integration/auth-flow.integration.test.ts`, and
  `tests/integration/community-flow.integration.test.ts`.
- Kept the S93 web dual-read tests and updated comments to describe `{ error:{code,message} }` as
  a pre-S94 legacy envelope, not the ongoing contract.
- Added ADR-074, updated ADR-006/ADR index, `packages/shared/CONTEXT.md`, `docs/ARCHITECTURE.md`,
  `docs/api/SCHEMA_API.md`, `docs/IDEAS.md`, `scripts/generate-docs.ts`, landing generated docs, and
  bumped root version/package-lock to `11.3.0`.

**Audit notes**
- Live server/client readers for `.error.code` / `response.body.error.message` are clean.
- Remaining object-shaped error envelope hits are intentional legacy web test fixtures/docs, plus
  `services/cleanup-service/src/index.ts` local helper/rate-limit drift. ADR-074 catalogues this as
  out-of-scope direct/local drift rather than claiming a service-wide sweep.
- `apps/landing/src/data/docs/` is ignored by `apps/landing/.gitignore`; generated ADR-074 JSON
  exists locally but is not shown by normal `git status`. Use `git add -f` if the PR convention wants
  generated landing data committed.

**Verification run**
- ✅ `npm test` in `packages/shared` — 8 suites / 114 tests passed.
- ✅ `npm run build` in `packages/shared` — passed.
- ✅ `npm run test:unit -- authMiddleware.test.ts` in `services/auth-service` — passed.
- ✅ `npm run test:regression -- auth.routes.test.ts` in `services/auth-service` — passed.
- ✅ `npx jest --runTestsByPath tests/tdd/sprint-93-login-error-render.test.tsx` in `apps/frontend`
  — 1 suite / 9 tests passed.
- ✅ `npm run feedback:check` — passed (`No staged changes detected`).
- ✅ `npm audit --package-lock-only --audit-level=high` — 0 vulnerabilities.
- ✅ Claude post-gate verification: shared 114/114, frontend error test 12/12, and `tsc --noEmit`
  clean on community-service, request-service, auth-service, and frontend.
- ⚠️ Root `npx tsc --noEmit` exits 1 with TypeScript help because the repo root has no `tsconfig.json`;
  no typecheck actually runs from that command.
- ⚠️ Root `npm test` timed out after 5 minutes under Turbo without producing failure output.
- ⚠️ Root `npm run test:tdd` exits immediately: Turbo reports missing `test:tdd` task in at least one
  workspace.
- ⚠️ Process-reviewer's literal `npm test -- --passWithNoTests` command is incompatible with current
  Turbo CLI argument parsing (`unexpected argument '--passWithNoTests'`); use the per-package/CI gates
  above as the effective test evidence.
- ⚠️ Targeted root integration files start but require localhost services/database:
  `npx jest --config jest.integration.config.js --runTestsByPath integration/auth-flow.integration.test.ts integration/community-flow.integration.test.ts`
  fails with `AggregateError` for service/database connectivity.

---

## Multi-sprint arc

- **S92 (done):** Matching & Dibs Repair — dibs correctness floor, 8-bug sweep (v11.1.0).
- **S93 (done):** Provider↔Community link-up (audit-first) + carry-forward fixes (v11.2.0, PR #80
  merged + deployed).
- **S94 (this, CONFIRMED 2026-06-11):** Error Contract Cleanup — see plan below.
- **S95 (next):** Service Consolidation Phase 2 — geocoding → client-side, 10→9 (ADR-071).
- **Deferred to post-rollout:** mobile parity (incl. mobile error-read tolerance — see review note 4).

---

## S94 plan (Codex, v2 — RE-REVIEW PASSED, approved for execution)

**Canonical shape:** `{ success:false, message:string, error:'ERROR_CODE', details?, meta? }`.

**Key changes**
- Most direct route literals already emit top-level `message` + string `error`; the OUTLIER is
  `packages/shared/utils/response.ts` (`sendError`/wrappers/`sendInternalError` emit OBJECT
  `error:{code,message}`) plus shared middleware. Fix the outlier — **not** a service-wide route sweep.
- `sendError`, wrapper helpers, `sendInternalError` → string `error` code + top-level `message`.
- Move dev-only stack/details out of `error` into `details` (or drop).
- Normalize shared `validate` / `tenant` / `rateLimit` middleware to the canonical shape.
- Keep web client dual-read tolerance for legacy object envelopes; strip comments that frame the
  object shape as the ongoing contract.
- Audit inter-service consumers + shared clients for `.error.code`/`.error.message`; patch any live
  server-side reader.

**Docs**
- ADR-074: canonical error contract + migration boundary. **Must be honest** — after S94, shared
  helpers + middleware are canonical; direct route literals are NOT fully swept, and routes missing
  `error` are catalogued drift, not claimed fixed.
- Mark `docs/IDEAS.md` [2026-06-10] shared `sendError` mismatch as addressed/superseded.
- Update CLAUDE.md wording only if precision needs it; relevant CONTEXT.md / landing docs.

**Test plan**
- Shared response tests for all helpers (`sendError`, `sendValidationError`, `sendUnauthorized`,
  `sendForbidden`, `sendConflict`, `sendNotFound`, `sendInternalError`).
- Middleware failure tests: validation, tenant, rate-limit.
- **Blocking tests that assert the OLD object shape — must update (they go red on the flip):**
  - `services/auth-service/tests/regression/auth.routes.test.ts`
  - `tests/unit/authMiddleware.test.ts`
  - `tests/integration/auth-flow.integration.test.ts`
  - `tests/integration/community-flow.integration.test.ts`
- Keep S93 frontend tests proving legacy object errors still render as strings.
- Gates: `npx tsc --noEmit`, `npm test`, `npm run test:tdd`, `npm run feedback:check`,
  `npm audit --package-lock-only --audit-level=high`, then `/simplify`, `/code-review`, `/security-review`.

**Assumptions:** success envelopes unchanged; web is the S94 demo priority; socket/WS error payloads
out of scope unless they reuse HTTP helpers; no all-services direct-route sweep.

---

## Claude cross-agent review of the S94 plan (2026-06-11) — all findings folded into v2

Codex authored the plan; Claude reviewed (cross-agent protocol). v2 resolves all findings:

1. **Scope reframed (was P1):** canonical shape is already the de-facto route standard (~689
   `success:false, message:` literals across 74 files); the OBJECT-shape `sendError` helper is the
   outlier. Emit-side migration = shared helper + 3 middleware, not a sweep.
2. **Mobile (resolved):** parity deferred to post-rollout. **Accepted risk:** mobile error-read
   paths are NOT made tolerant in S94 — a mobile client hitting the flipped contract may render
   degraded error text until parity lands. Web-first demo → acceptable; ADR-074 states the boundary.
3. **Blocking tests enumerated (was P1):** the four files above assert the object shape and are
   must-pass tiers; named in the test plan so they don't surprise the push.
4. **Inter-service audit (was P2):** near-empty — the only other `.error.code/.message` hit is
   `packages/shared/utils/logger.ts`, which reads a JS `Error` (`.name/.message/.stack`), NOT the
   HTTP envelope → false positive, no patch. Audit is cheap confirmation.
5. **ADR-074 honesty (was P2):** many route literals omit `error`; post-S94 the string `error` field
   is best-effort, not uniformly enforced. ADR must say so.

---

## Persistent Context (carry forward unchanged)

### Multi-agent PR process — ✅ LIVE on master
- `.github/pull_request_template.md` = the cross-agent PR contract (Summary / Validation / Docs /
  Quality gates / Security dismissals / Follow-ups / Lane).
- master branch protection: required checks = `pr-contract`, `Lint & Type Check`, `Test Frontend`,
  `Test Backend Services (Unit + Regression)`, `Code Scanning Gate (ADR-060)`, `Security Audit`;
  `strict: true`; 1 approving review; `enforce_admins: false`.
- **Merge authority:** Admin owns approval + merge; agents merge only on Admin "pull it in"
  (then `gh pr merge --admin --squash --delete-branch`). Never self-merge / never push master directly.
- Deliberate empty marker commit `90b9067` on master — do NOT "clean it up".

### ⚠️ Open dependabot PRs (#34–50) still need unblocking
Comment `@dependabot rebase` to pick up `pr-contract.yml`, then review per dependabot merge discipline
(inspect grouped PRs for MAJOR bumps; don't rapid-merge). Major bumps: tailwindcss 3→4 #41,
typescript-eslint 6→8 #40, expo/vector-icons 14→15 #39, gesture-handler 2→3 #37, eslint-config-expo
8→56 #36, eslint-config-next 15→16 #35. (Note: a newer production-deps group PR's CI/CD + Tests were
failing as of 2026-06-11 — inspect before merging.)

### Architecture Gotchas (Persistent)
- **Landing page docs**: `apps/landing/src/data/docs/` is gitignored — `git add -f`. Generated by
  `scripts/generate-docs.ts` (wipes the dir each run); edit SOURCES, never the JSON. Grep-verify
  nav.json after editing (it silently reverts).
- **ADR numbering**: ADR-073 created in S93; **next free = 074.**
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **Schema is `communities.communities`** (plural schema name).
- **API response unwrap**: `createApiClient` interceptor already unwraps the envelope — use
  `res.data`, not `res.data.data`.
- **trust_edges_live is a VIEW**: never INSERT/UPDATE it.
- **`git add` on CLAUDE.md**: tracked as lowercase `claude.md`.
- **Solo dev — no worktrees**: work directly on feature branches.
- **Root package.json version**: **11.2.0** (Sprint 93) → bump to 11.3.0 in Sprint 94.
- **CI security gates**: dependency audit (ADR-059) + CodeQL (ADR-060) run on push; `js/request-forgery`
  on `apps/frontend/src/lib/api.ts` baseURL is a known recurring FP — dismiss.
- **request-service serves the feed** now (`/requests/feed`); calls social-graph via `SOCIAL_GRAPH_API_URL`.

### ⚠️ Deploy drift watch
`karmyq.org` live content has drifted from `master` before (around Sprint 83). Confirm the latest
deploy succeeded and live content matches `master` before judging by live content.
