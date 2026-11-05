# Sprint 137 — Exchange Integrity — Handoff

**Date**: 2026-11-05
**Outcome so far**: **Tasks 1–9 executed and reviewed. Next: Task 10's full-suite sweep and targeted promotion.**
- Scope and decisions 1–3 were agreed with the maintainer on 2026-11-04.
- The spec, plan, BUG-088/090 corrections and the new BUG-091 entry are committed on this branch.
- Codex's plan review found three issues, and two re-reviews found one each. All five are confirmed and resolved in the
  spec and plan (see *Plan review*).
- A's closed/forgotten-request edit guard, B's offer integrity guards, C's locked provider-offer submit and D's
  expired-hold release are implemented with mocked-SQL proofs; the real-PostgreSQL proofs are written (Task 9) and
  first run in CI on the PR. No PR is open. Task 1 (`0499e524`) sets the three root version fields to
  provisional v11.110.0. Task 2 (`2e7a0c1f`) extends the scanner and adds the offer-status gate in the nonblocking
  tdd tier. Task 3 (`3a8a2542`) adds the compiling, assertion-red request-service contracts for A/B/C.

> The handoff carries **state between sessions**. It is not a copy of the plan: it links the plan and names the next
> unchecked task. It is branch-local, so it can reserve nothing; see `CLAUDE.md` → *Parallel Development* for how
> contended resources are actually allocated. Git and PR state (`gh pr list`, `git log origin/master`) outrank anything
> written here. No parallel lanes are active.

**Sprint goal:** close the four gaps the request-status guards leave (BUG-088, 089, 090 and 091) in one PR:
- an expired ask releases what it held;
- an offer's status follows its exchanges;
- a provider offer is written under the request lock;
- a completed or cancelled ask can't be edited.

**Spec:** [`docs/superpowers/specs/2026-11-04-sprint-137-exchange-integrity-design.md`](../../docs/superpowers/specs/2026-11-04-sprint-137-exchange-integrity-design.md)
**Plan:** [`docs/superpowers/plans/2026-11-04-sprint-137-exchange-integrity.md`](../../docs/superpowers/plans/2026-11-04-sprint-137-exchange-integrity.md)

**Previous**: Sprint 136 COMPLETE (merged `f19ca413`, v11.109.0; deploy green 9/9; #180/#179 cleared; #316 closed).
Archived: [`archive/2026-11-04-sprint-136-mobile-deps-and-status-followups-COMPLETE-v11.109.0.md`](archive/2026-11-04-sprint-136-mobile-deps-and-status-followups-COMPLETE-v11.109.0.md)
(it holds the #328 post-merge record and the corrected 2026-11-04 fix-forward account).

---

## Quick Start

1. Read this handoff. Then confirm live state:
   - `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`.
   - `gh issue view 329`. The first post-#328 scheduled drift run (2026-11-05 15:26Z; the cron says 07:15Z but runs
     have started ~15:00–17:00Z) failed on a **new** Expo patch train and filed #329 — not a regression of #328's
     pin; #316 stays closed. It gates no PR. Whether to take it is the maintainer's call (see *Open*).
2. Reuse the existing task branch: `git switch agent/claude/sprint-137-planning`. It is already cut from
   `origin/master` `f19ca413`. If master moved, merge it in with a merge commit, never a rebase. Never branch off a
   stale local master; unpushed local-master commits leak in via the squash-merge.
3. Open the plan: `docs/superpowers/plans/2026-11-04-sprint-137-exchange-integrity.md`.
4. Invoke `superpowers:subagent-driven-development` directly (or `superpowers:executing-plans`). There is no
   `/execute-plan` slash command; superpowers removed it as a deprecated stub.
5. Merges, ADR numbers, demo-host operations and dismissals each need explicit authorization. Stop at PR creation.

**Next unchecked task**: Plan Task 10 (each changed workspace's full suite; targeted `git mv` promotion of the three
Sprint 137 tdd files).
Execution moved from the Codex chat to a Claude Code chat on 2026-11-05 mid-Task 6, using the same SDD ledger
(`.superpowers/sdd/2026-11-04-sprint-137-exchange-integrity/progress.md`), sequential implementers and independent
reviewers. Codex has reviewed
the plan three times (`6d478a36`, `17f41af6`, `fcec0e28`). R2's fix (a stricter parse rule and
its negative fixtures) is mechanical, so no further plan review is planned. The PR's `/code-review` will cover the
implementation.

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-137-planning`, cut from `origin/master` `f19ca413` on 2026-11-04. It carries the Sprint 136 archive, the #328 post-merge record, and the Sprint 137 spec, plan, handoff and BUGS entries. **No PR is open from it.** Execution continues here, and the one PR opens from it. |
| **Base** | `origin/master` at `f19ca413` (#328, v11.109.0). No open PRs on 2026-11-04. The version (provisional 11.110.0) is re-derived from `origin/master` at merge. |
| **Active editor** | Claude Code executing the approved plan from Task 6's review onward (2026-11-05), with one subagent editor at a time. Codex executed Tasks 1–5 and implemented Task 6 (2026-11-04–05); its chat is stopped. |
| **Shared resources** | **Dependency lane: Claude** (maintainer-designated); this sprint adds no dependency. Nothing dependency-dated except #178 (below). **No ADR number needed.** No demo-host operation pending. |
| **Merged branches safe to delete** (maintainer's call) | `agent/claude/sprint-136-planning` (head `170d39fe`; same tree as `f19ca413`), `agent/claude/sprint-135-pr-request-status-guards` (`7bfc65ac`), `agent/claude/sprint-135-planning` (`5a3589ef`), `agent/claude/sprint-134-pr-bug-077-badge-insert` (`afbaed7a`). |

## Decisions

**Maintainer (2026-11-04):**
1. **Scope: exchange integrity, one PR** from this branch: BUG-088, BUG-089, BUG-090, and a closed-ask edit guard
   (BUG-091).
2. **Retention clock: keep COALESCE, and lock closed asks.** `PUT /requests/:id` refuses a completed or cancelled ask.
   This closes BUG-091, a gap found while planning: the edit route has no `content_forgotten_at` check, and the
   retention job only selects `content_forgotten_at IS NULL` (`memoryRetentionJob.ts:99`). So an edit after forgetting
   writes content that is never forgotten. GREATEST is not adopted. *(Answers Sprint 136 open question 1.)*
3. **BUG-088: the expiration sweep closes an expired ask's proposals** and frees their help offers. *(Answers Sprint 136
   open question 2.)*

**Planner (2026-11-04), each open to the maintainer's veto before execution.** Spec → *Decisions* has the reasons.
4. The sweep runs in cleanup-service after `markExpiredData` flags asks, one transaction per ask (`expireDibs` pattern).
5. The same sweep frees **stranded holds** with one guarded statement: offers left `matched` after the hard delete
   cascaded their proposals away (`matches_request_id_fkey ON DELETE CASCADE`). This changes demo data on the first
   deployed run. **Drop it (D2) if the maintainer prefers.**
6. No notification on an expiry close (`match_rejected` is unconsumed today).
7. BUG-089: a body `status` on `PUT /offers/:id` → `400 STATUS_NOT_EDITABLE`. The hold requires an unexpired offer, and a
   gate pins every help-offer status writer.
8. BUG-090: `POST /providers/offers` (BUG-090's entry wrongly said `/requests/offers`) re-checks and inserts under
   `lockRequestForCommitment` → `409 REQUEST_NOT_OPEN`.
9. No ADR, no migration, no new event or endpoint.
10. **One release rule for every offer free** (from the Codex review). An offer is freed only while no other proposed,
    matched or completed match holds it. This covers `closeProposals`, match reject and cancel (now sharing a new
    `releaseOffer` helper), D1 and D2. Spec B5 has the details.

## Plan review (Codex, 2026-11-04)

The review was read-only, and its working tree was clean. Each finding was verified against the repo and resolved in
the spec and plan:

| # | Finding | Verdict | Evidence | Resolution |
|---|---|---|---|---|
| 1 (P1) | D1 frees an offer another ask still holds | CONFIRMED, and wider | BUG-089 (`docs/BUGS.md:2424-2426`) lets one offer back several matches. The same unguarded free is in `closeProposals` (`requestStatus.ts:128`), reject (`matches.ts:493`) and cancel (`:746`) | Decision 10 / spec B5: one guarded release rule everywhere, plus shared-offer integration fixtures. Codex also suggested a **separate offer lock**; it is **not adopted**. In `services/*/src`, the only writer that sets `matched` is the hold, from `active` (`matches.ts:241`), and only `POST /matches` inserts an offer-backed match (`:247-248`), so a single guarded statement is exact. The spec's D2 per-offer lock rested on the same impossible race and was simplified to one statement. |
| 2 (P2) | The B4 gate cannot tell reject's release from cancel's | CONFIRMED | `matches.ts:493` and `:746` are byte-identical | Both now call `releaseOffer`. A negative fixture puts two identical writers in one file. |
| 3 (P2) | Task 7's red commit fails required checks | CONFIRMED | cleanup's `"test": "jest"` (`package.json:12`) and `tests/tdd` in `jest.config.js:10` | Task 7 runs red locally and is committed with Task 8. Logged **BUG-092** (simulation-service has the same drift). |
| R1 (P1, re-review of `17f41af6`) | B5's writer invariant was stated repo-wide, and it is false repo-wide | CONFIRMED (the wording; the race argument stands) | The archived seeder (`scripts/archive/seeding/generate-realistic-data.ts:904`, `:923`) and integration fixtures (`sprint-136-request-followups.integration.test.ts:81`, `sprint-134-bug-074-match-status-guards.integration.test.ts:55`) insert offer-backed matches; under `services/*/src` only `matches.ts:247-248` does | The claim is narrowed to runtime writers in `services/*/src`, and setup-time writers are accounted for (spec B5, *Writers outside the argument*). B4 now **gates** the invariant: one `matched` setter and one offer-backed insert, each with negative fixtures (plan Task 2). |

| R2 (P2, review of `17f41af6..fcec0e28`) | The gate parsed the column list from the literal's "first `(`", so a CTE or comment could let an offer-backed insert slip past it | CONFIRMED | Plan Task 2 said "between the first `(` and its matching `)`" | The parser anchors at each `INSERT INTO (requests.)?matches` (optional `AS alias`) and balances from the next `(`. Three more gaps found while verifying are also closed: no column list, an interpolated list, and several inserts in one literal. Each has a negative fixture. All five current `services/*/src` inserts name their columns, so nothing existing is flagged. |

**Re-review (Codex, 2026-11-04, `6d478a36..17f41af6`):** no findings on the `closeProposals` exclusion across its four
callers, on reject and cancel updating their match row before `releaseOffer`, on D2 as one statement, or on the Task 7/8
sequencing. Its one finding is R1 above.

## Implementation review (2026-11-05)

**I1 — CONFIRMED; Task 5 helpers/spec/plan corrected, full suite green, runtime re-review approved. Cleanup/tests follow in Tasks 8–9.** The plan's original single-statement proof missed a
`matched → active → matched` cycle. Two overlapping D2 sweeps can select the same stranded offer; the first frees
it, a real `POST /matches` re-holds it, and the delayed sweep can follow the latest tuple while its match subquery
still has the old snapshot. Both the manual trigger and cron can run the job (`services/cleanup-service/src/index.ts:179`,
`:309`). PostgreSQL's [Read Committed semantics](https://www.postgresql.org/docs/15/transaction-iso.html#XACT-READ-COMMITTED)
and the independent PostgreSQL 15 source review confirm the mechanism; no database reproduction is claimed yet.

The correction preserves decisions 4–10: each of the four offer frees additionally compares its current target's
`ctid` to a **distinct scalar self-scan under the statement snapshot**. A changed version is left for the next sweep.
The reviewed predicate is `o.ctid = (SELECT visible_offer.ctid FROM requests.help_offers visible_offer WHERE visible_offer.id = o.id)`.
This is a statement-local version check, never a persisted identity, and adds no lock, schema, endpoint, event or
dependency. Concurrent metadata edits can conservatively defer a release. Task 5 updates its helpers, exact contracts,
spec and plan; Tasks 7–8 carry the identical predicate into cleanup. Task 9 adds deterministic CI snapshot-barrier
proofs for conservative deferral and a real new hold. This strengthens the earlier Plan review row 1/R1 argument;
the original no-new-hold-on-matched invariant alone does not exclude the cycle. Both request-service helpers now
append the reviewed predicate after `NOT EXISTS`, and independent SQL contracts were tightened RED first. The spec
and plan require Task 7's exact cleanup predicate expectations and Task 8's text-for-text D1 copy. Task 9's fixture-only,
waiter-session-gated `BEFORE UPDATE STATEMENT` trigger pauses the shipped D2 statement on an advisory lock after
snapshot acquisition; `pg_blocking_pids` proves the wait. One case commits metadata then checks deferred/next-sweep
release; the other runs a first D2 and real `POST /matches` re-hold before resuming delayed D2. No sleeps, production
test hooks or local database execution. PostgreSQL primary-source links and scoped proof are in spec B5.

## Critical implementation notes (copied verbatim from the spec)

1. **Lock, then check, in separate statements** for the request lock (A, C, D1). A statement that waited on a row lock
   keeps its subqueries' snapshot from before the wait (`requestStatus.ts:38-44`). Take the lock in its own statement,
   and decide in the next one. **Offer releases are single guarded statements** (`releaseOffer`, `closeProposals`, D1's
   offer `UPDATE`, D2). Each needs B5's `NOT EXISTS` **and** distinct scalar snapshot CTID check. The gated runtime
   hold invariant alone misses a matched → active → matched cycle (I1); a concurrent version change defers release.
2. **Lock order.**
   - D1 is request → offers → matches, the same as accept's `closeProposals`.
   - D2 takes only the offer rows it updates.
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
7. **The copied `closeProposals` SQL** (D1) is text for text the guarded statement in B5. It keeps four properties:
   - an offer is freed only while `matched`, so a withdrawn offer stays withdrawn;
   - no other match must still hold it (decision 10);
   - the target version equals its distinct scalar snapshot self-scan (I1); never persist CTID or add `FOR UPDATE`;
   - offers are updated first, so the subquery still sees the proposals.

   A comment in each copy names the other. The integration tests' withdrawn-offer and shared-offer cases prove the
   behaviour, not the text.
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
    **Cleanup-service's `test` script is bare `jest`, and its config includes `tests/tdd`** (`package.json:12`,
    `jest.config.js:10`; BUG-092). So a red cleanup tdd file fails `npm test` and the pre-push hook. Run it red
    locally, and commit it only together with the implementation that turns it green. Request-service's `test` is
    `test:unit && test:regression`, so its red tdd files may be committed alone.
12. **`markExpiredData`'s unit test pins four calls** (`tests/unit/expirationJob.test.ts:19-33`). Update it to the new
    contract: the four flags, then the release. Do not weaken it.
13. **`npm test` regenerates landing docs.** Revert the timestamp and HEAD-sha churn before committing.
14. **No demo-host operation in this sprint.** The first deployed run changes demo data (D1's backlog, D2's stranded
    holds); say so in the PR body. A read-only count beforehand is optional and needs the maintainer's authorization.
15. **`feedback:check` reads `git diff --cached`.** Run it before committing; on a committed branch it is a false green.
16. **After the merge, read master's open code-scanning alerts and the merge-sha analysis.** B3 keeps `api.ts`'s line
    count, but diffs don't predict re-raises. Surface a re-raise to the maintainer; never loop the dismissal API.

**Plan-only rule (Tasks 4–8):** each `src/` change re-pins its own directed-surface hashes and updates the unit and
regression tests it breaks **in the same commit**. Only request-service's new `tests/tdd/` files may be red between
tasks. Cleanup-service's `test` script runs its tdd tier (BUG-092), so its tdd file is committed only once it is green,
with Task 8.

## Execution record (2026-11-04–05)

- Bootstrap reconciled at planning head `c3357160`: fetched origin, no open PRs, `origin/master` remains `f19ca413`,
  #316 is CLOSED. Drift run `41890283148` (manual, post-merge) passed. The next expected scheduled run
  (2026-11-05 07:15Z) was not present yet. The latest failed scheduled run `41857550328` reports
  `expo-notifications@57.0.23` versus `~57.0.24`, the pre-#328 pin; its gate output was read before execution.
- Task 1: request-service unit + regression, cleanup-service, and the two scanner baseline gates passed on
  `c3357160`. Only the three root version fields changed to `11.110.0`; staged feedback and whitespace checks passed.
  Spec/quality review approved that diff. Full `npm test` passed on the version-change tree based at `c3357160`
  (27/27 Turbo tasks; 26 cached, root tests executed: 42 regression suites / 982 tests). Only this handoff changed
  between that pass and Task 1's commit. Independent spec/quality and final process review passed.
- Full-suite host issue: sandbox Bash access was denied; an elevated retry selected
  `C:/WINDOWS/system32/bash.exe` (WSL with no installed distribution), and `tr`/`basename` were absent from PATH.
  A test-process-only PATH using the installed Git Bash `bin` and `usr/bin` passed the full suite. No test or runtime
  source was changed to address these host errors. The three root version fields are included with this record.
- Decisions 4–10 remain in force, including D2. Cleanup's red test remains uncommitted until Task 8. No merge,
  ADR number, demo-host operation or dismissal was performed or authorized.
- Task 2: default scanner parity is **92 identical file/line/SQL records**; the two existing gates remain green.
  The new offer-status gate has **36 passing negative fixtures across the status gates** and exactly two intended
  live assertion failures: the current inline releases and the future `releaseOffer`/D1/D2 writers. They become green
  in Tasks 5 and 8. Independent review found parenthesized dynamic SET and nested-subquery blind spots; both were
  reproduced red and fixed. The equivalent existing request-status gate received the same minimal correction and
  fixtures. No runtime source changed. Re-review approved both fixes.
  Full `npm test` passed on `0499e524` plus Task 2's staged test changes (27/27 tasks; 24 cached; root 42 regression
  suites / 982 tests). Only this handoff changed between that pass and Task 2's commit `2e7a0c1f`; staged feedback
  and whitespace checks passed. The following record carries Task 3's progress.
- Task 3: 22 real-route/helper contracts compile cold: **17 expected assertion failures, five existing controls
  passed**. A, B1/B2/B5 and C each have a red proof; only the SQL/auth/ownership/transport boundary is mocked.
  Independent spec/quality review approved the contracts. The request blocking tiers passed (71 suites; 724 tests
  passed, one skipped); full `npm test` passed on `2e7a0c1f` plus the staged contract (27/27 tasks; 24 cached;
  root 42 regression suites / 982 tests). Only this handoff changed afterward. These red tests are intentionally in
  request-service's nonblocking tdd tier and turn green through Tasks 4–6.
- Task 4: ownership 404 and body-status 400 remain before the transaction; derived completed/cancelled states and
  forgotten-content writes refuse with `409 REQUEST_CLOSED` (`services/request-service/src/routes/requests.ts:2036`).
  The request lock and status read remain separate. Only the changed edit UPDATE's hash was recomputed; privacy's
  hash is unchanged. Both named regression files and a brief service-context note are in the same commit.
  A's eight contracts and 74 focused regression/gate tests passed cold. Independent spec/quality review approved;
  full `npm test` passed on `3a8a2542` plus Task 4's staged changes (27/27 tasks; 24 cached; root 42 regression
  suites / 982 tests). Only this handoff changed before the Task 4 commit. B/C remain intentionally red in tdd.
- Live recheck on resumed 2026-11-05: fetch succeeded, `origin/master` is still `f19ca413`, no PR is open, and #316 is
  still CLOSED. The latest-three drift query still returns manual success `41890283148` and the pre-merge scheduled
  failures; the expected November 5 scheduled result is **not listed yet**, so scheduled success is not claimed.
- Task 5: B1/B2/B3/B5 implemented with exact existing-test fallout and a brief context note. The frontend type edit
  remains one line added/removed. Original B proof: six assertion failures/three controls; focused A+B and fallout:
  125 passed. Both typechecks passed. I1 tightened three B5 SQL assertions RED before the statement-local CTID guard;
  all 71 request blocking suites pass (724 tests, one skipped). The amended spec and plan carry identical D1 SQL and
  new snapshot-barrier CI cases; the initially missed spec D1 example was corrected and all six executable examples
  were compared with the intended SQL. Post-fix full `npm test` passed on `edcdc4d6` plus Task 5's staged code
  (27/27 tasks; 24 cached; root 42 regression suites / 982 tests). Only the one-line spec correction and handoff
  metadata changed afterward. C's five contracts and the two future cleanup writer identities remain intentionally
  red in tdd. No PostgreSQL execution is claimed; those proofs remain Task 9/CI.
- Controller handover (2026-11-05): Codex's chat stopped while its Task 6 full-suite call was in flight. Claude Code
  verified the tree before resuming: exactly Task 6's four staged files, staged diff byte-identical to the packaged
  review diff, sources unmodified since before the suite started, Codex idle. Live: `origin/master` still `f19ca413`,
  no PR open, #316 CLOSED; at 15:22Z no 2026-11-05 scheduled drift run is listed yet (scheduled runs have landed
  ~15:00–17:00Z, not 07:15Z), so scheduled success is still not claimed.
- Task 6: C implemented. `POST /providers/offers` keeps its profile and fast-path answers, then one transaction locks
  the request (`lockRequestForCommitment`), refuses anything but open with `409 REQUEST_NOT_OPEN` before any write,
  and runs the unchanged duplicate check and insert on the transaction client; the requester lookup and
  `offer_submitted` stay after commit. Proof: five assertion failures RED on `fa27e0c0`; GREEN 37 focused tests (all
  22 Task 3 contracts, the Sprint 116 regression with its transaction mock, both scanner gates with no hash change);
  request typecheck clean. Full `npm test` on `fa27e0c0` plus the staged change: 27/27 Turbo tasks, 24 cached, root
  42 regression suites / 982 tests (the tool call that ran it was cut off, so its exit code was read from the Turbo
  summary, not captured). Independent spec/quality review approved; three minors deferred to the final review (a
  request deleted after the fast path answers 409 rather than 404, per the plan's `!== 'open'`; formatting; the
  pre-existing ts-jest TS151002 warning). Only this handoff changed afterward.
- Live 2026-11-05 15:27Z: the first post-#328 scheduled drift run (`42055042687`) **failed** and filed **#329**: a new
  Expo patch train (`expo` 57.0.31 → ~57.0.32, `expo-notifications` 57.0.24 → ~57.0.25, and six siblings); the
  `jest`/`@types/jest` registered divergences cleared. #316 stays closed. The workflow is schedule-only by design
  (`.github/workflows/expo-sdk-drift.yml:13-20`), so it gates no PR; not fixed in this sprint (see *Open*).
- Task 7 (`b1a57dd3` base; committed with Task 8): 12 cleanup contracts for `releaseExpiredHolds`, red on assertions
  only (the function is read off a dynamic import and asserted to exist first, because ts-jest type-checks). Review
  found one test asserting text the correct D1 free contains; fixed and re-reviewed. A COMMIT-failure case proves
  `proposalsClosed` counts committed transactions only.
- Task 8: `releaseExpiredHolds` (D1 per-ask transaction, D2 one guarded autocommit statement) runs from
  `markExpiredData` after the four flags; the unit test pins the four flags then the release (exact counts). D1's
  offer free is byte-identical to `closeProposals`' guarded UPDATE, each naming the other. Two allowlist entries
  (candidate read, lock read) hashed with `surfaceHash`. Proof: Task 7's 12 RED → GREEN; a three-mutation proof
  (count before COMMIT, D2 via a client, drop the CTID predicate) turned each red and was restored by byte copy;
  offer-status gate now fully green (34/34); cleanup tsc + lint clean. Full `npm test` exit 0 on `b1a57dd3` plus the
  staged Tasks 7+8 (27/27 tasks; 22 cached; cleanup 59 pass / 7 skipped; root 42 suites / 982 tests). Independent
  review (spec + quality) approved; seven minors deferred to the final review, including an unescaped regex in the
  unit test (`expirationJob.test.ts:38-39`) and CONTEXT wording for Task 11.
- Task 9: `tests/integration/sprint-137-exchange-integrity.integration.test.ts`, 38 real-SQL tests, **not run on
  this host** (no PostgreSQL); they run in CI's Integration Tests job on the PR. Coverage: D1 (incl. unchanged
  `updated_at`), the D1 race, 12 shared-offer cases (D1, match reject, match cancel, `closeProposals` via accept ×
  the other reference proposed / matched / completed), D2, both I1 snapshot-barrier cases, B, C (incl. its race) and
  A. The I1 barrier pins D2 to a recorded cleanup-pool backend pid (pg-pool 3.14.0 reuses idle clients LIFO,
  `index.js:158/:427`) and pauses only that pid's D2 statement with a fixture statement trigger on an advisory lock;
  waits are proven with `pg_blocking_pids`; a missed pin fails the test. PostgreSQL's snapshot-before-trigger and
  recheck behaviour is labelled REASONED in the header. The file alone type-checks (exit 0); `tsc -p tests` keeps its
  70 pre-existing errors (e2e/tdd), byte-identical to before. Root `tests` workspace passed on the staged file
  (unit 101/101, regression 42 suites / 982). Independent review approved; four minors deferred (incl. a CI-hang
  exposure only if request-service itself hangs mid-race, shared with Sprint 136's helpers).

## Dated obligations

- **`deepmerge` #178** (dismissed `tolerable_risk`): re-check at the next Expo SDK move or by **2026-12-01**.
- Nothing else is dated.

## Open, not scheduled

- **#329 Expo SDK drift (opened 2026-11-05, maintainer's call).** The live version map moved one patch on eight
  `apps/mobile` packages (`expo` ~57.0.32, `expo-notifications` ~57.0.25, …), and the `jest`/`@types/jest`
  registrations cleared. It gates no PR (schedule-only workflow). Dependency work needs a maintainer-recognised reason
  (advisory or feature need); the dependency lane is Claude's. Not in Sprint 137's scope.
- **From Sprint 136:**
  - **BUG-087 has no runtime log proof in CI.** The Integration Tests job prints container logs only on failure
    (`.github/workflows/ci.yml:363-367`), so reputation's two "not scheduled" lines never appear on a green run. The
    proof today is the unit tests plus `sprint-136-test-stack-crons-gate`. An optional follow-up: a CI step that
    asserts the lines from `docker compose logs reputation-service`.
  - **#180's alert was withdrawn, not marked fixed** (HTTP 410). The advisory isn't withdrawn, and the lock is clean
    (`minimatch` 11.0.3). The cause is unverified, and no action is needed.
- **Noted while planning Sprint 137 (not logged as bugs; product questions):**
  - an expired open ask stays editable, and an edit restarts the hard delete's 7 days;
  - an offer that backed a completed exchange stays `matched` (one-shot);
  - pending provider offers on an expired ask stay pending.

  Spec → *Out of scope*.
- **BUG-073** tabled (maintainer, 2026-10-26): community admin and platform admin become separate roles, as a future
  feature (`docs/IDEAS.md` 2026-10-26).
- **BUG-092** (cleanup-service and simulation-service run their tdd tier in their blocking `test`; Sprint 137 only
  sequences around it).
- **BUG-076** (pre-push TDD false pass), **BUG-080** (provider completion rate counts a status never written),
  **BUG-081** (trust-config readers return NUMERIC strings typed as `number`; latent), **BUG-082** (the per-query SQL
  log in five services floods the log; the reputation log loses the 02:00Z nightly by 03:30Z).
- **The mobile sprint** (maintainer, 2026-10-29; `docs/IDEAS.md`): BUG-041 `query-string@7` / `decode-uri-component`,
  stale mobile match statuses, the unused `cancelMatch`, no build pipeline. Do not ship the app before it.
- **Back out of an in-progress exchange from the UI** (`docs/IDEAS.md` 2026-10-29), which would also route
  `match_rejected` / `match_cancelled` to notifications.
- **PR C** (scheduled exemption re-check evidence): the exemption registry on master is empty, so it may have no work
  left.
- **PR D's D8** is blocked on the host persona: `DEMO_UNRELATED_EMAIL` in the host's `.env.demo.rotation` names a
  pre-reset account; the guide wants Marcus Lee (`docs/guides/demo-data.md:253`). Fixing it is a host write, and each
  rerun is its own authorization.
- **Per-community health-quality weight**: needs an ADR number from the maintainer and a quality-signal decision.
- **Sprint 135 recount note:** the 2 `matched` rows of 2026-10-29 are no longer `matched`; why was not traced (BUG-075).

## Standing rules

Every demo-host operation, merge, exemption renewal, CodeQL dismissal and ADR number needs explicit per-operation
authorization. Never push docs-only to master; fold docs into the next PR. Reconcile this handoff against `gh pr list` /
`git log` after every merge and at session end.
