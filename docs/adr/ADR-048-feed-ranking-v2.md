# ADR-048: Feed Ranking v2 — 7-Signal Formula + Interaction Logging

**Status**: Implemented
**Date**: 2026-04-03
**Supersedes**: ADR-031 (feed scoring weights — extended, not replaced)

> **Amended by [ADR-082](ADR-082-reputation-disclosure-boundary.md) (Sprint 112):** the 7-signal
> formula's "requester trust" signal is removed from outward-affecting feed ranking (it let another
> member's exact reputation be reconstructed from the exposed composite + weights). The feed now ranks
> on the six remaining signals (weights normalized to sum 1.0), `feed_weight_requester_trust` is not
> founder-configurable, and the composite score, its components, and breakdowns are no longer returned;
> the outward ranking signal is the server-sorted order (a non-reversible rank). Interaction logging
> (the feed_events insert) is unchanged and remains internal.

## Context

Sprint 43 extends ADR-031's 4-signal feed scoring with 3 additional signals: requester trust score, prior interaction history, and request recency. It also introduces a `requests.feed_events` table to log impressions and outcomes for future weight tuning.

The original 4 signals (skill match, trust distance, community relevance, urgency) captured match quality and connection strength but ignored whether a viewer has helped this person before or how fresh the request is. High-urgency old requests could crowd out timely new ones from known collaborators.

## Decision

Extend `FeedScoringWeights` and `FeedScoreInput` with `requesterTrustScore`, `priorInteractionScore`, and `recencyScore`. Redistribute default weights to sum to 1.0 across all 7 signals. Move weight-sum validation from DB constraint to application code. Add `requests.feed_events` table with fire-and-forget impression/outcome logging.

## Signal Definitions

| Signal | Source | Range | Default Weight |
|--------|--------|-------|----------------|
| `skillMatchScore` | `calculateMatchScore()` in shared | 0–100 | 0.25 |
| `trustDistanceScore` | `auth.social_distances` cache | 0–100 | 0.20 |
| `communityRelevanceScore` | community config `enabled_request_types` | 0–100 | 0.15 |
| `urgencyScore` | request urgency field | 0–100 | 0.10 |
| `requesterTrustScore` | `reputation.trust_scores` (already fetched) | 0–100 | 0.15 |
| `priorInteractionScore` | `social_graph.connections` (batch query) | 0, 50, or 100 | 0.10 |
| `recencyScore` | computed from `request.created_at` (no DB join) | 0–100 | 0.05 |

**Prior interaction scoring:** `type='exchange'` → 100, `type='community'` → 50, no row → 0.

**Recency scoring:** 0–1 day → 100, 2–3 days → 85, 4–7 days → 70, 8–14 days → 50, 15–30 days → 30, 30+ days → 15.

## Logging Strategy

`requests.feed_events` records three event types:
- `impression` — logged fire-and-forget after each `/requests/curated` response
- `offer_made` — logged when a match is created (POST `/matches`)
- `match_completed` — logged when both parties confirm completion

This creates a dataset for correlation analysis: do higher `priorInteractionScore` values lead to more completions? Weights can be tuned from this data in future sprints.

## Weight Sum Validation

The DB CHECK constraint on `communities.community_configs` is dropped. Validation moves to application code in `calculateFeedScore()`: throws `Error('Feed weights must sum to 1.0 (got X)')` if `|sum - 1.0| > 0.01`. Caught at call time, not silently ignored.

## Consequences

- Feed results will shift: requests from prior exchange partners and fresher requests rank higher.
- Skill match weight decreases from 40% to 25% of the total score.
- Community admins can override all 7 weights in `community_configs` (7 columns now).
- Weight-sum validation moves to application code — misconfigured DB weights throw at call time rather than at migration time.
- `requests.feed_events` is append-only, non-blocking. A logging failure never surfaces to the user.
