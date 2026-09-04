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
**Active lanes** table (branch → lane file → reserved ADR block). Each lane gets its own
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

Claude will:
1. Document what was just completed
2. Explain why the feature matters
3. List what's already implemented
4. Provide a detailed implementation plan
5. Include file paths, code patterns to reuse
6. Define success criteria
7. Write everything to `CURRENT_HANDOFF.md`

### 3. **Handoff Document Structure**

Each handoff should include:

- ✅ **Context**: What was completed, why we're doing this feature
- ✅ **Current State**: What's implemented, what's missing
- ✅ **Implementation Plan**: Week-by-week breakdown with file paths
- ✅ **Critical Files**: All files that need to be touched
- ✅ **Existing Patterns**: What code can be reused
- ✅ **Testing Strategy**: How to verify the work
- ✅ **Quick Start**: Exact commands to begin
- ✅ **Success Definition**: How to know when it's done

See `TEMPLATE.md` for the full structure.

## Best Practices

### Do ✅

- **Update the handoff** when priorities change
- **Be specific** with file paths and line numbers
- **Include code examples** for complex patterns
- **Reference existing code** that can be reused
- **Define clear success criteria**
- **Provide quick start commands**

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
