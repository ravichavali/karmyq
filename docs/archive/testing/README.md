# Karmyq Testing Documentation

**Version**: 8.0.0
**Last Updated**: 2025-12-27

This directory contains all testing-related documentation for the Karmyq platform.

---

## 📚 Documentation Index

### Primary Guides (Start Here)

#### [V8_TESTING_GUIDE.md](V8_TESTING_GUIDE.md) - **AUTHORITATIVE GUIDE**
**Purpose**: Complete testing strategy for v8.0+
**Covers**:
- Realistic test data generation (2000 users, 200 communities)
- Test personas (7 user types for E2E testing)
- Performance benchmarks and API response times
- Git hooks setup for automated testing
- Quick start commands

**Use this for**: Understanding the current testing infrastructure and running tests

#### [LOCAL_TESTING.md](LOCAL_TESTING.md)
**Purpose**: Practical guide for running tests locally
**Covers**:
- Running integration tests
- Running E2E tests
- Running unit tests
- Debugging test failures
- Test data setup

**Use this for**: Day-to-day testing during development

### Specialized Guides

#### [TEST_DATA_STRATEGY.md](TEST_DATA_STRATEGY.md)
**Purpose**: Test data generation and management
**Covers**:
- Data generator architecture
- Power law distribution for realistic activity
- Test personas (new user, power helper, moderator, etc.)
- Seed files and fixtures

**Use this for**: Understanding or modifying test data generation

#### [SOCIAL_KARMA_V2_TESTING.md](SOCIAL_KARMA_V2_TESTING.md)
**Purpose**: Feature-specific testing for Social Karma v2.0
**Covers**:
- Reputation service tests
- Feed service tests
- Trust score calculations
- Karma decay algorithms

**Use this for**: Testing reputation and feed features

### Methodology Documentation

#### [../TDD_WORKFLOW.md](../TDD_WORKFLOW.md)
**Purpose**: Test-Driven Development methodology
**Covers**:
- Red → Green → Refactor cycle
- Unit test best practices
- Jest configuration and setup
- Custom matchers and test utilities

**Use this for**: Writing new unit tests following TDD principles

#### [../TEST_SUMMARY.md](../TEST_SUMMARY.md)
**Purpose**: Summary of TDD implementation (historical)
**Covers**:
- 163 unit tests implemented across 4 services
- Coverage metrics (98%+ on business logic)
- Test results and benefits achieved

**Use this for**: Reference on existing unit test coverage

---

## 🚀 Quick Reference

### Running Tests

```bash
# All tests (integration + unit + E2E)
npm test                              # From root
./scripts/test-all.sh                 # Mac/Linux
scripts\test-all.bat                  # Windows

# Integration tests only
cd tests && npm run test:integration

# Unit tests only
cd services/reputation-service && npm test
cd services/request-service && npm test
cd services/feed-service && npm test
cd services/notification-service && npm test

# E2E tests
cd tests && npx playwright test

# Specific service
docker logs karmyq-auth-service -f
```

### Test Data Setup

```bash
# Quick seed (3 communities, 7 personas) - 30 seconds
cat tests/fixtures/quick-seed.sql | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db

# Large dataset (200 communities, 2000 users) - 5 minutes
cd tests
npx ts-node fixtures/generate-large-dataset.ts
cat fixtures/large-dataset.sql | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db
```

### Git Hooks Setup

```bash
# Install pre-commit and pre-push hooks
./scripts/install-git-hooks.sh      # Mac/Linux
scripts\install-git-hooks.bat       # Windows
```

---

## 📊 Test Coverage Summary

### Unit Tests (163 passing)
- **Reputation Service**: 22 tests, 98.46% coverage
- **Request Service**: 36 tests, 98.46% coverage
- **Feed Service**: 58 tests, 62-98% coverage
- **Notification Service**: 47 tests, 100% coverage

### Integration Tests (126 passing)
- Authentication & multi-tenant JWT
- Tenant isolation & RLS policies
- Multi-community user flows
- Complete help exchange workflows

### E2E Tests (Playwright)
- User registration and login
- Community creation and joining
- Help request posting and fulfillment
- Reputation tracking
- Real-time notifications

---

## 🎯 Testing Philosophy

### TDD (Test-Driven Development)
Follow the Red → Green → Refactor cycle for all new business logic:
1. **Red**: Write failing test first
2. **Green**: Write minimal code to pass
3. **Refactor**: Improve code while keeping tests green

### Test Pyramid
```
        /\
       /E2E\      <- Few (critical user journeys)
      /------\
     / Integration\  <- Some (API contracts, workflows)
    /----------\
   /  Unit Tests \  <- Many (business logic, edge cases)
  /--------------\
```

### Coverage Targets
- **Business Logic**: 95%+ (karma calculation, matching, trust scores)
- **Route Handlers**: 80%+ (API endpoints, middleware)
- **Infrastructure**: 60%+ (database queries, event publishers)
- **Overall**: 80%+ (project-wide minimum)

---

## 🔧 Troubleshooting

### Tests Failing After Pull
```bash
# Reset database and regenerate test data
docker-compose down -v
docker-compose up -d postgres redis
cat tests/fixtures/quick-seed.sql | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db
```

### Port Conflicts
```bash
# Check what's using port 3001-3009
lsof -i :3001-3009  # Mac/Linux
netstat -ano | findstr :3001  # Windows
```

### Playwright Tests Timing Out
```bash
# Increase timeout in playwright.config.ts
timeout: 60000  // 60 seconds
```

---

## 📝 Writing New Tests

### Unit Test Example
```typescript
// services/reputation-service/tests/unit/karmaService.test.ts
describe('Karma Calculation', () => {
  it('should award 10 points to helper and 5 to requester', async () => {
    const result = await awardKarma({
      match_id: 'test-match',
      helper_id: 'user-1',
      requester_id: 'user-2',
      community_id: 'comm-1'
    });

    expect(result.helperKarma).toBe(10);
    expect(result.requesterKarma).toBe(5);
  });
});
```

### Integration Test Example
```typescript
// tests/integration/auth.test.ts
describe('POST /auth/register', () => {
  it('should register new user and return JWT', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!'
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toBeDefined();
  });
});
```

---

## 📚 Related Documentation

- **[CLAUDE.md](../../CLAUDE.md)** - Testing requirements and commands
- **[docs/architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md)** - System architecture
- **[docs/PROJECT_STATUS.md](../PROJECT_STATUS.md)** - Current implementation status

---

## 📦 Archived Documentation

The following testing documents have been archived but may contain useful historical context:

- **[TESTING_STRATEGY.md](../../archive/TESTING_STRATEGY.md)** (v5.4.0, 2025-01-29)
  - Original testing strategy targeting 90%+ coverage
  - Superseded by V8_TESTING_GUIDE.md
  - Preserved for historical reference

---

**Last Updated**: 2025-12-27
**Maintained by**: Karmyq Development Team
