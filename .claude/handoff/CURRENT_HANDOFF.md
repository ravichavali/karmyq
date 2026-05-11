# SPRINT 54 — Security Hardening | Scoping In Progress

## Handoff Document

**Date**: 2026-05-10
**Current Version**: v9.20.0 (Sprint 53 complete + deployed)
**Status**: Sprint 54 repurposed — security hardening sprint. UI Facelift deferred to Sprint 55+.

---

## Quick Start (next session)

1. Read this handoff
2. Run `/sprint-planning` to scope and plan the security sprint
3. Sprint 54 spec → implementation plan → execute

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 51 | Trust scores + explore/exploit | ✅ Complete |
| Sprint 52 | Trust-path visibility in DibsPrompt | ✅ Complete |
| Sprint 53 | Test coverage: critical paths + CI enforcement | ✅ Complete + deployed |
| **Sprint 54** | **Security hardening** | 🔵 Scoping |
| Sprint 55+ | UI Facelift (Claude Design) — deferred | ⬜ Upcoming |

---

## Sprint 54 — What To Do Next

**Theme**: Security hardening — scope to be defined via `/sprint-planning`.

### UI Facelift — deferred context (for Sprint 55+)

Audit was completed 2026-05-10. Key findings preserved here for when Sprint 55 starts:
- **Dashboard**: 4 tabs → 3 (Browse / Active / Profile), remove sidebars (full-width), merge Commitments + My Requests into action-first "Active" tab
- **Design decisions confirmed**: no sidebars, 3 tabs, action-first filter (items needing response by default)
- **Claude Design tool feedback pending** — user waiting on limits to reset; paste feedback into sprint planning session when available
- **Audit findings**: `apps/frontend/src/components/CommitmentsTab.tsx` (616 lines), `apps/frontend/src/pages/communities/[id].tsx` (2,257 lines) are the main complexity hotspots
- **Token inconsistency**: hardcoded `red-100`, `amber-100`, `blue-500` throughout — needs semantic token pass

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
