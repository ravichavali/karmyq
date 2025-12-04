# FR-003: Help Requests

**Status:** ✅ Implemented
**Priority:** High
**Version:** 5.1.0
**Last Updated:** 2025-12-04

## Overview

Help Requests are the core of the mutual aid platform. Users post requests for help, and other community members can respond with offers to help. Requests can be matched with offers to create helping exchanges.

## Functional Requirements

### FR-003.1: Create Help Request

**User Story:**
> As a community member, I want to post a request for help so that others can offer assistance.

**Acceptance Criteria:**
- [x] User provides title, description, category
- [x] Optional urgency level (low, medium, high, urgent)
- [x] Optional preferred start/end dates
- [x] Request automatically associated with community
- [x] Request status defaults to 'open'
- [x] Request can belong to multiple communities
- [x] Creator notified when request is matched

**Implementation:**
- Service: `request-service`
- Endpoint: `POST /requests`
- Database: `requests.help_requests`, `requests.request_communities`
- Event: `request_created` published to Redis

---

### FR-003.2: View Help Requests

**User Story:**
> As a community member, I want to browse help requests so that I can find ways to contribute.

**Acceptance Criteria:**
- [x] List all open requests in community
- [x] Filter by category, urgency, status
- [x] Sort by created date, urgency
- [x] Pagination support
- [x] Only see requests from user's communities
- [x] RLS enforces community isolation

**Implementation:**
- Endpoint: `GET /requests`
- Query params: `status`, `category`, `urgency`, `sort`, `page`, `limit`
- RLS Policy: `community_isolation` via `request_communities`

---

### FR-003.3: Update Help Request

**User Story:**
> As a requester, I want to update my request so that I can provide more details or change urgency.

**Acceptance Criteria:**
- [x] Only creator can update their request
- [x] Can update title, description, category, urgency
- [x] Can update status (open → completed, open → cancelled)
- [x] Cannot update after matched
- [x] Updated timestamp tracked

**Implementation:**
- Endpoint: `PATCH /requests/:id`
- Authorization: `req.user.userId === request.requester_id`

---

### FR-003.4: Delete Help Request

**User Story:**
> As a requester, I want to delete my request if I no longer need help.

**Acceptance Criteria:**
- [x] Only creator can delete their request
- [x] Soft delete (status='cancelled')
- [x] Cannot delete if matches exist
- [x] Associated data cleaned by Cleanup Service based on TTL

**Implementation:**
- Endpoint: `DELETE /requests/:id`
- Cascade: Deletes from `request_communities`

---

### FR-003.5: Request Expiration

**User Story:**
> As a platform, I want requests to expire automatically so that stale data is removed.

**Acceptance Criteria:**
- [x] Requests have configurable TTL (community setting)
- [x] Expired requests marked with `expired=true`
- [x] Cleanup Service runs periodic job
- [x] Expired requests excluded from listings
- [x] Expired data eventually hard-deleted

**Implementation:**
- Cleanup Service: Daily cron job
- TTL Source: `community_settings.request_ttl_days`
- Column: `expired` boolean (not `expires_at` timestamp)

---

## Data Model

### Help Requests Table
```sql
CREATE TABLE requests.help_requests (
  id UUID PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES auth.users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  urgency VARCHAR(50) DEFAULT 'medium',
  preferred_start_date TIMESTAMP,
  preferred_end_date TIMESTAMP,
  status VARCHAR(50) DEFAULT 'open',
  expired BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Request Communities (Many-to-Many)
```sql
CREATE TABLE requests.request_communities (
  id UUID PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES help_requests(id),
  community_id UUID NOT NULL REFERENCES communities.communities(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(request_id, community_id)
);
```

## Categories

Predefined categories (can be extended):
- Emergency
- Transportation
- Food
- Housing
- Skills
- Emotional Support
- Childcare
- Pet Care
- Technology
- Other

## Status Flow

```
open → matched → completed
  ↓      ↓
cancelled
```

## Related Requirements

- [FR-004: Matching System](FR-004-matching.md)
- [FR-002: Communities](FR-002-communities.md)
- [FR-006: Notifications](FR-006-notifications.md)
- [FR-009: Data Cleanup](FR-009-cleanup.md)
