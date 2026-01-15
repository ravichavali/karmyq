# Social Karma v2.0 Feature Documentation

**Status**: ✅ Completed in v7.0.0
**Last Updated**: 2025-12-13

This directory contains complete documentation for the Social Karma v2.0 feature release.

---

## Overview

Social Karma v2.0 introduced a modern, three-column dashboard layout with comprehensive reputation tracking, community health metrics, and interactive UI components.

---

## Documentation Index

### Implementation Guides

#### [SOCIAL_KARMA_V2_IMPLEMENTATION.md](SOCIAL_KARMA_V2_IMPLEMENTATION.md)
**Purpose**: Complete technical implementation guide
**Covers**:
- Backend services (Reputation, Feed, Notification)
- Database schema changes
- API endpoints and event flows
- Karma calculation algorithms
- Trust score formulas

**Use this for**: Understanding the backend implementation

#### [SOCIAL_KARMA_V2_SUMMARY.md](SOCIAL_KARMA_V2_SUMMARY.md)
**Purpose**: Executive summary and feature overview
**Covers**:
- Key features delivered
- User experience improvements
- Technical architecture decisions
- Performance metrics

**Use this for**: High-level understanding of what was built

### UI Documentation

#### [SOCIAL_KARMA_V2_UI_READY.md](SOCIAL_KARMA_V2_UI_READY.md)
**Purpose**: Frontend implementation details
**Covers**:
- Three-column dashboard layout
- User profile widget
- Community health metrics
- Milestone posts integration
- Responsive design patterns

**Use this for**: Understanding the UI architecture

#### [UI_COMPONENTS_SOCIAL_KARMA_V2.md](UI_COMPONENTS_SOCIAL_KARMA_V2.md)
**Purpose**: React component reference
**Covers**:
- Component hierarchy
- Props and state management
- API integration patterns
- Styling and theme usage

**Use this for**: Working with UI components

---

## Quick Reference

### Key Features Delivered

1. **Modern Dashboard (3-Column Layout)**
   - Left sidebar: Community switcher + navigation
   - Center: Activity feed with requests, milestones, stories
   - Right sidebar: User profile + community health

2. **Reputation System**
   - Karma points (10pts helper, 5pts requester)
   - Trust scores (0-100 based on karma)
   - Milestone bonuses (10, 50, 100 exchanges)
   - First help bonus (15pts)

3. **Community Health Metrics**
   - Network strength (Thriving, Strong, Growing, Developing, Building)
   - Active helpers count
   - Trend indicators (growing, stable, declining)
   - Match completion rates

4. **Milestone Posts**
   - Automated celebration posts
   - 48-hour pinning window
   - Community-wide visibility

---

## Architecture Overview

### Backend Services

```
┌─────────────────┐
│ Reputation      │ ← Karma calculation, trust scores
│ Service (3004)  │
└─────────────────┘
        ↓ events
┌─────────────────┐
│ Feed Service    │ ← Personalized feed composition
│ (3007)          │
└─────────────────┘
        ↓ events
┌─────────────────┐
│ Notification    │ ← Real-time milestone notifications
│ Service (3005)  │
└─────────────────┘
```

### Database Schema

```sql
-- Reputation schema
reputation.karma_records
reputation.trust_scores
reputation.badges

-- Feed schema extensions
feed.milestone_posts
feed.dismissed_items

-- Notifications schema
notifications.notifications (12 types)
```

### Frontend Components

```
Dashboard
├── LeftSidebar
│   ├── CommunitySwitcher
│   └── Navigation
├── FeedColumn
│   ├── HelpRequestCard
│   ├── MilestonePost
│   └── StoryCard
└── RightSidebar
    ├── UserProfileWidget
    └── CommunityHealthCard
```

---

## Testing Coverage

### Unit Tests
- **Reputation Service**: 22 tests, 98.46% coverage
  - Karma calculation
  - Trust score formulas
  - Milestone bonuses
  - Edge cases

- **Feed Service**: 58 tests, 62-98% coverage
  - Feed composition ratios
  - Skill matching algorithms
  - Network strength calculation
  - Milestone pinning logic

- **Notification Service**: 47 tests, 100% coverage
  - All 12 notification templates
  - Priority classification
  - Channel configuration

### Integration Tests
- API endpoint testing
- Multi-service event flows
- Database RLS verification

### E2E Tests
- Complete user journeys
- Milestone post generation
- Real-time notification delivery

See [../../testing/SOCIAL_KARMA_V2_TESTING.md](../../testing/SOCIAL_KARMA_V2_TESTING.md) for complete test documentation.

---

## Performance Metrics

**Dashboard Load Time**: <500ms
**Feed Refresh**: <200ms
**Real-time Notifications**: <100ms latency
**Trust Score Calculation**: <50ms

---

## API Endpoints Added

### Reputation Service (3004)
```
GET  /karma/:userId/:communityId          - Get karma points
GET  /trust/:userId/:communityId          - Get trust score
GET  /leaderboard/:communityId            - Community leaderboard
POST /karma/award                          - Manual karma award (admin)
```

### Feed Service (3007)
```
GET  /feed/:userId/:communityId           - Personalized feed
GET  /community-health/:communityId       - Health metrics
GET  /milestones/:communityId             - Recent milestones
```

### Notification Service (3005)
```
GET  /notifications/:userId               - User notifications
PUT  /notifications/:id/read              - Mark as read
GET  /sse/:userId                         - SSE connection
```

---

## Migration Notes

If upgrading from v6.0 or earlier, see:
- [../../archive/V6_MIGRATION_GUIDE.md](../../archive/V6_MIGRATION_GUIDE.md) - Database migrations
- [SOCIAL_KARMA_V2_IMPLEMENTATION.md](SOCIAL_KARMA_V2_IMPLEMENTATION.md) - API changes

---

## Related Documentation

- **[../../architecture/ARCHITECTURE.md](../../architecture/ARCHITECTURE.md)** - System architecture
- **[../../testing/SOCIAL_KARMA_V2_TESTING.md](../../testing/SOCIAL_KARMA_V2_TESTING.md)** - Test coverage
- **[../../PROJECT_STATUS.md](../../PROJECT_STATUS.md)** - Current status (v8.0)

---

**Feature Status**: ✅ Complete (v7.0.0)
**Last Updated**: 2025-12-27
