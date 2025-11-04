# How to Run Tests in Karmyq

## Quick Reference

Tests are located **inside each service**, not at the root level.

### Auth Service Tests

```bash
# Navigate to the service
cd services/auth-service

# Run all tests
npm test

# Run tests in watch mode (best for development)
npm run test:watch

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run with coverage report
npm test -- --coverage
```

### Running Tests in Docker

If you want to run tests inside the Docker container:

```bash
# Run tests in running container
docker exec -it karmyq-auth-service npm test

# Or rebuild and run tests
docker compose run auth-service npm test
```

## Test Commands Explained

| Command | What it does |
|---------|--------------|
| `npm test` | Runs all tests with coverage |
| `npm run test:watch` | Watches for changes, re-runs tests automatically |
| `npm run test:unit` | Runs only unit tests (fast) |
| `npm run test:integration` | Runs only integration tests (slower) |

## Common Issues

### Issue: "Cannot find package.json"

**Problem**: You're in the wrong directory

**Solution**: 
```bash
# Make sure you're in the service directory
cd services/auth-service
npm test
```

### Issue: "Module not found"

**Problem**: Dependencies not installed

**Solution**:
```bash
cd services/auth-service
npm install
npm test
```

### Issue: Tests fail with database errors

**Problem**: Tests need database connection

**Solution**: Make sure Docker is running
```bash
# Start Docker services first
docker compose up -d

# Then run tests
cd services/auth-service
npm test
```

## Test Structure

```
services/auth-service/
├── package.json          # Contains test scripts
├── jest.config.js        # Jest configuration
├── tests/
│   ├── unit/            # Fast, isolated tests
│   ├── integration/     # Tests with real DB
│   └── helpers/         # Test utilities
└── src/                 # Source code being tested
```

## Example: Running Tests

```bash
# From project root
cd services/auth-service

# Install dependencies (first time only)
npm install

# Run tests
npm test
```

**Output you'll see:**
```
PASS  tests/unit/auth.routes.test.ts
  Auth Routes - Unit Tests
    ✓ should have auth routes defined (2 ms)
    Registration validation
      ✓ should require email, name, and password (1 ms)
    Login validation
      ✓ should require email and password (1 ms)

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
Snapshots:   0 total
Time:        2.345 s
```

## For Future Services

When you create new services (community-service, request-service, etc.):

```bash
# Each service will have its own tests
cd services/community-service
npm test

cd services/request-service
npm test
```

## CI/CD (GitHub Actions)

Tests run automatically when you:
- Push to GitHub
- Create a pull request
- Trigger manual workflow

No need to do anything - they run in the cloud!

## Coverage Reports

After running tests with coverage:

```bash
npm test -- --coverage

# View HTML report (Windows)
start coverage/lcov-report/index.html

# View HTML report (Mac/Linux)
open coverage/lcov-report/index.html
```

## Development Workflow

**Best practice while coding:**

```bash
# Terminal 1: Run services
docker compose up

# Terminal 2: Run tests in watch mode
cd services/auth-service
npm run test:watch

# Now as you edit code, tests automatically re-run!
```

## Quick Test Examples

### Test a Specific File
```bash
npm test auth.routes.test.ts
```

### Test with Pattern Matching
```bash
npm test -- --testNamePattern="registration"
```

### Verbose Output
```bash
npm test -- --verbose
```

### Update Snapshots (if using snapshot testing)
```bash
npm test -- --updateSnapshot
```

## Summary

**Remember**: 
- Tests are **per service**, not at root level
- Always `cd` into the service directory first
- Use `npm run test:watch` for development
- Tests require Docker services to be running (for integration tests)

**Quick command:**
```bash
cd services/auth-service && npm test
```

That's it! 🎯
