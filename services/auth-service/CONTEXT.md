# Auth Service Context

> **Quick Start**: `cd services/auth-service && npm run dev`
> **Port**: 3001 | **Health**: http://localhost:3001/health

## Purpose

Handles user authentication, registration, and JWT token management for the KarmyQ platform.

## Database Schema

### Tables Owned by This Service

```sql
-- auth.users
CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    location JSONB,
    bio TEXT,
    skills TEXT[],
    profile_picture_url TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_email ON auth.users(email);
CREATE INDEX idx_users_status ON auth.users(status);

-- Federation columns (v4.0+)
ALTER TABLE auth.users
ADD COLUMN federated_id VARCHAR(255) UNIQUE,
ADD COLUMN allow_federation BOOLEAN DEFAULT true,
ADD COLUMN federation_privacy JSONB;
```

-- auth.user_feed_preferences (ADR-022 Multi-Tier Feed)
CREATE TABLE auth.user_feed_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    feed_show_trust_network BOOLEAN DEFAULT true,
    feed_trust_network_max_degrees INTEGER DEFAULT 3
        CHECK (feed_trust_network_max_degrees BETWEEN 1 AND 6),
    feed_show_platform BOOLEAN DEFAULT false,
    feed_platform_categories JSONB DEFAULT '["digital", "questions"]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tables Read by This Service
- None (auth service is fully self-contained)

## API Endpoints

### POST /register
Register a new user account.

**Request:**
```json
{
  "name": "Alice Smith",
  "email": "alice@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "name": "Alice Smith",
    "email": "alice@example.com",
    "created_at": "2025-01-10T12:00:00Z"
  },
  "token": "jwt-token-here"
}
```

**Implementation:** `src/routes/auth.ts:15`

### POST /login
Authenticate user and receive JWT token.

**Request:**
```json
{
  "email": "alice@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "name": "Alice Smith",
    "email": "alice@example.com"
  },
  "token": "jwt-token-here"
}
```

**Implementation:** `src/routes/auth.ts:45`

### GET /verify
Verify JWT token and return user info.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "name": "Alice Smith",
    "email": "alice@example.com"
  }
}
```

**Implementation:** `src/routes/auth.ts:75`

### GET /users/:id
Get user profile by ID.

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "name": "Alice Smith",
    "email": "alice@example.com",
    "bio": "Community gardener",
    "skills": ["gardening", "cooking"],
    "created_at": "2025-01-10T12:00:00Z"
  }
}
```

**Implementation:** `src/routes/users.ts:10`

### PUT /users/:id
Update user profile.

**Request:**
```json
{
  "name": "Alice Johnson",
  "bio": "Updated bio",
  "skills": ["gardening", "carpentry", "cooking"]
}
```

**Implementation:** `src/routes/users.ts:35`

### GET /preferences/request-types
Get user's request type subscriptions (v9.0).

**Authentication:** Required (JWT token)

**Response:**
```json
{
  "success": true,
  "data": {
    "preferences": [
      { "request_type": "generic", "subscribed": true },
      { "request_type": "ride", "subscribed": true }
    ],
    "isDefault": true
  }
}
```

**Implementation:** `src/routes/preferences.ts:17`

### POST /preferences/request-types
Update a single request type subscription.

**Request:**
```json
{
  "request_type": "ride",
  "subscribed": false
}
```

**Implementation:** `src/routes/preferences.ts:77`

### PUT /preferences/request-types/bulk
Bulk update request type subscriptions.

**Request:**
```json
{
  "preferences": [
    { "request_type": "ride", "subscribed": false },
    { "request_type": "event", "subscribed": true }
  ]
}
```

**Implementation:** `src/routes/preferences.ts:144`

### GET /preferences/interests
Get user's interest categories (service_category, item_category, event_type).

**Implementation:** `src/routes/preferences.ts:206`

### POST /preferences/interests
Add a new interest.

**Request:**
```json
{
  "interest_type": "service_category",
  "interest_value": "plumbing"
}
```

**Implementation:** `src/routes/preferences.ts:256`

### DELETE /preferences/interests/:id
Remove an interest.

**Implementation:** `src/routes/preferences.ts:320`

### GET /preferences/feed (ADR-022)
Get user's feed visibility preferences for multi-tier feed.

**Authentication:** Required (JWT token)

**Response:**
```json
{
  "success": true,
  "data": {
    "feed_show_trust_network": true,
    "feed_trust_network_max_degrees": 3,
    "feed_show_platform": false,
    "feed_platform_categories": ["digital", "questions"],
    "isDefault": true
  }
}
```

**Implementation:** `src/routes/preferences.ts:367`

### PUT /preferences/feed (ADR-022)
Update user's feed visibility preferences.

**Request:**
```json
{
  "feed_show_trust_network": true,
  "feed_trust_network_max_degrees": 4,
  "feed_show_platform": true,
  "feed_platform_categories": ["digital", "questions", "services"]
}
```

**Validation:**
- `feed_trust_network_max_degrees`: 1-6
- `feed_platform_categories`: must be an array

**Implementation:** `src/routes/preferences.ts:421`

### GET /health
Service health check.

**Response:**
```json
{
  "status": "healthy",
  "service": "auth-service"
}
```

## Dependencies

### Calls (Outbound)
- None (auth service does not call other services)

### Called By (Inbound)
- All services (for token verification via middleware)
- Frontend (for login/register)
- Mobile app (for authentication)

### Events Published
- None (auth service does not publish events currently)

### Events Consumed
- None

### External Dependencies
- PostgreSQL (auth schema)
- JWT library (jsonwebtoken)
- bcrypt (password hashing)

## Environment Variables

```bash
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/karmyq_db

# JWT
JWT_SECRET=your-secret-key-here  # MUST be strong in production
JWT_EXPIRATION=7d                # Token validity period

# Logging
LOG_LEVEL=info                   # debug, info, warn, error
```

## Key Files

### Entry Point
- `src/index.ts` - Express app initialization, middleware setup

### Routes
- `src/routes/auth.ts` - Login, register, verify endpoints
- `src/routes/users.ts` - User profile CRUD operations
- `src/routes/preferences.ts` - Request type subscriptions, interests, feed preferences (v9.0 + ADR-022)

### Services
- `src/services/authService.ts` - JWT token generation/verification
- `src/services/passwordService.ts` - Password hashing/comparison

### Middleware
- `src/middleware/auth.ts` - JWT verification middleware (used by other services)

### Database
- `src/database/db.ts` - PostgreSQL connection pool

## Common Development Tasks

### Add a New Authentication Method (e.g., OAuth)

1. **Create OAuth route:**
```typescript
// src/routes/oauth.ts
router.get('/auth/google', (req, res) => {
  // Redirect to Google OAuth
});

router.get('/auth/google/callback', async (req, res) => {
  // Handle OAuth callback
  // Create or find user
  // Generate JWT token
  // Return token to client
});
```

2. **Update user schema if needed:**
```sql
ALTER TABLE auth.users
ADD COLUMN google_id VARCHAR(255) UNIQUE,
ADD COLUMN oauth_provider VARCHAR(50);
```

3. **Register route in index.ts:**
```typescript
import oauthRouter from './routes/oauth';
app.use('/auth', oauthRouter);
```

### Add a New User Field

1. **Create migration:**
```sql
-- infrastructure/postgres/migrations/00X_add_user_field.sql
ALTER TABLE auth.users
ADD COLUMN new_field VARCHAR(255);
```

2. **Update TypeScript types:**
```typescript
// src/types/user.ts
interface User {
  // ... existing fields
  new_field?: string;
}
```

3. **Update user update endpoint:**
```typescript
// src/routes/users.ts
router.put('/users/:id', async (req, res) => {
  const { new_field } = req.body;
  // Add to UPDATE query
});
```

### Change JWT Expiration

Edit `.env`:
```bash
JWT_EXPIRATION=30d  # For longer sessions
JWT_EXPIRATION=1h   # For shorter sessions
```

No code changes needed - reads from environment.

### Add Password Reset Flow

1. **Create password reset token table:**
```sql
CREATE TABLE auth.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

2. **Add reset endpoints:**
```typescript
// POST /auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  // Generate token
  // Send email with reset link
  // Store token in database
});

// POST /auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  // Verify token
  // Hash new password
  // Update user password
  // Mark token as used
});
```

3. **Integrate email service:**
```typescript
import { sendEmail } from '../services/emailService';
await sendEmail({
  to: email,
  subject: 'Password Reset',
  body: `Reset your password: ${resetLink}`
});
```

## Security Considerations

### Password Hashing
- Uses bcrypt with salt rounds = 10
- Never store plaintext passwords
- Verify password strength on registration (min 8 chars recommended)

```typescript
// src/services/passwordService.ts
import bcrypt from 'bcrypt';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### JWT Tokens
- Signed with HS256 algorithm
- Include user ID and email in payload
- Set reasonable expiration (default: 7 days)
- Store secret in environment variable, NEVER in code

```typescript
// src/services/authService.ts
import jwt from 'jsonwebtoken';

export function generateToken(user: User): string {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRATION }
  );
}

export function verifyToken(token: string): any {
  return jwt.verify(token, process.env.JWT_SECRET!);
}
```

### Input Validation
- Validate email format
- Enforce password complexity
- Sanitize all user inputs
- Rate limit login attempts (TODO: implement)

## Debugging Common Issues

### "Invalid token" errors
1. Check JWT_SECRET matches between services
2. Verify token hasn't expired
3. Check Authorization header format: `Bearer <token>`

### "User not found" on login
1. Check email is correct (case-sensitive)
2. Verify user exists in database: `SELECT * FROM auth.users WHERE email = '...'`
3. Check user status is 'active'

### Password hash mismatch
1. Ensure password is being hashed before storage
2. Check bcrypt salt rounds match
3. Verify no extra whitespace in password input

### Database connection errors
1. Check DATABASE_URL is correct
2. Verify PostgreSQL is running: `docker ps | grep postgres`
3. Test connection: `psql $DATABASE_URL`

## Testing

### Manual Testing with curl

**Register:**
```bash
curl -X POST http://localhost:3001/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com", "password": "password123"}'
```

**Login:**
```bash
curl -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

**Verify Token:**
```bash
TOKEN="<jwt-token-from-login>"
curl http://localhost:3001/verify \
  -H "Authorization: Bearer $TOKEN"
```

### Unit Tests

Run tests:
```bash
npm test
```

Test structure:
```
src/
├── __tests__/
│   ├── auth.test.ts          # Auth endpoint tests
│   ├── users.test.ts         # User endpoint tests
│   └── services/
│       ├── authService.test.ts
│       └── passwordService.test.ts
```

## Performance Considerations

- Password hashing is CPU-intensive (bcrypt blocks event loop)
- Consider using bcrypt in worker threads for high-load scenarios
- Cache user lookups if needed (currently no caching implemented)
- Database queries use connection pooling (max 20 connections)

## Recent Changes

### Sprint 38: User Tags API (2026-03-24)
- **NEW**: `GET /auth/profile/tags` — returns user's tags grouped by type (`skills`, `interests`, `needs`)
- **NEW**: `POST /auth/profile/tags` — adds a tag (`tag_type` + `tag_value`). ON CONFLICT DO NOTHING (idempotent)
- **NEW**: `DELETE /auth/profile/tags/:tagId` — removes a specific tag (scoped to current user)
- **NEW**: `GET /auth/profile/tags/suggestions?tag_type=skill|interest|need` — returns hardcoded suggestions
- **Schema**: New `auth.user_tags` table (see migration `20260324-user-tags.sql`)
- **File**: `src/routes/profileTags.ts`, `src/constants/tagSuggestions.ts`
- **Note**: `auth.user_skills` table is unchanged; `auth.user_tags` is additive

---

## Future Enhancements (TODO)

- [ ] Rate limiting on login attempts
- [ ] Two-factor authentication (2FA)
- [ ] OAuth providers (Google, GitHub)
- [ ] Email verification flow
- [ ] Password reset via email
- [ ] Session management (revoke tokens)
- [ ] Account lockout after failed attempts
- [ ] Federated identity support (for cross-instance auth)

## Related Documentation

- Main architecture: `/docs/ARCHITECTURE.md`
- Database schema: `/infrastructure/postgres/init.sql` (lines 1-50)
- Federation auth: `/docs/FEDERATION_PROTOCOL.md` (section: User Identity)
