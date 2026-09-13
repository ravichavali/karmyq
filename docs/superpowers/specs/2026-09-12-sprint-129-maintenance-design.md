# Sprint 129: Maintenance — a demo that defends itself, a clear dependency board, and a quiet console — Design Spec

**Date**: 2026-09-12 · **Revised**: 2026-09-13 (PR A executed and rescoped; BUG-040 added)
**Status**: Approved — PR A partially executed
**Version**: v11.50.0 → v11.53.0 (three PRs)
**Sprint Branches**: `feature/sprint-129-demo-session`, `feature/sprint-129-deps`, `feature/sprint-129-community-aggregate`

---

## Overview

Karmyq's public front door was broken. `https://karmyq.com/demo` is the one page that lets a stranger
see the product without an account, and it had been dead since at least 2026-09-09. **It is now
restored** (commit `10600546`, verified live 2026-09-12). What this sprint does with the remaining
time is make sure the next failure is both *diagnosable* and *detected before a visitor hits it* —
because the investigation showed the demo had neither property, and that is why a broken front door
went unnoticed for days.

The diagnosis is worth stating precisely, because it changed the shape of the work twice.
`cleanup-service` hard-deletes expired help requests seven days after they expire
(`expirationJob.ts:84-88`, daily at 02:00). Maria's two demo requests aged out and were deleted; the
match and provider offer went with them. The demo's five hardcoded `DEMO_*` UUIDs are therefore on a
**timer**. The design already knew this — `docs/guides/demo-data.md` says the persona's stories are
"rotated explicitly before they age out", and `rotate:demo-stories` exists to do it — but that
mechanism had **never been wired on the demo host**. The documented safety mechanism could not run,
so the stories aged out silently instead. Wiring it, rather than re-pointing the UUIDs, is what
turned a repair-with-an-expiry-date into a fix.

Alongside that, two backlogs get cleared: thirteen open Dependabot PRs with four live security
alerts (one **high**, past its one-week SLA), and a `/communities` page that fires one trust-aggregate
request per card and gets a 404 for every one — roughly thirty-two console errors on a single load
of the very demo we just fixed.

### Core Principle: Opaque to the client, legible to the operator, loud to the maintainer

A response that refuses to say why is a privacy feature. A *log* that refuses to say why is just a
missing log. And a system that only tells you it is broken when a user finds it is not monitored at
all. ADR-084's opacity was designed for the client and accidentally applied to the operator; this
sprint separates those audiences and adds the third.

---

## What is already done — PR A, commit `10600546`

Verified live on 2026-09-12, not inferred from the tooling's own report.

| Delivered | Evidence |
|---|---|
| **Demo restored** | `POST /api/auth/demo-session` → **200**, both stories present, 30-min token |
| **Read-only guarantee intact** | write with the demo token → **403 `FORBIDDEN`** |
| **All state checks green** | 16/16 booleans true (was 8 true / 8 false) |
| **Rotation wired** | `.env.demo.rotation.example`, `scripts/demo/enable-demo.sh`, `scripts/demo/restart-auth.sh` |
| **Secret hygiene** | `.gitignore` now `.env*` + `!.env*.example`; `.gitattributes` pins `.env*` to LF |
| **Bugs recorded** | BUG-039 closed with full root cause; **BUG-040 filed** |

**Two security findings, both verified in both directions.** `.gitignore` did not cover `.env.demo`,
`.env.production` or `.env.demo.rotation` — and the demo host keeps `.env.demo` in the repo working
tree carrying `POSTGRES_PASSWORD`, `JWT_SECRET`, `INTERNAL_SECRET` and `DATABASE_URL`, so a single
`git add -A` there would have committed production secrets. Nothing was ever tracked, so no leak
occurred. Separately, the pattern `.env.*.users  # Simulated user credentials - never commit!`
matched **nothing**: `.gitignore` does not support trailing inline comments, so the comment text was
part of the pattern and the file it named had never been ignored.

Three traps were hit and fixed while wiring, and they are recorded because they will recur:
`npm --workspace` sets cwd to the **workspace** directory (so relative script paths silently
misresolve); the rotation env file is **shell-sourced**, so values containing spaces must be quoted
and CRLF breaks every line; and compose on the demo host takes its values from the **process
environment** via `set -a; source .env.demo`, across **two** compose files — recreating a container
without reproducing both would deploy a silently misconfigured service.

---

## What remains

### Part A (continued) — diagnosability and detection

**A1 — Log the reason.** `auth.ts:252` logs only failures that are *not*
`DemoSessionUnavailableError`, so every expected cause is silent. Log it too, at `warn`, carrying
its already-specific message. **The HTTP response does not change** — same 503, same
`DEMO_UNAVAILABLE`, same body. The reason strings in `demoSessionService.ts` are already written as
operator-facing diagnoses ("Ordinary request is not owned by the persona"); today they are
constructed and discarded.

**A2 — Startup self-check.** On auth-service boot, when `DEMO_SESSION_ENABLED === 'true'`, attempt
one demo session and log the outcome; when the flag is not `'true'`, log once that demo sessions are
disabled, so "off" is never mistaken for "broken". It must never throw — auth is Critical with seven
dependents and the demo is optional — and must never log the issued token.

**A3 — The scheduled demo-health monitor (BUG-040).** This is the only piece that prevents a
recurrence, and the sprint's most important remaining deliverable.

The replacement stories were measured the day they were created:

| | value |
|---|---|
| `expires_at`, both requests | **2026-11-12** |
| hard-deleted by cleanup (expiry + 7d) | **~2026-11-19** |

So the demo has a **66-day fuse**, and rotation being one command does not help if nobody runs it —
which is precisely the assumption that just failed. The monitor asserts two things daily:

1. `POST /api/auth/demo-session` returns **200** — the demo actually works.
2. The configured story rows are **more than 14 days from hard deletion** — so the warning arrives
   with time to act, not after the demo is already dead.

It follows `expo-sdk-drift.yml` exactly: scheduled (not `pull_request`, so a merge never depends on
karmyq.com being reachable), fails visibly, ensures its label exists, then files or updates one
labelled issue. It **never writes to the demo** — auto-rotation would mean unattended scheduled
writes to the demo database and the persona password as a CI secret, which is a larger security
surface than the problem justifies.

⚠️ **A crashed monitor must file an issue, not go quiet.** `expo-sdk-drift.yml` learned this the
hard way (BUG-035): narrowing issue-filing to "detected drift" left crashes and unparseable output
turning the run red with nobody told. The demo monitor inherits that rule — any non-green outcome,
including the check itself failing, is issue-worthy.

### Part B — Dependencies and security

Unchanged from the original plan. Scope: **safe + security only.**

**All four alerts closed:**

| Sev | Package | Where | Route |
|---|---|---|---|
| **HIGH** | `@faker-js/faker` ≤10.4.0 | `scripts/package-lock.json` | PR #216, 8.4.1 → 10.5.0. **Past the ≤1-week SLA.** |
| medium | `qs` (×2) | root lock | Raise the **existing** `overrides.qs` `">=6.15.2"` → `">=6.16.0"` |
| medium | `decode-uri-component` ≤0.4.2 | root lock | At **0.2.2**, patched at **0.5.0** |

**Merge six** (each verified all-minor/patch by reading its dependency table): #223 (6 prod deps),
#231 (15 dev deps), #217, #216, #212, #211.

**Leave seven open with a one-sentence triage comment each** — every one is a single **major**:
#229 `next` 16, #227 `zod` 4, #225 `node-fetch` 3 (ESM-only), #224 `express-rate-limit` 8,
#226 `dotenv` 17, #228 `node-cron` 4, #230 `expo-server-sdk` 7. The comment is the deliverable, so
the board reads as *decided* rather than *ignored*.

**Expo SDK drift ([issue #234](https://github.com/ravichavali/karmyq/issues/234))** — twelve
`expo-*` packages each one patch behind SDK 57. Not a broken workflow; a monitor correctly reporting
real drift.

### Part C — BUG-031, the `/communities` 404 storm

`communities/index.tsx:124` fans out one request per card; each returns 404 `AGGREGATE_NOT_AVAILABLE`.

⚠️ **`denyAggregate` (`reputation.ts:44`) returns the same 404 for two different situations** —
authorization denied (ADR-082: active member of a ≥5-member cohort) and aggregate-not-yet-computed.
That indistinguishability is a **privacy property**. So the fix is *not* "200 when uncomputed, 404
when denied" — that would leak exactly what ADR-082 hides. Both return an **identical 200** with an
explicitly empty aggregate; 404 is reserved for "no such community".

⚠️ **BUG-031's recorded caller reference is stale** — it cites `api.ts:754`, which is
`getLeaderboard`. The real definition is `api.ts:746`, and there is a **second** caller the bug never
mentions at `useCommunityData.ts:153`. Both must be covered and the bug entry corrected.

Batching the fan-out into one request is deferred — it changes the reputation service's public
surface, and the console-error half is what is visible on the demo.

---

## Data Model

No schema changes. No migration. (The demo story rows are ordinary `requests.help_requests` rows
created through the public API.)

---

## API Endpoints

| Method | Path | Change |
|---|---|---|
| POST | `/auth/demo-session` | **Contract unchanged.** Same 503, same code, same body. Server-side logging only. |
| GET | `/reputation/community-trust/:communityId` | `404 AGGREGATE_NOT_AVAILABLE` → `200 { success: true, data: { aggregate: null } }` for **both** the denied and uncomputed cases. 404 now means "no such community". |

---

## Frontend Changes

| File | Change |
|---|---|
| `apps/frontend/src/lib/api.ts` | `getCommunityTrust` (line 746) — consume the null-aggregate shape |
| `apps/frontend/src/pages/communities/index.tsx` | Line 124 fan-out — render empty state without erroring |
| `apps/frontend/src/hooks/useCommunityData.ts` | Line 153 — second call site |

`demo.tsx` is **not** modified: its `unavailable` phase is correct behavior for an unavailable demo.

---

## User Guide & Doc Updates

| Doc | Update |
|---|---|
| `docs/adr/ADR-084-*.md` | Amendment: opacity binds the client-facing response; operator-side logging is not a violation |
| `docs/guides/demo-data.md` | **Rotation is now runnable** — the env file, the two host scripts, the exact command, and that the monitor warns 14 days ahead. Correct the implication that rotation was already operational. |
| `services/auth-service/CONTEXT.md` | The six `DEMO_*` vars, that the flag defaults **off**, the self-check, the reason log; BUG-039 in "Recent Fixes" |
| `services/reputation-service/CONTEXT.md` | `community-trust` response change and why both cases are identical |
| `scripts/CLAUDE.md` | The new `scripts/demo/` subdirectory |
| `docs/gotchas/` | Two entries via the `learned` skill: the demo story rows are on a cleanup timer; and `npm --workspace` cwd + shell-sourced env quoting/CRLF traps |
| `docs/BUGS.md` | BUG-039 ✅ done; BUG-040 filed ✅; BUG-031 → fixed **and its stale line reference corrected** |
| `docs/IDEAS.md` | Deferred: resolve the demo story by query; batch the community-trust fan-out |

---

## Critical Implementation Notes

1. **The demo-session HTTP contract does not change.** A test must assert the response is
   byte-identical across two *different* causes while the log reasons differ. A test asserting only
   the log would pass a version that leaks the reason to the client.
2. **Never log the reason to the client, and never log the JWT.** The startup self-check must not log
   the issued token, and must never throw.
3. **A crashed monitor is the loudest case, not the quietest.** Any non-green outcome — including the
   check crashing or emitting no payload — files the issue. This is the BUG-035 lesson already
   encoded in `expo-sdk-drift.yml`.
4. **The monitor must not write to the demo.** Read-only assertions only; no rotation, no seeding.
5. **`qs` is an existing override, not a new one.** Raise it in place; do not add a second entry.
6. **Prove the `decode-uri-component` override actually lands.** It reaches the tree only via
   `apps/mobile → expo-router → query-string@7.1.3`, and root `overrides` are known not to reach
   `apps/*` subtrees reliably. Verify with strict `npm ci` then `npm ls decode-uri-component --all`.
   Check first whether the `expo-router` patch bump resolves it without an override.
7. **Dependency edits are surgical.** Never `npm install --workspace`, `npm dedupe`, or a scratch
   lockfile regen. Prove with strict `npm ci`.
8. **Do not widen `security/expo-divergences.json`.** Both entries cleared correctly; a divergence
   matching no current drift must be *deleted*.
9. **The Expo bump must move `SDK_PINNED` too**, or the gate stays green against a stale shadow.
10. **BUG-031's fix must keep denial and absence indistinguishable** — assert the two responses are
    identical, not merely that each is 200.
11. **BUG-031 has two call sites**, and the bug's recorded line reference is wrong.
12. **`apps/landing/src/data/docs/` churns on every `npm test`** — revert `build.json` and
    `architecture.json` before committing.
13. **Merge one PR at a time.** Every master push is a full deploy; overlapping deploys 502 the demo.
14. **The version bump is taken at merge time** from `origin/master`.
15. **Host traps, now recorded:** `npm --workspace` sets cwd to the workspace dir; the rotation env
    file is shell-sourced (quote values with spaces; LF only); compose on the demo host reads the
    **process environment** across **two** compose files.

---

## Done looks like

- ✅ `POST /api/auth/demo-session` returns 200 and `/demo` reaches `phase === 'active'` *(done)*
- A deliberately broken demo config produces a **specific reason** in the log while the HTTP response
  stays byte-identical — proven by a test
- The demo-health workflow runs green, and **fails with a filed issue** when the demo is broken or
  within 14 days of hard deletion — proven against a deliberately failing fixture, not just a green run
- **Zero** open Dependabot security alerts
- Six Dependabot PRs merged; seven majors open, each carrying a triage comment
- Expo drift workflow green; issue #234 closed
- `/communities` loads with **zero** console errors as `maria.reyes`
- BUG-039, BUG-040 and BUG-031 all accurately reflected in `docs/BUGS.md`
