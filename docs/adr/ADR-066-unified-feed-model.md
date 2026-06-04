# ADR-066: Unified Feed Model

**Status**: Implemented
**Date**: 2026-06-03
**Sprint**: 85
**Version**: 10.9.0

## Context

Karmyq's feed surfaces grew by accretion: three overlapping implementations of "a list of
requests a member can act on" (`BrowseFeed`, community `BrowseTab`, the unmounted `Feed/Feed.tsx`),
each with its own data shape, card markup, action vocabulary, and status model. The same request
rendered differently depending on where you saw it; "needs your response" decisions
(`CommitmentsTab`) lived in a separate tab from the requests you could fill; and three urgency
vocabularies, two status models, and a 0–1-vs-0–100 match-score ambiguity made a single canonical
card impossible to build.

The [Sprint 84 direction doc](../design/sprint-84-unified-feed/README.md) audited all three and
proposed collapsing them into **one feed model rendered in two views**, ordered by **action
altitude** (the decisions a member owes rise to the top), against the platform's actual job:
*connect a member who needs help with a member who can give it.*

## Decision

### One model, two views
A single `UnifiedFeedItem` union is the wire contract for every feed surface:

```ts
type UnifiedFeedItem =
  | { kind: 'request';  priority: number; data: RequestCardData }   // a request you can fill
  | { kind: 'decision'; priority: number; data: DecisionData }      // a response you owe
  | { kind: 'activity'; priority: number; data: ActivityData }      // texture (S86)
  | { kind: 'story';    priority: number; data: StoryData }         // texture (S86)
```

Sprint 85 populates `request` and `decision` for **Dashboard Home**. Community Feed view, the
`activity`/`story` texture layer, and retirement of the legacy feed components are **Sprint 86**.

### Source of truth: `request-service`, `view=home`
The union is served from the existing `GET /requests/curated?view=home` in **request-service**
(not the Feed service) — it already owns ranking, community config, and the live dashboard wiring.
`view` absent returns the legacy request array (back-compat for existing callers).

### Server-side action altitude
`priority` is computed server-side; the client renders in array order. Decisions you owe
(`>= 2000`) rank above requests you can fill (`1000–1100`), which rank above texture. Within the
decision band, a response a counterparty is waiting on (accept/decline) ranks above the member's
own housekeeping (withdraw / mark-done). This replaces the client-only
`CommitmentsTab.sortByActionPriority` — there is now one ordering, owned by the server.

### Vocabulary reconciliation (the canonical card depends on it)
- **Urgency** — one scale `urgent | high | medium | low` (`critical → urgent`, `normal → medium`).
  A DB CHECK enforces it; every producer (request creation, admin triage, the request wizard, the
  community triage UI) was reconciled in the same change so nothing writes a rejected value, and
  the two consumers (`scoreUrgency`, `applyUrgencyBonus`) were updated so `urgent` scores as the
  top tier, not the default floor.
- **Status** — the `help_requests` lifecycle is `open → dibs_pending → matched → completed`
  (+ `cancelled`), locked by a CHECK. **There is no `pending` status on `help_requests`**;
  `pending`/`proposed` are tokens on the `matches`/`dibs`/`offers` tables. The member-facing
  `proposed` ("awaiting your acceptance") token is **derived** in the curated handler from request
  + match state — it is not stored on the request row.
- **Match score** — one 0–100 integer scale plus a human-readable `match_reason`
  ("2nd-degree trust"), normalized at the API boundary so the card never sees a 0–1 fraction or a
  bare opaque percentage.
- **`request_type`** — the existing 5-value `request_type_enum` (`generic|ride|borrow|service|event`)
  is already canonical. The payload subtypes (transportation/moving_help/childcare/…) are a
  **separate `payload` concept** and were not migrated or conflated.

### Withdraw-Offer verify-lock
The decision band's "Withdraw Offer" (responder) wires to `PUT /matches/:id/reject`, which already
allows **both** participants (Sprint 62). S85 verify-locked this — a regression test proves the
responder can withdraw and that the request **reopens** when no proposed matches remain — and a
clean rebuild purged a stale guard string that lived only in `dist/`.

## Manifesto Alignment (binding constraints)

These are not aspirations — they constrain the implementation and any future change to the feed:

1. **Designed to forget.** There is **no permanent public ledger of acts.** The feed surfaces
   *current* requests, decisions, and decayed relationship signal — never an append-only history of
   what a member has done. Feed history is relationship-shaped and time-decayed only.
2. **Prior-interaction signal must read the half-life-decayed weight.**
   `feed_weight_prior_interaction` reads `social_graph.trust_edges_live.current_weight`
   (`raw_weight × e^(-Δt / (stability·half_life))`, ADR-011 / `20260526-interaction-halflife`),
   **not** a raw interaction count. A fresh exchange ranks near the top; a long-dormant edge decays
   toward zero regardless of how many interactions once occurred. This is **verified in the curated
   handler** and unit-tested (two requesters with equal raw history but different recency rank
   differently; a fully decayed edge contributes ~0).
3. **No broadcast reputation feed.** `match_reason` and feed items explain the *connection* between
   two members ("2nd-degree trust · matches your service type") — they never publish a member's act
   history to others. Karma/trust signals describe a path, not a scoreboard.
4. **Sovereignty is own-rules / own-context / own-trust-model.** Communities set their own feed
   weights, enabled types, and trust parameters. We do **not** describe these as separate
   per-community "instances" — it is one platform whose ranking is locally configurable.

## Consequences

**Easier:**
- One canonical `RequestCard` and one `DecisionBand`, used everywhere — fix once, fixed everywhere.
- Decisions you owe and requests you can fill share one ordering on one surface.
- A single urgency scale, status token, and match-score scale across DB, API, and UI.
- The "designed to forget" promise is now structurally enforced in ranking, not just documented.

**Harder / deferred → resolved in Sprint 86:**
- ~~The legacy `BrowseFeed`/`Feed.tsx`/`BrowseTab` cards still exist for non-Home surfaces; their
  retirement and the `activity`/`story` texture layer are **Sprint 86**.~~ **Resolved (S86):** the
  Community Feed view (`GET /requests/curated?view=community`) renders the union's second view with the
  populated `activity`/`story` texture layer, and `BrowseFeed`/`Feed.tsx`/`FeedItem.tsx`/`FeedFilterPanel`
  were deleted. The community Browse tab now renders `<UnifiedFeed view="community" />` for all members
  (admins keep a separate all-status management list, since the curated feed serves only open requests).
- ~~`RequestCardData.request_type` is typed as the payload-subtype union but carries the enum value at
  runtime — a pre-existing modelling seam left untouched this sprint.~~ **Resolved (S86, [ADR-067](ADR-067-request-type-payload-vocabulary.md)):**
  `request_type` stays the coarse 5-value enum (filter); a separate `payload_type` (derived from the
  `category` column via `categoryToPayloadType()`) now drives `RequestPayloadRenderer`, so payload detail
  finally renders on canonical cards.

## References
- [ADR-067: request_type vs payload_type Vocabulary](ADR-067-request-type-payload-vocabulary.md) — closes the S85 seam
- [Sprint 84 direction doc](../design/sprint-84-unified-feed/README.md)
- [ADR-011: Reputation Decay](ADR-011-reputation-decay.md)
- [ADR-031: Unified Trust-Scored Feed](ADR-031-feed-scoring.md) (where present)
- `infrastructure/postgres/migrations/20260603-feed-vocab-reconciliation.sql`
- `infrastructure/postgres/migrations/20260526-interaction-halflife.sql`
