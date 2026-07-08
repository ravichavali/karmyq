# Sprint 118: Invited Arrival & the Living Graph — Design Spec

**Date**: 2026-07-08
**Status**: Approved
**Version**: v11.26.0 → v11.27.0
**Sprint Branch**: `feature/sprint-118-invited-arrival-living-graph`

---

## Overview

Joining Karmyq today is transactional. Open registration is a bare form that dumps the new member
onto a community list to shop from; the invitation path — the one moment where a real trust edge is
*born* — renders that birth as another registration form and never shows the relationship. Meanwhile
the belonging graph, "the primary way Karmyq tells a member's story" (ADR-081), is only met long
after the join moment, when a new member opening `/network` sees the sparse-ego empty state.

This sprint reworks the join funnel **invite-primary**: the invitation page becomes the landing —
the community and inviter are the context, account creation happens inside that context — and both
join paths converge on a dedicated **arrival moment** route where the new member sees their first
belonging graph (you + your inviter edge + the community you just entered) before one guided first
action. On the other end of a bond's life, the ego graph gains a **growing/fading lifecycle
encoding**: each edge renders its ADR-070 decay state (new / active / fading / nearly forgotten) so
the graph reads as a living web, not a static structure. Finally, BUG-028 — the connected-badge and
the graph disagreeing about whether two people are connected — is investigated and fixed at the
correct layer, so the graph the arrival moment celebrates is also *true*.

### Core Principle: The Graph Is Alive

Sprint 115 made position **earned**; Sprint 118 makes state **lived** — bonds are visibly born at
arrival, visibly strengthen, and visibly fade, and every surface that claims a connection must agree
with the graph.

---

## Multi-Sprint Arc

### Sprint 115 — Earned Structure (complete, ADR-083)
Ego BFS orbits + community ring: position derives only from disclosed topology.

### Sprint 118 — Invited Arrival & the Living Graph (this sprint)
The join funnel delivers a member *into* their graph; edges carry lifecycle state; connection
claims are consistent (BUG-028).

### Future — Presentation continues
The maintainer's standing question — "what is the ONE thing each graph should say at a glance?" —
was answered for ego this sprint (*your web is growing/fading*). Community and across-communities
answers remain open threads.

---

## New Concepts

- **Arrival Moment** — a dedicated, skippable funnel step (`/welcome`) shown once after a member's
  first community join. Renders the member's actual nascent belonging graph — never a stock
  illustration — then offers exactly one guided action (see the community's open asks).
- **Edge lifecycle state** — a qualitative, privacy-safe outward label per disclosed edge:
  `new | active | fading | nearlyForgotten`, derived server-side from the ADR-070 decay tier plus
  edge age. Never a numeric weight (ADR-082 holds).
- **Invite-primary funnel** — invitation is the celebrated join path; open registration remains
  fully supported but visually secondary, and both paths end at the same arrival moment.

---

## Data Model

**No schema changes.** Lifecycle state is derived at projection time from existing columns
(`social_graph.trust_edges` decay classification + edge timestamps). If investigation of BUG-028
requires a data repair on the curated demo baseline, it ships as a fixture/manifest change in the
simulation service, not a migration.

---

## API Endpoints

| Method | Path | Change | Notes |
|--------|------|--------|-------|
| GET | `/trust/neighborhood/:userId` | **Modified** — each link gains `lifecycle: 'new'\|'active'\|'fading'\|'nearlyForgotten'` | Derived in `disclosureProjection.ts` from decay tier + edge age; qualitative only (ADR-082) |
| GET | `/trust/paths/:targetUserId` | **Possibly modified** (BUG-028) | Investigation decides the layer; the badge and the graph must share one connection derivation |
| — | Auth register / invitation validate | Unchanged | `/invite/[code]` already receives inviter + community context from validate |

---

## Frontend Changes

| Surface | Change |
|---------|--------|
| `pages/invite/[code].tsx` | Redesigned as the landing: community + inviter context is the card; the account form lives inside it. On success → `/welcome?invite=...` (arrival), not straight into the community. |
| `pages/register.tsx` | Invite-primary nudge ("Have an invitation? Start there.") above the form; open path otherwise unchanged in fields. On success → `/communities?welcome=true` as today. |
| `pages/communities/index.tsx` | Welcome-flow first join routes to `/welcome` (arrival) instead of `/dashboard`; keeps `karmyq_onboarded` semantics. |
| **New** `pages/welcome.tsx` | Arrival moment: full-screen, unhurried, skippable. Invite path renders you + inviter edge + joined-community ring; open path renders you + community ring (no inviter edge). One CTA → the community's open asks. Reuses `EgoOrbitGraph` / `CommunityRingGraph`. |
| `components/WelcomeModal.tsx` | Suppressed for joins that passed through `/welcome` (arrival replaces it); unchanged for legacy/demo sessions. |
| `components/graphs/EgoOrbitGraph.tsx` + `graphVisualEncoding.ts` | Edges render lifecycle state: `new` = full intensity + subtle emphasis, `active` = current bands, `fading` = reduced presence, `nearlyForgotten` = ghosted. No layout change (ADR-083 orbits untouched). |
| **New** ego memory legend | "How memory fades" legend adapted from the community view onto `/network?mode=ego`. |
| `components/requests/ConnectionBadge.tsx` (+ relationship-context surfaces) | BUG-028: consume the unified connection derivation; badge text/degree must match what the graph can show. |
| `lib/onboarding/workflows.ts` | Communities workflow gains an arrival/joining step; feed workflow step 5 updated if wording drifts. |

---

## User Guide & Doc Updates

*(Mandatory — content authored this sprint, wiring checked by the drift gate.)*

- **New User Guide** — `apps/landing/src/data/docs/guides/`: **"Joining Karmyq"** — the invite path,
  the open path, the arrival moment, what your first graph means. Wire into `nav.json`.
- **Update guide/concept** covering the network/belonging graph: add the edge-lifecycle encoding and
  the ego memory legend (growing/fading story, what "nearly forgotten" means, how to keep a bond).
- **New ADR-085** — `docs/adr/ADR-085-invited-arrival-and-edge-lifecycle.md`: invite-primary funnel +
  arrival moment as a funnel step + qualitative edge-lifecycle projection. Add to `docs/adr/README.md`
  index **and** as ADR JSON in `apps/landing/src/data/docs/concepts/` wired into `nav.json`.
- **Onboarding workflows** — `apps/frontend/src/lib/onboarding/workflows.ts` (see Frontend Changes).
- **BUG-028** — resolve the entry in `docs/BUGS.md`; document root cause in the owning service's
  `CONTEXT.md` "Recent Fixes".
- **CONTEXT.md / registry.json** — social-graph-service endpoint changes (`lifecycle` field, any
  paths change); frontend `.claude/README.md` if the funnel map changes it.

---

## Critical Implementation Notes

1. **Fix BUG-028 before building the arrival moment.** The arrival celebrates a connection; it must
   not celebrate one the graph can't substantiate. Follow the Bug Fixing discipline: reproduce on
   the curated demo baseline, identify the layer (the badge uses `GET /paths/:id`; the graph uses
   disclosed trust edges via `/neighborhood`), grep ALL surfaces consuming each derivation, fix at
   the source — never a client-side patch.
2. **Lifecycle is qualitative and server-derived (ADR-082).** The outward projection may say
   `fading`, never `weight: 0.23`. Do the derivation in `disclosureProjection.ts` where decay
   classification already lives; the frontend only maps labels to styles.
3. **No layout changes to the ego graph (ADR-083).** Orbits, ring placement, expansion arcs stay
   exactly as S115 shipped them. This sprint changes edge *rendering* only.
4. **The one-edge arrival graph is the design, not an empty state.** Do not reuse the sparse-ego
   empty-state copy on `/welcome`; a single bright new edge with the community ring is the intended
   picture. Open-path arrivals (no inviter edge) show you + the community ring and must also read
   as intentional.
5. **Do not break the curated demo.** `/auth/demo-session` and the Maria story flows must be
   untouched; protected demo personas are excluded from any manual smoke-test signups. New encoding
   will change how the demo's fading edges LOOK — that's expected and desirable; verify Maria's
   rich story still reads (`maria.reyes` is the rich view; most sim users are sparse).
6. **Registration side effects must be preserved on the redesigned invite page:** store `token`,
   `refreshToken`, `user`, clear `demoContext` (see `register.tsx`), and remember
   `ApiClient.login/register` set the auth token automatically since #140. On join, refresh
   membership state by decoding the new JWT — never hand-construct `communities`.
7. **`getMyCommunities` returns `{communities,count,total}`, not an array** — extract defensively
   anywhere the funnel or arrival reads it (S113 crash pattern).
8. **jsdom/D3 test gotchas apply to the graph work:** map `^d3$` → `d3/dist/d3.min.js`, stub
   ResizeObserver, seed `node.__zoom` directly; `next/router` is globally mocked in `jest.setup`.
9. **`nav.json` silently reverts** — grep-verify the wiring after editing; re-apply if needed.
10. **New TDD tests start in the changed workspace's `tests/tdd/`** (social-graph-service, frontend,
    root `tests/` for cross-workspace) and promote when green. Run cross-workspace suites directly
    (`cd tests && npx jest ...`) — Turbo's cache hides cross-workspace failures.
11. **Arrival is once-per-account and skippable.** Gate on first community join; a skip must be as
    graceful as completion (both mark `karmyq_onboarded`, both land on the guided destination).
    Deep-linking `/welcome` with no joined community redirects harmlessly to `/dashboard`.
12. **Keep the funnel rework bounded to the join surfaces named above.** No auth-service contract
    changes; if the invitation-validate payload lacks something the new landing needs, extend the
    projection, don't invent a parallel endpoint (Update, Don't Create).
