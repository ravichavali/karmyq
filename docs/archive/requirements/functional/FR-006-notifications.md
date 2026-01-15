# FR-006: Notifications

**Status:** ✅ Implemented | **Priority:** Medium | **Version:** 5.1.0

## Overview

Real-time and persistent notification system for platform events using Server-Sent Events (SSE) and in-app notifications.

## Key Features

### FR-006.1: Notification Types
- [x] match_created - New match proposed
- [x] match_accepted - Match accepted
- [x] match_completed - Match completed
- [x] karma_awarded - Karma earned
- [x] new_request - New request in community
- [x] join_request - User wants to join private community
- [x] message_received - New message
- [x] community_invite - Invited to community

### FR-006.2: Notification Delivery
- [x] In-app notifications (stored in DB)
- [x] Real-time via Server-Sent Events (SSE)
- [x] Push notifications ready (not implemented)
- [x] Email notifications ready (not implemented)

### FR-006.3: User Preferences
- [x] Global notification settings per user
- [x] Event-specific preferences
- [x] Per-community preferences (future)
- [x] Channels: in_app, push, email

### FR-006.4: Notification Management
- [x] Mark as read/unread
- [x] Delete notifications
- [x] Mark all as read
- [x] Pagination support
- [x] Notification bell with unread count

### FR-006.5: SSE Real-Time
- [x] EventSource connection per user
- [x] Automatic reconnection
- [x] Heartbeat every 30s
- [x] No authentication required (userId in URL)
- [x] Immediate notification delivery

## Data Model
```sql
CREATE TABLE notifications.notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  body TEXT,
  data JSONB,
  action_url VARCHAR(500),
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP
);
```

## Template System
Notification templates define:
- Title and body generation
- Priority level
- Icon
- Action URL
- Enabled channels

## Related
- [TR-005: Real-Time Features](../technical/TR-005-realtime.md)
- [FR-004: Matching](FR-004-matching.md)
- [FR-002: Communities](FR-002-communities.md)
