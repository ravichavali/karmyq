# Geocoding Cache Service

**Port**: 3009
**Database**: PostgreSQL (geocoding_cache table)
**Purpose**: Three-tier caching system for address geocoding to minimize external API calls

## Overview

The Geocoding Cache Service provides a shared backend cache layer for address lookups, reducing external Nominatim API calls by 95%+ through intelligent multi-tier caching.

## Architecture

```
User Request
    ↓
Tier 1: IndexedDB (Browser) → ~5ms (instant)
    ↓ (miss)
Tier 2: PostgreSQL (Backend) → ~50ms (this service) ✅
    ↓ (miss)
Tier 3: localStorage (Legacy) → ~10ms
    ↓ (miss)
Tier 4: Nominatim API (External) → ~500ms
```

## Features

- **Shared Cache**: One user's API call benefits all users
- **Hit Tracking**: Analytics on popular searches and cache efficiency
- **Auto-Expiration**: 30-day TTL for cached results
- **Rate Limiting**: Respects Nominatim's 1 req/sec limit
- **Fire-and-Forget Caching**: Non-blocking cache updates

## API Endpoints

### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "geocoding-cache",
  "port": "3009"
}
```

### `GET /search?q={query}`
Search for geocoded addresses. Returns cached results if available, otherwise calls Nominatim API and caches the result.

**Parameters:**
- `q` (required): Search query (e.g., "San Francisco")

**Response:**
```json
{
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
```

### `POST /cache`
Manually cache a geocoding result.

**Body:**
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

### `GET /stats`
Get cache statistics and analytics.

**Response:**
```json
{
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
```

### `POST /cleanup`
Remove expired cache entries (older than 30 days).

**Response:**
```json
{
  "message": "Cleanup completed",
  "deleted_count": 5
}
```

## Database Schema

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
```

## Environment Variables

- `PORT` - Service port (default: 3009)
- `DB_HOST` - PostgreSQL host (default: postgres)
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_NAME` - Database name (default: karmyq_db)
- `DB_USER` - Database user (default: karmyq)
- `DB_PASSWORD` - Database password

## Performance Benefits

**Without Cache:**
- Every search: ~500ms (external API)
- Rate limited to 1 req/sec
- Network dependent

**With Three-Tier Cache:**
- First search: ~500ms (external API, cached for all users)
- Same user, repeat search: ~5ms (IndexedDB)
- Other users: ~50ms (PostgreSQL backend)
- **95%+ reduction in external API calls**

## Development

```bash
# Install dependencies
npm install

# Start service
npm start

# Development mode (with hot reload)
npm run dev
```

## Testing

```bash
# Health check
curl http://localhost:3009/health

# Search for address
curl "http://localhost:3009/search?q=Oakland"

# Get cache stats
curl http://localhost:3009/stats

# Manual cache entry
curl -X POST http://localhost:3009/cache \
  -H "Content-Type: application/json" \
  -d '{"query":"test","results":[...]}'
```

## Integration

The frontend integrates with this service via `apps/frontend/src/lib/geocoding.ts`, which implements the complete three-tier fallback logic:

1. Check IndexedDB (browser-local)
2. Check backend cache (this service)
3. Check localStorage (legacy)
4. Call external API (and cache in all tiers)

All cache layers are updated simultaneously using fire-and-forget patterns to avoid blocking the user experience.
