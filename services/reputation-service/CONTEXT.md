# Reputation Service Context

> **Quick Start**: `cd services/reputation-service && npm run dev`
> **Port**: 3004 | **Health**: http://localhost:3004/health

## Purpose

Manages user karma points, trust scores, and badges within communities. Automatically awards karma when help exchanges are completed. Prevents gaming the system through milestone bonuses and trust score calculations.

## Database Schema

### Tables Owned by This Service

```sql
-- reputation.karma_records
CREATE TABLE reputation.karma_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities.communities(id),
    points INTEGER NOT NULL,               -- Karma points awarded/deducted
    reason VARCHAR(255) NOT NULL,          -- 'Provided help', 'Received help', etc.
    related_entity_id UUID,                -- match_id or other reference
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- reputation.trust_scores
CREATE TABLE reputation.trust_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities.communities(id),
    score INTEGER DEFAULT 50,              -- Trust score 0-100
    requests_completed INTEGER DEFAULT 0,  -- Number of help requests completed
    offers_accepted INTEGER DEFAULT 0,     -- Number of times helped others
    average_feedback NUMERIC(3,2) DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, community_id)         -- One score per user per community
);

-- reputation.badges
CREATE TABLE reputation.badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    badge_type VARCHAR(100) NOT NULL,      -- 'First Help', 'Milestone 10', etc.
    badge_name VARCHAR(255) NOT NULL,
    description TEXT,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_karma_records_user_id ON reputation.karma_records(user_id);
CREATE INDEX idx_karma_records_community_id ON reputation.karma_records(community_id);
CREATE INDEX idx_trust_scores_user_community ON reputation.trust_scores(user_id, community_id);
```

### Tables Read by This Service
- `auth.users` - User names for leaderboards
- `communities.communities` - Community names for karma history
- `requests.help_requests` - Get community_id from request when match completed

## Karma Points Configuration

Karma points are awarded automatically when help exchanges are completed:

| Action | Points | Description |
|--------|--------|-------------|
| Provided Help | 10 | Awarded to helper when match completed |
| Received Help | 5 | Awarded to requester when match completed |
| First Help Bonus | 15 | Bonus for first time helping in a community |
| 10 Exchanges Milestone | 25 | Bonus for completing 10 help exchanges |
| 50 Exchanges Milestone | 50 | Bonus for completing 50 help exchanges |
| 100 Exchanges Milestone | 100 | Bonus for completing 100 help exchanges |

**Configuration:** `src/services/karmaService.ts:11-18`

## Trust Score Calculation

Trust score ranges from 0-100 and is calculated per community:

- **Base score:** 50 (everyone starts here)
- **Karma contribution:** min(50, floor(total_karma / 10))
- **Final score:** 50 + karma_contribution

**Example:**
- User with 0 karma: score = 50
- User with 100 karma: score = 60
- User with 500 karma: score = 100 (maxed out)

**Implementation:** `src/services/karmaService.ts:152-154`

## API Endpoints

### GET /reputation/karma/:userId
Get user's total karma across all communities.

**Query Parameters:**
- `community_id` - Filter by specific community (optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "total_karma": 145,
    "by_community": [
      {
        "community_id": "uuid",
        "total_karma": "100",
        "transaction_count": "12"
      },
      {
        "community_id": "uuid",
        "total_karma": "45",
        "transaction_count": "5"
      }
    ]
  }
}
```

**Implementation:** `src/routes/reputation.ts:8`

### GET /reputation/trust/:userId/:communityId
Get user's trust score in a specific community.

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "community_id": "uuid",
    "score": 75,
    "requests_completed": 8,
    "offers_accepted": 12,
    "average_feedback": 4.5,
    "last_updated": "2025-01-10T12:00:00Z"
  }
}
```

**Implementation:** `src/routes/reputation.ts:37`

**Note:** Returns default score of 50 if user has no trust score yet.

### GET /reputation/leaderboard/:communityId
Get top karma earners in a community.

**Query Parameters:**
- `limit` - Max results (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "user_id": "uuid",
      "name": "Alice Smith",
      "total_karma": "250",
      "trust_score": 90,
      "requests_completed": 15,
      "offers_accepted": 20
    },
    {
      "user_id": "uuid",
      "name": "Bob Johnson",
      "total_karma": "180",
      "trust_score": 80,
      "requests_completed": 10,
      "offers_accepted": 15
    }
  ]
}
```

**Implementation:** `src/routes/reputation.ts:58`

**Note:** Ordered by total_karma DESC, limited to top N users.

### GET /reputation/history/:userId
Get karma transaction history for a user.

**Query Parameters:**
- `community_id` - Filter by community (optional)
- `limit` - Max results (default: 50)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "points": 10,
      "reason": "Provided help",
      "related_entity_id": "match-uuid",
      "created_at": "2025-01-10T12:00:00Z",
      "community_id": "uuid",
      "community_name": "Seattle Mutual Aid"
    },
    {
      "id": "uuid",
      "points": 15,
      "reason": "First help in community",
      "related_entity_id": "match-uuid",
      "created_at": "2025-01-10T12:00:00Z",
      "community_id": "uuid",
      "community_name": "Seattle Mutual Aid"
    }
  ],
  "count": 2
}
```

**Implementation:** `src/routes/reputation.ts:80`

### GET /reputation/badges/:userId
Get all badges earned by a user.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "badge_type": "milestone",
      "badge_name": "10 Exchanges",
      "description": "Completed 10 help exchanges",
      "earned_at": "2025-01-10T12:00:00Z"
    }
  ]
}
```

**Implementation:** `src/routes/reputation.ts:129`

### GET /health
Service health check.

**Response:**
```json
{
  "service": "reputation-service",
  "status": "healthy",
  "timestamp": "2025-01-10T12:00:00Z"
}
```

## Event-Driven Architecture

The reputation service automatically awards karma by listening to events from other services.

### Events Consumed

**match_completed** - Triggers karma award

When a match is completed, the reputation service:

1. Awards 10 points to the helper (responder)
2. Awards 5 points to the requester
3. Checks if this is helper's first help in the community (+15 bonus)
4. Checks for milestone bonuses (10, 50, 100 exchanges)
5. Updates trust scores for both users

**Event Handler:** `src/events/subscriber.ts:12`

**Karma Award Logic:** `src/services/karmaService.ts:20-106`

**Event Payload:**
```json
{
  "event": "match_completed",
  "payload": {
    "match_id": "uuid",
    "request_id": "uuid",
    "requester_id": "uuid",
    "responder_id": "uuid"
  }
}
```

## Dependencies

### Calls (Outbound)
- Request Service (via database) - Get community_id from request when match completed

### Called By (Inbound)
- Frontend (to display karma, trust scores, leaderboards)
- Feed Service (to get user reputation for feed explanations)

### Events Published
- None (reputation service only consumes events)

### Events Consumed
- `match_completed` - Award karma when help exchange completed

### External Dependencies
- PostgreSQL (reputation schema)
- Redis (event subscription via Bull queue)

## Environment Variables

```bash
# Server
PORT=3004
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
- `src/index.ts` - Express app initialization, event subscriber setup

### Routes
- `src/routes/reputation.ts` - Karma, trust score, leaderboard, badges endpoints

### Services
- `src/services/karmaService.ts` - Karma award logic, trust score calculation

### Events
- `src/events/subscriber.ts` - Listens to match_completed events

### Database
- `src/database/db.ts` - PostgreSQL connection pool

## Common Development Tasks

### Change Karma Point Values

Edit karma configuration:

```typescript
// src/services/karmaService.ts
const KARMA_CONFIG = {
  HELP_PROVIDED: 15,    // Changed from 10
  HELP_RECEIVED: 10,    // Changed from 5
  FIRST_HELP: 20,       // Changed from 15
  MILESTONE_10: 30,     // Changed from 25
  MILESTONE_50: 75,     // Changed from 50
  MILESTONE_100: 150,   // Changed from 100
};
```

### Add New Karma Reason

1. **Add to karma award logic:**
```typescript
// src/services/karmaService.ts
export async function awardKarmaForNewReason(data: any) {
  await recordKarma({
    user_id: data.user_id,
    community_id: data.community_id,
    points: 5,
    reason: 'New reason description',
    related_entity_id: data.entity_id,
  });

  // Update trust score
  await updateTrustScore(data.user_id, data.community_id);
}
```

2. **Subscribe to new event:**
```typescript
// src/events/subscriber.ts
eventQueue.process('new_event_name', async (job) => {
  const { payload } = job.data;
  await awardKarmaForNewReason(payload);
});
```

### Add New Milestone

```typescript
// src/services/karmaService.ts - In awardKarmaForCompletedMatch
const totalHelps = parseInt(helperHistory.rows[0].count);

// Add new milestone
if (totalHelps === 250) {
  await recordKarma({
    user_id: responder_id,
    community_id,
    points: 250,
    reason: '250 exchanges milestone',
    related_entity_id: match_id,
  });
}
```

### Change Trust Score Algorithm

```typescript
// src/services/karmaService.ts - In updateTrustScore

// Current algorithm:
const karma_contribution = Math.min(50, Math.floor(total_karma / 10));
const score = 50 + karma_contribution;

// Alternative: Logarithmic scaling
const karma_contribution = Math.min(50, Math.floor(Math.log10(total_karma + 1) * 20));
const score = 50 + karma_contribution;

// Alternative: Exponential diminishing returns
const karma_contribution = Math.min(50, Math.floor(50 * (1 - Math.exp(-total_karma / 500))));
const score = 50 + karma_contribution;
```

### Add Feedback/Rating System

1. **Create feedback table:**
```sql
-- infrastructure/postgres/migrations/00X_add_feedback.sql
CREATE TABLE reputation.match_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES requests.matches(id),
  from_user_id UUID NOT NULL REFERENCES auth.users(id),
  to_user_id UUID NOT NULL REFERENCES auth.users(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(match_id, from_user_id)
);
```

2. **Add feedback endpoint:**
```typescript
// src/routes/reputation.ts
router.post('/feedback', async (req, res) => {
  const { match_id, from_user_id, to_user_id, rating, comment } = req.body;

  // Validate match exists and user was part of it
  const match = await query(
    `SELECT requester_id, responder_id FROM requests.matches
     WHERE id = $1`,
    [match_id]
  );

  if (!match.rows[0]) {
    return res.status(404).json({ success: false, message: 'Match not found' });
  }

  const { requester_id, responder_id } = match.rows[0];
  if (from_user_id !== requester_id && from_user_id !== responder_id) {
    return res.status(403).json({ success: false, message: 'Not part of this match' });
  }

  // Record feedback
  await query(
    `INSERT INTO reputation.match_feedback
     (match_id, from_user_id, to_user_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5)`,
    [match_id, from_user_id, to_user_id, rating, comment]
  );

  // Update trust score with new average_feedback
  await updateTrustScoreWithFeedback(to_user_id, community_id);

  res.json({ success: true, message: 'Feedback recorded' });
});
```

3. **Update trust score calculation:**
```typescript
// src/services/karmaService.ts
async function updateTrustScoreWithFeedback(user_id: string, community_id: string) {
  // Get average rating
  const feedback = await query(
    `SELECT AVG(rating) as avg_rating
     FROM reputation.match_feedback
     WHERE to_user_id = $1`,
    [user_id]
  );

  const average_feedback = parseFloat(feedback.rows[0].avg_rating || 0);

  // Include in trust score calculation
  const feedback_bonus = Math.floor((average_feedback - 3) * 5); // -10 to +10
  const score = 50 + karma_contribution + feedback_bonus;
}
```

### Implement Badge System

```typescript
// src/services/badgeService.ts
export async function checkAndAwardBadges(user_id: string, community_id: string) {
  const karma = await getUserKarma(user_id, community_id);
  const total_karma = parseInt(karma[0]?.total_karma || 0);

  // Helper badge (10 helps)
  const helperCount = await query(
    `SELECT COUNT(*) as count FROM reputation.karma_records
     WHERE user_id = $1 AND community_id = $2 AND reason = 'Provided help'`,
    [user_id, community_id]
  );

  if (parseInt(helperCount.rows[0].count) === 10) {
    await awardBadge({
      user_id,
      badge_type: 'helper',
      badge_name: 'Community Helper',
      description: 'Helped 10 people in the community',
    });
  }

  // Karma milestones
  if (total_karma >= 100) {
    await awardBadge({
      user_id,
      badge_type: 'karma_milestone',
      badge_name: 'Karma Master',
      description: 'Earned 100+ karma points',
    });
  }
}

async function awardBadge(data: any) {
  // Check if badge already awarded
  const existing = await query(
    `SELECT id FROM reputation.badges
     WHERE user_id = $1 AND badge_type = $2`,
    [data.user_id, data.badge_type]
  );

  if (existing.rowCount > 0) return;

  // Award badge
  await query(
    `INSERT INTO reputation.badges
     (user_id, badge_type, badge_name, description)
     VALUES ($1, $2, $3, $4)`,
    [data.user_id, data.badge_type, data.badge_name, data.description]
  );

  // Publish event
  await publishEvent('badge_earned', {
    user_id: data.user_id,
    badge_type: data.badge_type,
  });
}
```

## Security Considerations

### Event-Driven Karma Awards
- Karma can only be awarded through events (not via API)
- Prevents users from manually awarding themselves karma
- All karma awards are auditable in karma_records table

### Automatic Calculation
- Trust scores calculated automatically
- No manual override via API
- Prevents gaming the system

### Milestone Detection
- First help bonus only awarded once per community
- Milestone bonuses only awarded at exact count (10, 50, 100)
- Uses COUNT from karma_records to detect milestones

```typescript
// src/services/karmaService.ts
const helperHistory = await query(
  `SELECT COUNT(*) as count FROM reputation.karma_records
   WHERE user_id = $1 AND community_id = $2 AND reason = 'Provided help'`,
  [responder_id, community_id]
);

if (parseInt(helperHistory.rows[0].count) === 1) {
  // Only award first help bonus if count is exactly 1
  await recordKarma({...});
}
```

### Audit Trail
- Every karma transaction recorded with reason and timestamp
- related_entity_id links to match/event that triggered it
- Full history available via /reputation/history endpoint

## Debugging Common Issues

### Karma not being awarded
1. Check event queue is running: `redis-cli LLEN karmyq-events`
2. Check event subscriber logs for errors
3. Verify match_completed event was published: Check request-service logs
4. Check karma_records table: `SELECT * FROM reputation.karma_records WHERE user_id = '...' ORDER BY created_at DESC LIMIT 5`
5. Look for error logs in reputation service

### Trust score not updating
1. Check trust_scores table: `SELECT * FROM reputation.trust_scores WHERE user_id = '...' AND community_id = '...'`
2. Verify karma_records exist for user in community
3. Check updateTrustScore was called (logs should show "Karma awarded")
4. Recalculate manually:
```sql
-- Check total karma
SELECT SUM(points) FROM reputation.karma_records WHERE user_id = '...' AND community_id = '...';

-- Manually trigger update (via API)
-- Award any karma and it will recalculate
```

### Leaderboard empty or incorrect
1. Check karma_records exist: `SELECT COUNT(*) FROM reputation.karma_records WHERE community_id = '...'`
2. Verify trust_scores exist: `SELECT COUNT(*) FROM reputation.trust_scores WHERE community_id = '...'`
3. Check JOIN is working: Run leaderboard query manually in psql
4. Verify community_id is correct

### Milestone bonus not awarded
1. Check exact count: `SELECT COUNT(*) FROM reputation.karma_records WHERE user_id = '...' AND community_id = '...' AND reason = 'Provided help'`
2. Verify milestone only triggers at exact count (10, 50, 100)
3. Check if milestone was already awarded: `SELECT * FROM reputation.karma_records WHERE reason LIKE '%milestone%' AND user_id = '...'`

### Redis connection errors
1. Check REDIS_URL is correct
2. Verify Redis is running: `redis-cli -u $REDIS_URL ping`
3. Check event subscriber initialization in logs
4. Test queue connection: `redis-cli LLEN karmyq-events`

## Testing

### Manual Testing with curl

**Get User Karma:**
```bash
curl "http://localhost:3004/reputation/karma/uuid-here"
```

**Get User Karma in Specific Community:**
```bash
curl "http://localhost:3004/reputation/karma/uuid-here?community_id=community-uuid"
```

**Get Trust Score:**
```bash
curl "http://localhost:3004/reputation/trust/user-uuid/community-uuid"
```

**Get Leaderboard:**
```bash
curl "http://localhost:3004/reputation/leaderboard/community-uuid?limit=20"
```

**Get Karma History:**
```bash
curl "http://localhost:3004/reputation/history/user-uuid?limit=10"
```

**Simulate Match Completion (triggers karma award):**
```bash
# Use Redis CLI to publish event
redis-cli LPUSH karmyq-events '{"event":"match_completed","payload":{"match_id":"uuid","request_id":"uuid","requester_id":"uuid","responder_id":"uuid"}}'
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
│   ├── karma.test.ts          # Karma award logic tests
│   ├── trustScore.test.ts     # Trust score calculation tests
│   └── events.test.ts         # Event subscription tests
```

## Performance Considerations

- Karma award logic runs in background queue (doesn't block match completion)
- Trust score updates use UPSERT (ON CONFLICT) for efficiency
- Leaderboard query uses LEFT JOIN and GROUP BY (indexed on community_id)
- Connection pooling for PostgreSQL (max 20 connections)
- Event queue processes one match_completed at a time (prevents race conditions)

## Future Enhancements (TODO)

- [ ] Feedback/rating system for matches
- [ ] Negative karma for reported issues
- [ ] Badge system implementation
- [ ] Decay factor for old karma (time-weighted reputation)
- [ ] Reputation portability across communities
- [ ] Advanced trust score algorithm (incorporate feedback ratings)
- [ ] Karma leaderboard across all communities
- [ ] Reputation-based privileges (verified helpers, trusted requesters)
- [ ] Federation support (federated reputation scores)

## Related Documentation

- Main architecture: `/docs/ARCHITECTURE.md`
- Database schema: `/infrastructure/postgres/init.sql` (lines 140-181)
- Karma configuration: `src/services/karmaService.ts:11-18`
- Federation reputation: `/docs/FEDERATION_PROTOCOL.md` (section: Federated Reputation)
