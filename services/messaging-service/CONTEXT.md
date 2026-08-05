# Messaging Service Context

> **Quick Start**: `cd services/messaging-service && npm run dev`
> **Port**: 3006 | **Health**: http://localhost:3006/health

## Purpose

Real-time chat messaging between users via WebSocket (Socket.IO). Enables requester and helper to communicate before, during, and after help exchanges.

## Database Schema

### Tables Owned by This Service

```sql
-- messaging.conversations
CREATE TABLE messaging.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_match_id UUID REFERENCES requests.matches(id) ON DELETE CASCADE,
    last_message_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- messaging.conversation_participants
CREATE TABLE messaging.conversation_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES messaging.conversations(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE(conversation_id, participant_id)
);

-- messaging.messages
CREATE TABLE messaging.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES auth.users(id),
    conversation_id UUID NOT NULL REFERENCES messaging.conversations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'sent',        -- sent, delivered, read
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_messages_conversation_id ON messaging.messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messaging.messages(created_at DESC);
CREATE INDEX idx_conversation_participants_user ON messaging.conversation_participants(participant_id);
```

## WebSocket API (Socket.IO)

### Connect to WebSocket
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3006', {
  query: { userId: 'user-uuid' }
});
```

### Join Conversation
```javascript
socket.emit('join_conversation', {
  conversation_id: 'conv-uuid',
  user_id: 'user-uuid'
});
```

### Send Message
```javascript
socket.emit('send_message', {
  conversation_id: 'conv-uuid',
  sender_id: 'user-uuid',
  content: 'Hello, when can we meet?'
});
```

### Receive Messages
```javascript
socket.on('new_message', (message) => {
  console.log('New message:', message);
  // {
  //   id: 'msg-uuid',
  //   conversation_id: 'conv-uuid',
  //   sender_id: 'user-uuid',
  //   content: 'Hello!',
  //   created_at: '2025-01-10T12:00:00Z'
  // }
});
```

**Implementation:** `src/socket/messageHandler.ts`

## REST API Endpoints

### GET /messages/conversations/:userId
Get all conversations for a user.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "conv-uuid",
      "request_match_id": "match-uuid",
      "last_message_at": "2025-01-10T12:00:00Z",
      "participants": [
        {"id": "user-1-uuid", "name": "Alice"},
        {"id": "user-2-uuid", "name": "Bob"}
      ],
      "last_message": {
        "content": "See you tomorrow!",
        "sender_id": "user-1-uuid"
      }
    }
  ]
}
```

### GET /messages/:conversationId
Get all messages in a conversation (paginated).

**Query Parameters:**
- `limit` - Max results (default: 50)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg-uuid",
        "sender_id": "user-uuid",
        "sender_name": "Alice Smith",
        "content": "Hello!",
        "status": "read",
        "created_at": "2025-01-10T12:00:00Z"
      }
    ],
    "total": 45
  }
}
```

### POST /messages
Create new conversation (usually auto-created when match occurs).

**Request:**
```json
{
  "request_match_id": "match-uuid",
  "participant_ids": ["user-1-uuid", "user-2-uuid"]
}
```

### POST /messages/:conversationId/mark-read
Mark all messages in conversation as read.

**Request:**
```json
{
  "user_id": "user-uuid"
}
```

## Key Files

- `src/index.ts` - Express + Socket.IO server setup
- `src/socket/messageHandler.ts` - WebSocket message handling
- `src/routes/messages.ts` - REST API endpoints
- `src/database/db.ts` - PostgreSQL connection pool
- `src/config/redis.ts` - node-redis client + dedicated subscriber connection

## Environment Variables

```bash
PORT=3006
DATABASE_URL=postgresql://user:password@localhost:5432/karmyq_db
REDIS_URL=redis://localhost:6379
NODE_ENV=development
LOG_LEVEL=info
```

## Common Development Tasks

### Add Message Types (text, image, location)
```typescript
// Add message_type column
ALTER TABLE messaging.messages
ADD COLUMN message_type VARCHAR(20) DEFAULT 'text',
ADD COLUMN media_url TEXT;

// Update send handler
socket.on('send_message', async (data) => {
  const { conversation_id, sender_id, content, message_type, media_url } = data;

  const result = await query(
    `INSERT INTO messaging.messages
     (conversation_id, sender_id, content, message_type, media_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [conversation_id, sender_id, content, message_type || 'text', media_url]
  );
});
```

### Add Typing Indicators
```typescript
// src/socket/messageHandler.ts
socket.on('typing_start', (data) => {
  socket.to(data.conversation_id).emit('user_typing', {
    user_id: data.user_id,
    user_name: data.user_name
  });
});

socket.on('typing_stop', (data) => {
  socket.to(data.conversation_id).emit('user_stopped_typing', {
    user_id: data.user_id
  });
});
```

## Security Considerations

- Only conversation participants can read/send messages
- Verify user_id on all WebSocket events
- SQL injection prevented with parameterized queries
- Message content should be sanitized

## Related Documentation

- Database schema: `/infrastructure/postgres/init.sql` (lines 178-208)
- Socket.IO docs: https://socket.io/docs/v4/

---

## Sprint 122 — Express 5 (2026-07-29)

`@types/express` **4.17.21 → 5.0.6**. Express 5's `path-to-regexp` 8 widened route params to
`string | string[]` (a repeatable `:ids+` or wildcard `*splat` segment captures an array), which
surfaced as `TS2345` at every `req.params` read. Karmyq declares no such segment, so params are
narrowed back to `string` via **`RouteParams`** (exported from `@karmyq/shared/middleware/auth`)
rather than widened with `as any`. The invariant is enforced by
`tests/regression/sprint-122-express5-route-params.test.ts`, which fails if any route literal
introduces wildcard or repeatable syntax.

Changed: `src/routes/messages.ts` — this file declares its **own local** `AuthenticatedRequest`
(a structural copy of the shared one), now `extends Request<RouteParams>` using the shared alias.

**Also fixed here: `@karmyq/shared` was imported but never declared.** `src/index.ts` imports
`createLogger`, `authMiddleware`, `AuthenticatedRequest` and the response helpers from it, yet the
manifest listed neither — a live "declare what you import" violation (CLAUDE.md), and the reason
Turbo had no build-order edge from `@karmyq/shared` to this service. Now declared as `"*"`, matching
every other consuming service.

*Known duplication, deliberately not fixed here:* `src/index.ts` imports `AuthenticatedRequest`
from `@karmyq/shared/middleware` while `src/routes/messages.ts` declares a local one whose `user`
shape differs from the shared `JWTPayload` (`communities` is optional with a widened `role`).
Consolidating them would change type semantics, which does not belong in a dependency PR.

⚠️ **This service contains zero test files** ("14 files checked, 0 matches") and declares no `test`
scripts, so `tsc` (0 errors) is the only local signal for the Express 5 move here.

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

---

## Sprint 122 PR 5 — node-redis 4 → 6, runtime floor Node 24 (2026-08-05)

`redis` **4.7.1 → 6.2.0** (two majors). This service is the **only** importer in the repo
(`src/config/redis.ts`), and it previously imported the package **without declaring it**, surviving
on the root declaration being hoisted — the same "declare what you import" violation as
`@karmyq/shared` above. Now declared at `^6.2.0`, matching the root.

**The bump required moving the container runtime first.** node-redis 6 declares
`engines.node: ">= 20.0.0"`; every backend Dockerfile ran `node:18-alpine`. See **ADR-090** — all
images are now `node:24-alpine` and `tests/regression/sprint-122-runtime-floor-gate.test.ts` blocks
on the image/`engines`/CI alignment.

### Two v6 behaviour changes that reach this service

**1. Ordinary commands now time out after 5s.** `@redis/client` 6 applies
`DEFAULT_COMMAND_TIMEOUT = 5000` in `#initiateOptions`; v4 applied none. Nine call sites here are
fire-and-forget or awaited inside async Socket.IO listeners, and **Socket.IO does not catch
rejections from async listeners** — an unhandled rejection terminates the process on Node 20+. All
nine are now guarded (`try`/`catch` around the `hSet` registration pair and the `hDel` cleanup pair,
`.catch` on the three `subscribe()` calls and both connects).

⚠️ **The timeout does NOT reach `subscribe()`** — corrected in code review after an earlier version
of this document claimed it did. Pub/sub is enqueued by `#addPubSubCommand`, which hardcodes
`timeout: undefined`; only `addCommand` attaches `commandOptions.timeout` as an
`AbortSignal.timeout`. So the 5s timeout governs `hSet`, `hDel` and `publish`. `subscribe()` still
rejects on a connection lost or destroyed while the SUBSCRIBE is queued, which is why it keeps its
`.catch` — but the mechanism is connection loss, not a timeout.

**2. RESP3 is the default protocol**, which flips `maintNotifications` to `"auto"`. That sends an
Enterprise-only `CLIENT MAINT_NOTIFICATIONS ON` at handshake and performs a **DNS lookup on every
connect**; the resulting error is swallowed only because `"auto"` (unlike `"enabled"`) does not
rethrow. We run OSS `redis:7-alpine` everywhere — compose, CI service containers, demo — so the
feature can never fire. It is now explicitly `maintNotifications: 'disabled'`.

**3. `duplicate()` copies options, not listeners.** It calls
`new constructor({ ...parentOptions })`, so `redisSubscriber` inherits **no** EventEmitter
registrations from `redisClient`. An `'error'` event with no listener **throws**, which terminates
the process — so every socket error on the subscriber connection was fatal. The subscriber now
registers its own `'error'` and `'connect'` handlers. Found in code review, not by me.

RESP3 itself is kept (Redis 7 speaks `HELLO 3`). `createClient`, `duplicate()`, `isOpen`,
`connect()`, `subscribe(channel, listener)`, `hSet`, `hDel` and `publish` are otherwise unchanged
across 4 → 6; verified by `tsc --noEmit` against the real 6.2.0 typings, with the resolution traced
to `redis/dist/index.d.ts@6.2.0` and proven non-vacuous by injecting a deliberate type error.

⚠️ **This service still contains zero test files** (BUG-034). It now at least has a `type-check`
script wired into CI's blocking `Lint & Type Check` step — before this PR, **nothing in CI could
have failed on a redis regression here.** A live message round-trip remains a manual post-deploy
check; `/health` alone does not exercise Redis.
