# Testing Guide for Auth Service

## Overview

This service uses **Jest** for testing with **Supertest** for API endpoint testing.

## Test Structure

```
tests/
├── unit/               # Unit tests (isolated, mocked dependencies)
│   └── auth.routes.test.ts
├── integration/        # Integration tests (with real database)
│   └── auth.integration.test.ts
└── helpers/            # Test utilities
    └── test-utils.ts
```

## Running Tests

### All Tests
```bash
npm test
```

### With Coverage
```bash
npm test -- --coverage
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

## Test Types

### Unit Tests
- Test individual functions/routes in isolation
- Mock all external dependencies (database, Redis, etc.)
- Fast execution
- Located in `tests/unit/`

**Example:**
```typescript
describe('POST /auth/register', () => {
  it('should register a new user', async () => {
    // Arrange: Mock database response
    (db.query as jest.Mock).mockResolvedValue({ rows: [mockUser] });
    
    // Act: Make request
    const response = await request(app)
      .post('/auth/register')
      .send({ email, name, password });
    
    // Assert: Check response
    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe(email);
  });
});
```

### Integration Tests
- Test complete flows with real dependencies
- Use test database
- Slower but more comprehensive
- Located in `tests/integration/`

**Example:**
```typescript
describe('User Registration Flow', () => {
  it('should create user in database', async () => {
    // Test with real database connection
    const user = await registerUser(testData);
    const dbUser = await query('SELECT * FROM auth.users WHERE id = $1', [user.id]);
    expect(dbUser.rows[0].email).toBe(testData.email);
  });
});
```

## Writing Tests

### Test Naming Convention
```typescript
describe('Component/Feature name', () => {
  describe('specific functionality', () => {
    it('should do something specific', () => {
      // test code
    });
  });
});
```

### Mocking Guidelines

**Mock database calls:**
```typescript
import * as db from '../../src/database/db';
jest.mock('../../src/database/db');

(db.query as jest.Mock).mockResolvedValue({ rows: [mockData] });
```

**Mock event publisher:**
```typescript
import * as eventPublisher from '../../src/events/publisher';
jest.mock('../../src/events/publisher');

(eventPublisher.publishEvent as jest.Mock).mockResolvedValue(undefined);
```

### Test Coverage Goals

- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

## Continuous Integration

Tests run automatically on:
- Every commit
- Pull requests
- Before deployment

## Best Practices

1. **Test One Thing**: Each test should verify one specific behavior
2. **Clear Naming**: Test names should describe what they test
3. **AAA Pattern**: Arrange, Act, Assert
4. **No Test Dependencies**: Tests should be independent
5. **Clean Up**: Always clean up test data
6. **Fast Tests**: Keep unit tests fast (< 100ms each)
7. **Readable**: Tests are documentation - make them clear

## Common Patterns

### Testing Auth Endpoints
```typescript
it('should require authentication', async () => {
  const response = await request(app)
    .get('/protected-route')
    .expect(401);
});

it('should allow authenticated users', async () => {
  const token = generateTestToken();
  const response = await request(app)
    .get('/protected-route')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
});
```

### Testing Validation
```typescript
it('should validate required fields', async () => {
  const response = await request(app)
    .post('/auth/register')
    .send({ email: 'test@example.com' }) // missing name and password
    .expect(400);
    
  expect(response.body.error).toBeDefined();
});
```

### Testing Error Handling
```typescript
it('should handle database errors gracefully', async () => {
  (db.query as jest.Mock).mockRejectedValue(new Error('DB Error'));
  
  const response = await request(app)
    .post('/auth/register')
    .send(validData)
    .expect(500);
});
```

## Debugging Tests

```bash
# Run specific test file
npm test auth.routes.test

# Run tests matching pattern
npm test -- --testNamePattern="registration"

# Show console logs
npm test -- --verbose

# Debug in VS Code
# Add breakpoint and use "Jest: Debug" configuration
```

## Test Environment

Tests use separate environment variables:
- `NODE_ENV=test`
- `DATABASE_URL=postgresql://...test_db`
- `REDIS_URL=redis://...test_redis`

## Future Improvements

- [ ] Add E2E tests
- [ ] Add performance tests
- [ ] Add load testing
- [ ] Increase coverage to 90%+
- [ ] Add mutation testing
- [ ] Add visual regression tests (for frontend)

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://testingjavascript.com/)
