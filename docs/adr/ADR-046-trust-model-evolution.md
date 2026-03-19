# ADR-046: Trust Model Evolution

**Status**: Accepted
**Date**: 2026-03-19
**Deciders**: Platform team
**Relates to**: ADR-037 (Multi-Signal Trust Score), ADR-040 (Community Trust Score), ADR-043 (Three-Score Model)

## Context

Trust parameters (depth/breadth weights, carry factor, decay) are currently configured once at community setup and remain static. This means users with consistently positive cross-community experiences have no way to reflect that in their trust model. Communities whose actual behavior diverges from their initial config drift silently.

## Decision

Introduce a bidirectional trust evolution system with three layers:

1. **Sprint 30 — Individual layer**: per-user trust config table (`reputation.user_trust_configs`) with opt-in auto-evolution. Five behavioral signals nudge parameters. An audit log (`reputation.user_trust_evolution_log`) tracks every adjustment.

2. **Sprint 31 — Community evolution**: aggregate individual signals to drive community-level config drift.

3. **Sprint 32 — Fractal feed interface**: feed and request ranking use blended `(user_personal, community, blend_factor)` weights.

## Core Principle

**Accuracy over direction.** The system calibrates toward what is real for this user or community. High cross-community trust is not better than low cross-community trust. An accurate low-trust model is healthier than an inaccurate high-trust model. Trust grows on honest foundations.

## New Parameter: `cross_community_prior`

A Bayesian prior (0.05–0.95, default 0.50) representing the starting trust assumption for people from other communities, before interaction history exists. Distinct from depth/breadth weights (which measure interaction patterns). Calibrates based on actual experience, in either direction.

## Known Limitations (Sprint 30)

- `getUserEffectiveParams()` exists but is not yet wired into `updateTrustScore()` — individual parameters don't yet affect displayed scores. Wired in Sprint 32.
- Cross-community membership check uses current membership, not historical. A user who left a community after submitting feedback will be classified as cross-community. Acceptable approximation for Sprint 30.
- 7-day cooldown is application-level, not DB-level. Duplicate nudges during concurrent events are bounded-harmless (clamped to same value at bound).

## Evolution Signals

| Signal | Code path | What it calibrates |
|--------|-----------|-------------------|
| `cross_community_positive_feedback` | Inline, `POST /feedback` | `cross_community_prior` +0.02, `breadth_weight` +0.01 |
| `cross_community_negative_feedback` | Inline, `POST /feedback` | `cross_community_prior` −0.02 |
| `cross_community_match_completed` | `match_completed` event | `cross_community_prior` +0.01 |
| `repeat_interaction_same_person` | `match_completed` event | `depth_weight` +0.01 |
| `diverse_community_interactions` | `match_completed` event | `breadth_weight` +0.02, `cross_community_prior` +0.01 |
