# Group Communities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Introduce Group Communities as a first-class community type with activity scheduling, participant management, and simulation support.

**Architecture:** Add `community_type` to existing communities table; new `activities` + `activity_participants` tables owned by community-service; new activities router mounted at `/communities/:id/activities`; simulation extended with group community templates and schedule/join workflows.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260407-group-communities.sql` | Adds `community_type` column, `activities`, `activity_participants` tables |
| `services/community-service/src/routes/activities.ts` | CRUD + join/leave endpoints for activities |
| `apps/frontend/src/components/ActivitiesTab.tsx` | Lists upcoming activities in a group community |
| `apps/frontend/src/components/ActivityCard.tsx` | Single activity display with join/leave |
| `apps/frontend/src/components/CreateActivityModal.tsx` | Admin form to create an activity |
| `services/simulation-service/src/workflows/schedule-activity-workflow.ts` | Sim workflow: COMMUNITY_BUILDER creates activities |
| `services/simulation-service/src/workflows/join-activity-workflow.ts` | Sim workflow: members join open activities |
| `docs/adr/ADR-050-group-communities.md` | ADR documenting community_type design decision |
| `docs/concepts/group-communities.md` | Concept page source for landing site |
| `tests/tdd/group-communities.test.ts` | TDD integration tests for activities API |

### Existing files to modify
| File | Change |
|------|--------|
| `infrastructure/postgres/init.sql` | Add `community_type` column and new tables to base schema |
| `services/community-service/src/index.ts` | Mount activities router BEFORE generic community router |
| `services/community-service/src/routes/communities.ts` | Accept + return `community_type` in GET/POST |
| `services/community-service/CONTEXT.md` | Document new endpoints + schema |
| `services/registry.json` | Add new activity endpoints + `activity_joined` event |
| `services/simulation-service/src/data/realistic-data.ts` | Add 4 GROUP_COMMUNITIES templates |
| `services/simulation-service/src/profiles/index.ts` | Add `joinActivity` + `scheduleActivity` action weights |
| `services/simulation-service/src/simulator.ts` | Register new workflows |
| `services/simulation-service/src/api-client.ts` | Add activity API methods |
| `services/simulation-service/CONTEXT.md` | Document new workflows |
| `apps/frontend/src/pages/communities/[id].tsx` | Add Activities tab for group communities |
| `apps/frontend/src/components/CreateCommunityModal.tsx` | Add `community_type` toggle |
| `scripts/generate-docs.ts` | Add ADR-050 + group-communities concept to generation |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **`community_type` defaults to `'mutual_aid'`** — all existing communities get this default via the migration. No behavior change for existing data.
2. **Activity endpoints are scoped to community membership** — check `communities.members` for the calling user before any activity operation, same pattern as existing member-gated endpoints.
3. **`current_participants` is a denormalized counter** — increment/decrement via `UPDATE ... SET current_participants = current_participants + 1` inside the same transaction as the participant insert. Do not recalculate from `COUNT(*)` on every read.
4. **Admin-only activity creation** — only users with `role = 'admin'` in `communities.members` can create activities.
5. **Simulation: check `community_type` before scheduling** — `schedule-activity-workflow` must call `GET /communities/:id` and check `community_type === 'group'` before creating activities.
6. **Activities router mount order** — mount `/communities/:communityId/activities` BEFORE the generic `/communities/:id` route in `index.ts` to avoid Express param conflicts.
7. **`scheduled_at` is TIMESTAMPTZ** — store UTC, display in browser local timezone. No server-side conversion.
8. **Karma this sprint = event emit only** — `publishEvent('activity_joined', {...})` is the complete karma implementation. No DB writes to reputation tables.

---

## Task 1: Feature Branch + DB Migration

**Files:**
- Create: `infrastructure/postgres/migrations/20260407-group-communities.sql`
- Modify: `infrastructure/postgres/init.sql`

- [ ] **Create the feature branch**

```bash
git checkout -b feature/sprint-47-group-communities
```

- [ ] **Create the migration file**

```sql
-- infrastructure/postgres/migrations/20260407-group-communities.sql

-- 1. Add community_type to existing communities table
ALTER TABLE communities.communities
  ADD COLUMN IF NOT EXISTS community_type VARCHAR(50) NOT NULL DEFAULT 'mutual_aid';

ALTER TABLE communities.communities
  ADD CONSTRAINT IF NOT EXISTS chk_community_type
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

- [ ] **Mirror the new tables in `init.sql`** — add the same `CREATE TABLE IF NOT EXISTS` blocks for `communities.activities` and `communities.activity_participants` to `infrastructure/postgres/init.sql` in the communities schema section. Add `community_type VARCHAR(50) NOT NULL DEFAULT 'mutual_aid'` to the `CREATE TABLE communities.communities` definition.

- [ ] **Verification**: migration file exists, init.sql updated

---

## Task 2: Community Service — Update Communities Route

**Files:**
- Modify: `services/community-service/src/routes/communities.ts`

- [ ] **In `POST /communities`**: accept `community_type` from request body (default `'mutual_aid'`), validate it is `'mutual_aid'` or `'group'`, include in the `INSERT` statement.

- [ ] **In `GET /communities` (all list queries)**: add `c.community_type` to the `SELECT` column list so it appears in every community object returned.

- [ ] **In `GET /communities/:id`**: add `community_type` to the `SELECT`.

- [ ] **Verification**: `curl -X POST /communities -d '{"name":"Test Group","community_type":"group",...}'` returns the community with `community_type: "group"` in the response.

---

## Task 3: Community Service — Activities Router

**Files:**
- Create: `services/community-service/src/routes/activities.ts`
- Modify: `services/community-service/src/index.ts`

- [ ] **Create `activities.ts` router** with the following endpoints. Use the same `sendSuccess`/`sendError`/`sendNotFound`/`sendForbidden` helpers from `@karmyq/shared/utils/response` used throughout the service. For all endpoints: verify the caller is a member of the community first.

```typescript
import { Router, Request, Response } from 'express';
import { query } from '../database/db';
import { publishEvent } from '../events/publisher';
import { sendSuccess, sendError, sendNotFound, sendForbidden, sendValidationError } from '@karmyq/shared/utils/response';

const router = Router({ mergeParams: true }); // mergeParams: true to access :communityId

// Helper: verify membership
async function getMembership(communityId: string, userId: string) {
  const result = await query(
    `SELECT role FROM communities.members WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
    [communityId, userId]
  );
  return result.rows[0] ?? null;
}

// GET /communities/:communityId/activities
router.get('/', async (req: any, res: Response) => { ... });

// POST /communities/:communityId/activities  (admin only)
router.post('/', async (req: any, res: Response) => { ... });

// GET /communities/:communityId/activities/:activityId
router.get('/:activityId', async (req: any, res: Response) => { ... });

// POST /communities/:communityId/activities/:activityId/join
router.post('/:activityId/join', async (req: any, res: Response) => { ... });

// DELETE /communities/:communityId/activities/:activityId/leave
router.delete('/:activityId/leave', async (req: any, res: Response) => { ... });

export default router;
```

- [ ] **GET `/` implementation**: query `communities.activities` filtered by `community_id = $1 AND status = 'open' AND scheduled_at > NOW()`, ordered by `scheduled_at ASC`. Also LEFT JOIN `communities.activity_participants` to include `is_joined` bool for the calling user.

- [ ] **POST `/` implementation**: validate required fields (`title`, `activity_type`, `scheduled_at`). Check `membership.role === 'admin'`. Insert into `communities.activities`. Return created activity.

- [ ] **GET `/:activityId` implementation**: fetch activity + participants (JOIN with `auth.users` for `name`).

- [ ] **POST `/:activityId/join` implementation**:
  - Check `max_participants` — if `current_participants >= max_participants`, return 400 "Activity is full"
  - `INSERT INTO communities.activity_participants ... ON CONFLICT DO NOTHING`
  - `UPDATE communities.activities SET current_participants = current_participants + 1 WHERE id = $1 AND current_participants < max_participants`
  - Emit event: `publishEvent('activity_joined', { activityId, userId, communityId, activityType, scheduledAt })`
  - Return updated activity

- [ ] **DELETE `/:activityId/leave` implementation**:
  - `DELETE FROM communities.activity_participants WHERE activity_id = $1 AND user_id = $2`
  - If a row was deleted: `UPDATE communities.activities SET current_participants = current_participants - 1 WHERE id = $1`
  - Return success

- [ ] **Mount in `index.ts`**: add BEFORE the generic `/communities/:id` routes:

```typescript
import activitiesRouter from './routes/activities';
// Mount BEFORE the generic community router to avoid param conflict
app.use('/communities/:communityId/activities', authMiddleware, activitiesRouter);
```

- [ ] **Verification**:

```bash
# Create activity (as admin of a group community)
curl -X POST http://localhost:3002/communities/{id}/activities \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Game","activity_type":"pickup_game","scheduled_at":"2026-04-15T10:00:00Z","max_participants":10}'

# List activities
curl http://localhost:3002/communities/{id}/activities \
  -H "Authorization: Bearer $TOKEN"

# Join
curl -X POST http://localhost:3002/communities/{id}/activities/{activityId}/join \
  -H "Authorization: Bearer $TOKEN"
```

---

## Task 4: Frontend — Community Type Toggle in Creation Modal

**Files:**
- Modify: `apps/frontend/src/components/CreateCommunityModal.tsx`

- [ ] **Read the file first**, then add a `community_type` field to the form state (default `'mutual_aid'`).

- [ ] **Add a toggle/radio group** after the community name field:

```
○ Mutual Aid   Help neighbors with everyday requests
○ Group        Coordinate activities, events, and meetups
```

- [ ] **Include `community_type` in the POST body** when submitting the form.

- [ ] **Verification**: Creating a community with "Group" selected → community appears with `community_type: "group"` in the detail view.

---

## Task 5: Frontend — Activities Tab on Community Detail

**Files:**
- Create: `apps/frontend/src/components/ActivityCard.tsx`
- Create: `apps/frontend/src/components/ActivitiesTab.tsx`
- Create: `apps/frontend/src/components/CreateActivityModal.tsx`
- Modify: `apps/frontend/src/pages/communities/[id].tsx`

- [ ] **`ActivityCard.tsx`**: Displays one activity.
  - Title + activity type badge (colored by type: pickup_game=orange, group_run=green, workout=blue, social=purple, other=gray)
  - Date/time (format: "Sat Apr 12 · 10:00 AM") + duration if set
  - Location string
  - Participant count: "4 / 12 joined" or "4 joined" if no cap
  - Join button (primary) or Leave button (secondary) based on `is_joined`
  - Full badge if `current_participants >= max_participants` and not joined

- [ ] **`CreateActivityModal.tsx`**: Admin-only form. Fields: title (text), activity_type (select dropdown), scheduled_at (datetime-local input), duration_minutes (number, optional), location (text, optional), max_participants (number, optional). POST to `/communities/:id/activities`.

- [ ] **`ActivitiesTab.tsx`**:
  - `useEffect` fetch `GET /api/communities/:id/activities` on mount
  - Render list of `ActivityCard` components
  - Show "Create Activity" button if user is admin
  - Empty state: "No upcoming activities. Create one to get started."
  - Handle join/leave by re-fetching the list

- [ ] **`communities/[id].tsx`**: Read the file. If `community.community_type === 'group'`, render an "Activities" tab alongside existing tabs. Pass `communityId` and `isAdmin` to `ActivitiesTab`.

- [ ] **Verification**: Visit a group community → Activities tab visible → activities listed → Join/Leave works.

---

## Task 6: Simulation — Group Community Templates + API Client

**Files:**
- Modify: `services/simulation-service/src/data/realistic-data.ts`
- Modify: `services/simulation-service/src/api-client.ts`

- [ ] **Add `GROUP_COMMUNITIES` array to `realistic-data.ts`**:

```typescript
export const GROUP_COMMUNITIES = [
  {
    name: 'Portland Pickup Basketball Crew',
    description: 'Weekly pickup games at Laurelhurst Park. All skill levels welcome — just bring yourself and some water.',
    location: 'Portland, OR',
    category: 'sports',
    community_type: 'group',
    defaultActivityType: 'pickup_game',
  },
  {
    name: 'SE Portland Running Club',
    description: 'Group runs every Tuesday morning and Saturday afternoon. Routes vary from 3K to 10K.',
    location: 'Portland, OR',
    category: 'fitness',
    community_type: 'group',
    defaultActivityType: 'group_run',
  },
  {
    name: 'Hawthorne Yoga Collective',
    description: 'Community yoga sessions in Sewallcrest Park. Free, donation-based, all levels.',
    location: 'Portland, OR',
    category: 'wellness',
    community_type: 'group',
    defaultActivityType: 'workout',
  },
  {
    name: 'Portland Board Game Society',
    description: 'Weekly board game nights at rotating locations. From gateway games to heavy euros.',
    location: 'Portland, OR',
    category: 'social',
    community_type: 'group',
    defaultActivityType: 'social',
  },
];
```

- [ ] **Add `ACTIVITY_TEMPLATES` to `realistic-data.ts`** — keyed by `activity_type`:

```typescript
export const ACTIVITY_TEMPLATES: Record<string, Array<{title: string, description: string, duration_minutes: number}>> = {
  pickup_game: [
    { title: 'Saturday Pickup Basketball', description: '5v5 at the park, all skill levels welcome', duration_minutes: 90 },
    { title: 'Sunday Morning Hoops', description: 'Casual run — show up and play', duration_minutes: 60 },
  ],
  group_run: [
    { title: 'Tuesday Morning Run', description: '5K loop around the park. Meet at the fountain.', duration_minutes: 45 },
    { title: 'Saturday Long Run', description: '8-10K depending on group pace. Coffee after!', duration_minutes: 75 },
  ],
  workout: [
    { title: 'Sunday Morning Yoga', description: 'All levels. Bring a mat if you have one.', duration_minutes: 60 },
    { title: 'Midweek Flow', description: 'Gentle 45-minute session, donations welcome', duration_minutes: 45 },
  ],
  social: [
    { title: 'Weekly Game Night', description: 'We have a mix of games — come and play whatever sounds fun', duration_minutes: 180 },
    { title: 'Strategy Saturday', description: 'Heavier games this week: Brass, Wingspan, or GMT games', duration_minutes: 240 },
  ],
};
```

- [ ] **Add to `api-client.ts`**:
  - `createActivity(communityId: string, data: object)` → POST `/communities/:id/activities`
  - `getActivities(communityId: string)` → GET `/communities/:id/activities`
  - `joinActivity(communityId: string, activityId: string)` → POST `/communities/:id/activities/:activityId/join`
  - `leaveActivity(communityId: string, activityId: string)` → DELETE `/communities/:id/activities/:activityId/leave`
  - `createCommunity` — already exists, but verify it passes `community_type` if provided

---

## Task 7: Simulation — New Workflows + Profile Weights

**Files:**
- Create: `services/simulation-service/src/workflows/schedule-activity-workflow.ts`
- Create: `services/simulation-service/src/workflows/join-activity-workflow.ts`
- Modify: `services/simulation-service/src/profiles/index.ts`
- Modify: `services/simulation-service/src/simulator.ts`
- Modify: `services/simulation-service/src/workflows/create-community-workflow.ts`

- [ ] **`schedule-activity-workflow.ts`**: COMMUNITY_BUILDER creates 1–2 activities in group communities they manage.

```typescript
export const scheduleActivityWorkflow: Workflow = async (context) => {
  const { session, sessionManager } = context;
  const client = sessionManager.getClient(session);

  // Get communities this user is admin of
  const communities = session.user.communities ?? [];
  const groupCommunity = communities.find(c => c.role === 'admin');
  if (!groupCommunity) return;

  // Fetch community detail to check community_type
  const communityDetail = await client.getCommunity(groupCommunity.id);
  if (!communityDetail || communityDetail.community_type !== 'group') return;

  // Pick an activity template based on community category
  const activityType = communityDetail.defaultActivityType ?? 'other';
  const templates = ACTIVITY_TEMPLATES[activityType] ?? ACTIVITY_TEMPLATES['social'];
  const template = pickRandom(templates);

  // Schedule it 2-10 days from now
  const daysAhead = Math.floor(Math.random() * 9) + 2;
  const scheduledAt = new Date(Date.now() + daysAhead * 86400000);
  scheduledAt.setHours(9 + Math.floor(Math.random() * 6), 0, 0, 0); // 9am-3pm

  await client.createActivity(groupCommunity.id, {
    title: template.title,
    description: template.description,
    activity_type: activityType,
    scheduled_at: scheduledAt.toISOString(),
    duration_minutes: template.duration_minutes,
    max_participants: 8 + Math.floor(Math.random() * 12), // 8-20
  });
};
```

- [ ] **`join-activity-workflow.ts`**: Members discover open activities in their communities and join.

```typescript
export const joinActivityWorkflow: Workflow = async (context) => {
  const { session, sessionManager } = context;
  const client = sessionManager.getClient(session);

  const communities = session.user.communities ?? [];
  if (communities.length === 0) return;

  // Pick a random community and check for group activities
  const community = pickRandom(communities);
  const activities = await client.getActivities(community.id);
  if (!activities || activities.length === 0) return;

  // Join one activity that isn't already joined and isn't full
  const joinable = activities.filter(a => !a.is_joined && 
    (!a.max_participants || a.current_participants < a.max_participants));
  if (joinable.length === 0) return;

  const activity = pickRandom(joinable);
  await client.joinActivity(community.id, activity.id);
};
```

- [ ] **Update `create-community-workflow.ts`**: Mix `GROUP_COMMUNITIES` templates with existing `COMMUNITIES` — roughly 25% chance of creating a group community. Import `GROUP_COMMUNITIES` and use `pickRandom([...COMMUNITIES, ...COMMUNITIES, ...COMMUNITIES, ...GROUP_COMMUNITIES])` to weight toward mutual aid (3:1).

- [ ] **Update `profiles/index.ts`**: add `joinActivity` and `scheduleActivity` action weights:

```typescript
// In SOCIAL_USER profile
joinActivity: 0.20,

// In ACTIVE_HELPER profile
joinActivity: 0.15,

// In COMMUNITY_BUILDER profile
scheduleActivity: 0.15,
joinActivity: 0.10,

// In REQUESTER profile
joinActivity: 0.05,

// In BROWSER profile
joinActivity: 0.02,
```

- [ ] **Register in `simulator.ts`**: import and add both workflows to the action dispatch table, guarded by the profile weight.

- [ ] **Verification**: Run simulation for 30 seconds locally, observe `scheduleActivity` and `joinActivity` log lines.

---

## Task 8: ADR-050 + User Guide + Landing Page Docs

**Files:**
- Create: `docs/adr/ADR-050-group-communities.md`
- Create: `docs/concepts/group-communities.md`
- Modify: `scripts/generate-docs.ts`

- [ ] **Create `ADR-050-group-communities.md`**:

```markdown
# ADR-050: Group Communities as a Distinct Community Type

**Status**: Implemented
**Date**: 2026-04-07
**Sprint**: 47

## Context

Karmyq communities have historically been uniform: all are mutual aid networks coordinating help requests. As the platform grows, users want to coordinate recurring shared activities — sports, fitness, social events — where the coordination unit is a scheduled event, not a help request.

## Decision

Introduce `community_type` as an explicit enum on the communities table (`'mutual_aid'` | `'group'`). Group communities expose activity scheduling endpoints and an Activities tab in the UI. Mutual aid communities are unchanged.

## Consequences

- **Positive**: Clear model for different coordination types; extensible to future types (e.g., `'provider_collective'`).
- **Positive**: Mutual aid behavior is entirely unchanged — no risk to existing communities.
- **Negative**: UI must branch on `community_type` — adds a conditional rendering path.
- **Neutral**: Karma/trust for group activities deferred to Sprint 49.

## Alternatives Considered

- **Single community type with flags**: e.g., `has_activities: boolean`. Rejected — flags accumulate and obscure the community's identity.
- **Separate service**: Activities as a new microservice. Rejected — activities are community-scoped and owned by community-service; a separate service adds cross-service queries for no benefit at current scale.
```

- [ ] **Create `docs/concepts/group-communities.md`**:

```markdown
# Group Communities

Group communities are communities organized around shared recurring activities — sports teams, fitness groups, hobby clubs — rather than help requests.

## How They're Different

| | Mutual Aid | Group |
|---|---|---|
| Coordination unit | Help request | Scheduled activity |
| Karma | Earned by helping | Earned by participating (Sprint 49) |
| Feed | Requests feed | Activities feed |

## Creating a Group Community

When creating a community, choose "Group" as the community type. Group communities show an Activities tab instead of a Requests feed.

## Scheduling Activities

Community admins can create activities with a title, type, date/time, location, and participant cap. Members can join or leave until the activity starts.

## Activity Types

- **Pickup Game** — informal sports games
- **Group Run** — running or walking groups  
- **Workout** — fitness classes or sessions
- **Social** — board games, book clubs, general meetups
- **Other** — anything else
```

- [ ] **Update `scripts/generate-docs.ts`**:
  - Add `'adr-050-group-communities'` to the relevant `ADR_GROUPS` array
  - Add `'group-communities'` to the `howItWorks` (or equivalent concepts) array

- [ ] **Run doc generation**:

```bash
cd apps/landing && npm run generate-docs
```

- [ ] **Verify** `apps/landing/src/data/docs/concepts/adr-050-group-communities.json` and `group-communities.json` were generated.

---

## Task 9: CONTEXT.md + registry.json

**Files:**
- Modify: `services/community-service/CONTEXT.md`
- Modify: `services/registry.json`
- Modify: `services/simulation-service/CONTEXT.md`

- [ ] **`community-service/CONTEXT.md`**: Add to Database Schema section:
  - `community_type` column on `communities.communities`
  - `communities.activities` table (all columns)
  - `communities.activity_participants` table

- [ ] **`community-service/CONTEXT.md`**: Add to API Endpoints section:
  - `GET /communities/:id/activities`
  - `POST /communities/:id/activities`
  - `GET /communities/:id/activities/:activityId`
  - `POST /communities/:id/activities/:activityId/join`
  - `DELETE /communities/:id/activities/:activityId/leave`

- [ ] **`services/registry.json`**: Add to `community-service.apis.provides`:
  - The 5 new activity endpoints

- [ ] **`services/registry.json`**: Add to events:
  - `activity_joined` — published by `community-service`, no subscribers (Sprint 49)

- [ ] **`simulation-service/CONTEXT.md`**: Document `schedule-activity-workflow` and `join-activity-workflow` in the Workflows table.

- [ ] **Verification**:

```bash
npm run feedback:check
npm run analyze:services
```

---

## Task 10: TDD Integration Test

**Files:**
- Create: `tests/tdd/group-communities.test.ts`

- [ ] **Write integration tests** covering the critical paths:

```typescript
describe('Group Communities — Activities API', () => {
  it('creates a community with community_type group');
  it('creates an activity in a group community (admin)');
  it('returns 403 when non-admin tries to create activity');
  it('lists upcoming activities with is_joined flag');
  it('joins an activity and increments current_participants');
  it('returns 409 on duplicate join (idempotent)');
  it('leaves an activity and decrements current_participants');
  it('returns 400 when joining a full activity');
  it('emits activity_joined event on join (stub: verify event published)');
});
```

- [ ] **Run TDD tests** (expected to pass):

```bash
npm run test:tdd -- --testPathPattern=group-communities
```

- [ ] **Run full test suite** (must not regress):

```bash
npm test
```

---

## Task 11: Type Check + Pre-Push Verification

**Files:** None (verification only)

- [ ] **TypeScript check across all changed services**:

```bash
cd services/community-service && npx tsc --noEmit
cd apps/frontend && npx tsc --noEmit
cd services/simulation-service && npx tsc --noEmit
```

- [ ] **Full test suite**:

```bash
npm test
npm run test:tdd
```

- [ ] **Feedback loop check**:

```bash
npm run feedback:check
```

- [ ] **Service dependency analysis**:

```bash
npm run analyze:services
```

- [ ] Fix any failures before proceeding to deploy.

---

## Task 12: Merge + Deploy

- [ ] **Commit all changes**:

```bash
git add -A
git commit -m "feat(group-communities): Sprint 47 — community_type, activity scheduling, simulation"
```

- [ ] **Merge to master and push**:

```bash
git checkout master
git merge feature/sprint-47-group-communities
git push origin master
```

- [ ] **Monitor GitHub Actions** — watch for green on: Tests → Docker Build → Deploy → Health Check

- [ ] **Apply migration on server** (SSH after deploy):

```bash
ssh ubuntu@karmyq.com
psql $DATABASE_URL -f ~/karmyq/infrastructure/postgres/migrations/20260407-group-communities.sql
```

- [ ] **Verify on demo**:
  - Create a Group community → Activities tab visible
  - Create an activity → appears in list
  - Join activity → participant count increments
  - Simulation generating group activities (check logs: `pm2 logs simulation-service | grep "scheduleActivity\|joinActivity"`)

- [ ] Use the `/deploy` skill if needed for deployment steps.
