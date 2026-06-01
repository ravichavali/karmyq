# Enforced Multi-Agent PR Process — Design

**Date:** 2026-06-01
**Status:** Approved (design)
**Author:** Claude (with maintainer)

## Problem

Karmyq is moving from a single-agent (Claude) workflow toward multiple AI agents
(Codex today, others later) plus future human contributors. A recent session exposed three
friction points that will worsen as contributors multiply:

1. **PR state is ambiguous.** A `pull/new/...` URL was mistaken for an existing/merging PR.
   There is no single, unambiguous "where are we" signal at the seam between agents.
2. **Out-of-band actions are invisible.** A CodeQL alert was dismissed manually with no
   durable, reviewable record of the decision or its justification for the next agent.
3. **Two memory systems that don't talk.** Claude's private memory dir holds hard-won
   project gotchas that **Codex and human contributors cannot see.** The knowledge that makes
   one agent productive is locked in an agent-private store.

The existing bones are good: `AGENTS.md` bootstrap, the handoff framework, `CONTEXT.md`
files, CI quality gates, and branch-per-task with a `codex/` prefix. The gaps are **protocol
and shared state**, not tooling.

## Core principle

**The PR is the contract between agents. Shared state lives in the repo, never in an agent's
private memory.** Anything the next contributor needs — decisions, validation evidence,
security-dismissal justifications, follow-ups — must be visible to *any* contributor reading
the repo and the PR.

## Decisions (locked during brainstorming)

- **Mechanism:** Enforce at the seam — CI checks that *fail the PR* when the contract is not
  satisfied, plus a required human review. Not documentation-only.
- **Merge authority:** Agents (Codex) open PRs but **never self-merge.** A human/Claude
  reviews, verifies the contract, and merges. The required review is the judgment backstop;
  CI enforces the objective/mechanical parts.
- **Approach A** chosen over a semantic PR-body linter (B, brittle/redundant) and
  review-only (C, no signal when the template is ignored).

### Operating model (roles)

- **Admin (maintainer):** approves scope, merge, and deploy.
- **Claude (orchestrator):** assigns scoped work, validates gates, owns the final merge
  decision, and is the **only** agent allowed to mark a sprint complete.
- **Contributor agents (Codex / others):** implement scoped tasks only; open PRs; never
  self-merge; never resolve cross-agent conflicts independently.

### Branch ownership (non-overlap rule)

- **One agent per branch.** No agent pushes to another agent's branch. No direct commits to
  `master`.
- **Agent lane naming:** `agent/<agent-name>/<slug>` (e.g. `agent/codex/dashboard-retry`),
  optionally `agent/<agent-name>/<ticket>-<slug>` once an issue/ticket queue exists.
- **Human lanes** keep the conventional prefixes: `feature/`, `fix/`, `docs/`, `refactor/`,
  `chore/`.

### Conflict policy

- If two agents need the same file area, the second agent **pauses and requests reassignment**
  from the orchestrator. Claude re-scopes or rebases; contributor agents do not resolve
  cross-agent conflicts themselves. (Moot while work is serial; stated so the rule exists.)

## Artifacts

### 1. `.github/pull_request_template.md` (new)
Generalizes the PR #44 body into the standing contract that the web UI auto-loads. Sections:

- **Summary** — what changed + why.
- **Validation** — commands run + results as evidence (e.g. `tsc --noEmit ✅`,
  `npm run test:unit` 62/62 ✅).
- **Docs updated** — checklist tied to the CLAUDE.md feedback loops: service `CONTEXT.md`,
  `services/registry.json`, ADR (if architectural), `apps/landing/` docs site.
- **Quality gates** — the four standing gates: tests, `/simplify`, `/code-review`,
  `/security-review`.
- **Security dismissals** — any CodeQL/audit dismissal + **written justification + link**.
  This is where a dismissed alert is recorded for the next agent.
- **Follow-ups / known issues.**
- **Lane** — who authored: `codex` / `claude` / human.

### 2. `.github/workflows/pr-contract.yml` (new)
A light CI job on `pull_request` (`opened`, `edited`, `synchronize`, `reopened`). It **fails
only** when the PR body is empty or the required section headers (`## Validation`,
`## Quality gates`, `## Security dismissals`) are absent — i.e. the template was ignored or
gutted. It does **not** semantically validate content; that judgment stays with the reviewer.

- **Exemptions:** PRs authored by `dependabot[bot]` are skipped (they don't use the template).
- **Required status check:** this job is added to branch protection (Artifact 3) so a PR that
  ignored the template cannot merge.

### 3. Branch protection on `master` (settings, applied via `gh api`)
The token has `admin: true`, so this is applied directly.

- Require a pull request before merging (no direct pushes to `master`).
- Require status checks to pass before merging, strict (up to date with base). Required set:
  `pr-contract`, `Lint & Type Check`, `Test Frontend`,
  `Test Backend Services (Unit + Regression)`, `Code Scanning Gate (ADR-060)`,
  `Security Audit`, `CodeQL`. **Not** `Deploy to Demo` (skipped on PRs).
- Require **1 approving review**.
- **Admin bypass allowed** (`enforce_admins: false`). Rationale: GitHub forbids a PR author
  approving their own PR; Codex cannot approve anything, so agent PRs naturally route through
  the maintainer's review. But the solo maintainer's *own* `feature/*` PRs would be blocked
  with no second human to approve. Admin bypass lets the maintainer merge their own solo PRs
  while the required-review norm still governs the agent/external lanes. **Flip to
  `enforce_admins: true` the day a second human contributor joins.**

### 4. `CONTRIBUTING.md` reconciliation (rewrite)
The current file is stale OSS boilerplate that contradicts the real process. Fixes:

- Make the **branch-based in-repo flow** primary (keep a short fork path for external humans).
- Correct branch prefixes: human lanes `feature/`, `fix/`, `docs/`, `refactor/`, `chore/`;
  agent lane `agent/<agent-name>/<slug>` (replaces the bare `codex/` prefix).
- Remove the dead `CHANGELOG.md` step (no such file exists).
- Replace the generic PR checklist with a pointer to the PR template + the CLAUDE.md
  Pre-Merge Checklist.
- Name `AGENTS.md` as the canonical process entry point and `CLAUDE.md` as the source of
  truth.

### 5. `AGENTS.md` "Lanes & Merge Authority" section (new section)
Codifies the process so agents follow it closely:

- **Roles & lanes:** the operating model above — Admin approves scope/merge/deploy; Claude
  orchestrates, validates gates, owns the merge decision, and is the only agent that marks a
  sprint complete; contributor agents implement scoped tasks on `agent/<name>/<slug>` branches
  → open PRs. External humans fork + PR.
- **Branch ownership:** one agent per branch; no pushing to another agent's branch; no direct
  commits to `master`.
- **No self-merge:** agents never merge their own PRs; a human/Claude reviews and merges;
  nothing merges red.
- **Templates are known (critical):** GitHub only auto-injects `pull_request_template.md` in
  the **web** create-PR UI. When opening a PR via `gh pr create` or the API (how agents work),
  the template is **not** applied automatically. Agents MUST populate the PR body *from*
  `.github/pull_request_template.md`. The `pr-contract` check is the backstop that fails the
  PR if they forget. AGENTS.md also points agents at the issue templates under
  `.github/ISSUE_TEMPLATE/`.
- **Out-of-band actions** (e.g. dismissing a security alert) MUST be recorded in the PR body
  with a written justification + link.
- **Handoff vs PR body:** the **PR body** carries per-task detail (what changed, files, tests,
  risks) via the template; **`CURRENT_HANDOFF.md`** carries rolling cross-session state and
  active branch/ownership. Do not duplicate the full PR contract into the handoff — they drift.
- **Conflict policy:** second agent into a shared file area pauses and requests reassignment;
  Claude re-scopes/rebases.
- **Shared state lives in-repo** (`AGENTS.md` / `CONTEXT.md` / ADR / handoff / PR body), never
  in an agent-private memory store — this closes the "Codex can't see Claude's memory" gap.

### 6. Concurrency escalation playbook (documented, NOT activated now)
Codex proposed two stronger concurrency-control mechanisms. They solve a problem that does
not exist while work is **serial** (one agent at a time), so they are **documented as an
escalation in `AGENTS.md`, not run as default overhead**. Activation trigger: **2+ agents
working the same sprint concurrently.** When that day comes:

- **File-ownership manifest per task:** at sprint start the orchestrator posts a file-ownership
  list in the PR/handoff; contributor agents may edit only listed files; a new file requires a
  lock-update request before editing.
- **PR layering:** contributor PRs target a Claude-maintained integration branch; Claude owns
  the final integration PR to `master`. (Note: this needs its own branch protection or it
  becomes a second unprotected mainline — apply protection to the integration branch too when
  activated.)

Until the trigger fires, the default is direct contributor-PR-to-`master` with required review
(Artifacts 1–5). This keeps standing overhead at zero while the playbook is ready to drop in.

## Non-goals (YAGNI)

- No semantic PR-body parser (Approach B) — brittle and redundant with the required reviewer.
- **No file-ownership manifest or integration-branch PR layering as default** — documented as
  the Artifact 6 escalation, activated only when 2+ agents work concurrently. Running them now
  is standing overhead against collisions that don't occur in serial work.
- No per-issue handoff decomposition yet — the single `CURRENT_HANDOFF.md` is fine while work
  is serial; revisit when agents/humans work concurrently.
- No GitHub Issues work-queue / labels rollout yet — deferred until multiple humans join.
- No change to the existing quality gates, hooks, or `process-reviewer` agent.

## Success criteria

- A PR opened via `gh pr create` without the contract body **fails `pr-contract`** and cannot
  merge.
- A direct push to `master` is rejected; merge requires a PR + green required checks + 1
  approval (admin bypass available to the maintainer only).
- Dependabot PRs are unaffected.
- `CONTRIBUTING.md`, `AGENTS.md`, and the PR template describe **one** consistent process with
  no contradictions (branch prefixes, merge authority, docs feedback loop all agree).
- `AGENTS.md` explicitly instructs agents to populate the PR body from the template when using
  the CLI/API.

## Rollout / validation

1. Land artifacts 1, 2, 4, 5 in one PR (artifact 6 is documentation that ships inside the
   `AGENTS.md` change in artifact 5). This PR will itself use the new template — dogfood.
2. Apply branch protection (artifact 3) via `gh api` after the `pr-contract` check has run at
   least once (so the check name is registerable as a required status).
3. Verify: open a throwaway PR with an empty body → `pr-contract` fails. Restore body → passes.
4. Verify: a direct push to `master` is rejected.
