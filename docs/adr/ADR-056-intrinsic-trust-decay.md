# ADR-056: Intrinsic Trust Decay (Interaction Half-Life)

**Status**: Implemented
**Date**: 2026-05-26
**Sprint**: 68

---

## Context

Trust edges in Karmyq encode the strength of the relationship between two members. Prior to this ADR, `raw_weight` was a static snapshot — a cumulative score that never changed after being set. This created a problem: a trust edge formed from a flurry of activity five years ago looked identical to one formed last month, even though the older relationship may have gone entirely dormant.

We wanted trust to reflect **recency** — not just history. The core design question was: where does decay live?

### Options Considered

1. **Nightly decay job**: A scheduled job updates `raw_weight` in place each night, applying the decay formula and writing the result back to the DB.
2. **Application-layer computation**: The service computes current weight on every read, passing the last-interaction timestamp through the decay formula at request time.
3. **PostgreSQL view (chosen)**: A DB view `trust_edges_live` computes `current_weight` at query time from stored `raw_weight`, `stability`, and `last_interaction_at`. The underlying `trust_edges` table stores only immutable parameters; time does the decaying.

---

## Decision

We use a **PostgreSQL view** to compute trust decay intrinsically. The view `social_graph.trust_edges_live` evaluates the Ebbinghaus exponential formula on every read:

```
current_weight = raw_weight × e^(-days_since_interaction / (stability × half_life))
```

Where:
- `raw_weight` is the peak trust weight, accumulated from weighted interactions. It only grows, never decays.
- `stability` starts at 1.0 and grows multiplicatively with each new interaction (`stability = stability × (1 + growth_rate)`). Higher stability = longer half-life.
- `half_life` is read from `social_graph.trust_decay_config`, community-specific or global (default: 30 days).

A `trust_decay_config` table allows per-community tuning of `base_half_life_days`, `stability_growth_rate`, and `disappearance_threshold`.

---

## Consequences

### Positive
- **No job does the decaying.** Time does. This eliminates a class of scheduler reliability issues.
- **No staleness.** `current_weight` is always accurate to the millisecond of the query.
- **Additive migration.** Adding `stability FLOAT NOT NULL DEFAULT 1.0` to `trust_edges` is zero-downtime. Existing rows default to 1.0 stability.
- **Per-community tuning.** Communities with faster social cycles (neighborhood groups) can configure shorter half-lives; communities with slower rhythms (regional networks) can extend them.

### Negative
- **View query cost.** The exponential formula runs on every row read. At the current scale (~670 edges), this is negligible. At 1M+ edges, a materialized view refresh job may be needed.
- **Sweep job still required.** Dead edges (below `disappearance_threshold`) must be garbage-collected by `trustEdgeSweepJob.ts`. The view can't delete rows.

### Neutral
- The relationship always outlives the transaction. Once an edge exists, `raw_weight` is a permanent ceiling. `current_weight` decays toward zero but never reaches it until the sweep job acts.

---

## Decay Behavior (default config)

| Interactions | Stability | Effective half-life | Disappears after silence |
|---|---|---|---|
| 1 | 1.0 | 30 days | ~90 days |
| 5 | 2.07 | 62 days | ~186 days |
| 10 | 5.16 | 155 days | ~465 days |
| 20 | 38.3 | 957 days | ~8 years |

A single interaction fades in three months. Twenty interactions create a relationship that effectively never disappears without a decade of silence.

---

## Implementation Notes

- All `getTrustGraph*` functions must query `trust_edges_live`, not `trust_edges`. Never mix the two.
- `raw_weight` is updated (grown) on each interaction. `stability` is also grown on each interaction. Neither is decayed — decay is purely time-based and view-computed.
- The view is not a table. Never `INSERT` or `UPDATE` it.
- Migration: `infrastructure/postgres/migrations/20260526-interaction-halflife.sql`
- Sweep jobs: `services/cleanup-service/src/jobs/trustEdgeSweepJob.ts`, `requestTtlSweepJob.ts`

---

## Related

- [ADR-054: Trust Graph Architecture](ADR-054-trust-graph-architecture.md)
- [ADR-055: Trust Governance Architecture](ADR-055-trust-governance-architecture.md)
- [ADR-011: Reputation Decay](ADR-011-reputation-decay.md)
