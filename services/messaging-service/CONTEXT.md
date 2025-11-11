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

## Environment Variables

```bash
PORT=3006
DATABASE_URL=postgresql://user:password@localhost:5432/karmyq_db
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
