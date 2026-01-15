# Testing Guide

Comprehensive testing strategy for the Karmyq platform.

## Testing Pyramid

```
       /\
      /  \     E2E Tests (Playwright)
     /____\    - Critical user journeys
    /      \   - Full system integration
   /________\
  /          \  Integration Tests
 /____________\ - API endpoint tests
/              \ - Service integration
|______________| Unit Tests
                 - Business logic
                 - Utility functions
```

## Test Types

### 1. End-to-End Tests (E2E)

**Location**: `tests/e2e/`
**Framework**: Playwright
**Purpose**: Test complete user workflows through the browser

**Run E2E Tests**:
```bash
cd tests/e2e
npm install
npm test
```

See [E2E Testing README](../../tests/e2e/README.md) for details.

### 2. Integration Tests

**Location**: `services/*/tests/integration/`
**Framework**: Jest
**Purpose**: Test API endpoints and service interactions

**Run Integration Tests**:
```bash
cd services/auth-service
npm run test:integration
```

### 3. Unit Tests

**Location**: `services/*/tests/unit/`
**Framework**: Jest
**Purpose**: Test individual functions and business logic

**Run Unit Tests**:
```bash
cd services/auth-service
npm test
```

## Test Organization

```
karmyq/
├── tests/
│   └── e2e/                    # End-to-end tests
│       ├── tests/
│       │   ├── 01-auth.spec.ts
│       │   ├── 02-communities.spec.ts
│       │   └── ...
│       └── playwright.config.ts
│
└── services/
    └── auth-service/
        └── tests/
            ├── unit/           # Unit tests
            │   └── *.test.ts
            └── integration/    # Integration tests
                └── *.test.ts
```

## Writing Tests

### E2E Test Example

```typescript
import { test, expect } from './fixtures/auth';

test('should create a community', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/communities/new');

  await authenticatedPage.fill('input[name="name"]', 'Test Community');
  await authenticatedPage.fill('textarea[name="description"]', 'Test description');
  await authenticatedPage.click('button[type="submit"]');

  await expect(authenticatedPage.locator('h1')).toContainText('Test Community');
});
```

### Integration Test Example

```typescript
import request from 'supertest';
import { app } from '../../src/index';

describe('POST /auth/login', () => {
  it('should return token on valid credentials', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'user@example.com',
        password: 'password123'
      })
      .expect(200);

    expect(response.body).toHaveProperty('token');
    expect(response.body.user).toHaveProperty('id');
  });

  it('should return 401 on invalid credentials', async () => {
    await request(app)
      .post('/auth/login')
      .send({
        email: 'user@example.com',
        password: 'wrong'
      })
      .expect(401);
  });
});
```

### Unit Test Example

```typescript
import { calculateKarma } from '../services/karma';

describe('calculateKarma', () => {
  it('should award 10 points for helping', () => {
    const karma = calculateKarma({
      action: 'help_given',
      isFirstHelp: false
    });

    expect(karma).toBe(10);
  });

  it('should award 15 points for first help', () => {
    const karma = calculateKarma({
      action: 'help_given',
      isFirstHelp: true
    });

    expect(karma).toBe(15);
  });
});
```

## Test Data Management

### Test Fixtures (Factory Pattern)

The project uses a comprehensive factory pattern for test data management located in `tests/fixtures/`:

```typescript
// tests/fixtures/index.ts - Main exports
import { ServiceUrls, TestScenario } from './config';
import { UserFactory, TestUser } from './users';
import { CommunityFactory, TestCommunity } from './communities';
import { RequestFactory, TestRequest } from './requests';
import { OfferFactory, TestOffer } from './offers';
```

### Using Test Factories

```typescript
import {
  TestScenario,
  UserFactory,
  CommunityFactory,
  RequestFactory
} from '../fixtures';

let scenario: TestScenario;
let testUser: TestUser | null;
let testCommunity: TestCommunity | null;

beforeAll(async () => {
  scenario = new TestScenario();

  // Create test user via API
  testUser = await UserFactory.create({
    prefix: 'my-test',
    name: 'Test User',
  });

  // Create test community
  if (testUser) {
    testCommunity = await CommunityFactory.create({
      creatorToken: testUser.token,
      creatorId: testUser.id,
      name: 'Test Community',
      description: 'For testing',
    });
  }
});

afterAll(async () => {
  // Cleanup in correct order (respect foreign keys)
  // 1. Communities first (reference users via creator_id)
  if (testCommunity) {
    await CommunityFactory.delete(scenario.pool, testCommunity.id);
  }
  // 2. Then users
  if (testUser) {
    await UserFactory.delete(scenario.pool, testUser.id);
  }
  await scenario.pool.end();
});
```

### Available Factories

| Factory | Creates | Cleanup Order |
|---------|---------|---------------|
| `UserFactory` | User via auth service | Last |
| `CommunityFactory` | Community with membership | Before users |
| `RequestFactory` | Help request | Before communities |
| `OfferFactory` | Help offer | Before communities |

### Multi-Tenant Testing

All requests require proper community context via headers:

```typescript
const response = await request(ServiceUrls.REQUEST)
  .get('/requests')
  .set('Authorization', `Bearer ${token}`)
  .set('X-Community-ID', communityId);  // Required for multi-tenant
```

### Database Seeding

For integration tests, seed the database before tests:

```typescript
beforeAll(async () => {
  await pool.query('TRUNCATE TABLE users CASCADE');
  await pool.query(`
    INSERT INTO users (email, password, name) VALUES
    ('test@example.com', 'hashed_password', 'Test User')
  `);
});

afterAll(async () => {
  await pool.end();
});
```

### Cleanup Order (Important!)

Due to foreign key constraints, cleanup must follow this order:

```typescript
afterAll(async () => {
  try {
    // 1. Delete requests/offers (reference communities)
    if (testRequest) await RequestFactory.delete(pool, testRequest.id);
    if (testOffer) await OfferFactory.delete(pool, testOffer.id);

    // 2. Delete communities (reference users via creator_id)
    if (testCommunity) await CommunityFactory.delete(pool, testCommunity.id);

    // 3. Delete users last
    if (testUser) await UserFactory.delete(pool, testUser.id);
  } catch (error) {
    console.log('Cleanup error:', error);
  }
  await pool.end();
});
```

## Mocking

### Mocking External Services

```typescript
jest.mock('../services/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true })
}));
```

### Mocking Database

```typescript
const mockQuery = jest.fn();
jest.mock('../database/db', () => ({
  query: mockQuery
}));

beforeEach(() => {
  mockQuery.mockReset();
});

it('should fetch user from database', async () => {
  mockQuery.mockResolvedValue({
    rows: [{ id: '123', name: 'Test User' }],
    rowCount: 1
  });

  const user = await getUserById('123');

  expect(mockQuery).toHaveBeenCalledWith(
    'SELECT * FROM users WHERE id = $1',
    ['123']
  );
  expect(user.name).toBe('Test User');
});
```

## Test Coverage

### Generate Coverage Report

```bash
npm run test:coverage
```

### Coverage Goals

- **Overall**: 80%+
- **Critical paths** (auth, payments): 95%+
- **Business logic**: 90%+
- **Utilities**: 85%+

### View Coverage Report

```bash
open coverage/lcov-report/index.html
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: npm install

      - name: Run unit tests
        run: npm test

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Start services
        run: bash scripts/dev/start.sh &

      - name: Wait for services
        run: sleep 30

      - name: Run E2E tests
        working-directory: tests/e2e
        run: |
          npm install
          npx playwright install --with-deps
          npm test

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: tests/e2e/test-results/
```

## Best Practices

### 1. Test Isolation

Each test should be independent:

```typescript
// ✅ Good
describe('User registration', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should create user', async () => {
    // Test creates its own data
  });
});

// ❌ Bad
let userId;
it('should create user', async () => {
  userId = await createUser(); // Next test depends on this
});
it('should update user', async () => {
  await updateUser(userId); // Depends on previous test
});
```

### 2. Descriptive Test Names

```typescript
// ✅ Good
it('should return 404 when user does not exist', async () => {});
it('should award 15 points for first help', async () => {});

// ❌ Bad
it('should work', async () => {});
it('test user', async () => {});
```

### 3. Test One Thing

```typescript
// ✅ Good
it('should create user with valid data', async () => {
  const user = await createUser(validData);
  expect(user.email).toBe(validData.email);
});

it('should reject user with invalid email', async () => {
  await expect(createUser({ email: 'invalid' }))
    .rejects.toThrow('Invalid email');
});

// ❌ Bad
it('should create user and send email and log event', async () => {
  // Testing too many things
});
```

### 4. Use Test Factories

```typescript
// tests/factories/user.ts
export function createTestUser(overrides = {}) {
  return {
    id: uuid(),
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
    createdAt: new Date(),
    ...overrides
  };
}

// Usage
const user = createTestUser({ name: 'Custom Name' });
```

### 5. Async/Await

Always use async/await for async tests:

```typescript
// ✅ Good
it('should fetch user', async () => {
  const user = await getUserById('123');
  expect(user).toBeDefined();
});

// ❌ Bad
it('should fetch user', (done) => {
  getUserById('123').then(user => {
    expect(user).toBeDefined();
    done();
  });
});
```

## Debugging Tests

### Run Single Test

```bash
npm test -- --testNamePattern="should create user"
```

### Run Single File

```bash
npm test -- auth.test.ts
```

### Debug in VSCode

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "${file}"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Enable Verbose Output

```bash
npm test -- --verbose
```

## Performance Testing

### Load Testing with Built-in Tool

The project includes a custom load testing tool at `tests/load/`:

```bash
# Install dependencies
cd tests/load
npm install

# Run default load test (10 users, 30 seconds)
npm test

# Light load test (5 users, 15 seconds)
npm run test:light

# Heavy load test (50 users, 60 seconds)
npm run test:heavy

# Stress test (100 users, 120 seconds)
npm run test:stress
```

### Configuration

Configure via environment variables:

```bash
# .env
LOAD_TEST_USERS=10        # Concurrent users
LOAD_TEST_DURATION=30     # Duration in seconds
LOAD_TEST_RAMP_UP=5       # Ramp-up time
```

### Load Test Output

```
🚀 Karmyq Load Testing Tool
============================================================
Configuration:
  Concurrent Users: 10
  Duration:         30s
  Ramp-up:          5s
============================================================

📈 Request Statistics:
   Total Requests:     1,234
   Successful:         1,180 (95.6%)
   Failed:             54 (4.4%)

⏱️  Latency Statistics:
   Average:            145ms
   Min:                23ms
   Max:                892ms

📊 Status Code Distribution:
   200: 1,100 (89.1%)
   201: 80 (6.5%)
   429: 54 (4.4%)   # Rate limiting

✅ PASSED: System performing well under load
📋 Rate limiting triggered 54 times (expected behavior)
```

### Testing with Rate Limiting Disabled

For integration tests, rate limiting can be disabled:

```bash
# Using docker-compose test overlay
docker compose -f infrastructure/docker/docker-compose.yml \
  -f infrastructure/docker/docker-compose.test.yml up -d

# Or via environment variable
RATE_LIMIT_DISABLED=true npm test
```

### Load Testing with Artillery (Alternative)

```yaml
# load-test.yml
config:
  target: "http://localhost:3001"
  phases:
    - duration: 60
      arrivalRate: 10

scenarios:
  - name: "Login flow"
    flow:
      - post:
          url: "/auth/login"
          json:
            email: "test@example.com"
            password: "password123"
```

Run:
```bash
artillery run load-test.yml
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev)
- [Testing Best Practices](https://testingjavascript.com)
- [Test-Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
