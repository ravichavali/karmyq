# Sprint 134 BUG-074: Match Cancel and Complete Status Guards — Design Spec

**Date**: 2026-10-29
**Status**: Approved (maintainer answered all five design questions on 2026-10-29)
**Version**: v11.104.0 → v11.105.0 (**provisional**: re-derive from `origin/master` at merge time)
**Sprint Branch**: `agent/claude/sprint-134-pr-bug-074-cancel-guard` (cut from `origin/master` `d8da50f0`)

---

## Overview

`DELETE /matches/:id` cancels a match whatever its status. Its first read does not select the status
(`services/request-service/src/routes/matches.ts:700-710`), its write is `UPDATE requests.matches SET status = 'cancelled'
WHERE id = $1` (`:732-737`), and it then sets the request to `open` (`:739-742`) and the linked offer to `active`
(`:745-750`) without checking either one's status. A participant can therefore:

- undo a **completed** exchange after its karma was awarded. The karma row stays, but the standing backfill no longer
  replays it, because replay reads only `status = 'completed'` matches
  (`services/reputation-service/src/services/standingBackfillService.ts:199`, `:611-612`). Rating the match then answers
  409 `MATCH_NOT_COMPLETED` (`services/reputation-service/src/routes/reputation.ts:363-364`), and the pair loses vouch
  eligibility, which reads `m.status = 'completed'` (`completedPairSql`,
  `services/auth-service/src/db/skillVisibility.ts:30-35`);
- cancel a **rejected** match and reopen an ask that another helper is matched on;
- reopen an ask the requester cancelled, and revive an offer the helper withdrew.

`PUT /matches/:id/complete` has the same flaw in the other direction. It returns early only for `completed` (`:606-612`)
and records the mark with `WHERE id = $1` (`:622-628`), so a proposed, rejected or cancelled match can be completed. If
one side cancels and the other then marks done, the cancelled match becomes completed, which a guard on cancel alone
cannot stop. Two simultaneous final marks both pass the early check, stamp `completed_at` twice and publish
`match_completed` twice, the double completion Sprint 126 meant to rule out.

The fix puts the guard **in the write**: each route changes the match only while it is `matched`, and refuses with a 409
carrying an ADR-074 string code otherwise. The cancel then updates the request and offer only while they are still in the
state this exchange put them in.

### Core Principle: The guard lives in the statement that writes

A status read before the transaction is advice; under READ COMMITTED it cannot see a completion that has not committed
yet. Only `UPDATE ... WHERE status = 'matched'`, which PostgreSQL re-checks against the row a concurrent writer
committed, decides.

---

## Decisions (maintainer, 2026-10-29)

| # | Question | Decision |
|---|---|---|
| 1 | Which statuses can be cancelled? | **`matched` only**, including a match one side has already marked done. Reject already covers `proposed` (decline and withdraw, `:435-529`). |
| 2 | What does the request become? | Change it only while it is still `matched` **and** no other match on it is `matched`: `completed` if another completed match remains, `open` otherwise. Never touch an `open`, `dibs_pending`, `completed` or `cancelled` request. Free the offer only while it is `matched`. |
| 3 | Refusal response | **409** `{ success: false, message, error: 'MATCH_NOT_CANCELLABLE' }` for proposed, completed, rejected and already-cancelled matches; no event. A non-participant still gets 404. |
| 4 | Existing bad data | Read-only counts authorized and run (below). Any repair is a separate, authorized demo operation with a dry run, not part of this PR. |
| 5 | Complete guard | **In this PR.** `WHERE id = $1 AND status = 'matched'`. Zero rows → re-read: `completed` → today's idempotent 200; anything else → 409 `MATCH_NOT_COMPLETABLE`. |

Defaults the maintainer did not object to: no ADR, no migration; request-service CONTEXT.md gains a `DELETE /matches/:id`
section, loses the stale "cancel still reads body.user_id" known issue, and gains a Recent Fixes entry; registry.json
entries for both routes; BUGS.md marks BUG-074 fixed; two guide corrections; an IDEAS entry for a UI cancel; tests first.

---

## Evidence

### Callers (verified with `git grep`)

- `cancelMatch` is defined in `apps/frontend/src/lib/api.ts:655-656` and `apps/mobile/services/api.ts:128-129`, and
  **nothing calls it**. No page, mobile screen, simulation step (`services/simulation-service/src/api-client.ts` has no
  `DELETE /matches`) or e2e helper sends `DELETE /matches/:id`. The only callers are
  `services/request-service/tests/regression/sprint-83-match-action-auth.test.ts:136-163`. The UI backs out through
  reject only (`CommitmentsTab.tsx:312`, `Feed/DecisionBand.tsx:54-56`, `MyRequestsTab.tsx:110`,
  `pages/requests/[id].tsx:130`; mobile `declineMatch`). **The cancel fix changes no screen.**
- `completeMatch` is offered only on `matched` matches: the decisions feed emits `mark_done` only when
  `m.status === 'matched'` (`services/request-service/src/routes/requests.ts:929-933`), `CommitmentsTab.tsx:240,262`, the
  simulation filters `getMatches({ status: 'matched' })`, and the mobile feed filters matched matches. A 409 from complete
  is reachable from the UI only in a race; `CommitmentsTab`'s catch shows `response.data.message`
  (`CommitmentsTab.tsx:252-253,273-274`), so the refusal message must read well on its own.

### The event

`match_cancelled` is in `UNCONSUMED_EVENTS` (`packages/shared/events/routes.ts:47`), so `publishEvent` never enqueues it
and nobody is notified (the template at `services/notification-service/src/templates/notificationTemplates.ts:90` is
never reached). Nothing reverses karma on a cancel. **No routing change in this PR.**

### Locking (default READ COMMITTED)

`withTransaction` issues a plain `BEGIN` (`services/request-service/src/database/db.ts:38-52`). Complete locks the match
row (its done_at `UPDATE`) and then the request row (`:642-645`). Accept and reject lock the request row first
(`:343-346`, `:475-478`). A cancel that copied accept's order (request, then match) could deadlock with a completion
(match, then request), so **cancel takes the match row first, then the request row**, the same order as complete.

### Demo data (maintainer-authorized read-only counts, 2026-10-29)

Run once on the demo database inside `BEGIN TRANSACTION READ ONLY ... ROLLBACK`:

| Count | Result | Reading |
|---|---|---|
| Requests with more than one `completed` match | **119** | Cause unconfirmed. |
| `cancelled` matches with `completed_at IS NOT NULL` (the completed-then-cancelled fingerprint) | **0** | **No surviving completed-then-cancelled fingerprint found; cause unconfirmed.** |
| Non-`completed` requests holding a `completed` match, by status | **52 `open`, 2 `matched`** | Cause unconfirmed. |

**What the counts do not show.** There is no status history, so the counts see only current state. The zero rules out
a match that is *still* cancelled after completing; it does not rule out a completed → cancelled → completed history
(BUG-074's complete route accepts a cancelled match, and its re-completion overwrites the fingerprint), nor a
rejected → cancelled transition. BUG-074's routes therefore stay **candidates** for the 119 and 54 rows, alongside
other request-status writers that lack a status guard: the reject reopen `WHERE id = $1 AND status != 'matched'`
(`matches.ts:514`) reopens a completed request; accept sets the request `matched` without checking it (`:361-366`);
admin propose-match has no request-status check (`services/request-service/src/routes/adminActions.ts`); dibs accept
never rejects sibling proposals (`services/request-service/src/routes/dibs.ts:323-338`); dibs decline and expire reopen
unconditionally (`dibs.ts:420,481`). That no current client calls `DELETE /matches/:id` is evidence about today's
code, not about history. Which writer produced the demo rows is **unconfirmed**. Logged as **BUG-075**
(`docs/BUGS.md`); its fix and any data repair are **out of scope here.**

The 2 `matched` requests above have exactly the shape decision 2's `completed` branch handles: an ask with a completed
exchange and a second helper still matched.

---

## Data Model

**No change.** `requests.matches.status` is `character varying(50)` with no CHECK constraint
(`infrastructure/postgres/init.sql`, `CREATE TABLE requests.matches`); `requests.help_requests.status` keeps
`chk_help_requests_status` (`open|dibs_pending|matched|completed|cancelled`); `requests.help_offers.status` is
`character varying(50)` default `'active'` (statuses written: `active`, `matched`, `withdrawn`). No triggers on any of the
three. No migration.

---

## API Endpoints

| Method | Path | Change | Auth | Body | Responses |
|---|---|---|---|---|---|
| DELETE | `/matches/:id` | Cancels only a `matched` match; request and offer end states per decision 2 | JWT; participant (requester or responder) | none | 200 `{ success: true, message: 'Match cancelled successfully' }`; **409** `{ success: false, message: 'Only an exchange in progress can be cancelled', error: 'MATCH_NOT_CANCELLABLE' }`; 404 not a participant or no such match |
| PUT | `/matches/:id/complete` | Records a mark only on a `matched` match; an already-completed match stays an idempotent 200 on both the fast path and the race path | JWT; participant | none (a legacy `user_id` is ignored) | 200 `{ fully_completed, waiting_for }` (unchanged); 200 `'Match already completed'` (unchanged); **409** `{ success: false, message: 'Only an exchange in progress can be marked done', error: 'MATCH_NOT_COMPLETABLE' }`; 404 |

### Cancel transaction (in this order)

1. `UPDATE requests.matches SET status = 'cancelled' WHERE id = $1 AND status = 'matched'`. `rowCount === 0` → return
   `false` → 409, no further statement, no event.
2. `SELECT id FROM requests.help_requests WHERE id = $1 FOR UPDATE` (byte-identical to the accept/reject lock literal).
3. ```sql
   UPDATE requests.help_requests r
   SET status = CASE
     WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'completed')
     THEN 'completed' ELSE 'open' END
   WHERE r.id = $1 AND r.status = 'matched'
     AND NOT EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'matched')
   ```
   Its own statement after the lock, so its snapshot sees any accept or completion on this request that committed
   before the lock was granted.
4. If the match has an offer: `UPDATE requests.help_offers SET status = 'active' WHERE id = $1 AND status = 'matched'`.
5. After commit: `publishEvent('match_cancelled', ...)` (unchanged payload).

### Complete transaction

The done_at `UPDATE` gains `AND status = 'matched'`. On `rowCount === 0` it re-reads
`SELECT status FROM requests.matches WHERE id = $1`: `'completed'` → the idempotent 200 (no stamp, no publish); anything
else → 409 `MATCH_NOT_COMPLETABLE`. The finalize statements and the post-commit publish are unchanged. The pre-read fast
path at `:606-612` stays.

---

## Frontend Changes

**None.** No client calls cancel; every client offers complete only on `matched`; the existing error handling shows the
409's `message`. `apps/mobile/app/requests/[id].tsx` checks the nonexistent statuses `accepted`/`in_progress`; that
stale mobile code is noted, not touched.

---

## User Guide & Doc Updates

- `docs/guides/match-lifecycle.md`, section **4. Completed**: add that a completed exchange is final and cannot be
  cancelled or reopened. The **Withdrawing Before Acceptance** section is already accurate (no cancel control exists).
- `docs/guides/managing-commitments-guide.md:67`: "cancel promptly so someone else can step in" describes a control that
  does not exist. Reword: tell the requester promptly in the inline conversation.
- Regenerate landing docs (`npm run generate-docs --workspace=apps/landing`); keep the diffs to the two tracked
  `apps/landing/src/data/docs/guides/{match-lifecycle,managing-commitments}.json` files; revert timestamp and HEAD-sha
  churn elsewhere.
- `docs/IDEAS.md`: a "back out of an in-progress exchange from the UI" entry (the route now refuses safely, but no
  control calls it; the guide reword is the interim answer; `match_cancelled` would also need a notification route).
- `services/request-service/CONTEXT.md`: Recent Changes entry; §3.3 gains `#### DELETE /matches/:id` and the 409 on
  `#### PUT /matches/:id/complete`; the stale **KNOWN ISSUE** in the Sprint 83 version log (cancel "still reads
  `body.user_id`") gets a resolved note (the route reads `req.user!.userId`, `matches.ts:697`); §10.4 Recent Fixes entry.
- `services/registry.json`: replace the bare `"/matches/:id/complete"` string with an object describing the guard, and
  add a `DELETE /matches/:id` object. Events unchanged (`match_cancelled` is already in `publishes`).
- `docs/BUGS.md`: BUG-074 → fixed (and correct its stale `:693-750` range to `:693-772`). BUG-075 stays open.
- **No ADR.** A guard on two existing routes; no event, queue, schema or contract shape change beyond a new 409 code.

---

## Out of Scope

- **BUG-075** (the other unguarded request-status writers and the 119 / 54 demo rows).
- Any demo data repair.
- A UI control for cancel; notification routing for `match_cancelled`.
- The stale mobile `accepted`/`in_progress` checks.

---

## Critical Implementation Notes

1. **The guard lives in the write.** Cancel's match `UPDATE` carries `AND status = 'matched'`; complete's done_at
   `UPDATE` carries `AND status = 'matched'`. A status check before the transaction may stay as a fast path but must
   never be the only guard: under READ COMMITTED a completion that has not committed is invisible to it.
2. **Lock order: match row first, then the request row.** In cancel, the guarded match `UPDATE` comes before
   `SELECT id FROM requests.help_requests WHERE id = $1 FOR UPDATE`. Complete already runs match then request
   (`matches.ts:622-645`). Do not copy accept/reject's request-first order into cancel: it would deadlock with complete.
3. **The reopen is its own statement, after the request lock**, and changes the request only when `r.status = 'matched'`
   and no other match on it is `'matched'`: `'completed'` when another completed match exists, else `'open'`. It never
   touches an `open`, `dibs_pending`, `completed` or `cancelled` request.
4. **Free the offer only while it is `matched`:** `WHERE id = $1 AND status = 'matched'`. A withdrawn offer stays withdrawn.
5. **Literal statuses only.** Never pass a status as a parameter compared with `requests.matches.status`; in test
   fixtures, cast any status parameter (`$n::varchar`). The route's parameters stay `[id]` / `[request_id]` / `[offer_id]`.
6. **Identity is `req.user!.userId` only** (ADR-064). No JWT `communities` claim read anywhere
   (`tests/regression/sprint-134-pr-k-claim-gate.test.ts` fails on one). Non-participants keep the 404 from
   `matchParticipantSql`.
7. **Complete stays idempotent for an already-completed match on both paths:** the pre-read fast path (`:606-612`) and
   the race path (guarded `UPDATE` hits 0 rows, re-read says `'completed'`). Neither stamps `completed_at` nor publishes
   `match_completed` again (Sprint 126 / ADR-096 reasoning in the comment at `:592-605`). Any other status → 409
   `MATCH_NOT_COMPLETABLE`.
8. **Refuse with `rowCount === 0`**, as reject does (`:488`). The existing `two-phase-completion.test.ts` mocks return the
   done_at `UPDATE` without `rowCount`, so `undefined` must pass through; every new refusal test sets `rowCount: 0`.
9. **`match_cancelled` publishes only after a successful commit** and stays in `UNCONSUMED_EVENTS`. No routing, registry
   event or queue change.
10. **Directed-surface gate** (`tests/regression/sprint-132-directed-audience-gate.test.ts`): write the new lock as the
    exact single-line literal `SELECT id FROM requests.help_requests WHERE id = $1 FOR UPDATE` so the existing allowlist
    hash `37124d9f…` covers it (matching is file + hash). The new reopen statement replaces the old cancel reopen, whose
    entry (`2fe695cd…`, label `SET status = 'open'`) then goes stale: **the gate fails on a stale entry as well as on an
    unlisted hit.** Replace that entry with the new statement's hash.
11. **The real-SQL test is CI-only on Windows** (no local Docker). Its race cases prove the wait with
    `pg_blocking_pids(<holder pid>)` over `pg_locks`, never a sleep, and release the holder client in `finally`.
12. **Fixture columns are checked against `infrastructure/postgres/init.sql`:** `help_offers` needs `community_id`,
    `offerer_id`, `title`, `description`, `category` (NOT NULL); `matches` needs `request_id`, `responder_id` (NOT NULL);
    `help_requests` as in `tests/integration/sprint-134-pr-b-viewer-partners.integration.test.ts:55-57`.
13. **Tests first:** request-service `tests/tdd/` (red), then the implementation; promote with
    `node scripts/promote-tdd-tests.js` (`.npmrc` sets `ignore-scripts`) and restore any unrelated file it sweeps.
14. **No migration, no dependency change.** The only lockfile edit is the root version: `package.json` and the two root
    `"version"` lines in `package-lock.json`, as in `d8da50f0`.
15. **Do not fix BUG-075 here,** even where a line sits next to the code being changed (the reject reopen at `:514`).
