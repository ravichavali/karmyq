# Row-Level Security (RLS) Policies

**Version**: 6.0.0
**Last Updated**: 2025-12-05
**Database**: PostgreSQL 15

---

## Overview

Karmyq uses PostgreSQL **Row-Level Security (RLS)** to enforce multi-tenant data isolation at the database level. This ensures that users can only access data from communities they belong to.

### Key Benefits

✅ **Database-Level Enforcement** - Cannot be bypassed by application code
✅ **Automatic Filtering** - No need for `WHERE community_id = ?` in every query
✅ **Security Guarantee** - Even SQL injection cannot access other communities' data
✅ **Audit Trail** - Policies are version-controlled and reviewable

### How It Works

```typescript
// 1. Middleware sets session variable
await pool.query('SET LOCAL app.current_community_id = $1', [communityId]);
await pool.query('SET LOCAL app.current_user_id = $1', [userId]);

// 2. Application makes query (no WHERE clause needed!)
const requests = await pool.query('SELECT * FROM requests.help_requests');

// 3. PostgreSQL RLS automatically filters
// Equivalent to: SELECT * FROM requests.help_requests WHERE ...RLS policy...
```

---

## Session Variables

RLS policies use two session variables set by middleware:

| Variable | Type | Purpose | Set By |
|----------|------|---------|--------|
| `app.current_community_id` | UUID | Current community context | `dbContextMiddleware` |
| `app.current_user_id` | UUID | Current authenticated user | `dbContextMiddleware` |

### Setting Session Variables

```typescript
// packages/shared/middleware/dbContext.ts
export const dbContextMiddleware = (pool: Pool) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { communityId, userId } = req;

    if (communityId) {
      await pool.query(
        'SET LOCAL app.current_community_id = $1',
        [communityId]
      );
    }

    if (userId) {
      await pool.query(
        'SET LOCAL app.current_user_id = $1',
        [userId]
      );
    }

    next();
  };
};
```

---

## Policy Types

### 1. Direct Community ID

**Pattern**: Table has `community_id` column
**Policy**: `WHERE community_id = current_setting('app.current_community_id')`

**Tables**:
- `communities.norms`
- `requests.help_offers`
- `reputation.karma_records`
- `reputation.trust_scores`
- `feedback.feedback`
- `governance.proposals`
- `governance.conflict_cases`

**Example**:
```sql
CREATE POLICY community_isolation ON communities.norms
  USING (
    community_id = current_setting('app.current_community_id', true)::uuid
  );
```

### 2. Membership-Based

**Pattern**: Check if user is member of community
**Policy**: `WHERE id IN (SELECT community_id FROM members WHERE user_id = ...)`

**Tables**:
- `communities.communities`
- `communities.members`

**Example**:
```sql
CREATE POLICY community_isolation ON communities.communities
  USING (
    id IN (
      SELECT community_id
      FROM communities.members
      WHERE user_id = current_setting('app.current_user_id', true)::uuid
    )
  );
```

**Why**: Users can belong to multiple communities, so we check membership.

### 3. Junction Table

**Pattern**: Many-to-many relationship via junction table
**Policy**: `WHERE EXISTS (SELECT 1 FROM junction WHERE ...)`

**Tables**:
- `requests.help_requests` (via `request_communities`)
- `requests.matches` (via request → `request_communities`)
- `communities.norm_approvals` (via `norms`)
- `governance.votes` (via `proposals`)

**Example**:
```sql
CREATE POLICY community_isolation ON requests.help_requests
  USING (
    EXISTS (
      SELECT 1 FROM requests.request_communities rc
      WHERE rc.request_id = help_requests.id
      AND rc.community_id = current_setting('app.current_community_id', true)::uuid
    )
  );
```

**Why**: Help requests can be posted to multiple communities.

### 4. Deep Nested

**Pattern**: Multiple levels of joins to reach community
**Policy**: `WHERE id IN (SELECT ... FROM ... JOIN ... WHERE ...)`

**Tables**:
- `messaging.conversations` (match → request → `request_communities`)
- `messaging.conversation_participants` (conversation → match → request → `request_communities`)
- `messaging.messages` (conversation → match → request → `request_communities`)

**Example**:
```sql
CREATE POLICY community_isolation ON messaging.conversations
  USING (
    request_match_id IN (
      SELECT m.id FROM requests.matches m
      WHERE m.request_id IN (
        SELECT rc.request_id FROM requests.request_communities rc
        WHERE rc.community_id = current_setting('app.current_community_id', true)::uuid
      )
    )
  );
```

**Why**: Conversations linked to matches, matches linked to requests, requests linked to communities.

### 5. User-Scoped (Not Community)

**Pattern**: Data belongs to user, not community
**Policy**: `WHERE user_id = current_setting('app.current_user_id')`

**Tables**:
- `notifications.notifications`
- `notifications.preferences`
- `feed.preferences`
- `feed.dismissed_items`

**Example**:
```sql
CREATE POLICY community_isolation ON notifications.notifications
  USING (
    user_id = current_setting('app.current_user_id', true)::uuid
  );
```

**Why**: Notifications are user-specific, not community-specific. Users see all their notifications across all communities.

### 6. Global (No RLS)

**Pattern**: Data is global/shared
**Policy**: `USING (true)` or no RLS

**Tables**:
- `auth.users` (users belong to multiple communities)
- `auth.sessions`
- `reputation.badges` (user-specific, but policy is `true`)

**Example**:
```sql
-- auth.users has NO RLS
-- Users are shared across communities

CREATE POLICY community_isolation ON reputation.badges
  USING (true); -- All badges visible
```

**Why**: User data is shared across communities. Badges are user achievements, not community-specific.

---

## Complete Policy List

### Auth Schema (No RLS)

| Table | RLS Enabled | Policy | Reason |
|-------|-------------|--------|--------|
| `auth.users` | ❌ No | N/A | Users shared across communities |
| `auth.sessions` | ❌ No | N/A | Session management, not community-specific |

### Communities Schema

| Table | RLS | Type | Policy |
|-------|-----|------|--------|
| `communities.communities` | ✅ | Membership | User must be member |
| `communities.members` | ✅ | Membership | User must be member of community |
| `communities.norms` | ✅ | Direct | `community_id = ?` |
| `communities.norm_approvals` | ✅ | Junction | Via norms table |
| `communities.join_requests` | ✅ | Direct | `community_id = ?` |
| `communities.settings` | ✅ | Direct | `community_id = ?` |

### Requests Schema

| Table | RLS | Type | Policy |
|-------|-----|------|--------|
| `requests.help_requests` | ✅ | Junction | Via `request_communities` |
| `requests.help_offers` | ✅ | Direct | `community_id = ?` |
| `requests.matches` | ✅ | Junction | Via request → `request_communities` |
| `requests.request_communities` | ✅ | Direct | `community_id = ?` |

### Reputation Schema

| Table | RLS | Type | Policy |
|-------|-----|------|--------|
| `reputation.karma_records` | ✅ | Direct | `community_id = ?` |
| `reputation.trust_scores` | ✅ | Direct | `community_id = ?` |
| `reputation.badges` | ✅ | Global | `USING (true)` |
| `reputation.activity_log` | ✅ | Direct | `community_id = ?` |

### Notifications Schema

| Table | RLS | Type | Policy |
|-------|-----|------|--------|
| `notifications.notifications` | ✅ | User-scoped | `user_id = ?` |
| `notifications.preferences` | ✅ | User-scoped | `user_id = ?` |
| `notifications.global_preferences` | ✅ | User-scoped | `user_id = ?` |

### Messaging Schema

| Table | RLS | Type | Policy |
|-------|-----|------|--------|
| `messaging.conversations` | ✅ | Deep Nested | Via match → request → communities |
| `messaging.conversation_participants` | ✅ | Deep Nested | Via conversation |
| `messaging.messages` | ✅ | Deep Nested | Via conversation |

### Feed Schema

| Table | RLS | Type | Policy |
|-------|-----|------|--------|
| `feed.preferences` | ✅ | User-scoped | `user_id = ?` |
| `feed.dismissed_items` | ✅ | User-scoped | `user_id = ?` |

### Feedback Schema

| Table | RLS | Type | Policy |
|-------|-----|------|--------|
| `feedback.feedback` | ✅ | Direct | `community_id = ?` |

### Governance Schema

| Table | RLS | Type | Policy |
|-------|-----|------|--------|
| `governance.proposals` | ✅ | Direct | `community_id = ?` |
| `governance.votes` | ✅ | Junction | Via proposals |
| `governance.conflict_cases` | ✅ | Direct | `community_id = ?` |

---

## Policy Details

### Communities.communities

```sql
ALTER TABLE communities.communities ENABLE ROW LEVEL SECURITY;

CREATE POLICY community_isolation ON communities.communities
  USING (
    id IN (
      SELECT community_id
      FROM communities.members
      WHERE user_id = current_setting('app.current_user_id', true)::uuid
    )
  );
```

**Explanation**: User can only see communities they are a member of.

**Query Impact**:
```sql
-- Application query
SELECT * FROM communities.communities;

-- PostgreSQL executes (with RLS)
SELECT * FROM communities.communities
WHERE id IN (
  SELECT community_id FROM communities.members
  WHERE user_id = 'current-user-uuid'
);
```

### Requests.help_requests (Complex)

```sql
ALTER TABLE requests.help_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY community_isolation ON requests.help_requests
  USING (
    EXISTS (
      SELECT 1 FROM requests.request_communities rc
      WHERE rc.request_id = help_requests.id
      AND rc.community_id = current_setting('app.current_community_id', true)::uuid
    )
  );
```

**Explanation**: Requests can be posted to multiple communities (many-to-many). Show request if it's posted to current community.

**Why EXISTS vs IN**: `EXISTS` is more efficient for subqueries, stops at first match.

### Messaging.conversations (Deep Nested)

```sql
ALTER TABLE messaging.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY community_isolation ON messaging.conversations
  USING (
    request_match_id IN (
      SELECT m.id FROM requests.matches m
      WHERE m.request_id IN (
        SELECT rc.request_id FROM requests.request_communities rc
        WHERE rc.community_id = current_setting('app.current_community_id', true)::uuid
      )
    )
  );
```

**Explanation**:
1. Conversations belong to matches
2. Matches belong to requests
3. Requests belong to communities (via junction table)

**Chain**: conversation → match → request → request_communities → community

### Notifications.notifications (User-Scoped)

```sql
ALTER TABLE notifications.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY community_isolation ON notifications.notifications
  USING (
    user_id = current_setting('app.current_user_id', true)::uuid
  );
```

**Explanation**: Notifications are user-specific, not community-specific. User sees all their notifications regardless of which community they're currently viewing.

**Why**: Notifications like "You earned karma in Community A" should be visible even when user is viewing Community B.

---

## Disabling RLS (Admin Operations)

Some operations require access across all communities (e.g., admin stats, cleanup jobs).

### Safe Pattern

```typescript
// 1. Verify user is admin FIRST
if (req.role !== 'admin') {
  return res.status(403).json({ error: 'Forbidden' });
}

// 2. Only THEN disable RLS
await query('BEGIN');
await query('SET LOCAL row_security = off');

try {
  // Admin queries here
  const stats = await query('SELECT COUNT(*) FROM requests.help_requests');

  await query('COMMIT');
  res.json({ success: true, data: stats.rows[0] });
} catch (error) {
  await query('ROLLBACK');
  throw error;
}
```

**Services that disable RLS**:
- **Cleanup Service**: Needs to expire data across all communities
- **Feed Service**: Aggregates across communities (read-only)
- **Community Service**: Admin stats for specific community

**Golden Rule**: ⚠️ ALWAYS check authorization BEFORE disabling RLS!

---

## Performance Considerations

### Query Performance Impact

RLS adds overhead to every query:
- **Simple policies** (direct `community_id`): ~5-10ms
- **Junction tables** (EXISTS/IN): ~10-20ms
- **Deep nested** (multiple joins): ~20-50ms

**Mitigation**:
1. **Indexes on community_id**: Already added to all tables
2. **Indexes on junction tables**: `request_communities(request_id, community_id)`
3. **Session variable caching**: PostgreSQL caches `current_setting()` per transaction

### Query Plans

Check if RLS is working efficiently:

```sql
EXPLAIN ANALYZE
SELECT * FROM requests.help_requests
WHERE id = 'some-uuid';
```

Look for:
- ✅ `Index Scan` on `request_communities`
- ✅ `Nested Loop` with efficient joins
- ❌ `Seq Scan` on large tables (add indexes!)

---

## Testing RLS Policies

### Manual Testing

```sql
-- 1. Set session variables
SET LOCAL app.current_community_id = 'community-uuid';
SET LOCAL app.current_user_id = 'user-uuid';

-- 2. Query should only show data from that community
SELECT * FROM requests.help_requests;

-- 3. Change community
SET LOCAL app.current_community_id = 'different-community-uuid';

-- 4. Results should be different
SELECT * FROM requests.help_requests;
```

### Integration Tests

```typescript
// tests/integration/rls.test.ts
describe('RLS Policies', () => {
  it('should isolate requests by community', async () => {
    // Create request in community A
    await createRequest(userA, communityA, 'Request A');

    // Create request in community B
    await createRequest(userB, communityB, 'Request B');

    // Query as user in community A
    const requestsA = await getRequests(userA, communityA);
    expect(requestsA).toHaveLength(1);
    expect(requestsA[0].title).toBe('Request A');

    // Query as user in community B
    const requestsB = await getRequests(userB, communityB);
    expect(requestsB).toHaveLength(1);
    expect(requestsB[0].title).toBe('Request B');
  });
});
```

---

## Troubleshooting

### Issue: "permission denied for table"

**Cause**: RLS enabled but no policy created yet, or policy too restrictive.

**Fix**:
```sql
-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'your_table';

-- Check policies
SELECT * FROM pg_policies
WHERE tablename = 'your_table';
```

### Issue: "unrecognized configuration parameter app.current_community_id"

**Cause**: Session variable not set before query.

**Fix**: Ensure `dbContextMiddleware` runs before queries.

### Issue: Query returns empty even with data

**Cause**: Session variable set incorrectly, or policy too restrictive.

**Debug**:
```sql
-- Check current session variables
SHOW app.current_community_id;
SHOW app.current_user_id;

-- Temporarily disable RLS to see all data
SET LOCAL row_security = off;
SELECT * FROM your_table;
```

### Issue: Poor performance

**Cause**: Missing indexes on `community_id` or junction tables.

**Fix**:
```sql
-- Add index
CREATE INDEX idx_table_community_id ON schema.table(community_id);

-- For junction tables
CREATE INDEX idx_request_communities_both
ON requests.request_communities(request_id, community_id);
```

---

## Future Enhancements

### Policy Versioning

Track policy changes:
```sql
CREATE TABLE admin.rls_policy_history (
  id SERIAL PRIMARY KEY,
  table_name TEXT,
  policy_sql TEXT,
  applied_at TIMESTAMP DEFAULT NOW(),
  applied_by TEXT
);
```

### Dynamic Policies

Allow community admins to customize isolation:
```sql
-- Community-specific privacy settings
CREATE POLICY community_privacy ON requests.help_requests
  USING (
    CASE
      WHEN get_community_setting(community_id, 'privacy_mode') = 'strict'
      THEN ... strict policy ...
      ELSE ... lenient policy ...
    END
  );
```

### Policy Testing Framework

Automated RLS policy testing:
```typescript
// Test all tables have RLS enabled
testRLSEnabled('requests.help_requests');
testRLSEnabled('reputation.karma_records');

// Test isolation
testIsolation('requests.help_requests', communityA, communityB);
```

---

## Related Documentation

- [TR-004: Row-Level Security](../requirements/technical/TR-004-rls.md)
- [TR-002: Multi-Tenancy](../requirements/technical/TR-002-multi-tenancy.md)
- [ARCHITECTURE.md](ARCHITECTURE.md#multi-tenancy)
- [MULTI_TENANT_GUIDE.md](../MULTI_TENANT_GUIDE.md)

---

**Last Updated**: 2025-12-05
**PostgreSQL Version**: 15
**Maintained by**: Karmyq Development Team
