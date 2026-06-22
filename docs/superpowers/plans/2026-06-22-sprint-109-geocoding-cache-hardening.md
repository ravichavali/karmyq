# Geocoding Cache Hardening & Dependency Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Keep `geocoding-service` as Karmyq's shared geocoding cache and public-API policy boundary,
then harden its tests, response contract, docs, and dependency posture.

**Architecture:** `geocoding-service` remains a small JavaScript Express service on port 3009. It
serves browser geocoding through local-cache-first frontend calls, PostgreSQL shared cache reads, and a
centrally throttled Nominatim fallback; no new service is introduced and no existing service absorbs it.

**Tech Stack:** Node.js/Express/JavaScript, PostgreSQL 15, Next.js 14 frontend consumer, Jest +
Supertest for service tests, npm audit/overrides for dependency hygiene.

## Global Constraints

- Sprint branch: `feature/sprint-109-geocoding-cache-hardening`.
- Version target: `v11.16.0 -> v11.17.0`.
- Do not decommission `geocoding-service`.
- Do not make browser-to-Nominatim the primary autocomplete path.
- Keep public Nominatim calls centralized, identified, cached, and throttled to at most one outbound
  request per second per process.
- No member forget/export work in this sprint.
- No paid geocoding provider or reverse geocoding work in this sprint.
- Do not use `npm audit fix --force`.
- Do not take major Expo/Jest migrations for moderate alerts unless proven safe.

---

## File Map

### New files to create

| File | Responsibility |
|---|---|
| `services/geocoding-service/src/geocodingApp.js` | Testable Express app factory and route registration, extracted from `index.js`. |
| `services/geocoding-service/src/geocodingService.js` | Query normalization, validation, cache lookup/write, outbound throttled Nominatim caller. |
| `services/geocoding-service/src/response.js` | Small ADR-074 response helpers for this JavaScript service. |
| `services/geocoding-service/tests/unit/geocodingService.test.js` | Unit tests for normalization, validation, cache-hit/miss behavior, outbound throttling, and Nominatim failure fallback. |
| `services/geocoding-service/tests/regression/geocodingRoutes.test.js` | Route-level regression tests for response envelopes and no external call on cache hit. |
| `docs/adr/ADR-080-geocoding-cache-policy-boundary.md` | ADR recording the decision to keep and harden the backend geocoding cache. |

### Existing files to modify

| File | Change |
|---|---|
| `services/geocoding-service/index.js` | Become a thin server bootstrap around `createApp`. |
| `services/geocoding-service/package.json` | Add Jest/Supertest scripts and dev dependencies if not already hoisted. |
| `apps/frontend/src/lib/geocoding.ts` | Clarify backend-first external policy boundary and verify direct fallback stays last. |
| `apps/frontend/tests/tdd/geocoding.test.ts` | Add/adjust frontend test proving backend tier is attempted before direct Nominatim fallback. |
| `services/geocoding-service/CONTEXT.md` | Update API envelopes, dependencies, policy boundary, tests, and recent fixes. |
| `services/geocoding-service/.claude/README.md` | Correct dependency/dependent drift and JavaScript service layout. |
| `services/geocoding-service/README.md` | Align overview and examples with hardened API contract. |
| `services/registry.json` | Correct dependencies and endpoint descriptions. |
| `apps/frontend/CONTEXT.md` | Document frontend geocoding boundary. |
| `docs/adr/README.md` | Add ADR-080. |
| `docs/adr/ADR-071-service-consolidation-feed-service.md` | Update follow-up to point to ADR-080 instead of assuming geocoding removal. |
| `apps/landing/src/data/docs/concepts/adr-080-geocoding-cache-policy-boundary.json` | Generated/committed landing ADR page. |
| `apps/landing/src/data/docs/nav.json` | Add ADR-080 under Architecture Decisions. |
| `apps/landing/src/data/docs/services/geocoding-service.json` | Update landing service docs. |
| `package.json`, `package-lock.json` | Version bump and safe dependency/override changes if Sprint 109 remediates moderate alerts. |
| `.claude/handoff/CURRENT_HANDOFF.md` | Track execution state and final outcome. |

---

## Critical Implementation Notes

1. **Do not decommission `geocoding-service`.** The backend is retained as the shared cache and external
   API policy boundary.
2. **Do not make browser-to-Nominatim the primary autocomplete path.** Direct external calls stay a
   last-resort fallback after local caches and backend cache fail.
3. **Respect the Nominatim policy.** Centralize outbound Nominatim calls, send a real Karmyq
   `User-Agent`, cache results, and throttle app-wide external requests to at most one request per
   second per process.
4. **Per-client HTTP rate limits are not enough.** `express-rate-limit` limits inbound callers; add a
   separate outbound throttle around `callNominatimAPI`.
5. **Response envelopes should match ADR-074.** Keep `/health` compatible, but use
   `{ success, data, message, error }` for API and error responses.
6. **Fix documentation drift.** The service is not "no dependents" in practice: frontend geocoding
   consumes it. It uses PostgreSQL, not Redis.
7. **Add test scripts before relying on tests.** `services/geocoding-service/package.json` currently has
   no `test`, `test:unit`, or `test:regression` scripts.
8. **Mock external calls in tests.** Tests must not call public Nominatim. Use mocked `fetch` and mocked
   `pool.query`.
9. **Do not take risky dependency majors.** Moderate audit cleanup is bounded; Expo/Jest major churn is
   out of scope unless proven safe.
10. **Update ADR-071/ADR-080 coherently.** ADR-071's geocoding follow-up should point to ADR-080's
    decision to retain and harden the service.

---

## Task 1: Branch, Baseline, And Audit Snapshot

**Files:**
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

**Interfaces:**
- Consumes: current `master` at v11.16.0.
- Produces: branch and baseline command outputs for the PR body.

- [ ] Create the sprint branch from current `origin/master`.

```bash
git fetch origin
git checkout master
git pull --ff-only origin master
git checkout -b feature/sprint-109-geocoding-cache-hardening
```

- [ ] Record baseline service and audit state.

```bash
git status --short
npm audit --package-lock-only --audit-level=high --json
npm audit --package-lock-only --audit-level=moderate --json
```

Expected high/critical result: `high: 0`, `critical: 0`. If high/critical is nonzero, pause and
resolve it before continuing.

- [ ] Run current geocoding service tests to prove the baseline has no usable package test script.

```bash
npm --workspace=geocoding-service test
```

Expected before Task 2: npm reports no `test` script. This is the red baseline for adding test
infrastructure.

- [ ] Update `.claude/handoff/CURRENT_HANDOFF.md` status if execution starts in a new chat.

```bash
git add .claude/handoff/CURRENT_HANDOFF.md
git commit -m "docs: start Sprint 109 geocoding hardening"
```

---

## Task 2: Add Test Harness For The JavaScript Service

**Files:**
- Modify: `services/geocoding-service/package.json`
- Create: `services/geocoding-service/tests/unit/geocodingService.test.js`
- Create: `services/geocoding-service/tests/regression/geocodingRoutes.test.js`

**Interfaces:**
- Consumes: Node.js CommonJS service files.
- Produces: package scripts `test`, `test:unit`, `test:regression`.

- [ ] Add test scripts and test dependencies.

Update `services/geocoding-service/package.json` scripts to:

```json
{
  "start": "node index.js",
  "dev": "nodemon index.js",
  "test": "npm run test:unit && npm run test:regression",
  "test:unit": "jest tests/unit --runInBand",
  "test:regression": "jest tests/regression --runInBand"
}
```

Add dev dependencies if absent from the root lock:

```json
{
  "jest": "^29.7.0",
  "supertest": "^7.0.0"
}
```

Use the repo's existing Jest version if `package-lock.json` already resolves a compatible version.

- [ ] Create the initial unit test file with a failing import.

```js
const {
  normalizeQuery,
  validateSearchQuery,
  createExternalThrottle,
} = require('../../src/geocodingService')

describe('geocodingService helpers', () => {
  test('normalizes query case and whitespace', () => {
    expect(normalizeQuery('  San   Jose  ')).toBe('san jose')
  })

  test('rejects short or unsafe queries', () => {
    expect(validateSearchQuery('s')).toEqual({ ok: false, code: 'INVALID_QUERY' })
    expect(validateSearchQuery('Oakland<script>')).toEqual({ ok: false, code: 'INVALID_QUERY' })
  })

  test('throttle waits before a second external call', async () => {
    jest.useFakeTimers()
    const throttle = createExternalThrottle(1000)
    const calls = []

    const first = throttle(() => {
      calls.push('first')
      return Promise.resolve('first')
    })
    await first

    const second = throttle(() => {
      calls.push('second')
      return Promise.resolve('second')
    })

    expect(calls).toEqual(['first'])
    jest.advanceTimersByTime(1000)
    await second
    expect(calls).toEqual(['first', 'second'])
    jest.useRealTimers()
  })
})
```

- [ ] Create the initial route regression test with a failing import.

```js
const request = require('supertest')
const { createApp } = require('../../src/geocodingApp')

describe('geocoding routes', () => {
  test('GET /search rejects invalid query with ADR-074 error envelope', async () => {
    const app = createApp({ pool: {}, fetchImpl: jest.fn() })

    const res = await request(app).get('/search?q=s').expect(400)

    expect(res.body).toEqual({
      success: false,
      message: 'Query must be at least 2 characters',
      error: 'INVALID_QUERY',
    })
  })
})
```

- [ ] Run the new tests and confirm they fail because modules do not exist yet.

```bash
npm --workspace=geocoding-service run test:unit
npm --workspace=geocoding-service run test:regression
```

Expected: both fail with `Cannot find module '../../src/geocodingService'` or
`Cannot find module '../../src/geocodingApp'`.

- [ ] Commit the test harness.

```bash
git add services/geocoding-service/package.json services/geocoding-service/tests
git commit -m "test(geocoding): add service test harness"
```

---

## Task 3: Extract Testable Geocoding Service Logic

**Files:**
- Create: `services/geocoding-service/src/geocodingService.js`
- Create: `services/geocoding-service/src/response.js`
- Modify: `services/geocoding-service/tests/unit/geocodingService.test.js`

**Interfaces:**
- Produces:
  - `normalizeQuery(query: string): string`
  - `validateSearchQuery(query: unknown): { ok: true, value: string } | { ok: false, code: string, message: string }`
  - `createExternalThrottle(intervalMs: number): <T>(fn: () => Promise<T>) => Promise<T>`
  - `createGeocodingService({ pool, fetchImpl, now, logger }): object`

- [ ] Implement `response.js`.

```js
function sendSuccess(res, data, message) {
  const body = { success: true, data }
  if (message) body.message = message
  return res.json(body)
}

function sendError(res, status, error, message) {
  return res.status(status).json({ success: false, message, error })
}

module.exports = { sendSuccess, sendError }
```

- [ ] Implement helper exports in `geocodingService.js`.

```js
const DEFAULT_USER_AGENT = 'Karmyq/1.0 (mutual aid platform; https://karmyq.com)'

function normalizeQuery(query) {
  return String(query || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

function validateSearchQuery(query) {
  if (typeof query !== 'string') {
    return { ok: false, code: 'INVALID_QUERY', message: 'Query must be at least 2 characters' }
  }
  const trimmed = query.trim()
  if (trimmed.length < 2) {
    return { ok: false, code: 'INVALID_QUERY', message: 'Query must be at least 2 characters' }
  }
  const sanitized = trimmed.slice(0, 200)
  if (!/^[a-zA-Z0-9\s,.-]+$/.test(sanitized)) {
    return { ok: false, code: 'INVALID_QUERY', message: 'Query contains unsupported characters' }
  }
  return { ok: true, value: normalizeQuery(sanitized) }
}

function createExternalThrottle(intervalMs) {
  let lastRun = 0
  let chain = Promise.resolve()

  return function throttled(fn) {
    chain = chain.then(async () => {
      const elapsed = Date.now() - lastRun
      if (lastRun > 0 && elapsed < intervalMs) {
        await new Promise(resolve => setTimeout(resolve, intervalMs - elapsed))
      }
      lastRun = Date.now()
      return fn()
    })
    return chain
  }
}

module.exports = {
  DEFAULT_USER_AGENT,
  normalizeQuery,
  validateSearchQuery,
  createExternalThrottle,
}
```

- [ ] Run unit tests.

```bash
npm --workspace=geocoding-service run test:unit
```

Expected: helper tests pass.

- [ ] Commit the helper extraction.

```bash
git add services/geocoding-service/src services/geocoding-service/tests/unit/geocodingService.test.js
git commit -m "feat(geocoding): extract testable service helpers"
```

---

## Task 4: Extract Express App And Preserve Routes

**Files:**
- Create: `services/geocoding-service/src/geocodingApp.js`
- Modify: `services/geocoding-service/index.js`
- Modify: `services/geocoding-service/tests/regression/geocodingRoutes.test.js`

**Interfaces:**
- Consumes: `sendSuccess`, `sendError`, geocoding service helpers.
- Produces: `createApp({ pool, fetchImpl, logger }): Express.Application`.

- [ ] Implement `createApp` with injectable dependencies.

```js
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const { sendSuccess, sendError } = require('./response')
const {
  validateSearchQuery,
  createExternalThrottle,
  DEFAULT_USER_AGENT,
} = require('./geocodingService')

function createApp({ pool, fetchImpl, logger = console, allowedOrigins = ['http://localhost:3000'] }) {
  const app = express()
  const searchLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false })
  const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false })
  const throttleExternal = createExternalThrottle(1000)

  app.use(helmet())
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true)
      else callback(new Error(`CORS blocked: ${origin}`))
    },
    credentials: true,
  }))
  app.use(express.json())

  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'geocoding-cache', port: process.env.PORT || 3009 })
  })

  app.get('/search', searchLimiter, async (req, res) => {
    const validation = validateSearchQuery(req.query.q)
    if (!validation.ok) return sendError(res, 400, validation.code, validation.message)

    const normalized = validation.value
    try {
      const cached = await pool.query(
        'SELECT results, hit_count FROM geocoding_cache WHERE query = $1 AND expires_at > NOW()',
        [normalized]
      )

      if (cached.rows.length > 0) {
        await pool.query(
          'UPDATE geocoding_cache SET hit_count = hit_count + 1, last_accessed = NOW() WHERE query = $1',
          [normalized]
        )
        return sendSuccess(res, { results: cached.rows[0].results, source: 'cache', cached: true })
      }

      const apiResults = await throttleExternal(() => callNominatim(fetchImpl, normalized, logger))
      if (apiResults.length > 0) {
        await pool.query(
          `INSERT INTO geocoding_cache (query, results)
           VALUES ($1, $2)
           ON CONFLICT (query) DO UPDATE
           SET results = $2, hit_count = geocoding_cache.hit_count + 1, last_accessed = NOW()`,
          [normalized, JSON.stringify(apiResults)]
        )
      }
      return sendSuccess(res, { results: apiResults, source: 'nominatim', cached: false })
    } catch (error) {
      logger.error('Geocoding search error:', error)
      return sendError(res, 500, 'GEOCODING_SEARCH_FAILED', 'Failed to search addresses')
    }
  })

  app.post('/cache', writeLimiter, async (req, res) => {
    const validation = validateSearchQuery(req.body.query)
    if (!validation.ok) return sendError(res, 400, validation.code, validation.message)
    if (!Array.isArray(req.body.results)) {
      return sendError(res, 400, 'INVALID_RESULTS', 'Results must be an array')
    }

    await pool.query(
      `INSERT INTO geocoding_cache (query, results)
       VALUES ($1, $2)
       ON CONFLICT (query) DO UPDATE
       SET results = $2, cached_at = NOW(), expires_at = NOW() + INTERVAL '30 days'`,
      [validation.value, JSON.stringify(req.body.results)]
    )
    return sendSuccess(res, { query: validation.value }, `Cached results for: ${validation.value}`)
  })

  app.get('/stats', searchLimiter, async (req, res) => {
    const stats = await pool.query(`
      SELECT COUNT(*) as total_entries,
             SUM(hit_count) as total_hits,
             COUNT(*) FILTER (WHERE expires_at > NOW()) as active_entries,
             COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_entries,
             AVG(hit_count)::INTEGER as avg_hit_count,
             MAX(hit_count) as max_hit_count
      FROM geocoding_cache
    `)
    const topQueries = await pool.query(`
      SELECT query, hit_count, last_accessed
      FROM geocoding_cache
      WHERE expires_at > NOW()
      ORDER BY hit_count DESC
      LIMIT 10
    `)
    return sendSuccess(res, { stats: stats.rows[0], top_queries: topQueries.rows })
  })

  app.post('/cleanup', writeLimiter, async (req, res) => {
    const result = await pool.query('DELETE FROM geocoding_cache WHERE expires_at <= NOW()')
    return sendSuccess(res, { deleted: result.rowCount }, `Deleted ${result.rowCount} expired cache entries`)
  })

  return app
}

async function callNominatim(fetchImpl, normalized, logger) {
  const response = await fetchImpl(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(normalized)}&format=json&limit=5&addressdetails=1`,
    { headers: { 'User-Agent': DEFAULT_USER_AGENT }, timeout: 5000 }
  )
  if (!response.ok) {
    logger.error(`Nominatim API error: ${response.status}`)
    return []
  }
  const results = await response.json()
  if (!Array.isArray(results)) return []
  return results.map(result => ({
    display_name: result.display_name || 'Unknown location',
    address: result.display_name?.split(',')[0] || normalized,
    lat: parseFloat(result.lat) || 0,
    lng: parseFloat(result.lon) || 0,
    type: result.type || 'place',
  }))
}

module.exports = { createApp, callNominatim }
```

- [ ] Replace `index.js` with a thin bootstrap using the extracted app.

```js
const { Pool } = require('pg')
const fetch = require('node-fetch')
const { createApp } = require('./src/geocodingApp')

const PORT = process.env.PORT || 3009
const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, max: 5 }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'karmyq',
      user: process.env.DB_USER || 'karmyq_user',
      password: process.env.DB_PASSWORD || 'karmyq_password_dev',
      max: 5,
    }
const pool = new Pool(poolConfig)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(o => o.trim())

const app = createApp({ pool, fetchImpl: fetch, allowedOrigins })
const server = app.listen(PORT, () => {
  console.log(`Geocoding Cache Service running on port ${PORT}`)
})

process.on('SIGTERM', async () => {
  console.log('Shutting down geocoding service...')
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
})
```

- [ ] Expand route regression tests for cache hit and cache miss.

```js
test('GET /search returns cached result without calling external geocoder', async () => {
  const pool = {
    query: jest.fn()
      .mockResolvedValueOnce({ rows: [{ results: [{ display_name: 'Oakland', lat: 37.8, lng: -122.2, type: 'city' }], hit_count: 2 }] })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
  }
  const fetchImpl = jest.fn()
  const app = createApp({ pool, fetchImpl })

  const res = await request(app).get('/search?q=Oakland').expect(200)

  expect(res.body.success).toBe(true)
  expect(res.body.data.cached).toBe(true)
  expect(fetchImpl).not.toHaveBeenCalled()
})
```

- [ ] Run route tests.

```bash
npm --workspace=geocoding-service run test:regression
```

Expected: all route tests pass.

- [ ] Commit the extraction.

```bash
git add services/geocoding-service/index.js services/geocoding-service/src services/geocoding-service/tests/regression
git commit -m "feat(geocoding): extract hardened app routes"
```

---

## Task 5: Frontend Boundary Regression

**Files:**
- Modify: `apps/frontend/src/lib/geocoding.ts`
- Modify: `apps/frontend/tests/tdd/geocoding.test.ts`

**Interfaces:**
- Consumes: `searchAddresses(query: string): Promise<AddressSuggestion[]>`.
- Produces: a tested guarantee that backend cache is attempted before direct Nominatim fallback.

- [ ] Add or update a frontend TDD test that mocks local caches empty, backend down/up, and direct fetch.

```ts
it('tries the backend geocoding cache before direct Nominatim fallback', async () => {
  ;(geocodingCache.searchCommonLocations as jest.Mock).mockResolvedValue([])
  ;(geocodingCache.getCachedResult as jest.Mock).mockResolvedValue(null)
  ;(geocodingCache.cacheAPIResult as jest.Mock).mockResolvedValue(undefined)

  const fetchMock = global.fetch as jest.Mock
  fetchMock
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ display_name: 'Oakland, CA', address: 'Oakland', lat: 37.8044, lng: -122.2712, type: 'city' }],
        cached: true,
      }),
    })

  const results = await searchAddresses('Oakland')

  expect(fetchMock.mock.calls[0][0]).toContain('/search?q=Oakland')
  expect(fetchMock.mock.calls[0][0]).not.toContain('nominatim.openstreetmap.org')
  expect(results[0].address).toBe('Oakland')
})
```

- [ ] Add a short code comment in `geocoding.ts` above the direct external fallback.

```ts
// Last-resort fallback only: the backend geocoding cache is the app-wide Nominatim policy boundary.
// Keep local caches + backend cache ahead of direct public API calls.
```

- [ ] Run the focused frontend geocoding test.

```bash
cd apps/frontend
npm test -- geocoding.test.ts
```

Expected: geocoding tests pass.

- [ ] Commit the frontend boundary test.

```bash
git add apps/frontend/src/lib/geocoding.ts apps/frontend/tests/tdd/geocoding.test.ts
git commit -m "test(frontend): lock backend geocoding boundary"
```

---

## Task 6: Dependency Hygiene

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

**Interfaces:**
- Consumes: npm audit JSON.
- Produces: clean high/critical audit and documented moderate disposition.

- [ ] Run current audits.

```bash
npm audit --package-lock-only --audit-level=high --json
npm audit --package-lock-only --audit-level=moderate --json
```

- [ ] If a safe leaf fix is available, add or update a scoped root override and apply with `npm update`.

Current likely candidates from the planning snapshot:

```json
{
  "overrides": {
    "tar": ">=7.5.16"
  }
}
```

Only use a version that exists in npm and does not violate existing ADR-059 tar override lessons. If no
patched `tar` version exists yet, do not invent one.

- [ ] If `js-yaml` can be fixed by a safe override without downgrading or major-changing Jest, apply it.

Candidate pattern:

```json
{
  "overrides": {
    "js-yaml": ">=4.1.2"
  }
}
```

Only apply if npm can resolve it and changed-package tests stay green. If npm resolves this by forcing
unsupported peers or breaking Jest config loading, revert the override and document carry-forward.

- [ ] Do not run `npm audit fix --force`.

- [ ] Re-run the audits and capture the remaining moderate count for the PR body.

```bash
npm audit --package-lock-only --audit-level=high
npm audit --package-lock-only --audit-level=moderate
```

Expected high/critical: clean. Moderate may remain if fixes require major Expo/Jest churn.

- [ ] Commit safe dependency changes, or commit only handoff/PR documentation if no safe changes land.

```bash
git add package.json package-lock.json .claude/handoff/CURRENT_HANDOFF.md
git commit -m "chore(security): triage moderate dependency drift"
```

---

## Task 7: Service Documentation And Registry

**Files:**
- Modify: `services/geocoding-service/CONTEXT.md`
- Modify: `services/geocoding-service/.claude/README.md`
- Modify: `services/geocoding-service/README.md`
- Modify: `services/registry.json`
- Modify: `apps/frontend/CONTEXT.md`

**Interfaces:**
- Consumes: hardened route and test behavior.
- Produces: accurate service docs.

- [ ] Update `services/geocoding-service/CONTEXT.md`.

Add a Sprint 109 recent fix section:

```md
## Sprint 109 - Geocoding Cache Hardening (2026-06-22)

- `geocoding-service` is retained as Karmyq's shared geocoding cache and external API policy boundary.
- `/search`, `/cache`, `/stats`, and `/cleanup` use ADR-074-style `{ success, data, message, error }`
  envelopes; `/health` keeps the flat health shape for infrastructure compatibility.
- Outbound Nominatim calls are centrally throttled and mocked in tests.
- Frontend remains local-cache-first, backend-cache-second, direct external fallback last.
```

- [ ] Correct `.claude/README.md`.

Required corrections:

```md
- **Database Schema**: `geocoding_cache` table in PostgreSQL
- **Infrastructure Dependencies**: postgres
- **Services That Depend On This**: none
- **Application Consumers**: `apps/frontend/src/lib/geocoding.ts`
```

- [ ] Update `services/registry.json` geocoding entry.

Use structured endpoints:

```json
{ "method": "GET", "path": "/search", "description": "Search shared geocoding cache and, on miss, query Nominatim through the service-level policy boundary." }
```

Ensure dependencies list `postgres` and not Redis.

- [ ] Update `apps/frontend/CONTEXT.md`.

Add a Sprint 109 note:

```md
- **Geocoding boundary:** `src/lib/geocoding.ts` must keep IndexedDB/common-location cache first,
  `geocoding-service` second, and direct Nominatim fallback last. The backend cache is the app-wide
  rate-limit/provider-switching boundary.
```

- [ ] Run service analysis if registry changed.

```bash
npm run analyze:services
```

- [ ] Commit docs and registry updates.

```bash
git add services/geocoding-service/CONTEXT.md services/geocoding-service/.claude/README.md services/geocoding-service/README.md services/registry.json apps/frontend/CONTEXT.md services/dependency-graph.md services/impact-analysis.md
git commit -m "docs(geocoding): document cache policy boundary"
```

---

## Task 8: ADR And Landing Docs

**Files:**
- Create: `docs/adr/ADR-080-geocoding-cache-policy-boundary.md`
- Modify: `docs/adr/README.md`
- Modify: `docs/adr/ADR-071-service-consolidation-feed-service.md`
- Create: `apps/landing/src/data/docs/concepts/adr-080-geocoding-cache-policy-boundary.json`
- Modify: `apps/landing/src/data/docs/services/geocoding-service.json`
- Modify: `apps/landing/src/data/docs/nav.json`

**Interfaces:**
- Consumes: Sprint 109 design decision.
- Produces: durable architecture record and public docs.

- [ ] Create ADR-080 with this decision summary.

```md
# ADR-080: Retain Geocoding Cache as External API Policy Boundary

**Status:** Implemented
**Date:** 2026-06-22
**Sprint:** 109

## Context

ADR-071 listed geocoding-service as a candidate for removal after feed-service was folded into
request-service. During Sprint 109 planning, we rechecked the public Nominatim usage policy. Karmyq's
frontend address search is autocomplete-like and can be triggered by many users; direct browser calls
would weaken shared caching, app-wide throttling, provider switching, and policy compliance.

## Decision

Keep `geocoding-service` as a small backend cache and external geocoder policy boundary. The service
continues to own shared PostgreSQL geocoding cache reads/writes, centralized outbound throttling, and
Nominatim application identification. The frontend remains local-cache-first and uses the backend cache
before any direct fallback.

## Consequences

- Backend service count remains 10.
- `geocoding-service` is no longer a near-term decommission candidate.
- The service must carry tests and docs like any other production service.
- A future provider swap can happen server-side without requiring browser code to know provider details.

## Alternatives Considered

Delete the backend and call Nominatim directly from the browser.

Rejected because it weakens app-wide policy compliance and shared caching.

Fold geocoding into request-service or community-service.

Deferred. It would reduce service count but increase ownership ambiguity and blast radius for a small,
optional, externally-facing utility.
```

- [ ] Update ADR-071 follow-up.

Replace the geocoding follow-up with:

```md
- Geocoding-service was re-evaluated in Sprint 109. ADR-080 keeps it as a backend cache and external
  API policy boundary rather than removing it.
```

- [ ] Add ADR-080 to `docs/adr/README.md`.

- [ ] Generate or create landing docs JSON for ADR-080 and update nav.

Use `scripts/generate-docs.ts` if it covers ADRs; otherwise create the JSON manually matching existing
ADR JSON shape.

- [ ] Grep-verify landing nav contains ADR-080.

```bash
rg -n "adr-080-geocoding-cache-policy-boundary" apps/landing/src/data/docs/nav.json apps/landing/src/data/docs/concepts
```

- [ ] Commit ADR and landing docs.

```bash
git add docs/adr/ADR-080-geocoding-cache-policy-boundary.md docs/adr/README.md docs/adr/ADR-071-service-consolidation-feed-service.md
git add -f apps/landing/src/data/docs/concepts/adr-080-geocoding-cache-policy-boundary.json apps/landing/src/data/docs/services/geocoding-service.json apps/landing/src/data/docs/nav.json
git commit -m "docs(adr): retain geocoding cache boundary"
```

---

## Task 9: Version Bump And Verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: any workspace package version files that already mirror root version.

**Interfaces:**
- Consumes: completed implementation tasks.
- Produces: v11.17.0 release metadata.

- [ ] Bump root version from `11.16.0` to `11.17.0`.

```json
{
  "version": "11.17.0"
}
```

- [ ] Refresh the lockfile in place.

```bash
npm install --package-lock-only --ignore-scripts
```

- [ ] Run focused checks.

```bash
npm --workspace=geocoding-service test
cd apps/frontend && npm test -- geocoding.test.ts
```

- [ ] Run broader checks.

```bash
npx tsc --noEmit
npm test
npm run feedback:check
```

If root Turbo exits before changed-package tests, also run the changed package tests directly as above
and record both outcomes.

- [ ] Commit release metadata.

```bash
git add package.json package-lock.json
git commit -m "chore: bump version to 11.17.0"
```

---

## Task 10: SDLC Quality Gates

**Files:**
- PR body and branch diff.

**Interfaces:**
- Consumes: full branch diff.
- Produces: reviewed and security-triaged branch ready for push.

- [ ] Run final testing gate.

```bash
npm --workspace=geocoding-service test
cd apps/frontend && npm test -- geocoding.test.ts
npm test
npm run test:tdd
npm run feedback:check
npm audit --package-lock-only --audit-level=high
```

- [ ] Run `/simplify` on the branch diff.

Verification: record findings and fixes in the PR body. If no findings, write "Simplify: no changes
requested."

- [ ] Run `/code-review` on the branch diff.

Verification: resolve correctness findings before merge. Record "Code review: no blocking findings" only
after review is complete.

- [ ] Run `/security-review` on the branch diff.

Verification: confirm no direct public autocomplete regression, no leaked geocoder errors, no high or
critical audit alerts, and no new CodeQL findings. Document any dependency-alert dismissal or carry-forward
in the PR body's Security dismissals section.

- [ ] Commit any gate fixes.

```bash
git status --short
git add <changed-files>
git commit -m "fix: address Sprint 109 review findings"
```

---

## Task 11: PR, Merge, And Deploy

**Files:**
- `.github/pull_request_template.md`
- `.claude/handoff/CURRENT_HANDOFF.md`

**Interfaces:**
- Consumes: completed branch and PR template.
- Produces: PR with contract, then deployed v11.17.0 after Admin authorization.

- [ ] Fill PR body from `.github/pull_request_template.md`.

Required sprint-specific entries:

```md
Summary:
- Hardened geocoding-service as the retained backend cache and external API policy boundary.
- Added service unit/regression tests and frontend boundary coverage.
- Triaged dependency audit drift; high/critical audit remains clean.

Security dismissals:
- List any unresolved moderate dependency alerts and why they are carry-forward rather than fixed here.
- List known CodeQL false positives only if this branch triggers them.
```

- [ ] Create PR.

```bash
git push -u origin feature/sprint-109-geocoding-cache-hardening
gh pr create --base master --head feature/sprint-109-geocoding-cache-hardening --title "Sprint 109: Geocoding Cache Hardening & Dependency Hygiene" --body-file <filled-template-file>
```

- [ ] Wait for CI and review.

```bash
gh pr checks --watch
gh pr view --json reviewDecision,mergeStateStatus,state
```

- [ ] After Admin authorization, merge using the repo's normal PR flow. Do not self-merge without
maintainer authorization.

- [ ] Deploy through the established CI/CD path after merge.

Use the `/deploy` skill or the repo deployment process:

```bash
git checkout master
git pull --ff-only origin master
```

Then monitor GitHub Actions deploy for the master push.

- [ ] Human validation checklist.

Validate on desktop and mobile:

```text
1. Open request creation with a location field.
2. Search for a common cached city/airport; confirm suggestions render quickly.
3. Search for a non-seeded valid address; confirm backend /search is used before direct external fallback.
4. Repeat the same search; confirm service logs or stats show cache hit/hit_count increase.
5. Confirm no browser console flood and no direct Nominatim calls during normal backend-available autocomplete.
6. Confirm /health and smoke-test still pass for geocoding-service.
```

- [ ] Update `.claude/handoff/CURRENT_HANDOFF.md` with final status and any carry-forward alerts.

```bash
git add .claude/handoff/CURRENT_HANDOFF.md
git commit -m "docs: update handoff after Sprint 109"
```

If this post-merge handoff update would require a docs-only push to `master`, fold it into the PR before
merge instead.

---

## Self-Review

- Spec coverage: geocoding backend retention, tests, docs, dependency hygiene, ADR, and deploy are covered.
- Ambiguity scan: no deferred implementation language is used; out-of-scope items are explicit.
- Type consistency: CommonJS exports/imports match across tasks.
- Risk check: public Nominatim is mocked in tests and never becomes the primary browser path.
