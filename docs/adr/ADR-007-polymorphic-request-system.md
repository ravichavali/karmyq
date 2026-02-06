# ADR-007: Polymorphic Request System ("Everything App")

**Date**: 2025-12-29
**Status**: ✅ Implemented (v9.0.0 - 2026-02-05)
**Deciders**: Development Team
**Related**: docs/guides/POLYMORPHIC_REQUESTS_GUIDE.md, V7_UI_ARCHITECTURE.md, services/request-service/CONTEXT.md

## Context

Users need to request different types of help: rides, services, events, borrowing items, and general assistance. We needed to decide how to model these different request types in the database and API.

### Requirements

- Support 5+ distinct request types with different fields
- Add new request types without schema migrations
- Type-specific validation and matching algorithms
- Consistent API across all types
- Flexible enough for future expansion

### Request Types Needed

1. **Ride** - Origin, destination, seats, time, preferences
2. **Service** - Skills needed, location, duration, tools
3. **Event** - Location, date/time, capacity, RSVP
4. **Borrow** - Item, duration, return condition
5. **Generic** - Free-form help request

## Decision

**We will use a single `help_requests` table with polymorphic type-specific data stored in a JSONB `payload` field.**

### Schema Design

```sql
CREATE TABLE requests.help_requests (
  id UUID PRIMARY KEY,
  community_id UUID NOT NULL,
  requester_id UUID NOT NULL,
  request_type VARCHAR(50) NOT NULL,  -- 'ride', 'service', 'event', 'borrow', 'generic'
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  urgency VARCHAR(50) DEFAULT 'medium',
  status VARCHAR(50) DEFAULT 'open',
  payload JSONB,                      -- Type-specific fields
  requirements JSONB,                 -- Type-specific constraints
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Type-Specific Payloads

**Ride Request:**
```json
{
  "origin": { "address": "...", "lat": 37.7749, "lng": -122.4194 },
  "destination": { "address": "...", "lat": 37.6213, "lng": -122.3790 },
  "seats_needed": 2,
  "departure_time": "2024-06-15T05:30:00Z",
  "preferences": { "women_only": false, "pet_friendly": true }
}
```

**Service Request:**
```json
{
  "skills_needed": ["plumbing", "handyman"],
  "location": { "address": "...", "lat": ..., "lng": ... },
  "estimated_hours": 3,
  "tools_available": ["wrench", "screwdriver"]
}
```

**Event Request:**
```json
{
  "location": { "address": "...", "lat": ..., "lng": ... },
  "start_time": "2024-06-20T18:00:00Z",
  "end_time": "2024-06-20T21:00:00Z",
  "capacity": 20,
  "rsvp_required": true
}
```

### Validation

Type-specific Zod schemas in `packages/shared/src/schemas/requests/`:
```typescript
// packages/shared/src/schemas/requests/ride.ts
export const RidePayloadSchema = z.object({
  origin: LocationSchema,
  destination: LocationSchema,
  seats_needed: z.number().int().min(1).max(10),
  departure_time: z.string().datetime(),
  preferences: z.object({...}).optional()
});
```

### API Usage

```typescript
POST /requests
{
  "community_id": "uuid",
  "request_type": "ride",
  "title": "Ride to airport Friday morning",
  "description": "Need ride to SFO for 6am flight",
  "urgency": "high",
  "payload": { /* ride-specific fields */ }
}
```

## Consequences

### Positive Consequences

- **Flexibility**: Add new request types without schema changes
- **Consistent API**: All types use same endpoint structure
- **Type Safety**: Zod schemas validate type-specific fields
- **Query Simplicity**: Single table to query for all requests
- **Easy Filtering**: `WHERE request_type = 'ride'` for type-specific queries
- **Shared Logic**: Authentication, community isolation, status tracking unified
- **JSONB Power**: Can query within payload: `payload->>'seats_needed' > 1`

### Negative Consequences

- **Less Type Safety in DB**: JSONB can hold any JSON
- **No Foreign Keys**: Can't reference JSONB fields from other tables
- **Validation Complexity**: Must validate in application layer
- **Query Performance**: JSONB queries slower than indexed columns
- **Migration Harder**: Changing payload structure requires data migration
- **ORM Limitations**: Some ORMs don't handle JSONB well

### Neutral Consequences

- **Documentation Critical**: Need clear payload schemas for each type
- **Client-Side Types**: Frontend needs TypeScript interfaces for each type
- **Testing More Complex**: Must test all request type variations

## Alternatives Considered

### Alternative 1: Separate Tables Per Type

- **Description**: `ride_requests`, `service_requests`, `event_requests`, etc.
- **Pros**:
  - Strict typing in database
  - Foreign keys possible
  - Simpler queries (no JSONB)
  - Better for traditional ORMs
- **Cons**:
  - Schema migration for each new type
  - Hard to query "all requests"
  - Duplicate columns (status, urgency, etc.)
  - More complex API (different endpoints)
  - N+1 queries for mixed feeds
- **Why rejected**: Too rigid, doesn't scale with new types

### Alternative 2: Single Table Inheritance (STI)

- **Description**: One table with ALL possible columns (origin, destination, skills_needed, etc.)
- **Pros**:
  - Single table
  - Direct column access
  - Simpler than JSONB
- **Cons**:
  - Sparse table (90% NULL values)
  - Schema bloat (100+ columns eventually)
  - Migration for every new field
  - Column name conflicts
  - Poor indexing efficiency
- **Why rejected**: Unmaintainable at scale

### Alternative 3: EAV (Entity-Attribute-Value)

- **Description**: Separate `request_attributes` table with key-value pairs
- **Pros**:
  - Ultimate flexibility
  - No schema changes
- **Cons**:
  - Query nightmare (multiple joins)
  - No type safety
  - Terrible performance
  - Hard to validate
  - Debugging hell
- **Why rejected**: EAV is an anti-pattern for good reason

### Alternative 4: MongoDB (NoSQL)

- **Description**: Use MongoDB instead of PostgreSQL for requests
- **Pros**:
  - Native document storage
  - Flexible schemas
  - No JSONB needed
- **Cons**:
  - Adds database dependency
  - No ACID guarantees
  - Harder to join with users/communities
  - Team unfamiliar with Mongo
  - Already using Postgres
- **Why rejected**: PostgreSQL JSONB gives us 80% of benefits without new DB

## Implementation Notes

### Files Affected

- `infrastructure/postgres/init.sql` - Table definition
- `packages/shared/src/schemas/requests/` - Validation schemas
- `services/request-service/src/routes/requests.ts` - API endpoints
- `apps/frontend/src/types/requests.ts` - TypeScript types
- `apps/frontend/src/components/requests/` - Type-specific forms

### Type Registry

Centralized registry of request types:
```typescript
// packages/shared/src/types/requests.ts
export const REQUEST_TYPES = {
  RIDE: 'ride',
  SERVICE: 'service',
  EVENT: 'event',
  BORROW: 'borrow',
  GENERIC: 'generic'
} as const;

export type RequestType = typeof REQUEST_TYPES[keyof typeof REQUEST_TYPES];
```

### Payload Schemas

Each type has its own schema file:
- `packages/shared/src/schemas/requests/ride.ts`
- `packages/shared/src/schemas/requests/service.ts`
- `packages/shared/src/schemas/requests/event.ts`
- `packages/shared/src/schemas/requests/borrow.ts`
- `packages/shared/src/schemas/requests/generic.ts`

### Frontend Type Guards

```typescript
export function isRideRequest(request: HelpRequest): request is RideRequest {
  return request.request_type === 'ride';
}
```

### JSONB Indexing

For performance on common queries:
```sql
CREATE INDEX idx_help_requests_payload_gin ON requests.help_requests USING GIN (payload);
CREATE INDEX idx_help_requests_type_status ON requests.help_requests(request_type, status);
```

### Adding New Types

1. Create schema in `packages/shared/src/schemas/requests/{type}.ts`
2. Add to REQUEST_TYPES constant
3. Create form component in `apps/frontend/src/components/requests/{Type}RequestForm.tsx`
4. Update validation middleware
5. **No database migration needed!**

## Future Considerations

### Type Migration

If we ever need to split out a type:
```sql
-- Create specific table
CREATE TABLE requests.ride_requests AS
SELECT id, community_id, requester_id,
       payload->>'origin' as origin,
       ...
FROM requests.help_requests
WHERE request_type = 'ride';

-- Update references
-- Drop old data
DELETE FROM requests.help_requests WHERE request_type = 'ride';
```

### Computed Columns

PostgreSQL generated columns for common queries:
```sql
ALTER TABLE requests.help_requests
ADD COLUMN origin_lat DOUBLE PRECISION
  GENERATED ALWAYS AS ((payload->'origin'->>'lat')::double precision) STORED;
```

## Implementation Summary (v9.0.0 - February 2026)

### What Was Built

The polymorphic request system was fully implemented in v9.0.0 with all 5 request types, curated feed, and user preferences. Implementation took 17 days from concept to production.

**Phase 1: Core Polymorphic System (Days 1-5)**
- ✅ Database migration (`009_polymorphic_requests.sql`) - Added `request_type`, `payload`, `requirements` columns
- ✅ Zod discriminated union validation - Full type safety with runtime validation
- ✅ Type-specific schemas - Generic, ride, service, event, borrow
- ✅ Type guards - `isRideRequest()`, `isServiceRequest()`, etc.
- ✅ Multi-community posting - Junction table for cross-community requests

**Phase 2: UX Improvements (Days 6-8)**
- ✅ Smart defaults - Default to generic type (2 clicks to post)
- ✅ Progressive disclosure - Collapsible type selector
- ✅ Curated feed endpoint - `/requests/curated` with match scores
- ✅ Match score algorithm - Type-specific matchers with 0-100% scores
- ✅ User preferences - Request type subscriptions + interest filtering
- ✅ Preference persistence - `auth.user_request_preferences` table

**Phase 3: Testing (Days 9-12)**
- ✅ 69 unit tests - Curated feed algorithm validation
- ✅ 40+ regression tests - Polymorphic lifecycle tests
- ✅ 30+ integration tests - Preferences + curated feed
- ✅ 25+ E2E tests - Complete user flows with Playwright

**Phase 4: Documentation (Days 13-14)**
- ✅ Updated CONTEXT.md to v9.0.0
- ✅ Updated root CLAUDE.md and README.md
- ✅ Updated this ADR with implementation details
- ✅ Comprehensive API documentation with examples

### Results Achieved

**Performance Metrics:**
- **95% noise reduction** in feed (100 requests → 5 highly relevant)
  - Day 7: 85% reduction via skill-based matching
  - Day 8: 67% additional reduction via preferences
- **2 clicks** to create generic request (33% better than 3-click target)
- **Match score transparency** - Users see why requests match (reasons + breakdown)

**Code Quality:**
- **200+ tests** covering all features
- **Zero breaking changes** - Backward compatible with v8.0 generic requests
- **Type-safe** - Zod + TypeScript ensure correctness
- **Extensible** - Adding new types requires no schema changes

### Production Usage (v9.0.0)

**Database Schema:**
```sql
CREATE TYPE request_type_enum AS ENUM ('generic', 'ride', 'service', 'event', 'borrow');

ALTER TABLE requests.help_requests
  ADD COLUMN request_type request_type_enum NOT NULL DEFAULT 'generic',
  ADD COLUMN payload JSONB,
  ADD COLUMN requirements JSONB;

CREATE INDEX idx_help_requests_type_status ON requests.help_requests(request_type, status);
CREATE INDEX idx_help_requests_payload_gin ON requests.help_requests USING GIN (payload);
```

**API Endpoints:**
- `POST /requests` - Create polymorphic request (accepts all 5 types)
- `GET /requests/curated` - Intelligent feed with match scores
- `GET /requests` - All requests (unchanged, backward compatible)

**Frontend:**
- Type selector with progressive disclosure
- Curated feed toggle with match score slider
- Match score badges (70%+ green, 50-69% blue, <50% yellow)
- Match reason tooltips
- Preferences page (`/settings/preferences`)

### Validation Against Original Design

| Design Decision | Implementation Status | Notes |
|-----------------|----------------------|-------|
| Single table with JSONB | ✅ Implemented | `requests.help_requests` with `payload` column |
| 5 request types | ✅ Implemented | Generic, ride, service, event, borrow |
| Zod validation | ✅ Implemented | Discriminated unions with type guards |
| Type-specific matching | ✅ Implemented | Matcher per type in `@karmyq/shared/matching` |
| No schema changes for new types | ✅ Validated | Can add new types via Zod schemas only |
| JSONB indexing | ✅ Implemented | GIN index on payload column |
| Backward compatibility | ✅ Validated | All v8.0 generic requests work unchanged |

### Lessons Learned

**What Worked Well:**
- JSONB flexibility allowed rapid iteration on payload structures
- Zod discriminated unions provided excellent type safety
- Type guards solved TypeScript narrowing challenges
- Progressive disclosure UX dramatically reduced friction
- Match score transparency increased user trust

**Challenges Overcome:**
- TypeScript type narrowing for discriminated unions (solved with type guards)
- Jest import resolution for workspace packages (solved with relative paths)
- Event matcher null safety (solved with proper validation)

**Performance Observations:**
- JSONB queries fast enough for production (< 10ms per request)
- Match score calculation CPU-bound but efficient (~0.1ms per request)
- Curated feed endpoint averages 50ms with 100 open requests

### Future Enhancements

Based on v9.0 implementation:

1. **Location-Based Matching** - Use PostGIS for distance scoring (ride/service requests)
2. **Budget Filtering** - Filter service requests by budget range in curated feed
3. **Recurring Events** - Auto-generate recurring event instances
4. **Image Upload** - Support images for borrow requests
5. **Certification Verification** - Automated credential checks for service requests

## References

- **Implementation**: `services/request-service/CONTEXT.md` - Complete v9.0 documentation
- **Schemas**: `packages/shared/src/schemas/requests/` - Zod validation schemas
- **Matching**: `packages/shared/src/matching/` - Type-specific matchers
- **API**: `services/request-service/src/routes/requests.ts` - REST endpoints
- **Frontend**: `apps/frontend/src/pages/requests/` - UI components
- **Tests**:
  - `services/request-service/tests/unit/curated-feed.test.ts` - 69 unit tests
  - `services/request-service/tests/integration/polymorphic-requests-lifecycle.test.ts` - 40+ integration tests
  - `tests/e2e/tests/12-polymorphic-requests-ux.spec.ts` - 25+ E2E tests
- **PostgreSQL JSONB**: https://www.postgresql.org/docs/current/datatype-json.html
