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

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

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
| Tasks 2–(N-3) | Core implementation (backend services, routes, frontend, events) |
| Task N-2 | ADR + landing page docs (if architectural decision) |
| Task N-1 | CONTEXT.md + registry.json + TDD integration test |
| Task N | Final type check + pre-push verification (`npm test`, `npm run feedback:check`) |

**TDD requirement — embed in the test task:**
- Unit tests are written BEFORE implementation (TDD) — the task that creates the test file must precede the implementation task
- Integration/TDD test file goes in `tests/tdd/`
- Unit test files go in `tests/unit/{service}/`

**Minimum tasks:** 8. **Typical range:** 10–14. Do not artificially inflate or compress.

---

## Step 5: Update the Handoff

Rewrite `.claude/handoff/CURRENT_HANDOFF.md` so the next conversation can execute immediately.

The handoff **Quick Start** section MUST include:

```markdown
## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-NN-{slug}`
3. Open plan: `docs/superpowers/plans/YYYY-MM-DD-sprint-NN-{slug}.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)
```

The handoff MUST include:
- Sprint goal (one sentence)
- Multi-sprint arc context (if applicable)
- Link to spec and plan files
- Critical implementation notes from the spec (copied verbatim)
- Any carry-forward issues or known bugs relevant to this sprint
- Persistent context section (copy from previous handoff unchanged)

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
| Handoff Quick Start doesn't mention `/execute-plan` | Next conversation won't know how to start |
| Sprint number guessed instead of read from git | Always `git log --oneline -5` first |
| Setting `evolution_enabled` defaults to `false` (opt-in) when it should be `true` (opt-out) | See `docs/IDEAS.md` [2026-03-20] — evolution defaults are opt-out |
