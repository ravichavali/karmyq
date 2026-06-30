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
