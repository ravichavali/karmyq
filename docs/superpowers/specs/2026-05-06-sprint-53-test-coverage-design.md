# Sprint 53: Test Coverage — Critical Paths — Design Spec

**Date**: 2026-05-06
**Status**: Approved
**Version**: v9.19.0 → v9.20.0
**Sprint Branch**: `feature/sprint-53-test-coverage`

---

## Overview

Sprint 53 adds meaningful unit tests to the four highest-risk silent-failure areas in Karmyq, replaces placeholder assertions, and enforces the existing 80% coverage threshold in CI so missing tests actually block pushes.

The platform has an 80% coverage threshold defined in the root `jest.config.js`, but several services currently bypass it: `cleanup-service` has `passWithNoTests: true` (zero tests exist), and `community-service` has all thresholds explicitly set to `0` with a TODO comment. These bypasses mean the threshold is aspirational, not enforced. Sprint 53 closes that gap.

This is a pure quality sprint — no new user-facing features. The deliverable is a codebase where `npm test` actually fails when critical logic is untested, and every service either meets a meaningful threshold or has a documented reason why it cannot.

### Core Principle: Coverage Without Theater

Every test added this sprint must fail if the logic it covers is broken. No `expect(true).toBe(true)`. No tests that would pass if the tested function returned `undefined`. Assertions must be specific to the behavior being tested.

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 51 | Trust scores + explore/exploit | ✅ Complete |
| Sprint 52 | Trust-path visibility in DibsPrompt | ✅ Complete |
| **Sprint 53** | **Test coverage: critical paths + CI enforcement** | 🔮 This sprint |
| Sprint 54 | UI Facelift (Claude Design) — research-first | 🔮 Planned |

---

## Services in Scope

### 1. cleanup-service — Cron Job Logic

**Current state**: 0 tests. `passWithNoTests: true` in `jest.config.js` allows CI to pass with an empty test suite. Directory `tests/unit/` exists but is empty.

**Target files**:
- `services/cleanup-service/src/jobs/expirationJob.ts` — Marks expired records soft-deleted (runs hourly). Issues UPDATEs on `help_requests`, `help_offers`, `messages`, `notifications` where `expires_at <= now`. Returns per-table `rowCount`.
- `services/cleanup-service/src/jobs/reputationDecayJob.ts` — Applies trust score decay (runs daily). Queries all user-community pairs, calls `reputation.calculate_decayed_karma($1, $2)` DB function, applies `min(100, floor(decayedKarma / 10))` formula, only updates rows where score changed.

**Import pattern**: Both jobs import `{ query }` from `'../database/db'` — mock target is `'../database/db'`.

**Tests to write** (in `services/cleanup-service/tests/unit/`):

`expirationJob.test.ts`:
- Updates all four tables (help_requests, help_offers, messages, notifications) when expired rows exist
- Returns cumulative count from all four UPDATE calls
- Handles zero-row updates (rowCount = 0) without error
- Calls `logger` on completion (smoke test for logging path)

`reputationDecayJob.test.ts`:
- Calls `calculate_decayed_karma` with correct user/community args for each pair
- Applies `min(100, floor(decayedKarma / 10))` formula correctly (e.g., karma=150 → score=15, karma=1050 → capped at 100)
- Only issues UPDATE when calculated score differs from current stored score
- Skips UPDATE when calculated score equals current score

**CI change**: Remove `passWithNoTests: true` from `services/cleanup-service/jest.config.js`.

---

### 2. auth-service — JWT Claims and Role Enforcement

**Current state**: Integration tests exist for registration flow; regression tests cover route definitions. Missing: unit tests for JWT payload shape, multi-community claims, role field encoding, and middleware behavior.

**Target files**:
- `services/auth-service/src/routes/auth.ts` — `generateJWTToken()` signs a token with `JWTPayload` including `communities: Array<{id, name, role}>`.
- `packages/shared/middleware/auth.ts` — JWT verification middleware; extracts `JWTPayload` and attaches to `req.user`.

**Tests to write** (in `services/auth-service/tests/unit/`; create `unit/` directory):

`jwtClaims.test.ts`:
- Decoded token contains `communities` field (not `communityMemberships`)
- `communities` array contains `id`, `name`, and `role` for each membership
- User in 3 communities → all 3 appear in decoded token payload
- Admin role encoded as `'admin'`, member encoded as `'member'`
- `user.communities ?? []` pattern handles missing field without throwing

`authMiddleware.test.ts`:
- Valid Bearer token → `req.user` populated, calls `next()`
- Expired token → 401 response, `next()` not called
- Missing Authorization header → 401 response
- Malformed token → 401 response

**Note**: If `generateJWTToken` is not directly exported, test through the `POST /auth/login` route handler using a mocked DB that returns a known user + communities.

---

### 3. feed-service — basicFeedRanker Scoring Algorithm

**Current state**: Regression tests exist for `feedComposer.ts` and `socialKarmaFeedComposer.ts`. `basicFeedRanker.ts` has zero coverage. The service jest config includes `tests/unit/` in testMatch but the directory doesn't exist yet.

**Target file**: `services/feed-service/src/services/basicFeedRanker.ts` — ranks `FeedRequest` items by social proximity (1°/2°/3°), urgency, and recency.

**Tests to write** (in `services/feed-service/tests/unit/`; create `unit/` directory):

`basicFeedRanker.test.ts`:
- 1° connection scores higher than 2°; 2° higher than 3°; 3° higher than no connection
- High urgency outranks low urgency at the same proximity level
- More recent request outranks older request at the same proximity + urgency
- Full sort: given a mixed input set, output order is deterministic and matches expected priority
- Edge case: empty input array → returns empty array
- Edge case: single item → returns that item unchanged

---

### 4. community-service — Replace Placeholder Tests

**Current state**: `tests/regression/communities.test.ts` contains `expect(true).toBe(true)` placeholder at line 9. Coverage thresholds are explicitly set to `0` in `jest.config.js` with a TODO comment. The service has a `helpers/` directory with test utilities.

**Tests to replace** (in `services/community-service/tests/regression/communities.test.ts`):
- GET /communities returns 200 with array of communities (each has `id`, `name`, `member_count`)
- GET /communities returns 401 without auth token
- POST /communities validates required fields (returns 400 on missing `name`)
- POST /communities with valid payload returns 201 with new community containing correct fields
- POST /communities returns 401 without auth token

Use the existing `helpers/` utilities for auth setup; mirror the pattern in `config-validation.test.ts`.

**CI change**: Update `services/community-service/jest.config.js` coverage thresholds from `0` to `60` for all metrics (branches, functions, lines, statements). Setting to 60% is pragmatic — database-dependent routes can't be fully unit-tested, but zero is indefensible.

---

## CI Enforcement Summary

| Service | Current bypass | Change |
|---------|---------------|--------|
| cleanup-service | `passWithNoTests: true` | Remove flag |
| community-service | All thresholds: `0` | Set to `60` |

Root `jest.config.js` threshold (80% global) stays unchanged — it is already correct.

---

## User Guide & Doc Updates

This sprint ships no new user-facing features. Required doc updates:

1. **ADR-029 status**: Update `docs/adr/ADR-029-tdd-test-framework.md` — change status from `Accepted` to `Implemented`. Add a note that the coverage enforcement gap (passWithNoTests + 0% thresholds) was closed in Sprint 53.

2. **Landing ADR JSON**: Update `apps/landing/src/data/docs/concepts/adr-029-tdd-test-framework.json` — change `"status": "accepted"` to `"status": "implemented"` and update `"description"` to include "Implemented".

3. **No new user guides required** — no user-facing behavior changed.

---

## Critical Implementation Notes

1. **Mock target for cleanup-service jobs**: Both jobs import `{ query }` from `'../database/db'`. Mock with `jest.mock('../database/db', () => ({ query: jest.fn() }))`. The `query` mock should return `{ rowCount: N, rows: [...] }`.

2. **cleanup-service jest config after removing passWithNoTests**: The config spreads `rootConfig`. Once `passWithNoTests` is removed, the root config's testMatch will govern. Verify test discovery works with `npx jest --config services/cleanup-service/jest.config.js --listTests` before committing.

3. **Order matters — write tests before removing CI bypasses**: Remove `passWithNoTests` AFTER tests are written and passing. Raise community-service thresholds AFTER real tests are in place.

4. **auth-service unit/ directory must be created**: The `tests/unit/` directory does not exist in auth-service. Create it. The jest config's `roots: ['<rootDir>/src', '<rootDir>/tests']` with default testMatch will auto-discover `tests/unit/**/*.test.ts`.

5. **feed-service testMatch**: The jest config explicitly includes `tests/unit/**/*.test.ts` — the directory just needs to be created. No config change needed for feed-service.

6. **`expect(true).toBe(true)` sweep**: After replacing in community-service, run `grep -r "expect(true).toBe(true)" .` across the whole codebase to confirm zero occurrences remain.

7. **Version bump**: Bump from v9.19.0 → v9.20.0 in `package.json` at the root.
