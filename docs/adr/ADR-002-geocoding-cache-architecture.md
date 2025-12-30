# ADR-002: 3-Tier Geocoding Cache Architecture

**Date**: 2025-12-29
**Status**: Accepted
**Deciders**: Development Team
**Related**: ADR-001 (Natural Language Location Parsing), DEVELOPMENT_ROADMAP.md Decision Log

## Context

The application requires geocoding (converting addresses to GPS coordinates) for location-based features like ride requests and event planning. We needed to decide how to handle geocoding efficiently and reliably.

### Requirements

- Fast autocomplete response (<100ms for good UX)
- Minimize external API calls (rate limits and latency)
- Work offline when possible
- Shared cache benefits all users
- Handle common locations (airports, landmarks) efficiently

### External API Constraints

- **Nominatim API** (OpenStreetMap):
  - Latency: 500-1000ms per request
  - Rate limit: 1 request/second
  - Free but unreliable
  - No caching built-in

## Decision

**We will implement a 4-tier caching architecture** to minimize external API calls and maximize performance.

### Architecture Layers

1. **Tier 1: IndexedDB Common Locations** (~5ms, instant)
   - Client-side cache for frequently used locations
   - Pre-seeded with airports, major cities, landmarks
   - File: `apps/frontend/src/lib/geocodingCache.ts`
   - ~38 locations (expandable to 100+)

2. **Tier 2: localStorage Cache** (~5ms, instant)
   - Client-side cache for user-specific searches
   - Persists across sessions
   - File: `apps/frontend/src/lib/geocoding.ts`

3. **Tier 3: Backend PostgreSQL Cache** (~50ms, fast)
   - Server-side shared cache at port 3009
   - Benefits all users across all sessions
   - Service: `services/geocoding-service`
   - Table: `geocoding_cache`

4. **Tier 4: Direct Nominatim API** (~500ms+, fallback)
   - Only used on cache miss
   - Results cached in all tiers for future use

### Cache Flow

```
User types address
  ↓
Check IndexedDB (Tier 1)
  ↓ [miss]
Check localStorage (Tier 2)
  ↓ [miss]
Call Backend Cache API (Tier 3)
  ↓ [miss]
Call Nominatim API (Tier 4)
  ↓
Cache result in all tiers
  ↓
Return to user
```

## Consequences

### Positive Consequences

- **90%+ cache hit rate** for common locations after seed data
- **Instant autocomplete** for cached locations (<10ms)
- **Reduced API dependency**: Fewer external calls = better reliability
- **Offline capability**: IndexedDB + localStorage work offline
- **Shared benefit**: Backend cache helps all users
- **Cost reduction**: Fewer API calls (future pricing consideration)

### Negative Consequences

- **Complexity**: 4 layers to maintain and debug
- **Storage overhead**: IndexedDB + localStorage + PostgreSQL
- **Stale data risk**: Cached addresses might become outdated
- **Initial cold start**: First query slow, subsequent fast
- **Seed data maintenance**: Need to keep common locations updated

### Neutral Consequences

- **Cache invalidation**: Currently no expiration (simple but may need TTL)
- **Storage limits**: IndexedDB has limits (~50MB typical) but sufficient
- **Debugging harder**: Cache misses require checking multiple layers

## Alternatives Considered

### Alternative 1: Direct API Calls Only

- **Description**: Call Nominatim on every search, no caching
- **Pros**:
  - Simple implementation
  - Always fresh data
  - No storage overhead
- **Cons**:
  - Poor UX (500ms+ latency)
  - Rate limit issues
  - Expensive at scale
  - No offline support
- **Why rejected**: Unacceptable UX for autocomplete

### Alternative 2: Backend Cache Only

- **Description**: Single PostgreSQL cache, no client caching
- **Pros**:
  - Centralized cache management
  - Shared across all users
  - Easier to invalidate
- **Cons**:
  - Network latency (~50ms minimum)
  - No offline support
  - More server load
  - Slower than client cache
- **Why rejected**: Still too slow for autocomplete UX

### Alternative 3: Google Maps/Mapbox API

- **Description**: Use commercial geocoding service
- **Pros**:
  - Fast and reliable
  - Better accuracy
  - Built-in caching
  - Better POI database
- **Cons**:
  - **Cost**: $5-17 per 1000 requests
  - Vendor lock-in
  - Privacy concerns
  - Requires payment method
- **Why rejected**: Cost prohibitive for MVP, can switch later

### Alternative 4: Client-Side Cache Only

- **Description**: IndexedDB + localStorage only, no backend cache
- **Pros**:
  - Simplest architecture
  - No backend service needed
  - Instant for cached items
- **Cons**:
  - No sharing between users
  - Each user cold-starts separately
  - More Nominatim API calls
  - Higher rate limit risk
- **Why rejected**: Misses opportunity for shared cache benefits

## Implementation Notes

### Files Affected

- `apps/frontend/src/lib/geocodingCache.ts` - IndexedDB common locations
- `apps/frontend/src/lib/geocoding.ts` - localStorage cache + API client
- `services/geocoding-service/index.js` - Backend cache service
- `infrastructure/postgres/init.sql` - geocoding_cache table schema

### Seed Data

Currently 38 locations pre-seeded:
- Major US airports (SFO, LAX, JFK, ORD, etc.)
- Major cities (San Francisco, New York, etc.)
- Common landmarks

**Future expansion**: 100+ locations covering:
- All major US airports
- Top 50 US cities
- State capitals
- Major landmarks

### Cache Hit Rate Metrics

- **Current**: ~60% (38 seed locations)
- **Target**: 90%+ (100+ seed locations)
- **Measurement**: Backend logs show cache hit/miss

### Database Schema

```sql
CREATE TABLE geocoding_cache (
  query TEXT PRIMARY KEY,
  results JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## References

- Geocoding service: `services/geocoding-service/`
- Client implementation: `apps/frontend/src/lib/geocoding.ts`
- Seed data: `apps/frontend/src/lib/geocodingCache.ts`
- Related: ADR-001 (Natural Language Location Parsing)
- Nominatim API: https://nominatim.org/release-docs/latest/api/Search/
