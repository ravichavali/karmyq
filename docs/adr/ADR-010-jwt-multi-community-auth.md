# ADR-010: JWT-Based Multi-Community Authentication

**Date**: 2025-12-29
**Status**: Accepted
**Deciders**: Development Team
**Related**: docs/MULTI_TENANT_GUIDE.md, ADR-003 (Multi-Tenant RLS)

## Context

Users need to belong to multiple communities with a single account. We needed an authentication system that supports:
- Single sign-on across all communities
- Different roles per community (admin in one, member in another)
- Efficient authorization checks
- Stateless authentication

## Decision

**Single JWT token with `communityMemberships` array containing all communities and roles.**

### JWT Structure

```json
{
  "userId": "uuid",
  "email": "alice@example.com",
  "communityMemberships": [
    {
      "communityId": "portland-uuid",
      "role": "admin",
      "name": "Portland Tools"
    },
    {
      "communityId": "oakland-uuid",
      "role": "member",
      "name": "Oakland Gardeners"
    }
  ],
  "iat": 1703980800,
  "exp": 1704067200
}
```

### Middleware Chain

```typescript
app.use(authenticateToken)          // Verify JWT, extract user
app.use(extractCommunityContext)    // Set req.communityId from header/query
app.use(requireRole('member'))      // Check user has role in community
```

### Authorization Pattern

```typescript
// Extract community from X-Community-ID header or query param
const communityId = req.headers['x-community-id'] || req.query.community_id;

// Verify user is member
const membership = req.user.communityMemberships.find(m => m.communityId === communityId);
if (!membership) {
  return sendForbidden(res, 'Not a member of this community');
}

// Check role
if (membership.role !== 'admin') {
  return sendForbidden(res, 'Admin access required');
}
```

## Consequences

### Positive

- **Single Login**: User logs in once, access all communities
- **Stateless**: No session storage needed (JWT is self-contained)
- **Fast Authorization**: No database lookup per request
- **Role Flexibility**: Different roles in different communities
- **Scalable**: Works with any number of communities

### Negative

- **Token Size**: Large for users in many communities (100+ bytes per community)
- **Role Changes**: Require new token (logout/login)
- **Token Refresh**: Must handle expiration gracefully
- **Security**: Compromised token = access to all communities

## Alternatives Considered

### Alternative 1: Session-Based Auth

- **Why rejected**: Requires database lookup per request, doesn't scale

### Alternative 2: Separate Token Per Community

- **Why rejected**: Users must switch tokens, poor UX

### Alternative 3: OAuth with Scopes

- **Why rejected**: Overcomplicated for our use case

## References

- Auth service: `services/auth-service/src/routes/auth.ts`
- Middleware: `packages/shared/src/middleware/auth.ts`
- Multi-tenant guide: `docs/MULTI_TENANT_GUIDE.md`
