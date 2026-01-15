# FR-007: Messaging

**Status:** ✅ Implemented | **Priority:** Medium | **Version:** 5.1.0

## Overview

Direct messaging between users, typically in the context of active matches.

## Key Features

### FR-007.1: Conversations
- [x] Created automatically when match accepted
- [x] Linked to match_id
- [x] Two participants (requester + responder)
- [x] Private to participants only

### FR-007.2: Send Messages
- [x] Text messages up to 5000 chars
- [x] Real-time delivery via SSE (future)
- [x] Message notifications sent
- [x] Timestamps tracked

### FR-007.3: View Conversations
- [x] List user's conversations
- [x] Filter by match status
- [x] Sort by last message time
- [x] Unread message indicator

### FR-007.4: Message History
- [x] View all messages in conversation
- [x] Chronological order
- [x] Pagination support
- [x] Messages retained per TTL

## Data Model
```sql
CREATE TABLE messaging.conversations (
  id UUID PRIMARY KEY,
  request_match_id UUID REFERENCES requests.matches(id),
  participant1_id UUID REFERENCES auth.users(id),
  participant2_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP
);

CREATE TABLE messaging.messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  sender_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP
);
```

## Related
- [FR-004: Matching](FR-004-matching.md)
- [FR-006: Notifications](FR-006-notifications.md)
- [FR-009: Cleanup](FR-009-cleanup.md)
