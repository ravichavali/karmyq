# SPRINT 54 — UI Facelift (Claude Design) | Research-First

## Handoff Document

**Date**: 2026-05-07
**Current Version**: v9.20.0 (just shipped Sprint 53)
**Status**: Sprint 53 complete + deployed. Sprint 54 is research-first — no implementation until UX audit done.

---

## Quick Start

1. Read this handoff
2. Sprint 54 begins with a **layout audit + reference product research** phase — NOT with code
3. Run `/sprint-planning` to kick off Sprint 54 with the brainstorming skill

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 51 | Trust scores + explore/exploit | ✅ Complete |
| Sprint 52 | Trust-path visibility in DibsPrompt | ✅ Complete |
| Sprint 53 | Test coverage: critical paths + CI enforcement | ✅ Complete + deployed |
| **Sprint 54** | **UI Facelift (Claude Design) — research-first** | 🔵 Next |

---

## What Was Just Completed (Sprint 53)

**Commit**: `903085b` — `feat(tests): Sprint 53 — critical-path test coverage + CI enforcement`

### New test files (32 tests total across 5 files)

| File | Tests | What it covers |
|------|-------|----------------|
| `services/cleanup-service/tests/unit/expirationJob.test.ts` | 5 | markExpiredData: 4-table UPDATE, error propagation |
| `services/cleanup-service/tests/unit/reputationDecayJob.test.ts` | 6 | updateDecayedTrustScores: formula, skip logic, UPDATE uses id not user_id |
| `services/auth-service/tests/unit/jwtClaims.test.ts` | 6 | JWT payload shape: communities field (NOT communityMemberships), role encoding |
| `services/auth-service/tests/unit/authMiddleware.test.ts` | 6 | authMiddleware: valid/expired/missing/tampered token → 401 |
| `services/feed-service/tests/unit/basicFeedRanker.test.ts` | 9 | BasicFeedRanker: proximity ordering, urgency ordering, recency, determinism, error resilience |

### Config changes
- `services/cleanup-service/jest.config.js` — removed `passWithNoTests: true`
- `services/community-service/jest.config.js` — threshold raised from 0 → 60 (scoped to `src/services/`), added `coverageProvider: 'v8'` to fix babel instrumentation bug
- `services/community-service/tests/regression/communities.test.ts` — replaced `expect(true).toBe(true)` with 8 real HTTP tests (using supertest + mocked DB + JWT)

### Docs
- `docs/adr/ADR-029-tdd-test-framework.md` — status: Accepted → Implemented
- `apps/landing/src/data/docs/concepts/adr-029-tdd-test-framework.json` — regenerated via `generate-docs`
- `package.json` — bumped to v9.20.0

---

## Sprint 54 — What To Do Next

### Theme: UI Facelift (Claude Design) — research-first

**The plan agreed in memory**:
> UX sprints start with layout audit + reference products before any implementation plan.

### Phase 1 (required before any code): Layout Audit + Research
1. **Audit current frontend layout** — document what's there, what's broken, what's inconsistent
2. **Identify reference products** — find 2-3 design references in the mutual aid / civic / social space
3. **Produce a design brief** — before touching any component, agree on direction

### Key areas likely in scope (TBD after audit):
- Community dashboard and request feed visual design
- Typography, spacing, color system
- Navigation and layout structure
- Mobile responsiveness

### Ideas captured in docs/IDEAS.md (relevant to Sprint 54):
- **ux**: Community and provider are 2 facets of the same user — provider should browse community dashboard without switching contexts
- **ux**: Provider and community facets should have different color patterns — visual language that signals which context you're in

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
- **community-service coverage**: scoped to `src/services/**/*.ts` (NOT all src files) because DB-dependent routes can't reach 60% without a live DB. coverageProvider set to 'v8' to fix babel instrumentation bug.

---

## Ideas Captured (docs/IDEAS.md)

- **ux**: Community and provider are 2 facets of the same user — provider should be able to browse community dashboard and act as a community member without switching contexts.
- **ux**: Provider and community facets should have different color patterns — visual language that signals which context you're in.
