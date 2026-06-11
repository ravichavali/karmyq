# ADR-006: Standardized API Response Format

**Date**: 2025-12-29
**Status**: Accepted
**Deciders**: Development Team
**Related**: ADR-074 (canonical error response contract)

## Context

With 9 microservices, we needed a consistent API response format so that:
- Frontend knows what to expect from every endpoint
- Error handling is predictable
- Debugging is easier with consistent structure
- Automatic unwrapping can work reliably

### Problem

Early implementations had inconsistent responses:
- Some services returned `{ data: {...} }`, others returned objects directly
- Error formats varied between services
- No standard metadata (timestamps, request IDs)
- Frontend needed service-specific code for each API

## Decision

**We will use standardized response helpers** (`packages/shared/utils/response.ts`) across ALL backend services with a consistent envelope format.

### Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2025-12-29T00:00:00.000Z",
    "requestId": "uuid-v4"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Human-readable message",
  "error": "ERROR_CODE",
  "meta": {
    "timestamp": "2025-12-29T00:00:00.000Z",
    "requestId": "uuid-v4"
  }
}
```

> **Sprint 94 / ADR-074 update:** ADR-006 originally documented an object-shaped
> `error: { code, message }` envelope. ADR-074 supersedes the error portion of this ADR: `message`
> is top-level and `error` is always a string code for shared helpers and middleware. Success
> envelopes remain unchanged.

### Data Wrapping Convention

**List Endpoints:** Wrap arrays in objects with metadata
```typescript
sendSuccess(res, {
  communities: [...],  // or items, requests, matches, etc.
  count: 50,
  total: 50
}, HTTP_STATUS.OK, { requestId: req.id });
```

**Single Item Endpoints:** Return object directly (not wrapped)
```typescript
sendSuccess(res, communityObject, HTTP_STATUS.OK, { requestId: req.id });
```

### Helper Functions

```typescript
// Success
sendSuccess(res, data, status, meta)

// Errors (typed)
sendValidationError(res, message, meta)      // 400
sendUnauthorized(res, message, meta)         // 401
sendForbidden(res, message, meta)            // 403
sendNotFound(res, message, meta)             // 404
sendConflict(res, message, meta)             // 409
sendInternalError(res, message, error, meta) // 500
```

### Frontend Automatic Unwrapping

Axios interceptor in `apps/frontend/src/lib/api.ts` automatically unwraps:
```typescript
// Backend sends:
{ success: true, data: { communities: [...] }, meta: {...} }

// Frontend receives:
response.data = { communities: [...] }
response.meta = {...}
response.success = true
```

## Consequences

### Positive Consequences

- **Consistency**: Every service follows same pattern
- **Type Safety**: Frontend knows exact shape of responses
- **Better DX**: Easy to understand and debug
- **Request Tracing**: Every response has `requestId` for debugging
- **Error Handling**: Centralized error format simplifies frontend logic
- **Automatic Unwrapping**: Frontend code cleaner (no `response.data.data`)

### Negative Consequences

- **Verbosity**: Extra wrapping adds bytes to responses
- **Migration Effort**: Required updating all existing endpoints
- **Learning Curve**: New developers need to learn helpers
- **Rigid Structure**: Hard to deviate for special cases

### Neutral Consequences

- **Meta Always Present**: Even when not strictly needed
- **Standard Library**: Shared package dependency for all services

## Alternatives Considered

### Alternative 1: No Standard (Service-Specific Formats)

- **Description**: Each service returns whatever format it wants
- **Pros**:
  - Maximum flexibility
  - No migration needed
  - Simpler to start
- **Cons**:
  - Frontend needs service-specific code
  - Inconsistent error handling
  - Debugging nightmare
  - No automatic unwrapping
- **Why rejected**: Doesn't scale with multiple services

### Alternative 2: GraphQL

- **Description**: Use GraphQL instead of REST
- **Pros**:
  - Client specifies exact data needed
  - Single endpoint
  - Strong typing
  - Built-in error handling
- **Cons**:
  - Steep learning curve
  - More complex infrastructure
  - Harder to cache
  - Overkill for our use case
- **Why rejected**: Too much complexity for current needs

### Alternative 3: JSend Standard

- **Description**: Use existing JSend specification
- **Pros**:
  - Industry standard
  - Well-documented
  - Simple and clear
- **Cons**:
  - Doesn't match our needs exactly
  - No request ID support
  - Limited error details
- **Why rejected**: Close, but our custom format better fits our needs

### Alternative 4: No Envelope (Direct Data)

- **Description**: Return data directly, use HTTP status codes only
- **Pros**:
  - Simpler responses
  - Less bandwidth
  - More RESTful
- **Cons**:
  - Can't include metadata
  - Error details go in headers (awkward)
  - No request tracing
  - Frontend can't distinguish success/error easily
- **Why rejected**: Need metadata for debugging and tracing

## Implementation Notes

### Files Affected

- `packages/shared/src/utils/response.ts` - Helper functions
- All service routes in `services/*/src/routes/*.ts`
- `apps/frontend/src/lib/api.ts` - Axios interceptor

### Migration Status

**✅ Completed:**
- auth-service (all routes)
- community-service (communities.ts)
- request-service (partial)
- All health check endpoints

**🔄 In Progress:**
- request-service (remaining routes)
- community-service (members, norms, settings)

**⏳ Not Started:**
- reputation-service
- notification-service
- messaging-service
- feed-service

### Example Usage

**Backend (Service Route):**
```typescript
import { sendSuccess, sendNotFound, sendInternalError } from '@karmyq/shared/utils/response';

router.get('/communities/:id', async (req: any, res) => {
  try {
    const community = await getCommunity(req.params.id);

    if (!community) {
      return sendNotFound(res, 'Community not found', { requestId: req.id });
    }

    sendSuccess(res, community, HTTP_STATUS.OK, { requestId: req.id });
  } catch (error) {
    sendInternalError(res, 'Failed to fetch community', error, { requestId: req.id });
  }
});
```

**Frontend (React Component):**
```typescript
const response = await communityService.getCommunity(id);
const community = response.data;  // NOT response.data.data
console.log(community.name);
```

### Testing Requirements

All endpoints must have tests verifying:
1. Success responses have `{ success: true, data, meta }`
2. Error responses have `{ success: false, error, meta }`
3. List endpoints wrap in objects: `{ items, count, total }`
4. Single endpoints return objects directly
5. All responses include `requestId`

## References

- Standard documentation: `docs/API_RESPONSE_STANDARD.md`
- Helper implementation: `packages/shared/src/utils/response.ts`
- Axios interceptor: `apps/frontend/src/lib/api.ts`
- Example service: `services/community-service/src/routes/communities.ts`
