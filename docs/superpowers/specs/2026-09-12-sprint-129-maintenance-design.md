# Sprint 129: Maintenance — a working demo, a clear dependency board, and a quiet console — Design Spec

**Date**: 2026-09-12
**Status**: Approved
**Version**: v11.50.0 → v11.53.0 (three PRs)
**Sprint Branches**: `feature/sprint-129-demo-session`, `feature/sprint-129-deps`, `feature/sprint-129-community-aggregate`

---

## Overview

Karmyq's public front door is broken. `https://karmyq.com/demo` is the one page that lets a stranger
see the product without an account, and it has been dead since at least 2026-09-09: every
`POST /api/auth/demo-session` returns `503 DEMO_UNAVAILABLE`, so `demo.tsx` renders "The live demo
isn't available right now" instead of Maria's story. Reproduced again on 2026-09-12 against deployed
v11.50.0. Ordinary login as `maria.reyes@test.karmyq.com` still returns 200 with a token, so the
auth service is healthy and only demo-session issuance is affected.

The reason it has stayed broken for three days is the more interesting half. ADR-084 deliberately
collapses all fourteen distinct failure causes into one opaque 503 so that resource existence is
never leaked, and `auth.ts:252` logs **only** failures that are *not* `DemoSessionUnavailableError`.
Every expected cause — disabled flag, missing config, persona absent, story rows no longer owned by
the persona — is therefore silent in the server logs by construction. BUG-039 advises "check
`pm2 logs`"; that advice cannot work. The opacity was designed for the *client* and accidentally
applied to the *operator* as well. This sprint restores the demo and separates those two audiences,
so the next occurrence is diagnosable in one command instead of three blind days.

Alongside that, two backlogs get cleared. Thirteen Dependabot PRs are open and four security alerts
are live, one of them a **high** that has been open ten days against a one-week SLA. And
`/communities` fires one trust-aggregate request per card, each answering 404, producing roughly
thirty-two console errors on a single page load of the very demo we are fixing.

### Core Principle: Opaque to the client, legible to the operator

A response that refuses to say why is a privacy feature. A *log* that refuses to say why is just a
missing log. ADR-084's opacity is a property of what crosses the network to an unauthenticated
caller — it was never meant to blind the person holding the server. Every failure this sprint
touches keeps its externally indistinguishable response and gains an internally precise reason.

---

## Scope decisions taken at planning time

The maintainer set scope explicitly on 2026-09-12. Recording it here so the plan is not re-litigated
mid-sprint:

| Area | Decision | Consequence |
|---|---|---|
| Dependencies | **Safe + security only** | Merge the minor/patch PRs, fix all four alerts. The seven single **major** bumps stay open with a written triage note each. |
| BUG-039 | **Fix it *and* make it diagnosable** | Restore the demo, plus an operator-side reason channel and a self-check. Not the full "resolve the story by query" redesign. |
| Open bugs | **BUG-031 only** | BUG-033, BUG-034, BUG-036 stay open and out of scope. |

**Explicitly deferred, with reasons:**

- **BUG-034** (messaging-service has zero tests) — a Critical service needing a Socket.io test
  harness built from nothing. Its own sprint.
- **BUG-033** (TDD promoter blind to `.tsx`) — extending the filter moves ~442 tests into the
  blocking tier in one change. Deferred by maintainer decision in Sprint 122 and still deferred.
- **BUG-036** (CI healthcheck races a fixed `sleep 30`) — small and real, but it is a CI flake, not
  a user-visible defect. Next maintenance sprint.
- **The seven major dependency bumps** — see the triage table below.

---

## Found during planning, not in the handoff

The handoff lists the scheduled **"Expo SDK drift" workflow failing on master** as an undiagnosed
failure. It is not a failure. `expo-sdk-drift.yml` is a monitor added by Sprint 128 PR B that runs
`npx expo install --check` against Expo's **live** version map and fails deliberately so the
scheduled run is visibly red. It is working exactly as designed and reporting real drift, filed as
[issue #234](https://github.com/ravichavali/karmyq/issues/234): twelve `expo-*` packages each
exactly one patch release behind SDK 57, plus two correctly-cleared registered divergences.

This is folded into PR B rather than left open, because it is patch-level dependency hygiene of
exactly the kind this sprint exists to clear, and because a permanently-red scheduled workflow
trains everyone to ignore a monitor that will one day report something that matters.

The handoff also records `security/audit-exemptions.json` as carrying two entries expiring
**2026-09-15**. It does not — the file's `exemptions` array is now **empty**, resolved by Sprint 128
PR B. No renewal is owed. The stale note should be dropped from persistent memory.

---

## Part A — BUG-039: the demo session

### What is actually wrong

Not yet known, and that is the point. The candidate causes, read out of
`services/auth-service/src/services/demoSessionService.ts`, are:

| Cause | Source | Likelihood |
|---|---|---|
| `DEMO_SESSION_ENABLED` not `'true'` on the demo server | `demoSessionService.ts:118`; `docker-compose.yml:90` defaults it to **`false`** | **High** |
| One of five `DEMO_*` id vars empty | `demoSessionService.ts:121-130`; `docker-compose.yml:91-95` all default to empty | **High** |
| Story rows no longer owned by the persona | `demoSessionService.ts:221-234` | Medium — any demo reseed invalidates the hardcoded UUIDs |
| Persona missing / inactive / admin | `demoSessionService.ts:199-212` | Low — ordinary login as Maria works |
| `JWT_SECRET` unset | `demoSessionService.ts:192` | Very low — ordinary login issues tokens |

The two "high" rows share a shape: **the demo's configuration is six environment variables that
default to off-and-empty, and five of them are UUIDs pointing at specific rows in a mutable
database.** Nothing detects the moment they stop matching. That fragility is the real defect; this
sprint makes it *visible* rather than eliminating it (see *Deliberately not in scope* below).

### The fix, in three parts

**A1 — Diagnose against the running server.** ⚠️ Requires explicit maintainer authorization as a
demo-server operation; see *Operational gate* below. Read the deployed auth-service environment for
the six `DEMO_*` vars, then — only if the config is present — confirm the five referenced rows still
exist and are owned by the persona.

**A2 — Restore the demo.** Whichever of the two the diagnosis lands on: set the missing environment
on the demo server, or re-point the id vars at story rows that currently exist. Verified by
`POST /api/auth/demo-session` returning 200 against `karmyq.com`, and by the `/demo` page reaching
`phase === 'active'`.

**A3 — Make the next occurrence diagnosable.** Three changes, all server-side:

1. **Log the reason.** `auth.ts:252` currently logs only non-`DemoSessionUnavailableError`
   failures. Log `DemoSessionUnavailableError` too, at `warn`, carrying its already-specific
   message. The HTTP response is untouched — same 503, same `DEMO_UNAVAILABLE`, same body. The
   error messages in `demoSessionService.ts` are already written as operator-facing diagnoses
   ("Ordinary request is not owned by the persona"); today they are constructed and discarded.
2. **A startup self-check.** On auth-service boot, when `DEMO_SESSION_ENABLED === 'true'`, attempt a
   demo session once and log the outcome. A misconfigured demo then announces itself at deploy time
   rather than at first visitor. When the flag is not `'true'`, log once that demo sessions are
   disabled — so "disabled" is never mistaken for "broken".
3. **A smoke-test path.** Add `POST /api/auth/demo-session` to the documented demo smoke-test set,
   so a post-deploy check would have caught this.

### Deliberately not in scope

Resolving Maria's story from the database at request time — so that a reseed cannot invalidate it —
is the durable fix, and the maintainer chose not to take it this sprint. It changes what the demo
*is* (a fixed curated story vs. a derived one), needs an ADR, and must not ride along with an
outage fix. Recorded in `docs/IDEAS.md` for a future sprint.

### ADR handling

A3.1 modifies behavior that **ADR-084 specified**. Rather than mint a new ADR — numbers are
maintainer-allocated and none has been requested — ADR-084 gains an amendment section recording
that opacity binds the client-facing response only, and that operator-side logging is explicitly
*not* a violation of it. If the maintainer would prefer a separate ADR, they allocate the number and
the plan's doc task splits accordingly.

---

## Part B — Dependencies and security

### Security alerts — all four closed

| Sev | Package | Where | Route to fix |
|---|---|---|---|
| **HIGH** | `@faker-js/faker` ≤10.4.0 | `scripts/package-lock.json` | PR **#216** bumps 8.4.1 → 10.5.0. **10 days open against a ≤1-week SLA.** |
| medium | `qs` | root `package-lock.json` | Raise the existing `overrides.qs` from `">=6.15.2"` to `">=6.16.0"`. Two alerts, one fix. |
| medium | `decode-uri-component` ≤0.4.2 | root `package-lock.json` | Currently **0.2.2**, patched at **0.5.0**. |

Two notes that change how these are executed:

- **`qs` already has an override** pinned at `">=6.15.2"` — the exact floor the new advisory
  invalidates. This is not a new override; it is a floor that must be raised. A fresh override
  entry would be a second source of truth for the same package.
- **`decode-uri-component` reaches us only through `apps/mobile`:**
  `@karmyq/mobile → expo-router@57.0.20 → query-string@7.1.3 → decode-uri-component@0.2.2`.
  ⚠️ Per the standing `apps/*` half-resolution gotcha, **a root `overrides` entry may not reach an
  `apps/*` subtree.** Whether the override actually lands must be proven by a strict `npm ci`
  followed by `npm ls decode-uri-component --all`, not assumed from the edited manifest. If the
  override does not reach it, the fallback is a `query-string` bump inside `apps/mobile`.

### Dependabot PRs — six merged, seven triaged

**Merge (all minor/patch, verified by reading each PR's dependency table):**

| PR | Contents |
|---|---|
| **#223** | production-deps group, 6 updates — `axios` 1.19→1.20, `pg` 8.22→8.23, `redis` 6.2.0→6.2.1, `zustand` 5.0.14→5.0.15, `uuid` 14.0.1→14.0.2, `@alloc/quick-lru` 5.2→5.3. No majors. |
| **#231** | dev-deps group, 15 updates — `jest` 30.4→30.5, `turbo` 2.10.8→2.10.12, `tsx`, `postcss`, `@typescript-eslint/*` 8.65→8.70, `@playwright/test` 1.62→1.63, `@faker-js/faker` 10.5→10.6, others. No majors. |
| **#217** | `qs` 6.15.2 → 6.16.0 — the security fix above. |
| **#216** | `@faker-js/faker` 8.4.1 → 10.5.0 in `/scripts` — the **high**. Two majors, but `scripts/` is tooling; blast radius is the seed/simulation scripts, not a shipped service image. Verify the scripts still run. |
| **#212** | `docker/setup-buildx-action` 4.2.0 → 4.3.0 — CI action, minor. |
| **#211** | `google/osv-scanner-action` 2.3.8 → 2.5.1 — CI action, minor. |

**Leave open, with a triage comment on each** — every one is a single major bump needing its own
verification, and per standing discipline majors are never rapid-merged:

| PR | Bump | Why it needs its own pass |
|---|---|---|
| #229 | `next` 15.5.24 → **16**.3.4 | Framework major across the whole frontend. Note `eslint-config-next` is *already* at 16.x in devDeps — that mismatch wants recording either way. |
| #227 | `zod` 3.25.76 → **4**.5.4 | Validation schema rewrite; touches every request validator. |
| #225 | `node-fetch` 2.7.0 → **3**.3.2 | v3 is **ESM-only**. Requires import-site changes wherever it is used. |
| #224 | `express-rate-limit` 7.5.1 → **8**.7.0 | Rate-limiting config surface changed; interacts with the known CodeQL rate-limiting false positive. |
| #226 | `dotenv` 16.6.1 → **17**.4.2 | Env loading order is already a documented CI failure mode. |
| #228 | `node-cron` 3.0.3 → **4**.6.0 | Cleanup-service scheduling. |
| #230 | `expo-server-sdk` 6.1.0 → **7**.2.0 | Push notification delivery; pairs with mobile SDK work. |

The triage comment is the deliverable here, not the merge. Each PR gets one sentence saying why it
is held and what would unblock it, so the board reads as *decided* rather than *ignored*.

### Expo SDK drift — issue #234

Twelve packages, every one a single patch bump within SDK 57: `expo` 57.0.21→~57.0.22, plus
`expo-camera`, `expo-constants`, `expo-device`, `expo-font`, `expo-image-picker`, `expo-linking`,
`expo-location`, `expo-notifications`, `expo-router`, `expo-secure-store`, `expo-splash-screen`.

Per the issue's own instructions: update `apps/mobile/package.json` **and** the matching `SDK_PINNED`
entries in `tests/regression/sprint-122-expo-sdk-alignment.test.ts`, re-resolve the lockfile
surgically, and assert the resolved versions. The two registered divergences in
`security/expo-divergences.json` (`jest`, `@types/jest`) cleared correctly and must be left alone —
they are not drift.

The `expo-router` 57.0.20 → 57.0.21 bump may incidentally move `query-string` and resolve
`decode-uri-component` without an override. **Check this before writing the override** — if it does,
the override is unnecessary and adding one would be dead configuration that the audit gate would
later flag as unmatched.

---

## Part C — BUG-031: the `/communities` 404 storm

### What happens

`apps/frontend/src/pages/communities/index.tsx:124` fans out one request per community card:

```ts
communityIds.map(id => reputationService.getCommunityTrust(id))
```

Each lands on `GET /reputation/community-trust/:communityId`
(`services/reputation-service/src/routes/reputation.ts:165`) and returns **404** with a well-formed
ADR-074 envelope, `AGGREGATE_NOT_AVAILABLE`. Roughly thirty-two console errors per page load,
observed on demo as `maria.reyes` at 1440px. Nothing renders broken — the costs are a red console
on the demo we are fixing, and an N+1 request pattern on a list page.

⚠️ **BUG-031's recorded caller reference is stale.** It cites `apps/frontend/src/lib/api.ts:754`;
line 754 is `getLeaderboard`. The real definition is `api.ts:746`, and there is a **second** caller
at `apps/frontend/src/hooks/useCommunityData.ts:153` that the bug does not mention. Both must be
covered, and the bug entry corrected.

### The constraint that shapes the fix

`denyAggregate` (`reputation.ts:44-46`) returns the **same** 404 body for two different situations:
the caller is not entitled to the aggregate (ADR-082: must be an active member of a ≥5-member
cohort), and the aggregate simply has not been computed yet. That indistinguishability is a
**privacy property, not an oversight** — it prevents an outsider from probing which communities
exist or how large they are.

So the fix is *not* "return 200 when it's merely uncomputed and keep 404 for denial". That would
make the two distinguishable and leak exactly what ADR-082 hides.

### The fix

Return **200 with an explicitly empty aggregate for both cases**, preserving indistinguishability
while ending the error storm — an absent aggregate is a legitimate empty state, not a failure. The
two cases stay byte-identical on the wire. 404 is then reserved for "no such community".

Response becomes `{ success: true, data: { aggregate: null } }` for both. The frontend renders the
same "no aggregate yet" state it renders today, without the console error.

Batching the fan-out into one request for the visible cards is the other half of BUG-031 and is
**deferred**: it changes the reputation service's public surface, wants its own endpoint design, and
the console-error half is what is visible on the demo. Recorded in `docs/IDEAS.md`.

---

## Data Model

No schema changes. No migration.

---

## API Endpoints

| Method | Path | Change |
|---|---|---|
| POST | `/auth/demo-session` | **Unchanged contract.** Same 503, same `DEMO_UNAVAILABLE`, same body. Only server-side logging is added. |
| GET | `/reputation/community-trust/:communityId` | `404 AGGREGATE_NOT_AVAILABLE` → `200 { success: true, data: { aggregate: null } }` for both the denied and the uncomputed case. 404 now means "no such community". |

---

## Frontend Changes

| File | Change |
|---|---|
| `apps/frontend/src/lib/api.ts` | `getCommunityTrust` (line 746) — handle the 200-with-null shape. |
| `apps/frontend/src/pages/communities/index.tsx` | Line 124 fan-out — consume null aggregate without erroring. |
| `apps/frontend/src/hooks/useCommunityData.ts` | Line 153 — same, second call site. |

`apps/frontend/src/pages/demo.tsx` is **not** modified. Its `unavailable` phase is correct behavior
for an unavailable demo; the demo simply stops being unavailable.

---

## User Guide & Doc Updates

| Doc | Update |
|---|---|
| `docs/adr/ADR-084-*.md` | Amendment: opacity binds the client-facing response; operator-side logging is not a violation. |
| `services/auth-service/CONTEXT.md` | Demo-session config surface — the six `DEMO_*` vars, that the flag defaults **off**, the startup self-check, and the reason log. "Recent Fixes" entry for BUG-039. |
| `services/reputation-service/CONTEXT.md` | `community-trust` response change; why both cases return an identical 200. |
| `docs/guides/` | Operator-facing note on verifying the demo after deploy. |
| `docs/gotchas/` | New entry: the demo's five hardcoded story UUIDs silently invalidate on any demo reseed, and the endpoint cannot report it to the client by design. Authored via the `learned` skill. |
| `docs/BUGS.md` | BUG-039 → fixed; BUG-031 → fixed **and its stale `api.ts:754` reference corrected**. |
| `docs/IDEAS.md` | Two deferrals: resolve the demo story by query; batch the community-trust fan-out. |
| `services/registry.json` | Only if a dependency change alters a recorded service dependency. |

---

## Critical Implementation Notes

1. **The demo-session HTTP contract does not change.** Same status, same error code, same body.
   ADR-084's opacity is preserved exactly. Only the server-side log gains the reason. A test must
   assert the response is byte-identical before and after.
2. **Never log the reason to the client, and never log the JWT.** The reason strings go to
   `req.logger` only. The startup self-check must not log the issued token.
3. **`qs` is an existing override, not a new one.** Raise `overrides.qs` from `">=6.15.2"` to
   `">=6.16.0"` in place. Do not add a second entry.
4. **Prove the `decode-uri-component` override actually lands.** It reaches the tree only through
   `apps/mobile`, and root `overrides` are known not to reach `apps/*` subtrees reliably. Verify
   with a strict `npm ci` then `npm ls decode-uri-component --all` — never from the manifest alone.
   Check first whether the `expo-router` patch bump resolves it without an override.
5. **Dependency edits are surgical.** Edit `package.json` and splice `package-lock.json` in place.
   Never `npm install --workspace`, never `npm dedupe`, never a scratch lockfile regen — they
   rewrite exact pins to ranges. Prove with strict `npm ci`.
6. **Do not widen `security/expo-divergences.json` to silence drift.** The two existing entries
   cleared correctly. A divergence matching no current drift must be *deleted*, not kept.
7. **The Expo bump must move `SDK_PINNED` too.** `tests/regression/sprint-122-expo-sdk-alignment.test.ts`
   holds a handwritten shadow map. Updating `package.json` alone leaves the gate green against a
   stale shadow — the exact false-green that made the drift monitor necessary.
8. **BUG-031's fix must keep denial and absence indistinguishable.** Both return the identical 200.
   Returning 200 only for the uncomputed case would leak ADR-082's hidden distinction. A test must
   assert the two responses are identical.
9. **BUG-031 has two call sites, not one**, and the bug's recorded line reference is wrong. Cover
   `communities/index.tsx:124` and `useCommunityData.ts:153`.
10. **`apps/landing/src/data/docs/` churns on every `npm test`.** `build.json` and
    `architecture.json` regenerate with fresh timestamps and HEAD sha. Revert that churn before
    committing — mandatory, not advisory.
11. **Merge one PR at a time.** Every master push is a full deploy; overlapping deploys restart
    services and 502 the demo — which is the thing this sprint is fixing. Wait for each deploy and
    its health verify before merging the next.
12. **The version bump is taken at merge time**, read from `origin/master`'s `package.json`, not
    assigned at branch time.

---

## Operational gate — read before Task A1

Diagnosing BUG-039 requires reading the deployed auth-service environment and possibly querying the
demo database as `karmyq_prod`. Standing discipline: **every demo-server data operation requires its
own explicit, per-operation maintainer authorization.** Ask before each one, and say what is being
read or written. The plan's A1 task is therefore a *request*, not an autonomous step.

The read-only environment inspection and the row-existence query are separate operations and are
authorized separately from any write that re-points the config.

---

## Done looks like

- `POST https://karmyq.com/api/auth/demo-session` returns **200**, and `/demo` reaches
  `phase === 'active'` showing Maria's two stories.
- A deliberately broken demo config produces a **specific reason** in the auth-service log while the
  HTTP response stays byte-identical — proven by a test, not by inspection.
- **Zero** open Dependabot security alerts.
- Six Dependabot PRs merged; the seven majors open, each carrying a one-sentence triage comment.
- The Expo SDK drift workflow's next scheduled run is **green**, and issue #234 is closed.
- `/communities` loads with **zero** console errors as `maria.reyes`.
- BUG-039 and BUG-031 marked fixed in `docs/BUGS.md`, with BUG-031's stale line reference corrected.
