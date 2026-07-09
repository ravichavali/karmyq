# Sprint 119: Truthful Surfaces & the Fractal Story — Design Spec

**Date**: 2026-07-09
**Status**: Approved
**Version**: v11.27.0 → v11.29.0 (PR A ships v11.28.0, PR B ships v11.29.0)
**Sprint Branches**: `feature/sprint-119-truthful-surfaces` (PR A), `feature/sprint-119-graph-presentation` (PR B, created after PR A merges)

---

## Overview

Sprint 118 fixed BUG-028 at the derivation layer and shipped the ego graph's at-a-glance answer
("your web is growing/fading"), but its human validation surfaced BUG-029: the deliberately
preserved `community_member` fallback **manufactures a person route that does not exist** —
`computeCommunityPath` inserts the community's earliest-joined admin as a path node, and
`TrustPathBadge` renders it as "via Nadia Ito". Nadia is not an intermediary of anything. This
sprint finishes the job S118 started: **no surface may claim structure the data doesn't contain**
(PR A), and then closes the presentation question opened by the S114 revert by giving the two
remaining graph scales their at-a-glance answers (PR B).

PR A is the truth-and-polish half: the BUG-029 fix at both ends (server path shape + badge
wording), the `community/[id]` first-join arrival gap (joins from a community page currently
bypass the `/welcome` arrival S118 built), a shared `setAuthSession` helper extracting the
five-site token/refreshToken/user/demoContext write sequence, and header de-congestion lever 2
(moving Communities/Service Providers out of the crowded topbar).

PR B is the fractal half. S115 (ADR-083) made position earned; S118 (ADR-085) made ego edge state
lived. The maintainer has now chosen the remaining two answers: the **community ring answers
"where do you fit?"** (the viewer's own place in the room — your bonds emphasized, everything else
quiet context), and the **across-communities hub answers "which of your communities are woven
together?"** (bridge emphasis with an aliveness read derived from existing cross-interaction
recency). ADR-086 records all three scale answers as the completed presentation decision.

### Core Principle: Every scale answers one question, and never with invented structure

A member glancing at any belonging graph gets exactly one story per zoom level — ego: "is my web
growing or fading?", community: "where do I fit?", across-communities: "which of my communities
are woven together?" — and every claim on every surface is derivable from disclosed data.

---

## Multi-Sprint Arc — "The Graph Is Alive" / belonging-graph presentation

### Sprint 115 — Earned Structure (complete, ADR-083)
Position earned from disclosed topology: ego BFS orbits, community single ring, hub for
across-communities. Killed the force layout ("doesn't tell a meaningful story").

### Sprint 118 — Invited Arrival & the Living Graph (complete, ADR-085)
Ego's answer shipped: growing (`formed_recently` new-bond emphasis) / fading (`decayTier` bands).
Invite-primary funnel + `/welcome` arrival. BUG-028 fixed at the derivation layer.

### Sprint 119 — Truthful Surfaces & the Fractal Story (this sprint, ADR-086)
PR A: BUG-029 + S118 follow-ups + header lever 2. PR B: community + across-communities at-a-glance
answers — **the presentation question opened after the S114 revert closes here**.

### Future (not this sprint)
Desktop/mobile five-second-test UX pass; init.sql regeneration (own sprint); docs-token cleanup.

---

## New Concepts

- **Scale answer** — the single at-a-glance question a graph scale answers. Ego = "growing or
  fading?" (S118); community = "where do you fit?"; across-communities = "which are woven
  together?". Documented in ADR-086.
- **Bridge aliveness (`active_recently`)** — a fail-closed boolean on across-communities organic
  links: `community_trust_edges.last_interaction_at` within the same 30-day window constant S118
  introduced for `formed_recently`. Qualitative only; no timestamp or numeric leaves the server
  (ADR-082 discipline).
- **Viewer anchor** — the community ring rotates so the viewing member sits at 12 o'clock. A view
  convention, not invented structure: ring order/membership is unchanged, only the rotation origin.
- **Truthful community-path shape** — a `community_member` path is two endpoints plus
  `community_name`. No third person is ever inserted into it.

---

## Data Model

**No schema changes in either PR.**

- BUG-029 is a projection-shape fix; existing cached `community_member` rows in
  `auth.social_distances` become harmless once no renderer names the admin (their `path_data`
  middle node is simply ignored/absent going forward — no migration, no cache purge needed).
- Bridge aliveness derives from the existing `social_graph.community_trust_edges.last_interaction_at`
  column (present since the 20260525 trust-graph foundation migration).

---

## API Endpoints

| Method | Path | Change | PR |
|--------|------|--------|----|
| GET | `/paths/:targetUserId` (social-graph) | `community_member` paths: `path` = `[source, target]` endpoints only + `community_name`; **no admin node**. `connection_type` and `degrees: 2` unchanged (feed-ranking proximity preserved — maintainer decision). | A |
| POST | `/paths/batch` (social-graph) | Same shape change for `community_member` entries. | A |
| GET | `/trust/communities` (social-graph) | Organic links gain `active_recently: boolean` (fail-closed from `last_interaction_at` vs the shared 30-day constant). Fission links unchanged. No other fields added. | B |
| GET | `/trust/graph/:communityId/full` | **Unchanged.** "Where do you fit?" is client-side viewer emphasis; do NOT add `formed_at` to community queries (weaving/fraying was considered and not chosen). | — |

---

## Frontend Changes

### PR A — Truthful surfaces
- **`TrustPathBadge.tsx`** — `community_member` renders "Fellow member of {community}" (full) /
  "in {community}" (feed-compact); **never "via {person}"** and no person-chain row for this type.
  `invitation_chain` wording reviewed: "Joined through {inviter}" is factual provenance — keep
  unless review finds a surface where it reads as a trust claim.
- **`pages/communities/[id].tsx`** — first public join routes through the S118 arrival: write
  user-stamped `karmyq_arrival` sessionStorage + `router.push('/welcome')`, gated identically to
  `communities/index.tsx` (only when `karmyq_onboarded:<userId>` and the legacy global key are
  both absent; otherwise current behavior).
- **`lib/session.ts` (new)** — `setAuthSession({ token, refreshToken, user })` extracts the
  repeated write sequence (store token/refreshToken/user, clear `demoContext`); migrate the five
  call sites: `login.tsx`, `register.tsx`, `invite/[code].tsx`, `demo.tsx`, `dashboard.tsx`.
- **`Layout.tsx` topbar** — lever 2 of header de-congestion: audit md–xl widths first, then move
  Communities / Service Providers (+ "Become a provider") from `kq-topnav` into an overflow ("More")
  affordance or the existing avatar menu, keeping Network in the topnav. Lever 1
  (`--measure-chrome: 72rem` via `kq-page`) is **already applied** — verified during planning; do
  not redo it. Don't regress the BUG-016 breathing-room rhythm.

### PR B — The fractal story
- **`graphs/CommunityRingGraph.tsx`** — viewer anchor (rotate ring so the caller is at 12
  o'clock); default state emphasizes the viewer's chords (existing caller-amber at full presence)
  while non-viewer chords render quieted until a focus interaction (decayTier opacity bands stay
  the relative encoding within each group); a one-line qualitative place summary ("You're bonded
  with N of the M members shown" / honest "No bonds here yet — help someone to start weaving in");
  "You" legend entry.
- **`graphs/CommunityHubGraph.tsx`** — bridges between two member communities (both endpoints
  `is_member`) render emphasized; bridges to periphery quieter; `active_recently` bridges get an
  aliveness treatment (reuse the S118 new-bond green family for consistency); legend entries
  ("Woven bridge — recent exchange", "Dormant bridge").
- **`graphs/graphVisualEncoding.ts`** — the new constants/helpers live here (single source of
  encoding truth); shipped contracts (decayTier bands, new > caller > focused stroke precedence)
  untouched and pinned by regression assertions.

---

## User Guide & Doc Updates

Mandatory, per PR:

**PR A:**
- `docs/BUGS.md` — BUG-029 → fixed (root cause + fix layer), riding the same PR.
- **Joining Karmyq guide** (`docs/guides/` + landing) — one addition: first join from a community
  page also lands on the welcome arrival (parity with the communities index path).
- **Trust-path / connection badge concept coverage** — wherever the badge's meaning is documented,
  reflect the truthful `community_member` wording ("Fellow member of {community}", no person route).
- Service `CONTEXT.md` (social-graph) — paths endpoint shape change under "API Endpoints" +
  "Recent Fixes"; `services/registry.json` if the endpoint description changes.
- Landing regen via `scripts/generate-docs.ts`; grep-verify `nav.json` after.

**PR B:**
- **ADR-086 — "Scale Answers: one question per zoom level"** (`docs/adr/` + index + landing ADR
  JSON + nav.json): records all three scale answers, the S114-revert lineage
  (ADR-083 → ADR-085 → this), the viewer-anchor convention, bridge aliveness, and the explicit
  rejection of manufactured emphasis (ties to BUG-029).
- **Living-graph / trust-graph user guide** — new sections for the community scale ("where you
  fit") and across-communities scale ("woven bridges"), matching the S118 ego section's voice.
- **Onboarding workflow** (`apps/frontend/src/lib/onboarding/workflows.ts`) — check whether the
  network-exploration step mentions the community view; update copy if it names what the views show.
- social-graph `CONTEXT.md` + `registry.json` for the `/trust/communities` projection change.

---

## Critical Implementation Notes

1. **BUG-029 is fixed at BOTH ends, presentation-truthful (maintainer-decided shape).** Server:
   `computeCommunityPath` (`pathComputation.ts:281`) returns endpoints + `community_name` only —
   the earliest-joined-admin lookup goes away entirely. Keep `connection_type: 'community_member'`
   and **keep `degrees: 2`** (feed proximity ranking preserved). Client: `TrustPathBadge.tsx` has
   TWO render sites that name the admin (full ~line 88, feed-compact ~line 112) — fix both, and
   grep for any other consumer of `community_member` path nodes before declaring done (Bug Fixing
   discipline: find ALL instances). Existing cached rows become harmless via the renderer; do not
   write a cache purge.
2. **`computeInvitationPath` wording is provenance, likely fine — review, don't rewrite.**
   "Joined through {inviter}" states a fact (`invited_by`). Only change it if a surface renders it
   in a way that reads as a live trust route.
3. **Arrival gap: reuse the exact S118 pattern, including its gates.** Copy the
   `communities/index.tsx:355-362` behavior (user-stamped `karmyq_arrival` sessionStorage →
   `/welcome`): fires only on a FIRST public join (both `karmyq_onboarded:<userId>` and the legacy
   global key absent), never for invite-funnel joins (those already route), never for existing
   members. `/welcome` deep-link with no membership already redirects to `/dashboard` — don't
   re-implement.
4. **`setAuthSession` must preserve exact side effects and nothing more.** Store `token`,
   `refreshToken`, `user`; clear `demoContext`. `ApiClient.login/register` already set the auth
   token since #140 — the helper must tolerate that, not double-manage it. Membership state comes
   from decoding the new JWT — never hand-construct `communities`. The JWT field is `communities`,
   not `communityMemberships`.
5. **Header: lever 1 is DONE — only lever 2 remains.** `kq-page` already carries
   `--measure-chrome: 72rem` (`karmyq-shell.css:7`). The desktop `kq-topnav` is `xl`-only by
   design (BUG-016). Audit md–xl before moving anything; the change is relocating
   Communities/Service Providers links, not another measure change.
6. **Ring: rotation only — no layout invention (ADR-083).** Ring membership, order, radius, chord
   geometry stay as S115 shipped them; the viewer anchor is a rotation of the existing order.
   decayTier opacity bands and the `new > caller > focused` stroke precedence
   (`graphVisualEncoding.ts`) are shipped contracts — pin both with regression assertions before
   touching emphasis.
7. **Do NOT add `formed_at` to community graph queries.** "Weaving or fraying?" was considered for
   the community scale and NOT chosen. `projectPersonGraph` fail-closes `formed_recently` to false
   without it — leave it that way on community endpoints.
8. **Bridge aliveness is server-derived and fail-closed (ADR-082).** `active_recently` = boolean
   from `last_interaction_at` against the SAME 30-day window constant S118 introduced (share the
   constant, don't mint a second window). No timestamps, weights beyond the existing field, or
   counts added to the projection.
9. **Demo look: check bridge data before judging the hub.** The demo trust graph is sparse (avg
   ~4.6 in-scope connections) and `community_trust_edges` may be thin on the curated baseline —
   verify degree/bridge counts in the DB before debugging an "inert" hub. `maria.reyes` is the
   rich view; the protected story core (maria.reyes / elena.torres / noah.williams /
   marcus.lee@test.karmyq.com) must never be signed up or mutated by smoke tests.
10. **jsdom/D3 gotchas apply to all graph tests**: `^d3$` → `d3/dist/d3.min.js` mapping, stub
    ResizeObserver, seed `node.__zoom` directly; `next/router` is globally mocked in `jest.setup`.
11. **`getMyCommunities` returns `{communities,count,total}`, not an array** — extract defensively
    anywhere PR A's funnel work reads it (S113 crash pattern).
12. **TDD placement + turbo cache**: new tests start in the changed workspace's `tests/tdd/`
    (social-graph-service, frontend); run cross-workspace suites directly
    (`cd tests && npx jest ...`) — Turbo's cache hides cross-workspace failures.
13. **`nav.json` silently reverts** — grep-verify wiring after every edit; re-apply if needed.
14. **Two-PR sequencing**: PR A branch exists (off `origin/master`, carrying the S118 bookkeeping
    edits per S118 note 14 — ADR-085 → Implemented, BUGS.md, archived handoff). PR B branches off
    `origin/master` AFTER PR A merges. Each PR merges via admin-authorized squash and deploys via
    CI/CD; no docs-only follow-up pushes to master. PR B's post-deploy bookkeeping (ADR-086 →
    Implemented, handoff COMPLETE) rides the NEXT sprint's first PR.
15. **Feed-ranking regression check for BUG-029**: `degrees: 2` for `community_member` feeds
    proximity ranking — after the path-shape change, assert the feed ranking inputs are unchanged
    (the fix is presentational; ranking must not move).
