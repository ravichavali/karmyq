# ADR-072: Dibs Scope — the Neighbor/Provider First-Ask Seam

**Status:** Implemented
**Date:** 2026-06-08
**Sprint:** 92

## Context

"Dibs" (ADR-051) lets a requester privately give one trusted person first right of refusal before a
request goes public. It was designed in the **service-provider** layer (ADR-041's two-layer model):
the candidate is a vetted provider, the copy reads "a trusted **provider** can get an exclusive
window," and the submit path validates the nominee against the provider-only eligibility query.

But the dibs prompt was being triggered for **every** request type. `RequestWizard` fetched a dibs
candidate after creating any request; for a non-service (mutual-aid) request the backend returned an
ordinary community member (the mutual-aid candidate path), and the UI then framed that neighbour as
a "provider" (BUG-007). Worse, the submit path (`POST /requests/:id/dibs`) validated the nominee
through the provider-only `getEligibleCandidates`, so a neighbour first-ask 403'd with
`NO_PRIOR_INTERACTION` even when the neighbour was a perfectly valid mutual-aid candidate.

This sits on top of a standing product question (IDEAS): *"community and service-provider are two
facets of the same user"* — so the first-ask mechanic arguably belongs to **both** facets, framed
differently.

A second, related inconsistency surfaced in the same help-loop (BUG-005): the completion → rating
transition was implemented twice. The Dashboard `DecisionBand` "mark done" silently dropped the row
and never unlocked rating; the `CommitmentsTab` showed the rating prompt even on a one-sided done.

## Decision

### 1. Dibs scope: Option A (reframe), not Option B (disable)

We keep a first-ask for **both** facets, with facet-appropriate framing — we do **not** restrict the
mechanic to providers.

Two options were weighed:

- **Option A — reframe (chosen):** keep a first-ask for neighbours with neighbour-framed copy and a
  warm (non-provider) visual; "dibs" terminology stays provider-only. Candidates carry a
  `kind: 'neighbor' | 'provider'` discriminator (`getMutualAidCandidates` → neighbor,
  `getEligibleCandidates` → provider) that drives the framing. The submit path validates a
  non-service nominee against the **mutual-aid** candidate pool, so a neighbour first-ask is accepted
  instead of 403'ing.
- **Option B — disable:** make dibs provider-only — skip the prompt for non-service requests and
  remove the mutual-aid candidate path entirely.

**Option A was ratified** because it honours the two-facet direction (a neighbour first-ask is a real,
useful trust gesture) and preserves the existing mutual-aid candidate scoring rather than deleting
it. The visible cost is more surface area (a discriminator threaded through candidate selection, the
submit validation, and the prompt copy) — acceptable for the product value.

### 2. One completion → rating source of truth

The rating prompt fires on exactly one signal — the `completeMatch` transition to
`fully_completed` (two-phase completion) — from **both** surfaces. A shared
`extractCompletion()` helper and a shared `RatingPrompt` component replace the two divergent
implementations. A one-sided "done" never prompts for a rating; the Dashboard `DecisionBand` now
unlocks rating in place on full completion instead of dropping the row.

## Consequences

- A neighbour can be given a first-ask with honest, neighbour-framed copy; the provider dibs flow is
  unchanged.
- The dibs candidate contract gains a `kind` discriminator (internal; no breaking API change). The
  decisions feed gains `counterparty_id` + `community_id` so the Dashboard can attribute a rating.
- Completion and rating behave identically wherever a member closes an exchange, removing a class of
  "I marked it done but couldn't rate" confusion.
- "Dibs" remains provider-vocabulary; the neighbour equivalent is surfaced as a **first ask**. If we
  later unify the vocabulary entirely, that is a follow-up, not a regression of this decision.

## Related

- ADR-051: Explore/Exploit Dibs (the candidate scoring this builds on)
- ADR-041: Two-Layer Mutual-Aid + Services (the two-facet model)
- ADR-066: Unified Feed Model (the decision band these actions run through)
- BUG-007, BUG-005 (docs/BUGS.md) — the defects this resolves
