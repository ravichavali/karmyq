# Sprint 135 — Request Status Guards (BUG-075 + BUG-078) — Handoff

**Date**: 2026-11-01
**Outcome**: **PR open, awaiting review and the maintainer's merge.** The execution PR is opened from this branch
(`gh pr view agent/claude/sprint-135-pr-request-status-guards`), v11.108.0. All 16 plan tasks are done, plus the bundled
glob/minimatch fix, and all four gates have run (*Execution record*). The planning + security PR
[#326](https://github.com/ravichavali/karmyq/pull/326) merged as `20d930ce` (v11.107.0) and deployed green.

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
| **Branch (now)** | `agent/claude/sprint-135-pr-request-status-guards`, the **execution branch**, cut fresh from `origin/master` `20d930ce` on 2026-11-01. v11.108.0 (re-derive at merge). Its first commit is the #326 post-merge record. PR open. |
| **Branch (planning, merged)** | `agent/claude/sprint-135-planning`, head `5a3589ef`, squash-merged as `20d930ce` (#326). Safe to delete (maintainer's call). |
| **Base** | `origin/master` at `20d930ce` (#326, v11.107.0; fetched 2026-11-01). |
| **Active editor** | **Claude** (the executing chat, 2026-11-01). |
| **Reviewer role** | Codex (non-author), relayed by the maintainer. |
| **Owned paths** | `services/request-service/**`, `services/cleanup-service/src/jobs/expireDibs.ts` + its new test + its CONTEXT.md, the root `tests/integration/` file this sprint adds, `docs/guides/`, `docs/BUGS.md`, `claude.md` + `AGENTS.md` (the process policy only), this handoff, the spec and plan. |
| **Shared resources needed** | Version bump (re-derive from `origin/master` at merge). Merge slot. One read-only demo recount after deploy (its own authorization). Dependency lane: **Claude** (maintainer-designated). The planning PR changed one lock node (follow-redirects) plus the root version. The execution PR changes the root version **and, by the maintainer's decision of 2026-11-01, the glob/minimatch fix** (*Dated obligations*), a recorded scope expansion. No ADR number (one service). |
| **Merged branches safe to delete** (maintainer's call) | `agent/claude/sprint-134-pr-bug-077-badge-insert`: head `afbaed7a`, same tree as `965cdf2d` (`cc350727`). Older Sprint 134 branches: see the archived handoff's Ownership row. |

## Decisions (maintainer, 2026-11-01)

- **Scope: all ten request-status writers** in request-service: match accept, reject, complete (finalize and the repeat
  done mark), admin propose-match, dibs create, dibs accept, dibs decline and the test-only expire, provider-offer accept,
  `PUT /requests/:id` (status from the body) and `DELETE /requests/:id` (requester cancel). A gate test fails on any
  request-status write outside the reviewed list. cleanup-service's expiry jobs were presented as already guarded. The
  planning review found the dibs job's **dibs** write unguarded (`expireDibs.ts:37-42`), so it gains one guard. That is a
  correction to a claim, not a new decision. **Kept (2026-11-01):** it belongs with the status-consistency work.
- **Process policy (maintainer, 2026-11-01), codified in this sprint's execution PR** (plan Task 13; exact text there) as
  a recorded scope expansion:
  - `CLAUDE.md` gains **Bundle by default**. A security fix may get its own PR only when nothing else merges inside its
    SLA, or when it blocks every push now; that PR may include ready, reviewed work that won't delay the fix. Bundling
    into an existing PR respects its agreed scope and branch ownership, and any scope expansion is recorded explicitly.
  - `CLAUDE.md` *Chat cadence* allows **one-chat planning + execution** for small, well-understood fixes with clear
    acceptance criteria and no unresolved design decision. Tests, review gates and the handoff still apply; larger or
    uncertain work keeps separate chats.
  - `CLAUDE.md` *Session Workflow* requires **every chat to end with a next-chat prompt**: a ready-to-paste prompt
    (branch or PR, first command, the handoff's next step, any pending authorization) that agrees with this handoff's
    Quick Start.
  - `AGENTS.md` points to all three rather than restating them.
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
- **glob + minimatch alerts: bundle into this PR** (maintainer, 2026-11-01, asked in the execution chat). Two medium
  alerts opened on #326's merge push (*Dated obligations*). The fix lands after the plan's Task 13 and before the
  Task 14 gates, so every gate covers it. It is the PR's fourth recorded scope expansion. If the new majors break jest,
  eslint or Expo, it is backed out and reported rather than delaying the PR.

## Links

- **Spec**: [`docs/superpowers/specs/2026-11-01-sprint-135-request-status-guards-design.md`](../../docs/superpowers/specs/2026-11-01-sprint-135-request-status-guards-design.md)
- **Plan**: [`docs/superpowers/plans/2026-11-01-sprint-135-request-status-guards.md`](../../docs/superpowers/plans/2026-11-01-sprint-135-request-status-guards.md) (16 tasks)
- **PR**: execution PR open from this branch (`gh pr view agent/claude/sprint-135-pr-request-status-guards`).
  Planning + security [#326](https://github.com/ravichavali/karmyq/pull/326) merged `20d930ce`.

## Quick Start

1. Read this handoff, then confirm live state before trusting it:
   `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`.
2. `gh pr checks agent/claude/sprint-135-pr-request-status-guards`. At `7a251553` the PR is **all green**: CI run
   41576808610, with Integration Tests at 23 suites and 368 tests. That run includes the Sprint 135 real-SQL file:
   - the corrected refusal cases and the two-provider case;
   - the dibs-expiry race (410, 2,008 ms).
   The independent review has **no remaining code findings** (round 2, 2026-11-02). The file is CI-only on Windows.
3. **If the PR is still open:** only CI red on a later push, or new review findings, need work on this branch: fix, push,
   stop. A red integration case means a real behaviour gap, or a fixture that disagrees with `init.sql`. Read it; never
   weaken the assertion. The expiry race allows a 2-second window: a CI stall can fail it, but cannot make it pass falsely.
4. **Once it merges:** record the post-merge facts (deploy + health, merge-sha CodeQL, Dependabot) as the first commit
   of the next branch, cut from `origin/master`. No docs-only master push.

**Next unchecked task**: none on this branch: the PR's CI and review. The open maintainer decisions are under *Open after
this PR*.

**Stopping point = PR creation** (maintainer, standing). This chat stopped there.

**Human check after deploy** (the only thing tests cannot prove; its own authorization): one read-only demo recount of
the 2026-10-29 counts, plus the same counts restricted to rows created after the deploy. The post-deploy counts must
stay at zero under the simulation's traffic.

## Execution record (2026-11-01 → 11-02, executing chat)

Executed with `superpowers:subagent-driven-development`: a fresh implementer per task (or batch), a task review after
each, and fix rounds where needed. Commit range `20d930ce..HEAD`.

| Plan task | Commits | Review |
|---|---|---|
| #326 post-merge record | `7a0b9db3` | — |
| T1 version 11.108.0 | `c734cea8` | controller, inline |
| T2–T4 red tests (helper, gate, writers, real-SQL) | `9e692358`, `a568d774`, `ea969d6a`, `ed830862` | 1 fix round (presence assertions) |
| T5 `requestStatus.ts` | `dc0d7cab` | clean |
| T6 match routes | `daae0f40` | clean |
| T7 propose-match + provider-offer accept | `f6bbc6ab` | clean |
| T8 dibs routes + cleanup dibs guard | `067cffc2`, `ae9be5ca` | clean |
| T9 request edit/cancel + registry event | `8523dd08` | clean |
| T10 regressions, allowlist re-pin, BUG-074 fixtures | `69d02820` | clean (no assertion weakened; 4 new + 8 stale allowlist entries, exactly as planned) |
| T11 promote to regression | `4e31729a` | controller (targeted `git mv` of the 4 files; the promoter would sweep every green tdd file) |
| T12–T13 guides, CONTEXT, registry, BUGS, CLAUDE.md/AGENTS.md policy | `e7f88983`, `22a3689c`, `ba77cea7` | 1 fix round (stale `request_completed` event row; derived landing JSON) |
| **T13b glob/minimatch fix** (bundled) | `99815d73` | clean |
| T14 `/simplify` | `ce8e67c2` | 1 fix (stale dibs route header comments); 13 suggestions skipped with reasons |
| T14 `/code-review high` (the final whole-branch review) | `3d608f9c`, `8a25d55c`, `e39058fe` | 10 findings: 1 fixed in code (below), 6 cheap test/doc follow-ups, 4 logged as BUG-083..086, the rest kept per spec; scoped re-review clean |
| T14 `/security-review` | — | **No findings** at High/Medium. Checked: authorization order of all ten writers vs `20d930ce`, parameter binding, directed audience on the dibs paths, ADR-102 |

**The one review fix in code (`3d608f9c`):** the requester cancel could take the request lock and then wait on a dibs row
created in a gap, a deadlock against a dibs accept. Its dibs expiry now selects `FOR UPDATE SKIP LOCKED`, so it never
waits. A skipped dibs stays `pending` on the cancelled ask, and its accept answers 409.

**Kept as spec'd, despite review suggestions:**
- reconcile writes status only (BUG-083 records the retention-clock consequence);
- cancelling a cancelled ask answers 409 (decision 3);
- the dibs-create fast path reads the stored status;
- the derivation literal appears twice (the gate and allowlist pin both).

**Test evidence (Windows box; the real-SQL file is CI-only):**
- request-service regression: 59 suites, 521 passed, 1 skipped; tsc 0. cleanup-service: regression green; tsc 0.
- Root `npm test --workspace=tests`: 101 passed. Drift + license gates: 68 passed. ADR-059 audit gate: 0 high/critical.
- Mutation proofs: removing `SKIP LOCKED` fails 2 writer tests. Each glob/minimatch floor-gate case fails under its
  fault injection (9 injections).
- Full `npm test`: see the PR body (run at the end of this chat).

**glob + minimatch (`99815d73`):**
- Overrides: `minimatch >=11.0.1`, `glob >=14.0.2`. A scoped `babel-plugin-module-resolver: { glob: { ".": "^9.3.3",
  minimatch: "10.2.5" } }` keeps that one dev subtree as it was.
- The lock is spliced in place: 3 nodes changed, 2 added, 19 orphans removed (glob 10's chain). `libc` count 26 → 26.
  npm 11.19.0's own re-resolve is a fixed point (identical sha256). Strict `npx -y npm@11.19.0 ci` exits 0.
- Proofs: `npm test --force` 27/27; lint parity with the baseline; mobile jest and the Babel alias transform pass;
  `expo config` and `@expo/fingerprint` are identical to the baseline. `npm audit`: 46 findings → 14.
- **Residual, forced:** module-resolver 5.0.3 (latest) needs glob 9's `default` export. glob 9 combined with minimatch 11
  silently returns `[]` for every magic pattern (reproduced). So glob 9.3.5 + minimatch 10.2.5 stay on that dev-only
  subtree, and **alerts #179 and #180 stay open after merge.**
- `npm ls` shows a few extra "invalid" lines: arborist's override-scope conflict check. Every edge satisfies its range,
  and no CI step runs `npm ls`. Not a defect.
- **Process breach:** the implementer ran code from the downloaded minimatch 11 tarball in a scratch sandbox, which
  breaks the untrusted-download rule. The review of 2026-11-02 rejected the claim that "same package" makes the added
  risk negligible, and it stands as a breach. Future dependency briefs forbid executing downloaded code: behavioural
  checks run on the integrity-verified install.

## PR #327 review round 1 (2026-11-02)

CI run 41571898963 (head `fad885e5`): **Integration Tests failed, 11 failures across 2 suites** (356 passed). The
independent review relayed by the maintainer requested changes. Each finding was verified against the repo:
- **P1 (confirmed):** nine Sprint 135 refusal cases set a stored status with no backing rows, so the derived status is
  `open`. Fix: backing rows (a pending dibs, a matched or a completed exchange by H2); where a case expected no matches,
  it now compares the ask's rows before and after.
- **P2 (confirmed):** dibs accept checked liveness on the dibs row, then waited on the request lock, so a wait past
  `expires_at` still accepted. Fix: the guarded UPDATE also requires `expires_at > clock_timestamp()`. Under the dibs
  row lock, a miss can only mean expiry, which answers 410. A real-SQL race test holds the request lock until the
  invitation expires.
- **P2 (confirmed):** the second-provider case inserted two offers for the same `(provider_user_id, request_id)`, which
  `uq_provider_offers_active` forbids. Fix: a second provider, P2.
- **11th failure, Sprint 126 "dry run is provably read-only": cause proven, not this PR.**
  - reputation-service's daily `trustScoreRefresh` cron (`'30 3 * * *'`, `trustScoreRefresh.ts:59`) fired inside the
    CI test container while that test ran (03:29:56–03:30:03Z).
  - The container log reads "Trust-score refresh complete: 9 evaluated, 0 failed". 9 is exactly the suite's seeded
    memberships.
  - The rows that appeared are those 9 pairs with score 0.
  - A run fails this way when the refresh lands between the test's two fingerprints. Spanning 03:30 is necessary but
    not sufficient. Logged as BUG-087 (fix direction: keep crons off in the test compose). Fixing it would touch
    reputation-service and the test infrastructure, outside this PR's agreed scope.

**Round 1 result:** CI run 41576808610 on `7a251553` is all green: Integration Tests 23 suites / 368 tests, unit and
regression, security gates, the landing build, and seven Docker builds. Sprint 126 passed in that run. The review's
round 2 (2026-11-02) has no remaining code findings. It asked only for this handoff, the PR ledger and BUG-087's timing
wording to be corrected (done in the following docs commit).

## Open after this PR (maintainer decisions)

- **#179 / #180 residual (medium, SLA ~2026-11-13):**
  - (a) dismiss both as `tolerable_risk`. Reason: dev-only, the mobile Babel alias resolver only, static root `./`, no
    AbortSignal, no untrusted patterns. Or (b) replace babel-plugin-module-resolver (Expo's tsconfig paths) in a mobile
    sprint.
  - A dismissal needs your explicit yes.
- **BUG-087** (logged 2026-11-02): the Sprint 126 dry-run integration test fails when reputation's 03:30 trust-score
  refresh overlaps its fingerprint window in the CI stack. The fix touches reputation-service plus
  `tests/docker-compose.test.yml`, outside this PR's scope.
- **BUG-083..086** (logged 2026-11-01, not scheduled):
  - 083: completed-request retention runs from the last edit, not from completion;
  - 084: POST /matches pre-read race strands an offer;
  - 085: the derived `open` ignores `expired`;
  - 086: clients still declare `status` on `updateRequest`. An `api.ts` edit risks a CodeQL re-raise, so it belongs in a
    frontend PR.

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
- **Also in #326: a DST test fix** (`e76a8790`). `services/cleanup-service/tests/unit/reputationDecayJob.test.ts`
  compared the job's calendar-day cutoff (`setDate(-90)`) with a fixed 90 × 24 h. It has failed on the Windows box
  (America/Los_Angeles) since DST ended on 2026-11-01, which blocked the pre-push hook; CI runs in UTC and never saw it.
  - Proof: before, 1 failed in LA and green under `TZ=UTC`; after, green in both. An injected 91-day job fails by
    86,400,000 ms.
  - It was the only tight comparison of this kind; `Date.now() - N * 24 * 60 * 60 * 1000` appears elsewhere only as
    fixture timestamps.
- **Process (maintainer, 2026-11-01):** small PRs are costing dev time; bundle better. The rule is decided (see
  *Decisions*) and goes into `CLAUDE.md` / `AGENTS.md` in the Sprint 135 execution PR.
- **#326 review scope.** The `/code-review` and `/security-review` runs and the relayed independent check covered the
  branch through `3829d65d` (lockfile + docs). `e76a8790` (the DST test fix) and the later handoff and plan commits came
  after them, so **the final review must cover `965cdf2d...` the PR head**, including `e76a8790`. The PR body names the
  final head.

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
  - **CLOSED by #326** (*#326 post-merge record* below). The high SLA (~11-06) is met.

### #326 post-merge record (verified live 2026-11-01, ~21:25Z)

- **Merged** 2026-11-01T20:59:46Z as `20d930ce` (v11.107.0), from head `5a3589ef`.
- **CI/CD 41349664849: success**, 14/14 jobs, 20:59:49Z → 21:19:54Z. Deploy to Demo logged "DEPLOYMENT SUCCESSFUL"
  (rollback point `20d930ce`, not used), and the health verify passed **all 9 services** (auth, community, request,
  reputation, notification, messaging, cleanup, geocoding, social-graph). `Tests` 41349664854: success.
- **CodeQL on `20d930ce`**: `/language:javascript-typescript` (467 results, 21:02:05Z) and `/language:actions` (0,
  21:00:21Z), both with an **empty `error`**. The `4ee38e82` "Unknown Error" quirk did not recur. **0 open
  code-scanning alerts** on master.
- **Dependabot: 2 open alerts, not 0.** Both opened at 20:59:52Z on the merge push (next entry). Dependabot's own update
  runs for them failed (41349676330 minimatch, 41349678067 glob): the fixes cross a major, and the config is
  security-only. No follow-redirects alert was ever raised for GHSA-mrwp; the only follow-redirects alert is #87
  (GHSA-r4q5, fixed 2026-05-11).

### glob + minimatch (MEDIUM; maintainer: bundle into this PR, 2026-11-01)

- **#179 `glob` GHSA-3g3m-2fjr-6pw4** "AbortSignal cancellation bypass allows post-timeout filesystem traversal".
  Range `>= 9.0.0, <= 14.0.1`, patched **14.0.2**. No backport: the newest 10.x is 10.5.0 and the newest 9.x is 9.3.5.
- **#180 `minimatch` GHSA-g3hv-75wg-m249** "potential denial of service via globparts amplification". Range `< 11.0.1`,
  patched **11.0.1**. No backport.
- Both were published 2026-10-30 ~23:09Z. **Medium SLA (≤ 2 weeks): ~2026-11-13.** ADR-059 gates high+ only, so
  neither blocks a push.
- **Lock nodes (verified at `20d930ce`):**
  - `glob` 13.0.6 hoisted (Expo `@expo/cli`, `config`, `config-plugins`, `fingerprint`, `metro-config` `^13.0.0`;
    jest `@jest/reporters`, `jest-config`, `jest-runtime` `^13.0.6`);
  - nested `test-exclude/node_modules/glob` 10.5.0 (`^10.4.1`);
  - nested `babel-plugin-module-resolver/node_modules/glob` 9.3.5 (`^9.3.3`).
  - `minimatch`: one node, 10.2.5, forced by the root override `"minimatch": ">=9.0.5"` for every consumer (eslint
    `^3.1.x`, typescript-estree, nodemon, `@expo/fingerprint`, glob).
- **Exposure:** no source file imports either package (repo grep, 2026-11-01). They are reached only through tooling
  (jest, eslint, nodemon, Expo CLI) on patterns we write.
- **What the fix needs:** glob 14.x needs `minimatch ^11.0.2`, `path-scurry ^3.0.0` and `minipass ^7.1.3`. minimatch
  11.x needs `brace-expansion ^5.0.12` (already pinned) and a new `@isaacs/nonrecursive-glob-match`. Both engines are
  `18 || 20 || >=22`. New lock nodes are needed, so it is an in-place splice with overrides, proven by strict
  `npx npm@11.19.0 ci`, `npm ls --all` parity, the full suite and lint.
- **FIXED on this branch (`99815d73`), except a forced residual:** module-resolver's dev-only glob 9.3.5 + minimatch
  10.2.5 (*Execution record*). Both alerts stay open after merge, pending the maintainer's decision (*Open after this PR*).

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
