# Handoff Framework

This directory contains **handoff documents** for continuing work across Claude Code conversations.

## Purpose

When a conversation ends mid-feature, create a handoff document here so the next conversation can pick up seamlessly. This prevents context loss and eliminates the need to re-explain background.

## Files

- **`CURRENT_HANDOFF.md`** - The active handoff document (gets replaced with each new handoff).
  When parallel lanes are active it becomes a **router** — see below.
- **`lane-<slug>.md`** - One per active parallel lane (e.g. `lane-sprint-127-provider-search.md`)
- **`TEMPLATE.md`** - Template for creating new handoff documents
- **`archive/`** - Previous handoff documents (optional, for reference)

## Parallel lanes (two checkouts on two machines)

A single rolling handoff cannot serve two machines — it is the one file that carries all
cross-session state, and concurrent edits to it from two checkouts corrupt exactly that.

**The rule:** when more than one sprint is in flight, `CURRENT_HANDOFF.md` holds only the
**Active lanes** table (branch → lane file). That table **reserves nothing** — an ADR number is
maintainer-allocated and is never blocked out here. Each lane gets its own
`lane-<slug>.md`, created from `TEMPLATE.md`, owned by exactly one machine.

1. A session reads `CURRENT_HANDOFF.md`, matches its current branch to a row, and follows the
   pointer. If no row matches, it is not in a lane — the sprint state in that file applies.
2. A session reads and writes **only its own lane file**. Never edit another lane's handoff;
   that is the cross-machine equivalent of building on another agent's uncommitted WIP.
3. **Cross-lane facts do NOT live here.** Every file in this directory is branch-local, so a fact
   written on one lane's branch is invisible to the other until it merges. Contended resources
   (ADR numbers, the version bump, the dependency lane, the merge slot, demo data ops) are
   **derived from their live arbiters** at the moment they are needed — see `CLAUDE.md` →
   *Parallel Development* → **Why reservations do not work here**. The router table is a pointer
   to lane files and nothing more.
4. When a lane ships, archive its lane file to `archive/` and delete its row.

The serialization rules these lanes must honor are in `CLAUDE.md` → **Parallel Development**.

### Single stream is the default

**When only one sprint is in flight, `CURRENT_HANDOFF.md` is the state, not a router.** Do not
create a lane table for a single stream — an unnecessary router adds a level of indirection that
can only go stale. Add the table when a second lane actually starts.

### Checklist before activating a second machine

**Sequencing only — the rules themselves live in `CLAUDE.md`.** Restating them here would create a
second, ungated copy that drifts, which is the failure this framework exists to prevent. Work
through the pointers in order:

- [ ] **Host gotchas applied** — `CLAUDE.md` → *Host environments*. Run `uname -s` on each machine;
      they do not transfer.
- [ ] **Clone bootstrapped** — `CLAUDE.md` → *Development Disciplines* §3, and
      `docs/gotchas/hooks-install-to-git-hooks-on-a-fresh-clone.md`.
- [ ] **Hooks proven live** — same discipline's ⚠️ block: a silent, instant push means no hook ran.
- [ ] **Agent memory synced** — `CLAUDE.md` → *Parallel Development*; it lives outside the repo and
      a fresh clone has none of it.
- [ ] **File ownership split, shared-package consumers kept together** — `CLAUDE.md` →
      *Parallel Development* (split sprints on file-disjoint boundaries).
- [ ] **ADR number and dependency lane allocated by the maintainer** — `CLAUDE.md` →
      *Why reservations do not work here*, and *The dependency lane*.
- [ ] **Deploy slot serialized** — `CLAUDE.md` → *Parallel Development* (`master` merges row).
- [ ] **Generated-doc churn handled** — `docs/gotchas/landing-docs-are-generated-never-authored.md`.
- [ ] **Each lane's file created** from `TEMPLATE.md`, with its owned paths recorded.

## How It Works

### 1. **Starting a New Conversation**

When you start a new Claude Code conversation, Claude will automatically check for `CURRENT_HANDOFF.md` and load the context. You can also explicitly say:

```
Continue from the handoff document
```

Or:

```
Read .claude/handoff/CURRENT_HANDOFF.md and let's continue
```

### 2. **Creating a Handoff**

When ending a conversation mid-feature, ask Claude to create a handoff:

```
Create a handoff document for the next conversation
```

This is the **`update-handoff`** skill's procedure — invoke it rather than reproducing the steps.
In outline, Claude will:

1. Determine which file it owns — single stream, or the lane the router points at
2. Reconcile against live git/PR state **before** writing anything
3. Record what was completed, and the decisions behind it
4. Name the next unchecked task and any blockers
5. Cite verification evidence
6. Write **the file chosen in step 1** — the lane file in router mode, *never* the router —
   committed on the task branch

### 3. **Handoff Document Structure**

The handoff carries **state**, not a copy of the plan. Link the plan and name the next unchecked
task rather than duplicating it. `TEMPLATE.md` is the full structure; its sections are:

- ✅ **Ownership and base**: branch, base SHA, active editor, reviewer, owned paths, shared resources
- ✅ **Links**: spec, plan, PR
- ✅ **Next action**: the next unchecked task, concrete enough to start from cold
- ✅ **Blockers and decisions**: what is stopping progress; what was decided, and why
- ✅ **Verification references**: commands and their results, run links, dated observations

## Best Practices

### Do ✅

- **Update the handoff** when priorities change
- **Be specific** with file paths and line numbers
- **Reconcile against live state** (`gh pr view`, `git log origin/master`) before writing
- **Link the plan** rather than restating it
- **Record decisions with their reasons**, so the next session does not re-debate them

### Don't ❌

- **Don't leave vague instructions** like "implement the feature"
- **Don't skip context** about why the feature matters
- **Don't forget to list dependencies** or environment setup
- **Don't omit testing strategy**

## Example Workflow

### Conversation 1: Planning
```
User: "Let's add server-driven UI for dynamic forms"
Claude: [Plans the feature]
User: "Create a handoff document, I'll work on this tomorrow"
Claude: [Writes detailed handoff to CURRENT_HANDOFF.md]
```

### Conversation 2: Implementation
```
User: "Continue from handoff"
Claude: [Reads CURRENT_HANDOFF.md]
Claude: "I see we're implementing Server-Driven UI. The handoff says to
        start with the backend schema service. Should I begin with
        services/request-service/src/services/SchemaService.ts?"
User: "Yes, let's start"
Claude: [Implements based on handoff plan]
```

### Conversation 3: Completion
```
User: "Continue from handoff"
Claude: [Reads updated handoff]
Claude: "We're on Phase 3 (Mobile Integration). Let me continue with
        the field component library for React Native."
[Work continues until feature is complete]
```

## Archiving Handoffs (Optional)

When a feature is complete, you can archive the handoff:

```bash
mv .claude/handoff/CURRENT_HANDOFF.md .claude/handoff/archive/2026-02-15-server-driven-ui.md
```

This keeps the handoff history for reference.

## Integration with CLAUDE.md

The root `CLAUDE.md` file contains instructions for Claude to check this directory on every new conversation. See the "Starting a New Conversation" section in CLAUDE.md.

---

**This framework enables seamless collaboration across conversations, treating each session as a team handoff rather than starting from scratch.**
