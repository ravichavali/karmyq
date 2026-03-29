# Sprint 42: Direct "Dibs" Request — Design Spec

**Date**: 2026-03-28
**Status**: Approved
**Version**: v9.16.0 → v9.17.0
**Sprint Branch**: `feature/sprint-42-dibs-request`

---

## Overview

When a requester creates a scheduled request, they may already have someone in mind — a driver who took them to the airport last time, a tradesperson who fixed their boiler, a neighbor who's helped before. Today that context is invisible: the request broadcasts to all available providers equally, and the trusted person competes on the same footing as a stranger.

Dibs makes prior positive interactions economically valuable. When a requester creates a scheduled request, the platform surfaces their most trusted candidate and offers a private first-right-of-refusal window. The window is proportional: 20% of the available lead time. If the provider accepts, a match is created immediately. If they decline or the window expires, the request broadcasts publicly as normal. The requester pays for dibs with their own lead time — no artificial floors.

ASAP requests are never gated. The dibs option is only surfaced for scheduled requests (those with a `scheduled_for` timestamp), because urgency and relationship-building are incompatible goals.

### Core Principle: Relationships Over Reach

The best match isn't the fastest one — it's the most trusted one. Dibs rewards a history of positive interactions by giving those providers a private window before the request enters the open market.

---

## Multi-Sprint Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **40** | Admin Connector Tools + Provider Toggle | ✅ Complete — v9.15.0 |
| **41** | Provider on-duty push notifications + offer submission flow | ✅ Complete — v9.16.0 |
| **42** | Direct "Dibs" Request — scheduled-only private first-refusal | **This sprint** |
| **43** | Offer prioritization ranking in public feed | Upcoming |
| **44** | Group task communities | Upcoming |
| **45** | Onboarding / First-run UX | Upcoming |

---

## New Concepts

### `scheduled_for`
A new unified timestamp on `requests.help_requests` representing when the help is needed. Separate from type-specific payload fields (`departure_time`, `event_date`) — those describe the event details, while `scheduled_for` is the canonical field for dibs window calculations. For typed requests (ride, event), both are set on creation from the same input.

### Dibs Window
`expires_at = created_at + 0.20 × (scheduled_for − created_at)`. Requester-controlled by how far out they schedule. No floor — a tight window is the cost of scheduling late.

### `dibs_pending` Status
A new request status indicating the request is in a private dibs window. The request is not visible in the public feed or offer flow while in this state.

### Candidate Scoring
Providers are ranked using four signals in priority order:
1. **Community membership** — base filter (same communities as request)
2. **Trust score** — from `reputation.provider_trust_scores`
3. **Prior positive interactions** — count of completed matches between provider and requester
4. **Trust graph** — exchange connections in `social_graph.connections`

Geo-proximity is deferred to Sprint 43 — community membership serves as the proximity proxy in this sprint.

---

## Data Model

### Migration 1 — `scheduled_for` on help_requests

```sql
-- infrastructure/postgres/migrations/20260328-help-requests-scheduled-for.sql
ALTER TABLE requests.help_requests
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_help_requests_scheduled_for
  ON requests.help_requests(scheduled_for)
  WHERE scheduled_for IS NOT NULL;
```

### Migration 2 — `dibs_pending` enum value

```sql
-- included in migration 1 file (enum alterations must precede table creation)
ALTER TYPE request_status_enum ADD VALUE IF NOT EXISTS 'dibs_pending' AFTER 'open';
```

### Migration 3 — `requests.dibs` table

```sql
-- infrastructure/postgres/migrations/20260328-dibs.sql
CREATE TABLE IF NOT EXISTS requests.dibs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       UUID NOT NULL REFERENCES requests.help_requests(id) ON DELETE CASCADE,
  requester_id     UUID NOT NULL,
  provider_user_id UUID NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(request_id)   -- one dibs per request; no retry after terminal state
);

CREATE INDEX IF NOT EXISTS idx_dibs_provider_pending
  ON requests.dibs(provider_user_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_dibs_expires_at
  ON requests.dibs(expires_at) WHERE status = 'pending';
```

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/requests/:id/dibs-candidate` | Requester (own request) | Returns top-scored provider candidate + score breakdown |
| `POST` | `/requests/:id/dibs` | Requester (own request) | Send dibs to a specific provider_user_id |
| `PUT` | `/requests/dibs/:id/accept` | Provider (dibs target) | Accept dibs → creates `requests.matches` record |
| `PUT` | `/requests/dibs/:id/decline` | Provider (dibs target) | Decline dibs → request reverts to `open` |

### `GET /requests/:id/dibs-candidate`

Returns the top ranked provider candidate and up to 4 alternatives for the requester to choose from.

**Response:**
```json
{
  "success": true,
  "data": {
    "topCandidate": {
      "providerUserId": "uuid",
      "displayName": "Sarah K.",
      "trustScore": 82,
      "priorInteractions": 3,
      "isDirectConnection": true,
      "score": 91
    },
    "alternatives": [ ...same shape, max 4... ]
  }
}
```

Returns `{ data: null }` if no eligible candidates (no prior interactions with any provider).

### `POST /requests/:id/dibs`

**Body:** `{ "provider_user_id": "uuid" }`

**Validates:**
- Request belongs to requester
- Request `scheduled_for` is set (not null) — ASAP requests rejected with 400
- No existing dibs on this request (unique constraint)
- Provider has at least one prior completed match with requester
- Provider is `is_available = true`

**On success:**
- Creates `requests.dibs` record with `expires_at` = `created_at + 0.20 × (scheduled_for − created_at)`
- Sets `help_requests.status = 'dibs_pending'`
- Publishes `dibs_submitted` event → notification to provider

### `PUT /requests/dibs/:id/accept`

**Validates:** Dibs belongs to the authenticated provider, status = 'pending', not expired.

**On success:**
- Updates `dibs.status = 'accepted'`
- Creates `requests.matches` record with `status = 'matched'`, `helper_id = provider_user_id`
- Sets `help_requests.status = 'matched'`
- Publishes `dibs_accepted` event → notification to requester

### `PUT /requests/dibs/:id/decline`

**On success:**
- Updates `dibs.status = 'declined'`
- Sets `help_requests.status = 'open'` (back to public)
- Publishes `dibs_declined` event → notification to requester

---

## Scoring Algorithm

Implemented in `services/request-service/src/services/dibsScoringService.ts`.

```typescript
// Base pool: providers in request's communities with is_available = true
// Must have at least one prior completed interaction to be dibs-eligible

score =
  trustScore * 0.50            // 0–50 pts  (from reputation.provider_trust_scores)
+ min(priorInteractions, 3) * 11.67  // 0–35 pts  (capped at 3 interactions)
+ trustGraphBonus              // 0 | 10 | 15 pts (indirect | direct exchange connection)
```

Returns ranked array. Only providers with `priorInteractions >= 1` are eligible for dibs.

---

## Dibs Expiry (Cleanup Service)

Add a cron scan to `/services/cleanup-service/src/jobs/`:

```typescript
// Every 5 minutes — check for expired pending dibs
const expired = await db.query(`
  SELECT d.id, d.request_id
  FROM requests.dibs d
  WHERE d.status = 'pending' AND d.expires_at < NOW()
`);

for (const dibs of expired) {
  await db.query(`UPDATE requests.dibs SET status = 'expired' WHERE id = $1`, [dibs.id]);
  await db.query(`UPDATE requests.help_requests SET status = 'open' WHERE id = $1`, [dibs.request_id]);
  await publishEvent('dibs_expired', { dibsId: dibs.id, requestId: dibs.request_id });
}
```

---

## Frontend Changes

### Request Creation Flow (Frontend + Mobile)
- Add `scheduled_for` datetime picker to ride and event creation forms (maps same value as `departure_time` / `event_date`)
- For generic/borrow/service: no change — no scheduling, no dibs

### Post-Creation Dibs Prompt (Frontend)
After a scheduled request is created, if `GET /requests/:id/dibs-candidate` returns a candidate:

> "Send to Sarah K. first? (3 prior helps · Direct connection)"
> [Send Dibs] [Skip — post publicly]

Shown as a non-blocking modal/bottom sheet. Dismissing posts publicly immediately.

### Provider CommitmentsTab — "Dibs Requests" Section
New section above the existing "Offers Submitted" section. Each row shows:
- Request title + scheduled time
- Countdown timer (expires in Xh Ym)
- [Accept] [Decline] buttons

### Requester CommitmentsTab / Request Detail
Dibs-pending requests show a "Private — awaiting response from [Name]" badge with time remaining.

---

## User Guide & Doc Updates

**Mandatory — ship with the sprint:**

1. **New user guide**: `apps/landing/src/data/docs/guides/dibs-request.json` — "Sending a Private Request (Dibs)"
   - What dibs is and when it's available
   - How the window works (20% of lead time, their cost)
   - What happens when provider accepts / declines / window expires

2. **Update existing guide**: `apps/landing/src/data/docs/guides/making-requests.json`
   - Add "Scheduled Requests" section explaining `scheduled_for`
   - Add link to dibs guide

3. **Update existing guide**: `apps/landing/src/data/docs/guides/provider-mode.json`
   - Add "Responding to Dibs" section explaining the CommitmentsTab dibs section and the time window

4. **New concept page** (optional but recommended): `apps/landing/src/data/docs/concepts/dibs-and-trust.json`
   - The philosophy: depth over breadth, relationships over reach
   - How the scoring model works

---

## Critical Implementation Notes

1. **`scheduled_for` is separate from payload datetime fields** — For rides, set both `scheduled_for = departure_time` and keep `departure_time` in payload. Same for events. `scheduled_for` is the canonical field for dibs; the payload fields drive the type-specific display.

2. **Dibs window formula has no floor** — `expires_at = created_at + 0.20 × (scheduled_for − created_at)`. If a requester schedules close and the window is 20 minutes, that's their tradeoff. Do not add a minimum.

3. **`dibs_pending` must be excluded from public feed** — Any query in feed-service, request-service, or simulation that fetches `status = 'open'` requests must NOT include `dibs_pending`. Add explicit `AND status = 'open'` or `AND status NOT IN ('dibs_pending', 'matched', 'completed', 'cancelled')` to public queries.

4. **One dibs per request, no retry** — `UNIQUE(request_id)` on `requests.dibs`. Once a dibs reaches any terminal state (accepted/declined/expired), the request is either matched or permanently public. There is no mechanism to send a second dibs.

5. **Provider eligibility gate** — Only providers with at least one prior `status = 'completed'` match linking them to the requester appear in candidate results. Verify whether the provider's user_id column in `requests.matches` is `helper_id` or `responder_id` by reading the existing routes before implementing the query.

6. **Dibs acceptance skips `provider.offers`** — Accept creates `requests.matches` directly with `status = 'matched'`. This keeps Sprint 42 scope tight. The Sprint 41 offer flow remains unchanged for the public broadcast path.

7. **Enum migration ordering** — `ADD VALUE IF NOT EXISTS 'dibs_pending'` must run before the `requests.dibs` table creation in migration scripts (PostgreSQL enum alterations are transaction-scoped differently).

8. **Scoring cap** — Only show dibs UI if `topCandidate` is non-null. If no provider has a prior interaction with the requester, return `{ data: null }` and skip the post-creation prompt entirely.

9. **Provider `is_available` gate** — Score candidates only where `provider.providers.is_available = true`. Don't surface off-duty providers.
