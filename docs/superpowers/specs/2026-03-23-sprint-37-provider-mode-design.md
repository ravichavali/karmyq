# Sprint 37: Provider Mode + Notification Separation — Design Spec

**Date**: 2026-03-23
**Status**: Approved
**Version**: v9.11.0 → v9.12.0
**Sprint Branch**: `feature/sprint-37-provider-mode`

---

## Overview

Karmyq has always had two distinct personas living in one interface: a community member who makes and responds to requests, and a service provider who offers skilled help for compensation or karma. Today the UI treats both as the same person — the same feed, the same notifications, the same nav. As more users build provider profiles, this conflation creates friction: providers get buried in community noise, miss incoming service requests, and have no clear "working" view of their provider activity.

Sprint 37 introduces **Provider Mode** — a role switcher in the top nav that shifts the entire UI into a provider-focused lens without removing the user from their community context. In Provider mode, the dashboard feed shows only requests matching the user's service type(s), a stats card surfaces active commitments and pending reviews, and the nav reorients around provider workflows. Switching back to Member mode restores the existing community experience instantly.

The second half of this sprint rationalizes the notification system. Currently all 18 notification types flow into a single bell — karma milestones, community invites, match reminders, and pre-selections all compete for the same space, and provider-relevant alerts are indistinguishable from social noise. Sprint 37 splits this into two distinct streams: a **Community bell** for member activity and a **Provider bell** for service-related events. Two new notification types are added (`provider_request_matched`, `provider_review_received`), and the volume is rationalized so notifications only fire when they drive meaningful action.

Finally, three carry-forward test failures from previous sprints (`preSelectProvider`, `trust-evolution-flow`, `rateCards`) get root-cause fixes rather than skips.

### Core Principle: Role Clarity Without Context Switching

The mode toggle is not a separate app — it's a lens. Both modes share the same community membership, the same karma, the same trust graph. Switching modes takes under a second and preserves all navigation context.

---

## Multi-Sprint UX Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **33** | Design system foundation | ✅ Complete |
| **34** | Tab navigation + feed simplification | ✅ Complete |
| **35** | Request wizard + service hiring CTA | ✅ Complete |
| **36** | Commitment depth + admin power + community discovery | ✅ Complete |
| **37** | Provider mode + notification separation | 🔜 This sprint |
| **38** | ? (TBD — likely trust visibility or member profile depth) | Upcoming |

---

## New Concepts

### Provider Mode
A UI-level lens activated by a `Member / Provider` pill toggle in the top nav. Stored in `localStorage` as `karmyq_provider_mode` with values `'member'` (default) or `'provider'`. When set to `'provider'`:
- The dashboard feed shows requests matching the user's provider service type(s)
- A `ProviderDashboardCard` appears at the top of the dashboard with live stats
- The notification bell area shows two bells: Community + Provider

Mode is ephemeral UI state — it is never sent to the server and does not affect API calls except as a client-side filter on the feed query.

### Provider Notification Stream
A subset of all notifications filtered client-side to the set of `PROVIDER_NOTIFICATION_TYPES`. Displayed in a separate `ProviderNotificationBell` component alongside the existing community bell. No DB migration required — category is derived from `notification.type`.

---

## Data Model

No new database tables. Two new notification template entries only (TypeScript, no migration).

### New notification types (added to `NotificationType` union in `notificationTemplates.ts`)

**`provider_request_matched`**
- Trigger: A new request of a matching `service_type` is posted in a community the provider belongs to.
- Priority: `high`
- Channels: `in_app: true, push: false, email: false`
- Title: `"New ${service_type} request — can you help?"`
- Body: `"${requester_name} needs help with: \"${request_title}\""`
- CTA: `"View Request"` → `/requests/${request_id}`

**`provider_review_received`**
- Trigger: A requester submits a review/rating after match completion.
- Priority: `medium`
- Channels: `in_app: true, push: false, email: false`
- Title: `"You received a new review"`
- Body: `"${reviewer_name} left you a ${rating}-star review: \"${review_excerpt}\""`
- CTA: `"View Review"` → `/providers/${provider_id}`

### Event flow for `provider_request_matched`

When request-service publishes the `request_created` event, it must include `service_type` (already available on typed requests). The notification service subscriber, on receiving `request_created`:
1. Checks if `service_type` is present
2. If yes: calls `GET /api/requests/providers?service_type={type}&community_id={id}` internally
3. Creates a `provider_request_matched` notification for each matching provider's `user_id`
4. Skips the requester's own user_id

### Event flow for `provider_review_received`

Request-service already emits nothing on review submission. Add: after a provider review is saved, publish a `provider_review_received` event to the Bull queue. Notification service subscriber handles it.

---

## API Endpoints

No new REST endpoints. One new event publisher, one new event subscriber handler.

| Layer | Change | File |
|-------|--------|------|
| notification-service | Add `provider_request_matched` template | `src/templates/notificationTemplates.ts` |
| notification-service | Add `provider_review_received` template | `src/templates/notificationTemplates.ts` |
| notification-service | Handle `provider_request_matched` event in subscriber | `src/events/subscriber.ts` |
| notification-service | Handle `provider_review_received` event in subscriber | `src/events/subscriber.ts` |
| request-service | Include `service_type` in `request_created` event payload | `src/routes/requests.ts` |
| request-service | Publish `provider_review_received` event after review saved | `src/routes/providers.ts` |

---

## Frontend Changes

### New components

| Component | Path | Description |
|-----------|------|-------------|
| `ProviderModeSwitcher` | `src/components/ProviderModeSwitcher.tsx` | `Member / Provider` pill toggle. Only rendered when user has ≥1 provider profile. Shows soft "Become a Provider" link if user has no profiles. Reads/writes `localStorage` key `karmyq_provider_mode`. |
| `ProviderDashboardCard` | `src/components/ProviderDashboardCard.tsx` | Stats card shown at top of dashboard in Provider mode. Displays: active commitments count, pending reviews count, completion rate %, avg response time. Fetches from `GET /api/requests/providers/my` + `GET /api/requests/matches?role=responder`. |
| `ProviderNotificationBell` | `src/components/ProviderNotificationBell.tsx` | Wrench/briefcase icon bell showing unread count of provider-stream notifications. Same dropdown as community bell but filtered to `PROVIDER_NOTIFICATION_TYPES`. |

### Modified files

| File | Change |
|------|--------|
| `src/components/Layout.tsx` | Add `ProviderModeSwitcher` to top nav (desktop, between nav links and notification area). Add `ProviderNotificationBell` next to existing `NotificationBell`. |
| `src/contexts/NotificationContext.tsx` | Expose `providerNotifications`, `communityNotifications`, `providerUnreadCount` derived from the existing `notifications` array. No new API calls. |
| `src/components/NotificationBell.tsx` | Rename to community bell; uses `communityUnreadCount` from context. |
| `src/components/NotificationItem.tsx` | Add `preferred_provider_selected`, `match_reminder`, `provider_request_matched`, `provider_review_received` to `getIcon()` and `getCtaLabel()` switch cases. |
| `src/pages/dashboard.tsx` | When `providerMode === 'provider'`: render `ProviderDashboardCard` above TabBar, pass `serviceTypes` filter to `BrowseFeed`. Feed tab label changes to "Requests for Me". |
| `src/components/HamburgerMenu` (in `Layout.tsx`) | Add "Provider Mode" toggle link in mobile hamburger menu. |

### PROVIDER_NOTIFICATION_TYPES constant

Defined in `src/lib/notificationCategories.ts` (new file):

```typescript
export const PROVIDER_NOTIFICATION_TYPES = new Set([
  'preferred_provider_selected',
  'provider_request_matched',
  'provider_review_received',
  'match_reminder',
])
```

All other types are community notifications.

### Mode switcher behaviour detail

- Visible: only when user has ≥1 provider profile (check via `GET /api/requests/providers/my` on app mount, cache result in `ProviderContext`)
- Not visible / shows CTA: user has no provider profiles
- Mobile: pill toggle appears inside hamburger menu; `ProviderNotificationBell` appears in the top-right area next to community bell
- Mode is read by `dashboard.tsx` via a `useProviderMode()` hook (reads localStorage)

---

## User Guide & Doc Updates

Every sprint ships doc updates. The following must be created/updated in `apps/landing/`:

### New guides
- **`provider-mode.json`** (new) in `apps/landing/src/data/docs/guides/` — "Using Provider Mode": what it is, how to toggle, what changes in Provider mode, how to create a provider profile to unlock it
- **`managing-notifications.json`** (new) in `apps/landing/src/data/docs/guides/` — "Managing Your Notifications": community vs. provider streams, how to read each bell, notification types that exist and when they fire

### Updated guides
- **`finding-providers.json`** — Add section on provider mode from the provider's perspective (complement to the seeker's guide)

### New concepts
- **`provider-mode.json`** (new) in `apps/landing/src/data/docs/concepts/` — "Provider Mode": concept doc explaining the member/provider duality, why the split exists, how mode switching works at a technical level

### nav.json additions
- Add `provider-mode` to "User Guides" section
- Add `managing-notifications` to "User Guides" section
- Add `provider-mode` (concept) to "Concepts" section

---

## Carry-Forward Test Fixes

These are root-cause fixes, not skips.

| Test | Location | Likely Root Cause | Fix Approach |
|------|----------|-------------------|-------------|
| `preSelectProvider` | `tests/tdd/` or `tests/unit/` | Provider pre-selection component or API call reference is stale (renamed/moved since test was written) | Read test, trace to actual component/function, update import paths or mock targets |
| `trust-evolution-flow` | `tests/tdd/` | Likely Bull queue lazy-init issue — `_communityEvolutionQueue` is null at module load (known persistent context note) | Add proper queue initialization guard in test setup, or mock the queue correctly |
| `rateCards` | `tests/tdd/` | Rate card soft-delete uses `is_active = false` but test may expect hard-delete or incorrect status check | Read test assertions, align with actual API contract (soft-delete) |

Each fix must be verified by running the individual test file before marking done.

---

## Critical Implementation Notes

1. **Provider mode is UI-only — never send it to the server.** The `karmyq_provider_mode` localStorage value must never be included in API request bodies or headers. It is purely a client-side display filter.

2. **Mode switcher only appears when user has a provider profile.** On app mount, `GET /api/requests/providers/my` is called once and cached in a `ProviderContext`. If the response returns an empty array, the switcher shows "Become a Provider" link (`/providers/new`). If array is non-empty, show the pill toggle.

3. **Provider feed uses `service_type` filter, not a new endpoint.** The existing `BrowseFeed` component accepts a `serviceTypeFilter` prop. In Provider mode, pass the user's provider service types (may be multiple). Do not create a new `/requests/provider-feed` endpoint.

4. **Notification split is entirely client-side.** `NotificationContext` fetches all notifications as before. `providerNotifications` and `communityNotifications` are computed properties (useMemo) that filter by type. No new API calls.

5. **`provider_request_matched` must skip the requester.** When the notification service finds providers matching a new request's `service_type`, it must exclude the `requester_id` (a provider who requested their own service type should not get notified).

6. **`new_request` notification volume.** The existing `new_request` type is `medium` priority, in_app only. It is sent to community members generally. Do NOT disable it — it serves a different audience (members who might volunteer). Provider-targeted routing is handled by the new `provider_request_matched` type.

7. **No `tailwindcss-animate`.** The `animate-in` class is unavailable. Do not use it in any new components.

8. **`ProviderDashboardCard` stats must use cached/derived data.** Do not add new stats endpoints this sprint. Derive: active commitments from existing matches data (already fetched by CommitmentsTab), completion rate from provider profile trust score (already in `reputation.provider_trust_scores`). If data isn't available from existing fetches, show `—` gracefully.

9. **Carry-forward fixes: fix forward, not around.** Each failing test must be understood before touching it. Read the test, trace to the source, fix the source. No `describe.skip` or `it.skip` unless accompanied by a code comment explaining exactly why and a GitHub issue reference.
