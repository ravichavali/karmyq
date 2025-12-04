# TR-002: Multi-Tenancy & Row-Level Security

**Status:** ✅ Implemented | **Priority:** High | **Version:** 5.1.0

## Overview

Multi-tenant SaaS architecture where each community is isolated using PostgreSQL Row-Level Security (RLS).

## Architecture

### Community as Tenant
- Each community = separate tenant
- Users can belong to multiple communities
- Data strictly isolated by `community_id`

### RLS Implementation

#### Session Variable
```sql
SET LOCAL app.current_community_id = 'uuid';
```

#### RLS Policies
```sql
-- Example policy
CREATE POLICY community_isolation ON requests.help_requests
USING (community_id = current_setting('app.current_community_id')::uuid);
```

### Middleware Chain
```typescript
1. authMiddleware         // Validates JWT
2. tenantMiddleware       // Extracts community_id
3. dbContextMiddleware    // Sets RLS variable
4. businessLogic          // Query with RLS enforced
```

### Tenant Context Sources
1. **X-Community-ID header** - Explicit community selection
2. **URL parameter** - `/communities/:communityId/...`
3. **Request body** - `{ community_id: "uuid" }`
4. **JWT token** - First community from `communityMemberships`

## Schema Design

### With Direct community_id
```sql
CREATE TABLE communities.members (
  id UUID,
  community_id UUID,  -- Direct reference
  user_id UUID
);
```

### With Junction Table
```sql
-- Requests use many-to-many
CREATE TABLE requests.request_communities (
  request_id UUID,
  community_id UUID
);
```

## Benefits
✅ Strong data isolation
✅ No application-level filtering
✅ Database enforces security
✅ Performant (indexed)
✅ Audit trail built-in

## Challenges
❌ Complex queries (require joins)
❌ Stats queries need RLS disabled
❌ Testing requires setting session vars
❌ Migration complexity

## Related
- [TR-004: Row-Level Security](TR-004-rls.md)
- [NFR-004: Data Privacy](../non-functional/NFR-004-privacy.md)
