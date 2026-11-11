# Process overhead reduction — PR review handoff

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
3. Find this branch's PR with `gh pr list --head agent/codex/process-overhead --state all`.
   Read its commit-specific `## Validation` ledger for exact tested SHAs and limitations.
   Opening the PR with the full template is this session's final publication step; if it is
   absent, finish validation and push with normal hooks before opening it.
4. The next unchecked task is to check the PR's current-head CI and review findings. Merge and
   deploy remain maintainer-authorized; never direct-push master.

## Decisions and progress

- Mechanical checks read the Git index, including staged test additions and excluding deletions.
  New TS/TSX source requires a tracked basename-matching test; filename presence is only a
  mechanical heuristic. Judgment review still evaluates actual behavior coverage.
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
- Calibrated independent code/security review found no actionable production defects; its
  deleted-test coverage gap was fixed. Simplify pass removed a literal-command dependency from
  the hook fixture. Agent/skill YAML frontmatter was parsed after fixing a quoted description.
- Root claude.md relocation remains report-only in the PR. Candidates: service catalog detail,
  nginx setup, schema inventory, event transport detail, new-service scaffolding and deployment
  commands. Keep global authorization, API contracts, dependency rules and merge authority.

## Previous sprint reconciliation (observed 2026-11-11)

- [PR #334](https://github.com/ravichavali/karmyq/pull/334) merged at 2026-11-11T21:29:44Z
  as `24bed69b5eb714ef58de7784c750e2e2eaa2bcf6`. `gh pr list` returned no open PRs before this task.
  The inherited handoff's awaiting-review state is superseded by this observation.
- Master Tests run 43103530577 and CodeQL run 43103530350 report success on that SHA.
  This task has not independently verified demo health or marked Sprint 140 complete.
- The complete prior record, including PR-B suite names and carry-forward details, remains in
  [the base handoff](https://github.com/ravichavali/karmyq/blob/24bed69b5eb714ef58de7784c750e2e2eaa2bcf6/.claude/handoff/CURRENT_HANDOFF.md).
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
