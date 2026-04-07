# Sprint 47: Group Communities — Design Spec

**Date**: 2026-04-07
**Status**: Approved
**Version**: v9.12.0 → v9.13.0
**Sprint Branch**: `feature/sprint-47-group-communities`

---

## Overview

Karmyq communities today are uniform: all are mutual aid networks where members post requests and help each other. But not all community coordination looks like that. Sports teams organize pickup games. Fitness groups schedule group runs. Hobby clubs plan meetups. These are **activity-first communities** — recurring, scheduled, participatory — where the thing being coordinated is a shared event, not a help request.

Sprint 47 introduces **Group Communities** as a first-class community type alongside the existing mutual aid model. A group community can schedule activities (a pickup basketball game, a group yoga session, a hiking trip), set a participant cap, and let members join or leave. Karma and trust mechanics are **stubbed** this sprint — events are emitted but not processed — to keep scope tight.

The sprint also extends the simulation service to generate realistic group communities and activity participation, so the demo environment has live group data from day one.

### Core Principle: Communities as Coordination Surfaces

A community is not just a membership list — it is a surface for a specific type of coordination. Mutual aid communities coordinate help requests. Group communities coordinate shared activities. The community type drives what the UI shows and what workflows are available.

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 45 | Trust Configuration Externalization | ✅ Complete |
| Sprint 46 | Error Visibility + Committed Match State | ✅ Complete |
| **Sprint 47** | **Group Communities — Data Model + Activity Scheduling** | ← This sprint |
| Sprint 48 | Onboarding — First-Run UX + Community Type Selection | Upcoming |
| Sprint 49 | Karma + Trust for Group Activities | Upcoming |

---

## New Concepts

| Term | Definition |
|------|-----------|
| `community_type` | Enum on the community: `'mutual_aid'` (default, existing behavior) or `'group'` (activity-first) |
| `Activity` | A scheduled event within a group community: has a title, date/time, location, participant cap, and type |
| `activity_type` | The kind of activity: `'pickup_game'`, `'group_run'`, `'workout'`, `'social'`, `'other'` |
| `activity_joined` | Bull queue event emitted when a user joins an activity — **stubbed, no consumer this sprint** |

---

## Data Model

### Migration: `infrastructure/postgres/migrations/20260407-group-communities.sql`

```sql
-- 1. Add community_type to existing communities table
ALTER TABLE communities.communities
  ADD COLUMN IF NOT EXISTS community_type VARCHAR(50) NOT NULL DEFAULT 'mutual_aid';

-- Constraint: only valid types allowed
ALTER TABLE communities.communities
  ADD CONSTRAINT chk_community_type
  CHECK (community_type IN ('mutual_aid', 'group'));

-- 2. Activities table
CREATE TABLE IF NOT EXISTS communities.activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    activity_type VARCHAR(100) NOT NULL DEFAULT 'other',
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER,
    location TEXT,
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    max_participants INTEGER,
    current_participants INTEGER DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_activity_status CHECK (status IN ('open', 'cancelled', 'completed')),
    CONSTRAINT chk_activity_type CHECK (activity_type IN ('pickup_game', 'group_run', 'workout', 'social', 'other'))
);

-- 3. Activity participants table
CREATE TABLE IF NOT EXISTS communities.activity_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES communities.activities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(activity_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_activities_community_id ON communities.activities(community_id);
CREATE INDEX IF NOT EXISTS idx_activities_scheduled_at ON communities.activities(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_activities_status ON communities.activities(status);
CREATE INDEX IF NOT EXISTS idx_activity_participants_activity_id ON communities.activity_participants(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_participants_user_id ON communities.activity_participants(user_id);

-- Grants
GRANT ALL PRIVILEGES ON communities.activities TO karmyq_user;
GRANT ALL PRIVILEGES ON communities.activity_participants TO karmyq_user;
```

---

## API Endpoints

### Updated: Community Creation and Listing

| Method | Path | Change |
|--------|------|--------|
| POST | `/communities` | Accept optional `community_type` field (default: `'mutual_aid'`) |
| GET | `/communities` | Return `community_type` in each community object |
| GET | `/communities/:id` | Return `community_type` in community object |

### New: Activities

All activity endpoints require the caller to be an authenticated member of the community.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/communities/:id/activities` | Member | List upcoming activities (status=open, ordered by scheduled_at ASC) |
| POST | `/communities/:id/activities` | Admin | Create a new activity |
| GET | `/communities/:id/activities/:activityId` | Member | Get activity detail including participant list |
| POST | `/communities/:id/activities/:activityId/join` | Member | Join an activity |
| DELETE | `/communities/:id/activities/:activityId/leave` | Member | Leave an activity |

#### POST `/communities/:id/activities` — Request Body
```json
{
  "title": "Saturday Pickup Basketball",
  "description": "5v5 at the park, all skill levels welcome",
  "activity_type": "pickup_game",
  "scheduled_at": "2026-04-12T10:00:00-07:00",
  "duration_minutes": 90,
  "location": "Laurelhurst Park, Portland, OR",
  "latitude": 45.5231,
  "longitude": -122.6319,
  "max_participants": 12
}
```

#### GET `/communities/:id/activities` — Response
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "community_id": "uuid",
      "title": "Saturday Pickup Basketball",
      "activity_type": "pickup_game",
      "scheduled_at": "2026-04-12T10:00:00-07:00",
      "duration_minutes": 90,
      "location": "Laurelhurst Park, Portland, OR",
      "max_participants": 12,
      "current_participants": 4,
      "status": "open",
      "created_by": "uuid",
      "is_joined": true
    }
  ]
}
```

#### GET `/communities/:id/activities/:activityId` — Response
Same as above item, plus:
```json
{
  "participants": [
    { "user_id": "uuid", "name": "Maria Reyes", "joined_at": "..." }
  ]
}
```

---

## Frontend Changes

### Community Creation (`apps/frontend/src/components/`)
- **`CreateCommunityModal.tsx`**: Add `community_type` toggle — "Mutual Aid" / "Group" — displayed as two radio buttons with a short description of each type. Default: Mutual Aid.

### Community Detail (`apps/frontend/src/pages/communities/[id].tsx`)
- If `community_type === 'group'`: render an **Activities** tab alongside existing tabs
- If `community_type === 'mutual_aid'`: no change to existing behavior

### New Components
- **`ActivitiesTab.tsx`**: Fetches and renders `GET /communities/:id/activities`. Shows upcoming activities, "Create Activity" button (admin only), empty state.
- **`ActivityCard.tsx`**: Displays a single activity — title, activity type badge, date/time, location, participant count (`4 / 12`), joined status, and Join/Leave button.
- **`CreateActivityModal.tsx`**: Form for creating a new activity. Fields: title, activity type (dropdown), date/time picker, duration, location, max participants. Admin only.

---

## Event Stub (Karma Foundation for Sprint 49)

When a user joins an activity, emit to the Bull queue:
```typescript
publishEvent('activity_joined', {
  activityId: string,
  userId: string,
  communityId: string,
  activityType: string,
  scheduledAt: string
});
```

**No consumer this sprint.** Reputation service will process `activity_joined` in Sprint 49.

---

## Simulation Extensions

### New Group Community Templates (`realistic-data.ts`)
Add 4 group community templates:
1. **Portland Pickup Basketball Crew** — `activity_type: 'pickup_game'`
2. **SE Portland Running Club** — `activity_type: 'group_run'`
3. **Hawthorne Yoga Collective** — `activity_type: 'workout'`
4. **Portland Board Game Society** — `activity_type: 'social'`

### New Workflows
- **`schedule-activity-workflow.ts`**: `COMMUNITY_BUILDER` profile creates 1–3 activities per group community it manages. Runs after community creation.
- **`join-activity-workflow.ts`**: All profiles (weighted toward ACTIVE_HELPER and SOCIAL_USER) discover open activities in their communities and join 1–2 per session.

### Profile Weight Updates (`profiles/index.ts`)
- Add `joinActivity` action weight: SOCIAL_USER → 0.2, ACTIVE_HELPER → 0.15, COMMUNITY_BUILDER → 0.1, REQUESTER → 0.05, BROWSER → 0.02

---

## User Guide & Doc Updates

### New landing page content (Sprint 47 ships these)
1. **User Guide**: `apps/landing/src/data/docs/guides/group-communities.json` — "How to use Group Communities": creating a group community, scheduling activities, joining activities
2. **ADR-050**: `apps/landing/src/data/docs/concepts/adr-050-group-communities.json` — documents the community_type design decision
3. **Update**: `apps/landing/src/data/docs/concepts/how-communities-work.json` (if exists) — add section on group communities

Source files:
- `docs/concepts/group-communities.md` (new)
- `docs/adr/ADR-050-group-communities.md` (new)
- `scripts/generate-docs.ts` — add to `howItWorks` list and `ADR_GROUPS`

---

## Critical Implementation Notes

1. **`community_type` defaults to `'mutual_aid'`** — all existing communities get this default via the migration. No behavior change for existing data.
2. **Activity endpoints are scoped to community membership** — check `communities.members` for the calling user before any activity operation, same pattern as existing member-gated endpoints.
3. **`current_participants` is a denormalized counter** — increment/decrement via SQL `UPDATE ... SET current_participants = current_participants + 1` inside the same transaction as the `INSERT INTO activity_participants`. Do not recalculate from a `COUNT(*)` on every read.
4. **Admin-only activity creation** — only users with `role = 'admin'` in `communities.members` can create activities. Use the same admin check pattern as existing community management endpoints.
5. **Simulation: filter group communities by `community_type`** — the `schedule-activity-workflow` must look up the community's type before scheduling. Use the API `GET /communities/:id` response; do not assume.
6. **Events route order** — if adding an `activities` router, mount it at `/communities/:id/activities` in `index.ts` BEFORE the generic `/communities/:id` router to avoid param conflicts.
7. **`scheduled_at` timezone** — store as `TIMESTAMPTZ` (always UTC in DB), display in frontend using the browser's local timezone. Do not apply server-side timezone conversion.
8. **Karma stub is an event emit only** — do not create any DB records for karma in Sprint 47. The `publishEvent('activity_joined', ...)` call is the complete karma implementation for this sprint.
