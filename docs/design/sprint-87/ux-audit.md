# Sprint 87 — Screenshot UX Audit

**Date:** 2026-06-05
**Method:** Playwright MCP against the live demo (`https://karmyq.com`), logged in as a real **member**
(`aisha.white6964@test.karmyq.com` — 2 asks, 14 responder matches, 4 completed helps, 11 communities),
**after** the Task 4 data cleanup (match-spam removed, all communities ≤150). Screenshots in
`./screenshots/`.

**Lens:** "warm commons, calm behavior" + the five founding promises. For each surface: what violates
"one screen, one job", where **accounting outranks meaning**, where **privacy/forgetting is invisible**,
and raw-styling/technical-language spots. Promise tags map to `scorecard.md` rows:
**[sovereignty] [help-loop] [privacy] [meaning] [trust]**.

---

## Cross-cutting findings (every authenticated surface)

- **Loud engagement chrome in the top nav** — two separate notification bells with large count badges
  (`38` red, `12` orange). Two bells is confusing; big unread counts are the exact "stay engaged"
  posture calm is meant to remove. **[meaning]** — `screenshots/dashboard-home.png`
- **Match-relevance % is the most prominent number on every request card** (`58%`, `68%` top-right,
  e.g. "68% · Can provide general help"). The taxonomy rule is to *de-emphasize* the %; today it leads.
  **[meaning] [help-loop]** — `screenshots/request-card-detail.png`
- **Per-person `KarmaBadge` (`⭐ 75`) renders on cards** next to the trust badge. Decision 3 removes
  per-person scores; confirmed present (folds into the S88 card redesign). **[meaning] [trust]**
- **`TrustPathBadge` is present and good** ("Fellow member via Raj Okafor", "Direct connection") — but
  it sits *below/after* the score, not as the lead. The relationship reason should outrank the %.
  **[trust] [help-loop]**
- **Em-dash mojibake in community names** — split communities render "Portland Tool Library & Share
  **â–®â–®** Group B **â–®â–®** Group A" on membership chips, the communities list, and the profile, while the
  dashboard feed renders the same "—" correctly. A component-specific encoding bug (data is fine).
  **[sovereignty]** — `screenshots/communities-list.png`, `screenshots/profile-trust.png`
- **Technical payload label `generic`** shows as a card pill (the `category`/`payload_type` seam,
  ADR-067). Reads like a database value, not human language. **[help-loop]**

---

## Dashboard Home (`view=home`) — `screenshots/dashboard-home.png` (+ `-full.png`, `mobile-feed.png`)

- **"Needs your response" decision band is the right idea** — relationship-led Accept/Decline cards
  ("Dog walking help while I recover — From Sofia Davis · PDX Rides Collective"). Keep this. **[help-loop]**
- **Below the band, the feed is an endless single column** — the full-page capture is a metres-long
  scroll of request cards with no finite-queue boundary, no "you're caught up" state. This is the
  central **calm-behavior** violation: an infinite engagement feed, not a finite neighbourly queue.
  **[help-loop]** — `screenshots/dashboard-home-full.png`
- **Card hierarchy is inverted**: person name + match% lead; the actual *ask* (title) is the third line.
  Warm-commons wants relationship + task to lead, score to recede. **[help-loop] [meaning]**
- **Mobile** (`mobile-feed.png`): decision-band titles truncate hard ("Need to borrow a pr…"); the FAB
  (`+`) **overlaps the card's "Offer to Help" CTA** — a tap-target collision. **[help-loop]**

## Request Wizard — `screenshots/request-wizard.png`

- **Warmest surface in the product.** "What kind of help do you need?" with friendly emoji type cards
  (General 🤝 / Ride 🚗 / Service 🔧 / Event 🎉 / Borrow 📦 / Dog Walking 🐕). Humane voice, one screen
  one job. **[help-loop]** ✅
- Minor: "Dog Walking" as a top-level type sits oddly beside the generic "General/Service" — taxonomy
  altitude is uneven (one very specific, others broad). **[help-loop]**

## Community Home (member view) — `screenshots/community-home.png`

- **Warm header done right**: mission line ("Berkeley residents looking out for each other — groceries,
  rides, skills"), creator, and a **`115 / 150 members` progress bar** that makes the Dunbar cap legible
  (and now honored post-cleanup). **[sovereignty]** ✅
- **SaaS-dashboard stat row undercuts it**: four metric tiles (Members / Active Requests / Total
  Exchanges / This Week) where **three are empty dashes**. Accounting chrome that's also broken/unwired —
  meaning ("what's happening here, who needs what") is nowhere; empty KPIs are. **[meaning] [sovereignty]**
- Mission tagline is duplicated (header + "About this Community"). Minor redundancy.
- Tabs Overview / People / Trust Graph / Governance are a reasonable member-altitude split.

## Profile / Reputation — `screenshots/profile-trust.png`

- **"stay engaged" language, verbatim** — the Karma & Reputation block reads "…helps you understand your
  activity patterns and **stay engaged**." This is the engagement-chrome violation the spec named.
  **[meaning]**
- **Karma is private-by-default (good privacy posture)** but framed around *tracking/score display*
  ("Enable Karma Display"), not contribution meaning. There is **no member-facing contribution story**
  (what you helped with, for whom) — just a toggle to show a number. **[meaning] [privacy]**
- **Privacy/forgetting is invisible** — nothing on the member's own profile shows that trust/karma
  *fades*, what's decaying, or what's about to be forgotten. The "designed to forget" promise lives only
  in ranking math (and the public landing page), not the member surface. **[privacy]**
- **Off-palette dark slate "Your Trust Network" panel** — a dark graph box dropped into the warm cream
  page; jarring, reads like a different product. **[trust]**
- **Trust Evolution Settings** is a long, technical per-community on/off toggle list ("Trust evolution",
  "Evolution Off") — config/jargon altitude, not member language. **[trust]**
- Mojibake fission names recur on the "My Communities" cards. **[sovereignty]**

## Governance — `screenshots/governance.png`

- **Most "accounting outranks meaning" surface.** Raw numbers everywhere: a "Constrained" jargon badge,
  "Community avg trust: **10.3** / threshold: **50**", "small-collective · quorum 3", and member rows
  reading "trust 50 · 195 karma" with [Nominate]. **[meaning] [sovereignty]**
- No human framing of *what governance is for*, *why* a member would nominate, or *what changes* — only
  thresholds and scores. A member can't tell what this screen is asking of them. **[sovereignty]**

## Trust Graph — `screenshots/trust-graph.png`

- **Genuine relationship visualization** (radial HEB graph; "Community / My Network" toggle; warm copy
  "Every member, grouped by how closely they connect. Amber lines are your connections"). Good for the
  local-trust promise. **[trust]** ✅
- **But it's an academic node-link diagram** — 115 names crammed around an arc, high cognitive load, not
  "quiet density." A member learns little actionable. **[trust]**
- The "Community" toggle is **indigo/violet**, off the warm-green palette. **[trust]**

## Fission / Fusion — (admin-gated; documented from artifacts)

- The dedicated split/merge flow is **admin-only**; as a member it wasn't directly reachable, so it is
  audited indirectly from its **output**. Fission has clearly run and the results are poor:
  - **Cumulative, confusing names** — "Portland Tool Library & Share — Group B — Group A" (split twice,
    suffixes stack), "Northeast PDX Community Circle — Group A". A member can't tell these apart or tell
    which is "theirs". **[sovereignty]**
  - **Em-dash mojibake** on those names in chips/lists (above). **[sovereignty]**
- The S88/S89 mockup must show fission/fusion as **staged consent cards with human names and a community
  *picker*** (not raw UUIDs / cumulative suffixes), per the spec.

---

## What's already right (preserve in the redesign)

- Decision band ("Needs your response") as the relationship-led top of the help loop.
- Request Wizard's warm, emoji-led type picker and humane voice.
- Community header mission line + `x / 150` Dunbar progress bar.
- `TrustPathBadge` ("via X" / "Direct connection") — just needs to be promoted to the lead.
- Karma private-by-default.
- Trust Graph's warm explanatory copy.

## Top redesign targets for Sprint 88 (feeds the mockups + scorecard)

1. **Finite, relationship-led help loop** — kill the infinite feed; lead the card with the relationship
   reason + the ask; demote match% to a quiet signal; remove the per-person `KarmaBadge`.
2. **Calm the chrome** — one quiet notification affordance, not two big count badges.
3. **Meaning over accounting** — replace empty community KPI tiles and raw governance thresholds with
   human framing (who needs what; what this asks of you).
4. **Make forgetting visible & humane on the profile** — a member-facing "what's fading" surface; drop
   "stay engaged".
5. **Fix product-truth bugs** — em-dash mojibake; cumulative fission names; mobile FAB/CTA overlap.
6. **One warm palette** — retire the dark Trust Network panel and the indigo graph toggle.
