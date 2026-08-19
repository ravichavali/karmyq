# Sprint 126: Honest Standing Backfill — Design Spec

**Date**: 2026-08-19
**Status**: Approved
**Version**: v11.45.0 → v11.46.0
**Sprint Branch**: `feature/sprint-126-standing-backfill`

---

## Overview

The demo contains a substantial history of completed mutual-aid exchanges, but that history is not
visible to personal standing. A read-only production audit on 2026-08-19 found 7,814 completed
matches across 481 requesters, 509 helpers, and 50 request communities, while the current handoff
records zero `reputation.trust_scores` rows on demo
(`.claude/handoff/CURRENT_HANDOFF.md:77`). As a result, Sprint 125's provider reach gate behaves
correctly but a non-zero floor empties the provider layer.

The problem is projection, not a lack of underlying activity. The live reputation subscriber writes
canonical prose reasons such as `Provided help`, while the curated fixture projector writes
snake-case reasons such as `help_provided`
(`services/reputation-service/src/services/karmaService.ts:157`,
`packages/shared/src/projections/completedExchange.ts:201`). The trust calculator recognizes only
the production vocabulary (`services/reputation-service/src/services/karmaService.ts:258-260`).
The two paths also use different milestone schedules: the fixture uses 1/5/10/25
(`packages/shared/src/projections/completedExchange.ts:79-83`) while production uses 1/10/50/100
(`services/reputation-service/src/services/karmaService.ts:177-205`). The curated core therefore
looks populated in storage but is invisible or inconsistent to standing.

Sprint 126 creates one canonical, transactional, idempotent completed-match standing projector.
Both live events and a dry-run-first operator CLI will use it. The CLI will replay stored completed
matches oldest-first using their real completion timestamps, then recalculate every active
user-community membership through the ADR-037 production calculator. It will not invent matches,
ratings, feedback, or attractive score values.

### Core Principle: Project facts; never paint scores

Rich demo standing must emerge from stored exchange history through the same production rules used
for new activity, and a retry must never change the result.

---

## Multi-Sprint Arc

### Sprint 125 — Provider standing and community reach (complete, v11.45.0)

Shipped the authenticated provider directory and community reach gate. Unknown standing fails
closed through `COALESCE(ts.score, 0)`
(`services/request-service/src/services/providerReachService.ts:95-128`).

### Sprint 126 — Honest standing foundation and historical projection (this sprint)

Reconcile zero-standing semantics, make completed-match standing projection canonical and
idempotent, and project the demo's stored exchange history through production math.

### Sprint 127 — Live simulation across all users (upcoming)

Improve ongoing simulated behavior, including future feedback submitted through ordinary APIs.
Sprint 126 deliberately does not fabricate retroactive ratings.

---

## Verified Starting State

### Repository

| Finding | Evidence |
|---|---|
| A stored trust row defaults to 50. | `infrastructure/postgres/init.sql:2188-2195` |
| A missing provider-standing row is treated as 0. | `services/request-service/src/services/providerReachService.ts:95-128` |
| ADR-095 explicitly deferred that inconsistency. | `docs/adr/ADR-095-authenticated-provider-directory-and-reach-gated-standing.md:74-84` |
| Live projection writes prose reason labels. | `services/reputation-service/src/services/karmaService.ts:152-205` |
| Curated projection writes incompatible snake-case labels and milestones. | `packages/shared/src/projections/completedExchange.ts:79-83,201-216` |
| Trust metrics use karma records as their source of truth. | `services/reputation-service/src/database/trustMetricsDb.ts:9-23` |
| The live subscriber invokes `awardKarmaForCompletedMatch` directly. | `services/reputation-service/src/events/subscriber.ts:45-60` |
| Karma and activity rows have match provenance but no durable projection uniqueness. | `infrastructure/postgres/init.sql:2006-2012,2118-2125` |
| Match completion timestamps are stored. | `infrastructure/postgres/init.sql:1678` |

### Demo snapshot — read-only audit, 2026-08-19

| Measurement | Result |
|---|---:|
| Active user-community membership pairs | 5,659 |
| Active pairs with production-recognized interaction karma | 0 |
| Active pairs with feedback | 0 |
| Completed matches | 7,814 |
| Distinct requesters / helpers | 481 / 509 |
| Distinct request communities | 50 |
| Completed matches with an active shared request community | 7,814 |
| Completed matches with no eligible community | 0 |
| Completed matches exceeding the five-community award cap | 0 |
| Existing karma records | 174 across 22 curated matches |
| Existing duplicate karma projection identities | 0 |
| Existing duplicate activity projection identities | 0 |

The 174 curated records use only `help_provided`, `help_received`, and `first_help_bonus`; none use
the reason labels consumed by production trust math. The audit establishes that the backfill can
attribute every stored completed match without invoking the live fallback.

---

## New Concepts

### Canonical standing projection

The single reputation-service operation that turns one completed match into its durable
match-derived karma, activity, and recalculated personal standing. It is used by both the live Bull
subscriber and the historical operator CLI.

### Projection identity

A match-derived row is uniquely identified by `(user_id, community_id, reason,
related_entity_id)`. `related_entity_id` is the completed match ID. Activity rows use the analogous
`(user_id, community_id, activity_type, related_entity_id)` identity.

### Source coverage

The proportion of active user-community membership pairs whose score is supported by at least one
canonical completed-exchange record. Zero coverage is valid for a genuinely inactive member; it is
not silently padded.

---

## Architecture

### Shared contract

`@karmyq/shared` will export canonical completed-exchange reason constants. The fixture projector
and reputation service will import those constants rather than carrying string literals. The
fixture projector's milestone schedule will be removed as an independent policy and delegated to
the same canonical policy used by live reputation projection.

This export must be reflected in `packages/shared/package.json` exports/typesVersions only if a new
subpath is introduced; a root export is preferred to avoid needless subpath surface. The shared
context requires export changes to update `packages/shared/CONTEXT.md`
(`packages/shared/CONTEXT.md:1-5`).

### Transactional projector

The existing `awardKarmaForCompletedMatch` behavior will be refactored behind a transaction-aware
projector. For one match it will:

1. acquire a transaction-scoped lock for the match;
2. validate completed status, participants, request, request type, and completion timestamp;
3. resolve shared request communities using the existing cap and a stable community-ID tie-breaker;
4. allocate karma with the production `allocateKarma` function;
5. insert canonical helper/requester and earned bonus rows with `ON CONFLICT DO NOTHING`;
6. insert canonical activity rows with the same conflict behavior;
7. recalculate affected trust scores through `updateTrustScore`; and
8. commit all effects for that match together.

Historical calls pass `matches.completed_at` as the occurrence time. Live calls default to the
event's completion time or the database completion timestamp. No replayed history is stamped as
new activity.

Provider completion, badges, and trust-evolution side effects remain in the subscriber after the
standing transaction. The backfill does not replay those unrelated side effects.

### Operator CLI

The reputation-service owns a `backfill:standing` command. It is read-only by default and mutates
only with `--apply`.

Dry-run output includes:

- total completed matches, eligible matches, already-projected matches, and anomalies;
- active membership-pair coverage;
- canonicalization and deduplication counts;
- predicted writes and score buckets;
- interaction depth/breadth buckets;
- PDX provider eligibility at floors 1, 20, 40, and 60; and
- the exact command required to apply.

Apply processes matches oldest-first in bounded batches and prints durable progress. Because each
match commits atomically and each output has durable uniqueness, interruption requires no special
cleanup: rerunning the same command resumes by skipping existing projection identities.

After match projection, the CLI invokes `updateTrustScore` for every active membership pair. Pairs
without canonical history receive score 0, ensuring stored-row and missing-row semantics agree.

---

## Data Model

One migration will perform the foundation repair in this order:

```sql
-- Conceptual DDL; implementation must be collision-safe and idempotent.
UPDATE reputation.karma_records
SET reason = CASE reason
  WHEN 'help_provided' THEN 'Provided help'
  WHEN 'help_received' THEN 'Received help'
  WHEN 'first_help_bonus' THEN 'First help in community'
  ELSE reason
END
WHERE reason IN ('help_provided', 'help_received', 'first_help_bonus');

ALTER TABLE reputation.trust_scores
  ALTER COLUMN score SET DEFAULT 0,
  ALTER COLUMN score SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_karma_match_projection
  ON reputation.karma_records (user_id, community_id, reason, related_entity_id)
  WHERE related_entity_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_match_projection
  ON reputation.activity_log (user_id, community_id, activity_type, related_entity_id)
  WHERE related_entity_id IS NOT NULL;
```

Before normalizing reasons, the migration must rank any old/new vocabulary collisions across all
rows, retain one canonical row deterministically, and report/delete only exact projection
duplicates. Fixture-only milestone labels (`milestone_help_5`, `milestone_help_10`, and
`milestone_help_25`) are not aliases for production milestones and must not be renamed as if they
were. Preflight identifies them by completed-match provenance; apply removes/replaces only those
derived rows through the canonical projector. It must never equate different point amounts or
unrelated reasons silently. The data repair is dry-run against a disposable PostgreSQL 15 database
and audited read-only against demo before deployment.

`infrastructure/postgres/init.sql` is regenerated from the migration chain, never hand-edited
(`infrastructure/claude.md:14-24`).

---

## API Endpoints

No endpoint is added or modified. This is an internal event-projection and operator workflow.

The `match_completed` event retains its public payload and consumers. Its reputation-service
semantics change from retry-vulnerable inserts to an atomic idempotent standing projection; that
behavioral change is documented in `services/registry.json`.

---

## Frontend Changes

No frontend code changes are planned. The existing authenticated community provider surface is the
human-facing realism check. Sprint 125 already applies the non-zero standing floor at the server
boundary (`services/request-service/src/services/providerReachService.ts:95-128`).

---

## Failure Handling and Recovery

- **Dry-run writes nothing.** Integration coverage must compare table fingerprints before/after.
- **One match, one transaction.** A forced failure after any intermediate write rolls back the
  complete match.
- **Retry-safe outputs.** Database uniqueness, not an in-memory set or report file, is the arbiter.
- **Deterministic order.** Historical matches sort by `completed_at`, then match ID; community
  selection adds a stable ID tie-breaker after existing-karma order.
- **Anomalous history fails closed.** Missing participants, request communities, completion times,
  or conflicting existing rows abort preflight. The historical CLI does not use the live fallback
  that selects an arbitrary request community.
- **Bounded execution.** Batch size is configurable with a conservative default. Failure output
  identifies the last completed batch and exact match.
- **No false success.** Apply is complete only when a subsequent dry-run and apply both report zero
  new projection writes and all active memberships have been evaluated.
- **Backup and authority.** Demo apply requires a fresh backup and separate maintainer authorization;
  deployment alone never starts the backfill.

---

## Testing Strategy

New tests begin in the changed workspace's `tests/tdd/` tier and promote only when green.

### Shared projection

- canonical reason constants are used by fixture and reputation paths;
- fixture/live allocation and milestone schedules are identical;
- varied, chronological exchange histories project exact records and timestamps.

### Migration integration

- new trust rows default to 0 and reject null scores;
- legacy reasons normalize to canonical values;
- mixed old/new rows deduplicate without losing conflicting data;
- karma/activity uniqueness rejects duplicate projection identities;
- migration is idempotent and generated `init.sql` converges.

### Reputation projector

- exact production allocation for one and multiple communities;
- first-help and 10/50/100 milestones in chronological order;
- original completion timestamps on karma and activity;
- same match twice changes nothing;
- concurrent duplicate delivery changes nothing;
- forced mid-projector failure rolls back everything;
- no-history trust is exactly 0;
- varied histories produce varied ADR-037 scores.

### CLI integration

- dry-run writes zero rows;
- apply projects a fixture database and recalculates every active membership;
- interruption resumes without duplicates;
- second dry-run/apply reports zero writes;
- malformed or ambiguous history blocks before mutation;
- reports expose source coverage, score distribution, and provider-floor eligibility.

---

## User Guide & Doc Updates

| Document | Change |
|---|---|
| New ADR-096 | Canonical, idempotent completed-match standing projection and operator backfill boundary. |
| ADR-037 | Clarify canonical interaction provenance, zero cold start, and historical timestamps. |
| ADR-095 | Mark the `DEFAULT 50` inconsistency resolved by Sprint 126. |
| `docs/guides/demo-data.md` | Correct the current claim that both parties rate every completed match; explain that standing is derived from stored exchange history and absent ratings remain neutral. |
| Provider-standing concept page | Explain why inactive users stay at 0 and how a community floor changes reach. |
| `services/reputation-service/CONTEXT.md` | Projector, reason contract, schema indexes, CLI, and runbook. |
| `services/simulation-service/CONTEXT.md` | Curated projector now delegates canonical standing semantics. |
| `packages/shared/CONTEXT.md` | Canonical reason/projection exports. |
| `services/registry.json` | Idempotent `match_completed` reputation projection semantics. |
| Landing docs | Regenerate ADR/concept/guide output and verify `nav.json` wiring. |

No onboarding workflow changes are required because there is no new user action.

---

## Rollout and Human Validation

1. Deploy schema and code without running the backfill.
2. Verify service health and ordinary live match completion.
3. Take a fresh demo database backup.
4. Run and retain the CLI dry-run report.
5. Obtain separate maintainer authorization for `--apply`.
6. Apply all 7,814 stored completed matches in bounded batches.
7. Re-run dry-run and apply; both must report zero new writes.
8. Verify all 5,659 active membership pairs were evaluated and inspect score/source buckets.
9. Exercise the PDX community provider API and UI at a non-zero floor, initially 20 unless the
   observed distribution makes that threshold semantically unsuitable.
10. Confirm a credible eligible/ineligible mix and manually trace representative low-, medium-,
    and high-history profiles back to stored completed matches.
11. Do not change the PDX floor permanently without separate maintainer authorization.

---

## Critical Implementation Notes

1. **One projector, not equivalent-looking copies.** Live events, curated reset data, and historical
   backfill must share canonical reason and milestone policy. An equivalence claim needs a test that
   can fail.
2. **Foundation before backfill.** Change `trust_scores.score` to `DEFAULT 0 NOT NULL` and normalize
   legacy reasons before projecting history.
3. **Historical time is data.** Use `matches.completed_at`; stamping replayed rows with `NOW()` makes
   decay and recent-activity output falsely rich.
4. **Idempotency lives in PostgreSQL.** Per-match transactions and unique projection identities are
   required; a CLI checkpoint file or `SELECT`-then-insert check is insufficient.
5. **Oldest first.** First-help and milestone outcomes depend on chronological history. Sort by
   completion timestamp and match ID.
6. **No fabricated feedback.** Demo currently has no feedback rows. Keep quality neutral; Sprint 127
   may create future ratings only through ordinary authenticated workflows.
7. **Backfill only standing side effects.** Do not replay badges, provider metrics, notifications,
   trust evolution, or other subscriber work merely because a match is historical.
8. **Dry-run is the default and must be provably read-only.** `--apply` is a separately authorized
   demo data operation after deployment and backup.
9. **Every active membership is evaluated.** A zero is a meaningful result for no history, not a
   missing batch.
10. **Do not tune scores to look attractive.** Report the distribution produced by stored facts.
    Human validation checks credibility against histories, not a target bell curve.
11. **Generated files stay generated.** Regenerate `init.sql` and landing docs from their sources;
    revert unrelated timestamp/HEAD churn.
12. **Demo facts are a dated snapshot.** Re-run preflight immediately before apply because the live
    simulator can add matches after this spec's 2026-08-19 audit.
