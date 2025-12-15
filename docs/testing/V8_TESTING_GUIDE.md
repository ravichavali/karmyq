# Karmyq v8.0 Testing Guide

**Complete testing strategy for development, CI/CD, and performance validation**

---

## Overview

Karmyq v8.0 introduces a comprehensive testing infrastructure with:

- **Realistic Test Data**: 2000 users, 200 communities, 6 months of transactions
- **Test Personas**: 7 specific user types for E2E testing
- **Performance Tests**: API response time benchmarks
- **Git Hooks**: Automated testing before commits and pushes
- **E2E Test Suite**: Comprehensive user flow coverage

---

## Quick Start

```bash
# Generate large-scale test data (2000 users, 200 communities)
cd tests
npx ts-node fixtures/generate-large-dataset.ts
cat fixtures/large-dataset.sql | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db

# OR use quick seed (7 personas, 3 communities) for faster setup
cat tests/fixtures/quick-seed.sql | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db

# Run all tests locally
./scripts/test-all.sh      # Mac/Linux
scripts\test-all.bat        # Windows

# Install git hooks (enforces testing)
./scripts/install-git-hooks.sh      # Mac/Linux
scripts\install-git-hooks.bat       # Windows
```

---

## Test Data Generation

### Realistic Test Data

The test data generator creates a production-like dataset with:

**Users (2000)**
- Power law distribution: few very active, most moderate, some occasional
- Realistic names and emails using Faker.js
- Activity levels: very_active (5%), active (20%), moderate (45%), occasional (30%)

**Communities (200)**
- Size distribution:
  - Large (20 communities): 50-150 members
  - Medium (60 communities): 15-50 members
  - Small (120 communities): 3-15 members
- Realistic community names (geographic, interest-based, demographic)

**Transactions (6 Months)**
- Help requests with realistic descriptions
- Offers from community members
- Matches and completions (70% completion rate)
- Messages between matched users
- Karma awarded for completed helps

**Milestones**
- Match milestones: 10, 25, 50, 100, 250, 500
- Member milestones: 10, 25, 50, 100
- Pinned milestones for major achievements

### Generate and Load Data

```bash
# 1. Generate large-scale SQL file (2000 users, 200 communities)
cd tests
npx ts-node fixtures/generate-large-dataset.ts

# This creates:
# - fixtures/large-dataset.sql (SQL insert statements)
# - fixtures/large-dataset.json (metadata and statistics)

# 2. Load into database
cat fixtures/large-dataset.sql | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db

# Alternative: Use quick seed for faster testing (7 personas, 3 communities)
cat fixtures/quick-seed.sql | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db
```

### Data Generation Statistics

After generation, check `fixtures/large-dataset.json` for:

```json
{
  "statistics": {
    "users": 2000,
    "communities": 200,
    "members": 4790,
    "requests": 5320,
    "offers": 3592,
    "matches": 258,
    "messages": 1623,
    "karma_records": 453,
    "milestones": 21
  },
  "distribution": {
    "community_sizes": { "large": 20, "medium": 60, "small": 120 },
    "user_activity": { "very_active": 100, "active": 400, "moderate": 900, "occasional": 600 }
  }
}
```

---

## Test Personas

Seven test personas are included in the dataset for E2E testing:

| Persona | Email | Use Case |
|---------|-------|----------|
| New User | `new.user@test.com` | Brand new user, no karma, first request |
| Power Helper | `power.helper@test.com` | Very active helper, high karma (50+), high trust (80+) |
| Frequent Requester | `frequent.requester@test.com` | Often asks for help, moderate karma |
| Community Moderator | `community.moderator@test.com` | Moderator role, multiple communities |
| Balanced User | `balanced.user@test.com` | Equal giving/receiving, good trust score |
| Occasional User | `occasional.user@test.com` | Low activity, sporadic logins |
| Multi-Community Member | `multi.community@test.com` | Member of 10+ communities |

**All personas use password**: `password123`

### Using Personas in Tests

```typescript
// In Playwright E2E tests
import { PERSONAS } from './test-personas'

test('Power helper workflow', async ({ page }) => {
  await page.goto('http://localhost:3000/login')
  await page.fill('input[type="email"]', PERSONAS.POWER_HELPER.email)
  await page.fill('input[name="password"]', PERSONAS.POWER_HELPER.password)
  await page.click('button[type="submit"]')

  // User should have high karma
  const karma = await page.locator('text=Karma Points').locator('..').textContent()
  expect(parseInt(karma)).toBeGreaterThan(50)
})
```

---

## Test Suite Structure

```
tests/
├── integration/                    # API integration tests
│   ├── auth.test.ts               # Authentication tests
│   ├── tenant-isolation.test.ts   # Multi-tenant isolation
│   ├── rls-policies.test.ts       # Row-Level Security
│   ├── feed-service.test.ts       # Feed service tests
│   └── ...
│
├── e2e/                           # Playwright E2E tests
│   └── tests/
│       ├── 10-social-karma-v2.spec.ts    # Social Karma v2.0 UI
│       └── 11-comprehensive-flow.spec.ts  # All user flows
│
├── performance/                    # Performance benchmarks
│   └── api-performance.test.ts    # API response time tests
│
└── fixtures/                       # Test data
    ├── generate-realistic-data.ts  # Data generator
    ├── realistic-test-data.sql     # Generated SQL
    └── realistic-test-data.json    # Metadata
```

---

## Running Tests

### Local Testing

```bash
# Quick test (type-check + integration)
./scripts/test-local.sh quick
scripts\test-local.bat quick

# Full test suite (integration + E2E)
./scripts/test-all.sh
scripts\test-all.bat
```

### Individual Test Suites

**Integration Tests** (Jest)
```bash
cd tests
npm run test:integration           # All integration tests
npm run test:auth                  # Auth tests only
npm run test:tenant                # Tenant isolation
npm run test:rls                   # RLS policies
npm run test:flows                 # Multi-community flows
```

**E2E Tests** (Playwright)
```bash
cd tests/e2e
npm run test                       # Headless
npm run test:headed                # With browser
npm run test:ui                    # Interactive UI mode
```

**Performance Tests**
```bash
cd tests/performance
npm install
npm test

# Output shows P95/P99 response times and success rates
```

---

## Performance Benchmarks

### API Response Time Thresholds

| Endpoint | P95 Threshold | Description |
|----------|--------------|-------------|
| POST /auth/login | 500ms | User login |
| POST /auth/refresh | 300ms | Token refresh |
| GET /feed | 1000ms | Feed with 20 items |
| GET /feed/milestones | 500ms | Community milestones |
| GET /feed/community-health | 500ms | Health metrics |
| GET /reputation/karma | 300ms | User karma |
| GET /reputation/trust-score | 300ms | Trust score calc |
| GET /reputation/karma-history | 500ms | Karma history |
| POST /requests | 400ms | Create request |
| GET /requests | 800ms | List requests |
| POST /requests/:id/offers | 300ms | Create offer |

### Running Performance Tests

```bash
cd tests/performance
npm install
npm test

# Example output:
# ┌─────────────────────────────────────┬───────────┬───────────┬───────────┬───────────┬─────────────┐
# │ Endpoint                            │    Avg    │    P95    │    P99    │    Max    │  Success %  │
# ├─────────────────────────────────────┼───────────┼───────────┼───────────┼───────────┼─────────────┤
# │ POST /auth/login                    │    245ms  │    412ms  │    480ms  │    520ms  │     100.0%  │
# │ GET /feed                           │    612ms  │    890ms  │    950ms  │    1020ms │     100.0%  │
# └─────────────────────────────────────┴───────────┴───────────┴───────────┴───────────┴─────────────┘
```

Performance tests **fail** if any P95 exceeds the threshold.

---

## Git Hooks

### Pre-Commit Hook

Runs before every commit:
- TypeScript type checking
- Integration tests (quick subset)

### Pre-Push Hook

Runs before every push:
- Full integration test suite
- E2E tests
- (Optional) Performance tests

### Installing Hooks

```bash
# Mac/Linux
./scripts/install-git-hooks.sh

# Windows
scripts\install-git-hooks.bat
```

### Bypassing Hooks (Not Recommended)

```bash
git commit --no-verify
git push --no-verify
```

---

## E2E Test Coverage

The comprehensive E2E suite (`tests/e2e/tests/11-comprehensive-flow.spec.ts`) covers:

### New User Journey
- ✅ Sign up and first request creation
- ✅ Onboarding hints for empty state
- ✅ Zero karma and low trust score verification

### Power Helper Workflow
- ✅ High karma and trust score display
- ✅ Viewing and responding to multiple requests
- ✅ Offering help on open requests
- ✅ Messaging matched requesters

### Multi-Community Member
- ✅ Switching between communities
- ✅ Community-specific data updates
- ✅ Posting to specific vs. all communities
- ✅ Community health widget updates

### Complete Request Lifecycle
- ✅ Request creation
- ✅ Offer from helper
- ✅ Offer acceptance
- ✅ Messaging exchange
- ✅ Mark as complete
- ✅ Karma awarded

### Karma and Trust Score
- ✅ View detailed karma breakdown
- ✅ Karma history with event types
- ✅ Trust score detail page
- ✅ Trust score labels (Trusted/Reliable/Building/New)

### Community Health and Milestones
- ✅ Health widget metrics display
- ✅ Recent milestones list
- ✅ Milestone updates on community switch
- ✅ Pinned milestone indicators

### Navigation
- ✅ Profile page navigation
- ✅ Communities page navigation
- ✅ Karma/Trust detail pages
- ✅ Back button functionality

### Responsive Design
- ✅ 3-column layout on desktop (1920px)
- ✅ Single column on mobile (375px)
- ✅ Sidebar visibility by screen size

---

## CI/CD Integration

### GitHub Actions Workflow

The E2E workflow (`.github/workflows/e2e-tests.yml`) runs:

1. **Setup**
   - Start all services with Docker Compose
   - Wait for services to be healthy
   - Seed test data

2. **Integration Tests**
   - Run Jest integration tests
   - Verify multi-tenant isolation
   - Test RLS policies

3. **E2E Tests**
   - Install Playwright browsers
   - Run all E2E specs
   - Upload test artifacts on failure

4. **Cleanup**
   - Stop services
   - Clean up test data

### Running in CI

Tests run automatically on:
- Pull requests to `main` or `master`
- Pushes to `main` or `master`

---

## Testing Best Practices

### 1. Use Realistic Data

Always test with the large-scale dataset:
```bash
cd tests
npx ts-node fixtures/generate-large-dataset.ts
cat fixtures/large-dataset.sql | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db
```

### 2. Test All Personas

Ensure E2E tests cover all 7 personas:
- New users (onboarding, first request)
- Power helpers (high karma workflows)
- Moderators (community management)
- Multi-community members (switching)

### 3. Run Tests Locally Before Commit

```bash
# Before committing
./scripts/test-local.sh

# Before pushing
./scripts/test-all.sh
```

### 4. Monitor Performance

Run performance tests periodically:
```bash
cd tests/performance
npm test
```

If P95 exceeds thresholds, investigate:
- Database query optimization
- Caching opportunities
- N+1 query problems

### 5. Keep Test Data Fresh

Regenerate test data monthly or after schema changes:
```bash
cd tests
npx ts-node fixtures/generate-large-dataset.ts
cat fixtures/large-dataset.sql | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db
```

---

## Troubleshooting

### Tests Failing Locally

**Check services are running:**
```bash
docker-compose ps
```

**Verify database has test data:**
```bash
docker exec -it karmyq-postgres psql -U karmyq_user -d karmyq_db -c "SELECT COUNT(*) FROM auth.users;"
```

**Regenerate test data:**
```bash
cd tests
npx ts-node fixtures/generate-large-dataset.ts
cat fixtures/large-dataset.sql | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db
```

### E2E Tests Timeout

**Increase Playwright timeout:**
```typescript
// In playwright.config.ts
timeout: 60000 // 60 seconds
```

**Check frontend is accessible:**
```bash
curl http://localhost:3000
```

### Performance Tests Fail

**Check database connection pool:**
```bash
docker logs karmyq-postgres | grep "connection"
```

**Verify Redis is running:**
```bash
docker logs karmyq-redis
```

**Run with fewer concurrent requests:**
Edit `tests/performance/api-performance.test.ts`:
```typescript
private async measureEndpoint(..., iterations: number = 50) // Reduce from 100
```

---

## Test Data Cleanup

### Clean Expired Data

The Cleanup Service (port 3008) runs automated jobs:
- Expired requests (>60 days old)
- Orphaned matches
- Old messages

### Manual Cleanup

```bash
cd tests
npm run cleanup-test-data          # Interactive
npm run cleanup-test-data:dry-run  # Preview
npm run cleanup-test-data:force    # Force clean
```

---

## Future Enhancements

### Planned Testing Features

1. **Load Testing**
   - Concurrent user simulation
   - Database stress tests
   - Cache hit rate monitoring

2. **Visual Regression Testing**
   - Screenshot comparison
   - Component visual diffs
   - Responsive design verification

3. **Accessibility Testing**
   - WCAG compliance
   - Screen reader compatibility
   - Keyboard navigation

4. **Mobile E2E Tests**
   - React Native app testing
   - Cross-platform validation
   - Deep link testing

---

## Quick Reference

### Common Commands

```bash
# Generate large-scale test data
cd tests && npx ts-node fixtures/generate-large-dataset.ts
cat fixtures/large-dataset.sql | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db

# Quick seed (7 personas, 3 communities)
cat tests/fixtures/quick-seed.sql | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db

# Run all tests
./scripts/test-all.sh

# Install git hooks
./scripts/install-git-hooks.sh

# Performance tests
cd tests/performance && npm test

# E2E with UI
cd tests/e2e && npm run test:ui

# Single E2E test
cd tests/e2e && npx playwright test tests/11-comprehensive-flow.spec.ts
```

### Test Data Files

- **Large Dataset Generator**: `tests/fixtures/generate-large-dataset.ts`
- **Large Dataset SQL**: `tests/fixtures/large-dataset.sql`
- **Large Dataset Metadata**: `tests/fixtures/large-dataset.json`
- **Quick Seed SQL**: `tests/fixtures/quick-seed.sql`

### Documentation

- **LOCAL_TESTING.md**: Local testing guide
- **SOCIAL_KARMA_V2_TESTING.md**: Social Karma v2.0 test coverage
- **V8_TESTING_GUIDE.md**: This file

---

**For questions or issues, see [docs/KNOWN_ISSUES.md](../KNOWN_ISSUES.md)**
