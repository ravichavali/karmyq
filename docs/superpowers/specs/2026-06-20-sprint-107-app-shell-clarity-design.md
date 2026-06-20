# Sprint 107: App Shell Clarity & Commitment Truth - Design Spec

**Date**: 2026-06-20
**Status**: Approved
**Version**: v11.14.1 -> v11.15.0
**Sprint Branch**: `feature/sprint-107-app-shell-clarity`

---

## Overview

Sprint 105 gave the app its warm A-plus visual system, and Sprint 106 plus the v11.14.1 follow-up
trimmed obvious chrome duplication. The remaining problem is structural: the app topbar still shares
the 42rem content reading measure, so identity, nav, notifications, provider duty state, avatar, and
overflow actions are packed into a column sized for prose and feed cards. The app shell should feel
calm before the feed even appears.

This sprint finishes the shell work as a complete product pass: separate chrome width from content
width, make top-level navigation responsive instead of crowded, turn the hamburger/user menu into an
intentional overflow surface, and tune the Dashboard shell rhythm around the community selector and
tabs. The 42rem content column remains the reading/feed measure; only chrome gets a wider container.

The sprint also folds in two commitment-truth bugs captured on `docs/close-sprint-106` rather than
`master`: BUG-022, where the same pending dibs can appear in two places and one surface goes stale
after the other accepts it; and BUG-023, where Home says "You've offered to help..." but the user
cannot verify those asks in Helping. These belong in the same sprint because the shell is the
navigation promise: if Home points to Helping, Helping must show the same state truth.

### Core Principle: Calm Chrome, One Truth

Navigation and commitment surfaces should give people a stable map: one place per action, one source
of truth per count, and enough space for the interface to breathe.

---

## Multi-Sprint Arc

### Sprint 105 - UI Facelift Implementation (complete)

Implemented ADR-079's warm A-plus design system across the app, including shared shell classes,
warm topbar, typography, cards, finite states, and dashboard feed treatment.

### Sprint 106 - Post-Facelift Correctness & Link-Up Clarity (complete)

Fixed BUG-013 through BUG-016, moved DecisionBand to Helping, repaired provider feed copy, and shipped
the first header breathing-room pass. The v11.14.1 follow-up removed redundant Home nav, folded
provider notifications into the single bell, consolidated duty state, aligned tabs, and refreshed the
app splash.

### Sprint 107 - App Shell Clarity & Commitment Truth

Completes the shell pass by fixing the container-level topbar cause, defining responsive overflow
rules, and ensuring Home/Helping commitment surfaces are coherent.

### Later

Visible forgetting, responder Home actionability for `proposed` matches, Dibs relationship routing,
member forget/export, service scope/platform routing, simulation/data cleanup, and mobile parity stay
out of this sprint.

---

## New Concepts

### Chrome Container

A wider layout container for app chrome only. It may be implemented as a CSS custom property such as
`--measure-chrome: 72rem` plus `.kq-chrome-page`. It must not replace or widen `--measure`, which
remains the 42rem reading/feed measure.

### Responsive Overflow

Top-level navigation remains visible when the viewport can support it, but moves into an overflow menu
before it crowds identity and action controls. This is a responsive rule, not another one-off removal
of nav information.

### Canonical Dibs Decision Surface

Pending dibs responses are commitment decisions. The canonical action surface is the server-ranked
DecisionBand in Helping. A separate duplicate DibsCard action list must not render the same pending
dibs.

### Offered-Awaiting Truth

The Home "You've offered to help..." preview and the Helping tab must derive from one backend
predicate for proposed responder matches on open, unexpired asks. If Home says "View all in Helping",
Helping must show those rows in a recognizable section.

---

## Data Model

No schema changes.

No migrations.

No new tables or columns.

---

## API Endpoints

| Method | Path | Description | Auth | Body | Response |
|--------|------|-------------|------|------|----------|
| GET | `/requests/offered-awaiting` | New read-only endpoint returning the asks the authenticated member has already offered on and is waiting for the requester to answer. Uses the same predicate as Home's `offeredAwaiting` count: responder match `status='proposed'`, request `status='open'`, `expired=false`, deduped by request. | JWT | None | `{ success:true, data:{ count:number, items: OfferedAwaitingItem[] } }` |
| GET | `/requests/curated?view=home` | Existing endpoint keeps returning `offeredAwaiting` and `offeredAwaitingItems`; internally it should use the same helper as `/requests/offered-awaiting`. | JWT | None | Existing response shape unchanged |
| GET | `/requests/dibs/pending-for-provider` | Existing endpoint remains available for compatibility, but the Helping tab should not use it to render a duplicate action list when DecisionBand already surfaces pending dibs. | JWT | None | Existing response shape unchanged |

Route-order note: `/requests/offered-awaiting` must be registered before `/requests/:id`.

---

## Frontend Changes

### `apps/frontend/src/styles/globals.css`

Add a chrome-specific measure token, for example `--measure-chrome: 72rem`, without changing
`--measure`.

### `apps/frontend/src/styles/karmyq-shell.css`

Add `.kq-chrome-page` for topbar/header chrome. Keep `.kq-page` as the content measure. Update shell
comments so future work does not widen the reading measure to fix nav crowding.

### `apps/frontend/src/components/Layout.tsx`

Use the chrome container for `kq-topbar`. Refactor the hamburger into a general overflow/menu surface
visible whenever top-level nav is collapsed, not only mobile. Keep wordmark, notification bell,
provider On duty/Off duty toggle, avatar/profile, and logout reachable. Top-level nav should be
visible only at a width where "Communities" and "Service Providers" fit without crowding.

### `apps/frontend/src/pages/dashboard.tsx`

Keep `/dashboard?tab=helping` behavior. Tune the dashboard shell region so the community selector,
tabs, and Browse heading feel connected to the app shell rather than stacked as unrelated bands.

### `apps/frontend/src/components/TabBar.tsx`

Preserve the Dashboard tab model (`Browse`, `Helping`, `Asks`) and bottom nav. Adjust alignment only
if needed after the chrome container change; do not make tabs wider solely because the topbar is wider.

### `apps/frontend/src/components/CommitmentsTab.tsx`

Remove the duplicate pending-dibs action surface from Helping. The "Needs your response" DecisionBand
is the canonical dibs accept/decline surface. Use DecisionBand decisions to drive the Helping tab's
dibs count/badge.

Add an "Offers awaiting requester" or equivalent section sourced from `/requests/offered-awaiting`.
It should render the same requests Home previews and make the "View all in Helping" link truthful.

### `apps/frontend/src/components/Feed/OfferedAwaitingPanel.tsx`

Keep the Home preview band, but make copy and links match the new Helping section. If the count is
larger than the preview, keep the calm preview and link to Helping for the full list.

### `apps/frontend/src/lib/api.ts`

Add `requestService.getOfferedAwaiting()` or equivalent typed wrapper for `GET /requests/offered-awaiting`.

---

## User Guide & Doc Updates

Mandatory sprint docs:

1. Update `docs/BUGS.md` on the Sprint 107 branch with BUG-022 and BUG-023 from `docs/close-sprint-106`
   if PR #106 has not been merged first. Mark them planned for Sprint 107 during implementation and
   fixed after the fixes land.
2. Update `apps/frontend/CONTEXT.md` with the new shell container rule, responsive overflow behavior,
   canonical dibs surface, and offered-awaiting truth rule.
3. Update the relevant user guide source for Dashboard/Home/Helping behavior. If no dedicated guide
   exists, update or add the smallest guide that explains: Home preview, Helping tab, pending dibs,
   and where to respond.
4. Update landing docs data under `apps/landing/src/data/docs/` through the documented generated-docs
   pipeline if the guide/concept source changes require it.
5. Update `services/registry.json` and landing service docs for `request-service` because
   `/requests/offered-awaiting` is a new endpoint.
6. No ADR is expected unless implementation chooses a broader navigation architecture than this spec.

---

## Critical Implementation Notes

1. **Do not widen `--measure`.** The 42rem measure is intentional for feed cards and prose. Add a
   chrome-specific container for topbar/app-shell width.
2. **Responsive overflow is a rule, not a disappearance.** Communities, Service Providers or Become a
   provider, Profile, provider management, duty state, notifications, and logout must remain reachable
   on every viewport.
3. **BUG-022 is a duplicate-surface bug.** Pending dibs should not render both in DecisionBand and in
   a separate DibsCard list. Choose one canonical action surface; this sprint chooses DecisionBand.
4. **BUG-023 is a truth mismatch, not just copy.** The Home offered-awaiting count/preview and the
   Helping list must share the same backend predicate.
5. **If Home says "View all in Helping", Helping must show those asks.** Do not leave the user to infer
   that "Awaiting Acceptance" means the Home preview.
6. **Keep DecisionBand in Helping.** Sprint 106 deliberately moved decisions out of Browse; do not
   reintroduce commitment actions into Browse.
7. **Use semantic and accessible controls.** Icon/menu buttons need labels, focus states, and keyboard
   behavior. Status must not be color-only.
8. **Use the global `next/router` Jest mock.** Do not add one-off router mocks for widely rendered
   shell components unless a test needs custom query behavior.
9. **BUG-022/023 evidence may live only on `docs/close-sprint-106`.** Do not assume PR #106 is merged;
   copy the exact bug text into Sprint 107 docs if needed.
10. **Human browser validation is required.** Validate desktop, tablet, and 320-375px mobile chrome,
    plus Home -> Helping flows for pending dibs and offered-awaiting rows.
