# BUG-074 Match Cancel and Complete Status Guards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `DELETE /matches/:id` and `PUT /matches/:id/complete` change a match only while it is `matched`, refusing
everything else with a 409 and an ADR-074 string code, with the guard enforced inside the writing statement.

**Architecture:** Two existing request-service routes gain a status predicate on their match `UPDATE`; the cancel's
request and offer updates become conditional and take locks in the same order as complete (match row, then request row).
No schema, event, queue, dependency or client change.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*.

**Spec:** [`docs/superpowers/specs/2026-10-29-sprint-134-pr-bug-074-cancel-guard-design.md`](../specs/2026-10-29-sprint-134-pr-bug-074-cancel-guard-design.md)

**Branch:** `agent/claude/sprint-134-pr-bug-074-cancel-guard` (exists, pushed, cut from `origin/master` `d8da50f0`).
**Version:** 11.104.0 → 11.105.0, **provisional**: re-derive from `origin/master`'s `package.json` at merge time.
**Rules (maintainer):** no demo-host operation, merge or CodeQL dismissal without explicit per-operation authorization;
no dependency or lockfile change beyond the root version and the `decode-uri-component` override already on the branch;
push and leave the tree clean at every stopping point.
**Deadline:** this PR carries the fix for `decode-uri-component` GHSA-qr28-fpjm-wq7f (**high**), so it must be merged and
deployed by **2026-11-05** (spec, *Security Fix Carried by This PR*).

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `services/request-service/tests/tdd/sprint-134-bug-074-match-status-guards.test.ts` | Mocked SQL contract: the guards' exact SQL, statement order, parameters, refusal codes, no event on refusal. Promoted to `tests/regression/` in Task 7. |
| `tests/integration/sprint-134-bug-074-match-status-guards.integration.test.ts` | Real SQL over HTTP: the per-status matrix, request end states (including `open`, `dibs_pending`, `completed` and `cancelled` asks left as they are) and offer end states, complete refusals, and three race cases that separate a write guard from a pre-read check (cancel behind a completion, final mark behind a cancel, final mark behind a completion with a positive-control publication check). CI-only on Windows. |

### Already on the branch (do not redo)
| File | Change |
|------|--------|
| `package.json`, `package-lock.json` | `decode-uri-component` 0.5.1 override + one spliced lock node (`f6220d06`) |
| `tests/regression/sprint-131-d9-security-overrides.test.ts` | Exact-pin row for `decode-uri-component` 0.5.1 |
| `docs/BUGS.md`, `docs/IDEAS.md`, `apps/mobile/claude.md` | BUG-041 resolution, BUG-075/076/077, the mobile-sprint entry, the mobile warning |

### Existing files to modify
| File | Change |
|------|--------|
| `package.json`, `package-lock.json` | Root version 11.104.0 → 11.105.0 (package.json + the two root `"version"` lines in the lockfile only) |
| `services/request-service/src/routes/matches.ts` | Cancel guard + conditional request/offer updates (`:693-772`); complete guard + race re-read (`:614-668`) |
| `services/request-service/tests/regression/sprint-83-match-action-auth.test.ts` | Cancel 200 case mocks the new 5-statement sequence (`:150-163`) |
| `services/request-service/tests/helpers/directedSurfaceAllowlist.json` | Replace the stale old-cancel-reopen entry (`2fe695cd…`) with the new reopen statement's hash |
| `docs/guides/match-lifecycle.md`, `docs/guides/managing-commitments-guide.md` | Completed is final; no cancel control exists |
| `apps/landing/src/data/docs/guides/match-lifecycle.json`, `.../managing-commitments.json` | Regenerated (tracked; never hand-edited) |
| `docs/IDEAS.md` | "Back out of an in-progress exchange from the UI" entry |
| `services/request-service/CONTEXT.md` | Recent Changes; §3.3 DELETE section + complete 409; stale KNOWN ISSUE note; §10.4 Recent Fixes |
| `services/registry.json` | `DELETE /matches/:id` object; `/matches/:id/complete` string → object |
| `docs/BUGS.md` | BUG-074 → fixed (and its line range corrected); BUG-075 untouched |
| `.claude/handoff/CURRENT_HANDOFF.md` | Progress, PR number, human checks |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

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
14. **No migration. One dependency change, already on the branch:** the `decode-uri-component` 0.5.1 override
    (`f6220d06`; maintainer decision 2026-10-29 to fix GHSA-qr28-fpjm-wq7f in this PR). Add no other. The version bump
    edits only `package.json` and the two root `"version"` lines in `package-lock.json`, as in `d8da50f0`.
15. **Do not fix BUG-075 here,** even where a line sits next to the code being changed (the reject reopen at `:514`).

---

## Task 1: Branch check and provisional version bump

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Confirm the branch and base**

```bash
uname -s
git fetch origin
git switch agent/claude/sprint-134-pr-bug-074-cancel-guard
git status --short            # must be empty
git log --oneline -1 origin/master
git merge-base --is-ancestor d8da50f0 HEAD && echo "based on d8da50f0 or later"
git config core.hooksPath     # must print .husky
```

If `origin/master` has moved past `d8da50f0`, merge it in (merge commit, never rebase + force).

- [ ] **Bump the root version** (Edit tool, three lines: `package.json` `"version"`, and in `package-lock.json` the
  top-level `"version"` and `packages[""].version`). Nothing else in either file changes.

- [ ] **Verify**

```bash
git diff --stat               # exactly package.json (1 line) and package-lock.json (2 lines)
node -p "require('./package.json').version + ' ' + require('./package-lock.json').version + ' ' + require('./package-lock.json').packages[''].version"
# expect: 11.105.0 11.105.0 11.105.0
```

Commit: `chore: bump version to 11.105.0 (provisional, BUG-074)`.

---

## Task 2: Request-service TDD tests (red)

**Files:**
- Create: `services/request-service/tests/tdd/sprint-134-bug-074-match-status-guards.test.ts`

Per-status behavior lives in SQL, so a mock can only echo the WHERE clause back; the per-status proof is the real-SQL
test in Task 3. This file pins the SQL contract, statement order, parameters, the refusal codes, and (for complete) the
route's mapping of the re-read status, which is real route logic.

- [ ] **Write the test file**

```ts
/**
 * Sprint 134 BUG-074: cancel and complete change a match only while it is 'matched'.
 *
 * Mocked SQL contract: the exact guarded statements, their order (match row before request row, the same
 * order as complete), their parameters (no status is ever a parameter), the refusal codes, and that a
 * refusal writes and publishes nothing. The per-status matrix and the concurrency proof run against real
 * SQL in the root tests/integration/sprint-134-bug-074-match-status-guards.integration.test.ts.
 */

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  query: (...args: any[]) => mockQuery(...args),
  withTransaction: (fn: any) => fn((...args: any[]) => mockQuery(...args)),
}));

const mockPublishEvent = jest.fn();
jest.mock('../../src/events/publisher', () => ({ publishEvent: (...args: any[]) => mockPublishEvent(...args) }));

import express from 'express';
import request from 'supertest';

async function buildApp(userId: string) {
  const { default: matchesRouter } = await import('../../src/routes/matches');
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.user = { userId, email: 'u@test.com', communities: [] };
    next();
  });
  app.use('/matches', matchesRouter);
  return app;
}

const MATCH = {
  id: 'match-1',
  request_id: 'req-1',
  offer_id: 'offer-1',
  requester_id: 'requester-user',
  responder_id: 'helper-user',
  status: 'matched',
};

const sqlOf = (n: number) => String(mockQuery.mock.calls[n][0]).replace(/\s+/g, ' ').trim();
const paramsOf = (n: number) => mockQuery.mock.calls[n][1];

describe('BUG-074: DELETE /matches/:id cancels only an exchange in progress', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockPublishEvent.mockResolvedValue(undefined);
  });

  it('guards the match write, then locks the request, reopens it conditionally and frees only a matched offer', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [MATCH] })          // participant read
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })               // guarded UPDATE matches
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'req-1' }] }) // request row lock
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })               // conditional request update
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });              // conditional offer update

    const res = await request(await buildApp('helper-user')).delete('/matches/match-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Match cancelled successfully' });
    expect(mockQuery).toHaveBeenCalledTimes(5);
    expect(sqlOf(1)).toBe("UPDATE requests.matches SET status = 'cancelled' WHERE id = $1 AND status = 'matched'");
    expect(paramsOf(1)).toEqual(['match-1']);
    expect(sqlOf(2)).toBe('SELECT id FROM requests.help_requests WHERE id = $1 FOR UPDATE');
    expect(paramsOf(2)).toEqual(['req-1']);
    expect(sqlOf(3)).toContain(
      "SET status = CASE WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'completed') THEN 'completed' ELSE 'open' END");
    expect(sqlOf(3)).toContain(
      "WHERE r.id = $1 AND r.status = 'matched' AND NOT EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'matched')");
    expect(paramsOf(3)).toEqual(['req-1']);
    expect(sqlOf(4)).toBe("UPDATE requests.help_offers SET status = 'active' WHERE id = $1 AND status = 'matched'");
    expect(paramsOf(4)).toEqual(['offer-1']);
    expect(mockPublishEvent).toHaveBeenCalledTimes(1);
    expect(mockPublishEvent).toHaveBeenCalledWith('match_cancelled', { match_id: 'match-1', request_id: 'req-1', offer_id: 'offer-1' });
  });

  it('skips the offer statement when the match has no offer', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ ...MATCH, offer_id: null }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'req-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const res = await request(await buildApp('requester-user')).delete('/matches/match-1');

    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledTimes(4);
    // The participant read LEFT JOINs help_offers, so match the write, not the table name.
    expect(mockQuery.mock.calls.some((args: any[]) => /UPDATE requests\.help_offers/.test(String(args[0])))).toBe(false);
  });

  it('refuses with 409 MATCH_NOT_CANCELLABLE when the guarded write changes no row: no further statement, no event', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [MATCH] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(await buildApp('helper-user')).delete('/matches/match-1');

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      message: 'Only an exchange in progress can be cancelled',
      error: 'MATCH_NOT_CANCELLABLE',
    });
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('answers a non-participant with 404 and writes nothing', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(await buildApp('stranger-user')).delete('/matches/match-1');

    expect(res.status).toBe(404);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });
});

describe('BUG-074: PUT /matches/:id/complete records a mark only on an exchange in progress', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockPublishEvent.mockResolvedValue(undefined);
  });

  it('guards the done_at write with the match status', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [MATCH] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ requester_done_at: new Date(), responder_done_at: null }] });

    const res = await request(await buildApp('requester-user')).put('/matches/match-1/complete').send({});

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ fully_completed: false, waiting_for: 'helper' });
    expect(sqlOf(1)).toBe(
      "UPDATE requests.matches SET requester_done_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'matched' RETURNING requester_done_at, responder_done_at");
    expect(paramsOf(1)).toEqual(['match-1']);
  });

  it('answers a mark that lost the race to a completion with the idempotent 200: no stamp, no event', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [MATCH] })            // pre-read still saw 'matched'
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })                 // guarded UPDATE: the row is completed now
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ status: 'completed' }] }); // re-read

    const res = await request(await buildApp('helper-user')).put('/matches/match-1/complete').send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { fully_completed: true, waiting_for: null },
      message: 'Match already completed',
    });
    expect(mockQuery).toHaveBeenCalledTimes(3);
    expect(sqlOf(2)).toBe('SELECT status FROM requests.matches WHERE id = $1');
    expect(paramsOf(2)).toEqual(['match-1']);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it.each(['proposed', 'rejected', 'cancelled'])(
    'refuses a mark on a %s match with 409 MATCH_NOT_COMPLETABLE: no finalize, no event',
    async (status) => {
      mockQuery
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ ...MATCH, status }] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ status }] });

      const res = await request(await buildApp('requester-user')).put('/matches/match-1/complete').send({});

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        success: false,
        message: 'Only an exchange in progress can be marked done',
        error: 'MATCH_NOT_COMPLETABLE',
      });
      expect(mockQuery).toHaveBeenCalledTimes(3);
      expect(mockQuery.mock.calls.some((args: any[]) => /status = 'completed'/.test(String(args[0])))).toBe(false);
      expect(mockPublishEvent).not.toHaveBeenCalled();
    });
});
```

- [ ] **Run it and confirm it is red for the right reasons**

```bash
npm exec --workspace=services/request-service -- jest --runTestsByPath tests/tdd/sprint-134-bug-074-match-status-guards.test.ts
```

Expected failures: the cancel SQL lacks the guard (and the old code's 4-statement sequence), the refusal answers 200, and
the complete SQL lacks `AND status = 'matched'`. The 404 case passes already (it guards nothing new). Record the
red output in the PR body. (Planning dry run on `9af57d4b`: **8 failed, 1 passed**, the 404 case.)

Commit: `test(requests): BUG-074 match status guard contract (tdd, red)`.

---

## Task 3: Root real-SQL integration test (CI-only on Windows)

**Files:**
- Create: `tests/integration/sprint-134-bug-074-match-status-guards.integration.test.ts`

Template: `tests/integration/sprint-134-pr-b-viewer-partners.integration.test.ts`. The integration config runs files
serially (`maxWorkers: 1`) with `testTimeout: 30000` (`tests/jest.integration.config.js:50-51`), so a 10-second lock
poll fits.

- [ ] **Write the test file**

```ts
/**
 * Sprint 134 BUG-074: DELETE /matches/:id cancels only an exchange in progress, and PUT /matches/:id/complete
 * records a mark only on one. Real JWT, request service over HTTP, real PostgreSQL. Missing infrastructure is
 * a failure, never a skip.
 *
 * Proofs: (1) the cancel matrix: only 'matched' cancels, every other status is a 409 that writes nothing;
 * (2) the ask and offer end states after a cancel, including asks that are not 'matched' (left as they are);
 * (3) the complete refusals; (4) the guard is in the write: while a second client holds an uncommitted
 * completion (or cancel) on the row, the HTTP call waits on the row lock and, after the commit, is refused
 * or (for a completion behind a completion) answered with the idempotent 200 without re-stamping or
 * re-publishing. A check made only before the transaction reads the old committed 'matched' row and then
 * overwrites the commit, so all three race cases fail against it.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { createPool, ServiceUrls } from '../fixtures';

describe('Sprint 134 BUG-074 match status guards', () => {
  const pool = createPool();
  // R requester; H helper; H2 second helper; X same-community member with no part in any match.
  const R = randomUUID(), H = randomUUID(), H2 = randomUUID(), X = randomUUID();
  const users = [R, H, H2, X];
  const Cm = randomUUID();
  const asks: string[] = [];
  const offers: string[] = [];

  const bearer = (id: string) => `Bearer ${jwt.sign({ userId: id, email: `${id}@karmyq.test`, communities: [] }, process.env.JWT_SECRET || 'dev-secret-key')}`;
  // `.then` starts the request, so a race case can hold it in flight.
  const cancel = (as: string, matchId: string) => request(ServiceUrls.REQUEST).delete(`/matches/${matchId}`)
    .set('Authorization', bearer(as)).then((res) => res);
  const complete = (as: string, matchId: string) => request(ServiceUrls.REQUEST).put(`/matches/${matchId}/complete`)
    .set('Authorization', bearer(as)).send({}).then((res) => res);

  // One ask per case, so no case reads another's rows. Status parameters are INSERT values cast to varchar;
  // nothing here compares a parameter with requests.matches.status.
  async function ask(status: string): Promise<string> {
    const id = randomUUID();
    await pool.query(`INSERT INTO requests.help_requests
      (id,requester_id,title,description,category,request_type,visibility_scope,status)
      VALUES ($1,$2,'BUG-074 ask','Fixture','generic','generic','community',$3::varchar)`, [id, R, status]);
    await pool.query('INSERT INTO requests.request_communities(request_id,community_id) VALUES ($1,$2)', [id, Cm]);
    asks.push(id);
    return id;
  }
  async function offer(status: string): Promise<string> {
    const id = randomUUID();
    await pool.query(`INSERT INTO requests.help_offers (id,community_id,offerer_id,title,description,category,status)
      VALUES ($1,$2,$3,'BUG-074 offer','Fixture','generic',$4::varchar)`, [id, Cm, H, status]);
    offers.push(id);
    return id;
  }
  async function match(requestId: string, responder: string, status: string,
    opts: { offerId?: string; requesterDone?: boolean } = {}): Promise<string> {
    const { rows } = await pool.query(`INSERT INTO requests.matches (request_id,responder_id,offer_id,status,requester_done_at)
      VALUES ($1,$2,$3,$4::varchar,CASE WHEN $5::boolean THEN CURRENT_TIMESTAMP END) RETURNING id`,
      [requestId, responder, opts.offerId ?? null, status, opts.requesterDone ?? false]);
    return rows[0].id;
  }
  const matchRow = async (id: string) => (await pool.query('SELECT * FROM requests.matches WHERE id = $1', [id])).rows[0];
  const askStatus = async (id: string) => (await pool.query('SELECT status FROM requests.help_requests WHERE id = $1', [id])).rows[0].status;
  const offerStatus = async (id: string) => (await pool.query('SELECT status FROM requests.help_offers WHERE id = $1', [id])).rows[0].status;

  // Holds `holderSql` on the match row in an open transaction, starts `call`, proves the call is waiting on that
  // row lock (pg_blocking_pids, not a sleep), then commits and returns the call's response.
  async function whileHeld(holderSql: string, matchId: string, call: () => Promise<request.Response>) {
    const holder = await pool.connect();
    try {
      await holder.query('BEGIN');
      const { pid } = (await holder.query('SELECT pg_backend_pid() AS pid')).rows[0];
      await holder.query(holderSql, [matchId]);
      const pending = call();
      let waiting = false;
      for (const deadline = Date.now() + 10_000; !waiting && Date.now() < deadline;) {
        const blocked = await pool.query(
          'SELECT 1 FROM pg_locks l WHERE NOT l.granted AND $1::int = ANY(pg_blocking_pids(l.pid))', [pid]);
        waiting = (blocked.rowCount ?? 0) > 0;
        if (!waiting) await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(waiting).toBe(true);
      await holder.query('COMMIT');
      return await pending;
    } catch (err) {
      await holder.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      holder.release();
    }
  }

  beforeAll(async () => {
    await pool.query('SELECT 1');
    expect((await request(ServiceUrls.REQUEST).get('/health')).status).toBe(200);
    for (const id of users) {
      await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)',
        [id, `BUG-074 ${id.slice(0, 8)}`, `${id}@karmyq.test`, 'not-a-login']);
    }
    await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4)',
      [Cm, `BUG-074 ${Cm}`, 'Fixture', R]);
    for (const id of users) {
      await pool.query("INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'member','active')", [id, Cm]);
    }
  });

  afterAll(async () => {
    try {
      // A completion exists here only if a guard failed; clearing its effects lets a red run still clean up.
      await pool.query('DELETE FROM requests.feed_events WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM notifications.notifications WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM reputation.karma_records WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM reputation.trust_scores WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM social_graph.trust_edges WHERE user_id_a = ANY($1::uuid[]) OR user_id_b = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM requests.matches WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM requests.help_offers WHERE id = ANY($1::uuid[])', [offers]);
      await pool.query('DELETE FROM requests.request_communities WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM requests.help_requests WHERE id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM communities.members WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM communities.communities WHERE id = $1', [Cm]);
      await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [users]);
    } finally { await pool.end(); }
  });

  describe('cancel matrix', () => {
    it('cancels an exchange in progress: match cancelled, ask reopened, offer freed', async () => {
      const q = await ask('matched');
      const o = await offer('matched');
      const m = await match(q, H, 'matched', { offerId: o });
      const res = await cancel(H, m);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, message: 'Match cancelled successfully' });
      expect((await matchRow(m)).status).toBe('cancelled');
      expect(await askStatus(q)).toBe('open');
      expect(await offerStatus(o)).toBe('active');
    });

    it.each(['proposed', 'completed', 'rejected', 'cancelled'])(
      'refuses a %s match with 409 MATCH_NOT_CANCELLABLE and writes nothing', async (status) => {
        // A second helper is matched, so an unguarded cancel's reopen would show on the ask.
        const q = await ask('matched');
        await match(q, H2, 'matched');
        const o = await offer('matched');
        const m = await match(q, H, status, { offerId: o });
        const res = await cancel(R, m);
        expect(res.status).toBe(409);
        expect(res.body).toEqual({
          success: false, message: 'Only an exchange in progress can be cancelled', error: 'MATCH_NOT_CANCELLABLE',
        });
        expect((await matchRow(m)).status).toBe(status);
        expect(await askStatus(q)).toBe('matched');
        expect(await offerStatus(o)).toBe('matched');
      });

    it('answers a member who is not a participant with 404 and writes nothing', async () => {
      const q = await ask('matched');
      const m = await match(q, H, 'matched');
      expect((await cancel(X, m)).status).toBe(404);
      expect((await matchRow(m)).status).toBe('matched');
      expect(await askStatus(q)).toBe('matched');
    });
  });

  describe('the ask and offer after a cancel', () => {
    it('keeps the ask matched while another helper is still matched', async () => {
      const q = await ask('matched');
      await match(q, H2, 'matched');
      const m = await match(q, H, 'matched');
      expect((await cancel(R, m)).status).toBe(200);
      expect(await askStatus(q)).toBe('matched');
    });

    it('closes the ask as completed when a completed exchange remains', async () => {
      const q = await ask('matched');
      await match(q, H2, 'completed');
      const m = await match(q, H, 'matched');
      expect((await cancel(R, m)).status).toBe(200);
      expect(await askStatus(q)).toBe('completed');
    });

    // Only a 'matched' ask changes. 'open' is a preservation check that cannot fail against the old code
    // (which also writes 'open'); the other three each fail against it.
    it.each(['open', 'dibs_pending', 'completed', 'cancelled'])(
      'leaves a %s ask as it is when its matched exchange is cancelled', async (status) => {
        const q = await ask(status);
        const m = await match(q, H, 'matched');
        expect((await cancel(H, m)).status).toBe(200);
        expect((await matchRow(m)).status).toBe('cancelled');
        expect(await askStatus(q)).toBe(status);
      });

    it('leaves a withdrawn offer withdrawn', async () => {
      const q = await ask('matched');
      const o = await offer('withdrawn');
      const m = await match(q, H, 'matched', { offerId: o });
      expect((await cancel(H, m)).status).toBe(200);
      expect(await offerStatus(o)).toBe('withdrawn');
      expect(await askStatus(q)).toBe('open');
    });
  });

  describe('complete', () => {
    it.each(['proposed', 'rejected', 'cancelled'])(
      'refuses a mark on a %s match with 409 MATCH_NOT_COMPLETABLE and stamps nothing', async (status) => {
        const q = await ask('open');
        const m = await match(q, H, status);
        const res = await complete(R, m);
        expect(res.status).toBe(409);
        expect(res.body).toEqual({
          success: false, message: 'Only an exchange in progress can be marked done', error: 'MATCH_NOT_COMPLETABLE',
        });
        const after = await matchRow(m);
        expect(after.status).toBe(status);
        expect(after.requester_done_at).toBeNull();
      });

    it('still records a first mark on an exchange in progress', async () => {
      const q = await ask('matched');
      const m = await match(q, H, 'matched');
      const res = await complete(R, m);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ fully_completed: false, waiting_for: 'helper' });
      const after = await matchRow(m);
      expect(after.status).toBe('matched');
      expect(after.requester_done_at).not.toBeNull();
    });

    it('keeps the idempotent 200 for an already-completed match and stamps nothing', async () => {
      const q = await ask('completed');
      const m = await match(q, H, 'completed');
      const res = await complete(R, m);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ fully_completed: true, waiting_for: null });
      expect((await matchRow(m)).requester_done_at).toBeNull();
    });
  });

  describe('the guard is in the write, not in the read before it', () => {
    it('refuses a cancel that waited on a concurrent completion; the completion stands', async () => {
      const q = await ask('matched');
      const m = await match(q, H, 'matched', { requesterDone: true });
      const res = await whileHeld(
        "UPDATE requests.matches SET status = 'completed', responder_done_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP WHERE id = $1",
        m, () => cancel(R, m));
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('MATCH_NOT_CANCELLABLE');
      expect((await matchRow(m)).status).toBe('completed');
      expect(await askStatus(q)).toBe('matched');
    });

    it('refuses a final mark that waited on a concurrent cancel; nothing is completed', async () => {
      const q = await ask('matched');
      const m = await match(q, H, 'matched', { requesterDone: true });
      const res = await whileHeld("UPDATE requests.matches SET status = 'cancelled' WHERE id = $1", m, () => complete(H, m));
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('MATCH_NOT_COMPLETABLE');
      const after = await matchRow(m);
      expect(after.status).toBe('cancelled');
      expect(after.responder_done_at).toBeNull();
      expect(after.completed_at).toBeNull();
      expect(await askStatus(q)).toBe('matched');
    });

    it('answers a final mark that waited on a concurrent completion with the idempotent 200: no re-stamp, no second publication', async () => {
      const q = await ask('matched');
      const m = await match(q, H, 'matched', { requesterDone: true });
      const before = (await pool.query('SELECT requester_done_at::text AS r FROM requests.matches WHERE id = $1', [m])).rows[0].r;
      // The holder completes the match with fixed literal times (the column is `timestamp without time zone`)
      // and publishes nothing, so any match_completed effect for `m` below can only come from the HTTP call.
      const res = await whileHeld(
        "UPDATE requests.matches SET status = 'completed', responder_done_at = TIMESTAMP '2026-10-01 10:00:00', completed_at = TIMESTAMP '2026-10-01 10:00:00' WHERE id = $1",
        m, () => complete(H, m));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true, data: { fully_completed: true, waiting_for: null }, message: 'Match already completed',
      });
      const after = (await pool.query(`SELECT status, requester_done_at::text AS r,
          responder_done_at = TIMESTAMP '2026-10-01 10:00:00' AS done_kept,
          completed_at = TIMESTAMP '2026-10-01 10:00:00' AS completed_kept
        FROM requests.matches WHERE id = $1`, [m])).rows[0];
      expect(after).toEqual({ status: 'completed', r: before, done_kept: true, completed_kept: true });

      // Positive control: a genuine two-party completion published AFTER the race on the same transport.
      // Once its effects land, a publication by the race call (enqueued earlier) would have landed too.
      const cq = await ask('matched');
      const cm = await match(cq, H2, 'matched');
      expect((await complete(H2, cm)).status).toBe(200);
      expect((await complete(R, cm)).body.data.fully_completed).toBe(true);
      const count = async (sql: string, id: string) => Number((await pool.query(sql, [id])).rows[0].count);
      const effectsOf = async (matchId: string, askId: string) => ({
        karma: await count('SELECT COUNT(*) FROM reputation.karma_records WHERE related_entity_id = $1', matchId),
        notified: await count("SELECT COUNT(*) FROM notifications.notifications WHERE type = 'match_completed' AND data->>'match_id' = $1", matchId),
        feed: await count("SELECT COUNT(*) FROM requests.feed_events WHERE request_id = $1 AND event_type = 'match_completed'", askId),
      });
      let control = await effectsOf(cm, cq);
      for (let retry = 0; retry < 40 && !(control.karma > 0 && control.notified > 0 && control.feed > 0); retry++) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        control = await effectsOf(cm, cq);
      }
      expect(control.karma).toBeGreaterThan(0);
      expect(control.notified).toBeGreaterThan(0);
      expect(control.feed).toBeGreaterThan(0);
      expect(await effectsOf(m, q)).toEqual({ karma: 0, notified: 0, feed: 0 });
    });
  });
});
```

The control bound is an ordering argument, not a sleep. The route issues its own `feed_events` insert
(fire-and-forget, `matches.ts:661-667`) before it responds, so a race publication's insert is queued before the
control even starts. Karma and notifications arrive through `karmyq-completion-dispatch`; the bound assumes each consumer
takes an earlier job no later than a later one (Bull FIFO per queue). If the executor finds a consumer with concurrency
above 1 there, record in the handoff that the bound is exact for `feed_events` and approximate for karma and
notifications. If the control's effects never land, the test fails loudly; it cannot pass vacuously.

- [ ] **Type-check it locally** (it cannot run on Windows: no local Docker; CI's `test-integration` job runs it)

```bash
npx tsc --noEmit -p tests/tsconfig.json > "$SCRATCH/tests-tsc.log" 2>&1; echo "tsc exit=$?"
grep -n "sprint-134-bug-074" "$SCRATCH/tests-tsc.log"; echo "grep exit=$? (1 = no errors in this file)"
```

`tests/tsconfig.json` includes `**/*.ts` with `types: ["jest","node"]`. If `tsc` reports errors only in other files,
note them in the handoff (pre-existing) and do not fix them here.

- [ ] **Cleanup after the control completion:** `afterAll` deletes karma, trust scores, trust edges, notifications and
  feed events for the fixture users before the users and community go. If CI reports a foreign-key failure in
  `afterAll`, add that table's delete (Sprint 132's cleanup in
  `tests/integration/sprint-132-directed-audience.integration.test.ts` is the reference); never weaken an assertion.

- [ ] **State the red evidence by reasoning, in the PR body:** against the current code every refusal case answers 200;
  the reopen and offer cases show `open` / `active`; the `dibs_pending`, `completed` and `cancelled` preservation cases
  show `open` (the `open` case passes on both, by design); the cancel race returns 200 and leaves the match
  `cancelled`; the cancel-then-complete race returns 200, completes the match and publishes `match_completed`; the
  completion-behind-a-completion race returns "Match completed successfully" instead of the idempotent body, re-stamps
  `responder_done_at` and `completed_at`, and publishes a second `match_completed` (all cleaned up by `afterAll`).

Commit: `test(integration): BUG-074 real-SQL status matrix and race proofs`.

---

## Task 4: Cancel guard

**Files:**
- Modify: `services/request-service/src/routes/matches.ts` (`DELETE /:id`, `:729-763`)

- [ ] **Replace the transaction and the event/response block** (the participant read at `:699-727` is unchanged)

```ts
    // BUG-074: cancel only an exchange in progress. The guard is in the UPDATE, not in the read above: a
    // completion committing in between is invisible to that read, and the UPDATE re-checks its WHERE on
    // the row the completion committed. Lock order is match row, then request row, the same as complete,
    // so a cancel and a completion cannot deadlock. The request changes only while it is still 'matched'
    // and no other helper is matched on it; one that still holds a completed exchange becomes 'completed'.
    const cancelled = await withTransaction(async (q) => {
      const result = await q(
        `UPDATE requests.matches
         SET status = 'cancelled'
         WHERE id = $1 AND status = 'matched'`,
        [id]
      );
      if (result.rowCount === 0) {
        return false;
      }

      await q(
        `SELECT id FROM requests.help_requests WHERE id = $1 FOR UPDATE`,
        [match.request_id]
      );

      await q(
        `UPDATE requests.help_requests r
         SET status = CASE
           WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'completed')
           THEN 'completed' ELSE 'open' END
         WHERE r.id = $1 AND r.status = 'matched'
           AND NOT EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'matched')`,
        [match.request_id]
      );

      // Free the offer only while this exchange still holds it; a withdrawn offer stays withdrawn.
      if (match.offer_id) {
        await q(
          `UPDATE requests.help_offers SET status = 'active' WHERE id = $1 AND status = 'matched'`,
          [match.offer_id]
        );
      }
      return true;
    });

    if (!cancelled) {
      return res.status(409).json({
        success: false,
        message: 'Only an exchange in progress can be cancelled',
        error: 'MATCH_NOT_CANCELLABLE',
      });
    }

    // Publish event (after commit, only for a cancel that happened)
    await publishEvent('match_cancelled', {
      match_id: id,
      request_id: match.request_id,
      offer_id: match.offer_id,
    });
```

The lock literal must stay on one line exactly as written (Critical Note 10).

- [ ] **Verify the cancel half of the tdd file is green**

```bash
npm exec --workspace=services/request-service -- jest --runTestsByPath tests/tdd/sprint-134-bug-074-match-status-guards.test.ts -t "DELETE"
```

Commit: `fix(requests): cancel only an exchange in progress (BUG-074)`.

---

## Task 5: Complete guard

**Files:**
- Modify: `services/request-service/src/routes/matches.ts` (`PUT /:id/complete`, `:606-681`)

- [ ] **Hoist the idempotent body into one constant** near the top of the module (after the router is created), and
  use it in the fast path at `:606-612`:

```ts
// Sprint 126: re-completing a completed match is idempotent. Both the pre-read fast path and the race path
// (the guarded UPDATE finds the row already completed) answer with this body.
const ALREADY_COMPLETED = {
  success: true,
  data: { fully_completed: true, waiting_for: null },
  message: 'Match already completed',
} as const;
```

```ts
    if (match.status === 'completed') {
      return res.json(ALREADY_COMPLETED);
    }
```

- [ ] **Guard the done_at write and map the outcome** (replace `const bothDone = await withTransaction(...)` through the
  closing `});` of the transaction, then derive `bothDone`; the publish/feed/response code after it is unchanged)

```ts
    // BUG-074: record a mark only while the match is 'matched'. The guard is in the UPDATE, not the read above:
    // a cancel or a second final mark committing in between is invisible to that read, and the UPDATE re-checks
    // its WHERE on the committed row. A row that turns out already completed keeps the idempotent answer.
    const outcome = await withTransaction(async (q) => {
      // Use a RETURNING clause to get both done_at values in a single statement so we
      // can check if both parties have now confirmed.
      const updateResult = await q(
        `UPDATE requests.matches
         SET ${doneAtColumn} = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = 'matched'
         RETURNING requester_done_at, responder_done_at`,
        [id]
      );
      if (updateResult.rowCount === 0) {
        const current = await q(`SELECT status FROM requests.matches WHERE id = $1`, [id]);
        return current.rows[0]?.status === 'completed' ? 'already_completed' as const : 'not_completable' as const;
      }

      const updated = updateResult.rows[0];
      const finished = updated.requester_done_at !== null && updated.responder_done_at !== null;

      if (finished) {
        // Both parties have confirmed — finalize the match
        await q(
          `UPDATE requests.matches
           SET status = 'completed', completed_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [id]
        );

        await q(
          `UPDATE requests.help_requests SET status = 'completed' WHERE id = $1`,
          [match.request_id]
        );
      }
      return finished ? 'completed' as const : 'recorded' as const;
    });

    if (outcome === 'already_completed') {
      return res.json(ALREADY_COMPLETED);
    }
    if (outcome === 'not_completable') {
      return res.status(409).json({
        success: false,
        message: 'Only an exchange in progress can be marked done',
        error: 'MATCH_NOT_COMPLETABLE',
      });
    }
    const bothDone = outcome === 'completed';
```

The finalize statements keep their exact text, so the allowlisted `b8396be5…` hash (`SET status = 'completed'`) still
matches.

- [ ] **Verify the whole tdd file is green**

```bash
npm exec --workspace=services/request-service -- jest --runTestsByPath tests/tdd/sprint-134-bug-074-match-status-guards.test.ts
npx tsc --noEmit -p services/request-service
```

Commit: `fix(requests): record a completion mark only on an exchange in progress (BUG-074)`.

---

## Task 6: Existing tests and the directed-surface allowlist

**Files:**
- Modify: `services/request-service/tests/regression/sprint-83-match-action-auth.test.ts`
- Modify: `services/request-service/tests/helpers/directedSurfaceAllowlist.json`

- [ ] **Sprint 83 cancel 200 case** (`:150-163`): mock the new five-statement sequence with accurate comments
  (participant read; guarded `UPDATE` matches `rowCount: 1`; request lock; conditional request update; conditional offer
  update). The 403 case is unchanged.

- [ ] **Run the match regressions; `two-phase-completion.test.ts` must pass unchanged** (its done_at mocks carry no
  `rowCount`, Critical Note 8)

```bash
npm exec --workspace=services/request-service -- jest --runTestsByPath tests/regression/sprint-83-match-action-auth.test.ts tests/regression/two-phase-completion.test.ts
```

- [ ] **Re-pin the allowlist.** Run the gate; expect exactly one unguarded hit (the new reopen) and one stale entry
  (`2fe695cd…`):

```bash
npm exec --workspace=services/request-service -- jest --runTestsByPath tests/regression/sprint-132-directed-audience-gate.test.ts
npx tsx -e "import { scanServices, surfaceHash, unguarded } from './services/request-service/tests/helpers/directedSurfaceScan'; for (const h of unguarded(scanServices(process.cwd()))) console.log(h.file + ':' + h.line, surfaceHash(h.sql));"
```

(The `tsx -e` command was proven on `d8da50f0` during planning: 100 hits, 0 unguarded, and it located the old reopen
at `matches.ts:740`. In the planning dry run with Tasks 4–5's code applied verbatim, it printed exactly one hit,
`matches.ts:771 e267659f5d6769363b4408cd9198eaa01fa276a8e43f8c2f3091355e46f066aa`. The hash changes with any whitespace
change to the statement, so use the hash you print, and treat a different value as a sign the statement text drifted.) In `directedSurfaceAllowlist.json`, replace the entry whose hash is
`2fe695cddf7b01971550505684f8ec77cf8dec8f7048e45e5bc4d054275fa12a` with:

```json
 {
  "file": "services/request-service/src/routes/matches.ts",
  "hash": "<the printed hash>",
  "reason": "Mutation after audience and participant validation.",
  "label": "SET status = CASE"
 }
```

The reject reopen's `e8fc886f…` entry also carries the label `SET status = 'open'`; match by hash, not label.
The new lock literal needs no entry (`37124d9f…` already covers it). If the scan reports the lock as unguarded, its
text drifted from the single-line literal: fix the code, not the allowlist.

- [ ] **Verify**

```bash
npm exec --workspace=services/request-service -- jest --runTestsByPath tests/regression/sprint-132-directed-audience-gate.test.ts
# The claim gate lives in the root tests workspace, not request-service (the combined command ENOENTs):
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-134-pr-k-claim-gate.test.ts
```

(Planning-review check, 2026-10-29: the claim-gate command passes 17/17 on `9af57d4b`.)

Commit: `test(requests): align match regressions and re-pin the directed-surface allowlist (BUG-074)`.

---

## Task 7: Promote the tdd tests

- [ ] **Promote**

```bash
node scripts/promote-tdd-tests.js
git status --short
```

The promoter moves **every** green tdd file repo-wide. Keep only
`services/request-service/tests/tdd/sprint-134-bug-074-match-status-guards.test.ts` →
`tests/regression/`; restore every other moved file (`git restore --staged --worktree <path>` for each, and delete
any untracked copy it created).

- [ ] **Verify**

```bash
npm test --workspace=services/request-service
```

Commit: `test(requests): promote the BUG-074 guard contract to regression`.

---

## Task 8: User guides, landing docs and the IDEAS entry

**Files:**
- Modify: `docs/guides/match-lifecycle.md`, `docs/guides/managing-commitments-guide.md`, `docs/IDEAS.md`
- Regenerated: `apps/landing/src/data/docs/guides/match-lifecycle.json`, `.../managing-commitments.json`

- [ ] **`match-lifecycle.md`, section "4. Completed"**: after the bullet list, add one sentence: a completed exchange is
  final; it cannot be cancelled, reopened or marked done again.
- [ ] **`managing-commitments-guide.md:67`**: replace "cancel promptly so someone else can step in" with: tell the
  requester promptly in the inline conversation so they can find someone else (no cancel control exists). Keep
  "Reliability is your most visible reputation signal."
- [ ] **`docs/IDEAS.md`**: append `## [YYYY-MM-DD] Back out of an in-progress exchange from the UI (BUG-074 follow-up)`:
  `DELETE /matches/:id` now refuses everything but `matched`, but no client calls it (`cancelMatch` in
  `apps/frontend/src/lib/api.ts:655` and `apps/mobile/services/api.ts:128` is unused); the guide tells helpers to use the
  conversation. A control would also need `match_cancelled` routed to notification-service (it is in
  `UNCONSUMED_EVENTS`, `packages/shared/events/routes.ts:47`, and its template at
  `services/notification-service/src/templates/notificationTemplates.ts:90` is unreachable).
- [ ] **Regenerate and keep only the two guide JSONs**

```bash
npm run generate-docs --workspace=apps/landing
git status --short apps/landing/src/data/docs/
```

Keep `guides/match-lifecycle.json` and `guides/managing-commitments.json`; revert timestamp / HEAD-sha / CRLF churn in
every other file (`git checkout -- <path>`). Stage with `git add -f` (the directory is gitignored but tracked).

- [ ] **Verify the license gate and doc drift gate**

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/doc-context-drift-gate.test.ts
```

Commit: `docs(guides): a completed exchange is final; no cancel control (BUG-074)`.

---

## Task 9: CONTEXT.md, registry.json and BUGS.md

**Files:**
- Modify: `services/request-service/CONTEXT.md`, `services/registry.json`, `docs/BUGS.md`

- [ ] **CONTEXT.md, Recent Changes** (top of the list): a dated "Sprint 134 BUG-074" entry: both routes change a match
  only while it is `matched`; 409 `MATCH_NOT_CANCELLABLE` / `MATCH_NOT_COMPLETABLE`; guard in the write; match-then-
  request lock order; the conditional request and offer updates; complete's race path keeps the idempotent 200; tests
  (promoted regression file + root integration file, CI-only on Windows). No migration, event or dependency change.
- [ ] **CONTEXT.md §3.3**: add `#### DELETE /matches/:id` after `#### PUT /matches/:id/complete` (auth, the 200/409/404
  responses, the request/offer end states, `match_cancelled` is published but unconsumed, implementation path); in the
  complete section add the 409 and that a mark is recorded only on a `matched` match. Fix its stale request example:
  the body is ignored (identity comes from the JWT, ADR-064).
- [ ] **CONTEXT.md, Sprint 83 version log**: under the "KNOWN ISSUE: `DELETE /matches/:id` (cancel) still reads
  `body.user_id`" bullet, add "**Resolved:** the route reads `req.user!.userId` (`src/routes/matches.ts`); confirmed
  during BUG-074 planning, 2026-10-29." Do not rewrite the historical entry.
- [ ] **CONTEXT.md §10.4 Recent Fixes**: a "Sprint 134 BUG-074" block at the top, with the harm (completed exchange
  undone, rejected match reopening a matched ask, withdrawn offer revived, cancelled match completed, double finalize).
- [ ] **registry.json**: replace the bare string `"/matches/:id/complete"` with an object
  (`method: PUT`, path, a description naming the `matched` guard, the idempotent 200 and 409 `MATCH_NOT_COMPLETABLE`),
  and add `{ "method": "DELETE", "path": "/matches/:id", "description": ... }` (participant only, `matched` only,
  409 `MATCH_NOT_CANCELLABLE`, conditional request/offer end states, publishes unconsumed `match_cancelled`). Events
  unchanged.
- [ ] **BUGS.md**: BUG-074 heading → `· fixed (Sprint 134 BUG-074 PR, v11.105.0)`; correct `matches.ts:693-750` to
  `:693-772`; append a "**Fix:**" paragraph (both guards, the conditional updates, the race tests, and the demo counts
  with their limit: no surviving completed-then-cancelled fingerprint found; cause unconfirmed; the non-zero rows are
  tracked under BUG-075). Do not touch BUG-075.
- [ ] **Verify**

```bash
node -e "JSON.parse(require('fs').readFileSync('services/registry.json','utf8')); console.log('registry ok')"
npm test --workspace=tests
npm run feedback:check
```

`feedback:check` reads `git diff --cached` only (memory: false-green on a committed branch); run it with the changes
staged, before committing.

Commit: `docs(requests): BUG-074 CONTEXT, registry and bug log`.

---

## Task 10: SDLC quality gates

- [ ] **`/simplify`** on the branch diff (one pass; small diff). Resolve or dismiss each finding in writing.
- [ ] **`/code-review` at medium** on the branch diff (small, well-specified PR). Correctness findings are resolved
  before the PR opens; re-run the request-service and `tests` workspace suites after any fix.
- [ ] **`/security-review`** on the branch diff. Expected focus: authorization unchanged (participant check, JWT
  identity), no new SQL interpolation (only the existing `${doneAtColumn}`, a two-value constant), no information leak
  in the 409 (it reveals only that a match the caller participates in is not in progress).
- [ ] **Verification line for each gate** recorded in the handoff and the PR body (finding count, resolution).

---

## Task 11: Final verification

- [ ] **Type checks and suites**

```bash
npx tsc --noEmit -p services/request-service
npm test > "$SCRATCH/bug074-test.log" 2>&1; echo "npm test exit=$?"   # $SCRATCH = your session scratchpad
npm test --workspace=tests; echo "tests exit=$?"
git status --short
```

Capture exit codes separately (`| tail` masks them). If a Turbo run fails, read the failing suite name from the raw
log; a lone timeout in an unrelated workspace is the known parallel flake: re-run that package alone.

- [ ] **Landing churn**: `npm test` regenerates `apps/landing/src/data/docs/`; revert every change there except the two
  guide JSONs committed in Task 8.
- [ ] **Re-derive the version** against `origin/master` (`git fetch origin && git show origin/master:package.json |
  node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).version))"`). If master moved past 11.104.0, merge
  `origin/master` (merge commit) and re-bump.

---

## Task 12: Handoff, push, PR, stop

- [ ] **Update `.claude/handoff/CURRENT_HANDOFF.md`** (BUG-074 state block: commits, gate results, PR number once
  open, the human checks below). Commit and push.
- [ ] **Push and open the PR** with the repository PR template (`pr-contract.yml` checks the contract headers). Body:
  the red evidence (Task 2 output, Task 3 reasoning), the demo counts, BUG-075 named as out of scope, the gates, the
  carried security fix (`f6220d06`: GHSA-qr28-fpjm-wq7f, its proof, and the accepted mobile cost; due 2026-11-05), and
  the human checks:
  1. On demo after deploy, as a participant: `DELETE /api/matches/<completed match id>` (nginx maps `/api/matches` to
     request-service `/matches`, `infrastructure/nginx/nginx.conf:184-187`) answers 409 `MATCH_NOT_CANCELLABLE` and the
     match stays completed.
  2. A normal two-party mark-done on demo still completes and awards karma.
- [ ] **Stop.** No CI watch, merge request or post-merge work in this chat: merging, demo operations and CodeQL
  dismissals each need the maintainer's explicit authorization. After the merge, the post-merge record (CI/CD run,
  deploy health, CodeQL on the merge sha) goes on the next branch.
