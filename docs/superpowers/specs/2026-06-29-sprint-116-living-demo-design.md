# Sprint 116: Connected Help and Guided Entry — Design Spec

**Date**: 2026-06-29
**Status**: Approved
**Version**: v11.22.0 → v11.25.0 (PR A: v11.23.0; PR B: v11.24.0; PR C: v11.25.0)
**PR A Branch**: `agent/codex/sprint-116-relationship-shape`
**PR B Branch**: `agent/codex/sprint-116-offer-context` (from merged PR A)
**PR C Branch**: `agent/codex/sprint-116-guided-entry` (from merged PR B)

---

## Overview

Sprint 115 made the standalone belonging graphs structurally honest, but live validation exposed a
more important product gap. The renderer changed while the dominant picture remained a ring of people
and lines. Maria's one-hop ego data collapses the new orbit model to one ring, and sparse community
graphs remain sparse circles. Data shape amplifies the problem, but the deeper issue is placement: a
large network explorer asks people to interpret structure without giving them a decision or a story.

Karmyq already promises to explain how people are connected when help crosses from one person to
another. The current request and offer surfaces do not fulfill that promise. A member who is deciding
whether to offer sees the requester's name and perhaps a compact path badge. A requester reviewing a
helper or provider sees little more. Provider identity, the two people's surrounding networks, and the
mutual nature of the connection are absent.

Sprint 116 moves the relationship picture to the moment of choice. A compact reciprocal dual-ego lens
appears only when a visible request or existing offer brings two people together. It shows their
platform-wide path, their named one-hop networks, and where those networks overlap. Providers remain
people in the same topology, decorated with an opted-in service role. A guided read-only Maria story
demonstrates both an ordinary helper and a provider, while karmyq.org preserves three explicit paths:
Explore the demo, Join the Platform, and Join the Founding Circle.

### Core Principle: Show relationship when help asks for trust

Connection context is a reciprocal helping hand at a real decision, never a directory for browsing
people and never a substitute reputation score.

---

## Multi-Sprint Arc

### Sprint 115 — Earned Structure (complete)

Replaced the universal person renderer with deterministic ego and community layouts, equal person
nodes, direct disclosed relationships, and neutral full-community selection.

### Sprint 116 — Connected Help and Guided Entry (this sprint)

Add request-scoped reciprocal relationship context, integrate it for ordinary and provider help, and
give visitors a read-only Maria path plus a distinct Join the Platform path.

### Sprint 117 — Standalone Graph Narrative (upcoming)

Use evidence from the contextual lens to decide whether the full Network page needs a constellation,
connected-island community layout, or a smaller supporting role. Do not redesign it speculatively in
Sprint 116.

---

## Approaches Considered

### 1. Improve simulation data and keep iterating on the full Network page

Rejected for this sprint. More varied data could improve line contrast, but it would not fix the
circular silhouette or explain why a member should study the graph.

### 2. Replace the graph with a connection story card

Not selected as the primary treatment. Text is clear and remains the accessibility/mobile fallback,
but by itself it cannot show two surrounding networks, overlap, and provider belonging at a glance.

### 3. Request-scoped reciprocal relationship lens (selected)

Show a small dual-ego view before an offer and while an offer is reviewed. It is bounded enough to be
legible, attached to a real act of help, and capable of showing ordinary and professional help through
the same social structure.

### 4. Searchable member relationship explorer

Rejected. Karmyq connections are visible to authenticated members when a real request or offer creates
the context; the platform does not provide user search for inspecting arbitrary networks.

---

## Delivery: Three Ordered PRs

### PR A — Reciprocal Relationship Context (v11.23.0)

1. Add the request/offer-scoped authorization boundary and internal social-graph projection.
2. Add a coarse, privacy-safe `bond_depth` for contextual edges.
3. Build the deterministic reciprocal model and compact dual-ego renderer.
4. Prove platform-wide, cross-community, direct, indirect, and no-path behavior.

### PR B — Helping Decision Surfaces (v11.24.0)

1. Show the lens to an eligible member or provider before they offer.
2. Show the same relationship truth to the requester reviewing an ordinary helper.
3. Show it to the requester reviewing a provider offer, with service-role decoration.
4. Rehearse two deterministic Maria stories through ordinary request and offer APIs.

### PR C — Guided Entry and Join the Platform (v11.25.0)

1. Add fail-closed read-only demo sessions for Maria.
2. Guide the demo directly to Maria's ordinary-helper and provider decisions.
3. Add and test the distinct karmyq.org paths: Explore, Join the Platform, and Founding Circle.
4. Validate the complete desktop, mobile, keyboard, and read-only journeys after deployment.

---

## New Concepts

### Relationship lens

A compact dual-ego view with two anchors:

- **You** — always the authenticated viewer, regardless of whether they are requester, helper, or
  provider.
- **Counterpart** — derived by the server from the authorized request, match, or provider offer.

The visual contains three independent truths:

1. how the two people are connected to each other;
2. how the viewer is connected to their network;
3. how the counterpart is connected to their network.

It does not assume that the two people share a community. Request visibility may be community,
sister-community, trust-network, or platform-wide. Trust-path topology remains platform-wide under
ADR-077.

### Reciprocal orientation

The underlying topology is identical for both participants. The renderer orients the authenticated
viewer as “you” and the other participant as the counterpart. When roles reverse, names move sides but
the path, edge semantics, and disclosed network structure do not change. Provider metadata is the only
role-specific decoration.

### Context-bound public connection

Named topology is public within authenticated Karmyq, but this feature has no arbitrary user lookup.
The public route derives both people from a request or offer the caller is authorized to act on or
review. A client cannot submit a target user ID.

### Bond depth

`bond_depth` describes repeated recorded interaction, not trustworthiness or endorsement:

| Value | Internal interaction count | Meaning | Width |
|---|---:|---|---:|
| `forming` | 1 | A relationship exists | 1.2px |
| `growing` | 2–3 | The pair has interacted repeatedly | 1.9px |
| `established` | 4+ | The pair has sustained shared history | 2.8px |

Exact counts and weights remain internal. Brightness carries no relationship meaning in the lens.
Plain-language labels communicate direct, indirect, shared-network, and no-path states.

---

## Data Model

### Persistent schema

No product migration is required. Existing completed matches, trust edges, active memberships,
community links, request visibility, ordinary matches, provider offers, provider profiles, and
collective memberships remain authoritative.

### Internal context request

After public authorization, request-service sends social-graph-service only the derived viewer ID,
counterpart ID, and bounded context parameters through an internal-only service route. That route is
protected by the existing `X-Internal-Secret` pattern and is not exposed through the public gateway.
It fails closed when the secret is missing or misconfigured.

### Outward relationship context

The request-service projection contains:

```ts
{
  viewer: { id: string; name: string }
  counterpart: {
    id: string
    name: string
    role: 'member' | 'provider'
    provider?: { serviceType: string; collectiveName?: string }
  }
  request: {
    id: string
    visibilityScope: 'community' | 'trust_network' | 'platform'
    reachability: 'same_community' | 'sister_community' | 'trust_network' | 'platform'
  }
  path: {
    scope: 'platform'
    degrees: number | null
    nodes: Array<{ id: string; name: string }>
  }
  networks: {
    viewer: ContextNode[]
    counterpart: ContextNode[]
    shared: ContextNode[]
    truncated: boolean
  }
  links: Array<{
    source: string
    target: string
    relationship_state: 'strong' | 'warm' | 'fading' | 'nearly_forgotten'
    bond_depth: 'forming' | 'growing' | 'established'
  }>
  summary: string
}
```

`ContextNode` carries identity and visible community affiliation only. It never carries karma,
reputation, exchange text, request history, exact counts, raw/effective weights, or timestamps.

### Bounded network selection

The projection preserves both anchors, every disclosed path node, and shared direct connections first.
It then fills each one-hop side to the same fixed cap using stable ID ordering, never reputation,
weight, recency, or activity ranking. The response reports truncation. This creates a reproducible
picture without implying that omitted people matter less.

---

## API Endpoints

### Public request-service routes

| Method | Path | Pair derived by server | Authorization |
|---|---|---|---|
| GET | `/requests/:requestId/relationship-context` | caller ↔ requester | Existing request reachability; own request returns no counterpart context |
| GET | `/requests/:requestId/matches/:matchId/relationship-context` | requester ↔ ordinary responder | Caller must be one of the two match participants |
| GET | `/requests/:requestId/provider-offers/:offerId/relationship-context` | requester ↔ provider user | Caller must own the request or the provider offer |
| POST | `/auth/demo-session` | configured Maria persona | Public rate-limited entry; explicit environment gate; returns read-only authenticated session |

There is no route shaped as `/relationship-context/:userId`, no member search, and no public target-ID
parameter. Request lifecycle actions retain their existing authorization and are not coupled to graph
availability.

### Internal social-graph route

`POST /internal/relationship-context` accepts the two server-derived IDs only from request-service.
It returns a strict identity-and-structure projection. It is inaccessible through the public gateway,
requires `X-Internal-Secret`, rejects missing/invalid configuration, and has cross-user forbidden-key
tests under ADR-082.

### Demo session

`POST /auth/demo-session` accepts no account identifier. Configuration supplies one active synthetic
Maria account and the two approved demo request IDs. The token carries
`sessionMode: 'demo_read_only'`, expires after 30 minutes, has no refresh token, and shared auth
middleware rejects every non-safe HTTP method.

---

## Frontend Changes

### Compact reciprocal renderer

The viewer appears on the left and the counterpart on the right. The shortest disclosed path occupies
the middle. Named one-hop connections fan behind each anchor; mutual connections occupy the overlap.
Community labels describe where visible nodes belong without enclosing the pair in a false single-
community boundary.

Visual semantics are intentionally narrow:

- equal person nodes — no person is larger because of reputation, degree, or provider status;
- line thickness — coarse repeated shared history only;
- position — role in this particular reciprocal picture;
- solid lines — recorded person-to-person relationships;
- provider badge — opted-in service role, not a higher-status node;
- no brightness encoding, inferred clusters, health score, or recommendation claim.

The component always renders the server-provided summary beneath the SVG, for example: “You and Dev
are connected through Elena. Your networks overlap through Marin Helping Hands.” The summary is the
mobile/accessibility fallback and must remain useful when the SVG cannot load.

### Before offering

The canonical request detail page loads context only after the request response says the caller can
offer. The provider matching-request surface links to that same detail/context rather than building a
second interpretation. The lens is explanatory; the Offer action remains usable if it fails.

### Reviewing offers

Ordinary match cards and provider-offer review cards use their participant-scoped context routes.
Both requester and offerer receive the same topology oriented around themselves. Provider offers add
service type and collective name from the existing public provider contract.

### No browsing surface

The lens does not appear on provider profiles, member profiles, search, or the standalone Network page.
Provider directories retain their existing compact trust-path/shared-community information.

---

## Maria Rehearsal

The rehearsal creates or resolves two deterministic stories through ordinary APIs:

1. Maria reviews an ordinary community member's offer.
2. Maria reviews a professional provider's offer.

At least one story is cross-community under the requester's configured visibility policy. Together
the stories exercise direct or short-path connection, visible surrounding networks, provider role,
and a truthful no-path or low-overlap contrast. The rehearsal creates requests, offers, acceptance,
and any completed history through normal product APIs; it never inserts or rewrites trust edges.

The command is additive, dry-run by default, resumable from authoritative state, and requires
`--apply` for mutations. It verifies the expected request IDs and structural conditions before PR C
can enable the public guide.

---

## Guided Entry and Join the Platform

### `karmyq.com/demo`

The page discloses that Maria is a shared synthetic persona, creates the short-lived read-only session,
and opens the guided offer-comparison story. Visitors can switch between the ordinary helper and
provider and see the relationship lens for each. My Network may be linked as supporting context, but
is not the entry destination.

### Karmyq.org entry hierarchy

| Intention | Label | Destination | Prominence |
|---|---|---|---|
| See it | Explore the live demo | `https://karmyq.com/demo` | Primary header/home action |
| Use it | Join the Platform | `https://karmyq.com/register` | Secondary header/home action |
| Shape it | Join the Founding Circle | `/join` | Normal navigation; research/founding action |

All three paths appear in desktop and mobile navigation. The home closing section and demo page show
Explore plus Join the Platform, with Founding Circle as the distinct participation path. Automated
route tests prevent Join the Platform from drifting to `/join` or being hidden behind Explore.

---

## Safety and Failure Behavior

1. **Context, not search.** Public routes derive both participants from an authorized request or offer.
2. **Authenticated visibility.** Named connection topology is available inside Karmyq, not as an
   open-web endpoint.
3. **No reputation disclosure.** Exact karma, trust/reputation scores, weights, counts, histories, and
   timestamps never cross the context boundary.
4. **Reciprocal truth.** Reversing caller and counterpart changes orientation only, not topology.
5. **Cross-community truth.** The response never claims a path is community-local; path scope is
   platform-wide and request reachability is labeled separately.
6. **Non-blocking enhancement.** Timeout, 404, or 5xx leaves request/offer copy and actions intact.
7. **Honest absence.** No path reads “No recorded connection path yet”; it never invents membership,
   endorsement, or distrust.
8. **Internal route fails closed.** Missing or invalid internal secret returns 403; missing production
   configuration prevents startup or disables the internal route explicitly.
9. **Demo sessions fail closed.** Only the configured synthetic non-admin persona can receive a
   read-only token, with no refresh token and server-side write rejection.
10. **No graph-derived decision.** The server's existing eligibility and offer authorization remain
    authoritative; the renderer does not calculate eligibility.

---

## Verification Strategy

### Authorization and privacy

- Reachable community, sister-community, trust-network, and platform requests return context.
- Unreachable, nonexistent, closed-as-ineligible, or own requests do not expose a counterpart network.
- Match/provider-offer routes accept only their two participants.
- No route accepts an arbitrary target user ID.
- Internal-secret tests cover missing, wrong, and correct values.
- Strict schemas and sentinel tests reject every ADR-082 forbidden metric at any depth.

### Reciprocity and topology

- Swapping authenticated participants produces the same node/link/path sets with reversed orientation.
- Direct, 2–6 degree, and no-path fixtures produce truthful summaries.
- Cross-community paths remain `scope: platform`; request reachability remains separate metadata.
- Shared nodes occupy the overlap; one-sided nodes remain on their owner's side.
- Stable input produces byte-stable model coordinates and selection.
- Path/shared nodes survive caps; other nodes use stable non-evaluative ordering; truncation is explicit.

### Rendering and accessibility

- Exact widths are locked for all bond-depth bands.
- Brightness/opacity does not encode relationship value.
- Provider decoration never changes node size.
- Summary text is present with and without SVG support.
- Keyboard focus, screen-reader names, reduced motion, and narrow mobile layouts remain usable.

### Decision surfaces

- Eligible ordinary helper and provider see context before offering.
- Requester sees reciprocal context for ordinary and provider offers.
- Context failure does not disable offer, accept, decline, or withdraw actions.
- Provider metadata is present only for provider offers.

### Entry and joining

- Demo session is synthetic-only, 30-minute, non-refreshable, and server-side read-only.
- Maria guide opens the offer comparison rather than the standalone Network page.
- Desktop/mobile navigation and closing CTAs preserve Explore, Join the Platform, and Founding Circle.
- Join the Platform always resolves to ordinary registration; Founding Circle remains `/join`.

### Post-deploy five-second validation

Using Maria and both rehearsed offers, a viewer has five seconds to answer:

1. How are these two people connected?
2. Where does each person belong?
3. Which offerer is acting as a provider?

If the answers are not apparent without explaining the implementation, the sprint is not complete.

---

## User Guide and Documentation Updates

- **ADR-077:** retain platform-wide trust-path topology and document request-scoped reciprocal context.
- **ADR-082:** permit coarse `bond_depth` and named authenticated topology while retaining the exact-
  metric prohibition.
- **New ADR:** record context-bound connection visibility, internal authorization boundary, and the
  explicit rejection of arbitrary member browsing.
- **`docs/concepts/trust-path.md`:** explain reciprocal offer context and cross-community paths.
- **`docs/concepts/unified-feed.md`:** describe the lens as a pre-offer helping aid.
- **Provider guide:** explain that providers remain community people with an added public service role.
- **Getting started guide:** distinguish Explore, Join the Platform, and Join the Founding Circle.
- **Landing docs/content:** update the live product story to show relationship at the moment of help.
- **Service contexts and registry:** add public request routes, internal dependency/route, demo session,
  disclosure class, environment variables, and version changes.

---

## Critical Implementation Notes

1. The lens is request/offer-scoped. Do not add a public route that accepts an arbitrary target user.
2. Relationship topology is reciprocal. Reversing participants may change orientation and role copy,
   but never the disclosed node/link/path sets.
3. Trust paths are platform-wide under ADR-077. Never label an exchange path as belonging to the
   request's source community.
4. Request reachability is the existing visibility boundary, including sister-community,
   trust-network, and platform scope. Do not replace it with a shared-membership check.
5. Named connections are visible to authenticated Karmyq members in this context; exact ordinary-
   member reputation, weights, counts, history text, and timestamps remain forbidden under ADR-082.
6. Request-service owns public context authorization and derives both IDs. Social-graph-service only
   receives them over the fail-closed internal boundary.
7. Preserve path nodes and shared connections before applying caps. Fill remaining slots with stable,
   non-evaluative ordering and disclose truncation.
8. Thickness carries coarse repeated history only. Brightness carries no relationship meaning.
9. Providers use equal person nodes. Service type/collective are role decorations, never rank.
10. The relationship lens is non-blocking. Existing offer and acceptance actions must work through
    timeout, no-path, and service failure.
11. Rehearsal mutations use ordinary APIs, are dry-run by default, additive, resumable, and require
    explicit `--apply`; never seed trust edges or coordinates.
12. Demo write protection is server-side shared middleware. Hiding controls is defense in depth only.
13. Join the Platform is ordinary registration and must remain distinct from `/join`, the Founding
    Circle path, on desktop, mobile, home, and demo surfaces.
14. Update existing ADRs and docs rather than creating competing definitions of path scope,
    disclosure, provider identity, or request eligibility.

---

## Definition of Done

Sprint 116 is complete only when:

1. A helper or provider can see how they connect to a requester before offering.
2. A requester can see the same relationship truth when reviewing that helper or provider.
3. Cross-community requests show two truthful surrounding networks without assuming shared membership.
4. Direct, indirect, and no-path states are legible; repeated history uses thickness, not brightness.
5. The feature cannot search for or inspect an arbitrary member outside a request/offer context.
6. Context failure never blocks offer or acceptance actions.
7. Maria's read-only demo shows ordinary and provider offer stories and rejects writes server-side.
8. Explore, Join the Platform, and Join the Founding Circle remain distinct and usable on desktop and
   mobile.
9. Five-second live validation answers how the pair connects, where each belongs, and who is a provider.
10. Unit, regression, TDD, type, build, feedback, audit, CodeQL, simplify, code-review, and security-
    review gates are green, with docs, contexts, registry, versions, PR contracts, and handoff current.
