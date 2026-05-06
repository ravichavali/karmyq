# SPRINT 53 — Test Coverage: Critical Paths | Ready to Plan

## Handoff Document

**Date**: 2026-05-06
**Current Version**: v9.19.0
**Status**: Sprint 52 complete + deployed. Two post-sprint bug fixes shipped. Sprint 53 scope agreed — ready to plan.

---

## Quick Start

1. Read this handoff
2. Run `/sprint-planning` to spec and plan Sprint 53
3. Sprint 53 scope is already agreed (see below) — start from Step 3 (write spec)

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 37–42 | Provider profiles, rate cards, offers, dibs infrastructure | ✅ Complete |
| Sprint 50 | Wire toggle + lift scheduled-only restriction + nav simplification | ✅ Complete |
| Sprint 51 | Trust scores + explore/exploit + trust context UI | ✅ Complete |
| Sprint 52 | Trust-path visibility — names, hops, full path in DibsPrompt | ✅ Complete |
| **Sprint 53** | **Test coverage: critical paths + CI enforcement** | 🔮 Ready to plan |
| Sprint 54 | UI Facelift (Claude Design) — research-first | 🔮 Planned |
| Sprint 5X | Code-as-story docs + landing page catch-up | 🔮 Deferred |

---

## What Was Just Completed (Post-Sprint 52 Bug Fixes)

Two bugs found and fixed in this session — both shipped to demo.

### Bug fix 1: Provider offer validation used stale JWT (commits `d8040fa`)

**Symptom**: "Request not found in your communities" when making a provider offer.

**Root cause**: `validateRequestForOffer` compared provider's JWT community array against request communities. Stale JWT (or >15 communities) caused false negatives.

**Fix**: Rewrote to JOIN `communities.members` live — no more JWT dependency.

| File | Change |
|------|--------|
| `services/request-service/src/db/providerOffersDb.ts` | `validateRequestForOffer` now takes `providerUserId`, does live DB JOIN on `communities.members` |
| `services/request-service/src/routes/providerOffers.ts` | Removed communityIds extraction from JWT; pass `userId` directly |
| `services/request-service/src/routes/adminActions.ts` | Fixed wrong schema `community.members` → `communities.members` |

### Bug fix 2: Accepting a provider offer left request open (commit `f8227cd`)

**Symptom**: "Match must be in proposed state to accept" — Accept button appeared for a match that was already superseded.

**Root cause**: `offersDb.acceptOffer` inserted a `matched` match record but never set `requests.help_requests.status = 'matched'`. Request stayed `open`, old `proposed` matches remained visible in CommitmentsTab.

**Fix**: Added `UPDATE requests.help_requests SET status = 'matched'` + bulk-reject of remaining `proposed` matches after offer acceptance — mirrors dibs/match accept paths.

| File | Change |
|------|--------|
| `services/request-service/src/db/offersDb.ts` | Added request status update + proposed match rejection after offer acceptance |

**Data cleanup**: Ran audit SQL on demo server — 0 affected rows (provider offer acceptance had not been exercised end-to-end in demo yet).

---

## What Was Just Completed (Sprint 52)

**Commit**: `f035ba4 feat(dibs): Sprint 52 — trust-path visibility in DibsPrompt + feed cards`

### Changes shipped

| File | Change |
|------|--------|
| `services/social-graph-service/src/services/pathComputation.ts` | `MAX_DEPTH` 4 → 3 in `computeShortestPath` |
| `services/request-service/src/routes/dibs.ts` | After candidate selection, fetch trust path from social-graph-service (non-fatal, 3s AbortController timeout); attach `trustPath` to response |
| `apps/frontend/src/components/requests/DibsPrompt.tsx` | Added `trustPath: TrustPath \| null` to `DibsCandidate`; renders `TrustPathBadge` (full) when available, falls back to `trustContextSummary` text |
| `apps/frontend/src/components/BrowseFeed.tsx` | Already had compact trust path badge — verified, no change needed |
| `apps/frontend/src/components/Feed/FeedItem.tsx` | Already had compact trust path badge — verified, no change needed |
| `docs/guides/provider-dibs-guide.md` | Added "Trust path" section after "Trust context" section |
| `services/request-service/CONTEXT.md` | Updated dibs-candidate response shape to include `trustPath` |
| `services/social-graph-service/CONTEXT.md` | Updated "Max depth: 4 degrees" → "Max depth: 3 degrees" (two occurrences) |
| `services/registry.json` | Bumped `updated` to 2026-05-06 |
| `services/request-service/tests/tdd/sprint-52-trust-path.test.ts` | 3 new TDD tests — all passing |

### Test results
- `sprint-52-trust-path.test.ts`: 3/3 pass
- Unit + regression (`npm test`): 27/27 task suites pass
- TypeScript: request-service, social-graph-service, frontend — all clean

### Key implementation decisions
- **Internal URL**: `http://social-graph-service:3010/social-graph/paths/:userId` (nginx strips `/api`, not service prefix)
- **Forward Authorization header**: social-graph reads `req.user?.userId` from JWT — header must be forwarded
- **Non-fatal**: trust path fetch wrapped in try/catch + 3s timeout; `trustPath: null` on any error
- **Feed cards already wired**: `BrowseFeed.tsx` and `FeedItem.tsx` already had `useTrustPath` + compact `TrustPathBadge` — Sprint 52 verified, no code change needed

---

## Sprint 53 — Scope Agreed (ready to spec + plan)

**Theme**: Test coverage — critical paths + CI enforcement

**Goal**: Add meaningful tests to the three highest-risk silent-failure areas, replace misleading placeholders, and enforce the existing 80% coverage threshold in CI so missing tests actually block.

### In scope

| Area | Work |
|------|------|
| **cleanup-service** | Unit tests for `expirationJob.ts` and `reputationDecayJob.ts` — time-based logic, cron trigger behavior |
| **auth-service** | Tests for permission boundaries, multi-community JWT claims, role enforcement |
| **feed-service** | Unit tests for the ranking/scoring algorithm (currently 0 unit tests for ~1,934 LOC) |
| **community-service** | Delete `expect(true).toBe(true)` placeholder tests; replace with real regression tests |
| **CI enforcement** | Remove `passWithNoTests: true` from affected services; wire 80% threshold so it blocks on push |

### Out of scope (deferred)
- messaging-service socket.io tests — hard to set up, separate sprint
- mobile app tests — separate sprint
- Landing page / docs catch-up — deferred after UI Facelift

### Definition of done
- Meaningful unit/integration tests on the risky logic in each area (not just happy-path stubs)
- `npm test` fails if threshold is not met
- No `expect(true).toBe(true)` anywhere in the codebase

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

## Ideas Captured This Session (docs/IDEAS.md)

- **ux**: Community and provider are 2 facets of the same user — provider should be able to browse community dashboard and act as a community member without switching contexts.
- **ux**: Provider and community facets should have different color patterns — visual language that signals which context you're in.
