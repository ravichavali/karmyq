# Geocoding Cache Service Context

> **Quick Start**: `cd services/geocoding-service && npm run dev`
> **Port**: 3009 | **Health**: http://localhost:3009/health

## Purpose

`geocoding-service` is Karmyq's shared backend geocoding cache and external geocoder policy boundary.
It keeps browser autocomplete local-cache-first, shares PostgreSQL cache hits across users, centralizes
Nominatim application identification, and throttles outbound public Nominatim calls.

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

External Nominatim calls must be mocked in tests.

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

`express-rate-limit` stays at `^7.0.0` here (peer `4 || 5 || ^5.0.0-beta.1`) against root's `^8.2.2`
— a pre-existing, deliberate split; both majors accept Express 5.

Express **4.18.2 → 5.2.1**, supplied by the root `package.json` **production** dependency
(the Dockerfiles copy the root manifest and `npm install --omit=dev`). **No endpoint, payload,
status code or event contract changed** — `feedback:check` flags this service's `src/routes/`
diff as a "route change", but the diff is type annotations only, so the API Endpoints section
above is still accurate.

Express 5 semantics now in force: async handler rejections auto-forward to the error middleware,
`res.status()` throws `RangeError` on an out-of-range code, and `req.query` is a getter rather
than a writable own property.
