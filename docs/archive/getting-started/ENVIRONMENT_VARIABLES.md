# Environment Variables Reference

Complete reference for all environment variables used across Karmyq services.

## Quick Start

Copy the appropriate `.env.example` file and customize:

```bash
# Backend services
cp infrastructure/docker/.env.example infrastructure/docker/.env

# Frontend
cp apps/frontend/.env.local.example apps/frontend/.env.local

# Integration tests
cp tests/integration/.env.example tests/integration/.env

# E2E tests
cp tests/e2e/.env.example tests/e2e/.env
```

## Backend Services

### Common Variables (All Services)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `development` | No |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | `info` | No |
| `DATABASE_URL` | PostgreSQL connection string | - | Yes |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` | Yes |
| `JWT_SECRET` | Secret key for JWT tokens | - | Yes |

### Auth Service (Port 3001)

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTH_PORT` | Service port | `3001` |
| `JWT_EXPIRES_IN` | Token expiration | `24h` |
| `BCRYPT_SALT_ROUNDS` | Password hashing rounds | `12` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |
| `RATE_LIMIT_DISABLED` | Disable rate limiting | `false` |

### Community Service (Port 3002)

| Variable | Description | Default |
|----------|-------------|---------|
| `COMMUNITY_PORT` | Service port | `3002` |
| `MAX_COMMUNITY_MEMBERS` | Default max members | `1000` |
| `RATE_LIMIT_DISABLED` | Disable rate limiting | `false` |

### Request Service (Port 3003)

| Variable | Description | Default |
|----------|-------------|---------|
| `REQUEST_PORT` | Service port | `3003` |
| `MAX_ACTIVE_REQUESTS` | Max active requests per user | `10` |
| `REQUEST_EXPIRY_DAYS` | Days before request expires | `30` |
| `RATE_LIMIT_DISABLED` | Disable rate limiting | `false` |

### Reputation Service (Port 3004)

| Variable | Description | Default |
|----------|-------------|---------|
| `REPUTATION_PORT` | Service port | `3004` |
| `KARMA_DECAY_ENABLED` | Enable karma decay | `true` |
| `KARMA_DECAY_RATE` | Decay rate (0-1) | `0.1` |
| `KARMA_DECAY_INTERVAL_DAYS` | Days between decay | `30` |
| `FIRST_HELP_BONUS` | Points for first help | `15` |
| `HELP_GIVEN_POINTS` | Points for helping | `10` |
| `HELP_RECEIVED_POINTS` | Points for receiving help | `5` |
| `RATE_LIMIT_DISABLED` | Disable rate limiting | `false` |

### Notification Service (Port 3005)

| Variable | Description | Default |
|----------|-------------|---------|
| `NOTIFICATION_PORT` | Service port | `3005` |
| `SSE_HEARTBEAT_INTERVAL` | SSE heartbeat (ms) | `30000` |
| `NOTIFICATION_RETENTION_DAYS` | Days to keep notifications | `30` |
| `RATE_LIMIT_DISABLED` | Disable rate limiting | `false` |

### Messaging Service (Port 3006)

| Variable | Description | Default |
|----------|-------------|---------|
| `MESSAGING_PORT` | Service port | `3006` |
| `WS_PING_INTERVAL` | WebSocket ping (ms) | `30000` |
| `MESSAGE_RETENTION_DAYS` | Days to keep messages | `90` |
| `RATE_LIMIT_DISABLED` | Disable rate limiting | `false` |

### Feed Service (Port 3007)

| Variable | Description | Default |
|----------|-------------|---------|
| `FEED_PORT` | Service port | `3007` |
| `FEED_ITEMS_PER_PAGE` | Default pagination | `20` |
| `FEED_CACHE_TTL` | Cache TTL (seconds) | `300` |
| `RATE_LIMIT_DISABLED` | Disable rate limiting | `false` |

### Cleanup Service (Port 3008)

| Variable | Description | Default |
|----------|-------------|---------|
| `CLEANUP_PORT` | Service port | `3008` |
| `CLEANUP_SCHEDULE` | Cron schedule | `0 2 * * *` |
| `SESSION_EXPIRY_DAYS` | Days before session cleanup | `30` |
| `NOTIFICATION_RETENTION_DAYS` | Days to keep notifications | `30` |
| `MESSAGE_RETENTION_DAYS` | Days to keep messages | `90` |
| `RATE_LIMIT_DISABLED` | Disable rate limiting | `false` |

## Frontend

### Next.js Public Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Auth service URL | `http://localhost:3001` |
| `NEXT_PUBLIC_COMMUNITY_API_URL` | Community service URL | `http://localhost:3002` |
| `NEXT_PUBLIC_REQUEST_API_URL` | Request service URL | `http://localhost:3003` |
| `NEXT_PUBLIC_REPUTATION_API_URL` | Reputation service URL | `http://localhost:3004` |
| `NEXT_PUBLIC_NOTIFICATION_API_URL` | Notification service URL | `http://localhost:3005` |
| `NEXT_PUBLIC_MESSAGING_API_URL` | Messaging service URL | `http://localhost:3006` |
| `NEXT_PUBLIC_FEED_API_URL` | Feed service URL | `http://localhost:3007` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | `ws://localhost:3006` |
| `NEXT_PUBLIC_APP_NAME` | Application name | `Karmyq` |
| `NEXT_PUBLIC_APP_URL` | Application URL | `http://localhost:3000` |

## Database

### PostgreSQL

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_USER` | Database user | `karmyq_user` |
| `POSTGRES_PASSWORD` | Database password | `karmyq_pass` |
| `POSTGRES_DB` | Database name | `karmyq` |
| `POSTGRES_HOST` | Database host | `localhost` |
| `POSTGRES_PORT` | Database port | `5432` |

### Redis

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password (optional) | - |

## Testing

### Integration Tests

| Variable | Description | Default |
|----------|-------------|---------|
| `TEST_DATABASE_URL` | Test database URL | Same as DATABASE_URL |
| `JWT_SECRET` | JWT secret for tests | `dev_jwt_secret...` |

### E2E Tests

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_URL` | Frontend URL | `http://localhost:3000` |
| `AUTH_API_URL` | Auth service URL | `http://localhost:3001` |
| `TEST_USER_EMAIL` | Test user email | `isabella.thomas0@example.com` |
| `TEST_USER_PASSWORD` | Test user password | `password123` |
| `TEST_TIMEOUT` | Test timeout (ms) | `30000` |

### Load Tests

| Variable | Description | Default |
|----------|-------------|---------|
| `LOAD_TEST_USERS` | Concurrent users | `10` |
| `LOAD_TEST_DURATION` | Test duration (seconds) | `30` |
| `LOAD_TEST_RAMP_UP` | Ramp-up time (seconds) | `5` |

## Rate Limiting

### Global Rate Limit Variables

These variables can be set on any service:

| Variable | Description | Default |
|----------|-------------|---------|
| `RATE_LIMIT_DISABLED` | Disable rate limiting entirely | `false` |
| `RATE_LIMIT_WINDOW_MS` | Time window in ms | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |
| `RATE_LIMIT_MULTIPLIER` | Multiply limits (for testing) | `1` |

### Testing with Rate Limits

```bash
# Disable rate limits for tests
RATE_LIMIT_DISABLED=true npm test

# Or use docker-compose test overlay
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d
```

## Security

### JWT Configuration

| Variable | Description | Recommendation |
|----------|-------------|----------------|
| `JWT_SECRET` | Secret for signing tokens | Use 256+ bit random string |
| `JWT_EXPIRES_IN` | Token expiration | `24h` for regular, `7d` for remember me |

### Generate Secure Secrets

```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate database password
openssl rand -base64 32
```

## Production Checklist

Before deploying to production, ensure:

- [ ] `JWT_SECRET` is a cryptographically secure random string
- [ ] Database credentials are unique and strong
- [ ] `NODE_ENV=production` is set
- [ ] Rate limiting is enabled (`RATE_LIMIT_DISABLED=false`)
- [ ] SSL/TLS is configured for all services
- [ ] Log level is set appropriately (`LOG_LEVEL=info` or `warn`)
- [ ] All sensitive variables are stored in secure secrets manager

## Example Configurations

### Development

```env
NODE_ENV=development
LOG_LEVEL=debug
JWT_SECRET=dev_jwt_secret_change_in_production
DATABASE_URL=postgresql://karmyq_user:karmyq_pass@localhost:5432/karmyq
REDIS_URL=redis://localhost:6379
RATE_LIMIT_DISABLED=false
```

### Production

```env
NODE_ENV=production
LOG_LEVEL=info
JWT_SECRET=${SECURE_JWT_SECRET}
DATABASE_URL=${SECURE_DATABASE_URL}
REDIS_URL=${SECURE_REDIS_URL}
RATE_LIMIT_DISABLED=false
```

### Testing

```env
NODE_ENV=test
LOG_LEVEL=error
JWT_SECRET=test_jwt_secret
DATABASE_URL=postgresql://karmyq_user:karmyq_pass@localhost:5432/karmyq_test
REDIS_URL=redis://localhost:6379
RATE_LIMIT_DISABLED=true
```
