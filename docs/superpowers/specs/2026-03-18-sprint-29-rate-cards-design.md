# Sprint 29: Rate Cards / Pricing Transparency

**Date**: 2026-03-18
**Status**: Approved
**Sprint**: 29 of Provider/Service Economy Arc (Sprints 27–29)
**Depends on**: Sprint 28 deployed (commit `caa3894`) ✅

---

## Context

Providers have no way to publish what they charge. Requestors have no way to see pricing before filing a request or contacting a provider. This creates friction at the moment of engagement — especially for paid services where expectations need to be set upfront.

Sprint 29 closes this gap by introducing rate cards: structured price entries attached to provider profiles, visible everywhere providers appear in the UI. It also introduces provider pre-selection: when filing a typed request, a requestor can optionally pre-select a provider they found through rate cards, triggering an active in-app notification so the provider can accept and get matched.

---

## Architecture

All rate card data lives in `request-service` alongside `provider_profiles`. No new service. Pre-select uses the existing Bull event bus — a new `preferred_provider_selected` event fires to notification-service, which creates an in-app notification with a deep-link (`/requests/:request_id`) to the specific request. The provider accepts via the existing "propose to help" flow, creating a `proposed` match row.

---

## Schema Changes

### New table: `requests.provider_rate_cards`

```sql
CREATE TABLE requests.provider_rate_cards (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id    UUID NOT NULL REFERENCES requests.provider_profiles(id) ON DELETE CASCADE,
  label          VARCHAR(100) NOT NULL,
  service_type   TEXT,                             -- optional sub-category; use TEXT to match provider_profiles
  pricing_model  TEXT NOT NULL DEFAULT 'standard', -- 'standard' | 'free' | 'negotiable'
  rate_amount    NUMERIC(10,2),                    -- NULL when pricing_model != 'standard'
  rate_unit      TEXT,                             -- 'per_hour','per_session','per_trip','flat_rate' — NULL when pricing_model != 'standard'
  currency       CHAR(3) NOT NULL DEFAULT 'USD',
  notes          TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_pricing_model CHECK (pricing_model IN ('standard', 'free', 'negotiable')),
  CONSTRAINT chk_standard_rate CHECK (
    pricing_model != 'standard' OR (rate_amount IS NOT NULL AND rate_unit IS NOT NULL)
  ),
  CONSTRAINT chk_nonstandard_rate CHECK (
    pricing_model = 'standard' OR (rate_amount IS NULL AND rate_unit IS NULL)
  ),
  CONSTRAINT chk_rate_unit CHECK (
    rate_unit IS NULL OR rate_unit IN ('per_hour', 'per_session', 'per_trip', 'flat_rate')
  ),
  CONSTRAINT chk_rate_amount CHECK (rate_amount IS NULL OR rate_amount >= 0)
);

CREATE INDEX ON requests.provider_rate_cards(provider_id);
CREATE INDEX ON requests.provider_rate_cards(service_type);
```

**Notes:**
- `pricing_model` separates pricing semantics from rate units. `standard` means a numeric rate applies; `free` and `negotiable` set `rate_amount` and `rate_unit` to NULL.
- `service_type` is optional. When provided it must match a valid provider service type (`ride`, `tradesperson`, `tutor`, `other`). Validated in the API layer (not DB FK, as service_type is a soft enum).
- `TIMESTAMP` (not `TIMESTAMPTZ`) matches the existing convention in `provider_profiles` and `provider_reviews`.
- `is_active` supports soft-delete. The DELETE endpoint sets `is_active = FALSE` rather than hard-deleting rows (preserves history). Hard delete is not used.

### Modify: `requests.help_requests`

```sql
ALTER TABLE requests.help_requests
  ADD COLUMN preferred_provider_id UUID
    REFERENCES requests.provider_profiles(id)
    ON DELETE SET NULL;
```

### Migration file

`infrastructure/postgres/migrations/` — use the **next available sequential number** (check directory: last known is `022-provider-profiles.sql`; actual next may be higher, confirm before naming).

Both changes also added to `infrastructure/postgres/init.sql`.

---

## API Changes (request-service, `src/routes/providers.ts`)

### Rate card CRUD

All new routes registered **before** `/:providerId` in the Express router to avoid route ordering conflicts.

| Method | Route | Auth | Notes |
|--------|-------|------|-------|
| GET | `/requests/providers/:providerId/rate-cards` | Public | Returns only `is_active = TRUE` cards |
| POST | `/requests/providers/:providerId/rate-cards` | Required, owner only | Creates rate card |
| PUT | `/requests/providers/:providerId/rate-cards/:cardId` | Required, owner only | Updates rate card |
| DELETE | `/requests/providers/:providerId/rate-cards/:cardId` | Required, owner only | Soft-delete: sets `is_active = FALSE` |

**Owner check**: verify `provider_profiles.user_id = req.user.userId`. Return 403 if not.

**Input validation for POST/PUT** (return 400 if invalid):
- `label`: required, string, max 100 chars
- `pricing_model`: required, one of `'standard' | 'free' | 'negotiable'`
- If `pricing_model === 'standard'`: `rate_amount` required (non-negative number), `rate_unit` required (one of `per_hour | per_session | per_trip | flat_rate`)
- If `pricing_model !== 'standard'`: `rate_amount` and `rate_unit` must be absent or null
- `service_type`: optional; if provided, must be one of `ride | tradesperson | tutor | other`
- `currency`: optional, default `'USD'`, must be exactly 3 chars if provided
- `notes`: optional, string

**Rate card response shape:**
```json
{
  "id": "uuid",
  "provider_id": "uuid",
  "label": "Tutoring — Math",
  "service_type": "tutor",
  "pricing_model": "standard",
  "rate_amount": 30.00,
  "rate_unit": "per_hour",
  "currency": "USD",
  "notes": "First session free",
  "is_active": true,
  "created_at": "...",
  "updated_at": "..."
}
```

### Existing provider detail (modified)

`GET /requests/providers/:providerId` — append `rate_cards: RateCard[]` to response.
- Public response: filter `WHERE is_active = TRUE`
- Owner editing their profile: all cards including inactive (add `?include_inactive=true` for owner-only path, or return all in the `/my` endpoint variant)

### Request filing endpoint (modified, `src/routes/requests.ts`)

`POST /requests` — accepts optional `preferred_provider_id: string` in body.

**If `preferred_provider_id` is provided:**

1. Validate: `SELECT id, user_id, service_type, is_active FROM requests.provider_profiles WHERE id = $preferred_provider_id`
   - Not found → 400 `{ error: 'PROVIDER_NOT_FOUND' }`
   - `is_active = FALSE` → 400 `{ error: 'PROVIDER_INACTIVE' }`
   - `service_type` does not match `request_type` (typed requests) → 400 `{ error: 'PROVIDER_TYPE_MISMATCH' }`
   - Store resolved `provider_user_id = provider.user_id` in local scope for event payload

2. Look up requester name: `SELECT name FROM auth.users WHERE id = $requester_id`
   - Store as `requester_name`; use `'A user'` as fallback if lookup fails (non-blocking)

3. Store `preferred_provider_id` on the inserted `help_requests` row

4. After successful insert, publish Bull event:
   ```json
   {
     "type": "preferred_provider_selected",
     "request_id": "uuid",
     "requester_id": "uuid",
     "requester_name": "string",
     "provider_id": "uuid",
     "provider_user_id": "uuid",
     "request_title": "string",
     "request_type": "string"
   }
   ```

---

## Notification Changes (notification-service)

### Three required code changes

1. **`src/templates/notificationTemplates.ts`**: Add `'preferred_provider_selected'` to the `NotificationType` union AND add template entry:
   ```typescript
   preferred_provider_selected: {
     title: 'You were pre-selected',
     body: '{{requester_name}} pre-selected you for a {{request_type}} request: "{{request_title}}".',
     actionUrl: (data: any) => `/requests/${data.request_id}`,
     channels: { in_app: true, push: false, email: false }
   }
   ```

2. **`src/events/subscriber.ts`**: Add handler for `preferred_provider_selected`:
   - If `provider_user_id` is missing or null → log warning and skip (do not throw)
   - Call `createNotification(provider_user_id, 'preferred_provider_selected', eventData)`

3. **`src/services/notificationService.ts`**: Confirm `createNotification` passes `data` (including `request_id`) through to the template so `actionUrl` can resolve it.

### Accept flow

Provider receives notification → taps action URL → navigates to `/requests/:request_id` → uses existing "propose to help" button → `proposed` match created. No new match-creation code needed.

---

## Frontend Changes

### 1. Profile page — Provider tab (`apps/frontend/src/app/profile/page.tsx`)

Add "Rate Cards" section within each service profile card in `ProviderProfileTab`.

- Fetch rate cards via `GET /requests/providers/:providerId/rate-cards` on tab mount (all cards including inactive for owner)
- List: each card shows label, pricing, notes; inactive cards shown with a visual indicator
- "Add rate card" button → modal/drawer form with fields: label, service_type (select), pricing_model (radio: Standard / Free / Negotiable), rate_amount (number, shown when Standard), rate_unit (select, shown when Standard), notes
- Edit (pencil) and Deactivate/Delete (trash = soft-delete) per card

### 2. Provider detail page (`apps/frontend/src/app/providers/[id]/page.tsx`)

Add read-only "Rate Cards" section after existing service details.

- Fetch from `GET /requests/providers/:providerId` — `rate_cards` is already in the response
- Display: formatted rate — e.g., `$30 / hr — Tutoring (Math) · First session free`; `Free — Rides (General)`
- Visible to unauthenticated users
- Empty state: no section rendered if `rate_cards.length === 0`

### 3. Collective detail page

Add "Member Pricing" section.

- For each collective member: fetch their provider profile and rate cards via `GET /requests/providers/:providerId` (which now includes rate_cards)
- Group by provider display_name, list rate cards under each
- Read-only
- Empty state: "No pricing published yet" if no members have active rate cards

### 4. Request filing form

Add optional "Pre-select a provider" step.

- Appears only when `request_type !== 'generic'`
- Fetch: `GET /requests/providers?service_type=<request_type>` (existing endpoint, no change)
- Filter to providers with at least one active rate card
- Display as scrollable list: provider name, trust score badge, matching rate cards
- "Pre-select" button → sets `preferred_provider_id` in form state, shown as a chip
- Chip has × to clear selection
- If no provider selected: request files with `preferred_provider_id = undefined` (unchanged behavior)

---

## Testing

### TDD tests (new, `tests/tdd/`)

**`rateCards.test.ts`**:
- Create rate card as owner → 201
- Create rate card as non-owner → 403
- Create rate card with `pricing_model = 'standard'` but missing `rate_amount` → 400
- Create rate card with `pricing_model = 'free'` and `rate_amount` set → 400
- Create rate card with invalid `service_type` → 400
- List rate cards for provider (public) → 200, array, only active cards
- Update rate card as owner → 200
- Soft-delete (DELETE) as owner → 200, card set inactive
- `GET /providers/:id` response includes `rate_cards: []` even when provider has no cards

**`preSelectProvider.test.ts`**:
- `POST /requests` with valid `preferred_provider_id` → stores on row, publishes `preferred_provider_selected` event
- `POST /requests` with non-existent `preferred_provider_id` → 400 `PROVIDER_NOT_FOUND`
- `POST /requests` with inactive provider → 400 `PROVIDER_INACTIVE`
- `POST /requests` with mismatched service_type/request_type → 400 `PROVIDER_TYPE_MISMATCH`
- `POST /requests` without `preferred_provider_id` → unchanged behavior (no event)

**`preferredProviderNotification.test.ts`**:
- Subscriber handles `preferred_provider_selected` event → calls `createNotification` with correct user_id and data
- Subscriber with null `provider_user_id` → logs warning, does NOT throw
- Template renders with correct values including `actionUrl` → `/requests/:request_id`

### Unit test updates

- `GET /providers/:id` existing test: assert `rate_cards` key present in response (array, not undefined)

---

## Documentation Updates (mandatory per CLAUDE.md)

- [ ] `services/request-service/CONTEXT.md` — add 4 new rate card endpoints + modified `POST /requests`
- [ ] `services/notification-service/CONTEXT.md` — add `preferred_provider_selected` event type
- [ ] `services/registry.json` — add `preferred_provider_selected` to request-service events
- [ ] `apps/landing/src/data/docs/services/request-service.json` — add new endpoints
- [ ] `apps/landing/src/data/docs/concepts/` — add rate cards concept page (`rate-cards.json`)
- [ ] `apps/landing/src/data/docs/nav.json` — add rate cards concept entry
- [ ] `npm run feedback:check` passes

---

## Stop Criteria

- [ ] Providers can create, edit, and soft-delete rate cards from `/profile` → Provider tab
- [ ] Rate cards visible on `/providers/[id]` (unauthenticated access works)
- [ ] Collective page shows "Member Pricing" section with member provider rate cards
- [ ] Requestors can browse rate cards and pre-select a provider when filing a typed request
- [ ] Pre-selected provider receives in-app notification with deep-link to `/requests/:id`
- [ ] Provider accepts via "propose to help" → `proposed` match created
- [ ] All TDD tests pass: `npm run test:tdd`
- [ ] No regressions: `npm test`
- [ ] `npm run feedback:check` passes

---

## Key Files

| File | Change |
|------|--------|
| `infrastructure/postgres/migrations/0NN-rate-cards.sql` | New migration (next sequential number) |
| `infrastructure/postgres/init.sql` | Add new table + column |
| `services/request-service/src/routes/providers.ts` | Rate card CRUD routes; modify GET single provider |
| `services/request-service/src/routes/requests.ts` | Accept `preferred_provider_id`, publish event |
| `services/notification-service/src/templates/notificationTemplates.ts` | New `NotificationType` + template |
| `services/notification-service/src/events/subscriber.ts` | Handle `preferred_provider_selected` |
| `apps/frontend/src/app/profile/page.tsx` | Rate card section in Provider tab |
| `apps/frontend/src/app/providers/[id]/page.tsx` | Rate cards display section |
| `apps/frontend/src/app/` (collective detail) | Member pricing section |
| `apps/frontend/src/app/` (request form) | Pre-select provider step |
| `services/request-service/CONTEXT.md` | New endpoints + schema |
| `services/notification-service/CONTEXT.md` | New event type |
| `services/registry.json` | New event `preferred_provider_selected` |
| `apps/landing/src/data/docs/services/request-service.json` | New endpoints |
| `apps/landing/src/data/docs/concepts/rate-cards.json` | New concept page |
| `apps/landing/src/data/docs/nav.json` | Nav entry for rate cards concept |

---

## Deferred

- Sorting/filtering providers by rate amount
- Email/push notifications for pre-select (in-app only for now)
- TTL/expiry for pre-selections that are never accepted
- N+1 optimization on collective member rate card fetching
- Public `/users/[id]` profile pages
