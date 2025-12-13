# API Response Format Standard v6.1.0

## Overview

All Karmyq backend services MUST use standardized response helpers for consistent API contracts.

## Response Helpers

Located in `packages/shared/utils/response.ts`:

- `sendSuccess(res, data, status, meta)` - Successful responses
- `sendError(res, code, message, status, details, meta)` - Generic errors
- `sendValidationError(res, message, meta)` - 400 Bad Request
- `sendUnauthorized(res, message, meta)` - 401 Unauthorized
- `sendForbidden(res, message, meta)` - 403 Forbidden
- `sendNotFound(res, message, meta)` - 404 Not Found
- `sendConflict(res, message, meta)` - 409 Conflict
- `sendInternalError(res, message, error, meta)` - 500 Internal Server Error

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2025-12-06T04:00:00.000Z",
    "requestId": "uuid-v4-string"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  },
  "meta": {
    "timestamp": "2025-12-06T04:00:00.000Z",
    "requestId": "uuid-v4-string"
  }
}
```

## Data Wrapping Convention

### List Endpoints (Collections)
Wrap arrays in an object with metadata:

```typescript
// ❌ WRONG
sendSuccess(res, result.rows, HTTP_STATUS.OK, { requestId: req.id });

// ✅ CORRECT
sendSuccess(res, {
  items: result.rows,      // or: communities, requests, matches, etc.
  count: result.rowCount,
  total: result.rowCount
}, HTTP_STATUS.OK, { requestId: req.id });
```

**Example endpoints**:
- GET /communities → `{ communities: [...], count, total }`
- GET /requests → `{ requests: [...], count, total }`
- GET /matches → `{ matches: [...], count, total }`

### Single Item Endpoints
Return the object directly (not wrapped):

```typescript
// ❌ WRONG
sendSuccess(res, { community: result.rows[0] }, HTTP_STATUS.OK, ...);

// ✅ CORRECT
sendSuccess(res, result.rows[0], HTTP_STATUS.OK, { requestId: req.id });
```

**Example endpoints**:
- GET /communities/:id → `{ id, name, description, ... }`
- GET /requests/:id → `{ id, title, description, ... }`
- POST /communities → `{ id, name, ... }` (newly created object)

## Frontend Access Patterns

The axios interceptor (`apps/frontend/src/lib/api.ts`) automatically unwraps responses:

### Backend Response
```json
{
  "success": true,
  "data": { "communities": [...], "count": 50 },
  "meta": { "timestamp": "...", "requestId": "..." }
}
```

### After Axios Unwrapping
```javascript
response.data = { communities: [...], count: 50 }
response.meta = { timestamp: "...", requestId: "..." }
response.success = true
```

### Frontend Usage

```typescript
// ✅ List endpoints
const response = await communityService.getCommunities();
const communities = response.data.communities;  // NOT response.data.data
const count = response.data.count;

// ✅ Single item endpoints
const response = await communityService.getCommunity(id);
const community = response.data;  // NOT response.data.data
const name = response.data.name;
```

## Migration Checklist

### Backend Routes
- [ ] Import standardized helpers at top of file
- [ ] Replace `res.status(400).json({...})` with `sendValidationError()`
- [ ] Replace `res.status(401).json({...})` with `sendUnauthorized()`
- [ ] Replace `res.status(403).json({...})` with `sendForbidden()`
- [ ] Replace `res.status(404).json({...})` with `sendNotFound()`
- [ ] Replace `res.status(500).json({...})` with `sendInternalError()`
- [ ] Replace `res.json({ success: true, data: ... })` with `sendSuccess()`
- [ ] Add `{ requestId: (req as any).id }` to all meta parameters
- [ ] Wrap list responses in objects: `{ items: [...], count, total }`
- [ ] Return single items directly (not wrapped)

### Frontend Pages
- [ ] Replace `response.data.data` with `response.data` for single items
- [ ] Replace `response.data.data` with `response.data.items` for lists
- [ ] Use specific property names: `response.data.communities`, not generic `.data`

## Status by Service

### ✅ Completed
- auth-service (all routes)
- community-service (communities.ts: ALL CRUD routes)
- request-service:
  - requests.ts: GET / (list)
  - matches.ts: GET / (list)
  - offers.ts: GET / (list), GET /:id (detail)
- All service health endpoints (GET /health)

### 🔄 In Progress
- request-service:
  - requests.ts: POST, PUT, DELETE routes
  - matches.ts: GET /:id, POST, PUT, DELETE routes
  - offers.ts: POST, PUT, DELETE routes
- community-service:
  - members.ts: ALL routes
  - norms.ts: ALL routes
  - settings.ts: ALL routes

### ⏳ Not Started
- reputation-service routes (beyond index.ts)
- notification-service routes (beyond index.ts)
- messaging-service routes (beyond index.ts)
- feed-service routes (beyond index.ts)

### 🧪 E2E Test Status
- **410 total tests** across 9 test files
- **Auth flows**: ✅ Login working, session persistence working
- **Dashboard**: ✅ Most critical flows passing
- **Communities**: ⚠️ Some failures in list/create (under investigation)
- **Requests**: ⚠️ Creation failing (needs investigation)
- See [E2E Test Report](../tests/e2e/README.md) for details

## Testing Requirements

All endpoints MUST have:
1. **Unit tests** - Verify correct response format
2. **Integration tests** - Test actual API responses
3. **E2E tests** - Validate frontend-backend communication

## Common Mistakes to Avoid

### ❌ Don't nest data twice
```typescript
// WRONG
sendSuccess(res, { data: result.rows }, ...)
// Results in: { success: true, data: { data: [...] } }
```

### ❌ Don't forget requestId
```typescript
// WRONG
sendSuccess(res, data, HTTP_STATUS.OK)

// CORRECT
sendSuccess(res, data, HTTP_STATUS.OK, { requestId: (req as any).id })
```

### ❌ Don't use generic property names
```typescript
// WRONG
sendSuccess(res, { data: communities, count }, ...)

// CORRECT
sendSuccess(res, { communities, count, total }, ...)
```

## Pre-Commit Hook

TODO: Add validation script to check for:
- Direct `res.json()` usage in routes
- Missing `requestId` in responses
- Incorrect data wrapping patterns

## References

- Response helpers: `packages/shared/utils/response.ts`
- Axios interceptor: `apps/frontend/src/lib/api.ts`
- Example: `services/community-service/src/routes/communities.ts`
