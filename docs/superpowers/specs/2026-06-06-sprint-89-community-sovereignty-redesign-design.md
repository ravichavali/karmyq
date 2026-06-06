# Sprint 89: Community Sovereignty Redesign — Design Spec

**Date**: 2026-06-06
**Status**: Approved
**Version**: 10.12.0 → 10.13.0
**Sprint Branch**: `feature/sprint-89-community-sovereignty-redesign`

---

## Overview

Sprint 88 shipped the warm "warm-commons / calm-behavior" shell and re-skinned the **feed surface
only** — the relationship-led `RequestCard`, the `.kq-*` shell, `TrustPathBadge`, and the finite
"caught up" states. But the community **page** itself (`/communities/[id]`) was deliberately left
untouched. Two problems follow from that:

1. **The warm feed is effectively hidden from members.** On the live page the warm feed
   (`BrowseTab` → `UnifiedFeed`) renders only on the `requests` tab, and that tab button is gated
   behind `isAdminOrMod` ([id].tsx line ~192). A regular member who opens a community lands on the
   old `overview` tab and **never sees the redesigned feed at all**. The S88 work is real but
   unreachable for the people it was built for.

2. **The page is a 10-tab sprawl in pre-shell styling.** `overview · people · requests · providers ·
   settings · activities · trust · governance · fission · fusion` — none of the page chrome (header,
   tab bar, layout) uses a single shell class, and "overview" leads with empty/noisy KPI tiles
   instead of meaning.

Sprint 89 makes the community page match the approved `community-home.html` mockup. We collapse the
sprawl into **four warm tabs** — **Home · People · How we're connected · Stewardship** — make the
relationship-led warm feed the **default Home for every role**, add a warm serif hero with the
visible Dunbar cap bar, and replace empty KPI tiles with a real **"This week in the neighbourhood"
pulse** (neighbours helped, open asks, recent joins) backed by a new request-service endpoint.

### Core Principle: A community is a place you belong to, not a dashboard you administer

The community page should open as a *neighbourhood* — who's here, what's happening this week, who
needs a hand — for members and admins alike. Management tools still exist, but they live one
altitude down under **Stewardship**; they are not the thing you see first.

---

## Multi-Sprint Arc

- **Sprint 85** — unified feed, Dashboard Home first. ✅ Shipped v10.9.0.
- **Sprint 86** — Community Feed view + texture + legacy retirement + seam fix. ✅ Shipped v10.10.0.
- **Sprint 87** — Product Truth & UX Reset; warm-commons direction approved. ✅ v10.11.0.
- **Sprint 88** — Core help-loop redesign: shared shell + Dashboard Home + Community **feed**. ✅ v10.12.0.
- **Sprint 89 (THIS)** — Community sovereignty redesign: the whole community **page** → warm 4-tab
  model + pulse. Target v10.13.0.
- **Sprint 90** — Trust, forgetting, profile polish (visible decay; "designed to forget").
- **Sprint 91** — Mobile parity from the polished model.
- **Sprint 92** — Architecture & service pruning.

---

## New Concepts

### The four-tab community model

The mockup (`docs/design/sprint-87/mockups/community-home.html`) defines the target IA. Every
existing tab maps into one of four top-level warm tabs:

| Warm tab | Contains | Source component(s) today | Audience |
|----------|----------|---------------------------|----------|
| **Home** (default) | Warm hero + "this week" pulse + relationship-led open asks ("Neighbours who could use a hand") + finite caught-up state. **Member feed only** — the `UnifiedFeed` portion of `BrowseTab`, NOT the admin steward-request management. | `BrowseTab`'s `UnifiedFeed` portion (currently the whole tab is admin-gated) | Everyone |
| **People** | Members list + trust scores + norms | `ActiveTab` (current `people`) | Everyone |
| **How we're connected** | Community trust graph | `TrustGraphTab` (current `trust`) | Members |
| **Stewardship** | Governance/decisions + Split (fission) + Fusion; **admin-only: Steward requests** (all-status request list + triage/boost/propose + insights + export, extracted from `BrowseTab`) + Settings + Providers | `GovernanceTab` + `FissionTab` + `FusionTab` + extracted `BrowseTab` admin block + `ProfileTab(section=settings\|providers)` | Members (admin tools gated within) |

**Activities** stays as a conditional 5th tab for `community_type === 'group'` only (unchanged scope).

> **⚠️ BrowseTab is two surfaces today, not one.** `BrowseTab` currently renders BOTH the member
> feed (`UnifiedFeed`) AND an admin steward-request manager (all-status list, triage modal, boost,
> propose-match, insights, export — all gated on `isAdminOrMod`/`isAdmin`). S89 **splits** these:
> the member `UnifiedFeed` becomes Home (everyone); the admin steward-request block moves to
> **Stewardship** (admin-only). If Home rendered the whole `BrowseTab`, admins would still land on
> management; if it rendered only `UnifiedFeed`, the admin tools would silently disappear. The split
> is mandatory, not cosmetic.

### Community pulse — reuse the S86 texture aggregation, don't duplicate it

A small weekly summary of real activity, replacing empty KPI tiles:

- `helpedThisWeek` — completed matches in this community in the last 7 days
- `openAsks` — open, non-expired help requests in this community
- `timeSensitive` — of those, how many are `urgent`/`high` *(new — not in the existing query)*
- `recentJoins` — members who joined in the last 7 days
- `recentHelpers` *(optional)* — top names behind `helpedThisWeek`

**⚠️ This data already exists.** Sprint 86 added a community-feed "texture" aggregation in
`request-service` ([requests.ts ~1010–1051](../../services/request-service/src/routes/requests.ts))
that already computes `exchanges_completed_week`, `new_members_count`, `open_requests_count`
(already `expired = FALSE`), and `recent_helpers`, then appends them to the community feed as an
`ActivityCard` via `buildActivityItem`. The new pulse endpoint must **reuse / extract that same
aggregation** rather than write a second, divergent one — and the in-feed `ActivityCard` must be
**suppressed on the community Home** so the pulse is not rendered twice (once in the hero-level pulse,
once mid-feed).

Because that query already reads `communities.members.joined_at` server-side for `new_members_count`,
`recentJoins` is returned by the **endpoint** (server-side) — there is **no** client-side
member-recency seam. (The original plan's "derive recent-joins client-side" note is retired; it would
have produced a third copy of the same number.) `timeSensitive` is the only genuinely new field.

---

## Data Model

**No schema change.** All pulse facts come from existing tables via read-only aggregation:

- `requests.help_requests` — `status`, `urgency`, `expired`, joined to community via
  `requests.request_communities (rc.community_id)`. **Open count must include `expired = FALSE`**
  (the existing S86 texture query already does — match it).
- `requests.matches` — `status`, `completed_at`, joined to `help_requests` via `request_id`.
- `communities.members` — `joined_at`, `role`, `status` (read **server-side** by the existing
  texture query for `new_members_count`/`recentJoins`).

The pulse endpoint reuses the existing texture aggregation (see "Community pulse" above) plus one new
`timeSensitive` count — no new tables, no new member-recency seam.

---

## API Endpoints

| Method | Path | Description | Auth | Response |
|--------|------|-------------|------|----------|
| GET | `/api/requests/community/:communityId/pulse` | Weekly help-loop pulse: completed-help count, open (non-expired) asks, time-sensitive subset, recent joins, top helpers (last 7 days). Reuses the S86 texture aggregation. | Bearer JWT; caller must be an active member of `:communityId` (`user.communities`) | `{ success, data: { helpedThisWeek, openAsks, timeSensitive, recentJoins, recentHelpers?: {name, count}[], windowDays: 7 } }` |

Routing: the request-service is already proxied under `/api/requests` in `nginx.conf` — no new nginx
block needed. Membership is read from `user.communities` (JWT), **not** `communityMemberships`.

---

## Frontend Changes

| File | Change |
|------|--------|
| `apps/frontend/src/pages/communities/[id].tsx` | Restructure to 4 warm tabs; **Home is default for all roles**; render `CommunityHero` + `CommunityPulse` + **member feed only** on Home; map ALL old tab keys (see Critical Note #3) into the new model via a centralized, exported resolver + URL-sync. |
| `apps/frontend/src/components/community/tabs/BrowseTab.tsx` | **Split into two.** Extract the admin steward-request block (all-status list, triage modal, boost, propose-match, insights, export) into a new `StewardRequestsAdmin` component used by Stewardship. Leave the member `UnifiedFeed` + member-level "show more open" as the Home feed. |
| `apps/frontend/src/components/community/StewardRequestsAdmin.tsx` *(new)* | The extracted admin steward-request manager (admin-only); rendered inside `StewardshipTab`. |
| `apps/frontend/src/components/Feed/UnifiedFeed.tsx` | Add a mode/prop to **suppress the in-feed `ActivityCard`** on community Home (the hero-level `CommunityPulse` now renders that summary — avoid double pulse). |
| `apps/frontend/src/components/community/CommunityHero.tsx` *(new)* | Warm serif hero: eyebrow ("A place you belong to"), community name, mission quote, member faces, capline ("N neighbours · room for M more · stewarded by …"), Dunbar **cap bar** + "capped at 150, on purpose" note. Built from `.kq-*` shell + serif. Replaces the pre-shell `CommunityHeader` chrome. |
| `apps/frontend/src/components/community/CommunityPulse.tsx` *(new)* | "This week in the neighbourhood" card from the pulse endpoint: helped count, open asks (+ time-sensitive), recent joins. Suppresses rows with zero meaningful data rather than showing empty tiles. |
| `apps/frontend/src/components/community/tabs/StewardshipTab.tsx` *(new)* | Container that composes Governance/Split/Fusion (all members) + admin-only `StewardRequestsAdmin` + Settings/Providers sub-sections; warm sub-nav. Reuses/relocates existing components — does **not** rewrite admin management. |
| `apps/frontend/src/hooks/useCommunityPulse.ts` *(new)* | Fetches the pulse endpoint; returns `{ pulse, loading, error }`; called when Home is active; fail-soft. |
| `apps/frontend/src/lib/api.ts` | Add `requestService.getCommunityPulse(communityId)`. |
| `apps/frontend/src/styles/karmyq-shell.css` | Add hero/pulse/4-tab classes if not already covered by the shared shell. |
| `apps/frontend/src/components/community/CommunityHeader.tsx` | Either retired in favor of `CommunityHero`, or reduced to the join/CTA affordance the hero embeds. |

---

## User Guide & Doc Updates

Mandatory — this sprint ships real behavior changes.

- **`apps/landing/src/data/docs/guides/`** — update the community user guide (the page a member now
  lands on, the four tabs, where management moved, what the pulse means). Add it to `nav.json` "User
  Guides" if a new page. **Grep-verify nav.json after `generate-docs`** (it reverts).
- **`apps/landing/src/data/docs/concepts/`** — new concept page or update describing the four-tab
  community model + "a place you belong to" framing; add ADR-068 to nav.json "Architecture
  Decisions".
- **`apps/frontend/src/lib/onboarding/workflows.ts`** — update the community-related workflow keys
  whose navigation/tab names changed (overview→Home, trust→"How we're connected",
  governance/split/fusion→Stewardship).
- **`apps/frontend/CONTEXT.md`** — record the community-page IA change and default-tab behavior.
- **`services/request-service/CONTEXT.md`** + **`services/registry.json`** — document the new pulse
  endpoint under "apis.provides".
- **`docs/adr/ADR-068-community-page-information-architecture.md`** + `docs/adr/README.md` index +
  landing ADR JSON.

---

## Critical Implementation Notes

1. **The warm feed is currently admin-gated — that is the headline bug to fix.** In `[id].tsx` the
   `requests` tab button renders only under `isAdminOrMod`, so members never reach `BrowseTab`. Home
   must render the **member feed** (`UnifiedFeed` portion) for **every** role — but NOT the admin
   steward-request manager that also lives in `BrowseTab` (see New Concepts ⚠️ and Note #8). Verify a
   *member* (not admin) login lands on Home and sees relationship-led cards.
2. **Default tab = Home for all roles.** Initial `activeTab` is `'home'`; remove the `overview`
   default. Admins reach management via **Stewardship**, not by landing on it.
3. **Preserve EVERY existing deep link via a centralized resolver.** The live `OLD_TAB_MAP` in
   `[id].tsx` already aliases more than the obvious set: `manage`/`pending`/`members`/`norms` →
   People; `config`/`links` → Settings; `stats`/`insights`/`export` → the request/insights surface.
   The S89 resolver must remap ALL of them into the 4-tab model — nothing may 404 or dead-end:
   `overview`/`requests` → `home`; `trust` → `connected`; `governance`/`fission`/`fusion` →
   `stewardship`; `settings`/`config`/`links`/`providers` → `stewardship` (admin sub-section);
   `manage`/`pending`/`members`/`norms` → `people`; `stats`/`insights`/`export` → `stewardship`
   (admin steward/insights sub-section, since that moved out of the member feed). **Centralize the
   resolver in one exported function** and have BOTH the page and the redirect test import it — today
   the redirect test owns a *copied* map, so "tests stay green" would not actually prove the live
   resolver. Update the test to import the real resolver.
4. **Pulse reuses the existing S86 texture aggregation — do not write a second one, and de-dup the
   in-feed card.** request-service already computes the same weekly numbers (`exchanges_completed_week`,
   `new_members_count`, `open_requests_count` with `expired = FALSE`, `recent_helpers`) at
   `requests.ts ~1010–1051` and appends an `ActivityCard` to the community feed. The new `/pulse`
   endpoint must **extract/reuse that query** (adding only `timeSensitive`), and the community Home
   **must suppress the in-feed `ActivityCard`** (UnifiedFeed mode) so the pulse is not rendered twice.
   Because that query already reads `members.joined_at` server-side, `recentJoins` comes from the
   **endpoint** — there is no client-side member-recency seam (the earlier "derive client-side" idea
   is retired; it would have been a third copy of the same number).
5. **Pulse endpoint must enforce membership.** Gate on `user.communities` (active membership in
   `:communityId`), **not** `communityMemberships` (always `undefined` → always 403). Non-members
   get 403; the page only calls it for members.
6. **`openAsks` must exclude expired requests.** Count `status = 'open' AND expired = FALSE` (the
   existing texture query already does — match it, or the pulse will overcount vs the feed).
7. **No empty tiles.** The pulse suppresses rows that would render "0" / nothing meaningful (e.g.
   no completed help this week → hide that row, don't show "0 neighbours helped"). The Dunbar capline
   ("room for M more") always renders since every community has a cap.
8. **API unwrap rule:** `createApiClient` already unwraps the envelope — consume `res.data`, not
   `res.data.data`. The pulse hook returns `res.data`.
9. **Don't rewrite admin management (carry S88 note 13).** Stewardship *relocates* existing
   components under one warm tab with sub-nav: governance/split/fusion + the **extracted** steward-
   request admin block (`StewardRequestsAdmin`) + settings/providers. It does not re-implement them.
   **`/communities/[id]/admin` is just a back-compat redirect to `/communities/[id]` today** — do NOT
   describe it as a live heavy-config home; admin config lives in the Stewardship sub-sections.
10. **Capline math uses the real cap.** "N neighbours · room for M more" and the cap bar use the
    community's actual `current_members` and configured `max_members` (both confirmed present on the
    community model; fall back to 150 Dunbar only if `max_members` is null). Cap-bar width =
    `current_members / max_members`.
11. **`community_type` matters.** Activities stays a group-only tab; do not surface it for
    `mutual_aid` communities. Always check `community.community_type`.
12. **Schema name is `communities.*` (plural).** Older `community.*` comments/READMEs are stale; the
    request-service local README is also stale on the JWT field.
13. **nav.json reverts.** After `generate-docs`, grep-verify `apps/landing/.../nav.json` and re-apply
    if reverted. Landing docs dir is gitignored → `git add -f`.

---

## ADR

**ADR-068 — Community Page Information Architecture (warm four-tab model).** Records: the four-tab
consolidation and what maps where; warm Home as the default surface for all roles; the member/admin
altitude split (member feed on Home vs. steward-request management + settings/providers under
Stewardship); and the pulse decision (reuse the S86 texture aggregation server-side, suppress the
duplicate in-feed `ActivityCard`). Next free ADR after 067. Update `docs/adr/README.md` and add the
landing ADR JSON.
