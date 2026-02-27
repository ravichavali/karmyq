# ADR-042: Provider Trust Score

**Status**: Accepted
**Date**: 2026-02-27
**Related**: ADR-041 (Two-Layer Model), ADR-037 (Personal Trust Score)

---

## Context

Layer 2 providers (ADR-041) need a trust signal that is:
- Visible to anyone considering hiring the provider
- Based on direct service experience, not community relationships
- Separate from ADR-037 personal trust (which measures gift-economy reciprocity)

Star ratings are the established pattern for service providers. Completion record and responsiveness add behavioral signals beyond subjective ratings.

---

## Decision

Provider trust score uses a **three-component weighted formula**:

```
provider_trust_score =
  (avg_stars_normalized * 0.60) +
  (completion_rate       * 0.30) +
  (response_rate         * 0.10)
```

Where:
- `avg_stars_normalized` = `((avg_stars - 1) / 4) * 100` — maps 1–5 stars to 0–100
- `completion_rate` = completed matches / total matches accepted (0–100)
- `response_rate` = responded within 24h / total inquiries (0–100)

Score is an integer 0–100, cached in `reputation.provider_trust_scores`.

---

## Weight Rationale

| Component | Weight | Rationale |
|-----------|--------|-----------|
| avg_stars | 60% | Primary quality signal — direct experience feedback |
| completion_rate | 30% | Reliability — did they show up and complete the job? |
| response_rate | 10% | Responsiveness — secondary UX signal |

Completion rate is weighted heavily (30%) because a provider who accepts matches and doesn't complete them is more harmful to trust than one with mediocre ratings.

---

## Separation from ADR-037

| | Personal Trust (ADR-037) | Provider Trust (ADR-042) |
|-|--------------------------|--------------------------|
| Measures | Reciprocity in gift economy | Service quality + reliability |
| Source | Feedback after mutual aid | Stars after paid service |
| Scope | Community-scoped | Provider-scoped (public) |
| Range | 0–100 | 0–100 |
| Decay | Yes (ADR-011) | No |

---

## Score Update Triggers

Score is recalculated immediately when a new review is submitted (via `recalculateProviderTrustScore()`). Completion rate and response rate are updated by match completion events (future work for Phase 2).

---

## Review Constraints

- One review per match per reviewer (enforced by UNIQUE constraint on `match_id, reviewer_id`)
- Reviews are tied to `match_id` where possible to verify the reviewer actually used the service
- `match_id` is nullable for cases where coordination happened outside Karmyq's match system

---

## Consequences

**Positive**
- Simple, interpretable formula
- Visible score gives consumers a signal without requiring them to read all reviews
- Separate from karma/personal trust — no cross-contamination

**Negative / Risks**
- Completion rate starts at 0 for new providers — cold start problem
- Phase 1 response_rate not yet tracked (defaults to 0); Phase 2 will wire match response events
- Provider could game stars by self-reviewing through alt accounts (mitigated by match_id verification in Phase 2)
