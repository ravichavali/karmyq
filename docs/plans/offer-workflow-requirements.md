# Offer Fulfillment Workflow — Requirements

**Status**: Proposed (not yet scheduled)
**ADR**: [ADR-033](../adr/ADR-033-offer-fulfillment-workflow.md)
**Last updated**: 2026-02-21

---

## Problem Statement

After a match is accepted, Karmyq provides no structured guidance to either party. For time-sensitive requests (rides, tool loans, services), this results in:
- Uncertainty about when fulfillment will happen
- No reminders or day-of urgency
- No contextual actions (directions, return reminders, photo confirmation)
- High risk of abandonment after the initial match

---

## Goals

1. Guide both requester and offerer through completing a match end-to-end
2. Surface time-sensitive matches prominently on the day they're due
3. Support type-specific workflows (ride directions, tool photos, etc.)
4. Allow community admins to define custom workflows for their request types

---

## Non-Goals (for this phase)

- Native calendar sync (Google Calendar, Apple Calendar) — deferred
- In-app map rendering — deep-link to external maps apps instead
- File storage infrastructure decision — separate ADR needed before Phase 3 tool photos
- Push notifications to mobile — depends on mobile app maturity

---

## Phase 1: Structured Offer & Accept

### User Stories

**As a member wanting to help (offerer):**
- I can view the full details of a request before making an offer
- I can attach an optional message and schedule a proposed time when making an offer
- I can see my pending offers and their status on my dashboard

**As a requester:**
- I am notified when someone makes an offer on my request
- I can view the offer with trust path context before accepting
- I can accept or decline from the notification or dashboard tile

### Acceptance Criteria

- [ ] Offer detail view shows: request description, requester trust distance, offer message, proposed time (if set)
- [ ] Offer form includes: freetext message field, optional datetime picker for proposed time
- [ ] Proposed time is stored as part of the offer (extend `requests.help_offers` or pass through to `matches.scheduled_at` on accept)
- [ ] Accept/decline buttons appear in `match_created` notification and on dashboard tile
- [ ] Declining hides the offer from the requester's view; accepting triggers Phase 2 scheduling

### Files Affected
- `services/request-service/src/routes/matches.ts` — accept endpoint stores `scheduled_at`
- `apps/frontend/src/components/OfferItem.tsx` — add proposed time display
- `apps/frontend/src/pages/dashboard.tsx` — offer detail expansion

---

## Phase 2: Scheduling & Reminders

### User Stories

**As an offerer for an accepted match with a scheduled time:**
- I receive a reminder notification the day before
- My dashboard tile shows a "Today" badge or countdown on the day of fulfillment

**As a requester:**
- I receive a reminder the day before as well
- The matched tile is visually prominent on the day of fulfillment

### Acceptance Criteria

- [ ] `requests.matches` table has `scheduled_at TIMESTAMPTZ` column (migration required)
- [ ] When a match is accepted and `scheduled_at` is set, a `match_reminder` notification is scheduled for `scheduled_at - 24h`
- [ ] Scheduled reminder fires for both parties (requester + offerer)
- [ ] On day-of (`scheduled_at` date = today): tile priority upgraded to #1 in dashboard 5-tier system, with "Today" badge
- [ ] Tiles without `scheduled_at` behave as before

### Database Migration
```sql
-- infrastructure/postgres/migrations/YYYYMMDD-add-scheduled-at-to-matches.sql
ALTER TABLE requests.matches ADD COLUMN scheduled_at TIMESTAMPTZ;
```

### New Notification Type
```typescript
// services/notification-service/src/templates.ts
'match_reminder': {
  title: 'Upcoming Match — Tomorrow',
  body: 'Your match for "{{request_title}}" is scheduled for tomorrow.',
  priority: 'HIGH',
  channels: ['in_app', 'push'],
}
```

### Files Affected
- `infrastructure/postgres/migrations/` — new migration file
- `services/notification-service/src/templates.ts` — new notification type
- `services/notification-service/src/` — scheduled job to emit `match_reminder` events
- `apps/frontend/src/pages/dashboard.tsx` — day-of tile priority logic + "Today" badge

---

## Phase 3: Type-Specific Fulfillment

### Ride Workflow

**User Stories:**
- As an offerer who accepted a ride request, I see a "Plan Route" button on my matched tile
- Clicking "Plan Route" opens my preferred maps app with: my current location → pickup address → destination

**Acceptance Criteria:**
- [ ] Matched tile for `ride` request type shows "Plan Route" CTA
- [ ] CTA constructs a maps deep-link: `https://maps.google.com/maps?waypoints=...`
- [ ] Falls back to Google Maps on desktop, platform native on mobile
- [ ] Pickup and destination come from the request payload (`origin.address`, `destination.address`)

### Tool Borrow Workflow

**User Stories:**
- As an offerer of a tool loan, I can attach a photo of the item when making my offer
- As a requester who accepted a tool loan, I receive a return reminder notification after `loan_period_days`

**Acceptance Criteria:**
- [ ] Offer form for `borrow` request type shows optional photo attachment field
- [ ] Photos stored via TBD file storage (separate ADR)
- [ ] Photo shown on matched tile for both parties
- [ ] When match is accepted: schedule a `tool_return_reminder` notification for `scheduled_at + loan_period_days`
- [ ] `loan_period_days` sourced from request payload field (to be added to borrow schema)

### Service Workflow

**User Stories:**
- As an offerer, I mark "I've arrived" when I arrive at the requester's location
- As a requester, I confirm completion once the service is done

**Acceptance Criteria:**
- [ ] Matched tile shows two sequential steps: "Mark Arrived" → "Mark Complete" (requester confirms)
- [ ] Steps stored as match metadata (JSONB column or step status table — TBD)

### Files Affected
- `apps/frontend/src/components/OfferItem.tsx` — route planning CTA, photo display
- `apps/frontend/src/pages/dashboard.tsx` — type-specific step rendering on matched tile
- `services/request-service/src/routes/matches.ts` — store photo attachments, step state
- `packages/shared/src/schemas/requests/borrow.ts` — add `loan_period_days` field

---

## Phase 4: Admin-Defined Custom Workflows

### Overview

Community admins can define fulfillment workflow steps in the request type schema. The frontend renders these steps sequentially on the matched tile.

### Schema Extension

```typescript
// packages/shared/src/schemas/ui/types.ts
export interface WorkflowStep {
  id: string;
  label: string;            // "Plan your route"
  cta_label: string;        // "Open Maps"
  action_type: 'open_url' | 'send_notification' | 'attach_photo' | 'mark_step_complete';
  action_payload?: {
    url_template?: string;  // supports {{origin.address}} interpolation
    notification_type?: string;
    delay_hours?: number;
  };
  trigger_condition?: 'match_accepted' | 'previous_complete' | 'day_of';
  role?: 'offerer' | 'requester' | 'both';  // who sees this step
}

// Added to UISchema:
workflow?: WorkflowStep[];
```

### Admin UI

- Schema Canvas editor (ADR-planned) gets a "Workflow" tab
- Admin can add/reorder/delete workflow steps
- Step editor: label, CTA label, action type, trigger condition, role

### Frontend Rendering

- Matched tile queries the schema for `workflow` field
- Renders steps in order, gating each on the previous step being completed
- Step completion stored as `matches.workflow_state: JSONB` (`{ [stepId]: 'complete' | 'pending' }`)

### Files Affected
- `packages/shared/src/schemas/ui/types.ts` — `WorkflowStep` type, `UISchema.workflow`
- `apps/frontend/src/components/OfferItem.tsx` — workflow step renderer
- `services/request-service/src/routes/matches.ts` — `workflow_state` update endpoint
- `apps/frontend/src/components/admin/SchemaCanvas.tsx` — Workflow tab (future)

---

## Metrics & Success Criteria

| Metric | Target |
|--------|--------|
| Match completion rate | +20% vs baseline after Phase 2 |
| Day-of abandonment (no completion logged) | -30% for scheduled matches |
| Ride request fulfillment rate | >80% after Phase 3 |
| Tool return on time | >90% after Phase 3 reminders |

---

## Open Questions

1. **File storage for photos**: S3? CDN? Local volume? → Needs separate ADR before Phase 3
2. **Calendar `.ics` export**: Add as Phase 2 enhancement? Low effort, high value for some users
3. **Step state persistence**: JSONB on `matches` table vs. separate `match_steps` table?
4. **Notification scheduling**: Bull queue with delayed jobs (already in stack) or cron?
