# Sprint 84: Unified Feed & Dashboard Redesign — Research & Direction — Design Spec

**Date**: 2026-06-03
**Status**: Approved
**Version**: 10.8.0 → 10.8.0 (no bump — research/docs deliverable, `no-deploy`)
**Sprint Branch**: `feature/sprint-84-unified-feed-redesign-research`

---

## Overview

Karmyq's feed and dashboard surfaces grew by accretion. The logged-in dashboard
(`pages/dashboard.tsx`) is a tab shell — `browse` / `commitments` / `my-requests` — whose
`browse` tab renders `BrowseFeed` with three modes (provider / community / both). Separately,
each community has its own `BrowseTab` (586 lines) that re-implements a feed of the same
underlying requests, and there's a third `Feed/Feed.tsx` component. The result: **three
overlapping feed surfaces, borrowed social-media patterns, and no shared answer to "what is this
feed *for*."**

This sprint does not write the new feed. It produces the **design direction** that the next
sprints build against. The method is research-first (per our standing UX discipline): audit what
exists, catalog the real data and actions these surfaces carry, study products that solved
fit-for-purpose feeds, derive principles from Karmyq's actual job, and synthesize a single
unified information architecture — delivered as a written design-direction document plus
throwaway HTML/Tailwind mockups that can be opened in a browser and compared side by side.

### Core Principle: Design backward from the job, not forward from the pattern

Karmyq's feed exists to **connect a member who needs help with a member who can give it, inside a
community of trust.** It is not an engagement surface and does not need to scroll forever.
Curation, clarity, and "what should I do next" beat volume. Every redesign decision in the
deliverable must trace back to that job — borrowed infinite-scroll social patterns are explicitly
rejected unless re-justified from the job.

---

## Multi-Sprint Arc

### Sprint 83 — Founding-circle positioning + ADR-065 (complete)
Public-site positioning and content voice. Closed the outward/marketing phase.

### Sprint 84 — Unified Feed & Dashboard Redesign: Research & Direction (this sprint)
Turn back inward to the product. Produce the design-direction doc + mockups for the unified feed
system. **Deliverable is a document, not code.**

### Sprint 85+ — Implement the unified feed (upcoming)
Build the redesigned surfaces one vertical slice at a time against this sprint's direction.
Likely first slice: the dashboard home feed. Sequencing and scope are a Sprint 85 planning call.

---

## New Concepts

- **Unified feed system** — a single conceptual model for "a list of requests a member can act
  on," instantiated in two views: the **dashboard home** (all my communities, action-first) and
  the **community feed** (one community's activity). Same data model, same card vocabulary, same
  action affordances — different scope filters. The redesign collapses today's three divergent
  implementations into this one model.
- **Feed job-to-be-done** — the explicit statement of what a given feed view is for, written at
  the top of each view's section in the deliverable. Forces every component on that view to earn
  its place.
- **Action altitude** — the idea that the feed should foreground "what needs a decision from me"
  (offers to accept, requests I can fill, commitments due) above passive browsing.

---

## Data Model

**No schema changes this sprint.** Research only. The deliverable *catalogs* the existing data
the feed surfaces consume (request fields, match/offer states, trust signals, community scope)
so the redesign is grounded in real payloads — but it introduces no migrations and no new tables.

---

## API Endpoints

**No endpoint changes this sprint.** The deliverable catalogs which existing endpoints each
current surface calls (e.g. request listing, match/offer state, community membership) as input to
the redesign, but adds/modifies nothing. Any API implications are recorded as *recommendations
for Sprint 85*, not changes.

---

## Frontend Changes

**No production frontend changes this sprint.** The only built artifacts are **throwaway
HTML/Tailwind mockups** under `docs/design/sprint-84-unified-feed/mockups/`, served standalone
(Tailwind via CDN), not wired into the Next.js app and not part of any build. The existing
production components are *read for the audit* but **not modified**:

- `apps/frontend/src/pages/dashboard.tsx` — tab shell + browse-mode state
- `apps/frontend/src/components/BrowseFeed.tsx` — dashboard browse feed
- `apps/frontend/src/components/BrowseModeControl.tsx` — provider/community/both control
- `apps/frontend/src/components/community/tabs/BrowseTab.tsx` — community feed (586 lines)
- `apps/frontend/src/components/Feed/Feed.tsx` + `FeedItem.tsx` + `RequestPayloadRenderer.tsx`
- `apps/frontend/src/components/FeedFilterPanel.tsx`, `TabBar.tsx`
- `apps/frontend/src/components/CommitmentsTab.tsx`, `MyRequestsTab.tsx`
- `apps/frontend/src/components/dashboard/TrustNetworkWidget.tsx`, `ProviderDashboardCard.tsx`
- `apps/frontend/src/types/feed-items.ts`

---

## Deliverables (what this sprint produces)

1. **`docs/design/sprint-84-unified-feed/README.md`** — the design-direction document:
   - **Audit**: every current feed/dashboard surface, what it shows, what it duplicates, where
     it borrows social patterns that don't serve the job.
   - **Data & action inventory**: the real request/match/trust fields and the actions each card
     can trigger, sourced from the components and `feed-items.ts`.
   - **Reference study**: 3–5 fit-for-purpose products (not social feeds — think task/triage/
     mutual-aid/marketplace-coordination surfaces) and the specific patterns worth borrowing.
   - **Principles**: derived from the job-to-be-done, including the explicit rejection of
     infinite-scroll-for-its-own-sake.
   - **Unified information architecture**: the single feed model, its two views (dashboard home /
     community feed), the shared card vocabulary, and action altitude.
   - **Open questions + Sprint 85 recommendations**: sequencing, first slice, API/data
     implications.
2. **`docs/design/sprint-84-unified-feed/mockups/*.html`** — standalone HTML/Tailwind mockups of
   the redesigned dashboard home and community feed (at minimum: one of each; ideally a
   before/after pair so the direction is legible).

---

## User Guide & Doc Updates

This is a research/direction sprint with **no user-facing behavior change**, so no end-user guide
or onboarding workflow changes are warranted yet (those land with the Sprint 85 implementation).
The mandatory doc work for *this* sprint is the deliverable itself:

- **New**: `docs/design/sprint-84-unified-feed/README.md` (the design-direction doc).
- **Landing-page docs**: no concept/guide/service JSON changes — nothing shipped to users.
  A landing concept page describing the redesigned feed philosophy is a **Sprint 85** task, to
  ship alongside the implementation, not ahead of it.
- **No ADR this sprint**: the architectural decision (the unified feed model) is *proposed* by
  this research. The ADR is written when the direction is accepted for implementation in Sprint
  85, so its status starts at `Accepted`/`Implemented` against real code rather than vapor.

---

## Critical Implementation Notes

1. **Deliverable is a document, not code.** Do not start writing production feed components. If
   the sprint drifts toward editing `apps/frontend/src/components/`, stop — that's Sprint 85.
2. **Mockups are throwaway.** HTML/Tailwind via CDN, standalone files under
   `docs/design/sprint-84-unified-feed/mockups/`. Do **not** wire them into the Next.js build, do
   not add them to `apps/frontend`, do not import app components. They exist to be opened in a
   browser and compared.
3. **Design backward from the job.** Every section of the deliverable must trace its
   recommendations to "connect need with help inside a community of trust." Reject borrowed
   social-feed patterns unless re-justified from the job. (Source idea: `docs/IDEAS.md`
   [2026-05-20] framing note.)
4. **Audit before inventing.** Read all three current feed surfaces (`BrowseFeed`, community
   `BrowseTab`, `Feed/Feed.tsx`) before proposing the unified model — the redesign's whole point
   is collapsing their duplication, so it must be documented first.
5. **No schema/API/endpoint changes.** Any data the redesign wants that doesn't exist yet is
   logged as a *Sprint 85 recommendation*, not built.
6. **Unify, don't add a fourth surface.** The output is ONE feed model in two views, not a new
   parallel feed alongside the existing three.
7. **`no-deploy` sprint.** No version bump (stays 10.8.0), no merge-to-deploy step beyond merging
   the docs branch. Nothing reaches `karmyq.com`.
8. **`docs/` mockups & design folder are not in `.gitignore`** (that caveat is specific to
   `apps/landing/src/data/docs/`). Normal `git add` works for `docs/design/`.
