# ADR-079: Karmyq Visual Design System v2 (finish the warm system + harden it into tokens)

**Status**: Proposed
**Date**: 2026-06-17
**Sprint**: 104 (research) → implemented in 105
**Version**: (target 11.x, set at S105 release)

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

**Adopt a Visual Design System v2 that (1) completes adoption of the warm `.kq-*` system across all
four clusters and (2) hardens the drift axes into named tokens. The maintainer chose "A-plus" (review
2026-06-17): Direction A (convergence; no new visual personality required) is the mandated scope, and
the foundation is built B-compatible — token hooks for paper grain / leaf motif / a smoother Fraunces
ramp ship but are off by default (and, if used, sparse: finite states + section dividers only, enabled
later after seeing it in the running app). All deltas are expressed against the CSS-variable tokens so
they survive per-community re-skinning.**

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
finite states everywhere · P8 calm motion + an optional whisper of paper texture. P1–P7 are
non-negotiable convergence and are the mandated S105 scope; **P8 is the single creative dial** —
under the "A-plus" verdict its hook ships but stays **off by default** (dialed up later, sparingly).

### Token-system implications

New/clarified tokens in `globals.css :root` + `karmyq-shell.css` (the rollout detail is S105):
`--measure` (one content width), `--radius-card`, `--texture` (grain-layer hook, **default off** under
A-plus, nullable per skin), `kq-headline-sm` (26px Fraunces, the mid-size step request detail currently hand-rolls inline),
one canonical card primitive (`.kq-card`, retiring `.card` shadow variants), status/urgency mapped to
existing semantic tokens (`warn`/`success`/`error`/`accent`), `kq-finite-state` as the single
empty/caught-up/closed component, and a leaf motif reusing the existing `karmyq-mark.svg`. **No palette
or type-family change** — the brand colors and Fraunces + Hanken pairing are unchanged. Everything is a
delta to the CSS variables, so per-community `ThemeProvider` skins continue to override cleanly.

### Rollout decision (deferred to S105)

S104 is **research only — no implementation, no deploy.** S105 implements in order: a token/component
**foundation** PR first (it unblocks the rest), then the **Request feed** (highest score delta, the
visible proof point — reskinned onto the warm feed components or retired in favour of the dashboard
`UnifiedFeed`), then Profile + chrome, Dashboard (incl. the carried-forward "empty Home for
established users" altitude — the one non-styling item), and a light Community polish. The per-cluster
change list is in `docs/design/sprint-104-ui-facelift/recommendations.md`.

## Consequences

**Positive:**
- One coherent design language across the app; the cross-cluster drift closes and is tokenized so it
  cannot silently recur.
- The two weak clusters (Request feed 2.1, Profile/chrome 2.9) rise to parity with the community page.
- A genuine facelift from convergence alone ("make the app look like its best page"), without
  re-opening the approved aesthetic — with the texture/motif personality held in reserve behind
  default-off hooks (the per-community re-skin guarantee is preserved either way).
- An accessibility pass (contrast, focus, not-color-only) folds into the migration cheaply, since
  every surface is touched once.

**Negative / risks:**
- S105 touches many surfaces; the foundation PR must land first or the propagation PRs drift.
- The Request feed needs a fate decision (reskin vs retire) — keeping a second, colder feed is the
  failure mode to avoid.
- The P8 texture must stay a whisper or it violates the "calm, library-not-poster" anchor.

**Neutral:**
- Version drift (`package.json` 11.10.0 vs handoff v11.12.0) is reconciled as part of the S105
  release, not here.
- This ADR ships **Proposed**; S105 advances it to **Implemented** as surfaces land.

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
