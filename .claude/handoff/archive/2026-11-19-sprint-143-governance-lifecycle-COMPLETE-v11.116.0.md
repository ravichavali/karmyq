# Sprint 143 — Governance nomination lifecycle + member rejoin — Handoff (ARCHIVED, COMPLETE)

## Post-merge record (2026-11-19, Sprint 144 planning chat; every fact re-read live)

- **Merged:** PR #340 at 2026-11-19T17:54:43Z as squash `a2746057` (v11.116.0). `git diff 86808f53 a2746057` is
  empty, so the merge tree equals the reviewed release head.
- **Deployed:** CI/CD Pipeline run `44582208442` concluded `success` with 14 jobs, including Integration Tests and
  **Deploy to Demo = success**. The Tests run `44582208364` and the Push-on-master run `44582207840` also succeeded.
- **Code scanning:** 0 open alerts on `refs/heads/master`. Both `a2746057` analyses (`javascript-typescript`,
  `actions`) report no error.
- **Dependabot:** #185 (GHSA-mfr8-8qww-v76h) and #186 (GHSA-vc7v-qv4w-wrv8), both MEDIUM `next` `<= 16.4.4`, patched
  16.4.5, opened 2026-11-17/18. Sprint 144 fixes them in its first commit (maintainer authorized 2026-11-19).
  Dependabot PR #339 (→ 16.4.6) is not used: it nests `next` under `apps/*`, strips 26 `libc` lines, and fails
  `tests/regression/sprint-122-lint-config-gate.test.ts` (`Cannot find module 'next/dist/compiled/babel/eslint-parser'`).
- **Still not done:** the demo platform-admin grant and its 200 smoke check (fail-closed rollout, ADR-105). They need
  separate maintainer authorization and are not part of Sprint 144.
- Status lines updated on the Sprint 144 branch: ADR-055 amendment line, BUG-102 header, community-service CONTEXT
  Sprint 143 entry.

---

**Date**: 2026-11-18
**Outcome**: **PR #340 passed re-review; v11.116.0 and the merge slot are allocated.** Final reviewed-head integration
and `init.sql` runs are green; six maintainer CodeQL dismissals and gate rerun remain. Merge, deploy and the
platform-admin smoke check each still require separate explicit maintainer authorization.

> State between sessions only. This branch-local file reserves no contended resource; see
> `.claude/handoff/README.md` → *Parallel development rules*.

## Ownership and live base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-143-planning` |
| **Base** | `origin/master` at `1692a560`, fetched again on 2026-11-18; unchanged, so no merge was needed |
| **Open PRs observed** | Sprint 143 product PR #340; Dependabot #339 (Next bump), unrelated — do not enter its dependency lane |
| **Plan** | `docs/superpowers/plans/2026-11-15-sprint-143-governance-nomination-lifecycle.md` |
| **Spec** | `docs/superpowers/specs/2026-11-15-sprint-143-governance-nomination-lifecycle-design.md` |
| **Ledger** | `.superpowers/sdd/2026-11-15-sprint-143-governance-nomination-lifecycle/progress.md` |
| **PR** | [#340 — feat: Sprint 143 governance nomination lifecycle](https://github.com/ravichavali/karmyq/pull/340) |
| **Release** | v11.116.0 and merge slot allocated by the maintainer on 2026-11-18 |

The plan review rounds 1–2 are integrated. Tasks 1–13 and the PR #340 review corrections are complete; re-review passed.
Never rebase this branch.

## Quick Start — next unchecked work

1. Re-derive live state with `git status -sb`, `git fetch origin`, `gh pr list`, `gh pr view 340`, and
   `git log --oneline origin/master -3`; merge a moved master with a merge commit only.
2. Final reviewed-head `e1fa89fb` evidence: CI run `44422291966` passed all 32 integration suites / 596 tests plus 2
   curated-reset tests; `regenerate-init-sql` run `44422291636` passed every applicable step, including independent
   byte comparison. Read the new release head's actual job conclusions after pushing the version/evidence commit.
3. Hand the maintainer the six alerts from the release head's CodeQL annotations for UI dismissal: `api.ts` alerts as
   `false positive`, test-file alerts as `used in tests`. After dismissal, re-run only the gate job and update the PR
   body's *Security dismissals*. This agent must not dismiss the alerts itself.
4. Merge, deploy and the platform-admin grant/200 smoke check each require separate explicit maintainer authorization.
   Do not infer any of those authorizations from the allocated merge slot.

## Delivered commits

- `3e63ca9f` — Sprint 142 post-merge record. It rides with this product PR and must never go to master alone.
- `246f958a`…`5cb9447f` — spec, plan and integrated plan reviews.
- `dcffbae9`, `0f47ee40` — lifecycle migration and regenerated `init.sql`.
- `62a1ee4b`…`e3f2edc6` — pure lifecycle rules, withdraw/decline routes, DB close/expiry behavior and race coverage.
- `556e13c7` — GET expiry/viewer projection and POST mirror.
- `69b617c4` — member self-leave/rejoin, counters, active-only guards and token reissue.
- `9ad4b8cd`, `612c3207` — governance close controls and the web Leave control with shared token persistence.
- `4f42066a` — real-DB migration replay proof.
- `8e2414b8`, `aa018f6b` — guides/onboarding/ADR-055 amendment, landing docs, CONTEXT/registry/BUGS and test promotion.
- `cdb59891` — review fixes: rejoin refreshes `joined_at`; both GET trust eligibility sites reject non-finite sums.
- `9db325a7` — review fixes: staff PUT and DELETE share target-plus-active-admin user-ID lock order; DELETE hides
  internal DB details; GET documentation now correctly says it hides expired rows without writing.

## Behavior and review decisions

- Pending nominations close only through the active nominator's withdraw, active nominee's decline, ratification, or
  30-day expiry. Expired closes commit `resolved_at=expires_at` before returning 409. GET hides expired rows but does
  not persist that close; creation reclaims expired slots. Ballots survive every close.
- `can_ratify` mirrors POST, including idempotent prior-voter finalization and ineligible-nominee refusals. GET returns
  coarse eligibility only. PostgreSQL NaN and both infinities are ineligible in both GET projections and POST.
- Self-leave writes `left`; staff removal writes `inactive`. Only active/pending rows can self-leave, so removed users
  cannot convert `inactive` → `left`. Rejoin resets role to `member`, refreshes `joined_at`, applies public/private
  join rules, updates the counter only for active transitions, and reissues active-membership JWT claims.
- Governance writes lock nomination before memberships. Staff PUT demotion/deactivation and DELETE lock target plus
  active admins in one user-ID-ordered statement, preventing the review-discovered reverse-lock path. BUG-103 remains
  open for other staff-PUT counter drift.
- DELETE unexpected failures now use ADR-074 `INTERNAL_ERROR` without raw SQL/error details. Token reissue rebuilds
  claims from active memberships; no revocation or rotation was added.
- `/simplify` made no code change: existing lifecycle/policy helpers and shared token persistence were sufficient.
- The independent `process-reviewer` completed. Its GET-expiry documentation finding was fixed; its clean-tree/root
  evidence findings were resolved by subsequent commits and green runs, and this handoff replaces the planning state.
- A fresh independent whole-branch correctness/security reviewer was attempted twice and failed both times on the
  provider five-hour usage limit. Do **not** claim that independent review passed. Inline high-effort review completed
  all plan focus areas and fixed its verified leads. The known route-local `js/missing-rate-limiting` pattern is a
  false positive because rate limiting mounts at app level; no alert has been dismissed by this task.

## Validation evidence

| Commit / tested tree | Evidence | Limitation |
|---|---|---|
| `0f47ee40` | Route-A workflow `43801545661`: determinism, fresh boot, ledger and replay-drift checks passed; artifact host hash `f711ff9413787d4ce232fd90c4bed7bc71ad7c7c` | Dispatch skipped independent byte comparison; PR run `44103556499` supplies it below |
| `4f42066a` | Disposable PostgreSQL: Sprint 142 + 143 integration, 2 suites / 78 tests; `karmyq_test` superuser+bypass-RLS recorded, explicit community predicates tested | Predates all review fixes; container/tunnel removed. PR CI below covers the later real-DB additions |
| `612c3207` | Frontend full tier: 62 unit + 609 regression tests passed | No frontend product change after this run; final frontend `tsc --noEmit` also passed at `9db325a7` |
| `9db325a7` | Community-service full tier: 28 suites / 373 tests passed; focused new tests used `--no-cache` and had red→green proof | Local and predates the PR #340 review corrections |
| `9db325a7` | Root `npm test --workspace=tests`: 49 suites / 1074 tests passed after the initial review fixes; documentation+disclosure gate also passed 191 tests cold | Jest cache was not globally disabled; predates the PR #340 review corrections |
| `9db325a7` | `npm run type-check --workspace=services/community-service` and `npm exec --workspace=apps/frontend -- tsc --noEmit` passed | Static checks only; predate the PR #340 review corrections |
| `9db325a7` | `feedback:check` rerun; generated landing service/API docs refreshed, known build/dependencyGraph/ADR-010 churn reverted | Advisory output is not a pass claim; no dependency edit was made |
| `685ef410` | Final `bash scripts/pre-commit-check.sh`: initial tests passed but generated-doc churn failed; applied its exact snapshot recovery `20ceb2ba32ebf1de83a18498e9981fa3c73c129f`, and the single permitted retry exited 0 | Mixed project test cache; retry followed the documented artifact-recovery rule; local integration unavailable |
| `685ef410` | Normal push hook passed required unit/regression checks and pushed the branch | Turbo reported mixed caching; integration skipped without a local DB. Non-blocking development-TDD tasks failed with `ECONNREFUSED 127.0.0.1:5432`, which the hook explicitly accepted |
| `678403be` | PR CI run [44103556510](https://github.com/ravichavali/karmyq/actions/runs/44103556510): integration executed 32 suites / 596 tests; 595 passed and one failed because the staff-removal race expected `left` instead of actual `inactive` | Failed run; corrected assertions are proved by final reviewed-head run `44422291966` below |
| `678403be` | `regenerate-init-sql` run [44103556499](https://github.com/ravichavali/karmyq/actions/runs/44103556499) passed every applicable step: independent baseline, determinism, fresh boot, migration ledger, zero drift and committed-byte comparison | The failure-only database-log step was skipped on success; final reviewed-head run `44422291636` also passed |
| `e1fa89fb` | Final reviewed-head CI run [44422291966](https://github.com/ravichavali/karmyq/actions/runs/44422291966): Integration Tests passed 32 suites / 596 tests plus 2 curated-reset tests; backend unit/regression, lint/typecheck, security audit and landing build passed | Overall run failed only at Code Scanning Gate; Docker image build and deploy skipped. No deployment occurred |
| `e1fa89fb` | Final reviewed-head `regenerate-init-sql` run [44422291636](https://github.com/ravichavali/karmyq/actions/runs/44422291636) passed every applicable step, including independent baseline, determinism, fresh boot, migration ledger, zero drift and committed-byte comparison | Failure-only DB-log step skipped on success; no schema change followed |

## Remaining authorizations and blockers

- **Allocated:** v11.116.0 and the merge slot. **Not authorized:** demo data operations; demo application DB access;
  platform-admin grant and its 200 smoke check; new ADR numbers; dependency lane; merge; deploy. Each of merge, deploy
  and the platform-admin smoke check needs separate explicit maintainer authorization.
- Disposable SSH/Postgres authorization covered Tasks 1 and 4–9 only and has ended cleanly. No demo data operation occurred.
- Final reviewed-head integration and regeneration are green. Read the new release head's actual CI jobs after the
  version/evidence commit; do not infer their conclusions from `e1fa89fb`.
- The maintainer must dismiss six CodeQL alerts from the release head's annotations: `api.ts` as `false positive`, test
  files as `used in tests`; then re-run the gate job and update the PR body's *Security dismissals*.
- The platform-admin rollout remains fail-closed pending a separately authorized maintainer grant and smoke test.

## Carried follow-ups

- BUG-104 tracks the non-canonical-UUID PUT last-admin guard bypass; BUG-105 tracks moderator reactivation restoring a
  stored admin role. The maintainer explicitly chose separate bugs rather than bundling either fix into PR #340.
- Rotation, revocation, delegation, opposition votes and close/expiry notifications are unplanned.
- No web control cancels one's own pending join request; the API supports it after this sprint.
- Mobile's separate `POST /communities/:id/leave` remains revival debt, outside this branch.
- Other legacy member-handler error envelopes and staff PUT input/counter semantics (BUG-103) are pre-existing debt;
  this branch only fixed the rewritten DELETE disclosure and the lock interaction its new DELETE lock set introduced.

⚠️ GitHub status goes stale. Re-derive PR, CI and deploy state before acting on this handoff.
