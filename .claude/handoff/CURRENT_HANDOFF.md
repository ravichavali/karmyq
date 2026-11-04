# Sprint 137 — Exchange Integrity — Handoff

**Date**: 2026-11-04
**Outcome so far**: **Planned; not started.**
- Scope and decisions 1–3 were agreed with the maintainer on 2026-11-04.
- The spec, plan, BUG-088/090 corrections and the new BUG-091 entry are committed on this branch.
- No code has changed yet, and no PR is open.

> The handoff carries **state between sessions**. It is not a copy of the plan: it links the plan and names the next
> unchecked task. It is branch-local, so it can reserve nothing; see `CLAUDE.md` → *Parallel Development* for how
> contended resources are actually allocated. Git and PR state (`gh pr list`, `git log origin/master`) outrank anything
> written here. No parallel lanes are active.

**Sprint goal:** close the four gaps the request-status guards leave (BUG-088, 089, 090 and 091) in one PR:
- an expired ask releases what it held;
- an offer's status follows its exchanges;
- a provider offer is written under the request lock;
- a completed or cancelled ask can't be edited.

**Spec:** [`docs/superpowers/specs/2026-11-04-sprint-137-exchange-integrity-design.md`](../../docs/superpowers/specs/2026-11-04-sprint-137-exchange-integrity-design.md)
**Plan:** [`docs/superpowers/plans/2026-11-04-sprint-137-exchange-integrity.md`](../../docs/superpowers/plans/2026-11-04-sprint-137-exchange-integrity.md)

**Previous**: Sprint 136 COMPLETE (merged `f19ca413`, v11.109.0; deploy green 9/9; #180/#179 cleared; #316 closed).
Archived: [`archive/2026-11-04-sprint-136-mobile-deps-and-status-followups-COMPLETE-v11.109.0.md`](archive/2026-11-04-sprint-136-mobile-deps-and-status-followups-COMPLETE-v11.109.0.md)
(it holds the #328 post-merge record and the corrected 2026-11-04 fix-forward account).

---

## Quick Start

1. Read this handoff. Then confirm live state:
   - `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`.
   - `gh run list --workflow expo-sdk-drift.yml --limit 3`. The first **scheduled** run after #328 (2026-11-05 07:15Z)
     should be green, and #316 should stay closed. If it failed, read its gate output first.
   - Note: the only scheduled run since #328 merged, at 2026-11-04 15:25Z, ran on `b9682c34`, **before** the merge
     (17:54Z). It failed on exactly the `expo-notifications@57.0.23` pin #328 fixed. The post-merge manual run on
     `f19ca413` was green.
2. Reuse the existing task branch: `git switch agent/claude/sprint-137-planning`. It is already cut from
   `origin/master` `f19ca413`. If master moved, merge it in with a merge commit, never a rebase. Never branch off a
   stale local master; unpushed local-master commits leak in via the squash-merge.
3. Open the plan: `docs/superpowers/plans/2026-11-04-sprint-137-exchange-integrity.md`.
4. Invoke `superpowers:subagent-driven-development` directly (or `superpowers:executing-plans`). There is no
   `/execute-plan` slash command; superpowers removed it as a deprecated stub.
5. Merges, ADR numbers, demo-host operations and dismissals each need explicit authorization. Stop at PR creation.

**Next unchecked task**: Plan Task 1 (branch check, baselines, v11.110.0 bump).

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-137-planning`, cut from `origin/master` `f19ca413` on 2026-11-04. It carries the Sprint 136 archive, the #328 post-merge record, and the Sprint 137 spec, plan, handoff and BUGS entries. **No PR is open from it.** Execution continues here, and the one PR opens from it. |
| **Base** | `origin/master` at `f19ca413` (#328, v11.109.0). No open PRs on 2026-11-04. The version (provisional 11.110.0) is re-derived from `origin/master` at merge. |
| **Active editor** | Claude (the Sprint 137 planning chat, 2026-11-04). |
| **Shared resources** | **Dependency lane: Claude** (maintainer-designated); this sprint adds no dependency. Nothing dependency-dated except #178 (below). **No ADR number needed.** No demo-host operation pending. |
| **Merged branches safe to delete** (maintainer's call) | `agent/claude/sprint-136-planning` (head `170d39fe`; same tree as `f19ca413`), `agent/claude/sprint-135-pr-request-status-guards` (`7bfc65ac`), `agent/claude/sprint-135-planning` (`5a3589ef`), `agent/claude/sprint-134-pr-bug-077-badge-insert` (`afbaed7a`). |

## Decisions

**Maintainer (2026-11-04):**
1. **Scope: exchange integrity, one PR** from this branch: BUG-088, BUG-089, BUG-090, and a closed-ask edit guard
   (BUG-091).
2. **Retention clock: keep COALESCE, and lock closed asks.** `PUT /requests/:id` refuses a completed or cancelled ask.
   This closes BUG-091, a gap found while planning: the edit route has no `content_forgotten_at` check, and the
   retention job only selects `content_forgotten_at IS NULL` (`memoryRetentionJob.ts:99`). So an edit after forgetting
   writes content that is never forgotten. GREATEST is not adopted. *(Answers Sprint 136 open question 1.)*
3. **BUG-088: the expiration sweep closes an expired ask's proposals** and frees their help offers. *(Answers Sprint 136
   open question 2.)*

**Planner (2026-11-04), each open to the maintainer's veto before execution.** Spec → *Decisions* has the reasons.
4. The sweep runs in cleanup-service after `markExpiredData` flags asks, one transaction per ask (`expireDibs` pattern).
5. The same sweep frees **stranded holds**: offers left `matched` after the hard delete cascaded their proposals away
   (`matches_request_id_fkey ON DELETE CASCADE`). This changes demo data on the first deployed run. **Drop it (D2) if
   the maintainer prefers.**
6. No notification on an expiry close (`match_rejected` is unconsumed today).
7. BUG-089: a body `status` on `PUT /offers/:id` → `400 STATUS_NOT_EDITABLE`. The hold requires an unexpired offer, and a
   gate pins every help-offer status writer.
8. BUG-090: `POST /providers/offers` (BUG-090's entry wrongly said `/requests/offers`) re-checks and inserts under
   `lockRequestForCommitment` → `409 REQUEST_NOT_OPEN`.
9. No ADR, no migration, no new event or endpoint.

## Critical implementation notes (copied verbatim from the spec)

1. **Lock, then check, in separate statements** (A, C, D1, D2). A statement that waited on a row lock keeps its
   subqueries' snapshot from before the wait (`requestStatus.ts:38-44`). Take the lock in its own statement, and decide
   in the next one.
2. **Lock order.**
   - D1 is request → offers → matches, the same as accept's `closeProposals`.
   - D2 is the offer row only.
   - C is request-first and inserts one row.
   - A is the request lock only.

   Before writing D, re-read match cancel and complete. Confirm that each `UPDATE ... AND status = 'matched'` takes no
   lock on a proposed row, and that no `help_offers` writer holds an offer lock and then waits on the request lock
   (Sprint 136's test header lists them).
3. **Decide before the first write.** Each refusal returns before anything is written:
   - A refuses before its `UPDATE`;
   - C refuses at the lock and the duplicate check, before its insert;
   - the B2 hold's miss returns before the match insert.
4. **The scanner sees only `help_requests` literals** (`directedSurfaceScan.ts:30`). B4 adds a table parameter whose
   default keeps today's pattern. Prove that `sprint-132-directed-audience-gate` and `sprint-135-request-status-gate`
   find the same hits before and after.
5. **Re-pin directed-surface hashes with `surfaceHash`. Never hand-type one.** These need re-pinning:
   - D1's candidate `SELECT` and lock `SELECT`. These are new entries in
     `services/request-service/tests/helpers/directedSurfaceAllowlist.json`, with reason "Internal expiry mutation, no
     audience-facing output."
   - A's changed `UPDATE`.
   - Anything else the gate names with file:line.

   D2's statements do not name `help_requests` and need no entry.
6. **D writes no `help_requests` row.** No `updated_at` stamp, so the hard-delete clock (gotcha) and the request-status
   gate are untouched.
7. **The copied `closeProposals` SQL** keeps two properties: the offer is freed "only while `matched`" (a withdrawn
   offer stays withdrawn), and offers are updated first, so the subquery still sees the proposals. A comment in each
   copy names the other. The integration test's withdrawn-offer case proves the behaviour, not the text.
8. **SQL hygiene.**
   - Use literal statuses only.
   - `expired` is nullable, so write `IS TRUE` / `IS NOT TRUE` in request-service.
   - Check expiry with `clock_timestamp()` after a lock wait, never `NOW()`.
   - `expires_at` is `timestamp without time zone`. Compare it as Sprint 136 did (`requestStatus.ts:75`).
   - Test fixtures cast `$n::varchar`.
9. **Identity is `req.user!.userId`** (ADR-064). No route reads the JWT `communities` claim
   (`tests/regression/sprint-134-pr-k-claim-gate.test.ts`).
10. **Real-SQL tests live in root `tests/integration/`** and run in CI only (no local PostgreSQL on the Windows box).
    - Prove waits with `pg_blocking_pids`, never a sleep. A waiter counts when the holder blocks it directly, or blocks
      a pid that blocks it (Sprint 136 note 14).
    - Root integration tests already import cleanup-service source directly (`sprint-136-request-followups`), so D's
      cases call `markExpiredData()`.
11. **Tests first** in `services/request-service/tests/tdd/` and `services/cleanup-service/tests/tdd/`. Run them red,
    then implement. Promote with a targeted `git mv`, not the promoter, which sweeps every green tdd file repo-wide.
12. **`markExpiredData`'s unit test pins four calls** (`tests/unit/expirationJob.test.ts:19-33`). Update it to the new
    contract: the four flags, then the release. Do not weaken it.
13. **`npm test` regenerates landing docs.** Revert the timestamp and HEAD-sha churn before committing.
14. **No demo-host operation in this sprint.** The first deployed run changes demo data (D1's backlog, D2's stranded
    holds); say so in the PR body. A read-only count beforehand is optional and needs the maintainer's authorization.
15. **`feedback:check` reads `git diff --cached`.** Run it before committing; on a committed branch it is a false green.
16. **After the merge, read master's open code-scanning alerts and the merge-sha analysis.** B3 keeps `api.ts`'s line
    count, but diffs don't predict re-raises. Surface a re-raise to the maintainer; never loop the dismissal API.

**Plan-only rule (Tasks 4–8):** each `src/` change re-pins its own directed-surface hashes and updates the unit and
regression tests it breaks **in the same commit**. Only the new `tests/tdd/` files may be red between tasks, because
pre-push blocks on the other tiers.

## Dated obligations

- **`deepmerge` #178** (dismissed `tolerable_risk`): re-check at the next Expo SDK move or by **2026-12-01**.
- Nothing else is dated.

## Open, not scheduled

- **From Sprint 136:**
  - **BUG-087 has no runtime log proof in CI.** The Integration Tests job prints container logs only on failure
    (`.github/workflows/ci.yml:363-367`), so reputation's two "not scheduled" lines never appear on a green run. The
    proof today is the unit tests plus `sprint-136-test-stack-crons-gate`. An optional follow-up: a CI step that
    asserts the lines from `docker compose logs reputation-service`.
  - **#180's alert was withdrawn, not marked fixed** (HTTP 410). The advisory isn't withdrawn, and the lock is clean
    (`minimatch` 11.0.3). The cause is unverified, and no action is needed.
- **Noted while planning Sprint 137 (not logged as bugs; product questions):**
  - an expired open ask stays editable, and an edit restarts the hard delete's 7 days;
  - an offer that backed a completed exchange stays `matched` (one-shot);
  - pending provider offers on an expired ask stay pending.

  Spec → *Out of scope*.
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

Every demo-host operation, merge, exemption renewal, CodeQL dismissal and ADR number needs explicit per-operation
authorization. Never push docs-only to master; fold docs into the next PR. Reconcile this handoff against `gh pr list` /
`git log` after every merge and at session end.
