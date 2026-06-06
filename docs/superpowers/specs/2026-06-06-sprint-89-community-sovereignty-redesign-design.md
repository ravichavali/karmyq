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
| **Home** (default) | Warm hero + "this week" pulse + relationship-led open asks ("Neighbours who could use a hand") + finite caught-up state | `BrowseTab` → `UnifiedFeed` (currently admin-gated `requests` tab) | Everyone |
| **People** | Members list + trust scores + norms | `ActiveTab` (current `people`) | Everyone |
| **How we're connected** | Community trust graph | `TrustGraphTab` (current `trust`) | Members |
| **Stewardship** | Governance/decisions + Split (fission) + Fusion; admin-only sub-sections for Settings + Providers | `GovernanceTab` + `FissionTab` + `FusionTab` + `ProfileTab(section=settings\|providers)` | Members (admin tools gated within) |

**Activities** stays as a conditional 5th tab for `community_type === 'group'` only (unchanged scope).

### Community pulse

A small weekly summary of real activity, replacing empty KPI tiles. Three help-loop facts come from
a **new request-service endpoint** (they require aggregation over the `requests` schema):

- `helpedThisWeek` — completed matches in this community in the last 7 days
- `openAsks` — open help requests in this community
- `timeSensitive` — of those, how many are `urgent`/`high`

The fourth fact — **recent joins** — is derived client-side from `community.members` (already loaded
by `useCommunityData`, carries `joined_at`/role). See Critical Implementation Note #4 for the seam
rationale (we deliberately do **not** make request-service own member-recency).

---

## Data Model

**No schema change.** All pulse facts come from existing tables via read-only aggregation:

- `requests.help_requests` — `status`, `urgency`, `created_at`, joined to community via
  `requests.request_communities (rc.community_id)`.
- `requests.matches` — `status`, `completed_at`, joined to `help_requests` via `request_id`.
- `communities.members` — `joined_at`, `role`, `status` (read client-side for recent joins).

---

## API Endpoints

| Method | Path | Description | Auth | Response |
|--------|------|-------------|------|----------|
| GET | `/api/requests/community/:communityId/pulse` | Weekly help-loop pulse for a community: completed-help count, open asks, time-sensitive subset (last 7 days). | Bearer JWT; caller must be an active member of `:communityId` (`user.communities`) | `{ success, data: { helpedThisWeek: number, openAsks: number, timeSensitive: number, windowDays: 7 } }` |

Routing: the request-service is already proxied under `/api/requests` in `nginx.conf` — no new nginx
block needed. Membership is read from `user.communities` (JWT), **not** `communityMemberships`.

---

## Frontend Changes

| File | Change |
|------|--------|
| `apps/frontend/src/pages/communities/[id].tsx` | Restructure to 4 warm tabs; **Home is default for all roles**; un-gate the warm feed; render `CommunityHero` + `CommunityPulse` on Home; map old tab keys (overview/requests/trust/governance/fission/fusion/settings/providers) into the new model + URL-sync. |
| `apps/frontend/src/components/community/CommunityHero.tsx` *(new)* | Warm serif hero: eyebrow ("A place you belong to"), community name, mission quote, member faces, capline ("N neighbours · room for M more · stewarded by …"), Dunbar **cap bar** + "capped at 150, on purpose" note. Built from `.kq-*` shell + serif. Replaces the pre-shell `CommunityHeader` chrome. |
| `apps/frontend/src/components/community/CommunityPulse.tsx` *(new)* | "This week in the neighbourhood" card: helped count, open asks (+ time-sensitive), recent joins. Suppresses rows with zero meaningful data rather than showing empty tiles. |
| `apps/frontend/src/components/community/tabs/StewardshipTab.tsx` *(new)* | Container that composes Governance/Split/Fusion (all members) + admin-only Settings/Providers sub-sections; warm sub-nav. Reuses existing tab components — does **not** rewrite admin management. |
| `apps/frontend/src/hooks/useCommunityPulse.ts` *(new)* | Fetches the pulse endpoint; returns `{ pulse, loading, error }`; called when Home is active. |
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
   must render the warm feed for **every** role. Verify a *member* (not admin) login lands on Home
   and sees relationship-led cards.
2. **Default tab = Home for all roles.** Initial `activeTab` is `'home'`; remove the `overview`
   default. Admins reach management via **Stewardship**, not by landing on it.
3. **Preserve deep links / backwards-compat.** Old `?tab=` values must still resolve:
   `overview`/`requests` → `home`; `trust` → `connected`; `governance`/`fission`/`fusion` →
   `stewardship` (with the right sub-section); `settings`/`providers` → `stewardship` (admin
   sub-section). Keep `OLD_TAB_MAP` working and extend it; existing redirect tests must stay green.
4. **Pulse seam: endpoint owns help-loop facts; recent-joins is client-derived.** The new endpoint
   lives in **request-service** and returns only `helpedThisWeek`/`openAsks`/`timeSensitive` — facts
   that genuinely require aggregating the `requests` schema. **Recent joins is derived client-side**
   from `community.members` (already loaded, has `joined_at`). Do **not** make request-service read
   member-recency — that's community-domain data and crossing the seam for one trivially-available
   number adds coupling for no gain. This is a deliberate decision, not an oversight.
5. **Pulse endpoint must enforce membership.** Gate on `user.communities` (active membership in
   `:communityId`), **not** `communityMemberships` (always `undefined` → always 403). Non-members
   get 403; the page only calls it for members.
6. **No empty tiles.** The pulse suppresses rows that would render "0" / nothing meaningful (e.g.
   no completed help this week → hide that row, don't show "0 neighbours helped"). The Dunbar capline
   ("room for M more") always renders since every community has a cap.
7. **API unwrap rule:** `createApiClient` already unwraps the envelope — consume `res.data`, not
   `res.data.data`. The pulse hook returns `res.data`.
8. **Don't rewrite admin management (carry S88 note 13).** Stewardship *relocates* the existing
   governance/split/fusion/settings/providers components under one warm tab with sub-nav; it does not
   re-implement them. Heavy admin config may continue to live on `/communities/[id]/admin`.
9. **Capline math uses the real cap.** "N neighbours · room for M more" and the cap bar use the
   community's actual member count and 150 Dunbar cap (or the community's configured `max_members`
   if present) — not a hard-coded 150 if the field exists. Cap-bar width = `count / cap`.
10. **`community_type` matters.** Activities stays a group-only tab; do not surface it for
    `mutual_aid` communities. Always check `community.community_type`.
11. **Schema name is `communities.*` (plural).** Older `community.*` comments/READMEs are stale; the
    request-service local README is also stale on the JWT field.
12. **nav.json reverts.** After `generate-docs`, grep-verify `apps/landing/.../nav.json` and re-apply
    if reverted. Landing docs dir is gitignored → `git add -f`.

---

## ADR

**ADR-068 — Community Page Information Architecture (warm four-tab model).** Records: the four-tab
consolidation and what maps where; warm Home as the default surface for all roles; the member/admin
altitude split (management under Stewardship); and the pulse-endpoint seam decision (help-loop facts
in request-service, recent-joins client-derived). Next free ADR after 067. Update `docs/adr/README.md`
and add the landing ADR JSON.
