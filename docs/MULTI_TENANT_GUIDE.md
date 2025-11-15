# KarmyQ Multi-Tenant Architecture Guide

## Overview

KarmyQ uses a **multi-tenant SaaS architecture** where users can join multiple communities with a single account. Each community is isolated, has its own data, and can be exported at any time.

### Key Principles

1. **Low-Friction Onboarding** - Sign up once, join communities instantly
2. **Community Data Sovereignty** - Communities own and control their data
3. **Database-Enforced Isolation** - Row-Level Security (RLS) prevents cross-tenant leaks
4. **Multi-Community Users** - Different reputations in each community
5. **Ephemeral by Design** - Data fades like memory (configurable)

## Architecture

```
┌──────────────────────────────────────────────────────┐
│              karmyq.org (Hosted Platform)            │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │ Portland    │  │ Oakland     │  │  Austin    │  │
│  │ Tools       │  │ Gardeners   │  │  Parents   │  │
│  │             │  │             │  │            │  │
│  │ 47 members  │  │ 89 members  │  │ 12 members │  │
│  └─────────────┘  └─────────────┘  └────────────┘  │
│                                                      │
│  Alice is a member of Portland (admin) + Oakland    │
│  Different karma scores in each community           │
└──────────────────────────────────────────────────────┘
```

## How It Works

### 1. Multi-Community JWT

When a user logs in, their JWT includes all communities they belong to:

```json
{
  "userId": "alice-uuid",
  "email": "alice@example.com",
  "communities": [
    {
      "id": "portland-uuid",
      "role": "admin",
      "name": "Portland Tools"
    },
    {
      "id": "oakland-uuid",
      "role": "member",
      "name": "Oakland Gardeners"
    }
  ],
  "currentCommunityId": "portland-uuid"
}
```

**Benefits:**
- Frontend knows all user's communities
- Can display community switcher
- No need to query server for community list

### 2. Request Flow with Community Context

**Frontend sends:**
```http
GET /requests
Headers:
  Authorization: Bearer <jwt>
  X-Community-ID: portland-uuid
```

**Middleware chain:**
```
1. authMiddleware       → Verify JWT, extract user
2. tenantMiddleware     → Validate user belongs to Portland
3. dbContextMiddleware  → Set PostgreSQL session variables
4. Route handler        → Execute business logic
```

**Database sees:**
```sql
-- Session variables set by middleware
app.current_user_id = 'alice-uuid'
app.current_community_id = 'portland-uuid'

-- All queries automatically filtered by RLS
SELECT * FROM requests.help_requests;
-- Returns only Portland requests!
```

### 3. Row-Level Security (RLS)

PostgreSQL enforces tenant isolation at the database level:

```sql
-- Enable RLS on table
ALTER TABLE requests.help_requests ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY community_isolation ON requests.help_requests
  USING (
    community_id = current_setting('app.current_community_id')::uuid
  );
```

**What this means:**
- ✅ Alice can ONLY see Portland requests when community_id=portland
- ✅ Cannot bypass in application code
- ✅ Works even if developer forgets to filter
- ✅ Applies to SELECT, INSERT, UPDATE, DELETE

## User Flows

### Flow 1: New User Signs Up

```
1. POST /auth/register
   { "email": "alice@example.com", "name": "Alice", "password": "..." }

2. Response:
   {
     "user": {
       "id": "alice-uuid",
       "email": "alice@example.com",
       "communities": []  // Empty! New user
     },
     "token": "jwt-with-empty-communities"
   }

3. Alice has account but no communities yet
```

### Flow 2: Alice Creates a Community

```
1. POST /communities
   Headers:
     Authorization: Bearer <jwt>
   Body:
     { "name": "Portland Tools", "description": "...", "foundingMembers": [...] }

2. Community created
3. Alice becomes admin automatically

4. Alice must refresh JWT to see new community:
   POST /auth/refresh
   Headers:
     Authorization: Bearer <old-jwt>

5. Response:
   {
     "token": "new-jwt-with-portland",
     "communities": [
       { "id": "portland-uuid", "role": "admin", "name": "Portland Tools" }
     ]
   }

6. Frontend stores new JWT
7. Alice can now access Portland data
```

### Flow 3: Alice Joins Oakland Community

```
1. POST /communities/oakland-uuid/join
   Headers:
     Authorization: Bearer <jwt>
     X-Community-ID: oakland-uuid  // Joining this one

2. Join request created (requires approval)

3. Oakland admin approves

4. Alice refreshes JWT:
   POST /auth/refresh

5. Response:
   {
     "token": "new-jwt-with-portland-and-oakland",
     "communities": [
       { "id": "portland-uuid", "role": "admin", "name": "Portland Tools" },
       { "id": "oakland-uuid", "role": "member", "name": "Oakland Gardeners" }
     ]
   }

6. Alice can now switch between communities
```

### Flow 4: Alice Switches Communities

```
Frontend:
1. User clicks "Switch to Oakland Gardeners"
2. Frontend sends subsequent requests with:
   Headers:
     X-Community-ID: oakland-uuid

Backend:
1. Middleware validates Alice belongs to Oakland
2. Sets session variable to oakland-uuid
3. All queries return only Oakland data

Alice now sees:
- Oakland requests (not Portland)
- Oakland karma score (different from Portland)
- Oakland messages
- Oakland notifications
```

## Database Schema

### Tables with RLS (Community-Scoped)

✅ **Isolated by community:**
- `communities.communities`
- `communities.members`
- `communities.norms`
- `requests.help_requests`
- `requests.help_offers`
- `requests.matches`
- `reputation.karma_records`
- `reputation.trust_scores` (per-community!)
- `reputation.badges`
- `messaging.conversations`
- `messaging.messages`
- `feedback.feedback`
- `governance.proposals`
- `governance.votes`
- `feed.preferences`

❌ **NOT isolated (user-scoped):**
- `auth.users` - Shared across communities
- `auth.sessions` - User's login session
- `notifications.notifications` - Can filter by community or show all

## Developer Guide

### Adding Multi-Tenant Support to a New Service

1. **Import middleware:**
```typescript
import {
  authMiddleware,
  tenantMiddleware,
  dbContextMiddleware,
} from '../../packages/shared/middleware';
import pool from './database/db';
```

2. **Add to routes:**
```typescript
app.use(
  '/myresource',
  authMiddleware,           // Verify JWT
  tenantMiddleware,         // Validate community access
  dbContextMiddleware(pool),// Set RLS variables
  myRouter
);
```

3. **Access context in routes:**
```typescript
router.get('/', async (req: TenantRequest, res) => {
  const { userId } = req.user!;
  const { communityId, communityRole } = req;

  // Query automatically filtered by RLS!
  const result = await query(`
    SELECT * FROM myschema.myresources
    WHERE status = 'active'
  `);
  // Only returns resources from current community

  res.json({ data: result.rows });
});
```

4. **Enable RLS on your tables:**
```sql
ALTER TABLE myschema.myresources ENABLE ROW LEVEL SECURITY;

CREATE POLICY community_isolation ON myschema.myresources
  USING (
    community_id = current_setting('app.current_community_id')::uuid
  );
```

### Optional vs Required Tenant Context

**Required (tenantMiddleware):**
- Use for resources that MUST belong to a community
- Examples: requests, offers, matches, messages

**Optional (optionalTenantMiddleware):**
- Use for resources that can span communities
- Examples: notifications, feed, community list

```typescript
// Required - Must have X-Community-ID
app.use('/requests', authMiddleware, tenantMiddleware, ...);

// Optional - X-Community-ID is nice but not required
app.use('/notifications', authMiddleware, optionalTenantMiddleware, ...);
```

## Testing Multi-Tenancy

### Test 1: User Can Only See Their Community Data

```typescript
// Alice is in Portland
const response = await fetch('/requests', {
  headers: {
    'Authorization': 'Bearer alice-jwt',
    'X-Community-ID': 'portland-uuid'
  }
});

const requests = await response.json();
// All requests should have community_id = 'portland-uuid'
requests.every(r => r.community_id === 'portland-uuid'); // true
```

### Test 2: User Cannot Access Another Community

```typescript
// Alice tries to access Oakland without permission
const response = await fetch('/requests', {
  headers: {
    'Authorization': 'Bearer alice-jwt',
    'X-Community-ID': 'oakland-uuid'  // Alice not a member!
  }
});

expect(response.status).toBe(403); // Forbidden
```

### Test 3: RLS Prevents Data Leaks

```typescript
// Even if developer forgets to filter, RLS protects
const result = await pool.query(`
  SELECT * FROM requests.help_requests
  -- No WHERE clause!
`);

// Still only returns current community's requests
// RLS policy enforces this automatically
```

## Common Patterns

### Pattern 1: Multi-Community Resource Aggregation

```typescript
// Get user's requests across ALL their communities
router.get('/my/requests', async (req: AuthenticatedRequest, res) => {
  const { communities } = req.user!;
  const communityIds = communities.map(c => c.id);

  // Bypass RLS for multi-community query
  const result = await query(`
    SELECT r.*, c.name as community_name
    FROM requests.help_requests r
    JOIN communities.communities c ON r.community_id = c.id
    WHERE r.requester_id = $1
      AND r.community_id = ANY($2)
    ORDER BY r.created_at DESC
  `, [req.user.userId, communityIds]);

  res.json({ data: result.rows });
});
```

### Pattern 2: Admin-Only Actions

```typescript
import { adminOnlyMiddleware } from '../../packages/shared/middleware';

router.delete(
  '/communities/:id',
  authMiddleware,
  tenantMiddleware,
  adminOnlyMiddleware,  // Requires role='admin'
  async (req, res) => {
    // Only community admins can delete
  }
);
```

### Pattern 3: Cross-Community Notifications

```typescript
// Notify user in ALL their communities
async function notifyUser(userId: string, message: string) {
  const user = await getUserCommunities(userId);

  for (const community of user.communities) {
    await query(`
      INSERT INTO notifications.notifications
      (user_id, community_id, type, message)
      VALUES ($1, $2, 'system', $3)
    `, [userId, community.id, message]);
  }
}
```

## Troubleshooting

### Issue: "Access denied to this community"

**Cause:** User's JWT doesn't include that community

**Solution:**
1. Check user is actually a member: `SELECT * FROM communities.members WHERE user_id = ? AND community_id = ?`
2. If yes, user needs to refresh JWT: `POST /auth/refresh`

### Issue: Queries return empty even though data exists

**Cause:** Session variables not set correctly

**Solution:**
1. Ensure `dbContextMiddleware(pool)` is in middleware chain
2. Check `X-Community-ID` header is being sent
3. Verify RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'your_table';`

### Issue: User sees data from wrong community

**Cause:** Frontend sending wrong `X-Community-ID`

**Solution:**
1. Frontend should track current community in state
2. Include in ALL requests
3. Community switcher must update this value

## Security Considerations

### ✅ Do This

- Always use middleware chain for protected routes
- Trust RLS policies, not application code
- Validate `X-Community-ID` against user's communities
- Log community context in all requests
- Test cross-community isolation

### ❌ Don't Do This

- Don't manually filter by `community_id` in queries (RLS does it)
- Don't bypass middleware "just this once"
- Don't trust community ID from request body (use header)
- Don't disable RLS in production
- Don't store community ID in session

## Performance

### RLS Performance

RLS policies add ~0.1-0.5ms per query. Not significant for most use cases.

**Optimize by:**
- Index on `community_id` column (already done)
- Use connection pooling (already done)
- Cache user's communities in JWT (already done)

### JWT Refresh Strategy

**When to refresh:**
- After joining a new community
- After leaving a community
- After role change (member → admin)
- Periodically (e.g., every 24 hours)

**Don't refresh:**
- On every request (JWT is valid for 7 days)
- More than once per action

## Future Enhancements

### Planned Features

1. **Data Export** - Community admins can export all community data
2. **Trust Bridges** - Communities can form explicit alliances
3. **Reputation Portability** - Cryptographically signed karma export
4. **Cross-Community Discovery** - Opt-in help request sharing

### NOT Planned (By Design)

- Automatic federation (too complex for mutual aid)
- Global timeline (violates community sovereignty)
- Cross-community karma (reputation is local)
- Instance-to-instance messaging (use trust bridges instead)

## References

- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Dunbar's Number](https://en.wikipedia.org/wiki/Dunbar%27s_number)

---

**Questions?** See [docs/README.md](README.md) or open an issue.
