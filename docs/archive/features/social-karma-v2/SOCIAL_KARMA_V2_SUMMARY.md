# Social Karma v2.0 - Schema Design Complete

> **Status**: Schema Design Phase Complete ✅
> **Next Phase**: Implementation (API endpoints, background jobs, frontend UI)
> **Created**: 2025-01-13

## Overview

Social Karma v2.0 transforms Karmyq from an individual karma-tracking system to a privacy-first, community-health-focused mutual aid platform. The design emphasizes **collective prestige over individual rankings** and **interaction quality over individual ratings**.

## Core Design Principles

1. **Privacy First**: Requests/offers private by default with explicit opt-in
2. **Two-Way Consent**: Both parties must consent for names to be visible
3. **Metrics Over Individuals**: Focus on community health, not individual leaderboards
4. **Interaction-Based**: Rate the exchange quality, not the person
5. **Collective Prestige**: Celebrate community-level achievements
6. **Growth Visibility**: Show network strength trends and milestones

## Work Completed

### 1. Schema Design Document ✅
**File**: `docs/schema/SOCIAL_KARMA_V2_SCHEMA.md`

Comprehensive schema design covering:
- 4 new database tables
- Extensions to 7 existing tables
- New API endpoints for all 4 affected services
- Event architecture changes
- Privacy decision tree
- Metrics calculation logic
- Testing strategy

### 2. Service Documentation Updates ✅

Updated all affected service CONTEXT.md files with Social Karma v2.0 extensions:

#### Request Service (`services/request-service/CONTEXT.md`)
- **New Table**: `requests.interaction_feedback`
- **Schema Extensions**: Privacy columns on `help_requests`, `help_offers`, `matches`
- **New Endpoints**:
  - `PUT /requests/:id/privacy` - Update request privacy
  - `PUT /offers/:id/privacy` - Update offer privacy
  - `POST /matches/:id/feedback` - Submit interaction feedback
  - `GET /matches/:id/feedback` - Get match feedback
- **New Events**: `interaction_feedback_submitted`, `privacy_settings_updated`
- **New Route**: `src/routes/feedback.ts`

#### Reputation Service (`services/reputation-service/CONTEXT.md`)
- **New Tables**: `community_health_metrics`, `milestone_events`
- **Schema Extensions**: Interaction quality columns on `trust_scores`
- **New Endpoints**:
  - `GET /reputation/community-health/:communityId` - Community health metrics
  - `GET /reputation/milestones/:communityId` - Milestone achievements
  - Updated `GET /reputation/trust/:userId/:communityId` - Now includes interaction quality
- **New Events**: `milestone_achieved`, `health_metrics_calculated`
- **New Services**: `healthMetricsService.ts`, `milestoneDetector.ts`
- **New Background Job**: `cron/healthMetricsCalculator.ts` - Daily aggregation

#### Feed Service (`services/feed-service/CONTEXT.md`)
- **New Table**: `feed.featured_stories`
- **Schema Extensions**: Privacy/metrics preferences on `feed.preferences`
- **Enhanced Feed**: Now includes community metrics, milestones, anonymous stories
- **Story Types**: `community_metric`, `milestone`, `anonymous_story`

#### Community Service (`services/community-service/CONTEXT.md`)
- **New Table**: `communities.health_summary`
- **Purpose**: Cached community health metrics for quick access
- **Fields**: `total_exchanges`, `active_members`, `network_strength`, trend indicators

### 3. Database Migration Script ✅
**File**: `infrastructure/postgres/migrations/006_social_karma_v2_schema.sql`

Production-ready migration script with:
- All schema changes (CREATE TABLE, ALTER TABLE)
- Proper indexes for performance
- Column comments for documentation
- Data backfill for existing communities
- Idempotent (uses `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`)
- Safe for production rollout

## Key Features

### Privacy Controls

**Default Private**
- All new requests/offers default to `is_public = false`
- Users must explicitly opt-in to make requests/offers public

**Two-Way Consent for Visibility**
```
Requester Consent | Responder Consent | Result
------------------|-------------------|------------------
true              | true              | Both names visible
true              | false             | Anonymous story
false             | true              | Anonymous story
false             | false             | Generic metric only
```

**Opt-in for Featuring**
- Stories only featured if both parties set `allow_featuring = true` in feedback
- Respects individual privacy preferences

### Interaction Feedback System

**Rate the Exchange, Not the Person**
- **Helpfulness** (1-5): How helpful was the exchange
- **Responsiveness** (1-5): How responsive was communication
- **Clarity** (1-5): How clear was the communication
- **Comment**: Optional text about the exchange

**No Individual Ratings**
- Feedback is about the interaction quality
- Aggregated into community health metrics
- Contributes to trust scores, not public rankings

### Community Health Metrics

**Network Strength Score (0-100)**
```
network_strength = weighted_average(
  activity_score * 0.4,      // matches per member
  quality_score * 0.4,       // avg interaction ratings
  density_score * 0.2        // connection diversity
)
```

**Tracked Metrics**
- Total matches completed
- Unique participants (requesters + helpers)
- Average interaction quality (helpfulness, responsiveness, clarity)
- Network density (connections per member)
- Growth rates (7-day, 30-day, 90-day trends)

**Daily Aggregation**
- Background job runs daily to calculate metrics
- Stores snapshots in `community_health_metrics`
- Detects and records milestones

### Milestone System

**Community-Level Achievements**
- `10_matches`, `50_matches`, `100_matches`, `500_matches`, `1000_matches`
- `10_participants`, `25_participants`, `50_participants`, `100_participants`
- `avg_quality_4.5` - Average quality rating reaches 4.5+

**Celebration Focus**
- Milestones celebrate collective progress
- Featured in feed and stories
- No individual leaderboards (focus on community health)

### Featured Stories

**Story Types**
1. **Completed Exchange**: Anonymous or named (with consent)
   - "A neighbor helped another neighbor with moving furniture"
   - "Alice helped Bob with groceries" (if both consented)

2. **Milestone Achievement**
   - "Your community reached 100 help exchanges!"
   - "50 unique members have participated in mutual aid"

3. **Growth Trend**
   - "15% increase in help exchanges this week"
   - "Network strength growing - community health is strong"

**Privacy Controls**
- Anonymous by default
- Names only shown if both parties consent
- Optional expiration for ephemeral stories

## Architecture Changes

### Event Flow

```
Match Completed
    ↓
Reputation Service: Award Karma
    ↓
User Submits Feedback (interaction_feedback_submitted)
    ↓
Reputation Service: Update Trust Score
    ↓
Check Two-Way Consent
    ↓
Feed Service: Create Featured Story
    ↓
Daily Health Metrics Job
    ↓
Reputation Service: Calculate Community Health
    ↓
Detect Milestones
    ↓
Publish milestone_achieved Event
    ↓
Feed Service: Create Milestone Story
```

### Service Ownership

| Service | Schema | New Tables | New Endpoints |
|---------|--------|------------|---------------|
| Request Service | `requests` | `interaction_feedback` | 4 new |
| Reputation Service | `reputation` | `community_health_metrics`, `milestone_events` | 3 new |
| Feed Service | `feed` | `featured_stories` | 1 new |
| Community Service | `communities` | `health_summary` | 1 new |

## Next Steps

### Phase 1: Database Migration (Ready to Run) ✅
Run migration script:
```bash
cat infrastructure/postgres/migrations/006_social_karma_v2_schema.sql | \
  docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db
```

### Phase 2: API Implementation (TODO)
1. **Request Service**:
   - `src/routes/feedback.ts` - Interaction feedback endpoints
   - Update `src/routes/requests.ts` - Add privacy endpoints
   - Update `src/routes/offers.ts` - Add privacy endpoints
   - Event publishing logic for feedback

2. **Reputation Service**:
   - `src/routes/health.ts` - Community health endpoints
   - `src/services/healthMetricsService.ts` - Metrics calculation
   - `src/services/milestoneDetector.ts` - Milestone detection
   - `src/cron/healthMetricsCalculator.ts` - Daily aggregation job
   - Update `src/events/subscriber.ts` - Listen to feedback events

3. **Feed Service**:
   - Update `src/services/feedComposer.ts` - Include new story types
   - Story generation from feedback and milestones
   - Privacy consent enforcement

4. **Community Service**:
   - `GET /communities/:id/health` - Health summary endpoint

### Phase 3: Frontend UI (TODO)
1. **Privacy Controls**:
   - Request/offer creation: Privacy toggle (default private)
   - Request/offer edit: Update privacy settings
   - Match completion: Visibility consent checkbox

2. **Feedback UI**:
   - Feedback submission form (helpfulness, responsiveness, clarity)
   - Optional comment field
   - Allow featuring checkbox

3. **Community Health Dashboard**:
   - Network strength visualization
   - Growth trend charts
   - Milestone celebrations
   - Featured stories feed

4. **Feed Enhancements**:
   - Community metrics cards
   - Milestone celebration cards
   - Anonymous exchange stories

### Phase 4: Testing (TODO)
1. **Unit Tests**: Privacy consent logic, metrics calculation
2. **Integration Tests**: End-to-end privacy workflow
3. **E2E Tests**: Full user journey from request → feedback → story

## Files Created/Modified

### New Files
1. `docs/schema/SOCIAL_KARMA_V2_SCHEMA.md` - Complete schema design
2. `docs/SOCIAL_KARMA_V2_SUMMARY.md` - This summary
3. `infrastructure/postgres/migrations/006_social_karma_v2_schema.sql` - Migration script

### Modified Files
1. `services/request-service/CONTEXT.md` - Added Social Karma v2.0 section
2. `services/reputation-service/CONTEXT.md` - Added Social Karma v2.0 section
3. `services/feed-service/CONTEXT.md` - Added Social Karma v2.0 section
4. `services/community-service/CONTEXT.md` - Added Social Karma v2.0 section

## Impact Summary

### User Experience Improvements
- ✅ Privacy-first: Users control their visibility
- ✅ Less status anxiety: No public individual leaderboards
- ✅ Positive reinforcement: Celebrate community growth, not individual rankings
- ✅ Quality focus: Feedback improves interaction quality
- ✅ Collective prestige: Communities celebrated for health and growth

### Technical Improvements
- ✅ Modular design: Each service owns its bounded context
- ✅ Event-driven: Loose coupling between services
- ✅ Scalable: Daily aggregation prevents expensive real-time calculations
- ✅ Privacy-compliant: Two-way consent enforced at database level
- ✅ Observable: Health metrics provide community insights

### Architectural Alignment
- ✅ Follows existing microservices patterns
- ✅ Consistent with RLS and multi-tenancy
- ✅ Event-driven with Bull/Redis queues
- ✅ Service ownership and bounded contexts preserved
- ✅ Documentation complete before implementation

## Design Validation

### Privacy First ✅
- Default private requests/offers
- Two-way consent for visibility
- Opt-in for featuring
- Anonymous stories preserve privacy

### Metrics Over Individuals ✅
- Community health metrics
- No individual leaderboards (only trust scores for matchmaking)
- Interaction-based ratings
- Collective milestones

### Growth Visibility ✅
- Network strength score
- Trend indicators (growing/stable/declining)
- Milestone achievements
- Featured stories show community growth

### Implementation Ready ✅
- Complete schema design
- Database migration script
- Service documentation updated
- API endpoints defined
- Event architecture designed

---

**Schema Design Phase: Complete ✅**

Ready to proceed with implementation (API endpoints, background jobs, frontend UI).
