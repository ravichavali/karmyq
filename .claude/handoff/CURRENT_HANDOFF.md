# Sprint 137 — Exchange Integrity — Handoff

**Date**: 2026-11-04
**Outcome so far**: **Tasks 1–2 verified and reviewed. Continue with Task 3's request-service contracts.**
- Scope and decisions 1–3 were agreed with the maintainer on 2026-11-04.
- The spec, plan, BUG-088/090 corrections and the new BUG-091 entry are committed on this branch.
- Codex's plan review found three issues, and two re-reviews found one each. All five are confirmed and resolved in the
  spec and plan (see *Plan review*).
- No application code has changed yet, and no PR is open. Task 1 (`0499e524`) sets the three root version fields to
  provisional v11.110.0. Task 2 extends the scanner and adds the offer-status gate in the nonblocking tdd tier.

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
   - `gh run list --workflow expo-sdk-drift.yml --limit 3`. The first **scheduled** run after #328 (2026-11-05 07:15Z)
     should be green, and #316 should stay closed. If it failed, read its gate output first.
   - Note: the only scheduled run since #328 merged, at 2026-11-04 15:25Z, ran on `b9682c34`, **before** the merge
     (17:54Z). It failed on exactly the `expo-notifications@57.0.23` pin #328 fixed. The post-merge manual run on
     `f19ca413` was green.
2. Reuse the existing task branch: `git switch agent/claude/sprint-137-planning`. It is already cut from
   `origin/master` `f19ca413`. If master moved, merge it in with a merge commit, never a rebase. Never branch off a
   stale local master; unpushed local-master commits leak in via the squash-merge.
3. Open the plan: `docs/superpowers/plans/2026-11-04-sprint-137-exchange-integrity.md`.
4. Invoke `superpowers:subagent-driven-development` directly (or `superpowers:executing-plans`). There is no
   `/execute-plan` slash command; superpowers removed it as a deprecated stub.
5. Merges, ADR numbers, demo-host operations and dismissals each need explicit authorization. Stop at PR creation.

**Next unchecked task**: Plan Task 3 (request-service mocked-SQL contracts, assertion-red). Execution is in this Codex chat,
using sequential implementers and independent reviewers. Codex has reviewed
the plan three times (`6d478a36`, `17f41af6`, `fcec0e28`). R2's fix (a stricter parse rule and
its negative fixtures) is mechanical, so no further plan review is planned. The PR's `/code-review` will cover the
implementation.

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-137-planning`, cut from `origin/master` `f19ca413` on 2026-11-04. It carries the Sprint 136 archive, the #328 post-merge record, and the Sprint 137 spec, plan, handoff and BUGS entries. **No PR is open from it.** Execution continues here, and the one PR opens from it. |
| **Base** | `origin/master` at `f19ca413` (#328, v11.109.0). No open PRs on 2026-11-04. The version (provisional 11.110.0) is re-derived from `origin/master` at merge. |
| **Active editor** | Codex executing the approved plan, with one subagent editor at a time (2026-11-04). |
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

## Critical implementation notes (copied verbatim from the spec)

1. **Lock, then check, in separate statements** for the request lock (A, C, D1). A statement that waited on a row lock
   keeps its subqueries' snapshot from before the wait (`requestStatus.ts:38-44`). Take the lock in its own statement,
   and decide in the next one. **Offer releases are single guarded statements** (`releaseOffer`, `closeProposals`, D1's
   offer `UPDATE`, D2). B5 explains why that is exact: no runtime writer in `services/*/src` adds a hold to a
   `matched` offer, and B4 gates that.
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
7. **The copied `closeProposals` SQL** (D1) is text for text the guarded statement in B5. It keeps three properties:
   - an offer is freed only while `matched`, so a withdrawn offer stays withdrawn;
   - no other match must still hold it (decision 10);
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

## Execution record (2026-11-04)

- Bootstrap reconciled at planning head `c3357160`: fetched origin, no open PRs, `origin/master` remains `f19ca413`,
  #316 is CLOSED. Drift run `41890283148` (manual, post-merge) passed. The next expected scheduled run
  (2026-11-05 07:15Z) was not present yet. The latest failed scheduled run `41857550328` reports
  `expo-notifications@57.0.23` versus `~57.0.24`, the pre-#328 pin; its gate output was read before execution.
- Task 1: request-service unit + regression, cleanup-service, and the two scanner baseline gates passed on
  `c3357160`. Only the three root version fields changed to `11.110.0`; staged feedback and whitespace checks passed.
  Spec/quality review approved that diff. Full `npm test` passed on the version-change tree based at `c3357160`
  (27/27 Turbo tasks; 26 cached, root tests executed: 42 regression suites / 982 tests). Only this handoff changed
  afterward. Independent spec/quality and final process review passed; Task 1 is ready for Task 2.
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
  suites / 982 tests). Only this handoff changed afterward; staged feedback and whitespace checks are repeated before
  commit. Continue with Task 3 after the commit carrying this record.

## Dated obligations

- **`deepmerge` #178** (dismissed `tolerable_risk`): re-check at the next Expo SDK move or by **2026-12-01**.
- Nothing else is dated.

## Open, not scheduled

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
