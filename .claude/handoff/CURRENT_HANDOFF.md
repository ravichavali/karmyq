# SPRINT 53 — Code-as-Story Docs + Landing Page Catch-Up | Ready to Plan

## Handoff Document

**Date**: 2026-05-06
**Current Version**: v9.19.0 (bumped from Sprint 52 merge)
**Status**: Sprint 52 complete + deployed. Sprint 53 ready to plan.

---

## Quick Start

1. Read this handoff
2. Run `/sprint-planning` to spec and plan Sprint 53
3. Sprint 53 theme: Code-as-story feature tour docs + landing page catch-up (Sprints 42–52)

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 37–42 | Provider profiles, rate cards, offers, dibs infrastructure | ✅ Complete |
| Sprint 50 | Wire toggle + lift scheduled-only restriction + nav simplification | ✅ Complete |
| Sprint 51 | Trust scores + explore/exploit + trust context UI | ✅ Complete |
| Sprint 52 | Trust-path visibility — names, hops, full path in DibsPrompt | ✅ Complete |
| **Sprint 53** | **Code-as-story docs + new user journey + landing page catch-up** | 🔮 Ready to plan |

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

## Sprint 53 — Goals (Discussed, Not Yet Specced)

**Theme**: Code-as-story documentation + landing page catch-up

### Feature-tour documents
- One doc per major system area (dibs/matching, trust scores, feed, provider flow)
- Each doc traces a single user action from UI click → DB write → response, with real `file:line` references
- Useful for both human contributors and AI tools starting cold in the codebase
- Focus: new user journey, not just dibs internals

### Landing page catch-up
- Update landing page to reflect everything shipped since last major update (Sprints 42–52)
- Key systems to document: dibs, explore/exploit candidate selection, trust scores, trust path visibility, provider nav simplification

### Sprint 53 is a doc sprint — no service code changes expected
- Primary deliverables: markdown docs + landing page JSON updates
- Validate doc generation pipeline still works after Sprint 52

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
