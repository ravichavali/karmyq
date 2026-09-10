The four trust metrics are defined **twice**, on purpose, and the second copy is easy to miss.

| Definition | Lives in | Reads |
|---|---|---|
| SQL (the live writer) | `trustMetricsDb.ts` `getTrustMetrics`, plus the recent-interaction count in `karmaService.ts` `updateTrustScore` | rows already in PostgreSQL |
| TypeScript (the backfill preview) | `standingPreview.ts` `buildPreviewIndex` / `computePreviewMetrics` | the projected post-apply rows, which are **not in the database yet** |

The duplication is forced, not lazy: `analyzeStandingBackfill` is a dry run that must perform no
writes, so it cannot materialize its projection and query it. Sprint 128 PR C exists because the
two had already drifted — the preview reported 0 for memberships the writer then stored at 1.

**If you change the metric SQL, change `standingPreview.ts` in the same PR.** The semantics that
are easy to get wrong, each of which the TypeScript deliberately mirrors:

- `distinct_communities` is **global** — `WHERE user_id = $1`, no community predicate.
- `distinct_people` filters `me` to the local community but does **not** filter `other`; the join is
  on `related_entity_id`, so NULL match identity never joins.
- `repeat_pairs` needs `COUNT(DISTINCT me.related_entity_id) >= 2`.
- `recent_interactions` is a local **row count** with an inclusive `created_at >= now - 365d`, and
  the window is duplicated as `standingPreview.RECENT_WINDOW_MS`.
- All four name exactly `('Provided help', 'Received help')` — **narrower** than the projector's
  `COMPLETED_MATCH_REASONS`, which also contains the first-help and milestone reasons.

**What actually catches drift**, and what does not:

- The arbiter is `tests/integration/sprint-126-standing-backfill.integration.test.ts`,
  "discriminates every metric the writer computes" — it runs the real `getTrustMetrics` against real
  rows and compares all four numbers to the TypeScript, per membership. It needs a database.
- `tests/regression/sprint-128-recency-window.test.ts` pins the 365-day window against the cutoff
  `updateTrustScore` puts on the wire.
- **Score buckets do not catch drift.** An extra community moves a score by about one point, so a
  wrong metric stays inside the same bucket. A bucket-level comparison passed with a deliberately
  broken reason set during Sprint 128 review; the per-metric comparison caught it immediately.
- The reason set derivation runs **one way**. `standingPreview.ts` builds its filter from
  `COMPLETED_MATCH_REASONS`, but the SQL hardcodes the literals — renaming the constant moves the
  projector and the preview and silently leaves the SQL matching a string nothing writes.

The deeper fix, deferred: split `getTrustMetrics` into a row fetch plus a pure
`calculateTrustMetrics(rows, …)`, the way `feedbackDb.ts` already splits
`calculateWeightedAvgFeedback` from `getWeightedAvgFeedback` for the sibling input. That would leave
one definition instead of two. It touches the live writer, so it needs its own PR and its own
regression coverage.
