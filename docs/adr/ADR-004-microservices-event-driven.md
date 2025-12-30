# ADR-004: Microservices Event-Driven Architecture

**Date**: 2025-12-29
**Status**: Accepted
**Deciders**: Development Team
**Related**: docs/architecture/ARCHITECTURE.md, docs/architecture/DATA_FLOWS.md

## Context

Karmyq requires multiple services handling different concerns (authentication, communities, requests, reputation, notifications, messaging, feed, etc.). We needed to decide how these services should communicate and be organized.

### Requirements

- **Separation of concerns**: Each service owns its domain
- **Independent deployment**: Deploy services separately
- **Loose coupling**: Services shouldn't directly depend on each other
- **Async processing**: Some operations don't need immediate response
- **Reliability**: System should handle partial failures gracefully
- **Scalability**: Scale services independently based on load

## Decision

**We will use a microservices architecture with event-driven communication via Redis/Bull queues**, combined with direct REST APIs for synchronous operations.

### Architecture

**9 Backend Services**:
1. **Auth Service** (3001) - User authentication, sessions
2. **Community Service** (3002) - Community management, memberships
3. **Request Service** (3003) - Help requests, offers, matches
4. **Reputation Service** (3004) - Karma, trust scores
5. **Notification Service** (3005) - In-app, push, email notifications
6. **Messaging Service** (3006) - Real-time chat, conversations
7. **Feed Service** (3007) - Aggregated feed of activities
8. **Cleanup Service** (3008) - Ephemeral data cleanup
9. **Geocoding Service** (3009) - Location caching

### Communication Patterns

**Synchronous (REST API)**:
- Client → Service: Direct HTTP calls
- Used for: CRUD operations, queries, immediate responses

**Asynchronous (Event Queue)**:
- Service → Redis Queue → Listening Services
- Queue: `karmyq-events` (Bull/Redis)
- Used for: Notifications, karma awarding, feed updates

### Event Flow Example

```
User creates request
  ↓
Request Service:
  - Saves to database
  - Returns 201 to client
  - Publishes "request_created" event
  ↓
Redis Queue (karmyq-events)
  ↓
Notification Service:
  - Listens for "request_created"
  - Creates notifications for community members
  - Sends via SSE to connected clients
  ↓
Reputation Service:
  - Listens for "match_completed"
  - Awards karma to helper
  - Updates trust scores
```

## Consequences

### Positive Consequences

- **Independent scaling**: Scale notification service separately from requests
- **Service isolation**: One service crash doesn't bring down others
- **Technology flexibility**: Each service can use different tech if needed
- **Parallel development**: Teams can work on different services
- **Clear boundaries**: Each service has well-defined responsibilities
- **Async benefits**: Non-blocking operations improve perceived performance
- **Reliability**: Queue persistence survives service restarts

### Negative Consequences

- **Operational complexity**: 9 services to monitor, deploy, debug
- **Distributed tracing**: Harder to debug cross-service flows
- **Data consistency**: Eventual consistency instead of immediate
- **Network overhead**: More network calls between services
- **Docker dependencies**: Requires container orchestration
- **Local development**: Need to run multiple services

### Neutral Consequences

- **Service discovery**: Currently using Docker networking (localhost:300X)
- **No service mesh**: Simple architecture doesn't need Istio/Linkerd yet
- **Database sharing**: All services share PostgreSQL (different schemas)

## Alternatives Considered

### Alternative 1: Monolithic Application

- **Description**: Single Node.js application handling all features
- **Pros**:
  - Simplest to develop
  - Easiest to debug
  - Single deployment
  - No network overhead
  - Better performance
- **Cons**:
  - Tight coupling
  - Scale everything together
  - Large codebase hard to navigate
  - Technology lock-in
  - Harder to maintain long-term
- **Why rejected**: Doesn't scale with team or features

### Alternative 2: Microservices with Direct HTTP Calls

- **Description**: Services call each other directly via HTTP (no queue)
- **Pros**:
  - Simpler than events
  - Immediate consistency
  - Easier to debug
- **Cons**:
  - Tight coupling (service A depends on service B being up)
  - Cascading failures
  - Slower (blocking calls)
  - Harder to scale independently
- **Why rejected**: Too fragile, doesn't handle failures well

### Alternative 3: Message Broker (RabbitMQ/Kafka)

- **Description**: Use dedicated message broker instead of Redis queues
- **Pros**:
  - Better message guarantees
  - More features (routing, topics)
  - Battle-tested at scale
- **Cons**:
  - Additional infrastructure
  - More complex setup
  - Overkill for current scale
  - Redis already used for caching
- **Why rejected**: Redis + Bull sufficient for current needs

### Alternative 4: Serverless Functions

- **Description**: Deploy each service as AWS Lambda or similar
- **Pros**:
  - Auto-scaling
  - Pay per use
  - No server management
- **Cons**:
  - Vendor lock-in
  - Cold start latency
  - More expensive at steady load
  - Harder local development
  - WebSocket support limited
- **Why rejected**: Want to maintain deployment flexibility

## Implementation Notes

### Files Affected

All services in `services/` directory:
- `services/auth-service/`
- `services/community-service/`
- `services/request-service/`
- `services/reputation-service/`
- `services/notification-service/`
- `services/messaging-service/`
- `services/feed-service/`
- `services/cleanup-service/`
- `services/geocoding-service/`

### Shared Code

Common utilities in `packages/shared/`:
- `packages/shared/src/middleware/` - Auth, logging, error handling
- `packages/shared/src/types/` - TypeScript interfaces
- `packages/shared/src/schemas/` - Zod validation schemas
- `packages/shared/src/utils/` - Helper functions

### Event Publisher Pattern

```typescript
import { publishEvent } from '@karmyq/shared/utils/events';

// Publish event after database write
await publishEvent('request_created', {
  requestId: request.id,
  communityId: request.community_id,
  requesterId: request.requester_id,
  category: request.category
});
```

### Event Listener Pattern

```typescript
import { EventSubscriber } from '@karmyq/shared/utils/events';

const subscriber = new EventSubscriber();

subscriber.on('request_created', async (data) => {
  // Handle event
  await createNotifications(data.requestId, data.communityId);
});

subscriber.start();
```

### Service Port Allocation

- **3000**: Frontend (Next.js)
- **3001-3009**: Backend microservices
- **3010**: Social Graph Service
- **3011**: Grafana (observability)
- **3100**: Loki (logs)
- **5432**: PostgreSQL
- **6379**: Redis
- **8081**: Redis Commander
- **9090**: Prometheus

### Docker Compose

All services defined in `infrastructure/docker/docker-compose.yml`:
```yaml
services:
  auth-service:
    build: ../../services/auth-service
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis
```

## Event Types

Current events published/consumed:

- `request_created` - New help request posted
- `request_updated` - Request status changed
- `match_created` - Helper matched with requester
- `match_completed` - Help exchange completed
- `karma_awarded` - Reputation points given
- `notification_sent` - Notification delivered
- `message_sent` - Chat message sent

## Future Considerations

### Service Mesh

If we grow to 20+ services, consider service mesh:
- Istio or Linkerd for traffic management
- Automatic mTLS between services
- Advanced routing and load balancing

### API Gateway

Currently frontend calls services directly. Could add:
- Kong or Express Gateway
- Single entry point
- Rate limiting
- Authentication at gateway

### Database Per Service

Currently all services share PostgreSQL (different schemas). Could migrate to:
- Separate database per service
- Better isolation
- Independent scaling
- More operational overhead

## References

- Architecture diagram: `docs/architecture/ARCHITECTURE.md`
- Data flows: `docs/architecture/DATA_FLOWS.md`
- Docker setup: `infrastructure/docker/docker-compose.yml`
- Event utilities: `packages/shared/src/utils/events.ts`
- Microservices patterns: https://microservices.io/patterns/
