# SPRINT 53 — Test Coverage: Critical Paths | Ready to Execute

## Handoff Document

**Date**: 2026-05-06
**Current Version**: v9.19.0 → v9.20.0 this sprint
**Status**: Spec + plan written. Ready to execute.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-53-test-coverage`
3. Open plan: `docs/superpowers/plans/2026-05-06-sprint-53-test-coverage.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint Goal

Close the CI coverage enforcement gap: add meaningful unit tests to the four highest-risk silent-failure areas, replace `expect(true).toBe(true)` placeholders, and remove the `passWithNoTests: true` and zero-threshold bypasses so `npm test` actually blocks on missing coverage.

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 51 | Trust scores + explore/exploit | ✅ Complete |
| Sprint 52 | Trust-path visibility in DibsPrompt | ✅ Complete |
| **Sprint 53** | **Test coverage: critical paths + CI enforcement** | 🔵 Ready to execute |
| Sprint 54 | UI Facelift (Claude Design) — research-first | 🔮 Planned |

---

## What Was Just Completed (Post-Sprint 52 Bug Fixes)

Two bugs found and fixed — both shipped to demo.

### Bug fix 1: Provider offer validation used stale JWT (`d8040fa`)
**Root cause**: `validateRequestForOffer` compared provider's JWT community array against request communities. Stale JWT caused false negatives.
**Fix**: Rewrote to JOIN `communities.members` live — no more JWT dependency.

### Bug fix 2: Accepting a provider offer left request open (`f8227cd`)
**Root cause**: `offersDb.acceptOffer` inserted a `matched` match but never set `requests.help_requests.status = 'matched'`.
**Fix**: Added request status update + bulk-reject of remaining `proposed` matches after offer acceptance.

---

## Sprint 53 — What To Build

### Services in scope

| Area | What to do |
|------|-----------|
| **cleanup-service** | Create `tests/unit/expirationJob.test.ts` and `tests/unit/reputationDecayJob.test.ts`. Then remove `passWithNoTests: true` from `jest.config.js`. |
| **auth-service** | Create `tests/unit/jwtClaims.test.ts` (JWT payload shape, multi-community, role encoding) and `tests/unit/authMiddleware.test.ts` (valid/expired/missing token). Create `tests/unit/` directory first. |
| **feed-service** | Create `tests/unit/basicFeedRanker.test.ts` (social proximity, urgency, recency ranking). Create `tests/unit/` directory first. |
| **community-service** | Replace `expect(true).toBe(true)` in `tests/regression/communities.test.ts`. Raise coverage thresholds from 0% to 60% in `jest.config.js`. |
| **CI enforcement** | All threshold bypasses removed after real tests are in place. |

### Spec and plan files
- Spec: `docs/superpowers/specs/2026-05-06-sprint-53-test-coverage-design.md`
- Plan: `docs/superpowers/plans/2026-05-06-sprint-53-test-coverage.md`

---

## ⚠️ Critical Implementation Notes

1. **Mock target for cleanup jobs**: Both import `{ query }` from `'../database/db'`. Mock with `jest.mock('../database/db', () => ({ query: jest.fn() }))`. Return `{ rowCount: N, rows: [] }`.

2. **Write tests BEFORE removing CI bypasses.** Remove `passWithNoTests` from cleanup-service only after its tests pass. Raise community-service threshold only after real tests pass.

3. **auth-service `tests/unit/` doesn't exist** — must create directory. Jest config's `roots: ['<rootDir>/src', '<rootDir>/tests']` auto-discovers it once created.

4. **feed-service `tests/unit/` doesn't exist** — must create. Service jest config already includes `tests/unit/**/*.test.ts` in testMatch.

5. **JWT field is `communities`** — NOT `communityMemberships`. Tests must verify this exact field name.

6. **Task stubs in the plan have placeholder `expect(true).toBe(true)`** for auth middleware and basicFeedRanker — these are scaffolding ONLY. Read the source files first, then replace with real assertions. The stubs must not be left as placeholders after Task 4 and 5.

7. **community-service threshold**: Set to `60`, not `80`. Database-dependent routes can't reach 80% without a live DB.

8. **Version bump**: Root `package.json` → v9.20.0.

9. **Pre-existing TDD failures to ignore**: `sprint-39-provider-ux` (7 failures), `sprint-43-feed-ranking` (crashes), schema-related tests. Do NOT fix.

---

## Architecture Gotchas (Persistent)

- **Landing page docs source**: edit `docs/guides/*.md` + update `scripts/generate-docs.ts` arrays. Run `cd apps/landing && npm run generate-docs` to regenerate. Never hand-edit `apps/landing/src/data/docs/` directly.
- **ADR numbering**: highest is now 051. Next ADR is **052**.
- **TDD test placement**: sprint TDD tests go in `services/request-service/tests/tdd/` (NOT root `tests/tdd/`). Imports are relative: `../../src/...`.
- **Router mount paths**: always mount at full path (e.g. `/communities/trust-questions`) when router uses `router.get('/')`.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **Feed weights**: no sum constraint; normalized at query time in feed-service.
- **`git add` on CLAUDE.md**: file is tracked as lowercase `claude.md` — always `git add claude.md`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 tests fail), `sprint-43-feed-ranking` (crashes), schema-related tests. Do NOT fix.
- **Solo dev — no worktrees**: work directly on feature branches (`git checkout -b feature/sprint-NN`). Worktrees cause hundreds of npm install prompts, lockfile conflicts, and jest path bugs.
- **`?type=` routing in dibs-candidate**: `type === 'service'` → `getBestCandidate` (provider_profiles). Anything else → `getMutualAidBestCandidate` (auth.users).
- **Provider nav (post Sprint 50)**: `ProviderModeSwitcher` and `ProviderNotificationBell` are no longer rendered. Do not add them back. Only provider control in nav is the availability dot in `Layout.tsx`.
- **Explore tier — `sg.type = 'exchange'` only**: community-only connections do NOT qualify for explore dibs tier.
- **Trust path URL pattern**: `http://social-graph-service:3010/social-graph/paths/:userId` — nginx strips `/api` prefix but NOT the service prefix (`/social-graph`). Always use the full path when calling from request-service.
- **Provider offer acceptance**: `offersDb.acceptOffer` now correctly closes the request and rejects proposed matches. Mirrors `dibs.ts` and `matches.ts` accept paths — keep consistent if any new acceptance path is added.
- **Offer validation**: `providerOffersDb.validateRequestForOffer` uses live DB JOIN — no JWT community array. If touching this function, do not reintroduce JWT-based auth.

---

## Ideas Captured (docs/IDEAS.md)

- **ux**: Community and provider are 2 facets of the same user — provider should be able to browse community dashboard and act as a community member without switching contexts.
- **ux**: Provider and community facets should have different color patterns — visual language that signals which context you're in.
