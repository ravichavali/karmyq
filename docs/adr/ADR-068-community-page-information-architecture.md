# ADR-068: Community Page Information Architecture (warm four-tab model)

**Status**: Implemented
**Date**: 2026-06-06
**Sprint**: 89
**Version**: 10.13.0

## Context

Sprint 88 shipped the warm "warm-commons" shell and reskinned the **feed surface** — the
relationship-led `RequestCard`, the `.kq-*` shell, `TrustPathBadge`, finite "caught up" states. But
the community **page** (`/communities/[id]`) was deliberately left untouched, and two problems
followed:

1. **The warm feed was hidden from members.** On the live page the warm feed (`BrowseTab` →
   `UnifiedFeed`) rendered only on the `requests` tab, and that tab button was gated behind
   `isAdminOrMod`. A regular member who opened a community landed on the old `overview` tab and
   **never saw the redesigned feed at all** — the S88 work was unreachable for the people it was
   built for.

2. **The page was a ~10-tab sprawl in pre-shell styling** — `overview · people · requests ·
   providers · settings · activities · trust · governance · fission · fusion` — none of it using a
   shell class, and "overview" led with empty KPI tiles instead of meaning.

The approved mockup (`docs/design/sprint-87/mockups/community-home.html`) defines a warmer target: a
community is *a place you belong to, not a dashboard you administer*.

## Decision

**1. Collapse the sprawl into four warm tabs**, plus a group-only Activities:

| Warm tab | Source today | Audience |
|----------|--------------|----------|
| **Home** (default) | warm hero + "this week" pulse + `BrowseTab`'s **member `UnifiedFeed` only** (was the admin-gated `requests`; `overview` retired) | Everyone |
| **People** | `ActiveTab` | Everyone |
| **How we're connected** | `TrustGraphTab` | Members |
| **Stewardship** | `GovernanceTab` + `FissionTab` + `FusionTab` + admin-only `StewardRequestsAdmin` (extracted from `BrowseTab`) + admin `ProfileTab(settings\|providers)` under one warm sub-nav | Members (admin tools gated within) |
| **Activities** (5th) | `ActivitiesTab`, `community_type === 'group'` only | Group members |

**2. Warm Home is the default for every role.** Initial `activeTab` is `'home'`; the `overview`
default is removed. Admins reach management one altitude down, via **Stewardship** — they no longer
*land* on management.

**3. `BrowseTab` was two surfaces; split it.** `BrowseTab` carried BOTH the member `UnifiedFeed` AND
an admin steward-request manager (all-status list, triage/boost/propose/insights/export). The member
feed stays in `BrowseTab` and becomes Home for everyone; the admin block is **extracted** into
`StewardRequestsAdmin` and relocated under Stewardship (admin-only). Rendering the whole `BrowseTab`
on Home would re-strand admins in management; rendering only `UnifiedFeed` without extracting would
silently lose the admin tools — so the split is mandatory, not cosmetic. This is a *relocation*, not
a rewrite (carries the S88 "don't rewrite admin management" rule).

**4. Preserve every deep link through one centralized resolver.** `lib/communityTabs.ts` exports
`resolveCommunityTab(raw)` mapping every legacy alias into the four-tab model so nothing 404s or
dead-ends: `overview`/`requests` → `home`; `trust` → `connected`;
`governance`/`fission`/`fusion`/`settings`/`config`/`links`/`providers`/`stats`/`insights`/`export`
→ `stewardship`; `manage`/`pending`/`members`/`norms` → `people`; unknown → `home`. The page and the
redirect test both import this one function — the map is never copied.

**5. The pulse reuses the S86 texture aggregation — it does not add a second query.** request-service
already computed the community's weekly numbers (`exchanges_completed_week`, `new_members_count`,
`open_requests_count` with `expired = FALSE`, `recent_helpers`) for the in-feed `ActivityCard`. That
aggregation was extracted into one shared helper (`fetchCommunityPulse`) feeding **both** the
in-feed card and the new `GET /requests/community/:communityId/pulse` endpoint, with one new field
`timeSensitive` (`urgency IN ('urgent','high')` among open, non-expired asks). `recentJoins` is
returned by the endpoint (server already reads `members.joined_at`) — there is **no** client-side
member-recency seam. The in-feed `ActivityCard` is **suppressed on community Home** (`suppressActivity`)
so the weekly summary is rendered once (in the hero pulse), not twice.

## Consequences

- **Members finally reach the warm feed** — the headline bug is fixed: Home renders the member
  `UnifiedFeed` for every role.
- **The page reads as a neighbourhood**: serif hero, member faces, a visible Dunbar cap bar ("capped
  at 150, on purpose"), and a real "this week in the neighbourhood" pulse instead of empty KPI tiles.
  Pulse rows with no meaningful data are suppressed; the cap line always renders.
- **Management still exists, one altitude down.** Stewardship composes the existing governance /
  split / fusion / steward-requests / settings / providers components under a sub-nav. `CommunityHeader`
  is retired in favour of `CommunityHero`. `/communities/[id]/admin` remains a back-compat redirect.
- **The pulse and the in-feed card can never diverge** — one aggregation, one helper. The pulse
  endpoint is members-only (gated on the JWT `communities` claim, not `communityMemberships`).
- No schema change; the pulse is read-only over existing tables.

## Related

- [ADR-066: Unified Feed Model](ADR-066-unified-feed-model.md) — the feed model Home renders.
- [ADR-067: request_type vs payload_type Vocabulary](ADR-067-request-type-payload-vocabulary.md) — the card seam S86 fixed.
- [ADR-018: Community Splitting Mechanics](ADR-018-community-splitting-mechanics.md) — Split/Fusion now live under Stewardship.
