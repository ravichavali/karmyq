# Geocoding Cache Service

**Port**: 3009
**Database**: PostgreSQL (`geocoding_cache`)
**Purpose**: Shared geocoding cache and public geocoder policy boundary

## Overview

The Geocoding Cache Service provides Karmyq's backend cache layer for address lookups. It reduces
repeated public Nominatim calls, centralizes app-wide outbound throttling, sends the Karmyq
`User-Agent`, and lets the platform switch geocoding providers server-side in the future.

## Architecture

```text
User Request
  -> Tier 1: IndexedDB common locations / API cache
  -> Tier 2: PostgreSQL shared cache (this service)
  -> Tier 3: localStorage legacy cache
  -> Tier 4: direct Nominatim fallback only for backend reachability failures
```

The backend is the normal external-geocoder boundary. Browser-to-Nominatim calls must stay
last-resort fallback, not the primary autocomplete path.

## Features

- **Shared Cache**: one user's cache miss can benefit all users.
- **Hit Tracking**: query popularity and cache efficiency are available through `/stats`.
- **Auto-Expiration**: cached results expire after 30 days.
- **Outbound Throttling**: public Nominatim calls are limited to one per second per service process.
- **ADR-074 Envelopes**: application routes return `{ success, data, message, error }`.

## API Endpoints

### `GET /health`

Infrastructure health check. This route intentionally keeps a flat response shape.

```json
{
  "status": "healthy",
  "service": "geocoding-cache",
  "port": "3009"
}
```

### `GET /search?q={query}`

Search the shared cache. On miss, the service calls Nominatim through the central policy boundary and
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

### `POST /cache`

Manually cache geocoding results.

```json
{
  "query": "oakland",
  "results": [
    {
      "display_name": "Oakland, CA",
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

### `GET /stats`

Get cache statistics and top active queries.

### `POST /cleanup`

Delete expired cache entries.

```json
{
  "success": true,
  "data": {
    "deleted": 5
  },
  "message": "Deleted 5 expired cache entries"
}
```

## Development

```bash
npm install
npm --workspace=geocoding-service run dev
npm --workspace=geocoding-service test
```

## Testing

```bash
npm --workspace=geocoding-service run test:unit
npm --workspace=geocoding-service run test:regression
```

External Nominatim calls are mocked in tests.

## Integration

The frontend consumes this service through `apps/frontend/src/lib/geocoding.ts`:

1. IndexedDB common locations and API cache
2. Backend `/search`
3. localStorage legacy cache
4. Direct Nominatim fallback only when the backend is unreachable

Successful direct fallback results are written back to `/cache` in a non-blocking call.
