# ADR-084: Context-Bound Connection Visibility

**Date**: 2026-06-30
**Status**: Accepted
**Deciders**: Karmyq maintainer
**Related**: ADR-070, ADR-077, ADR-082, ADR-083

## Context

Karmyq asks people to help someone they may not know directly. A generic network explorer explains a
member's own surroundings, but it does not answer the decision-time question: **how are this specific
requester and potential helper connected, and how do their visible networks overlap?** The existing
visualization also changed little across simulated stories because the underlying topology was often
homogeneous; styling could not manufacture a meaningful contrast.

Named connections can increase confidence, but unrestricted person search would turn a helping aid
into a browsing and surveillance surface. Exact interaction counts or trust weights would also
violate ADR-082's reputation boundary.

## Decision

Expose a reciprocal relationship context only within an authenticated, concrete help workflow:

- before an eligible member or provider offers on a reachable open request;
- while either participant reviews an ordinary match; or
- while the requester or provider reviews a provider offer.

Request-service derives both participant IDs from the request/match/offer records and owns all public
authorization. Social-graph-service accepts the pair only on an internal-secret-protected route. No
public endpoint accepts an arbitrary target user ID, and the lens does not appear on profiles, search,
provider directories, or the standalone Network page.

The outward strict contract contains participant identity, request reachability, a platform-wide
completed-help path, bounded named one-hop networks, shared nodes, active community affiliations,
qualitative relationship state, and a coarse history band. It never contains exact reputation,
karma, interaction counts, edge weights, timestamps, exchange text, or recommendation scores.

The coarse `bond_depth` is intentionally ordinal:

- `forming`: fewer than two completed interactions;
- `growing`: at least two;
- `established`: at least four.

Thus `growing` and `established` disclose floors of ≥2 and ≥4. Exact history remains private. The
compact renderer maps only this band to widths `1.2`, `1.9`, and `2.8`; brightness/opacity has no
relationship meaning. Every person uses the same radius, including providers. Provider status is an
external badge, not a larger or higher-status person node.

Geometry is deterministic and earned from disclosed structure: viewer left, counterpart right,
shortest path through the middle, mutual neighbors in the overlap, and one-sided neighbors fanning
behind their anchor in stable-ID order. It uses pure TypeScript and React SVG, with no force layout,
cluster inference, or D3 dependency. The server summary remains normal text beneath the SVG.

Graph failure is non-blocking. Context reads fail closed and may return a retryable unavailable state,
but existing offer, accept, decline, and withdraw actions remain independent.

## Consequences

### Positive Consequences

- Trust support appears at the moment of helping and is reciprocal for requester and helper.
- Named topology is useful without creating a general-purpose people browser.
- Deterministic geometry makes sparse or rich data visibly honest and testable.
- Providers remain ordinary people in the network while their opted-in service role stays legible.

### Negative Consequences

- Named neighbors and the ≥2/≥4 history floors reveal more than an identity-only contract.
- Sparse simulated topology will produce a sparse lens; demo rehearsal must select truthful stories
  with different path/overlap shapes rather than rewriting trust edges.
- Request-service gains an internal runtime dependency on social-graph-service and a shared secret.

### Neutral Consequences

- Platform-wide path topology remains governed by ADR-077; request reachability is still separate.
- Community names describe affiliation but do not create inferred clusters or community-scoped paths.
- The full Network page remains unchanged until contextual-lens evidence justifies another redesign.

## Alternatives Considered

### Re-style the existing network graph

Rejected because color, brightness, and layout polish cannot create variation absent from the data or
explain two specific people's surrounding networks.

### Public member search with relationship previews

Rejected because the product need is decision-time confidence, not open-ended social browsing.

### Show exact interaction count or trust weight

Rejected under ADR-082. Coarse documented floors provide a narrower history signal.

## Implementation Notes

- Shared schema: `packages/shared/src/schemas/relationshipContext.ts`
- Internal projection: `services/social-graph-service/src/services/relationshipContextService.ts`
- Public authorization: `services/request-service/src/routes/relationshipContext.ts`
- Deterministic renderer: `apps/frontend/src/components/relationships/RelationshipLens.tsx`
- No database migration is required.

---

## Sprint 117 amendment (2026-07-02): curated historical floor, not additive rehearsal

Earlier demo runs reached the required relationship contrast by *additive rehearsal* — repeatedly
discovering candidate helpers and layering new exchanges until the floor happened to be met. That was
fragile and non-reproducible.

Sprint 117 replaces additive candidate discovery with a **curated historical floor plus an
API-created live story verified through ordinary APIs**:

- The deterministic curated baseline (ADR-024, amended) already contains the truthful repeated
  completed exchanges that make Maria's neighbourhood satisfy the rich floor: a ≤2-degree path to her
  helper, ≥3 shared named neighbours, and ≥4 visible one-hop people per side. The provider contrast is
  truthfully lower-overlap via a bridge. No trust edges or scores are invented.
- The finite live Maria decisions (ordinary request + match, provider request + offer) are created
  through ordinary APIs with server-generated IDs.
- A non-admin **verifier** is the only authority that may declare the demo ready and publish story
  IDs. It re-reads the context as the appropriate viewer and asserts, through outward APIs, the rich
  floor, reciprocal topology, an unrelated-viewer denial, and the ADR-082 privacy boundary (no raw
  `trust_score`/`karma`/`raw_weight`/interaction counts; `bond_depth` and the provider-rating
  exception remain allowed). Story IDs are withheld unless every check passes.

This keeps the ADR-084 contract (named, context-bound, privacy-respecting connection visibility) while
making the demo that demonstrates it reproducible and self-verifying.

---

## Sprint 129 amendment (2026-09-13): opacity binds the response, not the log

The opaque `503 DEMO_UNAVAILABLE` this ADR specifies had been applied to the **operator** as well as
the caller, and that cost a multi-day outage.

`POST /auth/demo-session` collapses all fourteen distinct failure causes into one response so that
resource existence is never leaked. `routes/auth.ts` then logged **only** failures that were *not*
`DemoSessionUnavailableError` — so every *expected* cause (disabled flag, missing config, persona
absent, a story row no longer owned by the persona) was silent by construction. The specific,
operator-ready reason strings in `demoSessionService.ts` were built and then discarded.

The result was BUG-039: `karmyq.com/demo` returned 503 from roughly 2026-09-09 to 2026-09-12, and
the bug report's own advice — check `pm2 logs` — could not have worked, because there was nothing
there to find.

**Amendment.** This ADR's opacity is a property of **what crosses the network to an unauthenticated
caller**. It was never intended to blind the person holding the server. Specifically:

- The HTTP contract is unchanged and must stay unchanged: same `503`, same `DEMO_UNAVAILABLE`, same
  body, byte-identical across every cause.
- `DemoSessionUnavailableError` is now logged server-side at `warn` with its reason in a structured
  field. This is **not** a violation of this ADR.
- Secrets never enter that channel: no token, ever.
- A boot-time self-check (`services/demoSessionSelfCheck.ts`) reports the same reason at startup, so
  a misconfigured demo announces itself at deploy time rather than at first visitor. It never throws
  — auth-service is Critical with seven dependents and the demo is optional.

**The general rule, for any future deliberately-opaque failure path:** a response that refuses to
say why is a privacy feature; a *log* that refuses to say why is just a missing log. Pair the two,
and assert both halves in one test — that the response is byte-identical across two different
causes, **and** that the logs differ. A test asserting only the log would pass a version that leaks
the reason to the client; a test asserting only the response is what let this ship.

Covered by `services/auth-service/tests/tdd/sprint-129-demo-session-logging.test.ts`, which proves
both halves by injection.
