# Sprint 131 PR D5: geocoding uses Node 24's built-in `fetch` instead of node-fetch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `node-fetch` from `services/geocoding-service`. Make the service's outbound Nominatim call use Node 24's global `fetch`, with the 5-second timeout re-expressed as `AbortSignal.timeout(5000)`. Prove all of it through real HTTP against a loopback stub. Dependabot #225 (node-fetch 2.7.0 → 3.3.2) is superseded and is **not** merged.

**Architecture:** `createGeocodingService` defaults `fetchImpl` to the global `fetch`. It also gains two optional seams that tests use and production never sets: `nominatimUrl` and `nominatimTimeoutMs`. `index.js` stops importing and passing a fetch implementation. A new regression file runs the real global `fetch`, never a mock, against a `127.0.0.1` stub server. It covers the success path, gzip, non-2xx, a hung response, a stalled body, throttle recovery after a timeout, and the production composition (`createApp` with no `fetchImpl`, exactly as `index.js` calls it). The manifest and lockfile edits are surgical.

**Tech Stack:** Node 24 (`fetch` = undici; `AbortSignal.timeout`), Express 5, Jest 30 (geocoding's own config: none, so `testEnvironment: node` and no `resetMocks`), supertest, plain JS (CommonJS).

**Spec:** [`docs/superpowers/specs/2026-09-15-sprint-131-maintenance-design.md`](../specs/2026-09-15-sprint-131-maintenance-design.md), D5 row (line 139): *"#225 node-fetch 2 → 3 | geocoding; audit CommonJS loaders and prove ESM boundary behavior"*. **This plan deliberately departs from that row.** The maintainer decided on 2026-09-23, in the D5 planning chat, to replace the dependency rather than bump it, which removes the ESM boundary instead of proving it. The decision and its evidence are in `.claude/handoff/CURRENT_HANDOFF.md` → *Blockers and decisions* → "D5 decisions". The "audit CommonJS loaders" half is done: `services/geocoding-service/index.js:14` is the only importer, per a repo-wide grep excluding `package-lock.json` and generated docs.

## Why not the bump (evidence, gathered 2026-09-23 on Node v24.11.1 against the real `node-fetch-3.3.2.tgz`)

1. `require('node-fetch')` on 3.3.2 → `typeof` is **`object`** (keys `AbortError, Blob, FetchError, File, FormData, Headers, …`). The callable is only `.default`. `index.js:38` passes that object as `fetchImpl`.
2. **The failure would be silent.** `callNominatimAPI` wraps the call in `try/catch` (`src/geocodingService.js:57-90`), so `fetchImpl is not a function` is logged and `[]` is returned. `/search` answers **200 with empty results** on every cache miss. It would not return a 500 and it would not crash, and no health check would notice.
3. 3.3.2's `src/` contains **zero** occurrences of `timeout`. The `timeout: 5000` at `src/geocodingService.js:68` is a node-fetch 2-only option (implemented at `node_modules/node-fetch/lib/index.js:187-213,384-385`), so the bump would also silently drop the timeout.
4. **Why the timeout matters:** every Nominatim call runs inside `createExternalThrottle` (`src/geocodingService.js:26-44`), a single promise chain. One call that never settles would block every later cache miss for the life of the process.
5. Every existing geocoding test injects `fetchImpl: jest.fn()` (`tests/regression/geocodingRoutes.test.js:6,28,50,68,88,102,115`, `tests/regression/sprint-130-log-injection.test.js`), and `tests/unit/geocodingService.test.js` asserts nothing about the URL, the headers or the timeout. No test would have gone red.

Verified inside geocoding's own Jest on Node v24.11.1 (throwaway probe, deleted):
- global `fetch` is a function, and it is `globalThis.fetch`;
- a custom `User-Agent` reaches the server unchanged;
- `accept-encoding: gzip, deflate` is sent, and a gzip body is decoded by `.json()`;
- `AbortSignal.timeout(300)` rejects with `name` `TimeoutError`, message `"The operation was aborted due to timeout"`, in about 312 ms, both when the server never answers and when it sends headers and then stalls the body.

## Global Constraints

- Node **24** only (ADR-090: images `node:24-alpine`, root `engines.node` and CI `NODE_VERSION` are gate-locked to one major). Global `fetch` and `AbortSignal.timeout` need no flag there.
- **Dependency edits are surgical** (CLAUDE.md): edit `package.json` and splice `package-lock.json` by hand. **Never** `npm install --workspace`, `npm dedupe` or a regenerated lockfile. Prove the result with strict `npx -y npm@11.19.0 ci`.
- **The lock node `node_modules/node-fetch` (2.7.0) must stay.** `node_modules/cross-fetch@3.2.0`, which `node_modules/fbjs` pulls in, declares `node-fetch ^2.7.0`, and none of those nodes is `dev`. The only lock edit is deleting `"node-fetch": "^2.6.7"` from `packages["services/geocoding-service"].dependencies`.
- **Locally, a leftover `require('node-fetch')` would still resolve** through that hoisted 2.7.0. The production image would not have it: its production stage runs a standalone `npm install --omit=dev` from geocoding's own `package.json` (`services/geocoding-service/Dockerfile:30-33`), so that `require` would crash at boot. The repo-wide declarations gate (`tests/regression/sprint-131-workspace-declarations.test.ts`) is what catches an undeclared import. Do not weaken it.
- Tests must never reach `nominatim.openstreetmap.org`, **including during the red run**, when the new seams do not exist yet. Every real-`fetch` case targets `http://127.0.0.1:<port>`; direct calls use `loopbackFetch`, and the composition case's redirecting spy also **throws** on any URL it does not recognise instead of passing it through. The default-fetch and timeout cases are safe before the change because the default `fetchImpl` is `undefined` then.
- **The new test starts in `tests/tdd/` (CLAUDE.md) and is promoted to `tests/regression/` by hand** once green (Task 1 Step 6). The automatic promoter cannot see geocoding's `.js` tests, which is why Sprint 130 moved its file by hand (`services/geocoding-service/CONTEXT.md:24-26`); it is not an exemption from starting in `tdd/`. geocoding's `npm test` runs only `tests/unit` and `tests/regression` (`package.json:9-11`), so a tdd-only file never blocks and must be run explicitly by path until it is promoted. **It must be in `regression/` before the push.**
- Version bump: take it from `origin/master`'s `package.json` **at merge time**. Today that is 11.66.0 → 11.67.0; re-read it before merging. `package-lock.json`'s root `version` must match (#257 left them split once).
- Rate limiting is **live on the demo** (since 2026-09-23 21:37 UTC): **10 auth requests per 15 min per IP**, successful logins included. Budget the post-deploy smoke run to **one** login.

## Review Focus

1. **A Nominatim call that never finishes.** Expected: the search returns `[]` within about the timeout, and the *next* cache miss still reaches Nominatim, because the throttle chain is not wedged. Pinned in Task 1 (hung response **and** stalled body, each followed by a second search that succeeds).
2. **The production composition, not just the service.** `index.js` builds the app with no `fetchImpl`. A default that is not a real callable fails only as "200 with no results". Pinned in Task 1 (the `createApp` case asserts two mapped results through `/search`, not just a 200).
3. **A gzip-compressed Nominatim answer.** Node-fetch 2 decoded gzip itself, and the built-in `fetch` must too. Pinned in Task 1 (the stub gzips; two rows must map).
4. **The identifying `User-Agent`.** Nominatim's usage policy requires it, and a runtime could drop or override it. Pinned in Task 1 (the stub asserts the exact `DEFAULT_USER_AGENT`).
5. **The production timeout value, as production composes it.** Tests shorten it, and a default injected between `createApp` and the helper (say `nominatimTimeoutMs = 50000`) would bypass a helper-only check: the plan's first draft passed 7/7 under exactly that mutation (plan review, 2026-09-23). Pinned in Task 1: the `createApp` case spies on `AbortSignal.timeout` and asserts `5000` and that its signal is the one handed to `fetch`; mutation M8 proves it.

---

## File map

| File | Change |
|---|---|
| `services/geocoding-service/tests/tdd/sprint-131-geocoding-builtin-fetch.test.js` | **Create** in `tdd/`, then promote by hand to `tests/regression/` once green (Task 1 Step 6). Real-`fetch` suite plus the boot check |
| `services/geocoding-service/src/geocodingService.js` | Export `NOMINATIM_SEARCH_URL` and `NOMINATIM_TIMEOUT_MS`; `callNominatimAPI` takes `{ url, timeoutMs }` and sends `signal: AbortSignal.timeout(timeoutMs)` instead of `timeout`; `createGeocodingService` defaults `fetchImpl` to global `fetch` and threads the two seams |
| `services/geocoding-service/index.js` | Drop `require('node-fetch')` and `fetchImpl` |
| `services/geocoding-service/package.json` | Remove `"node-fetch"` |
| `package-lock.json` | Splice: remove `node-fetch` from the `services/geocoding-service` node only; root `version` at merge time |
| `package.json` | Version bump at merge time |
| `services/geocoding-service/CONTEXT.md` | New "Sprint 131 D5" section (above the Sprint 130 one): built-in `fetch`, `AbortSignal` timeout, the silent-failure mode, the new test |
| `.claude/handoff/CURRENT_HANDOFF.md` | D5 row and banner |

`createApp` (`src/geocodingApp.js`) needs **no** change: it already forwards `fetchImpl` as given, and `undefined` triggers the new default. `services/registry.json` lists no npm dependencies for geocoding (checked 2026-09-23), so it needs no change. No user-visible behaviour changes, so there are no guide, landing or onboarding updates. State that in the PR body.

---

### Task 1: Real-`fetch` regression suite, then switch the service to the built-in `fetch`

**Files:**
- Create: `services/geocoding-service/tests/tdd/sprint-131-geocoding-builtin-fetch.test.js`
- Modify: `services/geocoding-service/src/geocodingService.js:46-93,193-201`
- Modify: `services/geocoding-service/index.js:14,38`

**Interfaces:**
- Produces, all exported from `src/geocodingService.js`:
  - `NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'`
  - `NOMINATIM_TIMEOUT_MS = 5000`
  - `callNominatimAPI(fetchImpl, query, logger = console, { url = NOMINATIM_SEARCH_URL, timeoutMs = NOMINATIM_TIMEOUT_MS } = {}) → Promise<Array<{display_name, address, lat, lng, type}>>`
  - `createGeocodingService({ pool, fetchImpl = fetch, logger, throttleIntervalMs, nominatimUrl, nominatimTimeoutMs })`
- Unchanged: `createApp({ pool, fetchImpl, logger, allowedOrigins, throttleIntervalMs })`. Existing callers of `callNominatimAPI(fetchImpl, query, logger)` keep working, because the 4th argument is optional.

- [ ] **Step 1: Write the failing test**

Create `services/geocoding-service/tests/tdd/sprint-131-geocoding-builtin-fetch.test.js`:

```js
/**
 * Sprint 131 D5: geocoding reaches Nominatim through Node 24's built-in fetch, not node-fetch (#225 superseded).
 *
 * Every other geocoding test injects `fetchImpl: jest.fn()`, so none of them could see what the node-fetch 3 bump
 * would have done: require('node-fetch') returns an object there, not a function, and 3.x has no `timeout` option.
 * callNominatimAPI swallows errors, so either defect shows up as "200 with empty results", never as a crash.
 * Every case here therefore runs the REAL global fetch over HTTP against a 127.0.0.1 stub, and asserts on results.
 */
const http = require('node:http')
const path = require('node:path')
const zlib = require('node:zlib')
const { spawn } = require('node:child_process')
const request = require('supertest')
const {
  DEFAULT_USER_AGENT,
  NOMINATIM_SEARCH_URL,
  NOMINATIM_TIMEOUT_MS,
  callNominatimAPI,
  createGeocodingService,
} = require('../../src/geocodingService')
const { createApp } = require('../../src/geocodingApp')

const ROWS = [
  { display_name: 'Main St, Portland, Oregon', lat: '45.5', lon: '-122.6', type: 'road' },
  { display_name: 'Main St, Salem, Oregon', lat: '44.9', lon: '-123.0', type: 'road' },
]
const MAPPED = [
  { display_name: 'Main St, Portland, Oregon', address: 'Main St', lat: 45.5, lng: -122.6, type: 'road' },
  { display_name: 'Main St, Salem, Oregon', address: 'Main St', lat: 44.9, lng: -123.0, type: 'road' },
]
const TEST_TIMEOUT_MS = 200
const TIMEOUT_MESSAGE = 'The operation was aborted due to timeout'

const realFetch = globalThis.fetch
let stub
let stubBase
let received
let behaviour
let fetchSpy

beforeAll(async () => {
  stub = http.createServer((req, res) => {
    received.push({ method: req.method, url: req.url, headers: req.headers })
    const mode = behaviour.shift() ?? 'gzip'
    if (mode === 'hang') return // never answer
    if (mode === 'stall') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.write('[') // headers sent, body never finishes
      return
    }
    if (mode === '503') {
      res.writeHead(503, { 'content-type': 'text/plain', connection: 'close' })
      return res.end('busy')
    }
    res.writeHead(200, { 'content-type': 'application/json', 'content-encoding': 'gzip', connection: 'close' })
    res.end(zlib.gzipSync(JSON.stringify(ROWS)))
  })
  await new Promise(resolve => stub.listen(0, '127.0.0.1', resolve))
  stubBase = `http://127.0.0.1:${stub.address().port}`
})

afterAll(async () => {
  stub.closeAllConnections()
  await new Promise(resolve => stub.close(resolve))
})

beforeEach(() => {
  received = []
  behaviour = []
  // Every case, including those that rely on the default fetchImpl: the global fetch may dial only the stub.
  // If the nominatimUrl seam were dropped, the public URL would reach this guard and throw, never the network.
  fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(loopbackFetch)
})

afterEach(() => jest.restoreAllMocks())

function captureLogger() {
  const errors = []
  return { errors, logger: { log: () => {}, warn: () => {}, error: (...args) => errors.push(args) } }
}

const missPool = () => ({ query: jest.fn().mockResolvedValue({ rows: [] }) })

// The real fetch, refusing anything but the stub: if the `url` seam were ignored, a test would otherwise dial Nominatim.
function loopbackFetch(url, init) {
  if (!String(url).startsWith(`${stubBase}/`)) throw new Error(`unexpected outbound URL: ${url}`)
  return realFetch(url, init)
}

function expectNominatimRequest(req, q) {
  expect(req.method).toBe('GET')
  expect(req.url).toBe(`/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`)
  expect(req.headers['user-agent']).toBe(DEFAULT_USER_AGENT)
}

describe('geocoding reaches Nominatim through the real built-in fetch (Sprint 131 D5)', () => {
  it('defaults to the global fetch: sends the identifying User-Agent and maps every row of a gzip answer', async () => {
    const { errors, logger } = captureLogger()
    const service = createGeocodingService({
      pool: missPool(), logger, throttleIntervalMs: 0, nominatimUrl: `${stubBase}/search`,
    })

    const result = await service.search('Main St')

    expect(errors).toEqual([])
    expect(result).toEqual({ ok: true, data: { results: MAPPED, source: 'nominatim', cached: false } })
    expect(fetchSpy).toHaveBeenCalledTimes(1) // the default IS the global fetch
    expect(received).toHaveLength(1)
    expectNominatimRequest(received[0], 'main st')
  })

  it('logs the status and returns no results on a non-2xx answer', async () => {
    const { errors, logger } = captureLogger()
    behaviour = ['503']

    const results = await callNominatimAPI(loopbackFetch, 'main st', logger, { url: `${stubBase}/search` })

    expect(results).toEqual([])
    expect(errors).toEqual([['Nominatim API error: 503']])
    expect(received).toHaveLength(1)
  })

  it.each(['hang', 'stall'])(
    'times out a call that %ss, and the next cache miss still reaches Nominatim',
    async (mode) => {
      const { errors, logger } = captureLogger()
      const service = createGeocodingService({
        pool: missPool(), logger, throttleIntervalMs: 0,
        nominatimUrl: `${stubBase}/search`, nominatimTimeoutMs: TEST_TIMEOUT_MS,
      })
      behaviour = [mode, 'gzip']

      const started = Date.now()
      const first = await service.search('Main St')
      const elapsed = Date.now() - started
      const second = await service.search('Salem')

      expect(first.data.results).toEqual([])
      expect(elapsed).toBeGreaterThanOrEqual(TEST_TIMEOUT_MS - 20)
      expect(elapsed).toBeLessThan(2000)
      expect(errors).toEqual([['Nominatim API call failed:', TIMEOUT_MESSAGE]])
      expect(second.data.results).toEqual(MAPPED)
      expect(received).toHaveLength(2)
      expectNominatimRequest(received[1], 'salem')
    },
    10_000,
  )

  it('uses a 5000 ms timeout in production, where no override is passed', async () => {
    expect(NOMINATIM_TIMEOUT_MS).toBe(5000)
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout')
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })

    await callNominatimAPI(fetchImpl, 'main st', captureLogger().logger)

    expect(timeoutSpy).toHaveBeenCalledTimes(1)
    expect(timeoutSpy).toHaveBeenCalledWith(5000)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(`${NOMINATIM_SEARCH_URL}?q=main%20st&format=json&limit=5&addressdetails=1`)
    expect(init.signal).toBe(timeoutSpy.mock.results[0].value)
  })

  it('serves /search through createApp with no fetchImpl, exactly as index.js builds it', async () => {
    // Production timeout, observed through the production composition: a default injected anywhere between
    // createApp and callNominatimAPI (e.g. `nominatimTimeoutMs = 50000`) must fail here, not only in the helper case.
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout')
    // Redirect only the Nominatim origin to the stub. Anything else throws, so this case can never reach the internet.
    fetchSpy.mockImplementation((url, init) => {
      const target = String(url)
      if (!target.startsWith(`${NOMINATIM_SEARCH_URL}?`)) throw new Error(`unexpected outbound URL: ${target}`)
      return realFetch(target.replace(NOMINATIM_SEARCH_URL, `${stubBase}/search`), init)
    })
    const app = createApp({ pool: missPool(), logger: captureLogger().logger, throttleIntervalMs: 0 })

    const res = await request(app).get('/search').query({ q: 'Main St' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, data: { results: MAPPED, source: 'nominatim', cached: false } })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(timeoutSpy).toHaveBeenCalledTimes(1)
    expect(timeoutSpy).toHaveBeenCalledWith(5000)
    expect(fetchSpy.mock.calls[0][1].signal).toBe(timeoutSpy.mock.results[0].value)
    expect(received).toHaveLength(1)
    expectNominatimRequest(received[0], 'main st')
  })
})

describe('index.js boots under plain node with no node-fetch import (Sprint 131 D5)', () => {
  it('starts listening, and its source neither requires node-fetch nor injects a fetchImpl', async () => {
    const serviceRoot = path.resolve(__dirname, '..', '..')
    const source = require('node:fs').readFileSync(path.join(serviceRoot, 'index.js'), 'utf8')
    expect(source).not.toMatch(/node-fetch/)
    expect(source).not.toMatch(/fetchImpl/)

    const child = spawn(process.execPath, ['index.js'], {
      cwd: serviceRoot,
      env: { ...process.env, PORT: '0', DATABASE_URL: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    try {
      await new Promise((resolve, reject) => {
        const deadline = setTimeout(() => reject(new Error(`no listen line in 8 s\nstdout:\n${stdout}\nstderr:\n${stderr}`)), 8000)
        child.stdout.on('data', chunk => {
          stdout += chunk
          if (stdout.includes('Geocoding Cache Service running on port')) { clearTimeout(deadline); resolve() }
        })
        child.stderr.on('data', chunk => { stderr += chunk })
        child.on('exit', code => { clearTimeout(deadline); reject(new Error(`exited ${code}\nstderr:\n${stderr}`)) })
      })
    } finally {
      child.removeAllListeners('exit')
      child.kill()
    }
    expect(stderr).toBe('')
  }, 15_000)
})
```

Notes for the implementer:
- `behaviour` is a per-request queue. Its default `'gzip'` is what makes every success case exercise decompression.
- "Each" needs two: the timeout case runs for **two** stall modes, and each run makes **two** searches. The success cases map **two** rows.
- `DATABASE_URL: ''` makes `index.js` take its `host`/`port` branch. `new Pool()` does not connect until the first query, so the boot needs no database.
- The boot case's `not.toMatch(/fetchImpl/)` is a deliberate text check on a 50-line entrypoint. The behaviour it guards is covered by the `createApp` case. The text check stops `index.js` from re-injecting something else that the `createApp` case cannot see.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd services/geocoding-service && npx jest tests/tdd/sprint-131-geocoding-builtin-fetch.test.js`
Expected: FAIL, for these reasons:
- the default-fetch case and both timeout cases: `result.data.results` is `[]`, because the default `fetchImpl` is `undefined`, the call throws `fetchImpl is not a function`, and that is swallowed. `errors` holds that message.
- the 5000 ms case: `NOMINATIM_TIMEOUT_MS` is `undefined`.
- nothing reaches the network in any case: the `beforeEach` guard on the global `fetch` admits only the stub.
- the `createApp` case: `results: []`, and the spy is never called.
- the boot case: `index.js` still contains `node-fetch`.
- the 503 case: the `url` option is ignored, so the call targets the public Nominatim URL. `loopbackFetch` refuses it (`unexpected outbound URL`) and nothing leaves the machine. That refusal is why every direct `callNominatimAPI` call in this file goes through `loopbackFetch`, never bare `fetch`.

Record the actual failure list in the PR's execution notes.

- [ ] **Step 3: Implement the change in `src/geocodingService.js`**

Replace lines 1 and 46-70 (the constant block and the `fetchImpl(...)` call) so the file starts and the call reads:

```js
const DEFAULT_USER_AGENT = 'Karmyq/1.0 (mutual aid platform; https://karmyq.com)'
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'
// Enforced with AbortSignal.timeout: Node's built-in fetch has no `timeout` option (node-fetch 2 did, and 3 dropped it).
// Every call runs inside createExternalThrottle's single chain, so a call that never settles would stall every later miss.
const NOMINATIM_TIMEOUT_MS = 5000
```

```js
async function callNominatimAPI(
  fetchImpl,
  query,
  logger = console,
  { url = NOMINATIM_SEARCH_URL, timeoutMs = NOMINATIM_TIMEOUT_MS } = {}
) {
  if (typeof query !== 'string') return []

  const validation = validateSearchQuery(query)
  if (!validation.ok) {
    logger.warn?.('Invalid characters in search query')
    return []
  }

  const sanitized = validation.value

  try {
    const response = await fetchImpl(
      `${url}?` +
        `q=${encodeURIComponent(sanitized)}` +
        `&format=json` +
        `&limit=5` +
        `&addressdetails=1`,
      {
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
        },
        signal: AbortSignal.timeout(timeoutMs),
      }
    )
```

(Lines 72-91 stay exactly as they are.)

Change `createGeocodingService`'s signature and its one `callNominatimAPI` call:

```js
function createGeocodingService({
  pool,
  fetchImpl = fetch,
  logger = console,
  throttleIntervalMs = 1000,
  nominatimUrl,
  nominatimTimeoutMs,
}) {
```

```js
    const apiResults = await throttleExternal(() =>
      callNominatimAPI(fetchImpl, normalized, logger, { url: nominatimUrl, timeoutMs: nominatimTimeoutMs })
    )
```

(`undefined` values fall through to the destructuring defaults, so production gets `NOMINATIM_SEARCH_URL` and `5000`.)

Add the two constants to `module.exports`:

```js
module.exports = {
  DEFAULT_USER_AGENT,
  NOMINATIM_SEARCH_URL,
  NOMINATIM_TIMEOUT_MS,
  SAFE_ADDRESS_QUERY_PATTERN,
  normalizeQuery,
  validateSearchQuery,
  createExternalThrottle,
  callNominatimAPI,
  createGeocodingService,
}
```

- [ ] **Step 4: Implement the change in `index.js`**

Delete line 14 (`const fetch = require('node-fetch')`) and change line 38 to:

```js
const app = createApp({ pool, allowedOrigins })
```

- [ ] **Step 5: Run the new file, then the whole geocoding suite**

Run: `cd services/geocoding-service && npx jest tests/tdd/sprint-131-geocoding-builtin-fetch.test.js`
Expected: PASS, 7 tests (the `it.each` counts two).

Run: `npm --workspace=geocoding-service test` (the tdd file is not in it yet).
Expected: PASS for the existing unit and regression suites, which the mocked tests leave unaffected.

- [ ] **Step 6: Promote the test by hand**

The automatic promoter cannot see `.js` files, so move the green file yourself:

```bash
mv services/geocoding-service/tests/tdd/sprint-131-geocoding-builtin-fetch.test.js \
   services/geocoding-service/tests/regression/sprint-131-geocoding-builtin-fetch.test.js
npm --workspace=geocoding-service test
```

Expected: PASS, now **including** the promoted file (its 7 tests appear in the regression run). Paths inside the test (`../../src/...`, `path.resolve(__dirname, '..', '..')`) are unchanged by the move.

- [ ] **Step 7: Commit**

```bash
git add services/geocoding-service/tests/regression/sprint-131-geocoding-builtin-fetch.test.js \
        services/geocoding-service/src/geocodingService.js services/geocoding-service/index.js
git commit -F - <<'EOF'
Sprint 131 D5: geocoding uses Node 24's built-in fetch; timeout via AbortSignal

node-fetch 3 (#225) would return an object from require() and drop the
`timeout` option; callNominatimAPI swallows both as "200, no results".
New regression suite runs the real global fetch against a loopback stub.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

(A quoted heredoc via `-F -`: backticks inside `-m` are silently eaten by Git Bash.)

- [ ] **Step 8: Prove each assertion can fail (mutation run, one at a time, each reverted)**

⚠️ This runs on the Step 7 commit, **never** before it. `git checkout --` restores to HEAD and would wipe uncommitted work (Sprint 131 D4 lost edits this way). Then apply each mutation, run `npx jest tests/regression/sprint-131-geocoding-builtin-fetch.test.js` (from `services/geocoding-service`), record which cases went red, and restore with `git checkout -- <file>`:

| # | Mutation | Must go red |
|---|---|---|
| M1 | `fetchImpl = fetch` → `fetchImpl = { default: fetch }` (the node-fetch 3 shape) | default-fetch, both timeout cases, `createApp` |
| M2 | delete the `signal:` line | both timeout cases (Jest timeout at 10 s, or `elapsed`) |
| M3 | `NOMINATIM_TIMEOUT_MS = 5000` → `50000` | the 5000 ms case |
| M4 | delete the `'User-Agent'` header | default-fetch, timeout (second request), `createApp` |
| M5 | stub sends the body uncompressed but still labelled `content-encoding: gzip` (proves decode is real, not a no-op) | default-fetch |
| M6 | put `const fetch = require('node-fetch')` back in `index.js` | boot case |
| M7 | `createGeocodingService` stops forwarding the URL seam (`{ url: nominatimUrl, timeoutMs: … }` → `{ timeoutMs: … }`) | default-fetch and both timeout cases, with `errors` showing `unexpected outbound URL: https://nominatim.openstreetmap.org/search?…` **and `received` empty**: proof that the global-fetch guard, not luck, kept the public URL off the network |
| M8 | `createGeocodingService`'s signature gets `nominatimTimeoutMs = 50000` (production default drifts; the helper constant stays 5000) | `createApp` case (`toHaveBeenCalledWith(5000)`). The helper-level 5000 ms case **stays green**, which is why the composition assertion exists |

Record the results table in the plan's Execution notes. If any mutation stays green, the suite does not prove what it claims. Fix the test, not the mutation.

Record the mutation results in Task 3 (the plan's Execution notes are committed there).

---

### Task 2: Remove the dependency: manifest plus a surgical lockfile splice

**Files:**
- Modify: `services/geocoding-service/package.json:19`
- Modify: `package-lock.json` (the `services/geocoding-service` node only)

**Interfaces:**
- Consumes: Task 1 (no `require('node-fetch')` left anywhere in the workspace).

- [ ] **Step 1: Confirm nothing imports node-fetch**

Run: `git grep -nE "(require\(|from |import\()\s*['\"]node-fetch" -- services/geocoding-service`
Expected: **no** output (exit 1). A plain `node-fetch` grep is not the check: the new regression test names the package in its header comment and in the boot case's `not.toMatch(/node-fetch/)`.

Run: `git grep -n '"node-fetch"' -- services/geocoding-service/package.json`
Expected: exactly one hit, line 19. That is the line Step 2 deletes.

- [ ] **Step 2: Edit the manifest**

Delete the line `"node-fetch": "^2.6.7",` from `services/geocoding-service/package.json`. The `dependencies` block becomes `cors, express, express-rate-limit, helmet, pg`. `pg` is now the last entry, so remove its trailing comma if one remains.

- [ ] **Step 3: Splice the lockfile**

Use the Edit tool, not a regenerated lockfile. In `package-lock.json`, find the `"services/geocoding-service": {` node and delete only its `"node-fetch": "^2.6.7",` line from `dependencies`. Do **not** touch `"node_modules/node-fetch"`, because `cross-fetch` still needs it.

Verify:

```bash
node -e "const l=require('./package-lock.json').packages;const g=l['services/geocoding-service'];console.log('geo deps:',Object.keys(g.dependencies).join(','));const n=l['node_modules/node-fetch'];console.log('node-fetch node:',n&&n.version,'dev=',!!n.dev)"
```

Expected: `geo deps: cors,express,express-rate-limit,helmet,pg` and `node-fetch node: 2.7.0 dev= false`.

- [ ] **Step 4: Prove the splice with a strict install**

Run: `npx -y npm@11.19.0 ci` (exit code captured separately, not through `| tail`), then `git status --short package-lock.json`.
Expected: exit 0, and the lockfile is **unchanged** by the install (the only diff is your one-line splice).

Run: `npm ls node-fetch --all`
Expected: only the `fbjs → cross-fetch → node-fetch@2.7.0` path. No `geocoding-service` entry and no new problems.

- [ ] **Step 5: Re-run geocoding and the declarations gate**

```bash
npm --workspace=geocoding-service test
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-131-workspace-declarations.test.ts
```

Expected: both PASS. (Use the `--workspace=tests` form: a root `npx jest tests/regression/<file>` finds 0 tests and reports a false red.)

- [ ] **Step 6: Commit**

```bash
git add services/geocoding-service/package.json package-lock.json
git commit -F - <<'EOF'
Sprint 131 D5: drop node-fetch from geocoding-service (supersedes #225)

Lockfile spliced in place: only the geocoding node's declaration is removed;
node_modules/node-fetch@2.7.0 stays for cross-fetch (via fbjs). Strict
npm@11.19.0 ci accepts it unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Docs, version, full suite, gates, PR

**Files:**
- Modify: `services/geocoding-service/CONTEXT.md` (new section above `## Sprint 130`; also update the Testing section at about line 238)
- Modify: `package.json`, `package-lock.json` root `version`
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`
- Modify: this plan (Execution notes)

- [ ] **Step 1: CONTEXT.md**

Insert above the Sprint 130 section:

```markdown
## Sprint 131 D5 - Built-in fetch replaces node-fetch (2026-09-23)

- Outbound Nominatim calls use Node 24's global `fetch`; `node-fetch` is no longer a dependency. Dependabot
  #225 (node-fetch 3.3.2) was superseded, not merged: 3.x is ESM-only, so `require('node-fetch')` returns an
  object, not a function, and 3.x has no `timeout` option.
- The 5 s timeout is `signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS)`. It covers a stalled body as well as a
  hung response. It matters because every call runs in one throttle chain: a call that never settles would
  block every later cache miss.
- ⚠️ `callNominatimAPI` swallows errors. A broken `fetchImpl` or a timeout shows up as **200 with empty
  results** and a `Nominatim API call failed:` log line, never as a 500. Check results, not status.
- `createGeocodingService` defaults `fetchImpl` to the global `fetch`; `index.js` injects nothing. The optional
  `nominatimUrl` and `nominatimTimeoutMs` exist for tests; production sets neither.
- Test: `tests/regression/sprint-131-geocoding-builtin-fetch.test.js` runs the real `fetch` against a 127.0.0.1
  stub (gzip, non-2xx, hang, stall, throttle recovery, the `createApp` composition, `index.js` boot).
```

In the Testing section, next to "External Nominatim calls must be mocked in tests.", add: "…except the D5 suite, which uses a loopback stub and a redirecting spy that throws on any other URL."

- [ ] **Step 2: Version**

Run: `git fetch origin && git show origin/master:package.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).version))"`
Set root `package.json` `version` to the next minor after that (11.67.0 if master is still 11.66.0). Set `package-lock.json`'s top-level `"version"` and `packages[""].version` to the same value. Re-check at merge time; if another PR merged first, re-bump then.

- [ ] **Step 3: Full suite, uncached**

Run: `npx turbo run test --concurrency=2 --force`, and capture the exit code separately.
Expected: exit 0, every task green. `--concurrency=2`: default concurrency times out unrelated suites on this Windows box. A lone timeout in another workspace means re-running that package alone.
Then revert the landing-docs churn that `npm test` regenerates (timestamp and HEAD-sha only): `git status --short apps/landing` → `git checkout -- apps/landing/src/data/docs`, after confirming that the diff is only that churn.

- [ ] **Step 4: SDLC gates (calibrated: small, well-specified diff)**

- `/simplify`: one pass over the branch diff.
- `/code-review medium`.
- `/security-review`. Expected focus: the outbound URL is still a constant in production; the test seams are not reachable from HTTP input (`createApp` does not forward them); the spy cannot leak to the internet.
- `node scripts/gotcha-check.js --for services/geocoding-service/src/geocodingService.js services/geocoding-service/index.js package-lock.json` (today: only the dotenv gotcha, which does not apply here: geocoding does not use dotenv).
- `npm run feedback:check`. It is advisory, and false-green on a committed branch, so also eyeball CONTEXT.md.

Resolve each finding, or dismiss it with a written justification in the Execution notes.

- [ ] **Step 5: Handoff, then commit and push**

Update the D5 row and banner in `CURRENT_HANDOFF.md` to "PR open, CI pending". Commit the docs, the version and the handoff. `git push -u origin agent/claude/sprint-131-d5-node-fetch`. That push must run the pre-push suite: a silent, instant push means no hook ran.

- [ ] **Step 6: Open the PR**

Title: `Sprint 131 D5: geocoding uses Node 24's built-in fetch; node-fetch removed (supersedes #225) (v11.67.0)`. The body follows `pr-contract.yml`'s required headers. Read them from `.github/workflows/pr-contract.yml` or the last merged PR (#267) before writing. Include:
- why not the bump (the evidence list above);
- the mutation table;
- "No user-visible change: no guide, landing or onboarding update";
- "Supersedes #225: do not merge it".

End the body with the Claude Code attribution line.

- [ ] **Step 7: Stop at "PR green"**

Merging needs the maintainer's explicit authorization for this PR. Record the handoff state before asking (a merge can strand an unlanded handoff).

---

## Post-merge verification (only after the maintainer authorizes the merge)

1. Confirm no other master deploy is in flight (`gh run list --branch master -L 3`). Merge per the maintainer's instruction. Watch the CI/CD run through **Deploy to Demo**: all 9 services healthy, `DEPLOYMENT SUCCESSFUL`, no rollback.
2. **Smoke, within the rate limit: one login only.** `POST https://karmyq.com/api/auth/login` (maria.reyes, sim password) → 200. Then:
   - `/api/requests` → 200;
   - `/api/conversations` → 200;
   - `/api/reputation/karma/:userId` → 200.
   Use `node -e` fetch (Windows: no `curl`/`jq`).
3. **Geocoding live check.** nginx routes `^/api/geocoding(/.*)?$` to `geocoding_service` with `/api/geocoding` stripped (`infrastructure/nginx/nginx.conf:269-271`). So:
   - `GET https://karmyq.com/api/geocoding/search?q=Klamath%20Falls%20Main%20St` (a query unlikely to be cached, no login needed; it counts against geocoding's own 60/min search limiter, not auth's) must return **non-empty** `data.results` with `data.source: "nominatim"`. **A 200 with empty results is the failure signature, not a pass.** If it comes back `source: "cache"`, try another uncached query.
   - This makes one real outbound Nominatim request, which the usage policy allows. It writes one row to the geocoding cache, the same as any user's search. That is not a demo data operation, but mention it in the report.
4. `gh pr view 225 --json state`. Dependabot usually closes a PR whose dependency left the manifest. If #225 is still open, **ask the maintainer** before closing it as superseded; do not close it unasked.
5. Record the results in this plan's Execution notes and in the handoff, on the **next** lane's branch (D6, zod #264) cut from the deployed master. Never make a docs-only master push.

## Execution notes

Executed 2026-09-23/24 by Claude (Native, `superpowers:executing-plans`), after plan review round 2 (maintainer-relayed). Commits `f9478357` (Task 1), `1b56e923` (Task 2), `75f43cda` (docs + 11.67.0), `f5bc5458` (`/simplify`), `d239a586` (landing page), `c84e1281` (final-review fix).

**Review round 2 rulings, applied at execution time:**
- The default-fetch case asserts `received` length first, so M7 fails by showing `Received length: 0`.
- The 2000 ms ceiling became `WATCHDOG_MS = 4000`: generous, but still below the 5000 ms production value.
- Task 2 Step 1's grep is restricted to `index.js` and `src/`, and the declarations gate stays the guard. Proven: injecting `require('node-fetch')` into `index.js` makes the gate fail with `services/geocoding-service: node-fetch (index.js)`.

**RED:** 7/7 failed, each for the expected reason:
- no default fetch, so the stub received 0 requests;
- the ignored `url` option sent the 503 case's call to the public URL, which the guard refused;
- `NOMINATIM_TIMEOUT_MS` was undefined;
- `index.js` still contained `node-fetch`.

**GREEN:** 7/7. After the manual promotion to `regression/`, the workspace ran unit 5/5 and regression 25/25.

**Mutations** (on the Step 7 commit, each reverted):

| # | Red | Cases |
|---|---|---|
| M1 | 4 | default, hang, stall, createApp |
| M2 | 4 | hang and stall hit Jest's 10 s timeout; createApp; 5000 ms |
| M3 | 2 | 5000 ms, createApp |
| M4 | 4 | default, hang, stall, createApp |
| M5 | 4 | default, hang, stall, createApp |
| M6 | 1 | boot |
| M7 | 3 | default shows `Received length: 0`; hang; stall |
| M8 | 1 | createApp only; the helper case stays green, as designed |

**Task 2:**
- The lock node's dependencies are now `cors, express, express-rate-limit, helmet, pg`. `node_modules/node-fetch@2.7.0` (prod) is kept.
- `npx -y npm@11.19.0 ci` exited 0 and left the lock unchanged.
- `npm ls node-fetch` shows only `@karmyq/mobile → react-native-web → fbjs → cross-fetch → node-fetch@2.7.0`.
- The declarations gate passed 10/10.

**Gates:**
- **Full suite** (`npx turbo run test --concurrency=2 --force`): exit 0.
- **Landing docs:** only `geocoding-service.json` was committed (real CONTEXT content). The timestamp/sha churn and a D4 notification-service catch-up were reverted.
- **`/simplify` (4 agents).** Applied:
  - `guardedFetch` replaces two near-copy URL guards;
  - `NOMINATIM_TIMEOUT_MS` is module-private again;
  - the boot test awaits the killed child's exit.
  Skipped, with reasons in the ledger:
  - dropping the helper 5000 ms case (it is the contrast to M8);
  - a `tests/helpers` module;
  - reading the non-2xx body.
  Deferred to `docs/IDEAS.md` [2026-09-23] D5 `/simplify`:
  - geocoder failures swallowed as 200-empty;
  - request-service's header-only timeouts;
  - the image-size script's fetch timeout;
  - the unread non-2xx body.
- **`/code-review` medium:** 0 findings.
- **`/security-review`:** 0 findings. Maintainer wording corrections:
  - availability protection is retained;
  - only the initial destination is fixed, and redirect following is unchanged;
  - no additional data exposure is introduced (logs also carry upstream status and error messages).
- **Final whole-branch review** (fresh, opus): 0 Critical, 0 Important, 5 Minor.
  - Minor 1 was re-graded to Important and fixed: a URL typo in `NOMINATIM_SEARCH_URL` passed 7/7, so the helper case now pins the literal, and the same typo turns 1 case red.
  - Deferred: the sequential "next miss" (a queued-waiter variant was not added); the header comment over-claims "every case runs real fetch"; the boot child runs outside the fetch guard.

**Post-merge verification (2026-09-24):** #269 merged as `32588ae9` (squash admin merge on explicit authorization, head `a083e366`). CI/CD run 36038174514: every job success, all 9 services healthy including geocoding, Demo Deployment Successful. Smoke, one login: login 200 (RateLimit-Remaining 9); `/api/requests`, `/api/conversations`, `/api/reputation/karma/:userId` all 200. **`GET /api/geocoding/search?q=Klamath Falls Main Street` → 200, `source: "nominatim"`, 2 results** — the built-in fetch path works against live Nominatim. #225 closed by Dependabot at 18:02:14Z. Plan-review correction recorded: PR CI *does* build geocoding's image (Test Docker Build), and a failed post-deploy health check does not roll back automatically (ci.yml:493 only exits 1).
