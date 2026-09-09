# Sprint 128 PR A — Framework refinement — Handoff

**Date**: 2026-09-09
**Outcome**: in progress — implementation complete, PR not yet opened

> Single stream. `CURRENT_HANDOFF.md` **is** the state, not a router — there is no second machine.
> This file is branch-local and reserves nothing; contended resources are allocated by the
> maintainer (`CLAUDE.md` → *Parallel Development*).

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/codex/sprint-128-framework` |
| **Base** | `origin/master` at `095fc856` (fetched 2026-09-09) |
| **Active editor** | Claude (this session) — one editor |
| **Reviewer role** | non-author review still owed (`/simplify`, `/code-review`, `/security-review`) |
| **Owned paths** | `.claude/skills/*`, `.claude/agents/process-reviewer.md`, `.claude/handoff/*`, `CONTRIBUTING.md`, `docs/concepts/how-karmyq-learns.md`, `tests/regression/doc-context-drift-gate.test.ts`, plus `docs/BUGS.md` (maintainer-approved deviation) |
| **Shared resources needed** | none — no ADR minted, no dependency change. Version bump is re-derived from `origin/master` **at merge time** |

## Links

- **Spec**: `docs/superpowers/specs/2026-09-07-sprint-128-single-stream-design.md`
- **Plan**: `docs/superpowers/plans/2026-09-07-sprint-128-a-framework.md`
- **PR**: not yet opened

## PR B is DONE — the previous handoff was wrong about this

The prior handoff stated PR #221 was OPEN and "no merge or deployment has occurred". Live state on
2026-09-09 contradicted it, and live evidence wins:

- **PR #221 MERGED** 2026-09-09T17:33:39Z, squash `095fc856` (`gh pr view 221`).
- **CI/CD Pipeline [run 34383657151](https://github.com/ravichavali/karmyq/actions/runs/34383657151) succeeded**, including the
  `Deploy to Demo` job. Observed 2026-09-09.
- `origin/master` is now `095fc856`. Version v11.48.0 shipped with it.

PR A's entry gate (B merged **and** deploy verified) is therefore satisfied. This correction is the
exact failure the corrected `update-handoff` skill now tells the next session to check for first.

## Next action

**Next unchecked task**: Plan Task 6/7 — run the non-author `/simplify`, `/code-review` and
`/security-review` gates on this branch diff, then commit and open PR A with the full
`.github/pull_request_template.md` body. Task 8 (merge) needs **explicit maintainer authorization**.

## What changed on this branch

- **New drift-gate assertion** (`tests/regression/doc-context-drift-gate.test.ts`, 13 → 24 tests):
  a pure `workflowRecipeIssues()` predicate over the **live agent-facing playbook set** — enumerated
  from git via the shared `tracked()` helper, never a directory glob — rejecting direct-to-master
  push recipes including `HEAD:master`, force, quoted and `refs/heads/` variants, with a negative
  fixture per case and a false-positive guard.
- **`docs/GITHUB_ACTIONS_SETUP.md`**: two direct-master recipes replaced with the PR-merge flow.
  One sat under *"Workflow Doesn't Trigger → Fix"*, i.e. it recommended the prohibited action.
- **`deploy` skill rewritten** to the PR flow: branch checks → gates green → PR template →
  independent review → readiness recommendation → **maintainer-authorized merge** → CI/deploy/health.
- **`ship`** delegates to `deploy`; `ship` Phase 1 owns the four gates and `deploy` Step 2 only
  confirms them, so the two no longer name each other as owner.
- **`update-handoff`** is canonical, with the routing decision procedure and a
  reconcile-against-live-state step; **`handoff`** is a thin alias, ending their divergence.
- **`process-reviewer`** no longer pipes `npm test` through `tail`, which discarded the exit status.
- **`TEMPLATE.md`** replaced (it was a *plan* template); **`handoff/README.md`** no longer documents
  that deleted template, and its activation checklist is now pointers into `CLAUDE.md` rather than a
  second ungated copy of those rules.
- **`sprint-planning`**: canonical stack reference, calibrated simplify cadence, test placement
  deferred to `tests/claude.md`, branch from fetched `origin/master`.
- **`CONTRIBUTING.md` / `how-karmyq-learns.md`**: one-editor workflow; the
  gotcha / handoff / agent-memory distinction lives in the concept page, with CONTRIBUTING linking.
- **BUG-039** logged (unrelated to this work).

## Review round — `/simplify` (4 parallel agents), all findings resolved

Four independent agents reviewed the diff for reuse, simplification, efficiency and altitude.
**Three defects this PR itself introduced** were found and fixed:

1. **The gate was a false-green** (altitude). It scanned only `.claude/skills/**`, while
   `docs/GITHUB_ACTIONS_SETUP.md:91,257` carried the identical recipe — and `claude.md:307` routes
   agents to that file. Scope widened to the live playbook set; **proven by injection** that it now
   fails there, then reverted.
2. **`handoff/README.md` still documented the deleted plan-style template**, actively instructing
   the next agent to rebuild the very defect this PR removes. Rewritten.
3. **Circular ownership**: `deploy` deferred the four gates to `ship`, `ship` deferred them back.
   One-way now. A stale `deploy Phase 7` pointer (renumbering left it aimed at the SSH step) fixed
   to Step 9.

Also applied: `findSkillDocs` replaced with the repo's shared `tracked()` helper (a hand-rolled
walker was the fourth in that directory and ignored the "live arbiter, never a directory glob"
contract, and lacked its `node_modules` guard); `find` → `some` with a hoisted `pushesToMaster`
predicate; duplicated policy removed from the activation checklist, CONTRIBUTING and sprint-planning.
Efficiency found nothing (new code is ~0.17% of suite runtime, measured).

**Deliberately not done, and why:**
- **Not acted on — needs your decision.** `master` branch protection has `enforce_admins: false`,
  and the admin identity used here can therefore bypass all six required checks and the review
  requirement with a direct push. The doc-level gate governs what playbooks *tell* an agent to do;
  it does not close that door. Setting `enforce_admins: true` is one API call and would make direct
  pushes actually impossible. **This is a repo-settings change and yours to make, not mine.**
- Fixture tests kept one-per-case rather than table-driven: the file's existing rationale (each
  failure mode gets its own fixture) is worth more than ~20 saved lines.

## Blockers and decisions

- **Decision (maintainer, this session)**: commit BUG-039 inside PR A even though `docs/BUGS.md` is
  outside the plan's file map — it is append-only and would otherwise be lost.
- **Deviation, flagged**: `docs/GITHUB_ACTIONS_SETUP.md` is also outside the plan's file map. It was
  changed because leaving it would have shipped a gate that green-lights the exact defect it exists
  to catch.
- **Blocker**: none. Merge authorization is a gate, not a blocker.
- **Open, not fixed here — BUG-039**: `POST /api/auth/demo-session` returns 503 `DEMO_UNAVAILABLE`
  on deployed karmyq.com, so the guided Maria demo cannot start. Needs server logs; ADR-084 makes
  every failure one opaque 503 by design. Not caused by Sprint 128.
- **Observed, left alone**: `apps/landing/src/data/docs/concepts/how-karmyq-learns.json` is
  gitignored and untracked while sibling concept pages are tracked. The prebuild regenerates it, so
  the site is correct; the inconsistency is pre-existing.

## Verification references

- `npm test -- --concurrency=2` → **exit 0**; 26/26 Turbo tasks, root unit **101/101**, root
  regression **722/722** across 29 suites (2026-09-09, after all review fixes).
- Drift gate direct: `cd tests && npx jest regression/doc-context-drift-gate.test.ts --runInBand`
  → **24/24, exit 0**.
- **Falsifiability proven twice**: the assertion failed on the two original defects
  (`deploy/SKILL.md:30`, `ship/SKILL.md:66`) before the fix; and after widening, a temporary
  injection into `docs/GITHUB_ACTIONS_SETUP.md` failed the gate at the expected file and line.
- `node scripts/gotcha-check.js` → clean, 6 entries. `git diff --check` → clean. Local markdown
  links resolve in all changed docs; code-fence counts balanced.
- Generated `apps/landing/src/data/docs/` churn reverted; `architecture.json` drift is pre-existing.

⚠️ GitHub status above is a dated observation. Re-derive with `gh pr view` and
`git log origin/master` before trusting it.

## Still owed before merge

- `/code-review` and `/security-review` on the branch diff (the `/simplify` gate is done).
- Independent **non-author** review — the `/simplify` round was run by agents on my own diff.
- Push + open PR A, then explicit maintainer merge authorization (plan Task 8).
