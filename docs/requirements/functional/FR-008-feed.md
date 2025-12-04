# FR-008: Activity Feed

**Status:** ✅ Implemented | **Priority:** Low | **Version:** 5.1.0

## Overview

Aggregated activity feed showing recent events across user's communities.

## Key Features

### FR-008.1: Feed Items
- [x] New requests posted
- [x] Matches created
- [x] Matches completed
- [x] Users joined communities
- [x] Karma milestones reached
- [x] Norms proposed

### FR-008.2: Feed Display
- [x] Chronological order (newest first)
- [x] Filter by community
- [x] Filter by event type
- [x] Pagination support
- [x] Last 30 days of activity

### FR-008.3: Privacy
- [x] Only see events from user's communities
- [x] RLS enforced on all queries
- [x] No cross-community data leakage

## Implementation
- Service: `feed-service`
- Endpoint: `GET /feed`
- Read-only: Queries all schemas
- No database writes
- Aggregates from multiple tables

## Data Sources
- `requests.help_requests`
- `requests.matches`
- `communities.members`
- `reputation.karma_records`
- `communities.norms`

## Related
- [FR-002: Communities](FR-002-communities.md)
- [FR-003: Help Requests](FR-003-help-requests.md)
- [FR-004: Matching](FR-004-matching.md)
