# Sprint 135 — Request Status Guards (BUG-075 + BUG-078) — Handoff

**Date**: 2026-11-01
**Outcome**: planned (spec, plan and this handoff are on the branch); the next chat executes the plan

> The handoff carries **state between sessions**. It is not a copy of the plan: it links the plan and names the next
> unchecked task. It is branch-local, so it can reserve nothing; see `CLAUDE.md` → *Parallel Development* for how
> contended resources are actually allocated. Git and PR state (`gh pr list`, `git log origin/master`) outrank anything
> written here. No parallel lanes are active.

**Previous**: Sprint 134 COMPLETE, closed by the maintainer on 2026-11-01 (archived:
[`archive/2026-11-01-sprint-134-dated-obligations-COMPLETE-v11.106.0.md`](archive/2026-11-01-sprint-134-dated-obligations-COMPLETE-v11.106.0.md)).
Last shipped: #325 `965cdf2d` (v11.106.0), CI/CD 40997981236 green 14/14; PR L2's nightly validation passed from the DB
on 2026-11-01.

**Sprint goal:** every request-status write in request-service is guarded, and the request's status is derived from its
matches and dibs, so a completed or cancelled ask can no longer be reopened, re-matched or overwritten.

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-135-pr-request-status-guards` |
| **Base** | `origin/master` at `965cdf2d` (#325, v11.106.0; fetched 2026-11-01). First commits: the #325 post-merge record (`a5138acd`), BUG-082 (`f707340e`), then this sprint's planning. |
| **Active editor** | **Claude** planned it (2026-11-01). The executing chat becomes the active editor. |
| **Reviewer role** | Codex (non-author), relayed by the maintainer. |
| **Owned paths** | `services/request-service/**`, the root `tests/integration/` file this sprint adds, `docs/guides/`, `docs/BUGS.md`, this handoff, the spec and plan. |
| **Shared resources needed** | Version bump (re-derive from `origin/master` at merge). Merge slot. One read-only demo recount after deploy (its own authorization). Dependency lane: **Claude** (maintainer-designated); this PR changes no manifest or lockfile entry beyond the root version. No ADR number (one service). |
| **Merged branches safe to delete** (maintainer's call) | `agent/claude/sprint-134-pr-bug-077-badge-insert`: head `afbaed7a`, same tree as `965cdf2d` (`cc350727`). Older Sprint 134 branches: see the archived handoff's Ownership row. |

## Decisions (maintainer, 2026-11-01)

- **Scope: all ten request-status writers** in request-service: match accept, reject, complete (finalize and the repeat
  done mark), admin propose-match, dibs create, dibs accept, dibs decline and the test-only expire, provider-offer accept,
  `PUT /requests/:id` (status from the body) and `DELETE /requests/:id` (requester cancel). A gate test fails on any
  request-status write outside the reviewed list. cleanup-service's expiry jobs are already guarded and stay as they are.
- **Approach: guarded writes plus one shared reconcile.** Each writer changes its own row with a conditional `UPDATE`
  (BUG-074 style; 409 when the guard misses). One shared helper then derives the request status under the request row
  lock: `cancelled` stays `cancelled`; otherwise `matched` > `completed` > `dibs_pending` > `open`. Cancel's existing
  `CASE` becomes that helper. No ADR (one service); the rules go in CONTEXT.md and the guide.
- **Requester cancel while an exchange is in progress: refuse** with 409 `REQUEST_HAS_ACTIVE_EXCHANGE` (cancel the
  exchange first). A completed ask also answers 409. Proposals on an open ask are rejected, and their offers freed, when
  it is cancelled.
- **Demo rows: no repair.** After deploy, one read-only recount shows no new inconsistent rows appear under the
  simulation's traffic. Any repair is a separate authorized operation, or the curated reset (demo stories runway
  ~2026-12-18) clears them.

## Links

- **Spec**: [`docs/superpowers/specs/2026-11-01-sprint-135-request-status-guards-design.md`](../../docs/superpowers/specs/2026-11-01-sprint-135-request-status-guards-design.md)
- **Plan**: [`docs/superpowers/plans/2026-11-01-sprint-135-request-status-guards.md`](../../docs/superpowers/plans/2026-11-01-sprint-135-request-status-guards.md) (16 tasks)
- **PR**: none yet

## Quick Start

1. Read this handoff, then confirm live state before trusting it:
   `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`.
2. Reuse the existing branch: `git switch agent/claude/sprint-135-pr-request-status-guards`. Never branch off a stale
   local master; unpushed local-master commits leak in via the squash-merge. If `origin/master` moved past `965cdf2d`,
   merge it in (merge commit, never rebase + force).
3. Open the plan linked above.
4. Invoke `superpowers:subagent-driven-development` (or `superpowers:executing-plans`) directly.
   There is no `/execute-plan` slash command; superpowers removed it as a deprecated stub.

**Next unchecked task**: Task 1, branch check and provisional version bump (11.106.0 → 11.107.0, `package.json` and two
lines of `package-lock.json`).

**Stopping point = PR creation** (maintainer, standing): run all gates, push this handoff marking the PR "open, awaiting
maintainer merge", open the PR, report the link and stop. The next chat starts with `gh pr checks <n>`.

**Human check after deploy** (the only thing tests cannot prove; its own authorization): one read-only demo recount of
the 2026-10-29 counts, plus the same counts restricted to rows created after the deploy. The post-deploy counts must
stay at zero under the simulation's traffic.

## Critical implementation notes (from the spec, verbatim)

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

## Verification references (planning, 2026-11-01)

- The status-write inventory was produced with the repo's own scanner
  (`services/request-service/tests/helpers/directedSurfaceScan.ts`), run through Node 24 type stripping. It found 14
  statements (11 status writes, 3 dynamic `SET`s). The gate's parser passed all nine negative fixtures in a dry run.
- No code changed in planning. The branch's only changes are docs: the #325 record (`a5138acd`), BUG-082 (`f707340e`),
  the Sprint 134 archive (`22c07c90`), and this spec, plan and handoff.

## Dated obligations

- **`follow-redirects` GHSA-mrwp-f3q8-3g9p (HIGH, CVE-2026-116689)** found 2026-11-01 by the root regression run.
  - Published 2026-10-30 22:59:33Z. Range `>=1.16.0 <=1.16.1`; patched in 1.16.2 (on npm).
  - The lock has one node, `node_modules/follow-redirects` 1.16.1, pulled in only by root `axios@1.20.0`. No override.
  - Dependabot has not raised an alert yet (0 open, 2026-11-01).
  - **It fails both ADR-059 gates** (`sprint-75-security-gate`, `sprint-123-audit-exemption-gate`), so it blocks the
    pre-push hook and CI on every branch, this one included.
  - **High SLA: about 2026-11-06 23:00Z.**
  - Likely fix: a one-node splice to 1.16.2, as in PR F #310 (1.16.0 → 1.16.1), proven by strict `npm ci` and both
    gates.
  - Dependency lane: Claude (maintainer-designated). **Which PR carries the fix is the maintainer's decision.**
  - **This planning branch is committed but not pushed:** the pre-push hook fails on the advisory, and bypassing it
    needs the maintainer's say-so.

## Open, not scheduled (carried from Sprint 134)

- **BUG-073** tabled (maintainer, 2026-10-26): community admin and platform admin become separate roles, as a future
  feature (`docs/IDEAS.md` 2026-10-26).
- **BUG-076** (pre-push TDD false pass), **BUG-080** (provider completion rate counts a status never written),
  **BUG-081** (trust-config readers return NUMERIC strings typed as `number`; latent), **BUG-082** (the per-query SQL
  log in five services floods the log; the reputation log loses the 02:00Z nightly by 03:30Z).
- **PR C** (scheduled exemption re-check evidence): the exemption registry on master is empty, so it may have no work
  left.
- **PR D's D8** is blocked on the host persona: `DEMO_UNRELATED_EMAIL` in the host's `.env.demo.rotation` names a
  pre-reset account; the guide wants Marcus Lee (`docs/guides/demo-data.md:253`). Fixing it is a host write, and each
  rerun is its own authorization.
- **Expo drift #316** awaits a maintainer decision (dependency lane: Claude).
- **Per-community health-quality weight**: needs an ADR number from the maintainer and a quality-signal decision.
- `deepmerge` alert #178 (dismissed `tolerable_risk`): re-check at the next Expo SDK move or by 2026-12-01.

## Standing rules

Every demo-host operation, merge, exemption renewal, CodeQL dismissal and ADR number needs explicit per-operation authorization.
Never push docs-only to master; fold docs into the next PR. Reconcile this handoff against `gh pr list` / `git log` after every
merge and at session end.
