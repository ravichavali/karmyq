# AGENTS.md — Cross-Agent Bootstrap (Codex, Claude, others)

This is the **shared entry point for every AI coding agent** working in the Karmyq
monorepo. Claude Code, Codex, and any other agent MUST load this context before doing
any work. The full rulebook is [`CLAUDE.md`](CLAUDE.md) — this file points every agent at
it plus the skill system, handoff, and memory so no agent starts blind.

> **Why this exists:** Claude Code auto-loads `CLAUDE.md`; Codex auto-loads `AGENTS.md`.
> This file makes both converge on the same context. **`CLAUDE.md` is the source of
> truth** — when this file and `CLAUDE.md` ever disagree, `CLAUDE.md` wins.
>
> **This file is a one-way bridge:** it adapts non-Claude agents *into* the canonical
> **Sprint Session Bootstrap** defined in [`CLAUDE.md`](CLAUDE.md) ("🚀 Starting a New
> Conversation?") — including the *one-chat-per-sprint* cadence. It does **not** define a
> separate process. The STEP 1–4 sequence below is how a non-Claude agent *executes* that
> canonical bootstrap (with the tool-name mapping Claude doesn't need); the rule itself lives in
> `CLAUDE.md`. Claude reaches the bootstrap by auto-loading `CLAUDE.md` and need not read this file.

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

> **Enforcement reality (read this):** `master` branch protection enforces by **authenticated
> GitHub identity, not by folder, agent, or commit author.** Because protection is set with
> `enforce_admins: false` (so the solo maintainer isn't locked out of their own PRs), any push
> using the maintainer's **admin** credentials **bypasses** the rules — and on the maintainer's
> machine, *every* agent (Claude, Codex, …) shares those same `gh`/git credentials. So for
> same-machine agents, "no direct commits to `master`" is a **convention enforced by this
> document, not a hard gate** — GitHub will let an admin-credentialed push through (it did once,
> on purpose, leaving an empty marker commit on `master`). The gate is only *hard* for non-admin
> identities (a write-only bot account/PAT, or external fork contributors). To hard-enforce it
> for agents, give them a non-admin identity; flipping `enforce_admins: true` would also bind the
> maintainer and remove self-merge. Until then: **agents MUST honor the branch/PR rules by
> discipline.**

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

### Same-machine reality: shared working tree, time-sliced (READ THIS)

The actual operating setup: **Claude and Codex run as two VS Code sessions pointed at the same
physical project folder on the same machine**, worked **time-sliced** (one agent active at a time;
roles rotate across plan → code → review; different parts of a sprint run by different agents).

**Consequence — there is no branch isolation between the two windows.** Git allows only one
checked-out branch per working tree, so both sessions are always on the *same* branch and **share
one working tree**. Anything either agent writes lands in the other's live tree immediately. The
"one agent per branch / no agent pushes to another's branch" lane model above describes *PR/identity
ownership* and *separate-checkout* setups — it does **not** create file-level isolation here.

**What actually prevents clashes (the real rules for this setup):**
1. **One agent edits at a time.** Never edit the shared tree while the other agent has work in
   flight in the other window.
2. **Clean tree at every role handoff.** The active agent **commits or stashes before handing the
   session to the other agent.** A clean tree at every switch removes almost all of the clash
   surface. Never edit or commit on top of the other agent's *uncommitted* WIP.
3. **Per-task file ownership.** When a sprint splits work, the orchestrator names which files each
   agent owns (in the handoff's "Active Session" stanza or the PR body); the other agent stays out
   of those files until handed over.
4. **Read-only when in doubt.** A cross-cutting task (context/process cleanup, audits) stays
   read-only until the other agent's work is committed/merged and the tree is clean.

> If the maintainer ever moves to **separate checkouts / git worktrees** (not the current setup —
> see "Solo dev, no worktrees"), then the branch-isolation lane model and PR-layering /
> integration-branch escalation become applicable. Until then, the four rules above govern.

---

**At session start, execute the canonical Sprint Session Bootstrap from
[`CLAUDE.md`](CLAUDE.md) → "🚀 Starting a New Conversation?":** confirm you have loaded
`CLAUDE.md`, the current handoff, and `MEMORY.md`, then summarize what the last session left,
current blockers, and what you recommend tackling first. Do not start coding until then. (A new
sprint warrants a fresh chat; same-PR follow-ups stay in the current one — see the cadence table
in `CLAUDE.md`.)
