# Sprint 135: Request Status Guards (BUG-075 + BUG-078) — Design Spec

**Date**: 2026-11-01
**Status**: Approved (maintainer answered all four design questions on 2026-11-01)
**Version**: v11.106.0 → v11.107.0 (**provisional**: re-derive from `origin/master` at merge time)
**Sprint Branch**: `agent/claude/sprint-135-pr-request-status-guards` (cut from `origin/master` `965cdf2d`)

---

## Overview

A request's status (`open`, `dibs_pending`, `matched`, `completed`, `cancelled`) is written by ten places in
request-service, and only BUG-074's cancel checks what it overwrites. The others each assume the request is in the state
their own happy path left it in. So a completed ask can be reopened by a reject, re-matched by an accept, an admin
proposal or a provider-offer accept, or flipped back to `open` by a dibs decline. A cancelled ask can be completed by a
late final mark. And a requester can set any status at all through `PUT /requests/:id`. The demo database holds the
results (2026-10-29, read-only): **119** requests with more than one completed match, and **52** `open` plus **2**
`matched` requests that already hold a completed match.

The fix has two parts. **Guarded writes:** each writer changes its own row (match, dibs or offer) with a conditional
statement, and refuses with a 409 when that row, or the request, is no longer in the state the action needs.
**One derived status:** a single helper, `reconcileRequestStatus`, then writes the request's status from its rows, under
the request row lock:

- `cancelled` stays `cancelled`;
- otherwise `matched` if an exchange on it is in progress;
- else `completed` if one has completed;
- else `dibs_pending` if a dibs invitation is pending;
- else `open`.

Cancel's existing `CASE` becomes that helper. A gate test then fails on any request-status write outside the reviewed
list, so the class cannot regrow.

### Core Principle: A request's status follows its rows

Nobody writes a request status by hand. Writers change the rows that mean something (a match was accepted, a dibs was
declined), and the request's status is derived from those rows by one statement, in one module. The only status that
is a decision, not a derivation, is the requester's `cancelled`, and it has its own guarded writer in the same module.

---

## Decisions (maintainer, 2026-11-01)

| # | Question | Decision |
|---|---|---|
| 1 | Scope | **All ten writers** (inventory below), plus a gate test that fails on any request-status write outside the reviewed list. cleanup-service's expiry jobs are already guarded and stay as they are. |
| 2 | Approach | **Guarded writes plus one shared reconcile.** Each writer guards its own row's change (BUG-074 style, 409 when the guard misses); `reconcileRequestStatus` derives the request status under the request row lock. Cancel's `CASE` becomes that helper. One service, so **no ADR**; the rules go in CONTEXT.md and the guide. |
| 3 | Requester cancel during an exchange | **Refuse** with 409 `REQUEST_HAS_ACTIVE_EXCHANGE`. A completed or cancelled ask answers 409 `REQUEST_NOT_CANCELLABLE`. Cancelling an open ask rejects its proposals and frees their offers. |
| 4 | Demo rows | **No repair.** After deploy, one read-only recount shows no new inconsistent rows appear under the simulation's traffic. A repair would be a separate authorized operation, or the curated reset (demo-stories runway ~2026-12-18) clears them. |

**Consequences of decision 2 that the spec makes explicit:**
- **An inconsistent row converges when touched.** An `open` ask that already holds a completed match becomes `completed`
  the next time any writer reconciles it. That is the derivation working, not a repair. No job sweeps the old rows.
- **BUG-074's decision 2 holds for consistent data.** In consistent data, a `dibs_pending` ask has a pending dibs and a
  `completed` ask has a completed match, so a cancel leaves both as they are, exactly as before. Two BUG-074 real-SQL
  fixtures assert this on asks with *no* backing rows (an inconsistent state). They gain their backing rows; their
  assertions stay the same.
- **Accept, propose and provider-offer accept need an `open` ask.** While a dibs invitation is pending the ask is not
  open to other offers: dibs is a first refusal. This barely changes reachable behavior. Dibs is sent at creation, the
  public feed hides a `dibs_pending` ask, and `POST /matches` already requires `open`.

---

## Evidence

### The ten writers (verified at `965cdf2d`)

| # | Writer | What it does today | Bug |
|---|---|---|---|
| 1 | `PUT /matches/:id/accept` (`services/request-service/src/routes/matches.ts:345-406`) | Sets the request `matched` with no status check (`:369-374`); frees sibling offers even when withdrawn (`:379-387`) | BUG-075, BUG-078 #1 |
| 2 | `PUT /matches/:id/reject` (`:480-527`) | Frees the offer even when withdrawn (`:504-509`); reopens with `status != 'matched'`, so a `completed`, `cancelled` or `dibs_pending` ask reopens (`:518-525`) | BUG-075, BUG-078 #1 |
| 3 | `PUT /matches/:id/complete` (`:623-656`) | Finalize sets the request `completed` unconditionally (`:650-653`): a cancelled ask completes, and an ask with a second helper still matched closes. A repeat mark re-stamps its own `done_at` (`:626-630`) | BUG-078 #2, #3 |
| 4 | `POST /requests/:id/propose-match` (`services/request-service/src/routes/adminActions.ts:94-170`) | No request-status check before the insert (`:144-148`) | BUG-075 |
| 5 | `POST /requests/:id/dibs` (`services/request-service/src/routes/dibs.ts:127-260`) | Checks `open` in a read (`:150`), then writes `dibs_pending` unconditionally in the transaction (`:235-238`) | new |
| 6 | `PUT /requests/dibs/:id/accept` (`dibs.ts:284-366`) | Dibs `UPDATE` unguarded (`:323-326`); sets the request `matched` whatever its status (`:336-339`); leaves sibling proposals alive | BUG-075 |
| 7 | `PUT /requests/dibs/:id/decline`, `POST /requests/dibs/:id/expire` (`dibs.ts:373-500`) | Reopen the request unconditionally (`:419-422`, `:480-483`); dibs `UPDATE`s unguarded | BUG-075 |
| 8 | `PUT /requests/offers/:id/accept` → `acceptOffer` (`services/request-service/src/db/offersDb.ts:34-70`) | Four writes with **no transaction** and no guard: sets `matched` whatever the status (`:60-63`) | new |
| 9 | `PUT /requests/:id` (`services/request-service/src/routes/requests.ts:1974-2055`) | Takes `status` from the body and writes it (`:2014-2017`); publishes `request_completed` when it is `completed` (`:2038-2043`) | new |
| 10 | `DELETE /requests/:id` (`requests.ts:2057-2106`) | Cancels whatever the status (`:2079-2085`), so a completed ask can be cancelled and a matched exchange is left `matched` on a cancelled ask | new |

BUG-074's `DELETE /matches/:id` (`matches.ts:713-818`) is already guarded. Its request `CASE` (`:771-779`) moves into the
shared helper.

**Not affected:** cleanup-service's `expirationJob.ts:19` writes the `expired` flag only, for `status = 'open'`, and
`expireDibs.ts:46` reopens only `WHERE status = 'dibs_pending'`. `memoryRetentionJob.ts` rewrites content columns only.

### Callers (verified with `git grep`)

- **Accept, reject, provider-offer accept:** `CommitmentsTab.tsx:293,312,325`, `Feed/DecisionBand.tsx:52-56`,
  `MyRequestsTab.tsx:97`. Each catch shows `err.response?.data?.message`, so **a refusal message must read well on its
  own.**
- **Propose-match:** `StewardRequestsAdmin.tsx:518,581`, offered only on `status === 'open'` (`:283`, `:499`), and the
  simulation's `admin-propose-helper-workflow.ts` (an `open` ask browsed earlier, so it can race). The alert shows the
  `message`.
- **Dibs:** `RequestWizard.tsx:201` (send) and `DecisionBand.tsx:58-60` (accept, decline); the simulation's
  `api-client.ts:498-511` swallows errors (`.catch(() => null)`).
- **`PUT /requests/:id` and `DELETE /requests/:id`: no client caller.** `updateRequest` (`apps/frontend/src/lib/api.ts:580`,
  `apps/mobile/services/api.ts:90`) and `cancelRequest` (`api.ts:589`) are defined and never called, and the simulation
  calls neither. So the `status` field and the cancel guard change no screen.
- **The simulation retries only 429** (`services/simulation-service/src/utils.ts:116-137`). A new 409 surfaces to a caller
  that already handles refusals.

### The event

`request_completed` has exactly one publisher, `PUT /requests/:id` (`requests.ts:2039`), and is in `UNCONSUMED_EVENTS`
(`packages/shared/events/routes.ts:49`). Removing the `status` field removes its only publish. The event-routes gate
(`tests/regression/sprint-133-pr-q-event-routes.test.ts:90-99`) holds `services/registry.json`'s request-service
`publishes` exactly equal to the source, so `request_completed` leaves the registry. It stays listed in
`UNCONSUMED_EVENTS`: nothing requires that list's names to have a publisher, and
`packages/shared/src/events/__tests__/routes.test.ts:30` pins its size at 21.

### Demo data (maintainer-authorized read-only counts, 2026-10-29)

119 requests with more than one `completed` match; 52 `open` and 2 `matched` requests holding a `completed` match; 0
`cancelled` matches with `completed_at`. There is no status history, so the cause is unconfirmed. Paths the simulation
actually drives, and that this design closes:
- an admin proposal lands on a `dibs_pending` or `completed` ask, the helper accepts and completes, and the ask gains a
  second completed match;
- a dibs decline then reopens that completed ask.

The simulation never calls reject or the match cancel.

---

## Data Model

**No change.** `requests.help_requests.status` keeps `chk_help_requests_status`. `requests.matches.status` and
`requests.help_offers.status` have no CHECK. `requests.dibs.status` keeps `dibs_status_check`
(`pending|accepted|declined|expired`), and `provider.offers.status` keeps `offers_status_check`
(`pending|accepted|declined|withdrawn`). No triggers. No migration.

---

## The Status Rule (`services/request-service/src/db/requestStatus.ts`, new)

| Helper | SQL | Contract |
|---|---|---|
| `lockRequest(q, requestId)` | `SELECT status FROM requests.help_requests WHERE id = $1 FOR UPDATE` | Locks the row for the transaction and returns its status (or `null`). The status is current: no writer can change it until this transaction ends. |
| `reconcileRequestStatus(q, requestId)` | `lockRequest`, then `UPDATE requests.help_requests r SET status = CASE WHEN <matched match> THEN 'matched' WHEN <completed match> THEN 'completed' WHEN <pending dibs> THEN 'dibs_pending' ELSE 'open' END WHERE r.id = $1 AND r.status <> 'cancelled'` | The UPDATE is its own statement **after** the lock, so its EXISTS subqueries see everything committed before the lock was granted (the BUG-074 cancel note). Called after the writer's own row changes; writes status only. |
| `markRequestCancelled(q, requestId)` | `UPDATE requests.help_requests r SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE r.id = $1 AND r.status IN ('open', 'dibs_pending') AND NOT EXISTS (<matched match>)` | The requester's decision, guarded in the write. Returns whether it cancelled. |
| `closeProposals(q, requestId)` | `UPDATE requests.help_offers SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE status = 'matched' AND id IN (<offer ids of proposed matches>)`, then `UPDATE requests.matches SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE request_id = $1 AND status = 'proposed'` | Rejects every open proposal and frees each one's offer only while the proposal holds it (BUG-078 #1). Offers first, so the subquery still sees the proposals. |

**Why the last committer is right.** Every writer that changes a match or dibs status reconciles in the same
transaction, under the request lock, as a fresh statement. A writer that changes its row first and waits for the lock
(complete, cancel, the dibs routes) reconciles after the lock holder commits, and so sees it. A writer that holds the
lock first (accept, reject) blocks the others until it commits. Either way, the transaction that reconciles last sees
every committed row.

---

## Locking (default READ COMMITTED)

| Order | Writers | Rows they touch |
|---|---|---|
| request → proposed matches → offers | accept, reject, propose-match, dibs create, provider-offer accept, requester cancel | only `proposed` matches (plus new rows) |
| matched match → request | complete, BUG-074 cancel | only `matched` matches |
| dibs → request | dibs accept, dibs decline, dibs expire, cleanup-service's `expireDibs` | one dibs row |

The first two groups never touch the same match row, so they cannot deadlock (BUG-074's analysis, extended). The dibs
routes take the dibs row first, in the same order as cleanup's job. **No writer may lock the request and then a dibs
row**; that is why the requester cancel leaves a pending dibs alone (below).

---

## API Endpoints

All refusals use the ADR-074 shape `{ success: false, message, error }`. No refusal writes or publishes anything.

| Method | Path | Change | New or changed responses |
|---|---|---|---|
| PUT | `/matches/:id/accept` | Request must be `open` (locked read); reconcile replaces the `matched` write; `closeProposals` replaces the sibling statements | **409** `REQUEST_NOT_OPEN` "This request is no longer open" (`dibs_pending`, `completed`, `cancelled`); 409 `ALREADY_MATCHED` unchanged (`matched`, or the match left `proposed`) |
| PUT | `/matches/:id/reject` | Offer freed only while `matched`; reconcile replaces the reopen and the remaining-proposals count | none (409 `MATCH_NOT_PROPOSED` unchanged) |
| PUT | `/matches/:id/complete` | `done_at = COALESCE(done_at, CURRENT_TIMESTAMP)`; reconcile replaces the finalize's request write | none: a repeat mark is the same 200 "waiting" and no longer moves the stamp |
| DELETE | `/matches/:id` | The request `CASE` becomes `reconcileRequestStatus` | none |
| POST | `/requests/:id/propose-match` | Lock, request must be `open`; duplicate check and insert inside the transaction | **409** `REQUEST_NOT_OPEN` "This request is no longer open" |
| POST | `/requests/:id/dibs` | Lock, request must be `open`; reconcile replaces the `dibs_pending` write | **409** `REQUEST_NOT_OPEN` "Request is not available for dibs" (the pre-read's existing message, now also on a race) |
| PUT | `/requests/dibs/:id/accept` | Lock dibs row, lock request; request must be `dibs_pending`; guarded dibs `UPDATE`; insert match; `closeProposals`; reconcile | **409** `REQUEST_NOT_OPEN` "This request is no longer waiting on your dibs"; **409** `INVALID_STATE` "Dibs is no longer pending" (race) |
| PUT | `/requests/dibs/:id/decline` | Guarded dibs `UPDATE`; reconcile replaces the reopen | **409** `INVALID_STATE` "Dibs is no longer pending" (race) |
| POST | `/requests/dibs/:id/expire` (test-only) | As decline, with `expired` | as decline |
| PUT | `/requests/offers/:id/accept` | One transaction: lock, request must be `open`; guarded offer `UPDATE`; insert match; `closeProposals`; reconcile | **409** `REQUEST_NOT_OPEN` "This request is no longer open"; 404 `NOT_FOUND` also on a lost race |
| PUT | `/requests/:id` | `status` is not editable | **400** `STATUS_NOT_EDITABLE` "A request's status changes through its exchanges, not an edit"; `request_completed` no longer published |
| DELETE | `/requests/:id` | Lock; guarded `markRequestCancelled`; then `closeProposals` | **409** `REQUEST_NOT_CANCELLABLE` "Only an open request can be cancelled" (`completed`, `cancelled`); **409** `REQUEST_HAS_ACTIVE_EXCHANGE` "This request has an exchange in progress, so it cannot be cancelled" |

**A pending dibs on a cancelled ask stays `pending`.** Marking it would make the cancel lock the request and then the
dibs row, the order the dibs routes reverse. The provider's accept then answers 409 `REQUEST_NOT_OPEN`, a decline still
works (and leaves the ask cancelled), and cleanup's job expires the row without touching the ask.

---

## Frontend Changes

**None.** Every UI caller shows the server's `message` on failure (*Callers* above), propose-match is offered only on
open asks, and no screen sends a status edit or a request cancel.

---

## User Guide & Doc Updates

- `docs/guides/match-lifecycle.md`:
  - *Withdrawing Before Acceptance*: a withdrawal or decline reopens the ask only if nothing else holds it. A completed or
    cancelled ask stays that way, and an offer you withdrew is never brought back.
  - New section, **What the request's status follows**: matched while an exchange is in progress, completed once one
    completes, cancelled stays cancelled. A late "mark done" on a cancelled ask completes the exchange but not the ask.
    An ask that is no longer open refuses new matches.
- `docs/guides/dibs-request.md`: while your dibs invitation is pending, the ask is not open to other offers. If you
  cancel the ask meanwhile, the provider can no longer accept.
- `docs/guides/making-requests-guide.md` (near `:97`): cancel works on an open ask. An ask with an exchange in progress,
  or a completed one, cannot be cancelled. A status cannot be set by editing.
- `docs/guides/admin-community-guide.md` (*Suggest a Helper*, `:161-163`): if the ask stops being open before you
  propose, you see "This request is no longer open".
- Regenerate the landing docs and keep only the four guides' tracked JSON diffs.
- `services/request-service/CONTEXT.md`: Recent Changes, the endpoint sections for all ten writers, a *Request status*
  rule paragraph in §2.3, and §10.4 Recent Fixes.
- `services/registry.json`: objects for the changed endpoints; `request_completed` removed from request-service
  `publishes`.
- `docs/BUGS.md`: BUG-075 and BUG-078 → fixed.
- **No ADR** (decision 2).

---

## Out of Scope

- Any demo data repair (decision 4).
- cleanup-service's expiry jobs, which are already guarded.
- `POST /matches` (it writes a proposal and its offer, not a request status; its `open` check is a pre-read, and a
  proposal that lands on a just-closed ask can only be rejected, never accepted).
- `packages/shared` (`request_completed` stays in `UNCONSUMED_EVENTS`).
- Declining a provider's other pending offers when one is accepted. The others stay `pending`, and their accept now
  answers 409 `REQUEST_NOT_OPEN`.
- A UI control for cancelling a request or an exchange (`docs/IDEAS.md` 2026-10-29); the frontend and mobile; BUG-076,
  BUG-080, BUG-081, BUG-082.

---

## Critical Implementation Notes

1. **The guard lives in the write, or under the request lock.** Match, dibs and provider-offer changes carry their
   status in the `WHERE` (`AND status = 'proposed'`, `'matched'`, `'pending'`). Request preconditions are read with
   `lockRequest` inside the transaction. A status read before the transaction may stay as a fast path, but it is never
   the guard.
2. **Only `src/db/requestStatus.ts` writes a request status.** `reconcileRequestStatus` and `markRequestCancelled` are
   its two writers. The gate (`sprint-135-request-status-gate.test.ts`) allows exactly these, plus cleanup's
   `expireDibs.ts`, and three reviewed dynamic `SET` builders (`memoryRetentionJob.ts`, `PUT /requests/:id`,
   `PUT /requests/:id/privacy`). Every other request-status write fails it.
3. **Reconcile = lock, then a fresh `UPDATE`,** called after the writer's own row changes, as the transaction's last
   request write. It never derives `cancelled` away. It writes `status` only (as the match routes do today): no
   `updated_at`, so the memory-retention window, which reads `updated_at`, does not move.
4. **Lock order** (the spec's *Locking* table): request-first writers touch only `proposed` matches, and match-first writers only
   `matched` ones. The dibs routes take the dibs row (`SELECT id FROM requests.dibs WHERE id = $1 FOR UPDATE`, or the
   guarded dibs `UPDATE`) before the request. Never lock the request and then a dibs row.
5. **Decide before the first write.** `withTransaction` commits whatever ran when the callback returns. A refusal must be
   returned before the transaction's first write, so dibs accept locks the dibs row with `SELECT ... FOR UPDATE`, checks
   the request, and only then runs its guarded `UPDATE`. The requester cancel runs the guarded `markRequestCancelled`
   before `closeProposals`.
6. **Free an offer only while it is `matched`:** `closeProposals` and reject use `AND status = 'matched'`. A withdrawn
   offer stays withdrawn.
7. **Literal statuses only.** Never pass a status as a parameter compared with `requests.matches.status`; test fixtures
   cast (`$n::varchar`).
8. **Response contract.** The new codes are `REQUEST_NOT_OPEN`, `REQUEST_NOT_CANCELLABLE`,
   `REQUEST_HAS_ACTIVE_EXCHANGE` (409) and `STATUS_NOT_EDITABLE` (400). The existing `ALREADY_MATCHED`,
   `MATCH_NOT_PROPOSED`, `INVALID_STATE`, `NOT_FOUND` and their messages stay as they are. Every message reads well
   alone.
9. **Directed-surface gate** (`sprint-132-directed-audience-gate.test.ts`). It fails on an unlisted `help_requests`
   literal **and** on a stale allowlist entry.
   - Stale after this sprint: the `matches.ts` entries `37124d9f…` (lock, two entries), `1aaaaca2…`
     (`SET status = 'matched'`), `e8fc886f…` (reopen), `b8396be5…` (finalize) and `e267659f…` (cancel `CASE`); the
     `offersDb.ts` entry `d5225b81…`; and the `requests.ts` entry for the request cancel's `UPDATE`.
   - New: the three `help_requests` statements in `requestStatus.ts`.
   - The gate prints file:line; compute each hash with `surfaceHash` and never hand-type one.
10. **Event.** `PUT /requests/:id` no longer publishes `request_completed`; remove it from request-service `publishes` in
    `services/registry.json`. Do not touch `packages/shared`.
11. **BUG-074's real-SQL file** (`tests/integration/sprint-134-bug-074-match-status-guards.integration.test.ts:183-190`):
    the `dibs_pending` and `completed` cases of "leaves a %s ask as it is" gain their backing rows: a pending dibs and a
    completed match by H2. The assertion `askStatus(q) === status` stays.
12. **Identity is `req.user!.userId` only** (ADR-064). No JWT `communities` claim is read
    (`tests/regression/sprint-134-pr-k-claim-gate.test.ts`).
13. **The real-SQL test is CI-only on Windows.** Its races prove the wait with `pg_blocking_pids` over `pg_locks`, never
    a sleep. Each HTTP completion waits for its `karmyq-completion-reputation` job before teardown, so no karma row lands
    after the community is gone. It does not call the test-only expire route.
14. **Tests first** in `services/request-service/tests/tdd/` (red), then the implementation. Promote with
    `node scripts/promote-tdd-tests.js` and restore any unrelated file it sweeps.
15. **No migration, no dependency change.** The version bump edits only `package.json` and the two root `"version"`
    lines in `package-lock.json`.
16. **Delete what becomes dead:**
    - `updateDibsStatus` (`src/db/dibsDb.ts:406-420`; its only caller was the expire route);
    - the `pool` import in `dibs.ts`;
    - the remaining-proposals count in reject.
    Grep for orphans after each delete.
