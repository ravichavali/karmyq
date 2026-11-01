# Sprint 135 Request Status Guards (BUG-075 + BUG-078) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** every request-status write in request-service is guarded, and a request's status is derived from its matches and
dibs by one helper. A completed or cancelled ask can then no longer be reopened, re-matched or overwritten.

**Architecture:** A new module, `services/request-service/src/db/requestStatus.ts`, is the only code that writes
`requests.help_requests.status`: a locked read, a derived-status reconcile, the requester's guarded cancel, and a shared
"close the proposals" step. The ten writers guard their own rows and call it. A regression gate fails on any request-status
write elsewhere.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*.

**Spec:** [`docs/superpowers/specs/2026-11-01-sprint-135-request-status-guards-design.md`](../specs/2026-11-01-sprint-135-request-status-guards-design.md)

**Branch:** `agent/claude/sprint-135-pr-request-status-guards`. **Cut it fresh from `origin/master` after the planning +
security PR merges.** That PR, branch `agent/claude/sprint-135-planning` (v11.107.0), carries:
- this spec, plan and handoff;
- the #325 post-merge record, BUG-082 and the Sprint 134 archive;
- the follow-redirects 1.16.2 fix.
**Version:** 11.107.0 → 11.108.0, **provisional**: re-derive from `origin/master`'s `package.json` at merge time.
**Rules (maintainer):**
- No demo-host operation, merge or CodeQL dismissal without explicit per-operation authorization.
- No dependency or lockfile change beyond the root version.
- Push, and leave the tree clean, at every stopping point.
- Stop at PR creation.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `services/request-service/src/db/requestStatus.ts` | `lockRequest`, `reconcileRequestStatus`, `markRequestCancelled`, `closeProposals`: the only request-status writers |
| `services/request-service/tests/tdd/sprint-135-request-status-helper.test.ts` | Mocked SQL contract for the four helpers (exact SQL, order, params, return values) |
| `services/request-service/tests/tdd/sprint-135-request-status-gate.test.ts` | The gate: every request-status write or dynamic `SET` on `help_requests` across `services/*/src` is one of six reviewed statements; negative fixtures prove it can fail |
| `services/request-service/tests/tdd/sprint-135-request-status-writers.test.ts` | Mocked SQL contract for the ten writers: lock before the first write, refusals decided before any write, guarded own-row writes, reconcile last, no request-status write of their own |
| `tests/integration/sprint-135-request-status-guards.integration.test.ts` | Real SQL over HTTP: each writer's refusals and derived end states, plus four races proving the guard is under the lock. CI-only on Windows |
| `services/cleanup-service/tests/tdd/sprint-135-expire-dibs-guard.test.ts` | The dibs expiry job overwrites only a still-pending dibs; on a miss it skips the request write and the event |

### Existing files to modify
| File | Change |
|------|--------|
| `package.json`, `package-lock.json` | Root version 11.107.0 → 11.108.0 (three lines) |
| `services/request-service/src/routes/matches.ts` | Accept, reject, complete, cancel use the helpers |
| `services/request-service/src/routes/adminActions.ts` | Propose-match: lock, `open` only, duplicate check + insert in the transaction |
| `services/request-service/src/routes/dibs.ts` | Create, accept, decline, expire use the helpers; drop the `pool` import and `updateDibsStatus` |
| `services/request-service/src/db/dibsDb.ts` | Delete `updateDibsStatus` (no caller left) |
| `services/request-service/src/db/offersDb.ts` | `acceptOffer`: one transaction, lock, `open` only, guarded offer write |
| `services/request-service/src/routes/requesterOffers.ts` | Map `'REQUEST_NOT_OPEN'` to 409 |
| `services/request-service/src/routes/requests.ts` | `PUT /:id` refuses `status` (400, after the ownership lookup); `DELETE /:id` guarded cancel that also expires a pending dibs |
| `services/cleanup-service/src/jobs/expireDibs.ts` | The dibs `UPDATE` gains `AND status = 'pending'`; a miss rolls back and skips the rest |
| `services/request-service/tests/helpers/directedSurfaceAllowlist.json` | Remove the stale entries; add the four `requestStatus.ts` statements |
| `services/request-service/tests/regression/sprint-134-bug-074-match-status-guards.test.ts`, `sprint-92-matching.test.ts`, `sprint-132-body-identity.test.ts`, `two-phase-completion.test.ts`, and any other file the suite names | Mock sequences follow the new statements; no assertion weakened |
| `tests/integration/sprint-134-bug-074-match-status-guards.integration.test.ts` | The `dibs_pending` and `completed` "left as it is" fixtures gain their backing rows; dibs teardown |
| `docs/guides/match-lifecycle.md`, `dibs-request.md`, `making-requests-guide.md`, `admin-community-guide.md` | Spec *User Guide & Doc Updates* |
| `apps/landing/src/data/docs/guides/*.json` (those four) | Regenerated (tracked; never hand-edited) |
| `services/request-service/CONTEXT.md`, `services/registry.json`, `docs/BUGS.md` | Endpoint docs, the status rule, `request_completed` out of `publishes`, BUG-075/078 fixed |
| `services/cleanup-service/CONTEXT.md` | Recent Changes + the *Expire Dibs* job row: the dibs write is guarded |
| `services/dependency-graph.md`, `services/impact-analysis.md` | Regenerated by `npm run analyze:services` (never hand-edited) |
| `.claude/handoff/CURRENT_HANDOFF.md` | Progress, PR number |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **The guard lives in the write, or under the request lock.** Match, dibs and provider-offer changes carry their
   status in the `WHERE` (`AND status = 'proposed'`, `'matched'`, `'pending'`). Request preconditions are read with
   `lockRequest` inside the transaction. A status read before the transaction may stay as a fast path, but it is never
   the guard.
2. **Preconditions read the DERIVED status.** `lockRequest` takes the row lock (`SELECT id … FOR UPDATE`), then derives
   the status from the request's matches and dibs in its own statement. It returns what `reconcileRequestStatus` would
   write, so an old row whose stored status disagrees with its rows is judged by its rows.
3. **Only `src/db/requestStatus.ts` writes a request status.** `reconcileRequestStatus` and `markRequestCancelled` are
   its two writers. The gate (`sprint-135-request-status-gate.test.ts`) allows exactly these, plus cleanup's
   `expireDibs.ts`, and three reviewed dynamic `SET` builders (`memoryRetentionJob.ts`, `PUT /requests/:id`,
   `PUT /requests/:id/privacy`). It also fails if a reviewed builder's source pushes a `status =` assignment.
4. **Reconcile = lock, then a fresh `UPDATE`,** called after the writer's own row changes, as the transaction's last
   request write. It never derives `cancelled` away. It writes `status` only (as the match routes do today): no
   `updated_at`, so the memory-retention window, which reads `updated_at`, does not move. The lock is one module
   constant used by both helpers, so it is one allowlisted literal.
5. **Lock order** (the spec's *Locking* table): request-first writers touch only `proposed` matches, and match-first
   writers only `matched` ones. The dibs writers take the dibs row before the request:
   - dibs accept: `SELECT status, expires_at > clock_timestamp() AS live FROM requests.dibs WHERE id = $1 FOR UPDATE`;
   - decline and expire: the guarded dibs `UPDATE`;
   - the requester cancel: `SELECT id FROM requests.dibs WHERE request_id = $1 AND status = 'pending' FOR UPDATE`.
   Never lock the request and then an existing dibs row.
6. **Decide before the first write.** `withTransaction` commits whatever ran when the callback returns. A refusal must be
   returned before the transaction's first write. So dibs accept reads the dibs row's status and liveness under its
   lock, checks the request, and only then runs its guarded `UPDATE`. The requester cancel refuses on the derived
   status before `markRequestCancelled`, `closeProposals` and the dibs expiry.
7. **Expiry uses the wall clock.** Dibs accept judges liveness with `clock_timestamp()`, not `NOW()` (the transaction
   start), because it may have waited on locks. An invitation that expired meanwhile answers 410 `DIBS_EXPIRED`.
8. **Free an offer only while it is `matched`:** `closeProposals` and reject use `AND status = 'matched'`. A withdrawn
   offer stays withdrawn.
9. **Literal statuses only.** Never pass a status as a parameter compared with `requests.matches.status`; test fixtures
   cast (`$n::varchar`).
10. **Response contract.** The new codes are `REQUEST_NOT_OPEN`, `REQUEST_NOT_CANCELLABLE`,
    `REQUEST_HAS_ACTIVE_EXCHANGE` (409) and `STATUS_NOT_EDITABLE` (400). The existing `ALREADY_MATCHED`,
    `MATCH_NOT_PROPOSED`, `INVALID_STATE`, `DIBS_EXPIRED`, `NOT_FOUND` and their messages stay as they are. Every
    message reads well alone. `STATUS_NOT_EDITABLE` comes after the ownership lookup, so a foreign id answers 404 like
    an absent one.
11. **Ownership stays in the write.** `markRequestCancelled(q, requestId, requesterId)` binds `r.requester_id = $2`, as
    today's cancel `UPDATE` does.
12. **Directed-surface gate** (`sprint-132-directed-audience-gate.test.ts`). It fails on an unlisted `help_requests`
    literal **and** on a stale allowlist entry.
    - Stale after this sprint: the `matches.ts` entries `37124d9f…` (lock, two entries), `1aaaaca2…`
      (`SET status = 'matched'`), `e8fc886f…` (reopen), `b8396be5…` (finalize) and `e267659f…` (cancel `CASE`); the
      `offersDb.ts` entry `d5225b81…`; and the `requests.ts` entry `9dde4b05…` for the request cancel's `UPDATE`.
    - New: the four `help_requests` statements in `requestStatus.ts` (the lock, which keeps hash `37124d9f…`; the
      derive `SELECT`; the reconcile `UPDATE`; the cancel `UPDATE`).
    - The gate prints file:line; compute each hash with `surfaceHash` and never hand-type one.
    - The dibs paths' old `notDirectedSql` filter is not lost. A dibs row exists only for a non-directed request: the
      only creator is behind `notDirectedSql` (`dibs.ts:139`), and nothing writes `is_directed` after creation.
13. **Event.** `PUT /requests/:id` no longer publishes `request_completed`; remove it from request-service `publishes` in
    `services/registry.json`. Do not touch `packages/shared`. The requester cancel publishes no `match_rejected`
    (unconsumed, `packages/shared/events/routes.ts:48`) and no `dibs_expired`.
14. **cleanup-service's `expireDibs.ts`** gains `AND status = 'pending'` on its dibs `UPDATE`. When that misses (the
    provider accepted or declined first), it rolls back and skips the request write and the event.
15. **BUG-074's real-SQL file** (`tests/integration/sprint-134-bug-074-match-status-guards.integration.test.ts:183-190`):
    the `dibs_pending` and `completed` cases of "leaves a %s ask as it is" gain their backing rows: a pending dibs and a
    completed match by H2. The assertion `askStatus(q) === status` stays.
16. **Identity is `req.user!.userId` only** (ADR-064). No JWT `communities` claim is read
    (`tests/regression/sprint-134-pr-k-claim-gate.test.ts`).
17. **The real-SQL test is CI-only on Windows.** Its races prove the wait with `pg_blocking_pids` over `pg_locks`, never
    a sleep. Each HTTP completion waits for its `karmyq-completion-reputation` job before teardown, so no karma row lands
    after the community is gone. It does not call the test-only expire route.
18. **Tests first** in each changed workspace's `tests/tdd/` (request-service, cleanup-service), red, then the
    implementation. Promote with `node scripts/promote-tdd-tests.js` and restore any unrelated file it sweeps.
19. **No migration, no dependency change.** The version bump edits only `package.json` and the two root `"version"`
    lines in `package-lock.json`.
20. **Delete what becomes dead:**
    - `updateDibsStatus` (`src/db/dibsDb.ts:406-420`; its only caller was the expire route);
    - the `pool` import in `dibs.ts`;
    - the remaining-proposals count in reject.
    Grep for orphans after each delete.

---

## Task 1: Branch check and provisional version bump

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Confirm the branch and base**

```bash
uname -s                       # MINGW64_NT-* = the Windows box
git fetch origin
git status --short             # must be empty
# The planning + security PR must be merged: the plan is on origin/master and the version is 11.107.0 (or later).
MSYS_NO_PATHCONV=1 git cat-file -e origin/master:docs/superpowers/plans/2026-11-01-sprint-135-request-status-guards.md && echo "planning PR merged"
MSYS_NO_PATHCONV=1 git show origin/master:package.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log('master version', JSON.parse(s).version))"
git switch -c agent/claude/sprint-135-pr-request-status-guards origin/master   # or `git switch` it, if a previous session cut it
git config core.hooksPath      # must print .husky
node scripts/gotcha-check.js --for services/request-service/src/db/requestStatus.ts services/request-service/src/routes/matches.ts services/request-service/src/routes/dibs.ts services/request-service/src/routes/adminActions.ts services/request-service/src/routes/requests.ts services/request-service/src/db/offersDb.ts services/request-service/tests/tdd/x.test.ts tests/integration/x.integration.test.ts docs/guides/x.md
```

If the planning PR has not merged, stop: this plan builds on it. Read every gotcha the check names. The code this plan
cites is unchanged since `965cdf2d`; that PR changed only the lockfile and docs.

- [ ] **Bump the root version.** Use the Edit tool on three lines: `package.json` `"version"`, and in
  `package-lock.json` the top-level `"version"` and `packages[""].version`. Nothing else in either file changes.

- [ ] **Verify**

```bash
git diff --stat               # exactly package.json (1 line) and package-lock.json (2 lines)
node -p "require('./package.json').version + ' ' + require('./package-lock.json').version + ' ' + require('./package-lock.json').packages[''].version"
# expect: 11.108.0 11.108.0 11.108.0
```

Commit: `chore: bump version to 11.108.0 (provisional, Sprint 135)`.

---

## Task 2: Helper and gate tests (red)

**Files:**
- Create: `services/request-service/tests/tdd/sprint-135-request-status-helper.test.ts`
- Create: `services/request-service/tests/tdd/sprint-135-request-status-gate.test.ts`

- [ ] **Write the helper contract** (`sprint-135-request-status-helper.test.ts`):

```ts
/**
 * Sprint 135 (BUG-075, BUG-078): src/db/requestStatus.ts is the only module that writes a request's status.
 *
 * Mocked SQL contract for its four helpers: the exact statements, their order and parameters (no status is ever a
 * parameter), and what each returns. Their behaviour against real rows, including the races, runs in the root
 * tests/integration/sprint-135-request-status-guards.integration.test.ts.
 */
import { closeProposals, lockRequest, markRequestCancelled, reconcileRequestStatus } from '../../src/db/requestStatus';

const flat = (sql: string) => sql.replace(/\s+/g, ' ').trim();
const q = jest.fn();
const sqlOf = (n: number) => flat(String(q.mock.calls[n][0]));
const paramsOf = (n: number) => q.mock.calls[n][1];

const LOCK = 'SELECT id FROM requests.help_requests WHERE id = $1 FOR UPDATE';
const DERIVE =
  "SELECT CASE WHEN r.status = 'cancelled' THEN 'cancelled' " +
  "WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'matched') THEN 'matched' " +
  "WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'completed') THEN 'completed' " +
  "WHEN EXISTS (SELECT 1 FROM requests.dibs d WHERE d.request_id = r.id AND d.status = 'pending') THEN 'dibs_pending' " +
  "ELSE 'open' END AS status FROM requests.help_requests r WHERE r.id = $1";
const RECONCILE =
  'UPDATE requests.help_requests r SET status = CASE ' +
  "WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'matched') THEN 'matched' " +
  "WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'completed') THEN 'completed' " +
  "WHEN EXISTS (SELECT 1 FROM requests.dibs d WHERE d.request_id = r.id AND d.status = 'pending') THEN 'dibs_pending' " +
  "ELSE 'open' END WHERE r.id = $1 AND r.status <> 'cancelled'";
const CANCEL =
  "UPDATE requests.help_requests r SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP " +
  "WHERE r.id = $1 AND r.requester_id = $2 AND r.status <> 'cancelled' " +
  "AND NOT EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status IN ('matched', 'completed'))";

beforeEach(() => q.mockReset());

describe('lockRequest', () => {
  it('locks the row, then returns the DERIVED status from its own statement', async () => {
    q.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'req-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ status: 'completed' }] });
    await expect(lockRequest(q, 'req-1')).resolves.toBe('completed');
    expect(q).toHaveBeenCalledTimes(2);
    expect(sqlOf(0)).toBe(LOCK);
    expect(paramsOf(0)).toEqual(['req-1']);
    expect(sqlOf(1)).toBe(DERIVE);
    expect(paramsOf(1)).toEqual(['req-1']);
  });

  it('returns null when there is no such request', async () => {
    q.mockResolvedValue({ rowCount: 0, rows: [] });
    await expect(lockRequest(q, 'missing')).resolves.toBeNull();
  });

  it('derives with the same three EXISTS branches, in the same order, as the reconcile write', () => {
    const branches = (sql: string) => sql.match(/WHEN EXISTS \([^)]*\) THEN '\w+'/g);
    expect(branches(DERIVE)).toEqual(branches(RECONCILE));
  });
});

describe('reconcileRequestStatus', () => {
  it('takes the lock, then derives the status in its own statement, leaving a cancelled request alone', async () => {
    q.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'req-1' }] }).mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await reconcileRequestStatus(q, 'req-1');
    expect(q).toHaveBeenCalledTimes(2);
    expect(sqlOf(0)).toBe(LOCK);
    expect(paramsOf(0)).toEqual(['req-1']);
    expect(sqlOf(1)).toBe(RECONCILE);
    expect(paramsOf(1)).toEqual(['req-1']);
  });

  it('writes status only, so updated_at (the memory-retention clock) does not move', async () => {
    q.mockResolvedValue({ rowCount: 1, rows: [] });
    await reconcileRequestStatus(q, 'req-1');
    expect(sqlOf(1)).not.toContain('updated_at');
  });
});

describe('markRequestCancelled', () => {
  it("cancels only the caller's request, not already cancelled, with no exchange in progress or completed", async () => {
    q.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await expect(markRequestCancelled(q, 'req-1', 'requester-1')).resolves.toBe(true);
    expect(q).toHaveBeenCalledTimes(1);
    expect(sqlOf(0)).toBe(CANCEL);
    expect(paramsOf(0)).toEqual(['req-1', 'requester-1']);
  });

  it('reports a guard miss', async () => {
    q.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    await expect(markRequestCancelled(q, 'req-1', 'requester-1')).resolves.toBe(false);
  });
});

describe('closeProposals', () => {
  it('frees only offers a proposal still holds, then rejects the proposals, in that order', async () => {
    q.mockResolvedValue({ rowCount: 1, rows: [] });
    await closeProposals(q, 'req-1');
    expect(q).toHaveBeenCalledTimes(2);
    expect(sqlOf(0)).toBe(
      "UPDATE requests.help_offers SET status = 'active', updated_at = CURRENT_TIMESTAMP " +
      "WHERE status = 'matched' AND id IN ( SELECT offer_id FROM requests.matches " +
      "WHERE request_id = $1 AND status = 'proposed' AND offer_id IS NOT NULL )");
    expect(paramsOf(0)).toEqual(['req-1']);
    expect(sqlOf(1)).toBe(
      "UPDATE requests.matches SET status = 'rejected', updated_at = CURRENT_TIMESTAMP " +
      "WHERE request_id = $1 AND status = 'proposed'");
    expect(paramsOf(1)).toEqual(['req-1']);
  });
});
```

- [ ] **Write the gate** (`sprint-135-request-status-gate.test.ts`). The parser was dry-run on 2026-11-01 against the
  live tree (14 statements: the 11 status writes and 3 dynamic `SET`s listed in the spec) and against every fixture
  below.

```ts
/**
 * Sprint 135 (BUG-075, BUG-078): a request's status is written in exactly the reviewed places.
 *
 * Scans every SQL literal that names help_requests across services/<service>/src, using the directed-surface scanner
 * over the untruncated tree. It finds each UPDATE of help_requests whose SET clause assigns status, or is built at run
 * time (a dynamic SET could carry status). Every such statement must match exactly one reviewed entry, and every entry
 * must match exactly one statement. A status write anywhere else fails here: route it through
 * src/db/requestStatus.ts.
 */
import fs from 'fs';
import path from 'path';
import { scanFile, scanServices, Surface } from '../helpers/directedSurfaceScan';

type Kind = 'status' | 'dynamic';
type Write = { file: string; line: number; kind: Kind; sql: string };

const flat = (sql: string) => sql.replace(/\s+/g, ' ');
const UPDATE_SET = /\bUPDATE\s+(?:requests\.)?help_requests\b(?:\s+(?:AS\s+)?\w+)?\s+SET\b/gi;

/** Each SET clause of an UPDATE of help_requests in `sql`. */
function setClauses(sql: string): string[] {
  return [...sql.matchAll(UPDATE_SET)].map((m) => {
    let rest = sql.slice((m.index ?? 0) + m[0].length);
    // Empty every parenthesized group, innermost first, so a subquery's own WHERE, FROM or status can neither end the
    // SET clause early nor fake a status assignment.
    for (let prev = ''; prev !== rest;) {
      prev = rest;
      rest = rest.replace(/\([^()]*\)/g, '()');
    }
    return rest.split(/\b(?:WHERE|RETURNING|FROM)\b/i)[0];
  });
}

/** UPDATEs of help_requests whose SET assigns status ('status') or is built at run time ('dynamic'). */
function statusWrites(hits: Surface[]): Write[] {
  return hits.flatMap((hit) => {
    const sql = flat(hit.sql);
    return setClauses(sql).flatMap((set): Write[] => {
      if (/\$\{/.test(set)) return [{ file: hit.file, line: hit.line, kind: 'dynamic', sql }];
      if (/(?:^|[\s,])status\s*=/i.test(set)) return [{ file: hit.file, line: hit.line, kind: 'status', sql }];
      return [];
    });
  });
}

/** The reviewed writers. `label` is a substring of the statement, distinct within its file and kind. */
const REVIEWED: Array<{ file: string; kind: Kind; label: string; why: string }> = [
  { file: 'services/request-service/src/db/requestStatus.ts', kind: 'status', label: 'SET status = CASE',
    why: 'reconcileRequestStatus: the derived status, under the request lock' },
  { file: 'services/request-service/src/db/requestStatus.ts', kind: 'status', label: "SET status = 'cancelled'",
    why: "markRequestCancelled: the requester's decision, guarded in the write" },
  { file: 'services/cleanup-service/src/jobs/expireDibs.ts', kind: 'status', label: "AND status = 'dibs_pending'",
    why: 'an expired dibs reopens only a request still dibs_pending' },
  { file: 'services/cleanup-service/src/jobs/memoryRetentionJob.ts', kind: 'dynamic', label: 'content_forgotten_at = NOW()',
    why: 'interpolates a constant sentinel into content columns; no status' },
  { file: 'services/request-service/src/routes/requests.ts', kind: 'dynamic', label: 'RETURNING *',
    why: 'PUT /requests/:id: title, description, urgency; a body status is refused with 400 STATUS_NOT_EDITABLE' },
  { file: 'services/request-service/src/routes/requests.ts', kind: 'dynamic', label: 'RETURNING id, is_pu',
    why: 'PUT /requests/:id/privacy: privacy fields only' },
];

const reviewedFor = (w: Write) => REVIEWED.filter((r) => r.file === w.file && r.kind === w.kind && w.sql.includes(r.label));
const unreviewed = (writes: Write[]) => writes.filter((w) => reviewedFor(w).length !== 1).map((w) => `${w.file}:${w.line} ${w.kind}`);

describe('Sprint 135: request-status writes', () => {
  const live = statusWrites(scanServices(path.resolve(__dirname, '../../../..')));

  it('every request-status write in services/*/src is a reviewed one', () => {
    expect(unreviewed(live)).toEqual([]);
  });

  it('every reviewed writer exists exactly once (identity, not a count)', () => {
    expect(REVIEWED.map((r) => live.filter((w) => w.file === r.file && w.kind === r.kind && w.sql.includes(r.label)).length))
      .toEqual(REVIEWED.map(() => 1));
  });

  describe('negative fixtures: the scan can fail', () => {
    const kinds = (source: string) => statusWrites(scanFile('services/example/src/x.ts', source)).map((w) => w.kind);

    it('flags a literal status write, with or without an alias, on one line or many', () => {
      expect(kinds("q(`UPDATE requests.help_requests SET status = 'open' WHERE id = $1`)")).toEqual(['status']);
      expect(kinds("q(`UPDATE requests.help_requests r\n  SET urgency = 'low',\n      status = 'matched'\n  WHERE r.id = $1`)"))
        .toEqual(['status']);
      expect(kinds("q('UPDATE help_requests SET status=$2 WHERE id=$1')")).toEqual(['status']);
    });

    it('a subquery neither hides a later status assignment nor ends the scan of a literal', () => {
      expect(kinds("q(`UPDATE requests.help_requests SET title = (SELECT x FROM y), status = 'open' WHERE id = $1`)"))
        .toEqual(['status']);
      expect(kinds("q(`WITH a AS (UPDATE requests.help_requests SET title = $2 WHERE id = $1 RETURNING id) UPDATE requests.help_requests SET status = 'open' WHERE id = $1`)"))
        .toEqual(['status']);
    });

    it('flags a SET built at run time', () => {
      expect(kinds('q(`UPDATE requests.help_requests SET ${sets.join(", ")} WHERE id = $1`)')).toEqual(['dynamic']);
    });

    it('does not flag other columns, a status in the WHERE, or a status inside a subquery', () => {
      expect(kinds("q(`UPDATE requests.help_requests r SET urgency = $1 WHERE id = $2 AND ${notDirectedSql('r')}`)")).toEqual([]);
      expect(kinds("q(`UPDATE requests.help_requests SET expired = TRUE WHERE status = 'open'`)")).toEqual([]);
      expect(kinds("q(`UPDATE requests.help_requests SET title = (SELECT m.status FROM requests.matches m WHERE m.status = 'x') WHERE id = $1`)"))
        .toEqual([]);
    });

    it('fails the live tree when a route writes a status itself (the pre-Sprint-135 finalize)', () => {
      const injected = statusWrites(scanFile('services/request-service/src/routes/matches.ts',
        "await q(`UPDATE requests.help_requests SET status = 'completed' WHERE id = $1`, [requestId]);"));
      expect(unreviewed([...live, ...injected])).toEqual(['services/request-service/src/routes/matches.ts:1 status']);
    });

    it('fails when the reviewed module gains a second, unreviewed status write', () => {
      const injected = statusWrites(scanFile('services/request-service/src/db/requestStatus.ts',
        "await q(`UPDATE requests.help_requests SET status = 'open' WHERE id = $1`, [id]);"));
      expect(unreviewed([...live, ...injected])).toEqual(['services/request-service/src/db/requestStatus.ts:1 status']);
    });
  });

  // A dynamic SET's columns live in its builder, not in the SQL literal, so the scan above cannot see a status pushed
  // into one. This catches the shape PUT /requests/:id used before Sprint 135; a builder that assigns its list some
  // other way is out of its reach, which is why the route test also pins the 400.
  const statusPushes = (source: string) => [...source.matchAll(/\.push\(\s*[`'"]\s*status\s*=/g)].length;

  it("no reviewed dynamic builder's source pushes a status assignment into its SET list", () => {
    const repo = path.resolve(__dirname, '../../../..');
    const builders = [...new Set(REVIEWED.filter((r) => r.kind === 'dynamic').map((r) => r.file))];
    expect(builders.map((file) => [file, statusPushes(fs.readFileSync(path.join(repo, file), 'utf8'))]))
      .toEqual(builders.map((file) => [file, 0]));
  });

  it("negative fixture: the pre-Sprint-135 PUT builder's status push is caught", () => {
    expect(statusPushes('if (status !== undefined) {\n  updates.push(`status = $${paramCount++}`);\n}')).toBe(1);
    expect(statusPushes("sets.push('status = $2')")).toBe(1);
    expect(statusPushes('updates.push(`title = $${paramCount++}`);')).toBe(0);
  });
});
```

- [ ] **Run both red** (capture each run to a file; `--no-cache`, so a warm ts-jest cache cannot hide a compile error)

```bash
cd services/request-service
npx jest tests/tdd/sprint-135-request-status-helper.test.ts --no-cache > /tmp/s135-t2-helper.txt 2>&1; echo "exit=$?"
npx jest tests/tdd/sprint-135-request-status-gate.test.ts --no-cache > /tmp/s135-t2-gate.txt 2>&1; echo "exit=$?"
```

Expected:
- Helper: the suite fails to run, `Cannot find module '../../src/db/requestStatus'`.
- Gate: these **fail**:
  - "every request-status write…" lists exactly 10 unreviewed statements: `offersDb.ts:61`,
    `dibs.ts:236/337/420/481`, `matches.ts:370/522/651/772` and `requests.ts:2081`;
  - "exists exactly once" (the two `requestStatus.ts` counts are 0);
  - "fails the live tree…" (the real list is longer than the injected one);
  - "no reviewed dynamic builder…" (`requests.ts` still has PUT's status push: count 1).
- Gate: every other fixture passes.
- If a fixture fails, the parser was mistyped; fix the test, not the expectation.

Commit: `test(requests): Sprint 135 status helper contract and request-status gate (red)`.

---

## Task 3: Writer contract tests (red)

**Files:**
- Create: `services/request-service/tests/tdd/sprint-135-request-status-writers.test.ts`

- [ ] **Write the writer contract.** It uses a SQL-routing mock: each test names the replies it needs, and every other
  statement answers `{ rowCount: 1, rows: [] }` (a write that hit one row, a read that found nothing).

```ts
/**
 * Sprint 135 (BUG-075, BUG-078): the ten request-status writers.
 *
 * Mocked SQL contract. Each writer takes its locks in the documented order, decides every refusal before its first
 * write, guards its own row's change in the write, and leaves the request's status to src/db/requestStatus.ts. None
 * issues a request-status UPDATE of its own. The real-row behaviour and the races run in the root
 * tests/integration/sprint-135-request-status-guards.integration.test.ts.
 */
const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: {},
  query: (...args: any[]) => mockQuery(...args),
  withTransaction: (fn: any) => fn((...args: any[]) => mockQuery(...args)),
}));

const mockPublishEvent = jest.fn();
jest.mock('../../src/events/publisher', () => ({ publishEvent: (...args: any[]) => mockPublishEvent(...args) }));

// Propose-match's admin check. A plain function, so no resetMocks setting can wipe it.
jest.mock('../../src/db/liveRole', () => ({
  ...jest.requireActual('../../src/db/liveRole'),
  hasLiveRoleInRequestCommunities: async () => true,
}));

// The dibs and provider-offer routers carry their own authMiddleware: inject the caller from a header instead.
jest.mock('@karmyq/shared/middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { userId: req.headers['x-test-user'], email: 'u@test.com', communities: [] };
    next();
  },
}));

import express from 'express';
import request from 'supertest';

type Reply = { rowCount: number; rows: any[] };
const rows = (r: any[] = [], rowCount = r.length): Reply => ({ rowCount, rows: r });
const flat = (sql: unknown) => String(sql).replace(/\s+/g, ' ').trim();
let replies: Array<[RegExp, Reply]> = [];
const reply = (re: RegExp, r: Reply) => { replies.push([re, r]); };

const statements = () => mockQuery.mock.calls.map(([sql, params]) => ({ sql: flat(sql), params }));
const sqls = () => statements().map((s) => s.sql);
/** Index of the first statement matching a pattern, or equal to an exact (flattened) statement. */
const at = (p: RegExp | string) => sqls().findIndex((s) => (typeof p === 'string' ? s === p : p.test(s)));
const writes = () => sqls().filter((s) => /^(UPDATE|INSERT|DELETE)\b/i.test(s));

const LOCK = /^SELECT id FROM requests\.help_requests WHERE id = \$1 FOR UPDATE$/;
/** lockRequest's second statement: the derived status every precondition reads. */
const DERIVE = /^SELECT CASE WHEN r\.status = 'cancelled'/;
const RECONCILE = /^UPDATE requests\.help_requests r SET status = CASE /;
const CANCEL_REQUEST = /^UPDATE requests\.help_requests r SET status = 'cancelled'/;
const CLOSE_OFFERS = /^UPDATE requests\.help_offers SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE status = 'matched' AND id IN/;
const CLOSE_MATCHES = /^UPDATE requests\.matches SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE request_id = \$1 AND status = 'proposed'$/;
/** A request-status write that is not the shared helper's: what every writer used to do. */
const OWN_STATUS_WRITE = /^UPDATE requests\.help_requests\b(?!.*SET status = CASE)(?!.*SET status = 'cancelled').*\bSET\b.*\bstatus = /;
const PARTICIPANT_READ = /FROM requests\.matches m LEFT JOIN requests\.help_requests r/;

const PROPOSED = { id: 'match-1', request_id: 'req-1', offer_id: 'offer-1', responder_id: 'helper', requester_id: 'requester', status: 'proposed', admin_proposed: false };
const MATCHED = { ...PROPOSED, status: 'matched' };

async function app() {
  const { default: requests } = await import('../../src/routes/requests');
  const { default: dibs } = await import('../../src/routes/dibs');
  const { default: adminActions } = await import('../../src/routes/adminActions');
  const { default: requesterOffers } = await import('../../src/routes/requesterOffers');
  const { default: matches } = await import('../../src/routes/matches');
  const a = express();
  a.use(express.json());
  a.use((req: any, _res: any, next: any) => {
    req.user = { userId: req.headers['x-test-user'], email: 'u@test.com', communities: [] };
    next();
  });
  // Mount order as in src/index.ts.
  a.use('/requests', requests);
  a.use('/requests', dibs);
  a.use('/requests', adminActions);
  a.use('/requests', requesterOffers);
  a.use('/matches', matches);
  return a;
}

beforeEach(() => {
  replies = [];
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: unknown) => {
    const text = flat(sql);
    const hit = replies.find(([re]) => re.test(text));
    return hit ? hit[1] : rows([], 1);
  });
  mockPublishEvent.mockReset();
  mockPublishEvent.mockResolvedValue(undefined);
});

describe('PUT /matches/:id/accept (BUG-075, BUG-078 #1)', () => {
  beforeEach(() => {
    reply(PARTICIPANT_READ, rows([PROPOSED]));
    reply(/^SELECT request_type, payload FROM requests\.help_requests/, rows([{ request_type: 'generic', payload: null }]));
    reply(/^SELECT m\.\*, r\.request_type/, rows([{ id: 'match-1' }]));
  });
  const accept = async () => request(await app()).put('/matches/match-1/accept').set('x-test-user', 'requester').send({});

  it('locks the open request, accepts the match, closes the other proposals and derives the request last', async () => {
    reply(DERIVE, rows([{ status: 'open' }]));
    const res = await accept();
    expect(res.status).toBe(200);
    const order = [LOCK, /^UPDATE requests\.matches SET status = 'matched'/, CLOSE_OFFERS, CLOSE_MATCHES, RECONCILE].map(at);
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect(sqls().filter((s) => OWN_STATUS_WRITE.test(s))).toEqual([]);
    expect(mockPublishEvent).toHaveBeenCalledWith('match_accepted', expect.objectContaining({ match_id: 'match-1' }));
  });

  it.each(['dibs_pending', 'completed', 'cancelled'])('refuses a %s request with 409 REQUEST_NOT_OPEN and writes nothing', async (status) => {
    reply(DERIVE, rows([{ status }]));
    const res = await accept();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'This request is no longer open', error: 'REQUEST_NOT_OPEN' });
    expect(writes()).toEqual([]);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('keeps ALREADY_MATCHED for a request a sibling accept already matched', async () => {
    reply(DERIVE, rows([{ status: 'matched' }]));
    const res = await accept();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'This request was just matched with someone else', error: 'ALREADY_MATCHED' });
    expect(writes()).toEqual([]);
  });
});

describe('PUT /matches/:id/reject (BUG-075, BUG-078 #1)', () => {
  it('frees the offer only while the proposal holds it, and derives the request instead of reopening it', async () => {
    reply(PARTICIPANT_READ, rows([PROPOSED]));
    reply(DERIVE, rows([{ status: 'completed' }]));
    const res = await request(await app()).put('/matches/match-1/reject').set('x-test-user', 'helper').send({});
    expect(res.status).toBe(200);
    const offer = statements().find((s) => s.sql === "UPDATE requests.help_offers SET status = 'active' WHERE id = $1 AND status = 'matched'");
    expect(offer?.params).toEqual(['offer-1']);
    expect(sqls().pop()).toMatch(RECONCILE);
    expect(sqls().filter((s) => OWN_STATUS_WRITE.test(s) || /COUNT\(\*\)/.test(s))).toEqual([]);
  });
});

describe('PUT /matches/:id/complete (BUG-078 #2, #3)', () => {
  it("records a first mark with COALESCE, so a repeat mark keeps the first mark's time, and touches no request", async () => {
    reply(PARTICIPANT_READ, rows([MATCHED]));
    reply(/^UPDATE requests\.matches SET requester_done_at/, rows([{ requester_done_at: 't1', responder_done_at: null }]));
    const res = await request(await app()).put('/matches/match-1/complete').set('x-test-user', 'requester').send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ fully_completed: false, waiting_for: 'helper' });
    expect(sqls()).toContain(
      "UPDATE requests.matches SET requester_done_at = COALESCE(requester_done_at, CURRENT_TIMESTAMP) WHERE id = $1 AND status = 'matched' RETURNING requester_done_at, responder_done_at");
    expect(sqls().filter((s) => /help_requests/.test(s) && !PARTICIPANT_READ.test(s))).toEqual([]);
  });

  it('derives the request after the final mark instead of overwriting it, match row first', async () => {
    reply(PARTICIPANT_READ, rows([MATCHED]));
    reply(/^UPDATE requests\.matches SET responder_done_at/, rows([{ requester_done_at: 't1', responder_done_at: 't2' }]));
    const res = await request(await app()).put('/matches/match-1/complete').set('x-test-user', 'helper').send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ fully_completed: true, waiting_for: null });
    const finalize = sqls().indexOf("UPDATE requests.matches SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = $1");
    expect(finalize).toBeGreaterThan(-1);
    expect(finalize).toBeLessThan(at(LOCK));
    expect(at(LOCK)).toBeLessThan(at(RECONCILE));
    expect(sqls().filter((s) => OWN_STATUS_WRITE.test(s))).toEqual([]);
    expect(mockPublishEvent).toHaveBeenCalledWith('match_completed', expect.objectContaining({ match_id: 'match-1' }));
  });
});

describe('DELETE /matches/:id (BUG-074 cancel, now through the shared helper)', () => {
  it('derives the request after the guarded match write and before freeing the offer', async () => {
    reply(PARTICIPANT_READ, rows([MATCHED]));
    const res = await request(await app()).delete('/matches/match-1').set('x-test-user', 'helper');
    expect(res.status).toBe(200);
    const cancel = sqls().indexOf("UPDATE requests.matches SET status = 'cancelled' WHERE id = $1 AND status = 'matched'");
    const offer = sqls().indexOf("UPDATE requests.help_offers SET status = 'active' WHERE id = $1 AND status = 'matched'");
    expect(cancel).toBeGreaterThan(-1);
    expect(cancel).toBeLessThan(at(LOCK));
    expect(at(RECONCILE)).toBeLessThan(offer);
    expect(sqls().filter((s) => OWN_STATUS_WRITE.test(s))).toEqual([]);
  });
});

describe('POST /requests/:id/propose-match (BUG-075)', () => {
  beforeEach(() => {
    reply(/^SELECT id FROM requests\.help_requests r WHERE/, rows([{ id: 'req-1' }]));
    reply(/FROM communities\.members cm JOIN requests\.request_communities rc/, rows([{ '?column?': 1 }]));
    reply(/^INSERT INTO requests\.matches \(request_id, responder_id, status, admin_proposed\)/, rows([{ id: 'match-new' }]));
  });
  const propose = async () => request(await app()).post('/requests/req-1/propose-match').set('x-test-user', 'admin').send({ user_id: 'helper' });
  const DUPLICATE_CHECK = /^SELECT id FROM requests\.matches WHERE request_id = \$1 AND responder_id = \$2 AND status = 'proposed'$/;

  it('locks the request, then checks for a duplicate and inserts, only while it is open', async () => {
    reply(DERIVE, rows([{ status: 'open' }]));
    const res = await propose();
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, data: { matchId: 'match-new' } });
    expect(at(LOCK)).toBeLessThan(at(DUPLICATE_CHECK));
    expect(at(DUPLICATE_CHECK)).toBeLessThan(at(/^INSERT INTO requests\.matches/));
  });

  it.each(['dibs_pending', 'matched', 'completed', 'cancelled'])('refuses a %s request with 409 REQUEST_NOT_OPEN and inserts nothing', async (status) => {
    reply(DERIVE, rows([{ status }]));
    const res = await propose();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'This request is no longer open', error: 'REQUEST_NOT_OPEN' });
    expect(writes()).toEqual([]);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });
});

describe('POST /requests/:id/dibs (BUG-075)', () => {
  beforeEach(() => {
    reply(/^SELECT id, requester_id, scheduled_for, status, request_type, category, payload FROM requests\.help_requests r/,
      rows([{ id: 'req-1', requester_id: 'requester', scheduled_for: null, status: 'open', request_type: 'generic', category: 'generic', payload: null }]));
    reply(/^SELECT \* FROM requests\.dibs WHERE request_id = \$1$/, rows([]));
    reply(/^SELECT community_id FROM requests\.request_communities/, rows([{ community_id: 'c1' }]));
    reply(/FROM auth\.users u/, rows([{ providerId: 'helper', providerUserId: 'helper', displayName: 'H', trustScore: 55,
      priorInteractions: 1, similarPriorInteractions: 0, trustGraphConnection: 'direct', isAvailable: true }]));
    reply(/^INSERT INTO requests\.dibs/, rows([{ id: 'dibs-1', request_id: 'req-1', provider_user_id: 'helper', status: 'pending' }]));
  });
  const send = async () => request(await app()).post('/requests/req-1/dibs').set('x-test-user', 'requester').send({ provider_user_id: 'helper' });

  it('writes the dibs under the lock while the request is open, then derives dibs_pending', async () => {
    reply(DERIVE, rows([{ status: 'open' }]));
    const res = await send();
    expect(res.status).toBe(201);
    expect(at(LOCK)).toBeLessThan(at(/^INSERT INTO requests\.dibs/));
    expect(at(/^INSERT INTO requests\.dibs/)).toBeLessThan(at(RECONCILE));
    expect(sqls().filter((s) => OWN_STATUS_WRITE.test(s))).toEqual([]);
  });

  it('refuses with 409 REQUEST_NOT_OPEN when the request stopped being open after the pre-read (a race)', async () => {
    reply(DERIVE, rows([{ status: 'matched' }]));
    const res = await send();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'Request is not available for dibs', error: 'REQUEST_NOT_OPEN' });
    expect(writes()).toEqual([]);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });
});

describe('PUT /requests/dibs/:id/accept (BUG-075)', () => {
  const DIBS_LOCK = /^SELECT status, expires_at > clock_timestamp\(\) AS live FROM requests\.dibs WHERE id = \$1 FOR UPDATE$/;
  const DIBS_ACCEPT = "UPDATE requests.dibs SET status = 'accepted', updated_at = NOW() WHERE id = $1 AND status = 'pending'";
  beforeEach(() => {
    reply(/^SELECT \* FROM requests\.dibs WHERE id = \$1$/, rows([{ id: 'dibs-1', request_id: 'req-1', provider_user_id: 'helper',
      status: 'pending', expires_at: new Date(Date.now() + 3_600_000).toISOString() }]));
  });
  // Replies are matched first-registered-first, so a test that needs a different dibs row registers it before this one.
  const liveDibs = () => reply(DIBS_LOCK, rows([{ status: 'pending', live: true }]));
  const accept = async () => request(await app()).put('/requests/dibs/dibs-1/accept').set('x-test-user', 'helper').send({});

  it('locks the dibs row, then the request, and accepts only while the request waits on it', async () => {
    liveDibs();
    reply(DERIVE, rows([{ status: 'dibs_pending' }]));
    const res = await accept();
    expect(res.status).toBe(200);
    const order = [DIBS_LOCK, LOCK, DIBS_ACCEPT,
      /^INSERT INTO requests\.matches \(request_id, responder_id, status\)/, CLOSE_OFFERS, CLOSE_MATCHES, RECONCILE].map(at);
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect(sqls().filter((s) => OWN_STATUS_WRITE.test(s))).toEqual([]);
  });

  it.each(['open', 'matched', 'completed', 'cancelled'])('refuses a %s request with 409 REQUEST_NOT_OPEN and writes nothing', async (status) => {
    liveDibs();
    reply(DERIVE, rows([{ status }]));
    const res = await accept();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'This request is no longer waiting on your dibs', error: 'REQUEST_NOT_OPEN' });
    expect(writes()).toEqual([]);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('refuses a dibs another call settled while this one waited on its lock: 409 INVALID_STATE, no write', async () => {
    reply(DIBS_LOCK, rows([{ status: 'declined', live: true }]));
    const res = await accept();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'Dibs is no longer pending', error: 'INVALID_STATE' });
    expect(writes()).toEqual([]);
    expect(at(LOCK)).toBe(-1);   // decided on the dibs row, before the request lock
  });

  it('refuses an invitation that expired while this call waited on its lock: 410 DIBS_EXPIRED, no write', async () => {
    reply(DIBS_LOCK, rows([{ status: 'pending', live: false }]));
    const res = await accept();
    expect(res.status).toBe(410);
    expect(res.body).toEqual({ success: false, message: 'This dibs invitation has expired', error: 'DIBS_EXPIRED' });
    expect(writes()).toEqual([]);
  });
});

describe('PUT /requests/dibs/:id/decline and POST /requests/dibs/:id/expire (BUG-075)', () => {
  beforeEach(() => {
    reply(/^SELECT \* FROM requests\.dibs WHERE id = \$1$/, rows([{ id: 'dibs-1', request_id: 'req-1', provider_user_id: 'helper',
      status: 'pending', expires_at: new Date(Date.now() + 3_600_000).toISOString() }]));
  });

  it('decline guards the dibs write and derives the request instead of reopening it', async () => {
    const res = await request(await app()).put('/requests/dibs/dibs-1/decline').set('x-test-user', 'helper').send({});
    expect(res.status).toBe(200);
    const decline = sqls().indexOf("UPDATE requests.dibs SET status = 'declined', updated_at = NOW() WHERE id = $1 AND status = 'pending'");
    expect(decline).toBeGreaterThan(-1);
    expect(decline).toBeLessThan(at(LOCK));
    expect(at(LOCK)).toBeLessThan(at(RECONCILE));
    expect(sqls().filter((s) => OWN_STATUS_WRITE.test(s))).toEqual([]);
  });

  it('decline refuses a dibs another call already settled with 409 INVALID_STATE and leaves the request alone', async () => {
    reply(/^UPDATE requests\.dibs SET status = 'declined'/, rows([], 0));
    const res = await request(await app()).put('/requests/dibs/dibs-1/decline').set('x-test-user', 'helper').send({});
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'Dibs is no longer pending', error: 'INVALID_STATE' });
    expect(sqls().filter((s) => /help_requests/.test(s))).toEqual([]);
  });

  it('expire guards the dibs write and derives the request', async () => {
    const res = await request(await app()).post('/requests/dibs/dibs-1/expire').set('x-test-user', 'helper').send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { dibs_status: 'expired' } });
    const expire = sqls().indexOf("UPDATE requests.dibs SET status = 'expired', updated_at = NOW() WHERE id = $1 AND status = 'pending'");
    expect(expire).toBeGreaterThan(-1);
    expect(expire).toBeLessThan(at(RECONCILE));
    expect(sqls().filter((s) => OWN_STATUS_WRITE.test(s))).toEqual([]);
  });
});

describe('PUT /requests/offers/:id/accept (BUG-075)', () => {
  const OFFER_ACCEPT = "UPDATE provider.offers SET status = 'accepted', updated_at = NOW() WHERE id = $1 AND status = 'pending'";
  beforeEach(() => {
    reply(/^SELECT o\.\*, hr\.requester_id as requester_user_id/, rows([{ id: 'off-1', request_id: 'req-1',
      provider_user_id: 'provider', requester_user_id: 'requester', status: 'pending' }]));
  });
  const accept = async () => request(await app()).put('/requests/offers/off-1/accept').set('x-test-user', 'requester').send({});

  it('accepts in one transaction only while the request is open, and derives it last', async () => {
    reply(DERIVE, rows([{ status: 'open' }]));
    const res = await accept();
    expect(res.status).toBe(200);
    const order = [LOCK, /^UPDATE provider\.offers SET status = 'accepted'/, /^INSERT INTO requests\.matches/,
      CLOSE_OFFERS, CLOSE_MATCHES, RECONCILE].map(at);
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect(sqls()).toContain(OFFER_ACCEPT);
    expect(sqls().filter((s) => OWN_STATUS_WRITE.test(s))).toEqual([]);
  });

  it.each(['dibs_pending', 'matched', 'completed', 'cancelled'])('refuses a %s request with 409 REQUEST_NOT_OPEN and writes nothing', async (status) => {
    reply(DERIVE, rows([{ status }]));
    const res = await accept();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'This request is no longer open', error: 'REQUEST_NOT_OPEN' });
    expect(writes()).toEqual([]);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('answers 404 when the offer was settled concurrently, and inserts no match', async () => {
    reply(DERIVE, rows([{ status: 'open' }]));
    reply(/^UPDATE provider\.offers SET status = 'accepted'/, rows([], 0));
    const res = await accept();
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'Offer not found or not pending', error: 'NOT_FOUND' });
    expect(writes()).toEqual([OFFER_ACCEPT]);
  });
});

describe('PUT /requests/:id (BUG-075)', () => {
  beforeEach(() => {
    reply(/^SELECT requester_id FROM requests\.help_requests WHERE id = \$1 AND requester_id = \$2$/, rows([{ requester_id: 'requester' }]));
  });

  it('refuses a status in the body with 400 STATUS_NOT_EDITABLE before any write or event', async () => {
    const res = await request(await app()).put('/requests/req-1').set('x-test-user', 'requester').send({ title: 'T', status: 'open' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: "A request's status changes through its exchanges, not an edit", error: 'STATUS_NOT_EDITABLE' });
    expect(writes()).toEqual([]);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('edits the other fields with no status assignment and no request_completed event', async () => {
    reply(/^UPDATE requests\.help_requests SET/, rows([{ id: 'req-1', title: 'T' }]));
    const res = await request(await app()).put('/requests/req-1').set('x-test-user', 'requester').send({ title: 'T' });
    expect(res.status).toBe(200);
    const update = statements().find((s) => /^UPDATE requests\.help_requests SET/.test(s.sql));
    expect(update?.sql).toBe('UPDATE requests.help_requests SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND requester_id = $3 RETURNING *');
    expect(update?.params).toEqual(['T', 'req-1', 'requester']);
    expect(mockPublishEvent).not.toHaveBeenCalledWith('request_completed', expect.anything());
  });

  it('answers a foreign id 404 even with a status in the body: access is decided before validation', async () => {
    replies = [];
    reply(/^SELECT requester_id FROM requests\.help_requests WHERE id = \$1 AND requester_id = \$2$/, rows([], 0));
    const res = await request(await app()).put('/requests/req-1').set('x-test-user', 'stranger').send({ status: 'open' });
    expect(res.status).toBe(404);
    expect(writes()).toEqual([]);
  });
});

describe('DELETE /requests/:id (BUG-075)', () => {
  const DIBS_CANCEL_LOCK = /^SELECT id FROM requests\.dibs WHERE request_id = \$1 AND status = 'pending' FOR UPDATE$/;
  const DIBS_EXPIRE_ON_CANCEL = "UPDATE requests.dibs SET status = 'expired', updated_at = NOW() WHERE request_id = $1 AND status = 'pending'";
  beforeEach(() => {
    reply(/^SELECT requester_id FROM requests\.help_requests WHERE id = \$1 AND requester_id = \$2$/, rows([{ requester_id: 'requester' }]));
  });
  const cancel = async () => request(await app()).delete('/requests/req-1').set('x-test-user', 'requester');

  it('locks a pending dibs, then the request; cancels; closes its proposals; expires the dibs; publishes request_cancelled', async () => {
    reply(DERIVE, rows([{ status: 'dibs_pending' }]));
    const res = await cancel();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Request cancelled successfully' });
    const order = [DIBS_CANCEL_LOCK, LOCK, CANCEL_REQUEST, CLOSE_OFFERS, CLOSE_MATCHES, DIBS_EXPIRE_ON_CANCEL].map(at);
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect(statements().find((s) => CANCEL_REQUEST.test(s.sql))?.params).toEqual(['req-1', 'requester']);
    expect(mockPublishEvent).toHaveBeenCalledTimes(1);
    expect(mockPublishEvent).toHaveBeenCalledWith('request_cancelled', { request_id: 'req-1', requester_id: 'requester' });
  });

  it.each(['completed', 'cancelled'])('refuses a %s request with 409 REQUEST_NOT_CANCELLABLE and writes nothing', async (status) => {
    reply(DERIVE, rows([{ status }]));
    const res = await cancel();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'Only an open request can be cancelled', error: 'REQUEST_NOT_CANCELLABLE' });
    expect(writes()).toEqual([]);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('refuses a request with an exchange in progress with 409 REQUEST_HAS_ACTIVE_EXCHANGE, writing nothing', async () => {
    reply(DERIVE, rows([{ status: 'matched' }]));
    const res = await cancel();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'This request has an exchange in progress, so it cannot be cancelled', error: 'REQUEST_HAS_ACTIVE_EXCHANGE' });
    expect(writes()).toEqual([]);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });
});
```

- [ ] **Run it red**

```bash
cd services/request-service
npx jest tests/tdd/sprint-135-request-status-writers.test.ts --no-cache > /tmp/s135-t3.txt 2>&1; echo "exit=$?"
```

Expected: the suite runs (it imports only the existing routes), and most cases fail on the old code:
- the old lock literal, so `LOCK` is not found;
- `OWN_STATUS_WRITE` hits;
- the missing 409s and 400.
A case that **passes** against the old code must be a preservation check you can name, for example:
- the 404 when a provider offer was already settled (the old pre-read path);
- the requester cancel publishing `request_cancelled`.
Any other pass means the case does not test the change. Record each red reason in the commit body.

Commit: `test(requests): Sprint 135 writer contract (red)`.

---

## Task 4: Root real-SQL integration test (CI-only on Windows)

**Files:**
- Create: `tests/integration/sprint-135-request-status-guards.integration.test.ts`

Fixture columns were checked against `infrastructure/postgres/init.sql` on 2026-11-01:
- `requests.dibs`: `request_id`, `requester_id`, `provider_user_id`, `expires_at` NOT NULL; `status` defaults to `pending`.
- `provider.offers`: `provider_id` (FK `requests.provider_profiles(id)`), `provider_user_id`, `request_id` NOT NULL.
- `requests.provider_profiles`: `user_id`, `service_type`, `display_name` NOT NULL.
- `notifications` and `provider_profiles` both cascade on `auth.users` delete.

The mutual-aid dibs nominee needs an active co-member with one completed exchange with the requester
(`dibsDb.getMutualAidCandidates`, `src/db/dibsDb.ts:210-330`).

- [ ] **Write the file**

```ts
/**
 * Sprint 135 (BUG-075, BUG-078): every request-status writer guards its own row and derives the request's status
 * (services/request-service/src/db/requestStatus.ts). Real JWT, request service over HTTP, real PostgreSQL. Missing
 * infrastructure is a failure, never a skip.
 *
 * Proofs, writer by writer:
 * - a refusal writes nothing;
 * - a success leaves the ask in its derived status (a completed or cancelled ask stays so; a withdrawn offer stays
 *   withdrawn);
 * - four races show the guard is under the lock, not in a read before it. While a second client holds an uncommitted
 *   change, the HTTP call waits on that lock (pg_blocking_pids, never a sleep) and is refused after the commit.
 * Every case except the named positive controls fails against the pre-Sprint-135 code.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import Queue from 'bull';
import { randomUUID } from 'crypto';
import { createPool, ServiceUrls } from '../fixtures';

describe('Sprint 135 request status guards', () => {
  const pool = createPool();
  // R requester; H, H2, H3 helpers; A community admin; P provider. All active members of Cm.
  const R = randomUUID(), H = randomUUID(), H2 = randomUUID(), H3 = randomUUID(), A = randomUUID(), P = randomUUID();
  const users = [R, H, H2, H3, A, P];
  const Cm = randomUUID();
  let providerProfile = '';
  const asks: string[] = [];
  const offers: string[] = [];
  const completions: string[] = [];
  const redis = process.env.REDIS_URL || 'redis://localhost:6380';
  const reputationJobs = new Queue('karmyq-completion-reputation', redis);
  const communityEvolution = new Queue('karmyq-community-evolution', redis);

  const bearer = (id: string) => `Bearer ${jwt.sign({ userId: id, email: `${id}@karmyq.test`, communities: [] }, process.env.JWT_SECRET || 'dev-secret-key')}`;
  // `.then` starts the request, so a race case can hold it in flight.
  const call = (method: 'put' | 'post' | 'delete', path: string, as: string, body: object = {}) =>
    request(ServiceUrls.REQUEST)[method](path).set('Authorization', bearer(as)).send(body).then((res) => res);
  const accept = (m: string) => call('put', `/matches/${m}/accept`, R);
  const reject = (m: string, as = H) => call('put', `/matches/${m}/reject`, as);
  const complete = (m: string, as: string) => call('put', `/matches/${m}/complete`, as);
  const propose = (q: string) => call('post', `/requests/${q}/propose-match`, A, { user_id: H });
  const sendDibs = (q: string) => call('post', `/requests/${q}/dibs`, R, { provider_user_id: H });
  const acceptDibs = (d: string) => call('put', `/requests/dibs/${d}/accept`, H);
  const declineDibs = (d: string) => call('put', `/requests/dibs/${d}/decline`, H);
  const acceptProviderOffer = (o: string) => call('put', `/requests/offers/${o}/accept`, R);
  const editAsk = (q: string, body: object) => call('put', `/requests/${q}`, R, body);
  const cancelAsk = (q: string) => call('delete', `/requests/${q}`, R);

  // Status parameters are INSERT values cast to varchar; nothing here compares a parameter with requests.matches.status.
  async function ask(status: string): Promise<string> {
    const id = randomUUID();
    await pool.query(`INSERT INTO requests.help_requests
      (id,requester_id,title,description,category,request_type,visibility_scope,status)
      VALUES ($1,$2,'Sprint 135 ask','Fixture','generic','generic','community',$3::varchar)`, [id, R, status]);
    await pool.query('INSERT INTO requests.request_communities(request_id,community_id) VALUES ($1,$2)', [id, Cm]);
    asks.push(id);
    return id;
  }
  async function offer(owner: string, status: string): Promise<string> {
    const id = randomUUID();
    await pool.query(`INSERT INTO requests.help_offers (id,community_id,offerer_id,title,description,category,status)
      VALUES ($1,$2,$3,'Sprint 135 offer','Fixture','generic',$4::varchar)`, [id, Cm, owner, status]);
    offers.push(id);
    return id;
  }
  async function match(requestId: string, responder: string, status: string,
    opts: { offerId?: string; requesterDone?: boolean } = {}): Promise<string> {
    const { rows } = await pool.query(`INSERT INTO requests.matches
      (request_id,responder_id,offer_id,status,requester_done_at,completed_at)
      VALUES ($1,$2,$3,$4::varchar,CASE WHEN $5::boolean THEN CURRENT_TIMESTAMP END,
              CASE WHEN $4::varchar = 'completed' THEN CURRENT_TIMESTAMP END) RETURNING id`,
    [requestId, responder, opts.offerId ?? null, status, opts.requesterDone ?? false]);
    return rows[0].id;
  }
  async function dibs(requestId: string, provider = H): Promise<string> {
    const { rows } = await pool.query(`INSERT INTO requests.dibs (request_id,requester_id,provider_user_id,expires_at)
      VALUES ($1,$2,$3,NOW() + INTERVAL '1 day') RETURNING id`, [requestId, R, provider]);
    return rows[0].id;
  }
  async function providerOffer(requestId: string): Promise<string> {
    const { rows } = await pool.query(`INSERT INTO provider.offers (provider_id,provider_user_id,request_id,price,note)
      VALUES ($1,$2,$3,10,'Sprint 135 provider offer') RETURNING id`, [providerProfile, P, requestId]);
    return rows[0].id;
  }
  const one = async (sql: string, id: string) => (await pool.query(sql, [id])).rows[0];
  const askStatus = async (id: string) => (await one('SELECT status FROM requests.help_requests WHERE id = $1', id)).status;
  const matchRow = (id: string) => one('SELECT * FROM requests.matches WHERE id = $1', id);
  const offerStatus = async (id: string) => (await one('SELECT status FROM requests.help_offers WHERE id = $1', id)).status;
  const dibsStatus = async (id: string) => (await one('SELECT status FROM requests.dibs WHERE id = $1', id)).status;
  const providerOfferStatus = async (id: string) => (await one('SELECT status FROM provider.offers WHERE id = $1', id)).status;
  const matchesOn = async (requestId: string) => (await pool.query(
    'SELECT responder_id, status, admin_proposed FROM requests.matches WHERE request_id = $1', [requestId])).rows;

  // Holds `holderSql` on one row in an open transaction, starts `pending`, proves it waits on that row's lock
  // (pg_blocking_pids, not a sleep), then commits and returns the call's response.
  async function whileHeld(holderSql: string, rowId: string, pending: () => Promise<request.Response>) {
    const holder = await pool.connect();
    try {
      await holder.query('BEGIN');
      const { pid } = (await holder.query('SELECT pg_backend_pid() AS pid')).rows[0];
      await holder.query(holderSql, [rowId]);
      const inFlight = pending();
      let waiting = false;
      for (const deadline = Date.now() + 10_000; !waiting && Date.now() < deadline;) {
        const blocked = await pool.query(
          'SELECT 1 FROM pg_locks l WHERE NOT l.granted AND $1::int = ANY(pg_blocking_pids(l.pid))', [pid]);
        waiting = (blocked.rowCount ?? 0) > 0;
        if (!waiting) await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(waiting).toBe(true);
      await holder.query('COMMIT');
      return await inFlight;
    } catch (err) {
      await holder.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      holder.release();
    }
  }

  // What a concurrent accept leaves behind, held uncommitted by whileHeld: the request row locked and 'matched', plus a
  // matched exchange by H2. Preconditions read the DERIVED status, so the stored column alone would not do: without the
  // exchange the ask still derives 'open'.
  const concurrentAccept = `WITH accepted AS (
      INSERT INTO requests.matches (request_id, responder_id, status) VALUES ($1, '${H2}', 'matched')
    ) UPDATE requests.help_requests SET status = 'matched' WHERE id = $1`;

  // An HTTP completion publishes match_completed, and reputation-service awards karma asynchronously. Wait for each
  // completion's job, so no karma row lands after the community is gone.
  async function settled(matchId: string) {
    for (const deadline = Date.now() + 20_000; Date.now() < deadline;) {
      const job = await reputationJobs.getJob(`completion-${matchId}`);
      if (job && ((await job.getState()) === 'completed' || job.attemptsMade > 0)) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  beforeAll(async () => {
    await pool.query('SELECT 1');
    expect((await request(ServiceUrls.REQUEST).get('/health')).status).toBe(200);
    for (const id of users) {
      await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)',
        [id, `Sprint 135 ${id.slice(0, 8)}`, `${id}@karmyq.test`, 'not-a-login']);
    }
    await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4)',
      [Cm, `Sprint 135 ${Cm}`, 'Fixture', R]);
    for (const id of users) {
      await pool.query(`INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,$3::varchar,'active')`,
        [id, Cm, id === A ? 'admin' : 'member']);
    }
    providerProfile = (await pool.query(`INSERT INTO requests.provider_profiles (user_id,service_type,display_name)
      VALUES ($1,'generic','Sprint 135 provider') RETURNING id`, [P])).rows[0].id;
    // One completed exchange between R and H makes H an eligible mutual-aid dibs nominee.
    await match(await ask('completed'), H, 'completed');
  });

  afterAll(async () => {
    try {
      for (const m of completions) await settled(m);
      await (await communityEvolution.getJob(Cm))?.remove().catch(() => undefined);
      await pool.query('DELETE FROM requests.dibs WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM provider.offers WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM requests.matches WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM requests.feed_events WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM notifications.notifications WHERE user_id = ANY($1::uuid[])', [users]);
      // karma_records.community_id has no ON DELETE CASCADE: clear it before the community.
      await pool.query('DELETE FROM reputation.karma_records WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM reputation.trust_scores WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM social_graph.trust_edges WHERE user_id_a = ANY($1::uuid[]) OR user_id_b = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM requests.help_offers WHERE id = ANY($1::uuid[])', [offers]);
      await pool.query('DELETE FROM requests.request_communities WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM requests.help_requests WHERE id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM communities.members WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM communities.communities WHERE id = $1', [Cm]);
      // Cascades provider_profiles, badges, notifications and the rest keyed on the user.
      await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [users]);
    } finally {
      await reputationJobs.close();
      await communityEvolution.close();
      await pool.end();
    }
  }, 90_000);

  describe('accept (BUG-075, BUG-078 #1)', () => {
    it('matches an open ask, rejects the other proposals and frees only the offers they still hold', async () => {
      const q = await ask('open');
      const o1 = await offer(H, 'matched'), o2 = await offer(H2, 'matched'), o3 = await offer(H3, 'withdrawn');
      const m1 = await match(q, H, 'proposed', { offerId: o1 });
      const m2 = await match(q, H2, 'proposed', { offerId: o2 });
      const m3 = await match(q, H3, 'proposed', { offerId: o3 });
      expect((await accept(m1)).status).toBe(200);
      expect([(await matchRow(m1)).status, (await matchRow(m2)).status, (await matchRow(m3)).status])
        .toEqual(['matched', 'rejected', 'rejected']);
      expect([await offerStatus(o1), await offerStatus(o2), await offerStatus(o3)]).toEqual(['matched', 'active', 'withdrawn']);
      expect(await askStatus(q)).toBe('matched');
    });

    it.each(['dibs_pending', 'completed', 'cancelled'])('refuses a %s ask with 409 REQUEST_NOT_OPEN and writes nothing', async (status) => {
      const q = await ask(status);
      const m = await match(q, H, 'proposed');
      const res = await accept(m);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, message: 'This request is no longer open', error: 'REQUEST_NOT_OPEN' });
      expect((await matchRow(m)).status).toBe('proposed');
      expect(await askStatus(q)).toBe(status);
    });

    it('refuses an accept that waited on a concurrent cancel of the ask', async () => {
      const q = await ask('open');
      const m = await match(q, H, 'proposed');
      const res = await whileHeld("UPDATE requests.help_requests SET status = 'cancelled' WHERE id = $1", q, () => accept(m));
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('REQUEST_NOT_OPEN');
      expect((await matchRow(m)).status).toBe('proposed');
      expect(await askStatus(q)).toBe('cancelled');
    });

    it('refuses a new helper on an ask stored open that already holds a completed exchange (the 2026-10-29 demo shape)', async () => {
      const q = await ask('open');
      await match(q, H2, 'completed');
      const m = await match(q, H, 'proposed');
      const res = await accept(m);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('REQUEST_NOT_OPEN');
      expect((await matchRow(m)).status).toBe('proposed');
      expect(await askStatus(q)).toBe('open');   // a refusal writes nothing, not even a correction
    });
  });

  describe('reject (BUG-075, BUG-078 #1)', () => {
    it.each([
      ['completed', async (q: string) => { await match(q, H2, 'completed'); }],
      ['dibs_pending', async (q: string) => { await dibs(q, H2); }],
      ['cancelled', async (_q: string) => undefined],
    ] as const)('leaves a %s ask as it is when a proposal on it is withdrawn', async (status, backing) => {
      const q = await ask(status);
      await backing(q);
      const o = await offer(H, 'matched');
      const m = await match(q, H, 'proposed', { offerId: o });
      expect((await reject(m)).status).toBe(200);
      expect((await matchRow(m)).status).toBe('rejected');
      expect(await offerStatus(o)).toBe('active');
      expect(await askStatus(q)).toBe(status);
    });

    it('declining a proposal never revives an offer the helper withdrew', async () => {
      const q = await ask('open');
      const o = await offer(H, 'withdrawn');
      const m = await match(q, H, 'proposed', { offerId: o });
      expect((await reject(m, R)).status).toBe(200);
      expect(await offerStatus(o)).toBe('withdrawn');
      expect(await askStatus(q)).toBe('open');
    });
  });

  describe('complete (BUG-078 #2, #3)', () => {
    it('completes the exchange but leaves a cancelled ask cancelled', async () => {
      const q = await ask('cancelled');
      const m = await match(q, H, 'matched', { requesterDone: true });
      const res = await complete(m, H);
      completions.push(m);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ fully_completed: true, waiting_for: null });
      expect((await matchRow(m)).status).toBe('completed');
      expect(await askStatus(q)).toBe('cancelled');
    });

    it('keeps the ask matched while a second helper is still matched', async () => {
      const q = await ask('matched');
      await match(q, H2, 'matched');
      const m = await match(q, H, 'matched', { requesterDone: true });
      const res = await complete(m, H);
      completions.push(m);
      expect(res.body.data).toEqual({ fully_completed: true, waiting_for: null });
      expect(await askStatus(q)).toBe('matched');
    });

    // Positive control: the old code also closes this ask.
    it('closes the ask as completed when its only exchange completes', async () => {
      const q = await ask('matched');
      const m = await match(q, H, 'matched', { requesterDone: true });
      const res = await complete(m, H);
      completions.push(m);
      expect(res.body.data).toEqual({ fully_completed: true, waiting_for: null });
      expect(await askStatus(q)).toBe('completed');
    });

    it("a repeat mark keeps the first mark's time", async () => {
      const q = await ask('matched');
      const m = await match(q, H, 'matched');
      expect((await complete(m, R)).body.data).toEqual({ fully_completed: false, waiting_for: 'helper' });
      const first = (await matchRow(m)).requester_done_at;
      expect((await complete(m, R)).body.data).toEqual({ fully_completed: false, waiting_for: 'helper' });
      expect((await matchRow(m)).requester_done_at).toEqual(first);
    });
  });

  describe('propose-match (BUG-075)', () => {
    // Positive control.
    it('proposes a member on an open ask', async () => {
      const q = await ask('open');
      expect((await propose(q)).status).toBe(201);
      expect(await matchesOn(q)).toEqual([{ responder_id: H, status: 'proposed', admin_proposed: true }]);
    });

    it.each(['dibs_pending', 'matched', 'completed', 'cancelled'])('refuses a %s ask with 409 REQUEST_NOT_OPEN and inserts nothing', async (status) => {
      const q = await ask(status);
      const res = await propose(q);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, message: 'This request is no longer open', error: 'REQUEST_NOT_OPEN' });
      expect(await matchesOn(q)).toEqual([]);
    });

    it('refuses a proposal that waited on a concurrent match of the ask', async () => {
      const q = await ask('open');
      const res = await whileHeld(concurrentAccept, q, () => propose(q));
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('REQUEST_NOT_OPEN');
      expect(await matchesOn(q)).toEqual([{ responder_id: H2, status: 'matched', admin_proposed: false }]);
    });

    it('refuses a proposal on an ask stored open that already holds a completed exchange', async () => {
      const q = await ask('open');
      await match(q, H2, 'completed');
      const res = await propose(q);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('REQUEST_NOT_OPEN');
      expect(await matchesOn(q)).toEqual([{ responder_id: H2, status: 'completed', admin_proposed: false }]);
    });
  });

  describe('dibs (BUG-075)', () => {
    // Positive control.
    it('sends a dibs on an open ask and derives dibs_pending', async () => {
      const q = await ask('open');
      const res = await sendDibs(q);
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('pending');
      expect(await askStatus(q)).toBe('dibs_pending');
    });

    it('refuses a dibs that waited on a concurrent match of the ask, and writes no dibs', async () => {
      const q = await ask('open');
      const res = await whileHeld(concurrentAccept, q, () => sendDibs(q));
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, message: 'Request is not available for dibs', error: 'REQUEST_NOT_OPEN' });
      expect((await pool.query('SELECT 1 FROM requests.dibs WHERE request_id = $1', [q])).rowCount).toBe(0);
      expect(await askStatus(q)).toBe('matched');
    });

    it('a dibs accept matches the ask and closes a stale proposal', async () => {
      const q = await ask('dibs_pending');
      const d = await dibs(q);
      const o = await offer(H2, 'matched');
      const stale = await match(q, H2, 'proposed', { offerId: o });
      expect((await acceptDibs(d)).status).toBe(200);
      expect(await dibsStatus(d)).toBe('accepted');
      const rows = await matchesOn(q);
      expect(rows).toHaveLength(2);
      expect(rows).toEqual(expect.arrayContaining([{ responder_id: H, status: 'matched', admin_proposed: false }]));
      expect((await matchRow(stale)).status).toBe('rejected');
      expect(await offerStatus(o)).toBe('active');
      expect(await askStatus(q)).toBe('matched');
    });

    it('a dibs accept on an ask the requester cancelled answers 409 and changes nothing', async () => {
      const q = await ask('cancelled');
      const d = await dibs(q);
      const res = await acceptDibs(d);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, message: 'This request is no longer waiting on your dibs', error: 'REQUEST_NOT_OPEN' });
      expect(await dibsStatus(d)).toBe('pending');
      expect(await matchesOn(q)).toEqual([]);
      expect(await askStatus(q)).toBe('cancelled');
    });

    it('a dibs accept that waited on a concurrent decline answers 409 INVALID_STATE and inserts no match', async () => {
      const q = await ask('dibs_pending');
      const d = await dibs(q);
      const res = await whileHeld("UPDATE requests.dibs SET status = 'declined' WHERE id = $1", d, () => acceptDibs(d));
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, message: 'Dibs is no longer pending', error: 'INVALID_STATE' });
      expect(await dibsStatus(d)).toBe('declined');
      expect(await matchesOn(q)).toEqual([]);
    });

    // Positive control.
    it('a dibs decline reopens an ask that waited only on it', async () => {
      const q = await ask('dibs_pending');
      const d = await dibs(q);
      expect((await declineDibs(d)).status).toBe(200);
      expect(await dibsStatus(d)).toBe('declined');
      expect(await askStatus(q)).toBe('open');
    });

    it('a dibs decline leaves a cancelled ask cancelled', async () => {
      const q = await ask('cancelled');
      const d = await dibs(q);
      expect((await declineDibs(d)).status).toBe(200);
      expect(await dibsStatus(d)).toBe('declined');
      expect(await askStatus(q)).toBe('cancelled');
    });
  });

  describe('provider-offer accept (BUG-075)', () => {
    it('accepts on an open ask in one transaction and closes the other proposals', async () => {
      const q = await ask('open');
      const po = await providerOffer(q);
      const o = await offer(H, 'matched');
      const proposal = await match(q, H, 'proposed', { offerId: o });
      expect((await acceptProviderOffer(po)).status).toBe(200);
      expect(await providerOfferStatus(po)).toBe('accepted');
      expect((await matchesOn(q)).filter((m: any) => m.responder_id === P))
        .toEqual([{ responder_id: P, status: 'matched', admin_proposed: false }]);
      expect((await matchRow(proposal)).status).toBe('rejected');
      expect(await offerStatus(o)).toBe('active');
      expect(await askStatus(q)).toBe('matched');
    });

    it.each(['dibs_pending', 'matched', 'completed', 'cancelled'])('refuses a %s ask with 409 REQUEST_NOT_OPEN and writes nothing', async (status) => {
      const q = await ask(status);
      const po = await providerOffer(q);
      const res = await acceptProviderOffer(po);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, message: 'This request is no longer open', error: 'REQUEST_NOT_OPEN' });
      expect(await providerOfferStatus(po)).toBe('pending');
      expect(await matchesOn(q)).toEqual([]);
      expect(await askStatus(q)).toBe(status);
    });

    it('a second provider offer on the same ask is refused once the first is accepted', async () => {
      const q = await ask('open');
      const first = await providerOffer(q), second = await providerOffer(q);
      expect((await acceptProviderOffer(first)).status).toBe(200);
      const res = await acceptProviderOffer(second);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('REQUEST_NOT_OPEN');
      expect(await providerOfferStatus(second)).toBe('pending');
      expect((await matchesOn(q)).filter((m: any) => m.status === 'matched')).toHaveLength(1);
    });
  });

  describe('request edit and cancel (BUG-075)', () => {
    it('an edit cannot set a status', async () => {
      const q = await ask('completed');
      const res = await editAsk(q, { status: 'open' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: "A request's status changes through its exchanges, not an edit", error: 'STATUS_NOT_EDITABLE' });
      expect(await askStatus(q)).toBe('completed');
    });

    // Positive control.
    it('an edit of other fields still works and leaves the status alone', async () => {
      const q = await ask('open');
      expect((await editAsk(q, { title: 'Sprint 135 edited' })).status).toBe(200);
      expect(await one('SELECT title, status FROM requests.help_requests WHERE id = $1', q))
        .toEqual({ title: 'Sprint 135 edited', status: 'open' });
    });

    it('cancelling an open ask rejects its proposals and frees the offers they hold', async () => {
      const q = await ask('open');
      const o = await offer(H, 'matched');
      const m = await match(q, H, 'proposed', { offerId: o });
      const res = await cancelAsk(q);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, message: 'Request cancelled successfully' });
      expect(await askStatus(q)).toBe('cancelled');
      expect((await matchRow(m)).status).toBe('rejected');
      expect(await offerStatus(o)).toBe('active');
    });

    it('an ask with an exchange in progress cannot be cancelled', async () => {
      const q = await ask('matched');
      const m = await match(q, H, 'matched');
      const res = await cancelAsk(q);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, message: 'This request has an exchange in progress, so it cannot be cancelled', error: 'REQUEST_HAS_ACTIVE_EXCHANGE' });
      expect(await askStatus(q)).toBe('matched');
      expect((await matchRow(m)).status).toBe('matched');
    });

    it.each(['completed', 'cancelled'])('a %s ask cannot be cancelled', async (status) => {
      const q = await ask(status);
      const res = await cancelAsk(q);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, message: 'Only an open request can be cancelled', error: 'REQUEST_NOT_CANCELLABLE' });
      expect(await askStatus(q)).toBe(status);
    });

    it('cancelling an ask expires its pending dibs, which then cannot be accepted', async () => {
      const q = await ask('dibs_pending');
      const d = await dibs(q);
      expect((await cancelAsk(q)).status).toBe(200);
      expect(await askStatus(q)).toBe('cancelled');
      expect(await dibsStatus(d)).toBe('expired');
      const res = await acceptDibs(d);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('INVALID_STATE');
      expect(await matchesOn(q)).toEqual([]);
    });
  });
});
```

- [ ] **Type-check it** (it cannot run locally on the Windows box; CI's Integration Tests job is the arbiter)

```bash
cd tests
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "sprint-135-request-status-guards" ; echo "grep-exit=$? (1 = no diagnostics for this file)"
npx tsc --listFilesOnly -p tsconfig.json | grep -c "sprint-135-request-status-guards"   # 1 = it is compiled
```

Commit: `test(integration): Sprint 135 request status guards over real SQL (CI-only)`.

---

## Task 5: The status module

**Files:**
- Create: `services/request-service/src/db/requestStatus.ts`

- [ ] **Write it**

```ts
/**
 * Sprint 135 (BUG-075, BUG-078): the only module that writes a request's status.
 *
 * A request's status follows its rows. It is 'matched' while an exchange on it is in progress, 'completed' once one has
 * completed and none is in progress, 'dibs_pending' while a dibs invitation waits, and 'open' otherwise. 'cancelled' is
 * the requester's decision, and nothing derives it away.
 *
 * Every writer changes its own row (a match, a dibs, an offer) with a guarded statement, then calls
 * reconcileRequestStatus in the same transaction. The reconcile takes the request row lock and derives the status in a
 * fresh statement, so the transaction that reconciles last sees every row committed before it.
 *
 * Lock order:
 * - request-first writers (accept, reject, propose-match, dibs create, provider-offer accept, requester cancel) touch
 *   only 'proposed' matches;
 * - match-first writers (complete, cancel) touch only 'matched' ones;
 * - the dibs routes lock the dibs row before the request, as cleanup-service's expiry job does.
 * Never lock a request and then a dibs row.
 *
 * tests/regression/sprint-135-request-status-gate.test.ts fails on a request-status write anywhere else.
 */
export type TxQuery = (text: string, params?: any[]) => Promise<any>;
export type RequestStatus = 'open' | 'dibs_pending' | 'matched' | 'completed' | 'cancelled';

/** The request row lock. One literal for both helpers, so the directed-surface allowlist has one entry for it. */
const LOCK_REQUEST = 'SELECT id FROM requests.help_requests WHERE id = $1 FOR UPDATE';

/**
 * Lock the request row until the transaction ends, then return its DERIVED status (what reconcileRequestStatus would
 * write), or null when there is no such request. Preconditions read this, not the stored column: an old row whose stored
 * status disagrees with its rows (the 2026-10-29 demo rows) is judged by its rows.
 *
 * The derivation is its own statement after the lock: a statement that waited on the lock would keep a snapshot from
 * before the wait in its subqueries. The status is current, because no writer can change these rows while this
 * transaction holds the request lock.
 */
export async function lockRequest(q: TxQuery, requestId: string): Promise<RequestStatus | null> {
  await q(LOCK_REQUEST, [requestId]);
  const result = await q(
    `SELECT CASE
       WHEN r.status = 'cancelled' THEN 'cancelled'
       WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'matched') THEN 'matched'
       WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'completed') THEN 'completed'
       WHEN EXISTS (SELECT 1 FROM requests.dibs d WHERE d.request_id = r.id AND d.status = 'pending') THEN 'dibs_pending'
       ELSE 'open' END AS status
     FROM requests.help_requests r WHERE r.id = $1`,
    [requestId]
  );
  return result.rows[0]?.status ?? null;
}

/**
 * Derive the request's status from its matches and dibs, and write it. Call it after the writer's own row changes.
 *
 * The UPDATE is its own statement after the lock. A single UPDATE that waited on the row lock would re-check only the
 * request row, while its EXISTS subqueries kept the snapshot from before the wait (the BUG-074 cancel note). It writes
 * status only, as the match routes always have: updated_at stays put, so the memory-retention window does not move.
 * Re-taking a lock this transaction already holds is immediate, so callers need not track whether they hold it.
 */
export async function reconcileRequestStatus(q: TxQuery, requestId: string): Promise<void> {
  await q(LOCK_REQUEST, [requestId]);
  await q(
    `UPDATE requests.help_requests r
     SET status = CASE
       WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'matched') THEN 'matched'
       WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'completed') THEN 'completed'
       WHEN EXISTS (SELECT 1 FROM requests.dibs d WHERE d.request_id = r.id AND d.status = 'pending') THEN 'dibs_pending'
       ELSE 'open' END
     WHERE r.id = $1 AND r.status <> 'cancelled'`,
    [requestId]
  );
}

/**
 * The requester's cancel, guarded in the write: the caller's own request, not already cancelled, with no exchange in
 * progress or completed (its derived status is open or dibs_pending). Returns whether it cancelled. The caller holds the
 * request lock.
 */
export async function markRequestCancelled(q: TxQuery, requestId: string, requesterId: string): Promise<boolean> {
  const result = await q(
    `UPDATE requests.help_requests r
     SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
     WHERE r.id = $1 AND r.requester_id = $2 AND r.status <> 'cancelled'
       AND NOT EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status IN ('matched', 'completed'))`,
    [requestId, requesterId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Reject every proposal still open on the request, and free each one's offer only while the proposal holds it: a
 * withdrawn offer stays withdrawn (BUG-008, BUG-078). Offers first, so the subquery still sees the proposals.
 */
export async function closeProposals(q: TxQuery, requestId: string): Promise<void> {
  await q(
    `UPDATE requests.help_offers
     SET status = 'active', updated_at = CURRENT_TIMESTAMP
     WHERE status = 'matched' AND id IN (
       SELECT offer_id FROM requests.matches
       WHERE request_id = $1 AND status = 'proposed' AND offer_id IS NOT NULL
     )`,
    [requestId]
  );
  await q(
    `UPDATE requests.matches
     SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
     WHERE request_id = $1 AND status = 'proposed'`,
    [requestId]
  );
}
```

- [ ] **Verify:** the helper contract is green (8 tests), and `tsc` is clean.

```bash
cd services/request-service
npx jest tests/tdd/sprint-135-request-status-helper.test.ts --no-cache > /tmp/s135-t5.txt 2>&1; echo "exit=$?"
npx tsc --noEmit; echo "tsc=$?"
```

Commit: `feat(requests): one module derives and writes a request's status (Sprint 135)`.

---

## Task 6: Match routes

**Files:**
- Modify: `services/request-service/src/routes/matches.ts`

- [ ] **Import** next to the existing `../database/db` import:
  `import { closeProposals, lockRequest, reconcileRequestStatus } from '../db/requestStatus';`

- [ ] **Accept.** Replace the transaction and its conflict handling (`:345-415`, from `// Atomic accept:` through the
  `ALREADY_MATCHED` return) with:

```ts
    // Atomic accept: lock the request → accept the match → close the other proposals → derive the request, all in one
    // transaction, so a mid-sequence failure can't split match/request/offer state.
    const result = await withTransaction(async (q) => {
      // The request row lock serializes concurrent accepts on the same request, and the status it returns is current.
      // BUG-075: only an open request can be matched. A sibling accept that committed first leaves it 'matched'.
      const requestStatus = await lockRequest(q, match.request_id);
      if (requestStatus === 'matched') {
        return { conflict: 'matched' as const };
      }
      if (requestStatus !== 'open') {
        return { conflict: 'not_open' as const };
      }

      // Accept THIS match only if it is still proposed. The row-count guard turns a
      // lost race (the sibling won and rejected this match) into a clean 409.
      const accepted = await q(
        `UPDATE requests.matches
         SET status = 'matched', scheduled_at = $2, travel_time_minutes = $3
         WHERE id = $1 AND status = 'proposed'`,
        [id, scheduled_at, travel_time_minutes]
      );
      if (accepted.rowCount === 0) {
        return { conflict: 'matched' as const };
      }

      // Reject the other proposals and free their offers (BUG-008) only while each proposal still holds its offer
      // (BUG-078), then derive the request: 'matched'.
      await closeProposals(q, match.request_id);
      await reconcileRequestStatus(q, match.request_id);

      // Fetch enriched match data for response (includes payload for frontend fulfillment panel)
      const enriched = await q(
        `SELECT m.*, r.request_type, r.payload, r.title as request_title
         FROM requests.matches m
         JOIN requests.help_requests r ON m.request_id = r.id
         WHERE m.id = $1 AND ${matchParticipantSql('r', 'm', '$2')}`,
      [id, user_id]
      );
      return { enriched };
    });

    if ('conflict' in result) {
      return result.conflict === 'matched'
        ? res.status(409).json({
            success: false,
            message: 'This request was just matched with someone else',
            error: 'ALREADY_MATCHED',
          })
        : res.status(409).json({
            success: false,
            message: 'This request is no longer open',
            error: 'REQUEST_NOT_OPEN',
          });
    }
```

  The enriched `SELECT` is byte-identical to today's, so its allowlist entry still matches. Diff it before committing.

- [ ] **Reject.** Replace the transaction (`:477-527`, from `// Atomic reject:` through `});` before `// The match left
  'proposed'`) with:

```ts
    // Atomic reject: mark rejected → free the linked offer → derive the request, all in one transaction, so a
    // mid-sequence failure can't strand the offer or split match/request state.
    const rejected = await withTransaction(async (q) => {
      // Serialize against a concurrent accept on the same request (accept takes the same lock first), so reject can
      // never run between accept's read and commit.
      await lockRequest(q, match.request_id);

      // Reject only while still proposed. Without the status guard a reject racing an
      // accept could flip an accepted (or completed) match back to 'rejected'.
      const result = await q(
        `UPDATE requests.matches
         SET status = 'rejected'
         WHERE id = $1 AND status = 'proposed'`,
        [id]
      );
      if (result.rowCount === 0) {
        return false;
      }

      // Free the linked offer back to the active pool so the helper re-enters matching (BUG-008), but only while
      // this proposal still holds it: an offer the helper withdrew stays withdrawn (BUG-078).
      if (match.offer_id) {
        await q(
          `UPDATE requests.help_offers SET status = 'active' WHERE id = $1 AND status = 'matched'`,
          [match.offer_id]
        );
      }

      // BUG-075: derive the request instead of reopening it. A completed, cancelled or dibs_pending request stays so.
      await reconcileRequestStatus(q, match.request_id);
      return true;
    });
```

- [ ] **Complete.** In the transaction (`:623-656`):
  - The done_at `UPDATE` becomes `SET ${doneAtColumn} = COALESCE(${doneAtColumn}, CURRENT_TIMESTAMP)`, with the comment
    `// BUG-078: COALESCE keeps the first mark's time, so a repeat mark (a double click) does not move it.` above it.
  - In `if (finished)`, keep the match finalize `UPDATE` as it is. Replace the request
    `UPDATE requests.help_requests SET status = 'completed' WHERE id = $1` statement with:

```ts
        // BUG-078: derive the request, never overwrite it: a cancelled request stays cancelled, and one with a second
        // helper still matched stays matched. Match row first, then the request row, the same order as cancel.
        await reconcileRequestStatus(q, match.request_id);
```

- [ ] **Cancel.**
  - In the transaction (`:765-779`), replace the `SELECT ... FOR UPDATE` and the conditional request `UPDATE` (with its
    comment) with:

```ts
      // Derive the request: it changes only if no other helper is still matched on it, to 'completed' if a completed
      // exchange remains and 'open' otherwise (BUG-074); a cancelled request stays cancelled. Match row first, then the
      // request row (inside reconcile), the same order as complete.
      await reconcileRequestStatus(q, match.request_id);
```

  - In the comment above the transaction (`:749-753`), replace its last sentence ("The request changes only while it is
    still 'matched' …") with
    `The request's status is then derived from its rows (src/db/requestStatus.ts).`

- [ ] **Verify:** the matches cases of the writer contract go green.

```bash
cd services/request-service
npx jest tests/tdd/sprint-135-request-status-writers.test.ts --no-cache -t "matches" > /tmp/s135-t6.txt 2>&1; echo "exit=$?"
npx tsc --noEmit; echo "tsc=$?"
```

Commit: `fix(requests): match accept, reject and complete derive the request status (BUG-075, BUG-078)`.

---

## Task 7: Propose-match and provider-offer accept

**Files:**
- Modify: `services/request-service/src/routes/adminActions.ts`, `services/request-service/src/db/offersDb.ts`,
  `services/request-service/src/routes/requesterOffers.ts`

- [ ] **adminActions imports:**
  - `import { query } from '../database/db';` → `import { query, withTransaction } from '../database/db';`
  - add `import { lockRequest } from '../db/requestStatus';`

- [ ] **Propose-match.** Replace the duplicate check, the `INSERT` and `const match = result.rows[0];` (`:134-150`) with:

```ts
    // BUG-075: propose only on an open request. The lock makes the status current and serializes the duplicate check
    // and the insert against an accept, a dibs and a cancel on the same request.
    const outcome = await withTransaction(async (q) => {
      if ((await lockRequest(q, id)) !== 'open') {
        return { conflict: 'not_open' as const };
      }
      // Prevent duplicate proposed matches for the same user
      const existingMatch = await q(
        `SELECT id FROM requests.matches WHERE request_id = $1 AND responder_id = $2 AND status = 'proposed'`,
        [id, user_id]
      );
      if (existingMatch.rows.length > 0) {
        return { conflict: 'duplicate' as const };
      }
      const result = await q(
        `INSERT INTO requests.matches (request_id, responder_id, status, admin_proposed)
         VALUES ($1, $2, 'proposed', TRUE)
         RETURNING *`,
        [id, user_id]
      );
      return { match: result.rows[0] };
    });
    if ('conflict' in outcome) {
      return outcome.conflict === 'duplicate'
        ? res.status(409).json({ success: false, message: 'A proposed match already exists for this user' })
        : res.status(409).json({ success: false, message: 'This request is no longer open', error: 'REQUEST_NOT_OPEN' });
    }

    const match = outcome.match;
```

- [ ] **offersDb imports:**
  - `import { query } from '../database/db';` → `import { query, withTransaction } from '../database/db';`
  - add `import { closeProposals, lockRequest, reconcileRequestStatus } from './requestStatus';`

- [ ] **`acceptOffer`.**
  - Keep the ownership read and the two early returns.
  - Replace the four writes after them, and the final `return offer;`, with the block below.
  - Add `Returns 'REQUEST_NOT_OPEN' if the request is no longer open (BUG-075).` to the doc comment. Change its "not
    pending" line to "not found or not pending, including one accepted or withdrawn concurrently".

```ts
  // One transaction: a mid-sequence failure can no longer leave an accepted offer without its match (BUG-075).
  return withTransaction(async (q) => {
    // Only an open request can be matched; the lock serializes this accept against every other request writer.
    if ((await lockRequest(q, offer.request_id)) !== 'open') return 'REQUEST_NOT_OPEN' as const;

    const accepted = await q(
      `UPDATE provider.offers SET status = 'accepted', updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
      [offerId]
    );
    if (accepted.rowCount === 0) return null;

    // Bridge into existing match tracking
    await q(
      `INSERT INTO requests.matches (request_id, responder_id, status)
       VALUES ($1, $2, 'matched')`,
      [offer.request_id, offer.provider_user_id]
    );

    // Close the other proposals and derive the request — mirrors the dibs/match accept path
    await closeProposals(q, offer.request_id);
    await reconcileRequestStatus(q, offer.request_id);
    return offer;
  });
```

- [ ] **requesterOffers accept route:** after the `FORBIDDEN` block, add:

```ts
    if (offer === 'REQUEST_NOT_OPEN') {
      return res.status(409).json({
        success: false,
        message: 'This request is no longer open',
        error: 'REQUEST_NOT_OPEN',
      });
    }
```

- [ ] **Verify**

```bash
cd services/request-service
npx jest tests/tdd/sprint-135-request-status-writers.test.ts --no-cache -t "propose-match|offers" > /tmp/s135-t7.txt 2>&1; echo "exit=$?"
npx tsc --noEmit; echo "tsc=$?"
```

Commit: `fix(requests): propose-match and provider-offer accept need an open request (BUG-075)`.

---

## Task 8: Dibs routes

**Files:**
- Modify: `services/request-service/src/routes/dibs.ts`, `services/request-service/src/db/dibsDb.ts`

- [ ] **Imports in dibs.ts:**
  - delete `import pool from '../database/db';`;
  - remove `updateDibsStatus,` from the `../db/dibsDb` import list;
  - add `import { closeProposals, lockRequest, reconcileRequestStatus } from '../db/requestStatus';`.

- [ ] **Create.** Replace the transaction (`:229-241`, through `});`) with:

```ts
    // Dibs insert + request status transition commit or roll back together. The insert
    // must run on the SAME transaction client (passed as `q`) — on the pool it would
    // survive a rollback, leaving an orphaned dibs row. BUG-075: the request must still be open when the dibs is
    // written; the status check above is a fast path only.
    const dibsRecord = await withTransaction(async (q) => {
      if ((await lockRequest(q, requestId)) !== 'open') {
        return null;
      }
      const created = await createDibs(requestId, userId, providerUserId, expiresAt, q);
      await reconcileRequestStatus(q, requestId);
      return created;
    });
    if (!dibsRecord) {
      return res.status(409).json({
        success: false,
        message: 'Request is not available for dibs',
        error: 'REQUEST_NOT_OPEN',
      });
    }
```

- [ ] **Accept.** Replace the manual `pool.connect()` transaction (`:318-347`) with:

```ts
    // Lock order: the dibs row, then the request row, the same order as cleanup-service's expiry job, so the two
    // cannot deadlock. Every refusal is decided before the first write.
    const outcome = await withTransaction(async (q) => {
      // The row as it is after any wait for its lock. Liveness uses the wall clock (clock_timestamp), not NOW(), which
      // is this transaction's start and could predate an expiry that passed while it waited.
      const locked = await q(
        `SELECT status, expires_at > clock_timestamp() AS live FROM requests.dibs WHERE id = $1 FOR UPDATE`,
        [dibsId]
      );
      const row = locked.rows[0];
      if (!row || row.status !== 'pending') {
        return 'dibs_not_pending' as const;
      }
      if (!row.live) {
        return 'dibs_expired' as const;
      }
      // BUG-075: accept only while the request is still waiting on this dibs (not cancelled, matched or reopened).
      if ((await lockRequest(q, dibs.request_id)) !== 'dibs_pending') {
        return 'request_not_waiting' as const;
      }
      // The write keeps its guard, though the row lock above already decides it.
      const accepted = await q(
        `UPDATE requests.dibs SET status = 'accepted', updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
        [dibsId]
      );
      if (accepted.rowCount === 0) {
        return 'dibs_not_pending' as const;
      }

      // Create a match record
      await q(
        `INSERT INTO requests.matches (request_id, responder_id, status)
         VALUES ($1, $2, 'matched')`,
        [dibs.request_id, dibs.provider_user_id]
      );
      // BUG-075: no stale proposal may outlive the exchange. Then derive the request: 'matched'.
      await closeProposals(q, dibs.request_id);
      await reconcileRequestStatus(q, dibs.request_id);
      return 'accepted' as const;
    });

    if (outcome === 'request_not_waiting') {
      return res.status(409).json({
        success: false,
        message: 'This request is no longer waiting on your dibs',
        error: 'REQUEST_NOT_OPEN',
      });
    }
    if (outcome === 'dibs_not_pending') {
      return res.status(409).json({ success: false, message: 'Dibs is no longer pending', error: 'INVALID_STATE' });
    }
    if (outcome === 'dibs_expired') {
      return res.status(410).json({ success: false, message: 'This dibs invitation has expired', error: 'DIBS_EXPIRED' });
    }
```

- [ ] **Decline.** Replace the manual transaction (`:408-430`) with:

```ts
    const declined = await withTransaction(async (q) => {
      // The guarded dibs UPDATE locks the dibs row before reconcile locks the request (cleanup's order).
      const result = await q(
        `UPDATE requests.dibs SET status = 'declined', updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
        [dibsId]
      );
      if (result.rowCount === 0) {
        return false;
      }
      // BUG-075: derive the request instead of reopening it; a cancelled or matched request stays so.
      await reconcileRequestStatus(q, dibs.request_id);
      return true;
    });
    if (!declined) {
      return res.status(409).json({ success: false, message: 'Dibs is no longer pending', error: 'INVALID_STATE' });
    }
```

- [ ] **Expire** (test-only route). Replace `await updateDibsStatus(dibsId, 'expired');` and the request `UPDATE` that
  follows it (`:478-483`) with:

```ts
    const expired = await withTransaction(async (q) => {
      const result = await q(
        `UPDATE requests.dibs SET status = 'expired', updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
        [dibsId]
      );
      if (result.rowCount === 0) {
        return false;
      }
      await reconcileRequestStatus(q, dibs.request_id);
      return true;
    });
    if (!expired) {
      return res.status(409).json({ success: false, message: 'Dibs is no longer pending', error: 'INVALID_STATE' });
    }
```

- [ ] **Delete `updateDibsStatus`** from `src/db/dibsDb.ts`: its doc comment ("Update the status of a dibs record…") and
  the function. Then grep for orphans:

```bash
cd /c/Users/ravic/development/karmyq
git grep -n "updateDibsStatus" -- services apps tests packages ; echo "grep-exit=$? (1 = none left)"
git grep -n "pool" services/request-service/src/routes/dibs.ts | grep -v "candidate pool\|provider pool\|on the pool"
```

- [ ] **Verify**

```bash
cd services/request-service
npx jest tests/tdd/sprint-135-request-status-writers.test.ts --no-cache -t "dibs" > /tmp/s135-t8.txt 2>&1; echo "exit=$?"
npx tsc --noEmit; echo "tsc=$?"
```

Commit: `fix(requests): dibs routes guard their rows and derive the request status (BUG-075)`.

- [ ] **cleanup-service's dibs expiry (spec *Decisions → Corrections*).** Read `services/cleanup-service/.claude/README.md`
  and `CONTEXT.md` first. Write the test, see it fail, then guard the job.

  Test (`services/cleanup-service/tests/tdd/sprint-135-expire-dibs-guard.test.ts`; same mocks as
  `tests/regression/sprint-133-pr-q-cleanup-publish.test.ts`):

```ts
/**
 * Sprint 135: the dibs expiry job expires only a dibs that is still pending. Between the job's SELECT and its UPDATE a
 * provider can accept (or decline) the dibs; overwriting that with 'expired' would leave an expired dibs beside a live
 * exchange and notify the provider that an invitation they accepted had expired.
 * The root config's resetMocks wipes factory implementations, so every implementation is set in-test.
 */
const mockPublish = jest.fn();
const mockPoolQuery = jest.fn();
const mockClientQuery = jest.fn();
jest.mock('../../src/events/publisher', () => ({ publishEvent: (...a: unknown[]) => mockPublish(...a) }));
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: { query: (...a: unknown[]) => mockPoolQuery(...a), connect: async () => ({ query: (...a: unknown[]) => mockClientQuery(...a), release: () => undefined }) },
  query: (...a: unknown[]) => mockPoolQuery(...a),
}));
jest.mock('../../src/utils/logger', () => ({ logger: { info: () => undefined, error: () => undefined, debug: () => undefined, warn: () => undefined } }));
import { expireDibs } from '../../src/jobs/expireDibs';

const flat = (sql: unknown) => String(sql).replace(/\s+/g, ' ').trim();
const GUARDED = "UPDATE requests.dibs SET status = 'expired', updated_at = NOW() WHERE id = $1 AND status = 'pending'";

beforeEach(() => {
  mockPoolQuery.mockResolvedValue({ rows: [{ id: 'd1', request_id: 'r1', provider_user_id: 'p1' }] });
  mockPublish.mockResolvedValue({ id: 'job' });
});

it('expires the dibs only while it is still pending', async () => {
  mockClientQuery.mockResolvedValue({ rowCount: 1, rows: [] });
  await expect(expireDibs()).resolves.toBe(1);
  expect(mockClientQuery.mock.calls.map(([sql]) => flat(sql))).toContain(GUARDED);
  expect(mockPublish).toHaveBeenCalledTimes(1);
});

it('leaves a dibs the provider settled first alone: no request write, no event, rolled back', async () => {
  mockClientQuery.mockImplementation(async (sql: unknown) =>
    (flat(sql) === GUARDED ? { rowCount: 0, rows: [] } : { rowCount: 1, rows: [] }));
  await expect(expireDibs()).resolves.toBe(0);
  const sqls = mockClientQuery.mock.calls.map(([sql]) => flat(sql));
  expect(sqls.filter((s) => /help_requests/.test(s))).toEqual([]);
  expect(sqls).toContain('ROLLBACK');
  expect(sqls).not.toContain('COMMIT');
  expect(mockPublish).not.toHaveBeenCalled();
});
```

  Run it red (`cd services/cleanup-service && npx jest tests/tdd/sprint-135-expire-dibs-guard.test.ts --no-cache`).
  Then in `src/jobs/expireDibs.ts`, replace the dibs `UPDATE` (`:37-42`) with:

```ts
        // Expire the dibs only while it is still pending. A provider who accepted or declined it after the SELECT
        // above has already decided; overwriting that with 'expired' would contradict a live exchange (Sprint 135).
        const expired = await client.query(
          `UPDATE requests.dibs
           SET status = 'expired', updated_at = NOW()
           WHERE id = $1 AND status = 'pending'`,
          [dibs.id]
        );
        if (expired.rowCount === 0) {
          await client.query('ROLLBACK');
          continue;
        }
```

  `continue` inside the `try` still runs the `finally`, so the client is released. The request `UPDATE` after it keeps
  its exact text, so its allowlist hash (`f165b289…`) still matches. The existing
  `sprint-133-pr-q-cleanup-publish.test.ts` mocks return no `rowCount`, so `undefined === 0` is false and that test is
  unaffected.

```bash
cd services/cleanup-service
npx jest tests/tdd/sprint-135-expire-dibs-guard.test.ts tests/regression/sprint-133-pr-q-cleanup-publish.test.ts --no-cache > /tmp/s135-t8-cleanup.txt 2>&1; echo "exit=$?"
npx tsc --noEmit; echo "tsc=$?"
```

Commit: `fix(cleanup): the dibs expiry job expires only a still-pending dibs (Sprint 135)`.

---

## Task 9: Request edit and cancel, and the event

**Files:**
- Modify: `services/request-service/src/routes/requests.ts`, `services/registry.json`

- [ ] **Imports.** Add `withTransaction` to the existing `../database/db` import (read the line first), and add
  `import { closeProposals, lockRequest, markRequestCancelled } from '../db/requestStatus';`.

- [ ] **`PUT /:id`:**
  - Right after the requester lookup's 404 (the `requestCheck` block that follows the 401), add the check below. Access
    is decided first, so a foreign or absent id answers 404 whatever the body holds, like the route's other refusals.

```ts
    // BUG-075: a request's status follows its exchanges (src/db/requestStatus.ts); an edit cannot set it.
    if (status !== undefined) {
      return res.status(400).json({
        success: false,
        message: "A request's status changes through its exchanges, not an edit",
        error: 'STATUS_NOT_EDITABLE',
      });
    }
```

  - Delete the `if (status !== undefined) { updates.push(`status = ...`) ... }` block.
  - Delete the `if (status === 'completed') { await publishEvent('request_completed', …) }` block.
  - Leave the `UPDATE` literal itself unchanged, so its allowlist hash still matches.

- [ ] **`DELETE /:id`.** Keep the 401 and the requester lookup. Replace the `// Cancel request` `UPDATE` and its 404
  check with:

```ts
    // Sprint 135 (BUG-075): only a request whose derived status is open or dibs_pending can be cancelled. Its proposals
    // and its pending dibs die with it. Every refusal is decided before the first write.
    const outcome = await withTransaction(async (q) => {
      // Lock order: a pending dibs on the request first, then the request: the dibs routes' and cleanup's order.
      await q(`SELECT id FROM requests.dibs WHERE request_id = $1 AND status = 'pending' FOR UPDATE`, [id]);
      const status = await lockRequest(q, id);
      if (status === null) return 'not_found' as const;
      if (status === 'completed' || status === 'cancelled') return 'not_cancellable' as const;
      if (status === 'matched') return 'active_exchange' as const;
      // Guarded in the write and bound to the JWT requester; the lookup above already proved ownership.
      if (!(await markRequestCancelled(q, id, user_id))) return 'not_found' as const;
      await closeProposals(q, id);
      // The provider's invitation ends with the request, so it leaves their pending list now. No event: a
      // dibs_expired notification would misstate why it ended.
      await q(
        `UPDATE requests.dibs SET status = 'expired', updated_at = NOW() WHERE request_id = $1 AND status = 'pending'`,
        [id]
      );
      return 'cancelled' as const;
    });

    if (outcome === 'not_found') {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    if (outcome === 'not_cancellable') {
      return res.status(409).json({
        success: false,
        message: 'Only an open request can be cancelled',
        error: 'REQUEST_NOT_CANCELLABLE',
      });
    }
    if (outcome === 'active_exchange') {
      return res.status(409).json({
        success: false,
        message: 'This request has an exchange in progress, so it cannot be cancelled',
        error: 'REQUEST_HAS_ACTIVE_EXCHANGE',
      });
    }
```

- [ ] **Registry event.** In `services/registry.json`, remove `"request_completed"` from request-service
  `events.publishes`. Leave `packages/shared` untouched.

- [ ] **Verify:** the whole writer contract is green, and the event gate agrees.

```bash
cd services/request-service
npx jest tests/tdd/sprint-135-request-status-writers.test.ts --no-cache > /tmp/s135-t9.txt 2>&1; echo "exit=$?"
npx tsc --noEmit; echo "tsc=$?"
cd /c/Users/ravic/development/karmyq
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-133-pr-q-event-routes.test.ts > /tmp/s135-t9-events.txt 2>&1; echo "exit=$?"
```

Commit: `fix(requests): an edit cannot set a status, and cancel refuses closed asks or exchanges in progress (BUG-075)`.

---

## Task 10: Existing tests, the BUG-074 fixtures and the directed-surface allowlist

**Files:**
- Modify: `services/request-service/tests/helpers/directedSurfaceAllowlist.json`
- Modify: the regression files the suite names (expected below)
- Modify: `tests/integration/sprint-134-bug-074-match-status-guards.integration.test.ts`

- [ ] **Run the request-service suite and list every failure**

```bash
cd services/request-service
npm run test:regression -- --no-cache --runInBand > /tmp/s135-t10-reg.txt 2>&1; echo "exit=$?"
npm run test:unit -- --no-cache > /tmp/s135-t10-unit.txt 2>&1; echo "exit=$?"
grep -E "^(FAIL|PASS)" /tmp/s135-t10-reg.txt | sort | uniq -c | sort -rn | head -40
```

Expected failures, and the fix for each. **Change mock sequences only; never weaken an assertion.**
- `sprint-132-directed-audience-gate.test.ts`: new hits and stale entries (next step).
- `sprint-135-request-status-gate.test.ts`: green now. If not, the gate lists the offending file:line.
- `sprint-134-bug-074-match-status-guards.test.ts`. Cancel test:
  - statement 2 keeps its text (`SELECT id FROM requests.help_requests WHERE id = $1 FOR UPDATE`, now reconcile's lock);
  - statement 3 is the reconcile `UPDATE`: assert it with `toContain` on
    `SET status = CASE WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'matched') THEN 'matched'`
    and on `WHERE r.id = $1 AND r.status <> 'cancelled'`;
  - the count stays 5.
  - Complete tests: the finalize now issues the lock plus the reconcile in place of one request `UPDATE`, so shift the
    sequences.
- `sprint-92-matching.test.ts`:
  - `lockRequest` is now two statements, so after every `SELECT request FOR UPDATE` mock add the derive reply
    `{ rowCount: 1, rows: [{ status: 'open' }] }`;
  - reject's "remaining proposed = 0" and reopen mocks become the reconcile's lock + `UPDATE`;
  - in the dibs-create case, insert the lock reply and the derive reply `{ status: 'open' }` before the createDibs row.
- `sprint-132-body-identity.test.ts`:
  - its default reply (`{ rows: [{ id: ID }] }`) has no `status`, so `lockRequest` returns `null` and the owner cancel
    would answer 404. Add a branch for the derive statement (`/SELECT CASE WHEN r\.status = 'cancelled'/` →
    `{ rows: [{ status: 'open' }], rowCount: 1 }`);
  - the owner cancel then issues four writes: the guarded cancel, `closeProposals`' two and the dibs expiry. Assert those
    four statements, not a count of 1.
- `two-phase-completion.test.ts`: the done_at SQL text is now the `COALESCE` form; the final-mark sequences gain the lock
  and the reconcile.
- Any other failure: read it. If it pins the old unguarded behavior, update it to the new contract and say why in the
  commit body. If it is unrelated (the Turbo timeout flake, the feed-dibs timestamp flake), rerun that file alone.

- [ ] **Re-pin the directed-surface allowlist.** Run the gate, then print the hash of each new hit with the scanner
  itself:

```bash
cd services/request-service
npx jest tests/regression/sprint-132-directed-audience-gate.test.ts --no-cache > /tmp/s135-t10-dir.txt 2>&1; echo "exit=$?"
node --experimental-strip-types --no-warnings -e "
import('./tests/helpers/directedSurfaceScan.ts').then(({ ALLOWLIST, scanServices, surfaceHash, unguarded }) => {
  const hits = scanServices('../..');
  for (const h of unguarded(hits)) console.log('NEW  ', h.file + ':' + h.line, surfaceHash(h.sql), JSON.stringify(h.sql.replace(/\s+/g, ' ').slice(0, 60)));
  for (const a of ALLOWLIST) if (!hits.some((h) => h.file === a.file && surfaceHash(h.sql) === a.hash)) console.log('STALE', a.file, a.hash.slice(0, 8), a.label);
});"
```

(The planning chat ran this scanner the same way, with Node 24's type stripping, on 2026-11-01. If `-e` will not load it,
put the same lines in a scratchpad `.mts` file that imports the helper by its `file:///` URL.)

  - Expect exactly four new hits, all in `src/db/requestStatus.ts`:
    - the lock `SELECT` (same text as the old `matches.ts` lock, so its hash is `37124d9f…`, under the new file);
    - the derive `SELECT`;
    - the reconcile `UPDATE`;
    - the cancel `UPDATE`.
  - Expect stale entries: `37124d9f…` (both `matches.ts` entries), `1aaaaca2…`, `e8fc886f…`, `b8396be5…`, `e267659f…`
    (`matches.ts`), `d5225b81…` (`offersDb.ts`) and `9dde4b05…` (`requests.ts`).
  - Remove every stale entry, and add one entry per new hit, each with the printed hash, the `label` and a `reason`:
    - lock: `"Lifecycle lock inside an already-authorized writer's transaction (Sprint 135); returns nothing to the client."`
    - derive: `"Derived lifecycle status read under the lock for an already-authorized writer's precondition (Sprint 135); never returned to the client."`
    - reconcile: `"Derived status write after the calling writer's audience and participant checks (Sprint 135). The dibs callers reach only non-directed requests: dibs rows are created behind notDirectedSql (dibs.ts) and is_directed is never rewritten."`
    - cancel: `"Requester-only cancellation: binds the id and the verified JWT requester in the write (Sprint 135)."`
  - If any other hit or stale entry appears, a statement drifted from the plan's text: fix the code, not the allowlist.
  - Rerun the gate: green.

- [ ] **BUG-074 real-SQL fixtures.** In `tests/integration/sprint-134-bug-074-match-status-guards.integration.test.ts`:
  - replace the `it.each(['open', 'dibs_pending', 'completed', 'cancelled'])` "leaves a %s ask as it is" case
    (`:181-190`) with the block below;
  - add `await pool.query('DELETE FROM requests.dibs WHERE request_id = ANY($1::uuid[])', [asks]);` to its `afterAll`,
    before the `requests.matches` delete.

```ts
    // Only a 'matched' ask changes. 'open' is a preservation check. The others carry the rows their status implies,
    // since Sprint 135 derives the status from them: a pending dibs, a completed exchange.
    it.each([
      ['open', async (_q: string) => undefined],
      ['dibs_pending', async (q: string) => {
        await pool.query(`INSERT INTO requests.dibs (request_id,requester_id,provider_user_id,expires_at)
          VALUES ($1,$2,$3,NOW() + INTERVAL '1 day')`, [q, R, H2]);
      }],
      ['completed', async (q: string) => { await match(q, H2, 'completed'); }],
      ['cancelled', async (_q: string) => undefined],
    ] as const)('leaves a %s ask as it is when its matched exchange is cancelled', async (status, backing) => {
      const q = await ask(status);
      await backing(q);
      const m = await match(q, H, 'matched');
      expect((await cancel(H, m)).status).toBe(200);
      expect((await matchRow(m)).status).toBe('cancelled');
      expect(await askStatus(q)).toBe(status);
    });
```

- [ ] **Verify:** request-service unit and regression green, `tsc` clean, the root gates green.

```bash
cd services/request-service
npm run test:regression -- --no-cache --runInBand > /tmp/s135-t10-reg2.txt 2>&1; echo "exit=$?"
npm run test:unit -- --no-cache > /tmp/s135-t10-unit2.txt 2>&1; echo "exit=$?"
npx tsc --noEmit; echo "tsc=$?"
cd /c/Users/ravic/development/karmyq
npm test --workspace=tests > /tmp/s135-t10-root.txt 2>&1; echo "exit=$?"
cd tests && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "sprint-134-bug-074|sprint-135" ; echo "grep-exit=$? (1 = clean)"
```

Commit: `test(requests): align match, dibs and request regressions and re-pin the directed-surface allowlist (Sprint 135)`.

---

## Task 11: Promote the tdd tests

- [ ] **Promote, then keep the PR scoped**

```bash
cd /c/Users/ravic/development/karmyq
node scripts/promote-tdd-tests.js > /tmp/s135-t11.txt 2>&1; echo "exit=$?"
git status --short
```

  - The promoter moves **every** green tdd file repo-wide.
  - Keep the three `sprint-135-*` files in `services/request-service/tests/regression/`, and
    `sprint-135-expire-dibs-guard.test.ts` in `services/cleanup-service/tests/regression/`.
  - Restore every other moved file, after a byte comparison:
    `git restore --staged --worktree <path>` for each one, and delete the new regression copy.
  - `requestStatus.ts`'s doc comment already names `tests/regression/sprint-135-request-status-gate.test.ts`, the
    promoted path inside request-service.

- [ ] **Verify:** `npm run test:regression` in request-service is green and includes the three files.

Commit: `test(requests): promote the Sprint 135 tests to regression`.

---

## Task 12: User guides and landing docs

**Files:**
- Modify: `docs/guides/match-lifecycle.md`, `docs/guides/dibs-request.md`, `docs/guides/making-requests-guide.md`,
  `docs/guides/admin-community-guide.md`
- Regenerate: their `apps/landing/src/data/docs/guides/*.json`

- [ ] **Write the guide changes** listed in the spec's *User Guide & Doc Updates*.
  - **Match lifecycle:**
    - The *Withdrawing Before Acceptance* lines that say the request "goes back to open status" / "reopens" become:
      it reopens only if nothing else holds it. A completed or cancelled ask stays that way, and an offer you
      withdrew is never brought back.
    - Add a section **What the request's status follows**, after *Waiting States*:
      - matched while an exchange is in progress;
      - completed once one completes;
      - cancelled stays cancelled;
      - a late "mark done" on a cancelled ask completes the exchange but not the ask;
      - an ask that is no longer open refuses new matches, with the message "This request is no longer open".
  - **Dibs:** while your invitation is pending, the ask isn't open to other offers. If you cancel the ask meanwhile, the
    provider can no longer accept.
  - **Making requests (near `:97`):**
    - you can cancel an open ask;
    - an ask with an exchange in progress, or a completed one, can't be cancelled;
    - editing never changes an ask's status.
  - **Admin (*Suggest a Helper*):** if the ask stops being open before you propose, you see "This request is no longer
    open".
  - Run `node scripts/gotcha-check.js --for docs/guides/match-lifecycle.md`. Paraphrase anything the license gate would
    read as a claim.

- [ ] **Regenerate, and keep only the intended diffs**

```bash
cd /c/Users/ravic/development/karmyq
npm run generate-docs --workspace=apps/landing > /tmp/s135-t12.txt 2>&1; echo "exit=$?"
git status --short apps/landing/src/data/docs/
```

Keep the four guides' JSON. Revert the timestamp / HEAD-sha churn everywhere else (`git restore` each file). Stage the
four with `git add -f` (the directory is gitignored but those files are tracked).

Commit: `docs(guides): a request's status follows its exchanges (Sprint 135)`.

---

## Task 13: CONTEXT.md, registry.json and BUGS.md

**Files:**
- Modify: `services/request-service/CONTEXT.md`, `services/registry.json`, `docs/BUGS.md`
- Regenerate: `services/dependency-graph.md`, `services/impact-analysis.md`

- [ ] **CONTEXT.md:**
  - **Recent Changes:** a `2026-11-01 (Sprint 135, BUG-075 + BUG-078)` entry. It covers the rule, the module, the ten
    writers, the new codes, `request_completed` no longer published, the tests (the promoted contract files and the
    root real-SQL file, CI-only on Windows), and no migration/dependency change.
  - **§2.3:** a *Request status* paragraph: the derivation, `cancelled` stays, and only `src/db/requestStatus.ts` writes
    it.
  - **§3.1** `PUT /requests/:id` (400 `STATUS_NOT_EDITABLE`) and `DELETE /requests/:id` (the two 409s, proposals closed,
    a pending dibs left alone).
  - **§3.3:** accept (409 `REQUEST_NOT_OPEN`), reject, complete (`COALESCE`), cancel (derived via the helper; update the
    implementation line numbers).
  - **The propose-match section (`:1478`):** 409 `REQUEST_NOT_OPEN`.
  - **§3.3b:** provider-offer accept (one transaction, 409).
  - **§3.3c:** the dibs status flow, `REQUEST_NOT_OPEN` / `INVALID_STATE`, and accept closing stale proposals.
  - **§10.4 Recent Fixes.**
- [ ] **registry.json:** turn each changed endpoint's entry into, or update it as, an object whose description names the
  guard and the new codes:
  - `PUT /matches/:id/accept`, `/reject`, `/complete`, and `DELETE /matches/:id`;
  - `POST /requests/:id/propose-match`, `PUT /requests/offers/:id/accept`;
  - `POST /requests/:id/dibs`, `PUT /requests/dibs/:id/accept`, `/decline`;
  - `PUT /requests/:id` and `DELETE /requests/:id`.
  - `request_completed` is already gone from `publishes` (Task 9).
- [ ] **cleanup-service CONTEXT.md:** a Recent Changes entry, and the *Expire Dibs* row (`:62`): the dibs write is
  guarded by `status = 'pending'`, and a dibs the provider settled first is left alone (no request write, no event).
- [ ] **BUGS.md:**
  - BUG-075 header: `fixed (Sprint 135, v11.108.0)`. Add a fix note naming the module and the ten writers. The 2026-10-29
    demo rows are not repaired (decision 4); a post-deploy recount is the check.
  - BUG-078 header: `fixed (Sprint 135, v11.108.0)`, with one line per item.
- [ ] **Regenerate the dependency analysis** (an event left the registry)

```bash
cd /c/Users/ravic/development/karmyq
npm run analyze:services > /tmp/s135-t13.txt 2>&1; echo "exit=$?"
git status --short services/
npm run feedback:check > /tmp/s135-t13-fb.txt 2>&1; echo "exit=$?"   # advisory; reads the staged diff, so stage first
```

Commit: `docs(requests): Sprint 135 status rule in CONTEXT, registry and BUGS (BUG-075, BUG-078 fixed)`.

---

## Task 14: SDLC quality gates

- [ ] **`/simplify`** on the branch diff (one pass; the diff is substantial, so run it after Task 13). Apply real fixes;
  write a reason for each skip. Verify: `npm test` still exits 0 after any change.
- [ ] **`/code-review high`** on the branch diff (`origin/master...HEAD`). Risky diff: concurrency on every request
  writer. Resolve every correctness finding, or dismiss it with a written reason. Verify: findings and dispositions are
  recorded in the PR body.
- [ ] **`/security-review`** on the branch diff. Resolve real findings, justify dismissals. Verify: recorded in the PR
  body.
- [ ] Re-run the root gates after any review fix: `npm test --workspace=tests` (~1 min). They read other workspaces'
  source.

Commit each fix separately: `fix(requests): <finding> (Sprint 135 review)`.

---

## Task 15: Final verification

```bash
cd /c/Users/ravic/development/karmyq
npm test > /tmp/s135-t15-test.txt 2>&1; echo "exit=$?"            # unit + regression across the repo; read the failing suite names, never just the tail
(cd services/request-service && npx tsc --noEmit); echo "tsc=$?"
npm exec --workspace=tests -- jest --runTestsByPath regression/doc-context-drift-gate.test.ts regression/sprint-133-pr-q-event-routes.test.ts regression/sprint-134-pr-k-claim-gate.test.ts > /tmp/s135-t15-gates.txt 2>&1; echo "exit=$?"
git status --short apps/landing/src/data/docs/   # revert any generated churn the test run produced
```

All exit 0. Name every flake you rerun, and the reason.

---

## Task 16: Handoff, push, PR, stop

- [ ] **Update `.claude/handoff/CURRENT_HANDOFF.md`:**
  - outcome "PR open, awaiting review and merge", with links to the spec and plan;
  - each gate's disposition and test evidence (the commands above, with their results);
  - the one human check that tests cannot prove: **after deploy, one read-only demo recount** (its own authorization) of
    the three 2026-10-29 counts, plus "new rows since the deploy". The counts may not grow from rows created after the
    deploy.
  - Set the next-chat instruction: `gh pr checks <n>`, the real-SQL file's first CI result, then the post-merge record.
- [ ] **Push and open the PR**

```bash
git push -u origin agent/claude/sprint-135-pr-request-status-guards
```

  - Open the PR with the repository's template and the contract headers `pr-contract.yml` checks.
  - Title: `fix(requests): every request-status writer is guarded and the status is derived (BUG-075, BUG-078, v11.108.0)`.
  - The body covers: the rule, the ten writers, the new codes, the allowlist re-pin, what is CI-only, the gate
    dispositions, and the post-deploy recount.
  - End it with the attribution line.
- [ ] **Stop.** Report the PR link. Don't watch CI, ask for a merge, or do post-merge work in this chat.
