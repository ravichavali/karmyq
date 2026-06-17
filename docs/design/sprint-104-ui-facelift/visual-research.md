# Sprint 104 — Reference & Visual Research

**Date:** 2026-06-17
**Anchor (unchanged):** "warm commons, calm behavior" — a **stewarded neighbourhood library**, not a
SaaS dashboard and not a social engagement feed. Warmth is identity (people, stories, relationship
reasons lead; humane voice); calm is discipline (finite queues, no engagement chrome, quiet density,
visible privacy/decay).
**Method:** Carries forward `docs/design/sprint-87/visual-research.md` references (still valid — the
brand anchor has not changed) and adds the S104-specific question the audit surfaced: not *"what
aesthetic?"* (chosen and shipped) but *"how far do we evolve the warm system while we finish
adopting it everywhere?"* Generated with the `frontend-design` skill, fed the existing token
vocabulary + the four-cluster audit as hard constraints.

---

## What's locked (do not re-litigate)

The S87→S92 arc already chose and shipped the aesthetic; the maintainer approved it
(`sprint-88-recommendation.md` §5). These are **fixed inputs**, not open questions:

- **Palette family:** earthy green primary (`#2d6e28`), teal accent (`#268882`), cream surfaces
  (`#faf8f3` / `#fdfcf9`), brown text (`#5c3e30`), orange warn (`#ed7620`). Defined as RGB-triplet
  CSS variables in `globals.css :root`, re-skinnable per community via `ThemeProvider`.
- **Type pairing:** **Fraunces** (serif display — human moments, names, asks, missions) + **Hanken
  Grotesk** (body/UI). Already loaded in `globals.css`.
- **Color discipline:** color carries *meaning*, never decoration. Green = action/agreement; orange =
  urgency only; teal = sparing accent.
- **Behavior:** finite queues, "you're all caught up" end-states, one quiet notification, relationship
  reason leads the card, match-% is a soft qualitative whisper.

S104 research is therefore **not** a palette/type search. It is a study of **typographic scale,
spacing rhythm, elevation language, texture, and density** — the levers that decide how *finished* and
how *characterful* the warm system feels once it's everywhere.

---

## References (borrow / avoid) — S104 lens

The S87 reference set (Front Porch Forum, the public-library catalogue, Are.na, editorial reading
apps, Things 3 / Linear end-states, Buy Nothing / Olio, Nextdoor-as-warning) still defines the spirit.
S104 re-reads them for the **specific design-system decisions** the cross-cluster drift forces:

### 1. Public-library catalogue / archive sites → **elevation & density**
Calm, categorized, generous; you browse a finite stewarded shelf. Modern library/archive interfaces
(e.g. well-made OPAC redesigns, museum collection sites) lean on **hairline borders and generous
whitespace** for separation, **not drop shadows**.
- **Borrow:** the borderless, shadow-free card the `.kq-card` already uses (`hover:border-primary-
  medium`). This resolves the audit's elevation split — **decide once: warm = border, not shadow**, and
  retire every `shadow-sm/md` fossil card.
- **Avoid:** rigid table coldness; metadata clutter (our equivalent is the `generic`/`trust 50`
  accounting the S87 audit flagged).

### 2. Editorial / "thoughtful newsletter" reading apps → **type scale & reading column**
Matter, Readwise Reader, Ghost, Substack reader: serif display, one comfortable measure (~60–72ch),
unhurried rhythm.
- **Borrow:** a **single content-width token** at a reading measure. The audit found four widths
  (`max-w-2xl` / `4xl` / `7xl` / `container`); editorial discipline says pick one (`max-w-2xl`
  reading column) and let dense admin surfaces opt into a wider variant explicitly.
- **Borrow:** a **mid-size serif heading token** — the audit found request detail hand-rolling a 26px
  Fraunces inline because the scale jumps 30 → nothing → body. Editorial ramps are smooth.

### 3. Are.na / archival minimalism → **restraint as the ceiling on "expressive"**
Near-chrome-free, content over UI, no vanity metrics.
- **Borrow:** restraint is the guardrail. Whatever direction we pick, the "expressive" ceiling is set
  by Are.na's discipline — texture and ornament earn their place or they're cut.
- **Avoid:** its cool monochrome austerity — we need *warmth* (Fraunces, cream, faces), not minimal
  cool.

### 4. Things 3 / calm task apps → **finite-state & micro-motion**
- **Borrow:** the `kq-finite-state` "you're all caught up" panel everywhere an empty state exists
  (the audit found three different empty-state treatments); gentle ≤220ms fades (already the
  `.kq-decay` transition timing) as the motion ceiling.
- **Avoid:** keyboard-power-user density and cool blue-grey — the "cold SaaS" the anchor rejects.

### 5. Risograph / letterpress / field-guide print → **texture (the one genuinely new lever)**
The brand's "neighbourhood library" metaphor has a print cousin: riso/letterpress zines, field guides,
seed catalogues — warm paper stock, a single spot ink, subtle grain, generous margins.
- **Borrow (sparingly):** the existing `body` already has a two-stop radial-gradient paper wash
  (`globals.css:52-55`). A **subtle grain/noise texture** and **a hand-drawn seed/leaf motif** (the
  wordmark already uses `karmyq-mark.svg`) are the one place the warm system could gain *character*
  without breaking calm.
- **Avoid:** heavy texture, multiple inks, or anything that reads as "decoration" — it must whisper.

---

## Derived aesthetic principles (anchored to existing tokens)

Eight principles, each tied to a concrete token the app already has or a justified extension. These are
the rubric the three directions are scored against.

| # | Principle | Token anchor (existing or +extension) |
|---|-----------|---------------------------------------|
| P1 | **One reading column.** A single content-width token; dense surfaces opt out explicitly. | +`--measure` token (e.g. `max-w-2xl`); replaces `max-w-4xl/7xl/container` drift |
| P2 | **Border, not shadow.** Elevation is a hairline + hover border, never a drop shadow. | `.kq-card` (existing) becomes the only card; retire `.card` `shadow-*` |
| P3 | **One radius per role.** Cards one radius, pills one radius, controls one radius. | Settle `rounded-lg` (cards) vs `rounded-xl` drift; +`--radius-card` token |
| P4 | **Smooth serif ramp.** Display/heading/sub-heading/body as named Fraunces+Hanken steps. | +`kq-headline-sm` (26px) fills the 30→body gap detail hand-rolls |
| P5 | **Color = meaning, from tokens only.** Status/urgency map to semantic tokens; zero raw Tailwind color. | `warn`/`success`/`error`/`accent` (existing); kills `red-600`/`yellow-100`/`gray-200`/`green-500` |
| P6 | **Quiet density.** Each row shouts once; match-% is always a whisper. | `kq-quiet-meta` + `describeMatchSignal()` (existing) everywhere; kill `{matchScore}% Match` pill |
| P7 | **Warm finite states.** One `kq-finite-state` for every empty/caught-up/closed surface. | `.kq-finite-state` (existing) replaces ad-hoc emoji blocks + `EmptyState` |
| P8 | **Calm motion + optional paper texture.** ≤220ms fades; at most a whisper of grain/leaf. | `.kq-decay` timing (existing) + optional `--texture` background layer |

P1–P7 are **non-negotiable convergence** (they just finish the system). **P8 is the one creative
dial** — and it is exactly the axis the three directions below differ on.

---

## The three candidate directions (token deltas only)

All three keep the locked palette + type and satisfy P1–P7. They differ on **P8 (texture/character)
and the typographic-scale ambition** — i.e. *how far we evolve while we're in there*. Each is
expressed as a delta to the existing tokens so it survives per-community re-skinning.

### Direction A — "Tidy Commons" (convergence only)
> **Thesis:** Finish the system. Zero new aesthetic; make every surface look like the community page.

- **Token deltas:** add `--measure`, `--radius-card`, `kq-headline-sm`; **no** new color, texture, or
  motion. Migrate fossils onto existing `.kq-*` classes.
- **Density/rhythm:** the community page's exact rhythm, app-wide.
- **Trade-offs:** lowest risk, lowest effort, fully reversible; but adds **no** new delight — the app
  becomes consistent, not more characterful. The "facelift" reads as "cleanup."

### Direction B — "Field Guide" (convergence + one warm texture step) — *recommendation candidate*
> **Thesis:** Finish the system **and** give it a quiet signature: the warm system, plus a single
> paper-grain texture, a smooth serif ramp, and a recurring leaf/seed motif — a printed neighbourhood
> field guide.

- **Token deltas (on top of A):**
  - `--texture`: a very low-opacity grain/noise layer composited under the existing body radial wash
    (one extra `background-image` stop; no new color).
  - **Serif ramp extended:** `kq-eyebrow` (existing) → `kq-headline-sm` (26) → `kq-headline` (30) →
    `kq-hero-name` (32) as a named, smooth scale; section labels gain a hairline rule + leaf glyph.
  - **Seed/leaf motif:** the existing `karmyq-mark.svg` reused as a faint section divider / empty-state
    illustration (replaces ad-hoc emoji).
  - **Card:** `.kq-card` unchanged (border, no shadow); section dividers become a 1px `border-light`
    rule rather than spacing alone.
- **Density/rhythm:** same as A, with editorial section rhythm (rule + label) instead of bare spacing.
- **Trade-offs:** still anchored to existing tokens (texture is one CSS layer, fully behind a token so
  re-skins can drop it); adds genuine, on-brand character; slightly more design care per surface.
  Texture must stay a whisper or it violates P8/Are.na restraint — that's the only risk.

### Direction C — "Almanac" (expressive evolution)
> **Thesis:** Treat the facelift as a real visual step-up: a bolder Fraunces display scale, a duotone
> green/cream hero treatment, decorative rules, and per-community accent expression.

- **Token deltas (on top of B):**
  - **Bigger display:** hero headlines jump to ~40–44px Fraunces with tighter tracking; heroes get a
    duotone cream→green wash.
  - **Decorative rules + drop caps** on community missions and the founder's-note voice.
  - **Per-community accent** promoted: the `ThemeProvider` accent appears in rules, drop caps, and
    active states, making each community visibly its own "edition."
- **Trade-offs:** the most memorable and the most "designed"; but the largest departure from what
  shipped, the highest re-skin-collision risk (decorative accent usage must be audited against every
  community theme), and the most S105 effort. Risks tipping from "warm library" toward "loud poster" —
  the boundary the anchor explicitly polices.

---

## How the directions map to principles

| Principle | A — Tidy Commons | B — Field Guide | C — Almanac |
|-----------|:---------------:|:---------------:|:-----------:|
| P1–P3 (column/card/radius) | ✅ | ✅ | ✅ |
| P4 smooth serif ramp | partial (just `-sm`) | ✅ full ramp | ✅✅ bolder |
| P5 color=meaning tokens | ✅ | ✅ | ✅ (+accent expression) |
| P6 quiet density | ✅ | ✅ | ⚠ bolder display tests it |
| P7 warm finite states | ✅ | ✅ (+ leaf motif) | ✅ |
| P8 texture/character | none | ✅ one whisper | ⚠ several steps |
| **Risk / effort** | low / low | **low-med / med** | high / high |
| **Brand fit** | safe, plain | **warm, on-anchor** | exciting, boundary-testing |

**Pointer to the recommendation (Task 6):** **Direction B ("Field Guide")** is the leading candidate —
it satisfies every non-negotiable principle, adds exactly *one* on-brand creative step (texture +
serif ramp + leaf motif) without departing from the shipped, approved aesthetic, and stays expressible
as token deltas that survive re-skinning. A is the safe fallback if S105 budget is tight; C is parked
as a future "expressive" option if the maintainer wants a bolder step. The mockups (Task 5) make A/B/C
concrete so the maintainer chooses on artifacts, not prose.
