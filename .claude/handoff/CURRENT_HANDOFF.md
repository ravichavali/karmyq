# Sprint 145 — Planning — Handoff

**Date**: 2026-11-23
**Outcome**: Sprint 145 scope confirmed by the maintainer: BUG-106 + BUG-108 admission integrity;
BUG-107 staff direct-add consent policy deferred. Claude's review of `32754735` rejected the first draft;
source-backed corrections and revised recommendations D1–D3 are recorded. Those decisions and design approval
remain pending. Do not write the implementation plan yet; no implementation is authorized here.

## Ownership and base

| Field | Value |
|---|---|
| Branch | `agent/claude/sprint-145-planning`, created from `origin/master` `71773476` |
| Active editor | Codex (this session); one editor at a time in the shared Windows checkout |
| Owned paths | Sprint 144 post-merge record (committed); Sprint 145 spec/plan, this handoff, BUG-109 log in docs/BUGS.md |
| PR | None; `gh pr list --state open` returned no open PRs on 2026-11-23 |
| Release | Current master v11.117.0; Sprint 145 version unallocated |

## Quick Start

1. Read [CLAUDE.md](../../CLAUDE.md), then this handoff.
2. `git fetch origin && git log --oneline origin/master -2`; reconcile `gh pr list` and
   `git status --short`. Reuse `agent/claude/sprint-145-planning`; never branch from local master.
3. Read the [Sprint 144 shipped archive](archive/2026-11-23-sprint-144-staff-write-integrity-SHIPPED-v11.117.0.md).
4. Review the [Sprint 145 design draft](../../docs/superpowers/specs/2026-11-23-sprint-145-admission-integrity-design.md).
   Scope is confirmed (2026-11-23); the first draft was not approved. Review the revised D1–D3 policy table
   and the review ledger below. After those decisions and the revised design are approved, invoke
   `superpowers:writing-plans` and finish `.claude/skills/sprint-planning/SKILL.md`.
   No Sprint 145 implementation plan exists yet. Do not start product implementation in this planning chat.

**Goal (confirmed 2026-11-23)**: invitation acceptance must enforce capacity and membership state
atomically (BUG-106); duplicate-create joins must follow membership lifecycle rules and report truthful
results (BUG-108). BUG-107's staff direct-add consent policy stays deferred.

**Next action**: settle D1–D3 and obtain approval of the revised design draft, then write the implementation plan tagged
`no-deploy`. Execution belongs in the next chat after planning is ready; reuse this branch.

## Proposed design (awaiting approval)

- Service-local transactions; no new schema, shared-package export, dependency or ADR number.
- Invitation consumption, membership, user attribution and inviter-statistics trigger commit together;
  capacity/state refusals leave all unchanged. Inviter liveness is explicitly an acceptance-side security fix.
- **D1 (recommended, pending):** already-active invitee gets 200 with no persistent writes: no consumption,
  stats, attribution or membership change. Code remains usable; response has `already_member: true` and
  `accepted_at: null`. A minimal caller guard avoids creating an invitation bond for this no-op.
- **D2 (recommended, pending):** an invitation promotes a pending applicant to active ordinary member,
  with the same post-write capacity check as a newcomer. New/left invitees become active ordinary members;
  blocked/NULL/unknown states still refuse. Duplicate-create still refuses pending membership.
- **D3 (recommended, pending):** inviter must still be a live active member, regardless of role.
  **Any active member of a private community can admit anyone without admin approval**, subject to capacity
  and blocked-state checks. This authority requires an explicit maintainer decision; it is not implied by scope.
- Duplicate-create uses the existing membership classifier inside its transaction. Active retries stay
  idempotent; left rows rejoin as member; pending/blocked refuse. A community that turned private returns the
  private pointer even for an active no-op; roll back any tentative admission before returning its pointer.
- Capacity follows the active write on the transaction client, using the ADR-106 counter. No community
  pre-lock ahead of membership locks. Races/rollback need real DB proof through isolated CI; remote test
  infrastructure is not authorized by this session.
- These are author proposals, not decisions implied by the maintainer's scope confirmation. The spec's
  Critical implementation notes are not copied here until the design is approved.

## Review ledger (Claude review of `32754735`, 2026-11-23)

All source evidence below was re-read before revising. Policy recommendations remain pending; none is marked
approved by the review's proposed choices.

| # | Finding (review wording) | Verdict and revision | Evidence |
|---|---|---|---|
| 1 | "The deferred \"envelope mismatch\" doesn't exist." | CONFIRMED. Removed the false defect; validation's nested envelope is correct. | `apps/frontend/src/lib/api.ts:915`, `:170–172`; `apps/frontend/src/pages/invite/[code].tsx:50` |
| 2 | "The acceptance contract the spec says to \"preserve\" is not tested by anything that runs." | CONFIRMED. Old root filename is unselected; service integration is outside npm test/CI. Cite the gated S144 new-invitee test; put new coverage in gated tiers. | `tests/jest.integration.config.js:38`; `services/social-graph-service/package.json:11`; `tests/integration/sprint-144-staff-write-integrity.integration.test.ts:476` |
| 3 | "The spec updates the wrong guide." | CONFIRMED. Retarget invitation copy to the joining guide. | `docs/guides/joining-karmyq-guide.md:9–11`; `docs/guides/onboarding-guide.md:3` |
| 4 | "An already-active member accepting a code should probably change nothing." | POLICY: recommend D1 no-write 200, approval pending. Accepted invitation rows, not users.invited_by, directly supply the current chain query. | `services/social-graph-service/src/routes/invitations.ts:135–158`; `services/social-graph-service/src/services/pathComputation.ts:360–363` |
| 5 | "A pending applicant gets a worse deal than a stranger." | POLICY: recommend D2 pending-to-active with capacity, approval pending. Ordinary duplicate-create still refuses pending. | `services/social-graph-service/src/routes/invitations.ts:155–160`; `services/community-service/src/utils/memberLifecycle.ts:7` |
| 6 | "The \"inviter must still be active\" rule is a security fix" | CONFIRMED security gap. State D3's ordinary-member private authority explicitly; decision pending. Log generation/stat inflation as out-of-scope BUG-109. | `services/social-graph-service/src/routes/invitations.ts:9–19`, `:46–66`, `:110–160` |
| 7 | "\"Destroy the client if rollback fails\" can't apply to BUG-108 as scoped." | CONFIRMED. Limit new cleanup guarantee to social-graph; community wrapper stays unchanged. | `services/community-service/src/database/db.ts:48–60` |
| 8 | "Follow existing patterns." | CONFIRMED patterns. Use db: Queryable = pool, and ordered inviter FOR SHARE / invitee FOR UPDATE locks; remove artificial exclusive-inviter queueing assumptions. | `services/social-graph-service/src/database/trustEdgeDb.ts:107–111`; `services/community-service/src/database/governanceDb.ts:286` |
| 9 | "Two invitation rules have no live trigger." | CONFIRMED distinctions. Bound-invitee refusal is synthetic-fixture coverage; self-acceptance already has a DB guard, with the planned API improvement 500→400. | `services/social-graph-service/src/routes/invitations.ts:49`, `:137`, `:176`; `infrastructure/postgres/init.sql:950` |
| 10 | "for an active member, return the existing private-community response" | Adopted in revised proposal. Private pointer covers a mid-request change too, with any tentative admission rolled back first. | `services/community-service/src/routes/communities.ts:438–447` |

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
- [BUG-109](../../docs/BUGS.md): newly logged generation authorization/statistics security gap, outside
  Sprint 145 implementation. Acceptance liveness is the proposed in-scope mitigation, not a generation fix.
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

GitHub open-PR query returned none again on 2026-11-23; the branch was clean at `32754735` before review revisions.
Fetched master remains `71773476` (Sprint 144 #341); root package version is 11.117.0 (`package.json:3`).
The first commit `8471a6a7` contains the Sprint 144 post-merge record. Its historical validation remains
in the shipped archive; it is not evidence of an implemented Sprint 145 fix.

Sprint 145 changes are this handoff, the design draft and the BUG-109 log only. The earlier builder check at
`32754735` did not catch the factual errors subsequently identified by Claude; it is not approval or validation
of this revision. The review ledger above records the re-verified sources and corrections. D1–D3/design approval
and the implementation plan remain pending. Historical draft documentation drift check at `32754735` passed
41/41, exit 0, no Jest cache
(`npm exec --workspace=tests -- jest --runTestsByPath regression/doc-context-drift-gate.test.ts --runInBand
--no-cache`); that result predates these review revisions. Fresh revision checks, their exit statuses and
limitations are recorded in the body of the `docs: revise Sprint 145 design after review` commit. Do not reuse
the earlier result as evidence for this diff or treat planning checks as proof that the proposed fixes work.
No product implementation test, DB proof, live smoke or release is claimed. This is an intermediate
planning checkpoint, not final task/PR verification; the final pre-commit skill and full implementation
gates remain owed when that stage is reached.
