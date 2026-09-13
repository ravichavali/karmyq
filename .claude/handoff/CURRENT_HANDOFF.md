# Sprint 129 — Maintenance: demo, dependencies, bugs — Handoff

**Date**: 2026-09-12 · **Revised**: 2026-09-13
**Outcome**: PR A is IN PROGRESS — **the demo is restored and live**. Tasks A1–A5 done
(`10600546`); remaining: reason logging, startup self-check, the BUG-040 monitor, docs, gates.

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
| **Branch** | `feature/sprint-129-demo-session` (exists, 2 commits, **not yet pushed**) |
| **Base** | `origin/master` at `55a536fc`, version **v11.50.0** |
| **Active editor** | Claude — PR A in progress |
| **Shared resources** | Demo-server rotation **performed and complete** 2026-09-12 (authorized). No further demo write is needed or authorized. No ADR minted — ADR-084 is amended in place. |

## Quick Start

1. Read this handoff
2. **Reuse the existing branch** — `git switch feature/sprint-129-demo-session`. Do NOT re-branch;
   two commits are already on it. Never branch off a stale local master.
3. Open plan: [`docs/superpowers/plans/2026-09-12-sprint-129-maintenance.md`](../../docs/superpowers/plans/2026-09-12-sprint-129-maintenance.md)
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

**Next unchecked task**: **Task A6** — write the demo-session logging test (TDD). Tasks A1–A5 are
DONE; do not redo them.

## ✅ Done already — commit `10600546`, verified live 2026-09-12

| Delivered | Evidence |
|---|---|
| Demo restored | `POST /api/auth/demo-session` → **200**, both stories, 30-min token |
| Read-only guarantee | write with demo token → **403 `FORBIDDEN`** |
| State checks | **16/16 green** (was 8 true / 8 false) |
| Rotation wired | `.env.demo.rotation.example` + `scripts/demo/{enable-demo,restart-auth}.sh` |
| Secret hygiene | `.gitignore` → `.env*` + `!.env*.example`; `.gitattributes` pins `.env*` to LF |
| Bugs | BUG-039 closed with root cause; **BUG-040 filed** |

⚠️ **The branch is not pushed.** Hooks are live, so the first push costs a full suite run.

## Artifacts

- **Spec**: [`docs/superpowers/specs/2026-09-12-sprint-129-maintenance-design.md`](../../docs/superpowers/specs/2026-09-12-sprint-129-maintenance-design.md)
- **Plan**: [`docs/superpowers/plans/2026-09-12-sprint-129-maintenance.md`](../../docs/superpowers/plans/2026-09-12-sprint-129-maintenance.md)

## Three PRs, merged in order

| PR | Branch | Scope |
|---|---|---|
| **A** | `feature/sprint-129-demo-session` | BUG-039 restore *(done)* + diagnosability + **BUG-040 monitor** |
| **B** | `feature/sprint-129-deps` | 6 Dependabot PRs, 4 security alerts, Expo SDK drift (#234) |
| **C** | `feature/sprint-129-community-aggregate` | BUG-031: the `/communities` 404 storm |

⚠️ **One merge at a time.** Every master push is a full deploy; overlapping deploys restart services
and 502 the demo — the thing this sprint is fixing.

---

## ✅ Operational gate — SATISFIED, nothing further authorized

The maintainer authorized the read-only diagnosis and then the seed + env update; both were carried
out on 2026-09-12 and the demo is live. **No further demo-server write is needed or authorized.**
The remaining PR A work is entirely local code, tests, a workflow and docs.

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
**2026-11-12** and are hard-deleted **~2026-11-19**. Rotation being one command does not help if
nobody runs it, which is exactly the assumption that just failed. Tasks A9/A10 add the scheduled
monitor that warns 14 days ahead.

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

1. **The demo-session HTTP contract does not change.** Same status, same error code, same body.
   ADR-084's opacity is preserved exactly. Only the server-side log gains the reason. A test must
   assert the response is byte-identical before and after.
2. **Never log the reason to the client, and never log the JWT.** Reason strings go to `req.logger`
   only. The startup self-check must not log the issued token.
3. **`qs` is an existing override, not a new one.** Raise `overrides.qs` from `">=6.15.2"` to
   `">=6.16.0"` in place. Do not add a second entry.
4. **Prove the `decode-uri-component` override actually lands.** It reaches the tree only through
   `apps/mobile`, and root `overrides` are known not to reach `apps/*` subtrees reliably. Verify
   with strict `npm ci` then `npm ls decode-uri-component --all` — never from the manifest alone.
   Check first whether the `expo-router` patch bump resolves it without an override.
5. **Dependency edits are surgical.** Edit `package.json` and splice `package-lock.json` in place.
   Never `npm install --workspace`, never `npm dedupe`, never a scratch lockfile regen. Prove with
   strict `npm ci`.
6. **Do not widen `security/expo-divergences.json` to silence drift.** The two existing entries
   cleared correctly. A divergence matching no current drift must be *deleted*, not kept.
7. **The Expo bump must move `SDK_PINNED` too.** Updating `apps/mobile/package.json` alone leaves
   the gate green against a stale shadow — the exact false-green that made the drift monitor
   necessary.
8. **BUG-031's fix must keep denial and absence indistinguishable.** Both return the identical 200.
   Returning 200 only for the uncomputed case would leak ADR-082's hidden distinction. A test must
   assert the two responses are identical.
9. **BUG-031 has two call sites, not one**, and the bug's recorded line reference is wrong. Cover
   `communities/index.tsx:124` and `useCommunityData.ts:153`.
10. **`apps/landing/src/data/docs/` churns on every `npm test`.** Revert `build.json` and
    `architecture.json` before committing — mandatory.
11. **Merge one PR at a time.** Wait for each deploy and health verify before merging the next.
12. **The version bump is taken at merge time** from `origin/master`'s `package.json`.

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
  **This has shaped the end of three consecutive sprints.** One API call either way.
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
