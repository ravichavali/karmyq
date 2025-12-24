# Request Service - Complete Context Documentation

> **Last Updated:** 2024-12-24
> **Version:** v8.0.0
> **Port:** 3003
> **Status:** Production (Ready for v9.0 polymorphic transformation)

## Quick Start

```bash
# Start this service
docker-compose up request-service

# Start in development mode
cd services/request-service && npm run dev

# Test this service
npm run test:integration -- integration/request-service.test.ts

# View logs
docker logs karmyq-request-service -f

# Health check
curl http://localhost:3003/health
```

---

## 1. Overview

### 1.1 Purpose
The Request Service manages help requests, help offers, and matches between requesters and helpers within communities. It implements skill-based matching to intelligently suggest relevant requests to users based on their abilities.

### 1.2 Responsibilities
- **Help Request Management** - CRUD operations for help requests
- **Help Offer Management** - CRUD operations for help offers
- **Matching Engine** - Match requesters with helpers (skill-based algorithm)
- **Privacy Controls** - Social Karma v2.0 privacy and consent management
- **Interaction Feedback** - Collect exchange quality ratings (not person ratings)
- **Event Publishing** - Emit domain events for request lifecycle

### 1.3 NOT Responsible For
- **Karma Calculation** - Handled by Reputation Service
- **User Authentication** - Handled by Auth Service
- **Messaging** - Handled by Messaging Service
- **Community Management** - Handled by Community Service

---

## 2. Architecture

### 2.1 Technology Stack
- **Runtime:** Node.js 18
- **Framework:** Express.js
- **Database Schema:** `requests`
- **Event Queues:** `karmyq-events` (Bull/Redis)
- **External Services:** PostgreSQL, Redis

### 2.2 Key Components
```
src/
├── index.ts              # Express app initialization, route registration
├── routes/
│   ├── requests.ts       # Help request CRUD + skill matching
│   ├── offers.ts         # Help offer CRUD
│   ├── matches.ts        # Match creation and status updates
│   └── feedback.ts       # Interaction feedback (Social Karma v2.0)
├── services/
│   └── matcher.ts        # Skill-based matching algorithms
├── database/
│   └── db.ts             # PostgreSQL connection pool
└── events/
    └── publisher.ts      # Redis event publishing (Bull)
```

### 2.3 Database Schema

#### Tables Owned by This Service

**requests.help_requests** - Core help request table
```sql
CREATE TABLE requests.help_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id),
    requester_id UUID NOT NULL REFERENCES auth.users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,           -- transportation, moving, childcare, etc.
    urgency VARCHAR(50) DEFAULT 'medium',     -- low, medium, high
    preferred_start_date TIMESTAMP,
    preferred_end_date TIMESTAMP,
    status VARCHAR(50) DEFAULT 'open',        -- open, matched, completed, cancelled

    -- Social Karma v2.0 Privacy
    is_public BOOLEAN DEFAULT false,
    requester_visibility_consent BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_help_requests_community_id ON requests.help_requests(community_id);
CREATE INDEX idx_help_requests_status ON requests.help_requests(status);
CREATE INDEX idx_help_requests_category ON requests.help_requests(category);
```

**requests.help_offers** - Help offers from community members
```sql
CREATE TABLE requests.help_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id),
    offerer_id UUID NOT NULL REFERENCES auth.users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    availability_start TIMESTAMP,
    availability_end TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active',      -- active, matched, expired

    -- Social Karma v2.0 Privacy
    is_public BOOLEAN DEFAULT false,
    offerer_visibility_consent BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_help_offers_community_id ON requests.help_offers(community_id);
```

**requests.matches** - Connections between requests and responders
```sql
CREATE TABLE requests.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES requests.help_requests(id),
    offer_id UUID REFERENCES requests.help_offers(id),
    responder_id UUID NOT NULL REFERENCES auth.users(id),
    status VARCHAR(50) DEFAULT 'pending',     -- pending, accepted, in_progress, completed, cancelled

    -- Social Karma v2.0 Privacy
    requester_visible BOOLEAN DEFAULT false,
    responder_visible BOOLEAN DEFAULT false,
    interaction_category VARCHAR(100),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    UNIQUE(request_id, offer_id)
);

CREATE INDEX idx_matches_request_id ON requests.matches(request_id);
CREATE INDEX idx_matches_status ON requests.matches(status);
```

**requests.interaction_feedback** - Social Karma v2.0 exchange quality ratings
```sql
CREATE TABLE requests.interaction_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES requests.matches(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Interaction quality ratings (1-5)
    helpfulness INTEGER CHECK (helpfulness BETWEEN 1 AND 5),
    responsiveness INTEGER CHECK (responsiveness BETWEEN 1 AND 5),
    clarity INTEGER CHECK (clarity BETWEEN 1 AND 5),

    -- Optional comment about the exchange (not the person)
    comment TEXT,

    -- Visibility consent for featuring in stories
    allow_featuring BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(match_id, from_user_id)
);

CREATE INDEX idx_interaction_feedback_match ON requests.interaction_feedback(match_id);
CREATE INDEX idx_interaction_feedback_to_user ON requests.interaction_feedback(to_user_id);
```

#### Privacy Design Principles (Social Karma v2.0)
- **Privacy First**: All requests/offers default to `is_public = false`
- **Two-Way Consent**: Both parties must consent for names in featured stories
- **Interaction Ratings**: Rate the exchange quality, NOT the individual

#### Tables Read by This Service
- `auth.users` - User details for requester/helper names
- `auth.user_skills` - User skills for skill-based matching
- `communities.communities` - Community names and details
- `communities.members` - Verify community membership

---

## 3. API Reference

### 3.1 Help Requests

#### GET /requests
Get all help requests with optional filters.

**Query Parameters:**
- `community_id` (UUID) - Filter by community
- `status` (string) - Filter by status (default: 'open')
- `type` (string) - Filter by category
- `limit` (number) - Max results (default: 50)
- `offset` (number) - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [{
    "id": "uuid",
    "community_id": "uuid",
    "community_name": "Seattle Mutual Aid",
    "requester_id": "uuid",
    "requester_name": "Alice Smith",
    "title": "Need help moving furniture",
    "description": "Moving couch upstairs, need 2-3 people",
    "category": "moving",
    "urgency": "medium",
    "status": "open",
    "created_at": "2025-01-10T12:00:00Z"
  }],
  "count": 1
}
```

**Implementation:** `src/routes/requests.ts:8`

#### GET /requests/matched/for-user
Get requests matching user's skills from their communities (skill-based matching algorithm).

**Query Parameters:**
- `user_id` (UUID, required) - User to match requests for
- `limit` (number) - Max results (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [{
    "id": "uuid",
    "title": "Need help moving furniture",
    "category": "moving",
    "urgency": "high",
    "urgency_priority": 3,
    "community_name": "Seattle Mutual Aid",
    "requester_name": "Alice Smith",
    "created_at": "2025-01-10T12:00:00Z"
  }],
  "count": 1
}
```

**Algorithm:**
- Orders by urgency (high=3, medium=2, low=1) then creation date
- Matches based on category-to-skill mapping (see Section 5.2)
- Excludes user's own requests
- Only includes communities user is a member of

**Implementation:** `src/routes/requests.ts:60`

#### GET /requests/:id
Get specific request details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Need help moving furniture",
    "description": "Moving couch upstairs",
    "category": "moving",
    "urgency": "medium",
    "status": "open",
    "requester_id": "uuid",
    "requester_name": "Alice Smith",
    "requester_email": "alice@example.com",
    "community_id": "uuid",
    "community_name": "Seattle Mutual Aid",
    "created_at": "2025-01-10T12:00:00Z"
  }
}
```

**Implementation:** `src/routes/requests.ts:134`

#### POST /requests
Create new help request.

**Request:**
```json
{
  "community_id": "uuid",
  "requester_id": "uuid",
  "title": "Need help moving furniture",
  "description": "Moving couch upstairs, need 2-3 strong people",
  "type": "moving",
  "urgency": "high"
}
```

**Validation:**
- User must be active member of the community
- Required fields: `community_id`, `requester_id`, `title`, `type`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Need help moving furniture",
    "category": "moving",
    "urgency": "high",
    "status": "open",
    "created_at": "2025-01-10T12:00:00Z"
  },
  "message": "Request created successfully"
}
```

**Events Published:** `request.created`

**Implementation:** `src/routes/requests.ts:173`

#### PUT /requests/:id
Update help request (requester only).

**Request:**
```json
{
  "user_id": "uuid",
  "title": "Updated title",
  "description": "Updated description",
  "urgency": "low",
  "status": "completed"
}
```

**Authorization:** Only the original requester can update

**Events Published:** `request.completed` (when status changed to 'completed')

**Implementation:** `src/routes/requests.ts:235`

#### DELETE /requests/:id
Cancel help request (requester only).

**Request:**
```json
{
  "user_id": "uuid"
}
```

**Events Published:** `request.cancelled`

**Implementation:** `src/routes/requests.ts:316`

#### PUT /requests/:id/privacy
Update privacy settings for a request (Social Karma v2.0).

**Request:**
```json
{
  "user_id": "uuid",
  "is_public": true,
  "requester_visibility_consent": true
}
```

**Authorization:** Only requester can update their request privacy

**Events Published:** `privacy_settings.updated`

**Implementation:** `src/routes/requests.ts` (Social Karma v2.0)

### 3.2 Help Offers

#### GET /offers
Get all help offers with optional filters.

**Query Parameters:** Same as GET /requests

**Implementation:** `src/routes/offers.ts:8`

#### GET /offers/:id
Get specific offer details.

**Implementation:** `src/routes/offers.ts:60`

#### POST /offers
Create new help offer.

**Request:**
```json
{
  "community_id": "uuid",
  "offerer_id": "uuid",
  "title": "I can help with moving",
  "description": "Available on weekends, have truck",
  "type": "moving"
}
```

**Events Published:** `offer.created`

**Implementation:** `src/routes/offers.ts:99`

#### PUT /offers/:id/privacy
Update privacy settings for an offer (Social Karma v2.0).

**Implementation:** `src/routes/offers.ts` (Social Karma v2.0)

### 3.3 Matches

#### GET /matches
Get all matches with optional filters.

**Query Parameters:**
- `request_id` - Filter by request
- `offer_id` - Filter by offer
- `status` - Filter by status

**Implementation:** `src/routes/matches.ts:8`

#### GET /matches/:id
Get specific match details.

**Implementation:** `src/routes/matches.ts:69`

#### POST /matches
Create a match between request and responder.

**Request:**
```json
{
  "request_id": "uuid",
  "offer_id": "uuid",
  "responder_id": "uuid"
}
```

**Note:** `offer_id` is optional (direct response without offer)

**Validation:**
- Request must exist and be 'open'
- Offer must exist and be 'active' (if provided)
- Responder cannot match their own request

**Events Published:** `match.created`

**Implementation:** `src/routes/matches.ts:113`

#### PUT /matches/:id
Update match status.

**Request:**
```json
{
  "status": "completed",
  "user_id": "uuid"
}
```

**Authorization:** Only requester or responder can update

**Side Effects:** When status set to 'completed', also updates request status

**Events Published:** `match.completed`

**Implementation:** `src/routes/matches.ts`

### 3.4 Interaction Feedback (Social Karma v2.0)

#### POST /matches/:id/feedback
Submit interaction feedback for a completed match.

**Request:**
```json
{
  "from_user_id": "uuid",
  "helpfulness": 5,
  "responsiveness": 4,
  "clarity": 5,
  "comment": "Great communication, very helpful exchange!",
  "allow_featuring": true
}
```

**Validation:**
- Match must be completed
- `from_user_id` must be requester or responder
- Can only submit feedback once per match
- All ratings must be 1-5

**Two-Way Consent Logic:**
When both parties submit feedback with `allow_featuring = true`:
1. Check `requester_visibility_consent` and `responder_visibility_consent`
2. If both true: Names visible in featured story
3. If either false: Anonymous story only
4. Update `matches.requester_visible` and `matches.responder_visible`

**Events Published:** `interaction_feedback.submitted`

**Implementation:** `src/routes/feedback.ts`

#### GET /matches/:id/feedback
Get feedback for a match.

**Authorization:** Only requester or responder can view

**Implementation:** `src/routes/feedback.ts`

### 3.5 Health Check

#### GET /health
Service health check.

**Response:**
```json
{
  "service": "request-service",
  "status": "healthy",
  "timestamp": "2025-01-10T12:00:00Z"
}
```

---

## 4. Events

### 4.1 Published Events

| Event Name | Queue | Payload | When Emitted |
|------------|-------|---------|--------------|
| `request.created` | `karmyq-events` | `{ request_id, requester_id, community_id, category }` | After successful request creation |
| `request.completed` | `karmyq-events` | `{ request_id, requester_id, community_id }` | When request status changed to 'completed' |
| `request.cancelled` | `karmyq-events` | `{ request_id, requester_id, community_id }` | When request is cancelled |
| `offer.created` | `karmyq-events` | `{ offer_id, offerer_id, community_id, category }` | After successful offer creation |
| `match.created` | `karmyq-events` | `{ match_id, request_id, offer_id, responder_id }` | When request and responder are matched |
| `match.completed` | `karmyq-events` | `{ match_id, request_id, responder_id, completed_at }` | When match is marked as completed |
| `interaction_feedback.submitted` | `karmyq-events` | `{ feedback_id, match_id, from_user_id, to_user_id, ratings }` | When user submits feedback (Social Karma v2.0) |
| `privacy_settings.updated` | `karmyq-events` | `{ entity_type, entity_id, is_public, visibility_consent }` | When request/offer privacy changes (Social Karma v2.0) |

### 4.2 Consumed Events
None currently. Request Service does not consume events.

**Note:** In v9.0 (Everything App), this service will consume:
- `user.verified` - To unlock premium request types (rides, services)

### 4.3 Event Publishing Pattern

```typescript
// src/routes/requests.ts
import { publishEvent } from '../events/publisher';

// After successful request creation
await publishEvent('request.created', {
  request_id: newRequest.id,
  requester_id: req.user.id,
  community_id: req.community.id,
  category: newRequest.category
});
```

---

## 5. Key Patterns

### 5.1 Authentication & Authorization Flow

**Standard Auth Pattern:**
```typescript
// All routes protected with auth middleware
router.post('/requests',
  authenticateToken,           // Verify JWT
  extractCommunityContext,     // Set req.community
  requireRole('member'),       // Check minimum role
  async (req, res) => { ... }
);
```

**Membership Verification:**
```typescript
// Verify user is active community member before allowing post
const memberCheck = await db.query(
  `SELECT id FROM communities.members
   WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
  [community_id, requester_id]
);

if (memberCheck.rowCount === 0) {
  return res.status(403).json({
    success: false,
    message: 'Only community members can post requests'
  });
}
```

**Requester-Only Updates:**
```typescript
// Only original requester can update/cancel their request
const requestCheck = await db.query(
  `SELECT requester_id FROM requests.help_requests WHERE id = $1`,
  [id]
);

if (requestCheck.rows[0].requester_id !== user_id) {
  return res.status(403).json({
    success: false,
    message: 'Only the requester can update this request'
  });
}
```

### 5.2 Skill-Based Matching Algorithm

**Category-to-Skill Mapping:**

| Category | Matched Skills |
|----------|---------------|
| transportation | driving |
| moving | moving, handyman |
| childcare | childcare |
| pet_care | pet_care |
| tech_support | tech_support, coding |
| home_repair | home_repair, handyman, electrical, plumbing, carpentry |
| gardening | gardening |
| cooking | cooking, baking |
| tutoring | tutoring |
| language | languages |
| professional_advice | career_advice |
| cleaning | cleaning, organizing |

**Matching Query Pattern:**
```sql
SELECT
  r.id, r.title, r.category, r.urgency,
  CASE
    WHEN r.urgency = 'high' THEN 3
    WHEN r.urgency = 'medium' THEN 2
    ELSE 1
  END as urgency_priority,
  c.name as community_name,
  u.name as requester_name,
  r.created_at
FROM requests.help_requests r
INNER JOIN communities.communities c ON r.community_id = c.id
INNER JOIN auth.users u ON r.requester_id = u.id
WHERE r.status = 'open'
  AND r.requester_id != $1                    -- Exclude user's own requests
  AND EXISTS (
    SELECT 1 FROM communities.members m
    WHERE m.user_id = $1
      AND m.community_id = r.community_id
      AND m.status = 'active'                 -- Only user's communities
  )
  AND EXISTS (
    SELECT 1 FROM auth.user_skills s
    WHERE s.user_id = $1
    AND (
      (r.category = 'moving' AND s.skill IN ('moving', 'handyman'))
      OR (r.category = 'tech_support' AND s.skill IN ('tech_support', 'coding'))
      -- ... other category mappings
    )
  )
ORDER BY urgency_priority DESC, r.created_at ASC
LIMIT $2;
```

### 5.3 Database Query Pattern (RLS-Aware)

```typescript
// All queries respect community_id for multi-tenant isolation
const result = await db.query(
  `SELECT * FROM requests.help_requests
   WHERE community_id = $1 AND status = $2`,
  [req.community.id, 'open']
);
```

### 5.4 Event Publishing Pattern

```typescript
// Publish event after successful database operation
const newRequest = await db.query(
  'INSERT INTO requests.help_requests (...) VALUES (...) RETURNING *',
  [...]
);

// Fire and forget (don't block response)
await publishEvent('request.created', {
  request_id: newRequest.rows[0].id,
  requester_id: req.user.id,
  community_id: req.community.id
});

return res.status(201).json({
  success: true,
  data: newRequest.rows[0]
});
```

---

## 6. Dependencies

### 6.1 Upstream Services (This service calls)
- **Community Service** (via database) - Verify community membership
- **Auth Service** (via database) - Get user details and skills

### 6.2 Downstream Services (This service is called by)
- **Gateway** - All client requests route through gateway
- **Frontend (Web)** - For browsing/creating requests and offers
- **Frontend (Mobile)** - Mobile app access
- **Feed Service** - Reads open requests for personalized feed

### 6.3 Event Consumers (Who listens to our events)
- **Reputation Service** - Listens to `match.completed` → Awards karma
- **Notification Service** - Listens to `request.created` → Notifies community
- **Feed Service** - Listens to `request.created` → Updates feed

### 6.4 Shared Libraries
- `@karmyq/shared/middleware` - `authenticateToken`, `extractCommunityContext`, `requireRole`
- `@karmyq/shared/utils/logger` - Structured logging
- `@karmyq/shared/database` - PostgreSQL connection utilities

**Note:** In v9.0 (Everything App), will use:
- `@karmyq/shared/schemas` - Zod validation schemas for polymorphic requests

---

## 7. Testing

### 7.1 Unit Tests

**Run Tests:**
```bash
cd services/request-service
npm test
```

**Test Structure:**
```
src/__tests__/
├── requests.test.ts       # Request CRUD and matching
├── offers.test.ts         # Offer CRUD
└── matches.test.ts        # Match creation and completion
```

### 7.2 Integration Tests

**Run Integration Tests:**
```bash
cd tests
npm run test:integration -- integration/request-service.test.ts
```

**Test Scenarios:**
- Request lifecycle (create → match → complete)
- Skill-based matching algorithm
- Privacy controls (Social Karma v2.0)
- Event publishing

### 7.3 Test Fixtures

**Test Personas:**
- `tests/fixtures/quick-seed.sql` - 7 test personas
- `tests/fixtures/large-dataset.sql` - 2000 users, realistic data

**Mock Data:**
```typescript
// Example test request
const testRequest = {
  community_id: 'test-community-uuid',
  requester_id: 'test-user-uuid',
  title: 'Test: Need help moving',
  description: 'Moving couch upstairs',
  type: 'moving',
  urgency: 'high'
};
```

### 7.4 Key Test Scenarios

**Generic Requests (v8.0 - Current):**
- [ ] Create generic request successfully
- [ ] Reject request with missing required fields
- [ ] Only requester can update their request
- [ ] User cannot match their own request
- [ ] Skill-based matching returns relevant requests
- [ ] Privacy settings update correctly
- [ ] Two-way consent logic works correctly

**Polymorphic Requests (v9.0 - Everything App):**
- [ ] Create generic request (backward compatibility)
- [ ] Create ride request with valid coordinates
- [ ] Create borrow request with item details
- [ ] Reject ride request with invalid coordinates
- [ ] Validate payload against Zod schema
- [ ] Emit `request.created` with `request_type` field

**Event Publishing:**
- [ ] `request.created` event published on creation
- [ ] `match.completed` event published on completion
- [ ] Events include all required payload fields

### 7.5 Manual Testing with curl

**Create Request:**
```bash
curl -X POST http://localhost:3003/requests \
  -H "Content-Type: application/json" \
  -d '{
    "community_id": "uuid-here",
    "requester_id": "uuid-here",
    "title": "Need help moving couch",
    "description": "Heavy couch, need 2-3 people",
    "type": "moving",
    "urgency": "high"
  }'
```

**Get Matched Requests:**
```bash
curl "http://localhost:3003/requests/matched/for-user?user_id=uuid-here&limit=5"
```

**Complete Match:**
```bash
curl -X PUT http://localhost:3003/matches/uuid-here \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "user_id": "uuid-here"
  }'
```

---

## 8. Configuration

### 8.1 Environment Variables

```bash
# Server
PORT=3003
NODE_ENV=development          # development | production

# Database
DATABASE_URL=postgresql://karmyq_user:password@localhost:5432/karmyq_db

# Redis (for events)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info                # debug | info | warn | error
```

### 8.2 Feature Flags

**Current (v8.0):**
- All features enabled by default

**Planned (v9.0 - Everything App):**
```bash
# Feature flags for new verticals
ENABLE_RIDE_REQUESTS=false
ENABLE_BORROW_REQUESTS=false
ENABLE_SERVICE_REQUESTS=false
ENABLE_EVENT_REQUESTS=false
```

### 8.3 Database Connection Pool

```typescript
// src/database/db.ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000
});
```

---

## 9. Monitoring & Observability

### 9.1 Key Metrics

**Request Metrics:**
- Total requests created (counter)
- Requests by category (counter with labels)
- Requests by urgency (counter with labels)
- Open requests count (gauge)

**Match Metrics:**
- Matches created (counter)
- Matches completed (counter)
- Time to first match (histogram)

**API Performance:**
- Request latency (histogram)
- Error rate (counter)
- Throughput (requests/second)

### 9.2 Logging

**Structured JSON Logging:**
```typescript
import { logger } from '@karmyq/shared/utils/logger';

logger.info('Request created', {
  request_id: newRequest.id,
  requester_id: req.user.id,
  community_id: req.community.id,
  category: newRequest.category
});

logger.error('Failed to create request', {
  error: err.message,
  stack: err.stack,
  requester_id: req.user.id
});
```

**Log Levels:**
- `DEBUG` - Detailed query logs, matching algorithm steps
- `INFO` - Request creation, match completion
- `WARN` - Invalid input, failed validations
- `ERROR` - Database errors, event publishing failures

### 9.3 Health Checks

**Endpoint:** `GET /health`

**Health Check Logic:**
```typescript
// src/routes/health.ts
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    await db.query('SELECT 1');

    // Check Redis connection
    await redis.ping();

    res.json({
      service: 'request-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'connected',
        redis: 'connected'
      }
    });
  } catch (error) {
    res.status(503).json({
      service: 'request-service',
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

**Monitoring Alerts:**
- Database connection failures
- Redis connection failures
- High error rate (>5% of requests)
- High latency (P95 > 500ms)

---

## 10. Troubleshooting

### 10.1 Common Issues

#### Issue: Skill-based matching returns no results

**Symptoms:** `GET /requests/matched/for-user` returns empty array

**Diagnosis:**
1. Check user has skills:
   ```sql
   SELECT * FROM auth.user_skills WHERE user_id = 'uuid-here';
   ```

2. Check user is member of communities:
   ```sql
   SELECT * FROM communities.members
   WHERE user_id = 'uuid-here' AND status = 'active';
   ```

3. Check requests exist in those communities:
   ```sql
   SELECT * FROM requests.help_requests
   WHERE community_id IN (...) AND status = 'open';
   ```

4. Verify category-to-skill mapping matches user's skills
5. Ensure user is not the requester (excluded from results)

**Solution:**
- Add skills to user: `INSERT INTO auth.user_skills ...`
- Ensure user joined communities
- Verify skill mapping in Section 5.2

#### Issue: Request not appearing in list

**Symptoms:** Request exists but not in `GET /requests` response

**Diagnosis:**
1. Check request status:
   ```sql
   SELECT status FROM requests.help_requests WHERE id = 'uuid-here';
   ```

2. Verify `community_id` filter if applied
3. Check pagination (limit/offset)
4. Verify request hasn't been soft-deleted

**Solution:**
- Use correct status filter
- Increase limit or adjust offset
- Check all status values: `open`, `matched`, `completed`, `cancelled`

#### Issue: Match creation fails

**Symptoms:** `POST /matches` returns 400 or 403

**Diagnosis:**
1. Verify request exists and is 'open':
   ```sql
   SELECT id, status FROM requests.help_requests WHERE id = 'uuid-here';
   ```

2. If using offer, verify it's 'active':
   ```sql
   SELECT id, status FROM requests.help_offers WHERE id = 'uuid-here';
   ```

3. Check responder is not requester
4. Look for duplicate match error (unique constraint)

**Solution:**
- Ensure request is in 'open' status
- Verify offer_id is valid (or omit for direct match)
- Different user_id for responder

#### Issue: Events not publishing

**Symptoms:** No events in Redis queue, downstream services not reacting

**Diagnosis:**
1. Check Redis connection:
   ```bash
   docker exec -it karmyq-redis redis-cli PING
   ```

2. Verify REDIS_URL environment variable
3. Check event publisher initialization in logs
4. Look for try-catch that swallows errors

**Solution:**
- Restart Redis: `docker-compose restart redis`
- Update REDIS_URL in `.env`
- Check publisher initialization: `src/events/publisher.ts`

#### Issue: Database connection errors

**Symptoms:** 500 errors, "connection pool exhausted"

**Diagnosis:**
1. Check DATABASE_URL is correct
2. Verify PostgreSQL is running:
   ```bash
   docker ps | grep postgres
   ```

3. Test connection:
   ```bash
   psql $DATABASE_URL
   ```

4. Check requests schema exists:
   ```sql
   \dn
   ```

**Solution:**
- Restart PostgreSQL: `docker-compose restart postgres`
- Verify connection string format
- Run migrations: `psql $DATABASE_URL < infrastructure/postgres/init.sql`

### 10.2 Performance Issues

#### Issue: Slow skill-based matching queries

**Solution:**
- Verify indexes exist: `idx_help_requests_community_id`, `idx_help_requests_category`
- Add index on `auth.user_skills(user_id, skill)` if missing
- Consider materialized view for frequently accessed matches

#### Issue: High memory usage

**Solution:**
- Check connection pool size (default: 20)
- Verify connections are being released properly
- Monitor with: `docker stats karmyq-request-service`

---

## 11. Future Enhancements

### 11.1 v9.0 - Everything App (In Progress)

- [ ] **Polymorphic Data Model** - Add `request_type`, `payload`, `requirements` columns
- [ ] **Zod Schema Validation** - Validate payloads against type-specific schemas
- [ ] **Ride Requests** - Origin/destination coordinates, seats needed
- [ ] **Borrow Requests** - Item condition, duration, images
- [ ] **Service Requests** - Professional services with pricing
- [ ] **Event Requests** - Community events with RSVP

### 11.2 Matching Engine Enhancements

- [ ] Auto-matching algorithm (suggest best helpers)
- [ ] Location-based matching (PostGIS integration)
- [ ] Skill proficiency levels (beginner, intermediate, expert)
- [ ] Multi-helper requests (request needs 3 people)

### 11.3 Request Lifecycle

- [ ] Request expiration (auto-cancel old requests)
- [ ] Request templates (common request types)
- [ ] Recurring requests (weekly/monthly help)
- [ ] Request attachments/images

### 11.4 Quality & Trust

- [ ] Helper ratings aggregation
- [ ] Verified helper badges
- [ ] Request categories requiring verification (e.g., childcare)

---

## 12. Related Documentation

### 12.1 Architecture Documentation
- [Main Architecture](../../docs/architecture/ARCHITECTURE.md)
- [Everything App Roadmap](../../docs/gemini-architecture-review/roadmap.md)
- [API Gateway Design](../../docs/gemini-architecture-review/gateway_design.md)
- [Events Architecture](../../docs/gemini-architecture-review/events_architecture.md)

### 12.2 Database Documentation
- [Database Schema](../../infrastructure/postgres/init.sql) - Lines 91-144 (requests schema)
- [Polymorphic Migration](../../infrastructure/postgres/migrations/009_polymorphic_requests.sql) - v9.0

### 12.3 Testing Documentation
- [Local Testing Guide](../../docs/testing/LOCAL_TESTING.md)
- [V8 Testing Guide](../../docs/testing/V8_TESTING_GUIDE.md)
- [Integration Test Suite](../../tests/integration/request-service.test.ts)

### 12.4 Development Guides
- [Agent-Driven Development](../../docs/development/AGENT_DRIVEN_DEVELOPMENT.md)
- [Service Context Template](../../docs/development/SERVICE_CONTEXT_TEMPLATE.md)
- [CONTEXT.md Audit](../../docs/development/CONTEXT_AUDIT.md)

### 12.5 API Documentation
- API Gateway endpoints (TBD - v9.0)
- Swagger/OpenAPI spec (TBD - v9.0)

---

## Appendix A: Request Categories Reference

Complete category-to-skill mapping for skill-based matching:

```typescript
// src/services/matcher.ts
export const CATEGORY_SKILL_MAP = {
  transportation: ['driving'],
  moving: ['moving', 'handyman'],
  childcare: ['childcare'],
  pet_care: ['pet_care'],
  tech_support: ['tech_support', 'coding'],
  home_repair: ['home_repair', 'handyman', 'electrical', 'plumbing', 'carpentry'],
  gardening: ['gardening'],
  cooking: ['cooking', 'baking'],
  tutoring: ['tutoring'],
  language: ['languages'],
  professional_advice: ['career_advice'],
  cleaning: ['cleaning', 'organizing']
};
```

## Appendix B: Development Tasks Reference

### Add New Request Category

1. Add to skill mapping in `src/routes/requests.ts`
2. Update CATEGORY_SKILL_MAP in Appendix A
3. Update documentation

### Add New Request Field

1. Create migration: `ALTER TABLE requests.help_requests ADD COLUMN ...`
2. Update POST endpoint to accept field
3. Update GET endpoints to return field
4. Update tests

### Change Urgency Levels

Update urgency priority calculation in skill matching query (see Section 5.2)

---

**End of Request Service Context Documentation**

*This document is the gold standard for service documentation. All other services should follow this structure.*
