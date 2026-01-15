# Social Graph & Trust Paths Feature

**Status**: 📋 Planned
**Priority**: High (Core Trust Mechanism)
**Target Version**: v7.0.0
**Last Updated**: 2025-12-27

---

## Executive Summary

Transform Karmyq from "mutual aid platform" to **"helping your extended family"** by visualizing social connections and using invitation paths as a primary trust signal.

### Core Principle
**"Trust flows through relationships"** - Show users how they're connected to each other through invitation chains, rank feed items by social proximity, and make the invitation graph transparent.

---

## Problem Statement

### Current State
- Users see requests from strangers with no context
- Trust is built solely through karma points (impersonal)
- No way to know if requester is "vouched for" by someone you know
- Feed ranking is generic (time-based or distance-based)

### User Pain Points
1. **Hesitation to help strangers**: "I don't know this person, should I help them?"
2. **No context about requester**: "Are they part of my community?"
3. **Missed relevant requests**: Requests from friends-of-friends buried under distant requests
4. **Weak network effects**: No incentive to invite quality people

---

## Solution Overview

### Visual Trust Paths
Show the invitation chain between any two users:
```
You → Mike Chen → Sarah Rodriguez (2 degrees)
     ↑ invited 3 weeks ago  ↑ invited 5 days ago
```

### Smart Feed Ranking
Prioritize requests by social proximity + skill match:
```
Priority Algorithm:
1. Direct connections (1°) + skill match + high karma
2. 2nd degree (2°) + skill match + high karma
3. Direct connections (1°) + any request
4. 3rd degree (3°) + skill match
5. Geographic proximity (<5 mi) + skill match
6. High karma (>80) in community
7. Rest of community (time-based)
```

### Path Selection Strategy
When multiple paths exist between two users:
- **Same length**: Show highest trust path (sum of invitee karma scores)
- **Different lengths**: Show shortest path (fewest hops)
- **Max depth**: 4 degrees (beyond this, don't show connection)

---

## Technical Architecture

### Database Schema

#### New Tables

```sql
-- Track invitation graph
CREATE TABLE auth.user_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invitee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invited_at TIMESTAMP NOT NULL DEFAULT NOW(),
    invitation_code TEXT UNIQUE NOT NULL,
    invitation_accepted_at TIMESTAMP,
    community_id UUID NOT NULL REFERENCES community.communities(id),

    -- Metadata
    invitation_method VARCHAR(50), -- 'email', 'sms', 'link', 'qr_code'
    inviter_note TEXT, -- Optional message from inviter

    UNIQUE(inviter_id, invitee_id, community_id),

    -- Indexes
    CREATE INDEX idx_invitations_inviter ON auth.user_invitations(inviter_id),
    CREATE INDEX idx_invitations_invitee ON auth.user_invitations(invitee_id),
    CREATE INDEX idx_invitations_community ON auth.user_invitations(community_id),
    CREATE INDEX idx_invitations_accepted ON auth.user_invitations(invitation_accepted_at)
);

-- Precomputed social distances (performance optimization)
CREATE TABLE auth.social_distances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_a_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_b_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES community.communities(id),

    -- Path information
    degrees_of_separation INTEGER NOT NULL CHECK (degrees_of_separation >= 1 AND degrees_of_separation <= 4),
    shortest_path JSONB NOT NULL, -- Array of user IDs: ["user_a", "intermediary_1", ..., "user_b"]
    highest_trust_path JSONB, -- Alternative path with highest total karma
    path_trust_score INTEGER, -- Sum of karma scores along highest_trust_path

    -- Cache metadata
    computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '7 days',

    UNIQUE(user_a_id, user_b_id, community_id),

    -- Indexes
    CREATE INDEX idx_social_distances_user_a ON auth.social_distances(user_a_id),
    CREATE INDEX idx_social_distances_user_b ON auth.social_distances(user_b_id),
    CREATE INDEX idx_social_distances_community ON auth.social_distances(community_id),
    CREATE INDEX idx_social_distances_degrees ON auth.social_distances(degrees_of_separation),
    CREATE INDEX idx_social_distances_expires ON auth.social_distances(expires_at)
);

-- Invitation quality tracking (gamification)
CREATE TABLE auth.inviter_stats (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES community.communities(id),

    -- Invitation metrics
    total_invitations_sent INTEGER DEFAULT 0,
    total_invitations_accepted INTEGER DEFAULT 0,
    acceptance_rate DECIMAL(5,2), -- Percentage

    -- Invitee quality metrics
    avg_invitee_karma DECIMAL(5,2),
    avg_invitee_trust_score DECIMAL(5,2),
    total_invitee_exchanges INTEGER, -- Sum of all exchanges by invitees

    -- Network impact
    total_network_size INTEGER, -- Total people reachable within 3 degrees
    bridge_score INTEGER, -- How many disconnected communities this user connects

    -- Quality tier
    inviter_tier VARCHAR(20), -- 'bronze', 'silver', 'gold', 'platinum'
    tier_updated_at TIMESTAMP,

    -- Computed metadata
    last_computed TIMESTAMP DEFAULT NOW(),

    UNIQUE(user_id, community_id),

    CREATE INDEX idx_inviter_stats_tier ON auth.inviter_stats(inviter_tier),
    CREATE INDEX idx_inviter_stats_community ON auth.inviter_stats(community_id)
);
```

#### Schema Updates

```sql
-- Add invitation tracking to users table
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMP;

-- Add privacy settings
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS show_connection_path BOOLEAN DEFAULT true;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS show_who_invited_me BOOLEAN DEFAULT true;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS show_who_i_invited BOOLEAN DEFAULT false;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_invited_by ON auth.users(invited_by);
```

---

## API Endpoints

### New Social Graph Service (Port 3010)

```javascript
// GET /api/social/path/:userId
// Get shortest path between current user and target user
{
  "path": [
    { "id": "user-123", "name": "You", "avatar": "..." },
    { "id": "user-456", "name": "Mike Chen", "karma": 87, "invited_at": "2024-11-15" },
    { "id": "user-789", "name": "Sarah Rodriguez", "karma": 92, "invited_at": "2024-12-20" }
  ],
  "degrees": 2,
  "trust_score": 179, // Sum of intermediate karma scores
  "alternative_paths": [
    // Other paths with same or similar length
  ]
}

// GET /api/social/network-stats
// Get current user's network statistics
{
  "direct_connections": 12,
  "second_degree": 87,
  "third_degree": 342,
  "total_reachable": 441,
  "inviter_tier": "gold",
  "invitations_sent": 8,
  "invitations_accepted": 7,
  "avg_invitee_karma": 78.5
}

// GET /api/social/invitations
// Get user's invitation history
{
  "sent": [
    {
      "invitee_id": "user-789",
      "invitee_name": "Sarah Rodriguez",
      "invited_at": "2024-12-20",
      "accepted_at": "2024-12-21",
      "current_karma": 92
    }
  ],
  "received": {
    "inviter_id": "user-456",
    "inviter_name": "Mike Chen",
    "invited_at": "2024-11-15",
    "accepted_at": "2024-11-15"
  }
}

// POST /api/social/generate-invite-code
// Generate new invitation code
{
  "code": "KARMYQ-MIKE-2024-A7B3",
  "url": "https://karmyq.com/invite/KARMYQ-MIKE-2024-A7B3",
  "qr_code": "data:image/png;base64,...",
  "expires_at": "2025-01-27T00:00:00Z"
}

// GET /api/social/compute-distances/:userId
// Trigger path computation for a specific user (admin/background job)
{
  "computed_paths": 441,
  "duration_ms": 1250,
  "cached_until": "2025-01-03T00:00:00Z"
}
```

### Feed Service Updates

```javascript
// GET /api/feed?ranked=true
// Enhanced feed with social proximity ranking
{
  "requests": [
    {
      "id": "req-123",
      "title": "Need ride to airport",
      "requester": { ... },

      // NEW: Social context
      "social_context": {
        "degrees_of_separation": 2,
        "connection_path": [
          { "name": "You" },
          { "name": "Mike Chen", "relation": "invited you 3 weeks ago" },
          { "name": "Sarah Rodriguez", "relation": "invited by Mike 5 days ago" }
        ],
        "trust_score": 179,
        "distance_miles": 2.3
      },

      // Existing fields...
      "match_score": 95, // Now influenced by social proximity
      "rank_reason": "2nd degree connection + skill match"
    }
  ]
}
```

---

## Implementation Phases

### Phase 1: MVP - Basic Path Tracking (v7.0)
**Effort**: 2-3 weeks | **Value**: High | **Risk**: Low

#### Deliverables
1. **Database**
   - Add `invited_by` column to users table
   - Create `user_invitations` table
   - Migration scripts

2. **Backend**
   - Invitation code generation endpoint
   - Accept invitation endpoint (links inviter/invitee)
   - Basic "who invited me" query

3. **Frontend**
   - Show "Invited by X" on user profiles
   - Generate/share invitation codes
   - Simple 1-degree connection display

4. **Feed Ranking**
   - Boost requests from direct connections (1°) by 50%
   - Add "Connected through X" badge on request cards

**Success Metrics**:
- 80%+ of new users come through invitations (vs. organic signup)
- Requests from 1° connections get 3x more responses

---

### Phase 2: Social Graph Computation (v7.1)
**Effort**: 3-4 weeks | **Value**: Very High | **Risk**: Medium

#### Deliverables
1. **New Service**: Social Graph Service (Port 3010)
   - BFS algorithm for path computation
   - Background job to precompute distances
   - Caching layer (social_distances table)

2. **Algorithm Implementation**
   ```javascript
   function computeShortestPath(userA, userB, communityId) {
     // Bidirectional BFS for efficiency
     // Max depth: 4 degrees
     // Return shortest path + all paths of same length
   }

   function selectBestPath(paths) {
     // If same length: highest trust (sum of karma)
     // Else: shortest path
   }
   ```

3. **Frontend Enhancements**
   - Full path visualization on request cards
   - Degrees of separation badge (1°, 2°, 3°, 4°)
   - Click path to see full user chain

4. **Feed Ranking v2**
   ```javascript
   function calculateMatchScore(request, currentUser) {
     let score = 0;

     // Skill match (0-40 points)
     score += skillMatchScore(request, currentUser);

     // Social proximity (0-30 points)
     const degrees = getDegreesOfSeparation(request.requester, currentUser);
     if (degrees === 1) score += 30;
     else if (degrees === 2) score += 20;
     else if (degrees === 3) score += 10;
     else if (degrees === 4) score += 5;

     // Karma (0-20 points)
     score += (request.requester.karma / 100) * 20;

     // Distance (0-10 points)
     score += getDistanceScore(request.location, currentUser.location);

     return score; // Max 100 points
   }
   ```

**Success Metrics**:
- Feed engagement increases by 40%
- Response time to requests decreases by 30%
- 90% of matched requests are within 3 degrees

---

### Phase 3: Advanced Features (v7.2+)
**Effort**: 4-6 weeks | **Value**: High | **Risk**: Medium

#### Deliverables

1. **Inviter Quality Scoring**
   - Track invitee karma, exchanges, retention
   - Calculate "inviter tier": Bronze/Silver/Gold/Platinum
   - Display tier badge on profiles
   - Leaderboard: "Top Community Builders"

2. **Network Visualization**
   - Interactive graph view: "Your Network"
   - See your invitation tree (who you invited → who they invited)
   - Identify "bridge people" connecting communities

3. **Smart Filtering**
   ```
   Feed Filters:
   ☑ Direct connections (1°)
   ☑ Friends of friends (2°)
   ☐ Extended network (3-4°)
   ☐ Everyone

   ☑ Skill match only
   ☐ Within 10 miles
   ```

4. **Privacy Controls**
   - Settings to hide connection paths
   - "Anonymous requests" that hide requester's social graph
   - Block specific users from seeing your network

5. **Gamification**
   - "Connector" badge (bridge 3+ communities)
   - "Quality Inviter" achievement (avg invitee karma >80)
   - "Network Builder" milestone (invited 10+ people)

**Success Metrics**:
- 50%+ of users have "gold" or higher inviter tier
- Network visualization engagement: 30% weekly active usage
- Privacy concerns: <5% of users hide connection paths

---

## UI/UX Design

### Request Card with Social Context

```
┌─────────────────────────────────────────────────┐
│ 🚗 Need ride to Oakland Airport                │
│                                                 │
│ Sarah Rodriguez · 2 hours ago                   │
│ ⭐ Trust Score: 85 · 🎯 45 karma                │
│                                                 │
│ 📍 Downtown Oakland → OAK                       │
│ ⏰ Tomorrow 3:30 PM · 💺 1 passenger            │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │ 🔗 2nd Degree Connection                │   │
│ │ You → Mike Chen → Sarah Rodriguez       │   │
│ │       ↑3 wks ago    ↑5 days ago         │   │
│ │ Path Trust: 179/200 ⭐⭐⭐⭐⭐         │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ 📏 2.3 miles away · 🎯 Skill match: Driving    │
│                                                 │
│ [👋 Offer Help]  [💬 Message]  [⋯ More]        │
└─────────────────────────────────────────────────┘
```

### User Profile - Social Context

```
┌─────────────────────────────────────────────────┐
│ Sarah Rodriguez                                  │
│ Oakland, CA · Member since Dec 2024              │
│                                                  │
│ ⭐ Trust Score: 85  🎯 Karma: 45                │
│ 🏆 12 exchanges · 💬 Response: <2h              │
│                                                  │
│ ┌─────────────────────────────────────────┐    │
│ │ 🔗 How You're Connected                 │    │
│ │                                          │    │
│ │ Shortest Path (2 degrees):               │    │
│ │ You → Mike Chen → Sarah Rodriguez        │    │
│ │      ↑ invited you     ↑ invited by Mike │    │
│ │      Nov 15, 2024      Dec 20, 2024      │    │
│ │                                          │    │
│ │ Path Trust Score: 179/200 ⭐⭐⭐⭐⭐      │    │
│ │                                          │    │
│ │ [View Full Network] [Hide Connection]    │    │
│ └─────────────────────────────────────────┘    │
│                                                  │
│ 📊 Sarah's Network:                             │
│ • Invited 3 people to Karmyq                    │
│ • Average invitee karma: 67                     │
│ • Network reach: 18 people                      │
│ • Inviter Tier: 🥈 Silver                       │
│                                                  │
│ Skills: Driving, Tech Support, Moving Help      │
│ Available: Weekday evenings, Weekends           │
└─────────────────────────────────────────────────┘
```

### Network Visualization Page

```
┌─────────────────────────────────────────────────┐
│ Your Network · Oakland Community                 │
│                                                  │
│ 📊 Network Stats:                               │
│ • 12 direct connections (1°)                    │
│ • 87 second-degree (2°)                         │
│ • 342 third-degree (3°)                         │
│ • 441 total reachable                           │
│                                                  │
│ 🏆 Your Inviter Tier: 🥇 Gold                  │
│ • 8 invitations sent, 7 accepted (87.5%)       │
│ • Average invitee karma: 78.5                   │
│ • You connect 3 different neighborhoods         │
│                                                  │
│ ┌─────────────────────────────────────────┐    │
│ │        Interactive Network Graph         │    │
│ │                                          │    │
│ │              ● Sarah (92)               │    │
│ │             /                            │    │
│ │    ● Mike (87) ──● Alex (75)           │    │
│ │           \                              │    │
│ │            🔵 YOU                        │    │
│ │           /     \                        │    │
│ │  ● Jordan (81)  ● Lisa (94)             │    │
│ │                                          │    │
│ │ [Filter: 1° 2° 3°]  [Export Network]    │    │
│ └─────────────────────────────────────────┘    │
│                                                  │
│ 🌟 People You Invited:                          │
│ • Mike Chen (87 karma, 15 exchanges)            │
│ • Lisa Park (94 karma, 23 exchanges) ⭐ MVP    │
│ • Jordan Smith (81 karma, 8 exchanges)          │
│                                                  │
│ [Generate Invite Code] [View Leaderboard]       │
└─────────────────────────────────────────────────┘
```

### Feed Filter UI

```
┌─────────────────────────────────────────────────┐
│ 🏠 Feed · Oakland Community                     │
│                                                  │
│ [All Requests ▼] [🔧 Filters]  [🔔 3 new]      │
│                                                  │
│ Active Filters:                                  │
│ ├─ 🔗 My Network Only (1-2 degrees) [×]         │
│ ├─ 🎯 Skill Match [×]                           │
│ └─ 📏 Within 10 miles [×]                       │
│                                                  │
│ Showing 8 requests (ranked by relevance)         │
│                                                  │
│ [Request cards sorted by match score...]         │
└─────────────────────────────────────────────────┘

Filter Modal:
┌─────────────────────────────────────────────────┐
│ Filter Requests                                  │
│                                                  │
│ Social Proximity:                                │
│ ☑ Direct connections (1°) · 5 requests          │
│ ☑ Friends of friends (2°) · 12 requests         │
│ ☐ Extended network (3-4°) · 34 requests         │
│ ☐ Everyone in community · 89 requests           │
│                                                  │
│ Skills:                                          │
│ ☑ Match my skills only                          │
│ ☐ Show all requests                             │
│                                                  │
│ Distance:                                        │
│ ☐ Within 5 miles · 23 requests                  │
│ ☐ Within 10 miles · 47 requests                 │
│ ☑ Any distance                                  │
│                                                  │
│ [Clear All]              [Apply Filters]         │
└─────────────────────────────────────────────────┘
```

---

## Performance Considerations

### Challenge: BFS at Scale

**Problem**: Computing shortest paths for 10,000 users = 100M potential paths

**Solutions**:

1. **Lazy Computation**
   - Only compute paths when users interact (view profile, see request)
   - Cache results for 7 days
   - Background job: precompute for active users

2. **Bidirectional BFS**
   ```javascript
   // Search from both ends simultaneously
   // Reduces search space from O(b^d) to O(2 * b^(d/2))
   function bidirectionalBFS(source, target, maxDepth = 4) {
     const forwardQueue = [source];
     const backwardQueue = [target];
     const forwardVisited = new Set([source]);
     const backwardVisited = new Set([target]);

     while (forwardQueue.length && backwardQueue.length) {
       // Search one level from source
       const fwdNode = forwardQueue.shift();
       if (backwardVisited.has(fwdNode)) return constructPath();

       // Search one level from target
       const bwdNode = backwardQueue.shift();
       if (forwardVisited.has(bwdNode)) return constructPath();
     }
   }
   ```

3. **Graph Partitioning**
   - Partition by community (most paths stay within community)
   - Partition by neighborhood (geographic clustering)
   - Only search across partitions if no path found

4. **Caching Strategy**
   ```javascript
   // social_distances table TTL
   - Active users (logged in last 7 days): Cache for 7 days
   - Inactive users: Cache for 30 days
   - Paths involving new users: Recompute immediately
   - Expired paths: Lazy recomputation on next request
   ```

5. **Database Optimization**
   ```sql
   -- Adjacency list index for fast neighbor lookup
   CREATE INDEX idx_invitations_graph ON user_invitations(inviter_id, invitee_id);

   -- Materialized view for frequently accessed paths
   CREATE MATERIALIZED VIEW active_user_paths AS
   SELECT * FROM social_distances
   WHERE user_a_id IN (SELECT id FROM users WHERE last_login > NOW() - INTERVAL '7 days')
     AND user_b_id IN (SELECT id FROM users WHERE last_login > NOW() - INTERVAL '7 days');

   REFRESH MATERIALIZED VIEW CONCURRENTLY active_user_paths;
   ```

### Performance Targets

| Metric | Target | Max Acceptable |
|--------|--------|----------------|
| Path computation (uncached) | <500ms | <1s |
| Path retrieval (cached) | <50ms | <100ms |
| Feed ranking with social context | <200ms | <500ms |
| Background job (10k users) | <10 min | <30 min |

---

## Privacy & Ethics

### Privacy Settings

**Default**: Transparent (all connection info visible)
**Why**: Transparency builds trust, which is the core value proposition

**User Controls**:
```javascript
{
  "show_connection_path": true,      // Others can see path to me
  "show_who_invited_me": true,       // Show "Invited by X" on profile
  "show_who_i_invited": false,       // Hide my invitees from public
  "allow_path_display_in_feed": true // Show path on request cards
}
```

### Ethical Considerations

1. **Avoid Social Pressure**
   - Don't show "X invited Y but Y has low karma" (blaming)
   - Don't rank users by "inviter quality" publicly
   - Focus on positive reinforcement

2. **Prevent Gaming**
   - Detect "invitation farms" (users inviting fake accounts)
   - Flag suspicious patterns (10+ invites in 1 day, all low karma)
   - Require invitees to complete 1 exchange before inviter gets credit

3. **Bias Mitigation**
   - Don't completely exclude 4+ degree or no-connection users
   - Provide "new member boost" for first 30 days
   - Balance social proximity with other factors (karma, skills, distance)

4. **Data Protection**
   - Social graph data is sensitive (who knows whom)
   - Encrypt invitation codes
   - Don't expose invitation graph via public API
   - Require authentication for all social endpoints

---

## Success Metrics

### Phase 1 KPIs (MVP)
- **Invitation conversion rate**: >70% of codes get accepted
- **Invitation-sourced growth**: >80% of new users come via invites
- **1° connection response rate**: 3x higher than strangers
- **User satisfaction**: "Connection info helpful" >4.5/5 avg rating

### Phase 2 KPIs (Social Graph)
- **Feed engagement**: 40% increase in requests clicked
- **Match quality**: 90% of fulfilled requests within 3 degrees
- **Response time**: 30% faster responses to socially-proximate requests
- **Path cache hit rate**: >95% (most paths precomputed)

### Phase 3 KPIs (Advanced)
- **Network visualization engagement**: 30% MAU (monthly active users)
- **Inviter quality**: 50% of users reach Silver+ tier
- **Bridge recognition**: Top 10% of users labeled "Community Connectors"
- **Privacy adoption**: <10% of users disable connection paths

---

## Migration Plan

### Existing Users Without Invitation Data

**Problem**: Existing users don't have `invited_by` set

**Solutions**:

1. **Email Campaign** (first 2 weeks post-launch)
   ```
   Subject: Who invited you to Karmyq?

   Hi [Name],

   We're building trust through transparency! Help us map our
   community by telling us who invited you to Karmyq.

   [Select Person Who Invited Me ▼]

   Don't remember? That's okay - you'll still be part of the network!
   ```

2. **Graceful Degradation**
   - Users without `invited_by`: Show "Founding Member" badge
   - In feed ranking, treat as "1.5 degrees" (between direct and 2°)
   - Encourage them to retroactively set inviter

3. **Founder's Circle**
   - First 100 users: Special "Founder" badge
   - No social path required (they built the community!)
   - Auto-connect all founders (virtual 1° connections)

### Data Backfill Strategy

```sql
-- Identify likely inviters from early message history
WITH message_sequences AS (
  SELECT
    recipient_id AS likely_invitee,
    sender_id AS likely_inviter,
    MIN(sent_at) AS first_message
  FROM messaging.messages
  GROUP BY recipient_id, sender_id
)
UPDATE auth.users u
SET invited_by = ms.likely_inviter
FROM message_sequences ms
WHERE u.id = ms.likely_invitee
  AND u.invited_by IS NULL
  AND u.created_at - ms.first_message < INTERVAL '7 days';
```

---

## Testing Strategy

### Unit Tests
```javascript
// BFS algorithm correctness
test('finds shortest path between users', () => {
  const path = computeShortestPath(userA, userD);
  expect(path.degrees).toBe(3);
  expect(path.path).toEqual([userA, userB, userC, userD]);
});

// Path selection logic
test('selects highest trust path when same length', () => {
  const paths = [
    { degrees: 2, trust: 150, path: [a, b, c] },
    { degrees: 2, trust: 180, path: [a, x, c] }
  ];
  expect(selectBestPath(paths).trust).toBe(180);
});

// Privacy controls
test('hides path when user disabled show_connection_path', () => {
  user.show_connection_path = false;
  const context = getSocialContext(user, currentUser);
  expect(context.path).toBeNull();
});
```

### Integration Tests
```javascript
// End-to-end path computation
test('computes and caches path for new user pair', async () => {
  const response = await request(app)
    .get('/api/social/path/user-789')
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.degrees).toBe(2);

  // Verify cached
  const cached = await db.query(
    'SELECT * FROM social_distances WHERE user_a_id = $1 AND user_b_id = $2',
    [currentUser.id, 'user-789']
  );
  expect(cached.rows.length).toBe(1);
});

// Feed ranking integration
test('ranks socially-close requests higher', async () => {
  const feed = await request(app)
    .get('/api/feed?ranked=true')
    .set('Authorization', `Bearer ${token}`);

  const firstRequest = feed.body.requests[0];
  expect(firstRequest.social_context.degrees).toBeLessThanOrEqual(2);
});
```

### Performance Tests
```javascript
// Path computation performance
test('computes 1000 paths in under 10 seconds', async () => {
  const start = Date.now();

  for (let i = 0; i < 1000; i++) {
    await computeShortestPath(randomUserA(), randomUserB());
  }

  const duration = Date.now() - start;
  expect(duration).toBeLessThan(10000);
});

// Cache effectiveness
test('cache hit rate above 95% for active users', async () => {
  const stats = await getCacheStats();
  expect(stats.hitRate).toBeGreaterThan(0.95);
});
```

---

## Open Questions & Decisions Needed

### 1. Multiple Paths of Same Length
**Question**: If Alice can reach Bob via two paths of equal length, show both or pick one?

**Options**:
- A) Show only highest trust path (sum of karma)
- B) Show all paths with same length
- C) Let user toggle between paths

**Recommendation**: **A** (highest trust) - keeps UI clean, most users won't care about alternatives

---

### 2. No Connection Path (4+ degrees or unconnected)
**Question**: How to handle users with no path within 4 degrees?

**Options**:
- A) Show "No connection" and hide from feed by default
- B) Show geographic distance only ("2.3 miles away")
- C) Show "Extended network" (vague)
- D) Allow filter toggle: "Show unconnected users"

**Recommendation**: **B + D** - Show distance as fallback trust signal, but allow filtering

---

### 3. Anonymous Requests
**Question**: Should users be able to post anonymous requests (no social path shown)?

**Use Case**: Sensitive help (medical, legal, financial)

**Options**:
- A) No - transparency is core to trust
- B) Yes, but only for certain categories (medical, legal)
- C) Yes, with "Anonymous Request" warning badge

**Recommendation**: **C** - Allow anonymity with clear disclosure

---

### 4. Cross-Community Paths
**Question**: Can paths span multiple communities?

**Scenario**: Alice in Oakland Community invited Bob, Bob joined SF Community and invited Carol

**Options**:
- A) Paths only within single community
- B) Paths can span communities (show community boundaries)
- C) Let community admins decide

**Recommendation**: **B** - Real relationships cross community boundaries

---

### 5. Invitation Code Expiration
**Question**: Should invitation codes expire?

**Options**:
- A) Never expire (simple, user-friendly)
- B) Expire after 30 days (prevents stale codes)
- C) Unlimited use vs. single-use codes

**Recommendation**: **B + C** - Default 30-day expiration, allow "single-use" option for security

---

### 6. Inviter Rewards
**Question**: Should inviters get tangible rewards (karma, badges, perks)?

**Risk**: Could incentivize spam invitations

**Options**:
- A) No rewards - invitation is its own reward
- B) Karma bonus only after invitee completes first exchange
- C) Tiered rewards (Bronze/Silver/Gold) based on invitee quality

**Recommendation**: **C** - Gamification drives adoption, quality gating prevents abuse

---

## Dependencies

### Phase 1
- Auth Service (existing)
- User database schema updates
- Frontend profile pages

### Phase 2
- New Social Graph Service (Port 3010)
- PostgreSQL graph query optimization
- Feed Service updates
- Background job scheduler (Bull/Redis)

### Phase 3
- Data visualization library (D3.js or similar)
- Advanced analytics infrastructure
- Notification Service (for gamification achievements)

---

## Risks & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Performance degradation** with large graphs | High | Medium | Precomputation, caching, bidirectional BFS |
| **Privacy concerns** from transparent social graph | Medium | Low | Granular privacy controls, opt-out options |
| **Gaming** (fake invitations for rewards) | Medium | Medium | Quality gates (1 exchange required), fraud detection |
| **Exclusion** of new/unconnected users | High | Low | "New member boost", don't fully exclude 4+ degrees |
| **Complexity** overwhelming users | Medium | Medium | Progressive disclosure, start with simple UI |

---

## Future Enhancements (Beyond v7.2)

### 1. ML-Based Path Recommendations
Use machine learning to predict "best" path based on:
- Historical collaboration success
- Shared interests/skills
- Communication patterns

### 2. "Introduce Me" Feature
```
"I want to help Sarah with moving, but don't know her.
Could Mike introduce us?"

[Request Introduction] → Sends notification to Mike
```

### 3. Trust Endorsements
Let users endorse connections:
```
Mike vouches for Sarah: "Helped me move twice, super reliable! ⭐⭐⭐⭐⭐"
```

### 4. Community Health Metrics
Track network health:
- Clustering coefficient (how interconnected)
- Average path length (how many degrees)
- Bridge people count (network resilience)

### 5. "Six Degrees of Karmyq"
Gamification: Can you connect to any user in under 6 degrees?
Show leaderboard of most connected users.

---

## Conclusion

The Social Graph & Trust Paths feature is **the secret sauce** that transforms Karmyq from a transactional mutual aid platform into a **trust-based community network**.

By making relationships visible and using social proximity as a primary ranking signal, we:
1. ✅ Build trust through transparency
2. ✅ Create viral network effects (quality invitations matter)
3. ✅ Improve matching (help flows through real relationships)
4. ✅ Differentiate from competitors (unique value proposition)

**Next Steps**:
1. Review and approve this design document
2. Finalize open questions (section above)
3. Create technical implementation tickets for Phase 1
4. Allocate engineering resources (estimated 2-3 weeks)
5. Begin Phase 1 development

---

**Document Revision History**:
- v1.0 (2025-12-27): Initial design document
- Future revisions will be tracked here
