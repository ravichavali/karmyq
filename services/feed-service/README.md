# Feed Service

The Feed Service provides personalized activity feeds for Karmyq users, surfacing relevant community activity, open requests, and inspiring stories.

## Features

### Feed Composition
- **Your Communities** (60-70%): Recent activity from communities you're part of
- **Suggested Requests** (20-30%): Requests from adjacent communities matching your skills
- **Broader Stories** (10-20%): Inspiring stories from across the platform

### Smart Discovery
- **Adjacent Communities**: Discovers related communities based on:
  - Shared members with your communities
  - Skill overlap
  - Member activity patterns
- **Skill Matching**: Calculates match scores between your skills and request requirements
- **Exploration Levels**: Conservative, Balanced, or Adventurous discovery

### Feed Personalization
- Adapts to user behavior (new users get more exploration)
- Respects user preferences
- Filters dismissed items
- Prioritizes urgent and underserved requests

## API Endpoints

### `GET /feed`
Get personalized feed for user.

**Headers:**
- `x-user-id`: User ID
- `Authorization`: Bearer token

**Query Parameters:**
- `limit`: Number of items (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "community_activity_123",
        "type": "community_activity",
        "priority": 100,
        "created_at": "2025-01-07T...",
        "data": {
          "community_id": 123,
          "community_name": "Web Dev Mentors",
          "exchanges_completed_week": 5,
          "recent_helpers": [...],
          "open_requests_count": 2,
          "new_members_count": 3
        }
      },
      {
        "id": "open_request_456",
        "type": "open_request",
        "priority": 95,
        "created_at": "2025-01-07T...",
        "data": {
          "request_id": 456,
          "title": "Need help with React",
          "description": "...",
          "urgency": "high",
          ...
        }
      }
    ],
    "count": 15
  }
}
```

### `GET /feed/requests`
Get just open requests from user's communities.

**Query Parameters:**
- `community_id`: Filter by specific community (optional)
- `limit`: Number of items (default: 10)

### `POST /feed/dismiss/:itemId`
Dismiss a feed item (won't show again for 7 days).

### `GET /feed/preferences`
Get user's feed preferences.

### `PUT /feed/preferences`
Update user's feed preferences.

**Body:**
```json
{
  "show_community_activity": true,
  "show_open_requests": true,
  "show_completed_exchanges": false,
  "suggest_adjacent_requests": true,
  "exploration_level": "balanced",
  "show_explanations": true,
  "show_broader_stories": true,
  "allow_public_featuring": true
}
```

## Feed Item Types

### Community Activity
Shows stats and activity from communities you're part of:
- Exchanges completed this week
- Top helpers
- New members
- Open requests count

### Open Request
Actionable request from your communities:
- Request details
- Author info
- Urgency level
- Required skills
- Offers count

### Suggested Request
Request from adjacent community with explanation:
- Why suggested (skill match, community adjacency)
- Match score
- Community context

### Story
Inspiring moments from the platform:
- **First Timer**: Someone's first help
- **Milestone**: 10, 50, 100 helps achieved
- **Pay it Forward**: Chain of helps
- **Unexpected Match**: Unusual skill combinations

## Algorithm Details

### Feed Composition Ratio
Adapts based on user behavior:

**New Users** (≤2 communities, ≤3 helps):
- Your Communities: 40%
- Suggested Requests: 40%
- Broader Stories: 20%

**Active Users** (>10 helps):
- Your Communities: 70%
- Suggested Requests: 20%
- Broader Stories: 10%

**Standard Users**:
- Your Communities: 60%
- Suggested Requests: 25%
- Broader Stories: 15%

### Request Priority Scoring
```typescript
Base Priority: 80

Urgency Boost:
- urgent: +20
- high: +10
- medium: +5
- low: 0

Offer Count Penalty:
- 0 offers: +15
- 1 offer: +5
- 2+ offers: 0

Recency Boost:
- <2 hours: +10
- <24 hours: +5
- older: 0
```

### Adjacent Community Discovery
Relevance score calculation:
```typescript
score = (shared_members * 2) + (shared_skills * 3) + member_overlap
```

Filtered by exploration level:
- Conservative: score * 0.5
- Balanced: score * 1.0
- Adventurous: score * 1.5

## Database Schema

### `feed.preferences`
Stores user feed preferences.

### `feed.dismissed_items`
Tracks dismissed items (7-day expiration).

## Environment Variables

```env
NODE_ENV=development
PORT=3007
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
COMMUNITY_API_URL=http://community-service:3002
REQUEST_API_URL=http://request-service:3003
REPUTATION_API_URL=http://reputation-service:3004
AUTH_API_URL=http://auth-service:3001
LOG_LEVEL=info
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Run in production
npm start

# Run tests
npm test
```

## Docker

```bash
# Build image
docker build -t karmyq-feed-service .

# Run container
docker run -p 3007:3007 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  karmyq-feed-service
```

## Design Philosophy

### Non-Performative
- No likes, reactions, or engagement metrics
- Stories are curated, not popularity contests
- Focus on impact over metrics

### Transparent Matching
- Always explain why something is suggested
- Show match scores and reasoning
- User can control exploration level

### Respectful of Time
- Not real-time (no FOMO)
- User-triggered refresh
- Dismissed items stay hidden

### Privacy-First
- Users can opt out of public featuring
- Control what details are shared
- Community-specific visibility options

## Future Enhancements

- [ ] Machine learning for better skill matching
- [ ] A/B testing for feed composition ratios
- [ ] Collaborative filtering for adjacent communities
- [ ] Weekly digest emails
- [ ] Mobile push notifications for urgent requests
- [ ] Feed analytics dashboard

## Related Services

- **Community Service**: Provides community membership data
- **Request Service**: Provides open requests
- **Reputation Service**: Provides user skills (inferred from helps)
- **Auth Service**: Provides user data

---

**Port:** 3007
**Health Check:** `GET /health`
**Version:** 1.0.0
