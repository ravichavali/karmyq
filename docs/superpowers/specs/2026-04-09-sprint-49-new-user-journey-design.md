# Sprint 49: New User Journey — Design Spec

**Date**: 2026-04-09
**Status**: Approved
**Version**: v9.14.0 → v9.15.0
**Sprint Branch**: `feature/sprint-49-new-user-journey`

---

## Overview

Karmyq is being shared with real people for the first time. The core adoption challenge is that mutual aid is counterintuitive compared to transactional platforms — there's no instant gratification, and a new user who lands on an empty screen has no reason to stay.

The current flow routes new users to `/dashboard` immediately after registration. Their feed is empty (they have no communities yet), and the WelcomeModal explains the concept in 3 passive info slides, then dismisses — leaving the user with nothing to do. The user has to discover on their own that `/communities` exists and that joining one is the prerequisite for everything else.

This sprint fixes that. The communities discovery page already has solid UX (geography mode, interests mode, filter panel, join button). The problem is that no new user ever gets there. We fix the routing, add a first-join experience, and ensure every empty screen has a clear path forward rather than a dead end.

### Core Principle: Action Over Explanation

Every screen in the new user flow should move the user one step closer to their first community interaction. Passive explanations ("here's how Karmyq works") are replaced with guided actions ("here's your first community — join it").

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 47 | Group Communities — Data Model + Activity Scheduling | ✅ Complete |
| Sprint 48 | Onboarding — Contextual Workflow Guides | ✅ Complete |
| **Sprint 49** | **New User Journey** | 🔵 This sprint |
| Sprint 50 | TBD | Upcoming |

---

## What Changes

### 1. Post-Registration Redirect

**Before**: `register.tsx` redirects to `/dashboard` after successful signup.

**After**: Redirects to `/communities?welcome=true`.

A new user with zero communities has no feed. Sending them to the dashboard is a dead end. Sending them to communities discovery lets them immediately take the one action that unlocks everything else.

### 2. First-Join Experience on Communities Page

When `?welcome=true` is present in the URL:

- Replace the "Community Configuration" banner (admin-focused, not relevant to new users) with a **welcome banner**: "Welcome to Karmyq! Join a community near you to get started — it's where requests, activities, and mutual aid happen."
- Hide the filter panel by default (expandable). New users don't need filters; they need to see communities.
- After the user joins their **first community** (detected by `(user.communities ?? []).length === 0` at time of join):
  - Set `localStorage.setItem('karmyq_onboarded', '1')` to suppress the WelcomeModal (they've already been welcomed)
  - Redirect to `/dashboard` so they immediately see their community's feed

### 3. Dashboard Zero-Community Empty State

If a user somehow reaches `/dashboard` with no joined communities (pre-existing users, or users who skipped the communities step), the current experience shows an empty feed with no explanation.

**After**: When `!loading && userCommunities.length === 0`, render a full-width empty state **instead of the TabBar and tab content**:

```
🏘️
You haven't joined a community yet

Communities are where requests, activities, and mutual aid happen.
Join one near you to see your feed.

[Find Communities]  →  /communities
```

### 4. WelcomeModal — Suppress for New Flow, Update for Legacy

The WelcomeModal fires on the dashboard when `karmyq_onboarded` is not set. With the new flow, new users set `karmyq_onboarded` when they join their first community, so the modal never fires for them.

The WelcomeModal remains as-is for legacy users (people who registered before this sprint). Minor update: change the final CTA from "Get started" (dismisses) to "Browse my feed" (also dismisses, but labels the action clearly).

### 5. Empty State Improvements

**BrowseFeed** (`BrowseFeed.tsx`): The current empty state says "Check back soon — your community will post requests here." This message is correct for members but confusing for a new user with no communities. Add a `noCommunities` prop — when true, show a CTA to `/communities` instead.

**Requests page** (`requests/index.tsx`): Check and improve empty state copy to guide new users toward joining a community or posting a request.

**ActivitiesTab**: Already shows "No upcoming activities. Create one to get started." — acceptable, no change needed.

---

## Frontend Changes

| File | Change |
|------|--------|
| `apps/frontend/src/pages/register.tsx` | Redirect to `/communities?welcome=true` instead of `/dashboard` |
| `apps/frontend/src/pages/communities/index.tsx` | Read `?welcome=true`; show welcome banner; detect first join; redirect to `/dashboard` after first join; set `karmyq_onboarded` |
| `apps/frontend/src/pages/dashboard.tsx` | Zero-community empty state when `userCommunities.length === 0` |
| `apps/frontend/src/components/WelcomeModal.tsx` | Update final CTA label from "Get started" to "Browse my feed" |
| `apps/frontend/src/components/BrowseFeed.tsx` | Add `noCommunities` prop; show CTA to `/communities` when true |
| `apps/frontend/src/pages/requests/index.tsx` | Improve empty state copy for new users |

No backend changes. No new API endpoints. No schema changes.

---

## User Guide & Doc Updates

- **Update existing guide**: `docs/guides/onboarding-guide.md` — add a section describing the new post-registration flow (register → communities → join → feed)
- **Landing page**: regenerate `apps/landing/src/data/docs/guides/onboarding.json` via `npm run generate-docs`

No new ADR — this is a UX routing change, not an architectural decision.

---

## Critical Implementation Notes

1. **First-join detection uses pre-join state**: Check `(user.communities ?? []).length === 0` BEFORE calling `communityService.joinCommunity()`. The JWT in localStorage is not refreshed after joining, so checking after the join call will still show `0` and isn't reliable as a "was-first" detector.

2. **Set `karmyq_onboarded` before redirecting**: `localStorage.setItem('karmyq_onboarded', '1')` must be called before `router.push('/dashboard')` in the first-join handler. Otherwise WelcomeModal fires on the dashboard, creating a duplicate welcome experience.

3. **`?welcome=true` is cosmetic-only**: The welcome flag only affects which banner is shown on the communities page. It must not affect the communities API call, filtering logic, or any other behavior. Keep it purely presentational.

4. **Zero-community check must wait for loading**: The dashboard loads `userCommunities` asynchronously. Show the zero-community empty state only when `!loading && userCommunities.length === 0` — not during the loading phase.

5. **`git add claude.md` (lowercase)**: CLAUDE.md is tracked in git as lowercase on Windows. `git add CLAUDE.md` silently does nothing.

6. **`git add -f` for new landing page docs**: `apps/landing/src/data/docs/` is gitignored. Force-add new generated files with `git add -f apps/landing/src/data/docs/guides/onboarding.json`.
