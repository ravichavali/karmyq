# ADR-012: Real-Time Communication Stack (WebSocket + SSE)

**Date**: 2025-12-29
**Status**: Accepted
**Deciders**: Development Team
**Related**: services/messaging-service, services/notification-service

## Context

The application needs two types of real-time communication:
1. **Chat/Messaging** - Bidirectional, interactive conversations
2. **Notifications** - Unidirectional, push updates to clients

We needed to choose the right technology for each use case.

## Decision

**Hybrid approach: WebSocket for chat, Server-Sent Events (SSE) for notifications.**

### WebSocket for Messaging (Socket.IO)

**Service**: Messaging Service (Port 3006)

```typescript
// Server
io.on('connection', (socket) => {
  socket.on('join_conversation', (conversationId) => {
    socket.join(`conversation:${conversationId}`);
  });

  socket.on('send_message', async (data) => {
    const message = await saveMessage(data);
    io.to(`conversation:${data.conversationId}`).emit('new_message', message);
  });
});

// Client
const socket = io('http://localhost:3006');
socket.emit('join_conversation', conversationId);
socket.on('new_message', (message) => {
  updateUI(message);
});
```

### SSE for Notifications

**Service**: Notification Service (Port 3005)

```typescript
// Server
app.get('/notifications/stream/:userId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Store connection for push updates
  activeConnections.set(userId, send);
});

// Client
const eventSource = new EventSource(`/notifications/stream/${userId}`);
eventSource.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  showNotification(notification);
};
```

## Consequences

### Positive

- **Right Tool for Job**: WebSocket bidirectional, SSE unidirectional
- **SSE Simpler**: Native browser API, auto-reconnect, no library needed
- **Socket.IO Features**: Rooms, namespaces, fallback to long-polling
- **Separate Scaling**: Scale chat and notifications independently
- **Battery Efficient**: SSE more efficient than polling

### Negative

- **Two Technologies**: More complexity than single solution
- **IE Compatibility**: No SSE support (but who uses IE?)
- **Connection Management**: Must handle disconnects, reconnects
- **Load Balancing**: Sticky sessions needed for WebSocket

## Alternatives Considered

### Alternative 1: WebSocket for Everything

- **Why rejected**: Overkill for unidirectional notifications

### Alternative 2: Long Polling

- **Why rejected**: Inefficient, high latency, server load

### Alternative 3: GraphQL Subscriptions

- **Why rejected**: Requires GraphQL infrastructure, overcomplicated

## References

- Messaging service: `services/messaging-service/src/index.ts`
- Notification service: `services/notification-service/src/routes/notifications.ts`
- Socket.IO docs: https://socket.io/
- SSE docs: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
