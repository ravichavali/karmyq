# Sprint 143 — Governance nomination lifecycle + member rejoin — Handoff

**Date**: 2026-11-17
**Outcome**: **implementation and local quality gates complete; product PR not open yet.** Sprint 143 is not complete:
completion requires merge, deploy and post-deploy verification by a separately authorized follow-on.

> State between sessions only. This branch-local file reserves no contended resource; see
> `.claude/handoff/README.md` → *Parallel development rules*.

## Ownership and live base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-143-planning` |
| **Base** | `origin/master` at `1692a560`, fetched again on 2026-11-17; unchanged, so no merge was needed |
| **Open PRs observed** | Only Dependabot #339 (Next bump), unrelated; do not enter its dependency lane |
| **Plan** | `docs/superpowers/plans/2026-11-15-sprint-143-governance-nomination-lifecycle.md` |
| **Spec** | `docs/superpowers/specs/2026-11-15-sprint-143-governance-nomination-lifecycle-design.md` |
| **Ledger** | `.superpowers/sdd/2026-11-15-sprint-143-governance-nomination-lifecycle/progress.md` |
| **PR** | Not open yet; Task 13 is in progress |

The plan review rounds 1–2 are integrated. Tasks 1–12 are complete. Never rebase this branch.

## Quick Start — next unchecked work

1. Reconcile `git status -sb`, `git fetch origin`, `gh pr list`, and `git log --oneline origin/master -3`; merge a moved
   master with a merge commit only.
2. Finish Task 13: run `bash scripts/pre-commit-check.sh` exactly once unless its documented artifact-recovery rule
   permits one retry, commit/push with normal hooks, then open the single product PR from
   `.github/pull_request_template.md`.
3. Replace BUG-102's `PR pending` text in `docs/BUGS.md` with the real PR reference, reconcile this handoff with the
   live PR, push that correction, and **stop**. Do not watch CI in this chat.
4. A later maintainer-authorized chat starts at Task 14: confirm the PR head's whole-tier integration job and
   `regenerate-init-sql.yml` drift check plus independent byte comparison, then obtain version and merge-slot
   allocation before any merge/deploy.

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
| `0f47ee40` | Route-A workflow `43801545661`: determinism, fresh boot, ledger and replay-drift checks passed; artifact host hash `f711ff9413787d4ce232fd90c4bed7bc71ad7c7c` | Dispatch skipped independent byte comparison; PR workflow evidence remains pending |
| `4f42066a` | Disposable PostgreSQL: Sprint 142 + 143 integration, 2 suites / 78 tests; `karmyq_test` superuser+bypass-RLS recorded, explicit community predicates tested | Predates review fixes; container/tunnel removed. New `joined_at`, non-finite-trust and PUT/DELETE race cases require PR CI |
| `612c3207` | Frontend full tier: 62 unit + 609 regression tests passed | No frontend product change after this run; final frontend `tsc --noEmit` also passed at `9db325a7` |
| `9db325a7` | Community-service full tier: 28 suites / 373 tests passed; focused new tests used `--no-cache` and had red→green proof | Local, not CI; no disposable DB restart was authorized for review fixes |
| `9db325a7` | Root `npm test --workspace=tests`: 49 suites / 1074 tests passed after all review fixes; documentation+disclosure gate also passed 191 tests cold | Jest cache was not globally disabled for the root run; whole-tier integration is CI-only |
| `9db325a7` | `npm run type-check --workspace=services/community-service` and `npm exec --workspace=apps/frontend -- tsc --noEmit` passed | Static checks only |
| `9db325a7` | `feedback:check` rerun; generated landing service/API docs refreshed, known build/dependencyGraph/ADR-010 churn reverted | Advisory output is not a pass claim; no dependency edit was made |

Task 13's final pre-commit and push-hook evidence must be added to the PR Validation ledger after it runs.

## Remaining authorizations and blockers

- **Not authorized:** demo data operations; demo application DB access; platform-admin grant and its 200 smoke check;
  version bump; merge slot; new ADR numbers; dependency lane; merge/deploy; watching CI after PR creation.
- Disposable SSH/Postgres authorization covered Tasks 1 and 4–9 only and has ended cleanly. Do not recreate that DB for
  Task 13. No demo data operation occurred.
- Version and merge slot remain unallocated and block merge readiness, not PR creation.
- PR CI must still prove the whole integration tier, current real-DB review additions, regeneration drift check and
  independent `init.sql` byte comparison. Read actual job conclusions before merge.
- The platform-admin rollout remains fail-closed pending a separately authorized maintainer grant and smoke test.

## Carried follow-ups

- Rotation, revocation, delegation, opposition votes and close/expiry notifications are unplanned.
- No web control cancels one's own pending join request; the API supports it after this sprint.
- Mobile's separate `POST /communities/:id/leave` remains revival debt, outside this branch.
- Other legacy member-handler error envelopes and staff PUT input/counter semantics are pre-existing debt; this branch
  only fixed the rewritten DELETE disclosure and the lock interaction its new DELETE lock set introduced.

⚠️ GitHub status goes stale. Re-derive PR, CI and deploy state before acting on this handoff.
