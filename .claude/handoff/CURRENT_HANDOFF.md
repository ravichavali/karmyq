# Sprint 145 — Planning — Handoff

**Date**: 2026-11-23
**Outcome**: Sprint 144 post-merge record prepared; Sprint 145 goal selection pending.

## Ownership and base

| Field | Value |
|---|---|
| Branch | `agent/claude/sprint-145-planning`, created from `origin/master` `71773476` |
| Active editor | Codex (this session); one editor at a time in the shared Windows checkout |
| Owned paths | Sprint 144 ADR/bug status, handoff/archive; Sprint 145 spec/plan after goal confirmation |
| PR | None; `gh pr list --state open` returned no open PRs on 2026-11-23 |
| Release | Current master v11.117.0; Sprint 145 version unallocated |

## Quick Start

1. Read [CLAUDE.md](../../CLAUDE.md), then this handoff.
2. `git fetch origin && git log --oneline origin/master -2`; reconcile `gh pr list` and
   `git status --short`. Reuse `agent/claude/sprint-145-planning`; never branch from local master.
3. Read the [Sprint 144 shipped archive](archive/2026-11-23-sprint-144-staff-write-integrity-SHIPPED-v11.117.0.md).
4. Continue `.claude/skills/sprint-planning/SKILL.md` Step 2: confirm the Sprint 145 goal before writing
   the spec and implementation plan. No Sprint 145 spec or plan exists yet.

**Next action**: select the sprint outcome. Recommendation: BUG-106 + BUG-108 admission integrity,
with BUG-107's consent policy as a separate decision. This is a proposal, not approved scope.

## Verified prior release

[#341](https://github.com/ravichavali/karmyq/pull/341) merged as `71773476` on 2026-11-22;
[CI/CD attempt 2](https://github.com/ravichavali/karmyq/actions/runs/45066293676/attempts/2)
passed 14/14, Deploy to Demo succeeded, the member-count migration committed, 9/9 service health checks
passed. ADR-106 is Implemented and BUG-103/104/105 fixed and deployed in this branch's post-merge record.
See the archive for exact timestamps, security status and evidence limitations (application smoke is
maintainer-reported and was not independently rerun here).

## Open candidates and decisions

- [BUG-106/107/108](../../docs/BUGS.md): invitation acceptance capacity/state, staff direct-add consent,
  duplicate-create false joined response. Goal selection is pending.
- [Expo drift #329](https://github.com/ravichavali/karmyq/issues/329): daily run
  [45246722488](https://github.com/ravichavali/karmyq/actions/runs/45246722488) failed on nine patch
  mismatches. No advisory established; the maintainer must earn and allocate dependency work.
- Deepmerge #178 now returns HTTP 410 (withdrawn), and
  [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) was withdrawn 2026-11-16.
  Keep the 2026-12-01 re-check to reconcile the old obligation; no upgrade authorized.
- Parked `origin/lane/lanes-provenance`: design/PR-1 plan/lane file exist only on that branch.
  Schedule it or land a reconciled spec; do not silently drop or execute the old plan.
  The old spec's ADR-098 is occupied on master, so any future ADR needs a fresh maintainer allocation.
- GitHub auto-delete of merged head branches is OFF (`delete_branch_on_merge=false`); maintainer setting.
- Carry-forward: governance rotation/revocation/delegation/opposition, close/expiry notifications,
  legacy member-handler error envelopes, mobile revival debt, demo platform-admin grant and smoke
  (separate authorization), Sprint 144 review minors. Historical detail stays in the shipped archive.

## Constraints

No demo database reads or writes. Version, merge and deploy each require the maintainer's explicit yes.
No dependency/lockfile work or settings change is allocated by this planning request. One task branch/PR;
post-merge records ride with the next product PR, never a docs-only master push. No worktrees.

## Verification

GitHub and git observations above were re-read 2026-11-23. The documentation drift gate passed
41/41 (`npm exec --workspace=tests -- jest --runTestsByPath regression/doc-context-drift-gate.test.ts
--runInBand --no-cache`). `git diff --check` passed. Landing docs were generated from source; ADR-106's
generated content matches its source and says Implemented. No product code changed. The first commit
contains the Sprint 144 post-merge record; Sprint 145 planning follows separately after goal confirmation.
