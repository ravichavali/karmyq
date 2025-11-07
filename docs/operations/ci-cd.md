# CI/CD Pipeline

Complete guide to Karmyq's continuous integration and deployment pipeline.

## Overview

Karmyq uses GitHub Actions for automated testing and deployment:

- **Unit & Integration Tests**: Run on every push/PR
- **E2E Tests**: Full end-to-end testing with Playwright
- **Docker Builds**: Validate containerization
- **Coverage Reports**: Track test coverage trends

## Workflows

### 1. Unit & Integration Tests (`.github/workflows/test.yml`)

Runs on every push and pull request to `main`, `master`, or `develop` branches.

**Jobs:**
- `test-auth-service` - Tests auth service with PostgreSQL & Redis
- `test-frontend` - Lints and builds frontend
- `docker-build` - Validates Docker Compose setup

**Services:**
- PostgreSQL 15 (test database)
- Redis 7 (session storage)

**Steps:**
1. Checkout code
2. Setup Node.js 18 with npm cache
3. Install dependencies
4. Run linter (if configured)
5. Run tests with coverage
6. Upload coverage to Codecov
7. Build Docker images
8. Start services and validate health

**Estimated Duration:** 5-10 minutes

### 2. E2E Tests (`.github/workflows/e2e-tests.yml`)

Comprehensive end-to-end testing with Playwright.

**Triggers:**
- Push to `main`, `master`, or `develop`
- Pull requests
- Manual dispatch

**Services:**
- PostgreSQL 15
- Redis 7
- All 6 microservices (auth, community, request, reputation, notification, messaging)
- Next.js frontend

**Test Suites (63 tests):**
- 01-auth.spec.ts (6 tests)
- 02-communities.spec.ts (5 tests)
- 03-requests.spec.ts (6 tests)
- 04-messaging.spec.ts (4 tests)
- 05-notifications.spec.ts (6 tests)
- 06-karma-system.spec.ts (9 tests)
- 07-advanced-matching.spec.ts (10 tests)
- 08-edge-cases.spec.ts (17 tests)

**Steps:**
1. Checkout code
2. Setup Node.js with caching
3. Initialize database schema
4. Install all service dependencies
5. Build shared packages
6. Start all microservices in background
7. Wait for health checks
8. Seed test data
9. Install Playwright browsers
10. Run E2E tests
11. Upload reports and videos
12. Show logs on failure
13. Cleanup processes

**Estimated Duration:** 15-25 minutes

**Artifacts:**
- Playwright HTML report (30 days retention)
- Test videos on failure (7 days retention)
- Service logs on failure

## Environment Variables

### Required for CI

```yaml
# Database
DATABASE_URL: postgresql://karmyq_user:karmyq_password_dev@localhost:5432/karmyq_db

# Redis
REDIS_URL: redis://localhost:6379

# JWT
JWT_SECRET: test_jwt_secret_for_ci

# Service URLs
NEXT_PUBLIC_API_URL: http://localhost:3001
NEXT_PUBLIC_COMMUNITY_API_URL: http://localhost:3002
NEXT_PUBLIC_REQUEST_API_URL: http://localhost:3003
NEXT_PUBLIC_REPUTATION_API_URL: http://localhost:3004
NEXT_PUBLIC_NOTIFICATION_API_URL: http://localhost:3005
NEXT_PUBLIC_MESSAGING_API_URL: http://localhost:3006

# Test User
TEST_USER_EMAIL: isabella.thomas0@example.com
TEST_USER_PASSWORD: password123

# Logging
LOG_LEVEL: info
```

## Status Badges

Add to your README:

```markdown
[![Tests](https://github.com/ravichavali/karmyq/actions/workflows/test.yml/badge.svg)](https://github.com/ravichavali/karmyq/actions/workflows/test.yml)
[![E2E Tests](https://github.com/ravichavali/karmyq/actions/workflows/e2e-tests.yml/badge.svg)](https://github.com/ravichavali/karmyq/actions/workflows/e2e-tests.yml)
```

## Viewing Test Results

### GitHub Actions UI

1. Go to the **Actions** tab in your repository
2. Select a workflow run
3. Click on a job to see logs
4. Download artifacts at the bottom

### Playwright Reports

E2E test artifacts include:
- **HTML Report**: Complete test results with screenshots
- **Videos**: Screen recordings of failed tests
- **Traces**: Full execution traces for debugging

To view locally:
```bash
# Download artifact from GitHub Actions
# Extract to tests/e2e/playwright-report/
npx playwright show-report tests/e2e/playwright-report
```

## Troubleshooting CI Failures

### Tests Timeout

**Symptom:** Tests fail with timeout errors

**Causes:**
- Services not starting in time
- Database initialization slow
- Health checks failing

**Solutions:**
1. Check service logs in failed job
2. Increase timeout in workflow (default: 30 minutes)
3. Add more retries to health checks
4. Verify database schema initialization

### Service Health Check Fails

**Symptom:** "Services failed to become healthy"

**Causes:**
- Port conflicts
- Missing dependencies
- Database connection issues
- Environment variables not set

**Solutions:**
1. Review service logs in workflow output
2. Verify environment variables are set correctly
3. Check database initialization step
4. Ensure all dependencies are installed

### Playwright Browser Install Fails

**Symptom:** "browserType.launch: Executable doesn't exist"

**Solutions:**
1. Ensure `npx playwright install --with-deps` runs
2. Use `chromium` only (lighter than full install)
3. Check Ubuntu version compatibility

### Database Schema Errors

**Symptom:** SQL errors during initialization

**Solutions:**
1. Verify `init.sql` is valid PostgreSQL
2. Check for duplicate schema definitions
3. Ensure proper user permissions
4. Run schema locally first to validate

### Flaky Tests

**Symptom:** Tests pass/fail randomly

**Causes:**
- Race conditions
- Insufficient wait times
- Network timing issues
- Async operations not awaited

**Solutions:**
1. Use `waitForSelector` instead of `waitForTimeout`
2. Add explicit waits for API responses
3. Use `test.retry(2)` for known flaky tests
4. Check for proper cleanup between tests

## Manual Workflow Dispatch

Trigger workflows manually:

1. Go to **Actions** tab
2. Select workflow (e.g., "E2E Tests")
3. Click **Run workflow**
4. Choose branch
5. Click green **Run workflow** button

## Local CI Testing

Test workflows locally with [act](https://github.com/nektos/act):

```bash
# Install act
brew install act  # macOS
# or
choco install act-cli  # Windows

# Run unit tests workflow
act -j test-auth-service

# Run E2E tests (requires large runner)
act -j e2e-tests --container-architecture linux/amd64
```

**Note:** E2E tests may not run perfectly with act due to service complexity.

## Coverage Reports

### Codecov Integration

Coverage reports are automatically uploaded to Codecov:

1. Sign up at https://codecov.io
2. Connect GitHub repository
3. Add `CODECOV_TOKEN` to repository secrets
4. Coverage badge appears in PR comments

### Local Coverage

Generate coverage reports locally:

```bash
# Auth service
cd services/auth-service
npm test -- --coverage
open coverage/lcov-report/index.html

# Frontend
cd apps/frontend
npm test -- --coverage
```

## Best Practices

### Writing CI-Friendly Tests

1. **Isolation**: Tests should not depend on each other
2. **Cleanup**: Always clean up created resources
3. **Deterministic**: No random data or timing dependencies
4. **Fast**: Keep tests under 30 seconds each
5. **Retries**: Use `test.retry()` for known flaky tests

### Optimizing CI Performance

1. **Cache Dependencies**: Use `actions/cache` for npm packages
2. **Parallel Jobs**: Run independent tests concurrently
3. **Selective Testing**: Only test changed services
4. **Skip Tests**: Use `[skip ci]` in commit message when appropriate
5. **Lightweight Images**: Use Alpine-based Docker images

### Security

1. **Secrets**: Never commit secrets or tokens
2. **Environment**: Use GitHub Secrets for sensitive data
3. **Permissions**: Limit workflow permissions to minimum needed
4. **Dependencies**: Regularly update action versions
5. **Audit**: Review workflow runs for suspicious activity

## Future Improvements

- [ ] Add deployment workflows (staging/production)
- [ ] Implement visual regression testing
- [ ] Add performance benchmarking
- [ ] Create preview environments for PRs
- [ ] Add automatic dependency updates (Dependabot)
- [ ] Implement canary deployments
- [ ] Add smoke tests for production
- [ ] Create rollback procedures

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Playwright CI Guide](https://playwright.dev/docs/ci)
- [Docker Compose in CI](https://docs.docker.com/compose/ci/)
- [Codecov Documentation](https://docs.codecov.io)

---

**Last Updated:** 2025-11-06
