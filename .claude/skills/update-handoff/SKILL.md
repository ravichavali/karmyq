---
name: update-handoff
description: Update the CURRENT_HANDOFF.md document to reflect the current session's completed work, remaining tasks, and next steps. Use this at the end of every session, or when the user asks to update the handoff.
---

Update the handoff for the next session. This is the canonical procedure; the `handoff` skill is an
alias for it.

## Step 1: Decide which file you own — do not assume

The handoff is not always a single file, and it is **never** authority over who owns a contended
resource. Follow this procedure:

```text
Read the current branch and .claude/handoff/CURRENT_HANDOFF.md.

Single stream (no "Active lanes" table):
    CURRENT_HANDOFF.md IS the active state — read and update it.

Router mode + a row matching your branch:
    Read and update ONLY the lane file that row names. Never edit another lane's file.

Router mode + no row matching your branch:
    Reconcile the assignment with the maintainer. Do NOT adopt another lane's file.

Any contended resource (ADR number, version bump, dependency lane, merge slot, demo data op):
    Consult the canonical allocation rules in CLAUDE.md → Parallel Development.
    Never infer ownership from a handoff file or a PR list.
```

Every file in `.claude/handoff/` is **branch-local**, so anything written there is invisible to
another branch until it merges. A handoff records state; it cannot reserve anything.

## Step 2: Reconcile against live state before writing

**A handoff that contradicts reality is a blocking defect, not a stale nicety.** Verify before you
write, and let live evidence win:

```bash
git fetch origin
git branch --show-current
git log --oneline -10
git log --oneline origin/master -3
gh pr list
gh pr view <N> --json state,mergedAt,mergeCommit
```

The classic failure is a handoff saying "PR N awaiting merge" when PR N is already merged and
deployed. Check the PR state and the deploy run before describing either.

## Step 3: Update the document

- Record what was completed — specific commits, files, decisions, and **why**, so the next session
  does not re-debate them.
- State what is next as a concrete first action, with file paths and line numbers.
- List real blockers and open questions.
- Update the date.
- Mark a sprint complete only when its PR is merged **and** its deploy is verified.

Cite GitHub status as a link or a dated observation — it goes stale. Never record a handoff's own
final commit SHA inside itself; it cannot know it.

## Step 4: Verify it is actionable

The next session must be able to read only this file and know exactly what to do — branch, plan,
next unchecked task, and blockers — with no machine-local memory.

## Step 5: Commit on the task branch

Commit with the handoff change on the current task branch. **Never push a docs-only change to
master** — every master push is a full deploy.

## Template reference

`.claude/handoff/TEMPLATE.md` for the full structure; `.claude/handoff/README.md` for the router
and lane conventions.
