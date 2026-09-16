# Lanes, Stages and Provenance (contributor-model sub-project 1) — Handoff

**Date**: 2026-09-16
**Outcome**: in progress (spec drafted, awaiting maintainer review)

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
| **Stage / active editor** | `spec`, by ravichavali/claude |
| **Reviewer role** | Maintainer reviews the spec; any non-author agent may review later stages read-only |
| **Owned paths** | the spec below, this file; implementation paths per the future plan |
| **Shared resources needed** | ADR number (maintainer-allocated, the last by hand). Merge only after Sprint 131 PR B has deployed and passed its health check. No dependency lane (no new npm packages). |

## Links

- **Spec**: [Lanes, stages and provenance](../../docs/superpowers/specs/2026-09-16-lanes-stages-provenance-design.md)
- **Plan**: not yet written
- **PR**: none

## Quick Start

1. `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`; confirm Sprint 131 PR B's state first (it merges before this lane).
2. `git switch lane/lanes-provenance`. Never commit this work on a Sprint 131 branch.
3. Read the spec. If the maintainer has approved it, invoke `superpowers:writing-plans` to write the plan.

**Next unchecked task**: maintainer review of the spec; then allocate the ADR number.

## Blockers and decisions

- **Decision (2026-09-16):** the contributor model is split into four sub-projects (stages/provenance → agent-neutral rules → onboarding; memory as a separate track). This is sub-project 1. All design decisions D1–D13 are recorded in the spec.
- **Decision:** kept apart from Sprint 131 PR B (test readiness) to avoid scope creep. PR B continues under the current rules and is grandfathered.
- **Blocker:** the ADR number must come from the maintainer.

## Verification references

- Evidence gathered while designing, 2026-09-16:
  - `gh label list` has no lane labels.
  - The repo is public with issues enabled and collaborators `ravichavali`, `kompellachavali`.
  - Master protection requires 1 approving review plus 6 checks.
  - `ci.yml:408-411` deploy concurrency is `deploy-demo`, `cancel-in-progress: false`.
  - Commits `b47c0fe6`/`e2c03a56`, credited to Codex, carry `Co-Authored-By: Claude Opus 5`.
