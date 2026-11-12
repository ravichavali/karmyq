# PR #335 process overhead reduction — archived post-merge record

Archived on `agent/claude/usage-diet` (2026-11-11). [PR #335](https://github.com/ravichavali/karmyq/pull/335) merged on
2026-11-11 at 23:53:07Z as `edc867e90bb2c913da2702f3e6e875b35d9062cc`. Master CI/CD run
[43123187527](https://github.com/ravichavali/karmyq/actions/runs/43123187527) concluded `success` on that SHA, with all
14 jobs successful, Deploy to Demo among them (re-verified with `gh run view` on 2026-11-11). `https://karmyq.com/`
returned 200 on the same date. No version bump: #335 changed process docs and scripts only, so `package.json` stays at
11.113.0.

The "pending" review wording in the snapshot below is historical. The reviewing Claude chat recorded that its
non-author `/code-review medium` and `/security-review` ran on head `7f9b027d` before the merge: code review raised 10
non-blocking findings and security review found none. Those results were never posted to the PR; its last comment is
the first-round review at 23:06:50Z. They are therefore **UNVERIFIED** against GitHub. ADR-104 (allocated 2026-11-11)
records the process decision, which #335 shipped without an ADR.

The snapshot below is preserved verbatim from `edc867e9`. Relative links inside it keep their original locations.
Working navigation from this archive: [previous archive (Sprint 140 PR A)](2026-11-11-sprint-140-pr-a-COMPLETE-v11.113.0.md),
[ADR-104](../../../docs/adr/ADR-104-agent-process-economy.md).

---

# Process overhead reduction — PR #335 review fixes

**Date:** 2026-11-11
**Branch:** `agent/codex/process-overhead`
**Base:** fresh `origin/master` `24bed69b` (PR #334).
**Goal:** replace repeated agent-driven mechanical checks with a quiet deterministic gate,
retain judgment review once per PR, and reuse tests only on the same clean HEAD.

## Quick Start

1. Read `CLAUDE.md` and this handoff. Run `git status --short`, `git fetch origin`,
   `gh pr list`, and `git log --oneline origin/master -3` to reconcile live state.
2. Stay on `agent/codex/process-overhead`. The task owns the pre-commit/process-reviewer,
   ship/review-response/sprint-planning instructions, service reminder, script docs and two
   root regression suites. No dependency, service behavior, version or ADR changes.
3. Open [PR #335](https://github.com/ravichavali/karmyq/pull/335) and its commit-specific
   `## Validation` ledger for tested SHAs, CodeQL annotations and limitations. Review feedback:
   [Claude's items 1–8](https://github.com/ravichavali/karmyq/pull/335#issuecomment-6809294318).
4. The next unchecked task after these fixes is Claude's non-author `/code-review medium` and
   `/security-review` on the fixed head, plus current-head CI/annotation verification. Codex
   review equivalents do not claim those Claude commands ran. Merge and deploy still require
   maintainer authorization; never direct-push master or force-push this branch.

## Decisions and progress

- Mechanical checks compare the Git index to `git merge-base origin/master HEAD`, including
  earlier branch commits, staged additions and staged deletions. A missing base fails closed.
  New TS/TSX source requires either a tracked basename-matching test or an indexed test that
  imports the module; both are heuristics. Judgment review evaluates actual behavior coverage.
- The final script rejects unstaged tracked changes before npm so tests cannot validate different
  bytes from the index. npm's exit status is captured directly; success is silent and failure
  diagnostics are bounded. The git hook remains responsible for feedback:check.
- Claude Code hook docs checked 2026-11-11: command hooks read JSON stdin;
  PreToolUse can send model context via hookSpecificOutput.additionalContext on stdout.
  The reminder uses a tested standalone script instead of an environment-only stderr command.
  Source: https://code.claude.com/docs/en/hooks#pretooluse-decision-control
- Passing tests may be reused only with the same HEAD SHA, exit 0, clean tree then and now,
  command/cache/limitations recorded. Staged pre-commit evidence on a parent is explicitly
  distinguished. No change to the installed git gates or CI.
- Regression cases were written first. The initial focused run passed 18/18; review then added
  isolated deleted-test and two-service cases. Full testing, gotcha/feedback checks and exact
  outcomes belong to the PR Validation ledger, not an unstamped pass count in this document.
- The earlier Codex-equivalent review missed the five blockers Claude found on `e8cb7d20`.
  The hook fixture now pins the configured command identity and invokes a fixed Node executable
  with argv; settings text is no longer shell code. New branch-scope, missing-base and imported-test
  cases were observed failing before the gate fix. Both suites are re-run with `--no-cache`;
  exact outcomes and actual tested commits belong to the PR ledger.
- Remaining Edit/Write handler defects are captured as BUG-101 in `docs/BUGS.md` (review item 7).
  Item 6's session/service reminder deduplication and malformed-input handling are deferred.
  Item 8's WIP baseline investigation is recorded in the PR ledger; do not assume the old count.
- Root claude.md relocation remains report-only in the PR. Candidates: service catalog detail,
  nginx setup, schema inventory, event transport detail, new-service scaffolding and deployment
  commands. Keep global authorization, API contracts, dependency rules and merge authority.

## Previous sprint reconciliation (observed 2026-11-11)

- [PR #334](https://github.com/ravichavali/karmyq/pull/334) merged at 2026-11-11T21:29:44Z
  as `24bed69b5eb714ef58de7784c750e2e2eaa2bcf6`. `gh pr list` returned no open PRs before this task.
  The inherited handoff's awaiting-review state is superseded by this observation.
- Master Tests run 43103530577 and CodeQL run 43103530350 report success on that SHA.
  This task has not independently verified demo health or marked Sprint 140 complete.
- The prior handoff is now restored verbatim in the local
  [Sprint 140 archive](archive/2026-11-11-sprint-140-pr-a-COMPLETE-v11.113.0.md), with a short
  post-merge note and verified master CI/CD run 43103530588 on `24bed69b`.
  Sprint 140 PR B remains unplanned and decision-gated: required-CI integration execution design
  and a per-suite repair/rewrite/retire ledger need approval before implementation; retirement
  needs separate approval and replacement coverage. This task does not authorize that work.

## Dated obligations and follow-ups

- node-forge security fix from #334 is now on master; alert closure has not been re-queried by
  this task. Do not dismiss alerts as a substitute for a master scan.
- deepmerge alert #178: re-check at the next Expo SDK move or by **2026-12-01** (prior handoff).
- #329 Expo SDK drift and all Sprint 140 carry-forward items remain outside this task.
- Root context relocation recommendations belong in this PR's report; no root claude.md
  service-specific section is moved in this task.
