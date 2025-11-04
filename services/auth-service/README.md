# Auth Service

User authentication and session management for Karmyq.

## Features

- User registration with email/password
- Secure password hashing (bcrypt)
- JWT token authentication
- Session management
- User profile management
- Event publishing (user_created)

## API Endpoints

### POST /auth/register
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "securepassword123"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2025-11-04T00:00:00.000Z"
  },
  "token": "jwt-token-here"
}
```

### POST /auth/login
Authenticate a user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "jwt-token-here"
}
```

### POST /auth/logout
Logout a user (invalidate session).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

### GET /auth/verify
Verify a JWT token.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200):**
```json
{
  "valid": true,
  "userId": "uuid",
  "email": "user@example.com"
}
```

### GET /users/:userId
Get user profile.

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "bio": "Optional bio",
  "avatar_url": "https://...",
  "created_at": "2025-11-04T00:00:00.000Z",
  "updated_at": "2025-11-04T00:00:00.000Z"
}
```

### PUT /users/:userId
Update user profile (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request:**
```json
{
  "name": "Updated Name",
  "bio": "Updated bio",
  "avatar_url": "https://new-avatar.jpg"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "Updated Name",
  "bio": "Updated bio",
  "avatar_url": "https://new-avatar.jpg",
  "updated_at": "2025-11-04T00:00:00.000Z"
}
```

## Events Published

### user_created
Published when a new user registers.

**Payload:**
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "createdAt": "2025-11-04T00:00:00.000Z"
}
```

## Database Schema

**Tables:**
- `auth.users` - User accounts
- `auth.sessions` - Active sessions

See [infrastructure/postgres/init.sql](../../infrastructure/postgres/init.sql) for full schema.

## Environment Variables

```env
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/karmyq_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
NODE_ENV=development
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode (hot reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

## Testing

See [TESTING.md](./TESTING.md) for comprehensive testing guide.

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# All tests with coverage
npm test
```

## Security

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens expire after 7 days
- SQL injection prevention (parameterized queries)
- Input validation on all endpoints
- CORS configured

## Error Codes

- `400` - Bad Request (missing/invalid fields)
- `401` - Unauthorized (invalid credentials/token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (user doesn't exist)
- `409` - Conflict (user already exists)
- `500` - Internal Server Error

## Dependencies

- **express** - Web framework
- **pg** - PostgreSQL client
- **bcrypt** - Password hashing
- **jsonwebtoken** - JWT tokens
- **bull** - Redis queue for events
- **cors** - CORS middleware
- **dotenv** - Environment variables

## Development Dependencies

- **typescript** - TypeScript support
- **jest** - Testing framework
- **supertest** - HTTP assertion library
- **ts-jest** - Jest TypeScript preprocessor
- **nodemon** - Auto-restart on changes
- **ts-node** - TypeScript execution

## Contributing

See [TESTING.md](./TESTING.md) for testing guidelines.

1. Write tests first (TDD)
2. Ensure 80%+ code coverage
3. Follow existing code style
4. Update documentation

## License

MIT
