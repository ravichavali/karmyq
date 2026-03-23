# Feed Service Context

> **Quick Start**: `cd services/feed-service && npm run dev`
> **Port**: 3007 | **Health**: http://localhost:3007/health

## Purpose

Generates personalized activity feed for users showing community updates, open requests, and stories. Uses adaptive algorithms to balance exploration (discovering new content) and exploitation (familiar content).

## Database Schema

### Tables Owned by This Service

```sql
-- feed.preferences
CREATE TABLE feed.preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    show_community_activity BOOLEAN DEFAULT true,
    show_open_requests BOOLEAN DEFAULT true,
    show_completed_exchanges BOOLEAN DEFAULT false,
    suggest_adjacent_requests BOOLEAN DEFAULT true,
    exploration_level VARCHAR(20) DEFAULT 'balanced' CHECK (exploration_level IN ('conservative', 'balanced', 'adventurous')),
    show_explanations BOOLEAN DEFAULT true,      -- Show why item is in feed
    show_broader_stories BOOLEAN DEFAULT true,   -- Stories from platform
    allow_public_featuring BOOLEAN DEFAULT true, -- Allow featuring in public stories
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- feed.dismissed_items
CREATE TABLE feed.dismissed_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL,             -- 'request', 'story', etc.
    item_id VARCHAR(255) NOT NULL,
    dismissed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, item_type, item_id)
);

-- Indexes
CREATE INDEX idx_dismissed_items_user ON feed.dismissed_items(user_id);
```

**Social Karma v2.0 Schema Extensions:**

```sql
-- Add new privacy and metrics preferences
ALTER TABLE feed.preferences
ADD COLUMN show_community_metrics BOOLEAN DEFAULT true,
ADD COLUMN show_milestone_celebrations BOOLEAN DEFAULT true,
ADD COLUMN show_anonymous_stories BOOLEAN DEFAULT true;

-- feed.featured_stories (NEW)
CREATE TABLE feed.featured_stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,

    -- Story type
    story_type VARCHAR(50) NOT NULL,

    -- Story content
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,

    -- Referenced entities (nullable depending on story type)
    match_id UUID REFERENCES requests.matches(id) ON DELETE CASCADE,
    category VARCHAR(100),

    -- Privacy controls
    is_anonymous BOOLEAN DEFAULT true,
    requester_name VARCHAR(255),
    responder_name VARCHAR(255),

    -- Featuring controls
    is_public BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE INDEX idx_featured_stories_community ON feed.featured_stories(community_id);
CREATE INDEX idx_featured_stories_type ON feed.featured_stories(story_type);
CREATE INDEX idx_featured_stories_created ON feed.featured_stories(created_at);
```

### Tables Read by This Service
- `communities.members` - User's communities
- `requests.help_requests` - Open requests
- `requests.matches` - Completed exchanges
- `reputation.karma_records` - User activity
- `auth.users` - User details

## Feed Composition Algorithm

### Adaptive Ratios

The feed adjusts based on user behavior:

**New Users** (≤2 communities, ≤3 helps):
- 40% Your Communities
- 40% Suggested Requests
- 20% Broader Stories

**Active Users** (>10 helps):
- 70% Your Communities
- 20% Suggested Requests
- 10% Broader Stories

**Standard** (default):
- 60% Your Communities
- 25% Suggested Requests
- 15% Broader Stories

**Implementation:** `src/services/feedComposer.ts:calculateFeedRatio()`

### Exploration Levels

Users can control how adventurous their feed is:

| Level | Description | Adjacent Communities |
|-------|-------------|----------------------|
| conservative | Only my communities | 0 |
| balanced | Some adjacent suggestions | 1-2 |
| adventurous | Explore widely | 3+ |

**Implementation:** `src/services/feedComposer.ts:getAdjacentCommunities()`

### Boost Scoring (Sprint 36)

Requests with an active admin boost (`is_boosted = TRUE AND boosted_expires_at > NOW()` on `requests.help_requests`) receive a **+0.3 score bonus** applied after all other scoring factors, capped at a maximum of 1.0. This allows community admins to surface urgent or high-priority requests regardless of their base match score.

The boost flag is set via `POST /requests/:id/boost` in the request-service and expires automatically after 48 hours.

## API Endpoints

### GET /feed
Get personalized feed for user.

**Headers:**
```
x-user-id: user-uuid
```

**Query Parameters:**
- `limit` - Max items (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "type": "open_request",
        "data": {
          "request_id": "uuid",
          "title": "Need help moving couch",
          "category": "moving",
          "urgency": "high",
          "community_name": "Seattle Mutual Aid",
          "requester_name": "Alice Smith"
        },
        "explanation": "Matches your moving skill",
        "created_at": "2025-01-10T12:00:00Z"
      },
      {
        "id": "uuid",
        "type": "community_activity",
        "data": {
          "community_id": "uuid",
          "community_name": "Seattle Mutual Aid",
          "activity_type": "new_member",
          "member_name": "Charlie Brown"
        },
        "explanation": "Activity in your community",
        "created_at": "2025-01-10T11:00:00Z"
      }
    ],
    "count": 2
  }
}
```

**Implementation:** `src/routes/feed.ts:GET /`

### POST /feed/dismiss
Dismiss item from feed.

**Request:**
```json
{
  "user_id": "uuid",
  "item_type": "request",
  "item_id": "request-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Item dismissed"
}
```

**Implementation:** `src/routes/feed.ts:POST /dismiss`

### GET /feed/preferences
Get user's feed preferences.

**Response:**
```json
{
  "success": true,
  "data": {
    "show_community_activity": true,
    "show_open_requests": true,
    "show_completed_exchanges": false,
    "suggest_adjacent_requests": true,
    "exploration_level": "balanced",
    "show_explanations": true,
    "show_broader_stories": true,
    "allow_public_featuring": true
  }
}
```

### PUT /feed/preferences
Update feed preferences.

**Request:**
```json
{
  "exploration_level": "adventurous",
  "show_community_activity": true,
  "show_explanations": false
}
```

## Feed Item Types

| Type | Description | Source |
|------|-------------|--------|
| `community_activity` | New members, norms | User's communities |
| `open_request` | Help requests needing responses | User's communities + adjacent |
| `suggested_request` | Requests matching user skills | Skill-based matching |
| `story` | Completed exchanges worth celebrating | Platform-wide |

## Key Files

- `src/index.ts` - Express server setup
- `src/routes/feed.ts` - Feed API endpoints
- `src/services/feedComposer.ts` - **Feed algorithm implementation**
- `src/database/db.ts` - PostgreSQL connection pool

## Environment Variables

```bash
PORT=3007
DATABASE_URL=postgresql://user:password@localhost:5432/karmyq_db
NODE_ENV=development
LOG_LEVEL=info
```

## Common Development Tasks

### Change Feed Ratios

Edit ratios in `src/services/feedComposer.ts`:

```typescript
export class FeedComposer {
  async calculateFeedRatio(userId: string): Promise<FeedComposition> {
    const behavior = await this.getUserBehavior(userId);

    if (behavior.communities_count <= 2) {
      return {
        your_communities: 50,      // Changed from 40
        suggested_requests: 30,    // Changed from 40
        broader_stories: 20
      };
    }

    // ... other ratios
  }
}
```

### Add New Feed Item Type

1. **Update FeedComposer:**
```typescript
// src/services/feedComposer.ts
async composeFeed(userId: string, limit: number): Promise<FeedItem[]> {
  // ... existing items

  // Add new item type
  const newItems = await this.getNewItemType(userId, allocation.new_items);
  feedItems.push(...newItems);

  return this.shuffleAndLimit(feedItems, limit);
}

private async getNewItemType(userId: string, count: number) {
  // Query database for new item type
  // Return formatted feed items
}
```

2. **Update API Response:**
Client will automatically receive new item type in feed.

### Add Filtering

```typescript
// src/routes/feed.ts
router.get('/', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const category = req.query.category; // Add filter

  const composer = new FeedComposer();
  let feed = await composer.composeFeed(userId, limit);

  // Filter by category
  if (category) {
    feed = feed.filter(item =>
      item.data.category === category
    );
  }

  res.json({ success: true, data: { items: feed } });
});
```

## Security Considerations

- User can only see feed for their own user_id
- Dismissed items excluded from feed
- No sensitive data exposed (respects community membership)
- Skill-based suggestions only from accessible communities

## Performance Considerations

- **Current Status:** Returns empty feed (schema mismatch TODO)
- Feed composition requires multiple queries
- Consider caching user behavior calculations
- Limit default to 20 items to control query size

**Note:** The feed composer currently has schema mismatches with the database:
- References `requests.requests` (should be `requests.help_requests`)
- Uses `helper_id`/`helpee_id` (should be `responder_id`/`requester_id`)
- References `matching.matches` (should be `requests.matches`)

**See:** `src/services/feedComposer.ts` TODO comments

## Future Enhancements (TODO)

- [ ] Fix schema references in feedComposer.ts
- [ ] Add caching layer (Redis)
- [ ] Machine learning for personalization
- [ ] A/B testing for feed ratios
- [ ] Engagement metrics (click-through tracking)
- [ ] Real-time feed updates (via WebSocket)

## Related Documentation

- Database schema: `/infrastructure/postgres/init.sql` (lines 375-397)
- Feed composer: `src/services/feedComposer.ts`
- Feed algorithm design: Explore/exploit balance
