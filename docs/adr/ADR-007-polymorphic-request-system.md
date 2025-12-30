# ADR-007: Polymorphic Request System ("Everything App")

**Date**: 2025-12-29
**Status**: Accepted
**Deciders**: Development Team
**Related**: docs/guides/POLYMORPHIC_REQUESTS_GUIDE.md, V7_UI_ARCHITECTURE.md

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

## References

- Guide: `docs/guides/POLYMORPHIC_REQUESTS_GUIDE.md`
- Schemas: `packages/shared/src/schemas/requests/`
- Implementation: `services/request-service/src/routes/requests.ts`
- Frontend types: `apps/frontend/src/types/requests.ts`
- PostgreSQL JSONB: https://www.postgresql.org/docs/current/datatype-json.html
