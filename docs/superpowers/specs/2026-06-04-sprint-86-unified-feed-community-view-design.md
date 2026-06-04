# Sprint 86: Unified Feed — Community Feed view + texture — Design Spec

**Date**: 2026-06-04
**Status**: Approved
**Version**: v10.9.0 → v10.10.0
**Sprint Branch**: `feature/sprint-86-unified-feed-community-view`

---

## Overview

Sprint 85 shipped the unified feed's **first** view — Dashboard Home — built from one
`UnifiedFeedItem` union (`request` + `decision` kinds) served by `GET /requests/curated?view=home`,
ordered by server-computed action altitude. It deliberately left three things for Sprint 86:
the **second view** (Community Feed), the **texture layer** (`activity`/`story` items — their shapes
exist in `unified-feed.ts` but are never populated), and **retirement of the legacy feed components**
that the canonical `RequestCard`/`DecisionBand` were built to replace.

This sprint renders the **same union in its second view**. The community page's "requests" tab today
uses `BrowseTab`'s bespoke request cards; Sprint 86 replaces that with the canonical unified feed,
served by a new `view=community` branch on `/requests/curated`. That view returns community-scoped
`request` items **plus** a `activity` texture item (this-week community stats) and `story` items
(milestones / first-timers), all computed inside request-service — the unified feed stays
single-source (ADR-066's core consolidation; no new cross-service dependency on feed-service).

It also closes the modelling seam ADR-066 documented as a known consequence: `RequestCardData.request_type`
is typed as the payload-subtype union but carries the 5-value enum at runtime, so `RequestPayloadRenderer`
(which switches on the fine subtype) renders **no payload detail** on canonical cards. Sprint 86 separates
the two concepts into two fields — `request_type` (the coarse 5-value enum, for filtering) and `payload_type`
(the fine subtype discriminator, sourced from the DB `category` column, for payload rendering) — so
commitment legibility finally lights up on the canonical card. This is ADR-067.

### Core Principle: One model, two views, zero bespoke cards

After Sprint 86 there is exactly **one** request card (`RequestCard`), **one** decision surface
(`DecisionBand`), and **one** feed renderer (`UnifiedFeed`) — rendered on Dashboard Home and on the
Community tab. Every legacy bespoke renderer (`Feed.tsx`, `FeedItem.tsx`, `BrowseFeed.tsx`, `BrowseTab`'s
inline cards) is deleted, not merely bypassed. Fix once, fixed everywhere.

---

## Multi-Sprint Arc

### Sprint 84 — Unified feed research & direction (complete)
Design direction doc + mockups. `no-deploy`. See `docs/design/sprint-84-unified-feed/README.md`.

### Sprint 85 — Unified feed, Dashboard Home first (complete, shipped v10.9.0)
Canonical `RequestCard` + `DecisionBand` + `UnifiedFeed` on Dashboard Home; `GET /requests/curated?view=home`
returns the `request`/`decision` union with server-side action altitude; urgency/status/`match_score`
vocab reconciliation; Withdraw-Offer verify-lock; ADR-066. Left a documented `request_type` seam.

### Sprint 86 — Community Feed view + texture (this sprint)
Second view of the union (Community Feed, replacing `BrowseTab` cards); populate the `activity`/`story`
texture layer (computed in request-service via `view=community`); retire legacy feed components; fix the
`request_type`/`payload_type` modelling seam (ADR-067). **Web-only.**

### Sprint 87 — Mobile parity + analytics (upcoming)
Bring the unified feed (both views) to React Native/Expo; home-feed impression logging for the
`view=home`/`view=community` union (the curated `feed_events` impression log currently only fires on the
legacy array path, not the unified-feed path — an analytics gap carried from S85).

---

## New Concepts

### `view=community` (curated feed mode)
A third mode of `GET /requests/curated` (after the legacy array and `view=home`). Returns a
`{ items, count }` union scoped to one community: the community's open `request` items (canonical
card payload), **without** the personal "needs your response" decision band (decisions are a
Dashboard-Home concern — the member's cross-community action queue, not a per-community view), plus
the texture layer below. **Requires `community_id`** — the handler 400s if it's missing and verifies the
caller is a member of that community (JWT `user.communities`) before running texture reads, so a non-member
can never pull a community's activity/story texture even when no request rows match the request filter.

### Texture layer — `activity` and `story` items
The two `UnifiedFeedItem` kinds whose shapes shipped empty in S85:

- **`activity`** (`ActivityData` = `CommunityActivityData`): one summary item per community view —
  exchanges completed this week, new members, open-requests count, recent helpers. Ranks **below**
  all request items (it's ambient texture, not an action). Sourced from request-service reads over
  `requests.matches` / `communities.members` / `requests.help_requests`.
- **`story`** (`StoryData`): milestone / first-timer / pay-it-forward narrative beats. Ranks at the
  bottom band. Sourced from request-service reads (e.g. recently-completed first exchanges, karma
  milestones already visible to request-service). Best-effort: a story-query failure degrades to "no
  stories", never breaks the feed (same non-fatal pattern as `fetchDecisions`).

### `payload_type` (the seam fix, ADR-067)
A new explicit field on the request-card payload carrying the **fine payload subtype**
(`transportation|moving_help|childcare|tech_help|home_repair|food|pet_care|event_help|other`), distinct
from `request_type` (the coarse 5-value `request_type_enum`). Derived from the existing DB `category` column
via a `categoryToPayloadType()` **normalization map** — **not** a raw passthrough. The `category` column is
messy: on INSERT it's set to the *same* value as `request_type` (so newer wizard rows hold the enum), while
older/simulation rows hold skill-ish tokens (`moving`, `tech_support`, `gardening`, `cooking`, …) that the
matching SQL keys off. The renderer switches on `moving_help`/`tech_help`/etc. The map translates known
aliases (`moving`→`moving_help`, `tech_support`→`tech_help`, `transportation`, `childcare`, `home_repair`,
`cooking`/`food`→`food`, `pet_care`) and returns `undefined` for anything unrecognized — `RequestPayloadRenderer`
already no-ops on an unknown type / empty payload, so unmapped rows render exactly as today (no regression).
`request_type` remains the filter dimension. No DB migration — only a plumb-through + the map.

---

## Data Model

**No schema migration this sprint.** All texture and the `payload_type` value come from existing columns:

| Source column | Used for |
|---------------|----------|
| `requests.help_requests.category` (VARCHAR) | `payload_type` discriminator — via `categoryToPayloadType()` map (mixed vocabulary: enum values on newer rows, skill tokens like `moving`/`tech_support` on older/sim rows) |
| `requests.help_requests.request_type` (enum) | `request_type` filter dimension (unchanged) |
| `requests.matches` (completed this week) | `activity.exchanges_completed_week`, `story` (first exchanges) |
| `communities.members` (joined this week) | `activity.new_members_count` |
| `requests.help_requests` (open in community) | `activity.open_requests_count` |

If a story signal needs reputation/karma data request-service cannot already read, **degrade to no
story** rather than adding a cross-service call (texture is best-effort; ADR-066 single-source intent).

---

## API Endpoints

| Method | Path | Change | Auth | Response |
|--------|------|--------|------|----------|
| GET | `/requests/curated?view=community&community_id=:id` | **New view branch.** Returns the community-scoped union: `request` items + one `activity` item + `story` items, ranked by action altitude (requests above activity above stories). No `decision` band. **400** if `community_id` missing; **403** (or no texture) for a non-member. | JWT | `{ success, data: { items: UnifiedFeedItem[], count } }` |
| GET | `/requests/curated?view=home` | **Modified.** Each `request` item's `data` now carries `payload_type` (the fine subtype via `categoryToPayloadType(category)`) alongside `request_type`. | JWT | unchanged shape + `payload_type` field |

`view` absent → legacy request array (unchanged back-compat — but all in-repo callers move off it this sprint).

---

## Frontend Changes

| File | Change |
|------|--------|
| `apps/frontend/src/types/unified-feed.ts` | Add `payload_type?: PayloadType` to `RequestCardData`; export `PayloadType`. Keep `request_type` as the enum. Update the `activity`/`story` doc comments to "populated S86". |
| `apps/frontend/src/lib/api.ts` | Widen `getCuratedRequests` `view?: 'home'` → `view?: 'home' \| 'community'` (current type rejects `'community'`). |
| `apps/frontend/src/components/Feed/RequestCard.tsx` | Pass `data.payload_type` (not `data.request_type`) to `RequestPayloadRenderer`. |
| `apps/frontend/src/components/Feed/UnifiedFeed.tsx` | Render `activity` and `story` kinds (new `ActivityCard`/`StoryCard` presentational components); accept a `view: 'home' \| 'community'` prop and request that view; community view hides the decision band and browse-mode control. |
| `apps/frontend/src/components/Feed/ActivityCard.tsx` (new) | Presentational community-activity texture card. |
| `apps/frontend/src/components/Feed/StoryCard.tsx` (new) | Presentational story texture card. |
| `apps/frontend/src/components/community/tabs/BrowseTab.tsx` | Replace the bespoke request-card list with `<UnifiedFeed view="community" communityId={…} />`. Keep the admin/triage/export controls that are genuinely community-management (not feed rendering). |
| `apps/frontend/src/components/BrowseFeed.tsx` | **Delete** (canonical card + UnifiedFeed replace it). Remove all imports. |
| `apps/frontend/src/components/Feed/Feed.tsx`, `Feed/FeedItem.tsx` | **Delete** (legacy bespoke renderer; superseded by UnifiedFeed). Remove all imports/usages. |
| `apps/frontend/src/components/FeedFilterPanel.tsx` / `FilterChipRow.tsx` | **De-dup** into one filter component (keep `FilterChipRow`, the one UnifiedFeed uses; delete `FeedFilterPanel` and migrate any remaining caller). |

---

## User Guide & Doc Updates

Mandatory — every sprint ships doc updates.

- **ADR-067** (`docs/adr/ADR-067-request-type-payload-vocabulary.md` + index + landing JSON + nav): the
  `request_type` vs `payload_type` separation and why it closes the ADR-066 seam.
- **ADR-066 status note**: mark the documented "Harder/deferred" consequences (legacy retirement, texture
  layer, the `request_type` seam) as **resolved in Sprint 86**, linking ADR-067.
- **User guide** `apps/landing/src/data/docs/guides/` — update the unified-feed / browsing-requests guide:
  the Community tab now shows the same canonical feed as Dashboard Home, with community texture (activity
  summary + stories). Document where the two views differ (decision band is Home-only).
- **Concept page** `apps/landing/src/data/docs/concepts/unified-feed.json`: add the "two views, one model"
  + texture-layer section.
- **Onboarding** `apps/frontend/src/lib/onboarding/workflows.ts`: update any workflow that points at the
  old Browse tab card UI.
- **CONTEXT.md** `services/request-service/` + **registry.json**: document the `view=community` branch.

---

## Critical Implementation Notes

1. **Texture is computed in request-service, NOT feed-service.** Add a `view=community` branch to
   `/requests/curated` that assembles request + activity + story items from request-service's own DB
   reads. Do **not** call feed-service — that reintroduces the dependency ADR-066 consolidated away.
2. **The `request_type` seam fix = two fields + a normalization map, no migration. A raw `r.category`
   passthrough is WRONG.** `request_type` stays the 5-value enum (`generic|ride|borrow|service|event`, the
   filter dimension). Derive `payload_type` from `category` via `categoryToPayloadType()`: on INSERT,
   `category` and `request_type` get the *same* value, so newer rows hold the enum while older/sim rows hold
   skill tokens (`moving`, `tech_support`, `gardening`, …) that the matching SQL keys off. The renderer
   switches on `moving_help`/`tech_help`/etc., so the map must translate the known aliases and return
   `undefined` for the rest (renderer no-ops safely). `RequestPayloadRenderer` switches on `payload_type`.
3. **Community view has NO decision band, and requires a `community_id` + membership guard.** Decisions are
   the member's cross-community action queue — a Dashboard-Home concern. `view=community` returns
   `request`/`activity`/`story` only (never call `fetchDecisions`). It MUST 400 on a missing `community_id`
   and verify the caller is a member (JWT `user.communities`) before running texture reads, so a non-member
   can't pull a community's texture.
4. **Texture ranks below requests; stories below activity.** Extend the priority bands in
   `unifiedFeed.ts`: requests (1000–1100, existing) > activity (e.g. 500) > story (e.g. 100). Reuse
   `assembleHomeFeed`'s stable descending-priority sort (rename to `assembleFeed` if it now serves both
   views, or add a sibling). The client renders in array order — server owns ordering.
5. **Texture queries are best-effort (non-fatal).** Wrap each activity/story query in try/catch that
   degrades to "no texture" and logs — never let a texture-query error break the feed (same pattern as
   `fetchDecisions` in `requests.ts`).
6. **Delete legacy components, don't bypass them.** `BrowseFeed.tsx`, `Feed/Feed.tsx`, `Feed/FeedItem.tsx`,
   and `FeedFilterPanel.tsx` are removed this sprint. Grep every import before deleting; a dangling import
   fails the type check. `BrowseTab` keeps its community-management controls (triage/export/member-picker)
   — only its bespoke *card rendering* is replaced by `<UnifiedFeed view="community" />`.
7. **`UnifiedFeed` already takes `communityId`** and passes it to `getCuratedRequests`. The S86 work adds a
   `view` prop (`'home' | 'community'`), the `activity`/`story` renderers, and the conditional decision-band
   / browse-mode hiding for the community view. Don't rebuild the fetch/filter plumbing — extend it.
8. **`view=home` request items also gain `payload_type`** — the seam fix benefits Dashboard Home too
   (payload detail renders there now). Add `payload_type: categoryToPayloadType(r.category)` in
   `toRequestCardData`.
9. **Dry-run the `category` vocabulary to build the map.** `SELECT request_type, category, COUNT(*) FROM
   requests.help_requests GROUP BY 1,2` on the demo DB — drive `categoryToPayloadType`'s alias cases and its
   unit test from the real distinct values. Null/unknown `category` → `payload_type` undefined →
   `RequestPayloadRenderer` no-ops on empty payload (safe fallback, same as today).
10. **API response unwrap**: `createApiClient` already unwraps the envelope → use `res.data.items`, not
    `res.data.data.items`. **JWT field is `communities`**, not `communityMemberships`.
11. **Landing docs dir is gitignored** — `git add -f apps/landing/src/data/docs/...`. Run `generate-docs`
    from `apps/landing/` and **grep-verify nav.json after** (it silently reverts).
