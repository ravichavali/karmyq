# AGENTS.md — Cross-Agent Bootstrap (Codex, Claude, others)

Shared entry point for every AI coding agent in the Karmyq monorepo. Claude Code auto-loads
`CLAUDE.md`; Codex and others auto-load this file. This is a **one-way bridge** into the
canonical Session Bootstrap in [`CLAUDE.md`](CLAUDE.md) — it does not define a separate process.
**`CLAUDE.md` is the source of truth; if the two disagree, `CLAUDE.md` wins.** Claude need not
read this file.

## STEP 1 — Load context, in order

1. **[`CLAUDE.md`](CLAUDE.md)** — global rules; they OVERRIDE your defaults.
2. **[`.claude/handoff/CURRENT_HANDOFF.md`](.claude/handoff/CURRENT_HANDOFF.md)** — the only doc
   carrying state between sessions; follow its Quick Start.
3. **Persistent memory** — `~/.claude/projects/c--Users-ravic-development-karmyq/memory/MEMORY.md`
   + matching memory files (advisory; maintainer-machine-local, may be absent elsewhere; verify
   anything named still exists).
4. **[`services/registry.json`](services/registry.json)** — services, ports, endpoints, events.

Then summarize (sprint, branch, blockers, recommended first action) BEFORE coding. New sprint =
fresh chat; same-PR follow-ups stay in the current one (cadence table in `CLAUDE.md`).

## STEP 2 — The skill system

Skills are markdown playbooks (`SKILL.md`). If there's even a 1% chance one applies, read it and
follow it exactly; process skills (brainstorming, debugging, TDD) come before implementation
skills. A user's explicit instruction outranks any skill.

**Claude:** `Skill` tool. **Codex/others:** skills don't auto-load — open the `SKILL.md` directly.
Tool-name mapping (`Read`→your read tool, `Bash`→your shell, `TodoWrite`→`update_plan`, etc.):
`~/.claude/plugins/cache/claude-plugins-official/superpowers/*/skills/using-superpowers/references/codex-tools.md`

**Project skills** ([`.claude/skills/`](.claude/skills/)): `sprint-planning`,
`pre-commit-check` (**mandatory before every commit**), `deploy`, `ship`,
`update-handoff`/`handoff`, `bug`, `capture`.
**Superpowers skills** (same plugin cache, `superpowers/*/skills/`): `brainstorming`,
`test-driven-development`, `systematic-debugging`, `writing-plans`, `executing-plans`,
`verification-before-completion`, code-review skills, and more.

## STEP 3 — Local context + agents

Working in a service → `services/<name>/.claude/README.md` AND `CONTEXT.md` first. Custom review
agents live in [`.claude/agents/`](.claude/agents/) (`migration-validator`, `process-reviewer`).

## STEP 4 — Standing rules

- **TDD:** new tests in the changed workspace's `tests/tdd/`; promote to `regression/` when
  green; unit + regression MUST pass before push.
- **Docs feedback loop:** every behavior change updates `CONTEXT.md`, `registry.json`, an ADR if
  architectural, and the `apps/landing/` docs (see `CLAUDE.md` → Pre-Merge Checklist, "Landing
  docs authoring").
- **Quality gates before merge:** tests, `/simplify`, `/code-review`, `/security-review` —
  effort calibrated to diff size (see `CLAUDE.md` Pre-Merge Checklist).
- **Declare what you import:** every workspace declares every package it imports; hoisting is not
  a contract (see `CLAUDE.md` → Global Patterns).
- **Solo dev, no git worktrees.** Feature branches only.
- **Host is Windows/PowerShell** (`$null`, `$env:VAR`).
- **Update the handoff before stopping.**

## Lanes & Merge Authority

Enforced multi-agent PR process; shared state lives in the repo, never in agent-private memory.

- **Admin (maintainer):** owns scope approval, merge authority, deploy authorization.
- **Claude (orchestrator):** merge-readiness validation + recommendation; executes a merge only
  after explicit Admin authorization; the only agent that marks a sprint complete.
- **Contributor agents:** implement scoped tasks; open PRs; never self-merge; never resolve
  cross-agent conflicts (pause and request reassignment).
- One agent per branch; no pushes to another agent's branch; no direct commits to `master`.
  Agent lane `agent/<name>/<slug>`; human lanes `feature/`, `fix/`, `docs/`, `refactor/`, `chore/`.
- **Enforcement reality:** on this machine every agent shares the maintainer's admin
  credentials, so branch rules are convention enforced by this document, not a hard gate —
  honor them by discipline.

**PR contract:** every task = one branch = one PR. `gh pr create` does NOT auto-apply the
template — copy [`.github/pull_request_template.md`](.github/pull_request_template.md) into
`--body` and fill every section (the `pr-contract` check fails otherwise). Out-of-band actions
(e.g. alert dismissals) go in the PR body's "Security dismissals" with justification. No merge
without all gates green. PR body = per-task detail; handoff = rolling cross-session state; don't
duplicate one into the other.

## Same-machine reality: shared working tree, time-sliced

Claude and Codex are two VS Code sessions on the SAME folder — one working tree, one checked-out
branch, **no file-level isolation**. The real clash rules:

1. **One agent edits at a time** — never edit while the other has work in flight.
2. **Clean tree at every role handoff** — commit or stash before switching agents; never build on
   the other agent's uncommitted WIP.
3. **Per-task file ownership** — the orchestrator names which files each agent owns (handoff or
   PR body); stay out of the other's files.
4. **Read-only when in doubt** — cross-cutting audits stay read-only until the tree is clean.
