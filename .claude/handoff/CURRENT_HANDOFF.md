# Between sprints — after Sprint 136 — Handoff

**Date**: 2026-11-04
**Outcome so far**: **No sprint in flight.** Sprint 136 is complete: #328 merged as `f19ca413` (v11.109.0) and deployed
green. Master has 0 open code-scanning alerts and 0 open Dependabot alerts, and Expo drift #316 is closed. The next
sprint's scope is the maintainer's call. Two questions wait on the maintainer (*Open questions*).

> The handoff carries **state between sessions**. It is not a copy of the plan: it links the plan and names the next
> unchecked task. It is branch-local, so it can reserve nothing; see `CLAUDE.md` → *Parallel Development* for how
> contended resources are actually allocated. Git and PR state (`gh pr list`, `git log origin/master`) outrank anything
> written here. No parallel lanes are active.

**Previous**: Sprint 136 COMPLETE (merged `f19ca413`, v11.109.0; deploy green 9/9; #180/#179 cleared; #316 closed).
Archived: [`archive/2026-11-04-sprint-136-mobile-deps-and-status-followups-COMPLETE-v11.109.0.md`](archive/2026-11-04-sprint-136-mobile-deps-and-status-followups-COMPLETE-v11.109.0.md)
(it holds the #328 post-merge record and the corrected 2026-11-04 fix-forward account).

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-137-planning`, cut from `origin/master` `f19ca413` on 2026-11-04. It carries the Sprint 136 archive and the #328 post-merge record. **No PR is open from it.** Those docs ride in the next PR, never a docs-only master push. |
| **Base** | `origin/master` at `f19ca413` (#328, v11.109.0). No open PRs on 2026-11-04. The next version is re-derived from `origin/master` at merge. |
| **Active editor** | Claude (the Sprint 136 post-merge chat, 2026-11-04). |
| **Shared resources** | **Dependency lane: Claude** (maintainer-designated). Nothing dependency-dated except #178 (below). No ADR number allocated. No demo-host operation pending. |
| **Merged branches safe to delete** (maintainer's call) | `agent/claude/sprint-136-planning` (head `170d39fe`; same tree as `f19ca413`), `agent/claude/sprint-135-pr-request-status-guards` (`7bfc65ac`), `agent/claude/sprint-135-planning` (`5a3589ef`), `agent/claude/sprint-134-pr-bug-077-badge-insert` (`afbaed7a`). |

## Open questions for the maintainer (carried from Sprint 136)

1. **Retention clock edge (Sprint 136 code-review #9).** BUG-083's fix ages a completed ask from
   `COALESCE(MAX(matches.completed_at), updated_at)`
   (`services/cleanup-service/src/jobs/memoryRetentionJob.ts`). A requester can still edit a completed ask
   (`PUT /requests/:id` bumps `updated_at`), and COALESCE ignores that edit. `GREATEST(...)` would give a post-completion
   edit a full window. Shipped as decided (COALESCE). Change it?
2. **BUG-088 direction.** Refusing accept on an expired ask (Sprint 136 decision 3) leaves its proposals, and the help
   offers they hold, in place until the helper withdraws or the requester cancels. Should the expiration sweep close
   them?

## Dated obligations

- **`deepmerge` #178** (dismissed `tolerable_risk`): re-check at the next Expo SDK move or by **2026-12-01**.
- Nothing else is dated. #180's SLA (~11-13) was met on 2026-11-04.

## Open, not scheduled

- **From Sprint 136:**
  - BUG-088 (an expired ask's proposals keep their help offers held), BUG-089 (`PUT /offers/:id` writes any status; an
    expired help offer can back a proposal), BUG-090 (`POST /requests/offers` has no request lock or `expires_at`
    check).
  - **BUG-087 has no runtime log proof in CI.** The Integration Tests job prints container logs only on failure
    (`.github/workflows/ci.yml:363-367`), so reputation's two "not scheduled" lines never appear on a green run. The
    proof today is the unit tests plus `sprint-136-test-stack-crons-gate`. An optional follow-up: a CI step that
    asserts the lines from `docker compose logs reputation-service`.
  - **#180's alert was withdrawn, not marked fixed** (HTTP 410). The advisory isn't withdrawn, and the lock is clean
    (`minimatch` 11.0.3). The cause is unverified, and no action is needed.
- **BUG-073** tabled (maintainer, 2026-10-26): community admin and platform admin become separate roles, as a future
  feature (`docs/IDEAS.md` 2026-10-26).
- **BUG-076** (pre-push TDD false pass), **BUG-080** (provider completion rate counts a status never written),
  **BUG-081** (trust-config readers return NUMERIC strings typed as `number`; latent), **BUG-082** (the per-query SQL
  log in five services floods the log; the reputation log loses the 02:00Z nightly by 03:30Z).
- **The mobile sprint** (maintainer, 2026-10-29; `docs/IDEAS.md`): BUG-041 `query-string@7` / `decode-uri-component`,
  stale mobile match statuses, the unused `cancelMatch`, no build pipeline. Do not ship the app before it.
- **PR C** (scheduled exemption re-check evidence): the exemption registry on master is empty, so it may have no work
  left.
- **PR D's D8** is blocked on the host persona: `DEMO_UNRELATED_EMAIL` in the host's `.env.demo.rotation` names a
  pre-reset account; the guide wants Marcus Lee (`docs/guides/demo-data.md:253`). Fixing it is a host write, and each
  rerun is its own authorization.
- **Per-community health-quality weight**: needs an ADR number from the maintainer and a quality-signal decision.
- **Sprint 135 recount note:** the 2 `matched` rows of 2026-10-29 are no longer `matched`; why was not traced (BUG-075).

## Quick Start (the next chat)

1. Confirm live state before trusting this file: `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`.
   Then `gh run list --workflow expo-sdk-drift.yml --limit 2`: the first scheduled run after the merge (2026-11-05
   07:15Z cron) should be green, and #316 should stay closed. If it fails, read its gate output before anything else.
2. **The next sprint's scope is the maintainer's call.** Plan it with the `sprint-planning` skill, from the
   *Open questions* and *Open, not scheduled* lists. Both open questions touch request-service, as BUG-088..090 do.
3. **Work on this branch** (`agent/claude/sprint-137-planning`) so the Sprint 136 archive and post-merge record ride in
   the next PR. If the next PR is cut elsewhere, cherry-pick this branch's post-merge commit onto it first.
4. Merges, ADR numbers, demo-host operations and dismissals each need explicit authorization.

**Next unchecked task**: the maintainer picks the Sprint 137 scope (and answers the two open questions).

## Standing rules

Every demo-host operation, merge, exemption renewal, CodeQL dismissal and ADR number needs explicit per-operation authorization.
Never push docs-only to master; fold docs into the next PR. Reconcile this handoff against `gh pr list` / `git log` after every
merge and at session end.
