# Sprint 104: UI Facelift Research — Design Spec

**Date**: 2026-06-17
**Status**: Approved
**Version**: 11.12.0 → 11.12.0 (no version change — research-only, **no-deploy**)
**Sprint Branch**: `feature/sprint-104-ui-facelift-research`

---

## Overview

Karmyq's visual layer has been re-skinned incrementally across many sprints (S84 unified feed,
S87 UX audit, S88–S89 community page, S100–S102 feed/memory surfaces). Each pass improved one
surface in isolation. The result is a UI that is *functional and tokenized* but **inconsistent in
altitude across surfaces** — the dashboard, community page, request feed, and global chrome each
carry a slightly different visual era, spacing rhythm, and information density. No single sprint has
stepped back and looked at the whole product as one designed system.

This sprint does exactly that, and **only** that. It is a research-first design sprint: the
deliverable is a comprehensive **UI Facelift Research doc** that (1) audits the current state of all
four surface clusters against a shared scorecard, (2) researches reference products and distinctive
aesthetic directions using the `frontend-design` skill, anchored to the existing CSS-variable token
system, and (3) recommends a concrete redesign direction with enough specificity that a later
implementation sprint can execute it. **There is no app implementation and no proof-of-concept page
in this sprint** — per the standing rule that UX sprints start with a layout audit and reference
research before any code, and the maintainer's explicit choice of a pure-research deliverable.

### Core Principle: Audit the whole before re-skinning the parts

We have re-skinned surfaces one at a time and produced drift. This sprint inverts that: look at the
entire product as one system first, decide the visual language once, then let implementation sprints
apply it surface by surface against a single agreed reference.

---

## Multi-Sprint Arc

### Sprint 103 — Governance + Intake Clarity (complete)
Split-governance truth, service-vs-help action copy, founding-circle review tooling. Functional
clarity. Shipped `v11.12.0`.

### Sprint 104 — UI Facelift Research (this sprint)
Whole-product visual audit + reference research + recommended redesign direction. **Doc only.**
No implementation, no deploy.

### Sprint 105+ — UI Facelift Implementation (upcoming)
Execute the recommended direction surface-by-surface against the agreed reference. Net-new code,
token/system changes, per-surface rollout, deploy. Scoped from this sprint's recommendations.

---

## What This Sprint Is NOT (Scope Guardrails)

- **No app code.** No edits under `apps/frontend/src/pages/**`, `src/components/**`, `globals.css`,
  or `tailwind.config.js`. The token system is *referenced and critiqued*, not changed.
- **No POC page.** No wired-into-the-app demonstration route.
- **No deploy.** This plan is tagged `no-deploy`. No master push triggering a demo deploy for a
  research doc (see the "no docs-only push to master" discipline — the planning + research artifacts
  live in `docs/` and ship via PR, not a standalone deploy push).
- **No new platform features, no API changes, no schema changes.**

Static, throwaway HTML **design-direction mockups** (visual exploration, not app code, not wired to
any route) ARE in scope as a research artifact — this matches the Sprint 87 precedent
(`docs/design/sprint-87/mockups/`). They are illustrations inside the research, not implementation.

---

## Research Scope: Four Surface Clusters

| Cluster | Primary routes | Why it's in scope |
|---------|---------------|-------------------|
| **Dashboard / Home** | `/dashboard`, `/index` (logged-in landing) | The logged-in front door; the "empty Home for established users" problem makes its IA a facelift priority |
| **Community page** | `/communities/[id]` (overview/requests/graph tabs), `/communities/index` | Most re-skinned surface (S88–S89); revisit holistically for consistency |
| **Request feed + detail** | `/requests/index`, `/requests/[id]`, `/offers/*`, `/matches/[id]` | Core transactional surface — cards, detail pages, action copy (just centralized in S103) |
| **Profile + global chrome** | `/profile`, shared nav/header/shell, `_app.tsx` layout | The frame around every page; trust/karma display; the ThemeProvider skin boundary |

---

## Research Methodology (how the doc gets built)

1. **Current-state audit** — capture each cluster as it ships today (live demo screenshots where
   possible, component inventory, token usage). Score each against a shared scorecard (visual
   hierarchy, spacing rhythm, density, consistency, warmth/brand fit, accessibility, mobile
   readiness). Reuse and extend the Sprint 87 scorecard rather than inventing a new one.
2. **Reference research** — use the `frontend-design` skill to study reference products in the
   mutual-aid / warm-social / community space and to generate distinctive aesthetic directions that
   avoid generic AI defaults. Anchor every direction to the *existing* token vocabulary (earthy
   green/teal/cream/brown; Fraunces display + Hanken Grotesk body) so the recommendation is an
   evolution, not a rip-and-replace.
3. **Gap analysis** — for each cluster, name the specific deltas between current state and the
   target direction (e.g. "dashboard cards use 3 different corner radii", "community tabs and feed
   cards disagree on elevation").
4. **Direction synthesis** — propose **2–3 coherent design directions** for the whole product
   (not per-surface), each with: a one-line thesis, token deltas, a representative mockup, and the
   trade-offs. Recommend one.
5. **Recommendations + rollout sketch** — translate the recommended direction into a per-cluster
   change list specific enough to scope the S105 implementation sprint.

---

## Deliverables

| Deliverable | Path |
|-------------|------|
| **UI Facelift Research doc** (primary) | `docs/design/sprint-104-ui-facelift/README.md` |
| Current-state audit + scorecard | `docs/design/sprint-104-ui-facelift/ux-audit.md` |
| Reference & visual research | `docs/design/sprint-104-ui-facelift/visual-research.md` |
| Design-direction mockups (2–3, static HTML) | `docs/design/sprint-104-ui-facelift/mockups/*.html` |
| Per-cluster recommendations → S105 scope | `docs/design/sprint-104-ui-facelift/recommendations.md` |
| **ADR-079 (Proposed)**: Karmyq Visual Design System v2 (source) | `docs/adr/ADR-079-visual-design-system-v2.md` |
| Updated UX design principles (source concept) | `docs/concepts/ux-design-principles.md` |

ADR-079 ships at status **Proposed** (not Implemented) — it records the recommended direction; the
S105 implementation sprint moves it to Accepted → Implemented.

**Landing docs are generated, not authored.** `apps/landing/src/data/docs/` is wiped and rebuilt by
`scripts/generate-docs.ts` on every run: concept pages from `docs/concepts/*.md`, ADR pages from
`docs/adr/ADR-*.md`, and the ADR nav from the `ADR_GROUPS` table in that script. To surface ADR-079
and the refreshed principles on the landing site, edit those **sources** + add the ADR-079 slug to
`ADR_GROUPS`, then run `cd apps/landing && npm run generate-docs` and `git add -f` the output. Never
hand-edit `apps/landing/src/data/docs/**` or `nav.json` — the next regenerate would discard it.

---

## Data Model

None. No schema changes.

## API Endpoints

None. No endpoint changes.

## Frontend Changes

None to shipped app code. Static research mockups only, under `docs/design/`.

---

## User Guide & Doc Updates

Even a research sprint ships docs (standing rule). For this sprint the docs ARE the deliverable, plus:

- **Source concept** `docs/concepts/ux-design-principles.md` — refresh to reflect the recommended
  visual direction's principles (still Proposed; framed as "where the visual system is heading").
- **ADR index** `docs/adr/README.md` — add ADR-079 (Proposed).
- **Generator nav** `scripts/generate-docs.ts` — add the `adr-079-visual-design-system-v2` slug to
  `ADR_GROUPS`, then regenerate so the ADR page + nav entry appear on the landing site.
- No user-facing *feature* guide changes (no feature shipped).

---

## Critical Implementation Notes

1. **Research-first, no app code.** Do not touch `apps/frontend/src/pages/**`,
   `src/components/**`, `globals.css`, or `tailwind.config.js`. If a finding tempts a "quick fix,"
   log it as a recommendation for S105 — do not implement it.
2. **Anchor to the existing token system.** The app already has a CSS-variable, ThemeProvider-backed
   token system (`apps/frontend/src/styles/globals.css`, `tailwind.config.js`). Every proposed
   direction must express itself as *deltas to those tokens*, not a parallel system. Per-community
   skins override tokens via `ThemeContext` — any direction must survive being re-skinned.
3. **Extend Sprint 87, don't restart.** Reuse `docs/design/sprint-87/scorecard.md`,
   `ux-audit.md`, and `visual-research.md` as the baseline; this sprint is the whole-product
   superset, not a from-scratch redo. Cite what changed since S87.
4. **Mockups are throwaway research artifacts.** Static HTML under `docs/design/sprint-104-ui-facelift/mockups/`.
   They must NOT import app components, hit APIs, or be reachable from any Next.js route. They
   illustrate direction only.
5. **No-deploy sprint.** Tagged `no-deploy`; the plan has no merge+deploy task. Ships via a normal
   PR that is reviewed and merged, but does not require a demo deploy validation pass (there is no
   runtime change to validate). Reconcile separately, do not push docs alone to master to "deploy."
6. **frontend-design skill is the engine for directions.** Use it to generate distinctive,
   non-generic aesthetic directions; do not hand-roll a generic Tailwind look. Feed it the existing
   tokens + the four-cluster audit as constraints.
7. **ADR-079 ships Proposed, not Implemented.** It is a recommendation, not a deployed decision.
8. **Version drift to flag (not fix here):** `package.json` reads `11.10.0` while the S103 handoff
   tracks `v11.12.0`. Note it in the recommendations as a housekeeping item for the implementation
   sprint; do not bump versions in a research sprint.
9. **Live demo screenshots:** capturing current-state screenshots uses the documented demo UX-audit
   access (SSH + sim account). If the demo is unreachable, fall back to local `npm run dev` or
   annotated component inventory — do not block the audit on screenshot capture.
