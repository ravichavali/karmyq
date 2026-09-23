# Notification Service Context

> **Quick Start**: `cd services/notification-service && npm run dev`
> **Port**: 3005 | **Health**: http://localhost:3005/health

## Purpose

Manages user notifications across the platform with template-based messaging, user preferences, and real-time delivery via Server-Sent Events (SSE). Listens to events from other services and creates appropriate notifications for users.

## Database Schema

### Tables Owned by This Service

```sql
-- notifications.notifications
CREATE TABLE notifications.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,               -- 'match_created', 'match_completed', etc.
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',                 -- Additional notification data
  read BOOLEAN DEFAULT FALSE,
  action_url VARCHAR(500),                 -- Deep link or URL to open
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP
);

-- notifications.preferences (event-specific)
CREATE TABLE notifications.preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id UUID REFERENCES communities.communities(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,        -- Which event this preference applies to
  in_app_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  email_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, event_type, community_id)
);

-- notifications.global_preferences
CREATE TABLE notifications.global_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  email_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications.notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications.notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications.notifications(created_at DESC);
```

### Tables Read by This Service
- `auth.users` - User names for notification messages
- `auth.device_push_tokens` - Expo push tokens, read by `src/lib/expoPush.ts` (auth-service writes them)
- `requests.help_requests` - Request details for notifications
- `communities.communities` - Community names for notifications

## Notification Types

The service uses template-based notifications for consistency:

| Type | Description | Recipients |
|------|-------------|-----------|
| `match_created` | Someone offered to help with your request | Requester |
| `match_completed` | Help exchange was completed | Both requester and helper |
| `karma_awarded` | You earned karma points | User who earned karma |
| `new_request` | New help request in your community | Community members |
| `request_cancelled` | A request you matched with was cancelled | Matched helper |
| `community_activity` | Activity in your community | Community members |
| `norm_proposed` | New norm proposed in your community | Community members |
| `norm_established` | Norm was approved by majority | Community members |
| `join_request` | Someone wants to join your community | Community admins |
| `member_joined` | New member joined the community | Community admins |
| `badge_earned` | You earned a new badge | User who earned badge |
| `welcome` | Welcome to KarmyQ | New users |
| `preferred_provider_selected` | A requestor pre-selected you as their provider | Selected provider |
| `provider_request_matched` | New request matching your service type was posted | Matching providers |
| `provider_review_received` | A client left a review on your provider profile | Provider |
| `match_reminder` | Upcoming commitment departure reminder | Responder |

**Templates:** `src/templates/notificationTemplates.ts`

## API Endpoints

### GET /notifications/stream
Authenticated Server-Sent Events (SSE) endpoint for real-time notifications.

**Usage:**
```javascript
const token = localStorage.getItem('token');
const eventSource = new EventSource(
  `http://localhost:3005/notifications/stream?access_token=${encodeURIComponent(token)}`
);

eventSource.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  console.log('New notification:', notification);
};
```

**Response (SSE stream):**
```
data: {"type":"connected"}

data: {"id":"uuid","type":"match_created","title":"Someone wants to help!","body":"Bob Johnson offered to help with your request","read":false,"created_at":"2025-01-10T12:00:00Z"}
```

**Implementation:** `src/routes/notifications.ts:16`

**Features:**
- Keep-alive heartbeat every 30 seconds
- Automatic cleanup on client disconnect
- User identity is derived from JWT (not URL path)
- Real-time push as soon as notification is created

**Security — JWT-in-URL log scrub (ADR-064, Sprint 83):** Browser `EventSource`
cannot set headers, so the JWT rides in the URL as `access_token`. To keep it out
of nginx access logs, the `/api/notifications` location logs through a custom
`log_format` whose request line is rewritten by an http-scope `map` that masks the
`access_token` value to `***` ([nginx.conf](../../infrastructure/nginx/nginx.conf)).
Takes effect on deploy (`deploy.sh` reloads nginx).

**Token TTL decision (ADR-064):** access tokens are retained at **1 hour** with
rotation — the balance of long-lived stream UX vs. blast radius. Not shortened:
a shorter TTL degrades SSE streams without a refresh-on-SSE story (out of scope).
The Sprint-81 SSE auth contract is locked in `tests/regression/sprint-81-sse-auth.test.ts`
(promoted from `tdd/` in Sprint 83; the regression tier is now wired into
`jest.config.js` `testMatch`).

### GET /notifications/stream/:userId (legacy compatibility)
Compatibility route for older clients. Requires JWT auth and rejects streams where
`:userId` does not match `token.userId`.

### GET /notifications/:userId
Get user's notifications (paginated).

**Query Parameters:**
- `limit` - Max results (default: 50)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "user_id": "uuid",
        "type": "match_created",
        "title": "Someone wants to help!",
        "body": "Bob Johnson offered to help with your request",
        "data": {
          "match_id": "uuid",
          "request_id": "uuid",
          "request_title": "Need help moving",
          "responder_name": "Bob Johnson"
        },
        "read": false,
        "action_url": "/requests/uuid",
        "created_at": "2025-01-10T12:00:00Z"
      }
    ],
    "unread_count": 5,
    "total": 1
  }
}
```

**Implementation:** `src/routes/notifications.ts:53`

### GET /notifications/:userId/unread-count
Get count of unread notifications.

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 5
  }
}
```

**Implementation:** `src/routes/notifications.ts:85`

### PUT /notifications/:notificationId/read
Mark specific notification as read.

**Request:**
```json
{
  "user_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "read": true,
    "read_at": "2025-01-10T13:00:00Z"
  },
  "message": "Notification marked as read"
}
```

**Implementation:** `src/routes/notifications.ts:104`

### PUT /notifications/:userId/read-all
Mark all notifications as read for a user.

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 5
  },
  "message": "5 notifications marked as read"
}
```

**Implementation:** `src/routes/notifications.ts:140`

### DELETE /notifications/:notificationId
Delete a notification.

**Request:**
```json
{
  "user_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification deleted"
}
```

**Implementation:** `src/routes/notifications.ts:161`

### GET /notifications/:userId/preferences
Get user's notification preferences.

**Response:**
```json
{
  "success": true,
  "data": {
    "global": {
      "in_app_enabled": true,
      "push_enabled": true,
      "email_enabled": false
    },
    "event_specific": [
      {
        "event_type": "match_created",
        "in_app_enabled": true,
        "push_enabled": true,
        "email_enabled": false
      }
    ]
  }
}
```

**Implementation:** `src/routes/notifications.ts:196`

### PUT /notifications/:userId/preferences
Update user's global notification preferences.

**Request:**
```json
{
  "in_app_enabled": true,
  "push_enabled": false,
  "email_enabled": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "in_app_enabled": true,
    "push_enabled": false,
    "email_enabled": true
  },
  "message": "Preferences updated successfully"
}
```

### POST /notifications/push/send (internal)
Send Expo push notifications to a list of users. Internal use only, authenticated by the
`x-internal-secret` header — **not** by JWT, because the router is mounted ahead of
`authMiddleware` in `src/index.ts`.

⚠️ **This path IS reachable from the internet.** nginx proxies `^/api/notifications(/.*)?$` to this
service (`infrastructure/nginx/nginx.conf`), so the internal-secret header is the only credential
standing in front of it. The guard therefore **fails closed**: when `INTERNAL_SECRET` is unset the
route answers `503 SERVICE_UNAVAILABLE` rather than admitting the caller (BUG-051 — the previous
guard skipped the comparison entirely when the secret was unconfigured, and no Compose file set it
for this service). A wrong secret gets `403 FORBIDDEN`; secrets are compared as SHA-256 digests via
`timingSafeEqual` and neither is ever logged.

No in-repo caller uses this HTTP route today. Event handlers call `sendPushToUsers()` in process
(`src/events/subscriber.ts` imports it directly), so failing closed breaks no existing flow.

**Request:**
```json
{
  "user_ids": ["uuid1", "uuid2"],
  "title": "New offer on your request",
  "body": "A provider has submitted an offer."
}
```

**Response:**
```json
{
  "success": true,
  "data": {}
}
```

**Notes:**
- Looks up Expo push tokens from `auth.device_push_tokens`
- Uses `expo-server-sdk` to deliver push messages
- Silently skips users with no registered push token
- Delivery counts are not reported; the response `data` is an empty object
- `400 MISSING_FIELDS` when `user_ids`, `title` or `body` is absent or empty

**Implementation:** `src/routes/push.ts` (route + guard), `src/lib/expoPush.ts` (delivery),
`src/middleware/internalAuth.ts` (fail-closed guard)

### GET /health
Service health check.

**Response:**
```json
{
  "status": "ok",
  "service": "notification-service"
}
```

## Event-Driven Architecture

The notification service listens to events from other services and creates appropriate notifications.

### Events Consumed

**preferred_provider_selected** - Requestor pre-selected a provider
- Triggered when a requestor files a typed request with a `preferred_provider_id`
- Creates an in-app notification for the provider with deep-link to `/requests/:id`
- Lets the provider know a requestor has specifically chosen them before reaching out

**match_created** - Someone offered to help
- Notifies requester
- Includes helper name and request details

**match_completed** - Help exchange completed
- Notifies both requester and helper
- Triggers karma notification (if listening)

**request_created** - New request in community
- Notifies all active community members (except requester) via `new_request`
- Additively routes `provider_request_matched` to providers whose `service_type` matches the request's `service_type` field (Sprint 37)
- Provider routing uses direct DB query (`requests.provider_profiles` JOIN `communities.members`) — no HTTP call
- `is_available` is NOT a filter: it controls browse visibility, not notification routing

**provider_review_received** - New review left on a provider profile (Sprint 37)
- Published by reputation-service after a review is saved and trust score recalculated
- Creates an in-app notification for the provider with deep-link to `/providers/:id`

**norm_proposed** - New norm proposed
- Notifies community members

**Event Handler:** `src/events/subscriber.ts:12-100`

**Example Event Processing:**
```typescript
eventQueue.process('match_created', async (job) => {
  const { payload } = job.data;
  const { match_id, request_id, requester_id, responder_id } = payload;

  // Get request details
  const request = await query('SELECT title FROM requests.help_requests WHERE id = $1', [request_id]);

  // Create notification for requester
  await createNotification({
    user_id: requester_id,
    type: 'match_created',
    data: {
      match_id,
      request_id,
      request_title: request.title,
      responder_name: responder.name,
    },
  });
});
```

## Notification Templates

Templates ensure consistent messaging across the platform:

```typescript
// src/templates/notificationTemplates.ts
export function generateNotification(type: NotificationType, data: any) {
  switch (type) {
    case 'match_created':
      return {
        type: 'match_created',
        title: 'Someone wants to help!',
        body: `${data.responder_name} offered to help with "${data.request_title}"`,
        data,
        action_url: `/requests/${data.request_id}`,
      };

    case 'match_completed':
      return {
        type: 'match_completed',
        title: 'Help exchange completed!',
        body: `You successfully completed "${data.request_title}"`,
        data,
        action_url: `/matches/${data.match_id}`,
      };

    // ... other templates
  }
}
```

## Dependencies

### Calls (Outbound)
- Auth Service (via database) - Get user names
- Request Service (via database) - Get request details
- Community Service (via database) - Get community details

### Called By (Inbound)
- Frontend (to fetch notifications, update preferences)
- Mobile App (SSE for real-time notifications)

### Events Published
- None (notification service only consumes events)

### Events Consumed
- `match_created` - Create notification for requester
- `match_completed` - Create notifications for both parties
- `karma_awarded` - Notify user of karma points (future)
- `norm_proposed` - Notify community members (future)
- `norm_established` - Notify community members (future)
- `preferred_provider_selected` - Notify provider of pre-selection (Sprint 29)
- `request_created` - Notify community members + matching providers (Sprint 37: now includes `provider_request_matched` routing)
- `provider_review_received` - Notify provider of new review (Sprint 37)
- `match_reminder` - Notify responder of upcoming departure time (cleanup-service cron)
- `provider_went_on_duty` - Notify matching community members that a provider is now available (Sprint 41)
- `offer_submitted` - Notify the requester that a provider has submitted an offer (Sprint 41; triggers Expo push via `auth.device_push_tokens`)
- `offer_accepted` - Notify the provider that their offer was accepted (Sprint 41)
- `offer_declined` - Notify the provider that their offer was declined (Sprint 41)

### External Dependencies
- PostgreSQL (notifications schema)
- Redis (event subscription via Bull queue)

## Environment Variables

```bash
# Server
PORT=3005
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/karmyq_db

# Redis
REDIS_URL=redis://localhost:6379

# Internal service auth (BUG-051). Required: POST /notifications/push/send answers 503 without it.
# Wired in docker-compose.yml and docker-compose.prod.yml; the demo host sets it in .env.demo.
INTERNAL_SECRET=dev_internal_secret_change_in_production

# Logging
LOG_LEVEL=info                   # debug, info, warn, error
```

## Key Files

### Entry Point
- `src/index.ts` - Express app initialization, event subscriber setup, SSE support

### Routes
- `src/routes/notifications.ts` - Notification CRUD, preferences, SSE endpoint

### Services
- `src/services/notificationService.ts` - Notification creation, preference checking
- `src/templates/notificationTemplates.ts` - Notification templates

### Events
- `src/events/subscriber.ts` - Listens to match_created, match_completed events

### Database
- `src/database/db.ts` - PostgreSQL connection pool

## Common Development Tasks

### Add New Notification Type

1. **Add to notification templates:**
```typescript
// src/templates/notificationTemplates.ts
export type NotificationType =
  | 'match_created'
  | 'match_completed'
  | 'new_notification_type'; // Add here

export function generateNotification(type: NotificationType, data: any) {
  switch (type) {
    // ... existing cases

    case 'new_notification_type':
      return {
        type: 'new_notification_type',
        title: 'Notification Title',
        body: `Notification body with ${data.field}`,
        data,
        action_url: `/path/${data.id}`,
      };
  }
}
```

2. **Add event subscriber (if event-driven):**
```typescript
// src/events/subscriber.ts
eventQueue.process('new_event_name', async (job) => {
  const { payload } = job.data;

  await createNotification({
    user_id: payload.user_id,
    type: 'new_notification_type',
    data: payload,
  });
});
```

### Push Notifications (Mobile) — already implemented

Push delivery exists; extend it rather than following an older recipe.

- **Token registration** is in auth-service: `POST /auth/push-tokens` and `DELETE /auth/push-tokens`
  (`services/auth-service/src/routes/pushTokens.ts`) write `auth.device_push_tokens`.
- **Delivery** is `sendPushToUsers()` in `src/lib/expoPush.ts`: it reads those tokens, drops any that
  `Expo.isExpoPushToken` rejects, sends in chunks of at most 100, and logs error tickets.
- **Callers** are the `provider_went_on_duty`, `offer_submitted`, `offer_accepted` and `offer_declined`
  handlers in `src/events/subscriber.ts`, plus the internal `POST /notifications/push/send` route.
- The SDK is pure ESM and reaches this CommonJS build through `require()` — see *Sprint 131 D4* below.

### Add Email Notifications

1. **Install email library:**
```bash
npm install nodemailer
```

2. **Create email service:**
```typescript
// src/services/emailService.ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function sendEmail(user_id: string, notification: any) {
  // Get user email
  const user = await query(
    `SELECT email, name FROM auth.users WHERE id = $1`,
    [user_id]
  );

  if (!user.rows[0]) return;

  await transporter.sendMail({
    from: 'KarmyQ <notifications@karmyq.org>',
    to: user.rows[0].email,
    subject: notification.title,
    text: notification.body,
    html: generateEmailHTML(notification),
  });
}

function generateEmailHTML(notification: any) {
  return `
    <h2>${notification.title}</h2>
    <p>${notification.body}</p>
    ${notification.action_url ? `<a href="${notification.action_url}">View Details</a>` : ''}
  `;
}
```

3. **Call from createNotification:**
```typescript
// src/services/notificationService.ts
if (shouldSend.email_enabled) {
  await sendEmail(user_id, createdNotification);
}
```

### Add Event-Specific Preferences

```typescript
// src/routes/notifications.ts
router.put('/:userId/preferences/:eventType', async (req, res) => {
  const { userId, eventType } = req.params;
  const { in_app_enabled, push_enabled, email_enabled, community_id } = req.body;

  await query(
    `INSERT INTO notifications.preferences
     (user_id, event_type, community_id, in_app_enabled, push_enabled, email_enabled)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, event_type, community_id)
     DO UPDATE SET
       in_app_enabled = $4,
       push_enabled = $5,
       email_enabled = $6,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, eventType, community_id || null, in_app_enabled, push_enabled, email_enabled]
  );

  res.json({ success: true, message: 'Preferences updated' });
});
```

### Add Notification Batching (Daily Digest)

```typescript
// src/cron/dailyDigest.ts
import cron from 'node-cron';

// Run every day at 8 AM
cron.schedule('0 8 * * *', async () => {
  // Get users with daily digest enabled
  const users = await query(
    `SELECT DISTINCT user_id
     FROM notifications.global_preferences
     WHERE email_enabled = TRUE`
  );

  for (const user of users.rows) {
    // Get unread notifications from last 24 hours
    const notifications = await query(
      `SELECT * FROM notifications.notifications
       WHERE user_id = $1
         AND read = FALSE
         AND created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC`,
      [user.user_id]
    );

    if (notifications.rows.length > 0) {
      await sendDigestEmail(user.user_id, notifications.rows);
    }
  }
});
```

## Security Considerations

### User-Only Access
- Notifications can only be read by their owner
- user_id verified on all read/update/delete operations

```typescript
// src/routes/notifications.ts
const notification = await markAsRead(notificationId, user_id);

// Implementation checks user_id matches
UPDATE notifications.notifications
SET read = TRUE
WHERE id = $1 AND user_id = $2  -- Ensures ownership
```

### SSE Connection Security
- SSE endpoint requires JWT authentication
- Supports browser `EventSource` by accepting `access_token` query param
- Stream user identity is derived from JWT
- Automatic cleanup on disconnect
- Legacy `/:userId` route enforces path-user and token-user equality

```typescript
// src/routes/notifications.ts
const tokenUserId = req.user?.userId;
if (requestedUserId && requestedUserId !== tokenUserId) {
  return res.status(403).json({ success: false, error: 'FORBIDDEN' });
}
const notificationHandler = (data: any) => {
  if (data.user_id === tokenUserId) {
    res.write(`data: ${JSON.stringify(data.notification)}\n\n`);
  }
};
```

### Preference Enforcement
- Notifications only sent if user preferences allow
- Falls back to global preferences if no event-specific preference
- Cannot be bypassed

### Input Validation
- Validate notification types against defined NotificationType
- Sanitize user-provided data in notifications
- Validate user_id exists before creating notification

## Debugging Common Issues

### SSE connection not working
1. Check browser console for connection errors
2. Verify port 3005 is accessible
3. Check CORS headers are set correctly
4. Test with curl:
   `curl -N "http://localhost:3005/notifications/stream?access_token=<jwt>"`
5. Check service logs for "SSE connection established"

### Notifications not appearing
1. Check event was published: Look at request-service logs
2. Check event subscriber is running: Look for "Event subscriber initialized"
3. Check notifications table: `SELECT * FROM notifications.notifications WHERE user_id = '...' ORDER BY created_at DESC LIMIT 5`
4. Check user preferences: May be disabled
5. Verify notification template exists for event type

### Real-time notifications delayed
1. Check Redis connection
2. Verify event queue is processing: `redis-cli LLEN karmyq-events`
3. Check for errors in event subscriber logs
4. Test SSE connection is active
5. Check network connectivity (SSE can be blocked by proxies)

### Unread count incorrect
1. Query database directly: `SELECT COUNT(*) FROM notifications.notifications WHERE user_id = '...' AND read = FALSE`
2. Check if mark-as-read is working correctly
3. Verify read_at timestamp is being set
4. Check for concurrent updates

### Preferences not saving
1. Check user_id exists in auth.users
2. Verify unique constraint on (user_id, event_type, community_id)
3. Check ON CONFLICT clause is working
4. Look for database errors in logs

## Testing

### Manual Testing with curl

**Get Notifications:**
```bash
curl "http://localhost:3005/notifications/user-uuid?limit=10"
```

**SSE Stream:**
```bash
curl -N "http://localhost:3005/notifications/stream/user-uuid"
curl -N "http://localhost:3005/notifications/stream?access_token=<jwt>"
```

**Mark as Read:**
```bash
curl -X PUT http://localhost:3005/notifications/notification-uuid/read \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user-uuid"}'
```

**Update Preferences:**
```bash
curl -X PUT http://localhost:3005/notifications/user-uuid/preferences \
  -H "Content-Type: application/json" \
  -d '{
    "in_app_enabled": true,
    "push_enabled": false,
    "email_enabled": true
  }'
```

**Trigger Notification (via event):**
```bash
redis-cli LPUSH karmyq-events '{"event":"match_created","payload":{"match_id":"uuid","request_id":"uuid","requester_id":"uuid","responder_id":"uuid"}}'
```

### Unit Tests

Run tests:
```bash
npm test
```

Test structure:
```
src/
├── __tests__/
│   ├── notifications.test.ts  # Notification CRUD tests
│   ├── preferences.test.ts    # Preference management tests
│   ├── sse.test.ts           # SSE connection tests
│   └── events.test.ts        # Event subscription tests
```

## Performance Considerations

- SSE connections kept alive with 30-second heartbeats
- Notifications paginated (default 50 limit)
- Indexes on user_id, read status, created_at for fast queries
- EventEmitter used for in-memory SSE distribution (no database polling)
- Connection pooling for PostgreSQL (max 20 connections)
- Event queue processes one event at a time per type

## Future Enhancements (TODO)

- [ ] Push notifications for mobile (Expo/FCM integration)
- [ ] Email notifications (transactional emails)
- [ ] Daily digest emails (batched notifications)
- [ ] Notification batching (group similar notifications)
- [ ] Rich media notifications (images, actions)
- [ ] Notification sound customization
- [ ] Per-community notification preferences
- [ ] Notification scheduling (send later)
- [ ] Read receipts for critical notifications
- [ ] Federation support (cross-instance notifications)

## Related Documentation

- Main architecture: `/docs/ARCHITECTURE.md`
- Database schema: `/infrastructure/postgres/init.sql` (lines 209-272)
- SSE implementation: `src/routes/notifications.ts:16-50`
- Templates: `src/templates/notificationTemplates.ts`

---

## Sprint 122 — Express 5 (2026-07-29)

`@types/express` **4.17.21 → 5.0.6**. Express 5's `path-to-regexp` 8 widened route params to
`string | string[]` (a repeatable `:ids+` or wildcard `*splat` segment captures an array), which
surfaced as `TS2345` at every `req.params` read. Karmyq declares no such segment, so params are
narrowed back to `string` via **`RouteParams`** (exported from `@karmyq/shared/middleware/auth`)
rather than widened with `as any`. The invariant is enforced by
`tests/regression/sprint-122-express5-route-params.test.ts`, which fails if any route literal
introduces wildcard or repeatable syntax.

Changed: `src/routes/notifications.ts` — 7 handlers annotated `Request<RouteParams>`, importing the
shared alias.

**Also fixed here: `@karmyq/shared` was imported but never declared.** `src/index.ts` and
`src/middleware/sseAuth.ts` import the logger, middleware, `JWTPayload` and response helpers from
it, yet the manifest listed neither — a live "declare what you import" violation (CLAUDE.md), and
the reason Turbo had no build-order edge from `@karmyq/shared` to this service. Now declared as
`"*"`, matching every other consuming service.

Express **4.18.2 → 5.2.1**, supplied by the root `package.json` **production** dependency
(the Dockerfiles copy the root manifest and `npm install --omit=dev`). **No endpoint, payload,
status code or event contract changed** — `feedback:check` flags this service's `src/routes/`
diff as a "route change", but the diff is type annotations only, so the API Endpoints section
above is still accurate.

Express 5 semantics now in force: async handler rejections auto-forward to the error middleware,
`res.status()` throws `RangeError` on an out-of-range code, and `req.query` is a getter rather
than a writable own property.

**⚠️ `req.body` default restored (the bug this PR actually shipped to CI).** body-parser 1
initialised `req.body` to `{}` on every request; body-parser 2 leaves it **undefined** unless a
body was parsed, so `const { x } = req.body` throws a `TypeError` on a bodyless request and the
route's catch turns it into a **500**. `app.use(normalizeRequestBody)` is now mounted immediately
after `express.json()` in `src/index.ts` to restore the Express 4 behaviour. It fills in only a
*missing* body, so a parsed array or explicit `null` is untouched.

## Sprint 131 PR B2 — declared imports (2026-09-17)

Now declares `bull`, `cors`, `dotenv`, `express`, `pg` in `dependencies`, and `jsonwebtoken` in `devDependencies` at root's exact
ranges (BUG-046). They were imported but undeclared, resolving only through root hoisting. Resolved versions are
unchanged. `tests/regression/sprint-131-workspace-declarations.test.ts` fails on any undeclared import, and fails
when root's hoisted version stops satisfying a range declared here — so a root-only major bump (e.g. D1 dotenv 17)
must bump this manifest in the same PR. Range satisfaction alone could not enforce that: npm answers a stranded
range by nesting a satisfying older copy under the workspace, which keeps a plain satisfaction check green.

No endpoint, payload, event or schema change.

## Sprint 131 D1 — dotenv 17 (2026-09-19)

`dotenv` **16.6.1 → 17.4.2** (root plus all 9 npm workspaces that declare it; the ranges moved together in
one PR, which the declarations gate requires. The two non-workspace test manifests, `tests/e2e/package.json` and
`tests/load/package.json`, deliberately stay on `^16.3.1` with their own nested installs — dotenv 16 accepts
`quiet` too, so their call sites are fixed either way). `src/index.ts` now calls **`dotenv.config({ quiet: true })`**.

`quiet` is not cosmetic here. dotenv 16 defaulted it to `true`; 17 defaults it to falsy, so a bare
`config()` prints `◇ injected env (N) from .env // tip: …` on every call — and the tip is drawn at random
from an 8-entry list that includes third-party promo URLs. Without the flag this service would log a
non-deterministic marketing line on every container start.
`tests/regression/sprint-131-dotenv-quiet.test.ts` discovers the call sites from tracked source and fails
on any `config()` that omits `quiet`.

No endpoint, payload, event or schema change. `parse()` output is byte-identical between 16 and 17, and
nothing here reads `config()`’s return value.

## Sprint 131 BUG-051 — the internal push route now fails closed (2026-09-22)

`POST /notifications/push/send` was **unauthenticated in every deployed environment**. Four
independent facts combined into one hole:

1. The guard in `src/routes/push.ts` read `if (secret && supplied !== secret)`. With
   `INTERNAL_SECRET` unset the condition is falsy, so every request passed through — it **failed
   open** rather than refusing.
2. `INTERNAL_SECRET` was wired to request-service and social-graph-service only. **This service
   received it in neither Compose file**, so the guard was never armed anywhere.
3. The push router is mounted at `src/index.ts` *before* the `authMiddleware`-protected
   `/notifications` router. Express matches in order, so the path never reaches JWT auth.
4. nginx proxies `^/api/notifications(/.*)?$` publicly.

Net effect: `POST https://karmyq.com/api/notifications/push/send` would send an arbitrary push
notification to arbitrary users with no credential at all — a phishing surface arriving on users'
devices under the platform's own name.

**The fix is two halves that only work together.** `src/middleware/internalAuth.ts` (new) mirrors
social-graph-service's guard: 503 when unconfigured, `timingSafeEqual` over SHA-256 digests, and
neither secret logged. `INTERNAL_SECRET` is now wired to this service in **both**
`docker-compose.yml` and `docker-compose.prod.yml`. Failing closed without the secret would have
turned the route into a permanent 503; wiring the secret without failing closed would have changed
nothing.

⚠️ **The guard is attached to the ROUTE, never with `router.use`.** This router is mounted at
`/notifications`, not `/notifications/push`, so a router-level guard gates every sibling route
under the prefix — the authenticated list, unread-count and preferences routes that fall through
to the next mount. That was inert only while `INTERNAL_SECRET` was unset; arming the secret turns
it into **403 for every notifications read on the platform** (measured: 403 configured, 503 unset,
before correction; 401 from `authMiddleware` after). If you ever add a second internal route here,
give each one its own `internalAuth` argument, or mount a separate router at `/notifications/push`. The demo host's `~/karmyq/.env.demo` was confirmed (read-only, 2026-09-22) to define
`INTERNAL_SECRET` exactly once and non-empty, so the deployed route authenticates rather than 503s.

`tests/regression/sprint-131-push-internal-auth.test.ts` drives the **real** Express app with the
**real** guard — only the push transport, database and Bull subscriber are mocked — and every
rejection asserts the transport was never invoked, because a status code alone cannot prove the
guard ran *before* the handler. The suite was shown to discriminate: the legacy predicate admits an
anonymous caller with 200 and reaches the handler, where the fixed guard answers 503 and does not.

No caller was broken: nothing in the repo invokes this HTTP route. `src/events/subscriber.ts`
imports `sendPushToUsers()` and calls it in process, which is what the old "called by event
handlers" note in this file actually described.

Not changed: `docker-compose.qa.yml`, `.staging.yml` and `.test.yml` still omit `INTERNAL_SECRET`
for this service. They are referenced only by archived scripts, not by the live deploy path, and
qa already omits social-graph-service's too.

No payload, event or schema change. The response shape of the route is unchanged — this file
previously documented a `{ sent, failed }` body that the code has never returned, and an
implementation path (`src/services/pushNotificationService.ts`) that does not exist; both are
corrected above.

## Sprint 131 D4 — expo-server-sdk 7 (2026-09-23)

`expo-server-sdk` **6.1.0 → 7.2.0** (#230). This service is its only declarer and `src/lib/expoPush.ts` its
only importer. The whole v7 code change, read from the two published packages rather than the changelog: the
SDK reads its own version through a JSON import (`with { type: 'json' }`) instead of `createRequire`; its
engines floor is Node `>=22.12.0` (was `>=20`; we run 24); and its types gain optional message fields.
Everything this service calls — the default export, a no-argument constructor, `Expo.isExpoPushToken`,
`chunkPushNotifications`, `sendPushNotificationsAsync` — is unchanged.

**How the SDK actually loads.** `expoPush.ts` says `await import('expo-server-sdk')`, but this service compiles
with `"module": "commonjs"`, so tsc emits `require('expo-server-sdk')`. A pure-ESM package loads that way only
because Node can `require()` an ES module. The code now reads the SDK's named `Expo` export rather than
`default`: `.default` is the class only while Node marks a required ES module `__esModule`, and the named export
does not depend on that. Both are the same class today, so behavior is unchanged. The comment that described a
dynamic `import()` was wrong and is corrected.

`tests/regression/sprint-131-expo-push-real-sdk.test.ts` is the first test to exercise the SDK at all — the
BUG-051 suite mocks `sendPushToUsers` out. Jest's module loader is not the one production uses, so each case runs
in a plain `node` child (`tests/helpers/expo-push-child.cjs`). The child loads `expoPush.ts` through ts-node with
this service's tsconfig (the same emit as `npm run build`), resolves modules from the file's real location and
substitutes only the database; the real
SDK talks to a local stub of Expo's push API through `EXPO_BASE_URL`, and the child can dial nothing but
loopback (one case proves it). Only data crosses to the child, never code. Cases: invalid tokens filtered;
error tickets logged with message and details; chunks of at most 100; nothing sent when no token is valid; an
Expo API error rejects, so the calling event handler logs it; and the SDK is reached through `require()`. The
same file passes on 6.1.0 and on 7.2.0.

The SDK loads lazily, on the first push, so a deploy's health checks never exercise it. This test covers the
source and the lockfile's install on CI's Node 24; the image builds its own tree (`npm install --omit=dev` on
`node:24-alpine`), so only loading the SDK inside the running container checks the deployed copy. Loading it at
boot instead would put it under the deploy's health checks — see `docs/IDEAS.md` [2026-09-23].

No endpoint, payload, event or schema change. Not covered: the SDK's own retry of a 429 with backoff.
