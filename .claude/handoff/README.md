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
   **derived from their live arbiters** at the moment they are needed — see
   *Parallel development rules* → **Why reservations do not work here** (below). The router table is a pointer
   to lane files and nothing more.
4. When a lane ships, archive its lane file to `archive/` and delete its row.

The serialization rules these lanes must honor are in *Parallel development rules* (below).

### Single stream is the default

**When only one sprint is in flight, `CURRENT_HANDOFF.md` is the state, not a router.** Do not
create a lane table for a single stream — an unnecessary router adds a level of indirection that
can only go stale. Add the table when a second lane actually starts.

### Checklist before activating a second machine

**Sequencing only — the rules themselves live in `CLAUDE.md` and in *Parallel development rules* below.** Restating them here would create a
second, ungated copy that drifts, which is the failure this framework exists to prevent. Work
through the pointers in order:

- [ ] **Host gotchas applied** — `CLAUDE.md` → *Host environments*. Run `uname -s` on each machine;
      they do not transfer.
- [ ] **Clone bootstrapped** — `CLAUDE.md` → *Development Disciplines* §3, and
      `docs/gotchas/hooks-install-to-git-hooks-on-a-fresh-clone.md`.
- [ ] **Hooks proven live** — same discipline's ⚠️ block: a silent, instant push means no hook ran.
- [ ] **Agent memory synced** — *Parallel development rules* (below); it lives outside the repo and
      a fresh clone has none of it.
- [ ] **File ownership split, shared-package consumers kept together** —
      *Parallel development rules* (split sprints on file-disjoint boundaries).
- [ ] **ADR number and dependency lane allocated by the maintainer** — *Parallel
      development rules* → *Why reservations do not work here*, and *The dependency lane*.
- [ ] **Deploy slot serialized** — *Parallel development rules* (`master` merges row).
- [ ] **Generated-doc churn handled** — `docs/gotchas/landing-docs-are-generated-never-authored.md`.
- [ ] **Each lane's file created** from `TEMPLATE.md`, with its owned paths recorded.

## Parallel development rules

*(Moved from `CLAUDE.md` 2026-11-11; `CLAUDE.md` keeps a one-paragraph summary that points here.)*

Work runs from **two checkouts on different machines** (Windows primary + Mac), each on its own
sprint and its own branch. There is real branch isolation, so the lane model is now the actual
mechanism — but the machines cannot see each other's working trees, so **all coordination goes
through git and PR state, never through tree hygiene.** Neither machine may assume the other is
idle.

**Serialize these four shared surfaces** — they collide even when sprint scope is fully disjoint:

| Surface | Why it collides | Rule |
|---|---|---|
| `master` merges | Every master push is a full deploy with rollback-on-failure; overlapping deploys restart services and 502 the demo | **One merge at a time.** Wait for the deploy AND health verify to finish before the next PR merges. |
| `package.json` version | One line, bumped every sprint; second merge ships a duplicate or skipped version | First PR to merge takes the bump; the second re-bumps at merge time, not at branch time. |
| `package.json` / `package-lock.json` | Lockfile conflicts cannot be resolved by regeneration (scratch-regen is forbidden — it rewrites exact pins) | **One maintainer-designated active holder.** An open Dependabot PR is a queued proposal, NOT the holder (below). |
| ADR numbers | Both lanes mint the same next number → filename AND `docs/adr/README.md` index conflict | **Maintainer-allocated** — never self-assigned from a derived list. Uniqueness is gate-enforced (below). |

**Also expect, and handle locally:**
- `apps/landing/src/data/docs/` is **git-tracked** and regenerated by `npm test` with timestamp /
  HEAD-sha churn. Two machines on two branches produce competing diffs — reverting that churn
  before committing is **mandatory** here, not advisory.
- `docs/BUGS.md` and `docs/IDEAS.md` are append-only from both lanes. Append at the end; resolve
  the trivial conflicts rather than reordering.
- **The demo server is a single shared resource** — both machines SSH as the same user and write
  as `karmyq_prod`. Demo data operations are **exclusive, and the maintainer is the lock**: every
  demo data operation already requires its own explicit per-operation authorization, so ask before
  each one and say which lane is asking. Do NOT rely on a written announcement to reserve the
  server — see *Why reservations do not work here*.
- **Persistent memory does not travel.** `MEMORY.md` and the memory files live outside the repo in
  `~/.claude/projects/<project>/memory/`. A fresh checkout starts with none of it; sync that
  directory between machines rather than duplicating it into the repo.

**Split sprints on file-disjoint boundaries** — by service. Never run one lane in
`packages/shared/` while the other is in a consumer of it; a shared-package change plus an
un-updated importer is exactly the breakage the workspace-dependency rule exists to prevent.

### Why reservations do not work here — derive instead

There is **no shared mutable store between the two checkouts.** Every handoff file, including the
lane router, is a **branch-local file**: a reservation written on lane A's branch is invisible on
lane B's branch until it merges to `master`. A lane is also told to read only its own lane file, so
a reservation recorded there is written where the other lane is forbidden to look. Any protocol of
the form "announce it in the handoff" is therefore **unreliable by construction** — both lanes can
believe they hold the same resource.

**Querying live state establishes what is VISIBLE. Allocating ownership still requires
SERIALIZATION.** These are different problems and need different mechanisms — conflating them was
the original error. Deriving "the next ADR number" from open PRs tells you what exists; it does not
stop the other lane deriving the same answer in the same minute.

**Read-only — derive these, no coordination needed:**

| Resource | Live arbiter |
|---|---|
| Version bump | `origin/master`'s `package.json` **at merge time**, not at branch time |
| `master` merge slot | `gh pr list` + the latest deploy run's status — is a deploy in flight? |

**Contended — these need an owner, and the maintainer is the only serializer available:**

| Resource | Allocation |
|---|---|
| Next ADR number | **Ask the maintainer to allocate it.** Do not self-assign from a derived list; two lanes reading the same list get the same answer. |
| Dependency / lockfile lane | **One designated active holder at a time** (below). |
| Demo data operations | **Ask per operation.** There is no file-based lock. |

There is no shared mutable store between the checkouts, so a human is the only thing that can
serialize. That is not a workaround — with two independent clones and no lock service, it is the
only correct answer.

**Detection and reconciliation, because serialization can still fail.** The drift gate now asserts
ADR numbers are unique (`tests/regression/doc-context-drift-gate.test.ts`, with a negative fixture
proving it fails on two `ADR-097` files — indexing alone does not catch this). If a collision does
reach `master`, **the PR that merges second renumbers**: rename the file, update
`docs/adr/README.md`, and fix every reference to it. The first is already merged and referenced;
the second is the one that must move.

### The dependency lane: queued proposals vs. the active holder

An open Dependabot PR is a **queued proposal, not a lane holder.** Dependabot PRs sit open for
weeks — #218 has been open since 2026-09-03 — so treating any open dependency PR as occupying the
lane would make the lane permanently unavailable, including for the security-exemption renewal that
must land before **2026-09-15**.

- **Exactly one active dependency task at a time**, designated by the maintainer.
- **Queued proposals do not hold it.** Dependabot PRs, and PRs awaiting review, are queued.
- **Ownership transfers explicitly** — the maintainer hands it over; it is never inferred.
- **Before starting any dependency work, ask who holds the lane.** `gh pr list` shows you what is
  queued; it cannot tell you who is *working*, because an agent's work is invisible until they push.

**What earns dependency work (maintainer, 2026-09-30).** Only two things do: a **security advisory**
(the vulnerability SLA applies), or a **feature that needs** a newer version. Dependabot is
security-only (`open-pull-requests-limit: 0`, gated by
`tests/regression/sprint-131-dependabot-security-only.test.ts`). Do not start upgrades for their
own sake, however cheap they look. Weight the process by risk: runtime auth or data paths get a
planned PR; everything else gets a short PR proven by strict `npm ci`, the suite and one review.
Keep maintenance to roughly a fifth of capacity; product work is the default.

**The router is a pointer, not a coordination store.** `CURRENT_HANDOFF.md`'s lane table tells you
which file is yours. Because it is branch-local it can be stale, and it must never be treated as
the authority on who owns a resource — the arbiters above are.

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
