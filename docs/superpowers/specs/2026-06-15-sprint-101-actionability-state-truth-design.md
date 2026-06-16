# Sprint 101: Actionability + State Truth — Design Spec

**Date**: 2026-06-15
**Status**: Approved
**Version**: v11.9.0 -> v11.10.0
**Sprint Branch**: `feature/sprint-101-actionability-state-truth`

---

## Overview

Sprint 100 made feed and pulse counts reachable: when Karmyq says there are open asks or offers in
flight, the member can get to a surface that shows them. Sprint 101 turns that reachability into
actionability. The current UI still has places where a member can reach an item but gets sent to the
wrong tab, sees only an aggregate count, or reads copy that belongs to a different lifecycle state.

This sprint focuses on the request surfaces members touch most: Dashboard Home, Community Home/open
asks, request detail, Helping/Asks, and the graph tab copy/layout spike. Maria's concrete symptoms
anchor the scope: Home should not reduce hundreds of pending offers to only one count; a community
open ask should open a real detail/action surface instead of redirecting to the dashboard; a completed
ask should never say "No offers yet"; and empty/community copy should not imply samples or completed
interactions when it is describing open asks.

### Core Principle: One Truthful Next Action

Every visible request item should state the lifecycle truth and offer the next real action for that
member, on that surface, in that state.

---

## Multi-Sprint Arc

### Sprint 100 — Pulse Truth + Feed Actionability (complete)

Counts became truthful and reachable: distinct helper pulse counts, a read-only community open-asks
view, clickable request cards, labelled asker avatars, the Home "offered to help" summary band, and
community connection reconciliation.

### Sprint 101 — Actionability + State Truth

Turn reachable surfaces into useful ones: per-item offered-awaiting surfacing, a real request detail
route, state-aware Asks copy, community open-ask action rules, and a bounded graph-layout spike.

### Sprint 102+ — Research-First UI Facelift / Visible Decay Delivery

If Sprint 101 removes the obvious state/action lies, the next UX sprint can be a research-first
facelift rather than a bug-disguised redesign. "Platform forgets" visible-decay delivery remains a
strong follow-up candidate.

---

## New Concepts

### Offered Awaiting Item

An **offered awaiting item** is an open, unexpired request where the current member is the responder
on a `proposed` match. It is awaiting the requester, so it is not a decision the responder owes, but
it is still active work that should be visible. Sprint 100 returned only `offeredAwaiting: number`;
Sprint 101 adds a small per-item preview list.

### Actionable Request Detail

`/requests/[id]` is no longer a redirect shim. It becomes the canonical request-detail action surface:
show the ask, payload details, community context, current viewer relationship to the ask, and the next
valid action:

- requester viewing own ask -> status/offers guidance, link to Asks
- responder already offered -> awaiting-response state, link to Helping
- eligible member viewing an open, unexpired ask in a community they actively belong to -> Offer to
  Help / Offer service
- non-actionable state -> clear finite state, no fake CTA

### State-Aware Ask Expansion

The Asks tab should render lifecycle language. "No offers yet" is valid only for an open ask with no
offers. A completed ask with no active offer rows needs completed-state language, not "yet."

### Bounded Graph Layout Spike

Network graph crossings are not treated as a broad visual redesign. The sprint investigates whether a
simple, deterministic improvement is available:

- for circular community-depth graphs, sort nodes by group/type/degree to reduce crossings
- for HEB trust graphs, document why bundled crossings remain inherent if no simple ordering helps

If the answer is "not simple/formulaic," the deliverable is a written decision and no tedious manual
layout pattern.

---

## Data Model

No schema change is planned.

The existing `requests.matches`, `requests.help_requests`, and `requests.request_communities` tables
already contain the data needed for pending-offer item previews and viewer relationship state. Any
additional API fields are derived read-model fields only.

---

## API Endpoints

| Method | Path | Change | Auth | Response |
|---|---|---|---|---|
| GET | `/requests/curated?view=home` | Add `offeredAwaitingItems` alongside existing `offeredAwaiting` | Required | `{ items, count, offeredAwaiting, offeredAwaitingItems }` |
| GET | `/requests/:id` | Enrich request detail with viewer relationship state | Required | Existing request row plus `viewer_relation` (`own_request`, `already_offered`, `can_offer`, `not_actionable`) and optional `viewer_match`; `can_offer` requires `status='open'`, `expired=FALSE`, not own request, no live viewer match, and active membership in at least one request community |
| GET | `/requests/community/:communityId/open-asks` | Keep same endpoint; frontend stops rendering every card read-only when the viewer can act through detail | Required community member | Unchanged `{ items, count }` |

No new mutation endpoint is required. Offering help still uses `POST /matches` through
`requestService.createMatch`, mirroring the existing canonical `RequestCard` behavior. The detail page
may label coarse `request_type='service'` asks as **Offer service**, but provider priced offers
(`provider.offers`) remain in their existing provider-offer flow and are not newly introduced here.

---

## Frontend Changes

| Area | Files | Change |
|---|---|---|
| Dashboard Home | `apps/frontend/src/components/Feed/UnifiedFeed.tsx`; new `OfferedAwaitingPanel.tsx` if useful | Replace the one-count-only offered-awaiting band with a compact per-item preview and link to Helping |
| Types | `apps/frontend/src/types/unified-feed.ts` | Add `OfferedAwaitingItem` / home-feed response typing |
| Request detail | `apps/frontend/src/pages/requests/[id].tsx` | Replace redirect with a real detail/action page built from existing card/payload patterns |
| Request cards | `apps/frontend/src/components/Feed/RequestCard.tsx` | Preserve click behavior and keyboard guard; make read-only/actionable semantics explicit for community open asks |
| Community open asks | `apps/frontend/src/pages/communities/[id]/open-asks.tsx`; `BrowseTab.tsx` copy | Clarify that the page lists open asks and that opening an ask is where action happens |
| Asks tab | `apps/frontend/src/components/MyRequestsTab.tsx` | Render state-aware expanded copy for completed/matched/cancelled/open asks |
| Graph spike | `apps/frontend/src/components/graphs/CommunityDepthGraph.tsx`; `TrustGraphHEB.tsx` only if simple | Try deterministic ordering; document if crossings are inherent |
| Onboarding | `apps/frontend/src/lib/onboarding/workflows.ts` | Update feed/request/community wording to match new detail/action behavior |

---

## User Guide & Doc Updates

Every shipped behavior change updates user-facing docs:

- `apps/landing/src/data/docs/guides/dashboard-home.json` — per-item offered-awaiting preview and Home behavior.
- `apps/landing/src/data/docs/guides/fulfilling-requests.json` — opening a request from community/Home and offering from detail.
- `apps/landing/src/data/docs/guides/making-requests.json` — Asks tab completed/open state language.
- `apps/landing/src/data/docs/guides/managing-commitments.json` — clarify pending offers awaiting acceptance.
- `apps/landing/src/data/docs/guides/match-lifecycle.json` — update lifecycle copy for proposed/offered/completed states if needed.
- `apps/landing/src/data/docs/guides/trust-graph.json` — record graph layout behavior if the spike changes or explicitly preserves the current HEB model.
- `apps/frontend/CONTEXT.md` — record Sprint 101 frontend behavior.
- `services/request-service/CONTEXT.md` and `services/registry.json` — update only if API response contracts change.

No ADR is expected unless the request-detail restoration becomes a broader navigation architecture
decision. If the implementation chooses to introduce a new route contract beyond `/requests/:id`,
create the ADR then.

---

## Critical Implementation Notes

1. **Do not scatter router mocks.** `RequestCard` and `/requests/[id]` use Next routing. The global
   `apps/frontend/jest.setup.js` `next/router` mock already exists; preserve it and use per-file mocks
   only when a test needs a custom `push`/`replace` spy.
2. **Keep keyboard navigation guarded.** Click `stopPropagation` is not enough: `RequestCard`
   `onKeyDown` must keep `e.target === e.currentTarget` so Enter/Space on inner controls does not
   also navigate.
3. **Request detail is the action surface.** Do not send community open-ask clicks to Asks/Helping as
   a substitute for detail. `/requests/[id]` should show the ask and the next valid action.
4. **Pending responder offers are not decisions.** They await the requester. Surface them as "offered
   awaiting" items, not in the "Needs your response" decision band.
5. **Count and items must agree.** `offeredAwaiting` should count distinct open asks; preview items
   should be selected from the same predicate and deduped by request.
6. **State copy must be lifecycle-aware.** "No offers yet" is valid only for an open ask. Completed,
   matched, cancelled, or expired asks need different copy.
7. **Open-asks semantics stay community-wide.** The pulse/open-asks page includes own asks and
   already-offered asks for count reachability; action eligibility is handled by the detail page.
8. **No client-side truth workaround for server state.** Viewer relation (`own_request`,
   `already_offered`, `can_offer`, `not_actionable`) must be derived server-side for request detail.
   `can_offer` means the ask is open, unexpired, not the viewer's own request, the viewer has no live
   proposed/matched responder match, and the viewer is an active member of at least one request
   community. Expired or non-member open asks are `not_actionable`, not optimistic buttons that 403.
9. **Graph layout is bounded.** Try deterministic ordering only if it is simple and formulaic. Do not
   hand-place nodes or invent a tedious pattern.
10. **Docs are part of done.** User guides, onboarding copy, frontend context, and API docs (if
    contracts change) ship with the sprint.
11. **Moderate dependency advisories remain secondary.** Clean them only if low-risk and not at the
    expense of the product truth work; high/critical audit gate still blocks per ADR-059.
