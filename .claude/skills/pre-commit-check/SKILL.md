---
name: pre-commit-check
description: Run the full Karmyq pre-merge checklist before committing — invokes the process-reviewer agent, runs tests, and verifies feedback loop. Use this before every git commit.
---

Run the process-reviewer agent to check compliance with the Karmyq development process.

The agent will check:
1. Local `.claude/README.md` was consulted for each changed service
2. Tests exist for every new logic file
3. `CONTEXT.md` was updated for each changed service
4. `npm run feedback:check` passes
5. `npm test` passes

If all checks pass, proceed with the commit.
If any check fails, fix the flagged items before committing — do NOT use `--no-verify` to bypass.
