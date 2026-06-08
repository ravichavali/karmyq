# Sprint 92: Matching & Dibs Repair + Bug Sweep — Design Spec

**Date**: 2026-06-08
**Status**: Approved
**Version**: v11.0.0 → v11.1.0
**Sprint Branch**: `feature/sprint-92-matching-repair`

---

## Overview

Sprint 91 consolidated services (11→10) and is live. Manual testing since has surfaced a cluster
of correctness bugs, most of them concentrated in the **matching / dibs / completion seam** — the
core help-loop that connects a need to a helper and closes the exchange. The most damaging are
BUG-007 (a *neighbor* mutual-aid request surfaces a "provider" dibs prompt) and BUG-008 ("request
matching logic seems broken"), which together echo the standing IDEAS note that *"Community /
service-provider link-up seems confusing."*

This sprint makes the matching/dibs seam the centerpiece: reproduce and root-cause BUG-008,
untangle the neighbor-vs-provider framing in dibs (BUG-007), and unify the completion→rating flow
that two different surfaces implement inconsistently (BUG-005). Alongside the deep-fix it sweeps the
remaining open bug backlog — feed staleness (BUG-002), an adminless community (BUG-001), provider
copy (BUG-003), and the missing wordmark logo (BUG-004). BUG-006 was already fixed in Sprint 91.

This is a bug-fix sprint, not a feature sprint: the bar is **root-cause the layer, fix every
instance, prove it with a test** — no client-side workarounds for server-side problems.

### Core Principle: One help-loop, one source of truth

Each lifecycle action (offer → match → accept → complete → rate) should run the **same** business
logic regardless of which surface invokes it (Dashboard `DecisionBand` vs `CommitmentsTab`). Where
the two surfaces diverge today, that divergence is the bug. Fix the seam, don't paper over a
surface.

---

## Multi-Sprint Arc

### Sprint 91 — Service Consolidation Phase 1 (complete)
feed-service folded into request-service (`/requests/feed/*`); 11→10 services; v11.0.0 live.

### Sprint 92 — Matching & Dibs Repair + Bug Sweep (this sprint)
Root-cause the matching/dibs/completion seam; clear the open bug backlog (BUG-001..008 minus 006).

### Sprint 93 — candidates (upcoming)
Service Consolidation Phase 2 (geocoding-service → client-side geocoder, 10→9) per ADR-071, OR
mobile parity. To be planned after this bug sweep lands.

---

## Diagnosis Findings (root-cause, captured during planning)

These are the grounded findings the implementation must address. Each fix task starts from the
named layer — do not re-derive from symptoms.

### BUG-007 — dibs surfaces a "provider" for a neighbor request
- **Layer:** frontend trigger + backend candidate selection + UI copy.
- [RequestWizard.tsx:167](../../../apps/frontend/src/components/RequestWizard.tsx) calls
  `getDibsCandidate(createdRequest.id, requestType)` for **every** request type.
- Backend [dibs.ts:52-55](../../../services/request-service/src/routes/dibs.ts) branches:
  `type === 'service'` → `getBestCandidate` (provider profiles); otherwise →
  `getMutualAidBestCandidate` ([dibsScoringService.ts:128](../../../services/request-service/src/services/dibsScoringService.ts)),
  which returns an ordinary community member from
  [`getMutualAidCandidates`](../../../services/request-service/src/db/dibsDb.ts).
- But [DibsPrompt.tsx:109-113](../../../apps/frontend/src/components/requests/DibsPrompt.tsx)
  hardcodes provider framing: *"Offer First Dibs? A trusted **provider** can get an exclusive
  window…"*. A neighbor is shown as a provider.
- **Submit-path (Option A only):** `POST /requests/:id/dibs` validates the nominee through
  provider-only `getEligibleCandidates` ([dibs.ts:148](../../../services/request-service/src/routes/dibs.ts)),
  so a neighbor first-ask 403s (`NO_PRIOR_INTERACTION`) unless the submit validation, payload
  naming, and pending-dibs language are also updated for neighbors — not just the candidate shape
  and `DibsPrompt`.
- **Design decision (decide in-sprint, ADR-072):** does dibs apply to mutual-aid at all? Two
  options — (A) **reframe**: keep a "first ask" for neighbors with neighbor language and a distinct
  warm visual, dibs stays provider-only terminology; (B) **disable**: dibs is provider-only, skip
  the prompt for non-service requests and remove the mutual-aid candidate path. **Recommendation:
  Option A (reframe)** — it honors the IDEAS direction that *"community and provider are two facets
  of the same user"* and preserves trust-based first-ask for neighbors. The deep-fix design task
  traces the full flow and the maintainer ratifies A vs B before implementation.

### BUG-008 — "request matching logic seems broken"
- **Layer:** unknown — **vague symptom, no reproduction yet.** Must follow
  superpowers:systematic-debugging: reproduce in the demo/sim, capture the actual broken behavior,
  write a failing test that encodes it, THEN fix. Do not guess.
- Suspect areas to investigate during diagnosis (not conclusions):
  - `getMutualAidCandidates` admits users with **0 prior interactions** when a `sg.type =
    'exchange'` edge exists ([dibsDb.ts:195-197](../../../services/request-service/src/db/dibsDb.ts)) —
    may surface unexpected candidates.
  - offer → match → accept → reject reopen logic in
    [matches.ts](../../../services/request-service/src/routes/matches.ts) (e.g. `reject` reopen
    only when zero remaining proposed; `accept` rejects sibling proposals).
  - feed/match cross-talk: a matched request still appearing as browsable (related to BUG-002 and
    the IDEAS [2026-04-02] "confirmed match = commitment" note).
- **Output of diagnosis:** a one-paragraph root-cause statement + failing regression test, written
  into the plan's Task 2 before any fix lands.

### BUG-005 — "Mark as done" doesn't unlock rating
- **Layer:** frontend — duplicated completion logic across two surfaces.
- [CommitmentsTab.tsx:225/245](../../../apps/frontend/src/components/CommitmentsTab.tsx) sets
  `pendingRatingId` after `completeMatch`, rendering `RatingPrompt`.
- [DecisionBand.tsx:51](../../../apps/frontend/src/components/Feed/DecisionBand.tsx) `mark_done`
  calls `completeMatch` then `onResolved` drops the row — **no rating prompt**. Marking done from
  the Dashboard never unlocks rating.
- Backend [matches.ts complete](../../../services/request-service/src/routes/matches.ts) already
  returns `{ fully_completed, waiting_for }`. The rating prompt should fire on the transition to
  fully-completed, consistently from both surfaces. (Today CommitmentsTab even shows the prompt on
  a one-sided "done", which is premature — fix to gate on `fully_completed`.)

### BUG-002 — feed shows already-offered requests on reload when none are open
- **Layer:** backend feed query. The unified feed does not exclude requests the viewer has already
  made an offer/match on. Trace the feed candidate query in
  [unifiedFeed.ts](../../../services/request-service/src/services/unifiedFeed.ts) /
  [feedComposer.ts](../../../services/request-service/src/services/feed/feedComposer.ts) and add an
  exclusion for requests where the viewer already has an active offer/match (and for non-open
  statuses). Server-side only — no client filter.

### BUG-001 — a community has no admin
- **Layer:** data + member-lifecycle (NOT the create path).
- **Corrected root cause:** the create path already inserts the creator as `admin`
  ([communities.ts:617](../../../services/community-service/src/routes/communities.ts)). Adminless
  communities come from data (sim-seeded) or the last admin leaving/being demoted. Fix = (1)
  idempotent backfill migration for adminless communities (promote `created_by` if active, else
  earliest-joined active member), and (2) a last-admin guard on leave/demote. Do **not** change the
  create insert. Confirm the cause for the reported community before choosing guard behavior.

### BUG-003 / BUG-004 — copy + logo (quick wins)
- BUG-003: providers should read "Offer service" in **provider context only**. "Offer to Help" in
  [RequestCard.tsx:152](../../../apps/frontend/src/components/Feed/RequestCard.tsx) is the shared
  button used for mutual-aid too — do NOT blanket-replace; branch on `request_type === 'service'` /
  provider mode and prove both paths with a test. Grep frontend + mobile + sim.
- BUG-004: **reproduce first** — [Layout.tsx:116](../../../apps/frontend/src/components/Layout.tsx)
  already renders the seed + "Karmyq" wordmark. Find the specific surface/viewport/state where only
  the green dot shows and fix that; if not reproducible, mark `cannot-reproduce` rather than
  blind-editing.

---

## New Concepts (if Option A is ratified for BUG-007)

- **First ask (neighbor)** — the mutual-aid analogue of dibs: a private, time-boxed first
  invitation to a trusted community member before a request goes public. Same mechanic as dibs, but
  neighbor-framed copy and a warm (non-provider) visual. If Option B is chosen, this concept is
  dropped and dibs is documented as provider-only.

---

## Data Model

No new tables. One **data-repair migration** for BUG-001 (dated `YYYYMMDD-slug.sql` naming):

```sql
-- infrastructure/postgres/migrations/20260608-backfill-community-admins.sql
-- Backfill an admin for any community that has zero active admins.
-- Idempotent: only touches communities with no admin; promotes the creator
-- (communities.communities.created_by) if still an active member, else the
-- earliest-joined active member.
-- Guard with IF NOT EXISTS / NOT EXISTS subqueries; cross-schema safe (auth + communities).
```

(Exact column names verified against `communities.communities` / `communities.members` during
implementation — schema is plural `communities.communities`.)

---

## API Endpoints

No new endpoints expected. Possible **modifications** (confirm during diagnosis):
- `GET /requests/:id/dibs-candidate` — may stop returning a candidate for non-service requests
  (Option B) or return a `kind: 'neighbor' | 'provider'` discriminator the UI uses for framing
  (Option A).
- Feed query (`GET /requests/feed`) — internal query change to exclude already-offered / non-open
  requests for the viewer (no contract change).

Any contract change updates `services/registry.json` and the service CONTEXT.md.

---

## Frontend Changes

- `RequestWizard.tsx` — gate / route the dibs-candidate call by request kind (BUG-007).
- `DibsPrompt.tsx` — neighbor vs provider framing (Option A) or not rendered for neighbors
  (Option B) (BUG-007).
- `DecisionBand.tsx` — `mark_done` unlocks the rating flow consistently with CommitmentsTab
  (BUG-005).
- `CommitmentsTab.tsx` — gate `RatingPrompt` on `fully_completed`, not one-sided done (BUG-005).
- Provider "Offer help" → "Offer service" label surfaces (BUG-003).
- Brand/logo component — restore the "Karmyq" wordmark (BUG-004).
- Mobile: mirror BUG-003 copy if the label exists there (grep mobile).

---

## User Guide & Doc Updates

Mandatory (every sprint ships doc updates):
- **User Guide** — update the help-request / dibs guide in `apps/landing/src/data/docs/guides/` to
  reflect the neighbor-vs-provider first-ask behavior (whichever option ships) and the rating flow.
- **Concept page** — if Option A ships, add/update a concept page describing "first ask" for
  neighbors vs providers; clarify the community/provider two-facet relationship (directly addresses
  the IDEAS "link-up confusing" note).
- **ADR-072** — "Dibs scope: the neighbor/provider first-ask seam" documenting the A-vs-B decision
  and the unified completion→rating flow. Landing JSON + nav.json entry.
- **CONTEXT.md** (request-service) — note any dibs-candidate / feed query changes under Recent
  Fixes; add BUG-001..008 resolutions to the relevant Known Issues → Recent Fixes.
- **services/registry.json** — only if an endpoint contract changes.

---

## Critical Implementation Notes

1. **BUG-008 is diagnosis-first.** Do NOT write a fix before you have reproduced the broken
   behavior and captured it in a failing test (superpowers:systematic-debugging). The plan's Task 2
   produces a written root-cause statement; the fix is a separate task gated on it.
2. **Fix at the correct layer.** These are server-side data/logic bugs in most cases — never add a
   client-side filter to hide a server-side problem (CLAUDE.md Bug Fixing rule).
3. **Find ALL instances.** Grep the whole codebase (frontend, mobile, simulation, services) for
   each pattern before editing — the "Offer help" label and the completion/rating logic both exist
   in more than one place.
4. **One help-loop, one source of truth.** `DecisionBand` and `CommitmentsTab` must route lifecycle
   actions through the same logic; the rating prompt fires on the same condition
   (`fully_completed`) from both.
5. **Dibs framing decision (Option A vs B) is the maintainer's call**, made in-sprint after the
   diagnosis task traces the flow. Recommendation is Option A (reframe). Record it in ADR-072.
6. **Migration safety (BUG-001):** idempotent, `IF NOT EXISTS` / `NOT EXISTS` guards, cross-schema
   (auth + communities) safe; only touches adminless communities. Run the migration-validator.
7. **Schema is `communities.communities`** (plural). **JWT field is `communities`** not
   `communityMemberships`. **API unwrap is `res.data`** (interceptor already unwraps).
8. **Feed exclusion (BUG-002)** must also cover non-open statuses — a matched/dibs_pending request
   must not reappear as browsable (ties to the IDEAS "confirmed match = commitment" note).
9. **Fold the S91 doc tail** (this spec's branch first commit): handoff, BUGS.md (BUG-007/008),
   IDEAS captures — do NOT push docs to master standalone (`feedback_no_docs_push_to_master`).
10. **Landing docs are generated** — edit SOURCES (CONTEXT.md / ADR md / generate-docs.ts), never
    the JSON in `apps/landing/src/data/docs/` (gitignored; `git add -f`); verify nav.json after
    editing (it silently reverts).
11. **Next free ADR = 072.**
