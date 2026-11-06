# Between sprints — after Sprint 137 — Handoff

**Date**: 2026-11-05
**Outcome so far**: **No sprint in flight.** Sprint 137 is complete: #330 merged as `17e453f8` (v11.110.0) and deployed
green (9/9 healthy, no rollback). Master has 0 open code-scanning alerts. The next sprint's scope is the maintainer's
call. Three questions wait on the maintainer (*Open questions*).

> The handoff carries **state between sessions**. It is not a copy of the plan: it links the plan and names the next
> unchecked task. It is branch-local, so it can reserve nothing; see `CLAUDE.md` → *Parallel Development* for how
> contended resources are actually allocated. Git and PR state (`gh pr list`, `git log origin/master`) outrank anything
> written here. No parallel lanes are active.

**Previous**: Sprint 137 COMPLETE (merged `17e453f8`, v11.110.0; CI/CD `42137735346` green, deploy health 9/9;
code scanning 0 open). Archived:
[`archive/2026-11-05-sprint-137-exchange-integrity-COMPLETE-v11.110.0.md`](archive/2026-11-05-sprint-137-exchange-integrity-COMPLETE-v11.110.0.md)
(its top section is the #330 post-merge record).

---

## Quick Start

1. Confirm live state: `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`, `gh issue view 329`.
2. Reuse this branch for the next sprint's planning: `git switch agent/claude/sprint-138-planning`. It is cut from
   `origin/master` `17e453f8` and carries the Sprint 137 archive and this handoff. If master moved, merge it in with a
   merge commit, never a rebase.
3. When the maintainer picks the scope, plan it with the `sprint-planning` skill (spec + plan + handoff), and execute in
   the next chat.
4. Merges, ADR numbers, demo-host operations, dismissals and dependency work each need the maintainer's explicit
   authorization.

**Next unchecked task**: none scheduled — the maintainer chooses the next sprint (see *Open questions*).

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-138-planning`, cut from `origin/master` `17e453f8` on 2026-11-05. It carries the Sprint 137 archive and the #330 post-merge record. **No PR is open from it.** Those docs ride in the next PR, never a docs-only master push. |
| **Base** | `origin/master` at `17e453f8` (#330, v11.110.0). No open PRs on 2026-11-05. The next version is re-derived from `origin/master` at merge. |
| **Active editor** | Claude (the Sprint 137 post-merge chat, 2026-11-05). |
| **Shared resources** | **Dependency lane: Claude** (maintainer-designated). Dated: #178 only (below). No ADR number allocated. One optional demo-host read pending authorization (below). |
| **Merged branches safe to delete** (maintainer's call) | `agent/claude/sprint-137-planning` (head `49ebd68a`; same tree as `17e453f8`), `agent/claude/sprint-136-planning` (`170d39fe`), `agent/claude/sprint-135-pr-request-status-guards` (`7bfc65ac`), `agent/claude/sprint-135-planning` (`5a3589ef`), `agent/claude/sprint-134-pr-bug-077-badge-insert` (`afbaed7a`). Older `agent/claude/sprint-134-*` heads also remain on origin. |

## Open questions for the maintainer

1. **BUG-093 — are standing offers one-shot by design?** An offer that backed a completed exchange stays `matched`
   forever: every release path counts a completed match as a hold. Sprint 137's B1 (the BUG-089 fix) removed the
   body-status edit that used to reactivate it, so the recovery today is to withdraw it and post a new offer.
   Reopening body-status edits would reopen BUG-089. Product decision: reusable after completion, or one-shot?
2. **#329 — take the Expo patch train?** The scheduled drift run of 2026-11-05 filed it: eight `apps/mobile` packages
   moved one patch (`expo` ~57.0.32, `expo-notifications` ~57.0.25, …), and the `jest`/`@types/jest` divergence
   registrations cleared. It gates no PR. Dependency work needs a maintainer-recognised reason (an advisory or a
   feature need).
3. **Optional demo-host read:** the first hourly `markExpiredData` after the 2026-11-06 00:51Z deploy logs
   `Released expired holds { asksReleased, proposalsClosed, strandedOffersFreed }` and changes demo data (D1's backlog,
   D2's stranded holds). Reading it is `docker logs` on the demo host, which needs per-operation authorization.

## Dated obligations

- **`deepmerge` #178** (dismissed `tolerable_risk`): re-check at the next Expo SDK move or by **2026-12-01**. #329 is an
  Expo patch move, not an SDK move.
- Nothing else is dated.

## Open, not scheduled

- **From Sprint 137:**
  - **BUG-094** (an offer freed after its `expires_at` reads `expired = FALSE` for up to an hour; the hold path still
    refuses it) and **BUG-095** (`requests.matches.offer_id` is unindexed; release guards and the hourly D2 sweep scan
    `matches`; needs a migration).
  - Offer-state altitude (deferred from `/simplify`): the hold UPDATE sits inline in `matches.ts` `POST /matches` while
    releases live in `requestStatus.ts`. A `holdOffer` beside `releaseOffer` would put every offer-status write in one
    file and could collapse the offer-status gate to "no `help_offers` status write outside `requestStatus.ts`".
  - The two status gates' SET-clause parsers differ (Sprint 137's bounds each `UPDATE` at the next one and splits on
    `;`; Sprint 135's does not), so they were not merged into one helper.
  - Shared integration-test helpers (`bearer`, the `pg_blocking_pids` waiters) are copied across the Sprint 134–137
    integration files; extracting them needs a CI run to prove.
  - Product questions noted while planning (spec *Out of scope*): an expired open ask stays editable, and an edit
    restarts the hard delete's 7 days; pending provider offers on an expired ask stay pending.
- **BUG-092** (cleanup-service and simulation-service run their tdd tier in their blocking `test`).
- **From Sprint 136:**
  - **BUG-087 has no runtime log proof in CI.** The Integration Tests job prints container logs only on failure
    (`.github/workflows/ci.yml:363-367`), so reputation's two "not scheduled" lines never appear on a green run. An
    optional follow-up: a CI step that asserts the lines from `docker compose logs reputation-service`.
  - **#180's alert was withdrawn, not marked fixed** (HTTP 410). The lock is clean (`minimatch` 11.0.3); no action.
- **BUG-073** tabled (maintainer, 2026-10-26): community admin and platform admin become separate roles, as a future
  feature (`docs/IDEAS.md` 2026-10-26).
- **BUG-076** (pre-push TDD false pass), **BUG-080** (provider completion rate counts a status never written),
  **BUG-081** (trust-config readers return NUMERIC strings typed as `number`; latent), **BUG-082** (the per-query SQL
  log in five services floods the log; the reputation log loses the 02:00Z nightly by 03:30Z).
- **The mobile sprint** (maintainer, 2026-10-29; `docs/IDEAS.md`): BUG-041 `query-string@7` / `decode-uri-component`,
  stale mobile match statuses, the unused `cancelMatch`, no build pipeline. Do not ship the app before it.
- **Back out of an in-progress exchange from the UI** (`docs/IDEAS.md` 2026-10-29), which would also route
  `match_rejected` / `match_cancelled` to notifications.
- **PR C** (scheduled exemption re-check evidence): the exemption registry on master is empty, so it may have no work
  left.
- **PR D's D8** is blocked on the host persona: `DEMO_UNRELATED_EMAIL` in the host's `.env.demo.rotation` names a
  pre-reset account; the guide wants Marcus Lee (`docs/guides/demo-data.md:253`). Fixing it is a host write, and each
  rerun is its own authorization.
- **Per-community health-quality weight**: needs an ADR number from the maintainer and a quality-signal decision.
- **Sprint 135 recount note:** the 2 `matched` rows of 2026-10-29 are no longer `matched`; why was not traced (BUG-075).

## Standing rules

See `CLAUDE.md` (global rules) and the Sprint 137 archive's *Standing rules* for the rules that carried through the
last sprint. In short: branch off `origin/master`; never force-push or direct-push master; one merge at a time; no
docs-only master push; ask before any demo-host operation, merge, ADR number, dismissal or dependency work; stop after
PR creation.
