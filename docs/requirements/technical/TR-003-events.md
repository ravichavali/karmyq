# TR-003: Event-Driven Architecture

**Status:** ✅ Implemented | **Priority:** Medium | **Version:** 5.1.0

## Overview

Services communicate asynchronously via Redis-backed event queue (Bull) for loose coupling and eventual consistency.

## Event Queue

### Technology
- **Queue:** Bull (Node.js job queue)
- **Backend:** Redis
- **Queue Name:** `karmyq-events`

### Event Flow
```
Publisher → Redis Queue → Subscriber(s)
```

## Event Types

### Core Events
1. **match_completed** - Match marked as completed
   - Publisher: request-service
   - Subscribers: reputation-service, notification-service
   - Payload: `{ match_id, request_id, requester_id, responder_id, community_id }`

2. **user_joined_community** - User joins public community
   - Publisher: community-service
   - Subscribers: notification-service
   - Payload: `{ community_id, user_id, role }`

3. **join_request_created** - User requests to join private community
   - Publisher: community-service
   - Subscribers: notification-service
   - Payload: `{ community_id, user_id, message }`

4. **karma_awarded** - Karma points awarded
   - Publisher: reputation-service
   - Subscribers: notification-service
   - Payload: `{ user_id, community_id, points, reason }`

5. **request_created** - New help request
   - Publisher: request-service
   - Subscribers: notification-service, feed-service
   - Payload: `{ request_id, requester_id, community_id, title }`

## Implementation

### Publisher
```typescript
import { publishEvent } from './events/publisher';

await publishEvent('match_completed', {
  match_id,
  request_id,
  requester_id,
  responder_id,
  community_id
});
```

### Subscriber
```typescript
eventQueue.process('match_completed', async (job) => {
  const { payload } = job.data;
  // Handle event
});
```

## Benefits
✅ Loose coupling between services
✅ Async processing
✅ Retry on failure
✅ Multiple subscribers per event
✅ Event sourcing foundation

## Challenges
❌ Eventual consistency
❌ Monitoring distributed events
❌ Dead letter queue needed
❌ Event versioning strategy

## Related
- [TR-001: Microservices](TR-001-microservices.md)
- [TR-005: Real-Time Features](TR-005-realtime.md)
