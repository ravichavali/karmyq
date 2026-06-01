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

-- notifications.push_tokens
CREATE TABLE notifications.push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,                     -- Expo push token or FCM token
  device_type VARCHAR(20) NOT NULL,        -- 'ios', 'android', 'web'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, token)
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications.notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications.notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications.notifications(created_at DESC);
```

### Tables Read by This Service
- `auth.users` - User names for notification messages
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
Send Expo push notifications to a list of users. Internal use only (called by event handlers within the notification service itself, not exposed publicly).

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
  "data": { "sent": 2, "failed": 0 }
}
```

**Notes:**
- Looks up Expo push tokens from `auth.device_push_tokens`
- Uses `expo-server-sdk` to deliver push messages
- Silently skips users with no registered push token

**Implementation:** `src/services/pushNotificationService.ts`

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

### Implement Push Notifications (Mobile)

1. **Add push token registration endpoint:**
```typescript
// src/routes/notifications.ts
router.post('/:userId/push-token', async (req, res) => {
  const { userId } = req.params;
  const { token, device_type } = req.body;

  await query(
    `INSERT INTO notifications.push_tokens (user_id, token, device_type)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, token) DO UPDATE SET last_used = CURRENT_TIMESTAMP`,
    [userId, token, device_type]
  );

  res.json({ success: true, message: 'Push token registered' });
});
```

2. **Send push notification via Expo:**
```typescript
// src/services/pushNotificationService.ts
import { Expo } from 'expo-server-sdk';

const expo = new Expo();

export async function sendPushNotification(user_id: string, notification: any) {
  // Get user's push tokens
  const tokens = await query(
    `SELECT token FROM notifications.push_tokens WHERE user_id = $1`,
    [user_id]
  );

  const messages = tokens.rows.map(row => ({
    to: row.token,
    sound: 'default',
    title: notification.title,
    body: notification.body,
    data: notification.data,
  }));

  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      console.error('Push notification error:', error);
    }
  }
}
```

3. **Call from createNotification:**
```typescript
// src/services/notificationService.ts
export async function createNotification(params: CreateNotificationParams) {
  // ... existing code ...

  // Send push notification if enabled
  if (shouldSend.push_enabled) {
    await sendPushNotification(user_id, createdNotification);
  }
}
```

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
