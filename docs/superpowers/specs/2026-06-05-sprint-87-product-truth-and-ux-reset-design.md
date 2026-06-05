# Sprint 87: Product Truth & UX Reset — Design Spec

**Date**: 2026-06-05
**Status**: Approved
**Version**: v10.10.0 → v10.11.0
**Sprint Branch**: `feature/sprint-87-product-truth-and-ux-reset`

---

## Overview

Karmyq has the right philosophical spine and the unified-feed arc (Sprints 84–86) moved the product
in the right direction. The remaining gap is no longer missing features — it's whether the **product
surface makes the founding promises legible**. The app still reads like a generic dashboard with admin
panels attached; several surfaces foreground points/scores/percentages and "stay engaged" language;
the "trust fades / privacy by default" promise is invisible outside ranking math; and public docs +
repo metadata trail the actual repo state.

Sprint 87 is a **manifesto-first presentation reset**, not a UI rewrite. It does three things:
1. **Ships low-risk quick wins** that immediately reduce confusion — stale source-of-truth metadata,
   `apps/frontend/CONTEXT.md` BrowseFeed drift, and landing placeholder stories.
2. **Cleans/seeds representative demo data** so the UX audit judges signal, not stale-sim noise.
3. **Produces the design-research deliverables** — a product-polish scorecard, a screenshot-based UX
   audit, visual reference research, throwaway HTML mockups for the five key surfaces, and a written
   presentation-rules system — **so Sprint 88 executes the help-loop redesign from an approved direction.**

**No production UI rewrite happens this sprint.** The quick wins deploy; the design artifacts commit to
the repo as `docs/design/sprint-87/` and change no production UI. The maintainer approves the mockup
direction before the Sprint 88 implementation plan is written.

### Core Principle: Warm commons, calm behavior

Warmth is the **identity** — people, faces, stories, and relationship reasons lead; the voice is humane.
Calm is the **discipline** — finite queues, no engagement chrome, quiet density, visible privacy/decay.
Reference feel: a well-made neighborhood library / thoughtful newsletter. **Not** a cold SaaS dashboard;
**not** a loud civic-tech poster.

---

## Multi-Sprint Arc

- **Sprint 84** — Unified feed research & direction. ✅ Complete (`no-deploy`).
- **Sprint 85** — Unified feed, Dashboard Home first (steps 1–3). ✅ Shipped v10.9.0.
- **Sprint 86** — Community Feed view + texture + legacy retirement + seam fix. ✅ Shipped v10.10.0.
- **Sprint 87 — Product Truth & UX Reset** (this sprint) — manifesto-first presentation reset:
  quick wins + demo-data cleanup + scorecard + UX audit + mockups + presentation rules.
- **Sprint 88** — Core help-loop redesign (RequestCard hierarchy, KarmaBadge removal, finite-queue
  states, impression logging on `view=home`/`view=community`, community `minScore` "show more open",
  seed of "what fades", RequestWizard copy).
- **Sprint 89** — Community sovereignty redesign (member-home vs admin altitude; fission/fusion tokens).
- **Sprint 90** — Trust, forgetting, profile polish (full member-facing memory/forgetting surface).
- **Sprint 91** — Mobile parity from the polished web model.
- **Sprint 92** — Architecture & service pruning (feed-service / cleanup-service / geocoding-service).

Full arc detail: `docs/superpowers/specs/2026-06-05-sprint-87-90-polish-reset-review-and-roadmap.md`.

---

## Decisions Locked (2026-06-05, maintainer)

1. **Aesthetic anchor = "warm commons, calm behavior"** (above).
2. **Quick wins are in scope** — stale metadata, `apps/frontend/CONTEXT.md` BrowseFeed drift, landing
   placeholder stories. Design research + throwaway mockups are the core. **No production UI rewrite
   until the direction is approved.**
3. **Score-vs-relationship taxonomy** (design rule for the whole arc): lead with the relationship path
   (`TrustPathBadge`, "via X"); remove per-person reputation/trust SCORES (`KarmaBadge`); de-emphasize
   the match-relevance %. The `RequestCard` `KarmaBadge` removal **folds into the Sprint 88 card
   redesign** — this sprint only documents the rule, it does not edit the card.
4. **Community feed "show all open" = both** — curated-first default (`minScore≥30`), a low-altitude
   member "show more open requests" affordance, **and** the admin all-status list (shipped #64).
   Implements in Sprint 88; Sprint 87 records the decision.
5. **"Designed to forget" stays Sprint 90**, seeded small in Sprint 88.

**Execution decisions for this sprint (2026-06-05):**
- **Deploy posture:** quick wins ship in one PR (real deploy); design artifacts commit in the same PR
  but touch no production UI. Final task = `/deploy` for the quick wins.
- **Mockup fidelity:** static HTML/CSS throwaway pages (built with `frontend-design`) under
  `docs/design/sprint-87/mockups/` — not wired to the app.
- **Mockup scope:** all five surfaces — Dashboard Home, Community Home, Request Card, Profile/Trust,
  Governance/Fission-Fusion.
- **UX audit capture:** Claude drives demo via Playwright MCP (login → navigate → screenshot →
  audit notes per surface).

---

## New Concepts

- **Product-polish scorecard** — a one-page table scoring each founding promise (community sovereignty,
  help-loop clarity, privacy/forgetting, meaning-not-points, local trust) against the current surface,
  with a target state. Becomes the rubric the whole 88–92 arc is measured against.
- **Presentation-rules system** — the written design language: page shells, type scale, spacing, color
  use, card hierarchy, status language, score treatment, privacy/decay affordances, a11y + responsive
  rules, and mobile-translation notes. The source the Sprint 88 implementation builds from.

---

## Data Model

**No schema changes this sprint.** Demo-data cleanup is data hygiene (delete/reseed stale simulation
rows on the demo DB), not DDL. Any reseed uses existing simulation-service flows.

---

## API Endpoints

**No new or modified endpoints this sprint.**

---

## Frontend Changes

**Production UI changes are limited to quick wins:**

| File | Change |
|------|--------|
| `apps/landing/src/components/sections/CommunityStories.tsx` | Remove or replace placeholder/fabricated community stories until real founding-circle stories exist (decide: hide the section vs. honest "stories coming from the founding circle" copy). |
| `apps/frontend/CONTEXT.md` | Fix BrowseFeed drift — it still documents the Sprint 34 `BrowseFeed` architecture that Sprint 86 retired; replace with the unified-feed (`UnifiedFeed` view=home/community) reality. |

**No other production component changes.** All design output (mockups) lives in `docs/design/sprint-87/`
as standalone HTML, not in `apps/`.

---

## Source-of-Truth / Doc Quick Wins

| File | Change |
|------|--------|
| `CLAUDE.md` | Version header `9.1.0` → `10.11.0` (currently 14 minor versions behind). |
| `README.md` | Version/update metadata → v10.11.0 + Sprint 86/87 state. |
| `docs/README.md` | Version/update metadata refresh. |
| `docs/ARCHITECTURE.md` | Version/update metadata + note feed source-of-truth is request-service (ADR-066). |
| Landing docs metadata | Verify the newest unified-feed guide/concept pages generate + appear in nav; refresh build metadata so public docs aren't behind repo state. |

---

## Design Deliverables (the core of this sprint)

All under `docs/design/sprint-87/` (NOT gitignored — only `apps/landing/src/data/docs/` is):

1. **`scorecard.md`** — product-polish scorecard (five promises × current/target).
2. **`visual-research.md`** — reference research for warm-commons/calm: quiet density, editorial warmth,
   no engagement-feed posture, no SaaS chrome. Concrete references + what to borrow/avoid.
3. **`ux-audit.md`** — screenshot-based audit notes per surface (Dashboard Home, Request Wizard,
   Community page, Profile/Reputation, Governance, Fission/Fusion, mobile Feed), with screenshots in
   `docs/design/sprint-87/screenshots/`.
4. **`mockups/`** — throwaway static HTML/CSS for the five surfaces: Dashboard Home, Community Home,
   Request Card, Profile/Trust, Governance/Fission-Fusion. Plus a `mockups/index.html` contact sheet.
5. **`presentation-rules.md`** — the new design language (shells, type, spacing, color, card hierarchy,
   status language, score treatment, privacy/decay affordances, a11y, responsive, mobile translation).
6. **`sprint-88-recommendation.md`** — the `minScore` decision (curated-first + "show more open"),
   the score-vs-relationship taxonomy applied to the card, and the recommendation on whether S88 builds
   a shared design-system shell + Dashboard Home together (recommended) or Dashboard Home alone.

---

## User Guide & Doc Updates

This sprint's user-facing changes are the **quick wins** and the **design research**; the deep guide
rewrites land with their implementing sprints (88–90). Specifically this sprint:

- **Landing placeholder stories** — `CommunityStories.tsx` corrected so the public site stops showing
  fabricated stories (a manifesto/"real communities" violation).
- **Public docs freshness** — verify the unified-feed guide + ADR-066/067 concept pages are present in
  the landing docs nav and the build metadata isn't behind repo state.
- **No new user guide** is required because no new user-facing *workflow* ships — the design rules and
  scorecard are internal artifacts. (Sprint 88 ships the help-loop guide updates.)

---

## Critical Implementation Notes

1. **No production UI rewrite this sprint.** The only production code touched is the two quick wins
   (`CommunityStories.tsx`, `apps/frontend/CONTEXT.md`). Everything else is repo artifacts under
   `docs/design/sprint-87/`. Resist scope creep into S88 card/shell work.
2. **`KarmaBadge` is NOT removed this sprint** — Decision 3 explicitly folds its removal into the
   Sprint 88 card redesign so the card is decided holistically. Sprint 87 documents the taxonomy rule;
   it does not edit `RequestCard`.
3. **Clean/seed demo data BEFORE the screenshot audit** — a UX audit on stale-sim data judges noise.
   The audit's honesty depends on representative data. Order matters: data cleanup → audit → mockups.
4. **Drive the audit via Playwright with a real member login** — JWT field is `communities`. Capture
   each surface logged in as a member (not just admin) so member-altitude issues surface. If demo is
   unhealthy, confirm the latest "Deploy to Demo" run succeeded first (deploy-drift watch).
5. **Mockups are throwaway and standalone** — static HTML/CSS in `docs/design/sprint-87/mockups/`,
   not wired into `apps/frontend`. They exist to win approval on direction, not to be imported. Build
   with the `frontend-design` skill against the warm-commons/calm anchor.
6. **Landing docs dir is gitignored** (`apps/landing/src/data/docs/`) → `git add -f` for any landing
   docs changes. **`docs/design/` is NOT gitignored** — sprint-87 artifacts add normally.
   Run `generate-docs` from `apps/landing/` and **grep-verify nav.json after** (it silently reverts).
7. **`git add` on CLAUDE.md** is tracked lowercase as `claude.md` on Windows — uppercase silently
   does nothing.
8. **This is the proof-point sprint for warm-commons/calm** — the mockups + presentation rules are the
   artifact the maintainer approves before any S88 code. Optimize the deliverables for an approval
   decision, not for completeness.

---

## ADR

No ADR this sprint — there is no new architectural decision, only documented design direction. (The
score-vs-relationship taxonomy and presentation rules are design conventions captured in
`docs/design/sprint-87/`, not an architectural decision record.) Next free ADR number remains **068**.
