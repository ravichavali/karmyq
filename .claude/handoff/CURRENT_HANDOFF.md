# Sprint 145 — Admission integrity — Handoff

**Date**: 2026-11-24 (Codex re-review clean); opened 2026-11-23
**Outcome**: **Implementation complete and cross-agent reviewed clean; PR [#342](https://github.com/ravichavali/karmyq/pull/342)
is open and awaits the maintainer's release decision.** Claude executed the Codex-authored, maintainer-approved
plan inline (`superpowers:executing-plans`) after a cross-agent plan review. BUG-106 and BUG-108 are fixed in
this branch, pending merge and deploy.

**Review and CI evidence (observed 2026-11-24):**
- **Codex's re-review of `e9be2a26`: no new findings.** Both P2 races from its review of `222d6dc4` are resolved:
  the duplicate-create lost race re-reads the community before classifying the winner (`communities.ts:124`;
  ruling 13 matches the spec), and acceptance refuses an inviter row its share lock missed
  (`invitationAcceptance.ts:129`; lock order and rollback intact). Codex judged that all three new DB cases
  discriminate the old code by source and barrier inspection. **It did not rerun the old implementation against
  PostgreSQL**, and neither did the author.
- **CI run [45444724146](https://github.com/ravichavali/karmyq/actions/runs/45444724146) on `e9be2a26`:** every
  check passed, including Integration Tests (Sprint 145 file 78/78, suite 727/727, Jest exited), the Code Scanning
  Gate and CodeQL. Deploy to Demo was skipped (PR branch). Detail: the PR's `## Validation` ledger.
- **Commits after `e9be2a26`:** only the handoff commit that records this review (docs-only). Its CI is a fresh
  run; check it on the head that merges.
- CodeQL #654–656 were dismissed by the maintainer as "used in tests" (2026-11-24, 16:33Z).

**Next: the maintainer decides on merge, version and deploy.** None of them is authorized yet. A release chat
starts with the `deploy` skill once the maintainer says yes.

**Review history.** Codex's first review raised the two P2 races above (fixed test-first in `a7235275`: 6
regression cases, red first, plus 3 DB cases). Before that, **PR #342's first CI run** ([45340891388](https://github.com/ravichavali/karmyq/actions/runs/45340891388), head
`7c183014`) failed two jobs:
- **Integration Tests:** 66 of the 73 new DB cases passed, 7 failed, then Jest never exited and the job hit the
  six-hour limit. One harness defect caused all of it: `holdAndRace` called `.finally` on a bare supertest
  request, which throws before sending and leaves its server listening. No product failure was observed.
- **Code Scanning Gate:** three `js/missing-rate-limiting` alerts (#654–656) on the test file's in-process
  `app.use` lines 130–132. This is the rule the maintainer dismissed as "used in tests" on the Sprint 142–144
  files. Dismissal is the maintainer's call; nothing in code changes them.

`c3860cf6` fixes the harness and closes the race gaps. **Its CI** ([45426404877](https://github.com/ravichavali/karmyq/actions/runs/45426404877),
head `59ab057b`) **passed Integration Tests: all 75 Sprint 145 cases, suite 724/724, and Jest exited.** At that
head, every other job passed except the Code Scanning Gate and the CodeQL check, which failed on #654–656 alone
(since dismissed). Version, merge, deploy and demo-data access remain unauthorized.

## Ownership, approval and base

| Field | Value |
|---|---|
| Branch | `agent/claude/sprint-145-planning`, based on `origin/master` `71773476` (re-fetched 2026-11-23; unchanged) |
| Active editor | Claude (executor since 2026-11-23). The review is complete; the next actor is the maintainer (release decision). One editor at a time in the shared Windows checkout |
| Owned paths | Sprint 145 implementation, tests, docs and this handoff. The plan and spec stay Codex-authored; review findings are recorded here, not edited into them |
| Spec | [Approved design](../../docs/superpowers/specs/2026-11-23-sprint-145-admission-integrity-design.md) |
| Plan | [Implementation plan](../../docs/superpowers/plans/2026-11-23-sprint-145-admission-integrity.md), tagged `no-deploy` |
| PR | [#342](https://github.com/ravichavali/karmyq/pull/342), opened 2026-11-23 from tested head `42d587da`; first CI on `7c183014` (handoff-only). Fix-forward `c3860cf6` (test + `ci.yml` only) and handoff `59ab057b`, CI-verified, then handoff `222d6dc4` (Codex reviewed it). Review fixes `a7235275` + registry `8932e9c5` + handoff `e9be2a26` (Codex re-reviewed it clean; CI green), plus this handoff-only commit recording that review |
| Release | Master v11.117.0; Sprint 145 version unallocated |

**Maintainer approval (2026-11-23)**: "Approve D1–D3 and the revised design".
D1 = active invitee no-write 200; D2 = invitation promotes pending, accepting the stale staff-notification cost;
D3 = any live active private member can admit someone without admin approval, subject to capacity/blocked checks.
Version, merge, deploy, demo-data operations and remote test infrastructure remain unauthorized.

## Quick Start (release decision)

1. Read [CLAUDE.md](../../CLAUDE.md) and this handoff.
2. `git fetch origin && git log --oneline origin/master -2`; `gh pr list`; `git status --short`. Confirm master is
   still `71773476` and PR #342 is open.
3. Check CI **on the current head** (`gh pr view 342 --json headRefOid,statusCheckRollup`). The reviewed head is
   `e9be2a26`; later commits must be handoff-only and green, including the root integration job (78 Sprint 145
   cases) and the Code Scanning Gate.
4. **Stop for the maintainer.** Merge, the version bump (re-derived from `origin/master` at merge time) and deploy
   each need an explicit yes. Only with that yes, continue with the `deploy` skill: one master merge at a time,
   then CI/CD deploy and health, then the post-merge record, which rides with the next PR.
5. If anything has changed since `e9be2a26` beyond handoff commits, it needs a fresh cross-agent review first.

**Goal**: BUG-106 invitation acceptance enforces capacity/live membership atomically; BUG-108 duplicate-create
respects membership lifecycle and reports truthful outcomes. BUG-107/109 remain out of implementation scope.

## Task status and evidence

| Task | State | SHA/evidence |
|---|---|---|
| Design D1–D3 | Approved | Explicit maintainer message, 2026-11-23 |
| Implementation plan | Cross-agent reviewed (Claude) — executable | Reviewed `a24e854a`. Citations re-read; staff/governance lock order confirmed ascending user_id (`members.ts:30-34`, `governanceDb.ts:239`), so there is no deadlock cycle with acceptance locks. No local psql/postgres/Docker, so DB proof is CI-owed |
| Step 5b self-audit | Complete | `92e398ff`: 0 findings |
| Task 1 red tests | `fafc13ce` | 57 red / 5 green (behavioral); module red = missing module; integration compiled, unrun (ECONNREFUSED) |
| Task 2 live role + acceptance module | `f48a0bb3` | 21/21 green; S134 live-role regression 11/11; tsc 0 |
| Task 3 accept route wiring | `7b578444` | 78/78; social-graph unit+regression 27 suites/196; root claim gate 17/17; tsc 0. Fixed a test bug (the 401 undefined caller used a default parameter); re-verified red on the old handler |
| Task 4 red duplicate-create + DB races | `5455d3aa` | 19 red / 9 green (behavioral); integration 73 cases, compiled, unrun |
| Task 5 duplicate-create implementation | `865065ba` | focused 66/66; community-service unit+regression 33 suites/534; tsc 0. Fixture corrections in S144 capacity + S77 idempotent-create (assertions kept, one no-write assertion added) |
| Task 6 frontend contract tests | `2832a09f` | 1 red (D1) / 10 green baselines |
| Task 7 defensive D1 branch | `b0007785` | 28/28; tsc 0 |
| Task 8 guides/concept/ADR-062 + landing | `54a40c7f` | drift gate 41/41; generator churn restored |
| Task 9 contexts/registry/BUGS + promotion | `0a3cb4dc` | 5 files `git mv`'d to regression, verified directly (78 / 42 / 28, `--no-cache`); drift 41/41; `analyze:services` no diff |
| Task 10 SDLC gates | Done at `bdc852a7` | `/simplify` (4 Sonnet reviewers): 2 cleanups applied in `bdc852a7`, rest skipped with reasons. `/security-review`: 0 findings. `/code-review` high: 5 "important" + 3 nits, all re-graded (spec-mandated or false premise; nits deferred) with no code change. Process review: PASS on coverage, docs, bundled commits and gate rulings; its handoff-staleness blocker is fixed by this revision; advisory A1 applied (ADR-106 points at the Sprint 145 fix), A2 N/A (AGENTS.md only bridges into CLAUDE.md) |
| Task 11 final verification + PR | Done: `42d587da`, PR #342 | `tsc --noEmit` ×3 exit 0 at `bdc852a7`. `bash scripts/pre-commit-check.sh` on tree `123e340a`: run 1 had `npm test` pass but failed the integrity check on landing generator churn (restored from snapshot); run 2 exit 0, tree unchanged. Pre-push at `42d587da`: unit + regression 27/27 Turbo tasks (26 cached; root `tests` ran fresh), report-only TDD tier exit 1 (existing WIP), integration skipped (no DB) |
| PR #342 CI fix-forward | `c3860cf6` | First CI (run 45340891388): integration 66/73, 7 failed with `fire(...).finally is not a function`, then the six-hour hang. Reproduced without a DB (old form: TypeError, one server left listening, process kept alive; new form: 200, zero servers, clean exit). Fixed: thenable adoption, a typed `BarrierError`, `raceInOrder`, a forced-order pending race (2 → 4 cases), full winner/loser/invitation assertions on the last-slot races, and `timeout-minutes: 20` on the CI step. Local: compiles, 75 cases, all `ECONNREFUSED`, Jest exits in 11 s; tests `tsc`: 0 errors in the file; CI-workflow gate 8/8; `pre-commit-check.sh` exit 0 on tree `3a19c6af`. **CI run 45426404877 at `59ab057b`: Integration Tests passed, Sprint 145 file 75/75 (suite 724/724); the gate fails only on #654–656** |
| Codex review fixes (two P2 races) | `a7235275`, registry `8932e9c5` | Both confirmed in source (`communities.ts:119-123`; the ignored `FOR SHARE` result in `invitationAcceptance.ts`). Red first on unchanged product code: community duplicate-create +4 (failed 409, 409, `joined: true`, 200); social-graph acceptance +2 via the fake's new `afterInviterLock` hook (resolved as admitted). Green: social-graph focused 80/80, unit+regression 30 suites / 276; community focused 48/48, unit+regression 34 suites / 566; `tsc` 0 / 0; claim + count-delta gates 41/41; drift 41/41. +3 DB cases (file 78), compiled, unrun locally. `pre-commit-check.sh` on tree `1981a6f5`: run 1 `npm test` passed, then the integrity check failed on landing churn (restored); run 2 exit 0. Docs: both CONTEXTs, ADR-062 amendment, BUG-106/108, registry, regenerated landing pages. **CI run 45444724146 at `e9be2a26`: all checks green; Sprint 145 file 78/78, suite 727/727** |
| Codex re-review | Clean at `e9be2a26` (2026-11-24) | No new findings; both P2 races resolved; ruling 13 matches the spec. Codex judged the three new DB cases discriminating by source and barrier inspection; the old code was not rerun against PostgreSQL. Branch unchanged by the reviewer |

## Rulings (deviations from the plan, all recorded in the git-ignored ledger too)

1. The same-inviter barrier counts waiters on `INSERT INTO communities.members` only, plus a `FOR UPDATE NOWAIT`
   probe proving the inviter row is share-locked. S144's `'%communities.members%'` filter also matches the inviter
   `FOR SHARE` select and would pass with an exclusive lock (false green).
2. Self-acceptance is refused in code before the D1 branch, with the CHECK as a backstop.
3. The stats-trigger rollback proof intercepts only the `UPDATE auth.users` statement on the real client; every
   other statement and the ROLLBACK run on the real DB.
4. Classifier parity is one shared state table driving both endpoints in the root integration file.
5. A non-test helper `services/social-graph-service/tests/helpers/fakeInvitationDb.ts` serves both social-graph
   unit tiers and is never promoted.
6. The S77 idempotent-create regression mock gained one answer for the new in-transaction state read (not in the
   plan's file map; spec allows necessary fixture corrections).
7. `/code-review` ran before the process review, because the process reviewer verifies code-review resolution.
8. `/code-review` re-grades: NULL `max_members` = full is already shared by every admission path (JS `n > null`);
   active invitee with a non-live inviter gets 403 (spec: live-inviter check precedes D1); an active member of a
   now-private/inactive public match gets the pointer / `COMMUNITY_INACTIVE` (spec); stored `invited` fails closed
   (approved table; no writer exists); refused acceptance → discovery without a reason (spec frontend section).
9. (CI fix-forward) The pending-applicant race now forces both arrival orders, because both contenders take
   `FOR UPDATE` on the applicant row and queue first-come-first-served. The last-slot capacity races cannot be ordered:
   an INSERT's foreign-key `FOR KEY SHARE` waiters on the community row wake together. They keep asserting the
   winner they observe, now with the full outcome on both sides. Cost if wrong: a branch of those races runs
   only when CI happens to pick it.
10. (CI fix-forward) `ci.yml` gains `timeout-minutes: 20` on "Run integration tests". This is outside the plan's file
    map; it is recorded in the PR body. It bounds a leaked handle to minutes instead of six hours of runner time.
    Cost if wrong: a legitimately slow suite would fail at 20 minutes (today it runs in about 90 seconds).
11. (CI fix-forward) CodeQL #654–656 are surfaced to the maintainer for dismissal, not code-fixed: they flag the
    test file's in-process app, the same pattern dismissed as "used in tests" for Sprints 142–144. Adding a rate
    limiter to a test app would only satisfy the scanner. The maintainer dismissed all three as "used in tests"
    on 2026-11-24 (16:33Z).
12. (Review fixes) The acceptance checks the inviter lock's result after both member locks, not right after the
    inviter lock. Lock order and the statement sequence stay the same in both id orders, and the DB case can
    park the acceptance on the invitee row after its empty inviter lock. Cost if wrong: an acceptance with a
    missing inviter row holds the invitee lock a few statements longer before refusing.
13. (Review fixes) A lost duplicate-create race re-reads the community after locking the winner row and before
    classifying it. So a now-private community answers the pointer for every winner state, including pending and
    blocked winners that previously got 409. This follows "a current private match is a no-write pointer for
    every stored membership state" (plan Task 4). Cost if wrong: a pending or blocked caller of a just-privatized
    community sees the approval pointer instead of their 409.

## Execution boundaries and PR contract

- No policy decision is pending. Same-inviter repeat admission remains 409 INVITATION_CONFLICT with another
  member's code/public self-rejoin as recovery; no schema change.
- D2/D3 may supersede staff review and stale its earlier notification; no notification-service cleanup.
- `.npmrc` disables npm posttest/prebuild lifecycle hooks: promotion and landing generation were run explicitly.
- Root integration CI is mandatory evidence before a future merge; mocks and test-file discovery are not
  transaction/race proof.
- The PR body uses the complete template and lists bundled work: **30b1823e — docs(process): apply /insights
  triage to agent rules and skills**, **cd8b973a — docs(process): route plan subagent models**, and the Sprint 144
  post-merge record **8471a6a7**, each docs-only, riding here because a separate docs PR costs a full deploy.
- The execution chat stops after opening the PR; the reviewer checks actual CI before any release authorization.

## Critical implementation notes (as implemented)

1. One social-graph transaction client owns invitation consumption, membership, counter effect, attribution and
   inviter stats (`src/services/invitationAcceptance.ts`); a failed admission consumes nothing; a failed ROLLBACK
   destroys that client. Community-service's `withTransaction` is unchanged, with its documented cleanup limitation.
2. Lock order: invitation → inviter FOR SHARE / invitee FOR UPDATE in ascending user id → community row via the
   trigger only. Never pre-lock a community.
3. D1/D2/D3 as approved; duplicate-create refuses pending; both paths refuse inactive/NULL/unknown and reset left
   rejoins to ordinary member.
4. A conflict no-op is followed by a locked read of the winner; no invented role or claim anywhere.
5. Live inviter authority is read inside the locked transaction (`getLiveRole(..., client)`); BUG-109 (generation)
   stays open.
6. Capacity checks follow real admitting writes on the same client; the database owns `current_members`.
7. Private duplicate-create pointer preserved, including a mid-request flip (tentative write rolled back first);
   post-commit token must contain the community or the answer is 409 `MEMBERSHIP_CHANGED`.
8. Do not claim live UI smoke, DB proof or deployment from API tests, mocks or historical Sprint 144 evidence.

## Persistent context (carried forward)

## Verified prior release

[#341](https://github.com/ravichavali/karmyq/pull/341) merged as `71773476` on 2026-11-22;
[CI/CD attempt 2](https://github.com/ravichavali/karmyq/actions/runs/45066293676/attempts/2)
passed 14/14, Deploy to Demo succeeded, the member-count migration committed, 9/9 service health checks
passed. ADR-106 is Implemented and BUG-103/104/105 fixed and deployed in this branch's post-merge record.
See the archive for exact timestamps, security status and evidence limitations (application smoke is
maintainer-reported and was not independently rerun here).

## Open candidates and decisions

- **Bundled agent-process commits (maintainer-requested 2026-11-23, Claude):** `30b1823e` (the `/insights`
  triage: CLAUDE.md Windows-host and next-chat-prompt rules, sprint-planning Step 5b self-audit and checkpoint,
  ship blocker report, deploy post-merge closeout plus frontmatter, review-response agent-report section) and
  `cd8b973a` (plan-template subagent model routing: implementers and per-task reviewers on Sonnet, final
  whole-branch review on Opus). Neither changes product code, committed settings or dependencies. Pre-existing
  defect found, not fixed: `tests/claude.md` says the TDD promoter "runs as root `posttest`", but `.npmrc`
  `ignore-scripts=true` stops npm from running it.
- [BUG-107](../../docs/BUGS.md) staff direct-add consent remains open and deferred.
- [BUG-109](../../docs/BUGS.md) generation authorization/sent-stat gap remains open. The acceptance-side
  live-inviter gate (in this branch) stops outsider-minted codes from admitting anyone; generation is unchanged.
- **New candidates from Sprint 145 review (not filed):** invitation codes carry a 4-hex suffix per inviter-year
  (`init.sql:189-213`), so they are guessable within an inviter's year (pre-existing; narrowed by the live-inviter
  check). A refused acceptance lands on discovery without saying why; carrying the refusal reason there is a UX
  follow-up. Deferred minors: shared social-graph test builders, integration `as()` helper, `MEMBERSHIP_CHANGED`
  wording, untrimmed code lookup after a blank check, the `liveRole.ts` `db` doc placement.
- **Gotcha candidate (CI fix-forward, not filed):** a bare supertest request is a thenable without `.finally`.
  It sends only when something calls `then`, and its ephemeral server closes only when the request ends. So
  `req.finally(...)` throws and leaks a listening server, and Jest never exits. Sprint 144's helper avoided it with
  `.then((r) => r)`. A `docs/gotchas/` entry would need a machine check, such as a static scan of
  `tests/integration` for `.finally(` on a request chain.
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
No dependency/lockfile work or settings change was allocated. One task branch/PR; post-merge records ride with
the next product PR, never a docs-only master push. No worktrees.

## Planning verification record

Source references in the spec were pre-implementation anchors; the as-built contracts are in the two service
`CONTEXT.md` files. Planning review history is in `d169f5c6`, `a29a38ed` and `92e398ff` (Step 5b: 0 findings).
