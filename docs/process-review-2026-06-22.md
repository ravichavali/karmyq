# Process / Context / Memory Review — 2026-06-22

> **Scope:** periodic hygiene pass requested by the maintainer, in two phases:
> 1. **Audit phase (read-only):** while Codex still had Sprint 109 in flight, this was a pure
>    read-only audit — no shared files touched; this doc was the only artifact created.
> 2. **Execution phase:** *after* Sprint 109 merged (#111) and the working tree was clean, the
>    maintainer approved execution. The fixes below were then applied — including edits to
>    `CLAUDE.md`, `AGENTS.md`, and `CURRENT_HANDOFF.md` (on branch `docs/context-process-hygiene`).
>    So the "did NOT touch" notes further down describe the *audit phase only*; see the Execution
>    Status block immediately below for what the execution phase actually changed.
>
> **Areas reviewed:** process/cadence · memory · context docs · tandem-with-Codex.

> **EXECUTION STATUS (2026-06-22, after Sprint 109 #111 merged, tree clean):**
> - ✅ **Memory:** deleted 4 fossil `project_*` memories + 1 superseded (`feedback_trust_graph_ego_network`); fixed `project_current_state` (stripped stale Sprint-52 candidates); updated `project_header_decongestion` (S107 partial); added `feedback_same_machine_shared_working_tree`; reconciled MEMORY.md (no dangling/orphan refs).
> - ✅ **CLAUDE.md:** version line now points to `package.json` (won't re-stale).
> - ✅ **AGENTS.md:** concurrency model rewritten to the real shared-working-tree setup.
> - ✅ **Handoff:** status → MERGED; added "Active Session" stanza + commit-before-handoff rule.
> - ⏭️ **Deferred (low value / churn):** C1 handoff-gotcha thinning (kept — in-repo IS the right cross-agent home; memory is the advisory mirror), C2 moving settled history out of CLAUDE.md, P2 `docs:check` automation.
> - These doc edits are on branch `docs/context-process-hygiene` (not pushed — a master push deploys).

---

## TL;DR — the five things worth doing

1. **CLAUDE.md header is badly stale** — says `Version 10.11.0`, "Services (10 total)", anchored to Sprint 91. Reality: `package.json` is **11.17.0**, handoff is **Sprint 109**. (High — it's the first doc every agent reads.)
2. **`project_current_state.md` memory is half-live, half-fossil** — the Stop hook refreshes git state, but the body still lists "Sprint 52 candidates" and a contradictory ADR count. It actively misleads recall. (High.)
3. **Same gotchas live in 3 places** (CLAUDE.md ↔ handoff "Persistent Context" ↔ memory store) — JWT field, nginx, response unwrap, etc. Triple-maintenance → guaranteed drift. (Medium — pick one home per fact.)
4. **4 stale `project_*` sprint-plan memories** (Sprints 74, 89, karmyq.org, polish backlog) are fossilized point-in-time plans for long-shipped sprints. Delete/archive. (Medium — they pollute recall.)
5. **Concurrency reality outran the docs** — AGENTS.md "Concurrency escalation" is marked *"documented, NOT active"* and the handoff says *"work is serial."* You are now running Claude + Codex concurrently. Decide whether to activate the escalation rules. (Medium — this is the actual trigger for this review.)

---

## Area 1 — Process / Cadence

**Healthy:**
- The sprint cadence (one chat per sprint), handoff-as-state, and the multi-agent PR contract in AGENTS.md are coherent and well-thought-out.
- `CURRENT_HANDOFF.md` is current and high quality — Sprint 109 in progress, scope/out-of-scope, critical notes, multi-sprint arc all present.
- SDLC quality gates (testing, /simplify, /code-review, /security-review + CI deps/CodeQL) are clearly codified.

**Findings:**

| # | Finding | Severity | Recommended action | Run now or after Codex? |
|---|---------|----------|--------------------|--------------------------|
| P1 | CLAUDE.md header (`10.11.0`, "10 services", "Sprint 91" framing) is ~7 minors + 18 sprints stale vs `package.json 11.17.0` / Sprint 109. | High | Update the version line; either drop the hard-coded version or wire it to `package.json`. The "Services (10 total)" table is still accurate (count unchanged) but the Sprint-91 framing note reads as current-events when it's history. | **After** — CLAUDE.md is shared; Codex may also touch docs. |
| P2 | Pre-Merge Checklist "Landing Page Docs" section requires a 3-way doc sync (guides + concepts + ADR JSON + nav.json) every sprint. It's thorough but is the single heaviest recurring tax, and `nav.json silently reverts` is a known footgun. | Low | Keep (you value docs), but consider a `npm run docs:check` that asserts nav-integrity so the manual checklist shrinks. Don't cut scope — automate the verification. | After |
| P3 | No single place states "we are now running 2 agents concurrently" as the *active* mode. The handoff's Persistent Context still says "work is serial." | Medium | See Area 4 / finding T1. | After |

---

## Area 2 — Memory (53 files)

The store is large but mostly high-value `feedback_*` gotchas. The problem is **fossils and duplication**, not volume.

**Findings:**

| # | Finding | Severity | Recommended action |
|---|---------|----------|--------------------|
| M1 | `project_current_state.md`: header says `Generated 2026-06-23` (tomorrow), body lists **"Sprint 52 candidates"** and "ADR count 77 / next 080" while the handoff says next-free ADR after S109 = **081**. The Stop hook only refreshes the git lines; the rest is frozen. | High | Either (a) make the hook rewrite the whole file from `package.json` + registry + latest ADR, or (b) strip the frozen "Sprint candidates" block so the file is *only* auto-refreshed git state. Half-fresh files are worse than none. |
| M2 | 4 fossil sprint-plan memories: `project_polish_backlog` ("now Sprint 74"), `project_sprint89_community_page` (S89, planned 2026-06-06), `project_karmyq_org_relaunch` (~June 2), `project_ui_facelift` (upcoming → likely shipped as S104/S105 per handoff arc). All describe sprints that have shipped. | Medium | Verify each shipped (handoff arc shows S89-era and facelift S104/105 done), then **delete**. Keep only genuinely-open design questions. Memory is for durable non-obvious facts, not shipped sprint plans. |
| M3 | `feedback_trust_graph_ego_network` is already marked **SUPERSEDED** in MEMORY.md. | Low | Delete the file + its index line; superseded memory should be removed, not annotated forever. |
| M4 | Triple-storage of gotchas (see Area 3). Many `feedback_*` files restate facts that also live in CLAUDE.md and the handoff. | Medium | Keep memory as the canonical home for *hard-won gotchas* (it's searchable and survives handoff churn); thin the handoff's duplicate "Architecture/Workflow Gotchas" to pointers. (Per your own [[feedback_cross_agent_review]] principle: shared/in-repo state is authoritative; memory is advisory — so anything Codex must honor belongs in-repo, not only in memory.) |
| M5 | MEMORY.md index "Polish Backlog" + "Open Design Questions" sections point to fossils (M2). | Low | Prune index lines alongside the file deletions. |

**Note on the advisory/authoritative split:** AGENTS.md correctly states memory is *advisory, maintainer-local* and that anything another agent must honor lives in-repo. That's the right model — but it means the `feedback_*` workflow gotchas Codex also needs (JWT field, nginx, response unwrap) must exist in-repo (they do, in CLAUDE.md/handoff). So the memory copies are genuinely redundant *for cross-agent purposes* and exist only for Claude's recall convenience. Fine to keep, but don't treat them as the source of truth.

---

## Area 3 — Context docs

**Findings:**

| # | Finding | Severity | Recommended action | Run now or after Codex? |
|---|---------|----------|--------------------|--------------------------|
| C1 | Same facts in CLAUDE.md + handoff Persistent Context + memory (JWT `communities`, nginx-needs-deploy, `res.data` unwrap, no-worktrees, category/request_type seam, feed query surfaces…). | Medium | Designate one home per fact class: **global invariants → CLAUDE.md**, **rolling/sprint state → handoff**, **searchable gotchas → memory**. Convert the handoff's "Architecture/Workflow Gotchas" to a short pointer list ("see CLAUDE.md Global Patterns + memory"). | After |
| C2 | CLAUDE.md "Sprint 91 (ADR-071)" feed-service note reads as recent; it's now long-settled architecture. | Low | Move settled history into ARCHITECTURE.md; keep CLAUDE.md to live invariants. | After |
| C3 | The geocoding service docs drift (registry says "no dependents" + Redis; reality is frontend consumer + PostgreSQL) is **already in Sprint 109 scope** — Codex/this sprint is fixing it. | — | No action; don't touch — Codex owns it this sprint. | **Leave for Codex** |
| C4 | AGENTS.md ↔ CLAUDE.md relationship is well-documented (one-way bridge, CLAUDE.md wins). No drift found. | — | None. Good as is. | — |

---

## Area 4 — Tandem-with-Codex

This is the actual trigger, and it's where the docs lag reality the most.

> **Operating model (confirmed 2026-06-22):** Claude + Codex run as **two VS Code sessions on
> the same physical folder / same machine**, **time-sliced** (one active at a time, roles
> rotated across plan → code → review). **They therefore share one git working tree** — git only
> allows one checked-out branch per working tree, so both windows are on the *same* branch
> (currently `feature/sprint-109-geocoding-cache-hardening`). **Consequence:** any file either
> agent writes lands in the other's live working tree immediately — there is no branch isolation
> between the two windows. The escalation model's "one branch per agent / no agent pushes to
> another's branch" assumes *separate* checkouts and does **not** hold here. What actually
> protects against clashes is: (a) only one agent editing at a time, and (b) a clear per-task
> file-ownership record. This is a workflow gotcha worth a memory entry during execution.

| # | Finding | Severity | Recommended action |
|---|---------|----------|--------------------|
| T1 | AGENTS.md "Concurrency escalation" assumes **separate checkouts** (one branch per agent, no agent pushes to another's branch). The real setup is **one shared working tree, time-sliced** — so branch isolation doesn't exist and that part of the model doesn't apply. | Medium | **Keep serial as the explicit mode** (it matches reality), but rewrite the AGENTS.md framing: the protection is "one agent edits at a time + per-task file ownership," **not** branch separation. Drop or caveat the "PR layering / integration branch" escalation since both agents commit to the same branch. |
| T2 | No live "who-owns-what right now" record. Because the working tree is shared, the *only* real safeguard is knowing which agent is active and which files are in flight — and that lives nowhere. The clash risk that prompted your whole question has no doc surface. | Medium (highest-leverage) | Add an **"Active Session" stanza** to the handoff: which agent is driving, current phase (plan/code/review), and the uncommitted files in flight. Update it on every role handoff. This session is proof it's needed — I had to ask you rather than read it. |
| T2b | Role rotation (plan/code/review across agents on the same branch) means uncommitted WIP regularly changes hands. Per [[feedback_cross_agent_review]], the danger is editing another agent's *uncommitted* work. | Medium | Convention: **the active agent commits (or stashes) before handing the session to the other.** A clean tree at every role switch removes 90% of the clash surface. Worth a memory entry. |
| T3 | The cross-agent review protocol is solid (author produces, the other reviews; one owner per artifact) and lives both in-repo (AGENTS.md) and in memory. | Low | Good. Keep the in-repo copy authoritative. |
| T4 | This review itself is the model behavior you want: a non-Codex agent producing a *separate* review doc rather than editing Codex's working files. | — | None — confirms the protocol works. |

---

## Suggested execution order (after Codex's branch merges)

1. **Quick wins (5 min):** fix CLAUDE.md version line (P1); delete `feedback_trust_graph_ego_network` (M3).
2. **Memory cleanup:** verify + delete the 4 fossil `project_*` memories and prune MEMORY.md (M2, M5); fix or strip `project_current_state` (M1).
3. **De-duplication:** thin handoff Persistent Context gotchas to pointers (C1); move settled history out of CLAUDE.md (C2).
4. **Concurrency (decided — time-sliced, shared working tree):** rewrite AGENTS.md so the safeguard is "one agent edits at a time + per-task file ownership + clean tree at every role switch," not branch isolation (T1). Add an **"Active Session" stanza** to the handoff and adopt the **commit/stash-before-handoff** convention (T2, T2b). Add a memory entry for the shared-working-tree gotcha.
5. **Optional automation:** `docs:check` nav-integrity assertion to lighten the landing-docs tax (P2).

---

## What the AUDIT phase deliberately did NOT touch

*(point-in-time, while Sprint 109 was still in flight — the execution phase later edited some of these; see the Execution Status block at the top)*

- `services/geocoding-service/*`, `services/registry.json`, frontend geocoding — **Codex's Sprint 109 lane.** (Still untouched — never in scope here.)
- `CURRENT_HANDOFF.md`, `CLAUDE.md`, `AGENTS.md`, the memory store — shared files; left for the post-merge execution pass. **These were edited in the execution phase** after #111 merged.
- At the end of the audit phase, this doc was the only file created.
```
