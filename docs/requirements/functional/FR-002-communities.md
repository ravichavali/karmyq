# FR-002: Community Management

**Status:** ✅ Implemented
**Priority:** High
**Version:** 5.1.0
**Last Updated:** 2025-12-04

## Overview

The Community Management feature enables users to create, join, and manage mutual aid communities. Each community is an isolated multi-tenant instance where members can share help requests and offers.

## User Roles

### Community Creator
- Creates the community
- Automatically becomes admin
- Can delete the community

### Community Admin
- Manages members (approve/reject/remove)
- Updates community settings
- Views community statistics
- Manages community norms
- Configures data retention policies

### Community Moderator
- Monitors community activity
- Can warn/remove members
- Cannot manage admins or settings

### Community Member
- Views community details
- Creates help requests
- Responds to requests
- Participates in messaging

## Functional Requirements

### FR-002.1: Community Creation

**Description:** Users can create new communities with configurable settings.

**User Story:**
> As a community organizer, I want to create a new mutual aid community so that local members can help each other.

**Acceptance Criteria:**
- [x] User can create community with name and description
- [x] Creator automatically becomes admin with active status
- [x] Community has unique ID (UUID)
- [x] Communities can be public or private
- [x] Max members limit is configurable
- [x] Community has configurable TTL settings
- [x] Community has karma decay settings

**Implementation:**
- Service: `community-service`
- Endpoint: `POST /communities`
- Database: `communities.communities` table
- RLS Policy: `community_isolation`

---

### FR-002.2: Community Discovery

**Description:** Users can browse and search for communities to join.

**User Story:**
> As a user, I want to discover communities in my area so that I can join and participate.

**Acceptance Criteria:**
- [x] List all public communities
- [x] Filter by access type
- [x] Sort by member count, creation date
- [x] Search by name
- [x] View community details before joining
- [x] See member count and max capacity

**Implementation:**
- Endpoint: `GET /communities`
- Supports query parameters: `access_type`, `search`, `sort`

---

### FR-002.3: Joining Communities

**Description:** Users can join public communities or request to join private ones.

**User Story:**
> As a user, I want to join a community so that I can access help requests and participate.

**Acceptance Criteria:**
- [x] Public communities: instant join (status='active')
- [x] Private communities: request to join (status='pending')
- [x] Prevent duplicate memberships
- [x] Check max member capacity
- [x] Join request includes optional message
- [x] Admin receives notification for join requests

**Implementation:**
- Endpoint: `POST /communities/:id/members`
- Event: `join_request_created` published to Redis queue
- Notification: Sent to all community admins

---

### FR-002.4: Member Management

**Description:** Admins can manage community members.

**User Story:**
> As a community admin, I want to approve join requests and manage members so that I can maintain community quality.

**Acceptance Criteria:**
- [x] View all members (active, pending)
- [x] Approve pending join requests
- [x] Reject pending join requests
- [x] Update member roles (member, moderator, admin)
- [x] Remove members from community
- [x] View join request messages
- [x] Filter members by status and role

**Implementation:**
- Endpoints:
  - `GET /communities/:id/members`
  - `PATCH /communities/:id/members/:userId/approve`
  - `PATCH /communities/:id/members/:userId/reject`
  - `PATCH /communities/:id/members/:userId/role`
  - `DELETE /communities/:id/members/:userId`

---

### FR-002.5: Community Settings

**Description:** Admins can configure community settings and data retention policies.

**User Story:**
> As a community admin, I want to configure how long data is retained so that the community aligns with our privacy values.

**Acceptance Criteria:**
- [x] Configure request TTL (days)
- [x] Configure offer TTL (days)
- [x] Configure match TTL (days)
- [x] Configure notification TTL (days)
- [x] Configure message TTL (days)
- [x] Configure session TTL (days)
- [x] Enable/disable karma decay
- [x] Configure karma half-life (months)
- [x] Update community description
- [x] Settings changes apply immediately

**Implementation:**
- Endpoint: `PATCH /communities/:id/settings`
- Database: `communities.community_settings` table
- Cleanup Service: Reads settings for TTL enforcement

---

### FR-002.6: Community Statistics

**Description:** Admins can view comprehensive community analytics.

**User Story:**
> As a community admin, I want to see community statistics so that I can understand engagement and health.

**Acceptance Criteria:**
- [x] Member statistics (total, active, pending, admins, moderators)
- [x] Request statistics (open, matched, completed, trends)
- [x] Match statistics (completion rate, recent activity)
- [x] Karma statistics (average, max, distribution)
- [x] Top helpers leaderboard
- [x] Top requesters list
- [x] Daily activity charts (last 30 days)
- [x] Community health score

**Implementation:**
- Endpoint: `GET /communities/:id/stats`
- Query: Complex CTE joining multiple schemas
- RLS: Disabled for admin queries (safe, already authorized)

---

### FR-002.7: Community Norms

**Description:** Communities can establish norms (community guidelines).

**User Story:**
> As a community admin, I want to create community norms so that members understand expected behavior.

**Acceptance Criteria:**
- [x] Create new norms
- [x] View all norms
- [x] Update existing norms
- [x] Delete norms
- [x] Norms are visible to all members
- [x] Norms displayed on community page

**Implementation:**
- Endpoints: CRUD at `/communities/:id/norms`
- Database: `communities.norms` table

---

## Data Model

### Communities Table
```sql
CREATE TABLE communities.communities (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  access_type VARCHAR(50) DEFAULT 'public',
  max_members INT DEFAULT 100,
  current_members INT DEFAULT 1,
  creator_id UUID NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Members Table
```sql
CREATE TABLE communities.members (
  id UUID PRIMARY KEY,
  community_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role VARCHAR(50) DEFAULT 'member',
  status VARCHAR(50) DEFAULT 'active',
  join_request_message TEXT,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(community_id, user_id)
);
```

### Community Settings Table
```sql
CREATE TABLE communities.community_settings (
  community_id UUID PRIMARY KEY,
  request_ttl_days INT DEFAULT 30,
  offer_ttl_days INT DEFAULT 30,
  match_ttl_days INT DEFAULT 90,
  notification_ttl_days INT DEFAULT 30,
  message_ttl_days INT DEFAULT 90,
  session_ttl_days INT DEFAULT 30,
  karma_decay_enabled BOOLEAN DEFAULT true,
  karma_half_life_months INT DEFAULT 6,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Security

### Row-Level Security (RLS)
- ✅ All community data filtered by `community_id`
- ✅ Session variable: `app.current_community_id`
- ✅ Admins can view all community data
- ✅ Members can only view active community data

### Authorization
- Create community: Any authenticated user
- Join community: Any authenticated user (subject to capacity)
- View members: Community members only
- Manage members: Admins only
- Update settings: Admins only
- View stats: Admins only

## Testing

### Unit Tests
- ✅ Community creation validation
- ✅ Membership uniqueness
- ✅ Capacity limits
- ✅ Role validation

### Integration Tests
- ✅ Join public community
- ✅ Request to join private community
- ✅ Admin approves join request
- ✅ Admin rejects join request
- ✅ Update community settings
- ✅ View community stats

### E2E Tests
- ✅ Full community lifecycle (create → join → manage → delete)
- ✅ Multi-user scenarios
- ✅ Permission boundaries

## Performance

### Optimization
- Indexes on `community_id`, `user_id`, `status`
- Cached member counts
- Paginated member lists

### Scalability
- Supports 1000+ communities
- Each community can have 10,000+ members
- RLS ensures data isolation

## Related Requirements

- [FR-001: Authentication](FR-001-authentication.md) - User auth required
- [FR-003: Help Requests](FR-003-help-requests.md) - Communities contain requests
- [FR-005: Reputation](FR-005-reputation.md) - Karma scoped to community
- [FR-006: Notifications](FR-006-notifications.md) - Join request notifications
- [TR-002: Multi-Tenancy](../technical/TR-002-multi-tenancy.md) - Community isolation

## Known Issues

- [ ] Stats tab requires page refresh to see data (caching issue)
- [x] ~~Notifications don't appear without page refresh~~ - Fixed via SSE

## Future Enhancements

- [ ] Community categories/tags
- [ ] Community discovery map
- [ ] Invite-only communities
- [ ] Community verification badges
- [ ] Community-to-community partnerships
