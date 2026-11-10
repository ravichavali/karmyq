# Between Sprints — after Sprint 139 (v11.112.0)

**Date**: 2026-11-10
**Outcome so far**: **Sprint 139 is COMPLETE — merged and deployed.** PR #332 was admin squash-merged as `8aabc50c`
(v11.112.0); CI/CD `42914254213` passed all 14 jobs, the deploy's health check found all 9 services healthy, and there
was no rollback. 0 open code-scanning alerts on master. **New since the merge: 4 open Dependabot alerts on `node-forge`
(3 medium, 1 low; SLA deadline 2026-11-24) and Dependabot PR #333.** The next sprint's scope is the maintainer's call.

> The handoff carries **state between sessions**. It is branch-local, so it can reserve nothing; see `CLAUDE.md` →
> *Parallel Development*. Git and PR state (`gh pr list`, `git log origin/master`) outrank anything written here. No
> parallel lanes are active.

**Previous**: Sprint 139 COMPLETE. Archived, with the verified post-merge record on top:
[`archive/2026-11-09-sprint-139-correctness-bundle-COMPLETE-v11.112.0.md`](archive/2026-11-09-sprint-139-correctness-bundle-COMPLETE-v11.112.0.md).

---

## Quick Start

1. Read `CLAUDE.md` and this handoff. Confirm live state: `git fetch origin`, `gh pr list`,
   `git log --oneline origin/master -3`, `gh api repos/ravichavali/karmyq/dependabot/alerts?state=open --jq length`.
2. This branch, `agent/claude/sprint-140-planning`, is cut from `origin/master` `8aabc50c` and carries only this
   handoff and the Sprint 139 archive. Reuse it for the next sprint's planning or first PR (post-merge records ride in
   the next PR; never a docs-only master push).
3. **Ask the maintainer for the next scope** (below). Nothing is scheduled.

**Next unchecked task**: maintainer decision on the next sprint. If it is the node-forge fix, it is dependency work —
confirm the lane and the authorization first.

## Candidates for the next sprint (maintainer's call)

1. **node-forge advisories — #181/#182/#183 medium, #184 low** (GHSA-j8rw-jp99-435v, GHSA-6cv4-p8m7-4r25,
   GHSA-w4xr-hqv8-ch44, GHSA-6889-vf6x-f3g5), runtime scope in `package-lock.json`, patched in 1.4.3. **Deadline
   2026-11-24.** Dependabot PR #333 proposes node-forge 1.4.2 → 1.4.3 and touches `package.json` as well as the lock —
   inspect what it changes before treating it as the fix (`feedback_dependabot_merge_discipline`). Dependency work
   needs explicit authorization; a security fix rides as the first commit of the next PR if that PR merges inside the
   SLA (CLAUDE.md → *Bundle by default*).
2. **BUG-100 (security, pre-existing, proposed MEDIUM):** `GET /communities/my/communities` trusts a query-string
   `user_id` (`services/community-service/src/routes/communities.ts:266-288`), so a signed-in user can list another
   user's memberships.
3. **BUG-098:** remaining `response.data.data` reads in the frontend; `admin/trust-questions` is confirmed broken.
   **BUG-099:** the offers page's "All" filter shows active offers only.
4. **Now-visible WIP reds:** since Sprint 139 the pre-push hook's TDD tier really runs and warns on every push; it exits
   1 on pre-existing failures in request, community, social-graph, tests and frontend.
5. Unchanged product candidates: the mobile sprint (`docs/IDEAS.md` 2026-10-29; do not ship the app before it), backing
   out of an in-progress exchange from the UI, and the 2026-11-08 communication-channel framing idea (adversarial
   discussion first).
6. **#329 — the Expo patch train:** still open; the scheduled Expo SDK drift run keeps failing daily on master because
   the drift is open (not a deploy).

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-140-planning`, cut from `origin/master` `8aabc50c` on 2026-11-10 |
| **Base** | `origin/master` `8aabc50c` (#332, v11.112.0). The next version is re-derived from `origin/master` at merge |
| **Shared resources** | **Dependency lane: Claude** (maintainer-designated). No ADR number allocated. Dated: node-forge SLA, #178 (below) |
| **Merged branches safe to delete** (maintainer's call) | `agent/claude/sprint-139-planning` (head `71f957b1`; same tree as `8aabc50c`), `agent/claude/sprint-138-planning` (`96ce19d2`), `agent/claude/sprint-137-planning` (`49ebd68a`), `agent/claude/sprint-136-planning` (`170d39fe`), `agent/claude/sprint-135-pr-request-status-guards` (`7bfc65ac`), `agent/claude/sprint-135-planning` (`5a3589ef`), `agent/claude/sprint-134-pr-bug-077-badge-insert` (`afbaed7a`); older `agent/claude/sprint-134-*` heads remain on origin |

## Dated obligations

- **node-forge #181–#184:** fix by **2026-11-24** (vulnerability SLA, any severity ≤ 2 weeks).
- **`deepmerge` #178** (dismissed `tolerable_risk`): re-check at the next Expo SDK move or by **2026-12-01**.

## Not yet observed (each needs the maintainer's per-operation authorization — a demo-host read)

- The first nightly `=== Provider trust refresh complete: N evaluated, M failed ===` line from the 03:30 job after the
  2026-11-10 22:40Z deploy. Until then, a provider's stored completion rate stays on the old formula unless it
  completed an exchange since the deploy. No backfill was run.

## Carry-forward work

See the Sprint 139 archive's *Carry-forward work* and *Decisions*: Sprint 138's F2/F3/F4/F8/F9; the spec-forbidden
follow-ups logged by Sprint 139's gates (a pg NUMERIC type parser, a versioned effective-params cache key, a shared
timed-query wrapper / `logger.query()` repair, a `match_cancelled` consumer, one offer-past-expiry SQL fragment, typed
API wrappers or a `.data.data` gate); pruning retained pre-push TDD logs; Sprint 137 `/simplify` deferrals; BUG-087
runtime log proof; BUG-073 tabled; PR C exemption re-check; PR D's D8; the per-community health-quality weight (needs an
ADR number).

## Standing rules

See `CLAUDE.md` and the Sprint 138 archive's *Standing rules*. Branch off `origin/master`; never force-push or
direct-push master; one merge at a time; no docs-only master push; ask before any demo-host operation, merge, ADR
number, dismissal or dependency work; stop after PR creation. Check each CI run's conclusion and created job count,
not only `gh pr checks`.
