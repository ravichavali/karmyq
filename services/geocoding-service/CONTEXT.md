# Geocoding Cache Service Context

> **Quick Start**: `cd services/geocoding-service && npm run dev`
> **Port**: 3009 | **Health**: http://localhost:3009/health

## Purpose

Provides a shared backend caching layer for address geocoding to minimize external Nominatim API calls by 95%+ through intelligent multi-tier caching.

## Database Schema

### Tables Owned by This Service

```sql
-- Geocoding cache table (no schema prefix - service-specific)
CREATE TABLE geocoding_cache (
    query TEXT PRIMARY KEY,
    results JSONB NOT NULL,
    cached_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days',
    hit_count INTEGER DEFAULT 1,
    last_accessed TIMESTAMP DEFAULT NOW(),
    source VARCHAR(50) DEFAULT 'nominatim'
);

-- Indexes
CREATE INDEX idx_geocoding_expires_at ON geocoding_cache(expires_at);
CREATE INDEX idx_geocoding_hit_count ON geocoding_cache(hit_count DESC);
CREATE INDEX idx_geocoding_last_accessed ON geocoding_cache(last_accessed DESC);
```

### Tables Read by This Service
- None (geocoding service is fully self-contained)

## Architecture

The service is Tier 2 in a three-tier caching strategy:

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

## API Endpoints

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "geocoding-cache",
  "port": "3009"
}
```

**Implementation:** `src/index.ts:25`

### GET /search?q={query}
Search for geocoded addresses. Returns cached results if available, otherwise calls Nominatim API and caches the result.

**Parameters:**
- `q` (required): Search query (e.g., "San Francisco")

**Response (Cache Hit):**
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

**Response (Cache Miss - External API):**
```json
{
  "results": [...],
  "source": "nominatim",
  "cached": false
}
```

**Implementation:** `src/index.ts:35`

**Key Features:**
- Normalizes queries (lowercase, trim whitespace)
- Updates hit_count and last_accessed on cache hits
- Respects Nominatim rate limit (1 req/sec)
- Fire-and-forget caching pattern (non-blocking)

### POST /cache
Manually cache a geocoding result (used by frontend for fire-and-forget caching).

**Request:**
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

**Response:**
```json
{
  "success": true,
  "message": "Results cached successfully"
}
```

**Implementation:** `src/index.ts:80`

### GET /stats
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

**Implementation:** `src/index.ts:100`

**Use Cases:**
- Monitor cache hit rates
- Identify popular searches
- Track cache efficiency

### POST /cleanup
Remove expired cache entries (older than 30 days).

**Response:**
```json
{
  "message": "Cleanup completed",
  "deleted_count": 5
}
```

**Implementation:** `src/index.ts:120`

**Scheduled Job:** Can be called by cleanup-service on a schedule

## Key Features

### Shared Cache
One user's API call benefits all users. When user A searches for "Oakland," the result is cached. When user B searches for "Oakland," they get instant results from the cache.

### Hit Tracking
- Tracks `hit_count` for each cached query
- Updates `last_accessed` timestamp on every cache hit
- Provides analytics via `/stats` endpoint

### Auto-Expiration
- 30-day TTL for cached results
- Configurable via `expires_at` column
- Manual cleanup via `/cleanup` endpoint

### Rate Limiting
- Respects Nominatim's 1 req/sec limit
- Uses fire-and-forget pattern to avoid blocking

## Integration with Frontend

The frontend ([apps/frontend/src/lib/geocoding.ts](../../apps/frontend/src/lib/geocoding.ts)) implements the complete three-tier fallback logic:

1. Check IndexedDB (browser-local) - ~5ms
2. Check backend cache (this service) - ~50ms ✅
3. Check localStorage (legacy) - ~10ms
4. Call external API (and cache in all tiers) - ~500ms

All cache layers are updated simultaneously using fire-and-forget patterns to avoid blocking the user experience.

## Performance Benefits

**Without Cache:**
- Every search: ~500ms (external API)
- Rate limited to 1 req/sec per IP
- Network dependent
- Costs API quota

**With Three-Tier Cache:**
- First search (any user): ~500ms (external API, cached for all users)
- Same user, repeat search: ~5ms (IndexedDB)
- Other users: ~50ms (PostgreSQL backend)
- **95%+ reduction in external API calls**

## Dependencies

### External Services
- **Nominatim API**: OSM geocoding service
  - URL: `https://nominatim.openstreetmap.org/search`
  - Rate Limit: 1 req/sec
  - No API key required (public service)

### Database
- PostgreSQL 15+ (for geocoding_cache table)

### No Dependencies on Other Karmyq Services
- Fully independent microservice
- No authentication required (public cache)
- No multi-tenancy (global cache for all communities)

## Events Published

None. This service is purely request/response with no event-driven communication.

## Events Consumed

None.

## Common Tasks

### Check Cache Status
```bash
curl http://localhost:3009/stats
```

### Search for Address
```bash
curl "http://localhost:3009/search?q=Oakland"
```

### Manually Cache Result
```bash
curl -X POST http://localhost:3009/cache \
  -H "Content-Type: application/json" \
  -d '{
    "query": "oakland",
    "results": [{
      "display_name": "Oakland, CA",
      "lat": 37.8044,
      "lng": -122.2712,
      "type": "city"
    }]
  }'
```

### Clean Up Expired Entries
```bash
curl -X POST http://localhost:3009/cleanup
```

### View Service Logs
```bash
docker logs karmyq-geocoding-service -f
```

## Environment Variables

```bash
# Server
PORT=3009
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=karmyq_db
DB_USER=karmyq_user
DB_PASSWORD=your_password_here

# Logging
LOG_LEVEL=info
```

## Testing

### Unit Tests
**Status**: Not yet implemented
**Planned Coverage**:
- Query normalization logic
- Cache hit/miss scenarios
- Rate limiting behavior
- Expiration calculations

### Integration Tests
**Status**: Not yet implemented
**Planned Coverage**:
- Database cache CRUD operations
- External API fallback
- Concurrent request handling

### Manual Testing
```bash
# 1. Test cache miss (external API call)
curl "http://localhost:3009/search?q=NewYorkCity"

# 2. Test cache hit (should be instant)
curl "http://localhost:3009/search?q=NewYorkCity"

# 3. Check stats (should show hit_count = 2 for NewYorkCity)
curl http://localhost:3009/stats
```

## Known Issues & TODOs

### Current Limitations
- No authentication (anyone can query the cache)
- No rate limiting on service endpoints
- Cache invalidation is time-based only (no manual invalidation per query)
- No support for reverse geocoding (lat/lng → address)

### Future Enhancements
- [ ] Add reverse geocoding support
- [ ] Implement per-IP rate limiting
- [ ] Add cache invalidation endpoint
- [ ] Support multiple geocoding providers (Google Maps, Mapbox)
- [ ] Add cache warming for popular locations
- [ ] Implement distributed cache (Redis) for horizontal scaling

## Related Documentation

- **Frontend Integration**: [apps/frontend/src/lib/geocoding.ts](../../apps/frontend/src/lib/geocoding.ts)
- **Frontend Cache**: [apps/frontend/src/lib/geocodingCache.ts](../../apps/frontend/src/lib/geocodingCache.ts)
- **Architecture**: [docs/architecture/ARCHITECTURE.md](../../docs/architecture/ARCHITECTURE.md)

---

**Status**: ✅ Production
**Version**: 8.0.0
**Last Updated**: 2025-12-27
