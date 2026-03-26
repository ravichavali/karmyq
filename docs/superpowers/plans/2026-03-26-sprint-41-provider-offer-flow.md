# Provider Offer Flow (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the full provider offer loop — on-duty push notification → offer submission → requester push notification → accept/decline from CommitmentsTab.

**Architecture:** Two new tables (`auth.device_push_tokens`, `provider.offers`) bridge mobile push delivery and the commercial offer flow. Four new events wire push notifications bidirectionally across provider and requester. Accepted offers create a `requests.matches` record to integrate with existing match tracking.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, React Native + Expo, PostgreSQL 15, Bull queue, Expo Push API.

---

## File Map

### New files to create

| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260326-device-push-tokens.sql` | `auth.device_push_tokens` table |
| `infrastructure/postgres/migrations/20260326-provider-offers.sql` | `provider.offers` table |
| `services/notification-service/src/routes/push.ts` | Internal push send endpoint |
| `services/notification-service/src/lib/expoPush.ts` | Expo Server SDK wrapper |
| `services/auth-service/src/routes/pushTokens.ts` | Push token register/unregister |
| `services/provider-service/src/routes/offers.ts` | Provider offer CRUD |
| `services/provider-service/src/db/offersDb.ts` | Offer DB queries |
| `services/request-service/src/routes/offers.ts` | Requester offer accept/decline |
| `services/request-service/src/db/offersDb.ts` | Offer accept/decline DB queries |
| `apps/mobile/src/hooks/useExpoNotifications.ts` | Push token registration hook |
| `apps/frontend/src/components/ProviderMatchingRequests.tsx` | Open requests feed for on-duty provider |
| `apps/frontend/src/components/SubmitOfferModal.tsx` | Offer price + note submission modal |
| `tests/tdd/sprint-41-provider-offer-flow.test.tsx` | TDD integration tests |

### Existing files to modify

| File | Change |
|------|--------|
| `services/provider-service/src/routes/availability.ts` (or similar) | Publish `provider_went_on_duty` event on toggle-on |
| `services/notification-service/src/index.ts` or event subscriber | Subscribe to 4 new events → push |
| `services/auth-service/src/index.ts` | Mount push token routes |
| `services/provider-service/src/index.ts` | Mount offer routes |
| `services/request-service/src/index.ts` | Mount offer accept/decline routes |
| `apps/mobile/src/app/_layout.tsx` (or App.tsx) | Invoke `useExpoNotifications` after auth |
| `apps/frontend/src/components/CommitmentsTab.tsx` | Add "Offers Received" section |
| `apps/frontend/src/components/dashboard.tsx` (or provider section) | Mount `ProviderMatchingRequests` when on-duty |
| `apps/frontend/src/lib/api/providerApi.ts` | Add offer submission + list calls |
| `apps/frontend/src/lib/api/requestApi.ts` | Add offer accept/decline calls |
| `services/notification-service/package.json` | Add `expo-server-sdk` dependency |
| `apps/mobile/package.json` | Verify `expo-notifications` is present |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Push tokens must be registered after auth** — `useExpoNotifications` must only call the API once `userId` is available. Registering before auth means the token can't be linked to a user.

2. **`provider_went_on_duty` query uses the junction table** — `requests.help_requests` has NO `community_id` column. To find matching open requests: `JOIN requests.request_communities rc ON rc.request_id = hr.id WHERE rc.community_id = ANY($1) AND hr.status = 'open'`.

3. **Rate card lookup for offer pre-fill** — query `provider.rate_cards WHERE provider_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1`. If no rate card, price field is blank (not zero).

4. **`offer_accepted` creates a `requests.matches` record** — map `provider_user_id` → `helper_id`, set `status = 'matched'`. Skip the `proposed` stage.

5. **Expo push API** — install `expo-server-sdk` in notification service. Token format: `ExponentPushToken[xxxx]`. Batch up to 100 per call.

6. **One active offer per provider per request** — check for existing `pending` or `accepted` offer before inserting. Return 409 if duplicate.

7. **Locate the existing availability endpoint** — find in `services/provider-service/src/routes/` before modifying. Do not guess the path.

8. **`communityIds` in event payload** — provider service must include the provider's community IDs in the `provider_went_on_duty` event so notification service can query matching requests without a cross-service DB call.

---

## Task 1: Feature branch + DB migrations

**Files:**
- Create: `infrastructure/postgres/migrations/20260326-device-push-tokens.sql`
- Create: `infrastructure/postgres/migrations/20260326-provider-offers.sql`

- [ ] **Create feature branch**

```bash
git checkout -b feature/sprint-41-provider-offer-flow
```

- [ ] **Create push tokens migration**

```sql
-- 20260326-device-push-tokens.sql
CREATE TABLE IF NOT EXISTS auth.device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  platform VARCHAR(10) CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, expo_push_token)
);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user_id
  ON auth.device_push_tokens(user_id);
```

- [ ] **Create provider offers migration**

```sql
-- 20260326-provider-offers.sql
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

CREATE INDEX IF NOT EXISTS idx_provider_offers_provider_user
  ON provider.offers(provider_user_id);
CREATE INDEX IF NOT EXISTS idx_provider_offers_request
  ON provider.offers(request_id);
CREATE INDEX IF NOT EXISTS idx_provider_offers_status
  ON provider.offers(status);
```

- [ ] **Verify migrations apply cleanly**

```bash
docker exec karmyq-postgres psql -U karmyq_user -d karmyq -f /path/to/20260326-device-push-tokens.sql
docker exec karmyq-postgres psql -U karmyq_user -d karmyq -f /path/to/20260326-provider-offers.sql
```

---

## Task 2: Notification service — Expo push delivery

**Files:**
- Create: `services/notification-service/src/lib/expoPush.ts`
- Create: `services/notification-service/src/routes/push.ts`
- Modify: `services/notification-service/package.json`
- Modify: `services/notification-service/src/index.ts`

- [ ] **Install expo-server-sdk**

```bash
cd services/notification-service && npm install expo-server-sdk
```

- [ ] **Create Expo push wrapper** (`src/lib/expoPush.ts`)

```typescript
import Expo, { ExpoPushMessage } from 'expo-server-sdk';
import { pool } from '../db';

const expo = new Expo();

export async function sendPushToUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (userIds.length === 0) return;

  const result = await pool.query(
    `SELECT expo_push_token FROM auth.device_push_tokens
     WHERE user_id = ANY($1)`,
    [userIds]
  );

  const tokens: string[] = result.rows.map(r => r.expo_push_token);
  if (tokens.length === 0) return;

  const messages: ExpoPushMessage[] = tokens
    .filter(token => Expo.isExpoPushToken(token))
    .map(to => ({ to, title, body, data: data ?? {} }));

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    await expo.sendPushNotificationsAsync(chunk);
  }
}
```

- [ ] **Create internal push route** (`src/routes/push.ts`)

```typescript
import { Router } from 'express';
import { sendPushToUsers } from '../lib/expoPush';

const router = Router();

// Internal use only — no auth middleware (behind nginx, not exposed externally)
router.post('/push/send', async (req, res) => {
  const { user_ids, title, body, data } = req.body;
  if (!user_ids?.length || !title || !body) {
    return res.status(400).json({ success: false, message: 'user_ids, title, body required' });
  }
  await sendPushToUsers(user_ids, title, body, data);
  res.json({ success: true });
});

export default router;
```

- [ ] **Mount push route in index.ts** — `app.use('/notifications', pushRouter)`

- [ ] **Verify** — notification service builds without TypeScript errors

```bash
cd services/notification-service && npx tsc --noEmit
```

---

## Task 3: Auth service — push token endpoints

**Files:**
- Create: `services/auth-service/src/routes/pushTokens.ts`
- Modify: `services/auth-service/src/index.ts`

- [ ] **Create push token routes** (`src/routes/pushTokens.ts`)

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { pool } from '../db';

const router = Router();

router.post('/push-tokens', authenticate, async (req, res) => {
  const { expo_push_token, platform } = req.body;
  const userId = req.user.userId;

  if (!expo_push_token) {
    return res.status(400).json({ success: false, message: 'expo_push_token required' });
  }

  await pool.query(
    `INSERT INTO auth.device_push_tokens (user_id, expo_push_token, platform)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, expo_push_token) DO UPDATE SET updated_at = NOW()`,
    [userId, expo_push_token, platform ?? null]
  );

  res.json({ success: true });
});

router.delete('/push-tokens/:token', authenticate, async (req, res) => {
  const userId = req.user.userId;
  await pool.query(
    `DELETE FROM auth.device_push_tokens
     WHERE user_id = $1 AND expo_push_token = $2`,
    [userId, req.params.token]
  );
  res.json({ success: true });
});

export default router;
```

- [ ] **Mount in auth service index** — `app.use('/auth', pushTokenRouter)`

- [ ] **Verify**

```bash
cd services/auth-service && npx tsc --noEmit
```

---

## Task 4: Provider service — offer endpoints + event on availability toggle

**Files:**
- Create: `services/provider-service/src/db/offersDb.ts`
- Create: `services/provider-service/src/routes/offers.ts`
- Modify: existing availability route (find path first)
- Modify: `services/provider-service/src/index.ts`

- [ ] **Locate existing availability endpoint** — read provider service routes to find the `updateAvailability` endpoint path before modifying

- [ ] **Add `provider_went_on_duty` event to availability toggle** — when `is_available: true` is set, publish to Bull queue:

```typescript
import { getEventQueue } from '../lib/queue';

// Inside the availability update handler, after DB update:
if (is_available === true) {
  const queue = getEventQueue();
  const memberships = req.user.communities ?? [];
  const communityIds = memberships.map((m: { id: string }) => m.id);

  await queue.add('provider_went_on_duty', {
    providerId: provider.id,       // provider profile UUID
    providerUserId: req.user.userId,
    communityIds,
  });
}
```

- [ ] **Create offers DB module** (`src/db/offersDb.ts`)

```typescript
import { pool } from '../db';

export async function getDefaultPrice(providerId: string): Promise<number | null> {
  const result = await pool.query(
    `SELECT price_per_hour FROM provider.rate_cards
     WHERE provider_id = $1 AND is_active = true
     ORDER BY created_at DESC LIMIT 1`,
    [providerId]
  );
  return result.rows[0]?.price_per_hour ?? null;
}

export async function createOffer(
  providerUserId: string,
  providerId: string,
  requestId: string,
  price: number | null,
  note: string | null
) {
  // Check for duplicate active offer
  const existing = await pool.query(
    `SELECT id FROM provider.offers
     WHERE provider_user_id = $1 AND request_id = $2
       AND status IN ('pending', 'accepted')`,
    [providerUserId, requestId]
  );
  if (existing.rows.length > 0) {
    throw Object.assign(new Error('Offer already exists for this request'), { code: 'DUPLICATE_OFFER' });
  }

  const result = await pool.query(
    `INSERT INTO provider.offers (provider_id, provider_user_id, request_id, price, note)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [providerId, providerUserId, requestId, price, note]
  );
  return result.rows[0];
}

export async function getMyOffers(providerUserId: string) {
  const result = await pool.query(
    `SELECT o.*, hr.title as request_title, hr.type as request_type
     FROM provider.offers o
     JOIN requests.help_requests hr ON hr.id = o.request_id
     WHERE o.provider_user_id = $1
     ORDER BY o.created_at DESC`,
    [providerUserId]
  );
  return result.rows;
}

export async function withdrawOffer(offerId: string, providerUserId: string) {
  const result = await pool.query(
    `UPDATE provider.offers SET status = 'withdrawn', updated_at = NOW()
     WHERE id = $1 AND provider_user_id = $2 AND status = 'pending'
     RETURNING *`,
    [offerId, providerUserId]
  );
  return result.rows[0] ?? null;
}
```

- [ ] **Create offer routes** (`src/routes/offers.ts`)

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { createOffer, getMyOffers, withdrawOffer, getDefaultPrice } from '../db/offersDb';
import { getEventQueue } from '../lib/queue';

const router = Router();

router.post('/offers', authenticate, async (req, res) => {
  const { request_id, price, note } = req.body;
  const userId = req.user.userId;

  // Get provider profile id
  const providerResult = await pool.query(
    `SELECT id FROM provider.provider_profiles WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  if (!providerResult.rows.length) {
    return res.status(403).json({ success: false, message: 'No provider profile' });
  }
  const providerId = providerResult.rows[0].id;

  try {
    const offer = await createOffer(userId, providerId, request_id, price ?? null, note ?? null);

    // Get requester user_id for the notification event
    const reqResult = await pool.query(
      `SELECT user_id, title FROM requests.help_requests WHERE id = $1`,
      [request_id]
    );
    if (reqResult.rows.length > 0) {
      const queue = getEventQueue();
      await queue.add('offer_submitted', {
        offerId: offer.id,
        requestId: request_id,
        requesterUserId: reqResult.rows[0].user_id,
        providerName: req.user.email, // notification service can format this
        price: offer.price,
      });
    }

    res.json({ success: true, data: offer });
  } catch (err: any) {
    if (err.code === 'DUPLICATE_OFFER') {
      return res.status(409).json({ success: false, message: 'You already have an active offer for this request' });
    }
    throw err;
  }
});

router.get('/offers', authenticate, async (req, res) => {
  const offers = await getMyOffers(req.user.userId);
  res.json({ success: true, data: offers });
});

router.put('/offers/:id/withdraw', authenticate, async (req, res) => {
  const offer = await withdrawOffer(req.params.id, req.user.userId);
  if (!offer) {
    return res.status(404).json({ success: false, message: 'Offer not found or already resolved' });
  }
  res.json({ success: true, data: offer });
});

export default router;
```

- [ ] **Mount offer routes in provider service index** — `app.use('/providers', offersRouter)`

- [ ] **Verify**

```bash
cd services/provider-service && npx tsc --noEmit
```

---

## Task 5: Request service — offer accept/decline (requester side)

**Files:**
- Create: `services/request-service/src/db/offersDb.ts`
- Create: `services/request-service/src/routes/offers.ts`
- Modify: `services/request-service/src/index.ts`

- [ ] **Create offers DB module** (`src/db/offersDb.ts`)

```typescript
import { pool } from '../db';

export async function getOffersForRequest(requestId: string, requesterUserId: string) {
  // Verify requester owns the request
  const check = await pool.query(
    `SELECT id FROM requests.help_requests WHERE id = $1 AND user_id = $2`,
    [requestId, requesterUserId]
  );
  if (!check.rows.length) return null; // not owner

  const result = await pool.query(
    `SELECT o.*, u.email as provider_email
     FROM provider.offers o
     JOIN auth.users u ON u.id = o.provider_user_id
     WHERE o.request_id = $1 AND o.status IN ('pending', 'accepted', 'declined')
     ORDER BY o.created_at DESC`,
    [requestId]
  );
  return result.rows;
}

export async function acceptOffer(offerId: string, requesterUserId: string) {
  // Verify ownership through request
  const offerResult = await pool.query(
    `SELECT o.*, hr.user_id as requester_user_id
     FROM provider.offers o
     JOIN requests.help_requests hr ON hr.id = o.request_id
     WHERE o.id = $1 AND o.status = 'pending'`,
    [offerId]
  );
  const offer = offerResult.rows[0];
  if (!offer || offer.requester_user_id !== requesterUserId) return null;

  await pool.query(
    `UPDATE provider.offers SET status = 'accepted', updated_at = NOW() WHERE id = $1`,
    [offerId]
  );

  // Create requests.matches record to bridge into existing match tracking
  await pool.query(
    `INSERT INTO requests.matches (request_id, helper_id, status)
     VALUES ($1, $2, 'matched')
     ON CONFLICT DO NOTHING`,
    [offer.request_id, offer.provider_user_id]
  );

  return offer;
}

export async function declineOffer(offerId: string, requesterUserId: string) {
  const offerResult = await pool.query(
    `SELECT o.*, hr.user_id as requester_user_id
     FROM provider.offers o
     JOIN requests.help_requests hr ON hr.id = o.request_id
     WHERE o.id = $1 AND o.status = 'pending'`,
    [offerId]
  );
  const offer = offerResult.rows[0];
  if (!offer || offer.requester_user_id !== requesterUserId) return null;

  await pool.query(
    `UPDATE provider.offers SET status = 'declined', updated_at = NOW() WHERE id = $1`,
    [offerId]
  );
  return offer;
}
```

- [ ] **Create offer routes** (`src/routes/offers.ts`)

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getOffersForRequest, acceptOffer, declineOffer } from '../db/offersDb';
import { getEventQueue } from '../lib/queue';

const router = Router();

router.get('/:id/offers', authenticate, async (req, res) => {
  const offers = await getOffersForRequest(req.params.id, req.user.userId);
  if (offers === null) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }
  res.json({ success: true, data: offers });
});

router.put('/offers/:id/accept', authenticate, async (req, res) => {
  const offer = await acceptOffer(req.params.id, req.user.userId);
  if (!offer) {
    return res.status(404).json({ success: false, message: 'Offer not found or not pending' });
  }

  const queue = getEventQueue();
  await queue.add('offer_accepted', {
    offerId: offer.id,
    providerUserId: offer.provider_user_id,
    requesterName: req.user.email,
  });

  res.json({ success: true, data: offer });
});

router.put('/offers/:id/decline', authenticate, async (req, res) => {
  const offer = await declineOffer(req.params.id, req.user.userId);
  if (!offer) {
    return res.status(404).json({ success: false, message: 'Offer not found or not pending' });
  }

  const queue = getEventQueue();
  await queue.add('offer_declined', {
    offerId: offer.id,
    providerUserId: offer.provider_user_id,
  });

  res.json({ success: true, data: offer });
});

export default router;
```

- [ ] **Mount in request service index** — `app.use('/requests', offerRouter)` (note: `/:id/offers` and `/offers/:id/accept|decline` both live here)

- [ ] **Verify**

```bash
cd services/request-service && npx tsc --noEmit
```

---

## Task 6: Notification service — event subscribers for push

**Files:**
- Modify: `services/notification-service/src/index.ts` (or wherever event subscriptions live)

- [ ] **Locate existing event subscriber pattern** in notification service before adding new subscriptions

- [ ] **Subscribe to `provider_went_on_duty`** — query open requests in provider's communities → push notify provider

```typescript
queue.process('provider_went_on_duty', async (job) => {
  const { providerUserId, communityIds } = job.data;
  if (!communityIds?.length) return;

  // Find open requests in provider's communities
  const result = await pool.query(
    `SELECT DISTINCT hr.id, hr.title
     FROM requests.help_requests hr
     JOIN requests.request_communities rc ON rc.request_id = hr.id
     WHERE rc.community_id = ANY($1) AND hr.status = 'open'
     LIMIT 10`,
    [communityIds]
  );

  const count = result.rows.length;
  if (count === 0) return;

  await sendPushToUsers(
    [providerUserId],
    'Requests waiting in your community',
    `${count} open request${count > 1 ? 's' : ''} match your services. Tap to view.`,
    { type: 'provider_on_duty', count }
  );
});
```

- [ ] **Subscribe to `offer_submitted`** — push notify requester

```typescript
queue.process('offer_submitted', async (job) => {
  const { requesterUserId, providerName, price } = job.data;
  const priceText = price ? ` for $${price}` : '';
  await sendPushToUsers(
    [requesterUserId],
    'Someone offered to help',
    `You received an offer${priceText}. Tap to review.`,
    { type: 'offer_received' }
  );
});
```

- [ ] **Subscribe to `offer_accepted`**

```typescript
queue.process('offer_accepted', async (job) => {
  const { providerUserId, requesterName } = job.data;
  await sendPushToUsers(
    [providerUserId],
    'Offer accepted!',
    `Your offer was accepted. Check your commitments.`,
    { type: 'offer_accepted' }
  );
});
```

- [ ] **Subscribe to `offer_declined`**

```typescript
queue.process('offer_declined', async (job) => {
  const { providerUserId } = job.data;
  await sendPushToUsers(
    [providerUserId],
    'Offer declined',
    'Your offer was not accepted this time.',
    { type: 'offer_declined' }
  );
});
```

- [ ] **Verify notification service builds**

```bash
cd services/notification-service && npx tsc --noEmit
```

---

## Task 7: Mobile — Expo push token registration

**Files:**
- Create: `apps/mobile/src/hooks/useExpoNotifications.ts`
- Modify: `apps/mobile/src/app/_layout.tsx` (or App.tsx — find the root layout)

- [ ] **Verify `expo-notifications` is installed**

```bash
cd apps/mobile && cat package.json | grep expo-notifications
# If missing: npx expo install expo-notifications
```

- [ ] **Create `useExpoNotifications` hook**

```typescript
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useAuth } from './useAuth'; // adjust import to actual auth hook
import { api } from '../lib/api'; // adjust to actual API client

export function useExpoNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.userId) return; // wait for auth

    async function registerToken() {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;

      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') return;

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';

      await api.post('/auth/push-tokens', { expo_push_token: token, platform });
    }

    registerToken().catch(console.error);

    // Foreground notification handler
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      // TODO Sprint 42: navigate based on notification.request.content.data.type
    });

    return () => subscription.remove();
  }, [user?.userId]);
}
```

- [ ] **Invoke hook in root layout** — after auth is resolved, call `useExpoNotifications()` in the root component

- [ ] **Verify mobile builds** (TypeScript check)

```bash
cd apps/mobile && npx tsc --noEmit
```

---

## Task 8: Web — ProviderMatchingRequests + SubmitOfferModal

**Files:**
- Create: `apps/frontend/src/components/ProviderMatchingRequests.tsx`
- Create: `apps/frontend/src/components/SubmitOfferModal.tsx`
- Modify: `apps/frontend/src/lib/api/providerApi.ts`
- Modify: provider dashboard component (find the location that mounts `ProviderDashboardCard`)

- [ ] **Add offer API calls to `providerApi.ts`**

```typescript
export async function getMyOffers() {
  const response = await api.get('/providers/offers');
  return response.data.data;
}

export async function submitOffer(requestId: string, price: number | null, note: string) {
  const response = await api.post('/providers/offers', { request_id: requestId, price, note });
  return response.data.data;
}

export async function withdrawOffer(offerId: string) {
  const response = await api.put(`/providers/offers/${offerId}/withdraw`);
  return response.data.data;
}

export async function getMatchingRequests() {
  // Fetch open requests visible to the current user's communities
  // Reuses the existing curated or requests endpoint
  const response = await api.get('/requests?status=open&limit=20');
  return response.data.data;
}
```

- [ ] **Create `SubmitOfferModal`** — price input (number, pre-filled from rate card prop), optional note textarea, Cancel + Submit buttons

```typescript
interface SubmitOfferModalProps {
  requestId: string;
  requestTitle: string;
  defaultPrice: number | null;
  onClose: () => void;
  onSubmitted: () => void;
}
```

- [ ] **Create `ProviderMatchingRequests`** — fetches open requests, renders a list with title, type badge, and "Make Offer" button per item; "Make Offer" opens `SubmitOfferModal`

- [ ] **Mount `ProviderMatchingRequests` in provider dashboard** — render it below `ProviderDashboardCard` when `providerMode === 'provider'` and `isAvailable === true`

- [ ] **Verify web builds**

```bash
cd apps/frontend && npx tsc --noEmit
```

---

## Task 9: Web — CommitmentsTab offers section (requester)

**Files:**
- Modify: `apps/frontend/src/components/CommitmentsTab.tsx`
- Modify: `apps/frontend/src/lib/api/requestApi.ts`

- [ ] **Add offer API calls to `requestApi.ts`**

```typescript
export async function getOffersForRequest(requestId: string) {
  const response = await api.get(`/requests/${requestId}/offers`);
  return response.data.data;
}

export async function acceptOffer(offerId: string) {
  const response = await api.put(`/requests/offers/${offerId}/accept`);
  return response.data.data;
}

export async function declineOffer(offerId: string) {
  const response = await api.put(`/requests/offers/${offerId}/decline`);
  return response.data.data;
}
```

- [ ] **Add "Offers Received" section to CommitmentsTab** — for each active request the user has posted, fetch its offers; render pending offers with:
  - Provider name (email for now), price, note
  - "Accept" button → calls `acceptOffer`, re-fetches
  - "Decline" button → calls `declineOffer`, re-fetches
  - Show "No offers yet" if empty
  - Only show section when user has active requests with offers

- [ ] **Verify web builds**

```bash
cd apps/frontend && npx tsc --noEmit
```

---

## Task 10: User guides + landing page docs

**Files:**
- Modify: `apps/landing/src/data/docs/guides/provider-mode.json`
- Modify: `apps/landing/src/data/docs/guides/using-service-providers.json`

> **Reminder**: Never edit `nav.json` directly — run `cd apps/landing && npm run generate-docs` after updating source. These are updates to existing guides, not new pages, so GUIDE_ORDER doesn't change.

- [ ] **Update `provider-mode.json` content** — add three new sections at the end of the existing content:
  - **Going On Duty** — explain the toggle, the push notification that arrives listing matching requests, navigating to the provider dashboard to see them
  - **Submitting an Offer** — walk through the matching requests list, clicking "Make Offer", the pre-filled price from rate card, editing for variable-scope work, adding a note, submitting
  - **Tracking Your Offers** — explain the "My Offers" view, offer statuses (pending / accepted / declined / withdrawn), withdrawing a pending offer

- [ ] **Update `using-service-providers.json` content** — add two new sections:
  - **Receiving Provider Offers** — explain that providers can send offers directly to your open requests, and where to find them (CommitmentsTab → Offers Received)
  - **Accepting or Declining an Offer** — walk through the accept/decline flow, what happens after accepting (a match is created, shown in Commitments)

- [ ] **Regenerate landing docs**

```bash
cd apps/landing && npm run generate-docs
git add -f apps/landing/src/data/docs/
```

---

## Task 11: CONTEXT.md + registry.json + TDD tests

**Files:**
- Modify: `services/auth-service/CONTEXT.md`
- Modify: `services/provider-service/CONTEXT.md`
- Modify: `services/request-service/CONTEXT.md`
- Modify: `services/notification-service/CONTEXT.md`
- Modify: `services/registry.json`
- Create: `tests/tdd/sprint-41-provider-offer-flow.test.tsx`

- [ ] **Update auth-service CONTEXT.md** — add `POST /auth/push-tokens`, `DELETE /auth/push-tokens/:token`; add `auth.device_push_tokens` to schema section

- [ ] **Update provider-service CONTEXT.md** — add `POST /providers/offers`, `GET /providers/offers`, `PUT /providers/offers/:id/withdraw`; add `provider.offers` to schema section; add `provider_went_on_duty` event

- [ ] **Update request-service CONTEXT.md** — add `GET /requests/:id/offers`, `PUT /requests/offers/:id/accept`, `PUT /requests/offers/:id/decline`; add `offer_accepted`, `offer_declined` events

- [ ] **Update notification-service CONTEXT.md** — add `POST /notifications/push/send`; document Expo push integration; add 4 new event subscriptions

- [ ] **Update registry.json** — add new endpoints and events to all four services' entries

- [ ] **Run feedback check**

```bash
npm run feedback:check
```

- [ ] **Write TDD tests** (`tests/tdd/sprint-41-provider-offer-flow.test.tsx`)

Cover at minimum:
- `ProviderMatchingRequests` renders open requests when provider is on-duty
- `ProviderMatchingRequests` shows "Make Offer" button per request
- `SubmitOfferModal` renders with pre-filled price from `defaultPrice` prop
- `SubmitOfferModal` allows price to be edited
- `SubmitOfferModal` calls `submitOffer` on submit with correct args
- CommitmentsTab "Offers Received" section renders when offers exist
- CommitmentsTab Accept button calls `acceptOffer` with correct offerId
- CommitmentsTab Decline button calls `declineOffer` with correct offerId

```bash
npm run test:tdd
```

---

## Task 12: Final type check + pre-push verification

- [ ] **TypeScript check across all modified services**

```bash
cd services/auth-service && npx tsc --noEmit
cd services/provider-service && npx tsc --noEmit
cd services/request-service && npx tsc --noEmit
cd services/notification-service && npx tsc --noEmit
cd apps/frontend && npx tsc --noEmit
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Run unit + regression tests**

```bash
cd c:/Users/ravic/development/karmyq && npm test
```

- [ ] **Run TDD tests**

```bash
npm run test:tdd
```

- [ ] **Run feedback check**

```bash
npm run feedback:check
```

- [ ] **Fix any failures before proceeding to Task 13**

---

## Task 13: Merge + Deploy

- [ ] **Merge to master and push**

```bash
git checkout master
git merge feature/sprint-41-provider-offer-flow
git push origin master
```

- [ ] **Monitor GitHub Actions** — check Actions tab; confirm all steps pass (lint → tests → build → deploy → health)

- [ ] **Run DB migrations on demo server**

```bash
# From local machine
scp infrastructure/postgres/migrations/20260326-device-push-tokens.sql ubuntu@karmyq.com:~/
scp infrastructure/postgres/migrations/20260326-provider-offers.sql ubuntu@karmyq.com:~/

# On server (via SSH or docker exec after deploy)
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -f /home/ubuntu/20260326-device-push-tokens.sql
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -f /home/ubuntu/20260326-provider-offers.sql
```

- [ ] **Verify health**

```bash
npm run health:check
```

- [ ] **Bump version to v9.16.0** in root `package.json` and any service `package.json` files that track version

- [ ] **Update handoff** — mark Sprint 41 complete, document Sprint 42 scope
