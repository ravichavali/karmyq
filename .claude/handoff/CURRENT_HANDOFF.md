# Between sprints — after Sprint 138 — Handoff

**Date**: 2026-11-09
**Outcome so far**: **No sprint in flight.** Sprint 138 is complete: #331 merged as `74c5a8e5` (v11.111.0) and deployed
green (9/9 healthy, the offer-index migration applied, no rollback). Master has 0 open code-scanning and 0 open
Dependabot alerts. The next sprint's scope is the maintainer's call (*Open questions*).

> The handoff carries **state between sessions**. It is not a copy of the plan: it links the plan and names the next
> unchecked task. It is branch-local, so it can reserve nothing; see `CLAUDE.md` → *Parallel Development* for how
> contended resources are actually allocated. Git and PR state (`gh pr list`, `git log origin/master`) outrank anything
> written here. No parallel lanes are active.

**Previous**: Sprint 138 COMPLETE (merged `74c5a8e5`, v11.111.0; CI/CD `42679957353` green, deploy health 9/9; code
scanning 0 open). Archived:
[`archive/2026-11-06-sprint-138-reusable-standing-offers-COMPLETE-v11.111.0.md`](archive/2026-11-06-sprint-138-reusable-standing-offers-COMPLETE-v11.111.0.md)
(its top section is the #331 post-merge record).

---

## Quick Start

1. Confirm live state: `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`, `gh issue view 329`.
2. Reuse this branch for the next sprint's planning: `git switch agent/claude/sprint-139-planning`. It is cut from
   `origin/master` `74c5a8e5` and carries the Sprint 138 archive and this handoff. If master moved, merge it in with a
   merge commit, never a rebase.
3. When the maintainer picks the scope, plan it with the `sprint-planning` skill (spec + plan + handoff), and execute in
   the next chat.
4. Merges, ADR numbers, demo-host operations, dismissals and dependency work each need the maintainer's explicit
   authorization.

**Next unchecked task**: none scheduled — the maintainer chooses the next sprint (see *Open questions*).

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-139-planning`, cut from `origin/master` `74c5a8e5` on 2026-11-09. It carries the Sprint 138 archive and the #331 post-merge record. **No PR is open from it.** Those docs ride in the next PR, never a docs-only master push. |
| **Base** | `origin/master` at `74c5a8e5` (#331, v11.111.0). No open PRs on 2026-11-09. The next version is re-derived from `origin/master` at merge. |
| **Active editor** | Claude (the Sprint 138 review + merge chat, 2026-11-09). |
| **Shared resources** | **Dependency lane: Claude** (maintainer-designated). Dated: #178 only (below). No ADR number allocated. One optional demo-host read pending authorization (below). |
| **Merged branches safe to delete** (maintainer's call) | `agent/claude/sprint-138-planning` (head `96ce19d2`; same tree as `74c5a8e5`), `agent/claude/sprint-137-planning` (`49ebd68a`), `agent/claude/sprint-136-planning` (`170d39fe`), `agent/claude/sprint-135-pr-request-status-guards` (`7bfc65ac`), `agent/claude/sprint-135-planning` (`5a3589ef`), `agent/claude/sprint-134-pr-bug-077-badge-insert` (`afbaed7a`). Older `agent/claude/sprint-134-*` heads also remain on origin. |

## Open questions for the maintainer

1. **Next sprint's scope.** Candidates already on file (none is scheduled):
   - **BUG-097** (low, UX): `GET /offers` applies its expiry filter under every status filter; the possible fix scopes
     the expiry arms to `status = 'active'`. Small enough to bundle into another request-service PR.
   - **The mobile sprint** (`docs/IDEAS.md` 2026-10-29). Do not ship the app before it.
   - **Back out of an in-progress exchange from the UI** (`docs/IDEAS.md` 2026-10-29).
   - **The 2026-11-08 framing idea** (`docs/IDEAS.md`): evolve the platform toward a communication channel that grows
     with people's networks of trust. The maintainer asked for an adversarial discussion first, since it runs against
     the initial plan; that discussion would precede any spec.
   - Smaller open bugs: BUG-092, BUG-076, BUG-080, BUG-081, BUG-082 (*Open, not scheduled*).
2. **#329 — take the Expo patch train?** Still open and gates no PR. Dependency work needs a maintainer-recognised
   reason (an advisory or a feature need). The scheduled *Expo SDK drift* run keeps failing daily on master because
   the drift is open; that is not a deploy.
3. **Optional demo-host read:** the first hourly `markExpiredData` after the 2026-11-09 19:22Z deploy (20:00Z onward)
   logs `Released expired holds { asksReleased, proposalsClosed, strandedOffersFreed }`. Its `strandedOffersFreed` is
   Sprint 138's retroactive free of offers held by past completions (decision 3). Reading it is `docker logs` on the
   demo host, which needs per-operation authorization.

## Dated obligations

- **`deepmerge` #178** (dismissed `tolerable_risk`): re-check at the next Expo SDK move or by **2026-12-01**. #329 is an
  Expo patch move, not an SDK move.
- Nothing else is dated.

## Open, not scheduled

- **From Sprint 138's final review** (details in the archive's *Final-review findings parked*):
  - **BUG-097** (F1's follow-up; above).
  - **F2** (accepted consequence): the first deployed sweep frees history; freed offers past expiry are flagged and
    hard-deleted 7 days later, and their completed matches keep their rows with `offer_id = NULL`.
  - **F3** `GET /offers/:id` still answers `status: 'active'` for an expired offer.
  - **F4** two final marks committing concurrently on a legacy shared offer can both skip the release; the next hourly
    D2 frees it.
  - **F8** the release rule is four hand-kept SQL copies held together by a text-parity gate.
  - **F9** the "offer is unexpired" predicate is hand-written in the hold, the list and the releases.
- **From Sprint 137's `/simplify` (deferred):** a `holdOffer` beside `releaseOffer` (every offer-status write in one
  file); the two status gates' SET-clause parsers differ; shared integration-test helpers are copied across the Sprint
  134–138 integration files; product questions (an expired open ask stays editable and an edit restarts the hard
  delete's 7 days; pending provider offers on an expired ask stay pending).
- **BUG-092** (cleanup-service and simulation-service run their tdd tier in their blocking `test`).
- **From Sprint 136:** BUG-087 has no runtime log proof in CI; #180's alert was withdrawn (HTTP 410; no action).
- **BUG-073** tabled (community admin vs platform admin as separate roles; `docs/IDEAS.md` 2026-10-26).
- **BUG-076** (pre-push TDD false pass), **BUG-080** (provider completion rate counts a status never written),
  **BUG-081** (trust-config readers return NUMERIC strings typed as `number`; latent), **BUG-082** (the per-query SQL
  log in five services floods the log).
- **PR C** (scheduled exemption re-check evidence): the exemption registry on master is empty, so it may have no work
  left.
- **PR D's D8** is blocked on the host persona (`DEMO_UNRELATED_EMAIL`); fixing it is a host write.
- **Per-community health-quality weight**: needs an ADR number from the maintainer and a quality-signal decision.
- **Sprint 135 recount note:** the 2 `matched` rows of 2026-10-29 are no longer `matched`; why was not traced (BUG-075).

## Standing rules

See `CLAUDE.md` (global rules) and the Sprint 138 archive's *Standing rules*. In short: branch off `origin/master`;
never force-push or direct-push master; one merge at a time; no docs-only master push; ask before any demo-host
operation, merge, ADR number, dismissal or dependency work; stop after PR creation. **New from Sprint 138's merge:** a
`gh pr checks` list of passes can hide a run whose job GitHub never created, so check each run's conclusion and job
count before treating a head as green.
