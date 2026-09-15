# Sprint 129 Maintenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Revised 2026-09-13** — PR A Tasks A1–A5 are DONE and committed (`10600546`). BUG-040's monitor is
now in scope. Start at **Task A6**.

**Goal:** Restore the public demo and make its next failure both diagnosable and detected before a
visitor hits it; clear the dependency and security backlog to zero open alerts; silence the
`/communities` 404 storm.

**Architecture:** No new services, no schema changes, no new endpoints. One response-shape change in
reputation-service, one server-side logging channel behind an unchanged HTTP contract, one scheduled
GitHub Actions monitor modelled on `expo-sdk-drift.yml`, and dependency manifest edits.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*.

**Spec:** [`docs/superpowers/specs/2026-09-12-sprint-129-maintenance-design.md`](../specs/2026-09-12-sprint-129-maintenance-design.md)

---

## Three PRs, merged in this order

| PR | Branch | Scope | State |
|---|---|---|---|
| **A** | `feature/sprint-129-demo-session` | BUG-039 restore + diagnosability + BUG-040 monitor | **in progress** — restore done |
| **B** | `feature/sprint-129-deps` | Dependency backlog, 4 security alerts, Expo drift | not started |
| **C** | `feature/sprint-129-community-aggregate` | BUG-031 the 404 storm | not started |

**Merge one at a time** — every master push is a full deploy, and overlapping deploys 502 the demo
this sprint exists to fix.

---

## File Map

### New files to create

| File | Responsibility |
|------|---------------|
| `services/auth-service/tests/tdd/sprint-129-demo-session-logging.test.ts` | Response byte-identical across causes; reasons differ in the log |
| `services/auth-service/src/services/demoSessionSelfCheck.ts` | Startup self-check; never throws, never logs the token |
| `.github/workflows/demo-health.yml` | Scheduled monitor; fails visibly and files one labelled issue |
| `scripts/check-demo-health.js` | The assertions, as a testable module + CLI (not inline YAML) |
| `tests/regression/sprint-129-demo-health-gate.test.ts` | Proves the gate FAILS on broken/near-expiry fixtures |
| `services/reputation-service/tests/tdd/sprint-129-community-aggregate.test.ts` | Denial and absence return identical 200s |
| `docs/gotchas/demo-story-rows-expire-on-a-cleanup-timer.md` | Via the `learned` skill |
| `docs/gotchas/npm-workspace-cwd-and-shell-sourced-env.md` | Via the `learned` skill |

### Created already (commit `10600546`)

| File | Purpose |
|------|---------|
| `.env.demo.rotation.example` | Rotation env template; shell-sourced, LF, quoted, absolute paths |
| `scripts/demo/enable-demo.sh` | `DEMO_ENABLE_CMD` — idempotent, asserts its post-condition |
| `scripts/demo/restart-auth.sh` | `DEMO_RESTART_AUTH_CMD` — sources env, both compose files, health-waits |
| `.gitignore`, `.gitattributes` | `.env*` ignored except `*.example`; `.env*` pinned to LF |

### Existing files to modify

| File | Change |
|------|--------|
| `services/auth-service/src/routes/auth.ts` | Line ~252 — log `DemoSessionUnavailableError` at `warn`; response untouched |
| `services/auth-service/src/index.ts` | Wire the startup self-check |
| `services/auth-service/CONTEXT.md` | Demo config surface, self-check, BUG-039 in Recent Fixes |
| `docs/guides/demo-data.md` | Rotation is now runnable — command, env file, host scripts, 14-day warning |
| `docs/adr/ADR-084-*.md` | Amendment: opacity binds the client response, not the operator log |
| `scripts/CLAUDE.md` | Document the new `scripts/demo/` subdirectory |
| `services/reputation-service/src/routes/reputation.ts` | `denyAggregate` (line 44) → identical 200 |
| `apps/frontend/src/lib/api.ts` | `getCommunityTrust` (line 746) |
| `apps/frontend/src/pages/communities/index.tsx` | Line 124 fan-out |
| `apps/frontend/src/hooks/useCommunityData.ts` | Line 153 — second call site |
| `package.json` / `package-lock.json` | `overrides.qs` raise; possibly `decode-uri-component` |
| `apps/mobile/package.json` | 12 Expo patch bumps |
| `tests/regression/sprint-122-expo-sdk-alignment.test.ts` | `SDK_PINNED` must move with the manifest |
| `docs/BUGS.md` | BUG-031 fixed + stale reference corrected; BUG-040 closed when the monitor ships |

---

## ⚠️ Critical Implementation Notes (read before Task A6)

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

# PR A — demo: restore, diagnose, detect

## ✅ Tasks A1–A5 — DONE (commit `10600546`)

Diagnosed BUG-039 (all four story rows hard-deleted by `cleanup-service`), wired the rotation that
the design always assumed but had never been operational, ran it, and verified live: demo-session
**200**, write with demo token **403**, 16/16 state checks green. Fixed two `.gitignore` security
gaps found in flight. Filed BUG-040.

**Do not redo these.** Verify current state before continuing:

```bash
node -e "const h=require('https'),b='{}';const r=h.request({hostname:'karmyq.com',path:'/api/auth/demo-session',method:'POST',headers:{'Content-Type':'application/json','Content-Length':2}},s=>{let d='';s.on('data',c=>d+=c);s.on('end',()=>console.log(s.statusCode))});r.write(b);r.end()"
```

## Task A6: Test the logging change first (TDD)

**Files:**
- Create: `services/auth-service/tests/tdd/sprint-129-demo-session-logging.test.ts`

- [ ] **Write the failing test — assert BOTH halves together**

```ts
// The contract and the diagnosis must move together:
//  1. status === 503 and the body deep-equals today's exact ADR-074 envelope
//     ({ success:false, message:'Demo session is unavailable', error:'DEMO_UNAVAILABLE' })
//  2. the injected logger received a warn carrying the SPECIFIC reason
// Asserting only (2) would pass a version that leaks the reason to the client.
```

- [ ] **Add the indistinguishability case** — two *different* causes (disabled flag vs. persona not
      found) produce byte-identical HTTP responses but *different* log reasons. This is the whole
      design in one assertion.

- [ ] **Verify it fails for the right reason** (no reason is logged today)

```bash
cd services/auth-service && npx jest tests/tdd/sprint-129-demo-session-logging.test.ts
```

## Task A7: Log the reason

**Files:** Modify `services/auth-service/src/routes/auth.ts`

- [ ] At the catch (line ~250-266), log `DemoSessionUnavailableError` at `warn` with its message.
      Keep the existing `error`-level log for unexpected failures. **`sendError` is untouched.**

- [ ] Verify the new test passes and the Sprint 116 regressions still do

```bash
cd services/auth-service && npx jest tests/tdd/sprint-129-demo-session-logging.test.ts tests/regression/sprint-116-demo-session.route.test.ts tests/regression/sprint-116-demo-session.test.ts
```

## Task A8: Startup self-check

**Files:**
- Create: `services/auth-service/src/services/demoSessionSelfCheck.ts`
- Modify: `services/auth-service/src/index.ts`

- [ ] On boot: if `DEMO_SESSION_ENABLED === 'true'`, attempt one demo session and log the outcome;
      otherwise log once that demo sessions are disabled — so "off" is never read as "broken".
- [ ] **Must not log the issued token.** **Must never throw** — auth is Critical with 7 dependents.
- [ ] Test: a failing self-check is swallowed and never rejects

```bash
cd services/auth-service && npx jest tests/tdd/
```

## Task A9: The demo-health check module (TDD) — BUG-040

**Files:**
- Create: `scripts/check-demo-health.js`
- Create: `tests/regression/sprint-129-demo-health-gate.test.ts`

Put the logic in a module, not inline YAML — inline workflow JS cannot be unit-tested, and this gate
must be *proven* able to fail.

- [ ] **Write the failing gate test first.** Fixtures must include:

```
- healthy:            demo-session 200, stories 60 days from deletion   -> ok, no issue
- broken:             demo-session 503                                  -> FAIL + issue
- near expiry:        demo-session 200, stories 9 days from deletion    -> FAIL + issue
- boundary:           exactly 14 days                                   -> assert the chosen side
- crashed:            check throws / emits no payload                   -> FAIL + issue  (note 3)
- unreachable:        network error contacting karmyq.com               -> FAIL + issue
- already expired:    expired = TRUE, marked 3 days ago                 -> FAIL + issue  (note 18)
- clock restarted:    expired = TRUE but updated_at bumped since        -> deadline MOVED later
- never deletable:    expires_at passed while status != 'open'          -> never marked, no warning
- silent success:     exit 0 but GITHUB_OUTPUT empty                    -> FAIL + issue  (note 23)
- malformed payload:  exit 0, result present but unparseable            -> FAIL + issue  (note 23)
```

- [ ] **Implement `check-demo-health.js`.** Two assertions: `POST /auth/demo-session` returns 200,
      and the configured stories are **> 14 days** from hard deletion. Emits a result payload and an
      `issue=1|0` flag, mirroring `scripts/expo-divergences.js`.

- [ ] **Model the real deletion predicate, not `expires_at + 7 days`** — note 18. Cleanup is two
      stages and the second keys off a timestamp the first one writes:

```
mark   (hourly,  expirationJob.ts:18-22):
  UPDATE ... SET expired = TRUE, updated_at = CURRENT_TIMESTAMP
  WHERE expires_at <= now AND expired = FALSE AND status = 'open'

delete (02:00,   expirationJob.ts:84-88):
  DELETE ... WHERE expired = TRUE AND updated_at <= now - 7 days
```

So the true deadline is **mark-time + 7 days**, and mark-time is not `expires_at`: a row is only
marked while `status = 'open'`, and any later write to `updated_at` restarts the seven days.
Compute from the live row:

```
if expired = TRUE   -> deadline = updated_at + 7 days          (the real, already-running clock)
if expired = FALSE and status = 'open'
                    -> deadline ≈ expires_at + 7 days          (CONSERVATIVE: marking lags by
                                                                up to 1h, deletion by up to 24h,
                                                                so real deletion is always LATER)
if expired = FALSE and status <> 'open'
                    -> not deletable by this job; report "safe", do not warn
```

- [ ] **Label the conservative branch as conservative in the code and the issue body.** It warns
      earlier than strictly necessary, which is the safe direction; presenting it as exact is what
      the review correctly rejected.
- [ ] **Read-only. No writes to the demo** — note 4.
- [ ] **Never print the demo token** or any story UUID into logs an issue body will carry.

- [ ] Verify the gate genuinely fails on every negative fixture

```bash
cd tests && npx jest regression/sprint-129-demo-health-gate.test.ts
```

## Task A10: The scheduled workflow

**Files:** Create `.github/workflows/demo-health.yml`

- [ ] Model on `.github/workflows/expo-sdk-drift.yml`: `schedule` + `workflow_dispatch` only
      (**never `pull_request`** — a merge must not depend on karmyq.com being reachable),
      `concurrency` group, `permissions: contents: read, issues: write`.

- [ ] **Data source — DECIDED, do not defer (note 22).** The expiry half reads the live rows
      **over the SSH path CI already has**, running a read-only script inside
      `karmyq-auth-service` with the container's own `DATABASE_URL`:

```
secrets: PROD_SSH_PRIVATE_KEY, PROD_SERVER_HOST, PROD_SERVER_USER   (ci.yml:419-430, already exist)
probe:   ssh <user>@<host> 'docker exec -i karmyq-auth-service node' < scripts/check-demo-health.js
```

Rejected alternatives, recorded so this is not re-opened:
- **Add `expires_at` to a request endpoint** — the request routes never select it (only the
  unrelated `boosted_expires_at`), so this means a real API change, CONTEXT + registry updates and
  its own tests, to expose retention metadata publicly. Disproportionate.
- **Add it to the demo-session response** — directly contradicts note 1, which promises that
  contract does not change.
- **Ship `DATABASE_URL` to Actions** — a new, more dangerous secret than the one already present.

⚠️ **Security-review must cover this**: a *scheduled* workflow now exercises the deploy SSH key, which
previously only ran on a master push. The script is read-only and must stay so (note 4).

- [ ] `permissions` stays `contents: read` + `issues: write` — SSH is via secrets, not `GITHUB_TOKEN`.
- [ ] Ensure the label exists, then file **or update** a single labelled issue.

- [ ] **Any non-green outcome is issue-worthy, including a failure BEFORE the check step runs**
      — notes 3 and 19. `expo-sdk-drift.yml` gates its notify steps on `steps.check.outputs.*`
      (`:154`, `:232`, `:262`); `if:` carries an **implicit `success()`**, so a failure in checkout,
      setup-node or `npm ci` skips all of them and files nothing. Do not inherit that:

```yaml
# Every reporting step must survive an earlier failure AND a silent one.
# Default to NOTIFYING: only an explicit, well-formed `issue=0` earns silence.
- name: File or update the demo-health issue
  if: >-
    always() &&
    (failure() ||
     steps.check.outcome != 'success' ||
     steps.check.outputs.issue != '0' ||
     steps.check.outputs.result == '')
```

⚠️ **The inversion is the point — `issue != '0'`, not `issue == '1'`.** A step that exits 0 without
writing `GITHUB_OUTPUT` leaves `issue` as the empty string. Under an `issue == '1'` test that reads
false, `outcome` is `success`, and `failure()` is false — so the step is **skipped and nothing is
filed**, which is the silent pass this whole note exists to prevent. It also made the fallback body
below unreachable: the step never ran to render it.

| check state | `issue` | old condition | new condition |
|---|---|---|---|
| green | `0` | skip ✅ | skip ✅ |
| problem found | `1` | fire ✅ | fire ✅ |
| **exit 0, empty output** | `''` | **skip ❌** | **fire ✅** |
| crashed / step failed | `''` | fire ✅ | fire ✅ |
| earlier step failed | n/a | fire ✅ | fire ✅ |

- [ ] **Validate the payload's STRUCTURE before treating success as success** (note 23). A non-empty
      but malformed `result` passes the `== ''` guard. The check must parse its own payload and
      assert the expected shape — `ok`, and a per-story array with a computed deadline — and treat a
      parse failure or a missing field as `issue=1`, not as green.
- [ ] Give the check step an `id`, and have the issue body fall back to a generic "the demo-health
      check did not complete" when `steps.check.outputs.result` is empty or unparseable.
- [ ] **Fixtures for both silent-success shapes** (added to Task A9's list):

```
- exit 0, empty GITHUB_OUTPUT        -> notify step MUST fire, generic body
- exit 0, malformed/truncated payload -> notify step MUST fire, generic body
```

⚠️ The condition above follows GitHub's documented expression semantics but is **unproven by
execution** — the workflow-level fixture below is what settles it, not this table.

- [ ] **Validate before merge with fixtures, not dispatch** — note 20. `workflow_dispatch` only
      works once the workflow exists on the **default branch**, so `gh workflow run` cannot exercise
      this file while PR A is open. Pre-merge evidence is Task A9's regression suite plus a YAML
      parse check:

```bash
# Run jest in a SUBSHELL: a bare `cd tests &&` leaves the shell there, and the next line's
# .github/ path then resolves to tests/.github/ and silently finds nothing.
# Verified: from tests/, existsSync('.github/workflows/expo-sdk-drift.yml') === false.
(cd tests && npx jest regression/sprint-129-demo-health-gate.test.ts)
node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/demo-health.yml','utf8'));console.log('workflow YAML parses')"
```

`js-yaml` resolves from the repo root (4.3.2, verified) — but **a successful parse is not a passing
workflow**. It proves the file is well-formed YAML, nothing about whether the `if:` expression is
correct.

- [ ] **Also add a failure-path fixture at the workflow level**, not only the module's `issue=1`
      result: assert the notify step's `if:` expression still evaluates true when the check step
      did not succeed. A unit test of `check-demo-health.js` cannot catch an implicit-`success()`
      skip — that bug lives in the YAML.

- [ ] **Dispatch verification moves to Task E, after merge and deploy** (see Task E).

## Task A11: Docs for PR A

- [ ] `docs/adr/ADR-084-*.md` — "Amendment (Sprint 129)": opacity binds the client-facing response;
      operator-side logging is not a violation. Keep the ADR's status.
- [ ] `docs/guides/demo-data.md` — **rotation is now runnable**: the env file, the two host scripts,
      the exact command, and the 14-day warning. Correct the implication it was already operational.
- [ ] `services/auth-service/CONTEXT.md` — the six `DEMO_*` vars, flag defaults **off**, self-check,
      reason log, BUG-039 in "Recent Fixes".
- [ ] `scripts/CLAUDE.md` — the new `scripts/demo/` subdirectory.
- [ ] Two gotchas via the `learned` skill (see File Map).
- [ ] `docs/BUGS.md` — close **BUG-040** once the monitor ships.
- [ ] `docs/IDEAS.md` — defer "resolve the demo story by query instead of five stored UUIDs".

## Task A12: Quality gates for PR A

- [ ] `/simplify` on the branch diff
- [ ] `/code-review` on the branch diff — **high** (the diff is now substantial: shell scripts, a
      workflow, a logging change on a security-sensitive endpoint)
- [ ] `/security-review` on the branch diff — must confirm: no reason string or token can reach the
      client; the monitor cannot write; no secret reaches the issue body or CI logs; the `.gitignore`
      change actually covers every env file
- [ ] Resolve or dismiss every finding with written justification

## Task A13: Verify and open PR A

- [ ] `npx tsc --noEmit` in `services/auth-service`
- [ ] `npm test` — **capture the exit code separately**; `| tail` masks it
- [ ] `npm run feedback:check`
- [ ] **Syntax-check every shipped script — one file per invocation** (note 21)

```bash
# `bash -n a.sh b.sh` checks ONLY a.sh; the rest become positional parameters to it.
# Verified by reproduction: `bash -n good.sh bad.sh` exits 0 while `bash -n bad.sh` exits 2.
rc=0
for f in scripts/demo/*.sh; do bash -n "$f" || rc=1; done
node --check scripts/check-demo-health.js || rc=1
[ "$rc" -eq 0 ] && echo "all scripts parse" || { echo "SYNTAX FAILURE"; exit 1; }
```
- [ ] Revert `apps/landing/src/data/docs/` churn
- [ ] Confirm no `.env*` file except `*.example` is staged
- [ ] Bump the version, read from `origin/master` at merge time
- [ ] Open the PR; **stop at "green and ready"** — an agent cannot merge here

---

# PR B — Dependencies, security alerts, Expo drift

## Task B1: Branch and baseline

- [ ] Branch from freshly fetched `origin/master` **after PR A has merged and deployed**
- [ ] Record the live alert set to prove against at the end

```bash
gh api repos/ravichavali/karmyq/dependabot/alerts --paginate \
  -q '.[] | select(.state=="open") | "\(.security_advisory.severity)\t\(.dependency.package.name)\t\(.dependency.manifest_path)"' | sort
```

Expect four: the `@faker-js/faker` high in `scripts/`, two `qs`, one `decode-uri-component`.

## Task B2: Expo SDK drift (issue #234)

- [ ] Bump all twelve `expo-*` packages one patch each
- [ ] **Move `SDK_PINNED` in the same commit** — note 9
- [ ] Re-resolve the lockfile **surgically** — note 7
- [ ] Leave `security/expo-divergences.json` alone — note 8

```bash
cd apps/mobile && EXPO_NO_TELEMETRY=1 npx expo install --check
node scripts/expo-divergences.js
npm ls decode-uri-component --all   # did expo-router move query-string?
```

Record that last answer — Task B4 depends on it.

## Task B3: `qs` — raise the existing override

- [ ] `overrides.qs` `">=6.15.2"` → `">=6.16.0"` **in place** — note 5
- [ ] Prove the resolved version, not the manifest

```bash
npm ci && npm ls qs --all
```

## Task B4: `decode-uri-component`

- [ ] **If B2 already resolved it to ≥0.5.0, do nothing and record why** — a dead override would
      later trip the audit gate as unmatched.
- [ ] Otherwise add it and **prove it reaches the `apps/mobile` subtree** — note 6
- [ ] Fallback if the root override does not reach it: bump `query-string` inside `apps/mobile`

## Task B5: `@faker-js/faker` — the high, past SLA

- [ ] Take PR #216: `scripts/package-lock.json`, 8.4.1 → 10.5.0
- [ ] **Two majors** — verify the scripts that import faker still run; `helpers.fake` is the
      vulnerable surface and its signature may have moved

```bash
grep -rn "faker" scripts/ --include=*.js --include=*.ts | grep -v package-lock | head -20
```

## Task B6: Merge the six safe PRs

- [ ] Re-read each dependency table before taking it — a Dependabot PR can be force-updated after opening
- [ ] #223, #231, #217, #216, #212, #211
- [ ] Where this branch already carries the change, **close the PR with a comment** rather than
      merging a duplicate

## Task B7: Triage the seven majors

- [ ] One-sentence comment on each: why held, what unblocks it — #229 `next` 16, #227 `zod` 4,
      #225 `node-fetch` 3 (ESM-only), #224 `express-rate-limit` 8, #226 `dotenv` 17,
      #228 `node-cron` 4, #230 `expo-server-sdk` 7
- [ ] Record the `eslint-config-next` 16.x / `next` 15.x mismatch (on #229 or in `docs/IDEAS.md`)

## Task B8: Docs for PR B

- [ ] Update any service `CONTEXT.md` whose dependencies changed
- [ ] `npm run analyze:services` — dependencies changed
- [ ] Close issue #234 once the drift workflow is green

## Task B9: Quality gates for PR B

- [ ] `/simplify` · `/code-review` **high** (large diff, dependency surface) · `/security-review`
- [ ] Resolve or dismiss every finding with written justification

## Task B10: Verify and open PR B

- [ ] **Strict `npm ci` from clean** — the only thing that catches `apps/*` half-resolution

```bash
rm -rf node_modules && npm ci
```

- [ ] `npx tsc --noEmit` across changed workspaces; `npm test` (exit code captured separately)
- [ ] **Prove zero open alerts against the live API**

```bash
gh api repos/ravichavali/karmyq/dependabot/alerts --paginate -q '[.[] | select(.state=="open")] | length'
```

- [ ] Revert landing-docs churn; bump the version at merge time; open the PR

---

# PR C — BUG-031: the `/communities` 404 storm

## Task C1: Branch and test first (TDD)

**Files:** Create `services/reputation-service/tests/tdd/sprint-129-community-aggregate.test.ts`

- [ ] Branch from freshly fetched `origin/master` **after PR B has merged and deployed**

- [ ] **Read the corrected diagnosis first** (note 10). `denyAggregate` is reached from exactly one
      place — `reputation.ts:171`, `if (!access.allowed)`. The "not yet computed" case does **not**
      reach it: `reputation.ts:180-185` calculates on demand and returns **200**. So every one of
      BUG-031's 404s is an **authorization denial**, and the fix is about denial only.

- [ ] **Write the failing test — indistinguishability across all THREE denial causes**

```ts
// checkAggregateAccess (utils/disclosureAuth.ts:74-82) returns allowed:false for
//   (a) unknown community      -> getActiveMembership finds nothing
//   (b) caller not an active member
//   (c) cohort < MIN_AGGREGATE_COHORT
// Its docstring is explicit: "the caller is never told which, so we do not leak community
// existence or size." All three MUST stay byte-identical after this change.
// Assert deep-equality BETWEEN the three responses, not merely that each is 200.
```

- [ ] ⚠️ **Do NOT add a 404-for-unknown-community case.** An earlier draft of this plan required
      404 for unknown and 200 for denied; that would make existence observable and **introduce**
      the leak `disclosureAuth.ts` exists to prevent. Unknown is one of the denial causes, not a
      separate outcome.

- [ ] Add a case proving a *permitted* caller with a real aggregate still receives it unchanged

## Task C2: Change the response

- [ ] `denyAggregate` (`reputation.ts:44`) → `200` with `{ success: true, data: null }` *(shipped shape; `{ aggregate: null }` was truthy and broke `StewardRequestsAdmin`)*.
      It is the single shared exit for all three denial causes, so changing it in one place keeps
      them identical by construction — do not branch inside it.
- [ ] **Grep every call site** — do not assume `community-trust` is the only one; each one must be
      re-checked for whether a 200-with-null is correct there too

```bash
grep -rn "denyAggregate\|checkAggregateAccess" services/reputation-service/src
```

- [ ] Confirm no caller distinguishes the three causes downstream (logs, metrics, error mapping)

## Task C3: Frontend — both call sites

- [ ] `api.ts:746` — consume the null shape. The interceptor already unwraps: `res.data`, not
      `res.data.data`.
- [ ] `communities/index.tsx:124` — fan-out renders the empty state without erroring
- [ ] `useCommunityData.ts:153` — the second call site — note 11
- [ ] Frontend tests: renders with a null aggregate; no error logged

## Task C4: Verify the storm is gone

- [ ] Load `/communities` as `maria.reyes` and confirm **zero** console errors. The bug is defined by
      console output; a green unit test is not evidence.

## Task C5: Docs for PR C

- [ ] `services/reputation-service/CONTEXT.md` — the change and why both cases are identical
- [ ] `docs/BUGS.md` — BUG-031 fixed, **and correct `api.ts:754` → `api.ts:746`, adding the missing
      `useCommunityData.ts:153` call site**
- [ ] `docs/IDEAS.md` — defer batching the fan-out
- [ ] Guide/concept updates if the trust display description changes

## Task C6: Quality gates for PR C

- [ ] `/simplify` · `/code-review` **medium** (small, well-specified) · `/security-review` — this
      changes a response that deliberately hides an authorization outcome; confirm the new shape
      leaks nothing the old one hid
- [ ] Resolve or dismiss every finding with written justification

## Task C7: Verify and open PR C

- [ ] `npx tsc --noEmit`; `npm test` (exit code captured separately); `npm run feedback:check`
- [ ] Revert landing-docs churn; bump the version at merge time; open the PR

---

## Task D: Merge and deploy

Use the `/deploy` skill. **One PR at a time**, A → B → C.

- [ ] Confirm no deploy is in flight: `gh run list --workflow=ci.yml --limit 3`
- [ ] Request merge authorization — an agent cannot merge here
- [ ] After each merge, watch the **`Deploy to Demo` job**, not just the run
- [ ] Smoke-test after each: `/health` is not exposed via nginx — use `POST /api/auth/login` **and
      `POST /api/auth/demo-session`**
- [ ] Only then merge the next

## Task E: Close out

- [ ] Re-read `CURRENT_HANDOFF.md` end-to-end against real state and reconcile before claiming done
- [ ] **Dispatch and verify the demo-health workflow — only possible now** (note 20): it must be on
      the default branch before `workflow_dispatch` is available. Verify the **specific completed
      run**, not merely that a run appears:

```bash
gh workflow run demo-health.yml
sleep 60
run_id=$(gh run list --workflow=demo-health.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$run_id" --exit-status && echo "demo-health green (run $run_id)"
```

- [ ] **Prove it can still fail after merge.** A green gate that cannot fail is worse than no gate:
      re-run the Task A9 negative fixtures against the merged code, or temporarily point the check
      at an unreachable base URL via `workflow_dispatch` input and confirm an issue is filed.
- [ ] Close **BUG-040** only once both the green run and the can-fail evidence exist
- [ ] Confirm the Expo drift run is green; close issue **#234**
- [ ] Verify `https://karmyq.com/demo` still reaches `phase === 'active'` after all three deploys
- [ ] Archive the handoff and open a clean slate for Sprint 130
