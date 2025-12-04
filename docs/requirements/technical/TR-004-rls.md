# TR-004: Row-Level Security (RLS)

**Status:** ✅ Implemented | **Priority:** High | **Version:** 5.1.0

## Overview

PostgreSQL Row-Level Security enforces data isolation at the database level, ensuring users only access data from their communities.

## RLS Policies

### Simple Policy (Direct community_id)
```sql
CREATE POLICY community_isolation
ON communities.members
USING (community_id = current_setting('app.current_community_id')::uuid);
```

### Complex Policy (Via Junction Table)
```sql
CREATE POLICY community_isolation
ON requests.matches
USING (
  request_id IN (
    SELECT rc.request_id
    FROM requests.request_communities rc
    WHERE rc.community_id = current_setting('app.current_community_id')::uuid
  )
);
```

## Session Variable

### Setting
```typescript
await query('SET LOCAL app.current_community_id = $1', [communityId]);
```

### Middleware
```typescript
export const dbContextMiddleware = (pool: Pool) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const communityId = req.communityId;
    if (communityId) {
      await pool.query('SET LOCAL app.current_community_id = $1', [communityId]);
    }
    next();
  };
};
```

## Disabling RLS (Admin Queries)

For admin operations like stats:
```typescript
await query('BEGIN');
await query('SET LOCAL row_security = off');
// Execute admin query
await query('COMMIT');
```

⚠️ **Only after authorization check!**

## Benefits
✅ Database-level security
✅ No application filtering needed
✅ Cannot be bypassed
✅ Automatic enforcement
✅ Audit trail

## Gotchas
❌ Must set session variable before queries
❌ Complex queries harder to debug
❌ Stats/aggregation queries may need RLS disabled
❌ Testing requires proper setup

## Related
- [TR-002: Multi-Tenancy](TR-002-multi-tenancy.md)
- [NFR-002: Security](../non-functional/NFR-002-security.md)
