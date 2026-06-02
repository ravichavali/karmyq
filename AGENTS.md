# AGENTS.md — Cross-Agent Bootstrap (Codex, Claude, others)

This is the **shared entry point for every AI coding agent** working in the Karmyq
monorepo. Claude Code, Codex, and any other agent MUST load this context before doing
any work. The full rulebook is [`CLAUDE.md`](CLAUDE.md) — this file points every agent at
it plus the skill system, handoff, and memory so no agent starts blind.

> **Why this exists:** Claude Code auto-loads `CLAUDE.md`; Codex auto-loads `AGENTS.md`.
> This file makes both converge on the same context. **`CLAUDE.md` is the source of
> truth** — when this file and `CLAUDE.md` ever disagree, `CLAUDE.md` wins.

---

## STEP 1 — Load global + state context (read these first, in order)

1. **[`CLAUDE.md`](CLAUDE.md)** — global rules. These OVERRIDE your defaults. Note especially:
   the Pre-Merge Checklist, the TDD framework (unit + regression MUST pass before push),
   "Update don't create", "Fix forward not around", and the documentation feedback loops.
2. **[`.claude/handoff/CURRENT_HANDOFF.md`](.claude/handoff/CURRENT_HANDOFF.md)** — what the
   last session did, current blockers, next steps. If a handoff exists, follow its Quick
   Start. This is the ONLY doc that carries state between sessions.
3. **Persistent memory** — `~/.claude/projects/c--Users-ravic-development-karmyq/memory/MEMORY.md`
   (the index) plus any individual memory file whose description matches the task. These are
   hard-won project gotchas and workflow preferences. Verify any file/flag/function a memory
   names still exists before relying on it. *(Machine-local to the maintainer's checkout; may
   be absent in a sandbox or on another machine — that's expected.)*
4. **[`services/registry.json`](services/registry.json)** — source of truth for services,
   ports, endpoints, events, and dependencies.

## STEP 2 — Load the skill system

Skills are markdown playbooks (`SKILL.md`). Read the matching skill and **follow it exactly**
before acting. **If there's even a 1% chance a skill applies, read it first.** Process skills
(brainstorming, debugging, TDD) come BEFORE implementation skills. A user's explicit
instruction always outranks a skill.

**Claude Code:** use the `Skill` tool. **Codex / others:** skills don't auto-load — open the
`SKILL.md` and follow it. First read the tool-name mapping so you translate Claude tool names
to your own (`Read`→your read tool, `Bash`→your shell, `TodoWrite`→`update_plan`,
`Task`→`spawn_agent`, etc.):

```
~/.claude/plugins/cache/claude-plugins-official/superpowers/*/skills/using-superpowers/references/codex-tools.md
```

**Project skills** — [`.claude/skills/<name>/SKILL.md`](.claude/skills/):

| Skill | Use when |
|-------|----------|
| `sprint-planning` | Planning a new sprint (produces spec + plan + handoff) |
| `pre-commit-check` | **MANDATORY before every `git commit`** — runs the pre-merge checklist + process-reviewer agent |
| `deploy` | Deploying to the karmyq.com demo environment |
| `update-handoff` / `handoff` | Updating `CURRENT_HANDOFF.md` |
| `arch-review`, `capture` | Architecture review / capturing a transient idea |

**Superpowers skills** — `~/.claude/plugins/cache/claude-plugins-official/superpowers/*/skills/<name>/SKILL.md`:
`brainstorming` (before any feature/creative work), `test-driven-development`,
`systematic-debugging`, `writing-plans`, `executing-plans`, `verification-before-completion`,
`requesting-code-review`, `receiving-code-review`, `finishing-a-development-branch`,
`using-git-worktrees`, and more.

## STEP 3 — When working in a specific area, read the LOCAL context first

- **A service** → `services/<name>/.claude/README.md` AND `services/<name>/CONTEXT.md`
- **Custom review agents** live in [`.claude/agents/`](.claude/agents/)
  (`migration-validator`, `process-reviewer`) — their `.md` files describe checks to run for
  migrations and before commit.

## STEP 4 — Honor the standing rules

- **TDD:** new tests go in `tests/tdd/` (or `services/<name>/tests/tdd/`), promote to
  `regression/` when green. unit + regression MUST pass before push.
- **Docs feedback loop:** every behavior change updates the service `CONTEXT.md`,
  `services/registry.json`, an ADR if architectural, and the `apps/landing/` docs site
  (see `CLAUDE.md` → "Landing Page Docs").
- **Quality gates before merge:** tests, `/simplify`, `/code-review`, `/security-review`.
- **Solo dev, no git worktrees** unless asked. Work on feature branches.
- **Host is Windows / PowerShell.** Use PowerShell syntax (`$null`, `$env:VAR`).
- **End of session: UPDATE the handoff** before stopping.

## Lanes & Merge Authority

This repo runs an **enforced multi-agent PR process**. The PR is the contract between
agents; shared state lives in the repo, never in an agent-private memory store.

### Roles
- **Admin (maintainer):** owns scope approval, **merge authority**, and deploy. The merge
  decision and deploy authorization are the Admin's.
- **Claude (orchestrator):** assigns scoped work, validates gates, owns **merge-readiness
  validation and the merge recommendation**, and may *execute* a merge only once the Admin has
  authorized it (e.g. "pull it in"). Claude is the **only** agent that marks a sprint complete.
- **Contributor agents (Codex / others):** implement scoped tasks only; open PRs; never
  self-merge; never resolve cross-agent conflicts independently.

### Branch ownership (non-overlap)
- One agent per branch. No agent pushes to another agent's branch. No direct commits to `master`.
- Agent lane: `agent/<agent-name>/<slug>` (e.g. `agent/codex/dashboard-retry`).
- Human lanes: `feature/`, `fix/`, `docs/`, `refactor/`, `chore/`.

### The PR contract — templates are known
- Every task = one branch = one PR carrying the contract in [`.github/pull_request_template.md`](.github/pull_request_template.md).
- **GitHub only auto-injects the template in the web "create PR" UI.** When you open a PR with
  `gh pr create` or the API, the template is **NOT** applied — you MUST copy
  `.github/pull_request_template.md` into your `--body` and fill every section. The
  `pr-contract` CI check fails the PR if the required headers are missing.
- Issue templates live under [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/).
- **Out-of-band actions** (e.g. dismissing a CodeQL/audit alert) MUST be recorded in the PR
  body's "Security dismissals" section with a justification + link.
- **No merge without all gates green:** `tsc --noEmit`, unit/regression tests, docs updates,
  `/code-review`, `/security-review`, and the required status checks.

### Handoff vs PR body (no duplication)
- The **PR body** carries per-task detail (what changed, files, tests, risks).
- **`CURRENT_HANDOFF.md`** carries rolling cross-session state + the active branch/ownership.
- Do not copy the full PR contract into the handoff — they drift.

### Shared state lives in-repo
- Claude's persistent memory is **advisory only** (maintainer-local convenience). Any decision
  or process state another agent must honor MUST be written to repo docs, `CURRENT_HANDOFF.md`,
  an ADR, or the PR body.

### Conflict policy
- If two agents need the same file area, the second agent **pauses and requests reassignment**.
  Claude re-scopes/rebases; contributor agents do not resolve cross-agent conflicts themselves.

### Concurrency escalation (documented, NOT active)
While work is **serial** (one agent at a time) the default is direct contributor-PR-to-`master`
with required review. Activate the following ONLY when **2+ agents work the same sprint
concurrently**:
- **File-ownership manifest per task:** orchestrator posts a per-task file-ownership list in the
  PR/handoff; contributors edit only listed files; new files need a lock-update request first.
- **PR layering:** contributor PRs target a Claude-maintained integration branch; Claude owns
  the final integration PR to `master`. The integration branch needs its own branch protection
  (else it becomes a second unprotected mainline).

---

**At session start, confirm you have loaded `CLAUDE.md`, the current handoff, and `MEMORY.md`,
then summarize: what the last session left, current blockers, and what you recommend tackling
first. Do not start coding until then.**
