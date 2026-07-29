# ADR-079: Karmyq Visual Design System v2 (finish the warm system + harden it into tokens)

**Status**: Implemented
**Date**: 2026-06-17
**Sprint**: 104 (research) → implemented in 105
**Version**: 11.13.0

## Context

Sprint 88 shipped a "warm commons" design system — the `.kq-*` shell (`karmyq-shell.css`), Fraunces +
Hanken Grotesk type, relationship-led `RequestCard`, finite "caught up" states, one quiet
`NotificationBell` — anchored to a CSS-variable token system in `globals.css :root` that
`ThemeProvider` overrides per community. Sprints 89/90/101 extended it to the community page
(ADR-068), visible decay (ADR-070), and the request-detail action surface. The aesthetic was approved
by the maintainer (`docs/design/sprint-87/sprint-88-recommendation.md` §5).

The Sprint 104 UI-facelift research (`docs/design/sprint-104-ui-facelift/`) audited all four surface
clusters against a shared 1–5 scorecard and found the system is **real, good, and only ~60% adopted**:

- **Community page** (avg 4.4) and **Dashboard Home** (4.0) are on the warm shell.
- **Request feed + detail** (avg **2.1**) and **Profile + chrome** (2.9) lag. The standalone Request
  feed (`pages/requests/index.tsx`), `offers/index.tsx`, and `matches/[id].tsx` are **pre-S88
  fossils** that re-introduce the exact patterns the Sprint 87 audit flagged: a bold `% Match` badge
  leading the card, off-palette raw Tailwind colors (`red-600`, `yellow-100`, `gray-200`), SaaS
  "Smart Filtering" chrome, and wide cold grids.

The audit catalogued the divergence as a **cross-cluster drift table**: four different content widths,
two card/elevation languages (border-vs-shadow), three corner radii, two match-signal treatments
(quiet whisper vs bold pill), serif-vs-bold-sans display type, and raw-Tailwind-vs-token color. Each
row is a missing or under-used token.

The problem is therefore not "the app is cold" (S87's finding) but **"the app is half-converted, and
the seam shows."** The facelift is finishing the system we already chose and hardening it into tokens
so it cannot drift again — not inventing a new aesthetic.

## Decision

**Adopt and implement Visual Design System v2: (1) complete adoption of the warm `.kq-*` system across
the live frontend clusters and (2) harden the drift axes into named tokens. The maintainer chose
"A-plus" (review 2026-06-17): Direction A (convergence; no new visual personality required) is the
mandated scope. B-style texture/motif hooks were intentionally deferred because no Sprint 105 finite
state or divider consumed them. All shipped deltas are expressed against CSS-variable tokens so they
survive per-community re-skinning.**

Three directions were studied (mockups in `docs/design/sprint-104-ui-facelift/mockups/`):

- **A — Tidy Commons (chosen as the S105 scope):** convergence — finish the warm system everywhere,
  kill the fossils, standardize cards/width/status-color/type. Alone, this lifts the two weak clusters
  (Request feed 2.1, Profile/chrome 2.9) to ~4.2 — a meaningful facelift, not a cleanup.
- **B — Field Guide (optional garnish only):** the convergence above + a whisper of paper-grain
  texture, the serif ramp, and a leaf motif. Built as **default-off token hooks** so it can be dialed
  up later without re-plumbing; not an S105 deliverable.
- **C — Almanac:** an expressive step-up (bolder display, duotone hero, promoted accent). Most
  memorable, highest re-skin risk; **parked** as a future option.

Rationale: S104's strongest finding is that the app is *half-converted* (Request feed 2.1 vs Community
4.4 is real drift), not that it needs new personality. Direction A fixes exactly that and keeps the
approved aesthetic intact; the failure mode to avoid is letting "facelift" become "new costume."

### Design principles (the rubric)

P1 one reading column · P2 border-not-shadow elevation · P3 one radius per role · P4 smooth Fraunces
ramp · P5 color = meaning, from tokens only · P6 quiet density (match-% always a whisper) · P7 warm
finite states everywhere · P8 calm motion + an optional whisper of paper texture. P1–P7 shipped in
Sprint 105; **P8 remains the single creative dial** and is deferred until a real surface consumes it.

### Token-system implications

New/clarified tokens in `globals.css :root` + `karmyq-shell.css`:
`--measure` (one content width), `--radius-card`, `kq-headline-sm`, one canonical card primitive
(`.kq-card`, with legacy `.card` de-emphasized), semantic status/urgency helpers in
`src/lib/requestDisplay.ts`, and `kq-finite-state` via the shared `EmptyState` component. The
`--texture` / motif hook did **not** ship in Sprint 105 because it had no live consumer. **No palette
or type-family change** — the brand colors and Fraunces + Hanken pairing are unchanged.

**Token storage format changed in Sprint 121 (Tailwind v4, v11.35.0) — values only, not the system.**
The tokens keep their names and their single home, but each now holds a real CSS color
(`--color-primary: #2d6e28`) instead of the bare RGB triplet (`45 110 40`) Tailwind v3 required.
The triplet existed solely to feed v3's `<alpha-value>` splice
(`rgb(var(--color-primary) / <alpha-value>)`); v4 reads the `--color-*` namespace directly — the same
namespace these tokens already occupied — and does opacity with `color-mix()`, so a triplet there is
not a valid color. Consequences worth knowing:

- **Opacity modifiers still resolve the variable.** `bg-primary/50` compiles to
  `color-mix(in oklab, var(--color-primary) 50%, transparent)`, so per-community re-skinning via
  `ThemeContext` keeps working *at partial alpha as well as solid* — verified in a browser, not assumed.
- `CommunityTheme` in `ThemeContext.tsx` now accepts any CSS color string, not an RGB triplet.
- Direct consumers moved from `rgb(var(--color-x))` to `var(--color-x)` (69 sites).
- `--measure`, `--measure-chrome` and `--radius-card` are declared in a plain `:root` block rather
  than `@theme`, because v4 only emits theme variables that some generated utility references and
  nothing generates `max-w-measure` / `rounded-card`.
- Component classes composed by others (`.btn-primary`, `.card`) are declared with `@utility`, since
  v4 can only `@apply` a registered utility. Custom utilities emit before the built-ins, so utility
  precedence is unchanged from v3.

### Implementation notes (Sprint 105)

S105 shipped the foundation first, then converged the request/detail/offers/match cluster, Profile and
global chrome, Dashboard Home, and a light Community polish. The standalone `/requests` feed route was
retired deliberately and redirects to Dashboard Home, leaving `/requests/[id]` as the canonical request
detail route. Dashboard Home now keeps the primary caught-up state finite and adds a quieter secondary
path to browse communities for established members with an empty primary queue.

## Consequences

**Positive:**
- One coherent design language across the app; the cross-cluster drift closes and is tokenized so it
  cannot silently recur.
- The two weak clusters (Request feed 2.1, Profile/chrome 2.9) rise to parity with the community page.
- A genuine facelift from convergence alone ("make the app look like its best page"), without
  re-opening the approved aesthetic — with the texture/motif personality held in reserve until a
  live surface consumes it.
- An accessibility pass (contrast, focus, not-color-only) folds into the migration cheaply, since
  every surface is touched once.

**Negative / risks:**
- S105 touches many surfaces; the foundation PR must land first or the propagation PRs drift.
- The Request feed needs a fate decision (reskin vs retire) — keeping a second, colder feed is the
  failure mode to avoid.
- The P8 texture must stay a whisper or it violates the "calm, library-not-poster" anchor.

**Neutral:**
- Version drift is reconciled in the S105 release target: `11.13.0`.
- Texture/motif hooks remain deferred rather than shipping unused CSS.

## Related

- [ADR-053: Feed Design Philosophy](ADR-053-feed-design-philosophy.md) — the work-surface-not-scroll
  principles the fossil feed currently violates.
- [ADR-068: Community Page Information Architecture](ADR-068-community-page-information-architecture.md)
  — the reference implementation this system propagates from.
- [ADR-070: Visible Decay Model](ADR-070-visible-decay-model.md) — the `.kq-decay-*` ramp the system
  preserves.
- [ADR-020: Trust-First Design](ADR-020-trust-first-design.md) — the relationship-over-accounting
  philosophy the card hierarchy expresses.
- Research: `docs/design/sprint-104-ui-facelift/` (audit, visual research, recommendations, mockups);
  baseline `docs/design/sprint-87/`.
