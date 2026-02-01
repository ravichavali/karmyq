# Integration Tests

Integration tests verify service-to-service communication, database operations, and event-driven flows in a real environment.

---

## Quick Start

### Running Tests Locally

```bash
# 1. Start test environment (Docker Compose)
cd tests
npm run test:integration:setup

# 2. Wait for services to be healthy (check logs)
npm run test:integration:logs

# 3. Run integration tests
npm run test:integration

# 4. Stop test environment
npm run test:integration:teardown
```

### One-Line Command

```bash
npm run test:integration:full
```

This will start the environment, run tests, and tear down automatically.

---

## Test Structure

### New Clean Tests (Recommended)

Located in `tests/integration/` with `.integration.test.ts` suffix:

```
integration/
├── auth-flow.integration.test.ts           # User registration, login, JWT
├── community-flow.integration.test.ts      # Create, join, list communities
├── event-driven-flow.integration.test.ts   # Bull queue events
└── setup.ts                                 # Test environment setup
```

### Legacy Tests (Being Deprecated)

Old tests with `.test.ts` suffix (no `.integration` marker) use complex fixtures and are being phased out.

---

## What Integration Tests Cover

### ✅ Include

- **Service-to-service HTTP communication**
  - Example: auth-service validates token for community-service
- **Database operations**
  - Example: User registration creates record in auth.users table
- **Event publishing/subscribing**
  - Example: request_created event triggers notification creation
- **Multi-service workflows**
  - Example: Create request → publish event → create notification → update feed
- **Authentication/authorization flows**
  - Example: JWT validation across services
- **Data consistency**
  - Example: Referential integrity between users and requests

### ❌ Exclude (Covered by Other Test Tiers)

- Input validation → Unit tests
- Edge cases for single functions → Unit tests
- Mocked database operations → Regression tests
- UI/frontend behavior → E2E tests

---

## Test Environment

### Docker Compose Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Docker Compose Test Network (test-network)             │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │  PostgreSQL  │  │    Redis     │                    │
│  │  (test DB)   │  │  (test queue)│                    │
│  │  Port: 5433  │  │  Port: 6380  │                    │
│  └──────────────┘  └──────────────┘                    │
│         │                  │                            │
│  ┌──────────────────────────────────┐                  │
│  │        Services                  │                  │
│  │  • auth-service-test      :3001  │                  │
│  │  • community-service-test :3002  │                  │
│  │  • request-service-test   :3003  │                  │
│  │  • reputation-service-test:3004  │                  │
│  │  • notification-service   :3005  │                  │
│  │  • feed-service-test      :3007  │                  │
│  └──────────────────────────────────┘                  │
│                                                         │
│  ┌──────────────┐                                      │
│  │ Test Runner  │  (runs Jest inside Docker)           │
│  └──────────────┘                                      │
└─────────────────────────────────────────────────────────┘
```

### Environment Variables

Tests use Docker service names when running in Docker:
- `DATABASE_URL=postgresql://karmyq_test:test_password@postgres-test:5432/karmyq_test`
- `AUTH_SERVICE_URL=http://auth-service-test:3001`
- etc.

Or localhost when running on host (requires port forwarding):
- `DATABASE_URL=postgresql://karmyq_test:test_password@localhost:5433/karmyq_test`
- `AUTH_SERVICE_URL=http://localhost:3001`
- etc.

---

## Writing Integration Tests

### Test Template

```typescript
/**
 * [Feature] Integration Test
 *
 * Tests [describe what this test covers]
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { Pool } from 'pg';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const DATABASE_URL = process.env.DATABASE_URL || '...';

describe('[Feature] Flow', () => {
  let pool: Pool;
  let testDataId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    // Set up test data
  });

  afterAll(async () => {
    // Clean up test data
    if (testDataId) {
      await pool.query('DELETE FROM schema.table WHERE id = $1', [testDataId]);
    }
    await pool.end();
  });

  it('should [do something]', async () => {
    const response = await request(AUTH_SERVICE_URL)
      .post('/endpoint')
      .send({ data })
      .expect(200);

    expect(response.body.success).toBe(true);
  });
});
```

### Best Practices

1. **Use descriptive test names**
   ```typescript
   // ✅ Good
   it('should reject login with invalid password')

   // ❌ Bad
   it('test login')
   ```

2. **Clean up test data in afterAll**
   ```typescript
   afterAll(async () => {
     // Delete in reverse order (respect foreign keys)
     await pool.query('DELETE FROM requests WHERE id = $1', [requestId]);
     await pool.query('DELETE FROM users WHERE id = $1', [userId]);
     await pool.end();
   });
   ```

3. **Use unique identifiers**
   ```typescript
   const testUser = {
     email: `test-${Date.now()}@karmyq.test`,  // Unique
     username: `testuser-${Date.now()}`,
   };
   ```

4. **Test the happy path and error cases**
   ```typescript
   describe('User Login', () => {
     it('should login with correct credentials');
     it('should reject invalid password');
     it('should reject non-existent email');
   });
   ```

5. **Verify database state**
   ```typescript
   it('should persist user data in database', async () => {
     const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
     expect(result.rows.length).toBe(1);
   });
   ```

6. **Wait for async events**
   ```typescript
   // Allow time for Bull queue processing
   await new Promise(resolve => setTimeout(resolve, 2000));
   ```

---

## Troubleshooting

### Tests Fail with "ECONNREFUSED"

**Problem**: Can't connect to services

**Solution**:
1. Check services are running: `docker compose -f tests/docker-compose.test.yml ps`
2. Check logs: `npm run test:integration:logs`
3. Verify health: `docker compose -f tests/docker-compose.test.yml ps` (should show "healthy")

### Tests Fail with "EAI_AGAIN" or "getaddrinfo"

**Problem**: Can't resolve Docker service names

**Solution**:
- If running tests on host: Use `localhost` URLs and ensure ports are forwarded
- If running in Docker: Ensure using Docker service names and same network

### Tests Timeout

**Problem**: Services not responding in time

**Solution**:
1. Increase `testTimeout` in `jest.integration.config.js`
2. Check service logs for errors
3. Verify all dependencies are healthy before starting tests

### Database Connection Errors

**Problem**: "database \"karmyq_test\" does not exist"

**Solution**:
1. Restart test environment: `npm run test:integration:teardown && npm run test:integration:setup`
2. Check init.sql is being run: `docker logs karmyq-postgres-test`
3. Manually create database if needed:
   ```bash
   docker exec -it karmyq-postgres-test psql -U karmyq_test -c "CREATE DATABASE karmyq_test;"
   ```

### Port Conflicts

**Problem**: "port is already allocated"

**Solution**:
1. Stop production services if running locally
2. Change ports in `docker-compose.test.yml` (currently 5433, 6380 to avoid conflicts)
3. Use `docker ps` to see what's using ports

---

## CI/CD Integration

Integration tests run in GitHub Actions:

```yaml
- name: Run Integration Tests
  run: |
    cd tests
    docker compose -f docker-compose.test.yml up -d
    docker compose -f docker-compose.test.yml run --rm test-runner
    docker compose -f docker-compose.test.yml down -v
```

See [../.github/workflows/ci.yml](../../.github/workflows/ci.yml) for full configuration.

---

## Migration from Legacy Tests

### Phase 1: Build New Tests (Current)
- New tests coexist with old tests
- Use `.integration.test.ts` suffix for new tests
- Old tests remain in place

### Phase 2: Deprecate Old Tests
- Mark old tests as deprecated
- Update documentation to point to new tests
- Keep old tests for backwards compatibility

### Phase 3: Remove Old Tests
- Once all flows covered by new tests
- Remove old fixture system
- Delete legacy test files

---

## Test Coverage Goals

- **Authentication**: 100% (registration, login, JWT validation)
- **Communities**: 100% (create, join, list members)
- **Requests**: 80% (create, match, complete)
- **Events**: 80% (publish, subscribe, process)
- **Cross-service**: 80% (token validation, referential integrity)

---

## Performance Targets

- Full test suite: < 5 minutes
- Single test file: < 30 seconds
- Service startup: < 15 seconds
- Event processing: < 3 seconds

---

## Related Documentation

- [Integration Test Rebuild Plan](../../docs/INTEGRATION_TEST_REBUILD_PLAN.md)
- [Service Architecture](../../docs/ARCHITECTURE.md)
- [TDD Framework](../../CLAUDE.md#development-disciplines-must-follow)
- [Service Registry](../../services/registry.json)
