# ADR-047: Community Evolution Engine

**Status**: Implemented
**Date**: 2026-03-20
**Sprint**: 31

## Context

Sprint 30 introduced individual trust evolution — each user's trust parameters calibrate
based on lived experience. This creates a source of signal that had no destination: individual
calibrations happened but didn't feed back into the community-level trust model.

## Decision

Build a Community Evolution Engine that aggregates member trust deltas to drift community config.

Key design decisions:
1. **Delta-based, not absolute**: The signal is the change in each member's trust since
   they began evolving — not their current values. A community of uniformly trusting members
   who never evolved has no signal to contribute.
2. **Two opt-out levels, no middle state**: Users opt in/out of personal evolution.
   Communities opt in/out of community evolution. If a user's trust evolves, their delta
   contributes to the community — there is no third flag.
3. **Interaction rate as a health validator**: Before applying evolution, we check whether
   interaction rate is declining. Declining interaction dampens the nudge, preventing the
   system from drifting toward configurations that correlate with disengagement.
4. **Direction consensus for hop count**: `trust_path_max_hops` only changes after 3
   consecutive evolution cycles agree on direction, preventing oscillation on a high-impact
   parameter.
5. **Pluggable by design**: `communityEvolutionService.ts` checks the evolution flag at
   every entry point and is removable without touching core karma/trust logic.
6. **Default opt-out**: Both user and community evolution default to TRUE. Consent is given
   at account/community creation.

## Three Parameters That Evolve

- `cross_community_prior` (0.05–0.95): Direct delta aggregation × 0.30 damping
- `karma_split_helper` (0–100): Follows prior direction, ±1 per cycle
- `trust_path_max_hops` (1–5): Follows prior direction, ±1 only after 3 consecutive same-direction cycles

## Consequences

- Community configs are no longer static — they require a history audit log (`community_evolution_log`)
- Admins need a UI surface to observe evolution history and toggle it off
- Sprint 32 (fractal feed) can now blend individual + community evolved params in the matching model
