# Sprint 129 — Maintenance: demo, dependencies, bugs — Handoff

**Date**: 2026-09-12 · **Revised**: 2026-09-13
**Outcome**: **PR A is OPEN at [#235](https://github.com/ravichavali/karmyq/pull/235) — awaiting CI
and review.** The demo is restored and live. Tasks A1–A13 are DONE. PR B and PR C have not started.

> Single stream. `CURRENT_HANDOFF.md` **is** the state, not a router — there is no second machine.
> This file is branch-local and reserves nothing; contended resources are allocated by the
> maintainer (`CLAUDE.md` → *Parallel Development*).

---

## Sprint goal

Restore the public demo and make its next failure both diagnosable and **detected before a visitor
hits it**; clear the dependency and security backlog to zero open alerts; silence the
`/communities` 404 storm.

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `feature/sprint-129-demo-session` — **pushed**, tracking `origin/`. Read the head with `git rev-parse --short origin/feature/sprint-129-demo-session`; a sha written here is stale on the next commit. |
| **PR** | **[#235](https://github.com/ravichavali/karmyq/pull/235) OPEN** — `mergeable=MERGEABLE`, `mergeStateStatus=BLOCKED` on `REVIEW_REQUIRED` |
| **Base** | `origin/master` at `55a536fc`; branch bumps the version to **v11.51.0** |
| **Active editor** | Claude — PR A implementation complete |
| **Shared resources** | Demo-server rotation **performed and complete** 2026-09-12 (authorized). No further demo write is needed or authorized. No ADR minted — ADR-084 is amended in place. |

## Quick Start

1. Confirm live state before trusting this file: `gh pr view 235`, `gh pr checks 235`,
   `git log --oneline origin/master -1`.
2. **PR A needs no more implementation.** Do not re-run Tasks A1–A13.
3. If PR A has merged: start **PR B** — `git fetch origin` then
   `git switch -c feature/sprint-129-deps origin/master`, and re-derive the version bump from
   `origin/master` at that point.
4. Plan: [`docs/superpowers/plans/2026-09-12-sprint-129-maintenance.md`](../../docs/superpowers/plans/2026-09-12-sprint-129-maintenance.md)

**Next unchecked task**: **Task D — merge and deploy PR A**, which is blocked on a human approving
#235 (an agent cannot self-approve here). After the deploy, **Task E** verifies the demo-health
workflow and closes BUG-040. PR B follows.

## ✅ PR A — implementation complete

| Delivered | Evidence |
|---|---|
| Demo restored (BUG-039) | `POST /api/auth/demo-session` → **200**, both stories; write with demo token → **403**; 16/16 state checks green (was 8) |
| Rotation wired | `.env.demo.rotation.example` + `scripts/demo/{enable-demo,restart-auth}.sh`; one command, documented in `docs/guides/demo-data.md` |
| Failure is legible | `auth.ts` logs the reason at `warn`; response byte-identical (ADR-084 Sprint 129 amendment) |
| Boot self-check | `demoSessionSelfCheck.ts` — never throws, never logs the token, distinguishes *disabled* from *broken* |
| Monitor built (BUG-040) | `demo-health.yml` + `check-demo-health.js` + `probe-story-rows.js` + `render-health-issue.js` |
| Secret hygiene | `.gitignore` → `.env*` + `!.env*.example` (+3 tracked-file negations); `.gitattributes` pins `.env*` to LF |
| Gates | `/simplify`, `/code-review` high, `/security-review` — all run; findings fixed, one false positive recorded with evidence |

## ⚠️ Two things the next session must know

**The pre-push hook was bypassed with `SKIP_PREPUSH=1`, with maintainer authorization.** It blocked
four consecutive pushes on *unrelated* timeout flakes, in four different workspace combinations,
none reproducible standalone and none in files this branch touches. The verification the hook exists
to provide was satisfied another way first: `npx turbo run test --concurrency=1 --force` →
**26 tasks, 26 successful, exit 0**. CI on Linux then confirmed it — **Test Backend Services** and
**Test Auth Service** both pass on #235. This is documented in the PR body, not hidden.

**Turbo parallelism on this Windows box is unreliable.** Suites run ~60x slower under load (4.8s
standalone → jest *estimating* 301s), which pushes ordinary tests past the 5s default and explicit
10s timeouts. Triage: read `Failed: <pkg>#test`, re-run that package alone, and check whether the
branch touches it at all. Use `--output-logs=full` — turbo suppresses jest detail on failure. And
**capture exit codes separately**: a background-task notification reported "exit code 0" twice while
the underlying command had exited 1.

## Artifacts

- **Spec**: [`docs/superpowers/specs/2026-09-12-sprint-129-maintenance-design.md`](../../docs/superpowers/specs/2026-09-12-sprint-129-maintenance-design.md)
- **Plan**: [`docs/superpowers/plans/2026-09-12-sprint-129-maintenance.md`](../../docs/superpowers/plans/2026-09-12-sprint-129-maintenance.md)

## BUG-040 — stays OPEN until verified after merge

The monitor cannot be proven before merge: `workflow_dispatch` only works once a workflow is on the
**default branch**, and the condition evaluator in `sprint-129-demo-health-workflow.test.ts` is a
*model* of GitHub's expression semantics, not GitHub. Close it only when **both** exist (Task E):

1. A dispatched run of `demo-health.yml` that completes green — verify the **specific run**, not
   merely that a run appears.
2. A deliberately failing run — dispatch with an unreachable `base_url` input — that **files an
   issue**.

Closing it on a local green would be exactly the false-green this sprint kept finding.

---

## Three PRs, merged in order

| PR | Branch | Scope | State |
|---|---|---|---|
| **A** | `feature/sprint-129-demo-session` | BUG-039 restore + diagnosability + BUG-040 monitor | **[#235](https://github.com/ravichavali/karmyq/pull/235) OPEN** — awaiting CI and review |
| **B** | `feature/sprint-129-deps` | 6 Dependabot PRs, 4 security alerts, Expo SDK drift (#234) | not started — branch after A merges |
| **C** | `feature/sprint-129-community-aggregate` | BUG-031: the `/communities` 404 storm | not started — branch after B merges |

⚠️ **One merge at a time.** Every master push is a full deploy; overlapping deploys restart services
and 502 the demo — the thing this sprint is fixing.

---

## ✅ Operational gate — SATISFIED, nothing further authorized

The maintainer authorized the read-only diagnosis and then the seed + env update; both were carried
out on 2026-09-12 and the demo is live. **No further demo-server write is needed or authorized.**
PR A needed no further server access after that; everything since was code, tests, a workflow and
docs, and is now complete in #235.

⚠️ **Task E will need GitHub access, not demo-server access** — dispatching `demo-health.yml` runs
the read-only probe through CI's existing SSH secrets. No new demo-server authorization is implied.

The rotation is now repeatable by one command on the demo host:

```bash
cd ~/karmyq && set -a && . ./.env.demo.rotation && set +a
npm --workspace @karmyq/simulation-service run rotate:demo-stories -- --apply --publish-config
```

`.env.demo.rotation` exists on the host (chmod 600, not tracked). A pre-change backup of the compose
env is at `~/karmyq/.env.demo.bak.s129`.

---

## ✅ BUG-039 DIAGNOSED — 2026-09-12, read-only check inside `karmyq-auth-service`

Config is **entirely healthy**. All four story rows are **gone**.

```
flag_is_exactly_true=true          persona_found=true
all_five_ids_nonempty=true         resolved_persona_is_synthetic=true
jwt_secret_present=true            persona_has_active_membership=true
configured_email_is_synthetic=true persona_is_not_admin=true

ordinary_request_exists=false      provider_request_exists=false
match_exists=false                 offer_exists=false
```

**Root cause: `cleanup-service` deletes them on a schedule.**
`services/cleanup-service/src/jobs/expirationJob.ts:84-88` runs daily at **02:00**
(`index.ts:314`, `cron.schedule('0 2 * * *')`) and executes:

```sql
DELETE FROM requests.help_requests WHERE expired = TRUE AND updated_at <= now() - 7 days
```

Maria's two demo requests expired, sat out the 7-day grace period, and were permanently deleted;
the match and offer went with them. **The five hardcoded `DEMO_*` UUIDs are therefore on a timer** —
re-pointing them is a fix with a built-in expiry date, not a repair.

Eliminated by this check, so do not re-investigate: missing/disabled config, a persona problem, and
RLS (enabled on only `auth.user_invitations`, `auth.social_distances`, `auth.inviter_stats` — none
on the demo path, so the missing `setDbContext` in `demoSessionService.ts` is not a factor).

**Resolved by wiring rotation, not by re-pointing the ids.** `docs/guides/demo-data.md` always said
the stories are "rotated explicitly before they age out" and `rotate:demo-stories` existed to do it,
but the mechanism had **never been wired on the demo host** — simulation-service is not deployed
there and `.env.demo.example` carried none of the five variables rotation requires. The documented
safety mechanism could not run, which is why the stories aged out silently. Stories are now
API-created, so the demo stays truthful rather than hand-inserted.

⏰ **The recurrence is NOT gone — it is now tracked as BUG-040.** The replacement stories expire
**2026-11-12** and are hard-deleted **~2026-11-19** (conservative estimate — see note 18; the real deadline is mark-time + 7 days, not `expires_at` + 7 days). Rotation being one command does not help if
nobody runs it, which is exactly the assumption that just failed. The scheduled monitor that
warns 14 days ahead is now **built** (PR A, #235) but **not yet verified on GitHub** — see BUG-040.

---

## Scope decisions taken at planning (do not re-litigate)

| Area | Decision |
|---|---|
| Dependencies | **Safe + security only.** The seven single **major** bumps stay open with a written triage comment each. |
| BUG-039 | **Fix it *and* make it diagnosable.** Not the full "resolve the story by query" redesign. |
| Open bugs | **BUG-031 only.** BUG-033, BUG-034, BUG-036 stay open and out of scope. |
| BUG-040 *(added 2026-09-13)* | **In this sprint, PR A.** Scheduled demo-health monitor: warn early + file an issue, modelled on `expo-sdk-drift.yml`. **Never writes to the demo** — auto-rotation would mean unattended scheduled DB writes and the persona password as a CI secret. |
| PR A shape | **Kept whole** — restore + diagnosability + monitor is one cohesive story, and the `.gitignore` fix rides along (found in flight, two files). |

---

## Critical implementation notes (verbatim from the spec)

1. **The demo-session HTTP contract does not change.** A test must assert the response is
   byte-identical across two *different* causes while the log reasons differ. A test asserting only
   the log would pass a version that leaks the reason to the client.
2. **Never log the reason to the client, and never log the JWT.** The startup self-check must not log
   the issued token, and must never throw.
3. **A crashed monitor is the loudest case, not the quietest.** Any non-green outcome — including the
   check crashing or emitting no payload — files the issue (the BUG-035 lesson already encoded in
   `expo-sdk-drift.yml`).
4. **The monitor must not write to the demo.** Read-only assertions only.
5. **`qs` is an existing override, not a new one.** Raise it in place.
6. **Prove the `decode-uri-component` override actually lands** with strict `npm ci` then
   `npm ls decode-uri-component --all`. Check first whether the `expo-router` bump resolves it.
7. **Dependency edits are surgical.** Never `npm install --workspace`, `npm dedupe`, or a scratch regen.
8. **Do not widen `security/expo-divergences.json`.**
9. **The Expo bump must move `SDK_PINNED` too.**
10. **BUG-031 is about authorization denial only, and all three denial causes must stay identical.**
    `denyAggregate` is reached from exactly one place, `reputation.ts:171` (`!access.allowed`). The
    "not yet computed" case does **not** reach it — `reputation.ts:180-185` calculates on demand and
    returns 200. `checkAggregateAccess` (`utils/disclosureAuth.ts:74-82`) returns `allowed:false` for
    **unknown community, non-member, and undersized cohort alike**, and its docstring says why: "the
    caller is never told which, so we do not leak community existence or size." **Never add a
    404-for-unknown-community branch** — that introduces an existence leak that does not exist today.
    Assert deep-equality *between* the three responses, not merely that each is 200.
11. **BUG-031 has two call sites**, and the bug's recorded line reference is wrong.
12. **`apps/landing/src/data/docs/` churns on every `npm test`** — revert before committing.
13. **Merge one PR at a time.**
14. **The version bump is taken at merge time** from `origin/master`.
15. **Host traps:** `npm --workspace` sets cwd to the workspace dir; the rotation env file is
    shell-sourced (quote values with spaces; LF only); compose on the demo host reads the **process
    environment** across **two** compose files.
16. **New tests start in the changed workspace's `tests/tdd/`**, not root. Read
    [`tests/claude.md`](../../../tests/claude.md) before placing any test.
17. **Git hooks are LIVE.** A silent, instant push means no hook ran — treat that as the alarm.
18. **`expires_at + 7 days` is NOT the deletion deadline.** Cleanup is two stages: marking
    (`expirationJob.ts:18-22`, hourly) sets `expired = TRUE, updated_at = CURRENT_TIMESTAMP` and only
    for `status = 'open'`; deletion (`:84-88`, 02:00) keys off that **`updated_at`**. So the real
    deadline is mark-time + 7 days, a later write to `updated_at` restarts the clock, and a row that
    was never `open` at expiry is never deleted at all. Compute from the live row; where the
    approximation is used, label it conservative.
19. **`if:` carries an implicit `success()`.** A step condition referencing `steps.<id>.outputs.*`
    is skipped entirely when an earlier step fails, so setup/install failures file nothing. Every
    reporting step needs `always() && (...)` plus an empty-payload fallback. This is a gap in
    `expo-sdk-drift.yml` (`:154`, `:232`, `:262`) — do not inherit it. **Test for `issue != '0'`,
    never `issue == '1'`**: a step that exits 0 without writing `GITHUB_OUTPUT` leaves it empty,
    which an `== '1'` test reads as "nothing to report" and skips. Default to notifying; only an
    explicit, well-formed `0` earns silence.
20. **`workflow_dispatch` requires the workflow on the DEFAULT branch.** A new workflow cannot be
    dispatched while its PR is open. Pre-merge evidence is fixtures + a YAML parse; dispatch and
    run verification belong in Task E, after deploy.
21. **`bash -n a.sh b.sh` checks only `a.sh`** — the remaining arguments become positional
    parameters to it. Verified by reproduction: `bash -n good.sh bad.sh` exits 0 while
    `bash -n bad.sh` exits 2. Loop one file per invocation, and use `node --check` for JS.
22. **The demo-health expiry probe reads over the EXISTING deploy SSH path**, not a new secret and not a new public endpoint. `ci.yml:419-430` already provides `PROD_SSH_PRIVATE_KEY`,
    `PROD_SERVER_HOST` and `PROD_SERVER_USER`. The request routes never select the request's own
    `expires_at` (only the unrelated `boosted_expires_at`), so an API read would mean a real
    contract change; adding it to the demo-session response would violate note 1; and shipping
    `DATABASE_URL` to Actions is a worse secret than the one already there.
23. **An exit code of 0 is not evidence of a successful check.** The payload must be parsed and
    structurally validated — `ok` present, a per-story array, a computed deadline per story — and a
    parse failure or missing field treated as `issue=1`. An empty-string guard alone passes a
    non-empty but malformed payload. Fixtures must cover **exit 0 with empty output** and **exit 0
    with a malformed payload**, both of which must still file an issue.

---

## What planning established (so it isn't re-derived)

**BUG-039 is undiagnosable by design, and that is the real defect.** ADR-084 collapses all fourteen
failure causes into one opaque 503, and `auth.ts:252` logs **only** non-`DemoSessionUnavailableError`
failures — so every expected cause is silent in the server logs. BUG-039's advice to "check
`pm2 logs`" cannot work. Reproduced again 2026-09-12 against v11.50.0: 503 `DEMO_UNAVAILABLE`, while
ordinary login as Maria returns 200.

**The two likeliest causes are both config.** `DEMO_SESSION_ENABLED` defaults to **`false`**
(`docker-compose.yml:90`) and the five `DEMO_*` id vars default to empty (`:91-95`). The ids are
hardcoded UUIDs pointing at specific mutable DB rows, so any demo reseed silently invalidates them.

**The "failing Expo workflow" in the last handoff is not a failure.** `expo-sdk-drift.yml` is a
monitor working exactly as designed, reporting real drift as
[issue #234](https://github.com/ravichavali/karmyq/issues/234): twelve `expo-*` packages each one
patch behind SDK 57. Folded into PR B.

**`security/audit-exemptions.json` is now EMPTY.** The two entries expiring 2026-09-15 were resolved
by Sprint 128 PR B. **No renewal is owed** — the note in persistent memory is stale and should be
dropped.

**The grouped Dependabot PRs were inspected and contain no majors** — #223 (6 prod deps) and #231
(15 dev deps) are all minor/patch. Safe to take.

**`qs` already carries an override** at `">=6.15.2"` — precisely the floor the new advisory
invalidates.

**`decode-uri-component` arrives only via `apps/mobile`:**
`@karmyq/mobile → expo-router@57.0.20 → query-string@7.1.3 → decode-uri-component@0.2.2`
(vulnerable ≤0.4.2, patched 0.5.0).

**BUG-031's recorded caller line is stale** — it cites `api.ts:754`, which is `getLeaderboard`. The
real definition is `api.ts:746`; the N+1 is `communities/index.tsx:124`; and there is a second,
unrecorded caller at `useCommunityData.ts:153`.

**`denyAggregate` (`reputation.ts:44`) returns the same 404 for two different situations** —
authorization denied, and aggregate not yet computed. That indistinguishability is an ADR-082
**privacy property**, not an oversight. The fix returns an identical 200 for both; returning 200
only for the uncomputed case would leak what ADR-082 hides.

---

## Deferred, with reasons

- **BUG-034** — messaging-service has zero tests. A Critical service needing a Socket.io harness
  built from nothing. Its own sprint.
- **BUG-033** — TDD promoter blind to `.tsx`. Extending the filter moves ~442 tests into the
  blocking tier in one change; deferred by maintainer decision in Sprint 122.
- **BUG-036** — CI healthcheck races a fixed `sleep 30`. Small and real, but a CI flake, not
  user-visible. Next maintenance sprint.
- **The seven major bumps** — #229 `next` 16, #227 `zod` 4, #225 `node-fetch` 3 (ESM-only),
  #224 `express-rate-limit` 8, #226 `dotenv` 17, #228 `node-cron` 4, #230 `expo-server-sdk` 7.
- **Resolving the demo story by query** instead of five hardcoded UUIDs — the durable fix, needs an
  ADR, must not ride along with an outage fix. → `docs/IDEAS.md`.
- **Batching the community-trust fan-out** into one request — changes the reputation service's
  public surface. → `docs/IDEAS.md`.

---

## Still open, not in this sprint

- **`enforce_admins: false`** on `master`. Six required checks and one required approval are all
  admin-bypassable, yet the review requirement is also what stalls every sprint's end: the PR author
  and the authenticated account are the same, so the required approval can never be self-provided.
  **This has shaped the end of four consecutive sprints** — Sprint 129's PR #235 is blocked on it too.
  One API call either way.
- **`apps/landing/src/data/docs/` is only PARTIALLY git-tracked.** `apps/landing/.gitignore:2`
  ignores the directory, but ~160 files were committed before that and remain tracked; ADRs 095+ are
  not. `CLAUDE.md` calls it "git-tracked" without qualification, which is misleading.
- **Sprint 128 PR C architectural follow-through** — three deferred items (one definition of the
  trust metrics instead of a SQL copy and a TypeScript copy; a single `projectApply`; interpolating
  `COMPLETED_MATCH_REASONS` into the SQL). Detail in
  `.claude/handoff/archive/2026-09-11-sprint-128-standing-preview-SHIPPED-v11.50.0.md`.

## Process notes worth carrying

**Demo-host traps, all hit and fixed while wiring rotation — they will recur:**
- **`npm --workspace` sets cwd to the WORKSPACE directory**, not the repo root, so a relative path
  in an env var silently misresolves under `services/<name>/`. Both host scripts now re-anchor to
  the repo root from `${BASH_SOURCE[0]}`, and the env file uses absolute paths.
- **The rotation env file is SHELL-SOURCED.** A value containing spaces must be quoted or
  `set -a; . ./file` executes it instead of assigning it. CRLF fails as `$'\r': command not found`
  on every line — `.gitattributes` now pins `.env*` to LF.
- **Compose on the demo host reads the PROCESS ENVIRONMENT**, not an env_file: `deploy.sh` does
  `set -a; source .env.demo`. There is no `.env` on the host. It also uses **two** compose files
  (base + `docker-compose.prod.yml`) — recreating a container without both drops every prod override.
- **`grep -q $'\r'` is not a reliable CRLF check** in a loop; count bytes instead
  (`python -c "...count(b'\r')"`). It reported clean on a file with 59 CR bytes.

- **An agent cannot merge a PR here.** GitHub forbids self-approval, and the local permission
  classifier refuses `gh pr merge` in both `--admin` and plain form. Plan sprints to end at
  "PR green and ready", not "merged".
- **`gh run list` on master is drowned by Dependabot.** Filter by `--workflow=ci.yml`, and verify
  the `Deploy to Demo` **job**, not just the run.
- **Git hooks are LIVE on this clone** — a push costs a full suite run. A silent, instant push means
  no hook ran; treat that as the alarm.
- **`/health` is not exposed via nginx.** Smoke-test with `POST /api/auth/login`, and now also
  `POST /api/auth/demo-session`.
- **Windows + Git Bash:** `curl` flag parsing is unreliable and `jq` is not installed — use
  `node -e` for HTTP probes and JSON parsing. No local Docker.

⚠️ Every GitHub status above is a dated observation (2026-09-12). Re-derive with `gh pr list`,
`gh run list` and `git log origin/master` before trusting any of it.
