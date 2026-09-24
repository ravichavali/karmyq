# Geocoding Cache Service Context

> **Quick Start**: `cd services/geocoding-service && npm run dev`
> **Port**: 3009 | **Health**: http://localhost:3009/health

## Purpose

`geocoding-service` is Karmyq's shared backend geocoding cache and external geocoder policy boundary.
It keeps browser autocomplete local-cache-first, shares PostgreSQL cache hits across users, centralizes
Nominatim application identification, and throttles outbound public Nominatim calls.

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
  `nominatimUrl` and `nominatimTimeoutMs` exist for tests; production sets neither, and `createApp` does not
  forward them, so no HTTP input can reach them.
- Test: `tests/regression/sprint-131-geocoding-builtin-fetch.test.js` runs the real `fetch` against a 127.0.0.1
  stub (gzip, non-2xx, hang, stall, throttle recovery, the `createApp` composition, `index.js` boot). Eight
  mutations each turn it red, including the node-fetch 3 shape and a 50000 ms default injected between
  `createApp` and the helper.

## Sprint 130 PR B - Log injection fixed (2026-09-15)

CodeQL #540–#542 (`js/log-injection`) were **real**. `SAFE_ADDRESS_QUERY_PATTERN` allows `\s`, and
validation trims only the ends, so a query like `"Main St<newline>FORGED 200 OK"` passed validation.
The cache HIT, cache MISS and "Cached N results" log lines in `search()` interpolated that **raw**
query, so a caller could write a forged log line.

- The three lines now log `normalized`, the validated value. `normalizeQuery` collapses every
  whitespace run (`\n`, `\r`, U+2028 included) to one space.
- **Unchanged:** `normalizeQuery`, `validateSearchQuery` and the cache key. The key was already
  lowercased and whitespace-collapsed, so e.g. `"main st forged 200 ok"` is exactly what it was.
- Visible change: those log lines now show the lowercased, collapsed query instead of the raw one.
- Test: `tests/regression/sprint-130-log-injection.test.js` covers the miss, hit and cached paths for
  `\n`, `\r\n` and U+2028, and pins the cache key. Geocoding tests are `.js`, which the TDD promoter
  cannot see, so the file was moved to `regression/` by hand.
- Remaining `logger.` calls take no caller input (a fixed string, an HTTP status, an error message).

## Sprint 109 - Geocoding Cache Hardening (2026-06-22)

- `geocoding-service` is retained as Karmyq's shared geocoding cache and external API policy boundary.
- `/search`, `/cache`, `/stats`, and `/cleanup` use ADR-074-style `{ success, data, message, error }`
  envelopes; `/health` keeps the flat health shape for infrastructure compatibility.
- Outbound Nominatim calls are centrally throttled and mocked in tests.
- Frontend remains local-cache-first, backend-cache-second, direct external fallback last.
- Dependency docs now reflect PostgreSQL, not Redis, and `apps/frontend/src/lib/geocoding.ts` as the
  application consumer.

## Database Schema

### Tables Owned by This Service

```sql
CREATE TABLE geocoding_cache (
    query TEXT PRIMARY KEY,
    results JSONB NOT NULL,
    cached_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days',
    hit_count INTEGER DEFAULT 1,
    last_accessed TIMESTAMP DEFAULT NOW(),
    source VARCHAR(50) DEFAULT 'nominatim'
);

CREATE INDEX idx_geocoding_expires_at ON geocoding_cache(expires_at);
CREATE INDEX idx_geocoding_hit_count ON geocoding_cache(hit_count DESC);
CREATE INDEX idx_geocoding_last_accessed ON geocoding_cache(last_accessed DESC);
```

### Tables Read by This Service

- None; the cache table is service-specific and global.

## Architecture

The service is Tier 2 in the frontend geocoding flow:

```text
User Request
  -> Tier 1: IndexedDB common locations / API cache
  -> Tier 2: PostgreSQL shared cache (this service)
  -> Tier 3: localStorage legacy cache
  -> Tier 4: direct Nominatim fallback only for backend reachability failures
```

The backend owns the normal Nominatim path. Direct browser-to-Nominatim calls are last-resort fallback
only and must not become the primary autocomplete path.

## API Endpoints

### GET /health

Flat health check endpoint for infrastructure compatibility.

```json
{
  "status": "healthy",
  "service": "geocoding-cache",
  "port": "3009"
}
```

### GET /search?q={query}

Search the shared PostgreSQL cache. On miss, calls Nominatim through the service-level throttle and
caches successful results.

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "display_name": "Oakland, Alameda County, California, United States",
        "address": "Oakland",
        "lat": 37.8044,
        "lng": -122.2712,
        "type": "city"
      }
    ],
    "source": "cache",
    "cached": true
  }
}
```

Invalid queries return:

```json
{
  "success": false,
  "message": "Query must be at least 2 characters",
  "error": "INVALID_QUERY"
}
```

### POST /cache

Manually cache geocoding results, used by the frontend direct fallback as a non-blocking shared-cache
write.

```json
{
  "query": "oakland",
  "results": [
    {
      "display_name": "Oakland, Alameda County, California, United States",
      "address": "Oakland",
      "lat": 37.8044,
      "lng": -122.2712,
      "type": "city"
    }
  ]
}
```

Response:

```json
{
  "success": true,
  "data": {
    "query": "oakland"
  },
  "message": "Cached results for: oakland"
}
```

### GET /stats

Returns cache statistics and top active queries.

```json
{
  "success": true,
  "data": {
    "stats": {
      "total_entries": "1",
      "total_hits": "3",
      "active_entries": "1",
      "expired_entries": "0",
      "avg_hit_count": 3,
      "max_hit_count": 3
    },
    "top_queries": [
      {
        "query": "oakland",
        "hit_count": 3,
        "last_accessed": "2025-12-27T04:59:00.844Z"
      }
    ]
  }
}
```

### POST /cleanup

Deletes expired cache entries.

```json
{
  "success": true,
  "data": {
    "deleted": 5
  },
  "message": "Deleted 5 expired cache entries"
}
```

## Dependencies

### External Services

- **Nominatim API**: `https://nominatim.openstreetmap.org/search`
  - Public policy boundary is centralized in this service.
  - Outbound calls use Karmyq `User-Agent`.
  - Outbound calls are throttled to at most one call per second per process.
  - Outbound calls use Node 24's built-in `fetch` and abort after 5 s (`AbortSignal.timeout`).

### Infrastructure

- PostgreSQL 15+ for `geocoding_cache`.

### Application Consumers

- `apps/frontend/src/lib/geocoding.ts`

### Service Dependencies

- None.

## Implementation

- `src/geocodingApp.js`: Express app factory, middleware, rate limiters, and route registration.
- `src/geocodingService.js`: query normalization, validation, cache reads/writes, Nominatim call
  mapping, and outbound throttle.
- `src/response.js`: ADR-074 response helpers.
- `index.js`: server bootstrap and PostgreSQL connection setup.

## Testing

```bash
npm --workspace=geocoding-service test
npm --workspace=geocoding-service run test:unit
npm --workspace=geocoding-service run test:regression
```

Current coverage:

- Unit tests for normalization, validation, outbound throttling, and throttle recovery after rejection.
- Regression tests for `/search` error envelopes, cache hit behavior without external fetch, and recovery
  after transient external geocoder rejection.

External Nominatim calls must be mocked in tests, except in the Sprint 131 D5 suite, which uses a loopback
stub and a guard on the global `fetch` that throws on any URL other than the stub's.

## Common Tasks

```bash
curl http://localhost:3009/health
curl "http://localhost:3009/search?q=Oakland"
curl http://localhost:3009/stats
curl -X POST http://localhost:3009/cleanup
```

Manual cache entry:

```bash
curl -X POST http://localhost:3009/cache \
  -H "Content-Type: application/json" \
  -d '{"query":"oakland","results":[{"display_name":"Oakland, CA","address":"Oakland","lat":37.8044,"lng":-122.2712,"type":"city"}]}'
```

## Environment Variables

```bash
PORT=3009
DATABASE_URL=postgres://user:password@host:5432/karmyq
DB_HOST=localhost
DB_PORT=5432
DB_NAME=karmyq
DB_USER=karmyq_user
DB_PASSWORD=karmyq_password_dev
ALLOWED_ORIGINS=http://localhost:3000
```

## Known Issues & Future Enhancements

- No authentication; the cache is global and must not store user/community-specific state.
- Cache invalidation is time-based only.
- Reverse geocoding remains out of scope.
- Paid provider migration and self-hosted Nominatim remain future decisions.

---

**Status**: Production
**Version**: 11.17.0
**Last Updated**: 2026-06-22

---

## Sprint 122 — Express 5 (2026-07-29)

Declares `express` **directly**: `^4.18.2 → ^5.2.1`. This service is **plain JavaScript**
(`geocodingApp.js`, `geocodingService.js`, `response.js`) so it gets **no `tsc` coverage** and
declares no `@types/express`; runtime tests are the only signal. `tests/regression/geocodingRoutes.test.js`
was therefore extended with two Express 5 cases:

- `POST /cache` asserts the **arguments `pool.query` received** (`['oakland', JSON.stringify(results)]`),
  which proves `express.json()` — i.e. body-parser 2.x — delivered the parsed body all the way to the
  service layer. Had body parsing broken, `req.body.query` would throw and the route's own `catch`
  would return a 500 `GEOCODING_CACHE_FAILED` instead.
- `GET /health` proves `path-to-regexp` 8 still builds the route table.

⚠️ **`geocodingApp.js` has no express error middleware** — every route try/catches internally and
answers through `sendError`, so the ADR-074 envelope here comes from the route's own `catch`. No test
in this service may claim an async rejection reaches an express error handler, because there isn't one.

Express **4.18.2 → 5.2.1**, supplied by the root `package.json` **production** dependency
(the Dockerfiles copy the root manifest and `npm install --omit=dev`). **No endpoint, payload,
status code or event contract changed** — `feedback:check` flags this service's `src/routes/`
diff as a "route change", but the diff is type annotations only, so the API Endpoints section
above is still accurate.

Express 5 semantics now in force: async handler rejections auto-forward to the error middleware,
`res.status()` throws `RangeError` on an out-of-range code, and `req.query` is a getter rather
than a writable own property.

**⚠️ `req.body` default restored (the bug this PR actually shipped to CI).** body-parser 2 leaves
`req.body` **undefined** for a bodyless request where body-parser 1 gave `{}`, so `POST /cache`
reading `req.body.query` would throw and the route's catch would answer **500
GEOCODING_CACHE_FAILED** instead of a clean 400. Because this service is plain JS and does not
consume `@karmyq/shared`, it carries an **inline** equivalent of the shared
`normalizeRequestBody`, mounted immediately after `express.json()`. Pinned by a new case in
`tests/regression/geocodingRoutes.test.js` asserting the ADR-074 400 envelope, not a 500.

## Sprint 131 D3 — express-rate-limit 8 (2026-09-21)

`express-rate-limit` **→ 8.7.0** (#224). One PR moves root, `packages/shared`, cleanup-service and geocoding-service.
shared and geocoding were deliberately held back on **7.5.1** and are now on 8.
Their two `DIVERGENCE_ALLOWLIST` entries in `tests/regression/sprint-131-workspace-declarations.test.ts` are
removed: the gate's stale-entry test went red on #224 as soon as they stopped being divergences.

I checked behavior against the installed `dist/index.cjs` of both versions and with a real-Express probe:
- CommonJS `require()` still returns the function.
- `max` still maps to `limit`.
- `standardHeaders: true` still selects `draft-6`.
- The default key generator is still per-IP. v8 applies a /56 subnet to IPv6.
- None of v8's new validations fires for any option shape used here, and no test output contains `ERR_ERL`.

v8.7.0 adds a **runtime dependency, `debug@^4.4.3`**, installed under express-rate-limit's own folder because root
has `debug@2.6.9`.

Both limiters in `src/geocodingApp.js` use the default key generator, so they stay per-IP under v8.

No endpoint, payload or event change.
