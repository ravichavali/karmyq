# Sprint 122: Dependency Wave + Test-Tier Truth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship express 4 → 5, make the test tier's cache keys honest, and disposition all 9 open
dependency PRs — 6 merged, 3 closed with rationale.

**Architecture:** Nothing new is built. Express 5 changes runtime semantics under 197 existing route
literals across 9 Express backends; `turbo.json`'s `test` inputs change what the cache considers a
different run; two new blocking regression gates pin lint-config resolution and Expo SDK alignment.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 15, React Native + Expo SDK 57, PostgreSQL 15,
Bull queue, Turborepo.

**Shell:** All commands below are **PowerShell** (this repo's primary shell on Windows). Do not
paste POSIX `for` loops, subshells, `tail`, `/dev/null` or `||` idioms.

**Design spec:** [`2026-07-29-sprint-122-dependency-wave-test-truth-design.md`](../specs/2026-07-29-sprint-122-dependency-wave-test-truth-design.md)

---

## Scope of THIS plan file

**Tasks 1–11 below are PR 1 (express 4 → 5, v11.36.0)** — the immediately executable work.

**PRs 2, 4, 5 and 6 are execution-ready** and get their own plan files at the start of their own
chats, per CLAUDE.md's multi-PR sprint cadence. Their scope, version and gate level are fixed in the
Plan of Record.

**⚠️ PR 3 is NOT execution-ready.** It is blocked on three maintainer decisions recorded in its
outline below. Do not start it until those are decided and written into this file.

---

## File Map (PR 1)

### New files to create
| File | Responsibility |
|------|---------------|
| `tests/regression/sprint-122-express5-contract.test.ts` | The two things no existing test can see: that **Express itself** resolves `body-parser` 2.x, and that `req.query` is genuinely an accessor (not merely readable) |

**No new geocoding test file.** `services/geocoding-service/tests/regression/geocodingRoutes.test.js`
already exists and already mounts the real `createApp` through supertest, asserting the ADR-074
envelope and reading `req.query.q`. Per "update, don't create," **extend that file** — see Task 2.

### Existing files to modify
| File | Change |
|------|--------|
| `package.json` (root) | `express` `^4.18.2` → `^5.2.1`; `overrides.body-parser` `"1.20.6"` → range-scoped selector or removed; `version` `11.35.1` → `11.36.0` |
| `package-lock.json` | Surgical in-place resolution of the express subtree **and repair of the pre-existing `version` drift** (see Task 3) |
| **`packages/shared/package.json`** | **`peerDependencies.express` `^4.18.0` → `^5.0.0`** (the contract this PR would otherwise invalidate) — and `@types/express` `^4.17.21` → `^5.0.6` |
| `packages/shared/middleware/{auth,dbContext,rateLimit,tenant,validate}.ts` | `@types/express` 5 signature fallout, if any |
| `services/*/package.json` | `@types/express` `^4.17.21` → `^5.0.6` where declared |
| `services/geocoding-service/package.json` | `express` `^4.18.2` → `^5.2.1` (declares it directly) |
| `services/geocoding-service/tests/regression/geocodingRoutes.test.js` | Extended with the express 5 body-parsing + route-matching cases |
| `services/*/src/**/*.ts` | Only where express 5 type/semantic fallout is real — expect few or none |
| `CLAUDE.md` | Tech-stack drift: **"Next.js 14" → Next.js 15**; confirm the Express reference |
| `docs/ARCHITECTURE.md` | Express 5 baseline |
| `apps/landing/src/data/docs/architecture.json` | Regenerated from `docs/ARCHITECTURE.md` (`git add -f` — gitignored but tracked) |
| `packages/shared/CONTEXT.md` | The express peer range change; `@types/express` 5 signatures; the `express-rate-limit` 7/8 split |
| `services/*/CONTEXT.md`, `services/registry.json` | Dependency deltas per changed service |
| `.claude/handoff/CURRENT_HANDOFF.md` | Progress, every task |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **⚠️ `overrides.body-parser: "1.20.6"` will break express 5.** express `5.2.1` depends on
   `body-parser ^2.2.1`, but the root override is **unscoped**, so it forces `1.20.6` tree-wide —
   into express 5's own tree. Express 5 calls body-parser 2's API. Convert the override to a
   range-scoped selector (the shape already used for `ws@8.0.0 - 8.20.0`, `form-data@4.0.0 - 4.0.5`,
   `sharp@<0.35.0`), or drop it once nothing resolves body-parser 1. **Prove it by resolving
   `body-parser` from Express's own location, not from the test file** (Task 2) — a bare
   `require('body-parser/package.json')` finds whatever the *caller* resolves, which can be a
   different copy than the one Express uses.
   **Safety net:** `express.json()` *is* body-parser and is called in all 9 service entrypoints plus
   **46 test files**, so the regression suites will catch a break. Use both proofs, not either.

2. **⚠️ `packages/shared` DOES declare Express — as a peer.**
   `packages/shared/package.json` carries `"peerDependencies": { "express": "^4.18.0" }`. Bumping the
   provider to Express 5 without moving this leaves `@karmyq/shared` — consumed by **6 services and
   `apps/frontend`** — declaring a contract nothing in the repo satisfies.
   **Decision: set it to `^5.0.0`, not a dual `^4.18.0 || ^5.0.0` range.** The repo has exactly one
   Express provider (the root production dependency), so after this PR no build, test or image
   exercises Express 4 anywhere — a dual range would advertise support that is never verified, which
   is precisely the kind of decorative claim this sprint exists to remove. If a dual range is
   preferred instead, it must be **verified**, not asserted: that means actually running
   `packages/shared`'s suite against both majors.
   *(Aside, do not fix here: `apps/frontend` consumes `@karmyq/shared` without providing Express at
   all, so this peer is already unsatisfied there and `.npmrc`'s `legacy-peer-deps=true` silences it.
   Pre-existing; out of scope.)*

3. **✅ Express 5's most common blocker is ABSENT — verified.** All **197 unique route path literals**
   across `services/`, `packages/` and `apps/frontend` contain **zero** `*`, `?`, `(` or `)`, so
   `path-to-regexp` 8's syntax break does not apply. Also **zero** occurrences repo-wide of:
   `req.query =` assignment, `req.param(`, `res.sendfile`, `app.del(`, `res.json(status, body)`,
   `req.host`, `res.redirect('back')`, `express.urlencoded`. The remaining risk is **runtime
   semantics**, not syntax.

4. **The rest of the express surface, corrected.**
   - Root `package.json` declares `express ^4.18.2` as a **production** dependency — that is how all
     9 Express backends get it (Dockerfiles copy the root manifest, `npm install --omit=dev`).
   - `packages/shared`'s five middleware files live at `packages/shared/middleware/` — **outside
     `src/`** — and import `Request`/`Response`/`NextFunction` as types only.
   - **`services/geocoding-service/src` is plain JavaScript** (`geocodingApp.js`,
     `geocodingService.js`, `response.js`) and declares `express` directly, so it gets **no `tsc`
     coverage**. It is **not** untested, though: `tests/regression/geocodingRoutes.test.js` mounts
     the real app through supertest. The gap is *type* coverage, not test coverage — so the work is
     to **extend** that suite, not to write a new one.
   - **111 source files import from `'express'`**, overwhelmingly for types.

5. **Express 5 semantic changes that matter here**, most likely to bite first: `async` handler
   rejections are now forwarded to the error middleware automatically; `res.status()` **throws
   `RangeError`** on an out-of-range code; `req.query` is a **getter**; `res.clearCookie` ignores
   `maxAge`/`expires`.
   **⚠️ Do not assume auto-forwarding is observable everywhere.** `geocodingApp.js` has **no error
   middleware at all** — every route try/catches internally and returns via `sendError`. So in that
   service the ADR-074 envelope comes from the route's own catch, and there is no express error
   handler for a rejection to reach. Check for an error middleware before writing any test that
   claims to exercise one.

6. **⚠️ The lockfile's version field is ALREADY drifted, and the naive task order re-breaks it.**
   `package.json` reads `11.35.1` while `package-lock.json` records **`11.34.0`** in *both*
   `.version` and `.packages[""].version` — S121's PR 5 and hotfix never carried the bump into the
   lock. Task 3 therefore bumps the manifest **before** any lockfile work, so the single resolution
   in Task 4 lands `11.36.0` in all three places at once. **Assert all three afterwards.**

7. **`express-rate-limit` is split across majors and express 5 does not force alignment.** Root
   `^8.2.2` (peer `express: ">= 4.11"`), `packages/shared` `^7.1.5` (peer
   `express: "4 || 5 || ^5.0.0-beta.1"`) — both accept express 5. Note it; do **not** fix it in this
   PR. (`packages/shared` also declares `zod ^3.22.4` vs root `^4.1.12` — same class, same answer.)

8. **`npm audit` baseline is `found 0 vulnerabilities`.** Advisories publish mid-flight — four times
   across S120–121. Signature: `Security Audit` **and** `sprint-75-security-gate` red **together** on
   a diff that touches no dependencies. Check for a new advisory before debugging; remediate with a
   surgical in-place bump; **re-check immediately before merging**, not just when CI last ran.

9. **Standing mechanics:** surgical in-place lockfile bumps only — never `npm dedupe`, never a scratch
   regen on Windows, never a root **prod** dep added to force hoisting; run the **edge-vs-node** check
   before pushing and diff against `origin/master` so the ~26 deliberate `overrides` mismatches don't
   drown the real finding; branch off `origin/master`, never local master; **explicit admin
   authorization for the squash merge**; no docs-only master pushes; run cross-workspace suites
   **directly** because Turbo caches stale cross-workspace passes — **that bug is not fixed until
   PR 2**; `npm test` regenerates landing docs, so revert timestamp/HEAD-sha churn before committing;
   grep-verify `nav.json` after any landing regen.

10. **There are 9 Express backends, not 10.** `services/registry.json` lists 10 services, but
    `simulation-service` has **`"health_check": null`**, is dev-only, and has no Express usage. Every
    "all services" check in this plan means **the 9 registry entries with a non-null `health_check`**:
    auth (3001), community (3002), request (3003), reputation (3004), notification (3005), messaging
    (3006), cleanup (3008), geocoding (3009), social-graph (3010).

11. **A green pipeline is not the bar.** A merge fans out into three master runs — `Tests`, `CodeQL`,
    `CI/CD Pipeline` — and **only `CI/CD Pipeline` has a `Deploy to Demo` job**. Confirm that run
    reached `Deploy to Demo` = success with no rollback, **then** smoke-test the live site.

---

## Task 1: Confirm the branch and capture baselines

**Files:**
- Modify: none (measurement only)

- [ ] **`deps/sprint-122-pr1-express` already exists and carries the planning commit — check it out,
      do not re-cut it.** It was created from `deps/sprint-121-pr6-express`'s tip so that branch's two
      `docs(handoff)` commits are retained (they were never on master). Its code tree is identical to
      `origin/master` (`e187c5d6`); the only deltas are documentation. Confirm that before changing
      anything, so any later code diff is unambiguously yours. **Leave the superseded S121 branch
      alone** — deleting it is not part of this PR.

```powershell
git fetch origin
git checkout deps/sprint-122-pr1-express
git log --oneline -3
git diff --stat origin/master -- ':!*.md' ':!.claude'   # must print nothing
```

- [ ] **Capture the baselines this PR will be judged against.** The bar is *no regression*, not
      green — several tiers are red on master by design.

```powershell
npm audit --audit-level=moderate 2>&1 | Select-Object -Last 3   # expect: found 0 vulnerabilities
node -p "require('./node_modules/express/package.json').version"   # 4.22.2
node -p "const l=require('./package-lock.json'); l.version + ' / ' + l.packages[''].version"   # 11.34.0 / 11.34.0 (drifted)
npx tsc --noEmit -p packages/shared 2>&1 | Select-Object -Last 3
Push-Location tests; npx jest unit regression 2>&1 | Select-Object -Last 8; Pop-Location   # expect 278/278
```

- [ ] **Baseline each of the 9 Express service suites DIRECTLY, not through Turbo.** Turbo's
      cross-workspace cache is untrustworthy until PR 2 lands; a cached pass here would poison the
      comparison.

```powershell
$services = @('auth-service','community-service','request-service','reputation-service',
              'notification-service','messaging-service','social-graph-service',
              'cleanup-service','geocoding-service')
foreach ($s in $services) {
  Write-Host "=== $s ==="
  Push-Location "services/$s"
  npx jest 2>&1 | Select-Object -Last 4
  Pop-Location
}
```

- [ ] **Verification:** baselines recorded in the handoff — including the drifted lock version —
      before a single dependency line changes.

---

## Task 2: Write the express 5 regression tests FIRST (TDD)

**Files:**
- Create: `tests/regression/sprint-122-express5-contract.test.ts`
- Modify: `services/geocoding-service/tests/regression/geocodingRoutes.test.js`

These cover exactly what nothing else can see. They go straight into `regression/` because they
guard a known upgrade regression, which is this repo's definition of a regression test.

- [ ] **Cross-workspace contract test — two assertions, both precise.** Assert on real behaviour, no
      stubs for the thing under test.

```ts
// tests/regression/sprint-122-express5-contract.test.ts
import { createRequire } from 'module';
import express from 'express';
import request from 'supertest';

describe('Sprint 122 — express 5 runtime contract', () => {
  it('EXPRESS resolves body-parser 2.x (not the override-pinned 1.20.6)', () => {
    // Resolve from Express's own location. A bare require() here would report whichever
    // copy THIS file resolves, which can differ from the one Express actually loads.
    const requireFromExpress = createRequire(require.resolve('express'));
    const bodyParser = requireFromExpress('body-parser/package.json') as { version: string };
    expect(bodyParser.version).toMatch(/^2\./);
  });

  it('parses a JSON body end-to-end through express.json()', async () => {
    const app = express();
    app.use(express.json());
    app.post('/echo', (req, res) => { res.json({ got: req.body }); });
    const res = await request(app).post('/echo').send({ a: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ got: { a: 1 } });
  });

  it('req.query is an ACCESSOR on the request prototype, not a writable own property', async () => {
    // Express 4 assigns req.query as a plain writable own property in the query middleware.
    // Express 5 defines a getter on the request prototype with no setter. Merely READING
    // req.query passes under both, so the descriptor is what actually distinguishes them.
    let descriptor: PropertyDescriptor | undefined;
    let assignmentError: unknown = null;
    const app = express();
    app.get('/q', (req, res) => {
      descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(req), 'query');
      try { (req as unknown as { query: unknown }).query = { hacked: true }; }
      catch (e) { assignmentError = e; }
      res.json({ q: req.query });
    });

    const res = await request(app).get('/q?x=1&y=2');

    expect(descriptor).toBeDefined();
    expect(typeof descriptor!.get).toBe('function');
    expect(descriptor!.set).toBeUndefined();
    expect(descriptor!.writable).toBeUndefined();
    expect(assignmentError).toBeInstanceOf(TypeError);   // setter-less accessor, strict mode
    expect(res.body.q).toEqual({ x: '1', y: '2' });      // and reading still works
  });
});
```

- [ ] **Extend the EXISTING geocoding regression suite** — do not create a second file. It already
      mounts `createApp` through supertest and asserts the ADR-074 envelope on the `INVALID_QUERY`
      path, which means it already exercises `req.query.q` and `path-to-regexp` route matching under
      whatever Express is installed. Add the two cases it lacks:
      - **`POST /cache` with a real JSON body**, proving `express.json()` populated `req.body` (the
        route reads `req.body.query` / `req.body.results`). This is the geocoding-side body-parser
        proof, and it is the only one that runs against the real app.
      - **`GET /health` returns 200** with `status: 'healthy'` — the cheapest possible route-table
        smoke for path-to-regexp 8.
      **Do NOT write a test claiming an async rejection reaches an express error handler here:**
      `geocodingApp.js` has no error middleware (Critical Note 5). Its 500s come from each route's own
      `catch` calling `sendError`, and the existing suite's envelope assertions already cover that
      shape.

- [ ] **Verification — confirm the tests are wired to something real before the bump.** On express 4
      the body-parser assertion and the descriptor assertions **must FAIL**; that failure is the proof.

```powershell
Push-Location tests; npx jest regression/sprint-122-express5-contract --no-coverage; Pop-Location
Push-Location services/geocoding-service; npx jest tests/regression/geocodingRoutes; Pop-Location
```

---

## Task 3: Bump the version FIRST and repair the pre-existing lockfile drift

**Files:**
- Modify: `package.json` (root)

Ordering is deliberate — see Critical Note 6. Doing this before any dependency work means the single
lockfile resolution in Task 4 carries the version into the lock, instead of leaving it drifted again.

- [ ] **Set root `package.json` `version` to `11.36.0`.** Decided in the Plan of Record; do not leave
      it TBD. S121 PR 3 shipped without a bump for exactly this reason and the fix had to ride the
      next PR.

- [ ] **Record the pre-existing drift in the handoff** so the repair is visible in review rather than
      looking like incidental churn: the lock has said `11.34.0` since PR 4 while the manifest moved
      twice (`11.35.0`, `11.35.1`). This PR closes that gap as a side effect of doing the order right.

- [ ] **Verification:** manifest reads `11.36.0`; the lock still reads `11.34.0` at this point (it is
      repaired by Task 4's resolution, and asserted there).

```powershell
node -p "require('./package.json').version"
```

---

## Task 4: Fix the body-parser override, move the shared peer, bump express

**Files:**
- Modify: `package.json` (root), `packages/shared/package.json`,
  `services/geocoding-service/package.json`, `services/*/package.json`, `package-lock.json`

- [ ] **Fix `overrides.body-parser` FIRST, before touching express**, so any failure is
      attributable. Establish *why* the override exists before changing it, then scope it to the
      vulnerable 1.x line only so express 5's `^2.2.1` resolves untouched.

```powershell
git log -S'"body-parser"' --oneline -- package.json
```

```jsonc
// root package.json — overrides
"body-parser@<1.20.6": "1.20.6",   // was: "body-parser": "1.20.6" (unscoped — would capture 2.x)
```

- [ ] **Move `packages/shared`'s Express peer** — the contract this PR would otherwise invalidate
      (Critical Note 2):

```jsonc
// packages/shared/package.json
"peerDependencies": { "express": "^5.0.0" }   // was "^4.18.0"
```

- [ ] **Bump express and `@types/express`**: root `express` → `^5.2.1`;
      `services/geocoding-service` `express` → `^5.2.1`; `@types/express` → `^5.0.6` in root,
      `packages/shared`, and every service that declares it.

- [ ] **Resolve the lockfile surgically** and prove stability.

```powershell
npm install --package-lock-only
git diff --stat package-lock.json
npm install --package-lock-only     # second run must produce no further change
git diff --stat package-lock.json
```

- [ ] **Verification — the three proofs this task exists for.**

```powershell
# 1. Note 1: Express's own tree must carry body-parser 2.x
npm ls body-parser
node -p "const {createRequire}=require('module'); createRequire(require.resolve('express'))('body-parser/package.json').version"

# 2. Note 6: version now consistent in all THREE places
node -p "const l=require('./package-lock.json'); JSON.stringify({manifest:require('./package.json').version, lock:l.version, lockRoot:l.packages[''].version})"

# 3. express 5 installed, peer satisfied, audit clean
npm ls express
node -p "require('./packages/shared/package.json').peerDependencies.express"
npm audit --audit-level=moderate 2>&1 | Select-Object -Last 3
```

```powershell
# and the Task 2 assertions that were RED on express 4 must now be GREEN
Push-Location tests; npx jest regression/sprint-122-express5-contract; Pop-Location
```

---

## Task 5: Type-check fallout across the 111 express importers

**Files:**
- Modify: `packages/shared/middleware/*.ts` and any `services/*/src/**/*.ts` the compiler flags

- [ ] **Type-check every workspace that imports express.** `@types/express` 5 tightens
      `Request`/`Response` generics and retypes `req.query`; handler signatures that relied on the
      looser v4 types are where errors land.

```powershell
npx tsc --noEmit -p packages/shared
$tsServices = @('auth-service','community-service','request-service','reputation-service',
                'notification-service','messaging-service','social-graph-service','cleanup-service')
foreach ($s in $tsServices) {
  Write-Host "=== $s ==="
  Push-Location "services/$s"
  npx tsc --noEmit 2>&1 | Select-Object -Last 5
  Pop-Location
}
```

- [ ] **Do not widen types to silence errors.** If a handler's request shape was wrong, fix the
      shape. `as any` in a middleware signature is a finding, not a fix.

- [ ] **Verification:** every TS workspace type-checks with **0 new errors** versus Task 1's
      baseline. `geocoding-service` is JS and reports nothing — expected, which is why Task 2 extends
      its runtime suite instead.

---

## Task 6: Run every affected suite directly and prove no regression

**Files:**
- Modify: whatever the failures demand

- [ ] **Run all 9 Express service suites plus `packages/shared` and `tests` directly** (not via
      Turbo — Note 9) and diff against Task 1's baselines.

```powershell
Push-Location packages/shared; npx jest 2>&1 | Select-Object -Last 5; Pop-Location
$services = @('auth-service','community-service','request-service','reputation-service',
              'notification-service','messaging-service','social-graph-service',
              'cleanup-service','geocoding-service')
foreach ($s in $services) {
  Write-Host "=== $s ==="
  Push-Location "services/$s"
  npx jest 2>&1 | Select-Object -Last 5
  Pop-Location
}
Push-Location tests; npx jest unit regression 2>&1 | Select-Object -Last 8; Pop-Location
```

- [ ] **Treat these two failure shapes as noise, not as your diff** (both documented): the Windows
      Turbo timeout flake — confirm by running the package directly; and the `feed-dibs` privacy
      timestamp flake, whose digit regex false-fires on millisecond timestamps ~2/1000 runs. A lone
      CI red on that test means rerun, not debug.

- [ ] **Verification:** every suite matches or beats its baseline, and both Task 2 additions pass.

---

## Task 7: Docs — drift repairs and the feedback loop

**Files:**
- Modify: `CLAUDE.md`, `docs/ARCHITECTURE.md`, `apps/landing/src/data/docs/architecture.json`,
  `packages/shared/CONTEXT.md`, `services/*/CONTEXT.md`, `services/registry.json`

- [ ] **Fix the CLAUDE.md tech-stack drift found during planning:** § System Architecture reads
      **"Next.js 14"** while both apps run `^15.5.21`. Correct it and confirm the Express reference
      still reads true after the 4 → 5 move.

- [ ] **Update `docs/ARCHITECTURE.md`** for the express 5 baseline, then regenerate the landing
      artifact and force-add it (`apps/landing/src/data/docs/` is gitignored but tracked).

```powershell
npm run generate:docs
git add -f apps/landing/src/data/docs/architecture.json
git checkout -- apps/landing/src/data/docs/build.json   # pure timestamp/HEAD-sha churn
git diff --stat apps/landing/src/data/docs/nav.json     # grep-verify nav.json did not revert
```

- [ ] **Update `packages/shared/CONTEXT.md`** — the Express **peer range** change (4 → 5) is the
      headline, since 6 services and `apps/frontend` consume this package; plus `@types/express` 5
      middleware signatures, and a note recording the `express-rate-limit` 7/8 and `zod` 3/4 splits
      as known, deliberate and out of scope.

- [ ] **Update each changed service's `CONTEXT.md`** ("Recent Fixes") and `services/registry.json`
      dependency lists, then regenerate the graph.

```powershell
npm run analyze:services
npm run feedback:check
```

- [ ] **Verification:** `feedback:check` lists no outstanding CONTEXT/registry to-dos for this diff,
      and the doc-context drift gate passes when run directly.

```powershell
Push-Location tests; npx jest regression/doc-context-drift-gate.test.ts; Pop-Location
```

---

## Task 8: SDLC quality gates — all four, calibrated to HIGH

**Files:**
- Modify: whatever the findings demand

This PR is a runtime major across 9 backends. Per the standing calibration it reviews at **HIGH**.
Run the gates **inline** (the S121 PR 3/PR 5 precedent), not via sub-agents.

- [ ] **`/simplify`** on the branch diff. One pass — the diff is mostly manifests. Apply the fixes;
      record every skip with its reason.

- [ ] **`/code-review` at HIGH.** Point it at the four places a defect can hide invisibly: the
      body-parser override resolution, `packages/shared`'s peer contract and its consumers, the
      untyped `geocoding-service`, and any handler whose error path changed shape now that async
      rejections auto-forward (the ADR-074 envelope must survive). Resolve correctness findings before
      merge; justify dismissals in writing.

- [ ] **`/security-review`** on the branch diff. Express 5 changes request parsing and error
      propagation — check that no error path now leaks a stack trace or internal message through the
      envelope's `message` field, and audit every added lockfile `resolved` URL for
      `registry.npmjs.org` + integrity + `hasInstallScript: false` (ADR-061's `ignore-scripts=true`
      makes install scripts a real signal).

- [ ] **Testing gate** — Tasks 2 and 6 are the testing gate; confirm it, don't re-run blindly.

- [ ] **Verification:** each gate's findings are listed in the handoff as fixed or
      dismissed-with-reason. An unaddressed correctness finding blocks the merge.

---

## Task 9: Pre-push verification

**Files:**
- Modify: none

- [ ] **Run the blocking suites and the advisory checks.**

```powershell
npm test                     # unit + regression, blocks push
npm run feedback:check       # advisory to-do list for the diff
npm run analyze:services     # dependencies changed, so this is required
```

- [ ] **Run the lockfile integrity checks that CI is otherwise the only place to catch.** Only
      `npm ci` in CI catches half-resolution; do the local equivalents first.

```powershell
npm ci --dry-run
npm ls express body-parser @types/express
# edge-vs-node: every declared range must be satisfied by the node it resolves to.
# Diff against origin/master so master's ~26 deliberate `overrides` mismatches don't hide a real finding.
```

- [ ] **Revert generated-doc churn** before committing — `npm test` regenerates landing docs, and
      `build.json` timestamp/HEAD-sha changes are always reverted.

- [ ] **Invoke the `pre-commit-check` skill**, then commit, push, and open the PR filled from
      `.github/pull_request_template.md`.

- [ ] **Verification:** all PR checks green, including `Security Audit`, `sprint-75-security-gate`,
      CodeQL and `pr-contract`. If `Security Audit` and `sprint-75-security-gate` go red **together**,
      look for a newly published advisory before debugging anything (Note 8).

---

## Task 10: Merge

**Files:**
- Modify: none

- [ ] **Re-check the security gates immediately before merging**, not just when CI last ran — the
      longer a PR waits for authorization, the likelier it needs another surgical bump.

- [ ] **Request EXPLICIT admin authorization**, then squash-merge. Never self-merge.

```powershell
gh pr merge <N> --squash --admin   # ONLY after explicit authorization, each time
```

- [ ] **Verification:** PR state is `MERGED` (verify before retrying anything — a `gh merge` ff error
      is often a false alarm on an already-merged PR). Close #34 if the merge did not auto-close it.

---

## Task 11: Deploy and verify live

**Files:**
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

Use the **`/deploy`** skill.

- [ ] **Watch the right run.** A merge fans out into `Tests`, `CodeQL` and `CI/CD Pipeline`; **only
      `CI/CD Pipeline` has a `Deploy to Demo` job.** Confirm it reached `Deploy to Demo` = success
      with **no rollback**.

- [ ] **Live smoke test — a green pipeline is not the bar.** Express 5 changes request parsing, so
      exercise real request/response paths, not just health checks: log in on `karmyq.com`
      (`maria.reyes@…` / `password123`), load `/dashboard`, confirm a **POST** round-trips (the
      body-parser proof, live), and confirm an error response still carries the ADR-074 envelope.
      Then check the **9** deployed backends' `/health` endpoints — the non-null `health_check`
      entries in `services/registry.json`; `simulation-service` has none and is not deployed
      (Note 10). Note `curl -o /dev/null -w "%{http_code}"` returns `000` from this Windows host (a
      schannel TLS quirk, not an outage) — read the response body instead.

- [ ] **Update the handoff:** PR 1 shipped, demo at v11.36.0, deploy run ID, smoke-test evidence, and
      **PR 2 as the next work**.

- [ ] **Verification:** demo reports **v11.36.0**, all 9 deployed backends healthy, POST round-trip
      proven live, handoff updated.

---

# PRs 2–6 — scope outlines (each gets its own plan file and chat)

## PR 2 — Test-tier truthfulness · v11.37.0 · `/code-review` HIGH · **ADR-088** · READY

The only PR this sprint writing real logic. Order matters: fix the hasher, *then* look at what the
honest run reveals.

- `turbo.json` `test` task `inputs` → add **`$TURBO_DEFAULT$`**. Prove with `turbo run test --dry`
  that `@karmyq/mobile#test` and `@karmyq/tests#test` hash their real sources instead of one file.
- `scripts/promote-tdd-tests.js` — walk `APPS_DIR` (declared line 18, never used; only
  `SERVICES_DIR` at 63/65/73/75) so `apps/*/tests/tdd/` tests can promote instead of blocking pushes
  forever.
- `apps/mobile/jest.config.js` — remove `passWithNoTests: true` and its now-false comment.
- **New blocking gate:** lint print-config smoke test — `eslint --print-config <probe>` per linted
  workspace must exit 0 with a non-empty rule set. Raised in S121 PR 3's review and deliberately
  deferred. It separates "config is broken" from "code has lint findings" **without** requiring the
  ~677 outstanding findings to be cleaned up — which matters because lint is non-blocking everywhere
  in CI (`|| echo`), so a broken flat config today fails silently.
- **New blocking gate:** Expo SDK alignment — no `apps/mobile` dep declared `"*"`, every
  `expo-*`/`@expo/*` major equals `expo`'s major, lockfile satisfies manifest. This is the mechanism
  that would have prevented the drift S121 PR 4 cleaned up, and PR 3 is about to move three packages
  away from their SDK pins — so this gate lands **before** it.
- **ADR-088** + `docs/adr/README.md` index + landing JSON + `nav.json` + a `docs/guides/` testing
  section. Also repair the carry-forward stale `adr-059-*.json` landing artifact here.
- **⚠️ Budget for discovery.** The first honest run will likely surface pre-existing failures. That
  is the point — but log them to `docs/BUGS.md` and fix only what this diff broke. Do not let PR 2
  become a bug-fixing sprint.
- **Open question for the maintainer, do not decide unilaterally:** whether CI should now type-check
  `apps/mobile` (its `tsc` is 0 errors for the first time). The standing decision is "don't chase
  mobile green as a gate."

## PR 3 — Consolidated safe groups (#179 + #178) · v11.38.0 · MEDIUM · ⚠️ **NOT EXECUTION-READY**

**Three maintainer decisions are outstanding. Do not start this PR until they are recorded here.**
#179 wants to move three packages *away* from the versions S121 PR 4 deliberately chose:

| # | Package | S121 PR 4 chose | #179 wants | Decision |
|---|---|---|---|---|
| D-1 | `react` / `react-dom` | **exactly `19.2.3`** (root `overrides` + root devDep + both apps), to match SDK 57 and satisfy `expo install --check` | `19.2.8` | **OPEN** |
| D-2 | `react-native-safe-area-context` | aligned **DOWN** to `~5.7.0` (the 5.8.0 pin dated to the original scaffold; **zero** importers in mobile source) | `5.8.0` | **OPEN** |
| D-3 | `react-native-maps` | **held** at `1.27.2` because SDK 57 pins exactly that | `1.29.0` | **OPEN** |

- Mechanical constraint on D-1 regardless of the answer: a workspace-only react bump throws
  `EOVERRIDE`. Root override + root devDep + both apps must move together.
- **`npx expo install --check` must exit 0 afterwards** — it is the arbiter, not the Dependabot table.
- Everything else in the two groups is uncontroversial: 14 remaining #179 updates (axios 1.19.0,
  framer-motion/motion 12.43.0, the Expo patch line, react-native 0.86.2, reanimated 4.5.3,
  worklets 0.11.3) and #178's `eslint-config-next` 16.2.12, `postcss` ^8.5.25 (root
  `overrides.postcss` must move too), `eslint-config-expo` ~57.0.1.
- **`ts-jest`: re-test, don't reflexively exclude.** Root `overrides.ts-jest: "29.4.6"` contradicts
  #178's `^29.4.12`. The original blocker was TS2307 on the `@karmyq/shared/schemas/ui` subpath in
  request-service tests, from 29.4.11+ dropping tsconfig `moduleResolution: node16` inheritance.
  S121 closed #163 without an ignore rule precisely so this could be retried. If 29.4.12 fixed it,
  **take the ranges and delete the override**; only exclude if it persists.
- Close #170 (eslint 10), #168 (typescript 7), #171 (@types/node 26) with written rationale and **no
  Dependabot ignore rule**; record them in `docs/IDEAS.md` as the S123 "platform floor" candidate, in
  dependency order: **runtime floor off `node:18-alpine` → @types/node 26 → TS 7 → ESLint 10.**

## PR 4 — jest 29 → 30 (#173) · v11.39.0 · HIGH · READY

- 11 workspaces; the entire test tier is the blast radius.
- **ts-jest is NOT the blocker** — `ts-jest@29.4.6` already declares `jest: ^29.0.0 || ^30.0.0`.
  Real risks: `jest-environment-jsdom` must move to 30 in lockstep for `apps/frontend`, jest 30
  changes fake-timer and `testEnvironment` defaults, and `expect` type signatures shift.
- Lands **after** PR 2 on purpose: this is the PR whose entire safety argument is "the tests were
  green," so it needs honest cache keys.

## PR 5 — redis (node-redis) 4 → 6 (#169) · v11.40.0 · MEDIUM · READY

- **Exactly one importer:** `services/messaging-service/src/config/redis.ts` (`createClient`).
- Bump the **root** prod declaration (`redis: ^4.6.11`) **and add the declaration to
  `messaging-service`**, which currently imports it without declaring it — a live violation of the
  standing rule.
- Two majors are being crossed (4 → 5 → 6): read the v5 **and** v6 migration notes. `createClient`
  options and the RESP3/type surface both changed.
- `ioredis` (`^5.11.1`, Bull's client) is a **different package** and is not in scope.
- Messaging is Socket.io presence/pubsub — smoke-test a live message round-trip, not just `/health`.

## PR 6 — zustand 4 → 5 (#172) · v11.41.0 · MEDIUM · READY

- **Mobile only.** Declared solely in `apps/mobile/package.json`, imported by exactly one file:
  `apps/mobile/store/auth.ts`. The S121 roster's "frontend state" is **wrong**.
- `apps/mobile` is not deployed to the demo, making this the lowest-risk PR of the six.
- zustand 5 drops the default-export shim and changes `createWithEqualityFn`/`useStore` selector
  semantics — check the one store against the v5 migration guide.
- **Closes the sprint:** archive Sprint 122 and confirm the open-PR count is genuinely 0.
