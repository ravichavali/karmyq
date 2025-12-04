# TR-001: Microservices Architecture

**Status:** ✅ Implemented | **Priority:** High | **Version:** 5.1.0

## Overview

Karmyq uses a microservices architecture with 8 independent services communicating via REST APIs and Redis event queues.

## Services

### 1. Auth Service (Port 3001)
- **Responsibility:** User authentication and JWT management
- **Schema:** `auth`
- **Dependencies:** PostgreSQL, Redis
- **Endpoints:** `/auth/register`, `/auth/login`, `/auth/profile`

### 2. Community Service (Port 3002)
- **Responsibility:** Community and member management
- **Schema:** `community`
- **Dependencies:** PostgreSQL, Redis
- **Publishes Events:** `user_joined_community`, `join_request_created`

### 3. Request Service (Port 3003)
- **Responsibility:** Help requests and matching
- **Schema:** `requests`
- **Dependencies:** PostgreSQL, Redis
- **Publishes Events:** `request_created`, `match_completed`

### 4. Reputation Service (Port 3004)
- **Responsibility:** Karma and trust scores
- **Schema:** `reputation`
- **Dependencies:** PostgreSQL, Redis
- **Subscribes:** `match_completed`
- **Publishes:** `karma_awarded`

### 5. Notification Service (Port 3005)
- **Responsibility:** Notifications and SSE
- **Schema:** `notifications`
- **Dependencies:** PostgreSQL, Redis
- **Subscribes:** All events
- **Realtime:** SSE connections

### 6. Messaging Service (Port 3006)
- **Responsibility:** Direct messages
- **Schema:** `messaging`
- **Dependencies:** PostgreSQL, Redis

### 7. Feed Service (Port 3007)
- **Responsibility:** Activity aggregation
- **Schemas:** Reads all (read-only)
- **Dependencies:** PostgreSQL

### 8. Cleanup Service (Port 3008)
- **Responsibility:** Data expiration and karma decay
- **Schemas:** Writes all
- **Dependencies:** PostgreSQL, node-cron
- **Schedule:** Daily at 2 AM UTC

## Communication Patterns

### REST APIs
- Synchronous request/response
- JWT authentication on all endpoints
- JSON payloads
- Standard HTTP status codes

### Event Queue (Redis + Bull)
- Asynchronous event processing
- Queue name: `karmyq-events`
- Publish/Subscribe pattern
- Event types: job names
- Retry logic: 3 attempts

## Shared Components

### Packages (packages/shared/)
- **middleware/** - Auth, tenant context, rate limiting, RLS
- **utils/** - Logger, validation
- **types/** - Shared TypeScript types

### Database
- Single PostgreSQL instance
- Multiple schemas for isolation
- Shared connection pool configuration
- Row-Level Security (RLS)

## Deployment

### Docker Compose
All services in `infrastructure/docker/docker-compose.yml`:
```yaml
services:
  auth-service:
    ports: ["3001:3001"]
  community-service:
    ports: ["3002:3002"]
  # ... etc
```

### Horizontal Scaling
- Stateless services (except SSE connections)
- Load balancer distributes requests
- Shared PostgreSQL and Redis

## Benefits
✅ Independent deployment
✅ Technology flexibility
✅ Team autonomy
✅ Fault isolation
✅ Scalability

## Challenges
❌ Distributed tracing needed
❌ Service discovery for production
❌ API gateway for single entry point
❌ Monitoring complexity

## Related
- [TR-003: Event-Driven Architecture](TR-003-events.md)
- [TR-002: Multi-Tenancy](TR-002-multi-tenancy.md)
