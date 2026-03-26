# Sprint 41: Provider Offer Flow (Phase 1) — Design Spec

**Date**: 2026-03-26
**Status**: Approved
**Version**: v9.15.0 → v9.16.0
**Sprint Branch**: `feature/sprint-41-provider-offer-flow`

---

## Overview

When a provider goes on duty, they need to know immediately which community members need their help. Today, the toggle exists but nothing happens — no notifications, no request feed. This sprint builds the full real-time loop: provider on-duty → push notification of matching open requests → provider submits an offer with a price → requester gets push notified → requester accepts or declines from their dashboard.

This creates the reverse marketplace model Karmyq intends: needs are posted, available providers come to them. Rate cards pre-fill offer prices, but providers can edit per-offer for variable-scope work (a handyman visit has unknown scope; a dog-hosting quote does not).

This is Phase 1 of a multi-sprint provider flow build-out. Offer prioritization (routing to providers with strongest prior interactions first) and the "dibs" private-first request model are Sprint 42.

### Core Principle: Providers Come to Needs

Push notifications make providers aware of opportunities the moment they go on duty. Offers let them respond with concrete pricing. Requesters remain in control — they accept the offer that fits best.

---

## Multi-Sprint Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **37** | Provider Mode (profiles, rate cards, dashboard) | ✅ Complete |
| **39** | Provider UX Hardening + Accept Offers (community match flow) | ✅ Complete |
| **40** | Admin Connector Tools + Provider Toggle | ✅ Complete |
| **41** | Provider on-duty push notifications + offer submission flow | **This sprint** |
| **42** | Offer prioritization by prior interactions + direct "dibs" request | Upcoming |
| **43** | Group task communities | Upcoming |

---

## New Concepts

**Provider Offer**: A provider's response to a specific open request. Contains a price (editable, defaulting from their rate card) and an optional note. Distinct from a community match — this is a commercial offer from a provider to a requester.

**On-Duty Notification**: Expo push notification sent to a provider the moment they toggle on-duty, listing matching open requests in their communities.

**Offer → Match Bridge**: When a requester accepts a provider offer, a `requests.matches` record is created with `status = 'matched'`. The offer and the match coexist — the offer is the commercial context, the match is the platform coordination record.

**Device Push Token**: An `ExponentPushToken[...]` registered per device after the user authenticates. Stored in `auth.device_push_tokens`. The notification service looks up tokens by user ID to deliver pushes.

---

## Data Model

### New table: `auth.device_push_tokens`

```sql
CREATE TABLE IF NOT EXISTS auth.device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  platform VARCHAR(10) CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, expo_push_token)
);

CREATE INDEX idx_device_push_tokens_user_id ON auth.device_push_tokens(user_id);
```

### New table: `provider.offers`

```sql
CREATE TABLE IF NOT EXISTS provider.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  provider_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES requests.help_requests(id) ON DELETE CASCADE,
  price NUMERIC(10,2),
  note TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_provider_offers_provider_user ON provider.offers(provider_user_id);
CREATE INDEX idx_provider_offers_request ON provider.offers(request_id);
CREATE INDEX idx_provider_offers_status ON provider.offers(status);
```

---

## API Endpoints

### Auth Service — Push Tokens (new)

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| POST | /auth/push-tokens | JWT | `{ expo_push_token, platform }` | Register device push token |
| DELETE | /auth/push-tokens/:token | JWT | — | Unregister device push token |

### Provider Service — Offers (new)

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| POST | /providers/offers | JWT | `{ request_id, price, note? }` | Submit offer on an open request |
| GET | /providers/offers | JWT | — | List my submitted offers with status |
| PUT | /providers/offers/:id/withdraw | JWT | — | Withdraw a pending offer |

### Provider Service — Availability (modify existing)

| Method | Path | Auth | Body | Change |
|--------|------|------|------|--------|
| PATCH | /providers/:id/availability | JWT | `{ is_available: boolean }` | Add: publish `provider_went_on_duty` event when `is_available: true` |

### Request Service — Offers (requester side, new)

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| GET | /requests/:id/offers | JWT (requester only) | — | List offers on a request |
| PUT | /requests/offers/:id/accept | JWT (requester only) | — | Accept offer → creates match, publishes event |
| PUT | /requests/offers/:id/decline | JWT (requester only) | — | Decline offer, publishes event |

### Notification Service — Internal Push (new)

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| POST | /notifications/push/send | Internal | `{ user_ids: string[], title: string, body: string, data?: object }` | Deliver Expo push to user(s) by looking up their tokens |

---

## Event Flow

| Event | Publisher | Subscriber | Payload | Action |
|-------|-----------|-----------|---------|--------|
| `provider_went_on_duty` | Provider service | Notification service | `{ providerId, providerUserId, communityIds }` | Query open requests in provider's communities → push notify provider |
| `offer_submitted` | Provider service | Notification service | `{ offerId, requestId, requesterUserId, providerName, price }` | Push notify requester: "Someone offered to help with your request" |
| `offer_accepted` | Request service | Notification service | `{ offerId, providerUserId, requesterName }` | Push notify provider: "Your offer was accepted" |
| `offer_declined` | Request service | Notification service | `{ offerId, providerUserId }` | Push notify provider: "Your offer was declined" |

---

## Frontend Changes

### Mobile (React Native / Expo)

| Component / Hook | Change |
|-----------------|--------|
| `useExpoNotifications` (new hook in `apps/mobile/src/hooks/`) | Request push permissions, get Expo token, POST to `/auth/push-tokens` |
| Root layout (`_layout.tsx` or `App.tsx`) | Invoke `useExpoNotifications` after user is authenticated |
| Foreground notification handler | `expo-notifications` listener — show in-app alert with title/body |

### Web (Next.js)

| Component | Change |
|-----------|--------|
| `ProviderMatchingRequests` (new, `apps/frontend/src/components/`) | Shows open requests in provider's communities when on-duty; "Make Offer" button per item |
| `SubmitOfferModal` (new) | Price input (pre-filled from rate card), optional note, submit → POST `/providers/offers` |
| Provider dashboard section | Mount `ProviderMatchingRequests` when `providerMode === 'provider'` and provider is available |
| `CommitmentsTab` | New "Offers Received" section — fetches offers on each active request; Accept/Decline buttons |

---

## User Guide & Doc Updates

Every sprint ships doc updates. No new ADR (this is implementation, not an architectural decision).

**Update `apps/landing/src/data/docs/guides/provider-mode.json`**:
- Add section: "Going On Duty" — explain the toggle, what push notification arrives, what matching requests look like
- Add section: "Submitting an Offer" — walk through SubmitOfferModal, rate card pre-fill, editing price, adding a note
- Add section: "Tracking Your Offers" — explain offer statuses: pending / accepted / declined / withdrawn

**Update `apps/landing/src/data/docs/guides/using-service-providers.json`** (requester perspective):
- Add section: "Receiving Provider Offers" — explain that providers can send offers directly, how to find them in CommitmentsTab
- Add section: "Accepting or Declining an Offer" — walk through the accept/decline flow

Remember: never edit `nav.json` directly. Add source markdown to `scripts/generate-docs.ts` GUIDE_ORDER/GUIDE_SLUGS if adding new pages. These are updates to existing pages so nav.json does not change.

---

## Critical Implementation Notes

1. **Push tokens must be registered after auth** — `useExpoNotifications` must only call the API once `userId` is available in auth context. Registering before auth means the token can't be linked to a user.

2. **`provider_went_on_duty` query uses the junction table** — `requests.help_requests` has NO `community_id` column. To find matching open requests: `JOIN requests.request_communities rc ON rc.request_id = hr.id WHERE rc.community_id = ANY($1) AND hr.status = 'open'`.

3. **Rate card lookup for offer pre-fill** — query `provider.rate_cards WHERE provider_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1`. If no rate card, price field is blank (not zero).

4. **`offer_accepted` creates a `requests.matches` record** — map `provider_user_id` → `helper_id`, `request_id` → `request_id`, set `status = 'matched'`. Skip the `proposed` stage — this is an already-agreed commercial offer.

5. **Expo push API** — POST to `https://exp.host/--/api/v2/push/send` with `Content-Type: application/json`. Token format: `ExponentPushToken[xxxx]`. Install `expo-server-sdk` in notification service (`npm install expo-server-sdk`). Batch up to 100 tokens per call.

6. **One active offer per provider per request** — enforce at application layer: check for existing `pending` or `accepted` offer before inserting. Return 409 if duplicate.

7. **Locate the existing availability endpoint** — `providerService.updateAvailability` in the frontend calls some endpoint. Find it in `services/provider-service/src/routes/` before modifying — do not guess the path.

8. **`communityIds` in `provider_went_on_duty` event** — the provider service must look up the provider's community memberships at the time of the event (from JWT `communities` field or a DB query) to include in the event payload.
