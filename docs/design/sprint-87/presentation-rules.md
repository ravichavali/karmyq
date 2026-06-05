# Karmyq Presentation Rules — "warm commons, calm behavior"

> **Status: APPROVED (2026-06-05) — basis for Sprint 88.** The design language extracted from the
> Sprint 87 mockups (`./mockups/`), approved by the maintainer as the direction the Sprint 88
> implementation builds from. Every category below carries at least one concrete, buildable rule.

**The one-line test for any screen:** *Would this feel at home in a well-run neighbourhood library or a
thoughtful newsletter?* If it feels like a SaaS dashboard or an engagement feed, it's wrong.

---

## 1. Page shells

- **One centered column** at a comfortable measure (`--measure: 680px`; wide utility pages 920px). Never
  a full-width dashboard grid.
- **One sticky top bar**: wordmark · primary nav · a single quiet notification affordance · the person.
  Nothing else lives in the chrome.
- Every page opens with an **eyebrow → serif headline → one-line lede**, in a humane voice
  ("Good afternoon, Aisha." not "Dashboard").
- Surfaces stack: page = cream `#faf8f3`; raised cards = warm white `#fdfcf9`; recessed wells =
  `#f3eee4`. Depth comes from these three tones + a 1px warm border, not heavy shadows.

## 2. Type scale

- **Two families.** Display/human moments: **Fraunces** (warm optical serif) — headlines, the *ask*,
  community missions, story quotes (italic). UI/labels/dense data: **Hanken Grotesk** (humane sans).
  Never Inter/Roboto/system as the brand voice.
- **Few steps:** 30 (page) · 22 (serif section/ask) · 17 (card title) · 15 (body) · 13 (meta/eyebrow).
  One step between levels; no 9-size ramp.
- Eyebrows: 12px, `letter-spacing .12em`, uppercase, green-600.
- Body measure 60–72ch; line-height 1.5.

## 3. Spacing & density

- Card padding 20–24px; section rhythm ~30px; gutters ≥24px.
- **Quiet density:** many items may share a screen, but **each row shouts once** — one primary action,
  one quiet signal. No badge clusters, no stat-tile walls.
- Whitespace is structural, not decorative; let the serif breathe.

## 4. Color use (color = meaning, never decoration)

- **Green** (`#2d6e28`/`#245621`) = action, agreement, "you" (primary buttons, path badges).
- **Orange** (`#ed7620`) = **urgency only** (time-sensitive pills). Never decorative.
- **Teal** (`#268882`) = sparing accent (privacy notes).
- **Brown** = text (`#5c3e30`) / muted (`#b48455`) / borders (`#e4d3bc`).
- **One warm palette everywhere.** Banned: the dark-slate Trust Network panel and the indigo graph
  toggle from the current build. No purple-on-white, no cool greys.

## 5. Card hierarchy (the help loop's core unit)

Reading order is fixed, top to bottom:
1. **Relationship reason leads** — "Through Raj Okafor" / "Direct connection" (green path badge).
2. **The ask** — serif, plain language, human. The card's one job.
3. **What's involved** — kind · time · place as quiet pills. Human words, never DB labels like `generic`.
4. **One primary action** — "Offer to help" / "Yes, I can".
5. **Quiet match signal** — "good match", a trailing meta line. **Never a "68%" headline.**
- **Removed:** the per-person `KarmaBadge (⭐75)`. People are not scores (Decision 3).

## 6. Status & language

- Speak like a neighbour, not a system: "Waiting on your reply", "That's everyone for now",
  "new here", "close by".
- **No engagement language.** Banned: "stay engaged", "grow your score", unread-count pressure.
- Empty/terminal states are warm and final: "You're caught up. We'll let you know when a neighbour
  needs you — quietly."
- Governance reads in human terms ("Neighbours others trust to help steward"), not "trust 50 · quorum 3".

## 7. Score treatment

- **No per-person reputation/trust scores** on any surface (no `KarmaBadge`).
- **Match-relevance % is de-emphasized** to a soft qualitative signal ("good match", "close by"); never
  the most prominent element on a card.
- Karma is **private by default**; if surfaced to its owner, it's framed as a *contribution story*
  (what you did for neighbours), not a meter to maximise.
- Governance shows **reasons and relationships**, not raw thresholds/quorum numbers.

## 8. Privacy & decay affordances (make the manifesto visible)

- **"Private by default"** stated plainly on the profile, with a shield, in teal.
- **"Designed to forget" is a visible member surface**, not just ranking math: a contribution thread
  whose older entries **literally fade in opacity**; trust connections shown as "close / warm / fading".
- Decay is reassuring, not punitive: "Old interactions fade automatically — keep a few that mattered."
- Visibility/consent is shown **at the point of sharing** (who can see this ask), never buried.

## 9. Accessibility

- Color never the sole signal: urgency = orange pill **+ the word** "Time-sensitive"; fading = opacity
  **+ a "fading" label**. (The opacity-fade thread must keep a text cue for low-vision users.)
- Contrast: brown-900 on cream and white-on-green-600 meet WCAG AA for body text; never put text below
  brown-400 on cream for anything essential.
- All actions are real `<button>`/`<a>` with discernible names; the single notification control has an
  accessible label. Focus states use the green focus ring (existing `.input` pattern).
- Tap targets ≥ 40px; the mobile FAB must **never overlap** a card's primary action (current bug).
- Honor `prefers-reduced-motion`: fades ≤200ms and removable.

## 10. Responsive

- One breakpoint at **768px** (`md:`), matching the existing app.
- Below `md`: single column, bottom tab bar, decision-band titles **wrap (never truncate to "…")**.
- At/above `md`: two-column detail layouts (request-card legend, profile, governance) collapse to one
  column below `md`.
- Content max-width holds on large screens — the column never sprawls into a dashboard.

## 11. Mobile translation

- The phone is the primary neighbourly device; the web model must translate 1:1, not be an afterthought.
- Decision band, finite queue, and the "caught up" end-state carry to mobile unchanged.
- Bottom nav = the three real jobs (Browse · Helping · Asks). The single quiet notification stays in the
  header dot — no count badges on mobile either.
- FAB sits clear of card actions (bottom offset above the last card's button); the type picker modal is
  full-width, one-tap, emoji-led (keep the current warm wizard).

---

### Anti-patterns (auto-fail a design review)

Infinite/engagement feed · count-badge clusters · "stay engaged"/"grow your score" copy · per-person
score badges · a leading match % · empty KPI stat-tile rows · raw `generic`/`trust 50`/`quorum 3` labels
· UUIDs or stacked "— Group A — Group B" names in the UI · off-palette dark/indigo panels · em-dash
mojibake.
