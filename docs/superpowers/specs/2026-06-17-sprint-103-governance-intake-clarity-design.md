# Sprint 103: Governance + Intake Clarity - Design Spec

**Date**: 2026-06-17
**Status**: Approved
**Version**: v11.11.0 -> v11.12.0
**Sprint Branch**: `feature/sprint-103-governance-intake-clarity`

---

## Overview

Sprint 102 made Karmyq's memory model visible, then the reconnect follow-up removed a dead affordance.
The next trust issue is not visual; it is operational truth. A split can currently make the same parent
admin an admin of both children, even when the whole purpose of the split is to let two groups govern
separately. Service asks can also regress back toward mutual-aid language, which makes paid/provider
and neighbour help flows blur again.

Sprint 103 fixes those truth seams and adds one small operational surface for founding-circle intake.
The public landing form already persists submissions, but reviewing them still requires direct DB
queries. This sprint turns that into authenticated admin/reviewer workflow: list submissions, filter by
status, and mark them reviewed, contacted, or archived. It deliberately does not add outbound
notifications, email, Slack, or a new role system.

The sprint is intentionally narrow. It repairs governance authority after splits, centralizes service
versus mutual-aid action language, and gives the maintainer a reliable review queue for founding-circle
notes.

### Core Principle: Operational Truth Over Implied Affordance

The app should only show authority, actions, and intake state that really exist.

---

## Multi-Sprint Arc

### Sprint 100 - Pulse Truth + Feed Actionability (complete)

Made community pulse counts truthful and inspectable.

### Sprint 101 - Actionability + State Truth (complete)

Made request surfaces show the next real action from server-derived eligibility.

### Sprint 102 - Visible Memory + Re-warm First Step (complete)

Made memory and forgetting visible, then removed the dead peer reconnect CTA.

### Sprint 103 - Governance + Intake Clarity

Repairs split authority, locks provider/mutual-aid action language, and makes founding-circle intake
reviewable without DB spelunking.

### Sprint 104+ - Candidate Directions

Restore a reconnect CTA only after peer messaging or directed asks exist; continue community/provider
link-up clarity; or begin a research-first UI facelift.

---

## New Concepts

### Child-Local Split Admin

After a split, each child community must have an admin selected from that child's assigned members. The
executing parent admin may become admin of a child only if they are assigned to that child. The sibling
relationship remains represented by the `split_origin` community link, not by shared inherited admin
authority.

### Founding-Circle Reviewer

For Sprint 103, a founding-circle reviewer is any authenticated user who is an active admin of at least
one community. This matches the existing frontend admin gate and avoids introducing a new platform-role
schema. A future sprint can replace this with a true platform admin role if the maintainer wants a
separate permission model.

### Request Action Copy

The user-facing action label for offering on an ask is derived from the coarse `request_type`:
`service` -> "Offer service"; all mutual-aid request types -> "Offer to Help". The logic should be a
small shared frontend helper so request cards and request detail cannot drift.

---

## Data Model

No new tables are planned.

Existing founding-circle table is reused:

```sql
auth.founding_circle_submissions (
  id UUID PRIMARY KEY,
  email VARCHAR(320) NOT NULL,
  lens VARCHAR(200),
  contribution TEXT,
  concern TEXT,
  source_page VARCHAR(64) NOT NULL DEFAULT 'join',
  status VARCHAR(24) NOT NULL DEFAULT 'new', -- new | reviewed | contacted | archived
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP
)
```

Sprint 103 may add an idempotent CHECK constraint migration only if one does not already exist:

```sql
ALTER TABLE auth.founding_circle_submissions
  ADD CONSTRAINT founding_circle_status_check
  CHECK (status IN ('new', 'reviewed', 'contacted', 'archived'));
```

No reviewer metadata is added in this sprint. `reviewed_at` is set when a submission first leaves
`new`, and preserved afterward.

---

## API Endpoints

| Method | Path | Description | Auth | Body | Response |
|--------|------|-------------|------|------|----------|
| GET | `/founding-circle/submissions` | List founding-circle submissions, newest first, filterable by `status`, paginated by `limit`/`offset`. | Founding-circle reviewer | none | `{ items, count, limit, offset }` |
| PATCH | `/founding-circle/submissions/:id/status` | Update a submission status to `new`, `reviewed`, `contacted`, or `archived`. | Founding-circle reviewer | `{ "status": "reviewed" }` | updated submission |

Existing endpoint remains unchanged:

| Method | Path | Change |
|--------|------|--------|
| POST | `/founding-circle/submissions` | No change. Still public, honeypot-screened, persist-only. |

Error contract remains ADR-074:

```json
{ "success": false, "message": "Human-readable error", "error": "ERROR_CODE" }
```

---

## Frontend Changes

### Split Governance

- `apps/frontend/src/components/community/tabs/FissionTab.tsx`
  - Keep the existing execute flow and child links.
  - Add or adjust success copy if needed so the page does not imply the parent admin automatically
    governs both children.
  - No broad fission UI redesign.

### Request Action Labels

- `apps/frontend/src/lib/requestActionCopy.ts`
  - New helper: `getOfferActionLabel(requestType?: string, state?: 'idle' | 'pending'): string`.
  - `pending` returns `"Offering service..."` for service asks and `"Offering..."` for mutual-aid asks.
  - `idle` returns `"Offer service"` for service asks and `"Offer to Help"` otherwise.

- `apps/frontend/src/components/Feed/RequestCard.tsx`
  - Replace inline `String(data.request_type) === 'service'` logic with the helper.
  - Keep existing click and `createMatch` behavior.

- `apps/frontend/src/pages/requests/[id].tsx`
  - Use the same helper for the detail action button.
  - Change service-offer error fallback to service language so errors do not say "Failed to offer help"
    on a service ask.

### Founding-Circle Review

- `apps/frontend/src/pages/admin/founding-circle.tsx`
  - Auth-gated admin page using existing `requireAdmin` / `isAdmin` frontend pattern.
  - Shows status filters: New, Reviewed, Contacted, Archived, All.
  - Lists email, lens, contribution, concern, source page, created date, status, and reviewed date.
  - Provides status actions for reviewed/contacted/archived; optionally allows moving back to new for
    correction.
  - No outbound notification button.

- `apps/frontend/src/components/admin/AdminLayout.tsx`
  - Add a nav link to the founding-circle page.

- `apps/frontend/src/lib/api.ts`
  - Add `foundingCircleAdminService.listSubmissions` and `updateSubmissionStatus` wrappers under auth
    service API. Editing this file may retrigger the known CodeQL request-forgery false positive; if it
    does, use the documented trusted `NEXT_PUBLIC_API_URL` rationale.

---

## Backend Changes

### Community Split Admin Selection

- `services/community-service/src/services/fissionService.ts`
  - Extract a pure helper that selects a child admin from assigned members.
  - Selection rule:
    1. If the executing admin is assigned to the child, choose them.
    2. Else choose an assigned member who was already an active parent admin, using `joined_at` then
       `user_id` as deterministic tie-breaks.
    3. Else choose the assigned member with the highest within-child trust degree from parent
       `trust_edges_live`, then `joined_at`, then `user_id`.
  - During `executeSplit`, upsert exactly one admin per child from that child-local selection. Do not
    upsert the executing admin into both children.
  - Keep `split_origin` community link creation unchanged.
  - Recompute `current_members` from actual active child rows after roles are assigned.

### Founding-Circle Review Endpoints

- `services/auth-service/src/database/foundingCircleDb.ts`
  - Add `listFoundingCircleSubmissions`, `updateFoundingCircleSubmissionStatus`, and
    `isFoundingCircleReviewer`.
  - Use parameterized queries only.
  - `isFoundingCircleReviewer(userId)` checks for at least one active `communities.members` row with
    `role='admin'`.

- `services/auth-service/src/routes/foundingCircle.ts`
  - Keep public `POST /submissions` unchanged.
  - Add authenticated `GET /submissions` and `PATCH /submissions/:id/status`.
  - Validate status against `new | reviewed | contacted | archived`.
  - Return 403 for authenticated non-reviewers, 404 for unknown IDs.

---

## User Guide & Doc Updates

Mandatory Sprint 103 docs:

- `docs/guides/community-fission.md`
  - Explain that split children keep a relationship through `split_origin`, but admin authority becomes
    child-local.
  - Clarify how the default child admin is selected if the executing admin is assigned to only one child.

- `docs/concepts/governance.md`
  - Add a short section on split governance: relation is preserved by links, not shared admin by default.

- `docs/concepts/community-and-provider-two-facets.md`
  - Add or tighten action-language guidance: service asks say "Offer service"; mutual-aid asks say
    "Offer to Help".

- `docs/guides/using-service-providers-guide.md`
  - Confirm provider/service asks keep service-specific language throughout card and detail surfaces.

- `docs/adr/ADR-076-founding-circle-intake.md`
  - Update status from persist-only review via `psql` to admin/reviewer API + frontend review queue.
  - No new ADR unless implementation introduces a new role model or notification transport.

- `apps/frontend/CONTEXT.md`
  - Add Sprint 103 frontend section.

- `services/auth-service/CONTEXT.md`
  - Document new founding-circle review endpoints.

- `services/community-service/CONTEXT.md`
  - Document split child-local admin selection in Recent Changes.

- `services/registry.json`
  - Add the two new auth-service endpoints.

- `apps/landing/src/data/docs/`
  - Regenerate after source docs change and force-add generated JSON as needed.

---

## Testing Strategy

TDD first:

- `services/community-service/tests/tdd/sprint-103-split-child-admin.test.ts`
  - Pure helper chooses executing admin only for the child they are assigned to.
  - Sibling child receives an assigned parent admin if present.
  - If no assigned parent admin exists, strongest assigned member by within-child trust degree is chosen.
  - Tie-breaks are deterministic.

- `apps/frontend/tests/tdd/sprint-103-offer-action-copy.test.tsx`
  - Helper returns correct labels.
  - `RequestCard` and request detail both render "Offer service" for service asks.
  - Mutual-aid asks keep "Offer to Help".
  - Service detail error fallback does not say "Failed to offer help".

- `services/auth-service/tests/tdd/foundingCircleReview.route.test.ts`
  - Auth is required for review endpoints.
  - Non-reviewer receives 403.
  - Reviewer can list by status and update status.
  - Invalid status returns 400.
  - Unknown submission returns 404.

- `apps/frontend/tests/tdd/sprint-103-founding-circle-admin.test.tsx`
  - Admin page loads submissions.
  - Status filter changes API params.
  - Mark reviewed/contacted calls the wrapper and updates the visible row.

Regression:

- Existing founding-circle public POST tests remain green.
- Existing Sprint 92 provider-copy and Sprint 101 request-detail action tests remain green.
- Community-service split/fusion tests remain green.

---

## Critical Implementation Notes

1. **Do not create a new platform-role system in Sprint 103.** Founding-circle reviewer permission is
   defined as any active community admin, matching the existing admin UI gate. A true platform role is a
   future architectural decision.
2. **Split child admins must be child-local.** The executing parent admin is not automatically inserted
   as admin into both children. Each child admin must be selected from that child's assigned members.
3. **Keep the `split_origin` link.** The relationship between child communities is preserved by
   `communities.community_links`, not by shared admin authority.
4. **Never leave a child adminless.** If no assigned parent admin exists for a child, promote the
   strongest assigned member by within-child trust degree with deterministic tie-breaks.
5. **Do not change trust/karma carry-forward semantics.** Sprint 103 changes roles only; within-group
   trust and karma copying from Sprint 86 stays intact.
6. **Centralize offer action copy.** Do not reintroduce inline `request_type === 'service'` label checks
   in multiple components.
7. **Service asks are not peer messaging.** Do not restore the Sprint 102 reconnect CTA or add direct
   peer messages as part of service/provider clarity.
8. **Founding-circle review is not notification.** No email, Slack, webhook, queue event, or outbound
   transport in this sprint.
9. **Use the ADR-074 error contract.** New auth-service review endpoints return string `error` codes.
10. **API interceptor unwraps envelopes.** Frontend callers should read `res.data`, not `res.data.data`.
11. **Editing `apps/frontend/src/lib/api.ts` can retrigger CodeQL `js/request-forgery`.** If it recurs,
    dismiss with the documented trusted env-baseURL rationale and re-run the gate.
12. **Docs are part of done.** Update source docs, service contexts, registry, frontend context, and
    regenerated landing docs in the same PR.
