# Request Service Context

> **Quick Start**: `cd services/request-service && npm run dev`
> **Port**: 3003 | **Health**: http://localhost:3003/health

## Purpose

Manages help requests, help offers, and matches between requesters and helpers. Implements skill-based matching to suggest relevant requests to users based on their abilities.

## Database Schema

### Tables Owned by This Service

```sql
-- requests.help_requests
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- requests.help_offers
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- requests.matches
CREATE TABLE requests.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES requests.help_requests(id),
    offer_id UUID REFERENCES requests.help_offers(id),
    responder_id UUID NOT NULL REFERENCES auth.users(id),
    status VARCHAR(50) DEFAULT 'pending',     -- pending, accepted, in_progress, completed, cancelled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    UNIQUE(request_id, offer_id)
);

-- Indexes
CREATE INDEX idx_help_requests_community_id ON requests.help_requests(community_id);
CREATE INDEX idx_help_requests_status ON requests.help_requests(status);
CREATE INDEX idx_help_requests_category ON requests.help_requests(category);
CREATE INDEX idx_help_offers_community_id ON requests.help_offers(community_id);
CREATE INDEX idx_matches_request_id ON requests.matches(request_id);
CREATE INDEX idx_matches_status ON requests.matches(status);
```

**Social Karma v2.0 Schema Extensions:**

```sql
-- Privacy controls for help_requests
ALTER TABLE requests.help_requests
ADD COLUMN is_public BOOLEAN DEFAULT false,
ADD COLUMN requester_visibility_consent BOOLEAN DEFAULT false;

-- Privacy controls for help_offers
ALTER TABLE requests.help_offers
ADD COLUMN is_public BOOLEAN DEFAULT false,
ADD COLUMN offerer_visibility_consent BOOLEAN DEFAULT false;

-- Privacy and interaction tracking for matches
ALTER TABLE requests.matches
ADD COLUMN requester_visible BOOLEAN DEFAULT false,
ADD COLUMN responder_visible BOOLEAN DEFAULT false,
ADD COLUMN interaction_category VARCHAR(100);

-- requests.interaction_feedback (NEW)
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

**Privacy Design Principles:**
- **Privacy First**: All new requests/offers default to `is_public = false`
- **Two-Way Consent**: Both requester and responder must consent (`*_visibility_consent = true`) for names to appear in featured stories
- **Interaction Ratings**: Feedback rates the exchange quality (helpfulness, responsiveness, clarity), not the individual

### Tables Read by This Service
- `auth.users` - User details for requester/helper names and emails
- `auth.user_skills` - User skills for skill-based matching
- `communities.communities` - Community names and details
- `communities.members` - Verify community membership

## Request Categories and Skill Matching

The service maps request categories to user skills for intelligent matching:

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

## API Endpoints

### GET /requests
Get all help requests with optional filters.

**Query Parameters:**
- `community_id` - Filter by community
- `status` - Filter by status (default: 'open')
- `type` - Filter by category
- `limit` - Max results (default: 50)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
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
    }
  ],
  "count": 1
}
```

**Implementation:** `src/routes/requests.ts:8`

### GET /requests/matched/for-user
Get requests matching user's skills from their communities.

**Query Parameters:**
- `user_id` - User UUID (required)
- `limit` - Max results (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Need help moving furniture",
      "category": "moving",
      "urgency": "high",
      "urgency_priority": 3,
      "community_name": "Seattle Mutual Aid",
      "requester_name": "Alice Smith",
      "created_at": "2025-01-10T12:00:00Z"
    }
  ],
  "count": 1
}
```

**Implementation:** `src/routes/requests.ts:60`

**Note:** Orders by urgency (high=3, medium=2, low=1) then creation date.

### GET /requests/:id
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

### POST /requests
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

**Implementation:** `src/routes/requests.ts:173`

**Validation:**
- User must be active member of the community
- Required fields: community_id, requester_id, title, type

**Events Published:** `request_created`

### PUT /requests/:id
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

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Updated title",
    "status": "completed",
    "updated_at": "2025-01-10T13:00:00Z"
  },
  "message": "Request updated successfully"
}
```

**Implementation:** `src/routes/requests.ts:235`

**Events Published:** `request_completed` (when status changed to 'completed')

### DELETE /requests/:id
Cancel help request (requester only).

**Request:**
```json
{
  "user_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Request cancelled successfully"
}
```

**Implementation:** `src/routes/requests.ts:316`

**Events Published:** `request_cancelled`

### GET /offers
Get all help offers with optional filters.

**Query Parameters:**
- `community_id` - Filter by community
- `status` - Filter by status (default: 'active')
- `type` - Filter by category
- `limit` - Max results (default: 50)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "community_id": "uuid",
      "community_name": "Seattle Mutual Aid",
      "offerer_id": "uuid",
      "helper_name": "Bob Johnson",
      "title": "I can help with moving",
      "description": "Available on weekends",
      "category": "moving",
      "status": "active",
      "created_at": "2025-01-10T12:00:00Z"
    }
  ],
  "count": 1
}
```

**Implementation:** `src/routes/offers.ts:8`

### GET /offers/:id
Get specific offer details.

**Implementation:** `src/routes/offers.ts:60`

### POST /offers
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

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "I can help with moving",
    "category": "moving",
    "status": "active",
    "created_at": "2025-01-10T12:00:00Z"
  },
  "message": "Offer created successfully"
}
```

**Implementation:** `src/routes/offers.ts:99`

**Validation:**
- User must be active member of the community
- Required fields: community_id, offerer_id, title, type

**Events Published:** `offer_created`

### GET /matches
Get all matches with optional filters.

**Query Parameters:**
- `request_id` - Filter by request
- `offer_id` - Filter by offer
- `status` - Filter by status
- `limit` - Max results (default: 50)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "request_id": "uuid",
      "request_title": "Need help moving",
      "request_category": "moving",
      "requester_id": "uuid",
      "requester_name": "Alice Smith",
      "offer_id": "uuid",
      "offer_title": "I can help with moving",
      "offerer_id": "uuid",
      "helper_name": "Bob Johnson",
      "responder_id": "uuid",
      "status": "completed",
      "created_at": "2025-01-10T12:00:00Z",
      "completed_at": "2025-01-10T15:00:00Z"
    }
  ],
  "count": 1
}
```

**Implementation:** `src/routes/matches.ts:8`

### GET /matches/:id
Get specific match details.

**Implementation:** `src/routes/matches.ts:69`

### POST /matches
Create a match between request and responder.

**Request:**
```json
{
  "request_id": "uuid",
  "offer_id": "uuid",
  "responder_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "request_id": "uuid",
    "offer_id": "uuid",
    "responder_id": "uuid",
    "status": "pending",
    "created_at": "2025-01-10T12:00:00Z"
  },
  "message": "Match created successfully"
}
```

**Implementation:** `src/routes/matches.ts:113`

**Validation:**
- Request must exist and be 'open'
- Offer must exist and be 'active' (if provided)
- Responder cannot match their own request

**Note:** offer_id is optional (direct response without offer)

**Events Published:** `match_created`

### PUT /matches/:id
Update match status.

**Request:**
```json
{
  "status": "completed",
  "user_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "completed",
    "completed_at": "2025-01-10T15:00:00Z"
  },
  "message": "Match updated successfully"
}
```

**Validation:**
- Only requester or responder can update match
- When status set to 'completed', also updates request status

**Events Published:** `match_completed`

---

## Social Karma v2.0 API Endpoints

### PUT /requests/:id/privacy
Update privacy settings for a request.

**Request:**
```json
{
  "user_id": "uuid",
  "is_public": true,
  "requester_visibility_consent": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "is_public": true,
    "requester_visibility_consent": true
  },
  "message": "Privacy settings updated"
}
```

**Validation:**
- Only requester can update their request privacy settings

**Implementation:** `src/routes/requests.ts` (NEW)

### PUT /offers/:id/privacy
Update privacy settings for an offer.

**Request:**
```json
{
  "user_id": "uuid",
  "is_public": false,
  "offerer_visibility_consent": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "is_public": false,
    "offerer_visibility_consent": false
  },
  "message": "Privacy settings updated"
}
```

**Validation:**
- Only offerer can update their offer privacy settings

**Implementation:** `src/routes/offers.ts` (NEW)

### POST /matches/:id/feedback
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

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "match_id": "uuid",
    "helpfulness": 5,
    "responsiveness": 4,
    "clarity": 5,
    "allow_featuring": true,
    "created_at": "2025-01-10T15:30:00Z"
  },
  "message": "Feedback submitted successfully"
}
```

**Validation:**
- Match must be completed
- from_user_id must be requester or responder
- Can only submit feedback once per match
- All ratings must be 1-5

**Implementation:** `src/routes/feedback.ts` (NEW)

**Events Published:** `interaction_feedback_submitted`

**Two-Way Consent Logic:**
When both parties submit feedback with `allow_featuring = true`:
1. Check `requester_visibility_consent` and `responder_visibility_consent`
2. If both true: Names visible in featured story
3. If either false: Anonymous story only
4. Update `matches.requester_visible` and `matches.responder_visible` accordingly

### GET /matches/:id/feedback
Get feedback for a match.

**Query Parameters:**
- `user_id` - User requesting feedback (must be requester or responder)

**Response:**
```json
{
  "success": true,
  "data": {
    "feedback_from_requester": {
      "id": "uuid",
      "helpfulness": 5,
      "responsiveness": 4,
      "clarity": 5,
      "comment": "Very helpful!",
      "created_at": "2025-01-10T15:30:00Z"
    },
    "feedback_from_responder": {
      "id": "uuid",
      "helpfulness": 4,
      "responsiveness": 5,
      "clarity": 4,
      "comment": "Clear communication",
      "created_at": "2025-01-10T15:35:00Z"
    },
    "both_allow_featuring": true,
    "requester_visible": true,
    "responder_visible": true
  }
}
```

**Validation:**
- Only requester or responder can view feedback

**Implementation:** `src/routes/feedback.ts` (NEW)

---

### GET /health
Service health check.

**Response:**
```json
{
  "service": "request-service",
  "status": "healthy",
  "timestamp": "2025-01-10T12:00:00Z"
}
```

## Dependencies

### Calls (Outbound)
- Community Service (via database) - Verify community membership

### Called By (Inbound)
- Frontend (for browsing/creating requests and offers)
- Feed Service (to get open requests for feed)
- Reputation Service (listens to match_completed events)

### Events Published
- `request_created` - When new request is created
- `request_completed` - When request status changed to completed
- `request_cancelled` - When request is cancelled
- `offer_created` - When new offer is created
- `match_created` - When request and responder are matched
- `match_completed` - When match is marked as completed
- `interaction_feedback_submitted` - When user submits feedback on interaction (Social Karma v2.0)
- `privacy_settings_updated` - When request/offer privacy settings change (Social Karma v2.0)

### Events Consumed
- None

### External Dependencies
- PostgreSQL (requests schema)
- Redis (event publishing via Bull queue)

## Environment Variables

```bash
# Server
PORT=3003
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/karmyq_db

# Redis
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info                   # debug, info, warn, error
```

## Key Files

### Entry Point
- `src/index.ts` - Express app initialization, route registration

### Routes
- `src/routes/requests.ts` - Help request CRUD and skill-based matching
- `src/routes/offers.ts` - Help offer CRUD operations
- `src/routes/matches.ts` - Match creation and status updates
- `src/routes/feedback.ts` - Interaction feedback (Social Karma v2.0) - NEW

### Database
- `src/database/db.ts` - PostgreSQL connection pool

### Events
- `src/events/publisher.ts` - Redis event publishing

## Common Development Tasks

### Add New Request Category

1. **Add category to skill mapping:**
```typescript
// src/routes/requests.ts - GET /requests/matched/for-user
WHERE EXISTS (
  SELECT 1 FROM auth.user_skills s
  WHERE s.user_id = $1
  AND (
    -- ... existing mappings ...
    OR (r.category = 'new_category' AND s.skill IN ('skill1', 'skill2'))
  )
)
```

2. **Update documentation:**
Add to Request Categories table above.

### Add New Request Field

1. **Create migration:**
```sql
-- infrastructure/postgres/migrations/00X_add_request_field.sql
ALTER TABLE requests.help_requests
ADD COLUMN new_field VARCHAR(255);
```

2. **Update create endpoint:**
```typescript
// src/routes/requests.ts - POST /requests
const { new_field } = req.body;

const result = await query(
  `INSERT INTO requests.help_requests
    (community_id, requester_id, title, ..., new_field)
  VALUES ($1, $2, $3, ..., $N)
  RETURNING *`,
  [community_id, requester_id, title, ..., new_field]
);
```

3. **Update GET endpoints:**
```typescript
// Add to SELECT clauses
SELECT
  r.id, r.title, ..., r.new_field
FROM requests.help_requests r
```

### Change Urgency Levels

```typescript
// Current urgency mapping in skill matching:
CASE
  WHEN r.urgency = 'high' THEN 3
  WHEN r.urgency = 'medium' THEN 2
  ELSE 1
END as urgency_priority

// To add 'critical' level:
CASE
  WHEN r.urgency = 'critical' THEN 4
  WHEN r.urgency = 'high' THEN 3
  WHEN r.urgency = 'medium' THEN 2
  ELSE 1
END as urgency_priority
```

### Implement Auto-Matching Algorithm

```typescript
// src/services/matcher.ts
export async function autoMatchRequests() {
  // 1. Get all open requests
  const requests = await query(
    `SELECT * FROM requests.help_requests WHERE status = 'open'`
  );

  for (const request of requests.rows) {
    // 2. Find users with matching skills in same community
    const potentialHelpers = await query(
      `SELECT DISTINCT u.id, u.name
      FROM auth.users u
      INNER JOIN communities.members m ON u.id = m.user_id
      INNER JOIN auth.user_skills s ON u.id = s.user_id
      WHERE m.community_id = $1
        AND m.status = 'active'
        AND u.id != $2
        AND (
          -- Skill matching logic
          (r.category = 'moving' AND s.skill IN ('moving', 'handyman'))
          -- ... etc
        )`,
      [request.community_id, request.requester_id]
    );

    // 3. Create match suggestions (store in new table)
    for (const helper of potentialHelpers.rows) {
      await query(
        `INSERT INTO requests.match_suggestions
          (request_id, suggested_helper_id, score)
        VALUES ($1, $2, $3)`,
        [request.id, helper.id, calculateMatchScore(request, helper)]
      );
    }
  }
}
```

### Add Location-Based Matching

1. **Add location to requests:**
```sql
ALTER TABLE requests.help_requests
ADD COLUMN location POINT,
ADD COLUMN max_distance_km DECIMAL(5,2) DEFAULT 10.0;

-- Create spatial index
CREATE INDEX idx_help_requests_location ON requests.help_requests USING GIST(location);
```

2. **Add location filter to skill matching:**
```typescript
// src/routes/requests.ts - GET /requests/matched/for-user
AND (
  r.location IS NULL
  OR ST_DWithin(
    r.location::geography,
    (SELECT location FROM auth.users WHERE id = $1)::geography,
    r.max_distance_km * 1000
  )
)
```

### Add Request Expiration

1. **Add expiration field:**
```sql
ALTER TABLE requests.help_requests
ADD COLUMN expires_at TIMESTAMP;

-- Auto-expire old requests
UPDATE requests.help_requests
SET status = 'expired'
WHERE status = 'open'
  AND expires_at IS NOT NULL
  AND expires_at < NOW();
```

2. **Create cron job:**
```typescript
// src/cron/expireRequests.ts
import cron from 'node-cron';

// Run every hour
cron.schedule('0 * * * *', async () => {
  const result = await query(
    `UPDATE requests.help_requests
     SET status = 'expired'
     WHERE status = 'open'
       AND expires_at IS NOT NULL
       AND expires_at < NOW()
     RETURNING id`
  );

  for (const request of result.rows) {
    await publishEvent('request_expired', {
      request_id: request.id
    });
  }
});
```

## Security Considerations

### Member-Only Actions
- Only active community members can create requests
- Only active community members can create offers
- Membership verified before allowing post/offer creation

```typescript
// src/routes/requests.ts - Member verification
const memberCheck = await query(
  `SELECT id FROM communities.members
   WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
  [community_id, requester_id]
);

if (memberCheck.rowCount === 0) {
  return res.status(403).json({
    success: false,
    message: 'Only community members can post requests',
  });
}
```

### Requester-Only Updates
- Only the original requester can update/cancel their request
- Prevents unauthorized modification

```typescript
// src/routes/requests.ts - Requester verification
const requestCheck = await query(
  `SELECT requester_id FROM requests.help_requests WHERE id = $1`,
  [id]
);

if (requestCheck.rows[0].requester_id !== user_id) {
  return res.status(403).json({
    success: false,
    message: 'Only the requester can update this request',
  });
}
```

### Self-Match Prevention
- Users cannot match their own requests
- Enforced in match creation

```typescript
// src/routes/matches.ts
if (requestCheck.rows[0].requester_id === responder_id) {
  return res.status(400).json({
    success: false,
    message: 'Cannot respond to your own request',
  });
}
```

### Input Validation
- Required fields validation
- Status transition validation (can't complete already completed request)
- Category validation (should match defined categories)

## Debugging Common Issues

### Skill-based matching returns no results
1. Check user has skills: `SELECT * FROM auth.user_skills WHERE user_id = '...'`
2. Check user is member of communities: `SELECT * FROM communities.members WHERE user_id = '...' AND status = 'active'`
3. Check requests exist in those communities: `SELECT * FROM requests.help_requests WHERE community_id IN (...) AND status = 'open'`
4. Verify category-to-skill mapping matches user's skills
5. Check user is not requester: `... AND r.requester_id != $1`

### Request not appearing in list
1. Check request status: `SELECT status FROM requests.help_requests WHERE id = '...'`
2. Verify community_id filter if applied
3. Check pagination (limit/offset)
4. Verify request hasn't been soft-deleted

### Match creation fails
1. Verify request exists and is 'open': `SELECT id, status FROM requests.help_requests WHERE id = '...'`
2. If using offer, verify offer exists and is 'active': `SELECT id, status FROM requests.help_offers WHERE id = '...'`
3. Check responder is not requester
4. Look for duplicate match error (unique constraint on request_id, offer_id)

### Events not publishing
1. Check Redis connection: Verify REDIS_URL is correct
2. Test Redis: `redis-cli -u $REDIS_URL ping`
3. Check event publisher initialization in server startup logs
4. Verify publishEvent calls are not in try-catch that swallows errors

### Database connection errors
1. Check DATABASE_URL is correct
2. Verify PostgreSQL is running: `docker ps | grep postgres`
3. Test connection: `psql $DATABASE_URL`
4. Check requests schema exists: `\dn` in psql

## Testing

### Manual Testing with curl

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

**Get Matched Requests for User:**
```bash
curl "http://localhost:3003/requests/matched/for-user?user_id=uuid-here&limit=5"
```

**Create Offer:**
```bash
curl -X POST http://localhost:3003/offers \
  -H "Content-Type: application/json" \
  -d '{
    "community_id": "uuid-here",
    "offerer_id": "uuid-here",
    "title": "I can help with moving",
    "description": "Available on weekends, have truck",
    "type": "moving"
  }'
```

**Create Match:**
```bash
curl -X POST http://localhost:3003/matches \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "uuid-here",
    "offer_id": "uuid-here",
    "responder_id": "uuid-here"
  }'
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

### Unit Tests

Run tests:
```bash
npm test
```

Test structure:
```
src/
├── __tests__/
│   ├── requests.test.ts       # Request CRUD and matching tests
│   ├── offers.test.ts         # Offer CRUD tests
│   └── matches.test.ts        # Match creation and completion tests
```

## Performance Considerations

- Skill-based matching query uses INNER JOIN for efficiency
- Indexes on community_id, status, category for fast filtering
- Urgency priority calculated in query (no post-processing)
- Connection pooling for PostgreSQL (max 20 connections)
- Limit default pagination to 50 to prevent large queries

## Future Enhancements (TODO)

- [ ] Auto-matching algorithm (suggest best helpers for requests)
- [ ] Location-based matching (find nearby helpers)
- [ ] Request expiration (auto-cancel old requests)
- [ ] Request templates (common request types)
- [ ] Recurring requests (weekly/monthly help)
- [ ] Multi-helper requests (request needs 3 people)
- [ ] Helper ratings and feedback
- [ ] Request attachments/images
- [ ] Skill proficiency levels (beginner, intermediate, expert)
- [ ] Federation support (cross-instance requests)

## Related Documentation

- Main architecture: `/docs/ARCHITECTURE.md`
- Database schema: `/infrastructure/postgres/init.sql` (lines 91-144)
- Skill matching algorithm: `src/routes/requests.ts:93-112`
- Federation requests: `/docs/FEDERATION_PROTOCOL.md` (section: Federated Requests)
