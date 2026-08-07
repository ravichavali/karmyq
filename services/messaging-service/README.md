# Messaging Service

Real-time chat messaging system for the Karmyq platform.

## Overview

Provides real-time chat functionality using Socket.IO. Enables users to communicate when matched for help exchanges. Supports conversation management, typing indicators, and message history.

## Port

**3006**

## API Endpoints

### GET /health
Service health check

### Conversations

- `GET /conversations` - Get user's conversations
- `GET /conversations/:id` - Get conversation details
- `POST /conversations` - Create new conversation
- `GET /conversations/:id/messages` - Get conversation messages

### Messages

- `POST /conversations/:id/messages` - Send message
- `GET /messages/:id` - Get message details
- `PUT /messages/:id/read` - Mark message as read

## Socket.IO Events

### Client → Server

- `join_conversation` - Join a conversation room
- `leave_conversation` - Leave a conversation room
- `send_message` - Send a new message
- `typing` - User is typing
- `stop_typing` - User stopped typing

### Server → Client

- `new_message` - New message received
- `message_sent` - Message delivery confirmation
- `user_typing` - Another user is typing
- `user_stopped_typing` - User stopped typing
- `conversation_updated` - Conversation metadata changed

## Database Schema

### messaging.conversations
- id, match_id, created_at, updated_at
- last_message_at, last_message_id

### messaging.participants
- id, conversation_id, user_id
- joined_at, last_read_at

### messaging.messages
- id, conversation_id, sender_id
- content, status (sent/delivered/read)
- created_at, updated_at

## Features

- **Real-time Chat**: Socket.IO for instant messaging
- **Typing Indicators**: Shows when users are typing
- **Read Receipts**: Track message read status
- **Message History**: Persistent chat storage
- **Unread Counts**: Track unread messages per conversation

## Environment Variables

```env
PORT=3006
DATABASE_URL=postgresql://karmyq_user:karmyq_password_dev@localhost:5432/karmyq_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret
CORS_ORIGIN=http://localhost:3000
```

## Related Services

- Auth Service - Validates user tokens
- Matching Service - Creates conversations on match
- Notification Service - Sends message notifications

## WebSocket Authentication

Messages must include JWT token:

```javascript
const socket = io('http://localhost:3006', {
  auth: {
    token: 'your_jwt_token'
  }
});
```

## License

AGPL-3.0-or-later - See [LICENSE](../../LICENSE) for details.
