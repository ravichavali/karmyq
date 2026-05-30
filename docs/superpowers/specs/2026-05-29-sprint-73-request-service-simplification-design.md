# Sprint 73: Request Service Simplification + Bug Fix + UX Polish — Design Spec

**Date**: 2026-05-29
**Status**: Approved
**Version**: v10.1.0 → v10.2.0
**Sprint Branch**: `feature/sprint-73-request-simplification`

---

## Overview

Sprint 72 overhauled the simulation engine. Sprint 73 turns attention inward: the request service is the platform's core, but 18 months of iteration have left it with 6,799 lines spread across 24 files, significant dead code, inconsistent error response formats, and a divergence between route handlers and a service class that's no longer in use. Before layering on more features, this sprint simplifies the code to make it easier to reason about and maintain.

The sprint runs in order: **simplify first, then fix, then polish**. The simplification pass has two benefits beyond code quality: it removes the stale `matchService.rejectMatch()` method that was masking a deployed bug ("Withdraw Offer" returns wrong error on karmyq.com), and it makes the subsequent UI/UX pass easier to reason through because the API surface is clean.

After the simplification pass, the sprint does a UI/UX audit of the request creation and management flow (CommitmentsTab, request creation wizard), then ships updated user guides and landing docs.

### Core Principle: Delete Before You Add

Every change in this sprint should reduce total lines of code or complexity. No new abstractions, no new patterns — only removal of things that shouldn't be there, consolidation of things that are duplicated, and cleanup of things that were never finished.

---

## Multi-Sprint Arc

### Sprint 72 — Simulation Engine Overhaul (complete)
10 concurrent workers, 24/7 operation, dibs/feedback/governance/nomination workflows.

### Sprint 73 — Request Service Simplification (this sprint)
Code audit and simplify; fix deployed Withdraw Offer bug via cleanup + deploy.

### Sprint 74 — Community / Governance Polish (upcoming)
Same pattern: audit → simplify → polish → docs.

---

## What Gets Simplified

### 1. `requests.ts` — 1,351 lines

The `GET /curated` route handler is ~562 lines of inline SQL and business logic in a single function. Extract it into a `buildCuratedFeed()` helper function in the same file (or a sibling `curatedFeed.ts`), so the route handler becomes a thin wrapper.

Also standardize error responses: several handlers in this file use raw `res.status().json({ success: false, message: ... })` instead of `sendSuccess` / `sendInternalError` from `@karmyq/shared`.

### 2. `matchService.ts` — 288 lines, mostly unused

Routes use inline SQL exclusively. `matchService.ts` methods are NOT called by any route. The class was used in an earlier architecture and was never removed. Key stale method: `rejectMatch()` at line ~250, which still has a requester-only check — this is the root cause of the "Withdraw Offer" confusion (deployed server has old route code that mirrors this logic).

**Action**: Delete `matchService.ts` entirely after confirming nothing imports it. If any method is still needed, inline it at the call site.

### 3. Dead code in `matches.ts`

Two large comment blocks mark a temporarily disabled matching feature (`find-candidates` endpoint). This has been commented out for multiple sprints. Remove it entirely.

Also remove the debug `console.log('Sample match data:', ...)` added for development inspection.

### 4. Placeholder TDD tests — delete 3 files

Three TDD test files in `services/request-service/tests/tdd/` were scaffolded but never implemented — their `beforeAll` blocks are entirely `// TODO` and `pool` is never initialized:

- `dynamic-schemas-api.test.ts` — requires real DB pool, uninitialized
- `schema-caching.test.ts` — requires real Redis + DB pool, uninitialized
- `schema-fallback.test.ts` — requires real DB pool, uninitialized

These fail in CI with confusing errors. Delete all three. The concepts they test (caching, fallback) are not part of Sprint 73 scope.

### 5. `admin-schemas.ts` — minor cleanup

This file is 641 lines of well-structured code. Auth is correctly applied via `index.ts`. Minor cleanup: remove stale JSDoc comments that reference fields that no longer exist in the schema.

---

## The Withdraw Offer Bug

**Symptom**: Clicking "Withdraw Offer" on a proposed match in the CommitmentsTab (Helping side) returns: `"Only the requester can reject this match"`.

**Root cause**: The deployed version of `routes/matches.ts` on karmyq.com (visible in the actions-runner copy) has an old `PUT /reject` handler that only allows the requester. The LOCAL code already has the fix (checks both `requester_id` and `responder_id`).

**Fix**: This is resolved automatically by deploying Sprint 73. The simplification pass also removes `matchService.rejectMatch()` which had the same stale restriction, preventing future confusion.

No code change needed to `routes/matches.ts` for this bug — the local code is already correct.

---

## TDD Test Assessment

| File | Status | Action |
|------|--------|--------|
| `dynamic-schemas-api.test.ts` | Never implemented, pool uninitialized | Delete |
| `schema-caching.test.ts` | Never implemented, pool + Redis uninitialized | Delete |
| `schema-fallback.test.ts` | Never implemented, pool uninitialized | Delete |
| `two-phase-completion.test.ts` | Well-implemented, matches current routes | Verify passes; keep |
| `providers-api.test.ts` | Real mocks, appears complete | Verify passes; fix if needed |

---

## Frontend Changes

### CommitmentsTab.tsx — UX audit

Review and improve the "Helping" and "Requested" tabs:
- Verify "Withdraw Offer" label is correct for the helper's perspective (should say "Withdraw" not "Decline")
- Verify empty states are informative
- Verify status labels match what users would expect ("Waiting for confirmation", "Matched", etc.)
- Remove or improve the `alert()` calls for errors — these should use inline error messages

### Request creation flow — UX audit

Review the request creation wizard (Sprint 35) for:
- Form field labels that are technical rather than human
- Any hardcoded categories that feel generic rather than mutual-aid specific
- Clarity of the submission confirmation state

---

## User Guide & Doc Updates

Every sprint ships doc updates.

| Doc | Action |
|-----|--------|
| `apps/landing/src/data/docs/guides/help-requests.json` | Update to reflect simplified flow; add note about Withdraw Offer behavior |
| `apps/landing/src/data/docs/guides/match-lifecycle.json` | Update to clarify two-phase completion and withdraw behavior |
| `apps/landing/src/data/docs/services/request-service.json` | Update endpoint list to remove dead `find-candidates` entry |
| `docs/guides/` | Verify request-related guides are current |

---

## Critical Implementation Notes

1. **matchService.ts is NOT called by routes** — confirm with `grep -rn "matchService\|new MatchService" services/request-service/src` before deleting. If anything imports it, fix that import first.

2. **Delete means delete** — do not comment out the placeholder TDD tests; delete the files entirely. They add noise to CI output.

3. **Response format**: `sendSuccess` and `sendInternalError` are from `@karmyq/shared/utils/response`. Do not change the HTTP behavior — just the format of the helper call.

4. **admin-schemas.ts auth is at app level** — the route file itself has no auth middleware but `index.ts` applies `...adminAuth` spread at mount. Don't add middleware inside the route file.

5. **nav.json revert bug** — `scripts/generate-docs.ts` regenerates `apps/landing/src/data/docs/nav.json` on build. Always add guide slugs to `GUIDE_ORDER`, `GUIDE_LABELS`, and `GUIDE_SLUGS` in `generate-docs.ts` first; then run `npx ts-node scripts/generate-docs.ts` to regenerate nav.json. Then `git add -f` the result.

6. **Version invariant test**: After bumping to 10.2.0, update `services/community-service/tests/regression/sprint-71-v10-polish.test.ts` which checks `pkg.version`.

7. **Solo dev — no worktrees**: Work directly on `feature/sprint-73-request-simplification`. Do not create a worktree.
