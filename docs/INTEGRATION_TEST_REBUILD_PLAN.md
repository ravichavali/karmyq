# Integration Test Rebuild Plan

**Date**: 2026-01-31
**Status**: Planning
**Priority**: Critical (blocks TDD framework completion)

---

## Problem Statement

Current integration tests are broken and carry technical debt:

- ❌ Tests try to connect to `karmyq-postgres` hostname from host machine
- ❌ Tests timeout (30000ms) waiting for database connection
- ❌ Tests require manual service startup (not automated)
- ❌ No isolation between test runs
- ❌ Cannot run in CI environment (GitHub Actions)

**User Decision**: "If our integration tests are carrying a lot of bad debt from past, I don't mind a clean start for them."

---

## Goals

1. ✅ Integration tests run reliably in CI (GitHub Actions)
2. ✅ Integration tests run reliably locally (`npm run test:integration`)
3. ✅ Tests are isolated and repeatable
4. ✅ Tests verify service-to-service communication
5. ✅ Tests verify event-driven flows (Bull queues)
6. ✅ Tests verify database operations with real PostgreSQL
7. ✅ Fast feedback (<5 minutes total)

---

## Architecture

### Test Environment

```
┌─────────────────────────────────────────────────────────┐
│ Docker Compose Test Environment                        │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  PostgreSQL  │  │    Redis     │  │  Test Runner │ │
│  │  (test DB)   │  │  (test queue)│  │  (Node.js)   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│         │                  │                  │        │
│         └──────────────────┴──────────────────┘        │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Auth Service │  │ Community Svc│  │ Request Svc  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                         │
│  ... (other critical services as needed)               │
└─────────────────────────────────────────────────────────┘
```

### Test Structure

```
tests/
├── integration/
│   ├── setup/
│   │   ├── globalSetup.ts        # Start Docker Compose
│   │   ├── globalTeardown.ts     # Stop Docker Compose
│   │   └── testDatabase.ts       # Seed test data
│   ├── auth/
│   │   ├── login.integration.test.ts
│   │   └── registration.integration.test.ts
│   ├── community/
│   │   ├── create-community.integration.test.ts
│   │   └── join-community.integration.test.ts
│   ├── events/
│   │   ├── match-completed.integration.test.ts
│   │   └── karma-awarded.integration.test.ts
│   └── flows/
│       ├── help-request-flow.integration.test.ts
│       └── user-onboarding-flow.integration.test.ts
├── docker-compose.test.yml       # Test environment config
└── jest.integration.config.js    # Jest config for integration tests
```

---

## Implementation Steps

### Phase 1: Docker Compose Test Environment (Day 1)

1. **Create `tests/docker-compose.test.yml`**
   - PostgreSQL with test database (`karmyq_test`)
   - Redis (separate from production)
   - Only critical services needed for integration tests
   - Use same network so services can communicate

2. **Create test database initialization**
   - Copy schema from `infrastructure/postgres/init.sql`
   - Add test data seeding script
   - Ensure clean state for each test run

3. **Create Jest global setup/teardown**
   - `globalSetup.ts`: Start Docker Compose, wait for health
   - `globalTeardown.ts`: Stop and remove containers
   - Set environment variables for test services

### Phase 2: Core Integration Tests (Day 2-3)

Start with **highest-value flows** that cover critical functionality:

1. **Authentication Flow**
   ```
   POST /auth/register → Creates user
   POST /auth/login → Returns JWT
   GET /auth/users/me (with JWT) → Returns user data
   ```

2. **Community Flow**
   ```
   POST /communities → Creates community (requires auth)
   POST /communities/:id/join → Joins community
   GET /communities/:id/members → Lists members
   ```

3. **Help Request Flow**
   ```
   POST /requests → Creates request (triggers events)
   → Verify notification created (event-driven)
   → Verify feed updated (event-driven)
   GET /requests/:id → Retrieves request
   ```

4. **Event-Driven Flow**
   ```
   POST /requests/:id/complete → Marks complete
   → Verify karma awarded (reputation service)
   → Verify notification sent (notification service)
   → Verify both users notified
   ```

### Phase 3: CI Integration (Day 4)

1. **Update `.github/workflows/ci.yml`**
   - Add new job: `integration-tests`
   - Run after `test-backend` passes
   - Use `docker-compose -f tests/docker-compose.test.yml`
   - Upload test results as artifacts

2. **Add test reporting**
   - Jest JUnit reporter for GitHub Actions
   - Clear failure messages
   - Test coverage for integration tests (separate from unit)

3. **Remove `SKIP_TESTS=1` from deployment**
   - Integration tests now run in CI, not on production
   - Deployment only happens if CI passes
   - Production deployment is clean (no test execution)

### Phase 4: Local Development Experience (Day 5)

1. **Add npm scripts**
   ```json
   "test:integration": "jest --config tests/jest.integration.config.js",
   "test:integration:watch": "jest --config tests/jest.integration.config.js --watch",
   "test:integration:setup": "docker-compose -f tests/docker-compose.test.yml up -d",
   "test:integration:teardown": "docker-compose -f tests/docker-compose.test.yml down -v"
   ```

2. **Add to pre-push hook**
   - Run integration tests before push (if Docker available)
   - Skip with `SKIP_INTEGRATION=1` flag if needed
   - Show clear message if Docker not running

3. **Documentation**
   - Update `tests/.claude/README.md`
   - Add troubleshooting guide
   - Document how to run tests locally

---

## What to Test (Integration Test Scope)

### ✅ Include

- Service-to-service HTTP communication
- Database operations (real PostgreSQL queries)
- Event publishing/subscribing (Bull queues)
- Authentication/authorization flows
- Multi-service workflows (e.g., create request → notify → update feed)
- Error handling between services

### ❌ Exclude (covered by unit/regression tests)

- Input validation (covered by unit tests)
- Edge cases for single functions (covered by unit tests)
- Mocked database operations (covered by regression tests)
- UI/frontend behavior (covered by E2E tests)

---

## Success Criteria

- [ ] All integration tests pass locally: `npm run test:integration`
- [ ] All integration tests pass in CI: GitHub Actions green checkmark
- [ ] Tests run in <5 minutes (parallel execution)
- [ ] Tests are isolated (can run in any order)
- [ ] Tests have clear failure messages
- [ ] Test coverage report shows critical flows covered
- [ ] Documentation updated with how to run/debug tests
- [ ] Pre-push hook runs integration tests (with skip option)
- [ ] CI runs integration tests before deployment
- [ ] Production deployment no longer runs tests (clean separation)

---

## Migration Strategy

### Step 1: Build in Parallel (No Disruption)

- Keep existing tests in place (even if broken)
- Build new test infrastructure alongside
- No changes to deployment process yet

### Step 2: Validate New Tests

- Run new integration tests locally
- Run new integration tests in CI (separate job)
- Verify they catch real issues
- Get confidence in new approach

### Step 3: Switch Over

- Update CI to use new integration tests
- Remove `SKIP_TESTS=1` from deployment
- Delete old integration test files
- Update documentation

### Step 4: Monitor

- Watch GitHub Actions for failures
- Fix any flaky tests immediately
- Gather team feedback

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1: Docker Compose | 1 day | Test environment working locally |
| Phase 2: Core Tests | 2 days | Auth, community, request, event flows tested |
| Phase 3: CI Integration | 1 day | Tests running in GitHub Actions |
| Phase 4: DX Polish | 1 day | npm scripts, hooks, docs complete |
| **Total** | **5 days** | **Production-ready integration tests** |

---

## Next Steps

1. ✅ Create this plan document
2. Create `tests/docker-compose.test.yml`
3. Create Jest global setup/teardown
4. Write first integration test (auth flow)
5. Get it passing locally
6. Add to CI
7. Iterate on remaining flows

---

## References

- [TDD Framework](../CLAUDE.md#development-disciplines-must-follow)
- [Service Registry](../services/registry.json)
- [Current CI Configuration](../.github/workflows/ci.yml)
- [Current Integration Tests](../tests/integration/) *(to be replaced)*
