# ADR-003: Multi-Tenant Row-Level Security (RLS) Database Design

**Date**: 2025-12-29
**Status**: Accepted
**Deciders**: Development Team
**Related**: docs/architecture/ARCHITECTURE.md, V6_ARCHITECTURAL_REVIEW.md

## Context

Karmyq is a mutual aid platform where communities help each other. We needed to decide how to isolate data between different communities while maintaining performance and simplicity.

### Requirements

- **Data Isolation**: Users should only see data from communities they're members of
- **Multi-Community Users**: Users can belong to multiple communities
- **Security**: Prevent data leaks between communities
- **Performance**: Queries should be fast despite multi-tenancy
- **Simplicity**: Easy to understand and maintain
- **Scalability**: Support thousands of communities

## Decision

**We will use Row-Level Security (RLS) with `community_id` on every multi-tenant table** instead of separate databases per community or schema-based isolation.

### Implementation

Every multi-tenant table includes:
```sql
community_id UUID NOT NULL REFERENCES communities.communities(id)
```

Row-Level Security policies enforce isolation:
```sql
CREATE POLICY community_isolation ON requests.help_requests
  USING (community_id IN (SELECT community_id FROM user_communities WHERE user_id = current_user_id()));
```

Middleware sets `community_id` context:
```typescript
// extractCommunityContext middleware
req.communityId = extractFromToken(req.user.communityMemberships)
```

### Scope

**Multi-Tenant Tables** (community-scoped):
- `requests.help_requests`
- `requests.help_offers`
- `requests.matches`
- `reputation.karma_records`
- `notifications.notifications`
- `messaging.conversations`
- All community-specific data

**Global Tables** (not community-scoped):
- `auth.users`
- `auth.sessions`
- `communities.communities`
- `communities.members`

## Consequences

### Positive Consequences

- **Simple queries**: Just add `WHERE community_id = $1`
- **Single database**: Easier to manage, backup, replicate
- **Fast joins**: All data in same database, no cross-database overhead
- **PostgreSQL RLS**: Battle-tested security mechanism
- **Flexible permissions**: RLS policies handle complex access patterns
- **Easy migration**: All data centralized
- **Cost effective**: No database sprawl

### Negative Consequences

- **Table bloat**: All communities in same tables (mitigated by partitioning if needed)
- **RLS overhead**: Small performance cost (~5-10ms) for policy checks
- **Schema changes**: Affect all communities simultaneously
- **Single point of failure**: One database down = all communities down
- **Resource contention**: Large communities might affect small ones
- **Complexity in queries**: Must always remember `community_id` filter

### Neutral Consequences

- **Index strategy**: Need indexes on `(community_id, ...)` for performance
- **Backup strategy**: Single backup covers all communities
- **Monitoring**: Single database to monitor

## Alternatives Considered

### Alternative 1: Separate Database Per Community

- **Description**: Each community gets its own PostgreSQL database
- **Pros**:
  - Perfect isolation
  - No RLS overhead
  - Independent scaling
  - Easy to archive/delete community
- **Cons**:
  - Database sprawl (thousands of DBs)
  - Complex connection pooling
  - Cross-community queries impossible
  - Schema migrations nightmare
  - Expensive (connection overhead)
- **Why rejected**: Operational complexity too high

### Alternative 2: Schema-Based Multi-Tenancy

- **Description**: One database, separate schema per community
- **Pros**:
  - Good isolation
  - Single database
  - PostgreSQL native feature
- **Cons**:
  - Search_path complexity
  - Cross-community queries hard
  - Schema migrations still complex
  - Limited to ~1000 schemas realistically
- **Why rejected**: Doesn't scale to thousands of communities

### Alternative 3: No Isolation (Single Tenant)

- **Description**: Single community only, no multi-tenancy
- **Pros**:
  - Simplest possible
  - Best performance
  - No isolation overhead
- **Cons**:
  - Doesn't meet requirements
  - Can't scale business model
  - Major refactor needed later
- **Why rejected**: Business model requires multi-tenancy

### Alternative 4: Application-Level Filtering Only

- **Description**: RLS disabled, rely on middleware to filter
- **Pros**:
  - Simpler than RLS
  - More flexible
  - Easier debugging
- **Cons**:
  - **Security risk**: One middleware bug = data leak
  - No defense in depth
  - Trust application layer completely
- **Why rejected**: Too risky, RLS provides security guarantee

## Implementation Notes

### Files Affected

- `infrastructure/postgres/init.sql` - All table definitions
- `packages/shared/src/middleware/auth.ts` - Authentication middleware
- `packages/shared/src/middleware/community.ts` - Community context extraction
- All service route handlers - Community filtering

### Middleware Chain

```typescript
app.use(authenticateToken)      // Extract user from JWT
app.use(extractCommunityContext) // Set req.communityId
app.use(requireRole('member'))   // Check community membership
```

### JWT Token Structure

```json
{
  "userId": "uuid",
  "communityMemberships": [
    {
      "communityId": "uuid",
      "role": "member|admin|owner"
    }
  ]
}
```

### Database Schema Pattern

```sql
CREATE TABLE requests.help_requests (
  id UUID PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES communities.communities(id),
  requester_id UUID NOT NULL REFERENCES auth.users(id),
  -- other fields --
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_help_requests_community ON requests.help_requests(community_id);
CREATE INDEX idx_help_requests_community_status ON requests.help_requests(community_id, status);
```

### Query Pattern

```sql
-- Always include community_id filter
SELECT * FROM requests.help_requests
WHERE community_id = $1
  AND status = 'open'
ORDER BY created_at DESC;
```

### Request-to-Community Mapping

Some requests can be posted to multiple communities:
```sql
CREATE TABLE requests.request_communities (
  request_id UUID REFERENCES requests.help_requests(id),
  community_id UUID REFERENCES communities.communities(id),
  PRIMARY KEY (request_id, community_id)
);
```

## Future Considerations

### Partitioning

If tables grow very large (millions of rows), consider partitioning by `community_id`:
```sql
CREATE TABLE help_requests (...) PARTITION BY HASH (community_id);
```

### Read Replicas

Large communities could use dedicated read replicas with selective replication.

### Caching Strategy

Community-scoped caching with Redis:
```
redis-key: community:{community_id}:requests:{request_id}
```

## References

- Architecture overview: `docs/architecture/ARCHITECTURE.md`
- V6 review: `docs/V6_ARCHITECTURAL_REVIEW.md`
- PostgreSQL RLS docs: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Multi-tenancy patterns: https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/
