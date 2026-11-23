# Sprint 145 — Planning — Handoff

**Date**: 2026-11-23
**Outcome**: Sprint 145 scope confirmed by the maintainer: BUG-106 + BUG-108 admission integrity;
BUG-107 staff direct-add consent policy deferred. Design draft written and builder-checked; maintainer design
approval is next. No implementation authorized here.

## Ownership and base

| Field | Value |
|---|---|
| Branch | `agent/claude/sprint-145-planning`, created from `origin/master` `71773476` |
| Active editor | Codex (this session); one editor at a time in the shared Windows checkout |
| Owned paths | Sprint 144 post-merge record (committed); Sprint 145 spec/plan and this handoff |
| PR | None; `gh pr list --state open` returned no open PRs on 2026-11-23 |
| Release | Current master v11.117.0; Sprint 145 version unallocated |

## Quick Start

1. Read [CLAUDE.md](../../CLAUDE.md), then this handoff.
2. `git fetch origin && git log --oneline origin/master -2`; reconcile `gh pr list` and
   `git status --short`. Reuse `agent/claude/sprint-145-planning`; never branch from local master.
3. Read the [Sprint 144 shipped archive](archive/2026-11-23-sprint-144-staff-write-integrity-SHIPPED-v11.117.0.md).
4. Review the [Sprint 145 design draft](../../docs/superpowers/specs/2026-11-23-sprint-145-admission-integrity-design.md).
   Scope is confirmed (2026-11-23); detailed design approval is pending. After approval, invoke
   `superpowers:writing-plans` and finish `.claude/skills/sprint-planning/SKILL.md`.
   No Sprint 145 implementation plan exists yet. Do not start product implementation in this planning chat.

**Goal (confirmed 2026-11-23)**: invitation acceptance must enforce capacity and membership state
atomically (BUG-106); duplicate-create joins must follow membership lifecycle rules and report truthful
results (BUG-108). BUG-107's staff direct-add consent policy stays deferred.

**Next action**: obtain approval of the linked design draft, then write the implementation plan tagged
`no-deploy`. Execution belongs in the next chat after planning is ready; reuse this branch.

## Proposed design (awaiting approval)

- Service-local transactions; no new schema, shared-package export, dependency or ADR number.
- Invitation consumption, membership, user attribution and inviter-statistics trigger commit together;
  capacity/state refusals leave all unchanged. Inviter must still have live active membership.
- New/left invitees become active ordinary members (including private invitations, preserving current
  behavior); existing active members retain role/count; pending/blocked/unknown states refuse.
- Duplicate-create uses the existing membership classifier inside its transaction. Active retries stay
  idempotent; left rows rejoin as member; pending/blocked refuse. Private pointer response stays unchanged.
- Capacity follows the active write on the transaction client, using the ADR-106 counter. No community
  pre-lock ahead of membership locks. Races/rollback need real DB proof through isolated CI; remote test
  infrastructure is not authorized by this session.
- These are author proposals, not decisions implied by the maintainer's scope confirmation. The spec's
  Critical implementation notes are not copied here until the design is approved.

**Adjacent finding, deferred:** `apps/frontend/src/pages/invite/[code].tsx:51` reads validation as
`response.data.data`, while `apps/frontend/src/lib/api.ts:81` unwraps the envelope. The existing
`apps/frontend/tests/regression/sprint-118-invited-arrival.test.tsx` mocks the nested shape. Source-backed
observation only; no live UI reproduction or fix here. The spec explicitly limits any funnel claim.

## Verified prior release

[#341](https://github.com/ravichavali/karmyq/pull/341) merged as `71773476` on 2026-11-22;
[CI/CD attempt 2](https://github.com/ravichavali/karmyq/actions/runs/45066293676/attempts/2)
passed 14/14, Deploy to Demo succeeded, the member-count migration committed, 9/9 service health checks
passed. ADR-106 is Implemented and BUG-103/104/105 fixed and deployed in this branch's post-merge record.
See the archive for exact timestamps, security status and evidence limitations (application smoke is
maintainer-reported and was not independently rerun here).

## Open candidates and decisions

- [BUG-106/108](../../docs/BUGS.md): confirmed Sprint 145 scope. BUG-107 staff direct-add consent
  remains open and deferred; scope confirmation does not change that exception.
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

GitHub open-PR query returned none on 2026-11-23; the branch was clean at `8471a6a7` before planning edits.
Fetched master remains `71773476` (Sprint 144 #341); root package version is 11.117.0 (`package.json:3`).
The first commit `8471a6a7` contains the Sprint 144 post-merge record. Its historical validation remains
in the shipped archive; it is not evidence of an implemented Sprint 145 fix.

Sprint 145 changes are this handoff and the design draft only. Source references were checked, and a
fresh read-only builder reviewer reported "nothing important left" (2026-11-23). Design approval and
the implementation plan remain pending. Draft documentation drift check passed 41/41, exit 0, no Jest cache
(`npm exec --workspace=tests -- jest --runTestsByPath regression/doc-context-drift-gate.test.ts --runInBand
--no-cache`); `git diff --check` passed and editor diagnostics reported no errors for the two draft files.
No product implementation test, DB proof, live smoke or release is claimed. This is an intermediate
planning checkpoint, not final task/PR verification; the final pre-commit skill and full implementation
gates remain owed when that stage is reached.
