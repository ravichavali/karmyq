# Sprint 87 — Visual Reference Research

**Date:** 2026-06-05
**Anchor:** "warm commons, calm behavior" — warmth is identity (people/stories/relationship reasons
lead, humane voice); calm is discipline (finite queues, no engagement chrome, quiet density, visible
privacy/decay). Reference feel: a well-made **neighbourhood library / thoughtful newsletter**. **Not**
a cold SaaS dashboard; **not** a loud civic-tech poster.

This doc collects concrete references, what to **borrow** and **avoid** from each, and derives the
starting palette/type/spacing the Task 8 mockups use.

---

## References (borrow / avoid)

### 1. Front Porch Forum (neighbourhood email digest)
The closest spiritual sibling — a Vermont neighbour-to-neighbour digest that is deliberately boring,
finite, and trusted.
- **Borrow:** the *digest* mental model — a finite, periodic, "here's what your neighbours need" list with
  a clear end; plain humane language; zero gamification; trust from real local identity.
- **Avoid:** its dated, unstyled visuals — we want warmth and craft, not 2005 plain-HTML.

### 2. The neighbourhood library / public-library catalogue
Physical and digital library aesthetics: calm, categorized, generous, unhurried; you browse a finite
shelf, you don't doomscroll.
- **Borrow:** quiet density (lots of items, low visual shouting), clear sectioning, serif/editorial
  headings, the feeling that the space is *stewarded* and finite.
- **Avoid:** rigid table/grid coldness; over-bureaucratic metadata (call numbers everywhere) — our
  equivalent failure is the `generic`/threshold/`trust 50` accounting the audit flagged.

### 3. Are.na (content-first knowledge tool)
Famously calm, near-chrome-free, content over UI, no vanity metrics, no algorithmic feed.
- **Borrow:** restraint — minimal chrome, generous whitespace, typography doing the work, **no engagement
  counters**; connections (blocks/channels) shown as quiet relationships, not scores.
- **Avoid:** its near-monochrome austerity — we need *warmth* (people, faces, reasons), not cool minimalism.

### 4. Editorial / "thoughtful newsletter" reading apps (Matter, Readwise Reader, Substack reader, Ghost)
Reading-first surfaces: serif body, comfortable measure, photography/portrait-led, calm.
- **Borrow:** editorial warmth — serif display for human moments, a comfortable reading measure
  (~60–72ch), portraits and names leading, an unhurried rhythm.
- **Avoid:** long-form full-bleed reading layouts for what is actually a *task* surface — we adopt the
  *warmth*, not the article layout; the help loop still needs scannable cards.

### 5. Calm task apps — Things 3 (Cultured Code), Linear's quiet end-states
How to present a **finite list of actions** without an engagement feed: clear "you're done / caught up"
states, gentle motion, quiet density.
- **Borrow:** the **finite queue + "you're all caught up"** empty state; one clear primary action per row;
  restraint in color (color = meaning, not decoration).
- **Avoid:** Linear's cool blue-grey SaaS palette and keyboard-power-user density — that is exactly the
  "cold SaaS dashboard" the anchor rejects.

### 6. Peer mutual-aid products — Buy Nothing, Olio (and Nextdoor as a cautionary tale)
Neighbour-to-neighbour giving/sharing.
- **Borrow (Buy Nothing/Olio):** the gift-economy warmth — real photos, first names, gratitude, a humane
  ask/offer rhythm; small map/locality cues.
- **Avoid (Nextdoor):** the engagement feed, notification pressure, reactive/“us-vs-them” posture, and
  ranking that rewards loudness — the audit's "38/12 notification badges + infinite feed + stay engaged"
  is the Nextdoor failure mode; reject it.

---

## Derived visual direction (what the mockups will use)

**Aesthetic in one line:** a warm, stewarded neighbourhood library — editorial warmth, quiet density,
finite queues, color used only for meaning.

### Palette (the existing Karmyq tokens — already warm-commons; reuse, don't reinvent)
| Role | Token | Hex |
|------|-------|-----|
| Surface (page) | cream | `#faf8f3` |
| Surface (raised/card) | warm white | `#fdfcf9` |
| Primary (green) | green-600 / -700 | `#2d6e28` / `#245621` |
| Primary tint | green-50 | `#f0f7f0` |
| Accent (teal — sparingly) | teal-600 | `#268882` |
| Text | brown-900 | `#5c3e30` |
| Text muted | brown-500 | `#b48455` |
| Text subtle | brown-400 | `#c19a6f` |
| Border | brown-200 / -100 | `#e4d3bc` / `#f2eade` |
| Warn / urgency | orange-500 | `#ed7620` |

**Color discipline (from the audit):** color carries *meaning*, never decoration. Green = action/agreement;
orange = urgency only; teal = sparing accent. **Retire** the off-palette dark-slate Trust Network panel
and the indigo graph toggle the audit found — one warm palette everywhere.

### Type
- **Display / human moments** (names, asks, community missions, stories): a warm **serif** (e.g.
  Source Serif / Georgia-class), italic for quotes — matches the landing founder's-note voice.
- **UI / labels / dense data:** the existing humane sans (system/Inter-class).
- **Scale (calm, few steps):** 28/22/17/15/13 px — display 28, section 22, card title 17, body 15,
  meta 13. One step between levels; resist a 9-size ramp.

### Spacing & density
- Generous page gutters; card padding ~20–24px; **one** content column at a comfortable measure
  (max ~640–720px), centered — keep the existing `max-w-2xl` discipline.
- "Quiet density": many items can share a screen, but each row shouts once (one primary action, one
  quiet signal). No badge clusters.

### Motion & chrome
- Gentle, slow fades (≤200ms); no attention-grabbing animation.
- **One** quiet notification affordance, not two count-badge bells.
- Finite queues with explicit **"you're all caught up"** end-states.

### What this is NOT
- Not a KPI dashboard (no empty metric-tile rows).
- Not an infinite engagement feed (no doomscroll, no unread-count pressure).
- Not cool/minimal SaaS (warmth required) and not loud civic poster (restraint required).
