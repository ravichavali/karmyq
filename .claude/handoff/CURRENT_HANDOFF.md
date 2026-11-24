# Sprint 145 — Admission integrity — Handoff

**Date**: 2026-11-23
**Outcome**: D1–D3 and the revised design are explicitly approved. Claude's cross-agent plan review found the
plan executable (no design decision owed; four execution rulings below). Execution is in progress, inline
(`superpowers:executing-plans`), on this branch.

## Ownership, approval and base

| Field | Value |
|---|---|
| Branch | `agent/claude/sprint-145-planning`, based on `origin/master` `71773476` |
| Active editor | Claude (executor since 2026-11-23), one editor at a time in the shared Windows checkout |
| Owned paths now | Sprint 145 implementation, tests, docs and this handoff. The plan and spec stay Codex-authored; review findings are recorded here, not edited into them |
| Spec | [Approved design](../../docs/superpowers/specs/2026-11-23-sprint-145-admission-integrity-design.md) |
| Plan | [Implementation plan](../../docs/superpowers/plans/2026-11-23-sprint-145-admission-integrity.md), tagged `no-deploy` |
| PR | None; open-PR query returned none on 2026-11-23 |
| Release | Master v11.117.0; Sprint 145 version unallocated |

**Maintainer approval (2026-11-23)**: "Approve D1–D3 and the revised design".
D1 = active invitee no-write 200; D2 = invitation promotes pending, accepting the stale staff-notification cost;
D3 = any live active private member can admit someone without admin approval, subject to capacity/blocked checks.
This is design/planning approval. Version, merge, deploy, demo-data operations and remote test infrastructure
remain unauthorized. Execution belongs in the next chat.

## Quick Start

1. Read [CLAUDE.md](../../CLAUDE.md) and this handoff.
2. `git fetch origin && git log --oneline origin/master -2`; reconcile `gh pr list` and
   `git status --short`. Reuse this branch; no worktrees or branch from local master.
3. Read the linked approved spec and plan together. All implementation Tasks 1–11 are unchecked.
4. Review the plan against the approved design before execution. Step 5b is complete; final planning
   verification evidence is in the planning closeout commit body. Do not mistake it for implemented behavior.
5. After plan review, the next execution chat uses `superpowers:subagent-driven-development` or
   `superpowers:executing-plans`. The plan includes the required Sonnet/Haiku/Opus subagent-model header.
   No execution-method selection or product implementation has occurred in this planning chat.
6. Checkpoint after at most three tasks and before any long suite or subagent review: commit, update
   task/state/SHA/evidence here, and state what is awaited. A mid-sprint pickup reads this file.

**Goal**: BUG-106 invitation acceptance enforces capacity/live membership atomically; BUG-108 duplicate-create
respects membership lifecycle and reports truthful outcomes. BUG-107/109 remain out of implementation scope.

## Task status and evidence

| Task | State | SHA/evidence |
|---|---|---|
| Design D1–D3 | Approved | Explicit maintainer message, 2026-11-23; includes the two re-review gaps and nits |
| Implementation plan | Cross-agent reviewed (Claude) — executable | Reviewed `a24e854a`. Citations re-read, staff/governance lock order confirmed ascending user_id (`members.ts:30-34`, `governanceDb.ts:239`), so there is no deadlock cycle with acceptance locks. No local psql/postgres/Docker, so DB proof is CI-owed |
| Step 5b self-audit | Complete | self-audit at `92e398ff`: 0 findings fixed; fresh-context session-model reviewer found no actionable findings |
| Task 1 red tests | Committed (see Task 1 commit) | 3 social-graph TDD files + root integration file. Focused run: 57 red / 5 green, all behavioral (old timestamp, D1 writes, explicit client ignored); module test red = missing new module; integration compiles, 43 cases unrun locally (ECONNREFUSED; CI-owed) |
| Task 2 live role + acceptance module | Committed `f48a0bb3` | Module and live-role TDD 21/21 green (exit 0, `--no-cache`); S134 live-role regression 11/11; social-graph tsc exit 0 |
| Task 3 accept route wiring | Committed (Task 3 commit) | 3 social-graph TDD files 78/78; service unit+regression 27 suites/196 passed; root claim gate 17/17; tsc exit 0. A test bug was fixed: the 401 undefined-caller case used a default parameter. It was re-verified red on the old handler (400 vs 401) |
| Task 4 red duplicate-create + DB races | Committed `5455d3aa` | community TDD 19 red / 9 green (behavioral); root integration now 73 cases, compiles, unrun locally (CI-owed) |
| Task 5 duplicate-create implementation | Committed `865065ba` | focused 66/66; community-service unit+regression 33 suites/534; tsc exit 0. Fixture corrections: S144 capacity + S77 idempotent-create mocks answer the new state read (assertions kept) |
| Task 6 frontend contract tests | Committed (Task 6 commit) | 1 red (D1 routes to /welcome) / 10 green baselines (actual acceptance, 4 refusal fallbacks, 4 create refusals, create success) |
| Task 7 defensive D1 branch | Committed `b0007785` | frontend S145 + S118 28/28; frontend tsc exit 0 |
| Task 8 guides/concept/ADR-062 + landing | Committed `54a40c7f` | drift gate 41/41; generator churn restored (architecture/build/adr-010) |
| Task 9 contexts/registry/BUGS + promotion | Committed (Task 9 commit) | BUG-106/108 "fixed in branch, pending review and deploy"; BUG-107/109 open. 5 files `git mv`'d to regression and verified directly: social-graph 78, community 42, frontend 28 (all `--no-cache`, exit 0). Drift 41/41; `analyze:services` no change. Root DB file stays in `tests/integration/` — **unrun locally, CI-owed** |
| Tasks 10–11 | Not started | Next: whole-branch gates (/simplify, /security-review, process review, /code-review), then final verification and PR |

**Plan-review execution rulings (Claude):** (1) the same-inviter barrier counts waiters on
`INSERT INTO communities.members` only, plus a `FOR UPDATE NOWAIT` probe proving the inviter row is share-locked.
The S144 `'%communities.members%'` filter also matches the inviter `FOR SHARE` select, so it would pass with an
exclusive lock (false green). (2) Self-acceptance is refused in code before the D1 branch, with the CHECK as a
backstop; otherwise an active self-inviter would get D1's 200. (3) The stats-trigger rollback proof intercepts only
the `UPDATE auth.users` statement on the real client; everything else, including ROLLBACK, runs on the real DB.
(4) Classifier parity is one shared state table that drives both endpoints in the root integration file. Also: a
new `services/social-graph-service/tests/helpers/fakeInvitationDb.ts`, shared by the two unit tiers (not a test
file; it is never promoted).
| Final planning verification | See planning closeout commit body | Fresh command/exit/cache/limitations recorded there; older `d169f5c6` evidence does not cover this plan |

**Next action**: continue execution at the first task without a commit (Claude, inline). The ledger is in the
git-ignored `.superpowers/sdd/2026-11-23-sprint-145-admission-integrity/progress.md`; `git log` is the record if it is lost.
The design and D1–D3 do not need another approval; any new material scope change still does.

## Execution boundaries and PR contract

- Reuse the approved design; no more policy decision is pending. Same-inviter repeat admission remains
  409 INVITATION_CONFLICT with another member's code/public self-rejoin as recovery; no schema change.
- D2/D3 may supersede staff review and stale its earlier notification; no notification-service cleanup.
- D1's UI branch is defensive, with one minimal test; validation's bare-Axios nested envelope is correct.
- New TDD files are explicitly promoted only after green. `.npmrc` disables npm posttest/prebuild lifecycle
  hooks, so never rely on automatic promotion or automatic landing generation.
- No authorized local DB/remote test host is allocated. New DB tests are written before backend implementation;
  local DB red/green may remain unrun and must be recorded CI-owed. Root integration CI is mandatory evidence
  before a future merge; mocks and test-file discovery are not transaction/race proof.
- The execution PR body must use the complete repository template and explicitly list bundled work:
  **30b1823e — docs(process): apply /insights triage to agent rules and skills** and
  **cd8b973a — docs(process): route plan subagent models**. Explain why these docs ride with this product PR
  instead of costing a separate deploy. Include the Sprint 144 post-merge record as bundled documentation.
- Keep real test SHA/command/exit/cache/limits in the PR Validation ledger. Stop the execution chat after
  opening its reviewable PR; a next reviewer checks actual CI before any future release authorization.

## Critical implementation notes

1. One transaction client owns actual invitation consumption, membership, counter effect, attribution and inviter
   stats; failed admission consumes nothing. Failed rollback destroys the new social-graph transaction's client
   only; community-service's existing wrapper remains unchanged with its documented cleanup limitation.
2. Lock invitation, then inviter FOR SHARE and invitee FOR UPDATE in global user_id order, then let the trigger
   lock the community. Use the existing Queryable/client injection pattern. Never pre-lock a community.
3. Approved D1–D3: active invitees get a no-write 200 with an unconsumed code; pending invitees become
   active ordinary members after capacity validation; any active private member can admit anyone without admin
   approval (subject to capacity and blocked-state refusals). Duplicate-create still refuses pending; both paths
   refuse inactive/NULL/unknown and reset left rejoins to ordinary member.
4. A conflict no-op must be followed by a locked state read. A missing row is not a NULL-status row. Never infer
   active membership from row existence or fall back to an invented role/token claim.
5. Live inviter authority is an in-scope security fix; read it inside the locked acceptance transaction using the
   stored community and verified caller. BUG-109 tracks unguarded generation separately. Self-acceptance already
   has a DB guard (now map to 400); bound-invitee refusal is defensive fixture-only coverage.
6. Capacity checks follow real active admissions on the same client. The database owns current_members; no deltas,
   counter assignments, recounts, schema changes, generated init.sql edits or new dependency are needed.
7. Preserve private duplicate-create pointers, including a mid-request change (rollback tentative admission
   first), active member roles, used-code status and post-commit token refresh. D1 adds already_member: true and
   accepted_at: null; the invite caller must not manufacture an invitation bond for that no-write outcome.
8. Prove SQL, rollback and interleavings against the real CI database; mocks alone do not prove them. Include
   compatible shared inviter locks in barriers and unconditionally clean up failed barriers. Put new acceptance
   coverage in gated tiers, not the unselected old root/service integration files.
9. BUG-107 and generation BUG-109 stay out of scope. Validation uses bare Axios, so its nested envelope is correct.
   Do not claim live UI smoke or deployment from API tests, source inspection or historical Sprint 144 evidence.
10. Version, merge, deploy, demo data and remote test infrastructure remain unauthorized; planning produces docs
    only, with execution in the next chat after design/plan readiness.
11. Repeat invitations from the same inviter/community can hit the existing unique triplet on a left or pending
    invitee. Keep 409 INVITATION_CONFLICT with the alternate-path message, joining-guide explanation and real-history
    state-matrix/rollback proof. No schema change or deletion of accepted history.
12. D2/D3 let an ordinary member admit an applicant while staff review, leaving a prior join-request notification
    stale. This is an explicit policy cost, not a notification cleanup task. The D1 frontend guard is defensive
    and gets one minimal test because registration itself creates no membership.

## Persistent context (carried forward)

## Verified prior release

[#341](https://github.com/ravichavali/karmyq/pull/341) merged as `71773476` on 2026-11-22;
[CI/CD attempt 2](https://github.com/ravichavali/karmyq/actions/runs/45066293676/attempts/2)
passed 14/14, Deploy to Demo succeeded, the member-count migration committed, 9/9 service health checks
passed. ADR-106 is Implemented and BUG-103/104/105 fixed and deployed in this branch's post-merge record.
See the archive for exact timestamps, security status and evidence limitations (application smoke is
maintainer-reported and was not independently rerun here).

## Open candidates and decisions

- **Bundled agent-process commit (maintainer-requested 2026-11-23, Claude):** this is the
  `docs(process): ...` commit on this branch, from the `/insights` report triage. It changes the
  CLAUDE.md Windows-host and next-chat-prompt rules, the sprint-planning Step 5b self-audit and
  checkpoint, the ship blocker report, the deploy post-merge closeout plus frontmatter, and the
  review-response agent-report section. A second commit, `docs(process): route plan subagent models`
  (the maintainer's `/usage` follow-up), adds the plan-template rule: implementers and per-task
  reviewers run on Sonnet, and the final whole-branch review runs on Opus. Neither commit changes
  product code, committed settings or dependencies. The Sprint 145 PR body must list both under
  bundled work. It is docs-only, so a separate PR would cost
  a deploy for no gain. Pre-existing defect found, not fixed: `tests/claude.md` says the TDD
  promoter "runs as root `posttest`", but `.npmrc` `ignore-scripts=true` stops npm from running it.
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

## Planning verification record

Source references are pre-implementation anchors. The approved spec contains verified current behavior;
the plan's new helper/test paths are proposed interfaces. The first builder check at `32754735` missed
errors subsequently corrected by Claude's reviews; it is not approval or a self-audit of this plan.
Historical review details are in `d169f5c6` and `a29a38ed`; their test evidence is dated in those commit bodies.

Step 5b reviewed clean checkpoint `92e398ff`: **0 actionable findings; 0 findings fixed**. It checked source
citations, npm lifecycle/CI tiers, task order/interfaces, transaction invariants, races/rollback and scope.
This read-only session-model review did not run tests or replace the next cross-agent plan review.

The planning closeout commit body records the fresh final check command, exit status, cache and limitations
for its staged tree. Product behavior, DB proof, live smoke and release remain unverified/unperformed.
