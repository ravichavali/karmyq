---
name: pre-commit-check
description: Run the Karmyq pre-commit checks. Use when the user asks, or before the final commit of a task or PR. Not needed for intermediate commits during plan execution.
---

Stage the intended changes, then run from the repo root:

```bash
bash scripts/pre-commit-check.sh
```

The script checks the staged diff for service CONTEXT updates and tests for new source files,
then runs `npm test`, silently on success. It refuses unstaged tracked changes so npm cannot
test different contents from the index. If tests generate tracked changes, reconcile generated
churn before committing; a modified tree is not reusable evidence for a clean HEAD.

- Exit 0: commit without re-reading files or re-running tests. No process-reviewer invocation.
- Nonzero: fix only flagged items, stage the fixes, and re-run once. If still failing, report
  the remaining failures and stop; do not commit or retry indefinitely.
- Never use `--no-verify`. The installed git pre-commit hook still runs `feedback:check` at
  commit time; this skill and script do not run it a second time.

Intermediate plan-execution commits keep git hooks and focused TDD verification; reserve this
full check for final verification. The judgment-level process-reviewer runs once before opening
the PR. All four SDLC gates and pre-push hooks remain mandatory.
