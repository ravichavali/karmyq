# Sprint 139 — Correctness Bundle — Planning Handoff

**Date**: 2026-11-09
**Outcome so far**: **Sprint 139 design approved and planning finalized; implementation not started.** The maintainer approved
bundling the offers-page repair with expiry fields/display tests and extending the existing 03:30 job to refresh
provider metrics nightly. Completions still refresh immediately; cancellations are reflected by the next
successful nightly run. No new timer, event consumer or host operation is authorized by this decision.
The maintainer selected BUG-097 plus
BUG-092, BUG-076, BUG-080, BUG-081 and BUG-082. BUG-080 uses completed / (completed + cancelled), excluding ongoing
matches (maintainer decision in this planning chat). Spec and plan are written; execution belongs in the next chat.
Sprint 138 is complete: #331 merged as `74c5a8e5` (v11.111.0) and deployed
green (9/9 healthy, the offer-index migration applied, no rollback). Master has 0 open code-scanning and 0 open
Dependabot alerts at the Sprint 138 post-merge check; those alert counts were not re-queried by this planning chat.

> The handoff carries **state between sessions**. It is not a copy of the plan: it links the plan and names the next
> unchecked task. It is branch-local, so it can reserve nothing; see `CLAUDE.md` → *Parallel Development* for how
> contended resources are actually allocated. Git and PR state (`gh pr list`, `git log origin/master`) outrank anything
> written here. No parallel lanes are active.

**Previous**: Sprint 138 COMPLETE (merged `74c5a8e5`, v11.111.0; CI/CD `42679957353` green, deploy health 9/9; code
scanning 0 open). Archived:
[`archive/2026-11-06-sprint-138-reusable-standing-offers-COMPLETE-v11.111.0.md`](archive/2026-11-06-sprint-138-reusable-standing-offers-COMPLETE-v11.111.0.md)
(its top section is the #331 post-merge record).

---

## Quick Start

1. Read `CLAUDE.md` and this handoff. Confirm live state: `git fetch origin`, `gh pr list`,
   `git log --oneline origin/master -3`, `gh issue view 329`, `git status --short --branch`.
2. Reuse `agent/claude/sprint-139-planning`; no worktrees. It is cut from
   `origin/master` `74c5a8e5` and carries the Sprint 138 archive and this handoff. If master moved, merge it in with a
   merge commit only after explicit authorization, never a rebase.
3. The design and review decisions **1 and 7 are approved**. Read the finalized
   [spec](../../docs/superpowers/specs/2026-11-09-sprint-139-correctness-design.md) and
   [plan](../../docs/superpowers/plans/2026-11-09-sprint-139-correctness.md). Full host verification passes;
   see the dated ledger. This chat stops after committing the planning update; Task 1 is next-chat work.
4. In the next chat, invoke `superpowers:executing-plans` (or `superpowers:subagent-driven-development` if the
   maintainer chooses it). Start **Task 1: preflight and first failing tier-boundary proof**. Execute through
   Task 14 only; stop at PR creation. Task 15 remains a separate, unauthorized future operation.
5. Merges, ADR numbers, demo-host operations, dismissals and dependency work each need explicit authorization.
   #329 stays open; #178 re-check by **2026-12-01**. No demo backfill or optional expired-holds log read is authorized.

**Next unchecked task**: **Task 1 — preflight and first failing tier-boundary proof**, in the next chat.
This chat stops after the planning-document commit. No implementation task, version bump or PR creation.

## Sprint goal and decisions

Fix offer expiry visibility, trustworthy test-tier reporting, provider completion metrics, numeric trust values
and routine SQL log volume in one bundled PR (six bugs). This is one corrective sprint; no new product arc.

- **Maintainer:** all six bugs are in scope; completion rate is completed / (completed + cancelled), excluding ongoing.
- **Approved decision 1:** owners see their expired active offers; other members do not. Non-active readable
  offers remain visible after expiry. Bundle the existing page repair (response.data.offers), additive
  expired/expires_at list fields, honest Expired/Offer expired labels, mount/error/retry tests and onboarding note.
- **Approved decision 7:** extend the existing 03:30 job with provider metrics, independently of the personal
  phase. Completions still refresh immediately; cancellations are reflected by the next successful nightly
  run. Catch/count failures per profile, preserve manual backfill behavior and scheduler disabled flag/timezone.
  No new timer/consumer/startup run and no manual demo backfill. Nightly failures can delay freshness further.
- Parse numbers at DB and cache boundaries, including valid legacy Redis strings; retain NULL inheritance and zero.
- All five unconditional SQL success logs move to existing debug loggers; error/transaction behavior stays.
- Amend existing ADR-015/042/029/088. No new ADR allocation, migration, event consumer or dependency.

## Critical implementation notes

1. Reuse `agent/claude/sprint-139-planning`; one editor, no worktrees, rebase, force-push or master push.
2. The maintainer approved the page/expiry bundle and nightly provider refresh on 2026-11-09. This chat changes documents only; Task 1 starts in the next chat.
3. Preserve the outer offer audience; add list expiry fields, read response.data.offers and show honest expiry labels. Owner visibility never permits an expired hold.
4. Completion rate is completed / (completed + cancelled), rounded to two decimals. Refresh on completion and the next successful existing 03:30 job; isolate both phases and profile failures. No manual demo backfill.
5. Normalize DB/cache numbers with strict decimal-string validation; preserve NULL inheritance and community zero, use legal user overrides, and retain disclosure guards.
6. Fix the source pre-push hook, then reinstall it. Capture true TDD exit status in a unique retained temp log; show its last 20 lines and path. WIP failures never block required-green pushes.
7. Register uncached Turbo TDD execution with build prerequisites; prove clean-output imports, discovery and failure propagation against real tools.
8. SQL success logging moves to existing debug loggers in all five affected services; transactions, errors and parameters are unchanged. Amend existing ADRs; allocate no new number.
9. New service/frontend tests begin in their own tdd tier; root gates are the exception. Preserve simulation's 17-test suite, explicitly promote frontend TSX, and reconcile promotions/landing churn after full runs.
10. No dependency work, merges, dismissals or demo-host operations without separate explicit authorization. #329 stays open; #178 is due by 2026-12-01.
11. Regenerate landing docs from source and remove only generated metadata noise. Re-derive the version from origin/master at merge time.
12. Execution runs testing, /simplify, /code-review and /security-review, updates the handoff, pushes one PR and stops at PR creation.

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-139-planning`, cut from `origin/master` `74c5a8e5` on 2026-11-09. It carries the Sprint 138 archive/#331 post-merge record and Sprint 139 planning. **No PR is open from it.** Those docs ride in the implementation PR, never a docs-only master push. |
| **Base** | `origin/master` at `74c5a8e5` (#331, v11.111.0). No open PRs on 2026-11-09. The next version is re-derived from `origin/master` at merge. |
| **Active editor** | Codex (Sprint 139 planning, 2026-11-09); no concurrent editor observed or authorized here. |
| **Reviewer** | Maintainer reviewed the full plan and approved both remaining decisions. Fresh process/design check covers this planning update; implementation SDLC reviews remain next-chat work. |
| **Owned paths** | This chat: Sprint 139 spec, plan and this handoff only. Execution: exact File Map in the plan, one editor at a time. |
| **Shared resources** | **Dependency lane: Claude** (maintainer-designated). Dated: #178 only (below). No ADR number allocated. One optional demo-host read pending authorization (below). |
| **Merged branches safe to delete** (maintainer's call) | `agent/claude/sprint-138-planning` (head `96ce19d2`; same tree as `74c5a8e5`), `agent/claude/sprint-137-planning` (`49ebd68a`), `agent/claude/sprint-136-planning` (`170d39fe`), `agent/claude/sprint-135-pr-request-status-guards` (`7bfc65ac`), `agent/claude/sprint-135-planning` (`5a3589ef`), `agent/claude/sprint-134-pr-bug-077-badge-insert` (`afbaed7a`). Older `agent/claude/sprint-134-*` heads also remain on origin. |

## Open questions for the maintainer

1. **No Sprint 139 design question remains open.** The denominator, page/expiry bundle and existing-job nightly
   provider refresh are approved. Implementation has not started. The following product candidates remain unscheduled:
   - **The mobile sprint** (`docs/IDEAS.md` 2026-10-29). Do not ship the app before it.
   - **Back out of an in-progress exchange from the UI** (`docs/IDEAS.md` 2026-10-29).
   - **The 2026-11-08 framing idea** (`docs/IDEAS.md`): evolve the platform toward a communication channel that grows
     with people's networks of trust. The maintainer asked for an adversarial discussion first, since it runs against
     the initial plan; that discussion would precede any spec.
2. **#329 — take the Expo patch train?** Still open and gates no PR. Dependency work needs a maintainer-recognised
   reason (an advisory or a feature need). The scheduled *Expo SDK drift* run keeps failing daily on master because
   the drift is open; that is not a deploy.
3. **Optional demo-host read:** the first hourly `markExpiredData` after the 2026-11-09 19:22Z deploy (20:00Z onward)
   logs `Released expired holds { asksReleased, proposalsClosed, strandedOffersFreed }`. Its `strandedOffersFreed` is
   Sprint 138's retroactive free of offers held by past completions (decision 3). Reading it is `docker logs` on the
   demo host, which needs per-operation authorization.

## Dated obligations

- **`deepmerge` #178** (dismissed `tolerable_risk`): re-check at the next Expo SDK move or by **2026-12-01**. #329 is an
  Expo patch move, not an SDK move.
- Nothing else is dated.

## Carry-forward work

- **From Sprint 138's final review** (details in the archive's *Final-review findings parked*):
  - **BUG-097** (F1's follow-up) is scheduled for Sprint 139, not fixed yet; see spec.
  - **F2** (accepted consequence): the first deployed sweep frees history; freed offers past expiry are flagged and
    hard-deleted 7 days later, and their completed matches keep their rows with `offer_id = NULL`.
  - **F3** `GET /offers/:id` still answers `status: 'active'` for an expired offer.
  - **F4** two final marks committing concurrently on a legacy shared offer can both skip the release; the next hourly
    D2 frees it.
  - **F8** the release rule is four hand-kept SQL copies held together by a text-parity gate.
  - **F9** the "offer is unexpired" predicate is hand-written in the hold, the list and the releases.
- **From Sprint 137's `/simplify` (deferred):** a `holdOffer` beside `releaseOffer` (every offer-status write in one
  file); the two status gates' SET-clause parsers differ; shared integration-test helpers are copied across the Sprint
  134–138 integration files; product questions (an expired open ask stays editable and an edit restarts the hard
  delete's 7 days; pending provider offers on an expired ask stay pending).
- **Scheduled for Sprint 139, not fixed yet:** BUG-092 (cleanup/simulation blocking WIP tier), BUG-076 (pre-push
  false pass), BUG-080 (provider completion denominator), BUG-081 (numeric trust readers/cache), BUG-082 (SQL logs).
- **From Sprint 136:** BUG-087 has no runtime log proof in CI; #180's alert was withdrawn (HTTP 410; no action).
- **BUG-073** tabled (community admin vs platform admin as separate roles; `docs/IDEAS.md` 2026-10-26).
- **PR C** (scheduled exemption re-check evidence): the exemption registry on master is empty, so it may have no work
  left.
- **PR D's D8** is blocked on the host persona (`DEMO_UNRELATED_EMAIL`); fixing it is a host write.
- **Per-community health-quality weight**: needs an ADR number from the maintainer and a quality-signal decision.
- **Sprint 135 recount note:** the 2 `matched` rows of 2026-10-29 are no longer `matched`; why was not traced (BUG-075).

## Planning verification (2026-11-09)

- **Latest host verification:** full root `npm test` exited **0**, preserving `S139_DECISIONS_TEST_EXIT=0`.
  27/27 Turbo tasks succeeded (26 cached); root regression passed **43/43 suites and 992/992 tests**.
  Tested code HEAD is `491658f1` plus planning Markdown changes; subsequent changes only finalize these
  same three documents. This supersedes the earlier host pass and sandbox failures below.
- The host command used PowerShell with Git `bin` and `usr/bin` on PATH and invoked `npm.cmd` explicitly.
  A preceding shell launch reached WSL and failed before npm; it is not counted as a test run. No repo test gate,
  dependency, override or global Git/shell setting was changed. Full raw log (machine-local):
  `C:/Users/ravic/AppData/Local/Temp/vscode-agent-codex-sandbox-nTkvhf/s139-approved-decisions-test.log`.
- Before/after byte comparison of **387** tracked TDD, promotion-target and landing paths found **no changes**:
  no restoration was needed. `ignore-scripts=true` is effective here and no promoter invocation appeared in
  the host log. The plan nevertheless reconciles promotion/churn after every full run in any environment.
- Process review accepted the actual test exit and fresh staged feedback/whitespace checks. The resulting
  planning-only commit contains these three documents; inspect git log/status for its identity. No implementation,
  push, PR or demo operation is part of this chat.

- `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`: fetched successfully, no open PRs,
  master remains `74c5a8e5`; branch was clean before planning edits. #329 was queried OPEN during this chat.
- Read-only builder check of the written spec returned “nothing important left”; its relevant source inspection
  found no contradiction. This is design review, not evidence that any bug is fixed.
- Planning consistency check passed: critical notes are identical in spec/plan/handoff, plan tasks are numbered
  1–15, and Markdown document links resolve. Editor diagnostics found no errors. Staged feedback:check exited 0.
- **Historical pre-commit process review FAILED (superseded by host pass):** sandbox `npm test` exited 1 on branch code HEAD `377efa5a` plus these planning
  documents. 26 of 27 Turbo tasks succeeded (26 cached); root regression had 5 failing / 38 passing suites,
  33 failing / 959 passing tests. Failing suites: `sprint-122-adr-060-code-scanning-gate`,
  `sprint-127-gotcha-registry-gate`, `sprint-123-audit-exemption-gate`, `sprint-123-git-hooks-installed`,
  `sprint-75-security-gate`. Reported failures involve WSL Bash access denial, sandbox Git ownership,
  missing Unix `tr`, and unavailable/invalid npm audit evidence. No runtime fix or green test claim is made.
- Exact raw log (machine-local, not a portable artifact):
  `C:/Users/ravic/AppData/Local/Temp/vscode-agent-codex-sandbox-5hVKsr/s139-process-review-npm-test-20261109-1.log`.
  The requested elevated retry, with Git Bash selected, was rejected by the user before execution. No retry
  ran, and no commit/push/PR was attempted. Do not bypass the mandatory pre-commit gate or reroute the rejection.
- Read-only attached progress snapshots describe Sprint 137 execution; they were read and never edited or used
  as current authorization.

## Review disposition

Findings **2, 4–6 and 8–10** are confirmed and incorporated into spec/plan; finding **3** is partial because
root posttest is broad but effective local ignore-scripts=true suppresses it. The after-every-full-run policy
handles both environments. The simulation protection test is explicitly promoted in Task 2; root completion-rate
unit mocks are added to Task 6's file map and verification. See the plan's final review ledger for file evidence.
Findings **1 and 7** are resolved by the maintainer's explicit agreement: bundle the page/expiry repair and
extend the existing nightly job for provider metrics. Spec/plan include source files, signatures, failure
isolation and tests for both. This chat stops after committing planning; Task 1 remains next-chat work.

## Standing rules

See `CLAUDE.md` (global rules) and the Sprint 138 archive's *Standing rules*. In short: branch off `origin/master`;
never force-push or direct-push master; one merge at a time; no docs-only master push; ask before any demo-host
operation, merge, ADR number, dismissal or dependency work; stop after PR creation. **New from Sprint 138's merge:** a
`gh pr checks` list of passes can hide a run whose job GitHub never created, so check each run's conclusion and job
count before treating a head as green.
