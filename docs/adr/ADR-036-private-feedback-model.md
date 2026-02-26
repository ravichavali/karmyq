# ADR-036: Private Feedback Model — Trust Without Rating Economies

**Date**: 2026-02-25
**Status**: Accepted
**Deciders**: Development Team

## Context

After implementing the trust score formula (`50 + karma_contribution + feedback_contribution`), we needed a mechanism for users to submit quality feedback after a completed interaction. The `feedback.feedback` database table and `avg_feedback_score` field in `reputation.trust_scores` were already designed for this.

The key design question was: **should feedback ratings be visible to other users?**

### The Social Gossip Problem

In human societies, peer reputation forms through quiet word-of-mouth — not public scorecards. When people whisper "she's reliable" or "he follows through," that reputation propagates through trust networks organically. No one publishes a leaderboard.

Public rating systems disrupt this natural dynamic in several ways:

**1. Performative behavior**: When ratings are visible, people optimize for the score rather than the interaction. The goal becomes "get 5 stars" rather than "be genuinely helpful." This distorts the signal we're trying to measure.

**2. Asymmetric power dynamics**: A negative public review can damage someone disproportionately — especially in small communities where the population is limited and reputation is everything. A helper who gives a bad experience once shouldn't carry a public 1-star for years.

**3. Rating chilling effect**: Users avoid giving honest negative feedback out of fear of retaliation ("I gave them 2 stars, now they'll give me 2 stars"). This compresses all feedback toward 5 stars, making the signal useless.

**4. Rating economy emerges**: Public scores create a secondary currency. Users start tracking their scores, comparing scores, and feeling anxiety around them. This is the Uber/Airbnb problem — the rating number becomes an identity artifact divorced from actual helpfulness.

**5. Gaming and reciprocal inflation**: When ratings affect visibility or status, communities develop implicit norms of reciprocal 5-star exchange that defeat the measurement purpose entirely.

## Decision

**Feedback ratings are private inputs to the trust score algorithm. They are never exposed via API or displayed in any UI.**

- Users submit a 1–5 star rating after each completed interaction
- The rating feeds into `avg_feedback_score` in the trust formula
- The trust score itself influences feed curation and trust distance filtering
- No user can ever see another user's rating or their own average feedback score
- The feedback endpoint (`POST /reputation/feedback`) is authenticated but the aggregated result is never returned to clients

The trust score (50–100) is surfaced in the trust path display, but it's presented as a holistic "trust distance" indicator — not decomposed into "this person's average rating is 3.7 stars."

## Analogy

Credit scores work the same way: lenders use them to make decisions, but individuals don't see each other's credit scores. This enables honest assessment without social comparison or anxiety.

## Consequences

### Positive

- **Honest signal**: Users can rate honestly without fear of retaliation
- **Organic reputation**: Trust shifts feel natural, not punitive — you don't know why your feed changed
- **No rating anxiety**: Users aren't watching a number
- **No gaming**: No visible score to optimize, so behavior optimizes for the interaction instead
- **Simpler UI**: No rating display component or history view needed

### Negative

- **Less transparent**: Users can't see why their feed weight is changing
- **Harder to debug**: If feedback data is affecting results incorrectly, users can't surface the issue
- **Some user expectation mismatch**: Users familiar with Uber/Airbnb may expect to see ratings

### Neutral

- **Karma is still visible**: Public karma score and interaction count remain surfaced on profiles
- **Trust distance still shown**: The "trust path" badge (direct / 2nd degree / community) gives directional information without rating numbers

## Implementation

- `services/reputation-service/src/database/feedbackDb.ts` — insert/query layer
- `services/reputation-service/src/routes/reputation.ts` — `POST /reputation/feedback` (authenticated, no GET exposed)
- `apps/frontend/src/components/UpcomingPanel.tsx` — star picker appears inline after match completion, silently submits, no confirmation of the rating value shown
- `apps/frontend/src/lib/api.ts` — `reputationService.submitFeedback()` — fire-and-forget pattern (errors swallowed client-side)

## References

- ADR-035: Karma Allocation Strategy and Trust Score Abstraction
- ADR-011: Reputation Decay System
- `services/reputation-service/src/services/trustScoreStrategy.ts`
