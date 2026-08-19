# Sprint 126: Honest Standing Backfill — Design Spec

**Date**: 2026-08-19
**Status**: Approved
**Version**: v11.45.0 → v11.46.0
**Sprint Branch**: `feature/sprint-126-standing-backfill`

---

## Overview

The demo contains a substantial history of completed mutual-aid exchanges, but that history is not
visible to personal standing. A read-only demo audit on 2026-08-19 found 7,817 completed
matches across 481 requesters, 509 helpers, and 50 request communities, while the current handoff
records zero `reputation.trust_scores` rows on demo
(`.claude/handoff/CURRENT_HANDOFF.md:99`). As a result, Sprint 125's provider reach gate behaves
correctly but a non-zero floor empties the provider layer.

The problem is projection, not a lack of underlying activity. The live reputation subscriber writes
canonical prose reasons such as `Provided help`, while the curated fixture projector writes
snake-case reasons such as `help_provided`
(`services/reputation-service/src/services/karmaService.ts:157`,
`packages/shared/src/projections/completedExchange.ts:201`). The trust calculator recognizes only
the production vocabulary (`services/reputation-service/src/services/karmaService.ts:258-260`).
The two paths also diverge on milestone schedule, milestone scope, and community selection. The
fixture uses 1/5/10/25 milestones, counts them platform-wide per helper, and allocates over the
entire static `config.communityConfigs` list with no cap
(`packages/shared/src/projections/completedExchange.ts:79-83,151,193-218`). Production uses
1/10/50/100 milestones scoped to `(helper, community)` and resolves at most three shared request
communities (`services/reputation-service/src/services/karmaService.ts:31,67-92,170-209`). The
curated core therefore looks populated in storage but is invisible or inconsistent to standing.
Canonicalization is expected to change curated-demo karma output on all four axes: reason labels,
milestone schedule, milestone scope, and community selection/cap.

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
| Curated projection differs in labels, milestone schedule/scope, and uncapped static community allocation. | `packages/shared/src/projections/completedExchange.ts:79-83,151,193-218` |
| Trust metrics use karma records as their source of truth. | `services/reputation-service/src/database/trustMetricsDb.ts:9-23` |
| The live subscriber invokes `awardKarmaForCompletedMatch` directly. | `services/reputation-service/src/events/subscriber.ts:45-60` |
| Activity and karma rows have match provenance but no durable projection uniqueness. | `infrastructure/postgres/init.sql:2006-2012,2118-2125` |
| Match completion timestamps are stored. | `infrastructure/postgres/init.sql:1678` |
| Fusion and fission copy karma with bare `INSERT ... SELECT` writers. | `services/community-service/src/services/fusionService.ts:97-103`; `services/community-service/src/services/fissionService.ts:311-317` |
| The production community cap is 3, and selection ranks on existing karma. | `services/reputation-service/src/services/karmaService.ts:31,67-92` |

### Demo snapshot — read-only audit, 2026-08-19

| Measurement | Result |
|---|---:|
| Active user-community membership pairs | 5,659 |
| Active pairs with production-recognized interaction karma | 0 |
| Active pairs with feedback | 0 |
| Completed matches | 7,817 |
| Distinct requesters / helpers | 481 / 509 |
| Distinct request communities | 50 |
| Completed matches with an active shared request community | 7,817 |
| Completed matches with no eligible community | 0 |
| Completed matches exceeding the three-community award cap | 0 |
| Eligible-community distribution | all 7,817 resolve to exactly 1 |
| Existing karma records | 174 across 22 curated matches |
| Existing duplicate karma projection identities | 0 |
| Existing duplicate activity projection identities | 0 |

The 174 curated records use only `help_provided`, `help_received`, and `first_help_bonus`; none use
the reason labels consumed by production trust math. The cap-3 audit establishes that the current
backfill population can attribute every stored completed match without invoking the live fallback.

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
fixture projector's milestone schedule, platform-wide helper counter, and uncapped static
community allocation will be removed as independent policy. Curated exchanges will provide their
facts to the same canonical reason, milestone, per-community counting, and capped resolution policy
used by live reputation projection. Existing curated fixture expectations must change; preserving
their old karma output is not a compatibility goal.

This export must be reflected in `packages/shared/package.json` exports/typesVersions only if a new
subpath is introduced; a root export is preferred to avoid needless subpath surface. The shared
context requires export changes to update `packages/shared/CONTEXT.md`
(`packages/shared/CONTEXT.md:1-5`).

### Transactional projector

The existing `awardKarmaForCompletedMatch` behavior will be refactored behind a transaction-aware
projector. For one match it will:

1. acquire a transaction-scoped lock for the match;
2. validate completed status, participants, request, request type, and completion timestamp;
3. resolve shared request communities using the production cap of 3 and a stable community-ID
   tie-breaker;
4. allocate karma with the production `allocateKarma` function;
5. insert canonical helper/requester rows with `ON CONFLICT DO NOTHING`;
6. derive the helper's per-community milestone rank from canonical `Provided help` history ordered
   by `(completed_at, match_id)` at or before this match—not from the current unbounded row count;
7. insert any earned canonical bonus row with the same conflict behavior;
8. insert canonical activity rows with the same conflict behavior;
9. recalculate affected trust scores through `updateTrustScore`; and
10. commit all effects for that match together.

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

Apply processes matches oldest-first in bounded batches and prints durable progress. Every match
defines one replay key, `asOf = (match.completed_at, match.id)`. Historical community priority uses
only canonical karma whose source-match ordering key is lexicographically strictly before `asOf`
(`completed_at` is earlier, or the timestamp is equal and the match ID is lower), followed by the
stable community-ID tie-breaker. Milestone rank uses the same `asOf` key but includes canonical
helper history through `asOf`, so the current match occupies its chronological position. Therefore
rerunning an early match after later rows exist cannot attach a later milestone to the early match,
and pre-existing curated rows are counted at their true chronological position. For a live
completion, `asOf` is the stored `(completion time, match ID)` key, which reduces to current live
behavior. Because each match commits atomically and each output has durable uniqueness, interruption
requires no special cleanup: rerunning the same command resolves the same per-match community set
and milestone rank, then skips existing projection identities.

After match projection, the CLI invokes `updateTrustScore` for every active membership pair. Pairs
without canonical history receive score 0, ensuring stored-row and missing-row semantics agree.
This is the deliberate temporal exception: cached standing reflects all present canonical history;
projector decisions about where and what to write reflect only history as of the source match.

---

## Data Model

One migration will perform the foundation repair in this order:

```sql
-- Conceptual DDL; implementation must be collision-safe and idempotent.
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

Every existing writer must remain valid after these indexes land. The community service's fusion
and fission `INSERT ... SELECT` karma copies will add `ON CONFLICT DO NOTHING`; otherwise merging
two communities that both awarded the same match would collapse them onto the same new community
identity and abort with `23505`. Their regression coverage is part of the schema change, not an
optional community-service cleanup.

The incompatible fixture milestone values are:

| Fixture label | Count | Points | Canonical production milestone at same count |
|---|---:|---:|---|
| `first_help_bonus` | 1 | 15 | `First help in community` — 15 |
| `milestone_help_5` | 5 | 25 | none |
| `milestone_help_10` | 10 | 50 | `10 exchanges milestone` — 25 |
| `milestone_help_25` | 25 | 100 | none |
| — | 50 | — | `50 exchanges milestone` — 50 |
| — | 100 | — | `100 exchanges milestone` — 100 |

The matching 50-point values belong to different counts (`milestone_help_10` versus production's
50-exchange milestone) and are not aliases.

The migration does **not** rename the 174 curated rows in place. Operator preflight first proves
that each legacy row's `related_entity_id` identifies a completed match with a non-null completion
timestamp. For every attributable match, apply removes its fixture-derived karma rows and rebuilds
them inside that match's canonical projection transaction. This produces the right vocabulary,
cap-3 community set, per-community milestones, and chronological bonuses from source facts instead
of preserving fixture artifacts.

If preflight finds a legacy row that cannot be attributed to a completed match, it must not delete
it. The report identifies it explicitly; apply retains its points and timestamps through a
collision-safe legacy-to-canonical normalization, resolving only exact projection duplicates. The
fixture-only milestone labels (`milestone_help_5`, `milestone_help_10`, and `milestone_help_25`)
are never aliases for production milestones. The repair must never equate different point amounts
or unrelated reasons silently.

The schema and data repair are dry-run against a disposable PostgreSQL 15 database and audited
read-only against demo before deployment.

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
  selection ranks only canonical history lexicographically strictly before the match's `asOf` key,
  then adds a stable ID tie-breaker; milestone rank counts canonical helper history through `asOf`.
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
- curated fixture output changes are pinned for canonical labels, cap-3 per-match community
  resolution, and `(helper, community)` milestone counting;
- varied, chronological exchange histories project exact records and timestamps.

### Migration integration

- new trust rows default to 0 and reject null scores;
- karma/activity uniqueness rejects duplicate projection identities;
- migration is idempotent and generated `init.sql` converges;
- fusion of two communities carrying the same match succeeds and retains one row per canonical
  projection identity in the merged community;
- fission karma carry uses the same conflict-safe writer and remains retry-safe.

### Reputation projector

- exact production allocation for one, three, and more-than-three candidate communities, including
  cap selection (synthetic coverage is mandatory because all audited demo matches resolve to one);
- first-help and 10/50/100 milestones in chronological order;
- rerunning match 1 after a helper already has exactly 10/50/100 completed helps adds no milestone
  to the earlier match;
- pre-existing later rows do not affect an earlier match's milestone rank;
- two matches with the same `completed_at` use match-ID ordering consistently for both community
  priority (strictly before `asOf`) and milestone rank (through `asOf`);
- original completion timestamps on karma and activity;
- same match twice changes nothing;
- concurrent duplicate delivery changes nothing;
- forced mid-projector failure rolls back everything;
- no-history trust is exactly 0;
- varied histories produce varied ADR-037 scores.

### CLI integration

- dry-run writes zero rows;
- apply projects a fixture database and recalculates every active membership;
- attributable legacy curated rows are removed and canonically reprojected; unattributable rows are
  reported and normalized without losing points/timestamps;
- a run killed mid-batch resumes with the identical community set and milestone rank for every
  match, with no duplicates;
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
| `apps/landing/src/data/docs/concepts/adr-095-authenticated-provider-directory-and-reach-gated-standing.json` | Explain why inactive users stay at 0 and how a community floor changes reach. |
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
6. Apply the preflight-reported stored completed matches in bounded batches (7,817 at the
   2026-08-19 cap-3 audit; the live count may grow).
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
2. **Foundation before backfill.** Change `trust_scores.score` to `DEFAULT 0 NOT NULL`; reproject
   attributable legacy rows from completed-match facts rather than renaming them in place.
3. **Historical time is data.** Use `matches.completed_at`; stamping replayed rows with `NOW()` makes
   decay and recent-activity output falsely rich.
4. **Idempotency lives in PostgreSQL.** Per-match transactions and unique projection identities are
   required; a CLI checkpoint file or `SELECT`-then-insert check is insufficient.
5. **Oldest first.** First-help and milestone outcomes depend on chronological history. Sort by
   completion timestamp and match ID. Define one `asOf = (completed_at, match_id)` key. Historical
   community priority may read only canonical history lexicographically strictly before `asOf`;
   milestone rank may count canonical helper history through `asOf`. Current/future replay writes
   must change neither result.
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
13. **Audit every writer before adding uniqueness.** Fusion and fission karma copies must use
    `ON CONFLICT DO NOTHING`, with shared-match regression coverage, before the indexes land.
14. **Every projector predicate is as-of.** Community selection, milestone eligibility, and any
    future write decision must be a function only of stored history as of the match plus the match
    itself—never current table state. `updateTrustScore` is the deliberate exception because its
    cache is supposed to reflect the present.
