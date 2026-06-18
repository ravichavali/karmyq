# Sprint 105: UI Facelift Implementation - Design Spec

**Date**: 2026-06-17
**Status**: Approved
**Version**: 11.12.0 -> 11.13.0 (also reconcile root `package.json` drift from 11.10.0)
**Sprint Branch**: `feature/sprint-105-ui-facelift-implementation`

---

## Overview

Sprint 104 proved that Karmyq does not need a new visual costume. The warm commons system already
exists and works where it landed: Dashboard Home, the unified feed, the community page, the topbar,
and request detail. The problem is uneven adoption. The standalone Request feed, offers list, match
detail, and much of Profile still speak the pre-S88 language: wide grids, shadow cards, raw Tailwind
colors, bold match percentages, and SaaS filter chrome.

Sprint 105 implements the maintainer-approved "A-plus" direction from Sprint 104. Direction A is the
scope: finish the warm system everywhere, standardize tokens and components, kill the fossil card/feed
patterns, and make the product look like its best existing page. Direction B contributes only
consumer-backed hooks: a nullable texture token, a reusable motif class, and a smoother serif ramp may
land only if at least one S105 finite-state or divider uses them; otherwise defer them to the sprint
that needs them. Direction C stays parked.

This is a full rollout sprint, not just foundation plus request feed. It still lands in a controlled
order: shared token/component foundation first, then the Request feed cluster, Profile and chrome,
Dashboard Home polish, and Community light polish. No backend behavior, database schema, or API
contract changes are expected. The sprint is frontend-heavy and must end with demo validation because
it changes the visible product shell.

### Core Principle: Convergence is the facelift

The visual upgrade comes from making every surface obey the warm commons system already approved and
shipped, not from adding a louder personality.

---

## Multi-Sprint Arc

### Sprint 104 - UI Facelift Research (complete)
Audited the current UI across four clusters, produced the A/B/C directions, recorded the maintainer's
"A-plus" verdict, and shipped ADR-079 as Proposed.

### Sprint 105 - UI Facelift Implementation (this sprint)
Implements A-plus across the full app surface set: foundation tokens, Request feed/detail fossils,
Profile/chrome, Dashboard, Community polish, docs, validation, and deploy.

### Sprint 106+ - Functional Follow-Ons (upcoming)
Candidate follow-ons remain out of scope for S105: responder Home actionability beyond the secondary
altitude, Dibs server-side relationship routing, member forget/export, reconnect CTA, service
consolidation, and mobile parity.

---

## New Concepts

### A-plus

The official Sprint 105 direction: Direction A convergence is mandatory; Direction B expressive hooks
are allowed only as default-off, sparse infrastructure when there is a real S105 consumer; Direction C
is parked.

### Visual System Foundation

The shared tokens and primitives every surface consumes: one reading measure, one card radius, one
card primitive, one mid-size serif heading, one finite-state treatment, semantic status/urgency
helpers, and optional texture/motif hooks that do not change the default app appearance and only land
with a finite-state/divider consumer.

### Fossil Surface

A pre-S88 surface that still uses old card, color, width, or match-score patterns. In S105 this means
primarily `pages/requests/index.tsx`, `pages/offers/index.tsx`, `pages/matches/[id].tsx`, and the old
body sections of `pages/profile.tsx`.

### Secondary Home Altitude

A low-key Dashboard Home layer for established users whose primary queue is empty. It should offer
real, calm next context such as recent helps, open community asks, or communities needing a hand
without inventing fake urgency or engagement chrome.

---

## Data Model

None. No schema changes.

## API Endpoints

None. No new or modified endpoints.

Existing read paths may be consumed differently by the frontend:

| Method | Path | Use in Sprint 105 |
|--------|------|-------------------|
| GET | `/requests/curated` | Existing unified feed source for Dashboard/community feed surfaces. |
| GET | `/requests/feed` | Existing personalized feed source if the standalone Request feed is reskinned rather than retired. |
| GET | `/requests/:id` | Existing request detail source; only visual/copy presentation changes. |
| GET | `/requests/community/:communityId/open-asks` | Existing community open-asks source; candidate for secondary Home altitude if already reachable from current client helpers. |

If the executor discovers a new endpoint is truly needed, pause and re-scope. The approved Sprint 105
plan assumes a frontend-only convergence sprint.

---

## Frontend Changes

### Foundation

- Add `--measure`, `--radius-card`, and `--texture` to `apps/frontend/src/styles/globals.css`.
- Add/settle shell classes in `apps/frontend/src/styles/karmyq-shell.css`: `kq-page`,
  `kq-headline-sm`, canonical `.kq-card`, finite-state/motif helpers, and any B-compatible hooks
  needed to keep texture default-off. Do not land B hooks as unused CSS; if no S105 finite-state or
  divider consumes them, defer them.
- Retire or de-emphasize `.card` and `.feed-card` shadow variants by migrating live surfaces to
  `.kq-card`; keep compatibility only where removing the class would be too broad for this sprint.
- Add a small request-display helper beside `apps/frontend/src/lib/requestActionCopy.ts` or in a
  sibling module for humanized status/urgency labels and semantic token classes.
- Reuse `describeMatchSignal()` for qualitative match copy; do not render a leading match percentage.

### Request Feed + Detail Cluster

- Decide the standalone Request feed fate during the initial inventory, before TDD for the request
  cluster, then implement that known answer:
  - Preferred: reskin `apps/frontend/src/pages/requests/index.tsx` onto the warm feed/card language.
  - Acceptable: retire it with a deliberate redirect to the dashboard feed if the route is redundant.
- Remove the `% Match` pill, "Smart Filtering" badge, match-score slider, and broad `max-w-7xl` cold
  layout.
- Migrate request detail to `kq-headline-sm`, semantic error/status classes, and humanized urgency.
- Apply the same visual convergence to `apps/frontend/src/pages/offers/index.tsx` and
  `apps/frontend/src/pages/matches/[id].tsx`.

### Profile + Global Chrome

- Migrate Profile body cards to `.kq-card`, one measure, token colors, and warm finite states where
  relevant.
- Tokenize Layout's title bar, availability/on-duty control, and topbar width alignment.
- Keep the Sprint 90 memory/profile behavior intact; this is not a reputation or forgetting feature
  sprint.

### Dashboard / Home

- Tokenize the community selector row and on-duty pill.
- Use the shared finite-state treatment for zero-community and caught-up states.
- Add the secondary Home altitude for established users with an empty queue, using existing data and
  quiet hierarchy. It must not fake actionability or resurrect engagement metrics.

### Community Page

- Keep the community page as the reference implementation.
- Tokenize the pending dot and error colors; make the dot text/aria-legible so it is not color-only.
- Apply only light convergence polish; do not redesign the community IA.

---

## User Guide & Doc Updates

Every sprint ships docs. S105 changes user-visible workflows and the design-system ADR status, so the
executor must update source docs and regenerate landing docs.

- `docs/adr/ADR-079-visual-design-system-v2.md` - advance from Proposed toward Implemented once the
  rollout lands; update the implementation notes and version.
- `docs/adr/README.md` - update ADR-079 status.
- `docs/concepts/ux-design-principles.md` - move from recommended direction to implemented visual
  system principles.
- `docs/guides/dashboard-home.md` - document the secondary Home altitude and updated empty/caught-up
  states.
- `docs/guides/making-requests-guide.md` - update request browsing/detail/action copy if the
  standalone feed is reskinned or retired.
- `docs/guides/fulfilling-requests-guide.md` and `docs/guides/managing-commitments-guide.md` - update
  offers/matches surface language if the visible flow changes.
- `docs/guides/profile-guide.md` - update screenshots/copy expectations for the profile page if the
  guide describes visual sections.
- `apps/frontend/src/lib/onboarding/workflows.ts` - update onboarding copy for any Dashboard Home or
  request-browse wording changes.
- `apps/frontend/CONTEXT.md` - record Sprint 105 frontend changes and the new design-system helpers.
- Regenerate landing docs from source with the existing generator; do not hand-edit
  `apps/landing/src/data/docs/**` or `nav.json`.

`services/registry.json` should not change unless a new endpoint is introduced, which is outside the
approved scope.

---

## Critical Implementation Notes

1. **Direction is already decided: A-plus.** Do not re-run visual exploration or pick a new aesthetic.
   Direction A convergence is mandatory; B hooks are default-off and sparse; C is parked.
2. **Foundation lands first.** Add the tokens/helpers/classes before touching the surfaces, so every
   cluster consumes the same vocabulary instead of inventing local fixes.
3. **Force the Request feed fate early.** Decide reskin vs retire during Task 1, record the decision
   in the handoff, and write Task 4 tests against that known answer. Do not leave the highest-risk
   route decision to mid-execution.
4. **No unused B hooks.** `--texture` must default to off/none, and texture/motif hooks land only if a
   S105 finite-state or divider consumes them. If there is no consumer, defer the hook instead of
   shipping dead CSS.
5. **One card language.** Live surfaces should migrate to `.kq-card` and border-based separation.
   Avoid new shadows, new card radii, or nested cards.
6. **One content measure by default.** Use the new measure token for member-facing reading surfaces.
   Dense admin tools may opt out explicitly, but fossils must not keep `max-w-7xl` by habit.
7. **No leading match percentage.** Match signal is qualitative quiet metadata via
   `describeMatchSignal()`. Do not render `{matchScore}% Match` as a visual lead.
8. **Semantic color only.** Status, urgency, errors, availability, and pending dots use tokenized
   semantic colors plus text/aria where needed. No new raw `red-*`, `yellow-*`, `green-*`, or
   `gray-*` status styling.
9. **Test behavior and accessibility first.** Prefer helper output, route fate, visible copy, aria,
   keyboard, and not-color-only assertions. Class-string assertions are allowed only as narrow
   guardrails for fossil-pattern removal, not as the main proof of quality.
10. **EmptyState has broader blast radius.** If `EmptyState` changes, validate all direct consumers:
    requests, offers, communities index, CommitmentsTab, MyRequestsTab, and UnifiedFeed empty/error
    states. Run the full frontend suite immediately after the foundation task.
11. **Accessibility travels with the migration.** Verify contrast, visible focus, keyboard reachability,
   mobile tap targets, and no color-only state on every touched surface.
12. **Frontend-only unless re-scoped.** No database, service, or registry change is expected. If an
   implementation task seems to need a backend endpoint, pause and ask for re-scope.
13. **Version drift is part of the sprint.** Reconcile root `package.json` from `11.10.0` to the
    correct S105 release target (`11.13.0`) and make the docs agree.
14. **Docs are source-first.** Edit Markdown sources and generator mappings, then regenerate landing
    JSON. Do not hand-edit generated landing docs.
15. **Human validation is required.** This is a deploy sprint. Validate desktop and responsive mobile
    web flows for Dashboard, Request feed/detail, Offers, Match detail, Profile, Community, and the
    EmptyState ripple surfaces after deploy. This does not include React Native mobile parity.
