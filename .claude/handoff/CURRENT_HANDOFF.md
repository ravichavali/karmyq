# Sprint 135 — Request Status Guards (BUG-075 + BUG-078) — Handoff

**Date**: 2026-11-01
**Outcome**: planned. The **planning + security PR** (this branch) is open, awaiting review and the maintainer's merge.
After it merges, the next chat executes the plan from a fresh branch.

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
| **Branch (now)** | `agent/claude/sprint-135-planning`: the **planning + security PR** (v11.107.0). It carries the #325 post-merge record (`a5138acd`), BUG-082 (`f707340e`), the Sprint 134 archive (`22c07c90`), the Sprint 135 spec + plan + handoff, and the follow-redirects 1.16.2 fix (the PR F #310 pattern). It was cut from `origin/master` `965cdf2d` as `agent/claude/sprint-135-pr-request-status-guards` and renamed before its first push. |
| **Branch (execution)** | `agent/claude/sprint-135-pr-request-status-guards`, cut **fresh from `origin/master` after the planning PR merges** (plan Task 1). Provisional v11.108.0. |
| **Base** | `origin/master` at `965cdf2d` (#325, v11.106.0; fetched 2026-11-01). |
| **Active editor** | **Claude** planned it and built the security fix (2026-11-01). The executing chat becomes the active editor. |
| **Reviewer role** | Codex (non-author), relayed by the maintainer. |
| **Owned paths** | `services/request-service/**`, `services/cleanup-service/src/jobs/expireDibs.ts` + its new test + its CONTEXT.md, the root `tests/integration/` file this sprint adds, `docs/guides/`, `docs/BUGS.md`, this handoff, the spec and plan. |
| **Shared resources needed** | Version bump (re-derive from `origin/master` at merge). Merge slot. One read-only demo recount after deploy (its own authorization). Dependency lane: **Claude** (maintainer-designated). The planning PR changes one lock node (follow-redirects) plus the root version; the execution PR changes no manifest or lockfile entry beyond the root version. No ADR number (one service). |
| **Merged branches safe to delete** (maintainer's call) | `agent/claude/sprint-134-pr-bug-077-badge-insert`: head `afbaed7a`, same tree as `965cdf2d` (`cc350727`). Older Sprint 134 branches: see the archived handoff's Ownership row. |

## Decisions (maintainer, 2026-11-01)

- **Scope: all ten request-status writers** in request-service: match accept, reject, complete (finalize and the repeat
  done mark), admin propose-match, dibs create, dibs accept, dibs decline and the test-only expire, provider-offer accept,
  `PUT /requests/:id` (status from the body) and `DELETE /requests/:id` (requester cancel). A gate test fails on any
  request-status write outside the reviewed list. cleanup-service's expiry jobs were presented as already guarded. The
  planning review found the dibs job's **dibs** write unguarded (`expireDibs.ts:37-42`), so it gains one guard. That is a
  correction to a claim, not a new decision; the maintainer can veto it (spec *Decisions → Corrections*).
- **Planning review (2026-11-01, `/code-review` medium; 9 findings, 6 fixed, 1 partly):**
  - preconditions read the **derived** status;
  - dibs accept judges expiry with the wall clock, and answers 410 on an expiry during a lock wait;
  - the requester cancel binds `requester_id` and expires the ask's pending dibs (dibs-first lock);
  - the 400 for a status edit comes after the ownership check;
  - the gate also catches a status pushed into a dynamic `SET` builder.
  Dismissed with reasons (spec critical notes 4 and 12):
  - the redundant re-lock / no-op rewrite;
  - the `notDirectedSql` loss on the dibs paths (dibs rows exist only for non-directed requests).
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
2. **If the planning + security PR is still open,** handle its CI or review first, on `agent/claude/sprint-135-planning`.
   After it merges, record its post-merge facts (deploy, CodeQL on the merge sha, Dependabot) as the first commit of the
   execution branch.
3. **Once it has merged,** cut `git switch -c agent/claude/sprint-135-pr-request-status-guards origin/master` (plan
   Task 1). Never branch off a stale local master; unpushed local-master commits leak in via the squash-merge. Then open
   the plan linked above.
4. Invoke `superpowers:subagent-driven-development` (or `superpowers:executing-plans`) directly.
   There is no `/execute-plan` slash command; superpowers removed it as a deprecated stub.

**Next unchecked task**: Task 1, branch check and provisional version bump (11.107.0 → 11.108.0, `package.json` and two
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

## Verification references (planning, 2026-11-01)

- The status-write inventory was produced with the repo's own scanner
  (`services/request-service/tests/helpers/directedSurfaceScan.ts`), run through Node 24 type stripping. It found 14
  statements (11 status writes, 3 dynamic `SET`s). The gate's parser passed all nine negative fixtures in a dry run.
- No application code changed in planning. Besides docs (the #325 record `a5138acd`, BUG-082 `f707340e`, the Sprint 134
  archive `22c07c90`, and this spec, plan and handoff), the branch changes only the root version and one lock node
  (follow-redirects 1.16.2; *Dated obligations*).

## Dated obligations

- **`follow-redirects` GHSA-mrwp-f3q8-3g9p (HIGH, CVE-2026-116689)** found 2026-11-01 by the root regression run.
  - Published 2026-10-30 22:59:33Z. Range `>=1.16.0 <=1.16.1`; patched in 1.16.2 (on npm).
  - The lock has one node, `node_modules/follow-redirects` 1.16.1, pulled in only by root `axios@1.20.0`. No override.
  - Dependabot has not raised an alert yet (0 open, 2026-11-01).
  - **It fails both ADR-059 gates** (`sprint-75-security-gate`, `sprint-123-audit-exemption-gate`), so it blocks the
    pre-push hook and CI on every branch, this one included.
  - **High SLA: about 2026-11-06 23:00Z.**
  - **Maintainer, 2026-11-01:** fix it in a small PR, bundled with the planning docs; no bypass push.
  - **FIXED on this branch (v11.107.0).** An in-place splice of one node: `node_modules/follow-redirects` `version`,
    `resolved`, `integrity`. Every other lock field is identical between 1.16.1 and 1.16.2 (`npm view`), and axios's
    declared `^1.16.0` admits 1.16.2, so no manifest changes and no override.
  - **Proof: the author's validation on `0f7bba16`, 2026-11-01, not independently rerun.**
    - node-level diff: 2 of 1878 nodes changed (root `version`; follow-redirects), key and field order identical;
    - strict `npx npm@11.19.0 ci` exit 0, with 1.16.2 on disk;
    - `npm ls --all` problems identical to the pre-change baseline (179 lines, mostly unmet platform-specific optional
      deps);
    - `node scripts/audit-exemptions.js` exit 0, "0 high/critical";
    - no other tracked lockfile holds follow-redirects.
  - **What the lock change adds:** no runtime dependencies and no install scripts. `resolved` is the canonical registry
    URL, and `integrity` matches the published tarball (`npm view`). CI's strict `npm ci` is the independent check.
  - **Gates on this PR (2026-11-01):**
    - `/simplify`: clean, inline; there is no source code.
    - `/code-review` medium: 9 findings, all on the Sprint 135 plan's design. 6 fixed, 1 partly, 2 dismissed with reasons
      (`3829d65d`; see *Decisions*).
    - `/security-review`: no HIGH or MEDIUM.
    - A relayed independent check (2026-11-01) agreed. It corrected two wordings, applied here: "adds no attack surface"
      became "no runtime dependencies or install scripts", and the `npm ci` result is attributed to the author's run.
  - **Due on merge:** confirm the deploy, read the merge-sha CodeQL analyses, and confirm 0 open Dependabot alerts.

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
