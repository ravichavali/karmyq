# Sprint 95: karmyq.org Multi-Route Relaunch — Design Spec

**Date**: 2026-06-11
**Status**: Approved
**Version**: v11.3.0 -> v11.4.0
**Sprint Branch**: `feature/sprint-95-karmyq-org-routes`

---

## Overview

`karmyq.org` currently asks one page to do too much: story, principles, mechanics, research, and invitation all compete for the same scroll. The next public-site pass should make the site easier to read, easier to share, and safer to maintain by turning the single-page composition into five explicit routes.

The supplied v5 HTML files are the content and organization source of truth. The existing landing design system remains the source of truth for the visual language: colors, typography, motion, particle/network feel, shared components, and the quiet essay-like tone. This is an information architecture sprint, not a redesign.

The join backend question is intentionally split into Sprint 96. Sprint 95 keeps `/join` as the invitation page with a hardened mailto/contact fallback, while preparing the page shape so Sprint 96 can replace the mailto CTA with a backend-backed intake form without rewriting the route structure.

### Core Principle: One Idea Per Route

Each page should carry one reader intention: understand the story, inspect principles, understand mechanics, trace the research, or join the founding circle.

---

## Multi-Sprint Arc

### Sprint 94 — Error Contract Cleanup (complete)

Canonicalized shared API error helpers and middleware around `{ success:false, message:string, error:string }`, shipped as v11.3.0.

### Sprint 95 — karmyq.org Multi-Route Relaunch

Split the landing site into five static routes, preserve `/docs`, migrate the v5 copy into the existing design system, fix route-aware nav on desktop and mobile, and fold in the queued logo fix.

### Sprint 96 — Founding Circle Backend Intake

Replace `/join` mailto-only submission with a real backend-backed intake: public endpoint, persistence, validation, spam/rate controls, success/error UI, and a visible contact fallback.

---

## New Concepts

### Public Site Routes

The public site has five top-level essay/invitation routes:

| Source file | Route | Purpose |
|---|---|---|
| `karmyq-v5-home.html` | `/` | Story and founding narrative only |
| `karmyq-v5-principles.html` | `/principles` | Six platform principles |
| `karmyq-v5-how-it-works.html` | `/how-it-works` | Mechanics and design essays |
| `karmyq-v5-research.html` | `/research` | Research foundation |
| `karmyq-v5-join.html` | `/join` | Founding-circle invitation |

### Sprint 96 Intake Boundary

Sprint 95 does not create a backend endpoint or database table for join submissions. It should leave `/join` form-shaped and CTA-ready, but the only active submission mechanism remains `mailto:contact@karmyq.org` plus visible copyable `contact@karmyq.org`.

---

## Data Model

No data model changes in Sprint 95.

Sprint 96 is expected to introduce persistence for founding-circle submissions, likely with fields such as email, lens, contribution, concern, source page, status, created_at, and reviewed_at.

---

## API Endpoints

No new or modified API endpoints in Sprint 95.

Sprint 96 candidate endpoint:

| Method | Path | Description | Auth | Body | Response |
|---|---|---|---|---|---|
| `POST` | `/founding-circle/submissions` | Store a founding-circle interest note from `karmyq.org/join` | Public with rate limit/spam controls | `email`, `lens`, `contribution`, `concern`, optional `source` and honeypot | Canonical success/error envelope |

---

## Frontend Changes

### Landing App Routes

- `apps/landing/src/app/page.tsx` becomes the story-only home route.
- Add `apps/landing/src/app/principles/page.tsx`.
- Add `apps/landing/src/app/how-it-works/page.tsx`.
- Add `apps/landing/src/app/research/page.tsx`.
- Add `apps/landing/src/app/join/page.tsx`.
- Keep `apps/landing/src/app/docs/**` unchanged.
- Extract route metadata, nav links, and key copy into pure TypeScript modules so the current
  landing Jest harness can test the route contract without adding a React/jsdom test stack.

### Shared Landing Shell

- Update `apps/landing/src/components/Header.tsx` from anchor navigation to route navigation.
- Nav on every public route: `Story`, `Principles`, `How it works`, `Research`, `Join the circle`, `Docs`.
- `Join the circle` is the nav button, not duplicated as a plain text nav item.
- Mobile hamburger must include the full nav loop and close after navigation.
- Footer should continue to distinguish `karmyq.org` as commons and `karmyq.com` as platform.

### Content Migration

- Use each supplied HTML file's meta description as written for its route metadata.
- Home page contains the story only; mechanics, principles, thinkers, and invitation move out.
- Remove all "LinkedIn relaunch" wording.
- Remove any Roy quote.
- Merge the two reputation essays into one: "The Problem with Stars"; do not keep "In Defense of Gossip" as a separate essay/card.
- Add "Why No Role Is Permanent" as the governance/growth essay.
- Rewrite the reputation feature box as "Being known, not being seen."
- Render `.star-line` copy as visually isolated emphasis lines, not ordinary paragraphs.

### Queued Logo Fix

Fold in the already staged-in-working-tree frontend shell logo polish:

- `apps/frontend/src/styles/karmyq-shell.css` `.kq-wordmark-seed` uses `/brand/karmyq-mark.svg`.
- Keep the 24px full mark chosen by the maintainer.
- Treat this as a carry-forward polish item, not a separate deploy.

---

## User Guide & Doc Updates

- Create ADR-075 for the public-site route split and the Sprint 95/Sprint 96 boundary.
- Update `docs/ARCHITECTURE.md` public surfaces / landing site notes if the current text still describes `karmyq.org` as a single-page landing site.
- Update `docs/adr/README.md` for ADR-075.
- Generate landing docs from sources and verify ADR-075 appears in the generated landing docs mirror.
- Verify `apps/landing/src/data/docs/concepts/adr-075-karmyq-org-multi-route-relaunch.json` exists after generation.
- Verify `apps/landing/src/data/docs/nav.json` contains the ADR-075 entry after generation; `nav.json` has silently reverted in prior sprints.
- Remember generated landing docs may require `git add -f`.
- No `services/registry.json` change in Sprint 95 because no service endpoint changes.

---

## Critical Implementation Notes

1. The five supplied HTML files are the content and organization source of truth, but the live landing design system remains the visual source of truth. Do not paste their standalone CSS wholesale.
2. `/docs` must remain unchanged and reachable from every page.
3. `apps/landing` is a static export (`output: 'export'`), so Sprint 95 cannot use Next API routes for join submission.
4. Sprint 96 owns backend-backed founding-circle intake. Sprint 95 keeps mailto/contact fallback and should not create database/API surface.
5. Use each source file's meta description exactly for its corresponding route.
6. Never imply: acts broadcast to the community; karma carrying to daughter communities after fission; automatic splitting at the Dunbar threshold; a founder group; moderation features; governance templates; user-level questionnaires; Bayesian updating; federation; or a community-of-communities layer.
7. Copy voice test: any sentence touched should feel like it could appear in a long-form magazine essay. Avoid body-copy spec language such as "executes atomically," "in parallel," "algorithm," and similar implementation phrasing.
8. "The Problem with Stars" is the single merged reputation essay. "In Defense of Gossip" may appear as an internal section heading inside that essay only if it reads naturally, but not as a separate essay/card.
9. `.star-line` text should be styled as isolated emphasis lines, not visually treated as body paragraphs.
10. Mobile nav validation is mandatory after deployment because five pages make the hamburger menu a real primary navigation surface.
11. Preserve the existing unstaged logo fix in `apps/frontend/src/styles/karmyq-shell.css`; do not revert it while editing landing files.
12. `apps/landing` currently has a pure TypeScript Jest harness only (`**/tests/**/*.test.ts`, no `.tsx`, no jsdom). Do not create `.test.tsx` component-rendering tests unless the harness is explicitly upgraded. Prefer pure `.test.ts` tests against extracted route/nav/content modules.
