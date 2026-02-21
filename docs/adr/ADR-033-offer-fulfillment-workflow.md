# ADR-033: Offer Fulfillment Workflow

**Status**: Proposed
**Date**: 2026-02-21
**Deciders**: Development team

---

## Context

Karmyq's current match lifecycle ends at `matched` status — both parties know a match was accepted, but there is no structured guidance for what happens next. For time-sensitive requests (rides, tool loans, services), this creates friction:

- The requester doesn't know when to expect the offerer
- The offerer has no reminder for day-of fulfillment
- Neither party gets contextual help (directions, handoff photos, return reminders)
- There is no "day of" urgency surfacing in the UI

The existing infrastructure already has unused date fields (`scheduled_at` on matches, `availability_start_date` on offers, `preferred_start_date` on requests) and a flexible notification system that can be extended with new event types.

The goal is to move from a purely social matching system to an **end-to-end fulfillment system** that guides both parties through completing the request.

---

## Decision

Build a structured **Offer Fulfillment Workflow** system with four progressive phases:

### Phase 1 — Offer & Accept (extend existing match flow)
- Structured offer form: message + optional scheduled time
- Accept/decline surfaced in notifications and dashboard tile
- Offer detail view: full request info, trust path, accept CTA

### Phase 2 — Scheduling & Reminders
- Add `scheduled_at` column to `requests.matches` table
- When a match is accepted with a scheduled time: create a day-before reminder notification (`match_reminder` type)
- Day-of: tile for accepted offer surfaces to highest dashboard priority (#1) with a countdown or "Today" badge

### Phase 3 — Type-Specific Fulfillment Workflows
Each request type can define a fulfillment workflow appropriate to its context:

| Request Type | Fulfillment Steps |
|---|---|
| **Ride** | "Plan Route" CTA → maps link (offerer location → pickup → destination); confirm pickup time |
| **Tool Borrow** | Photo of tool attached to offer; return reminder notification after `loan_period_days` |
| **Service** | Confirmation of arrival; completion sign-off by requester |
| **Event** | Add to calendar link; day-of reminder |
| **Generic** | Standard complete/confirm flow (existing) |

### Phase 4 — Custom Workflows (Admin-Defined)
- Add optional `workflow` field to `UISchema` (packages/shared)
- Workflow is an array of steps, each with: `label`, `cta_label`, `trigger_condition`, `action_type`
- Action types: `open_url`, `send_notification`, `attach_photo`, `mark_step_complete`
- Frontend renders workflow steps on the matched tile, gating each step on the previous

---

## Consequences

### Positive
- Members get contextual guidance for completing requests — reduces abandonment after match
- Ride, tool, and service requests become significantly more useful
- Admin-defined workflows allow communities to model their own mutual aid patterns
- Day-of surfacing increases on-time fulfillment

### Negative / Tradeoffs
- Scheduling requires a new migration (adds `scheduled_at` to matches)
- Day-of notifications require a scheduled job (cron or Bull queue delay) in the notification service
- Custom workflow schema increases complexity of the UISchema type
- Photo attachments (tool borrow) require a file storage decision (deferred to a separate ADR)

---

## Alternatives Considered

### A. External Calendar Integration (Google Calendar / iCal)
Integrate with calendar APIs to add events directly to users' calendars. Deferred — requires OAuth flows, per-user auth, and platform-specific APIs. Can be added on top of Phase 2 as a progressive enhancement.

### B. In-App Calendar View
Full calendar view showing scheduled matches. Deferred — high UI complexity; day-of tile surfacing achieves most of the value with far less complexity.

### C. No Structured Workflow (Status Quo)
Continue with match accepted → done. Rejected — high abandonment rate expected for time-specific requests with no guidance.

---

## Implementation Notes

**Database changes needed:**
```sql
-- Phase 2
ALTER TABLE requests.matches ADD COLUMN scheduled_at TIMESTAMPTZ;

-- Phase 3 (tool borrow)
ALTER TABLE requests.matches ADD COLUMN attachments JSONB DEFAULT '[]';
```

**New notification type needed (Phase 2):**
```typescript
'match_reminder' // Triggered by scheduled job: day before scheduled_at
```

**Schema extension (Phase 4):**
```typescript
// packages/shared/src/schemas/ui/types.ts
interface WorkflowStep {
  id: string;
  label: string;
  cta_label: string;
  action_type: 'open_url' | 'send_notification' | 'attach_photo' | 'mark_step_complete';
  action_payload?: Record<string, string>;
  trigger_condition?: 'previous_complete' | 'match_accepted' | 'day_of';
}

// Added to UISchema:
workflow?: WorkflowStep[];
```

**Related ADRs:**
- ADR-007: Polymorphic Request System — type-specific workflows extend this
- ADR-032: Server-Driven UI — Phase 4 custom workflows extend the schema definition
- ADR-012: Real-Time Communication — notifications delivery mechanism

---

## Open Questions (to resolve before Accepted)

1. **File storage**: Where do tool photos get stored? (S3, local, CDN?) → separate ADR needed
2. **Calendar export**: Add `.ics` download as a Phase 2 enhancement or defer to Phase 3?
3. **Route planning**: Deep-link to Google Maps / Apple Maps / Waze, or in-app map view?
4. **Workflow step persistence**: Should step completion be stored per-match, or inferred from match status?
