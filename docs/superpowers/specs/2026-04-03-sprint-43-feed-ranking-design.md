# Sprint 43: Feed Ranking v2 — Design Spec

**Date**: 2026-04-03
**Status**: Approved
**Version**: v9.17.0 → v9.18.0
**Sprint Branch**: `feature/sprint-43-feed-ranking`

---

## Overview

The community feed is the platform's primary surface for connecting people who need help with people who can provide it. Sprint 42 shipped the Dibs system to prioritize trusted offers. Sprint 43 makes the feed itself smarter: requests that a viewer is most likely to act on should appear first.

The current feed already scores on four signals (skill match, trust distance, community relevance, urgency), but three high-signal data points are being fetched and discarded: the requester's trust score, whether the viewer has a prior successful interaction with the requester, and how fresh the request is. This sprint adds those signals to the formula, redistributes weights, and introduces a `feed_events` table that records impressions and outcomes — giving us the data to tune weights with evidence rather than intuition over time.

Error observability is treated as a practice, not a feature: every new code path in this sprint must produce human-readable error messages at service boundaries, distinguishing user-facing 400s from unexpected 500s.

### Core Principle: Evidence Before Intuition

We do not know the right weights today. We build the scoring system with explicit weights that can be changed, and we build the logging infrastructure so that future tuning decisions are grounded in actual outcome data (which signals correlate with completed matches), not guesswork.

---

## Multi-Sprint Arc

### Sprint 42 — Dibs / First Refusal (complete)
Trust-based offer prioritization. Requester picks one person first; if declined, request goes public.

### Sprint 43 — Feed Ranking v2 (this sprint)
Richer scoring signals + feed event logging. Feed becomes the primary participation driver.

### Sprint 44 — UI Pruning
Visual and structural simplification of the dashboard and CommitmentsTab. Apply "what can we remove?" lens.

### Sprint 45+ — Group Task Communities / Onboarding
Group communities organized around shared recurring activities; first-run UX.

---

## New Concepts

**Feed event**: A record of a user seeing a request in their feed (impression), making an offer (offer_made), or completing a match (match_completed). Events are the raw material for future weight tuning.

**Prior interaction score**: A signal measuring whether the feed viewer and the request's poster have successfully exchanged before. Direct exchange = high score; community-only connection = partial credit; no prior history = zero. This is distinct from trust distance (degrees of separation), which measures indirect network proximity.

**Recency score**: A time-decay signal that boosts fresh requests and lets stale ones drift down naturally, without them being removed. A 3-day-old request scores lower than a 6-hour-old request, all else equal.

---

## Data Model

### New table: `requests.feed_events`

```sql
CREATE TABLE requests.feed_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id    UUID NOT NULL REFERENCES requests.help_requests(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK (event_type IN ('impression', 'offer_made', 'match_completed')),
  feed_score    NUMERIC(5,2),       -- score at time of impression
  feed_rank     INTEGER,            -- position in feed (1-indexed)
  source_tier   TEXT,               -- 'community' | 'trust_network' | 'platform'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feed_events_user       ON requests.feed_events(user_id, created_at DESC);
CREATE INDEX idx_feed_events_request    ON requests.feed_events(request_id, event_type);
CREATE INDEX idx_feed_events_type_date  ON requests.feed_events(event_type, created_at DESC);
```

### Modified: `communities.community_configs`

Add 3 new weight columns; drop the 4-column sum CHECK constraint; add validation in application code:

```sql
ALTER TABLE communities.community_configs
  ADD COLUMN feed_weight_requester_trust   DECIMAL(3,2) NOT NULL DEFAULT 0.15,
  ADD COLUMN feed_weight_prior_interaction DECIMAL(3,2) NOT NULL DEFAULT 0.15,
  ADD COLUMN feed_weight_recency           DECIMAL(3,2) NOT NULL DEFAULT 0.05;

-- Drop the old 4-column constraint (constraint name may vary)
ALTER TABLE communities.community_configs
  DROP CONSTRAINT IF EXISTS community_configs_feed_weights_sum_check;

-- Redistribute existing rows
UPDATE communities.community_configs SET
  feed_weight_skill_match        = 0.25,
  feed_weight_trust_distance     = 0.20,
  feed_weight_community_relevance = 0.15,
  feed_weight_urgency            = 0.10,
  feed_weight_requester_trust    = 0.15,
  feed_weight_prior_interaction  = 0.15,
  feed_weight_recency            = 0.05;
```

---

## Scoring Formula (v2)

```
feedScore =
  skillMatch       × W_skill           (0.25)
  trustDistance    × W_trust           (0.20)
  communityRel     × W_community_rel   (0.15)
  urgency          × W_urgency         (0.10)
  requesterTrust   × W_requester_trust (0.15)  ← new
  priorInteraction × W_prior_interact  (0.15)  ← new
  recency          × W_recency         (0.05)  ← new
```

**New signal values:**

| Signal | 0 | 50 | 100 |
|--------|---|----|-----|
| `requesterTrust` | Score 0 (unknown/bad) | Score 50 (default) | Score 100 (highly trusted) |
| `priorInteraction` | No prior history | Community-only connection | Prior successful exchange |
| `recency` | 30+ days old | 8–14 days old | 0–1 day old |

Full recency decay table:
- 0–1 days: 100
- 2–3 days: 85
- 4–7 days: 70
- 8–14 days: 50
- 15–30 days: 30
- 30+ days: 15

**Weights sum validation** moves to application code (`calculateFeedScore()` throws if weights don't sum to 1.0 ± 0.01).

---

## API Endpoints

| Method | Path | Change |
|--------|------|--------|
| `GET` | `/requests/curated` | Now uses 7-signal formula; returns `priorInteractionScore` and `recencyScore` in `feedBreakdown`; logs impression event fire-and-forget |
| `POST` | `/requests/:id/matches` (existing) | Logs `offer_made` feed event after successful match creation |
| Bull handler | `match_completed` event (existing) | Logs `match_completed` feed event |

No new routes. No breaking changes to response shape (only additions to `feedBreakdown`).

---

## Frontend Changes

### `apps/frontend/src/utils/commitmentSort.ts`
Change sort within each status group from `updated_at DESC` to `created_at ASC` (chronological order, earliest first).

### `apps/frontend/src/components/CommitmentsTab.tsx`
Ensure `created_at` is available on match objects passed to the sort utility. No visible UI change beyond order.

No other frontend changes this sprint. Feed UI already shows `feedScore` and `matchScore`; no new columns needed in the card.

---

## User Guide & Doc Updates

- **ADR-038** (`docs/adr/ADR-038-feed-ranking-v2.md`): Documents the 7-signal formula, logging strategy, and weight redistribution rationale.
- **Landing ADR page** (`apps/landing/src/data/docs/concepts/adr-038-feed-ranking-v2.json`): Published to docs site.
- **Landing nav** (`apps/landing/src/data/docs/nav.json`): Add ADR-038 under "Architecture Decisions".
- **Request service landing page** (`apps/landing/src/data/docs/services/request-service.json`): Document `feed_events` table and updated `/requests/curated` behavior.
- **Existing user guide update**: If there is a "How the feed works" guide, update it to describe that requests from people you've helped before rank higher.

---

## Critical Implementation Notes

1. **Weight sum constraint** — Drop the DB CHECK constraint; enforce sum = 1.0 (±0.01) in `calculateFeedScore()`. This makes it easier to extend in future sprints.

2. **Existing community config rows** — Migration MUST `UPDATE` all existing rows to the new weight distribution before or simultaneously with adding columns (defaults of 0 would break the sum).

3. **Prior interaction batch query** — Single SQL query against `social_graph.connections`, not N calls. Handle both directions (user_a_id / user_b_id). Score: exchange=100, community=50, none=0.

4. **Feed events logging is non-blocking** — Never `await` in the response path. Use fire-and-forget (`void query(...)` inside `setImmediate`). A logging failure must never surface to the user.

5. **Recency is computed in the app layer** — No DB join needed. Use `request.created_at` already present in the response row.

6. **CommitmentsTab sort** — `created_at ASC` within each status group (proposed → matched → completed). Verify `created_at` is returned by the matches API.

7. **Error messages** — Every new code path (batch connections query, feed_events insert, new scoring path) must catch errors and log structured messages: `{ service: 'request-service', endpoint: '/requests/curated', step: 'prior-interaction-batch', error: e.message }`.
