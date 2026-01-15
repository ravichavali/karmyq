# FR-001: User Authentication

**Status:** ✅ Implemented
**Priority:** High
**Version:** 5.1.0
**Last Updated:** 2025-12-04

## Overview

The Authentication system provides secure user registration, login, and session management. It uses JWT tokens for stateless authentication across all microservices.

## User Roles

- **Unauthenticated User** - Can register or login
- **Authenticated User** - Can access all platform features
- **System** - Can validate tokens and manage sessions

## Functional Requirements

### FR-001.1: User Registration

**Description:** New users can create an account with email and password.

**User Story:**
> As a new user, I want to register an account so that I can join communities and participate in mutual aid.

**Acceptance Criteria:**
- [x] User provides name, email, and password
- [x] Email must be unique
- [x] Password must meet minimum requirements (8+ characters)
- [x] Password is hashed using bcrypt
- [x] User account created in auth.users table
- [x] Returns JWT token upon successful registration
- [x] Token contains userId and empty communityMemberships array

**Implementation:**
- Service: `auth-service`
- Endpoint: `POST /auth/register`
- Database: `auth.users` table
- Password Hashing: bcrypt with 10 salt rounds

**Validation:**
```typescript
{
  name: string (required, min 2 chars),
  email: string (required, valid email format),
  password: string (required, min 8 chars)
}
```

---

### FR-001.2: User Login

**Description:** Registered users can authenticate with email and password.

**User Story:**
> As a registered user, I want to log in so that I can access my communities and activity.

**Acceptance Criteria:**
- [x] User provides email and password
- [x] System validates credentials
- [x] Returns JWT token on success
- [x] Token contains userId and communityMemberships array
- [x] Returns 401 for invalid credentials
- [x] Password comparison uses bcrypt

**Implementation:**
- Endpoint: `POST /auth/login`
- Token Expiry: Configurable (default: 7 days)
- Refresh: Not implemented (user re-authenticates)

**Security:**
- Passwords never stored in plain text
- Passwords never returned in responses
- Failed login attempts logged

---

### FR-001.3: JWT Token Management

**Description:** JWT tokens provide stateless authentication across services.

**User Story:**
> As a system, I want to validate user tokens so that I can authorize requests without database lookups.

**Acceptance Criteria:**
- [x] Tokens signed with secret key (from env)
- [x] Tokens contain userId claim
- [x] Tokens contain communityMemberships array
- [x] Tokens have expiration time
- [x] All services can validate tokens independently
- [x] Invalid/expired tokens return 401

**Token Structure:**
```typescript
{
  userId: string,           // User's UUID
  communityMemberships: [   // Array of community memberships
    {
      communityId: string,
      role: 'admin' | 'moderator' | 'member'
    }
  ],
  iat: number,              // Issued at
  exp: number               // Expiration
}
```

**Implementation:**
- Library: jsonwebtoken
- Algorithm: HS256
- Secret: `JWT_SECRET` environment variable
- Shared middleware: `packages/shared/middleware/auth.ts`

---

### FR-001.4: User Profile

**Description:** Users can view and update their profile information.

**User Story:**
> As a user, I want to update my profile so that other community members can know me better.

**Acceptance Criteria:**
- [x] User can view their own profile
- [x] User can update name
- [x] User can update email (must be unique)
- [x] User cannot update password via profile (separate endpoint)
- [x] User can view their community memberships
- [x] User can view their karma across communities

**Implementation:**
- Endpoints:
  - `GET /auth/profile` - Get current user profile
  - `PATCH /auth/profile` - Update profile
- Returns: User data + community memberships + karma stats

---

### FR-001.5: Authentication Middleware

**Description:** Shared middleware validates tokens on all protected routes.

**User Story:**
> As a service, I want to validate user authentication so that I can protect my endpoints.

**Acceptance Criteria:**
- [x] Middleware extracts Bearer token from header
- [x] Validates token signature and expiration
- [x] Attaches user data to request object
- [x] Returns 401 for missing/invalid tokens
- [x] Returns 403 for expired tokens
- [x] Works across all microservices

**Implementation:**
- Location: `packages/shared/middleware/auth.ts`
- Export: `authMiddleware`
- Usage: Applied to all routes except /auth/register and /auth/login

**Middleware Chain:**
```typescript
app.use('/api',
  authMiddleware,              // Validates JWT
  tenantMiddleware,            // Sets community context
  dbContextMiddleware,         // Sets RLS variables
  routes
);
```

---

## Data Model

### Users Table
```sql
CREATE TABLE auth.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Sessions Table (Not Implemented)
Currently using stateless JWT. Future enhancement may add:
```sql
CREATE TABLE auth.sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  token_hash VARCHAR(255),
  expires_at TIMESTAMP,
  created_at TIMESTAMP
);
```

## Security

### Password Security
- ✅ Bcrypt hashing with 10 salt rounds
- ✅ Passwords never logged
- ✅ Passwords never returned in API responses
- ✅ Minimum 8 character requirement

### Token Security
- ✅ Signed with strong secret (256-bit recommended)
- ✅ Expiration enforced
- ✅ HTTPS required in production
- ✅ Tokens validated on every request

### Rate Limiting
- ✅ Global rate limiter (100 req/15min per IP)
- ✅ Auth routes limited (5 req/15min per IP)
- ✅ Prevents brute force attacks

### CORS
- ✅ Configured for frontend origin only
- ✅ Credentials allowed
- ✅ Preflight handled

## API Documentation

### POST /auth/register
```typescript
// Request
{
  name: string,
  email: string,
  password: string
}

// Response 201
{
  success: true,
  data: {
    token: string,
    user: {
      id: string,
      name: string,
      email: string
    }
  }
}

// Error 400
{
  success: false,
  message: "Email already exists"
}
```

### POST /auth/login
```typescript
// Request
{
  email: string,
  password: string
}

// Response 200
{
  success: true,
  data: {
    token: string,
    user: {
      id: string,
      name: string,
      email: string,
      communityMemberships: [...]
    }
  }
}

// Error 401
{
  success: false,
  message: "Invalid credentials"
}
```

### GET /auth/profile
```typescript
// Headers
Authorization: Bearer <token>

// Response 200
{
  success: true,
  data: {
    id: string,
    name: string,
    email: string,
    communities: [...],
    karma: {...}
  }
}
```

## Testing

### Unit Tests
- [x] Password hashing
- [x] Token generation
- [x] Token validation
- [x] Email validation

### Integration Tests
- [x] User registration flow
- [x] User login flow
- [x] Invalid credentials handling
- [x] Token expiration
- [x] Duplicate email prevention

### Security Tests
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Rate limit enforcement

## Performance

### Optimization
- Stateless JWT (no database lookup per request)
- bcrypt cost factor tuned for ~100ms hash time
- Token validation is synchronous (fast)

### Scalability
- Horizontal scaling (stateless)
- No session storage required
- Database queries only on login/register

## Known Issues

None currently.

## Future Enhancements

- [ ] Refresh tokens for long-lived sessions
- [ ] Multi-factor authentication (MFA)
- [ ] OAuth providers (Google, GitHub)
- [ ] Email verification
- [ ] Password reset flow
- [ ] Account deletion
- [ ] Session management (view/revoke active sessions)
- [ ] Audit log for authentication events

## Related Requirements

- [FR-002: Communities](FR-002-communities.md) - Community memberships in token
- [NFR-002: Security](../non-functional/NFR-002-security.md) - Security requirements
- [TR-001: Microservices](../technical/TR-001-microservices.md) - Service architecture
