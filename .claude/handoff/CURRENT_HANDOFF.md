# Sprint 129 — Maintenance: demo, dependencies, bugs — Handoff

**Date**: 2026-09-12
**Outcome**: Sprint 129 is PLANNED and ready to execute. Spec and plan written; no branch yet.

> Single stream. `CURRENT_HANDOFF.md` **is** the state, not a router — there is no second machine.
> This file is branch-local and reserves nothing; contended resources are allocated by the
> maintainer (`CLAUDE.md` → *Parallel Development*).

---

## Sprint goal

Restore the public Maria demo and make its next failure diagnosable, clear the dependency and
security backlog to zero open alerts, and silence the `/communities` 404 storm.

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | none yet — branch from freshly fetched `origin/master` |
| **Base** | `origin/master` at `55a536fc`, version **v11.50.0** |
| **Active editor** | unassigned |
| **Shared resources needed** | **Demo-server operations required** (see gate below). No ADR allocated — none needed; ADR-084 is amended in place. |

## Quick Start

1. Read this handoff
2. Reuse the existing task branch if one exists; otherwise `git fetch origin` then
   `git switch -c feature/sprint-129-demo-session origin/master`. Never branch off a stale local
   master — unpushed local-master commits leak in via the squash-merge.
3. Open plan: [`docs/superpowers/plans/2026-09-12-sprint-129-maintenance.md`](../../docs/superpowers/plans/2026-09-12-sprint-129-maintenance.md)
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

**Next unchecked task**: PR A, Task A1 — branch, reproduce, then **stop and request demo-server
authorization**.

## Artifacts

- **Spec**: [`docs/superpowers/specs/2026-09-12-sprint-129-maintenance-design.md`](../../docs/superpowers/specs/2026-09-12-sprint-129-maintenance-design.md)
- **Plan**: [`docs/superpowers/plans/2026-09-12-sprint-129-maintenance.md`](../../docs/superpowers/plans/2026-09-12-sprint-129-maintenance.md)

## Three PRs, merged in order

| PR | Branch | Scope |
|---|---|---|
| **A** | `feature/sprint-129-demo-session` | BUG-039: restore the demo + make it diagnosable |
| **B** | `feature/sprint-129-deps` | 6 Dependabot PRs, 4 security alerts, Expo SDK drift (#234) |
| **C** | `feature/sprint-129-community-aggregate` | BUG-031: the `/communities` 404 storm |

⚠️ **One merge at a time.** Every master push is a full deploy; overlapping deploys restart services
and 502 the demo — the thing this sprint is fixing.

---

## ⚠️ Operational gate — PR A cannot proceed without it

Diagnosing BUG-039 requires reading the deployed auth-service environment, and probably querying the
demo DB as `karmyq_prod`. **Every demo-server operation needs its own explicit, per-operation
maintainer authorization.** Task A1 is a *request*, not an autonomous step.

Three separate operations, authorized separately:
1. Read-only: which of the six `DEMO_*` vars are set (names and set/unset, **not values**)
2. Read-only: do the five referenced story rows exist and belong to the persona
3. Write: set the missing env, or re-point the story ids

---

## Scope decisions taken at planning (do not re-litigate)

| Area | Decision |
|---|---|
| Dependencies | **Safe + security only.** The seven single **major** bumps stay open with a written triage comment each. |
| BUG-039 | **Fix it *and* make it diagnosable.** Not the full "resolve the story by query" redesign. |
| Open bugs | **BUG-031 only.** BUG-033, BUG-034, BUG-036 stay open and out of scope. |

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
