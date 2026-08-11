# Notification Service

Real-time notification system for the Karmyq platform.

## Overview

Manages user notifications with multiple delivery methods (in-app, email, push). Supports Server-Sent Events (SSE) for real-time updates and customizable user preferences.

## Port

**3005**

## API Endpoints

### GET /health
Service health check

### Notifications

- `GET /notifications` - Get user's notifications
- `GET /notifications/:id` - Get notification details
- `PUT /notifications/:id/read` - Mark as read
- `PUT /notifications/read-all` - Mark all as read
- `DELETE /notifications/:id` - Delete notification

### Real-time

- `GET /notifications/stream` - SSE stream for real-time notifications
  - Requires JWT auth
  - Browser `EventSource` clients pass `access_token` as query param
  - Stream identity is derived from token user (not URL user parameter)

### Preferences

- `GET /preferences` - Get user's notification preferences
- `PUT /preferences` - Update preferences
- `PUT /preferences/:type` - Update specific notification type

## Notification Types

- `match_created` - New match found
- `match_completed` - Help completed
- `karma_awarded` - Karma points earned
- `new_request` - New request in community
- `new_offer` - New offer in community
- `request_response` - Someone responded to request
- `community_invite` - Invited to community
- `norm_proposed` - New norm proposed
- `norm_approved` - Norm approved
- `message_received` - New chat message
- `badge_earned` - New badge earned
- `milestone_reached` - Milestone achieved

## Database Schema

### notifications.notifications
- id, user_id, type, title, message
- data (JSONB), read, created_at

### notifications.preferences
- user_id, notification_type
- in_app_enabled, email_enabled, push_enabled
- updated_at

### notifications.global_preferences
- user_id, all_in_app, all_email, all_push
- updated_at

## Features

- **Server-Sent Events**: Real-time push to clients
- **User Preferences**: Granular control per notification type
- **Template System**: Consistent messaging
- **Event-Driven**: Listens to Redis queue

## Events

### Listens To

- All event types from other services

### Publishes

- None (notification delivery only)

## Environment Variables

```env
PORT=3005
DATABASE_URL=postgresql://karmyq_user:karmyq_password_dev@localhost:5432/karmyq_db
REDIS_URL=redis://localhost:6379
```

## Related Services

- All services - Consumes events from all services
- Frontend - Delivers notifications via SSE

## License

AGPL-3.0-or-later - See [LICENSE](../../LICENSE) for details.
