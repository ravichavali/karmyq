# Tests Directory

## Overview
Comprehensive test suite for the Karmyq platform.

## Test Types

### integration/
Multi-tenant integration tests using Jest:
- `auth.test.ts` - Authentication flows
- `tenant-isolation.test.ts` - RLS and community isolation
- `rls-policies.test.ts` - Row-level security verification
- `multi-community-flows.test.ts` - Cross-community scenarios
- `reputation-decay.test.ts` - Karma decay calculations
- `ephemeral-data.test.ts` - TTL and data expiration

### e2e/
End-to-end tests using Playwright:
- User registration and login
- Community creation and management
- Request/offer workflows
- Full user journeys

### load/
Performance tests using k6:
- API endpoint stress testing
- Concurrent user simulations
- Throughput benchmarks

### fixtures/
Test data generators:
- `users.ts` - User factory
- `communities.ts` - Community factory
- `requests.ts` - Request/offer factories
- `cleanup.ts` - Test data cleanup utilities

## Running Tests

```bash
cd tests

# Install dependencies
npm install

# Run integration tests
npm test

# Run specific test file
npm test -- auth.test.ts

# Run E2E tests
cd e2e && npx playwright test

# Run load tests
cd load && k6 run scenarios/api-load.js
```

## Test Environment
Tests use `docker-compose.test.yml` for isolated database:
- Separate PostgreSQL instance
- Fixtures loaded before tests
- Cleaned up after test runs

## Writing Tests
```typescript
import { createTestUser, createTestCommunity, cleanup } from './fixtures';

describe('Feature', () => {
  beforeEach(async () => {
    await cleanup();
  });

  it('should do something', async () => {
    const user = await createTestUser();
    const community = await createTestCommunity(user.id);
    // Test logic
  });
});
```
