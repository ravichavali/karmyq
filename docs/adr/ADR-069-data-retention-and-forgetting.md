# ADR-069: Data Retention and Forgetting (content anonymization policy)

**Status**: Accepted
**Date**: 2026-06-07
**Sprint**: 90
**Version**: 10.14.0

## Context

Karmyq's manifesto (§7) and [ADR-066](ADR-066-unified-feed-model.md) promise a platform that is
**"designed to forget."** As of Sprint 89 that promise was real only at the *edge* layer —
`trustEdgeSweepJob` deletes decayed trust edges, reputation decays ([ADR-011](ADR-011-reputation-decay.md)),
requests expire and get TTL-swept — but it was **invisible**, and the *content* of past exchanges
(request free-text, conversation messages) was **retained forever**. The forgetting was ranking math,
not a trustworthy, perceptible promise. PII accumulated indefinitely in `help_requests.title` /
`description` / `payload` / `requirements` and `messages.content`.

## Decision

Introduce a real **content retention policy**, enforced by a new `memoryRetentionJob` in
cleanup-service (joining `trustEdgeSweepJob` / `reputationDecayJob` / `expirationJob`; it also
**supersedes and retires** the old `requestTtlSweepJob` — see below), governed by a
`requests.retention_config` table that mirrors `social_graph.trust_decay_config` (per-community rows +
a global `NULL` default row).

### What forgets, and how

1. **Completed-request free-text → anonymized to a sentinel.** When a request with `status='completed'`
   ages past `completed_request_window_days` (default 180), its `title`, `description`, `payload`, and
   `requirements` are overwritten with `'[forgotten]'` / `'{}'::jsonb` and `content_forgotten_at` is
   stamped. The match and karma survive untouched (the aggregate).
2. **Expired + unmatched requests → hard-deleted.** A request with `expired = TRUE` and **no match
   row**, aged past `expired_request_window_days` (default 30) from `updated_at`, is deleted outright —
   there is no shared history to keep.
3. **Messages → cascade-forgotten with their exchange.** A request, its match, and the conversation
   (`messaging.conversations.request_match_id`) + messages are one **Exchange Unit**. When the request's
   text is forgotten, its conversation's `messages.content` is anonymized in the **same atomic
   statement**. A standalone `message_window_days` (default 180) backstop catches stragglers.

### The Exchange Unit cascade

Forgetting cascades along the Exchange Unit (request → match → conversation → messages). The
completed-anonymize + message-cascade is one data-modifying CTE — request text and its messages forget
**together or not at all**. The `match` and `karma_records` are never part of the cascade.

### Why karma is OFF LIMITS

`reputation.karma_records` holds **no free-text PII**. Its `reason` is a load-bearing enum
(`'Provided help'` / `'Received help'` / milestone strings) filtered across `trustMetricsDb`,
`trustEvolutionDb`, `communityTrustService`, and the `reputation.ts` karma breakdown
(`reason IN ('Provided help','Received help')`). Anonymizing it would silently corrupt trust scores.
There is nothing safe to forget there, so it is left fully intact — which *strengthens* the
keep-aggregates principle.

### Anonymize, don't NULL

The target columns (`help_requests.title`/`description`, `messages.content`) are `NOT NULL`. Forgetting
writes the sentinel `'[forgotten]'` (and `'{}'::jsonb` for the JSONB columns), never `NULL`. Aggregates
(reputation, trust, community pulse) keep computing correctly because only anonymizable free-text is
removed — never the numbers downstream systems depend on.

### Per-community windows

Windows resolve **per request**, honoring per-community overrides: a request's effective window is the
`MAX` over its communities (via `request_communities`) of that community's `retention_config` override,
falling back to the global row, then a hardcoded default. `MAX` is deliberate — a request shared across
communities is never forgotten earlier than **any** owning community wants. The standalone message
backstop uses the global window (a loose message isn't reliably attributable to one community;
per-community message retention is honored via the Exchange Unit cascade).

### Supersedes `requestTtlSweepJob`

The pre-existing `requestTtlSweepJob` hard-deleted completed+rated requests **and their matches** (which
FK-cascade-deleted conversations and messages) at 30 days. That both **destroyed the aggregate this ADR
promises to keep** and fired long before the 180-day anonymize window. It is **retired** — the
`memoryRetentionJob` now owns the completed-request lifecycle (anonymize, keep aggregates). The job file,
its cron, and the `/jobs/sweep-request-ttl` endpoint were removed.

### Idempotency

`retention_config` uses a partial unique index `WHERE community_id IS NULL` plus a `WHERE NOT EXISTS`
guarded seed (a bare `UNIQUE(community_id)` does **not** make the NULL global row unique in Postgres).
Partial indexes `WHERE content_forgotten_at IS NULL` / `WHERE forgotten_at IS NULL` mean each sweep only
scans un-forgotten rows, and a second run forgets nothing already forgotten.

### Transparency (member-facing)

A read-only `GET /api/requests/retention-policy?communityId=` returns the resolved windows plus the
member's own held-vs-forgotten counts (no PII), backing the `/about/memory` transparency page. Member
controls are **transparency only** this sprint — per-item "forget now" / export are deferred.

## Consequences

- **Positive:** the forget promise is real for content; PII no longer accumulates forever; reputation /
  trust / pulse math is provably unaffected (karma untouched, aggregates preserved); members can read
  exactly what is kept vs let go.
- **Negative / trade-offs:** forgotten exchanges show `'[forgotten]'` in any historical view (acceptable
  — that is the point); windows are coarse (per-community, not per-item) this sprint.
- **Follow-ups:** per-item member-initiated forget + data export; surfacing retention windows in
  community settings UI.

## Related

- [ADR-070: Visible Decay Model](ADR-070-visible-decay-model.md) — the member-facing other half.
- [ADR-066: Unified Feed Model](ADR-066-unified-feed-model.md), [ADR-056], manifesto §7.
