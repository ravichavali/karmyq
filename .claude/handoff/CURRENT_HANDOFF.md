# Sprint 141 — planning (scope not yet chosen) — Handoff

**Date**: 2026-11-12
**Outcome**: in progress. The branch exists and carries the PR #336 post-merge records. Sprint scope is not chosen yet

> State between sessions only. This branch is the carrier for the next product PR. Its first commit holds post-merge
> records only, so it must never reach master alone (see *Blockers and decisions*).

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-141-planning` |
| **Base** | `origin/master` at `06685ea4` (PR #336 merge; fetched 2026-11-12) |
| **Active editor** | Claude |
| **Reviewer role** | A non-author (Codex, by recent practice), for the eventual PR. Reviewers read the diff and do not co-edit |
| **Owned paths** | So far: `.claude/handoff/**`, `docs/adr/{ADR-104-agent-process-economy.md,README.md}`, and the generated ADR-104 landing data (`apps/landing/src/data/docs/concepts.json`, `concepts/adr-104-agent-process-economy.json`). Sprint planning adds the sprint's spec, plan and code paths here |
| **Shared resources needed** | None allocated yet. An ADR number, the version bump, the dependency lane, any demo data operation and the merge slot each need the maintainer's authorization when the plan calls for them (`.claude/handoff/README.md` → *Parallel development rules*) |

## Links

- **Spec / plan**: not written yet. The `sprint-planning` skill produces them on this branch
- **PR**: none yet
- **Previous handoff (PR #336)**: [archive](archive/2026-11-12-pr-336-usage-diet-COMPLETE.md), including the
  verified post-merge note

## Quick Start

1. Read `CLAUDE.md` and this handoff, then reconcile live state: `git fetch origin`, `gh pr list`,
   `git log --oneline origin/master -3`, `git log --oneline origin/master..agent/claude/sprint-141-planning`.
2. Stay on `agent/claude/sprint-141-planning`. Never push to master directly and never force-push this branch.

**Next unchecked task**: plan Sprint 141 with the maintainer by invoking the `sprint-planning` skill.
- The maintainer chose on 2026-11-12 that this branch carries a **product** sprint. The last three PRs (#334, #335,
  #336) were maintenance or process work.
- Scope is open. Draw candidates from the maintainer, `docs/IDEAS.md` and `docs/BUGS.md`. This handoff does not
  pre-select one.
- The planning chat writes the spec, the plan and this handoff on this branch. The next chat executes.

## Blockers and decisions

- **Blocker**: no sprint scope yet. The maintainer decides it in the planning chat.
- **Decision (maintainer, 2026-11-12)**: the #336 post-merge records (ADR-104 → Implemented, handoff archive) ride
  on `agent/claude/sprint-141-planning`, a product-sprint planning branch, not on a separate PR.
  - **Don't open or merge a PR with only these commits.** Every master push is a full deploy, and a docs-only
    one is forbidden.
  - If the next PR moves to another branch instead, carry these commits over (cherry-pick) and diff this branch
    against master before deleting it. An abandoned branch strands its records.
- **Decision (2026-11-12)**: ADR-103 was **not** moved to Implemented with ADR-104. Its §Consequences
  (`docs/adr/ADR-103-authenticated-listings-and-simulation-containment.md:85-87`) needs a deploy-time check on the
  demo first (see follow-ups).

## Carried follow-ups (out of scope until a plan picks them up)

- **ADR-103 is still Proposed** (`docs/adr/README.md:33`), though Sprint 140 PR A (#334, `24bed69b`) merged and its
  master CI/CD run 43103530588 succeeded on 2026-11-11, per its archive.
  - The ADR requires a check at deploy time that the demo is not producing simulated nominations or ratifications,
    and that the deployed artifact carries zero weights.
  - That is a demo-host read. Agent demo-host reads have been refused by the permission classifier, so the
    maintainer runs it.
  - Then flip ADR-103 to Implemented on a product branch.
- **The landing docs test dirties the tree on a Turbo cache miss.**
  - `apps/landing/tests/regression/docs-generation.test.ts:21-22` runs `npm run generate-docs` into the tracked
    `apps/landing/src/data/docs/`.
  - It rewrites `architecture.json` and `build.json` (timestamps, commit sha, ADR count), and on Windows
    `concepts/adr-010-*.json` (escaped `\r\n`).
  - `scripts/pre-commit-check.sh` fails on that churn, as designed. A manual `npm run generate-docs` on 2026-11-12
    produced exactly the same three churn files, confirmed churn-only and restored.
  - Fix forward: generate into a temp directory, which needs an output-dir option in `scripts/generate-docs.ts`.
    Don't weaken the dirty-tree check.
- **No relocation pointer gate.** No test checks that each root `claude.md` pointer of the form
  `[file](file) → *Heading*` names a heading that exists. All four were checked by hand on 2026-11-11.
- **The prebuild claim is UNVERIFIED.** Three places say the landing **prebuild** regenerates the docs:
  - `apps/claude.md:46`, `:49` and `:53`;
  - `scripts/claude.md:54`;
  - the `landing-docs-are-generated-never-authored` gotcha.

  Memory records that the prebuild never runs under `ignore-scripts` (shown with a scratch package on 2026-11-09).
- **The migration-validator schema list is stale** (verified 2026-11-11 against `infrastructure/claude.md`).
  - `.claude/agents/migration-validator.md:12-20` names `community`, but the schema is `communities`.
  - It says `feed` is owned by feed-service, which doesn't exist (ADR-071).
  - It omits `governance`, `feedback`, `provider`, `events`, `inventory` and the reserved `federation`.
  - The FAIL example at `:22` and the recommendation at `:24` both repeat `community.communities`.
- **BUG-101** (dead Edit/Write hook handlers) is open at `docs/BUGS.md:2743`.
- #335 item 6, the remaining half: session/service deduplication of the context reminder.
- **Sprint 140 PR B** is unplanned and decision-gated. It needs a design for required-CI integration execution and a
  per-suite ledger of what to repair, rewrite or retire. Retiring a suite needs separate approval and replacement
  coverage.
- **Expo SDK drift.** Issue #329 is open. The scheduled drift run fails and comments on it: run 43253443885 on
  2026-11-12, 7 comments by then. The deepmerge alert #178 is re-checked at the next Expo SDK move or by
  **2026-12-01**.

## Verification references

- PR #336 merge `06685ea4`: master CI/CD run [43262546443](https://github.com/ravichavali/karmyq/actions/runs/43262546443)
  concluded success, 14/14 jobs including Deploy to Demo. Observed with `gh run view` on 2026-11-12.
  - Same-SHA Tests (43262546725) and CodeQL (43262545346) runs succeeded.
  - `https://karmyq.com/` returned 200, and `POST /api/auth/login` returned an ADR-074 `VALIDATION_ERROR` 400.
  - Details are in the [archive note](archive/2026-11-12-pr-336-usage-diet-COMPLETE.md).
- Security state observed 2026-11-12: 0 open code-scanning alerts on master and 0 open Dependabot alerts.
- `package.json` is 11.113.0 on master and on this branch. The post-merge commit bumps nothing.

⚠️ GitHub status goes stale. Re-derive PR and deploy state before trusting anything above.
