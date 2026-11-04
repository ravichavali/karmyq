# Sprint 137: Exchange Integrity — Design Spec

**Date**: 2026-11-04
**Status**: Approved (maintainer, 2026-11-04: scope and decisions 1–3). Planner decisions 4–9 stand unless the
maintainer vetoes one before execution starts.
**Version**: v11.109.0 → v11.110.0 (provisional; re-derive from `origin/master` at merge)
**Sprint Branch**: `agent/claude/sprint-137-planning` (planning and execution; one PR)

---

## Overview

Sprint 135 put every request-status writer under the request lock. Sprint 136 made an expired ask refuse new
commitments. Their reviews left four gaps, each on a path those guards do not reach yet:

- **BUG-088.** An expired ask's proposals stay `proposed`, and the help offers they hold stay `matched`. The helper
  cannot use that offer elsewhere. Planning found it is worse than logged: the hard delete removes a flagged ask 7 days
  after flagging, its proposals cascade away with it, and the offers stay `matched` with nothing left to free them.
- **BUG-089.** `PUT /offers/:id` writes any `status` the owner sends, which defeats Sprint 136's guarded hold. And
  `POST /matches` will hold an offer that has expired.
- **BUG-090.** `POST /providers/offers` validates the ask and inserts on the pool, with no request lock and no
  `expires_at` check. A provider can land a pending offer on an ask that just closed or expired.
- **BUG-091** (found while planning). `PUT /requests/:id` edits an ask in any status. Text written over a forgotten
  ask's sentinel is never forgotten, because the retention job forgets each ask once.

This sprint closes each gap at the layer that owns the state:
- the expiration sweep releases what an expired ask held;
- an offer's status changes only through its exchanges;
- the provider-offer insert moves under the request lock;
- a completed or cancelled ask can no longer be edited.

There is no new endpoint, event, migration or ADR.

### Core Principle: State Follows the Exchange

A help offer's status, like a request's, changes only through the exchanges that use it, under the lock that orders
them. Whatever ends an ask also releases what the ask was holding.

---

## Multi-Sprint Arc

### Sprint 135 — Request Status Guards (complete, v11.108.0)
Every request-status writer is guarded, and the status is derived (#327, `b9682c34`).

### Sprint 136 — Mobile Dependencies and Status Follow-ups (complete, v11.109.0)
An expired ask takes no new commitment; `POST /matches` runs under the request lock; retention ages from completion
(#328, `f19ca413`).

### Sprint 137 — this sprint
The four gaps above.

### Next (not scheduled)
The mobile sprint (`docs/IDEAS.md`, 2026-10-29), and a control to back out of an in-progress exchange
(`docs/IDEAS.md`, 2026-10-29), which would also route `match_rejected` / `match_cancelled` to notifications.

---

## Decisions

### Maintainer (2026-11-04)

1. **Scope: exchange integrity, one PR** from `agent/claude/sprint-137-planning`. The PR also carries the #328
   post-merge record and the Sprint 136 archive.
2. **Retention clock: keep COALESCE, and lock closed asks.** `PUT /requests/:id` refuses a completed or cancelled ask
   (BUG-091). GREATEST is not adopted.
3. **BUG-088: the expiration sweep closes an expired ask's proposals** and frees their help offers.

### Planner (2026-11-04; each open to the maintainer's veto)

4. **The sweep runs in cleanup-service, right after `markExpiredData` flags asks, with one transaction per ask.** This
   follows the `expireDibs` pattern.
   - Request-service has no scheduler. Its only timer is the directed-notification flush
     (`src/events/directedNotifications.ts:54`).
   - Cleanup-service owns expiry. It already writes request rows under the documented lock order: `expireDibs.ts` is a
     reviewed writer in `sprint-135-request-status-gate`.
   - The two `closeProposals` statements are copied, not imported, because one service cannot import another's
     source. The integration tests prove the copy behaves the same way.
5. **The same sweep frees stranded holds.** A stranded hold is an offer that is `matched` while no `proposed`, `matched`
   or `completed` match references it. Each one is freed in its own transaction, under the offer's row lock.
   - This repairs holds that past cascades already stranded, and it is a safety net from now on.
   - It changes demo data on the first run after deploy, and the run logs the count. If the maintainer prefers, drop
     D2 and keep D1.
6. **No notification when expiry closes a proposal.**
   - `match_rejected` is in `UNCONSUMED_EVENTS` (`packages/shared/events/routes.ts:47-48`), so no rejection notifies
     anyone today. Routing it is the back-out-control idea's work.
   - The helper still sees the change. The proposal leaves their awaiting list: `GET /requests/offered-awaiting`
     selects only `proposed` and `matched` (`src/routes/requests.ts:911`). The ask's page already reads "This ask has
     expired." (`apps/frontend/src/pages/requests/[id].tsx:59`).
7. **BUG-089: an offer's status is not editable,** and the hold requires an unexpired offer.
   - A body `status` on `PUT /offers/:id` answers `400 STATUS_NOT_EDITABLE`, as `PUT /requests/:id` does.
   - Withdraw stays `DELETE /offers/:id`.
   - A gate pins every help-offer status writer, as Sprint 135's gate does for requests.
8. **BUG-090: `POST /providers/offers` re-checks and inserts under `lockRequestForCommitment`.** It answers
   `409 REQUEST_NOT_OPEN` at the lock. The fast-path answers do not change.
9. **No ADR, no migration, no new event, no new endpoint.** No ADR number is needed.

---

## A. BUG-091: a completed or cancelled ask can't be edited

**Today** (`services/request-service/src/routes/requests.ts:1975-2048`): an ownership pre-read (404), a body-`status`
refusal (400 `STATUS_NOT_EDITABLE`, Sprint 135), then a dynamic `UPDATE ... SET ${updates} WHERE id = $n AND
requester_id = $m RETURNING *` on the pool.

**New.** The two checks stay first and unchanged. Then one `withTransaction`:

1. `lockRequest(q, id)` returns the **derived** status, not the column, so an old row is judged by its rows.
2. If the status is `completed` or `cancelled`, answer
   `409 { success: false, message: "A completed or cancelled request can't be edited", error: 'REQUEST_CLOSED' }`.
   Nothing is written.
3. Otherwise run the existing `UPDATE`, with `AND content_forgotten_at IS NULL` added to its `WHERE`. If it updates
   zero rows, answer the same 409. Ownership was checked first, so zero rows can only mean the ask was forgotten.

The column check backs up the status check. Today the retention job forgets only `status = 'completed'` asks
(`memoryRetentionJob.ts:99`), so step 2 already covers every forgotten ask. Step 3 keeps the rule true if a later change
forgets another kind of ask.

`REQUEST_CLOSED` is a new code. `REQUEST_NOT_OPEN` would be wrong here, because a `matched` ask is not open but stays
editable. Open, `dibs_pending` and `matched` asks stay editable, and so does an expired open ask (see *Out of scope*).

## B. BUG-089: an offer's status follows its exchanges

**B1. `PUT /offers/:id`** (`src/routes/offers.ts:180`). After the ownership check, a body `status` answers
`400 { success: false, message: "An offer's status changes through its exchanges, not an edit", error:
'STATUS_NOT_EDITABLE' }`, and nothing is written. The ownership check stays first, so a foreign offer still answers 404
and leaks nothing (BUG-064). Title and description edits are unchanged.

**B2. `POST /matches`** (`src/routes/matches.ts:161`):
- `findOwnOffer` (`src/db/helpOffersDb.ts:8`) also selects `expired`. The fast path refuses
  `status !== 'active' || expired === true` with the existing `400 OFFER_NOT_ACTIVE`.
- The guarded hold (`matches.ts:241`) adds `AND expired IS NOT TRUE AND (expires_at IS NULL OR expires_at >
  clock_timestamp())`. A miss is the existing `400 OFFER_NOT_ACTIVE`, returned before anything is written.
- Why both arms: the sweep flags an offer only while it is `active` (`expirationJob.ts:32`). An offer that passes its
  expiry while held is flagged only after it is freed, and the clock arm covers that gap. This mirrors what BUG-085 did
  for asks.

**B3. Client type.** `updateOffer` in `apps/frontend/src/lib/api.ts:615-621` declares `status?: string`, and nothing calls
it. Replace that line with a comment line, `// No status: an offer's status follows its exchanges (BUG-089).`, so
`api.ts`'s line count does not change (Sprint 136 note 17). Mobile has no `updateOffer`.

**B4. Offer-status gate.** `services/request-service/tests/tdd/sprint-137-offer-status-gate.test.ts`, modelled on
`tests/regression/sprint-135-request-status-gate.test.ts`:
- Every `UPDATE ... help_offers ... SET` in `services/*/src` that assigns `status`, or builds its `SET` at run time, must
  match exactly one reviewed entry.
- Every reviewed entry must match exactly one statement: identity, not a count.
- Negative fixtures prove the scan can fail.

The directed-surface scanner collects only literals that name `help_requests` (`tests/helpers/directedSurfaceScan.ts:30`).
`scanFile` and `scanServices` gain an optional table pattern, which defaults to today's. Prove the default unchanged:
both existing gates' hit sets are identical before and after.

The reviewed writers, each re-read at execution:

| File | Statement | Why |
|---|---|---|
| `request-service/src/db/requestStatus.ts` | `closeProposals` offer free | under the request lock; frees only while `matched` |
| `request-service/src/routes/matches.ts` | POST /matches hold | `active` → `matched`, unexpired, under the request lock |
| `request-service/src/routes/matches.ts` | match reject free | only while `matched` |
| `request-service/src/routes/matches.ts` | match cancel free | only while `matched` |
| `request-service/src/routes/offers.ts` | PUT /offers/:id (dynamic) | title and description; a body status is refused (B1) |
| `request-service/src/routes/offers.ts` | DELETE /offers/:id | the owner's withdraw |
| `request-service/src/routes/offers.ts` | PUT /offers/:id/privacy (dynamic) | privacy fields only |
| `cleanup-service/src/jobs/expirationJob.ts` | D1 offer free | expired ask's proposals; only while `matched` |
| `cleanup-service/src/jobs/expirationJob.ts` | D2 stranded free | no live or completed match holds it |

The scan, not this table, is the arbiter. Review any other statement it finds one at a time, and never add an entry
blindly.

## C. BUG-090: a provider offer is written under the request lock

**Today** (`src/routes/providerOffers.ts:18-86`): a provider-profile lookup (403), the `validateRequestForOffer` fast path
(404 `REQUEST_NOT_FOUND` with a reason), then `createProviderOffer` on the pool (duplicate check → 409 `DUPLICATE_OFFER`,
then insert). After that come the requester lookup and `offer_submitted`.

**New.** The profile lookup and fast path stay, with the same answers. Then one `withTransaction`:

1. `lockRequestForCommitment(q, request_id)`. Anything but `'open'` answers
   `409 { success: false, message: 'This request is no longer open', error: 'REQUEST_NOT_OPEN' }`, and nothing is
   written.
2. The duplicate check runs under the lock (409 `DUPLICATE_OFFER`).
3. Then the insert.

`createProviderOffer` takes the transaction's `q` as its first parameter; the route is its only caller. The requester
lookup and `offer_submitted` run after the commit, unchanged.

Lock order: this route is request-first and inserts one `provider.offers` row. That matches provider-offer accept
(`acceptOffer`, `src/db/offersDb.ts`), which also locks the request first.

## D. BUG-088: the expiration sweep releases what an expired ask held

A new exported function in `services/cleanup-service/src/jobs/expirationJob.ts`:
`releaseExpiredHolds(): Promise<{ asksReleased: number; proposalsClosed: number; strandedOffersFreed: number }>`.
`markExpiredData` calls it after its four flag statements, so the hourly cron and `POST /jobs/mark-expired` both run it.
The flag statements do not change. The run logs all three counts at `info`. A per-ask or per-offer failure logs the id
at `error`, rolls back that one transaction and continues, as `expireDibs` does.

**D1. Close an expired ask's proposals.** Candidates:

```sql
SELECT h.id FROM requests.help_requests h
 WHERE h.expired = TRUE AND h.status = 'open'
   AND EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = h.id AND m.status = 'proposed')
```

Each candidate gets its own transaction on a pool client:

```sql
SELECT id FROM requests.help_requests WHERE id = $1 AND expired = TRUE AND status = 'open' FOR UPDATE
-- zero rows: ROLLBACK and skip (cancelled, or matched, since the candidate read)
UPDATE requests.help_offers SET status = 'active', updated_at = CURRENT_TIMESTAMP
 WHERE status = 'matched' AND id IN (
   SELECT offer_id FROM requests.matches
    WHERE request_id = $1 AND status = 'proposed' AND offer_id IS NOT NULL)
UPDATE requests.matches SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
 WHERE request_id = $1 AND status = 'proposed'
-- COMMIT
```

- The candidates include asks flagged before this sprint shipped. So the first run also clears that backlog, before the
  7-day hard delete can strand any more offers.
- No reconcile is needed. The derivation ignores `proposed` matches (`requestStatus.ts:69-74`), so closing them leaves
  the derived status unchanged.
- D1 writes no `help_requests` row. So the hard-delete clock does not move (gotcha
  `demo-story-rows-are-deleted-on-a-cleanup-timer`), and `sprint-135-request-status-gate` is unaffected.

**D2. Free stranded holds.** Candidates:

```sql
SELECT o.id FROM requests.help_offers o
 WHERE o.status = 'matched'
   AND NOT EXISTS (SELECT 1 FROM requests.matches m
                    WHERE m.offer_id = o.id AND m.status IN ('proposed', 'matched', 'completed'))
```

Each candidate gets its own transaction:

```sql
SELECT id FROM requests.help_offers WHERE id = $1 FOR UPDATE
UPDATE requests.help_offers SET status = 'active', updated_at = CURRENT_TIMESTAMP
 WHERE id = $1 AND status = 'matched'
   AND NOT EXISTS (SELECT 1 FROM requests.matches m
                    WHERE m.offer_id = $1 AND m.status IN ('proposed', 'matched', 'completed'))
-- COMMIT
```

- **The lock is its own statement.** A single `UPDATE` that waited on the row would re-check only that row, while its
  `NOT EXISTS` kept the snapshot from before the wait. Suppose a `POST /matches` was holding the row: that `UPDATE`
  would miss the match it committed and free a live hold. `requestStatus.ts:38-44` documents the same hazard. After a
  separate lock statement, the `UPDATE` takes its snapshot after the wait (READ COMMITTED).
- **`completed` counts as a hold.** Completion never frees the offer. The only offer writers are the hold
  (`matches.ts:241`), reject (`:493`), cancel (`:746`) and `closeProposals`, so an offer that backed a completed
  exchange stays `matched` today. This sprint keeps that behaviour (see *Out of scope*).
- **Lock order.** D2 locks one offer row and never waits on a request lock. `POST /matches` locks the request, then the
  offer, so the two cannot form a cycle. D1 locks the request, then offers, then matches: the same order as accept's
  `closeProposals`. Match cancel and complete never wait on a proposed row: their `UPDATE ... AND status = 'matched'`
  does not qualify a proposed row, so it takes no lock on it.

---

## Data Model

No change. There are no migrations, and `init.sql` is untouched.

## API Endpoints

| Method | Path | Change | New answer |
|---|---|---|---|
| PUT | `/requests/:id` | refuses a completed or cancelled (or forgotten) ask, under the request lock | `409 REQUEST_CLOSED` |
| PUT | `/offers/:id` | refuses a body `status` | `400 STATUS_NOT_EDITABLE` |
| POST | `/matches` | an expired offer is not active (fast path and hold) | existing `400 OFFER_NOT_ACTIVE` |
| POST | `/providers/offers` | re-check and insert under the request lock | `409 REQUEST_NOT_OPEN` |

**Job:** cleanup-service `markExpiredData` now also runs `releaseExpiredHolds`, from both the hourly cron and the
`POST /jobs/mark-expired` admin trigger.

## Frontend Changes

None visible. One type line in `apps/frontend/src/lib/api.ts` changes (B3).

---

## Tests

The tests come first, red, in each changed workspace's `tests/tdd/`. Real-SQL proofs go in the root integration tier.

| File | Proves |
|---|---|
| `services/request-service/tests/tdd/sprint-137-exchange-integrity.test.ts` | Mocked-SQL contract, in the pattern of `sprint-136-request-followups.test.ts`: A's 409s come before any write, and the `UPDATE` carries `content_forgotten_at IS NULL`; B1's 400 comes after the 404 and writes nothing; B2's fast path and hold SQL; C's lock → duplicate check → insert inside the transaction, its refusals write nothing, and the event follows the commit |
| `services/request-service/tests/tdd/sprint-137-offer-status-gate.test.ts` | B4, with negative fixtures, and the scanner default unchanged |
| `services/cleanup-service/tests/tdd/sprint-137-release-expired-holds.test.ts` | D's statement order per transaction (lock, offers, matches, commit); rollback-and-skip when the re-check under the lock finds nothing; one failure is isolated; D2's lock statement comes before its `UPDATE`; the counts |
| `tests/integration/sprint-137-exchange-integrity.integration.test.ts` | Real PostgreSQL, CI-only on Windows (see below) |

The integration cases:

- **D1.** A flagged ask with three proposals (one holding an offer, one whose offer was withdrawn, one with no offer)
  → `markExpiredData()`:
  - all three are `rejected`, the held offer is `active` and the withdrawn one stays `withdrawn`;
  - an unexpired twin's proposal is untouched, and so is a cancelled ask;
  - an ask past `expires_at` but not yet flagged is flagged and released in the same run;
  - an already-flagged ask's `updated_at` is unchanged by the release.
- **D1 race.** The requester's uncommitted cancel holds the ask. The sweep waits on it, shown by `pg_blocking_pids`
  (never a sleep). After the commit the sweep skips the ask, which writes nothing more.
- **D2.**
  - A stranded `matched` offer with no match row is freed.
  - An offer backing a `completed` match stays `matched`.
  - An offer that a second client holds and is matching (`UPDATE ... 'matched'` plus a match `INSERT`, uncommitted)
    makes the sweep wait. After the commit the offer stays `matched`.
- **B.**
  - `PUT /offers/:id` with `status` → 400, and the row is unchanged.
  - `POST /matches` with a flagged offer → 400, writing nothing.
  - `POST /matches` with an offer past `expires_at` but not flagged → 400 at the hold, with no proposal; the offer stays
    `active`.
- **C.**
  - An ask past `expires_at` but not flagged → 409, and no `provider.offers` row.
  - An uncommitted cancel → the submit waits on it, then 409.
  - The unexpired twin → 201.
- **A.**
  - A completed ask → 409, and the title is unchanged.
  - A cancelled ask → 409.
  - A forgotten ask → 409, and the sentinel stays.
  - Open and matched asks → 200.

## User Guide & Doc Updates

- **`docs/guides/fulfilling-requests-guide.md`** (line 61, *Expired requests take no new offers*): an offer still waiting
  on an expired request is closed within about an hour, and the standing offer it held is free again; you can withdraw
  it sooner. An expired standing offer can't back a new offer. An offer's status changes only by withdrawing it or
  through the exchange.
- **`docs/guides/making-requests-guide.md`**: line 59, offers still waiting on an expired request are closed for you
  within about an hour. Line 102, a completed or cancelled request can't be edited.
- **`docs/guides/match-lifecycle.md`** (the withdraw/decline section, ~line 59-63): a proposal is also closed when its
  request expires.
- **`docs/guides/your-memory-and-relationships-guide.md`** (~line 47): a completed request can't be edited, so nothing
  written after it completes escapes forgetting.
- **`docs/guides/using-service-providers-guide.md`** (~line 93): a provider can't offer on a request that has closed or
  expired.
- **Landing:** regenerated from the guides; revert the timestamp and HEAD-sha churn. No new page.
- **`services/request-service/CONTEXT.md`:**
  - `PUT /requests/:id` (`REQUEST_CLOSED`);
  - new entries for `PUT /offers/:id` and `DELETE /offers/:id`, which are documented today only in passing under
    `POST /offers`;
  - `POST /matches` (the expiry arms of the hold);
  - `POST /providers/offers` (the lock);
  - Known Issues → Recent Fixes for BUG-088..091.
- **`services/cleanup-service/CONTEXT.md`:** the expiration job's `releaseExpiredHolds` (D1, D2, the counts).
- **`docs/BUGS.md`:** BUG-088, 089, 090 and 091 → `fixed`, each with its commit and covering test. BUG-089's entry
  should say how B4 locks it.
- **`services/registry.json`:** no change (no endpoint, event or dependency). `feedback:check` confirms.
- **No ADR.**

---

## PR shape

One PR from `agent/claude/sprint-137-planning`. It bundles:
- the #328 post-merge record and the Sprint 136 archive (already on the branch);
- this spec, the plan and the handoff;
- the BUG-088/090 corrections and the BUG-091 entry;
- A–D.

Title:
`fix(requests): expired asks release their holds, offer status follows its exchanges, closed asks can't be edited
(BUG-088..091, v11.110.0)`.

The body states that the first run after deploy changes demo data (D1's backlog, D2's stranded holds), and that the
counts appear in the cleanup-service log.

---

## Critical Implementation Notes

1. **Lock, then check, in separate statements** (A, C, D1, D2). A statement that waited on a row lock keeps its
   subqueries' snapshot from before the wait (`requestStatus.ts:38-44`). Take the lock in its own statement, and decide
   in the next one.
2. **Lock order.**
   - D1 is request → offers → matches, the same as accept's `closeProposals`.
   - D2 is the offer row only.
   - C is request-first and inserts one row.
   - A is the request lock only.

   Before writing D, re-read match cancel and complete. Confirm that each `UPDATE ... AND status = 'matched'` takes no
   lock on a proposed row, and that no `help_offers` writer holds an offer lock and then waits on the request lock
   (Sprint 136's test header lists them).
3. **Decide before the first write.** Each refusal returns before anything is written:
   - A refuses before its `UPDATE`;
   - C refuses at the lock and the duplicate check, before its insert;
   - the B2 hold's miss returns before the match insert.
4. **The scanner sees only `help_requests` literals** (`directedSurfaceScan.ts:30`). B4 adds a table parameter whose
   default keeps today's pattern. Prove that `sprint-132-directed-audience-gate` and `sprint-135-request-status-gate`
   find the same hits before and after.
5. **Re-pin directed-surface hashes with `surfaceHash`. Never hand-type one.** These need re-pinning:
   - D1's candidate `SELECT` and lock `SELECT`. These are new entries in
     `services/request-service/tests/helpers/directedSurfaceAllowlist.json`, with reason "Internal expiry mutation, no
     audience-facing output."
   - A's changed `UPDATE`.
   - Anything else the gate names with file:line.

   D2's statements do not name `help_requests` and need no entry.
6. **D writes no `help_requests` row.** No `updated_at` stamp, so the hard-delete clock (gotcha) and the request-status
   gate are untouched.
7. **The copied `closeProposals` SQL** keeps two properties: the offer is freed "only while `matched`" (a withdrawn
   offer stays withdrawn), and offers are updated first, so the subquery still sees the proposals. A comment in each
   copy names the other. The integration test's withdrawn-offer case proves the behaviour, not the text.
8. **SQL hygiene.**
   - Use literal statuses only.
   - `expired` is nullable, so write `IS TRUE` / `IS NOT TRUE` in request-service.
   - Check expiry with `clock_timestamp()` after a lock wait, never `NOW()`.
   - `expires_at` is `timestamp without time zone`. Compare it as Sprint 136 did (`requestStatus.ts:75`).
   - Test fixtures cast `$n::varchar`.
9. **Identity is `req.user!.userId`** (ADR-064). No route reads the JWT `communities` claim
   (`tests/regression/sprint-134-pr-k-claim-gate.test.ts`).
10. **Real-SQL tests live in root `tests/integration/`** and run in CI only (no local PostgreSQL on the Windows box).
    - Prove waits with `pg_blocking_pids`, never a sleep. A waiter counts when the holder blocks it directly, or blocks
      a pid that blocks it (Sprint 136 note 14).
    - Root integration tests already import cleanup-service source directly (`sprint-136-request-followups`), so D's
      cases call `markExpiredData()`.
11. **Tests first** in `services/request-service/tests/tdd/` and `services/cleanup-service/tests/tdd/`. Run them red,
    then implement. Promote with a targeted `git mv`, not the promoter, which sweeps every green tdd file repo-wide.
12. **`markExpiredData`'s unit test pins four calls** (`tests/unit/expirationJob.test.ts:19-33`). Update it to the new
    contract: the four flags, then the release. Do not weaken it.
13. **`npm test` regenerates landing docs.** Revert the timestamp and HEAD-sha churn before committing.
14. **No demo-host operation in this sprint.** The first deployed run changes demo data (D1's backlog, D2's stranded
    holds); say so in the PR body. A read-only count beforehand is optional and needs the maintainer's authorization.
15. **`feedback:check` reads `git diff --cached`.** Run it before committing; on a committed branch it is a false green.
16. **After the merge, read master's open code-scanning alerts and the merge-sha analysis.** B3 keeps `api.ts`'s line
    count, but diffs don't predict re-raises. Surface a re-raise to the maintainer; never loop the dismissal API.

## Out of scope

- **Pending provider offers on an expired ask stay pending.** They hold nothing, provider-offer accept already refuses
  them (Sprint 136), and the demo's provider-offer story is one of them.
- **An expired open ask stays editable.** An edit restarts the hard delete's 7 days (gotcha). The maintainer's decision
  covered completed and cancelled asks only.
- **An offer that backed a completed exchange stays `matched`,** so a standing offer is one-shot today. That is existing
  behaviour and is not changed here; whether offers should be reusable is a product question.
- **Notifying a helper of any rejection** (`match_rejected` is unconsumed). That belongs to the back-out-control idea.
- The mobile sprint; BUG-073, 076, 080, 081, 082; the per-community health-quality weight; `deepmerge` #178 (re-check by
  2026-12-01).
