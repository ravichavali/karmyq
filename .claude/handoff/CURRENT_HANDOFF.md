# Offer Fulfillment (ADR-033 Phase 1) - COMPLETE ✅

## Implementation Summary (Completed: 2026-02-24)

**Feature**: Type-Aware Post-Accept Workflow — Calendar, Maps, Departure Reminders
**Current Version**: v9.1.0
**Status**: Complete — all backend + frontend + tests done

---

## What Was Built

### Problem
When a ride (or other structured) request was accepted, UX dead-ended: accept → nothing happened. No calendar link, no maps, no reminder.

### Solution
Carry `payload` data through the match accept flow, show type-specific CTAs after acceptance, and schedule smart departure reminders.

---

## ✅ All Changes Complete

### DB Migration
- `infrastructure/postgres/migrations/016-match-fulfillment.sql` — adds `scheduled_at TIMESTAMPTZ` and `travel_time_minutes INTEGER DEFAULT 60` to `requests.matches`
- `infrastructure/postgres/init.sql` — updated CREATE TABLE to include both columns
- Index `idx_matches_scheduled_at` for efficient cron queries

### Backend: Request Service
- `services/request-service/src/routes/matches.ts`
  - `PUT /:id/accept` — extracts `departure_time` from ride payload → writes `scheduled_at`; accepts `travel_time_minutes` from body; returns enriched match with `request_type`, `payload`, `scheduled_at`
  - `GET /:id` — now returns `request_type`, `payload`, `scheduled_at`, `travel_time_minutes`

### Backend: Cleanup Service (Cron)
- `services/cleanup-service/src/jobs/matchReminderJob.ts` (NEW) — scans every 15 min for matches where `(scheduled_at - travel_time_minutes) BETWEEN NOW() AND NOW() + 15min`; publishes `match_reminder` Bull events
- `services/cleanup-service/src/index.ts` — added `*/15 * * * *` cron schedule
- `services/cleanup-service/package.json` — added `bull` as real dependency

### Backend: Notification Service
- `services/notification-service/src/templates/notificationTemplates.ts` — added `match_reminder` to `NotificationType` union + template
- `services/notification-service/src/events/subscriber.ts` — added `match_reminder` handler

### Frontend
- `apps/frontend/src/components/FulfillmentPanel.tsx` (NEW) — ride-aware panel:
  - Departure time display
  - Travel time selector (15/30/45/60/90/120 min) — optional, shown when `onTravelTimeChange` prop passed
  - "📅 Add to Calendar" → Google Calendar URL
  - "🗺 Get Directions" → Google Maps (pickup as waypoint, destination as endpoint, no origin = current device location)
  - Generic fallback for non-ride types
- `apps/frontend/src/components/OfferItem.tsx` — shows `FulfillmentPanel` when `status === 'matched'` and `request_type`/`payload` are present
- `apps/frontend/src/lib/api.ts` — `acceptMatch` now accepts optional `travel_time_minutes` param
- `apps/frontend/src/pages/dashboard.tsx` — `Match` interface extended with `request_type`, `payload`, `scheduled_at`, `request_title`

### Tests
- `apps/frontend/tests/tdd/FulfillmentPanel.test.tsx` (NEW) — 18 tests, all passing:
  - Calendar URL format (title, date YYYYMMDDTHHmmssZ)
  - Maps URL (destination lat/lng, origin waypoint, travelmode=driving)
  - Travel time selector interaction
  - Non-ride generic fallback
  - Missing payload graceful handling

---

## What's Next

Based on the roadmap and ADRs, consider:

1. **ADR-033 Phase 2**: UISchema `workflow_steps` for custom request types — define per-type CTAs in schema rather than hardcoded ride logic
2. **Mobile app**: After frontend feature completeness, begin React Native parity
3. **Rating/feedback flow**: Post-completion UX (currently `match_completed` template exists but no rating UI)
4. **Messaging improvements**: Group chat per request, read receipts

---

## Quick Verification

```bash
# Tests
cd apps/frontend && npx jest tests/tdd/FulfillmentPanel.test.tsx

# Full suite
npm test  # should be 27 tasks successful

# To test the full flow manually:
# 1. Create a ride request with origin, destination, departure_time in payload
# 2. Accept as another user
# 3. FulfillmentPanel should appear with departure time, calendar button, maps button
# 4. Cron fires within 15 min of (departure_time - travel_time_minutes) → in-app notification
```
