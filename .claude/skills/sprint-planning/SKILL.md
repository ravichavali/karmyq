---
name: sprint-planning
description: Use when planning a new sprint for Karmyq — discussing goals, producing a design spec and implementation plan, and updating the handoff so the next conversation can execute immediately.
---

# Sprint Planning

Guide a sprint planning session end-to-end: discussion → spec → plan → handoff ready to execute.

## Output Artifacts

| Artifact | Path |
|----------|------|
| Design spec | `docs/superpowers/specs/YYYY-MM-DD-sprint-NN-{slug}-design.md` |
| Implementation plan | `docs/superpowers/plans/YYYY-MM-DD-sprint-NN-{slug}.md` |
| Updated handoff | `.claude/handoff/CURRENT_HANDOFF.md` |

---

## Step 1: Orient

Before discussing anything, establish context:

```bash
git log --oneline -5           # last sprint number + what was just shipped
cat .claude/handoff/CURRENT_HANDOFF.md   # current state, arc context, known issues
cat docs/IDEAS.md | tail -40   # recently captured ideas that may scope this sprint
```

Determine **sprint number** = last sprint + 1 (from git log or handoff). Never guess — read it.

---

## Step 2: Brainstorm with User

Ask focused questions to scope the sprint. Do NOT write any files yet.

Key questions:
- What is the single most important outcome of this sprint?
- Is this part of a multi-sprint arc? If so, what's the next phase?
- Are there known bugs or carry-forward items that should be included?
- Any constraints (demo date, migration complexity, external dependencies)?
- What does "done" look like for this sprint?

Reflect back a concise sprint goal and confirm before proceeding.

---

## Step 3: Write the Design Spec

File: `docs/superpowers/specs/YYYY-MM-DD-sprint-NN-{slug}-design.md`

Required sections:

```markdown
# Sprint NN: {Title} — Design Spec

**Date**: YYYY-MM-DD
**Status**: Approved
**Version**: vX.X.X → vX.X.X
**Sprint Branch**: `feature/sprint-NN-{slug}`

---

## Overview

[2–3 paragraph description. Lead with the user problem, then the solution approach.]

### Core Principle: [Name]

[One sentence that captures the philosophy behind this sprint's design decisions.]

---

## [Multi-Sprint Arc] (include if applicable)

### Sprint NN–1 — [Previous] (complete)
### Sprint NN — [This sprint]
### Sprint NN+1 — [Next] (upcoming)

---

## New Concepts (include if applicable)

[Define any new domain terms, parameters, or abstractions introduced this sprint.]

---

## Data Model

[SQL DDL or schema changes. Every new table + every modified table.]

---

## API Endpoints

[Table of new/modified endpoints: method, path, description, auth, body, response.]

---

## Frontend Changes

[List of pages/components added or modified, with brief description of each.]

---

## User Guide & Doc Updates

[MANDATORY — every sprint ships doc updates. List every user guide and concept page that needs creating or updating. Be specific: which guide, what section, what changes. If a new feature ships, a guide must ship with it.]

---

## Critical Implementation Notes

[Numbered list of gotchas, constraints, and non-obvious decisions that implementers MUST know.
These appear verbatim in the implementation plan header.]
```

---

## Step 4: Write the Implementation Plan

File: `docs/superpowers/plans/YYYY-MM-DD-sprint-NN-{slug}.md`

**Plan header (required):**

```markdown
# {Title} Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** [One sentence.]

**Architecture:** [Two sentences: what's new + how it fits in.]

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*. Do not restate version numbers here — a pinned example goes stale and then gets copied into specs.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| ... | ... |

### Existing files to modify
| File | Change |
|------|--------|
| ... | ... |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

[Copy from spec. These are the gotchas that prevent bugs.]

---
```

**Task structure — follow this exact pattern for each task:**

```markdown
## Task N: {Short name}

**Files:**
- Create: `path/to/new-file.ts`
- Modify: `path/to/existing-file.ts`

- [ ] **Step description**

[Code block if the step has non-trivial implementation]

- [ ] **Verification step**

```bash
[verification command]
```
```

**Task ordering — always use this sequence:**

| Position | Task content |
|----------|-------------|
| Task 1 | Feature branch + DB migration (if schema changes) or first new file |
| Tasks 2–(N-4) | Core implementation (backend services, routes, frontend, events) |
| Task N-3 | User guides + landing page docs (mandatory every sprint) + ADR (if architectural decision) |
| Task N-2 | CONTEXT.md + registry.json + TDD integration test |
| Task N-1 | **SDLC quality gates** (mandatory every sprint) — see below |
| Task N | Final type check + `/pre-commit-check` (runs `bash scripts/pre-commit-check.sh` once); retain git pre-commit feedback check and pre-push hooks |
| Task N+1 | **Merge + Deploy** — merge to master, push, monitor GitHub Actions, SSH if migration scripts needed. Use the `/deploy` skill. **Omit this task only if the plan is tagged `no-deploy`**. |

**SDLC quality gates — every sprint runs all four (this is the standing process, not optional):**

Generated plans MUST put `/pre-commit-check` only in **Task N (final verification)**, never
after each implementation task. Intermediate plan-execution commits keep focused TDD checks
and normal git hooks; do not invoke the full pre-commit skill or process-reviewer per task.
Run process-reviewer once on the full branch diff before opening the PR. All four gates below
remain mandatory. Later ship/review-response steps reuse full test evidence only for the same
clean HEAD, with the SHA, command, exit status, cache state and limitations recorded in the PR
Validation ledger; otherwise run tests and record fresh evidence.

| Gate | How | When |
|------|-----|------|
| **Testing** | TDD tests written before implementation; `npm test` (unit + regression) green | Throughout + final |
| **Simplify** | `/simplify` on the PR diff; per-task only for substantial tasks | Calibrated to diff size |
| **Code review** | `/code-review` on the branch diff; resolve correctness findings before merge | Task N-1 |
| **Security review** | `/security-review` on the branch diff; resolve real findings, justify dismissals | Task N-1 |

The Task N-1 quality-gate task MUST list `/simplify`, `/code-review`, and `/security-review` as explicit steps with a verification line each. Standing CI security gates (dependency audit per ADR-059, code scanning per ADR-060) run automatically on push — the per-sprint `/security-review` is the human-level complement, not a replacement.

**TDD requirement — embed in the test task:**
- Unit tests are written BEFORE implementation (TDD) — the task that creates the test file must precede the implementation task
- **New sprint tests start in the CHANGED workspace's `tests/tdd/`** (e.g.
  `services/request-service/tests/tdd/`), not in root `tests/`
- **Read [`tests/claude.md`](../../../tests/claude.md) before placing any test.** It states the
  tier contract and the promotion mechanism next to the script that implements them — including
  why a rule "enforced" by a root `tests/tdd/` test is not enforced at all

**Minimum tasks:** 8. **Typical range:** 10–14. Do not artificially inflate or compress.

---

## Step 5: Update the Handoff

Rewrite `.claude/handoff/CURRENT_HANDOFF.md` so the next conversation can execute immediately.

The handoff **Quick Start** section MUST include:

```markdown
## Quick Start

1. Read this handoff
2. Reuse the existing task branch if one exists; otherwise `git fetch origin` then
   `git switch -c feature/sprint-NN-{slug} origin/master`. Never branch off a stale local master —
   unpushed local-master commits leak in via the squash-merge.
3. Open plan: `docs/superpowers/plans/YYYY-MM-DD-sprint-NN-{slug}.md`
4. Invoke `superpowers:subagent-driven-development` directly (or `superpowers:executing-plans`).
   There is no `/execute-plan` slash command — superpowers removed it as a deprecated stub.
5. Checkpoint: after every group of at most 3 tasks, and before starting any long-running suite or
   subagent review, commit and update this handoff's task status (task, state, SHA, evidence) and
   say what you are waiting on. A mid-sprint pickup reads this handoff, never `git log`.
```

The handoff MUST include:
- Sprint goal (one sentence)
- Multi-sprint arc context (if applicable)
- Link to spec and plan files
- Critical implementation notes from the spec (copied verbatim)
- Any carry-forward issues or known bugs relevant to this sprint
- Persistent context section (copy from previous handoff unchanged)

---

## Step 5b: Pre-review self-audit

Before the spec, plan or handoff goes to the other agent for review, audit it for the defect
classes that first drafts here keep shipping. The cross-agent review should confirm, not discover.

1. **Citations:** re-open every `file:line` and confirm the line still says what the doc claims.
   Line numbers drift by one or two between drafting and committing.
2. **Behavior-changing config:** `.npmrc` sets `ignore-scripts=true`, so no `pre*`/`post*`
   lifecycle script runs, locally or in CI. Confirm that the tier each new test lands in actually
   runs in CI. CI's integration step runs only root `tests/integration/*.integration.test.ts`
   (`tests/jest.integration.config.js` `roots` + `testMatch`); a service's `tests/integration/`
   never runs there.
3. **Ordering and invariants:** for each migration, dependency or lockfile-splice step, list its
   preconditions. Check that no two requirements contradict each other and that every task's
   inputs exist when it runs.
4. **Gates fail closed:** every new gate or test names the red case it fails on, and every
   negative assertion is paired with a positive match on a known-bad input.
5. **Claim scope:** "every writer" or "all callers" is enumerated with a live search, never a
   sample. Policy choices are marked pending until the maintainer decides them; scope approval
   does not approve them.

For a plan with schema, migration, dependency or security-gate tasks, run this checklist through
**one** fresh-context reviewer subagent on the session model (ADR-104: judgment is not delegated
to a cheaper model). Verify each of its findings with `review-response` before applying it. This
pass does not replace the cross-agent review. Record "self-audit at `<sha>`: N findings fixed" in
the handoff.

---

## Step 6: Commit

```bash
git add docs/superpowers/specs/ docs/superpowers/plans/ .claude/handoff/CURRENT_HANDOFF.md
git commit -m "docs: Sprint NN spec + plan — ready to execute"
```

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Starting to write the plan before user confirms goal | Always get explicit confirmation after Step 2 |
| Forgetting `⚠️ Critical Implementation Notes` section in plan | These prevent the most common bugs — copy from spec verbatim |
| Task N-1 missing TDD test | Every plan ends with a docs/registry task then a verification task |
| Handoff Quick Start doesn't name the execution skill | Next conversation won't know how to start — name `superpowers:subagent-driven-development`, never the removed `/execute-plan` |
| Sprint number guessed instead of read from git | Always `git log --oneline -5` first |
| Sending a draft to review without the Step 5b self-audit | Cross-agent rounds then spend themselves on mechanical defects (stale citations, contradictory migration steps); run 5b first |
| Setting `evolution_enabled` defaults to `false` (opt-in) when it should be `true` (opt-out) | See `docs/IDEAS.md` [2026-03-20] — evolution defaults are opt-out |
| Treating docs as optional ("no ADR this sprint") | User guides MUST be updated every sprint — even without an ADR, update affected guides and concept pages in `apps/landing/` |
