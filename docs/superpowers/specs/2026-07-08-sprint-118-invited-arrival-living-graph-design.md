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
belonging graph (you on the ring of the community you just entered, plus — on the invite path —
the **invitation bond** to your inviter, rendered distinctly from trust because trust is earned
through exchanges, not conferred by an invite) before one guided first action. On the other end of
a bond's life, the ego graph completes its **growing/fading story**: the fading half already ships
(links carry `decayTier` — strong/warm/fading/nearly-forgotten — rendered as opacity bands with an
inline legend); this sprint adds the *growing* half — a qualitative `formedRecently` flag so newly
formed bonds read as new — plus a legend entry. Finally, BUG-028 — the connected-badge and the
graph disagreeing about whether two people are connected — is investigated and fixed at the correct
layer, so the graph the arrival moment celebrates is also *true*.

### Core Principle: The Graph Is Alive

Sprint 115 made position **earned**; Sprint 118 makes state **lived** — bonds are visibly born at
arrival, visibly strengthen, and visibly fade, and every surface that claims a connection must agree
with the graph.

---

## Multi-Sprint Arc

### Sprint 115 — Earned Structure (complete, ADR-083)
Ego BFS orbits + community ring: position derives only from disclosed topology.

### Sprint 118 — Invited Arrival & the Living Graph (this sprint)
The join funnel delivers a member *into* their graph; the growing/fading edge story is completed
(`formedRecently` joins the existing `decayTier`); connection claims are consistent (BUG-028).

### Future — Presentation continues
The maintainer's standing question — "what is the ONE thing each graph should say at a glance?" —
was answered for ego this sprint (*your web is growing/fading*). Community and across-communities
answers remain open threads.

---

## New Concepts

- **Arrival Moment** — a dedicated, skippable funnel step (`/welcome`) shown once per account after
  a member's first community join. Renders the member's actual nascent belonging graph — never a
  stock illustration — then offers exactly one guided action (see the community's open asks).
- **Invitation bond** — the inviter↔invitee relationship born at invitation acceptance
  (`auth.user_invitations` / `users.invited_by`). It is provenance, **not** a trust edge — trust is
  earned through exchanges (ADR-070/077; earned-structure principle). The arrival moment renders it
  distinctly from trust edges, with copy that the bond *becomes* trust through helping. It is drawn
  from the invite-funnel context itself; the ego graph does not gain invitation edges this sprint.
- **`formedRecently`** — a qualitative, privacy-safe boolean per disclosed link, derived
  server-side: the pair's *first* edge formation (`MIN(created_at)` across the pair's per-community
  edges) falls within a 30-day window constant. Supplements the existing `decayTier` field — never
  replaces it, never exposes a timestamp or numeric weight (ADR-082 holds). A long-standing pair
  that adds an edge in a new community is *not* "new".
- **Invite-primary funnel** — invitation is the celebrated join path; open registration remains
  fully supported but visually secondary, and both paths end at the same arrival moment.

---

## Data Model

**No schema changes.** `formedRecently` is derived at query/projection time from the existing
`social_graph.trust_edges.created_at` (the neighborhood links query gains
`MIN(tel.created_at) AS formed_at` per grouped pair — internal only, never exposed outward). If
investigation of BUG-028 requires a data repair on the curated demo baseline, it ships as a
fixture/manifest change in the simulation service, not a migration.

---

## API Endpoints

| Method | Path | Change | Notes |
|--------|------|--------|-------|
| GET | `/trust/neighborhood/:userId` | **Modified** — each link gains `formedRecently: boolean` (existing `decayTier` untouched) | Links query adds `MIN(created_at)` per pair; boolean derived in `disclosureProjection.ts`; qualitative only (ADR-082) |
| GET | `/paths/:targetUserId` | **Possibly modified** (BUG-028) | Mounted at `/paths` (not under `/trust`). Uses `computeTrustPath` + the `auth.social_distances` cache (platform-wide exchange topology) — a different derivation than the neighborhood's community-scoped disclosed `trust_edges_live`. Investigation decides the fix layer; badge and graph must agree. |
| — | Auth register / invitation validate/accept | Unchanged | `/invite/[code]` already receives inviter + community context from validate; accept returns `inviter_id` + `community_id` — the arrival renders the invitation bond from this funnel context, no new endpoint |

---

## Frontend Changes

| Surface | Change |
|---------|--------|
| `pages/invite/[code].tsx` | Redesigned as the landing: community + inviter context is the card; the account form lives inside it. On success → `/welcome?invite=...` (arrival), not straight into the community. |
| `pages/register.tsx` | Invite-primary nudge ("Have an invitation? Start there.") above the form; open path otherwise unchanged in fields. On success → `/communities?welcome=true` as today. |
| `pages/communities/index.tsx` | Welcome-flow first join routes to `/welcome` (arrival) instead of `/dashboard`; **stops pre-setting the onboarded key** (it is written only when `/welcome` completes or is skipped). |
| **New** `pages/welcome.tsx` | Arrival moment: full-screen, unhurried, skippable. Invite path renders you on the joined-community ring + the invitation bond to your inviter (distinct chord style + "this bond becomes trust when you help each other" copy); open path renders you on the community ring. One CTA → the community's open asks. Completion/skip writes the user-scoped onboarded key. |
| **New** `components/graphs/ArrivalGraph.tsx` | Purpose-built arrival presentation reusing the ring/orbit primitives — explicitly NOT gated by the sparse short-circuit that makes `EgoOrbitGraph`/`CommunityRingGraph` early-return an empty state (`EgoOrbitGraph.tsx:102`). A zero-trust-edge arrival (you among your new neighbors on the ring) is the intended picture. |
| `components/WelcomeModal.tsx` | Gates on a **user-scoped** key (`karmyq_onboarded:<userId>`, honoring the legacy global `karmyq_onboarded` so existing users see no modal); suppressed for joins that passed through `/welcome`. |
| `components/graphs/EgoOrbitGraph.tsx` + `graphVisualEncoding.ts` | `formedRecently` links get a "new" emphasis layered on top of the EXISTING `decayTier` opacity bands (strong/warm/fading/nearly_forgotten — untouched). The existing inline legend gains a "New" entry. No layout change (ADR-083 orbits untouched). |
| `components/requests/ConnectionBadge.tsx` (+ relationship-context surfaces) | BUG-028: consume the unified connection derivation; badge text/degree must match what the graph can show. |
| `lib/onboarding/workflows.ts` | Communities workflow gains an arrival/joining step; feed workflow step 5 updated if wording drifts. |

---

## User Guide & Doc Updates

*(Mandatory — content authored this sprint, wiring checked by the drift gate.)*

- **New User Guide** — `apps/landing/src/data/docs/guides/`: **"Joining Karmyq"** — the invite path,
  the open path, the arrival moment, what your first graph means. Wire into `nav.json`.
- **Update guide/concept** covering the network/belonging graph: the completed growing/fading story
  (new-bond emphasis joining the existing memory-fades encoding), what the invitation bond is and
  how it differs from trust.
- **New ADR-085** — `docs/adr/ADR-085-invited-arrival-and-edge-lifecycle.md`: invite-primary funnel,
  arrival moment as a funnel step, invitation-bond-is-not-trust semantics, and the qualitative
  `formedRecently` projection (incl. the MIN-formation age rule and 30-day window). Add to
  `docs/adr/README.md` index **and** as ADR JSON in `apps/landing/src/data/docs/concepts/` wired
  into `nav.json`.
- **Onboarding workflows** — `apps/frontend/src/lib/onboarding/workflows.ts` (see Frontend Changes).
- **BUG-028** — resolve the entry in `docs/BUGS.md`; document root cause in the owning service's
  `CONTEXT.md` "Recent Fixes".
- **CONTEXT.md / registry.json** — social-graph-service endpoint changes (`formedRecently` field, any
  paths change); frontend `.claude/README.md` if the funnel map changes it.

---

## Critical Implementation Notes

1. **Fix BUG-028 before building the arrival moment.** The arrival celebrates a connection; it must
   not celebrate one the graph can't substantiate. Follow the Bug Fixing discipline: reproduce on
   the curated demo baseline, identify the layer — the badge uses `GET /paths/:id`
   (`computeTrustPath` + the `auth.social_distances` cache; platform-wide exchange topology), the
   graph uses community-scoped disclosed `trust_edges_live` with active-membership joins via
   `/trust/neighborhood` — grep ALL surfaces consuming each derivation, fix at the source, never a
   client-side patch.
2. **The inviter bond is an invitation relationship, NOT a trust edge.** Invitation acceptance
   writes `auth.user_invitations` / `users.invited_by` / membership only; `/trust/neighborhood`
   traverses `trust_edges_live` exclusively — no inviter edge exists in the belonging graph. The
   arrival renders the invitation bond from the invite-funnel context (validate/accept responses),
   visually distinct from trust edges, with "this bond becomes trust when you help each other"
   copy. **Never manufacture a trust edge from an invitation** (earned-structure principle,
   ADR-070/077/083). The ego graph does not gain invitation edges this sprint.
3. **`formedRecently` supplements the existing `decayTier` contract — it does not replace it.**
   Links already carry `decayTier` (strong/warm/fading/nearly_forgotten) rendered via the OPACITY
   bands in `graphVisualEncoding.ts` plus an inline ego legend — leave both exactly as they are and
   pin them with regression assertions. Server-side: the links query gains
   `MIN(tel.created_at) AS formed_at` per grouped pair (first formation across communities = the
   relationship's age; a long-standing pair adding a new community edge is NOT new); the projection
   derives `formedRecently: boolean` against one 30-day window constant. No timestamp or numeric
   leaves the server (ADR-082).
4. **No layout changes to the ego graph (ADR-083).** Orbits, ring placement, expansion arcs stay
   exactly as S115 shipped them. This sprint changes edge *rendering* only.
5. **The arrival graph must bypass the sparse short-circuit — it is the design, not an empty
   state.** `EgoOrbitGraph` (and the ring renderer) early-return an empty state on sparse graphs
   (`EgoOrbitGraph.tsx:102`); the new purpose-built `ArrivalGraph` reuses the ring primitives but
   is never gated on edge count. A zero-trust-edge open-path arrival (you among your new neighbors
   on the community ring) and a one-bond invite arrival must both read as intentional.
6. **Do not break the curated demo.** `/auth/demo-session` and the Maria story flows must be
   untouched; protected demo personas are excluded from any manual smoke-test signups. New-bond
   emphasis will change how recent demo edges LOOK — expected; verify Maria's rich story still
   reads (`maria.reyes` is the rich view; most sim users are sparse).
7. **Registration side effects must be preserved on the redesigned invite page:** store `token`,
   `refreshToken`, `user`, clear `demoContext` (see `register.tsx`), and remember
   `ApiClient.login/register` set the auth token automatically since #140. On join, refresh
   membership state by decoding the new JWT — never hand-construct `communities`.
8. **`getMyCommunities` returns `{communities,count,total}`, not an array** — extract defensively
   anywhere the funnel or arrival reads it (S113 crash pattern).
9. **jsdom/D3 test gotchas apply to the graph work:** map `^d3$` → `d3/dist/d3.min.js`, stub
   ResizeObserver, seed `node.__zoom` directly; `next/router` is globally mocked in `jest.setup`.
10. **`nav.json` silently reverts** — grep-verify the wiring after editing; re-apply if needed.
11. **New TDD tests start in the changed workspace's `tests/tdd/`** (social-graph-service, frontend,
    root `tests/` for cross-workspace) and promote when green. Run cross-workspace suites directly
    (`cd tests && npx jest ...`) — Turbo's cache hides cross-workspace failures.
12. **Arrival is once per account — use a user-scoped key, written only at the end.**
    `karmyq_onboarded` today is a browser-global localStorage key set BEFORE the arrival would run
    (`communities/index.tsx` sets it at join). Switch the gate to `karmyq_onboarded:<userId>`,
    written ONLY when `/welcome` completes or is skipped; `WelcomeModal` and the arrival gate also
    honor the legacy global key so existing users see nothing new. Skip must be as graceful as
    completion (both write the key, both land on the guided destination). Deep-linking `/welcome`
    with no joined community redirects harmlessly to `/dashboard`.
13. **Keep the funnel rework bounded to the join surfaces named above.** No auth-service contract
    changes; if the invitation-validate payload lacks something the new landing needs, extend the
    projection, don't invent a parallel endpoint (Update, Don't Create).
14. **Post-deploy bookkeeping rides the NEXT PR.** Flipping ADR-085 → `Implemented` and marking the
    handoff COMPLETE happen after deploy, which is after merge — leave those edits uncommitted (no
    docs-only master push; S117 precedent) so they ride the next PR.
