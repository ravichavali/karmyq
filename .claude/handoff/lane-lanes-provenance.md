# Lanes, Stages and Provenance (contributor-model sub-project 1) — Handoff

**Date**: 2026-09-16
**Outcome**: in progress (plan approved 2026-09-16; `execute` stage, available)

> Narrative only. This lane predates its own tooling, so stage and holder are recorded here by hand
> until `npm run work` exists. Re-derive branch and PR state with `git log` / `gh pr list` before trusting it.
>
> **This file is the handoff for `lane/lanes-provenance`.** The `CURRENT_HANDOFF.md` on this branch is
> master's Sprint 131 state and does **not** apply here. Deliberately, no router row is added
> (it would conflict with Sprint 131's branch-local copy); this departs from `README.md:45`. The branch
> name follows the spec's proposed `lane/<slug>` convention, not today's `agent/<name>/<slug>`,
> on purpose.

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `lane/lanes-provenance` (upstream unset on purpose; first push needs `--set-upstream`) |
| **Base** | `origin/master` at `d35a3fadd0912ab0ef076eb16c6fd1f23df80acd` (fetched 2026-09-16; v11.56.0) |
| **Stage / active editor** | `execute`, **available**: no executor has claimed it yet. Handed off by ravichavali/claude in the `plan -> execute` boundary commit, 2026-09-16. Until the `work` tool exists, claim it by telling the maintainer, then follow plan Task 0 |
| **Reviewer role** | Maintainer reviews the spec; any non-author agent may review later stages read-only |
| **Owned paths** | the spec below, this file; implementation paths per the future plan |
| **Shared resources needed** | ADR-098 (allocated by the maintainer 2026-09-16, the last by hand). Merge only after Sprint 131 PR B has deployed and passed its health check. No dependency lane (no new npm packages). |

## Links

- **Spec**: [Lanes, stages and provenance](../../docs/superpowers/specs/2026-09-16-lanes-stages-provenance-design.md)
- **Plan (this lane, PR 1 of 3)**: [Provenance gate](../../docs/superpowers/plans/2026-09-16-lanes-provenance.md)
- **PR**: none

## Quick Start

1. `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`; confirm Sprint 131 PR B's state first (it merges before this lane).
2. `git switch lane/lanes-provenance`. Never commit this work on a Sprint 131 branch.
3. Read the spec. If the maintainer has approved it, invoke `superpowers:writing-plans` to write the plan.

**Next unchecked task**: plan Task 0 Step 2 (set `karmyq.agent` / `karmyq.machine`), then Task 1. Execute in a fresh chat with any agent (`superpowers:subagent-driven-development` or `superpowers:executing-plans`). **Order:** Sprint 131 PR B is still unexecuted, and this lane cannot merge until PR B has deployed and passed its health check, so executing PR B first avoids a finished lane waiting on it.

## Blockers and decisions

- **Decision (2026-09-16):** the contributor model is split into four sub-projects (stages/provenance → agent-neutral rules → onboarding; memory as a separate track). This is sub-project 1. All design decisions D1–D13 are recorded in the spec.
- **Decision:** kept apart from Sprint 131 PR B (test readiness) to avoid scope creep. PR B continues under the current rules and is grandfathered.
- **Decision (2026-09-16):** this lane is scheduled as **Sprint 132**. Sprint 131 finishes first (PR B, D1–D7, C if approved), and the execute stage stays available until Sprint 132 starts (maintainer: "We probably can do this as next sprint").
- **Decision (2026-09-16):** plan approved (maintainer: "go for it"); the planner wrote the `plan -> execute` boundary.
- **Decision (2026-09-16):** three lanes, one PR each, replacing the single PR (maintainer: "3 PRs sound good"). The branch can't outlive its squash-merge, so they are `lanes-provenance` (this), `lanes-work-queue` and `lanes-rules`; the later two start at `plan` on fresh branches. The spec's *Rollout* is amended, and `execute -> verify` plus all of `verify` are issue comments, never commits.
- **Decision (2026-09-16):** spec approved, ADR-098 allocated, and labels use GitHub's default colours (maintainer: "yes on all three").

## Verification references

- Evidence gathered while designing, 2026-09-16:
  - `gh label list` has no lane labels.
  - The repo is public with issues enabled and collaborators `ravichavali`, `kompellachavali`.
  - Master protection requires 1 approving review plus 6 checks.
  - `ci.yml:408-411` deploy concurrency is `deploy-demo`, `cancel-in-progress: false`.
  - Commits `b47c0fe6`/`e2c03a56`, credited to Codex, carry `Co-Authored-By: Claude Opus 5`.
