# Unified Feed & Dashboard Redesign — Design Direction

**Sprint**: 84 (research & direction, `no-deploy`)
**Date**: 2026-06-03
**Status**: Direction proposed — input to Sprint 85 implementation
**Deliverable**: this document + throwaway HTML/Tailwind mockups under [`mockups/`](mockups/)

> This is a **design-direction document, not an implementation**. It audits the feed/dashboard
> surfaces that exist today, catalogs the real data and actions they carry, studies products that
> solved purposeful (non-engagement) feeds, derives principles from Karmyq's actual job, and
> synthesizes a single unified information architecture for Sprint 85 to build against. No
> production code, schema, or API changes ship in this sprint.

---

## 1. Overview & the Job-to-be-Done

Karmyq's feed exists to do exactly one thing:

> **Connect a member who needs help with a member who can give it, inside a community of trust.**

It is **not an engagement surface.** There is no business reason for a Karmyq member to scroll
forever — a healthy session ends when a need is met or an offer is made, not when the user runs out
of content. Curation, clarity, and "what should I do next" beat volume every time. This framing is
the anchor for every recommendation below; it comes directly from the founding framing note
([`docs/IDEAS.md`](../../IDEAS.md) [2026-05-20] "framing"):

> *"Feeds and dashboards need to be designed fit-for-purpose. These are not Facebook-style infinite
> feeds… start from what the platform is actually trying to do (connect people who need help with
> people who can give it, within a community of trust) and design the feed/dashboard experience
> backwards from that goal — not borrow patterns from social media."*

The problem this sprint addresses: Karmyq's feed surfaces **grew by accretion**. There are three
overlapping implementations of "a list of requests a member can act on," each with its own data
shape, card markup, and action vocabulary, and none of them states what it is *for*. This document
proposes collapsing them into **one feed model rendered in two views**.

---

## 2. Audit — the surfaces that exist today

Three distinct feed implementations render essentially the same underlying entity (an open help
request), plus three supporting tabs and two dashboard widgets. Read order and findings:

### 2.1 Surface A — Dashboard "Browse" feed (`BrowseFeed.tsx`)

- **Where**: [`pages/dashboard.tsx`](../../../apps/frontend/src/pages/dashboard.tsx) `browse` tab →
  [`BrowseFeed.tsx`](../../../apps/frontend/src/components/BrowseFeed.tsx).
- **Data**: `requestService.getCuratedRequests({ community_id, limit: 50 })` → `/requests/curated`.
  Client-filters to `status === 'open'` and `requester_id !== currentUserId`.
- **Renders**: a single-column card list (`max-w-2xl`). Each card: requester avatar/initial,
  requester name, **trust-path badge** (`useTrustPath` → `RequestTrustBadge`), `% match` when
  `match_score > 0`, relative time, title, optional "Provider match" / "⚡ Community Pick"
  (boost) badges, 2-line description clamp, type chip, urgency chip, community name.
- **Actions per card**: one — **"Offer to Help"** → `requestService.createMatch({ request_id,
  responder_id })`, optimistic remove from list, transient "Offer sent → Track in Helping tab" banner.
- **Filters/controls**: `FilterChipRow` (type + urgency); `BrowseModeControl` (Community / Provider
  / Both) — but **only visible when `isOnDuty`** (otherwise `invisible pointer-events-none`).
- **Notable**: the only surface wired to the **curated/ranked** endpoint and to the on-duty
  provider filter. Designed around the *helper* deciding whom to help.

### 2.2 Surface B — Community "Browse" tab (`community/tabs/BrowseTab.tsx`, 586 lines)

- **Where**: community detail page → `BrowseTab`. Receives `communityRequests` etc. as props from
  `useCommunityData` (not self-fetching the list).
- **Data**: community-scoped requests + `stats`, `communityTrust`, `networkMetrics` (admin-only
  insight payloads). Status filter tabs re-fetch via `refetchCommunityRequests(status)`.
- **Renders**: a **denser, left-aligned row list** (not the dashboard card) — title links to
  `/requests/:id`, urgency pill, boost pill, 1-line description clamp, "by {requester_name}",
  status pill, date. Plus admin-only summary cards (Open / Fulfilled rate / Avg response), a
  **Community Trust Score** panel, a **Network Cohesion** panel, and a **CSV/JSON export** block.
- **Actions per row**: **none for regular members** (rows are read → click through to detail).
  Admin/mod get: **Triage** (urgency + admin note modal), an **Actions ▾** dropdown
  (Boost 48h / Remove Boost, Mark Urgent, Propose a Match), and a **MemberPicker** "Propose a Match"
  flow. Status filter is `open / pending / matched / completed`.
- **Notable**: this surface is really **two products in one** — a member-facing request list *and*
  an admin community-management console. Its card vocabulary, status model (`pending`, `matched`,
  `completed` are exposed here but nowhere in Surface A), and trust display all diverge from A.

### 2.3 Surface C — `Feed/Feed.tsx` + `FeedItem.tsx` (the original "activity feed")

- **Where**: [`components/Feed/Feed.tsx`](../../../apps/frontend/src/components/Feed/Feed.tsx).
  **Not currently mounted by `dashboard.tsx`** — it's the legacy general feed component.
- **Data**: raw `fetch` to `${FEED_API_URL}/feed?limit=20` with an `x-user-id` header (the only
  surface that calls the **Feed service**, port 3007, directly rather than the request service).
- **Renders**: a **polymorphic** item list over four `FeedItem` types from
  [`types/feed-items.ts`](../../../apps/frontend/src/types/feed-items.ts):
  - `community_activity` — weekly exchanges, top helpers, new members, "N requests need help".
  - `open_request` — the richest request card: urgency pill, "Community Pick", "New – no offers yet",
    trust-path badge, **KarmaBadge**, polymorphic **`RequestPayloadRenderer`** (transportation,
    moving, childcare, tech, home repair, food), required-skills chips, completed-fade opacity, and
    two actions: **View Details** + **Offer to Help** (both links to `/requests/:id`).
  - `suggested_request` — "Suggested for You" with a `match_score` and a "Why suggested" reason.
  - `story` — first-timer / milestone / pay-it-forward / unexpected-match narrative cards.
- **Actions**: per-item **Dismiss** (`POST /feed/dismiss/:id`), **Refresh**, **Load more**.
- **Notable**: the most *editorially* ambitious surface (stories, suggestions, activity digests)
  and the only one with a **dismiss/feedback signal** — but it duplicates the open-request card a
  third time, with a third visual language, and isn't wired into the live dashboard.

### 2.4 The tab shell & supporting surfaces

- **`TabBar.tsx`** — three tabs: **Browse / Helping / Asks** (`TabId = 'browse' | 'helping' |
  'asks'`). Desktop horizontal + mobile bottom-nav. Carries a dibs/commitment count badge on Helping.
- **`CommitmentsTab.tsx`** ("Helping") — the **action-altitude surface that already exists**:
  groups matches into "I'm Helping" / "I Asked For Help", each split into **Awaiting Acceptance /
  Needs Your Response / In Progress / Completed**, sorted by `sortByActionPriority`. Surfaces pending
  **First Dibs** invitations at the top "before time runs out", provider **Offers Received**, inline
  rating prompts, and an `ExpandableConversation`. This is the closest thing Karmyq has to a
  "decisions needed" inbox — but it's siloed in a tab, not connected to the browse feeds.
- **`MyRequestsTab.tsx`** ("Asks") — the member's own requests, expandable to show offers with
  Accept/Decline. Overlaps the "I Asked For Help" section of CommitmentsTab.
- **`FeedFilterPanel.tsx`** — a richer filter (Trust distance: Direct / 2nd / Community / All +
  request type) that is **not** the one `BrowseFeed` uses (BrowseFeed uses `FilterChipRow`). Another
  divergence: two filter components for conceptually the same feed.
- **`TrustNetworkWidget.tsx`** / **`ProviderDashboardCard.tsx`** — dashboard context widgets (trust
  graph; provider stats + availability toggle). Relevant because the redesigned dashboard home must
  decide whether feed and context coexist on one screen.

### 2.5 What the audit reveals

| Concern | Surface A (BrowseFeed) | Surface B (Community BrowseTab) | Surface C (Feed/FeedItem) |
|---|---|---|---|
| Mounted in live app | ✅ dashboard | ✅ community page | ❌ legacy/unmounted |
| Backing endpoint | `/requests/curated` | community requests (props) | `/feed` (Feed service) |
| Card visual language | rounded `feed-card` | dense row | rich `bg-surface-raised` card |
| Open-request card defined | once | once (different) | once (different) | 
| Ranking / `match_score` | ✅ | ❌ | ✅ (+ suggestions) |
| Trust display | trust-path badge | community trust panel (aggregate) | trust-path + Karma badge |
| Primary action | Offer to Help (inline `createMatch`) | none (members) / triage (admins) | View + Offer (links) |
| Status vocabulary shown | `open` only | open/pending/matched/completed | open/completed (fade) |
| Polymorphic request payload | ❌ | ❌ | ✅ `RequestPayloadRenderer` |
| Dismiss / curation signal | ❌ | ❌ | ✅ dismiss |

**The duplication is the thing being collapsed.** The open help request — the single most important
object on the platform — is rendered by **three different card components, fed by three different
data paths, with three different action vocabularies.** A change to "how a request looks" today
means editing three files that will inevitably drift (they already have).

**Borrowed social-media patterns that don't serve the job** (flagged for rejection unless
re-justified in §5):
- **"Load more" / open-ended pagination** on Surface C — treats the feed as an infinite stream
  rather than a finite, actionable queue.
- **`story` cards** (milestones, "pay it forward") — pure engagement content; they decorate the feed
  with social proof but carry no decision for the viewer. Valuable as *community texture*, but they
  should never compete for altitude with an open request that needs a helper.
- **Engagement-style "Refresh" affordance** — implies a never-settled stream; a purposeful queue
  should reflect truth on load and update on action, not invite pull-to-refresh habit loops.
- **`% match` framed as a ranking score** with no explanation — borrows the opaque
  relevance-score pattern; in a trust context the *reason* matters more than the number.

---

## 3. Data & Action Inventory (grounded in real code)

Catalog only — **no API change this sprint.** Anything the redesign wants that doesn't exist is
flagged `→ S85` (Sprint 85 recommendation).

### 3.1 Request fields the cards actually consume

From [`types/feed-items.ts`](../../../apps/frontend/src/types/feed-items.ts) (`OpenRequestData`) and
the `HelpRequest` shapes in `BrowseFeed`/`BrowseTab`:

| Field | Source / type | Used by |
|---|---|---|
| `request_id` / `id` | uuid | all |
| `title`, `description` | string | all |
| `author_name` / `requester_name` | string | all |
| `requester_id` | uuid | trust-path lookup, "offer" guard |
| `community_id`, `community_name` | uuid / string | all |
| `urgency` | `urgent\|high\|medium\|low` (Surface A/C) **vs** `low\|medium\|high\|critical` (Triage, Surface B) | all — **vocabulary mismatch, → S85 to reconcile** |
| `request_type` | `generic\|ride\|service\|event\|borrow` (chips) **vs** `transportation\|moving_help\|childcare\|tech_help\|home_repair\|food` (payload renderer) | **two type taxonomies, → S85 to reconcile** |
| `payload` + `requirements` + `preferred_start_date` | polymorphic `RequestPayload` | Surface C only (`RequestPayloadRenderer`) |
| `required_skills` | `string[]` | Surface C |
| `offers_count` | number | Surface C ("New – no offers yet") |
| `match_score` | 0–1 (A) / 0–100 (C) | A, C — **scale mismatch, → S85** |
| `is_boosted` + `boosted_expires_at` | boost window | all (`isBoostActive`) |
| `requesterKarma`, `requesterTrustScore` | reputation | Surface C (`KarmaBadge`) |
| `status` | `open\|pending\|matched\|completed\|dibs_pending` | B (filters), C (fade) |
| `completed_at`, `updated_at` | timestamps | completed-fade opacity |
| `admin_note` | string (admin-only) | B (triage) |

### 3.2 Trust / reputation signals available

- **Trust path** — `useTrustPath(requesterId)` → `TrustPathBadge` (degree of separation / path to
  requester). Available on A and C; **absent from B's member view**.
- **Karma + trust score** — `KarmaBadge` (C only).
- **Community-level** — `communityTrust` (member quality / bonding / bridging) and `networkMetrics`
  (reciprocity, density, clustering, avg path) — aggregate, admin-only, Surface B.

### 3.3 Every action a card / surface can trigger today

| Action | API | Where it lives now |
|---|---|---|
| Offer to help (create match) | `POST /matches` (`createMatch`) | BrowseFeed (inline) |
| View request detail | link `/requests/:id` | B, C |
| Offer via detail page | link `/requests/:id?offer=true` | C |
| Accept / decline an offer (as requester) | `acceptMatch` / `rejectMatch` | CommitmentsTab, MyRequestsTab |
| Withdraw own proposed offer (as helper) | `rejectMatch` | CommitmentsTab — **known role bug, → S85** (see §7) |
| Mark / confirm done | `completeMatch` | CommitmentsTab |
| Rate exchange | `reputationService.submitFeedback` | CommitmentsTab |
| Accept / decline First Dibs | `dibsService.accept/declineDibs` | CommitmentsTab |
| Accept / decline provider offer | `acceptOffer` / `declineOffer` | CommitmentsTab |
| Dismiss feed item | `POST /feed/dismiss/:id` | Feed/FeedItem only |
| Admin: triage (urgency + note) | `adminTriageRequest` | BrowseTab |
| Admin: boost / remove boost | `boostRequest` / `removeBoost` | BrowseTab |
| Admin: mark urgent | `markUrgent` | BrowseTab |
| Admin: propose a match | `proposeMatch` | BrowseTab |
| Export community data | `exportCommunityData` / `exportMembers` / `exportActivity` | BrowseTab (admin) |

### 3.4 Endpoints each surface calls (catalog only)

- **Surface A** → `GET /requests/curated` (request service, 3003).
- **Surface B** → community requests + stats + trust + network metrics (community/reputation/
  social-graph), admin mutations on request service.
- **Surface C** → `GET /feed`, `POST /feed/dismiss/:id` (feed service, 3007).
- **Helping/Asks** → `GET /matches`, `GET /requests?requester_id=`, dibs + provider-offer APIs.

**Data gaps the redesign will want (→ S85):**
1. A **single feed endpoint** that returns the unified item shape for both views (today A and C use
   different services; the unified model needs one source of truth — likely the Feed service
   absorbing the curated-ranking logic, or the request service growing a `view=home|community` param).
2. **Reconciled urgency + request_type vocabularies** (two of each exist; see §3.1).
3. **A consistent `match_score` scale** (0–1 vs 0–100) and a **human-readable "why"** alongside it.
4. **Per-item "needs a decision from me" flags** so the home view can compute action altitude
   server-side rather than each tab re-deriving it (`sortByActionPriority` exists only client-side
   in CommitmentsTab).
5. **Trust-path on the community member view** (Surface B omits it today).

---

## 4. Reference Study — fit-for-purpose feeds

Five products that solved *purposeful* (non-engagement) feeds. For each: the problem it solves and
the one pattern worth borrowing for Karmyq, tied back to the job.

### 4.1 Linear — Triage as a shared, finite inbox

Linear's **Triage** is a team's shared inbox for new issues: a finite queue you **review, assign,
prioritize, and clear**, not an infinite stream. Teams run a *triage routine* and the queue is meant
to reach zero. ([Linear Triage docs](https://linear.app/docs/triage),
[How we built Triage Intelligence](https://linear.app/now/how-we-built-triage-intelligence))

- **Borrow**: the **"queue you can finish"** mental model. Karmyq's home feed should feel like a
  finite set of requests a member can act on or consciously pass on — not a river. An explicit
  *"you're all caught up"* end-state is on-brand here in a way it never is for social.
- **Ties to the job**: a member helps by clearing decisions, not by scrolling.

### 4.2 GitHub Notifications / PR "review requested" inbox

GitHub separates **"things assigned to / requested of you"** from general activity. The
review-requested inbox is the canonical *"what needs a decision from me"* surface, distinct from the
firehose of repository activity.

- **Borrow**: **action altitude via segmentation** — a top band of *"needs your response"* (offers
  to accept, dibs expiring, requests you can fill) above a lower band of *browseable* community
  activity. Karmyq already proved this works in `CommitmentsTab`'s "Needs Your Response" grouping;
  the redesign promotes it to the home feed.
- **Ties to the job**: connecting need with help is a *decision*; decisions go to the top.

### 4.3 Mutual Aid Hub / mutual-aid request boards

Mutual-aid networks coordinate needs and offers on **request boards**, and the field's own guidance
is that matching works best when a need is posted with **an exact time, a clear task, and a defined
commitment** so a helper can instantly see if they're available and capable.
([Mutual Aid Hub](https://www.mutualaidhub.org/),
[creating effective mutual aid networks](https://www.alwaysreadyhq.com/9626/creating-effective-mutual-aid-networks/))

- **Borrow**: **commitment-legible cards** — every request card should make the *task, time, and
  scope of commitment* legible at a glance. Karmyq's `RequestPayloadRenderer` (Surface C) already
  does this for typed requests (pickup/dropoff, duration, helpers needed) — it should be standard on
  the **one** unified card, not stranded on the unmounted legacy feed.
- **Ties to the job**: a helper can only say yes when the ask is concrete.

### 4.4 Front / Help Scout — the shared inbox with assignment & status

Support shared-inboxes give each conversation an **explicit status** (open → pending → resolved) and
an **owner**, so the team always knows who is handling what and nothing is silently dropped.

- **Borrow**: **first-class, shared status vocabulary**. Karmyq already has the states
  (`open / proposed / matched / completed / dibs_pending`) but exposes them inconsistently (Surface B
  shows them; A hides all but `open`). The unified model should make request/match status a
  **first-class, identical token** across both views.
- **Ties to the job**: trust depends on no request being silently abandoned; status makes the
  hand-off visible.

### 4.5 Marketplace request queues (TaskRabbit / Thumbtack-style)

Service marketplaces present an incoming request as a card with a clear **accept / decline / propose**
decision and the requester's reputation, optimizing for *time-to-first-response* rather than dwell.

- **Borrow**: **decision-first card economy** — minimal chrome, the requester's trust signal, and
  the primary action (Offer to Help) reachable in one tap, exactly as `BrowseFeed` does inline. Keep
  that; extend it with the commitment legibility from §4.3 and the status token from §4.4.
- **Ties to the job**: fast, confident matching beats engagement metrics.

**Anti-pattern explicitly rejected**: the **algorithmic engagement feed** (TikTok/FB) — opaque
ranking optimized for dwell time. Karmyq may *rank* (it already has `match_score`), but ranking must
be **explainable** ("2nd-degree trust · matches your service type"), never a black box optimizing
for time-on-app.

---

## 5. Design Principles

Led by the job; each principle states what it rejects.

1. **Design backward from the job, not forward from the pattern.** Every element on a feed view must
   help connect a need with help in a community of trust. If a component can't trace to that, it
   doesn't earn a place. *Rejects:* borrowing a pattern because "feeds have it."

2. **A feed is a finite, actionable queue — not an infinite stream.** Optimize for *clearing
   decisions* and a legitimate "you're caught up" end-state. *Rejects:* infinite scroll, "Load more"
   as the primary navigation, refresh-for-its-own-sake, dwell-time optimization.

3. **Action altitude: decisions you owe rise to the top.** Offers to accept, dibs expiring,
   requests you can uniquely fill come first; passive browsing and community texture sit below.
   `CommitmentsTab.sortByActionPriority` already encodes this — promote it to the home view.
   *Rejects:* chronological-only or engagement-only ordering.

4. **One request, one card.** A single canonical request-card vocabulary, used everywhere, with
   commitment legibility (task / time / scope) and an explainable trust signal. *Rejects:* three
   divergent card components for the same object.

5. **Trust is shown, not scored opaquely.** Lead with the *path* and *reason* (degree of separation,
   shared community, karma) over a bare percentage. *Rejects:* black-box relevance scores.

6. **Status is first-class and identical across views.** `open / proposed / matched / completed`
   render as the same token whether on the home feed or a community feed. *Rejects:* per-surface
   status vocabularies and hidden states.

7. **Stories and activity are texture, not altitude.** Community-activity and story items can warm
   the feed but must never outrank an open request needing a helper, and must be dismissible.
   *Rejects:* engagement content competing with actionable content.

8. **One model, two views — never a fourth surface.** The output collapses three implementations
   into one; it does not add a parallel feed. *Rejects:* solving divergence by adding another feed.

---

## 6. Unified Information Architecture

### 6.1 The model

There is **one feed model**: *a ranked, finite list of feed items a member can act on.* A **feed
item** is one of a small, shared set of card types (the union of today's three surfaces,
de-duplicated):

- **`request`** — the canonical open help request card (the union of A's inline-offer economy, C's
  `RequestPayloadRenderer` commitment legibility + Karma/trust badges, and B's status token). One
  component. Primary action: **Offer to Help** (inline `createMatch`); secondary: View Details.
- **`decision`** — *"needs a response from you"*: an offer to accept/decline, a First Dibs expiring,
  a match to mark done. Sourced from what `CommitmentsTab` renders today, surfaced *into the feed*
  at the top band.
- **`activity`** — community texture (weekly exchanges, new members, "N requests need help"). Low
  altitude, dismissible.
- **`story`** — narrative/social-proof. Lowest altitude, dismissible, capped.

All four already exist as data; the redesign **unifies their rendering and ranking**, it does not
invent new entities.

### 6.2 The two views (same model, different scope filter)

| | **Dashboard Home** | **Community Feed** |
|---|---|---|
| **Job statement** (written at top of view) | *"What needs me, across all my communities — and who can I help right now?"* | *"What's happening in **this** community, and what can I do here?"* |
| **Scope** | all the member's communities (`community_id = undefined`) | one community (`community_id = X`) |
| **Ordering** | **action altitude first**: decisions you owe → requests you can fill (ranked, explainable) → activity → story | same altitude rule, scoped; community admins also see triage/management affordances inline |
| **Top band** | `decision` items (accept offers, dibs, mark-done) | community `decision` items |
| **Body** | ranked `request` cards across communities, each tagged with its community | `request` cards for this community |
| **Texture** | `activity` + `story`, dismissible, below the fold | community `activity` + `story` |
| **End state** | "You're caught up — browse communities" | "No open requests here right now" |
| **Replaces** | `BrowseFeed` + the action-altitude role of `CommitmentsTab`/`MyRequestsTab` | community `BrowseTab` (member view); admin console stays a distinct admin region, not the feed |

### 6.3 How today's three surfaces collapse

- **Surface A (`BrowseFeed`)** → becomes the **request-card body of Dashboard Home**, keeping its
  inline-offer economy and on-duty provider filter, gaining the canonical card + status token.
- **Surface B (`BrowseTab`)** → its **member-facing list** becomes the **Community Feed** view of the
  same model; its **admin management** (triage, boost, propose-match, export, trust/cohesion panels)
  is **explicitly NOT part of the feed** — it stays an admin region/console on the community page.
  (Audit finding 2.2: B was two products in one; the redesign separates them.)
- **Surface C (`Feed/FeedItem`)** → its **card richness** (polymorphic payload, Karma badge,
  story/activity/suggestion types, dismiss signal) is the **source of the canonical card vocabulary**
  and the texture layer. The legacy `Feed.tsx` component itself is retired once its capabilities live
  in the unified model.

The single shared card vocabulary, the two scope-filtered views, and the action-altitude ordering
**are the unification.** This is one model in two views — not a fourth feed.

---

## 7. Open Questions & Sprint 85 Recommendations

### 7.1 Recommended first vertical slice

**Build Dashboard Home first.** Rationale: it's the highest-traffic surface, it's where action
altitude pays off most (a member lands and immediately sees what they owe), and it lets us prove the
canonical `request` card + `decision` band end-to-end before scoping it down to the community view
(which is mostly the same components with a `community_id` filter).

### 7.2 Suggested build sequencing (Sprint 85)

1. **Canonical `request` card component** — one component, absorbing `RequestPayloadRenderer`, the
   trust-path + Karma badges, the status token, and the inline Offer-to-Help action. Replace
   `BrowseFeed`'s card with it behind the existing dashboard first (lowest risk).
2. **Unified feed endpoint / item shape** — decide the source of truth (see 7.4) and return the
   `request | decision | activity | story` union with a server-computed altitude/priority.
3. **`decision` band on Dashboard Home** — promote `CommitmentsTab`'s "Needs Your Response" grouping
   into the home feed's top band.
4. **Community Feed view** — reuse the same components with `community_id` scope; split the admin
   console out of `BrowseTab` into its own admin region.
5. **Texture layer** (`activity` + `story`) with dismiss, capped and below the fold.
6. **Retire** the unmounted `Feed/Feed.tsx` and de-duplicate the second filter component
   (`FeedFilterPanel` vs `FilterChipRow`).

### 7.3 Proposed ADR (write at implementation time)

**ADR-066: Unified Feed Model** — *Accepted/Implemented* against real Sprint 85 code, documenting:
the one-model/two-views architecture, the canonical feed-item union, action-altitude ordering, the
chosen source-of-truth endpoint, and the explicit separation of the community admin console from the
community feed. (ADR-066 is reserved for this per the handoff.)

### 7.4 Open questions for Sprint 85 planning

1. **Source of truth for the unified feed**: extend the **Feed service** (3007) to absorb curated
   ranking, or grow `request-service`'s `/requests/curated` with a `view=home|community` param and
   add the decision/activity/story union there? (Trade-off: Feed service already owns
   dismiss/story/activity; request service already owns ranking + the live dashboard wiring.)
2. **Urgency + request_type vocabulary reconciliation**: pick one urgency scale
   (`urgent|high|medium|low` vs `…|critical`) and one type taxonomy (the 5 display chips vs the 6
   payload types) — a small migration + type change, scoped to S85.
3. **`match_score` normalization + explainability**: one scale and a human-readable "why" string.
4. **Server-side action altitude**: should `sortByActionPriority` move server-side so both views and
   mobile share it, rather than re-deriving per client?
5. **Withdraw-Offer role bug** ([`docs/IDEAS.md`](../../IDEAS.md) [2026-05-20] "other"): the helper
   can't withdraw their own proposed offer ("Only the requester can reject this match"). Out of scope
   for this research sprint; **carry to S85** since the `decision` band will surface this action
   prominently and the bug must be fixed before that ships.
6. **On-duty Community/Provider/Both filter**: how does it generalize to the cross-community home
   view (where "community" scope spans many communities)? A planning call for S85.
7. **Mobile parity**: the React Native app has a Feed screen; the unified model should be designed so
   mobile consumes the same item shape.

### 7.5 Mockups

Two standalone HTML/Tailwind mockups (throwaway; Tailwind via CDN) render the direction:

- [`mockups/dashboard-home.html`](mockups/dashboard-home.html) — the redesigned Dashboard Home: a
  `decision` top band, ranked canonical `request` cards across communities, a dismissible texture
  layer, and a "you're caught up" end-state.
- [`mockups/community-feed.html`](mockups/community-feed.html) — the same model scoped to one
  community, with the admin console shown as a separate region (not part of the feed).
- [`mockups/index.html`](mockups/index.html) — links both, with before/after framing against the
  three current surfaces.

Sample content in the mockups is drawn from the §3 inventory (real field names, real action labels,
real status vocabulary) so the direction is legible against actual payloads.
