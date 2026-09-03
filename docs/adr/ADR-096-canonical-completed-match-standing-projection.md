# ADR-096: Canonical Completed-Match Standing Projection

**Status**: Accepted
**Date**: 2026-08-20
**Supersedes**: —
**Related**: ADR-031 (Shared Community Karma), ADR-032 (Karma Allocation), ADR-035 (Karma Allocation & Trust Score Strategy), ADR-037 (Multi-Signal Trust Score), ADR-095 (Reach-Gated Standing), ADR-029 (TDD Test Framework)

---

## Context

Personal standing is a **projection** of completed exchanges. Three separate code paths claimed to
perform that projection, and all three disagreed.

### The live writer had been crashing since Sprint 62

`karmaService.getCommunityKarmaConfig()` selected `config->'enabled_request_types'` from
`communities.community_configs`. That table has **no `config` column** — `enabled_request_types` is
a top-level `jsonb` column, and no migration ever created a `config` column. PostgreSQL therefore
raised `42703` at parse time and `awardKarmaForCompletedMatch()` threw on **every call**.

Confirmed on the demo server on 2026-08-20, in live logs rather than by inspection:

```
❌ Failed to award karma for match: <uuid> error: column "config" does not exist
   code: '42703'
   at async awardKarmaForCompletedMatch (karmaService.js:112:30)
```

The database agreed exactly:

| Measure | Value |
|---|---|
| Completed matches | 7,860 |
| `karma_records` written by the live path | **0** |
| `karma_records` written by the curated fixture | 174 |
| `reputation.trust_scores` rows | **0** |
| `reputation.activity_log` rows | **0** |

Every completed match since the Sprint 117 reset produced no standing at all. This is why ADR-095's
reach gate — correct in itself — emptied the provider layer at any floor above 0.

### The fixture projector had drifted on four axes

Where the live path crashed, the curated fixture wrote rows the trust calculator cannot see:

| Axis | Production | Curated fixture |
|---|---|---|
| Reason labels | `Provided help` / `Received help` | `help_provided` / `help_received` |
| Milestone schedule | 1 / 10 / 50 / 100 | 1 / 5 / 10 / 25 |
| Milestone scope | per `(helper, community)` | platform-wide per helper |
| Community selection | ≤3 shared request communities, by prior karma | every configured community, uncapped |

`updateTrustScore` counts `reason = 'Provided help'` / `'Received help'` **in SQL**. Snake-case rows
are stored and then invisible: the curated demo looked populated while scoring nothing.

### Why duplication caused this

Each copy was "held identical by convention" — a comment asserting two functions agree, with no test
that could fail when they stopped agreeing. A projection replayed from history is only trustworthy
if replaying it cannot change the answer, and that guarantee cannot rest on convention.

## Decision

### 1. One pure policy owns the rules

`@karmyq/shared` `src/projections/completedMatchStanding.ts` is the single definition of what a
completed match does to standing: `COMPLETED_MATCH_REASONS`, `COMPLETED_MATCH_MILESTONES`,
`MAX_COMMUNITIES_PER_KARMA_AWARD`, `DEFAULT_KARMA_POOL`, `selectStandingCommunities()`,
`allocateCompletedMatchKarma()` and `planCompletedMatchStanding()`.

It is **pure** — no clock, no database. The same facts always produce the same plan, which is what
makes replay safe. Live delivery, the curated fixture projector, and historical operator replay all
consume it; the previous `reputation-service/karmaAllocation.ts` was deleted rather than left as a
parallel surface.

The reason strings are a **data contract, not labels**, because SQL predicates compare against them.

### 2. Projection identity lives in PostgreSQL

```sql
CREATE UNIQUE INDEX uq_karma_match_projection
  ON reputation.karma_records (user_id, community_id, reason, related_entity_id)
  WHERE related_entity_id IS NOT NULL;

CREATE UNIQUE INDEX uq_activity_match_projection
  ON reputation.activity_log (user_id, community_id, activity_type, related_entity_id)
  WHERE related_entity_id IS NOT NULL;
```

Idempotency is a database guarantee, not an application one. A CLI checkpoint file or a
`SELECT`-then-`INSERT` check cannot survive a crash between the check and the write.

Both indexes are **partial**: only rows attributable to a source entity have a projection identity.
Manual adjustments carry a NULL `related_entity_id` and stay unconstrained, because several may
legitimately be identical. The identity includes `reason` / `activity_type` because one match
legitimately writes several rows for the same user in the same community.

### 3. One replay key, two as-of boundaries

`asOf = (completed_at, match_id)` totally orders replay. The id tie-break is not cosmetic: first-help
and milestone outcomes depend on chronological rank, so matches sharing a timestamp must replay in a
fixed order. Ordering uses code-unit comparison, never `localeCompare`, whose collation is
locale- and ICU-dependent.

- **Community priority** reads canonical history **strictly before** `asOf`.
- **Milestone rank** is the count of prior helps **strictly before** `asOf`, plus one.

Deriving both from strictly-before history is what makes the result **replay-stable**: the match's
own rows are never counted, so the answer does not change once they exist. Counting inclusively
would award a different milestone on a second run.

The boundary is derived twice — in SQL for live delivery and historical replay, in TypeScript for
the curated fixture and the dry-run report — and **no type or shared predicate can bind those two
together**. An earlier draft of this ADR claimed a pair of exported predicates served as that
oracle; nothing called them, so they were deleted rather than left advertising a guarantee that did
not exist. The binding is instead a runtime check: `applyStandingBackfill` re-derives every
projected identity, point value and timestamp in TypeScript, compares them against what SQL actually
wrote, and **fails the run** on any mismatch. That check is the reason a dry run's prediction can be
trusted.

Every projector predicate is as-of — a function of stored history plus the match itself, never of
current table state. `updateTrustScore` is the deliberate exception: that cache is supposed to
reflect the present, and it runs *after* every as-of decision.

### 3b. Anomaly severity: corrupt source data blocks; only routine membership loss does not

`canApply` originally demanded zero anomalies of any kind, which made routine data permanently
fatal. The line is now drawn at **corrupt source facts versus routine history**.

**Blocking** — a completed match missing its participants, its completion time, or any request
community; duplicate projection identities; a stored canonical row whose points or timestamp
conflict with replay; and any stored canonical row replay does not produce at all. Silently
omitting such a match while reporting success is fail-open.

**Informational** — `NO_ELIGIBLE_COMMUNITY` only: the participants are no longer co-members of any
request community. Membership loss is routine, and guessing a community would fabricate history.

⚠️ **No lineage carve-out for carried rows.** Fusion and fission genuinely copy canonical rows into
a merged or child community, and replay will never produce them. A draft of this ADR excused such
rows when `community_links` / `split_proposals` showed a lineage edge — but adjacency is not
legitimacy. That check never validated the row's points, timestamp or carry semantics, was
undirected (accepting invalid reverse carries), was single-hop (rejecting real multi-generation
history), and ignored link status (a pending admin-created link sufficed). Since a carried row
cannot be derived from the match's own facts, it cannot be verified here at all; the run blocks and
an operator reconciles it deliberately.

### 4. One transaction per match, and historical time is data

Each match projects inside one transaction, serialised by
`pg_advisory_xact_lock(hashtextextended(matchId, 0))`. A partial projection is worse than none: the
projection identities would make the retry a no-op on the rows that already landed, so the match
could never finish being awarded.

Rows carry the **stored** `matches.completed_at`. A caller-supplied timestamp is a hint and never
overrides it; `NOW()` would make decay and recent-activity output falsely rich.

The event payload is a message, not a record. Participants, status and completion time are re-read
from the database under the lock, and a payload that disagrees is rejected rather than projected
onto someone else's karma.

### 5. Standing only, and the operator boundary

Historical replay projects **standing side effects only**. Badges, provider metrics, notifications
and trust evolution stay subscriber-owned and live-only — nobody should be badged for, or notified
about, help they gave eight months ago because an operator ran a projection. The projector module
exports exactly two entry points so nothing else is reachable from the backfill.

`backfill:standing` is **dry-run by default and provably read-only**. `--apply` is a separately
authorized demo data operation, after deployment and a fresh backup. Deployment approval is not
data-operation approval.

Historical mode **fails closed** when no community is eligible; only live delivery may fall back to a
single request community, ordered deterministically so a retry cannot award the same match in a
different community.

### 6. Zero is the cold start

`reputation.trust_scores.score` becomes `DEFAULT 0 NOT NULL`, so a stored cold-start row and a
missing row finally agree. This resolves the inconsistency ADR-095 recorded as deferred.

## Consequences

### Positive Consequences

- **Live karma awarding works again.** The `42703` crash is gone with the function that caused it.
  After deploy, a completed match writes standing for the first time since Sprint 62.
- **Demo standing becomes rich because its history is rich**, not because scores were invented. No
  fabricated feedback, no tuned distribution.
- **Retries are safe** at every layer: Bull redelivery, an interrupted backfill batch, a re-run CLI.
- **Equivalence is now testable.** The claim that fixture and live agree is a test that can fail,
  not a comment.

### Negative Consequences

- **Curated demo karma output changes on all four axes.** Reason labels, milestone schedule,
  milestone scope, and community selection all differ from what previous resets produced. This is
  intended, and is why the fixture's expectations were re-pinned.
- **`CREATE UNIQUE INDEX` cannot tolerate pre-existing duplicates.** It aborts the migration and
  rolls the deploy back, so duplicate projection identities must be measured immediately before
  deploying — `IF NOT EXISTS` guards against the index existing, not against duplicate data.
- **A brief deploy window** runs the new indexes against old service images. Every pre-existing
  karma writer was made conflict-safe first for exactly this reason.

### Neutral Consequences

- Cap-3 selection has **no validation from real demo data** — all 7,860 stored matches resolve to
  exactly one eligible community, so multi-community selection and its tie-break are exercised only
  by synthetic tests.
- `communities.community_configs.base_karma_pool_per_request` is read and then ignored; the pool is
  the flat `DEFAULT_KARMA_POOL`. Pre-existing, documented on the constant, not changed here.

## Alternatives Considered

### Alternative 1: Keep three implementations, add an equivalence test

Rejected. A test comparing three implementations pins them at the points it samples and nothing
else — and cannot compare a SQL derivation against a TypeScript one at all. The `42703` crash lived
undetected for three months precisely because no test exercised the real query.

### Alternative 2: Deduplicate in the application before inserting

Rejected. `SELECT`-then-`INSERT` is not atomic; a crash in between leaves exactly the partial state
the backfill must survive. Uniqueness belongs where the write happens.

### Alternative 3: Backfill by writing plausible scores directly

Rejected outright — it is the thing this sprint exists to avoid. Standing must be derivable from
stored facts through the same rules new activity uses, or it is decoration.

## Implementation Notes

- Migration: `infrastructure/postgres/migrations/20260819-standing-projection-foundation.sql`.
  A `NULL`-fill precedes `SET NOT NULL`, which would otherwise abort.
- Idempotency is proved against **real PostgreSQL 15**, not mocks: a mocked test asserting
  `ON CONFLICT DO NOTHING` proves only that the string was emitted, never that the database rejects
  the duplicate.
- Fusion's karma carry **sums** colliding identities rather than discarding one. Production splits a
  match's pool across up to three shared communities, so a user can hold the same
  `(reason, match)` identity in both origin communities; a bare `ON CONFLICT DO NOTHING` there would
  have silently and nondeterministically lost points.

## References

- ADR-031 — shared-community karma model
- ADR-032 / ADR-035 — karma allocation and the tuning surface
- ADR-037 — multi-signal trust score
- ADR-095 — reach-gated standing, and the `DEFAULT 50` inconsistency resolved here
- Design spec: `docs/superpowers/specs/2026-08-19-sprint-126-standing-backfill-design.md`
