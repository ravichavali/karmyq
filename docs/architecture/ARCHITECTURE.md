# Karmyq Architecture

**Version**: 6.0.0
**Last Updated**: 2025-12-05
**Status**: Production

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Microservices](#microservices)
4. [Multi-Tenancy](#multi-tenancy)
5. [Event-Driven Communication](#event-driven-communication)
6. [Database Schema](#database-schema)
7. [Authentication & Authorization](#authentication--authorization)
8. [API Patterns](#api-patterns)
9. [Monorepo Structure](#monorepo-structure)
10. [Technology Stack](#technology-stack)
11. [Infrastructure](#infrastructure)
12. [Observability](#observability)

---

## Overview

Karmyq is a **multi-tenant SaaS mutual aid platform** where community members help each other through a karma-based reputation system.

### Key Characteristics

- **Microservices Architecture** - 8 independent backend services
- **Multi-Tenant SaaS** - Row-Level Security (RLS) for data isolation
- **Event-Driven** - Asynchronous communication via Redis/Bull queues
- **Ephemeral Data** - Configurable TTL for requests and reputation decay
- **Monorepo** - Turborepo for unified development experience

### Design Principles

1. **Service Independence** - Each service can be developed, tested, and deployed independently
2. **Data Isolation** - Community data strictly isolated at database level (RLS)
3. **Loose Coupling** - Services communicate via REST APIs and events
4. **Eventual Consistency** - Accept temporary inconsistency for better scalability
5. **Fail Gracefully** - Services degrade gracefully when dependencies unavailable

---

## System Architecture

### High-Level View

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
│                                                              │
│  ┌──────────────┐              ┌──────────────┐            │
│  │   Web App    │              │  Mobile App  │            │
│  │  (Next.js)   │              │ (React Native)│            │
│  │   Port 3000  │              │   (Expo)     │            │
│  └──────────────┘              └──────────────┘            │
└───────────────────┬──────────────────┬──────────────────────┘
                    │                  │
                    │  REST APIs       │
                    ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend Services                          │
│                                                              │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐     │
│  │  Auth   │  │Community │  │ Request │  │Reputation│     │
│  │  :3001  │  │  :3002   │  │ :3003   │  │  :3004   │     │
│  └─────────┘  └──────────┘  └─────────┘  └──────────┘     │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐    │
│  │Notifica- │  │Messaging │  │  Feed   │  │ Cleanup  │    │
│  │ tion     │  │  :3006   │  │ :3007   │  │  :3008   │    │
│  │  :3005   │  └──────────┘  └─────────┘  └──────────┘    │
│  └──────────┘                                               │
└───────────────┬──────────────────┬──────────────────────────┘
                │                  │
     ┌──────────▼──────────┐      │
     │  Event Queue        │◄─────┘
     │  (Redis + Bull)     │
     │  karmyq-events      │
     └─────────────────────┘
                │
     ┌──────────▼──────────┐
     │   PostgreSQL 15     │
     │   (7 schemas)       │
     │   Row-Level Security│
     └─────────────────────┘
```

### Service Communication Patterns

#### Synchronous (REST)
- **Frontend → Services**: API calls with JWT authentication
- **Service → Service**: Rare, only when immediate response needed
- Example: Frontend calls Auth service for login

#### Asynchronous (Events)
- **Service → Event Queue**: Publish events to Redis/Bull
- **Event Queue → Services**: Subscribers consume events
- Example: Request service publishes `match_completed` event, Reputation service consumes it

---

## Microservices

### Service Catalog

| Service | Port | Purpose | Database Schema | Status |
|---------|------|---------|----------------|--------|
| **auth-service** | 3001 | User authentication, JWT tokens | `auth` | ✅ Production |
| **community-service** | 3002 | Community management, memberships | `community` | ✅ Production |
| **request-service** | 3003 | Help requests, offers, matching | `requests` | ✅ Production |
| **reputation-service** | 3004 | Karma tracking, trust scores | `reputation` | ✅ Production |
| **notification-service** | 3005 | Real-time notifications (SSE) | `notifications` | ✅ Production |
| **messaging-service** | 3006 | Direct messaging, conversations | `messaging` | ✅ Production |
| **feed-service** | 3007 | Personalized activity feed | - (reads all) | ✅ Production |
| **cleanup-service** | 3008 | Data expiration, reputation decay | - (writes all) | ✅ Production |

### Service Responsibilities

#### Auth Service (3001)
- User registration with email/password
- Login and JWT token generation
- Token verification (used by all services)
- User profile management
- **No dependencies** on other services

#### Community Service (3002)
- Create/update/delete communities
- Public vs private communities
- Membership management (roles: admin, moderator, member)
- Join requests for private communities
- Community norms/guidelines
- **Dependencies**: Auth (for user info)

#### Request Service (3003)
- Create help requests (with urgency, category)
- Create offers to help
- Match requests with offers
- Mark matches as completed
- **Publishes**: `match_completed`, `request_created`
- **Dependencies**: Community (for community validation)

#### Reputation Service (3004)
- Track karma points (helping, receiving help)
- Calculate trust scores (0-100)
- Award badges and bonuses
- **Consumes**: `match_completed` (to award karma)
- **Publishes**: `karma_awarded`

#### Notification Service (3005)
- Store notifications in database
- Real-time delivery via Server-Sent Events (SSE)
- User notification preferences
- Mark read/unread
- **Consumes**: All events (creates notifications)
- **No authentication on SSE** (userId in URL)

#### Messaging Service (3006)
- Direct conversations between users
- Message threading
- Read receipts
- **Dependencies**: Auth, Community

#### Feed Service (3007)
- Aggregate activity across all schemas
- Personalized feed per user
- Read-only, cross-schema queries
- **No database writes**

#### Cleanup Service (3008)
- Expire old requests (configurable TTL)
- Reputation decay (6-month half-life)
- Delete old notifications
- Archive completed requests
- **Runs scheduled jobs** (cron)
- **Writes to all schemas**

---

## Multi-Tenancy

### Design

Karmyq uses **database-level multi-tenancy** with PostgreSQL Row-Level Security (RLS).

### Key Concept: community_id

Every data table has a `community_id` column:
```sql
CREATE TABLE requests.help_requests (
    id UUID PRIMARY KEY,
    community_id UUID NOT NULL REFERENCES community.communities(id),
    requester_id UUID NOT NULL,
    title TEXT NOT NULL,
    -- ... other fields
);
```

### Row-Level Security (RLS)

RLS policies enforce data isolation at the database level:

```sql
-- Enable RLS on table
ALTER TABLE requests.help_requests ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY community_isolation
ON requests.help_requests
USING (community_id = current_setting('app.current_community_id')::uuid);
```

### Middleware Chain

Every authenticated request goes through:

```typescript
app.use(authMiddleware);           // 1. Verify JWT, extract userId
app.use(tenantMiddleware);          // 2. Extract community_id from JWT
app.use(dbContextMiddleware(pool)); // 3. Set session variable
```

The `dbContextMiddleware` sets the session variable:
```typescript
await pool.query('SET LOCAL app.current_community_id = $1', [communityId]);
```

Now all queries automatically filter by this community!

### Multi-Community Users

Users can belong to multiple communities. The JWT contains:
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "communityMemberships": [
    { "communityId": "uuid1", "role": "admin" },
    { "communityId": "uuid2", "role": "member" }
  ]
}
```

The frontend sends `X-Community-Context` header to specify which community:
```
X-Community-Context: uuid1
```

### Special Services

#### Feed Service & Cleanup Service
These services operate across all communities:
- **Feed Service**: Read-only, no RLS needed
- **Cleanup Service**: Writes with RLS disabled (after authorization)

```typescript
// Cleanup service disables RLS for admin operations
await query('BEGIN');
await query('SET LOCAL row_security = off');
// ... admin queries
await query('COMMIT');
```

See [TR-002: Multi-Tenancy](../requirements/technical/TR-002-multi-tenancy.md) for details.

---

## Event-Driven Communication

### Event Queue

- **Technology**: Bull (Node.js job queue)
- **Backend**: Redis
- **Queue Name**: `karmyq-events`

### Event Flow

```
┌──────────────┐         ┌─────────────┐        ┌──────────────┐
│  Publisher   │────────>│ Redis Queue │───────>│  Subscriber  │
│  (Service)   │ publish │  (Bull)     │ consume│  (Service)   │
└──────────────┘         └─────────────┘        └──────────────┘
```

### Core Events

#### 1. match_completed
**Published by**: request-service
**Consumed by**: reputation-service, notification-service

```typescript
{
  type: 'match_completed',
  payload: {
    match_id: 'uuid',
    request_id: 'uuid',
    requester_id: 'uuid',
    responder_id: 'uuid',
    community_id: 'uuid'
  }
}
```

#### 2. karma_awarded
**Published by**: reputation-service
**Consumed by**: notification-service

```typescript
{
  type: 'karma_awarded',
  payload: {
    user_id: 'uuid',
    community_id: 'uuid',
    points: 25,
    reason: 'helped_with_request',
    details: { ... }
  }
}
```

#### 3. request_created
**Published by**: request-service
**Consumed by**: notification-service, feed-service

```typescript
{
  type: 'request_created',
  payload: {
    request_id: 'uuid',
    requester_id: 'uuid',
    community_id: 'uuid',
    title: 'Need help with...'
  }
}
```

#### 4. user_joined_community
**Published by**: community-service
**Consumed by**: notification-service

```typescript
{
  type: 'user_joined_community',
  payload: {
    user_id: 'uuid',
    community_id: 'uuid',
    role: 'member'
  }
}
```

### Publishing Events

```typescript
// services/request-service/src/events/publisher.ts
import { publishEvent } from '@shared/events';

await publishEvent('match_completed', {
  match_id,
  request_id,
  requester_id,
  responder_id,
  community_id
});
```

### Consuming Events

```typescript
// services/reputation-service/src/events/subscriber.ts
import { eventQueue } from '@shared/events';

eventQueue.process('match_completed', async (job) => {
  const { payload } = job.data;
  await awardKarma(payload);
});
```

See [TR-003: Event-Driven Architecture](../requirements/technical/TR-003-events.md) for details.

---

## Database Schema

### PostgreSQL Schemas (7)

#### 1. auth
```sql
-- Users
auth.users (id, name, email, password_hash, bio, skills, ...)
```

#### 2. community
```sql
-- Communities and membership
community.communities (id, name, description, type, created_by, ...)
community.memberships (id, user_id, community_id, role, joined_at, ...)
community.join_requests (id, user_id, community_id, status, message, ...)
community.norms (id, community_id, title, description, category, ...)
```

#### 3. requests
```sql
-- Help requests, offers, matches
requests.help_requests (id, requester_id, title, description, status, urgency, ...)
requests.request_communities (request_id, community_id) -- junction table
requests.offers (id, request_id, responder_id, message, status, ...)
requests.matches (id, request_id, requester_id, responder_id, status, ...)
```

#### 4. reputation
```sql
-- Karma and trust
reputation.karma_records (id, user_id, community_id, points, reason, ...)
reputation.trust_scores (id, user_id, community_id, score, ...)
reputation.badges (id, user_id, community_id, badge_type, awarded_at, ...)
```

#### 5. notifications
```sql
-- Notifications and preferences
notifications.notifications (id, user_id, type, title, message, read, ...)
notifications.preferences (id, user_id, channel, type, enabled, ...)
notifications.global_preferences (id, user_id, email_digest, ...)
```

#### 6. messaging
```sql
-- Conversations and messages
messaging.conversations (id, created_at, ...)
messaging.participants (conversation_id, user_id, joined_at, ...)
messaging.messages (id, conversation_id, sender_id, content, ...)
```

#### 7. feed
```sql
-- Activity feed
feed.activities (id, user_id, community_id, type, data, created_at, ...)
```

### Database Conventions

1. **Primary Keys**: UUIDs (`uuid_generate_v4()`)
2. **Timestamps**: `created_at`, `updated_at` (auto-managed)
3. **Foreign Keys**: `requester_id`, `responder_id` (not `user_id`, `helper_id`)
4. **Schema Prefixes**: Always use `requests.help_requests`, not just `help_requests`
5. **RLS on All Tables**: Except feed service read-only tables

### Indexes

Strategic indexes on:
- Foreign keys (`user_id`, `community_id`)
- Status fields (`status`)
- Timestamps (`created_at` for sorting)
- Lookup fields (`email` for login)

See [architecture/DATA_MODEL.md](DATA_MODEL.md) for complete schema documentation.

---

## Authentication & Authorization

### JWT Structure

```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "communityMemberships": [
    { "communityId": "uuid", "role": "admin" }
  ],
  "iat": 1234567890,
  "exp": 1234567890
}
```

### Middleware Chain

```typescript
// 1. Authenticate - Verify JWT
export const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const decoded = jwt.verify(token, JWT_SECRET);
  req.user = decoded;
  next();
};

// 2. Extract Community Context
export const tenantMiddleware = (req, res, next) => {
  const communityId = req.headers['x-community-context'];
  const membership = req.user.communityMemberships.find(
    m => m.communityId === communityId
  );
  req.communityId = communityId;
  req.role = membership?.role;
  next();
};

// 3. Set Database Context
export const dbContextMiddleware = (pool) => async (req, res, next) => {
  if (req.communityId) {
    await pool.query(
      'SET LOCAL app.current_community_id = $1',
      [req.communityId]
    );
  }
  next();
};

// 4. Require Role
export const requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};
```

### Usage in Services

```typescript
// Public endpoint (no auth)
app.post('/register', registerHandler);

// Authenticated endpoint
app.get('/profile',
  authMiddleware,
  getProfileHandler
);

// Community-scoped endpoint
app.get('/requests',
  authMiddleware,
  tenantMiddleware,
  dbContextMiddleware(pool),
  getRequestsHandler
);

// Admin-only endpoint
app.post('/community/settings',
  authMiddleware,
  tenantMiddleware,
  dbContextMiddleware(pool),
  requireRole(['admin']),
  updateSettingsHandler
);
```

See [FR-001: Authentication](../requirements/functional/FR-001-authentication.md) for details.

---

## API Patterns

### Standard Response Format

```json
{
  "success": true,
  "data": { ... } | [ ... ],
  "message": "Optional success message"
}
```

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": { ... }
  }
}
```

### Pagination

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (no/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

### Health Check Endpoints

Every service exposes:
```
GET /health
Response: { "status": "healthy", "service": "auth-service" }
```

---

## Monorepo Structure

### Directory Layout

```
karmyq/
├── apps/
│   ├── frontend/          # Next.js web app (Port 3000)
│   └── mobile/            # React Native + Expo
├── services/
│   ├── _template/         # Service template
│   ├── auth-service/      # Port 3001
│   ├── community-service/ # Port 3002
│   ├── request-service/   # Port 3003
│   ├── reputation-service/# Port 3004
│   ├── notification-service/ # Port 3005
│   ├── messaging-service/ # Port 3006
│   ├── feed-service/      # Port 3007
│   └── cleanup-service/   # Port 3008
├── packages/
│   └── shared/            # Shared middleware, types, utils
├── infrastructure/
│   ├── docker/            # Docker Compose files
│   ├── postgres/          # Database init scripts
│   └── observability/     # Grafana, Loki, Prometheus configs
├── tests/                 # Integration and E2E tests
├── docs/                  # Documentation
└── scripts/               # Automation scripts
```

### Turborepo

The monorepo uses Turborepo for:
- **Parallel builds** - Build multiple services simultaneously
- **Dependency tracking** - Only rebuild what changed
- **Caching** - Speed up builds with intelligent caching

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "dev": {
      "cache": false
    }
  }
}
```

### Shared Packages

#### packages/shared/
- **middleware/** - Auth, tenant, rate limiting, validation
- **types/** - TypeScript interfaces
- **utils/** - Logger, helpers
- **api/** - API client for frontend
- **constants/** - Shared constants

Services import shared code:
```typescript
import { authMiddleware, tenantMiddleware } from '@shared/middleware';
import { logger } from '@shared/utils';
```

---

## Technology Stack

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL 15
- **Cache/Queue**: Redis 7 + Bull
- **Event Queue**: Bull (Redis-backed)

### Frontend
- **Framework**: Next.js 14
- **UI**: React 18
- **Styling**: Tailwind CSS
- **State**: React Context + Hooks
- **API Client**: Fetch API with shared client

### Mobile
- **Framework**: React Native
- **Platform**: Expo SDK 52
- **Navigation**: Expo Router
- **Storage**: Async Storage

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Orchestration**: Docker Compose (dev), Kubernetes (future)
- **Reverse Proxy**: Nginx (production)

### Observability
- **Logging**: Winston → Loki
- **Dashboards**: Grafana
- **Metrics**: Prometheus (planned)
- **Tracing**: OpenTelemetry (planned)

### Testing
- **Unit Tests**: Jest
- **Integration Tests**: Jest + Supertest
- **E2E Tests**: Playwright
- **Load Tests**: K6

### CI/CD
- **Platform**: GitHub Actions
- **Workflows**: Lint, test, build, deploy

---

## Infrastructure

### Docker Compose

#### Development Stack (docker-compose.yml)
```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: karmyq_db
      POSTGRES_USER: karmyq_user
      POSTGRES_PASSWORD: dev_password
    ports:
      - "5432:5432"
    volumes:
      - ./infrastructure/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # All 8 services
  auth-service:
    build: ./services/auth-service
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://...
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}

  # ... (7 more services)

  frontend:
    build: ./apps/frontend
    ports:
      - "3000:3000"
```

#### Observability Stack (docker-compose.observability.yml)
```yaml
services:
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"

  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log:/var/log

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3007:3000"
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
```

### Environment Variables

Each service requires:
```bash
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/karmyq_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-here
JWT_EXPIRATION=7d

# Logging
LOG_LEVEL=info
```

See [ENVIRONMENT_VARIABLES.md](../ENVIRONMENT_VARIABLES.md) for complete reference.

---

## Observability

### Structured Logging

All services use Winston for structured logging:

```typescript
import { logger } from '@shared/utils/logger';

logger.info('Request received', {
  method: req.method,
  path: req.path,
  userId: req.user?.userId,
  communityId: req.communityId
});

logger.error('Database error', {
  error: err.message,
  stack: err.stack,
  query: 'SELECT ...'
});
```

### Log Levels
- **debug**: Detailed troubleshooting info
- **info**: General operational events
- **warn**: Warning messages
- **error**: Error messages with stack traces

### Grafana Dashboards

Access at: http://localhost:3007

**Dashboards**:
- Service logs (query by service, level, user, community)
- Error rates
- Request latency (planned)
- Queue metrics (planned)

### Monitoring (Planned)

- **Prometheus**: Metrics collection
- **Alerting**: Grafana alerts for errors, high latency
- **Tracing**: OpenTelemetry for distributed tracing

See [operations/logging-and-monitoring.md](../operations/logging-and-monitoring.md) for details.

---

## Design Decisions

### Why Microservices?

**Pros**:
- Independent development and deployment
- Technology flexibility per service
- Scalability (scale what needs scaling)
- Clear boundaries and ownership

**Cons** (accepted trade-offs):
- Complexity in orchestration
- Distributed debugging harder
- Eventual consistency challenges

### Why Row-Level Security?

**Pros**:
- Database-level enforcement (cannot be bypassed)
- No application-level filtering needed
- Automatic isolation
- Audit trail

**Cons** (accepted trade-offs):
- Complex queries harder to debug
- Stats queries may need RLS disabled
- Testing requires proper setup

### Why Events over REST?

**Pros**:
- Loose coupling between services
- Asynchronous processing
- Retry on failure
- Multiple subscribers per event
- Foundation for event sourcing

**Cons** (accepted trade-offs):
- Eventual consistency
- Monitoring distributed events
- Event versioning strategy needed

### Why Server-Sent Events (SSE) over WebSocket?

**Pros**:
- Simpler (unidirectional)
- Auto-reconnect built-in
- HTTP/2 multiplexing
- Firewall-friendly

**Cons** (accepted trade-offs):
- No client → server messaging (use REST)
- Browser connection limits (6 per domain)

---

## Scaling Considerations

### Current Limitations (Single-Server)

- PostgreSQL on single instance
- Redis on single instance
- No horizontal scaling of services
- No load balancing

### Future Scaling Strategy

#### Database
- **Read Replicas**: For feed service, read-heavy queries
- **Connection Pooling**: PgBouncer for connection management
- **Partitioning**: Partition large tables by community_id

#### Services
- **Horizontal Scaling**: Run multiple instances behind load balancer
- **Sticky Sessions**: For SSE connections (or use Redis pub/sub)
- **Service Mesh**: Istio/Linkerd for advanced routing

#### Queue
- **Redis Cluster**: For high availability
- **Multiple Workers**: Scale Bull workers independently

#### Caching
- **Application Cache**: Redis for user/community lookups
- **CDN**: CloudFront/Cloudflare for frontend assets

---

## Security

### Current Security Measures

- ✅ JWT authentication on all services
- ✅ Password hashing (bcrypt, 10 rounds)
- ✅ SQL injection prevention (parameterized queries)
- ✅ Row-Level Security (RLS)
- ✅ Rate limiting (all endpoints)
- ✅ CORS configuration
- ✅ Environment variables for secrets

### Security Gaps (Planned)

- ⚠️ No refresh tokens (JWT expires but no rotation)
- ⚠️ No email verification flow
- ⚠️ No password reset flow
- ⚠️ No 2FA/MFA support
- ⚠️ SSE endpoint has no authentication (userId in URL only)

---

## Performance

### Current Optimizations

- ✅ Database connection pooling (max 20 connections per service)
- ✅ Redis caching for event queue
- ✅ Indexes on all foreign keys and lookup fields
- ✅ Efficient RLS policies

### Performance Considerations

- **Password Hashing**: bcrypt is CPU-intensive (consider worker threads)
- **RLS Overhead**: Adds ~5-10ms per query (acceptable for security)
- **No Application Caching**: All queries hit database (consider Redis cache)

---

## Related Documentation

- **Requirements**:
  - [FR-001: Authentication](../requirements/functional/FR-001-authentication.md)
  - [FR-002: Communities](../requirements/functional/FR-002-communities.md)
  - [TR-001: Microservices](../requirements/technical/TR-001-microservices.md)
  - [TR-002: Multi-Tenancy](../requirements/technical/TR-002-multi-tenancy.md)
  - [TR-003: Event-Driven Architecture](../requirements/technical/TR-003-events.md)
  - [TR-004: Row-Level Security](../requirements/technical/TR-004-rls.md)
  - [TR-005: Real-Time Features (SSE)](../requirements/technical/TR-005-realtime.md)

- **Guides**:
  - [Multi-Tenant Guide](../MULTI_TENANT_GUIDE.md)
  - [Ephemeral Data Guide](../guides/EPHEMERAL_DATA_GUIDE.md)
  - [Development Workflow](../development/workflow.md)
  - [Creating a Service](../development/creating-a-service.md)

- **Operations**:
  - [Logging & Monitoring](../operations/logging-and-monitoring.md)
  - [Deployment](../operations/ci-cd.md)

---

**Version**: 6.0.0
**Last Updated**: 2025-12-05
**Maintained by**: Karmyq Development Team
