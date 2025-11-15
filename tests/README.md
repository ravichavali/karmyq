# Karmyq Test Suite

Comprehensive integration and unit tests for the multi-tenant Karmyq platform.

## Test Organization

```
tests/
├── integration/          # Integration tests across services
│   ├── auth.test.ts                      # Authentication & JWT
│   ├── tenant-isolation.test.ts          # Multi-tenant isolation
│   ├── rls-policies.test.ts              # Row-Level Security policies
│   └── multi-community-flows.test.ts     # Complete user journeys
├── unit/                 # Unit tests (future)
├── jest.config.js        # Jest configuration
├── setup.ts              # Test setup and globals
├── package.json          # Test dependencies
└── tsconfig.json         # TypeScript config for tests
```

## Prerequisites

### 1. Running Services
All services must be running before executing tests:

```bash
# From project root
cd infrastructure/docker
docker-compose up

# Or use the convenience script
bash scripts/dev/start.sh
```

Wait until all services are healthy (check `docker-compose ps`).

### 2. Install Test Dependencies

```bash
cd tests
npm install
```

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Suites
```bash
# Authentication & JWT tests
npm run test:auth

# Multi-tenant isolation tests
npm run test:tenant

# RLS policy tests
npm run test:rls

# Multi-community user flow tests
npm run test:flows
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

## Test Suites Overview

### 1. Authentication Tests (`auth.test.ts`)
Tests the enhanced JWT system with multi-community support:
- User registration with empty communities array
- Login returns JWT with communities
- JWT verification
- Multi-community creation and admin role assignment
- JWT refresh after joining communities
- JWT payload structure validation
- JWT refresh strategy and token extension

**Key Validations:**
- JWT contains `userId`, `email`, `communities[]`, `currentCommunityId`
- Communities array includes `id`, `role`, `name`
- `/auth/refresh` updates communities array
- Token expiration extends on refresh

### 2. Tenant Isolation Tests (`tenant-isolation.test.ts`)
Verifies strict data isolation between communities:
- Community listing shows only user's communities
- Prevents access to other communities' data
- Help requests filtered by community
- Members list isolated per community
- Reputation/karma tracked separately per community
- Direct database RLS verification
- Rejects requests with wrong `X-Community-ID` header

**Key Validations:**
- User 1 in Portland cannot see User 2's Oakland data
- API requests with wrong community ID return 403
- RLS policies enforce isolation at database level

### 3. RLS Policy Tests (`rls-policies.test.ts`)
Tests Row-Level Security configuration and enforcement:
- RLS enabled on all 19 community-scoped tables
- Policies filter by `app.current_community_id` session variable
- Queries without session variables return no rows
- Policy completeness verification
- Direct PostgreSQL policy inspection

**Tables Tested:**
- `communities.*` (3 tables)
- `requests.*` (3 tables)
- `reputation.*` (4 tables)
- `notifications.*` (2 tables)
- `messaging.*` (3 tables)
- `feed.*` (4 tables)

### 4. Multi-Community User Flows (`multi-community-flows.test.ts`)
Complete user journey tests across multiple communities:

**Alice's Journey (Multi-Community User):**
1. Creates Portland community (becomes admin)
2. Refreshes JWT, sees Portland in token
3. Creates help request in Portland
4. Creates Seattle community (becomes admin)
5. Refreshes JWT, sees both communities
6. Creates help request in Seattle
7. Views requests separately by community
8. Has separate reputation in each community

**Bob's Journey (Joins Existing Community):**
1. Creates Oakland community
2. Cannot access Portland initially
3. Receives invite code from Alice
4. Joins Portland as member
5. Now has access to Portland data
6. Different roles in different communities (admin in Oakland, member in Portland)

**Complete Help Exchange Flow:**
1. Alice posts request in Portland
2. Bob (now in Portland) creates offer
3. Bob accepts Alice's request (match created)
4. Match completed, karma awarded
5. Bob's karma increases in Portland only (not Oakland)
6. Alice and Bob message about the exchange

## Environment Variables

Tests use these environment variables (from `.env` or defaults):

```bash
# Database
DATABASE_URL=postgresql://karmyq_user:karmyq_password_dev@localhost:5432/karmyq_db

# JWT
JWT_SECRET=dev_jwt_secret_change_in_production

# Service URLs
AUTH_SERVICE_URL=http://localhost:3001
COMMUNITY_SERVICE_URL=http://localhost:3002
REQUEST_SERVICE_URL=http://localhost:3003
REPUTATION_SERVICE_URL=http://localhost:3004
NOTIFICATION_SERVICE_URL=http://localhost:3005
MESSAGING_SERVICE_URL=http://localhost:3006
FEED_SERVICE_URL=http://localhost:3007
```

## Test Data Cleanup

All tests clean up after themselves:
- Test users are deleted in `afterAll()` hooks
- Uses cascading deletes for related data
- Direct database cleanup via PostgreSQL pool

## Debugging Tests

### View Test Output
```bash
# Verbose output
npm test -- --verbose

# Single test file with full output
npm test integration/auth.test.ts
```

### Enable Console Logs
Edit `setup.ts` and comment out the console mock lines:

```typescript
// log: jest.fn(),  // Uncomment to see logs
```

### Check Service Health
```bash
# From project root
docker-compose ps

# Check specific service logs
docker-compose logs auth-service
docker-compose logs community-service
```

### Database Inspection
```bash
# Connect to database
docker exec -it karmyq-postgres psql -U karmyq_user -d karmyq_db

# Check RLS policies
\d+ communities.communities

# View session variables
SELECT current_setting('app.current_user_id', true);
SELECT current_setting('app.current_community_id', true);
```

## CI/CD Integration

These tests run in GitHub Actions:

```yaml
# .github/workflows/test.yml
- name: Run Integration Tests
  run: |
    cd tests
    npm install
    npm test
```

## Writing New Tests

### Structure
```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { Pool } from 'pg';

const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:300X';
let pool: Pool;

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // Setup test data
});

afterAll(async () => {
  // Cleanup test data
  await pool.end();
});

describe('Feature Name', () => {
  it('should do something', async () => {
    const response = await request(SERVICE_URL)
      .post('/endpoint')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Community-ID', communityId)
      .send({ data: 'value' });

    expect(response.status).toBe(200);
  });
});
```

### Best Practices
1. **Isolate test data** - Use unique emails/names with timestamps
2. **Clean up** - Always delete test data in `afterAll()`
3. **Use descriptive names** - Test names should explain what they verify
4. **Test positive and negative cases** - Success and failure paths
5. **Verify RLS** - Test both API and direct database access
6. **Test cross-community isolation** - Verify data leakage prevention

## Troubleshooting

### Tests Timing Out
- Increase timeout in `jest.config.js`: `testTimeout: 60000`
- Check if all services are running: `docker-compose ps`
- Check service health endpoints: `curl http://localhost:3001/health`

### Connection Refused
- Ensure Docker containers are running
- Check port mappings: `docker-compose ps`
- Verify service URLs in `.env`

### RLS Tests Failing
- Check if RLS policies are created: `psql -U karmyq_user -d karmyq_db`
- Verify init.sql ran successfully: `docker-compose logs postgres`
- Check session variables are set correctly

### JWT Verification Errors
- Verify JWT_SECRET matches across services and tests
- Check token expiration hasn't passed
- Ensure `/auth/refresh` is called after community changes

## Next Steps

After completing the test suite:
1. **Phase 3**: Implement ephemeral data (TTL) and reputation decay
2. **Phase 4**: Add data export API for communities
3. **Phase 5**: Create E2E tests for frontend
4. **Phase 6**: Performance and load testing
