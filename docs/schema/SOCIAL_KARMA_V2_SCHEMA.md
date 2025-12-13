# Social Karma v2.0 Schema Design

> **Status**: Design Document
> **Version**: 2.0.0
> **Created**: 2025-01-13

## Design Principles

1. **Privacy First**: Requests/offers private by default with explicit opt-in for visibility
2. **Two-Way Consent**: Both requester and responder must consent for names to be visible
3. **Metrics Over Individuals**: Focus on community health metrics, not individual rankings
4. **Interaction-Based**: Rate interactions (helpfulness, responsiveness) not people
5. **Collective Prestige**: Community-level health tracking over individual leaderboards
6. **Growth Visibility**: Show network strength trends and milestone achievements

## Schema Changes by Service

### 1. Request Service (`requests` schema)

#### Modified Tables

**requests.help_requests** - Add privacy controls
```sql
ALTER TABLE requests.help_requests
ADD COLUMN is_public BOOLEAN DEFAULT false,
ADD COLUMN requester_visibility_consent BOOLEAN DEFAULT false;

COMMENT ON COLUMN requests.help_requests.is_public IS 'Whether this request is publicly visible (default: false, private)';
COMMENT ON COLUMN requests.help_requests.requester_visibility_consent IS 'Requester consents to having their name visible in completions';
```

**requests.help_offers** - Add privacy controls
```sql
ALTER TABLE requests.help_offers
ADD COLUMN is_public BOOLEAN DEFAULT false,
ADD COLUMN offerer_visibility_consent BOOLEAN DEFAULT false;

COMMENT ON COLUMN requests.help_offers.is_public IS 'Whether this offer is publicly visible (default: false, private)';
COMMENT ON COLUMN requests.help_offers.offerer_visibility_consent IS 'Offerer consents to having their name visible in completions';
```

**requests.matches** - Add interaction feedback and privacy
```sql
ALTER TABLE requests.matches
ADD COLUMN requester_visible BOOLEAN DEFAULT false,
ADD COLUMN responder_visible BOOLEAN DEFAULT false,
ADD COLUMN interaction_category VARCHAR(100);

COMMENT ON COLUMN requests.matches.requester_visible IS 'Both parties consented to show requester name';
COMMENT ON COLUMN requests.matches.responder_visible IS 'Both parties consented to show responder name';
COMMENT ON COLUMN requests.matches.interaction_category IS 'Category copy for metrics (from help_request)';
```

#### New Tables

**requests.interaction_feedback** - Rate interactions, not individuals
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

COMMENT ON TABLE requests.interaction_feedback IS 'Feedback about the interaction/exchange quality, not the person';
COMMENT ON COLUMN requests.interaction_feedback.helpfulness IS 'How helpful was the exchange (1-5)';
COMMENT ON COLUMN requests.interaction_feedback.responsiveness IS 'How responsive was communication (1-5)';
COMMENT ON COLUMN requests.interaction_feedback.clarity IS 'How clear was the communication (1-5)';
```

---

### 2. Reputation Service (`reputation` schema)

#### Modified Tables

**reputation.karma_records** - No changes needed

**reputation.trust_scores** - Add interaction quality metrics
```sql
ALTER TABLE reputation.trust_scores
ADD COLUMN avg_helpfulness NUMERIC(3,2) DEFAULT 0,
ADD COLUMN avg_responsiveness NUMERIC(3,2) DEFAULT 0,
ADD COLUMN avg_clarity NUMERIC(3,2) DEFAULT 0,
ADD COLUMN total_feedback_received INTEGER DEFAULT 0;

COMMENT ON COLUMN reputation.trust_scores.avg_helpfulness IS 'Average helpfulness rating from interactions (1-5)';
COMMENT ON COLUMN reputation.trust_scores.avg_responsiveness IS 'Average responsiveness rating (1-5)';
COMMENT ON COLUMN reputation.trust_scores.avg_clarity IS 'Average clarity rating (1-5)';
```

#### New Tables

**reputation.community_health_metrics** - Track community-level health
```sql
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

COMMENT ON TABLE reputation.community_health_metrics IS 'Community-level health metrics tracked daily';
COMMENT ON COLUMN reputation.community_health_metrics.network_density IS 'Average connections per member';
COMMENT ON COLUMN reputation.community_health_metrics.growth_rate_matches IS 'Percentage growth in matches vs previous period';
```

**reputation.milestone_events** - Track community milestones
```sql
CREATE TABLE reputation.milestone_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,

    -- Milestone type
    milestone_type VARCHAR(100) NOT NULL, -- '10_matches', '50_matches', '100_participants', etc.

    -- Milestone details
    milestone_value INTEGER NOT NULL,
    description TEXT NOT NULL,

    -- Privacy control
    is_featured BOOLEAN DEFAULT true,

    achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_milestone_events_community ON reputation.milestone_events(community_id);
CREATE INDEX idx_milestone_events_type ON reputation.milestone_events(milestone_type);

COMMENT ON TABLE reputation.milestone_events IS 'Community milestone achievements for celebrating collective progress';
COMMENT ON COLUMN reputation.milestone_events.is_featured IS 'Whether to feature this milestone in public stories';
```

---

### 3. Feed Service (`feed` schema)

#### Modified Tables

**feed.preferences** - Add new privacy and metrics preferences
```sql
ALTER TABLE feed.preferences
ADD COLUMN show_community_metrics BOOLEAN DEFAULT true,
ADD COLUMN show_milestone_celebrations BOOLEAN DEFAULT true,
ADD COLUMN show_anonymous_stories BOOLEAN DEFAULT true;

COMMENT ON COLUMN feed.preferences.show_community_metrics IS 'Show community health metrics in feed';
COMMENT ON COLUMN feed.preferences.show_milestone_celebrations IS 'Show community milestone achievements';
COMMENT ON COLUMN feed.preferences.show_anonymous_stories IS 'Show anonymous completed exchange stories';
```

#### New Tables

**feed.featured_stories** - Curated stories about interactions
```sql
CREATE TABLE feed.featured_stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,

    -- Story type
    story_type VARCHAR(50) NOT NULL, -- 'completed_exchange', 'milestone', 'growth_trend'

    -- Story content
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,

    -- Referenced entities (nullable depending on story type)
    match_id UUID REFERENCES requests.matches(id) ON DELETE CASCADE,
    category VARCHAR(100),

    -- Privacy controls
    is_anonymous BOOLEAN DEFAULT true,
    requester_name VARCHAR(255),  -- NULL if anonymous
    responder_name VARCHAR(255),  -- NULL if anonymous

    -- Featuring controls
    is_public BOOLEAN DEFAULT false, -- Platform-wide visibility

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP -- Optional expiration for ephemeral stories
);

CREATE INDEX idx_featured_stories_community ON feed.featured_stories(community_id);
CREATE INDEX idx_featured_stories_type ON feed.featured_stories(story_type);
CREATE INDEX idx_featured_stories_created ON feed.featured_stories(created_at);

COMMENT ON TABLE feed.featured_stories IS 'Curated stories about interactions for feed and celebration';
COMMENT ON COLUMN feed.featured_stories.is_anonymous IS 'Whether names are shown (requires two-way consent)';
```

---

### 4. Community Service (`communities` schema)

#### New Tables

**communities.health_summary** - Materialized view of latest metrics
```sql
CREATE TABLE communities.health_summary (
    community_id UUID PRIMARY KEY REFERENCES communities.communities(id) ON DELETE CASCADE,

    -- Latest metrics (from reputation.community_health_metrics)
    total_exchanges INTEGER DEFAULT 0,
    active_members INTEGER DEFAULT 0,
    network_strength NUMERIC(5,2) DEFAULT 0,  -- Composite score

    -- Trend indicators (7-day vs previous 7-day)
    trend_direction VARCHAR(20) DEFAULT 'stable', -- 'growing', 'stable', 'declining'
    trend_percentage NUMERIC(5,2) DEFAULT 0,

    -- Last updated
    last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE communities.health_summary IS 'Cached summary of community health for quick access';
COMMENT ON COLUMN communities.health_summary.network_strength IS 'Composite score: activity + quality + density';
```

---

## API Endpoint Changes by Service

### Request Service Endpoints

#### New Endpoints

**POST /requests** - Add privacy fields
```json
{
  "title": "Need help moving",
  "description": "...",
  "category": "moving",
  "is_public": false,  // NEW: default false
  "requester_visibility_consent": false  // NEW: consent for name visibility
}
```

**PUT /requests/:id/privacy** - Update privacy settings
```json
{
  "is_public": true,
  "requester_visibility_consent": true
}
```

**POST /matches/:id/feedback** - Submit interaction feedback
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

**GET /matches/:id/feedback** - Get feedback for a match
```json
{
  "success": true,
  "data": {
    "feedback_from_requester": { "helpfulness": 5, ... },
    "feedback_from_responder": { "helpfulness": 4, ... }
  }
}
```

---

### Reputation Service Endpoints

#### New Endpoints

**GET /reputation/community-health/:communityId** - Get community health metrics
```json
{
  "success": true,
  "data": {
    "current": {
      "total_matches_completed": 127,
      "unique_participants": 45,
      "avg_helpfulness": 4.6,
      "network_density": 0.342
    },
    "trend": {
      "matches_growth": 15.2,  // % growth
      "participants_growth": 8.5
    },
    "milestones": [
      {
        "type": "100_matches",
        "achieved_at": "2025-01-10T12:00:00Z"
      }
    ]
  }
}
```

**GET /reputation/milestones/:communityId** - Get community milestones
```json
{
  "success": true,
  "data": [
    {
      "milestone_type": "100_matches",
      "milestone_value": 100,
      "description": "Reached 100 successful help exchanges!",
      "achieved_at": "2025-01-10T12:00:00Z"
    }
  ]
}
```

**GET /reputation/trust/:userId/:communityId** - Enhanced with interaction quality
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "community_id": "uuid",
    "score": 75,
    "karma": 145,
    "interaction_quality": {
      "avg_helpfulness": 4.6,
      "avg_responsiveness": 4.8,
      "avg_clarity": 4.5,
      "total_feedback_received": 12
    }
  }
}
```

---

### Feed Service Endpoints

#### Modified Endpoints

**GET /feed** - Include new story types
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "type": "community_metric",
        "data": {
          "community_name": "Seattle Mutual Aid",
          "metric_type": "growth",
          "description": "15% increase in help exchanges this week",
          "trend": "growing"
        }
      },
      {
        "type": "milestone",
        "data": {
          "community_name": "Seattle Mutual Aid",
          "milestone": "100_matches",
          "description": "Your community reached 100 help exchanges!"
        }
      },
      {
        "type": "anonymous_story",
        "data": {
          "category": "moving",
          "description": "A neighbor helped another neighbor with moving furniture",
          "community_name": "Seattle Mutual Aid",
          "is_anonymous": true
        }
      }
    ]
  }
}
```

#### New Endpoints

**GET /feed/featured-stories/:communityId** - Get featured stories
```json
{
  "success": true,
  "data": [
    {
      "story_type": "completed_exchange",
      "title": "Moving Help in Capitol Hill",
      "description": "A neighbor helped with moving furniture",
      "category": "moving",
      "is_anonymous": true,
      "created_at": "2025-01-10T12:00:00Z"
    }
  ]
}
```

---

### Community Service Endpoints

#### New Endpoints

**GET /communities/:id/health** - Get community health summary
```json
{
  "success": true,
  "data": {
    "total_exchanges": 127,
    "active_members": 45,
    "network_strength": 78.5,
    "trend": {
      "direction": "growing",
      "percentage": 12.3
    },
    "last_calculated": "2025-01-13T08:00:00Z"
  }
}
```

---

## Event Changes

### New Events Published

**Request Service:**
- `interaction_feedback_submitted` - When user submits feedback on interaction
- `privacy_settings_updated` - When request/offer privacy settings change

**Reputation Service:**
- `milestone_achieved` - When community reaches a milestone
- `health_metrics_calculated` - Daily metric calculation complete

**Feed Service:**
- `story_featured` - When interaction is featured as a story

---

## Migration Strategy

### Phase 1: Schema Changes
1. Add new columns to existing tables (requests, reputation)
2. Create new tables (interaction_feedback, community_health_metrics, etc.)
3. Add indexes for performance

### Phase 2: Default Values & Backfill
1. Set existing requests/offers to `is_public = false` (privacy first)
2. Set existing matches with `requester_visible = false`, `responder_visible = false`
3. Initialize health_summary for all communities

### Phase 3: API Updates
1. Update Request Service endpoints for privacy controls
2. Add Reputation Service health metrics endpoints
3. Enhance Feed Service with new story types

### Phase 4: Background Jobs
1. Daily health metrics calculation (cron job in Reputation Service)
2. Milestone detection (triggered by metrics calculation)
3. Story curation (triggered by match completion + feedback)

---

## Privacy Decision Tree

### When Match is Completed

```
Match Completed
    ↓
Both submitted feedback?
    ↓ YES
Both allow_featuring = true?
    ↓ YES
requester_visibility_consent = true?
    ↓ YES
responder_visibility_consent = true?
    ↓ YES
    → Create NAMED featured story

    ↓ NO (any step)
    → Create ANONYMOUS featured story or generic metric
```

### Visibility Matrix

| Requester Consent | Responder Consent | Result |
|-------------------|-------------------|--------|
| true | true | Both names visible |
| true | false | Anonymous story |
| false | true | Anonymous story |
| false | false | Generic metric only |

---

## Metrics Calculation Logic

### Network Strength Score (0-100)
```
network_strength = weighted_average(
  activity_score * 0.4,      // matches per member
  quality_score * 0.4,       // avg interaction ratings
  density_score * 0.2        // connection diversity
)

activity_score = min(100, (total_matches / active_members) * 20)
quality_score = ((avg_helpfulness + avg_responsiveness + avg_clarity) / 3) * 20
density_score = network_density * 100
```

### Growth Rate Calculation
```
growth_rate = ((current_period - previous_period) / previous_period) * 100

Periods:
- 7-day rolling window
- Previous 7-day window for comparison
```

---

## Implementation Order

1. **Request Service**: Add privacy columns, interaction feedback table and endpoints
2. **Reputation Service**: Add health metrics tables, calculation logic, API endpoints
3. **Feed Service**: Add featured stories table, story generation logic
4. **Community Service**: Add health summary table, summary endpoint
5. **Background Jobs**: Health metrics calculator, milestone detector
6. **Frontend**: Privacy controls UI, metrics dashboard, featured stories

---

## Security & Privacy Considerations

1. **Default Private**: All new requests/offers default to `is_public = false`
2. **Two-Way Consent**: Names only visible if BOTH parties consent
3. **Opt-in Featuring**: Stories only featured if both parties `allow_featuring = true`
4. **Ephemeral Stories**: Optional expiration for featured stories
5. **No Individual Rankings**: No public individual leaderboards, only community metrics
6. **Interaction Ratings**: Rate the exchange quality, not the person

---

## Testing Strategy

### Unit Tests
- Privacy consent logic (truth tables)
- Metrics calculation algorithms
- Story generation with various consent combinations

### Integration Tests
- End-to-end privacy workflow (request → match → feedback → story)
- Metrics aggregation across multiple matches
- Milestone detection

### E2E Tests
- Privacy controls in UI
- Metrics dashboard display
- Featured stories with consent combinations

---

## Documentation Updates Needed

Each service CONTEXT.md will be updated with:
1. New schema tables and columns
2. New API endpoints
3. Event publishing/consumption changes
4. Privacy decision logic
5. Metrics calculation details
