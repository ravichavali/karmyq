# SPRINT 49 — New User Journey

## Handoff Document

**Date**: 2026-04-09
**Current Version**: v9.14.0 → v9.15.0
**Status**: Sprint 49 specced and planned. Ready to execute.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-49-new-user-journey`
3. Open plan: `docs/superpowers/plans/2026-04-09-sprint-49-new-user-journey.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 49 Goal

A first-time visitor can register, find a community, join it, and see their feed — without hitting a dead end or empty screen.

**Why this matters:** Karmyq is being shared with real people for the first time. The current flow routes new users to `/dashboard` immediately after registration — but their feed is empty (no communities yet). The WelcomeModal explains the concept passively and dismisses, leaving the user on an empty screen with nothing to do. They have to discover `/communities` on their own.

**What we're fixing:** Route, banner, redirect, and empty states — 6 frontend files, no backend changes.

---

## Sprint 48 — COMPLETE ✅

Deployed to karmyq.com via commit `7985fe4`. CI/CD pipeline run 24172247204 completed success (12m24s).

### What was built

**Frontend — Onboarding Overlays**
- `apps/frontend/src/lib/onboarding/workflows.ts` — central config for all four workflows (feed, communities, requests, activities)
- `apps/frontend/src/hooks/useOnboarding.ts` — SSR-safe hook (initializes `shouldShow: false`, sets in `useEffect`)
- `apps/frontend/src/components/OnboardingOverlay.tsx` — step modal with Back/Next/Skip/Done + dot indicators
- Wired into: `dashboard.tsx` (feed), `communities/index.tsx`, `requests/index.tsx`, `ActivitiesTab.tsx`
- State stored in `localStorage` under key `karmyq_onboarding` — JSON object with per-workflow seen flags

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 47 | Group Communities — Data Model + Activity Scheduling | ✅ Complete |
| Sprint 48 | Onboarding — Contextual Workflow Guides | ✅ Complete |
| **Sprint 49** | **New User Journey** | 🔵 Ready to execute |
| Sprint 50 | TBD | Upcoming |

---

## What Sprint 49 Changes

**6 files, frontend-only, no backend changes:**

| File | Change |
|------|--------|
| `apps/frontend/src/pages/register.tsx:44` | `router.push('/dashboard')` → `router.push('/communities?welcome=true')` |
| `apps/frontend/src/pages/communities/index.tsx` | Welcome banner when `?welcome=true`; hide filters by default; detect first join; set `karmyq_onboarded`; redirect to `/dashboard` after first public join |
| `apps/frontend/src/pages/dashboard.tsx` | Zero-community empty state when `!loading && userCommunities.length === 0` |
| `apps/frontend/src/components/WelcomeModal.tsx` | "Get started" → "Browse my feed" (final CTA label only) |
| `apps/frontend/src/components/BrowseFeed.tsx` | Add `noCommunities` prop — shows CTA to `/communities` when true |
| `apps/frontend/src/pages/requests/index.tsx` | Improve empty state copy for new users |

**Also ships:**
- `docs/guides/onboarding-guide.md` — new section on the first-visit flow
- `tests/tdd/sprint-49-new-user-journey.test.ts` — 7 tests covering first-join logic

---

## ⚠️ Critical Implementation Notes

1. **First-join detection uses pre-join state**: Check `(user.communities ?? []).length === 0` BEFORE calling `communityService.joinCommunity()`. JWT in localStorage is not refreshed after joining.

2. **Set `karmyq_onboarded` before redirecting**: `localStorage.setItem('karmyq_onboarded', '1')` must happen before `router.push('/dashboard')`. Otherwise WelcomeModal fires on the dashboard, duplicating the welcome experience.

3. **`?welcome=true` is cosmetic-only**: Only affects which banner is shown. Must NOT affect the communities API call or filtering logic.

4. **Zero-community check must wait for loading**: Only show when `!loading && userCommunities.length === 0`, not during the loading phase.

5. **Private community first-join**: Don't redirect after requesting to join a private community — the user is "pending", not "joined". Only redirect on `accessType === 'public'` first joins.

6. **`showFilters` state init**: `useState(!isWelcomeFlow)` — `isWelcomeFlow` must be derived from `router.query.welcome` before the state is initialized. Since `useState` only reads the initial value once, derive `isWelcomeFlow` as a const before the state declarations.

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
