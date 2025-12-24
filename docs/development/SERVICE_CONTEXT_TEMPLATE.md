# [Service Name] - CONTEXT.md Template

> **Last Updated:** YYYY-MM-DD
> **Version:** vX.Y.Z
> **Port:** XXXX
> **Status:** Production / Beta / Experimental

## Quick Start

```bash
# Start this service
docker-compose up [service-name]

# Test this service
npm run test:integration -- [service-name]

# View logs
docker logs karmyq-[service-name] -f
```

## 1. Overview

**Purpose:** [One sentence describing what this service does]

**Responsibilities:**
- Primary responsibility 1
- Primary responsibility 2
- Primary responsibility 3

**NOT Responsible For:**
- Thing this service explicitly does NOT do

## 2. Architecture

### 2.1 Technology Stack
- **Runtime:** Node.js XX / Python X.X
- **Framework:** Express / Fastify / Django
- **Database Schema:** `schema_name`
- **Event Queues:** `queue-name-1`, `queue-name-2`
- **External Services:** Service A, Service B

### 2.2 Key Components
```
src/
├── routes/          # API endpoints
├── services/        # Business logic
├── events/          # Event publishers/consumers
├── middleware/      # Request processing
└── database/        # Database queries
```

### 2.3 Database Schema
**Primary Tables:**
- `schema.table_name` - Description
- `schema.another_table` - Description

**Key Constraints:**
- RLS Policy: `community_isolation`
- Foreign Keys: List key relationships
- Indexes: List important indexes

## 3. API Reference

### 3.1 Endpoints

#### POST /api/resource
**Purpose:** Create a new resource

**Request:**
```json
{
  "field1": "value",
  "field2": 123
}
```

**Response:**
```json
{
  "success": true,
  "data": { "id": "uuid", ... }
}
```

**Auth:** Required (Bearer token)
**Permissions:** `member` role minimum

#### GET /api/resource/:id
...

## 4. Events

### 4.1 Published Events
| Event Name | Queue | Payload | When |
|------------|-------|---------|------|
| `resource.created` | `resource-lifecycle` | `{ id, user_id }` | After successful creation |

### 4.2 Consumed Events
| Event Name | Action | Side Effects |
|------------|--------|--------------|
| `user.verified` | Update resource permissions | Unlock premium features |

## 5. Key Patterns

### 5.1 Authentication Flow
```typescript
// Standard auth pattern
router.post('/resource',
  authenticateToken,
  extractCommunityContext,
  requireRole('member'),
  async (req, res) => { ... }
);
```

### 5.2 Database Query Pattern
```typescript
// RLS-aware query
const result = await db.query(
  'SELECT * FROM schema.table WHERE community_id = $1',
  [req.community.id]
);
```

### 5.3 Event Publishing Pattern
```typescript
// Publish event after operation
await eventPublisher.publish('resource.created', {
  id: resource.id,
  user_id: req.user.id
});
```

## 6. Dependencies

### 6.1 Upstream Services (This service calls)
- **Auth Service:** For user verification
- **Community Service:** For community validation

### 6.2 Downstream Services (This service is called by)
- **Gateway:** All client requests
- **Feed Service:** For aggregation

### 6.3 Shared Libraries
- `@karmyq/shared/middleware` - Auth middleware
- `@karmyq/shared/schemas` - Zod validation schemas
- `@karmyq/shared/events` - Event infrastructure

## 7. Testing

### 7.1 Unit Tests
```bash
cd services/[service-name]
npm test
```

### 7.2 Integration Tests
```bash
cd tests
npm run test:integration -- integration/[service-name].test.ts
```

### 7.3 Test Fixtures
- Test personas: `tests/fixtures/quick-seed.sql`
- Mock data: `tests/fixtures/[service-name]-mocks.ts`

### 7.4 Key Test Scenarios
- [ ] Create resource successfully
- [ ] Reject invalid input
- [ ] Enforce RLS isolation
- [ ] Emit events correctly

## 8. Configuration

### 8.1 Environment Variables
```bash
SERVICE_PORT=XXXX
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
```

### 8.2 Feature Flags
- `ENABLE_FEATURE_X` - Default: false
- `MAX_ITEMS_PER_PAGE` - Default: 50

## 9. Monitoring & Observability

### 9.1 Key Metrics
- Request rate: `/metrics/requests`
- Error rate: `/metrics/errors`
- Database queries: `/metrics/db`

### 9.2 Logging
- Structured JSON logs via `shared/utils/logger`
- Log levels: DEBUG, INFO, WARN, ERROR

### 9.3 Health Checks
```bash
curl http://localhost:XXXX/health
```

## 10. Common Issues & Troubleshooting

### Issue: Service not responding
**Solution:** Check database connection, verify Redis is running

### Issue: RLS policy blocking queries
**Solution:** Ensure `SET LOCAL app.current_community_id` is set

## 11. Future Enhancements
- [ ] Planned feature 1
- [ ] Planned feature 2
- [ ] Technical debt item 1

## 12. Related Documentation
- [Architecture Overview](../../docs/architecture/ARCHITECTURE.md)
- [Testing Guide](../../docs/testing/LOCAL_TESTING.md)
- [API Gateway Design](../../docs/gemini-architecture-review/gateway_design.md)
