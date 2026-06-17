# Sprint 104 — UI Facelift Current-State Audit

**Date:** 2026-06-17
**Method:** Source-grounded audit of the live frontend (`apps/frontend/src`) on branch
`feature/sprint-104-ui-facelift-research`, cross-referenced with the Sprint 87 screenshot audit
(`docs/design/sprint-87/`). Every finding cites a file:line so S105 can act without re-deriving.
**Lens (unchanged from S87):** "warm commons, calm behavior" measured against the five founding
promises — but where S87 asked *"does the surface make the promise legible?"*, S104 asks the
**visual-system** question: *"do the four surface clusters speak one coherent design language?"*

> **Demo screenshots:** the plan marks demo screenshots optional. This audit is grounded in the
> **source of truth** (the JSX + token system) rather than pixels, which is more durable for scoping
> S105 token/component work. S87's screenshots in `docs/design/sprint-87/screenshots/` remain a valid
> visual reference for surfaces that have not changed since (Trust Graph, governance, request wizard).

---

## Baseline since Sprint 87 (what changed — so this sprint extends, not restarts)

S87 audited a pre-redesign app. The 88–92 arc then shipped a real warm-commons design system. The
S104 audit must measure against *today*, so here is the delta:

| Since S87 | What shipped | Where it landed |
|-----------|--------------|-----------------|
| **S88** — warm shell + feed reskin | `.kq-*` shell (`karmyq-shell.css`), Fraunces + Hanken type, relationship-led `RequestCard`, `TrustPathBadge` promoted to lead, `KarmaBadge` removed from cards, match-% demoted to a soft `kq-quiet-meta` signal, finite "caught up" states, **one** quiet `NotificationBell` (the two-bells problem is fixed) | Dashboard Home (`dashboard.tsx`), `Feed/*`, `Layout.tsx` chrome |
| **S89 / ADR-068** — warm community page | Four-tab IA (`Home · People · How we're connected · Stewardship` + group Activities), `CommunityHero`, `CommunityPulse`, Dunbar cap bar, member feed reachable on Home | `communities/[id].tsx`, `community/*` |
| **S90 / ADR-070** — visible decay + profile header | `.kq-decay-*` opacity/desaturation ramp on bonds; warm `kq-hero` profile header | `karmyq-shell.css`, `profile.tsx` header |
| **S101** — request detail action surface | Server-derived `viewer_relation`; lifecycle-true `finiteStateCopy`; warm `kq-card` detail | `requests/[id].tsx` |
| **S103** — centralized action copy | `lib/requestActionCopy.ts` (offer/service labels) | request detail + feed |

**The net result the S104 audit must confront:** the design system is *real and good where it
landed* — but it **did not land everywhere**. Several high-traffic surfaces are pre-S88 fossils
running the old shadow-based, off-palette, match-%-leading styling. The dominant S104 problem is no
longer "the app is cold" (S87's finding); it is **"the app is half-converted, and the seam shows."**

### The single most important signal: shell adoption is uneven

`.kq-*` shell-class usage per surface (a proxy for "is this on the warm design system?"):

| Surface | File | `kq-*` classes | On the warm shell? |
|---------|------|:--------------:|--------------------|
| Dashboard / Home | `pages/dashboard.tsx` | 4 (+ `UnifiedFeed`/`RequestCard`) | ✅ Yes |
| Community page | `pages/communities/[id].tsx` | 6 (+ `CommunityHero`/`Pulse`) | ✅ Yes (reference) |
| Request **detail** | `pages/requests/[id].tsx` | 3 | ✅ Mostly |
| Profile | `pages/profile.tsx` | 4 (header only) | 🟧 Header only |
| Global chrome | `components/Layout.tsx` | topbar/wordmark/topnav | ✅ Mostly |
| **Request feed** | `pages/requests/index.tsx` | **0** | 🟥 No — pre-S88 fossil |
| **Offers list** | `pages/offers/index.tsx` | **0** | 🟥 No — pre-S88 fossil |
| **Match detail** | `pages/matches/[id].tsx` | **0** | 🟥 No — pre-S88 fossil |
| Public landing | `pages/index.tsx` | **0** | 🟥 No — generic marketing |

This table is the spine of the whole sprint: **the redesign is ~60% adopted.** S105's job is the
remaining 40% plus a token-level tightening of the parts that did convert.

---

## The shared scorecard (extends S87's promise rubric)

Each cluster scored **1–5** on seven design-system dimensions (1 = absent/contradicted, 3 = present
but inconsistent, 5 = coherent & warm). This is a **visual-system** scorecard; it complements (does
not replace) S87's five-promise rubric in `docs/design/sprint-87/scorecard.md`.

| Dimension | What it measures |
|-----------|------------------|
| **Visual hierarchy** | Does the most important thing (relationship → ask → action) lead? |
| **Spacing rhythm** | Consistent gutters, padding, content width (reading column) |
| **Density** | "Quiet density" — many items, each shouts once; no badge clusters |
| **Cross-surface consistency** | Same card/elevation/radius/type language as the rest of the app |
| **Brand / warmth fit** | Warm token palette + Fraunces/Hanken; no off-palette raw Tailwind |
| **Accessibility** | Contrast, focus states, not color-only signalling, semantic structure |
| **Mobile readiness** | Reading column, tap targets, no FAB/CTA collisions |

| Cluster | Hierarchy | Spacing | Density | Consistency | Brand/warmth | A11y | Mobile | **Avg** |
|---------|:---------:|:-------:|:-------:|:-----------:|:------------:|:----:|:------:|:-------:|
| **Dashboard / Home** | 4 | 4 | 4 | 4 | 5 | 3 | 4 | **4.0** |
| **Request feed + detail** | 2 | 2 | 3 | 1 | 2 | 3 | 2 | **2.1** |
| **Community page** | 5 | 5 | 4 | 5 | 5 | 3 | 4 | **4.4** |
| **Profile + global chrome** | 3 | 3 | 3 | 2 | 3 | 3 | 3 | **2.9** |

**Reading the scores:** Community page is the high-water mark; Dashboard Home is close behind. The
**Request feed cluster is the worst surface in the product** (avg 2.1) and is also one of the most
trafficked — it is the headline S105 target. Profile/chrome is a "warm head on an old body."
Accessibility is a flat 3 everywhere: nothing is broken, but nothing has been audited (color-only
status signalling and unverified contrast recur across all clusters).

---

## Cluster 1 — Dashboard / Home (`pages/dashboard.tsx`) — avg 4.0

The proof point of the warm redesign, and it mostly delivers.

**What's right (preserve):**
- Serif, warm, relationship-led header: `kq-eyebrow`/`kq-headline`/`kq-lede` with humane copy
  ("Good to see you, {name}." / "A calm queue of decisions and asks, led by the relationships that
  make help possible.") — `dashboard.tsx:215-219`.
- Renders `UnifiedFeed` → the warm `RequestCard`, which leads with `TrustPathBadge`, demotes the
  match score to a soft qualitative `kq-quiet-meta` line via `describeMatchSignal()`
  (`Feed/RequestCard.tsx:69,193`), and has finite "caught up" states. This is the S88 taxonomy,
  correctly implemented.
- Tab shell (`Browse · Helping · Asks`) + `SpeedDialFab`; FAB is `md:bottom-8` / `bottom-28` mobile,
  so the S87 FAB-over-CTA collision is resolved (`globals.css:99-103`).

**Drift / gaps:**
- **The community-selector row is off-shell chrome** — a raw `bg-surface-raised border-b border-border`
  bar with a bare `<select>` and an `bg-amber-100 text-amber-700` "On duty" pill
  (`dashboard.tsx:153-170`). The amber is off the warm palette (should be `warn`/`success` tokens),
  and a system `<select>` is the least warm control in an otherwise crafted surface.
- **Empty-Home-for-established-users hierarchy gap** (carried from the handoff): a user with no
  proposed matches lands on a structurally empty Home; the finite-queue "caught up" state is correct
  but the surface has no secondary altitude (recent helps, communities needing a hand) to fill the
  calm. This is a *hierarchy/IA* gap S105 should design for, not just a styling one.
- **Zero-community empty state** (`dashboard.tsx:186-200`) uses raw `bg-primary` button markup and an
  emoji rather than the `kq-finite-state` component the community page uses for the same job — a
  small consistency miss.

**Scores:** Hierarchy 4 · Spacing 4 · Density 4 · Consistency 4 · Brand 5 · A11y 3 · Mobile 4.

---

## Cluster 2 — Request feed + detail (`pages/requests/index.tsx`, `pages/requests/[id].tsx`) — avg 2.1

A split-personality cluster: the **detail** page is warm (S101), the **feed** page is a pre-S88
fossil. They look like two different products.

### Request **detail** (`requests/[id].tsx`) — the good half

- On the shell: `kq-card`, `kq-pill`, `kq-quiet-meta`, Fraunces title, server-derived one-true-next-
  step copy with lifecycle-true finite states (`requests/[id].tsx:157-233`).
- **Minor drift:** the title inlines `style={{ fontFamily: "'Fraunces'…" }}` at `26px`
  (`requests/[id].tsx:169`) instead of a shell class — there is a `kq-headline` (30px) and a
  `kq-hero-name` (32px) but no mid-size serif token, so detail pages hand-roll one. Error text uses
  `text-red-600` (`:231`) instead of the `text-error` token. Urgency is rendered as a raw lowercase
  string (`{detail.urgency}`, `:165`) rather than humanized.

### Request **feed** (`requests/index.tsx`) — the worst surface in the app

This page never received the S88 redesign. It contradicts ADR-053 (feed philosophy) and the S87
taxonomy that the dashboard feed already fixed:

- **Match % leads every card again.** A bold, color-coded `{matchScore}% Match` pill sits top-right
  of every card (`requests/index.tsx:285-294`) — the exact pattern S87 flagged and S88 demoted on the
  dashboard. The same request shown in `dashboard.tsx` says "good match" quietly; shown here it shouts
  "68% Match". **Two card systems for one data model.**
- **Off-palette raw Tailwind colors:** urgency uses `text-red-600 bg-red-100` / `text-yellow-600
  bg-yellow-100` (`:100-107`); the score slider track is `bg-gray-200` (`:198`); "Smart Filtering"
  badge is `bg-success-light text-green-800` (`:162`). None speak the warm token vocabulary
  (`warn`/`primary`/`accent`).
- **Accounting chrome the redesign was built to remove:** a "Show Curated Feed (Best Matches)"
  checkbox, a "Smart Filtering" badge, and a "Minimum Match Score: 30%" range slider
  (`:143-211`) — the SaaS/engineering-altitude controls that contradict "warm commons, calm."
- **Wrong reading column:** `max-w-7xl` full-width grid (`:128`) vs the `max-w-2xl` `kq-page`
  discipline everywhere warm. The feed is the widest, coldest surface in the app.
- **Raw status passthrough:** `{request.urgency}` / `{request.status}` rendered as lowercase DB
  strings (`:319-324`); category shown via `replace(/_/g,' ')` (`:348`) rather than the humanized
  type labels the detail page uses.
- **Functional redundancy:** this page duplicates the feed that `UnifiedFeed` already serves warmly on
  the dashboard, with worse UX. S105 should decide whether it is **reskinned to reuse the warm feed
  components** or **retired/redirected** — it should not survive as a second, colder feed.

**Scores:** Hierarchy 2 · Spacing 2 · Density 3 · Consistency 1 · Brand 2 · A11y 3 · Mobile 2.
(`offers/index.tsx` and `matches/[id].tsx` share the feed's fossil styling — `max-w-7xl`,
`shadow-sm/md` cards, `text-2xl font-bold` headings — and ride along in this cluster's S105 scope.)

---

## Cluster 3 — Community page (`pages/communities/[id].tsx`) — avg 4.4

The high-water mark of the redesign and the reference implementation for everything else (S89 /
ADR-068). S105 should treat this surface as the **style guide**, not a thing to change.

**What's right (preserve and propagate):**
- Full warm shell: `kq-page` reading column, `CommunityHero` (serif `kq-hero-name`, italic
  `kq-hero-mission`, Dunbar `kq-capbar` "capped at 150, on purpose", member `kq-faces`),
  `CommunityPulse` ("this week in the neighbourhood"), and a `kq-tabbar`/`kq-tab` four-tab IA
  (`communities/[id].tsx:160-207`).
- Member-first altitude: Home is the default for every role; admin tooling lives one altitude down in
  Stewardship (ADR-068). Visitors/pending users get a warm `kq-finite-state` invitation rather than a
  broken 403 feed (`:195-205`).
- Tab bar has `aria-label="Tabs"` and the legacy-alias resolver keeps deep links alive.

**Drift / gaps (minor):**
- **Off-token reds:** the pending-items notification dot is `bg-red-500` (`:178`) and the error state
  is `text-red-500` (`:137`) — raw Tailwind reds rather than `error`/`warn` tokens. The color-only dot
  (no text/aria) is also the cluster's one a11y soft-spot.
- **Density on `Stewardship`** — composes governance + split + fusion + steward-requests + settings +
  providers under one sub-nav; it is necessarily the densest tab and should be audited in S105 to keep
  "quiet density" (outside the S104 cluster-styling scope, noted for completeness).

**Scores:** Hierarchy 5 · Spacing 5 · Density 4 · Consistency 5 · Brand 5 · A11y 3 · Mobile 4.

---

## Cluster 4 — Profile + global chrome (`pages/profile.tsx`, `components/Layout.tsx`) — avg 2.9

A "warm head on an old body": the S90 header is warm, the page beneath it is pre-shell.

### Profile (`profile.tsx`)

- **Warm header (S90):** `kq-hero` / `kq-hero-name` / `kq-hero-mission` ("Your skills, your
  communities, and the relationships you're tending.") — `profile.tsx:479-485`. Good.
- **Cold body:** every section below the hero is a pre-shell `bg-surface-raised rounded-lg shadow-md
  p-6` card (`:533,629,752,845,993`) — shadow-based elevation and a `rounded-lg`/`rounded-xl` mix, not
  the borderless `.kq-card`. Buttons use raw grays: `disabled:bg-gray-400`, `bg-gray-300
  hover:bg-gray-400` (`:592,603,892`); the karma toggle is `bg-gray-200` (`:645`); error is
  `bg-red-100 border-red-400 text-red-700` (`:489`); community progress bars use `bg-gray-200`
  (`:795`).
- **Wider reading column:** `container mx-auto … max-w-4xl` (`:477`) — a third distinct content width
  (vs `max-w-2xl` warm pages and `max-w-7xl` fossils).
- **S87 carry-over still present:** "Trust Evolution Settings" remains a technical per-community config
  block (`:942`). The copy is gentler than S87's ("The goal is accuracy — not a particular
  direction") but it is still config/jargon altitude on a member surface.
- **No contribution story / no visible-forgetting on the member's own profile** — S90 shipped
  `.kq-decay-*` for *bonds*, but the profile still frames reputation as a karma toggle, not "what
  you've helped with" or "what's fading." (S87 promise 3 / 4 gap, partially open.)

### Global chrome (`Layout.tsx`)

- **Warm topbar:** `kq-topbar` (sticky, blur), `kq-wordmark` with the seed mark, `kq-topnav` links,
  and **one** quiet `NotificationBell` (`Layout.tsx:113-158`) — the S87 two-bells problem is fixed.
- **Off-shell title bar:** when a page passes `title=`, the chrome renders `text-3xl font-bold
  text-text` (`:227`) — a sans, bold page title that competes with the serif `kq-headline` /
  `kq-hero-name` system. `requests/index` and `matches/[id]` reach the user through this bar, so the
  *same app* shows serif headlines on warm pages and bold-sans titles on fossils.
- **Off-token availability toggle:** the on-duty control uses `bg-green-50 border-green-200
  text-green-700` / `bg-green-500` / `bg-gray-300` (`:164-169`) and inline `rgb(34 197 94)` (`:59`) —
  raw greens rather than `primary`/`success`/`accent` tokens.
- **Width:** the topbar uses `container mx-auto px-4` while content uses `kq-page` (`max-w-2xl`) — the
  header and body align to different grids.

**Scores:** Hierarchy 3 · Spacing 3 · Density 3 · Consistency 2 · Brand 3 · A11y 3 · Mobile 3.

---

## Cross-cluster consistency findings (where the four clusters disagree)

The defining S104 problem. Each row is a design-system axis where the warm surfaces and the fossils
have diverged — S105's token/component work closes these.

| Axis | Warm surfaces (S88+) | Fossils / drift | Where it shows |
|------|----------------------|-----------------|----------------|
| **Reading column** | `kq-page` = `max-w-2xl` | `max-w-7xl` (feed/offers), `max-w-4xl` (profile), `container` (chrome topbar, `index`) | **4 different content widths** in one app |
| **Card system** | `.kq-card` — borderless, `rounded-lg`, `hover:border-primary-medium`, **no shadow** | `.card` (`rounded-xl shadow-sm`) + `bg-surface-raised rounded-lg shadow-md` (profile, feed, offers) | Elevation language split: **border-hover vs drop-shadow** |
| **Corner radius** | `rounded-lg` (8px) on `.kq-card` | `rounded-xl` (12px) on `.card`/`.feed-card`; `rounded` (4px) on profile buttons | 3 radii for "a card" |
| **Match signal** | Soft qualitative `kq-quiet-meta` ("good match") via `describeMatchSignal()` | Bold color-coded `{matchScore}% Match` pill (`requests/index:285`) | Direct contradiction of ADR-053 + S88 taxonomy |
| **Display type** | Fraunces serif (`kq-headline` 30 / `kq-hero-name` 32; detail inlines 26) | Raw sans `text-3xl font-bold` (Layout title), `text-2xl` (match detail), `text-6xl` (`index`) | Serif on warm, bold-sans on fossils; **no mid-size serif token** |
| **Color palette** | Warm semantic tokens (`primary`/`accent`/`warn`/`success`/`error`) | Raw Tailwind: `red-600`, `yellow-100`, `gray-200/300/400`, `green-50/500`, `blue-50/700` (`status-badge--matched`), `amber-100` (`dashboard` on-duty pill) | Off-palette colors in feed, profile, chrome, status badges, dots |
| **Status / urgency** | Humanized lifecycle copy (`finiteStateCopy`, `STATUS_LABELS`, type labels) | Raw lowercase DB strings (`{request.status}`, `{request.urgency}`) | Feed/offers leak DB values; warm surfaces speak English |
| **Empty states** | `kq-finite-state` warm "caught up" panel | Ad-hoc emoji + raw button (`dashboard` zero-community), `EmptyState` component (feed) | 3 different empty-state treatments |

### The drift in one sentence

> The warm-commons design system is **real, good, and ~60% adopted**; the remaining surfaces are
> pre-S88 fossils that re-introduce the exact patterns S87 flagged (match-% lead, off-palette color,
> SaaS chrome, wide cold grids). The facelift is not a *new* aesthetic — it is **finishing the one we
> already chose** and hardening it into tokens so it cannot drift again.

---

## What this means for the design directions (Task 4–6 input)

1. **The direction is "complete the conversion," not "reinvent."** The community page already proves
   the target aesthetic. The job is propagation + token hardening, with a defensible question of *how
   far* to evolve the warm system while we are in there (subtle, moderate, or expressive — see
   `visual-research.md`).
2. **Tokenize the drift axes.** Every row in the cross-cluster table is a missing or under-used token:
   a single content-width token, one card primitive (border-vs-shadow decided once), a mid-size serif
   heading token, status/urgency mapped to semantic colors, a `kq-finite-state` everywhere.
3. **The Request feed is the headline target** (worst score, high traffic) — reskin onto the warm feed
   components or retire it in favour of the dashboard `UnifiedFeed`.
4. **Accessibility is a flat 3 everywhere** — S105 should fold a contrast + focus + not-color-only
   pass into the token work, since touching every surface is the cheapest time to do it.
5. **Anything proposed must survive per-community re-skinning** — directions are expressed as deltas to
   the CSS-variable tokens (`globals.css` `:root`), which `ThemeProvider` overrides per community.
