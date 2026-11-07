# Sprint 138: Reusable Standing Offers — Design Spec

**Date**: 2026-11-06
**Status**: Approved (maintainer, 2026-11-06)
**Version**: v11.110.0 → v11.111.0 (**provisional**: re-derive from `origin/master`'s `package.json` at merge)
**Sprint Branch**: `agent/claude/sprint-138-planning` (execution continues on it; the one PR opens from it)

---

## Overview

A standing help offer says "I can help with this" before anyone asks. Today it can be used exactly once. When an
exchange it backed completes, the offer stays `matched` forever, because every offer release
(`releaseOffer` and `closeProposals` in request-service, D1 and D2 in cleanup-service) counts a `completed` match as a
hold. Sprint 137's B1 (`PUT /offers/:id` refuses a body `status`, the BUG-089 fix) removed the status edit that used to
reactivate it, so today's only recovery is to withdraw the offer and post a new one (BUG-093).

This sprint makes standing offers reusable. Completing an exchange frees its offer, and offers already stuck behind
past completions are freed by the next hourly sweep. Three related gaps close with it:
- an offer freed after its expiry date is flagged `expired` in the same statement, not up to an hour later (BUG-094);
- `GET /offers` stops listing expired offers (new BUG-096), so freed history past its expiry stays out of the list;
- the release guards' `matches.offer_id` lookup gets an index (BUG-095).

### Core Principle: An offer is held only while an exchange is live

An offer is `matched` while a proposed or matched exchange uses it, and available otherwise. One rule, stated once,
copied text for text into the four release statements and gated so the copies cannot drift.

---

## Multi-Sprint Arc

### Sprint 136 — Mobile Dependencies and Status Follow-ups (complete, v11.109.0)
### Sprint 137 — Exchange Integrity (complete, v11.110.0)
Expired asks release their holds; offer status follows its exchanges; provider offers are written under the request
lock; closed asks can't be edited. Its `/code-review` logged BUG-093, 094 and 095.
### Sprint 138 — this sprint
Reusable standing offers (BUG-093), plus BUG-094, BUG-095 and the new BUG-096.
### Next (not scheduled)
The mobile sprint (`docs/IDEAS.md` 2026-10-29); #329 Expo patch drift stays open (no advisory or feature need).

---

## Decisions

### Maintainer (2026-11-06)
1. **Scope:** BUG-093 + BUG-094 + BUG-095, in request-service and cleanup-service, in one PR.
2. **BUG-093: standing offers are reusable after a completed exchange** (not one-shot).
3. **History is freed retroactively.** Offers stuck in `matched` behind past completions are freed by the first sweep
   after deploy. No dated exception.
4. **Every offer is reusable.** No per-offer "one-time vs standing" choice; no schema or UI change for it. An offerer
   who wants an offer gone withdraws it, as today.
5. **BUG-094 is fixed in every release statement** (the root cause), not by reordering the sweep.
6. **BUG-096 joins the sprint:** `GET /offers` hides expired offers. (Found while planning: the listing filters on
   status only, so an offer the hourly job flags expired is still listed as active today, and retroactively freed
   history past its 60-day TTL would reappear on the `/offers` page.)
7. **#329 stays open:** no advisory or feature need; no dependency work this sprint.

### Planner (2026-11-06; each open to the maintainer's veto; the maintainer approved the goal built on 1–5)
1. Completion frees its offer by calling the existing `releaseOffer` after the match becomes `completed` and the request
   is reconciled. Lock order match → request → offer, the same as match cancel. No new status writer.
2. The hold set becomes `('proposed', 'matched')` in all four release statements and in the parity gate. That alone
   makes D2 free history on its first run (decision 3).
3. Every release statement sets `expired` when `expires_at` has passed, using `clock_timestamp()` (these run after lock
   waits), in the same expression form as `requestStatus.ts:75`.
4. BUG-095 is one partial index, `CREATE INDEX IF NOT EXISTS` (not `CONCURRENTLY`: `scripts/apply-migrations.sh:86-90`
   wraps every migration file in `BEGIN … COMMIT`, and PostgreSQL refuses `CREATE INDEX CONCURRENTLY` in a transaction).
5. No ADR: two services change, and the rule is a refinement of Sprint 137's B5 release rule.
6. The user guides say an offer becomes available again after an exchange completes, and that an expired offer leaves
   the offers list.

---

## A. BUG-093: completing an exchange frees its offer

**Today** (`services/request-service/src/routes/matches.ts:533-660`): `PUT /matches/:id/complete` records the caller's
done mark under `status = 'matched'`. When both marks exist it sets the match `completed`, calls
`reconcileRequestStatus` (which takes the request lock, `requestStatus.ts:92-104`), commits, then publishes
`match_completed`. It never touches the offer. The match read (`:542-551`) already selects `m.offer_id`.

**New.** Inside the same transaction, after `reconcileRequestStatus`, and only when the exchange just finished and
`match.offer_id` is not null:

```ts
// BUG-093 (Sprint 138): a standing offer is reusable. The match is completed and no longer holds its offer, so free
// it unless another proposed or matched exchange still does. Match → request → offer, the same order as cancel.
if (match.offer_id) await releaseOffer(q, match.offer_id);
```

- A first done mark (the exchange not yet finished) frees nothing.
- A withdrawn offer stays withdrawn (`releaseOffer` frees only `matched`).
- A legacy shared offer (BUG-089 let one offer back several matches) stays `matched` while another proposed or matched
  exchange uses it.
- An offer whose `expires_at` has passed is freed with `expired = TRUE` (B), so it can't back a new exchange
  (`matches.ts:241-246` requires `expired IS NOT TRUE` and an unexpired clock) and leaves the list (C).
- Response, refusal order, idempotent "already completed" answer and the post-commit `match_completed` event are
  unchanged. No new event.

**The hold rule** in all four release statements:

```sql
AND NOT EXISTS (SELECT 1 FROM requests.matches m
                 WHERE m.offer_id = o.id AND m.status IN ('proposed', 'matched'))
```

`closeProposals` and D1 keep their same-request exclusion, now `… IN ('proposed', 'matched') AND NOT (m.request_id = $1
AND m.status = 'proposed'))`. A completed match no longer holds an offer anywhere.

**Retroactive freeing (decision 3).** D2 (`services/cleanup-service/src/jobs/expirationJob.ts`, the stranded-offer
statement) frees every `matched` offer that no proposed or matched exchange uses. On the first hourly run after deploy
that includes every offer stuck behind past completions. How many is unknown without a demo DB read (optional; needs the
maintainer's authorization). The post-merge record reads it from the first `strandedOffersFreed` count, which is a
demo-host read and also needs authorization.

**Accepted consequence: expired offers are deleted on the existing clock.** An offer past its expiry comes back flagged
`expired = TRUE`, and `hardDeleteExpiredData` deletes help offers where `expired = TRUE AND updated_at` is more than 7
days old. `requests.matches.offer_id` is `ON DELETE SET NULL` (`infrastructure/postgres/init.sql:6341`), so a completed
match keeps its row with `offer_id = NULL`, and `GET /matches`' `offer_title`/`offer_description`
(`matches.ts:61`, `:125`) then read null. No frontend or mobile code reads those fields (grep, 2026-11-06). This is
the same lifecycle every other expired offer already has; history no longer escapes it.

## B. BUG-094: a freed offer past its expiry is flagged at once

**Today:** the hourly flag (`expirationJob.ts:30-32`) marks `expired = TRUE` only on `status = 'active'` offers, and
every release sets `status = 'active'` without touching `expired`. An offer freed after its `expires_at` reads
`expired = FALSE` until the next hourly run. Correction to BUG-094's entry: no listing reads `expired` today, so the
visible effect is on `POST /matches`' fast path (which reads `expired`; the hold's clock check still refuses it) and on
the hard-delete clock (which starts up to an hour late). After C, the list reads it too.

**New.** All four release statements share one SET clause:

```sql
SET status = 'active',
    expired = (o.expired IS TRUE OR (o.expires_at IS NOT NULL AND o.expires_at <= clock_timestamp())),
    updated_at = CURRENT_TIMESTAMP
```

`expires_at` is `timestamp without time zone`; compare it exactly as `requestStatus.ts:75` does. The hourly flag is
unchanged.

## C. BUG-096 (new): `GET /offers` hides expired offers

**Today** (`services/request-service/src/routes/offers.ts:25-73`): `WHERE o.status = $1 AND ${offerReadableSql('o',
'$2')}`, with `status` defaulting to `'active'`. Expiry is never checked, so the `/offers` page
(`apps/frontend/src/pages/offers/index.tsx:43`) lists expired offers. Every offer created through the API gets
`expires_at` from the community's `offer_ttl_days`, default 60 (`offers.ts:137-143`).

**New.** The list adds, for every `status` value:

```sql
AND o.expired IS NOT TRUE
AND (o.expires_at IS NULL OR o.expires_at > NOW())
```

`NOW()` is right here: a read with no lock wait (`inventoryDb.ts:298` compares an ask's expiry the same way). The
visibility boundary (`offerReadableSql`), the filters, ordering, paging and the response shape are unchanged.
`GET /offers/:id` is unchanged: an offer reached by id still answers.

## D. BUG-095: index the offer-release lookup

**Today:** `requests.matches` is indexed on `request_id`, `responder_id` and two partial indexes
(`init.sql:4975-4993`); nothing on `offer_id`. Every guarded release and the hourly D2 sweep scan `matches`.

**New** migration `infrastructure/postgres/migrations/20261106-matches-offer-id-index.sql`:

```sql
-- Sprint 138 (BUG-095): index the offer-release guards' NOT EXISTS (... m.offer_id = o.id ...) and D2's sweep.
-- Plain CREATE INDEX: scripts/apply-migrations.sh runs each file inside BEGIN ... COMMIT, where CONCURRENTLY is refused.
CREATE INDEX IF NOT EXISTS idx_matches_offer_id
    ON requests.matches USING btree (offer_id)
    WHERE offer_id IS NOT NULL;
```

The build takes a write lock on `requests.matches` for its duration; at demo scale that is brief. Then regenerate
`init.sql` with `scripts/regenerate-init-sql.sh`, which needs a dedicated PostgreSQL 15 container
(`REGEN_PG_CONTAINER`, `scripts/regenerate-init-sql.sh:108-137`). This Windows box has no Docker: run it on the Mac
checkout, or in a disposable container on the demo host with the maintainer's separate authorization (the Sprint 134 L2
precedent, `docs/superpowers/plans/2026-10-27-sprint-134-pr-l2-drop-feedback-schema.md:78`). Never hand-edit
`init.sql`.

---

## Data Model

One partial index (D). No new or changed column, table or constraint. No data migration: retroactive freeing is the
hourly sweep's normal work under the new rule.

## API Endpoints

| Method | Path | Change | Answer |
|---|---|---|---|
| PUT | `/matches/:id/complete` | the final done mark frees the offer (A) | unchanged |
| GET | `/offers` | expired offers are not listed (C) | unchanged shape |
| PUT / DELETE | `/matches/:id/reject`, `/matches/:id` | `releaseOffer`: a completed match no longer holds; a freed past-expiry offer is flagged (A, B) | unchanged |
| — | match accept, provider-offer accept, dibs accept, requester cancel | `closeProposals`: same (A, B) | unchanged |

**Job:** cleanup-service `releaseExpiredHolds` D1 and D2: same (A, B). D2's first run after deploy frees history.
No new route, event or dependency. `services/registry.json`: no change.

## Frontend Changes

None. The `/offers` page shows fewer rows (expired offers leave it); an offer reappears there after its exchange
completes. Mobile: no change (it gains the same listing behaviour from the API).

## Tests

| File | What it proves |
|---|---|
| `services/request-service/tests/tdd/sprint-138-reusable-offers.test.ts` | Mocked-SQL contract, in the pattern of `sprint-137-exchange-integrity.test.ts`: the final done mark runs, in one transaction and in order, the done-mark UPDATE, the completed UPDATE, the request lock + reconcile, then `releaseOffer` with `[offer_id]`; a first mark and a null `offer_id` free nothing; `match_completed` still follows the commit; `releaseOffer`/`closeProposals` carry the new hold set and SET clause; `GET /offers` carries both expiry arms and keeps `offerReadableSql` and its params |
| `tests/regression/sprint-137-release-sql-parity.test.ts` (modified) | The hold set is `('proposed', 'matched')` in all four statements; the four SET clauses are identical (new check, with a negative case); the reference guard now asserts `completed` is **not** in the hold set |
| Existing regression fallout (modified, same commit as the source) | Every test that pins the old hold-set literal or SET clause: `services/cleanup-service/tests/regression/sprint-137-release-expired-holds.test.ts:329-332`, `services/request-service/tests/regression/sprint-134-bug-074-match-status-guards.test.ts:77`, `sprint-135-request-status-helper.test.ts:104`, `sprint-135-request-status-writers.test.ts:58,63`, `sprint-137-exchange-integrity.test.ts:80,282`, and the offer-status gate's `releaseOffer` `why` text (`sprint-137-offer-status-gate.test.ts:48`). Grep again before editing |
| `tests/regression/sprint-120-init-sql-drift-gate.test.ts` (modified) | `init.sql` contains `idx_matches_offer_id` with its partial predicate |
| `tests/integration/sprint-138-reusable-offers.integration.test.ts` (new, CI-only) | Real SQL: completion through both HTTP marks frees the offer, the first mark doesn't; a freed offer backs a new `POST /matches` on another ask and is freed again after that exchange completes (one offer, two completed matches); a legacy shared offer stays `matched` while another proposed or matched exchange uses it, then frees; D2 frees a completed-only `matched` offer (history); a past-expiry offer freed by completion, by reject and by D2 has `expired = TRUE` from the same statement; `GET /offers` hides a flagged offer and a clock-expired unflagged one and lists an unexpired one; `idx_matches_offer_id` exists with its definition (`pg_indexes.indexdef`) |
| `tests/integration/sprint-137-exchange-integrity.integration.test.ts` (modified) | Its `completed` variants (the shared-offer `it.each` at ~:500 and any D2 case with a completed reference) assert the Sprint 137 rule and must flip: a completed reference no longer holds |

## User Guide & Doc Updates

- **`docs/guides/fulfilling-requests-guide.md`**: line 39 (what a standing offer is): it stays available after an
  exchange it backed completes, until you withdraw it or it expires. Line 61: replace "an offer's status changes only
  when you withdraw it or through the exchange itself" with plain language that a completed exchange frees the offer
  for the next ask, and an expired offer leaves the offers list. Line 63 (can't be used twice at once): still true
  while an exchange is in progress; add that it is free again once that exchange completes.
- **`docs/guides/match-lifecycle.md`**: line 51 (a completed exchange is final): add that the standing offer it used is
  available again. Line 63: keep "an offer you withdrew is never brought back".
- **Landing:** regenerated from the guides and CONTEXT (`npm run generate-docs --workspace=apps/landing`; a landing
  `build` skips its prebuild under `ignore-scripts`). Revert timestamp/HEAD-sha churn. No new page.
- **`services/request-service/CONTEXT.md`:** `PUT /matches/:id/complete` (frees the offer), `GET /offers` (expired
  offers not listed), the release rule (hold set, expiry flag), Recent Fixes for BUG-093..096.
- **`services/cleanup-service/CONTEXT.md`:** `releaseExpiredHolds` D1/D2 hold set (`proposed`, `matched`), the expiry
  flag on free, and that D2's first run after deploy frees history.
- **`docs/BUGS.md`:** BUG-093, 094, 095 and 096 → `fixed (Sprint 138, v11.111.0)`, each with its commit and covering
  tests. BUG-094's entry gets the correction in B.
- **`services/registry.json`:** no change. **No ADR.**

## PR shape

One PR from `agent/claude/sprint-138-planning`, carrying the Sprint 137 archive and #330 post-merge record, this spec,
plan and handoff, the BUG-096 entry, and A–D. The PR body states that **the first deployed sweep frees history** (count
in the cleanup log's `strandedOffersFreed`; reading it is a demo-host read), and that expired freed offers then follow
the 7-day delete clock.

## Critical Implementation Notes

1. **One release rule, four copies, one commit.** `releaseOffer`, `closeProposals` (request-service
   `src/db/requestStatus.ts`), D1 and D2 (cleanup-service `src/jobs/expirationJob.ts`) change together, in the same
   commit as `tests/regression/sprint-137-release-sql-parity.test.ts`. The parity gate fails on any commit where they
   differ. D1 stays text for text `closeProposals`; D2 stays `releaseOffer` minus `o.id = $1 AND`.
2. **Keep every Sprint 137 guard.** Each release stays one guarded statement: `o.status = 'matched'`, the `NOT EXISTS`
   hold set, the same-request exclusion in `closeProposals`/D1, and the distinct scalar CTID version predicate (I1).
   Never add `FOR UPDATE` or persist a CTID.
3. **Completion lock order is match → request → offer**, the same as cancel (`matches.ts` cancel, ~:700-760, and the
   lock-order note in `expirationJob.ts`'s doc comment). Call `releaseOffer` after `reconcileRequestStatus`, inside the
   transaction, only when the exchange just finished. Re-read cancel and confirm no `help_offers` writer holds an offer
   lock and then waits on the request lock.
4. **Decide before the first write** stays true: completion's refusals (404, 409 `MATCH_NOT_COMPLETABLE`, the
   idempotent answer) return before any release.
5. **The expiry expression** is `o.expired IS TRUE OR (o.expires_at IS NOT NULL AND o.expires_at <= clock_timestamp())`
   in the releases (after lock waits), and `o.expired IS NOT TRUE AND (o.expires_at IS NULL OR o.expires_at > NOW())`
   in the `GET /offers` read. `expired` is nullable: `IS TRUE`/`IS NOT TRUE`.
6. **No new status writer.** The offer-status gate (`sprint-137-offer-status-gate.test.ts`) keeps its writer labels; only
   `releaseOffer`'s `why` text changes. Prove the gate still passes, and that it fails on an injected extra writer.
7. **Exact-contract fallout lands with its source.** Tests that pin the hold-set literal or the SET clause (the list in
   *Tests*) change in the same commit as the statements. Grep `'proposed', 'matched', 'completed'` and
   `SET status = 'active', updated_at` across `services/*/src`, `services/*/tests` and `tests/` before and after.
8. **The directed-surface allowlist is unaffected** (no `help_requests` literal changes); `sprint-132-directed-audience-gate`
   and `sprint-135-request-status-gate` must stay green with no hash change.
9. **Migration:** `IF NOT EXISTS`, partial, plain `CREATE INDEX` (decision P4). Review it with the
   `migration-validator` agent. Regenerate `init.sql` with `REGEN_PG_CONTAINER` (Mac checkout, or an authorized
   disposable demo-host container); never hand-edit it. The drift gate asserts the index.
10. **Real-SQL proofs are CI-only** (no PostgreSQL on the Windows box). Prove waits with `pg_blocking_pids`, never a
    sleep. Use fresh `randomUUID()` ids and `$n::varchar` status casts. Sprint 137's integration `completed` variants
    flip to the new rule in this sprint, with the reason in a comment.
11. **Tests first.** Request-service red tests go in `services/request-service/tests/tdd/` and may be committed red
    (its `test` is unit + regression). Cleanup-service's `test` runs its tdd tier (BUG-092), so its changes are edits
    to the existing regression test, committed with the implementation. Promote with a targeted `git mv`, never the
    promoter.
12. **`npm test` regenerates landing docs**; revert timestamp/HEAD-sha churn. **`feedback:check` reads
    `git diff --cached`**: run it staged.
13. **Identity is `req.user!.userId`** (ADR-064); no route reads the JWT `communities` claim.
14. **The first deployed sweep changes demo data** (decision 3). Say so in the PR body. A read-only count beforehand,
    and reading the first `Released expired holds` line afterwards, are demo-host reads: each needs authorization.

## Out of scope

- Per-offer "one-time vs standing" choice (decision 4).
- #329 Expo patch drift (decision 7); the mobile sprint; BUG-092.
- Notifying a helper that their offer is available again.
- `GET /offers/:id` expiry behaviour (an offer reached by id still answers).
- Pending provider offers on an expired ask (Sprint 137 *Out of scope*, unchanged).
