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

**Tasks 0–12 below are PR 1 (express 4 → 5, v11.36.0)** — the immediately executable work. Task 0 is
the shell-helper preamble; do not skip it, because every later verification depends on it.

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
| `tests/tdd/sprint-122-express5-contract.test.ts` | **Starts in the TDD tier** (CLAUDE.md: new sprint tests begin in the changed workspace's `tests/tdd/`). The two things no existing test can see: that **Express itself** resolves `body-parser` 2.x, and that `req.query` is genuinely an accessor. Promoted to `tests/regression/` in Task 7. |
| `services/geocoding-service/tests/tdd/sprint-122-express5-routes.test.js` | **TDD staging only.** The new geocoding cases are proven here first, then **folded into the existing regression suite and this file deleted** (Task 7) — so the blocking tier never carries a red test, and no second permanent route-test file is created. |

**No permanent new geocoding test file.**
`services/geocoding-service/tests/regression/geocodingRoutes.test.js` already exists and already
mounts the real `createApp` through supertest, asserting the ADR-074 envelope and reading
`req.query.q`. Per "update, don't create," the new cases **land in that file at promotion time** —
see Tasks 2 and 7.

### Existing files to modify
| File | Change |
|------|--------|
| `package.json` (root) | `express` `^4.18.2` → `^5.2.1`; `overrides.body-parser` `"1.20.6"` → range-scoped selector or removed; `version` `11.35.1` → `11.36.0`. **Root does NOT declare `@types/express` — do not add it.** |
| `package-lock.json` | Surgical in-place resolution of the express subtree **and repair of the pre-existing `version` drift** (see Task 3) |
| **`packages/shared/package.json`** | **`peerDependencies.express` `^4.18.0` → `^5.0.0`** (the contract this PR would otherwise invalidate) — and `@types/express` `^4.17.21` → `^5.0.6` |
| `packages/shared/middleware/{auth,dbContext,rateLimit,tenant,validate}.ts` | `@types/express` 5 signature fallout, if any |
| **8 services' `package.json`** | `@types/express` `^4.17.21` → `^5.0.6`. The declarers are exactly: auth, cleanup, community, messaging, notification, reputation, request, social-graph. **`geocoding-service` is NOT among them** (it is plain JS) and **root is not either.** |
| `services/geocoding-service/package.json` | `express` `^4.18.2` → `^5.2.1` (declares express directly; declares no `@types/express`) |
| `services/geocoding-service/tests/regression/geocodingRoutes.test.js` | Receives the new express 5 cases **at promotion time** (Task 7), not before |
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

## Task 0: Paste the shell helpers (once per session)

Every verification block below uses these. **They exist because a PowerShell pipeline "succeeds"
even when the native command inside it exited nonzero** — `npx jest 2>&1 | Select-Object -Last 4`
prints a failure and then carries on, which would let `/execute-plan` walk past a red suite. Capture
`$LASTEXITCODE` immediately after the native command, restore the location, then decide.

```powershell
# Runs a native command in a directory, shows its tail, and RETURNS its exit code.
function Invoke-InDir {
  param([string]$Dir, [scriptblock]$Cmd, [int]$Tail = 6)
  Push-Location $Dir
  try {
    $out  = & $Cmd 2>&1
    $code = $LASTEXITCODE          # captured immediately; later cmdlets can clobber it
    $out | Select-Object -Last $Tail | Out-Host
    $code                          # sole pipeline output
  } finally { Pop-Location }       # runs even on throw
}

# BASELINE mode — records the code, never throws. Several tiers are red on master by design.
function Measure-Baseline {
  param([string]$Label, [string]$Dir, [scriptblock]$Cmd)
  $code = Invoke-InDir -Dir $Dir -Cmd $Cmd
  Write-Host "BASELINE $Label -> exit $code" -ForegroundColor Cyan
}

# VERIFY mode — throws, so execution stops instead of moving on to the next task.
function Assert-Green {
  param([string]$Label, [string]$Dir, [scriptblock]$Cmd)
  $code = Invoke-InDir -Dir $Dir -Cmd $Cmd
  if ($code -ne 0) { throw "$Label FAILED (exit $code)" }
  Write-Host "OK $Label" -ForegroundColor Green
}
```

- [ ] **Verification — all five behaviours were confirmed on this box during planning; confirm at
      least the first two before proceeding.** If the failure case does not throw, stop: every later
      verification in this plan is meaningless.

```powershell
Assert-Green 'helpers wired'        '.' { node -e "process.exit(0)" }   # prints OK
Assert-Green 'helpers catch failure' '.' { node -e "process.exit(1)" }  # MUST throw
```

  Confirmed behaviours: success prints `OK` and restores the location · failure **throws** with the
  exit code **and still restores the location** (the `finally`) · `Measure-Baseline` records a nonzero
  code without throwing · `Invoke-InDir` returns a clean `Int32`, not the command's output.

> **Cosmetic, not a failure:** jest and tsc write their reports to **stderr**, so `2>&1` inside the
> helper surfaces them as PowerShell `NativeCommandError`-decorated lines ("`node : boom`" + a
> `CategoryInfo` block). The text is all still there and **the exit code is authoritative** — do not
> read that decoration as an additional error.

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
Assert-Green    'audit baseline' '.' { npm audit --audit-level=moderate }   # expect 0 vulnerabilities
node -p "require('./node_modules/express/package.json').version"                              # 4.22.2
node -p "const l=require('./package-lock.json'); l.version + ' / ' + l.packages[''].version"  # 11.34.0 / 11.34.0 (drifted)
Measure-Baseline 'shared tsc'   '.'     { npx tsc --noEmit -p packages/shared }
Measure-Baseline 'root tests'   'tests' { npx jest unit regression }         # expect 278/278
```

- [ ] **Baseline each of the 9 Express service suites DIRECTLY, not through Turbo.** Turbo's
      cross-workspace cache is untrustworthy until PR 2 lands; a cached pass here would poison the
      comparison. Baseline mode, because the bar is *no regression* — record each exit code.

```powershell
$services = @('auth-service','community-service','request-service','reputation-service',
              'notification-service','messaging-service','social-graph-service',
              'cleanup-service','geocoding-service')
foreach ($s in $services) {
  Measure-Baseline $s "services/$s" { npx jest }
}
```

- [ ] **Verification:** baselines recorded in the handoff — including the drifted lock version —
      before a single dependency line changes.

---

## Task 2: Write the express 5 tests FIRST, in the TDD tier

**Files:**
- Create: `tests/tdd/sprint-122-express5-contract.test.ts`
- Create: `services/geocoding-service/tests/tdd/sprint-122-express5-routes.test.js`

**Both start in `tests/tdd/`, per CLAUDE.md** — new sprint tests begin in the changed workspace's TDD
tier and are promoted only once green. That is not a formality here: these tests are *designed* to be
red on Express 4, so putting them in `regression/` now would block every push until Task 4 lands.
Promotion happens in Task 7.

- [ ] **Cross-workspace contract test.** Assert on real behaviour, no stubs for the thing under test.

```ts
// tests/tdd/sprint-122-express5-contract.test.ts
import { createRequire } from 'module';
import express from 'express';
import request from 'supertest';

/**
 * Walk the prototype chain and return the object that OWNS `prop`, plus its descriptor.
 * Needed because Express's request chain is 3 deep: the incoming req -> `app.request`
 * (Object.create'd per app) -> `express.request` (the shared prototype where the getter
 * is defined). Asserting on `Object.getPrototypeOf(req)` inspects `app.request`, which
 * owns nothing — it returns undefined even on a CORRECT Express 5 install.
 */
function findOwner(obj: object, prop: string) {
  let cursor: object | null = obj;
  let depth = 0;
  while (cursor) {
    const descriptor = Object.getOwnPropertyDescriptor(cursor, prop);
    if (descriptor) return { depth, descriptor, owner: cursor };
    cursor = Object.getPrototypeOf(cursor);
    depth++;
  }
  return null;
}

describe('Sprint 122 — express 5 runtime contract', () => {
  it('EXPRESS resolves body-parser 2.x (not the override-pinned 1.20.6)', () => {
    // Resolve from Express's own location. A bare require() here reports whichever copy
    // THIS file resolves, which can differ from the one Express actually loads.
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

  it('query lives on express.request as a setter-less getter (express 5), not as an own property (express 4)', async () => {
    // Measured on the installed Express 4.22.2: `query` is an OWN, writable property of the
    // incoming request (depth 0, writable: true), and `express.request` owns no `query`
    // descriptor at all. Express 5 inverts both halves. Assert both, so the test cannot pass
    // for the wrong reason.
    let ownedByRequestItself: boolean | undefined;
    let found: ReturnType<typeof findOwner> = null;
    let assignmentError: unknown = null;

    const app = express();
    app.get('/q', (req, res) => {
      ownedByRequestItself = Object.prototype.hasOwnProperty.call(req, 'query');
      found = findOwner(req, 'query');
      try { (req as unknown as { query: unknown }).query = { hacked: true }; }
      catch (e) { assignmentError = e; }
      res.json({ q: req.query });
    });

    const res = await request(app).get('/q?x=1&y=2');

    // 1. the shared prototype Express exports owns an accessor
    const shared = Object.getOwnPropertyDescriptor(express.request, 'query');
    expect(shared).toBeDefined();
    expect(typeof shared!.get).toBe('function');
    expect(shared!.set).toBeUndefined();

    // 2. and the incoming request inherits it rather than owning a writable copy
    expect(ownedByRequestItself).toBe(false);
    expect(found).not.toBeNull();
    expect(found!.owner).toBe(express.request);
    expect(typeof found!.descriptor.get).toBe('function');
    expect(found!.descriptor.writable).toBeUndefined();

    // 3. a setter-less inherited accessor rejects assignment under strict mode
    expect(assignmentError).toBeInstanceOf(TypeError);

    // 4. and reading still works
    expect(res.body.q).toEqual({ x: '1', y: '2' });
  });
});
```

- [ ] **Geocoding TDD staging test — exact code, mocks matched to the real implementation.**
      `service.cache(query, results)` validates the query, requires `Array.isArray(results)`, then
      issues **one** `pool.query(sql, [normalizedQuery, JSON.stringify(results)])` and returns
      `{ ok:true, data:{ query } }`; the route answers via `sendSuccess`. So asserting the **arguments
      `pool.query` received** is what proves the JSON body reached the handler — if `express.json()`
      were broken, `req.body` would be undefined, `req.body.query` would throw, and the route's own
      `catch` would return a 500 `GEOCODING_CACHE_FAILED` instead.

```js
// services/geocoding-service/tests/tdd/sprint-122-express5-routes.test.js
const request = require('supertest')
const { createApp } = require('../../src/geocodingApp')

describe('Sprint 122 — geocoding routes under express 5', () => {
  test('POST /cache: express.json() delivers the body all the way to pool.query', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) }
    const app = createApp({ pool, fetchImpl: jest.fn(), logger: { error: jest.fn(), log: jest.fn() } })
    const results = [{ display_name: 'Oakland', lat: 37.8, lng: -122.2, type: 'city' }]

    const res = await request(app).post('/cache').send({ query: 'Oakland', results }).expect(200)

    expect(res.body).toEqual({
      success: true,
      data: { query: 'oakland' },
      message: 'Cached results for: oakland',
    })
    // The body-parser proof: the parsed values, not defaults, reached the service layer.
    expect(pool.query).toHaveBeenCalledTimes(1)
    expect(pool.query.mock.calls[0][1]).toEqual(['oakland', JSON.stringify(results)])
  })

  test('GET /health returns 200 (route table built by path-to-regexp 8)', async () => {
    const app = createApp({ pool: {}, fetchImpl: jest.fn() })
    const res = await request(app).get('/health').expect(200)
    expect(res.body.status).toBe('healthy')
    expect(res.body.service).toBe('geocoding-cache')
  })
})
```

- [ ] **Do NOT write a test claiming an async rejection reaches an express error handler here:**
      `geocodingApp.js` has **no error middleware** (Critical Note 5). Its 500s come from each route's
      own `catch` calling `sendError`, and the existing regression suite's envelope assertions already
      cover that shape.

- [ ] **Verification — confirm the tests are wired to something real BEFORE the bump.** On Express 4
      the body-parser assertion and the `query`-descriptor assertions **must FAIL**; that failure is
      the proof they measure something. The geocoding staging test should already **pass** on Express 4
      (it asserts behaviour that must *survive* the upgrade, not change) — if it fails now, the mock is
      wrong, not Express.

```powershell
# Expected RED on express 4 — this is the TDD tier, which never blocks a push.
Measure-Baseline 'contract test (expect RED on express 4)' 'tests' `
  { npx jest tdd/sprint-122-express5-contract --no-coverage }

# Expected GREEN on express 4 — it pins behaviour that must not change.
Assert-Green 'geocoding staging test' 'services/geocoding-service' `
  { npx jest tests/tdd/sprint-122-express5-routes }
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

- [ ] **Bump express**: root `express` → `^5.2.1`; `services/geocoding-service` `express` → `^5.2.1`.

- [ ] **Bump `@types/express` → `^5.0.6` in exactly 9 manifests**: `packages/shared` plus the **8**
      services that declare it (auth, cleanup, community, messaging, notification, reputation, request,
      social-graph). **Root does NOT declare `@types/express` — do not add a declaration to it**, and
      `geocoding-service` does not declare it either (plain JS). Verify the declarer list rather than
      trusting this one:

```powershell
Get-ChildItem -Recurse -Filter package.json -Path services,packages,apps,tests |
  Where-Object { $_.FullName -notmatch 'node_modules' } |
  Where-Object { (Get-Content $_.FullName -Raw) -match '"@types/express"' } |
  ForEach-Object { $_.FullName }
```

- [ ] **Resolve the lockfile surgically** and prove stability. `--package-lock-only` is the *only* way
      to write the lock (Note 9 bans `npm dedupe` and scratch regens) — but it does **not** touch
      `node_modules`.

```powershell
npm install --package-lock-only
git diff --stat package-lock.json
npm install --package-lock-only     # second run must produce no further change
git diff --stat package-lock.json
```

- [ ] **⚠️ NOW MATERIALIZE THE TREE. `--package-lock-only` left `node_modules` on Express 4.** Without
      this step `npm ls express` reports a manifest/tree mismatch and the Task 2 contract test cannot
      go green — it would still be loading Express 4. `npm ci` installs strictly from the stabilized
      lockfile (it does **not** regenerate it, so Note 9 still holds) and will itself fail loudly if
      the manifest and lock disagree, which makes it a lockfile check as well as an install.
      `.npmrc`'s `ignore-scripts=true` (ADR-061) stays in force.

```powershell
Assert-Green 'npm ci (materialize express 5)' '.' { npm ci }
node -p "require('./node_modules/express/package.json').version"   # must read 5.2.x, NOT 4.22.2
```

- [ ] **Verification — the four proofs this task exists for.**

```powershell
# 1. Note 1: Express's own tree must carry body-parser 2.x
Assert-Green 'npm ls body-parser' '.' { npm ls body-parser }
node -p "const {createRequire}=require('module'); createRequire(require.resolve('express'))('body-parser/package.json').version"

# 2. Note 6: version consistent in all THREE places
node -p "const l=require('./package-lock.json'); JSON.stringify({manifest:require('./package.json').version, lock:l.version, lockRoot:l.packages[''].version})"

# 3. express 5 declared, installed and peer-consistent; audit still clean
Assert-Green 'npm ls express' '.' { npm ls express }
node -p "require('./packages/shared/package.json').peerDependencies.express"   # ^5.0.0
Assert-Green 'audit' '.' { npm audit --audit-level=moderate }

# 4. the Task 2 assertions that were RED on express 4 must now be GREEN (still the tdd tier)
Assert-Green 'contract test now green' 'tests' { npx jest tdd/sprint-122-express5-contract }
Assert-Green 'geocoding staging still green' 'services/geocoding-service' `
  { npx jest tests/tdd/sprint-122-express5-routes }
```

---

## Task 5: Type-check fallout across the 111 express importers

**Files:**
- Modify: `packages/shared/middleware/*.ts` and any `services/*/src/**/*.ts` the compiler flags

- [ ] **Type-check every workspace that imports express.** `@types/express` 5 tightens
      `Request`/`Response` generics and retypes `req.query`; handler signatures that relied on the
      looser v4 types are where errors land.

```powershell
# Baseline mode first, so the FULL error list is visible rather than stopping at the first workspace.
Measure-Baseline 'shared tsc' '.' { npx tsc --noEmit -p packages/shared }
$tsServices = @('auth-service','community-service','request-service','reputation-service',
                'notification-service','messaging-service','social-graph-service','cleanup-service')
foreach ($s in $tsServices) { Measure-Baseline "$s tsc" "services/$s" { npx tsc --noEmit } }
```

- [ ] **Do not widen types to silence errors.** If a handler's request shape was wrong, fix the
      shape. `as any` in a middleware signature is a finding, not a fix.

- [ ] **Verification:** every TS workspace type-checks with **0 new errors** versus Task 1's baseline.
      Once the fallout is fixed, re-run the same set in **verify** mode so a residual error cannot be
      walked past. `geocoding-service` is JS and reports nothing — expected, which is why Task 2
      stages a runtime test for it instead.

```powershell
Assert-Green 'shared tsc' '.' { npx tsc --noEmit -p packages/shared }
foreach ($s in $tsServices) { Assert-Green "$s tsc" "services/$s" { npx tsc --noEmit } }
```

---

## Task 6: Run every affected suite directly and prove no regression

**Files:**
- Modify: whatever the failures demand

- [ ] **Run all 9 Express service suites plus `packages/shared` and `tests` directly** (not via
      Turbo — Note 9) and diff against Task 1's baselines.

```powershell
# First pass in baseline mode to see the whole picture, then compare each exit code and
# suite count against Task 1. Anything that regressed gets fixed before the verify pass.
Measure-Baseline 'shared'     'packages/shared' { npx jest }
$services = @('auth-service','community-service','request-service','reputation-service',
              'notification-service','messaging-service','social-graph-service',
              'cleanup-service','geocoding-service')
foreach ($s in $services) { Measure-Baseline $s "services/$s" { npx jest } }
Measure-Baseline 'root tests' 'tests' { npx jest unit regression }
```

- [ ] **Treat these two failure shapes as noise, not as your diff** (both documented): the Windows
      Turbo timeout flake — confirm by running the package directly; and the `feed-dibs` privacy
      timestamp flake, whose digit regex false-fires on millisecond timestamps ~2/1000 runs. A lone
      CI red on that test means rerun, not debug.

- [ ] **Verification:** every suite matches or beats its baseline. Then re-run the ones that were
      **green at baseline** in verify mode, so a regression throws instead of scrolling past. Suites
      that were already red on master stay in baseline mode and are compared by count.

```powershell
Assert-Green 'shared'     'packages/shared' { npx jest }
Assert-Green 'root tests' 'tests'           { npx jest unit regression }   # was 278/278
foreach ($s in $services) { Assert-Green $s "services/$s" { npx jest } }   # drop any that were red at baseline
```

---

## Task 7: Promote the TDD tests into the blocking tier

**Files:**
- Move: `tests/tdd/sprint-122-express5-contract.test.ts` → `tests/regression/`
- Modify: `services/geocoding-service/tests/regression/geocodingRoutes.test.js`
- Delete: `services/geocoding-service/tests/tdd/sprint-122-express5-routes.test.js`

Both tests are green on Express 5 now, so they graduate. They belong in `regression/` rather than
`unit/` because they guard against a known upgrade regression — the repo's definition of the tier.

- [ ] **Promote the cross-workspace contract test by hand.** `scripts/promote-tdd-tests.js` only walks
      `services/`, so it will never see a `tests/` workspace file (that script bug is PR 2's work).

```powershell
git mv tests/tdd/sprint-122-express5-contract.test.ts tests/regression/
```

- [ ] **Fold the geocoding cases into the EXISTING regression suite, then delete the staging file.**
      Copy the two `test(...)` blocks from the TDD file into
      `services/geocoding-service/tests/regression/geocodingRoutes.test.js` (they use the same
      `createApp` + supertest idiom the file already establishes), then remove the staging file. Doing
      it in this order matters: `promote-tdd-tests.js` **does** walk `services/`, so leaving the file
      in place would let the script promote it as a *second* permanent route-test file, which is
      exactly the duplicate "update, don't create" forbids.

```powershell
git rm services/geocoding-service/tests/tdd/sprint-122-express5-routes.test.js
```

- [ ] **Verification:** both tests now run in the blocking tier, the TDD tier is empty of this
      sprint's files, and no duplicate geocoding route-test file exists.

```powershell
Assert-Green 'promoted contract test' 'tests' { npx jest regression/sprint-122-express5-contract }
Assert-Green 'geocoding regression'   'services/geocoding-service' { npx jest tests/regression }
Get-ChildItem -Recurse -Filter 'sprint-122-express5*' | ForEach-Object { $_.FullName }  # expect exactly ONE file
```

---

## Task 8: Docs — drift repairs and the feedback loop

**Files:**
- Modify: `CLAUDE.md`, `docs/ARCHITECTURE.md`, `apps/landing/src/data/docs/architecture.json`,
  `packages/shared/CONTEXT.md`, `services/*/CONTEXT.md`, `services/registry.json`

- [ ] **Fix the CLAUDE.md tech-stack drift found during planning:** § System Architecture reads
      **"Next.js 14"** while both apps run `^15.5.21`. Correct it and confirm the Express reference
      still reads true after the 4 → 5 move.

- [ ] **Update `docs/ARCHITECTURE.md`** for the express 5 baseline, then regenerate the landing
      artifact and force-add it (`apps/landing/src/data/docs/` is gitignored but tracked).

```powershell
Assert-Green 'generate:docs' '.' { npm run generate:docs }
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
Assert-Green 'analyze:services' '.' { npm run analyze:services }
Measure-Baseline 'feedback:check' '.' { npm run feedback:check }   # advisory by design; read the list
```

- [ ] **Verification:** `feedback:check` lists no outstanding CONTEXT/registry to-dos for this diff,
      and the doc-context drift gate passes when run directly (Turbo would cache a stale pass — this
      test reads files across the whole repo).

```powershell
Assert-Green 'doc-context drift gate' 'tests' { npx jest regression/doc-context-drift-gate.test.ts }
```

---

## Task 9: SDLC quality gates — all four, calibrated to HIGH

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

## Task 10: Pre-push verification

**Files:**
- Modify: none

- [ ] **Run the blocking suites and the advisory checks.**

```powershell
Assert-Green 'npm test'         '.' { npm test }                     # unit + regression, blocks push
Measure-Baseline 'feedback:check' '.' { npm run feedback:check }     # advisory to-do list for the diff
Assert-Green 'analyze:services' '.' { npm run analyze:services }     # deps changed, so this is required
```

> **Note on `npm test`:** it runs through Turbo, whose `test` inputs are still broken until PR 2, so a
> green here is necessary but **not sufficient** — Task 6's direct runs are the real evidence.

- [ ] **Run the lockfile integrity checks that CI is otherwise the only place to catch.** Only
      `npm ci` in CI catches half-resolution; do the local equivalents first.

```powershell
Assert-Green 'npm ci --dry-run' '.' { npm ci --dry-run }
Assert-Green 'ls express tree'  '.' { npm ls express body-parser @types/express }
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

## Task 11: Merge

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

## Task 12: Deploy and verify live

**Files:**
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

Use the **`/deploy`** skill.

- [ ] **Watch the right run.** A merge fans out into `Tests`, `CodeQL` and `CI/CD Pipeline`; **only
      `CI/CD Pipeline` has a `Deploy to Demo` job.** Confirm it reached `Deploy to Demo` = success
      with **no rollback**.

- [ ] **Live smoke test — a green pipeline is not the bar.** Express 5 changes request parsing, so the
      test must be a **POST with a JSON body**, not a health check. Use **`POST /api/auth/login`**: it
      is the safest available POST (it creates no domain data — no request, message, community or
      karma record — and is idempotent from the caller's side), and it is the *ideal* body-parser probe
      because the credentials only arrive via the parsed JSON body. If body parsing were broken, login
      fails outright; a 200 with a token is proof the whole chain works.

      1. **Happy path (proves body parsing):** POST `{"email":"maria.reyes@…","password":"password123"}`
         → **200** with `{ success: true, data: { token, user } }`. A 400/401 here means the body never
         arrived — that is the body-parser regression, not bad credentials.
      2. **Error path (proves the ADR-074 envelope survived express 5's error handling):** POST the same
         endpoint with a deliberately wrong password → non-2xx with
         `{ success: false, message: <human>, error: <CODE> }`, and **no stack trace or internal
         detail in `message`**.
      3. **Query-string path (proves `req.query`'s getter under real traffic):** load `/dashboard` in
         the browser as that user and confirm the feed renders — its requests carry query parameters.
      4. **Health:** check the **9** deployed backends' `/health` endpoints — the non-null
         `health_check` entries in `services/registry.json`. `simulation-service` has none and is not
         deployed (Note 10).

      Note `curl -o /dev/null -w "%{http_code}"` returns `000` from this Windows host (a schannel TLS
      quirk, not an outage) — read the response body instead.

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
