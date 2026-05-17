# Sprint 56: Backend Simplification — Design Spec

**Date**: 2026-05-17
**Status**: Approved
**Version**: v9.22.0 → v9.23.0
**Sprint Branch**: `feature/sprint-56-backend-simplification`

---

## Overview

Sprint 56 is the first of two KISS simplification sprints. The backend has accumulated duplicated infrastructure across services: four services each maintain their own event publisher, several maintain their own logger despite a shared one existing, and the request service's main route file has grown to 1,391 lines with SQL query-building logic tangled into route handlers.

This sprint removes the duplication and untangles the largest file. No new features. No behavior changes. The codebase after this sprint should be structurally simpler, with infrastructure living once in `packages/shared` and logic separated from routing.

The sprint also addresses the TDD health problem discovered during planning: approximately 25% of regression tests contain `expect(true).toBe(true)` assertions that pass regardless of whether the code works. These are replaced with real assertions or converted to honest `it.todo()` stubs.

### Core Principle: One Source of Truth

Every piece of infrastructure (loggers, event publishers) should exist once and be imported everywhere. Every route file should contain only routing logic.

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 55 | Brand rollout — Refined Fractal mark | ✅ Complete |
| **Sprint 56** | **Backend simplification — DRY infrastructure + TDD health** | 🔮 This sprint |
| Sprint 57 | Frontend simplification — API factory + community page | 🔮 Next |
| Sprint 58 | Dashboard UX Redesign (original Sprint 56) | 🔮 Planned |

---

## New Concepts

None. This sprint reorganizes existing code, it does not introduce new abstractions.

---

## Data Model

No schema changes.

---

## API Endpoints

No new or modified endpoints. All services maintain the same external interface.

---

## Frontend Changes

None.

---

## Shared Package Changes

### `packages/shared/src/events/publisher.ts` (new)

Extracted from the four duplicate service implementations. Accepts `source` as a parameter so the caller identifies which service is publishing.

```typescript
export function createPublisher(source: string): Publisher
```

The `Publisher` interface remains identical to what each service currently exports — callers are not affected.

### `packages/shared/utils/logger.ts` (existing)

The shared logger already exists (309 lines, full-featured). This sprint audits its exported API and ensures services can drop-in replace their local loggers without changes to call sites.

---

## TDD Health Changes

### Placeholder tests to fix

| File | Problem | Fix |
|------|---------|-----|
| `services/auth-service/tests/regression/auth.routes.test.ts` | 8 tests with `expect(true).toBe(true)` | Replace with real mock-based assertions |
| `services/reputation-service/tests/regression/placeholder.test.ts` | Trivial `"should pass placeholder test"` | Convert to `it.todo()` stubs for real behavior |
| `services/social-graph-service/tests/regression/placeholder.test.ts` | Same pattern | Convert to `it.todo()` stubs |
| `tests/tdd/community-evolution-flow.test.ts` | `"placeholder — replace with real DB assertions"` | Convert blocked tests to `it.todo()` |
| `tests/tdd/fractal-feed-flow.test.ts` | Same pattern | Convert blocked tests to `it.todo()` |
| `tests/integration/complete-workflow.test.ts` | 4+ `expect(true).toBe(true)` | Replace with real assertions where possible, `it.todo()` where infra-blocked |

### TDD promotion pipeline

`scripts/promote-tdd-tests.js` exists but is not wired into the dev workflow. This sprint runs it once manually to promote any currently-passing TDD tests to regression, and adds it to the `posttest` npm script so it runs automatically.

---

## User Guide & Doc Updates

No user-facing behavior changes. Landing page update: update the architecture concept page to note that shared infrastructure (logging, event publishing) is centralized in `packages/shared`.

File to update: `apps/landing/src/data/docs/architecture.json` — add a sentence to the content describing the shared package's role.

---

## Critical Implementation Notes

1. **Check shared logger API before migrating services.** Read `packages/shared/utils/logger.ts` exports before touching any service logger. The shared logger may expect a `service` name in its constructor or factory — confirm the call signature so all migration sites match.

2. **`@karmyq/shared` must be in each service's `package.json` dependencies.** If it's missing, Turbo skips building shared before the service, causing import failures at build time. Verify before running `npm run build`.

3. **`moduleResolution: node16` required for shared subpath imports.** Services importing from `@karmyq/shared/src/events/publisher` (a subpath) need `"moduleResolution": "node16"` in `tsconfig.json`. Check before adding the import.

4. **Delete placeholder test files if they contain only `it.todo()` stubs.** An empty test file (0 assertions) causes jest to warn. If converting all tests in a file to `it.todo()`, delete the file and document the intended tests as comments in a related source file, or keep one real test.

5. **Do not skip pre-push hooks.** The hook runs regression tests — if placeholders are converted correctly, tests should pass. If they fail, fix the assertion, don't bypass with `--no-verify`.

6. **Request route decomposition scope.** Only extract the query-builder logic (lines 35–99 of `requests.ts`) into a new file. Do not refactor the rest of the route handlers — that's out of scope for this sprint.
