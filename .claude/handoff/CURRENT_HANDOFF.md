# SPRINT 50 — TBD (Sprint 49 Complete)

## Handoff Document

**Date**: 2026-04-10
**Current Version**: v9.15.0
**Status**: Sprint 49 complete and deployed. Ready to plan Sprint 50.

---

## Quick Start

1. Read this handoff
2. Run `/sprint-planning` to brainstorm and plan Sprint 50
3. Once plan is ready, run `/execute-plan Sprint 50`

---

## Sprint 49 — COMPLETE ✅

Deployed to karmyq.com via commit `d1415aa`. CI/CD pipeline run 24226519934 in progress at time of handoff.

### What Was Built

**Frontend — New User Journey (6 files)**

| File | What Changed |
|------|-------------|
| `apps/frontend/src/pages/register.tsx:44` | `router.push('/dashboard')` → `router.push('/communities?welcome=true')` |
| `apps/frontend/src/pages/communities/index.tsx` | `isWelcomeFlow` const, welcome banner vs config banner, `showFilters` state with toggle, first-join detect + `karmyq_onboarded` flag + redirect to `/dashboard` after first public join |
| `apps/frontend/src/pages/dashboard.tsx` | Added `Link` import; zero-community empty state wrapping TabBar/content (`!loading && userCommunities.length === 0`); `noCommunities` prop passed to `<BrowseFeed>` |
| `apps/frontend/src/components/WelcomeModal.tsx:68` | "Get started" → "Browse my feed" |
| `apps/frontend/src/components/BrowseFeed.tsx` | `noCommunities` prop — shows CTA to `/communities` when true and feed is empty |
| `apps/frontend/src/pages/requests/index.tsx` | Empty state copy: "No requests yet" → "No requests found" with adjusted body |

**Docs & Tests**
- `docs/guides/onboarding-guide.md` — Added "Getting Started as a New User" section
- `apps/landing/src/data/docs/guides/onboarding.json` — Regenerated
- `tests/tdd/sprint-49-new-user-journey.test.ts` — 9 tests, all pass

### Key Implementation Decisions

- **First-join uses pre-join state**: `isFirstJoin` is captured before the `joinCommunity()` async call. JWT in localStorage is not refreshed post-join.
- **Private community first-join**: No redirect — user status is `pending`, not `active`. Only redirect on `accessType === 'public'` first joins.
- **WelcomeModal suppression**: `localStorage.setItem('karmyq_onboarded', '1')` is set before `router.push('/dashboard')` so WelcomeModal doesn't fire on arrival at dashboard.
- **`showFilters` state**: Initialized to `!isWelcomeFlow`. `isWelcomeFlow` is derived as a const before all state declarations (before `useState(!isWelcomeFlow)` runs).

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 47 | Group Communities — Data Model + Activity Scheduling | ✅ Complete |
| Sprint 48 | Onboarding — Contextual Workflow Guides | ✅ Complete |
| Sprint 49 | New User Journey | ✅ Complete |
| **Sprint 50** | **TBD** | 🔵 Ready to plan |

---

## Architecture Gotchas (Persistent)

- **Landing page docs source**: edit `docs/guides/*.md` + update `scripts/generate-docs.ts` arrays. Run `cd apps/landing && npm run generate-docs` to regenerate. Never hand-edit `apps/landing/src/data/docs/` directly.
- **ADR numbering**: highest existing ADR is 050. Next is **051**.
- **Router mount paths**: always mount at full path (e.g. `/communities/trust-questions`) when router uses `router.get('/')`.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **Feed weights**: no sum constraint; normalized at query time in feed-service.
- **trust-questions route**: must be registered BEFORE the generic config route in `community-service/src/index.ts`.
- **`git add` on CLAUDE.md**: file is tracked as lowercase `claude.md` — always `git add claude.md`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 tests fail) and `sprint-43-feed-ranking` (crashes). These are NOT regressions — do not attempt to fix them.
- **Solo dev — no worktrees**: work directly on feature branches (`git checkout -b feature/sprint-NN`). Worktrees cause hundreds of npm install prompts, lockfile conflicts, and jest path bugs.
