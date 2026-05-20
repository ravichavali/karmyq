# Sprint 59: Dashboard UX Simplification — Design Spec

**Date**: 2026-05-19
**Status**: Approved
**Version**: v9.25.0 → v9.26.0
**Sprint Branch**: `feature/sprint-59-dashboard-ux`

---

## Overview

The personal dashboard accumulates complexity over time: a fourth Profile tab that's just a redirect, provider stats cards that incentivize score-watching rather than helping, and no path for new users to discover provider mode. This sprint strips those back.

Four changes ship together because they share a theme — removing noise from the primary surface users see every day. The Profile tab is redundant (the avatar link in the nav already goes to /profile). The ProviderDashboardCard surfaces completion rates and response rates front-and-center, which runs counter to the anti-gamification principle: people should help because they want to, not to maintain a stat. Provider re-entry was broken in Sprint 50 when ProviderModeSwitcher was removed — users with no provider profile have no path to set one up. And accepted matches continue to appear as open requests in the Browse feed, misleading other community members.

### Core Principle: Simplicity as default

Remove anything that doesn't actively help users accomplish their immediate goal. Every element on the dashboard should earn its place by reducing friction, not adding it.

---

## Scope

### 1. Tab restructure: 4 → 3

**Current**: browse · commitments · my-requests · profile
**After**: browse · helping · asks

The Profile tab is a stub (`EmptyState` redirecting to /profile). The avatar/name link in the nav already navigates to /profile — the tab is redundant. Remove it.

Rename:
- `commitments` → `helping` (you are helping others)
- `my-requests` → `asks` (your asks to the community)

### 2. Remove ProviderDashboardCard + ProviderMatchingRequests from dashboard

`ProviderDashboardCard` renders completion rate and response rate as prominent stats above the tab bar. These metrics encourage users to optimize their numbers rather than their actual helpfulness. Remove the card entirely.

`ProviderMatchingRequests` shows open requests matching a provider's service type. This is valuable information, but it belongs in the provider context (`/providers`), not embedded above the community dashboard tab bar.

Both components remain in the codebase — they are just not rendered from `dashboard.tsx`.

### 3. Provider Mode re-entry via nav

When Sprint 50 removed `ProviderModeSwitcher`, there was no replacement path for users without a provider profile to discover or sign up for provider mode. The `/providers` nav link only renders for `hasProviderProfile` users, so new users never see it.

Fix: add a "Become a provider" link to the avatar dropdown and the mobile hamburger menu for users who do NOT yet have a provider profile. This links to `/providers/new` (the registration page that already exists).

Users who already have a provider profile continue to see the existing `/providers` link and the availability toggle — no change for them.

### 4. Feed fix: confirmed matches excluded from Browse

When a match is accepted (offer accepted by the requester), the request should no longer appear in the Browse feed. `BrowseFeed` already filters `r.status === 'open'`, so the fix is ensuring the request service updates the request's status to `matched` on offer acceptance.

Trace path: offer acceptance handler in `services/request-service/src/routes/requests.ts` → find the match acceptance endpoint (likely `PUT /requests/matches/:matchId/accept`) → verify it updates `requests.help_requests.status` to `'matched'` → if not, add that update.

---

## Data Model

No schema changes. All tables and columns already exist.

---

## API Endpoints

No new endpoints. One existing endpoint to verify/fix:

| Method | Path | Change |
|--------|------|--------|
| `PUT` | `/requests/matches/:matchId/accept` (or equivalent) | Verify it sets `help_requests.status = 'matched'` on acceptance |

---

## Frontend Changes

| File | Change |
|------|--------|
| `apps/frontend/src/components/TabBar.tsx` | Remove `'profile'` from `TabId`, update `TABS` array with new IDs + labels |
| `apps/frontend/src/pages/dashboard.tsx` | Remove profile tab render, remove ProviderDashboardCard + ProviderMatchingRequests, update URL param handling |
| `apps/frontend/src/pages/requests/[id].tsx` | Update `?tab=commitments` redirect → `?tab=helping` |
| `apps/frontend/src/components/Layout.tsx` | Add "Become a provider" link for non-providers in both desktop dropdown and mobile hamburger |

---

## User Guide & Doc Updates

Every sprint ships doc updates.

| Guide | Change |
|-------|--------|
| `apps/landing/src/data/docs/guides/getting-started.json` | Update tab names if mentioned |
| `apps/landing/src/data/docs/guides/making-a-request.json` | Update any "My Requests tab" reference → "Asks tab" |
| User guide: provider mode | Update to reflect new "Become a provider" entry point in nav |

---

## Critical Implementation Notes

1. **`TabId` type change is a breaking rename** — every file importing `TabId` or using tab ID strings must be updated. Run `grep -rn "commitments\|my-requests\|profile" apps/frontend/src/ --include="*.ts" --include="*.tsx"` before starting to find all references.

2. **Only one `?tab=commitments` URL reference exists** — `apps/frontend/src/pages/requests/[id].tsx:20`. Update to `?tab=helping`. There may also be notification service deep-link URLs — check `services/notification-service/src/` for hardcoded dashboard tab paths.

3. **ProviderDashboardCard + ProviderMatchingRequests**: removing their render from dashboard.tsx doesn't remove the components or the `useProvider()` call — the context hook is still needed for the provider availability toggle in the nav. Only remove the JSX rendering of those two components in dashboard.tsx.

4. **`activeCommitmentsCount`** (line 419 of dashboard.tsx) — computed for `ProviderDashboardCard`'s `activeCommitments` prop. Once the card is removed, this variable becomes unused. Remove it.

5. **Provider re-entry link target**: `/providers/new` already exists (`apps/frontend/src/pages/providers/new.tsx`). No new route needed — just add the nav link.

6. **Feed fix scope**: if the request service already sets status to `matched` on offer acceptance, the BrowseFeed bug may be a stale-fetch issue (BrowseFeed fetches independently and doesn't re-fetch when a match is accepted elsewhere). If so, the fix is adding a refetch trigger or ensuring the curated endpoint excludes `matched` requests at the query level.

7. **Tab rename: mobile bottom nav labels** — `TabBar` has both `label` (desktop) and `mobileLabel` (bottom nav) for each tab. Update both. Current: `{ id: 'commitments', label: 'Commitments', mobileLabel: 'Commits' }`. New: `{ id: 'helping', label: 'Helping', mobileLabel: 'Helping' }`.

8. **No ADR needed** — this sprint is a UX simplification, not an architectural decision.
