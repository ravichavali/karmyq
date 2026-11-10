# ADR-042: Provider Trust Score

**Status**: Implemented
**Date**: 2026-02-27
**Implemented**: 2026-03-17 (Sprint 28)
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
- `completion_rate` = completed matches / total matches accepted (0–100) — **amended Sprint 139:** completed /
  (completed + cancelled); see *Amendment — Sprint 139* below
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

Score is recalculated on two events (and, since Sprint 139, by a nightly sweep — see the amendment):
1. **Review submitted** — `POST /reputation/provider-reviews` calls `recalculateProviderTrustScore()` immediately after storing the review
2. **Match completed** — `match_completed` event triggers `updateProviderCompletionRate()` in the reputation-service event subscriber, which updates `completion_rate` then calls `recalculateProviderTrustScore()`

Both paths share the same `providerTrustService.ts` implementation to guarantee formula consistency.

### Cold-start behavior
A new provider with no reviews and no matches has `trust_score = 0`. As they complete matches (even with no reviews), `completion_rate` rises and the score reflects that — e.g. 100% completion with no reviews yields `0*0.6 + 100*0.3 + 0*0.1 = 30`. Once reviews arrive, avg_stars contributes the majority (60%) of the score.

### Backfill
One-time recalculation for all existing providers is available at:
`POST /reputation/provider-trust/recalculate` (admin-only). Safe to run multiple times (idempotent).

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
- Completion rate starts at 0 for new providers — cold start produces `trust_score = 0` until first match completes
- response_rate not yet tracked (defaults to 0); wiring match response events is deferred to post-arc
- Provider could game stars by self-reviewing through alt accounts; mitigated by `UNIQUE (match_id, reviewer_id)` requiring a real completed match to review

### Implementation notes (Sprint 28)
- Single source of truth: `services/reputation-service/src/services/providerTrustService.ts`
- `recalculateProviderTrustScore`: reads from `provider_reviews` + `provider_trust_scores`, writes updated row
- `updateProviderCompletionRate`: called on `match_completed` event, updates completion_rate then calls recalculate
- Simulation submits provider reviews after the requester marks a match done (`complete-match-workflow.ts`)

## Amendment — Sprint 139 BUG-080: the completion-rate denominator, and a nightly refresh (2026-11-09)

**The denominator was wrong.** Both recalculation paths computed completed / `status IN ('accepted', 'completed')`.
The live match lifecycle is proposed → matched → completed | cancelled; no route writes `accepted` (only the curated
demo fixture does), so the denominator equalled the numerator and a provider with one completion read 100% whatever
else happened. A cancellation never lowered the rate.

**Decision (maintainer, 2026-11-09):** `completion_rate` = completed / (completed + cancelled) over the responder's
matches, as a percentage rounded to two decimals; 0 when there is no terminal outcome yet. Ongoing matches (proposed,
matched) are excluded, as are rejected, declined, legacy `accepted` and any other status. A cancellation counts
regardless of who cancelled: the data records no fault, so this is an outcome ratio, not a blame score. The scope stays
the responder, so every active profile a user owns carries the same rate. The 60/30/10 formula, response rate and the
review recompute are unchanged.

**Refresh triggers.** A cancellation fires no provider refresh, so a provider who cancels and never completes again
would keep a stale rate forever. The existing 03:30 reputation job (`cron/trustScoreRefresh.ts`, Sprint 126 / ADR-096)
now runs a provider phase after its personal phase, as two independent try/catch blocks:
`refreshAllProviderTrustScores()` walks every active provider profile sequentially, logs and counts a per-profile
failure, and rejects if the profiles cannot be enumerated. So:

1. **Review submitted** — immediate recompute (unchanged).
2. **Match completed** — immediate rate refresh + recompute (unchanged path, new denominator).
3. **Nightly, 03:30** — every active provider's rate and score. A cancellation is reflected by the next *successful*
   run; a failed night is retried the next night, so there is no guaranteed freshness bound during an outage.

The manual admin backfill keeps its fail-fast, count-returning contract. One internal helper computes the rate for all
three paths (`services/reputation-service/src/services/providerTrustService.ts`). No migration; deploy runs no
backfill — the first successful nightly run after deploy refreshes historical rates.
