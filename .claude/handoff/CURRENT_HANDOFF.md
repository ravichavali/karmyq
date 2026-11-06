# Sprint 138 — Reusable Standing Offers — Handoff

**Date**: 2026-11-06
**Outcome so far**: **PLANNED; ready to execute.** The maintainer agreed scope and decisions on 2026-11-06. Spec and plan
are committed on this branch. No PR is open. Next: plan Task 1 in a fresh chat.

> The handoff carries **state between sessions**. It is not a copy of the plan: it links the plan and names the next
> unchecked task. It is branch-local, so it can reserve nothing; see `CLAUDE.md` → *Parallel Development* for how
> contended resources are actually allocated. Git and PR state (`gh pr list`, `git log origin/master`) outrank anything
> written here. No parallel lanes are active.

**Sprint goal:** a standing help offer is reusable: completing an exchange frees its offer, offers stuck behind past
completions are freed by the next sweep, a freed offer past its expiry is flagged at once, expired offers leave the
`/offers` list, and offer releases are indexed (BUG-093, 094, 095, 096; one PR; v11.110.0 → v11.111.0 provisional).

**Spec:** [`docs/superpowers/specs/2026-11-06-sprint-138-reusable-standing-offers-design.md`](../../docs/superpowers/specs/2026-11-06-sprint-138-reusable-standing-offers-design.md)
**Plan:** [`docs/superpowers/plans/2026-11-06-sprint-138-reusable-standing-offers.md`](../../docs/superpowers/plans/2026-11-06-sprint-138-reusable-standing-offers.md)

**Previous**: Sprint 137 COMPLETE (merged `17e453f8`, v11.110.0; CI/CD `42137735346` green, deploy health 9/9; code
scanning 0 open). Archived:
[`archive/2026-11-05-sprint-137-exchange-integrity-COMPLETE-v11.110.0.md`](archive/2026-11-05-sprint-137-exchange-integrity-COMPLETE-v11.110.0.md)
(its top section is the #330 post-merge record).

---

## Quick Start

1. Read this handoff. Then confirm live state: `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`.
2. Reuse the existing task branch: `git switch agent/claude/sprint-138-planning`. It is cut from `origin/master`
   `17e453f8`. If master moved, merge it in with a merge commit, never a rebase. Never branch off a stale local master;
   unpushed local-master commits leak in via the squash-merge.
3. Open the plan: `docs/superpowers/plans/2026-11-06-sprint-138-reusable-standing-offers.md`.
4. Invoke `superpowers:subagent-driven-development` directly (or `superpowers:executing-plans`). There is no
   `/execute-plan` slash command; superpowers removed it as a deprecated stub.
5. Merges, ADR numbers, demo-host operations, dismissals and dependency work each need explicit authorization. **Plan
   Task 6 needs a PostgreSQL 15 container** for `init.sql` regeneration: run it on the Mac checkout, or ask the
   maintainer to authorize a disposable container on the demo host. Stop at PR creation.

**Next unchecked task**: Plan Task 1 (branch check, baselines, provisional version 11.111.0).

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-138-planning`, cut from `origin/master` `17e453f8` on 2026-11-05. It carries the Sprint 137 archive and #330 post-merge record, the Sprint 138 spec, plan and handoff, and the BUG-094 correction + BUG-096 entry. **No PR is open from it.** Execution continues here, and the one PR opens from it. |
| **Base** | `origin/master` at `17e453f8` (#330, v11.110.0). No open PRs on 2026-11-06. The version (provisional 11.111.0) is re-derived from `origin/master` at merge. |
| **Active editor** | Claude (the Sprint 138 planning chat, 2026-11-06). A Codex session also did read-only scoping on 2026-11-06 and wrote nothing. |
| **Shared resources** | **Dependency lane: Claude** (maintainer-designated); this sprint adds no dependency. Dated: #178 only. **No ADR number needed.** One demo-host operation may be requested at execution (Task 6's disposable container, if not run on the Mac). |
| **Merged branches safe to delete** (maintainer's call) | `agent/claude/sprint-137-planning` (head `49ebd68a`; same tree as `17e453f8`), `agent/claude/sprint-136-planning` (`170d39fe`), `agent/claude/sprint-135-pr-request-status-guards` (`7bfc65ac`), `agent/claude/sprint-135-planning` (`5a3589ef`), `agent/claude/sprint-134-pr-bug-077-badge-insert` (`afbaed7a`). Older `agent/claude/sprint-134-*` heads also remain on origin. |

## Decisions

**Maintainer (2026-11-06):**
1. **Scope:** BUG-093 + BUG-094 + BUG-095, in request-service and cleanup-service, in one PR.
2. **BUG-093: standing offers are reusable after a completed exchange** (not one-shot).
3. **History is freed retroactively** by the first sweep after deploy; no dated exception.
4. **Every offer is reusable**; no per-offer choice, no schema or UI change for it.
5. **BUG-094 is fixed in every release statement**, not by reordering the sweep.
6. **BUG-096 joins the sprint:** `GET /offers` hides expired offers. (Planning found the list filters on status only.
   I had first told the maintainer that freed offers past their expiry "stay off live surfaces"; that was wrong, and
   the maintainer chose this fix after the correction.)
7. **#329 stays open:** no advisory or feature need.
8. **Demo-host read (one, authorized) — done:** cleanup-service's first sweep after the Sprint 137 deploy, 01:00Z on
   2026-11-06, logged `Released expired holds { asksReleased: 0, proposalsClosed: 0, strandedOffersFreed: 0 }`, and
   every hourly run through 06:00Z was the same, with no `Failed to release` line. (Two `docker logs` reads: the
   logger prints the counts on the lines after the message, which the first grep dropped.)

**Planner (each open to the maintainer's veto; the maintainer approved the goal built on them):** completion calls the
existing `releaseOffer` (match → request → offer, as cancel); the hold set becomes `('proposed', 'matched')` in all four
release statements and the parity gate; every release flags expiry with `clock_timestamp()`; BUG-095 is a plain
`CREATE INDEX IF NOT EXISTS` partial index (`scripts/apply-migrations.sh:86-90` runs each file in a transaction); no ADR;
the guides say a completed exchange frees the offer. Spec → *Decisions*.

## Critical implementation notes (copied verbatim from the spec)

1. **One release rule, four copies, one commit.** `releaseOffer`, `closeProposals` (request-service
   `src/db/requestStatus.ts`), D1 and D2 (cleanup-service `src/jobs/expirationJob.ts`) change together, in the same
   commit as `tests/regression/sprint-137-release-sql-parity.test.ts`. The parity gate fails on any commit where they
   differ. D1 stays text for text `closeProposals`; D2 stays `releaseOffer` minus `o.id = $1 AND`.
2. **Keep every Sprint 137 guard.** Each release stays one guarded statement: `o.status = 'matched'`, the `NOT EXISTS`
   hold set, the same-request exclusion in `closeProposals`/D1, and the distinct scalar CTID version predicate (I1).
   Never add `FOR UPDATE` or persist a CTID.
3. **Completion lock order is match → request → offer**, the same as cancel (`matches.ts` cancel, ~:700-760, and the
   lock-order note in `expirationJob.ts`'s doc comment). Call `releaseOffer` after `reconcileRequestStatus`, inside the
   transaction, only when the exchange just finished. Re-read cancel and confirm no `help_offers` writer holds an offer
   lock and then waits on the request lock.
4. **Decide before the first write** stays true: completion's refusals (404, 409 `MATCH_NOT_COMPLETABLE`, the
   idempotent answer) return before any release.
5. **The expiry expression** is `o.expired IS TRUE OR (o.expires_at IS NOT NULL AND o.expires_at <= clock_timestamp())`
   in the releases (after lock waits), and `o.expired IS NOT TRUE AND (o.expires_at IS NULL OR o.expires_at > NOW())`
   in the `GET /offers` read. `expired` is nullable: `IS TRUE`/`IS NOT TRUE`.
6. **No new status writer.** The offer-status gate (`sprint-137-offer-status-gate.test.ts`) keeps its writer labels; only
   `releaseOffer`'s `why` text changes. Prove the gate still passes, and that it fails on an injected extra writer.
7. **Exact-contract fallout lands with its source.** Tests that pin the hold-set literal or the SET clause (the list in
   *Tests*) change in the same commit as the statements. Grep `'proposed', 'matched', 'completed'` and
   `SET status = 'active', updated_at` across `services/*/src`, `services/*/tests` and `tests/` before and after.
8. **The directed-surface allowlist is unaffected** (no `help_requests` literal changes); `sprint-132-directed-audience-gate`
   and `sprint-135-request-status-gate` must stay green with no hash change.
9. **Migration:** `IF NOT EXISTS`, partial, plain `CREATE INDEX` (decision P4). Review it with the
   `migration-validator` agent. Regenerate `init.sql` with `REGEN_PG_CONTAINER` (Mac checkout, or an authorized
   disposable demo-host container); never hand-edit it. The drift gate asserts the index.
10. **Real-SQL proofs are CI-only** (no PostgreSQL on the Windows box). Prove waits with `pg_blocking_pids`, never a
    sleep. Use fresh `randomUUID()` ids and `$n::varchar` status casts. Sprint 137's integration `completed` variants
    flip to the new rule in this sprint, with the reason in a comment.
11. **Tests first.** Request-service red tests go in `services/request-service/tests/tdd/` and may be committed red
    (its `test` is unit + regression). Cleanup-service's `test` runs its tdd tier (BUG-092), so its changes are edits
    to the existing regression test, committed with the implementation. Promote with a targeted `git mv`, never the
    promoter.
12. **`npm test` regenerates landing docs**; revert timestamp/HEAD-sha churn. **`feedback:check` reads
    `git diff --cached`**: run it staged.
13. **Identity is `req.user!.userId`** (ADR-064); no route reads the JWT `communities` claim.
14. **The first deployed sweep changes demo data** (decision 3). Say so in the PR body. A read-only count beforehand,
    and reading the first `Released expired holds` line afterwards, are demo-host reads: each needs authorization.

## Dated obligations

- **`deepmerge` #178** (dismissed `tolerable_risk`): re-check at the next Expo SDK move or by **2026-12-01**. #329 is an
  Expo patch move, not an SDK move.
- Nothing else is dated.

## Open, not scheduled

- **#329 Expo SDK drift** (opened 2026-11-05): eight `apps/mobile` packages moved one patch (`expo` ~57.0.32,
  `expo-notifications` ~57.0.25, …); the `jest`/`@types/jest` divergence registrations cleared. Gates no PR. Left open
  by the maintainer (2026-11-06): no advisory or feature need.
- **From Sprint 137's `/simplify` (deferred):**
  - Offer-state altitude: the hold UPDATE sits inline in `matches.ts` `POST /matches` while releases live in
    `requestStatus.ts`. A `holdOffer` beside `releaseOffer` would put every offer-status write in one file.
  - The two status gates' SET-clause parsers differ (Sprint 137's bounds each `UPDATE` at the next one and splits on
    `;`; Sprint 135's does not), so they were not merged into one helper.
  - Shared integration-test helpers (`bearer`, the `pg_blocking_pids` waiters) are copied across the Sprint 134–137
    integration files.
  - Product questions (Sprint 137 spec *Out of scope*): an expired open ask stays editable, and an edit restarts the
    hard delete's 7 days; pending provider offers on an expired ask stay pending.
- **BUG-092** (cleanup-service and simulation-service run their tdd tier in their blocking `test`).
- **From Sprint 136:** BUG-087 has no runtime log proof in CI (`.github/workflows/ci.yml:363-367` prints container logs
  only on failure); #180's alert was withdrawn, not marked fixed (HTTP 410; the lock is clean; no action).
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

See `CLAUDE.md` (global rules) and the Sprint 137 archive's *Standing rules*. In short: branch off `origin/master`;
never force-push or direct-push master; one merge at a time; no docs-only master push; ask before any demo-host
operation, merge, ADR number, dismissal or dependency work; stop after PR creation.
