# Sprint 106: Post-Facelift Correctness & Link-Up Clarity — Design Spec

**Date**: 2026-06-18
**Status**: Approved
**Version**: v11.13.0 → v11.14.0
**Sprint Branch**: `feature/sprint-106-correctness-linkup`

---

## Overview

Sprint 105 shipped the A-plus UI facelift (v11.13.0) and deployed to the demo. Validating the
freshly redesigned surfaces surfaced four correctness bugs (BUG-013 through BUG-016, all captured
2026-06-18) and re-confirmed a standing UX confusion: the community ↔ service-provider link-up
([IDEAS 2026-06-08]). The redesign made the product *look* like one warm commons; this sprint makes
the redesigned surfaces also *behave* truthfully — rating works for both sides, the provider feed
labels asks correctly, "Needs your response" sits where the work actually lives, the header breathes,
and the provider model reads legibly.

This is a correctness-and-clarity sprint, not a new-feature sprint. Three of the four bugs are
frontend-or-chrome fixes; one (BUG-014) is a backend feed-ranker fix; one (BUG-013) is an
investigate-first rating-symmetry fix that likely spans the decisions feed and the DecisionBand. The
link-up cleanup is deliberately bounded to a diagnosis plus a single contained fix.

### Core Principle: A redesigned surface must also be a truthful surface

The facelift earned trust visually. Every bug here is a place where the surface now *looks* finished
but *behaves* wrong — wrong label, missing rating, misplaced band, cramped chrome, confusing provider
model. We close the gap between looking right and being right, fixing each at its correct layer and
finding every instance before touching anything.

---

## Multi-Sprint Arc

- **S102 (done):** Visible Memory + Re-warm First Step (v11.11.0).
- **S103 (done):** Governance + Intake Clarity (v11.12.0).
- **S104 (done):** UI Facelift Research — A-plus verdict, ADR-079 Proposed, no deploy.
- **S105 (done):** UI Facelift Implementation — full A-plus rollout, ADR-079 Implemented (v11.13.0).
- **S106 (this sprint):** Post-Facelift Correctness & Link-Up Clarity — close BUG-013…016, bound the
  provider link-up confusion, deploy (v11.14.0).
- **Deferred (unchanged):** "platform forgets" visible decay; responder Home actionability for
  `proposed` matches; Dibs server-side relationship routing; member forget/export; Service
  Consolidation Phase 2; mobile parity.

---

## The Bugs (diagnosed)

### BUG-014 — Provider feed shows "Offer help" instead of "Offer service" (regression)

**Root cause (diagnosed):** the copy helper `getOfferActionLabel`
(`apps/frontend/src/lib/requestActionCopy.ts`) is correct — it returns `'Offer service'` when
`request_type === 'service'`. The regression is upstream: the Dashboard feed ranker
`services/request-service/src/services/feed/basicFeedRanker.ts:131` sets
`request_type: item.request.category`. The `category` column is mixed-vocab (enum on new rows, skill
tokens on old/seed/sim rows — the documented category/request_type seam). A service ask whose
`category` holds a skill token is delivered to the card with `request_type` = that token, never
`'service'`, so the card falls back to "Offer to Help".

**Fix layer:** backend feed ranker. The feed item must carry the **persisted `request_type`** (the
enum), not `category`. Find ALL feed/projection sites that conflate the two (the memory notes
browsable-request filtering lives in ~4 places; the ranker projection is a separate seam) and ensure
the card always receives the true `request_type`. Do not patch this client-side.

### BUG-013 — Both requester and helper/provider should be able to rate on completion

**Root cause (diagnosed, investigate-first to confirm):** `DecisionBand`
(`apps/frontend/src/components/Feed/DecisionBand.tsx:88`) only unlocks the rating prompt for the
participant who clicks the **final** `mark_done` that transitions the exchange to `fully_completed`.
The other participant — the one who already marked done, or the requester when the helper completes
last — never receives a `rate` affordance, so "Needs your response" inconsistently offers rating.

**Fix layer:** Task 1 reproduces and confirms the rating lifecycle end-to-end (DB match/rating state →
decisions feed → DecisionBand) before committing. Expected fix: the decisions feed surfaces a durable
`rate` decision for any `fully_completed` match the viewer has not yet rated (for **both** parties),
and `DecisionBand` renders it as a first-class rate action rather than only as an in-place unlock
after `mark_done`.

**Write path (confirmed during planning):** ratings are submitted to **reputation-service
`POST /reputation/feedback`** (`services/reputation-service/src/routes/reputation.ts:292`), reached via
`reputationService.submitFeedback()` (`apps/frontend/src/utils/completion.ts:44` → `api.ts:732`) — NOT
a request-service route. That handler already accepts ratings from **any authenticated user** (no role
gate) and guards only against double-submission per `(fromUserId, match_id)`. So BUG-013 is
**surfacing-only on the write side** — both roles are already accepted, and the double-submission guard
already lets both parties rate the same match independently. However, the handler does **not** validate
that the rater is a participant of the match nor that the match is completed. Because S106 touches the
rating flow and `/security-review` is a standing gate, the recommended scope adds that
participant + completed-match validation to `POST /feedback` as hardening. Covered by an explicit
reputation-service TDD file, not the request-service one.

### BUG-015 — "Needs your response" belongs in Helping, not Browse

**Current state:** the DecisionBand renders inside `UnifiedFeed`, which is mounted in the **Browse**
tab (`apps/frontend/src/pages/dashboard.tsx:216-232`). Decisions you owe (accept/decline offers, mark
done, rate, dibs) are commitment work, not new asks to browse.

**Decision:** move the band to the top of the **Helping** tab (`CommitmentsTab`). Browse returns to
being purely the discovery surface. Preserve the band's server-ranked ordering and all existing
actions; only its mount point changes.

### BUG-016 — Header is too squished

**Current state:** `kq-topbar` packs wordmark + four nav links + notification bell + availability
toggle + avatar on a single row (`apps/frontend/src/components/Layout.tsx:115-164`). On narrower
desktop widths this crowds.

**Fix layer:** frontend chrome only. Give the topbar room — tighten spacing rules, allow the
secondary nav to collapse/condense earlier, and ensure the availability toggle and bell don't crowd
the wordmark. No nav-information change; a breathing-room pass within the existing A-plus token
vocabulary.

---

## The Link-Up Cleanup (bounded)

[IDEAS 2026-06-08] "Community / service-provider link-up seems confusing. We need to clean it up."

**Scope decision:** diagnose, then ship ONE contained fix — not an open-ended redesign. Task 1
documents exactly where the provider↔community relationship reads as confusing (the
"Become a provider" / "Providers" nav split in `Layout.tsx`, provider onboarding, and how a provider
attaches to or is discoverable within a community). Ship the single clearest legibility fix (most
likely: clarifying copy + the one obvious UX seam so a member understands how being a provider relates
to their communities). If the diagnosis shows the fix requires reworking the provider↔community data
model or multiple flows, STOP and flag for re-scope into its own sprint rather than expanding S106.

---

## Data Model

No schema changes expected. BUG-013 may read existing match/rating state and the decisions
projection; if the investigation reveals the rating write path does not accept both roles, any change
stays within existing tables (no new tables). If a migration becomes necessary, pause and re-scope.

---

## API Endpoints

No new endpoints expected. BUG-014 changes a server-side feed **projection** (request_type vs
category), not an endpoint contract. BUG-013 extends the **decisions feed** response to include a
`rate` decision for `fully_completed`-unrated matches — a payload addition to the existing decisions
endpoint, not a new route — and adds **participant + completed-match validation** to the existing
reputation-service `POST /reputation/feedback` (an authorization tightening, not a contract change; it
adds 403/400 rejection paths). No request-service rating route exists or is added. Update
`services/registry.json` only if a response shape changes.

---

## Frontend Changes

- `apps/frontend/src/components/Feed/DecisionBand.tsx` — render a first-class `rate` decision/action
  for completed-unrated exchanges (BUG-013).
- `apps/frontend/src/pages/dashboard.tsx` + `apps/frontend/src/components/CommitmentsTab.tsx` —
  relocate the DecisionBand from the Browse `UnifiedFeed` to the top of the Helping tab (BUG-015).
- `apps/frontend/src/components/Feed/UnifiedFeed.tsx` (where it mounts DecisionBand) — remove the band
  mount from Browse.
- `apps/frontend/src/components/Layout.tsx` (+ topbar CSS in `globals.css`) — header breathing-room
  pass (BUG-016) and provider link-up legibility fix (link-up cleanup).
- No client-side patch for BUG-014 — the card already calls the correct helper.

---

## User Guide & Doc Updates

Every sprint ships doc updates.

- **`docs/guides/`** — update the guide covering rating/completion to state that both requester and
  helper/provider rate on completion and where the rate prompt appears (Helping tab). Update any guide
  describing where "Needs your response" lives (now Helping). Update the provider guide for the
  link-up clarification.
- **`apps/frontend/src/lib/onboarding/workflows.ts`** — update the affected workflow copy if the
  Helping-tab relocation or provider link-up changes a described step.
- **`apps/landing/src/data/docs/guides/`** — mirror the user-guide changes (rating symmetry, Helping
  relocation, provider link-up) and re-run the generator. Edit Markdown sources, never generated JSON.
- **`apps/landing/src/data/docs/services/request-service.json`** — update if the decisions feed
  response shape gains a `rate` decision.
- **CONTEXT.md** for request-service (and reputation-service if its rating path changes) — note the
  feed-ranker `request_type` correctness and any decisions-feed addition.
- **ADR** — only if BUG-013's rating-symmetry surfacing is judged an architectural behavior change
  (next free number: **ADR-080**). Default: no ADR; document in CONTEXT.md + guides.

---

## Critical Implementation Notes

1. **BUG-014 is a backend seam, not a copy fix.** The helper is correct. The feed ranker projects
   `category` as `request_type` (`basicFeedRanker.ts:131`). Fix the projection to carry the persisted
   `request_type` enum. Grep every feed/projection site (browsable filtering lives in ~4 places per
   prior memory) and confirm none reintroduce `category`-as-`request_type`. Never client-side patch.
2. **BUG-013 is investigate-first.** Task 1 reproduces the rating lifecycle end-to-end (match/rating
   DB state → decisions feed → DecisionBand) and confirms the fix layer BEFORE writing code. Confirm
   whether the rating write path already accepts both roles; only then decide if the fix is
   surfacing-only or also write-path.
3. **Rating must be symmetric and durable.** A `fully_completed` exchange must offer a rate
   affordance to BOTH participants until each has rated, surviving reload — not only as an in-place
   unlock for whoever clicked the final `mark_done`. A one-sided "done" must not prompt rating.
4. **BUG-015 relocates, doesn't redesign.** Move the DecisionBand mount from Browse's `UnifiedFeed`
   to the top of the Helping tab. Preserve server-ranked ordering, all actions, and the rate
   affordance. Remove the band from Browse so it isn't duplicated.
5. **BUG-016 is chrome-only.** Breathing-room pass on the topbar within existing A-plus tokens. No
   nav-information change, no new design direction.
6. **Link-up cleanup is bounded.** Diagnose, ship one contained legibility fix. If it needs a
   provider↔community model change or multi-flow rework, STOP and flag for re-scope.
7. **Semantic + accessible.** Any new state (rate affordance, header changes) uses tokenized semantic
   colors, visible focus, keyboard reachability, mobile tap targets, and is not color-only.
8. **Frontend Pages Router.** `apps/frontend/src/pages`. Widely-rendered components using `useRouter`
   need the global `jest.setup.js` router mock — don't add per-file mocks.
9. **No docs-only push to master.** Fold docs into the sprint PR; every master push triggers a full
   deploy.
10. **Verify before claiming done.** Run the actual suites and confirm output; this is a deploy
    sprint with human browser validation required.
