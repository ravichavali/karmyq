# Sprint 73: Request Service Simplification — Ready to Execute

## Handoff Document

**Date**: 2026-05-29
**Current Version**: v10.1.0 → v10.2.0 (Sprint 73)
**Status**: Spec + plan written. Ready to execute.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-73-request-simplification`
3. Open plan: `docs/superpowers/plans/2026-05-29-sprint-73-request-service-simplification.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint Goal

Simplify the request service — delete dead code, remove stale service class, clean up 1,351-line route file, standardize error responses, delete three never-implemented TDD placeholder tests — then fix the deployed "Withdraw Offer" bug via deploy, polish the request UX (CommitmentsTab), and ship updated docs.

**No new features. Delete before you add.**

---

## Public Launch Polish Arc

| Sprint | Service | Status |
|--------|---------|--------|
| **72** | Simulation Engine | ✅ Complete + deployed |
| **73** | Request Service | ⬅ This sprint |
| **74** | Community / Governance | TBD |
| **75** | Feed + Discovery | TBD |
| **76+** | Final pass + launch prep | TBD |

---

## Sprint 73 Spec + Plan

- **Design spec**: `docs/superpowers/specs/2026-05-29-sprint-73-request-service-simplification-design.md`
- **Implementation plan**: `docs/superpowers/plans/2026-05-29-sprint-73-request-service-simplification.md`

---

## What Gets Done

### 1. Delete dead code
- `services/request-service/src/services/matchService.ts` — routes use inline SQL; this class is never called; stale `rejectMatch()` causes confusion
- `tests/tdd/dynamic-schemas-api.test.ts` — placeholder, `pool` never initialized
- `tests/tdd/schema-caching.test.ts` — placeholder, `pool` + Redis never initialized
- `tests/tdd/schema-fallback.test.ts` — placeholder, `pool` never initialized

### 2. Simplify matches.ts (674 lines)
- Remove two commented-out dead code blocks (disabled `find-candidates` endpoint)
- Remove debug `console.log('Sample match data:', ...)`
- Standardize raw `res.status().json()` calls to use `sendSuccess` / `sendInternalError`

### 3. Simplify requests.ts (1,351 lines)
- Extract the 562-line `GET /curated` handler body into a `buildCuratedFeed()` helper
- Standardize remaining raw response calls

### 4. Withdraw Offer bug (fixed by deploy)
- Local `routes/matches.ts` reject handler already checks both `requester_id` and `responder_id` (fixed)
- karmyq.com still has the old code — deploying Sprint 73 pushes the fix live
- No code change needed to routes/matches.ts

### 5. TDD tests — verify
- `two-phase-completion.test.ts` — verify passes (looks solid)
- `providers-api.test.ts` — verify passes; fix if failing

### 6. Frontend UX
- CommitmentsTab: replace `alert()` with inline error state; verify labels; add empty states
- Request creation flow: audit labels and confirmation state

### 7. Docs
- `apps/landing/.../guides/help-requests.json` — add two-phase + withdraw explanation
- `apps/landing/.../guides/match-lifecycle.json` — update/create
- `apps/landing/.../services/request-service.json` — remove dead `find-candidates` endpoint

### 8. Version bump 10.1.0 → 10.2.0
- Root `package.json`
- Version invariant test in `services/community-service/tests/regression/sprint-71-v10-polish.test.ts`

---

## ⚠️ Critical Implementation Notes

1. **matchService.ts is NOT called by routes** — confirm with `grep -rn "matchService\|new MatchService\|from.*matchService" services/request-service/src` before deleting. If anything imports it, fix that import first, then delete.

2. **Delete means delete** — do not comment out placeholder TDD tests; `rm` the files.

3. **Response format helpers**: `sendSuccess`, `sendInternalError`, `sendNotFound`, `HTTP_STATUS` from `@karmyq/shared/utils/response`. Do not change HTTP behavior, just call style.

4. **admin-schemas.ts auth is at app level** — `index.ts` applies `...adminAuth` at mount. Do not add middleware inside the route file.

5. **nav.json revert bug** — `scripts/generate-docs.ts` regenerates nav.json. Add slugs to `GUIDE_ORDER`, `GUIDE_LABELS`, `GUIDE_SLUGS` in that file first; regenerate; then `git add -f`.

6. **Version invariant test**: After bumping to 10.2.0, update `services/community-service/tests/regression/sprint-71-v10-polish.test.ts` (asserts `pkg.version === '10.1.0'`).

7. **Withdraw Offer bug**: Local code already correct. Bug lives on deployed server. Fixed by deploy. No code change to routes/matches.ts needed.

8. **Solo dev — no worktrees**: Work on `feature/sprint-73-request-simplification` directly.

---

## Architecture Gotchas (Persistent)

- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`
- **ADR numbering**: Next ADR is **059**
- **ADR-057 and ADR-058**: Already `implemented` in both source `.md` and landing `.json`
- **TDD test placement**: Request service tests in `services/request-service/tests/tdd/`
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **`git add` on CLAUDE.md**: Tracked as lowercase `claude.md` — always `git add claude.md`
- **Solo dev — no worktrees**: Work directly on feature branches
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json — always add new slugs to GUIDE_ORDER + GUIDE_LABELS + GUIDE_SLUGS in `scripts/generate-docs.ts`
- **trust_edges_live is a VIEW**: Never INSERT/UPDATE it. Use `trust_edges` for writes, `trust_edges_live` for reads
- **API response unwrap**: `createApiClient` interceptor already unwraps envelope — use `res.data`, not `res.data.data`
- **trust_edges normalized constraint**: `social_graph.trust_edges` requires `user_id_a::text < user_id_b::text` — always sort
- **community_links UNIQUE**: fusion_origin links must be (merged↔A) and (merged↔B), NOT (A↔B)
- **TrustGraph fission mode ref**: `fgRef.current.d3Force(...)` only callable after mount — guard with `if (!fgRef.current) return`
- **Root package.json version**: 10.1.0 (being bumped to 10.2.0 this sprint)
- **Version invariant test**: `services/community-service/tests/regression/sprint-71-v10-polish.test.ts` checks `pkg.version` — update to 10.2.0 this sprint

---

## Pre-existing TDD Failures (do NOT fix unless sprint targets them)

- `sprint-39-provider-ux` (7 fail)
- `sprint-43-feed-ranking` (crashes)
- `sprint-68-halflife` (6 DB connection tests)
- `sprint-67-governance` (DB connection tests)
- `social-graph-service/tests/tdd/sprint-66-trust-graph-visualization.test.ts` (fails)
- `social-graph-service/tests/tdd/sprint-67-ego-network.test.ts` (fails)
- `social-graph-service/tests/tdd/sprint-68-halflife.test.ts` (fails)

**Sprint 73 resolves**: `dynamic-schemas-api`, `schema-caching`, `schema-fallback` (deleted)
**Sprint 73 verifies**: `two-phase-completion`, `providers-api`

---

## What Sprint 72 Shipped (Context)

**Goal**: Replace single-loop simulation engine with 10 concurrent async workers running 24/7.
- WorkerPool class, 4 new workflow types (vote, feedback, dibs, nominate/ratify)
- Session affinity, selectWorkflow() dispatcher
- 18 regression tests, all green
- v10.0.0 → v10.1.0
