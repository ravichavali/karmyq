# Reputation Service Context

> **Quick Start**: `cd services/reputation-service && npm run dev`
> **Port**: 3004 | **Health**: http://localhost:3004/health

## Recent Changes

- **2026-03-04 (Sprint 14 — Prestige Badges)**: Phase 1 prestige badges implemented (ADR-016). Migration 024 adds `reputation.badges` table. New service: `badgeService.ts` (`checkAndAwardBadges`, `getUserBadges`). Badges wired into `match_completed` handler in `subscriber.ts`. New endpoint: `GET /reputation/users/:userId/badges`. Badge types: `first_helper`, `milestone_10`, `milestone_50`, `milestone_100`, `connector` (10+ distinct people helped). 11 unit tests in `tests/unit/reputation/prestige-badges.test.ts`.
- **2026-02-27 (Sprint 8 — ADR-040 + trust UX)**: Community Trust Score implemented (ADR-040). Bonding/bridging model: `member_quality(40) + bonding(retention+completion) + bridging(cross-community+external)` weighted by `community_trust_bonding_weight/bridging_weight` config. New files: `communityTrustDb.ts`, `communityTrustService.ts`. New endpoint: `GET /reputation/community-trust/:communityId`. New endpoint: `GET /reputation/trust/:userId` (overall weighted-average trust score). Migration 021. Trust page updated to ADR-037 formula display. Feed default changed to composite (no auto-select of first community).
- **2026-02-27 (ADR-037 + ADR-038 + ADR-039)**: Multi-signal trust score fully implemented. Formula: `volume(log, 12-month window) + quality(recency-weighted, 6-month half-life) + depth(repeat pairs × depth_weight) + breadth(distinct people + communities × breadth_weight) + bonus`. Karma removed as trust input. Cross-community carry floor (ADR-038): when `recent_interactions == 0`, score is floored by `min(carry_cap, floor(max_other_score × carry_factor))`. Migrations 019 + 020 add `trust_feedback_threshold`, `trust_negative_allowed`, `trust_carry_*`. New files: `trustMetricsDb.ts`, `trustCarryDb.ts`; new function `feedbackDb.getWeightedAvgFeedback()`.
- **2026-02-26 (blended feedback)**: `feedbackDb.ts` exports `getBlendedAvgFeedback(toUserId, communityId)` — 70% local + 30% cross-community blend. New composite DB index `idx_feedback_to_user_community` (migration 018).
- **2026-02-26 (trust formula)**: Interim interactions-primary model shipped. Superseded by ADR-037 on 2026-02-27.
- **2026-02-26 (bug fix)**: Fixed trust score read path in `karmaService.ts:getUserTrustScore()`. Was reading non-existent columns (`avg_helpfulness`, `avg_responsiveness`, `avg_clarity`) from `reputation.trust_scores`, causing feedback contribution to always be 0 on read. Now calls `getAvgFeedback()` from `feedbackDb.ts` — same source as the POST feedback endpoint — so read and write paths are consistent.
- **2026-02-25 (ADR-036)**: Private feedback ratings — star picker after match completion. Both parties rate each other via `POST /reputation/feedback`. Feedback feeds into trust score via `avg_feedback_score`. Ratings are never exposed via API.
- **2026-02-25 (ADR-035)**: Karma now uses a fixed-pool model — `BASE_KARMA_POOL` points divided across shared communities, preventing multi-community inflation. Trust score formula abstracted into `trustScoreStrategy.ts` and now incorporates feedback ratings alongside karma. See [ADR-035](../../docs/adr/ADR-035-karma-allocation-trust-score-strategy.md).

## Purpose

Manages user karma points, trust scores, and badges within communities. Automatically awards karma when help exchanges are completed via a fixed-pool allocation strategy (ADR-035). Prevents gaming through milestone bonuses, trust score calculations, and community-scoped karma.

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

-- feedback.feedback indexes (migration 018)
-- Single-column index for global avg scan already existed (idx_feedback_to_user)
-- Composite index for community-scoped getBlendedAvgFeedback local avg component
CREATE INDEX IF NOT EXISTS idx_feedback_to_user_community
  ON feedback.feedback (to_user_id, community_id);

-- community_configs trust score extensions (migration 019 — ADR-037)
ALTER TABLE communities.community_configs
  ADD COLUMN IF NOT EXISTS trust_feedback_threshold DECIMAL(3,1) DEFAULT 3.0
    CHECK (trust_feedback_threshold BETWEEN 1.0 AND 4.9),
  ADD COLUMN IF NOT EXISTS trust_negative_allowed BOOLEAN DEFAULT FALSE;
-- Note: trust_weights_sum constraint dropped (depth/breadth weights are independent)

-- community_configs carry model fields (migration 020 — ADR-038)
ALTER TABLE communities.community_configs
  ADD COLUMN IF NOT EXISTS trust_carry_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS trust_carry_factor DECIMAL(3,2) DEFAULT 0.40,
  ADD COLUMN IF NOT EXISTS trust_carry_cap INTEGER DEFAULT 59;
```

**Social Karma v2.0 Schema Extensions:**

```sql
-- Add interaction quality metrics to trust_scores
ALTER TABLE reputation.trust_scores
ADD COLUMN avg_helpfulness NUMERIC(3,2) DEFAULT 0,
ADD COLUMN avg_responsiveness NUMERIC(3,2) DEFAULT 0,
ADD COLUMN avg_clarity NUMERIC(3,2) DEFAULT 0,
ADD COLUMN total_feedback_received INTEGER DEFAULT 0;

-- reputation.community_health_metrics (NEW)
CREATE TABLE reputation.community_health_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,

    -- Snapshot date (daily aggregation)
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Network strength metrics
    total_matches_completed INTEGER DEFAULT 0,
    total_active_requesters INTEGER DEFAULT 0,
    total_active_helpers INTEGER DEFAULT 0,
    unique_participant_count INTEGER DEFAULT 0,

    -- Interaction quality aggregates (community-wide averages)
    avg_helpfulness NUMERIC(3,2) DEFAULT 0,
    avg_responsiveness NUMERIC(3,2) DEFAULT 0,
    avg_clarity NUMERIC(3,2) DEFAULT 0,

    -- Network density (connections per member)
    network_density NUMERIC(5,4) DEFAULT 0,

    -- Growth metrics (vs previous period)
    growth_rate_matches NUMERIC(5,2) DEFAULT 0,
    growth_rate_participants NUMERIC(5,2) DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(community_id, snapshot_date)
);

CREATE INDEX idx_health_metrics_community ON reputation.community_health_metrics(community_id);
CREATE INDEX idx_health_metrics_date ON reputation.community_health_metrics(snapshot_date);

-- reputation.milestone_events (NEW)
CREATE TABLE reputation.milestone_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,

    -- Milestone type
    milestone_type VARCHAR(100) NOT NULL,
    milestone_value INTEGER NOT NULL,
    description TEXT NOT NULL,

    -- Privacy control
    is_featured BOOLEAN DEFAULT true,

    achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_milestone_events_community ON reputation.milestone_events(community_id);
CREATE INDEX idx_milestone_events_type ON reputation.milestone_events(milestone_type);
```

**Social Karma v2.0 Design Principles:**
- **Metrics Over Individuals**: Focus on community health metrics, not individual rankings
- **Collective Prestige**: Track community-level achievements and growth
- **Interaction Quality**: Incorporate feedback ratings into trust scores
- **Growth Visibility**: Show network strength trends and milestone achievements

### Tables Read by This Service
- `auth.users` - User names for leaderboards
- `communities.communities` - Community names for karma history
- `requests.help_requests` - Get community_id from request when match completed

## Karma Points Configuration (ADR-035)

Karma is awarded via a **fixed-pool model** — a total of `BASE_KARMA_POOL` points (default: 100) is allocated per interaction, divided across all shared communities. This prevents inflation for users in many communities.

**Pool distribution:**
- Total pool is split equally across shared communities (up to `MAX_COMMUNITIES_PER_KARMA_AWARD = 3`)
- Each community applies its configured helper/requester split ratio to its share
- Largest-remainder rounding ensures integer awards sum exactly to the pool

**Per-community split (community-configurable):**
| Role | Default split | Description |
|------|--------------|-------------|
| Helper (responder) | 60% of community share | Awarded for providing help |
| Requester | 40% of community share | Awarded for receiving help |

**Bonus awards (fixed, not from pool):**
| Milestone | Points | Description |
|-----------|--------|-------------|
| First Help Bonus | 15 | First time helping in a community |
| 10 Exchanges | 25 | Completing 10 help exchanges |
| 50 Exchanges | 50 | Completing 50 help exchanges |
| 100 Exchanges | 100 | Completing 100 help exchanges |

**Tuning surface:** `src/services/karmaAllocation.ts` — `allocateKarma(configs, totalPool)`
**Configuration defaults:** `src/services/karmaService.ts` — `KARMA_DEFAULTS`

## Trust Score Calculation

Implemented per [ADR-037](../../docs/adr/ADR-037-multi-signal-trust-score.md) + [ADR-039](../../docs/adr/ADR-039-trust-score-decay-consistency.md) + [ADR-038](../../docs/adr/ADR-038-cross-community-trust.md). **Karma is not a trust input.**

### Formula (ADR-037 + ADR-039)

Trust score ranges from `floor` (0 or -50) to 100. New users start at 0:

```
volume_score   = min(30, floor(log2(recent_interactions + 1) × 10))
                 recent_interactions = completed interactions in last 12 months (ADR-039)

quality_score  = avg_feedback_score != null
                 ? round(((avg_feedback_score - threshold) / (5 - threshold)) × 25)
                 : 0
                 avg_feedback_score = recency-weighted blend (6-month half-life, ADR-039)
                 threshold = community_configs.trust_feedback_threshold (default 3.0)

depth_score    = min(15, repeat_interaction_pairs × 2) × trust_depth_weight
breadth_score  = (min(10, distinct_people × 2) + min(10, distinct_communities × 3))
                 × trust_breadth_weight
bonus_score    = recent_interactions >= min_interactions_for_trust ? 5 : 0

floor          = trust_negative_allowed ? -50 : 0
trust_score    = max(floor, min(100, round(raw_score)))
```

Tier thresholds: New (0–19), Active (20–49), Trusted (50–74), Highly Trusted (75–100).

### Cross-community carry floor (ADR-038)

When `recent_interactions == 0`, score is floored by:
```
carried = min(carry_cap, floor(max_other_community_score × carry_factor))
score   = max(local_score, carried)
```
Defaults: `carry_factor = 0.40`, `carry_cap = 59`. Configurable via `trust_carry_factor/cap/enabled`.

### Community configuration fields
| Field | Default | Effect |
|-------|---------|--------|
| `trust_depth_weight` | 0.6 | Bonding capital weight (repeat pairs) |
| `trust_breadth_weight` | 0.4 | Bridging capital weight (distinct people + communities) |
| `trust_feedback_threshold` | 3.0 | Neutral star rating (above = positive, below = negative) |
| `trust_negative_allowed` | false | Allow scores below 0 (punitive mode) |
| `trust_carry_enabled` | true | Cross-community carry floor |
| `trust_carry_factor` | 0.40 | Fraction of best other score to carry |
| `trust_carry_cap` | 59 | Max carried score |

**Tuning surface:** `src/services/trustScoreStrategy.ts` — `computeTrustScore(inputs: TrustScoreInputs)`
**Feedback weighting:** `src/database/feedbackDb.ts` — `getWeightedAvgFeedback(userId, communityId, halfLifeMonths=6)`
**Depth/breadth metrics:** `src/database/trustMetricsDb.ts` — `getTrustMetrics(userId, communityId)`
**Carry floor:** `src/database/trustCarryDb.ts` — `getMaxOtherCommunityScore(userId, targetCommunityId)`

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

### GET /reputation/trust/:userId
Get user's overall trust score — weighted average across all communities, weighted by recent interaction count.

**Response:**
```json
{
  "success": true,
  "data": {
    "overall_score": 68,
    "community_breakdown": [
      { "community_id": "uuid", "community_name": "Neighborly", "score": 74, "recent_interactions": 5 },
      { "community_id": "uuid", "community_name": "Tech Help", "score": 61, "recent_interactions": 2 }
    ]
  }
}
```

**Implementation:** `src/routes/reputation.ts` | `src/services/karmaService.ts:getOverallTrustScore()`

---

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

### GET /reputation/users/:userId/badges
Get all prestige badges earned by a user (public). Phase 1 badge types: `first_helper`, `milestone_10`, `milestone_50`, `milestone_100`, `connector`.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "community_id": null,
      "badge_type": "first_helper",
      "earned_at": "2026-03-04T12:00:00Z"
    }
  ]
}
```

**Implementation:** `src/routes/reputation.ts:129`

---

## Social Karma v2.0 API Endpoints

### GET /reputation/community-health/:communityId
Get community health metrics and trends.

**Query Parameters:**
- `period` - Time period for trend calculation ('7d', '30d', '90d', default: '7d')

**Response:**
```json
{
  "success": true,
  "data": {
    "current": {
      "total_matches_completed": 127,
      "unique_participants": 45,
      "total_active_requesters": 28,
      "total_active_helpers": 35,
      "avg_helpfulness": 4.6,
      "avg_responsiveness": 4.8,
      "avg_clarity": 4.5,
      "network_density": 0.342,
      "network_strength": 78.5
    },
    "trend": {
      "matches_growth": 15.2,
      "participants_growth": 8.5,
      "direction": "growing"
    },
    "period": "7d",
    "snapshot_date": "2025-01-13"
  }
}
```

**Implementation:** `src/routes/health.ts` (NEW)

**Network Strength Calculation:**
```
network_strength = weighted_average(
  activity_score * 0.4,      // matches per member
  quality_score * 0.4,       // avg interaction ratings
  density_score * 0.2        // connection diversity
)
```

### GET /reputation/milestones/:communityId
Get community milestone achievements.

**Query Parameters:**
- `limit` - Max results (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "milestone_type": "100_matches",
      "milestone_value": 100,
      "description": "Reached 100 successful help exchanges!",
      "is_featured": true,
      "achieved_at": "2025-01-10T12:00:00Z"
    },
    {
      "id": "uuid",
      "milestone_type": "50_participants",
      "milestone_value": 50,
      "description": "50 unique members have participated in help exchanges",
      "is_featured": true,
      "achieved_at": "2025-01-08T09:30:00Z"
    }
  ],
  "count": 2
}
```

**Implementation:** `src/routes/health.ts` (NEW)

**Milestone Types:**
- `10_matches`, `50_matches`, `100_matches`, `500_matches`, `1000_matches`
- `10_participants`, `25_participants`, `50_participants`, `100_participants`
- `avg_quality_4.5` - Average quality rating reaches 4.5+

### GET /reputation/trust/:userId/:communityId
Enhanced trust score with interaction quality (UPDATED).

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
    "interaction_quality": {
      "avg_helpfulness": 4.6,
      "avg_responsiveness": 4.8,
      "avg_clarity": 4.5,
      "total_feedback_received": 12
    },
    "last_updated": "2025-01-10T12:00:00Z"
  }
}
```

**Implementation:** `src/routes/reputation.ts:37` (UPDATED)

**Note:** Now includes detailed interaction quality metrics from Social Karma v2.0 feedback system.

---

### GET /reputation/community-trust/:communityId
Get the community trust score (ADR-040). Computed daily; recalculates on demand if no score exists yet.

**Query params:** `?recalculate=true` forces a fresh calculation.

**Response:**
```json
{
  "success": true,
  "data": {
    "community_id": "uuid",
    "score": 72,
    "member_quality_score": 30,
    "bonding_score": 25,
    "bridging_score": 17,
    "active_member_count": 14,
    "last_calculated": "2026-02-27T..."
  }
}
```

**Implementation:** `src/routes/reputation.ts` | `src/services/communityTrustService.ts:calculateCommunityTrustScore()`

---

### POST /reputation/feedback (Authenticated)
Submit a private quality rating after a completed interaction. Ratings are internal trust signals — never exposed to users (ADR-036).

**Request Body:**
```json
{
  "match_id": "uuid",
  "to_user_id": "uuid",
  "community_id": "uuid",
  "rating": 4
}
```
- `rating`: integer 1–5
- Prevents duplicate submission for the same match

**Response:**
```json
{
  "success": true,
  "data": { "score": 72 }
}
```
Returns the updated trust score for the rated user.

**Side effects**: Calls `updateTrustScore(to_user_id, community_id)` — full ADR-037 multi-signal recomputation (volume + quality + depth + breadth + bonus with ADR-039 time-weighting). Returns the new score.

---

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

1. Finds shared communities (request communities ∩ both users' active memberships, max 3)
2. Calls `allocateKarma(communityConfigs, BASE_KARMA_POOL)` to compute per-community integer awards
3. Awards helper and requester karma in each shared community (fixed pool, no inflation)
4. Checks if this is helper's first help in the community (+15 bonus)
5. Checks for milestone bonuses (10, 50, 100 exchanges)
6. Updates trust scores for both users via `computeTrustScore()`

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
- `milestone_achieved` - When community reaches a milestone (Social Karma v2.0)
- `health_metrics_calculated` - Daily metric calculation complete (Social Karma v2.0)

### Events Consumed
- `match_completed` - Award karma when help exchange completed; also recalculates `completion_rate` on `reputation.provider_trust_scores` if responder has an active provider profile (cross-schema: `requests.provider_profiles`)
- `interaction_feedback_submitted` - Update trust scores with interaction quality (Social Karma v2.0)

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
- `src/routes/health.ts` - Community health metrics and milestones (Social Karma v2.0) - NEW

### Services
- `src/services/karmaService.ts` - Karma award logic, trust score calculation, `getOverallTrustScore()` (weighted average across communities)
- `src/services/communityTrustService.ts` - Community Trust Score (ADR-040): bonding/bridging formula, `calculateCommunityTrustScore()`, `calculateAllCommunityTrustScores()`
- `src/services/healthMetricsService.ts` - Community health calculation (Social Karma v2.0); also runs community trust calculation daily
- `src/services/milestoneDetector.ts` - Milestone detection logic (Social Karma v2.0) - NEW

### Events
- `src/events/subscriber.ts` - Listens to match_completed and interaction_feedback_submitted events

### Background Jobs
- `src/cron/healthMetricsCalculator.ts` - Daily health metrics aggregation (Social Karma v2.0) - NEW

### Database
- `src/database/db.ts` - PostgreSQL connection pool
- `src/database/feedbackDb.ts` - `getAvgFeedback(userId)` (global), `getBlendedAvgFeedback(userId, communityId)` (70/30 blend), `getWeightedAvgFeedback(userId, communityId, halfLifeMonths=6)` (recency-weighted, used in trust score path)
- `src/database/trustMetricsDb.ts` - `getTrustMetrics(userId, communityId)` — repeat pairs, distinct people, distinct communities (ADR-037)
- `src/database/trustCarryDb.ts` - `getMaxOtherCommunityScore(userId, targetCommunityId)` — carry floor query (ADR-038)
- `src/database/communityTrustDb.ts` - `getCommunityTrustScore(communityId)`, `upsertCommunityTrustScore()` — ADR-040 community trust persistence

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

- [x] Feedback/rating system — private star ratings, ADR-036 (implemented)
- [x] Decay factor for old karma — 6-month half-life, ADR-011 (implemented)
- [x] Advanced trust score algorithm — ADR-037 multi-signal formula (implemented)
- [x] Reputation portability across communities — ADR-038 carry model (implemented)
- [x] Provider trust score — ADR-042 (stars 60% + completion 30% + response 10%), implemented 2026-02-27
  - `POST /reputation/provider-reviews` — submit review (auth required)
  - `GET /reputation/provider-trust/:providerId` — public trust score
  - `GET /reputation/provider-reviews/:providerId` — public review list
  - New tables: `reputation.provider_reviews`, `reputation.provider_trust_scores`
- [ ] Negative karma for reported issues
- [ ] Badge system implementation
- [ ] Karma leaderboard across all communities
- [ ] Reputation-based privileges (verified helpers, trusted requesters)
- [ ] Federation support (federated reputation scores)

## Related Documentation

- Main architecture: `/docs/ARCHITECTURE.md`
- Database schema: `/infrastructure/postgres/init.sql` (lines 140-181)
- Karma configuration: `src/services/karmaService.ts:11-18`
- Federation reputation: `/docs/FEDERATION_PROTOCOL.md` (section: Federated Reputation)
