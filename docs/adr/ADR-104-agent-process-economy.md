# ADR-104: Agent Process Economy — Mechanical Checks Are Scripts, Judgment Runs Once per PR, and Context and Model Fit the Task

**Date**: 2026-11-11
**Status**: Proposed (part 1 shipped in PR #335 on 2026-11-11; parts 2–4 ship in the `agent/claude/usage-diet` PR; becomes Implemented once that PR is merged and deployed)
**Deciders**: Maintainer (scope, repo frontmatter over user scope, and this ADR number, allocated 2026-11-11); Codex (PR #335); Claude (the follow-up PR)
**Related**: [ADR-029](ADR-029-tdd-test-framework.md) (test tiers),
[ADR-088](ADR-088-test-tier-truthfulness.md) (test-tier truthfulness),
[ADR-091](ADR-091-verification-before-assertion.md) (verification before assertion),
[ADR-097](ADR-097-ecosystem-knowledge-registry.md) (repo-scoped operational knowledge)

## Context

Most of this repository's changes are written and reviewed by coding agents, so the cost of the
process is mostly the cost of agent sessions. Three costs were paid repeatedly without buying any
extra assurance:

1. **Mechanical checks were run by agents, again and again.** The pre-commit check ran after
   intermediate plan commits, `process-reviewer` re-did mechanical diff checks inside a model
   context, and full test logs were read back into the conversation to decide pass or fail.
2. **Every session and every subagent loaded the whole root `CLAUDE.md`.** On master `edc867e9`
   it is 29,978 bytes / 498 lines. Much of that text matters only inside one area: parallel
   development rules, landing-docs authoring, the new-service checklist and event routing.
3. **Every subagent inherited the main session's model**, including broad read-only searches
   whose job is to locate files, not to judge them.

None of the remedies may weaken what the process guarantees: the four SDLC gates (testing,
`/simplify`, `/code-review`, `/security-review`), the installed git hooks and CI stay as they are.

## Decision

### 1. Mechanical checks are one deterministic script, run once per task or PR (PR #335)

`scripts/pre-commit-check.sh` compares the Git index with `git merge-base origin/master HEAD`, so
it also covers earlier commits on the branch, and it fails closed when that base is missing. It
requires a service `CONTEXT.md` update for `src/` changes and a tracked test for new TS/TSX
source, then runs `npm test`, capturing the exit status directly. On success it prints nothing; on
failure it prints at most 25 matching diagnostic lines plus the last 15 lines of the log.

- `/pre-commit-check` runs before the final commit of a task or PR, not after every intermediate
  plan commit.
- A test result can be reused only for the same HEAD SHA, with exit 0 and a clean tree both when
  the test ran and now.

The follow-up PR closes two holes where the script's own exit 0 could not be trusted:

- **Untracked files are refused before npm runs.** `npm test` tests the working tree, so a test
  could pass by importing a file that the commit will never contain.
- **A passing run that changed the tree fails, and lists the changed paths.** Regenerated landing
  docs are the known case. Exit 0 means "commit now", so churn must not get through silently.

### 2. Judgment review runs once per PR

`process-reviewer` does judgment work only: whether the tests are meaningful, whether
`CONTEXT.md` and other docs are accurate, and whether the validation evidence is specific to a
commit. It runs once per PR, before the PR is opened. Mechanical checks belong to the script in §1.

### 3. Context is scoped to the work

The root `CLAUDE.md` keeps global rules only. Text that applies to one area moves, verbatim, into
the local context file that area already loads, and the root keeps a one-line pointer:

| Moved section | New home |
|---|---|
| Parallel development rules | `.claude/handoff/README.md` → *Parallel development rules* |
| Landing-docs authoring | `apps/claude.md` → *Authoring docs*. This also replaces stale guidance there to hand-edit `src/data/docs/` |
| New-service must-dos | `docs/SERVICE_GOVERNANCE.md` → §4 *Service Creation Checklist* |
| Event routing | `packages/claude.md` → *Event routing* |

The root file goes from 29,978 bytes / 498 lines to 18,109 bytes / 317 lines, as measured with
`wc -c -l` on the staged file. The doc/context drift gate
(`tests/regression/doc-context-drift-gate.test.ts`) keeps the pointers and the moved invariants
from going stale.

Hooks that fire on every edit must not cost a turn when they cannot help. The service-context
reminder (`scripts/service-context-hook.js`) emits `additionalContext` for a file under
`services/<name>/`. It now exits 0 with no output when stdin is empty or malformed, instead of
throwing.

### 4. Model routing lives in repo agent frontmatter

- `.claude/agents/Explore.md` overrides the built-in `Explore` agent. It uses `model: haiku`,
  read-only tools (`Read, Grep, Glob, Bash`) and `omitClaudeMd: true`. Claude Code's
  [subagent reference](https://code.claude.com/docs/en/sub-agents) (checked 2026-11-11) says a
  project agent named `Explore` overrides the built-in and keeps its own `model`, and that
  `omitClaudeMd` needs Claude Code v2.1.271 or later.
- `.claude/agents/migration-validator.md` uses `model: sonnet`.
- `process-reviewer` is deliberately unchanged and inherits the session model, because its work
  is judgment.

The maintainer chose **repo frontmatter over user scope** (`~/.claude/agents/`) so that both
development machines and every clone get the same routing, with no step to sync. The accepted
trade-off is that Codex and Kimi ignore both `.claude/agents/` and `model:`.

## Consequences

**Easier**
- A task pays for one quiet test run instead of several runs read back into context.
- Every session and every subagent starts with a fixed context about 40% smaller.
- Broad searches run on a cheaper model, and judgment stays on the session model.

**Harder / risks**
- A haiku `Explore` can miss things. It only locates code: it reports what it searched and what
  it did not find, and nothing it returns counts as review.
- With `omitClaudeMd`, `Explore` does not see the repository rules. That is acceptable for a
  read-only agent. Its own body carries the few rules a search needs: `jq` may be missing, and
  `node_modules` must be excluded.
- Moved text is read only when its area's file loads. That is the intent, so the root pointer
  has to stay accurate. The drift gate checks the pointers, but it does not check whether an
  agent actually follows them.
- `pre-commit-check.sh` now fails on landing-docs churn even when every test passes. The fix is
  to revert the churn and re-run; it is never to bypass the script.
- **No token saving is measured or claimed.** Proving one would need `/usage` comparisons across
  comparable sessions before and after. UNVERIFIED.

## Alternatives Considered

- **User-scope agents (`~/.claude/agents/`).** They are not in a clone and not synced between
  the two machines, so routing would differ per box.
- **`CLAUDE_CODE_SUBAGENT_MODEL`.** It is set per machine and applies to every subagent,
  including the judgment-heavy ones.
- **Running `process-reviewer` on a smaller model.** Rejected: its remaining work is judgment,
  which is exactly what a smaller model does worst.
- **Deleting area-specific text instead of moving it.** That would lose knowledge paid for in
  past incidents. Moving it keeps the knowledge and changes only who loads it.
- **Keeping the per-commit pre-commit run.** That is the repeated cost this ADR exists to remove.

## Verification

- `tests/regression/pre-commit-check.test.ts`: disposable-repo fixtures for each violation,
  including the untracked-file refusal and the tree-changing passing run.
- `tests/regression/service-context-hook.test.ts`: the configured command identity, the reminder
  output and quiet exit on unusable stdin.
- `tests/regression/doc-context-drift-gate.test.ts`: pointers, moved invariants and this ADR's
  index and nav entries.
- The ledger in the PR's `## Validation` section records the commits these tests ran on.
