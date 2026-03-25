# Sprint 39: Provider Mode UX Hardening — Design Spec

**Date**: 2026-03-25
**Status**: Approved
**Version**: v9.13.0 → v9.14.0
**Sprint Branch**: `feature/sprint-39-provider-ux-hardening`

---

## Overview

Sprint 37 introduced the provider mode toggle but left several gaps: provider UI leaks
into member mode (nav link, notification bell), the "Ask for Help" FAB shows when you're
in a provider mindset, clicking requester/helper names does nothing, and the
CommitmentsTab accept/decline buttons are wired to TODO stubs that call no API.

This sprint hardens the toggle into a true behavioral switch and closes all four gaps.
No new backend endpoints are needed — everything ships with frontend changes only.

### Core Principle: Mode is a Lens

When you switch to provider mode you're looking at the platform through a different lens —
you're there to offer services, not to request them. The UI should reflect that
completely. Member mode is for community participation; provider mode is for running
your service business.

---

## Frontend Changes

### 1. Provider Nav Link Gating (`Layout.tsx`)

The "Providers" nav link (both desktop and hamburger) currently shows for all logged-in
users. It should be visible **only when `providerMode === 'provider'`**.

- `Layout.tsx` doesn't currently use `useProvider()` — add it.
- Gate the desktop `<Link href="/providers">` behind `providerMode === 'provider'`.
- Gate the hamburger menu "Service Providers" `<Link>` behind the same condition.
- The `ProviderModeSwitcher` remains visible always (so users can switch modes).

### 2. Provider Notification Bell Gating (`ProviderNotificationBell.tsx`)

`ProviderNotificationBell` currently renders whenever `hasProviderProfile === true`
(regardless of current mode). This means the amber bell appears in member mode, leaking
provider context. Add `providerMode` check: only render when both
`hasProviderProfile === true` AND `providerMode === 'provider'`.

### 3. Hide SpeedDial FAB in Provider Mode (`SpeedDialFab.tsx`, `dashboard.tsx`)

In provider mode the user is browsing requests to offer help — they are not there to
request help themselves. The "Get Help" and "Get Service" FAB actions are member-mode
concepts. In provider mode, return `null` from `SpeedDialFab`.

- Add `isProviderMode: boolean` prop to `SpeedDialFab`.
- If `isProviderMode === true`, return `null` immediately (before tab logic).
- `dashboard.tsx` already has `isProviderMode` — pass it to `SpeedDialFab`.

### 4. Wire CommitmentsTab Accept/Reject (`CommitmentsTab.tsx`)

`handleAccept` and `handleDecline` are TODO stubs with no API calls. Wire them:

| Side | Action | API call |
|------|--------|----------|
| "I Asked For Help" + `proposed` | Accept | `requestService.acceptMatch(matchId, currentUser.id)` |
| "I Asked For Help" + `proposed` | Decline | `requestService.rejectMatch(matchId, currentUser.id)` |
| "I'm Helping" + `proposed` | (change label) Withdraw | `requestService.rejectMatch(matchId, currentUser.id)` |

The "I'm Helping" section shows `proposed` matches where the current user already
offered — they can't "Accept" their own offer. Rename those buttons to "Withdraw"
(single button, calls `rejectMatch`). On success, remove the match from state.

On success for "requested" accept: refresh the match list (re-fetch) so status updates
everywhere consistently.

### 5. Clickable Names → TrustCard (`CommitmentsTab.tsx`, `FeedItem.tsx`)

**CommitmentsTab**:
- "I'm Helping" card: make `m.requester_name` a clickable button → opens `TrustCard`
  with `m.requester_id` (available from API response). Skip if no `requester_id`.
- "I Asked For Help" card: make `m.responder_name` a clickable button → opens `TrustCard`
  with `m.responder_id` (always present in match response).
- Add `TrustCard` import and a `selectedProfileUserId` state to `CommitmentsTab`.

**FeedItem**:
- `OpenRequestItem`: "Posted by `{data.author_name}`" is plain text. Wrap name in a
  `<button>` that sets `selectedTrustUserId` (state already exists for TrustPathBadge).
  Re-use the same `selectedTrustUserId` state and `TrustCard` already rendered at the
  bottom of `OpenRequestItem`. No new state needed.
- `SuggestedRequestItem`: "From: `{data.community_name}`" row already shows trust badge.
  Make `data.author_name` (or the requester name if present) clickable. Check
  `SuggestedRequestData` type for the author name field.

---

## User Guide & Doc Updates

- Update `docs/guides/provider-guide.md` (or create if not yet existing): document the
  mode toggle behavior — what's visible in each mode, how to switch, the FAB difference.
- Update landing page: `apps/landing/src/data/docs/guides/provider-guide.json`.
- Add nav entry to `nav.json` if the guide is new (via `generate-docs.ts`).

---

## Critical Implementation Notes

1. **`useProvider()` in Layout.tsx** — `ProviderProvider` wraps the whole app in
   `_app.tsx`, so `useProvider()` works in Layout without any context changes.

2. **CommitmentsTab accept/reject state update** — after a successful `acceptMatch`,
   the match status changes from `proposed` → `matched` server-side. Update local state
   optimistically (change status in array) AND re-fetch to ensure consistency.
   After a successful `rejectMatch` on the "requested" side, remove the match from the
   `requested` array (it's rejected, not shown anymore).

3. **CommitmentsTab "helping" withdraw** — `rejectMatch` is used for withdraw too.
   On success, remove the match from the `helping` array.

4. **No `requester_id` guard** — `requester_id` is optional in the Match interface.
   Wrap the clickable name in a condition: `{m.requester_id ? <button>...</button> : <span>...</span>}`.

5. **`SuggestedRequestData` type** — check `apps/frontend/src/types/feed-items.ts`
   for the field name of the requester. If no requester name is on the type, skip the
   clickable name for that item type and only apply to `OpenRequestItem`.

6. **No DB migration** — this sprint is frontend-only.

7. **Generate-docs is source of truth** — add new guide to `GUIDE_ORDER/GUIDE_LABELS/GUIDE_SLUGS`
   in `scripts/generate-docs.ts`, then run `npm run generate-docs`. Never edit nav.json directly.
