# Sprint 116: Living Demo — Earned Relationships and Guided Entry — Design Spec

**Date**: 2026-06-29
**Status**: Approved
**Version**: v11.22.0 → v11.24.0 (PR A: v11.23.0; PR B: v11.24.0)
**PR A Branch**: `agent/codex/sprint-116-relationship-shape`
**PR B Branch**: `agent/codex/sprint-116-guided-entry` (from merged PR A)

---

## Overview

Sprint 115 made the belonging graphs structurally honest: deterministic layouts, equal person nodes,
direct disclosed relationships, no inferred clusters, and no hidden reputation ranking. Human review
then exposed the next truth. The live demo data does not yet carry enough social structure for that
honest renderer to tell the intended story. In a read-only sample on 2026-06-29, Maria's aggregate ego
graph contained 144 links but 143 were classified `strong`; Aisha's 25 links were all `strong`.
Meanwhile, several 110–150 member community graphs contained only 10–42 relationships. The simulation
creates substantial activity, but its random actor, community, request, and offer choices create
activity volume rather than repeated relationships, overlapping circles, bridges, or dependency.

This sprint makes the demo's relationship story earned from end to end. It adds one coarse,
privacy-safe measure of repeated shared history (`bond_depth`), maps that measure to bounded edge
thickness, teaches the ongoing simulation to remember prior partners while still exploring, and adds
an idempotent rehearsal that produces two contrasting community structures through the ordinary
request/match APIs. It then gives visitors a safe guided entrance: karmyq.org leads to a short-lived,
read-only Maria demo session, while registration and the Founding Circle remain distinct paths.

### Core Principle: Guide attention; never fabricate structure

A demo may choose which truthful communities to show, but every visible person and relationship must
come from ordinary platform membership and completed exchanges; no layout coordinate, trust edge, or
health verdict is seeded for presentation.

---

## Multi-Sprint Arc

### Sprint 115 — Earned Structure (complete)

Replaced the universal person renderer with deterministic ego orbits and one-ring community chords,
removed inferred clusters/bundles, and made full-community selection neutral and explicit about
truncation.

### Sprint 116 — Living Demo (this sprint)

Make repeated relationship depth legible, generate plausible social topology through normal behavior,
and create a guided read-only entry from karmyq.org into Maria's two contrasting communities.

### Sprint 117 — Named Connection Corridor (upcoming)

Add shortest-first, best-supported equal-hop named paths to profiles and offers. This remains separate
so path semantics are built on a graph whose relationship data is already legible.

---

## Approaches Considered

### 1. Wait for current edges to decay

Rejected. A fresh completed match has weight 10 while `strong` begins at current weight 1.5. Under the
default decay configuration, one completion remains `strong` for roughly 68 days. Waiting may create
more faint lines, but random pair selection still will not create meaningful topology.

### 2. Seed or rewrite `social_graph.trust_edges`

Rejected. This would manufacture the desired picture below the product boundary and violate Sprint
115's earned-structure rule. It would also bypass requests, matches, events, karma, and every invariant
that real help must traverse.

### 3. Coarse bond depth + relationship-shaped behavior + API rehearsal (selected)

Expose only a coarse repeated-history band, change future partner selection probabilistically, and
bring the current demo to a useful state by executing real request → offer → accept → two-sided
completion flows. This is slower than inserting rows but keeps the graph and the rest of the product
consistent.

---

## Delivery: Two Ordered PRs

### PR A — Relationship Shape (v11.23.0)

1. Add the privacy-safe `bond_depth` outward contract and server-side classifier.
2. Project it from every person-graph endpoint without exposing counts or weights.
3. Change person-edge rendering so bounded thickness represents bond depth and opacity represents
   decay state.
4. Add relationship-aware ongoing simulation selection.
5. Add the dry-run-first, additive scenario rehearsal and deploy-time verification.

PR A must merge and its scenario rehearsal must pass structural verification before PR B can advertise
the guided experience.

### PR B — Guided Entry (v11.24.0)

1. Add fail-closed read-only demo sessions for one configured synthetic persona.
2. Add `karmyq.com/demo` and the compact Maria guide.
3. Reframe karmyq.org navigation and calls to action around Explore / Join / Shape.
4. Run the full live Maria journey against the verified PR-A scenario.

---

## New Concepts

### Bond depth

`bond_depth` describes repeated recorded interaction, not trustworthiness, endorsement, reputation, or
recency:

| Outward value | Internal interaction count | Meaning | At-rest width |
|---|---:|---|---:|
| `forming` | 1 | A relationship exists | 1.2px |
| `growing` | 2–3 | The pair has interacted repeatedly | 1.9px |
| `established` | 4+ | The pair has sustained repeated history | 2.8px |

The server computes the band from the sum of the edge's recorded interaction counters. The exact count,
raw/effective weight, and counter breakdown never cross the disclosure boundary. `bond_depth` is not
configurable per community in this sprint; one shared pure classifier is the source of truth.

### Relationship state remains temporal

The existing `relationship_state` (`strong | warm | fading | nearly_forgotten`) continues to describe
how alive the relationship is after decay. It controls opacity only. Bond depth and relationship state
are independent axes:

- thickness: how much repeated history exists;
- opacity: how quiet that history has become.

Focus changes hue and dims unrelated edges. It does not change width, because width now always carries
data.

### Scenario rehearsal

A versioned simulation command that plans and executes ordinary API interactions until two demo
communities satisfy approved structural invariants. It is additive, dry-run by default, resumable from
database state, and safe to rerun. It does not write product-owned relationship, request, match, karma,
or membership rows directly.

### Read-only demo session

A short-lived JWT for one configured synthetic persona. It carries `sessionMode: 'demo_read_only'`,
has no refresh token, and is rejected by shared authentication middleware for every method except
`GET`, `HEAD`, and `OPTIONS`.

---

## Data Model

### Persistent schema

No new product table or column is required. Existing trust-edge interaction counters remain the source
of truth. Scenario progress is inferred from existing membership, request, match, and trust-edge state;
the rehearsal does not create a second ledger.

### Internal graph link

Social-graph database reads add an internal-only total interaction count to person links. Aggregate
ego reads sum the count across shared active communities, matching their existing sum of raw/current
weights. This field exists only long enough for projection.

### Outward graph link

`SafeBelongingLink` becomes:

```ts
{
  source: string
  target: string
  relationship_state: 'strong' | 'warm' | 'fading' | 'nearly_forgotten'
  bond_depth: 'forming' | 'growing' | 'established'
  type?: 'organic' | 'fission'
}
```

`match_completed_count`, `total_interaction_count`, and all numeric weights remain forbidden outward
keys. ADR-082 is amended to permit only this coarse band and to state explicitly that it is not an
endorsement.

### JWT payload

The shared JWT type gains optional:

```ts
sessionMode?: 'demo_read_only'
```

Ordinary tokens omit it and retain existing behavior.

---

## API Endpoints

| Method | Path | Change | Auth |
|---|---|---|---|
| GET | `/trust/graph` | Every link adds `bond_depth` | Existing member JWT |
| GET | `/trust/graph/:communityId` | Every link adds `bond_depth` | Existing live-membership rules |
| GET | `/trust/graph/:communityId/full` | Every link adds `bond_depth`; completeness metadata unchanged | Existing live-membership rules |
| GET | `/trust/neighborhood/:userId` | Every link adds `bond_depth` | Existing shared-active visibility rules |
| POST | `/auth/demo-session` | Create one configured short-lived read-only persona session | Public, auth-rate-limited, explicit environment gate |

### `POST /auth/demo-session`

The route accepts no account identifier. Configuration supplies the only persona email and the exact
names/locations of the two scenario communities. Before issuing a token it verifies:

1. `DEMO_SESSION_ENABLED === 'true'`;
2. the configured account exists, is active, and ends in `@test.karmyq.com`;
3. both configured communities are active;
4. the persona is an active, non-admin member of both.

Success returns the normal public user shape plus `token` and:

```json
{
  "demo": {
    "persona": "Maria",
    "expiresInMinutes": 30,
    "communities": [
      { "id": "...", "name": "Cedar Grove Neighbors" },
      { "id": "...", "name": "Harbor Mutual Aid" }
    ]
  }
}
```

It returns no refresh token. Disabled or incomplete configuration returns `503 DEMO_UNAVAILABLE`
without revealing which configured resource is missing. It never accepts an arbitrary email, user ID,
community ID, or redirect target.

---

## Simulation Design

### Ongoing request selection

Actor selection remains uniform across the synthetic actor pool. `offerHelpWorkflow` changes only how
an eligible request is selected after existing guards (not own request, open, not already offered,
provider-type preference) have run.

A pure selector groups eligible requests by the helper's relationship to the requester and makes a
weighted choice using an injected random source:

| Bucket | Target share | Definition |
|---|---:|---|
| prior partner | 50% | At least one completed exchange between helper and requester in the request community |
| local circle | 30% | At least one shared active neighbor in that community, but no prior completed exchange |
| exploration | 20% | Neither prior-partner nor local-circle condition |

If the selected bucket is empty, its probability falls through to the next non-empty bucket; the
workflow never fails merely because a relationship category is unavailable. Existing provider
preference remains a first-stage eligibility preference, so relationship memory cannot route a tutor
to an incompatible request.

This sprint does not introduce a universal health optimizer. The probabilities create memory,
triadic closure, and exploration; actual community shape remains emergent from available requests.

### Rehearsal communities

The rehearsal owns two neutral identities, created/joined through existing community APIs:

| Community | Location | Members | Presentation label |
|---|---|---:|---|
| Cedar Grove Neighbors | Demo District, Portland, OR | 24 | none |
| Harbor Mutual Aid | Demo District, Portland, OR | 24 | none |

Maria is an ordinary member of both, never the designated coordinator. Each scenario receives the
same member count, 36 unique relationship edges, and 72 completed-exchange budget. This controls the
quantity while allowing partner choice to change the shape.

Structural stop conditions:

- **Cedar Grove**: no isolates; minimum degree ≥2; maximum degree ≤5; no articulation point; at least
  four cross-circle bridge edges.
- **Harbor**: one non-Maria coordinator has degree ≥16; median non-coordinator degree ≤2; removing the
  coordinator yields at least four components.
- **Both**: all links come from completed matches; all three bond-depth bands are present; member,
  edge, and completed-exchange budgets remain equal.

For planning only, each 24-member roster is partitioned deterministically into four six-person cohorts.
The cohorts define which relationships count as cross-circle bridges; they are never returned by an
API, named in the UI, or passed to the renderer. The planner produces deterministic pair/exchange
targets from a fixed scenario seed, but it never produces coordinates. The executor checks current
counts and creates only each pair's remaining completed exchanges. A dry run prints proposed actions
and expected invariants. `--apply` is required for mutations. After interruption, a rerun recomputes
deficits from authoritative rows and converges on the same target rather than duplicating completed
exchanges.

### Rehearsal execution boundary

All product mutations use authenticated APIs:

1. create or resolve community;
2. join members;
3. create a realistic request;
4. offer help;
5. accept the offer;
6. confirm completion as both parties.

Direct database reads are permitted for planning, deficit detection, and verification because the
simulation service already reads the demo database. Direct inserts/updates/deletes into product-owned
tables are forbidden.

---

## Frontend Changes

### Person graphs

`graphVisualEncoding` owns the exact bond-depth widths. `CommunityRingGraph` and `EgoOrbitGraph` read
only the shared encoding result. Caller relationships remain amber; ordinary relationships remain
slate; focused incident relationships remain teal unless caller amber has precedence. Focus dims
unrelated edges/nodes but adds no width. Titles and selected-node summaries describe both axes in
plain language without counts (for example, `established · fading`).

Unknown/missing `bond_depth` falls back to the narrow `forming` width so old/cache-skewed payloads can
never overstate depth. Unknown relationship state retains the existing neutral opacity.

### `karmyq.com/demo`

The unauthenticated page contains:

- a clear “shared synthetic persona” disclosure;
- one **Explore as Maria** action;
- ordinary **Join the platform** and **Log in** alternatives;
- an honest unavailable state when the server returns `503`.

On success it stores the access token and user/demo context, stores no refresh token, and navigates to
`/network?mode=ego&demo=1`.

### Guided network context

When valid demo context exists, `/network` shows a compact dismissible guide above the existing graph:

1. Maria's network — notice repeated vs forming relationships;
2. Cedar Grove — compare alternate routes and bridges;
3. Harbor — consider what changes if the coordinator disappears.

The guide uses the two IDs returned by `/auth/demo-session`; no production UUID is hard-coded into the
frontend. It does not calculate, display, or persist a health score. If a graph fetch fails, the guide
keeps the last successful view, offers retry, and never claims the scenario is complete.

### Karmyq.org entry hierarchy

The public site distinguishes three intentions:

| Intention | Label | Destination | Prominence |
|---|---|---|---|
| See it | Explore the live demo | `https://karmyq.com/demo` | Primary header/home action |
| Use it | Join the platform | `https://karmyq.com/register` | Secondary header/home action |
| Shape it | Join the founding circle | `/join` | Normal navigation; Research closing action |

The logo already returns home, so the redundant `Story` item is removed from desktop and mobile
navigation. This keeps the two explicit external actions legible at the existing breakpoint. Mobile
navigation must show all three paths without hiding either registration or the Founding Circle behind
the demo action.

How It Works closes with **Explore the live demo**. Research continues to close with **Join the
founding circle**. The home ending presents Explore + Join platform, with the Founding Circle as a
quieter text path.

---

## Safety and Failure Behavior

1. **Demo sessions fail closed.** The endpoint is absent in effect unless explicitly enabled and fully
   configured. It discloses no configuration detail on failure.
2. **Demo sessions are read-only at the server.** Shared `authMiddleware` rejects non-safe HTTP methods
   whenever `sessionMode === 'demo_read_only'`. Hiding buttons is only supplementary UX, never the
   enforcement boundary.
3. **The persona is constrained.** It must be a synthetic ordinary member of both scenario communities;
   an admin persona prevents session issuance.
4. **No refresh token.** Demo sessions expire after 30 minutes and require re-entry through `/demo`.
5. **Scenario mutations are explicit.** Dry-run is the default; `--apply` and the exact environment are
   printed before any API action. No automatic execution occurs during service startup or deploy.
6. **Existing history is preserved.** No wipe, trust-edge rewrite, or broad demo repair is permitted.
7. **Partial runs are honest.** PR B is not enabled until rehearsal verification passes. Missing graphs
   show unavailable/retry states, never a health interpretation.
8. **No evaluative person claims.** Bond depth describes shared history only. Copy must not say that a
   person is trusted, recommended, generous, extractive, central, healthy, or unhealthy.

---

## Verification Strategy

### Contract and privacy

- Boundary tests for `forming` (1), `growing` (2–3), and `established` (4+).
- Strict outward-schema tests accept `bond_depth` and reject exact counters/weights.
- Projection tests prove every person-graph endpoint emits the coarse band and no numeric source.
- ADR-082 forbidden-key scanner adds all interaction-count spellings.

### Rendering

- Exact widths are locked for all three bands.
- Opacity changes do not change width; bond depth changes do not change opacity.
- Focus changes hue/dimming without changing width.
- Missing runtime bond depth falls back to `forming`.
- Dense 150-member fixture remains within the existing render budget and focus reuses geometry.

### Simulation

- Seeded selector tests lock the 50/30/20 policy, provider precedence, fallthrough, and empty inputs.
- Scenario planner tests lock equal budgets and the structural stop conditions.
- Executor tests prove dry-run default, `--apply` requirement, deficit-only reruns, and no direct product
  table writes.
- Database-backed TDD test runs a minimal two-pair rehearsal through API client mocks/contracts and
  proves a second plan contains no completed-exchange work.

### Demo session and entry

- Endpoint disabled/missing config/non-synthetic/admin persona all fail closed.
- Success returns one configured persona, two configured communities, a 30-minute demo claim, and no
  refresh token.
- Shared auth middleware permits GET/HEAD/OPTIONS and rejects POST/PUT/PATCH/DELETE for demo tokens.
- `/demo` handles success, rate-limit/error, and unavailable states without leaking credentials.
- Karmyq.org route/nav tests lock Explore / Join platform / Founding Circle destinations on desktop
  and mobile contracts.

### Post-deploy human validation

1. Run rehearsal dry-run; inspect budget and target evidence.
2. Admin explicitly authorizes `--apply`; run against the demo API and record completion evidence.
3. Verify both community graphs from Maria's ordinary account and capture node/edge/degree,
   articulation, and bond-depth distributions.
4. Enter through karmyq.org → Explore the live demo → Maria → both communities.
5. Confirm demo writes receive 403 server-side, registration remains independent, and the Founding
   Circle path still submits normally.
6. Confirm desktop/mobile keyboard operation, visible focus, reduced motion, no graph layout movement,
   and no health/endorsement claim.

---

## User Guide and Documentation Updates

- **ADR-084 (new):** coarse bond depth, relationship-shaped simulation, API-earned rehearsal, and
  read-only guided demo boundary.
- **ADR-082:** explicitly permit the three-value `bond_depth`; retain exact counter/weight prohibition.
- **ADR-083:** replace constant-width/intensity-only decision with bounded depth width + temporal opacity.
- **`docs/guides/trust-graph.md`:** explain thickness vs fading and the non-endorsement boundary.
- **`docs/concepts/reading-the-trust-graph.md`:** explain why data shape, not renderer shape, carries the
  community story.
- **`docs/guides/demo-data.md`:** explain Maria, the two rehearsal communities, shared read-only access,
  and API-earned scenario data.
- **`docs/guides/getting-started-guide.md`:** distinguish Explore, Join platform, and Join Founding Circle.
- Regenerate/update matching landing docs JSON and nav entries.
- Update `packages/shared/CONTEXT.md`, `services/social-graph-service/CONTEXT.md`,
  `services/simulation-service/CONTEXT.md`, `services/auth-service/CONTEXT.md`, and
  `apps/frontend/CONTEXT.md`.
- Update `services/registry.json` for the modified person-graph responses and new auth endpoint.
- Update onboarding workflow copy if it describes constant-width edges or manual demo credentials.

---

## Critical Implementation Notes

1. `bond_depth` is repeated-history context, never trustworthiness or endorsement. No UI or guide may
   call an established edge “more trustworthy.”
2. Exact interaction counts, count breakdowns, raw/effective/current weights, and numeric path strength
   remain forbidden in every ordinary-member response. Project at the final response boundary.
3. Thickness and opacity are independent. Focus must not alter width after this sprint.
4. Actor selection stays uniform. Only eligible-request choice becomes relationship-aware, and provider
   compatibility remains the first-stage preference.
5. The 50/30/20 policy uses an injected random source and deterministic ordering before selection so
   tests and reloads cannot depend on database row order.
6. The scenario runner is dry-run by default, requires `--apply`, mutates only through existing APIs,
   and computes deficits from authoritative state. Never insert/update/delete product rows directly.
7. Both scenarios use equal member, unique-edge, and completed-exchange budgets. Do not tune one until
   it merely looks prettier; enforce structural invariants without coordinates.
8. Maria must be an ordinary member of both scenario communities and must not be the Harbor
   coordinator. Demo-session issuance fails if that is untrue.
9. Demo configuration is server-only. The endpoint accepts no persona/community/redirect input and
   returns `503 DEMO_UNAVAILABLE` without naming missing resources.
10. `demo_read_only` is enforced in shared auth middleware for all non-safe methods. Client-side hidden
    controls are not a security boundary.
11. PR B remains disabled until PR A's live rehearsal verification passes. Never advertise an
    incomplete scenario.
12. Preserve every existing demo account, community, match, and trust edge. This sprint is additive;
    there is no wipe or bulk repair.
13. Update ADR-082 and ADR-083 rather than creating competing disclosure/rendering rules; ADR-084
    records only the new cross-cutting decision.
14. The named connection corridor and offer integration are Sprint 117 scope and must not leak into
    either Sprint 116 PR.

---

## Explicitly Out of Scope

- Named person-to-person corridors, path ranking, or offer integration.
- Public profile visibility changes.
- Raw relationship weights or exact interaction counts in the client.
- A community health score, recommendation, ranking, or automated verdict.
- Direct trust-edge seeding, database wipe/reseed, or rewriting existing history.
- Temporal fission/fusion lineage.
- Mobile-native parity beyond ensuring the responsive web demo remains usable.

---

## Definition of Done

Sprint 116 is complete only when:

1. All person graphs expose privacy-safe bond depth and render depth by bounded width plus decay by
   opacity.
2. Ongoing simulation produces relationship memory with tested fallback behavior.
3. The rehearsal creates/verifies both equal-budget scenarios through ordinary APIs without changing
   existing history.
4. A visitor can enter from karmyq.org, obtain a short-lived read-only Maria session, and traverse the
   ego plus both scenario communities.
5. Registration and Founding Circle paths remain explicit and independently usable.
6. Demo-token writes are rejected server-side.
7. Unit/regression/TDD suites, type checks, build, feedback check, dependency audit, CodeQL,
   `/simplify`, `/code-review`, and `/security-review` are green.
8. Documentation, contexts, registry, landing docs, versions, PR contracts, and handoff are current.
