# Sprint 129 Maintenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore the public Maria demo and make its next failure diagnosable, clear the dependency
and security backlog down to zero open alerts, and silence the `/communities` 404 storm.

**Architecture:** No new services, no schema changes, no new endpoints. One response-shape change in
reputation-service, one server-side logging channel added to auth-service behind an unchanged HTTP
contract, and dependency manifest edits.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*.

**Spec:** [`docs/superpowers/specs/2026-09-12-sprint-129-maintenance-design.md`](../specs/2026-09-12-sprint-129-maintenance-design.md)

---

## Three PRs, merged in this order

| PR | Branch | Scope | Why this order |
|---|---|---|---|
| **A** | `feature/sprint-129-demo-session` | BUG-039: restore + diagnose | The user-visible outage. Ships first. |
| **B** | `feature/sprint-129-deps` | Dependency backlog, 4 security alerts, Expo drift | Largest diff; the high is past SLA. |
| **C** | `feature/sprint-129-community-aggregate` | BUG-031: the 404 storm | Smallest, lowest risk, cosmetic-but-visible. |

Each branches fresh from `origin/master`. **Merge one at a time** — every master push is a full
deploy, and overlapping deploys 502 the demo this sprint exists to fix.

---

## File Map

### New files to create

| File | Responsibility |
|------|---------------|
| `services/auth-service/tests/tdd/sprint-129-demo-session-logging.test.ts` | Asserts the 503 response is byte-identical while the reason reaches the logger |
| `services/auth-service/src/services/demoSessionSelfCheck.ts` | Startup self-check; logs demo reachability at boot |
| `services/reputation-service/tests/tdd/sprint-129-community-aggregate.test.ts` | Asserts denial and absence return identical 200s |
| `docs/gotchas/demo-session-config-is-five-hardcoded-uuids.md` | Authored via the `learned` skill |

### Existing files to modify

| File | Change |
|------|--------|
| `services/auth-service/src/routes/auth.ts` | Line ~252 — log `DemoSessionUnavailableError` at `warn`; response untouched |
| `services/auth-service/src/index.ts` | Wire the startup self-check |
| `services/auth-service/CONTEXT.md` | Demo config surface, self-check, BUG-039 in Recent Fixes |
| `services/reputation-service/src/routes/reputation.ts` | `denyAggregate` (line 44) → identical 200 for both cases |
| `services/reputation-service/CONTEXT.md` | Response change + why both cases are identical |
| `apps/frontend/src/lib/api.ts` | `getCommunityTrust` (line 746) — consume the null-aggregate shape |
| `apps/frontend/src/pages/communities/index.tsx` | Line 124 fan-out |
| `apps/frontend/src/hooks/useCommunityData.ts` | Line 153 — second call site |
| `package.json` | `overrides.qs` `">=6.15.2"` → `">=6.16.0"`; possibly `decode-uri-component` |
| `package-lock.json` | Surgical splice only |
| `apps/mobile/package.json` | 12 Expo patch bumps |
| `tests/regression/sprint-122-expo-sdk-alignment.test.ts` | `SDK_PINNED` shadow map — must move with the manifest |
| `docs/adr/ADR-084-*.md` | Amendment: opacity binds the client response, not the operator log |
| `docs/BUGS.md` | BUG-039 fixed; BUG-031 fixed + stale line reference corrected |
| `docs/IDEAS.md` | Two deferrals appended |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

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
13. **New tests start in the changed workspace's `tests/tdd/`**, not root `tests/`. Read
    [`tests/claude.md`](../../../tests/claude.md) before placing any test.
14. **Git hooks are LIVE on this clone.** A push runs the full suite. A silent, instant push means
    no hook ran — treat that as an alarm.

---

# PR A — BUG-039: restore the demo and make it diagnosable

## Task A1: Branch, and request the diagnosis

**Files:** none yet.

- [ ] Branch from freshly fetched `origin/master`

```bash
git fetch origin
git switch -c feature/sprint-129-demo-session origin/master
```

- [ ] Confirm the bug still reproduces against the deployed site

```bash
node -e "
const https=require('https');const b=JSON.stringify({});
const r=https.request({hostname:'karmyq.com',path:'/api/auth/demo-session',method:'POST',headers:{'Content-Type':'application/json','Content-Length':b.length}},s=>{let d='';s.on('data',c=>d+=c);s.on('end',()=>console.log(s.statusCode,d));});
r.write(b);r.end();"
```

- [ ] **⚠️ STOP — ask the maintainer to authorize a read-only demo-server inspection.**

State exactly what will be read: the six `DEMO_*` environment variables on the deployed
auth-service. This is a demo-server operation and needs its own explicit authorization. Do not
proceed without it.

- [ ] Once authorized: read the deployed auth-service environment

```bash
# Confirm which of the six are set. Print names and whether each is non-empty — NOT the values.
ssh ubuntu@karmyq.com 'docker exec karmyq-auth-service printenv | grep -c "^DEMO_" || true'
```

- [ ] If config is present, request a **second** authorization to query the demo DB for the five
      referenced rows' existence and ownership. Separate operation, separate approval.

- [ ] Record the diagnosed cause in the handoff before writing any fix

## Task A2: Test the logging change first (TDD)

**Files:**
- Create: `services/auth-service/tests/tdd/sprint-129-demo-session-logging.test.ts`

- [ ] Write the failing test — the response must be byte-identical, and the reason must reach the logger

The test drives `POST /auth/demo-session` with a deliberately broken config (e.g.
`DEMO_SESSION_ENABLED` unset) and asserts both halves:

```ts
// Assert BOTH, in one test, so the contract and the diagnosis move together:
//  1. status === 503, body deep-equals the exact ADR-074 envelope shipped today
//     ({ success:false, message:'Demo session is unavailable', error:'DEMO_UNAVAILABLE' })
//  2. the injected logger received a warn carrying the SPECIFIC reason
//     ('Demo sessions are disabled'), proving the operator channel is real
// A test asserting only (2) would pass while silently leaking the reason to the client.
```

- [ ] Add a second case proving the response is identical across two *different* causes

```ts
// Disabled-flag and persona-not-found must produce byte-identical HTTP responses
// while producing DIFFERENT log reasons. This is the whole design in one assertion.
```

- [ ] Verify the test fails for the right reason (no reason is logged today)

```bash
cd services/auth-service && npx jest tests/tdd/sprint-129-demo-session-logging.test.ts
```

## Task A3: Log the reason

**Files:**
- Modify: `services/auth-service/src/routes/auth.ts`

- [ ] At the `catch` (line ~250-266), log `DemoSessionUnavailableError` at `warn` with its message;
      keep the existing `error`-level log for unexpected failures. The `sendError` call is untouched.

- [ ] Verify the TDD test now passes and the existing regression suites still pass

```bash
cd services/auth-service && npx jest tests/tdd/sprint-129-demo-session-logging.test.ts tests/regression/sprint-116-demo-session.route.test.ts tests/regression/sprint-116-demo-session.test.ts
```

## Task A4: Startup self-check

**Files:**
- Create: `services/auth-service/src/services/demoSessionSelfCheck.ts`
- Modify: `services/auth-service/src/index.ts`

- [ ] Implement the self-check: on boot, if `DEMO_SESSION_ENABLED === 'true'`, attempt one demo
      session and log success or the specific failure reason. If the flag is not `'true'`, log once
      that demo sessions are disabled — so "disabled" is never mistaken for "broken".

- [ ] **Must not log the issued token.** Log only the outcome.
- [ ] **Must never throw.** A failing self-check logs; it does not prevent auth-service from booting
      — auth is Critical with 7 dependents and the demo is optional.

- [ ] Add a test asserting the self-check swallows failures and never rejects

```bash
cd services/auth-service && npx jest tests/tdd/
```

## Task A5: Restore the demo on the server

- [ ] **⚠️ STOP — request maintainer authorization for the demo-server write**, naming the exact
      change (set the missing env vars, or re-point the story ids).

- [ ] Apply the fix and restart the auth service
- [ ] Verify live

```bash
node -e "
const https=require('https');const b=JSON.stringify({});
const r=https.request({hostname:'karmyq.com',path:'/api/auth/demo-session',method:'POST',headers:{'Content-Type':'application/json','Content-Length':b.length}},s=>{let d='';s.on('data',c=>d+=c);s.on('end',()=>console.log('EXPECT 200 ->',s.statusCode));});
r.write(b);r.end();"
```

- [ ] Load `https://karmyq.com/demo` and confirm it reaches `phase === 'active'` with Maria's two
      stories rendered. **A 200 from the endpoint is not sufficient evidence the page works.**

## Task A6: Docs for PR A

- [ ] Amend `docs/adr/ADR-084-*.md` — opacity binds the client-facing response; operator-side
      logging is explicitly not a violation. Keep the ADR's status; add an "Amendment (Sprint 129)"
      section.
- [ ] Update `services/auth-service/CONTEXT.md` — the six `DEMO_*` vars, that the flag defaults
      **off**, the self-check, the reason log, and BUG-039 under "Recent Fixes".
- [ ] Add the gotcha via the `learned` skill: the demo's five hardcoded story UUIDs silently
      invalidate on any demo reseed, and the endpoint cannot report it to the client by design.
- [ ] Add the demo-session probe to the documented demo smoke-test paths.
- [ ] Mark BUG-039 fixed in `docs/BUGS.md` with the actual diagnosed cause.
- [ ] Append to `docs/IDEAS.md`: resolve the demo story by query instead of five hardcoded UUIDs.

## Task A7: Quality gates for PR A

- [ ] `/simplify` on the branch diff
- [ ] `/code-review` on the branch diff — **medium** (small, well-specified diff)
- [ ] `/security-review` on the branch diff — this PR adds a logging channel to a deliberately
      opaque endpoint; the review must confirm no reason string and no token can reach the client
- [ ] Resolve or dismiss every finding with written justification

## Task A8: Verify and open PR A

- [ ] `npx tsc --noEmit` in `services/auth-service`
- [ ] `npm test` — capture the exit code separately; `| tail` masks it
- [ ] `npm run feedback:check`
- [ ] Revert `apps/landing/src/data/docs/` churn
- [ ] Bump the version, read from `origin/master` at merge time
- [ ] Open the PR; **stop at "green and ready"** — an agent cannot merge here

---

# PR B — Dependencies, security alerts, Expo drift

## Task B1: Branch and establish the baseline

- [ ] Branch from freshly fetched `origin/master` **after PR A has merged and deployed**

```bash
git fetch origin
git switch -c feature/sprint-129-deps origin/master
```

- [ ] Record the live alert set as the baseline to prove against at the end

```bash
gh api repos/ravichavali/karmyq/dependabot/alerts --paginate \
  -q '.[] | select(.state=="open") | "\(.security_advisory.severity)\t\(.dependency.package.name)\t\(.dependency.manifest_path)"' | sort
```

Expect exactly four: the `@faker-js/faker` high in `scripts/`, two `qs`, one
`decode-uri-component`.

## Task B2: The Expo SDK drift (issue #234)

**Files:**
- Modify: `apps/mobile/package.json`, `package-lock.json`,
  `tests/regression/sprint-122-expo-sdk-alignment.test.ts`

- [ ] Bump all twelve `expo-*` packages one patch each, per issue #234
- [ ] **Move the `SDK_PINNED` shadow map in the same commit** — note 7
- [ ] Re-resolve the lockfile **surgically** — note 5
- [ ] Leave `security/expo-divergences.json` alone — both entries cleared correctly — note 6

- [ ] Verify against the live arbiter, not the shadow

```bash
cd apps/mobile && EXPO_NO_TELEMETRY=1 npx expo install --check
node scripts/expo-divergences.js
```

- [ ] **Check whether the `expo-router` bump moved `query-string`** — this may resolve
      `decode-uri-component` without an override

```bash
npm ls decode-uri-component --all
```

Record the answer; Task B4 depends on it.

## Task B3: `qs` — raise the existing override

**Files:** `package.json`, `package-lock.json`

- [ ] Raise `overrides.qs` from `">=6.15.2"` to `">=6.16.0"` **in place** — note 3
- [ ] Splice the lockfile surgically
- [ ] Prove the resolved version, not the manifest

```bash
npm ci && npm ls qs --all | grep -c "qs@6.1[0-5]" # expect 0 matches below 6.16.0
```

## Task B4: `decode-uri-component`

**Files:** `package.json` and/or `apps/mobile/package.json`, `package-lock.json`

- [ ] **If Task B2 already resolved it to ≥0.5.0, do nothing and record why.** Adding a dead
      override would later trip the audit gate as unmatched — note 4.
- [ ] Otherwise add the override, then **prove it reaches the `apps/mobile` subtree**

```bash
npm ci
npm ls decode-uri-component --all   # every resolved copy must be >= 0.5.0
```

- [ ] If the root override does not reach `apps/mobile`, fall back to bumping `query-string` inside
      `apps/mobile` — note 4

## Task B5: `@faker-js/faker` — the high, past SLA

- [ ] Take PR #216's change: `scripts/package-lock.json`, 8.4.1 → 10.5.0
- [ ] **Two major versions.** Verify the seed/simulation scripts that import faker still run — the
      `helpers.fake` API is the vulnerable surface and its signature may have moved

```bash
grep -rn "faker" scripts/ --include=*.js --include=*.ts | grep -v package-lock | head -20
```

- [ ] Run each affected script far enough to prove it still works

## Task B6: Merge the safe Dependabot PRs

- [ ] Confirm each is still all-minor/patch before taking it — re-read the dependency table; a
      Dependabot PR can be force-updated after it is opened

| PR | Contents |
|---|---|
| #223 | production-deps group, 6 updates, no majors |
| #231 | dev-deps group, 15 updates, no majors |
| #217 | `qs` 6.15.2 → 6.16.0 (may be subsumed by Task B3) |
| #212 | `docker/setup-buildx-action` 4.2.0 → 4.3.0 |
| #211 | `google/osv-scanner-action` 2.3.8 → 2.5.1 |

- [ ] Where a PR's change is already carried by this branch, close it with a comment saying so
      rather than merging a duplicate

## Task B7: Triage the seven majors

- [ ] Post a one-sentence triage comment on each — why it is held, what would unblock it

| PR | Bump |
|---|---|
| #229 | `next` 15 → **16** |
| #227 | `zod` 3 → **4** |
| #225 | `node-fetch` 2 → **3** (ESM-only) |
| #224 | `express-rate-limit` 7 → **8** |
| #226 | `dotenv` 16 → **17** |
| #228 | `node-cron` 3 → **4** |
| #230 | `expo-server-sdk` 6 → **7** |

- [ ] Record the `eslint-config-next` 16.x / `next` 15.x mismatch found during planning — either as
      a note on #229 or in `docs/IDEAS.md`

## Task B8: Docs for PR B

- [ ] Update any service `CONTEXT.md` whose dependencies changed
- [ ] `npm run analyze:services` — dependencies changed
- [ ] Close issue #234 once the drift workflow is green

## Task B9: Quality gates for PR B

- [ ] `/simplify` on the branch diff
- [ ] `/code-review` on the branch diff — **high** (large diff, dependency surface)
- [ ] `/security-review` on the branch diff
- [ ] Resolve or dismiss every finding with written justification

## Task B10: Verify and open PR B

- [ ] **Strict `npm ci` from clean** — the only thing that catches `apps/*` half-resolution

```bash
rm -rf node_modules && npm ci
```

- [ ] `npx tsc --noEmit` across changed workspaces
- [ ] `npm test` — capture the exit code separately
- [ ] **Prove zero open security alerts** against the live API, not from the manifest

```bash
gh api repos/ravichavali/karmyq/dependabot/alerts --paginate \
  -q '[.[] | select(.state=="open")] | length'   # expect 0
```

- [ ] Revert `apps/landing/src/data/docs/` churn
- [ ] Bump the version, read from `origin/master` at merge time
- [ ] Open the PR; stop at "green and ready"

---

# PR C — BUG-031: the `/communities` 404 storm

## Task C1: Branch and test first (TDD)

**Files:**
- Create: `services/reputation-service/tests/tdd/sprint-129-community-aggregate.test.ts`

- [ ] Branch from freshly fetched `origin/master` **after PR B has merged and deployed**

- [ ] Write the failing test — and make indistinguishability the assertion

```ts
// The load-bearing assertion is that the two cases are IDENTICAL, not that each is 200:
//  - caller denied the aggregate (not an active member / cohort < 5, ADR-082)
//  - aggregate simply not computed yet
// Both must produce the same status AND a deep-equal body.
// A test checking only "returns 200" would pass a fix that leaks ADR-082's hidden
// distinction — which is exactly the regression to prevent.
```

- [ ] Add a case asserting a genuinely unknown community still returns **404**

## Task C2: Change the response

**Files:** `services/reputation-service/src/routes/reputation.ts`

- [ ] `denyAggregate` (line 44) → `200` with `{ success: true, data: { aggregate: null } }`
- [ ] Confirm every call site of `denyAggregate` should move — grep them all; do not assume the
      `community-trust` route is the only one

```bash
grep -rn "denyAggregate" services/reputation-service/src
```

- [ ] Ensure "no such community" still returns 404

## Task C3: Frontend — both call sites

**Files:** `apps/frontend/src/lib/api.ts`, `apps/frontend/src/pages/communities/index.tsx`,
`apps/frontend/src/hooks/useCommunityData.ts`

- [ ] `getCommunityTrust` (api.ts:746) — consume the null-aggregate shape. Remember the interceptor
      already unwraps: it is `res.data`, not `res.data.data`.
- [ ] `communities/index.tsx:124` — the fan-out renders the empty state without erroring
- [ ] `useCommunityData.ts:153` — the second call site — note 9
- [ ] Frontend tests: renders with a null aggregate, and no error is logged

## Task C4: Verify the storm is gone

- [ ] Load `/communities` as `maria.reyes` and confirm **zero** console errors. The bug is defined
      by console output; a green unit test is not evidence it is fixed.

## Task C5: Docs for PR C

- [ ] `services/reputation-service/CONTEXT.md` — the response change and why both cases are identical
- [ ] `docs/BUGS.md` — BUG-031 fixed, **and correct its stale `api.ts:754` reference to `api.ts:746`,
      adding the missing `useCommunityData.ts:153` call site**
- [ ] `docs/IDEAS.md` — defer batching the fan-out into one request
- [ ] User guide / concept page updates if the community trust display description changes

## Task C6: Quality gates for PR C

- [ ] `/simplify` on the branch diff
- [ ] `/code-review` on the branch diff — **medium** (small, well-specified diff)
- [ ] `/security-review` on the branch diff — this changes a response that deliberately hides an
      authorization outcome; confirm the new shape leaks nothing the old one hid
- [ ] Resolve or dismiss every finding with written justification

## Task C7: Verify and open PR C

- [ ] `npx tsc --noEmit`
- [ ] `npm test` — capture the exit code separately
- [ ] `npm run feedback:check`
- [ ] Revert `apps/landing/src/data/docs/` churn
- [ ] Bump the version, read from `origin/master` at merge time
- [ ] Open the PR; stop at "green and ready"

---

## Task D: Merge and deploy

Use the `/deploy` skill. **One PR at a time**, in order A → B → C.

- [ ] Confirm no deploy is in flight: `gh run list --workflow=ci.yml --limit 3`
- [ ] Request merge authorization — an agent cannot merge here; `gh pr merge` is refused in both
      plain and `--admin` form
- [ ] After each merge: watch the **`Deploy to Demo` job**, not just the run
- [ ] After each deploy: smoke-test. `/health` is not exposed via nginx — use
      `POST /api/auth/login`, and now also `POST /api/auth/demo-session`
- [ ] Only then merge the next PR

## Task E: Close out

- [ ] Re-read `CURRENT_HANDOFF.md` end-to-end against real state (`gh pr list`, `git log`,
      current branch) and reconcile before claiming done
- [ ] Confirm the next scheduled Expo drift run is green; close issue #234
- [ ] Verify `https://karmyq.com/demo` still reaches `phase === 'active'` after all three deploys
- [ ] Archive the handoff and open a clean slate for Sprint 130
