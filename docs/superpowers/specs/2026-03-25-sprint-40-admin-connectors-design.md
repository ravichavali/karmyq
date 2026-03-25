# Sprint 40: Admin & Moderator Connector Tools — Design Spec

**Date**: 2026-03-25
**Status**: Approved
**Version**: v9.14.0 → v9.15.0
**Sprint Branch**: `feature/sprint-40-admin-connectors`

---

## Overview

Karmyq's admin and moderator tools exist in a partially-built state: the boost button shows an ⚡ badge but doesn't change how requests appear in the member feed; the "Propose a Match" modal works but the requester has no way to know an admin suggested the match; and two long-standing bugs (provider availability buried in the wrong screen, geolocation community discovery returning empty) undermine trust during cold-start user testing.

This sprint makes the admin "connector" role real. When an admin spotlights a request, members see it rise in their feed with a "Community Pick" badge. When an admin suggests a helper, the requester sees "Suggested by your community admin" in their commitments. Together these tools let admins actively facilitate connections — not just moderate.

The two bug fixes (availability toggle + geo list) close high-visibility gaps that a cold-start user would hit immediately.

### Core Principle: Admins Are Active Facilitators

Admin actions should be legible to the people they affect. A boosted request, a suggested match — members should see these as intentional community stewardship, not invisible backend magic.

---

## Multi-Sprint UX Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **36** | Admin power tools (boost, propose match UI) | ✅ Complete |
| **37** | Provider Mode | ✅ Complete |
| **38** | Contextual Trust + Member Profile Depth | ✅ Complete |
| **39** | Provider Mode UX Hardening + Accept Offers | ✅ Complete — v9.14.0 |
| **40** | Admin Connector Tools (make them real) + bug fixes | This sprint |
| **41** | Onboarding / First-run UX (empty states, welcome flow) | Upcoming |

---

## What Already Exists (no new work needed)

These were built in Sprint 36 and are fully wired:
- `is_boosted`, `boosted_at`, `boosted_expires_at` columns on `requests.help_requests`
- `requestService.boostRequest()` + `requestService.removeBoost()` in admin UI
- `POST /requests/:id/propose-match` endpoint (`adminActions.ts`) with admin auth check
- Member picker modal in `communities/[id].tsx` (admin Requests tab)
- `requestService.markUrgent()` + UI button (left alone this sprint — already works)

---

## What This Sprint Adds

1. **Boost affects curated feed rank** — active boost floats the request higher in member feeds
2. **"Community Pick" badge in FeedItem** — members see a teal badge on boosted requests
3. **`admin_proposed` flag on matches** — `propose-match` route sets this; GET /matches returns it
4. **"Suggested by admin" in CommitmentsTab** — requester sees who initiated the match
5. **Provider Availability Toggle on ProviderDashboardCard** — toggle accessible from provider mode dashboard
6. **Geolocation community list fix** — graceful fallback when seed communities lack coordinates

---

## Data Model

### New column: `requests.matches.admin_proposed`

```sql
ALTER TABLE requests.matches
  ADD COLUMN admin_proposed BOOLEAN NOT NULL DEFAULT FALSE;
```

Migration file: `infrastructure/postgres/migrations/20260325-admin-proposed-match.sql`

No other schema changes. `is_boosted` and related columns already exist.

---

## API Endpoints

| Method | Path | Change | Auth |
|--------|------|--------|------|
| GET | `/requests/curated` | Returns `is_boosted`, `boosted_expires_at` per item; boost adds flat +30 to feedScore when active | JWT |
| POST | `/requests/:id/propose-match` | Sets `admin_proposed = TRUE` in INSERT | JWT + community admin |
| GET | `/matches` | Adds `admin_proposed` to SELECT and response | JWT |
| GET | `/communities?mode=geography&lat=&lng=` | Returns `fallback: true` + all active communities when geo query returns 0 rows | JWT |

---

## Frontend Changes

| Component/Page | Change |
|----------------|--------|
| `Feed/FeedItem.tsx` | Add "Community Pick" teal badge when `is_boosted && !expired` |
| `types/feed-items.ts` | Add `is_boosted?: boolean`, `boosted_expires_at?: string` to `OpenRequestData` |
| `components/CommitmentsTab.tsx` | Add "Suggested by your community admin" label below match card when `admin_proposed === true` |
| `types/` or CommitmentsTab inline | Add `admin_proposed?: boolean` to Match interface |
| `components/ProviderDashboardCard.tsx` | Add Available/Unavailable toggle; calls `providerService.updateAvailability`; optimistic update |
| `pages/communities/index.tsx` | Show "Showing all communities — location unavailable" message when fallback |

---

## User Guide & Doc Updates

**Update**: `apps/landing/src/data/docs/guides/admin-community.json`

Add a new section: "Acting as a Connector" covering:
- How to spotlight a request (Boost) and what members see
- How to suggest a helper (Propose a Match) and what the requester sees
- When to use each tool
- Note that urgency flags exist but this guide focuses on connection facilitation

The existing admin-community.json guide documents the admin interface generally. This sprint adds specific guidance on using connector tools.

Do not create a new guide. Update the existing one.

---

## Critical Implementation Notes

1. **Boost is in the DB but NOT in the curated feed SQL.** The `GET /requests/curated` query selects from `requests.help_requests` but does not include `r.is_boosted` or `r.boosted_expires_at`. Add these to the SELECT. Without this, the frontend can never show the badge.

2. **Boost scoring: flat +30 addition to feedScore.** After the existing weighted-score calculation, check `if (request.is_boosted && new Date(request.boosted_expires_at) > new Date())` and add 30 to feedScore (capped at 100). This is applied after the multi-factor weighted score, not inside it.

3. **admin_proposed migration**: The INSERT in `adminActions.ts` (`POST /requests/:id/propose-match`) needs `admin_proposed = TRUE`. The existing INSERT is `INSERT INTO requests.matches (request_id, responder_id, status) VALUES ($1, $2, 'proposed')` — add `admin_proposed` to both the column list and values.

4. **CommitmentsTab match interface**: The `admin_proposed` field must be in the type/interface used by CommitmentsTab. Check `apps/frontend/src/types/` for the Match type and add it. The CommitmentsTab fetches matches via the matches API — the GET /matches query in `matches.ts` must SELECT `m.admin_proposed`.

5. **Geo bug root cause**: Community service `GET /communities?mode=geography` filters `WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL`. Demo seed communities have no coordinates → 0 rows. Fix in two parts: (a) graceful fallback in the community service (if geo query returns 0, re-run without lat/lng filter and return `fallback: true` in the response body); (b) frontend shows "Showing all communities — we couldn't narrow by location" when `fallback: true`.

6. **Provider toggle placement**: `ProviderDashboardCard` receives props from `apps/frontend/src/pages/dashboard.tsx`. The provider profile (`providerProfiles[0]`) has `id` and `is_available`. Pass both to the card as props; the card renders a toggle that calls `providerService.updateAvailability(providerId, !currentValue)` on click, then updates local state optimistically.

7. **`OpenRequestData` type extension**: In `apps/frontend/src/types/feed-items.ts`, add `is_boosted?: boolean` and `boosted_expires_at?: string`. These are optional (backwards compatible with non-boosted requests).

8. **"Community Pick" badge expiry check**: In FeedItem, compute `const boostActive = data.is_boosted && data.boosted_expires_at && new Date(data.boosted_expires_at) > new Date()`. Only show badge when `boostActive`. Badge style: `bg-teal-100 text-teal-700 border-teal-200`.
