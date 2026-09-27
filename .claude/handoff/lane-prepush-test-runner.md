# Pre-push test runner + npm test caps + evidence ledger — Handoff

**Date**: 2026-09-24
**Outcome**: #272 shipped; #273 updated from master at v11.70.0, merge authorized on green checks

> The handoff carries **state between sessions**. It is branch-local, so it reserves nothing; see
> `CLAUDE.md` → *Parallel Development* for how contended resources are actually allocated.

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/prepush-test-runner` |
| **Base** | `origin/master` at `8fafed02` (v11.68.0, fetched 2026-09-24) |
| **Active editor** | Claude (Windows box) |
| **Reviewer role** | the maintainer, plus an external review; reviewers read the diff, they do not co-edit |
| **Owned paths** | `scripts/prepush-test-runner.js`, `scripts/jest-worker-cap.js`, `scripts/git-hooks/pre-push`, every `jest*.config.js` (one-line wrap), `turbo.json` (`concurrency`, `globalPassThroughEnv`), `tests/docker-compose.test.yml` (test-runner mount), `tests/regression/sprint-131-prepush-test-runner.test.ts`, the sprint-123 hook assertion, `.github/pull_request_template.md`, the `ship` / `review-response` / `update-handoff` skills, `scripts/claude.md`, `scripts/git-hooks/README.md`, `CONTRIBUTING.md`, BUG-053 in `docs/BUGS.md` |
| **Shared resources needed** | the version bump (at merge time) and the merge slot; no ADR (exception granted, below); no dependency or demo data work |

## Links

- **PR**: `gh pr list --head agent/claude/prepush-test-runner` (the PR body carries the evidence ledger)
- **Origin**: `/insights` report 2026-09-24, suggestions #1 (reconcile claims against evidence) and #2 (pre-push hook timeouts)

## Quick Start

1. `git fetch origin && gh pr list && git log --oneline origin/master -3`, then
   `gh pr view --json state,statusCheckRollup` for this branch's PR.
2. `git switch agent/claude/prepush-test-runner`. After switching from another branch, run `npm ci`
   and `npx turbo run build --force`: a stale `node_modules` or `packages/shared/dist` from another
   branch (for example D6's zod 4) makes this branch's tests fail for reasons unrelated to it.
3. `npm run hooks:install` so the pushed hook is the one that runs.

**Next unchecked task**: #273's merge, which the maintainer authorized on 2026-09-26 ("if all
checks out, merge #273 as well"), conditional on green checks at the merge commit. The PR shows
`REVIEW_REQUIRED`, so it needs an admin merge, and the permission classifier refused Claude's
attempt on #272; if it refuses again, the maintainer runs `gh pr merge 273 --squash --admin`.
After it deploys: verify health, then archive this lane file and delete its router row.

Done 2026-09-26:
- #272 merged as `01ed6cb9` (v11.69.0), with deploy and smoke verified (see `CURRENT_HANDOFF.md`).
- This branch is updated from `origin/master` with a merge commit and bumped to v11.70.0 in
  `package.json` and the lock root, with no other lock change.
- The router conflict is resolved: #272's Sprint 131 state kept, its D6 row dropped, this lane's
  row kept.
- D6's close-out folded in here, to avoid a docs-only master push: its SHIPPED line, the
  next-action paragraph (now D7) and `docs/IDEAS.md` follow-ups.

## Blockers and decisions

- **Decision (maintainer, 2026-09-24): caps behind `npm test` for every caller, CI included.**
  `turbo.json` `"concurrency": "4"` and `jest-worker-cap.js`'s default of 2 workers, overridable
  with `TURBO_CONCURRENCY` / `KARMYQ_JEST_MAX_WORKERS`. The single timeout-only retry stays in the
  pre-push runner. Why: three clean capped runs support the caps but do not prove a retry is
  never needed.
- **Decision (maintainer, 2026-09-24): ADR exception.** `CLAUDE.md` asks for an ADR when 3+
  services change; this touches only their test config, no service behavior. The exception and
  its reason go in the PR body.
- **Decision (maintainer, 2026-09-24): lane file + minimal router.** `CURRENT_HANDOFF.md` on this
  branch only swaps its stale bootstrap banner for an Active lanes pointer; the Sprint 131 state
  below it is untouched.
- **Decision (maintainer, 2026-09-25): #272 merges first.** It keeps v11.69.0. #273 re-bumps to
  the next version from `origin/master` after #272's deploy passes its health check. No version
  commit is made on this branch before then.
- **Evidence refreshed (2026-09-25):** a second `/security-review` over `91295af8..d126755a`
  (the async runner, stdout-derived logs, the caps, the test-runner mount) found nothing. The
  PR's timing claim now reads "no CI slowdown observed in these runs"; two runs do not explain
  the 157 s vs 217 s spread.
- **Decision: the retry never runs on its own evidence.** Tasks that never ran are retried only
  alongside a proven Jest timeout; a timeout is a failure block whose FIRST message line is Jest's
  timeout error. Everything else blocks.
- **Fixed from the second `/code-review` (medium):** the root `tests` suite is `cache: false`,
  and Turbo writes no log file for it (confirmed in four real run summaries), so its timeouts
  always blocked. The runner now streams Turbo's output live and keeps it, and reads a
  log-less task's lines from it (`pkg:task: ` prefix).
- **Not fixed here, logged as BUG-053:** `npm test`'s `posttest` promoter never runs under
  `ignore-scripts=true` (npm 10.8.2, verified), and the hook's `test:tdd` step has never run a
  test (`turbo`: no `test:tdd` task, and `| tail -20` masks that, so the step reports "passed"). Check npm on the Mac before rewriting the docs that claim
  otherwise.

## Verification references (all on the Windows box)

- Measurement, 2026-09-24, Turbo cache forced, Jest cache warm for both, alternating:
  uncapped 3/3 runs exit 1, 36 / 60 / 42 Jest timeouts, 445–562 s, min free RAM 0 GB;
  capped (Turbo 4, Jest 2) 0 / 0 / 0 timeouts, 141–167 s, min free RAM 0.92–1.42 GB.
- Forced cold `npm test` at `856e8e63`'s tree: exit 0, 27/27 tasks, 0 cached, 0 timeouts, 327 s
  with builds (2026-09-24).
- `node scripts/prepush-test-runner.js` for real: exit 0, 27/27 (2026-09-24, 24 cached).
- `tests/regression/sprint-131-prepush-test-runner.test.ts` + the sprint-123 hook test: 50/50
  (2026-09-24). Every check was also shown to FAIL on an injected violation.
- **CI, PR #273 first run (2026-09-25, at `f6edd652`):** `Test Backend Services` 157 s against
  master's 234–246 s (runs 36054927703, 36038174514, 35918478906), so the caps did not slow CI.
  `Integration Tests` FAILED building the test-runner image: `COPY scripts/jest-worker-cap.js`
  in `tests/Dockerfile.test`, but the root `.dockerignore` excludes `scripts`. I had "checked"
  that with `grep … | head`, which truncated before the `scripts` line. Fixed by mounting the
  helper in `tests/docker-compose.test.yml` (as `tests/` already is) and reverting the Dockerfile
  to master. Proven by CI at `2b30c751` (runs 36091214102 + 36091214119, all green, 2026-09-25):
  Integration Tests 276 s; Test Backend Services 217 s (the two PR runs: 157 s and 217 s).

⚠️ **Never record this document's own final commit SHA** — it cannot know it.
