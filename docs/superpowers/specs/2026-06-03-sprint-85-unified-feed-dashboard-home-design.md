# Sprint 85: Unified Feed — Dashboard Home — Design Spec

**Date**: 2026-06-03
**Status**: Approved
**Version**: 10.8.0 → 10.9.0
**Sprint Branch**: `feature/sprint-85-unified-feed-dashboard-home`

---

## Overview

Karmyq's feed surfaces grew by accretion: three overlapping implementations of "a list of requests a
member can act on" (`BrowseFeed`, community `BrowseTab`, the unmounted `Feed/Feed.tsx`), each with its
own data shape, card markup, action vocabulary, and status model. The [Sprint 84 direction
doc](../../design/sprint-84-unified-feed/README.md) audited all three and proposed collapsing them into
**one feed model rendered in two views**, ordered by **action altitude** (the decisions a member owes
rise to the top), against the platform's actual job: *connect a member who needs help with a member who
can give it, inside a community of trust.* It is not an engagement surface — a healthy session ends when
a need is met or an offer is made.

Sprint 85 builds the **first vertical slice: Dashboard Home.** It proves the canonical `request` card +
the `decision` top band end-to-end on the highest-traffic surface before scoping the same components down
to the Community Feed view (Sprint 86). The slice covers direction-doc build steps **1–3**: the canonical
`request` card, a unified feed item shape served from `request-service` (`GET /requests/curated?view=home`),
and a server-computed `decision` band promoting `CommitmentsTab`'s "Needs Your Response" grouping into the
home feed. It also lands the cross-cutting reconciliations the canonical card can't be built without (a
single urgency scale, a single status token, a normalized `match_score`) and verify-locks the
Withdraw-Offer action the decision band surfaces prominently.

### Core Principle: One request, one card — decisions you owe rise to the top

A single canonical request-card vocabulary, used everywhere, with commitment legibility and an explainable
trust signal; and a home view ordered so the decisions a member owes (offers to accept, dibs expiring,
matches to mark done) sit above passive browsing. This is direction-doc Principles 3 and 4 made real.

---

## Multi-Sprint Arc

### Sprint 84 — Unified feed research & direction (complete)
Audit of the three surfaces → data/action inventory → 5-product reference study → 8 principles → unified IA
(one model, two views) → 7 open questions + Sprint 85 recommendations + throwaway mockups. `no-deploy`, no code.

### Sprint 85 — Unified feed, Dashboard Home (this sprint)
Build steps 1–3 of the direction doc against real code: canonical `request` card, `GET /requests/curated?view=home`
union endpoint with server-side action altitude, `decision` top band on Dashboard Home. Land the vocabulary
reconciliations (urgency / status / `match_score`) the card depends on. Verify-lock Withdraw-Offer. Write ADR-066.

### Sprint 86 — Unified feed, Community Feed view + texture (upcoming)
Steps 4–6: reuse the same components with `community_id` scope; split the admin console out of `BrowseTab` into a
distinct admin region; add the dismissible `activity` + `story` texture layer; retire the unmounted `Feed/Feed.tsx`
and de-duplicate `FeedFilterPanel` vs `FilterChipRow`. Mobile parity against the same item shape.

---

## New Concepts

- **Unified feed item** — one of a small shared union the home view renders and ranks: `request | decision |
  activity | story`. Sprint 85 **populates `request` and `decision`**; `activity` and `story` are defined in the
  union shape (so the endpoint contract is forward-compatible) but not populated until Sprint 86's texture layer.
- **Action altitude (server-side)** — a numeric `priority` computed on the server so both web and (future) mobile
  share one ordering, replacing the client-only `CommitmentsTab.sortByActionPriority`. Decisions you owe rank above
  requests you can fill, which rank above texture.
- **Canonical status token** — one member-facing status vocabulary reconciling the request lifecycle
  (`open / pending / matched / completed / dibs_pending`) with the match lifecycle (`proposed / matched / completed`):
  **`proposed` replaces `pending`** for the awaiting-acceptance state (direction-doc Principle 6).
- **Explainable match score** — a single 0–100 integer scale plus a human-readable `match_reason` string
  ("2nd-degree trust · matches your service type"), never a bare opaque percentage (Principle 5).

---

## Data Model

No new tables. One reconciliation migration (`infrastructure/postgres/migrations/20260603-feed-vocab-reconciliation.sql`):

```sql
-- 1. Urgency: reconcile to one scale (urgent | high | medium | low). Triage's 'critical' maps to 'urgent'.
UPDATE requests.help_requests SET urgency = 'urgent' WHERE urgency = 'critical';
ALTER TABLE requests.help_requests
  DROP CONSTRAINT IF EXISTS chk_help_requests_urgency,
  ADD CONSTRAINT chk_help_requests_urgency
    CHECK (urgency IN ('urgent', 'high', 'medium', 'low'));

-- 2. Status: 'proposed' replaces 'pending' for the awaiting-acceptance state (Principle 6).
UPDATE requests.help_requests SET status = 'proposed' WHERE status = 'pending';
ALTER TABLE requests.help_requests
  DROP CONSTRAINT IF EXISTS chk_help_requests_status,
  ADD CONSTRAINT chk_help_requests_status
    CHECK (status IN ('open', 'proposed', 'matched', 'completed', 'dibs_pending', 'cancelled'));

-- 3. request_type: the existing request_type_enum (generic|ride|borrow|service|event) is already canonical.
--    The 6 "payload" subtypes (transportation, moving_help, childcare, tech_help, home_repair, food) are a
--    SEPARATE payload-subtype concept, NOT request_type. No request_type migration — documented in ADR-066.
```

Migration must be **idempotent** (`IF NOT EXISTS` / `DROP CONSTRAINT IF EXISTS` guards) and must run against
real demo data — verify no row violates the new CHECKs before adding them (dry-run the `SELECT DISTINCT urgency`
/ `status` first). See the FK-dedup migration dry-run discipline.

---

## API Endpoints

| Method | Path | Description | Auth | Notes |
|--------|------|-------------|------|-------|
| GET | `/requests/curated?view=home` | Returns the unified feed item union `{ items: UnifiedFeedItem[] }` for Dashboard Home (all the member's communities). Each item carries a server-computed `priority` (action altitude). S85 populates `request` + `decision` kinds. | JWT | Extends the existing curated handler; `view` defaults to legacy `request`-only array when absent (back-compat). |
| PUT | `/matches/:id/reject` | Reject/withdraw a proposed match. **Already allows both participants** (Sprint 62) — verify-locked, not changed. | JWT | Decision band's "Withdraw Offer" calls this. |

**`UnifiedFeedItem` shape (response):**
```ts
type UnifiedFeedItem =
  | { kind: 'request';  priority: number; data: RequestCardData }   // canonical request card
  | { kind: 'decision'; priority: number; data: DecisionData }      // needs your response
  | { kind: 'activity'; priority: number; data: ActivityData }      // S86 — shape only, not populated S85
  | { kind: 'story';    priority: number; data: StoryData };        // S86 — shape only, not populated S85
```
`RequestCardData` carries the reconciled fields: `urgency` (one scale), `status` (canonical token),
`match_score` (0–100 int) + `match_reason` (string), trust-path + Karma signals, and the polymorphic
`payload` for commitment legibility. `DecisionData` carries the match/dibs/offer to act on + the action
the member owes (accept / decline / withdraw / mark-done / accept-dibs).

---

## Frontend Changes

| File | Change |
|------|--------|
| `apps/frontend/src/types/unified-feed.ts` | **New.** The `UnifiedFeedItem` union, `RequestCardData`, `DecisionData`, canonical status token type, urgency scale type, `match_score` normalization helper. |
| `apps/frontend/src/components/feed/RequestCard.tsx` | **New.** The one canonical request card — absorbs `RequestPayloadRenderer`, trust-path + Karma badges, the status token, normalized match-score + reason, inline Offer-to-Help (`createMatch`), secondary View Details. |
| `apps/frontend/src/components/feed/DecisionBand.tsx` | **New.** The top band — renders `decision` items (accept/decline offer, withdraw own offer, accept/decline dibs, mark done), reusing the action handlers that live in `CommitmentsTab` today. |
| `apps/frontend/src/components/feed/UnifiedFeed.tsx` | **New.** Dashboard Home container: fetches `view=home`, renders `DecisionBand` on top + ranked `RequestCard`s below, "you're caught up" end-state. |
| `apps/frontend/src/pages/dashboard.tsx` | Mount `UnifiedFeed` for the Browse/Home surface; pass on-duty + browse-mode state through. |
| `apps/frontend/src/components/BrowseFeed.tsx` | Card replaced by canonical `RequestCard` (lowest-risk first step); retained as thin wrapper or folded into `UnifiedFeed`. |
| `apps/frontend/src/lib/api.ts` | `getCuratedRequests` gains `view` param; response typed to `UnifiedFeedItem[]`. |

The Community Feed view, the admin-console split, and the `activity`/`story` texture layer are **explicitly
Sprint 86** — not built here. `Feed/Feed.tsx` is **not** retired this sprint (it's deferred so the canonical
card can borrow its `RequestPayloadRenderer` without a same-sprint move-and-delete churn).

---

## User Guide & Doc Updates

Every sprint ships doc updates. Sprint 85:

- **User guide** `apps/landing/src/data/docs/guides/dashboard-home.json` (new or updated) — "Your Dashboard
  Home": the decision band ("what needs your response"), the ranked request feed, the explainable trust/match
  signal, the "you're caught up" end-state. Add nav.json "User Guides" entry.
- **Concept page** `apps/landing/src/data/docs/concepts/unified-feed.json` (new) — "One feed, two views"
  philosophy: finite actionable queue vs infinite stream, action altitude, one canonical card. Add nav.json
  "Concepts" entry.
- **ADR** `apps/landing/src/data/docs/concepts/adr-066-unified-feed-model.json` (new) — mirror of ADR-066.
  Add nav.json "Architecture Decisions" entry.
- **Service doc** `apps/landing/src/data/docs/services/request-service.json` — document the `view=home` param
  on `/requests/curated`.
- **Onboarding** `apps/frontend/src/lib/onboarding/workflows.ts` — update the dashboard/browse workflow key for
  the new decision band + canonical card layout.
- **Service `CONTEXT.md`** `services/request-service/CONTEXT.md` — `view=home` param, the `UnifiedFeedItem`
  shape, the vocab reconciliation, the status CHECK.
- **`services/registry.json`** — note the `view` param on `/requests/curated` (no new endpoint/event).

`apps/landing/src/data/docs/` is in `.gitignore` — `git add -f`. After editing nav.json, **grep-verify it
didn't revert** (run generate-docs from `apps/landing/`, re-apply if reverted).

---

## Critical Implementation Notes

1. **Source of truth is `request-service`, not the Feed service.** Extend the existing `/requests/curated`
   handler with a `view=home` param returning the union; do **not** route Dashboard Home through the Feed
   service (3007) this sprint. request-service already owns ranking + the live dashboard wiring. (Open
   question 7.4.1 — decided.)
2. **Withdraw-Offer is already fixed at the backend** (Sprint 62: `PUT /matches/:id/reject` allows both
   participants — [matches.ts:408](../../../services/request-service/src/routes/matches.ts#L408)). The stale
   `'Only the requester can reject this match'` string survives only in `dist/`/`coverage/` build artifacts —
   **never edit those**; a clean rebuild purges them. S85 work = wire the decision band's Withdraw to
   `rejectMatch(matchId)`, add a regression test proving the **responder** can withdraw their own proposed
   offer, and confirm the deployed server runs current `src`, not stale `dist`.
3. **`request_type` is the 5-value `request_type_enum`** (`generic|ride|borrow|service|event`) and is already
   canonical. The 6 payload subtypes (transportation/moving_help/childcare/tech_help/home_repair/food) are a
   **separate `payload` concept** — do NOT migrate or conflate them with `request_type`. Document the
   distinction in ADR-066; no request_type DB change.
4. **Urgency: the CHECK and ALL producers ship together (atomic) or creation 500s.** Canonical scale is
   `urgent | high | medium | low`. **Three** producer vocabularies exist today and must all be reconciled in
   the same branch *before* the CHECK lands: request creation validator `VALID_URGENCY` (`low|medium|high|critical`,
   `requests.ts:~1297`), admin triage critical-handling (`adminActions.ts:~215`, `BrowseTab.tsx:~443`,
   `api.ts:~524`), and `RequestWizard.tsx`'s `normal|urgent|critical` (`~line 15`). Mapping: `critical → urgent`,
   `normal → medium`. Use `??`/`!= null` (not `||`) for any default — `||` treats 0 as missing → weight sum blows
   up → 500. See Task 1 (it owns the migration + every producer).
5. **`match_score` is one 0–100 integer scale** with a `match_reason` string. The two legacy scales (0–1 in
   BrowseFeed, 0–100 in Feed) collapse to 0–100; normalize at the API boundary so the card never sees 0–1.
6. **Status token: `proposed` replaces `pending`.** Migrate `help_requests` rows and add the CHECK; update
   every code path that writes or reads `status = 'pending'` on `help_requests` (grep all services + frontend +
   simulation — the `dibs`/`offers` tables keep their own `pending` lifecycle, do NOT migrate those).
7. **JWT field is `communities`** not `communityMemberships`; **schema is `communities.communities`** (plural);
   **API response unwrap uses `res.data`** not `res.data.data` (the `createApiClient` interceptor already
   unwraps). **`trust_edges_live` is a VIEW** — read it, never write it.
8. **Action altitude moves server-side.** Compute `priority` in the curated handler so the union arrives
   pre-ordered; the client renders in array order. Keep `CommitmentsTab` working unchanged this sprint (it
   stays the canonical home of the action handlers the decision band reuses) — do not delete it.
9. **ADR-066 is reserved** for the Unified Feed Model. Write it against real S85 code. Next free ADR after 065.
10. **Pre-existing TDD failures are not S85 regressions** — see the handoff list. A *new* failure is real.

---

## Manifesto Alignment — public promises ADR-066 must honor

The karmyq.org "The thinking" manifesto (§7, *"Trust wasn't taken from us. We forgot how."*,
[`apps/landing/src/components/sections/TheThinking.tsx`](../../../apps/landing/src/components/sections/TheThinking.tsx))
now makes these **public product promises** about trust and the feed. Sprint 85's unified feed/trust
work must not contradict them, and **ADR-066 must record them as binding constraints**:

1. **"Designed to forget."** Interaction *details* expire after a few months; only the *shape* of
   relationships persists — not a permanent ledger of acts. Grounded in existing decay work (ADR-011
   reputation decay, `20260526-interaction-halflife`). S85 must not introduce a permanent public ledger
   of individual acts; if the feed surfaces any history, it must be the decayed/relationship-shaped
   signal, not raw historical transactions.
2. **No broadcast reputation feed.** What a member has done is never broadcast to the community. The
   `decision`/`activity`/`story` items and the `match_reason` string may explain *connection* ("2nd-degree
   trust · matches your service type") but must **not** publish a member's act history to others. The
   `activity`/`story` texture (S86) must respect this too — community texture, not an acts ledger.
3. **Feed ranking uses decayed, relationship-shaped trust signals**, not exposed raw transaction
   history. The curated handler's `feed_weight_prior_interaction` input must be a decayed signal
   consistent with promise 1 — confirm it reads the half-life-decayed interaction value, not a raw count.
4. **Sovereignty framing = "own rules, own context, own trust model."** Do **not** claim or imply each
   community "runs its own instance" in ADR-066 or any doc until the architecture supports it. The
   current, accurate framing is per-community rules/context/trust model on shared infrastructure.
