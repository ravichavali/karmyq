# Sprint 104 — UI Facelift Research

**Status:** Research complete · Proposed direction for maintainer review · **no implementation, no
deploy** (S104 is a doc-only sprint; S105 implements).
**Date:** 2026-06-17 · **Branch:** `feature/sprint-104-ui-facelift-research`

---

## The problem

The S88–S92 arc shipped a real, approved "warm commons" design system — the `.kq-*` shell, Fraunces +
Hanken type, relationship-led cards, finite "caught up" states, one quiet notification. It is genuinely
good **where it landed**. But it only landed on about **60% of the app**. Several high-traffic
surfaces — most of all the standalone **Request feed** — are pre-S88 fossils that re-introduce the
exact patterns the Sprint 87 audit flagged: a bold `% Match` badge leading the card, off-palette raw
Tailwind colors, SaaS "Smart Filtering" chrome, and wide cold grids.

> **The S104 finding in one line:** the app is not cold — it is **half-converted, and the seam shows.**
> The facelift is **finishing the warm system we already chose** and hardening it into tokens so it
> can't drift again — not inventing a new aesthetic.

## Method

Source-grounded audit of `apps/frontend/src` (JSX + the CSS-variable token system) rather than pixels —
more durable for scoping token/component work — cross-referenced with the S87 screenshot audit. Four
surface clusters scored 1–5 on seven design-system dimensions; cross-cluster drift catalogued with
file:line citations. Three whole-product directions generated via the `frontend-design` skill, fed the
existing tokens + the audit as hard constraints, and made concrete as throwaway static mockups.

## The documents

| Doc | What's in it |
|-----|--------------|
| [`ux-audit.md`](ux-audit.md) | Current-state audit of all four clusters + the shared scorecard + the cross-cluster drift table (the spine of the sprint). |
| [`visual-research.md`](visual-research.md) | References (S104 lens), eight aesthetic principles (P1–P8) anchored to existing tokens, and the three candidate directions as token deltas. |
| [`recommendations.md`](recommendations.md) | The recommendation, the per-cluster S105 change list, rollout order, and housekeeping. |
| [`mockups/`](mockups/) | Throwaway static HTML — `index.html` (contact sheet) + one page per direction. Open standalone in a browser; not wired to the app. |
| `docs/adr/ADR-079-visual-design-system-v2.md` | The Proposed ADR recording this direction (advanced to Implemented in S105). |

## The scorecard at a glance

| Cluster | Hierarchy | Spacing | Density | Consistency | Brand | A11y | Mobile | **Avg** |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard / Home | 4 | 4 | 4 | 4 | 5 | 3 | 4 | **4.0** |
| **Request feed + detail** | 2 | 2 | 3 | 1 | 2 | 3 | 2 | **2.1** |
| Community page | 5 | 5 | 4 | 5 | 5 | 3 | 4 | **4.4** |
| Profile + chrome | 3 | 3 | 3 | 2 | 3 | 3 | 3 | **2.9** |

The **community page is the reference** (4.4); the **Request feed is the worst surface** (2.1) and the
headline S105 target. Accessibility is a flat 3 everywhere — present but unaudited.

## The recommended direction: **B — "Field Guide"**

All three directions keep the locked palette + type and close the cross-cluster drift (principles
P1–P7). They differ on **P8 — texture / character**:

- **A — Tidy Commons:** convergence only, no new aesthetic. The safe fallback.
- **B — Field Guide (recommended):** convergence **+ one on-brand step** — a whisper of paper grain, a
  smooth Fraunces ramp, and a recurring seed/leaf motif. Character without leaving the approved
  aesthetic; every addition is a droppable token. Lifts the two weak clusters to ~4.2.
- **C — Almanac:** an expressive step-up (bolder display, duotone hero, accent expression). Most
  memorable, highest risk; **parked** as a future option.

See [`recommendations.md`](recommendations.md) for the full rationale and the per-cluster S105 task
list.

## S105 entry point

1. **S105.0 — token & component foundation** (one reading-column token, one card primitive,
   `kq-headline-sm`, status/color tokens, `kq-finite-state` everywhere, the grain/leaf layer). Merge
   first; everything else consumes it.
2. **S105.1 — Request feed** (reskin onto the warm feed components or retire it; kill the `% Match`
   pill and the Smart-Filtering chrome). Highest score delta + the visible proof point.
3. **S105.2 — Profile + chrome**, **S105.3 — Dashboard** (incl. the empty-Home altitude — the one
   non-styling design item), **S105.4 — Community** polish.
4. Reconcile the **version drift** (`package.json` 11.10.0 vs handoff v11.12.0) as part of the S105
   release; advance **ADR-079** to Implemented as surfaces land.

## Scope guardrails (S104)

- **No app code changed:** nothing under `apps/frontend/src/**`, `globals.css`, or `tailwind.config.js`.
- **Mockups are throwaway:** static HTML, no app imports, no API, not route-reachable.
- **No deploy:** ships via a reviewed PR, not a master-deploy push.
- **ADR-079 ships Proposed**, not Implemented.
