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
  a pure `workflowRecipeIssues()` predicate plus a real-files assertion over
  `.claude/skills/**/SKILL.md`, rejecting `git push origin master`, `HEAD:master`, force,
  quoted and `refs/heads/` variants, with a negative fixture per case and a false-positive guard.
- **`deploy` skill rewritten** to the PR flow: branch checks → four gates → PR template →
  independent review → readiness recommendation → **maintainer-authorized merge** → CI/deploy/health.
  The direct-master recipe is gone; the prohibition is prose, not a runnable example.
- **`ship`** delegates to `deploy` instead of restating the obsolete master push.
- **`update-handoff`** is now canonical and carries the routing decision procedure and a
  reconcile-against-live-state step; **`handoff`** is a thin alias, ending their divergence.
- **`process-reviewer`** no longer pipes `npm test` through `tail` (which discarded the exit status).
- **`TEMPLATE.md`** replaced: it was a *plan* template that duplicated the plan into the handoff.
- **`handoff/README.md`**: dropped the superseded "reserved ADR block"; added the second-machine
  activation checklist and "single stream is the default".
- **`sprint-planning`**: canonical stack reference (was "Next.js 14"), calibrated simplify cadence,
  corrected test placement, and branch-from-fetched-`origin/master`.
- **`CONTRIBUTING.md` / `how-karmyq-learns.md`**: one-editor workflow and the
  gotcha / handoff / agent-memory portability distinction.
- **BUG-039** logged (unrelated to this work; see below).

## Blockers and decisions

- **Decision (maintainer, this session)**: commit BUG-039 inside PR A even though `docs/BUGS.md` is
  outside the plan's file map — it is append-only and would otherwise be lost.
- **Blocker**: none. Merge authorization is a gate, not a blocker.
- **Open, not fixed here — BUG-039**: `POST /api/auth/demo-session` returns 503 `DEMO_UNAVAILABLE`
  on deployed karmyq.com, so the guided Maria demo cannot start. Needs server logs; ADR-084 makes
  every failure one opaque 503 by design. Not caused by Sprint 128.
- **Observed, worth a look later**: `apps/landing/src/data/docs/concepts/how-karmyq-learns.json` is
  gitignored and untracked while sibling concept pages are tracked. The landing prebuild regenerates
  it, so the site is correct; the inconsistency is pre-existing and was left alone.

## Verification references

- `npm test -- --concurrency=2` → **exit 0**; 26/26 Turbo tasks, root unit **101/101**, root
  regression **720/720** across 29 suites (2026-09-09). Two further gate fixtures were added after
  that run — **the full suite must be re-run before the PR is opened**.
- Drift gate direct: `cd tests && npx jest regression/doc-context-drift-gate.test.ts --runInBand`
  → **24/24, exit 0** (2026-09-09).
- **Falsifiability proven both ways**: the new assertion failed on the real defects
  (`deploy/SKILL.md:30`, `ship/SKILL.md:66`) before the fix and passes after.
- `node scripts/gotcha-check.js` → clean, 6 entries. `git diff --check` → clean. Local markdown
  links in changed docs resolve.
- Generated `apps/landing/src/data/docs/` churn was reverted; `architecture.json` drift is
  pre-existing and not owned by this PR.

⚠️ GitHub status above is a dated observation. Re-derive with `gh pr view` and
`git log origin/master` before trusting it.
