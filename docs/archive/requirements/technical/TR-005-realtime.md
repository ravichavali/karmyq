# TR-005: Real-Time Features (SSE)

**Status:** ✅ Implemented | **Priority:** Medium | **Version:** 5.1.0

## Overview

Real-time notifications using Server-Sent Events (SSE) for instant updates without polling.

## Technology Choice: SSE

### Why SSE over WebSocket?
✅ **Simpler** - Unidirectional (server → client)
✅ **HTTP/2** - Multiplexing support
✅ **Auto-reconnect** - Built into EventSource API
✅ **Firewall-friendly** - Uses standard HTTP

❌ **No client → server** - Use REST for client actions
❌ **IE not supported** - Modern browsers only

## Implementation

### Server (Notification Service)
```typescript
// SSE endpoint (no auth - userId in URL)
app.get('/notifications/stream/:userId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial connection message
  res.write('data: {"type":"connected"}\n\n');

  // Listen for notifications
  notificationEmitter.on('notification', (data) => {
    if (data.user_id === userId) {
      res.write(`data: ${JSON.stringify(data.notification)}\n\n`);
    }
  });

  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    notificationEmitter.removeListener('notification', handler);
    clearInterval(heartbeat);
  });
});
```

### Client (Frontend)
```typescript
const eventSource = new EventSource(`/notifications/stream/${userId}`);

eventSource.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  if (notification.type !== 'connected') {
    // Add to notifications list
    addNotification(notification);
  }
};

eventSource.onerror = () => {
  eventSource.close();
  // Reconnect after 5s
  setTimeout(connectSSE, 5000);
};
```

## Event Flow

```
Match Completed
    ↓
Event Published to Redis
    ↓
Notification Service Subscribes
    ↓
Creates Notification in DB
    ↓
Emits to notificationEmitter
    ↓
SSE pushes to connected clients
    ↓
Browser updates UI instantly
```

## Security

### No Authentication Required
- EventSource doesn't support custom headers
- userId in URL provides isolation
- Each user only receives their own notifications
- Acceptable risk for non-sensitive notifications

### Future Enhancement
- Token in query param: `/stream?token=jwt`
- Validate token before establishing connection

## Benefits
✅ Instant updates (no polling)
✅ Low latency (<100ms)
✅ Efficient (persistent connection)
✅ Simple to implement
✅ Auto-reconnection

## Challenges
❌ Horizontal scaling (sticky sessions needed)
❌ Connection limits per server
❌ No binary data support
❌ Browser connection limits (6 per domain)

## Monitoring

### Connection Stats
- Active SSE connections
- Messages sent per second
- Reconnection rate
- Error rate

## Related
- [FR-006: Notifications](../functional/FR-006-notifications.md)
- [TR-003: Event-Driven](TR-003-events.md)
