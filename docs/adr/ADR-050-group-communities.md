# ADR-050: Group Communities as a Distinct Community Type

**Status**: Implemented
**Date**: 2026-04-07
**Sprint**: 47

## Context

Karmyq communities have historically been uniform: all are mutual aid networks coordinating help requests. As the platform grows, users want to coordinate recurring shared activities — sports, fitness, social events — where the coordination unit is a scheduled event, not a help request.

## Decision

Introduce `community_type` as an explicit enum on the communities table (`'mutual_aid'` | `'group'`). Group communities expose activity scheduling endpoints and an Activities tab in the UI. Mutual aid communities are unchanged.

## Consequences

- **Positive**: Clear model for different coordination types; extensible to future types (e.g., `'provider_collective'`).
- **Positive**: Mutual aid behavior is entirely unchanged — no risk to existing communities.
- **Negative**: UI must branch on `community_type` — adds a conditional rendering path.
- **Neutral**: Karma/trust for group activities deferred to Sprint 49.

## Alternatives Considered

- **Single community type with flags**: e.g., `has_activities: boolean`. Rejected — flags accumulate and obscure the community's identity.
- **Separate service**: Activities as a new microservice. Rejected — activities are community-scoped and owned by community-service; a separate service adds cross-service queries for no benefit at current scale.
