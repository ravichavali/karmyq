# Sprint 139 — Correctness Bundle — Handoff (PR #332 reviewed; finding fixed; awaiting merge authorization)

**Date**: 2026-11-10
**Outcome so far**: **Execution of plan Tasks 1–14 is done and [PR #332](https://github.com/ravichavali/karmyq/pull/332)
is open from `agent/claude/sprint-139-planning`; its independent review's one finding is fixed; nothing is merged or
deployed.** All six selected bugs are fixed on the branch — BUG-097, BUG-076, BUG-092, BUG-080,
BUG-081, BUG-082 — plus a recorded scope expansion (the same `response.data.data` page defect on `/offers/new` and
`/matches/[id]`). All four SDLC gates ran. Three new bugs were logged, not fixed: BUG-098, BUG-099 and **BUG-100
(security, pre-existing, proposed MEDIUM)**. **Task 15 (merge + deploy) is NOT authorized.** The sprint is not complete
until the PR is merged and its deploy verified.

> The handoff carries **state between sessions**. It is branch-local, so it can reserve nothing; see `CLAUDE.md` →
> *Parallel Development*. Git and PR state (`gh pr list`, `git log origin/master`) outrank anything written here. No
> parallel lanes are active.

**Previous**: Sprint 138 COMPLETE (merged `74c5a8e5`, v11.111.0). Archived:
[`archive/2026-11-06-sprint-138-reusable-standing-offers-COMPLETE-v11.111.0.md`](archive/2026-11-06-sprint-138-reusable-standing-offers-COMPLETE-v11.111.0.md).

---

## Quick Start

1. Read `CLAUDE.md` and this handoff. Confirm live state: `git fetch origin`,
   `gh pr list --head agent/claude/sprint-139-planning`, `git log --oneline origin/master -3`, `gh issue view 329`.
   On 2026-11-10 origin/master was still `74c5a8e5` (v11.111.0) and no other PR was open.
2. The independent review is done and its one finding is fixed (below). The approved
   [spec](../../docs/superpowers/specs/2026-11-09-sprint-139-correctness-design.md) and
   [plan](../../docs/superpowers/plans/2026-11-09-sprint-139-correctness.md) govern Task 15. The PR body carries the
   full `## Validation` ledger, the acceptance-row red→green map and the dispositions of every gate finding.
3. Before any merge-readiness claim, check **every CI run's conclusion and its created job count** for the CURRENT PR
   head, not only the checks list (Sprint 138 lesson). The two Sprint 139 integration suites first ran in CI on
   `07b79e35` (green); they have never run locally (no PostgreSQL on the Windows box).
4. Merge, version re-derivation, deploy, demo-host operations, dismissals, dependency work and ADR numbers each need
   explicit maintainer authorization. #329 stays open; **#178 re-check by 2026-12-01**.

**Independent review — DONE (2026-11-10, relayed by the maintainer, review only).** On head `07b79e35` every Actions
run succeeded with its jobs created — CI/CD Pipeline [42860023401](https://github.com/ravichavali/karmyq/actions/runs/42860023401)
(14 jobs, deploy skipped), Tests 42860023006 (3), PR Contract 42860023107 (1), CodeQL 42860013879 (2) — and the
Integration Tests job ran **both Sprint 139 integration suites green** (28 suites / 469 tests). One finding, **P2: an
older `GET /offers` response could overwrite the current filter's results** (a slow earlier filter, its failure, or its
`finally` landing after a newer request). **Fixed** on this branch with a latest-request guard in
`apps/frontend/src/pages/offers/index.tsx` and four out-of-order tests in
`apps/frontend/tests/regression/sprint-139-offers-page.test.tsx` (red 4/4 → green) in `f57e8524`.

**Next unchecked task**: confirm CI on the new PR head (every run's conclusion and created job count), then the
maintainer decides whether to authorize the plan's **Task 15** (merge + deploy, via the `deploy`/`ship` skills).
Re-derive the version from `origin/master` at merge time (provisional 11.112.0). **Deploy runs no provider backfill:**
existing provider rates stay on the old formula until that provider's next completion or the first successful 03:30 run
after deploy.

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-139-planning`, cut from `origin/master` `74c5a8e5` (v11.111.0); carries the Sprint 138 archive, Sprint 139 planning and execution |
| **Base** | `origin/master` `74c5a8e5` — unchanged on 2026-11-10. If master moves, merge it in with a merge commit (authorized), never a rebase |
| **Active editor** | Claude (execution chat, 2026-11-09/10) — branch owner |
| **Reviewer** | An independent non-author agent: **review only, no pushes to this branch** |
| **Owned paths** | The plan's File Map, plus `apps/frontend/src/pages/offers/new.tsx` and `src/pages/matches/[id].tsx` (recorded scope expansion) |
| **Shared resources** | **Dependency lane: Claude** (maintainer-designated); no dependency work done. **No ADR number allocated** (four existing ADRs amended). #178 dated (below) |
| **Merged branches safe to delete** (maintainer's call) | `agent/claude/sprint-138-planning` (`96ce19d2`, same tree as `74c5a8e5`), `agent/claude/sprint-137-planning` (`49ebd68a`), `agent/claude/sprint-136-planning` (`170d39fe`), `agent/claude/sprint-135-pr-request-status-guards` (`7bfc65ac`), `agent/claude/sprint-135-planning` (`5a3589ef`), `agent/claude/sprint-134-pr-bug-077-badge-insert` (`afbaed7a`); older `agent/claude/sprint-134-*` heads remain on origin |

## What was built (plan Tasks 1–12; Task 13 was verification only, Task 14 is this handoff + the PR)

| Commit | Plan task | What |
|---|---|---|
| `96966f6a` | 1–2 | BUG-092: cleanup/simulation tiered `test` scripts + explicit `testMatch`; simulation's 17-test demo-env-file suite tdd → regression; new gate `tests/regression/sprint-139-tdd-boundaries.test.ts`; version → 11.112.0 (3 root fields only) |
| `2464bcad` | 3 | BUG-076: `turbo.json` `test:tdd` (uncached, `dependsOn: ["build"]`); root `--continue=always`; hook keeps npm's status in a retained `mktemp` log; gate `tests/regression/sprint-139-prepush-tdd-report.test.ts`; hooks re-installed |
| `f88f1b86` | 4 | Ten red WIP suites written and run red before any source change |
| `559b2364` | 5 | BUG-097: `GET /offers` predicate per spec A + `expires_at`/`expired`; offers page repair + labels; **scope expansion** `/offers/new`, `/matches/[id]`; Sprint 138 C case rewritten (mutation-proven) |
| `ef31e57a` | 6–7 | BUG-080 terminal-outcome rate + `refreshAllProviderTrustScores` + `runDailyTrustScoreRefresh`; BUG-081 numeric readers + strict cache normalization |
| `cf038909` | 8 | BUG-082: five `db.ts` wrappers log success at debug |
| `941bb733` | 9 | Root integration suites (CI-only) |
| `f8850490` | 11 | 11 suites promoted individually (`git mv`, not the repo-wide promoter); BUGS entries; registry notes |
| `3b1642fb` | 10 | Guides, observability concept, onboarding step, ADR-015/029/042/088 amendments, regenerated landing docs |
| `d7dab27f` | 12 | `/simplify` fixes |
| `e989293d` | 12 | `/code-review` fixes: picker uses `getMyCommunities(currentUser.id)`; query loggers created lazily (honour a `.env` `LOG_LEVEL`) |
| `ed7073e9` | 12 | `/security-review` result; BUG-100 logged |
| `07b79e35` | 14 | Handoff (the PR was opened on this head; the independent review ran on it) |
| `f57e8524` | review | Independent-review P2 fix: only the latest `GET /offers` request may update the offers list |

Committed after it: this handoff update only (docs). **Tested commit: `f57e8524`** — full `npm test` exit 0 (27/27 Turbo
tasks; 24 cached, as only the frontend changed since `ed7073e9`, where the full uncached run and the type-checks in all
eight changed workspaces also passed; lockfile diff = the three root version fields). Detail and limits: the PR's
`## Validation` ledger. A real root `npm run test:tdd` now actually runs (23 tasks) and exits 1 on
**pre-existing** WIP reds in request, community, social-graph, tests and frontend — reported as a warning, not fixed.

## Decisions taken during execution (rulings; each recorded with its cost if wrong)

- `refreshProviderTrustScore` returns the stored rate (`Promise<number>`, plan said `void`) so the completion path
  keeps logging it; internal only.
- Tasks 6–7 and 8–9 shared a process review; 6–7 share one commit (same CONTEXT file).
- Hook gate: Windows `TMPDIR` is rewritten by MSYS to `/tmp/...`, so the test translates with `cygpath`; the
  failing-`tail` fixture uses a `BASH_ENV` function (Git for Windows' `cmd/git.exe` prepends its own `usr/bin`).
- Integration NULL-expiry fixture is `UPDATE`d to NULL after insert: `requests.set_offer_expires_at()` (BEFORE INSERT)
  defaults a NULL `expires_at` to `created_at + 60 days`.
- `/code-review` was used as the plan's whole-branch final review (no separate reviewer dispatch).
- Not fixed, by spec or scope: members see expired *non-active* offers (spec A approves); per-profile repeated rate
  read; shared query wrapper / `logger.query()` repair (spec E); BUG-079 coercion kept (spec D); retained TDD logs
  accumulate (spec requires retention; deferred minor).

## Open questions for the maintainer

1. **BUG-100 (security, pre-existing):** `GET /communities/my/communities` trusts a query-string `user_id`, so a
   signed-in user can list another user's memberships. Schedule a fix? (Not widened by this PR.)
2. **BUG-098:** sweep the remaining `response.data.data` reads (`admin/trust-questions` is confirmed broken)?
   **BUG-099:** the offers "All" filter shows active offers only.
3. **Now-visible WIP reds** (five workspaces): the hook will warn on every push until they are fixed or promoted.
4. Unscheduled product candidates unchanged: the mobile sprint, backing out of an in-progress exchange, the 2026-11-08
   communication-channel framing idea (adversarial discussion first).
5. **#329 — Expo patch train?** Still open; dependency work needs an advisory or a feature need.

## Dated obligations

- **`deepmerge` #178** (dismissed `tolerable_risk`): re-check at the next Expo SDK move or by **2026-12-01**.
- Nothing else is dated.

## Carry-forward work

- **From Sprint 138's final review:** F2 (accepted consequence), F3 (`GET /offers/:id` still answers `status: 'active'`
  for an expired offer), F4, F8, F9 — unchanged by this sprint (see the Sprint 138 archive).
- **Logged follow-ups from this sprint's gates (spec-forbidden or out of scope):** a pg NUMERIC type parser; a
  versioned effective-params cache key; a shared timed-query wrapper / `logger.query()` repair; a `match_cancelled`
  consumer instead of the nightly sweep; one offer-past-expiry SQL fragment (`NOW()` vs `clock_timestamp()`); typed API
  wrappers or a `.data.data` gate (BUG-098); the three-way hook push-harness test refactor.
- **Earlier carry-forward unchanged:** Sprint 137 `/simplify` deferrals; BUG-087 runtime log proof; BUG-073 tabled;
  PR C exemption re-check (registry empty); PR D's D8 (host persona); per-community health-quality weight (needs an
  ADR number); the Sprint 135 recount note.
- No demo backfill, demo-host read or optional expired-holds log read was run or authorized.

## Standing rules

See `CLAUDE.md` and the Sprint 138 archive's *Standing rules*. Branch off `origin/master`; never force-push or
direct-push master; one merge at a time; no docs-only master push; ask before any demo-host operation, merge, ADR
number, dismissal or dependency work; stop after PR creation. Check each CI run's conclusion and job count, not only
`gh pr checks`.
