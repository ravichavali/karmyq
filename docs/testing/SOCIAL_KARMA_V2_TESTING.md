# Social Karma v2.0 - Testing Guide

> **Date**: 2025-12-13
> **Version**: 7.0.0
> **Status**: Comprehensive test coverage implemented

## Overview

This document describes the testing strategy and implementation for Social Karma v2.0 features, ensuring regression prevention and quality assurance for all new UI components and APIs.

---

## Test Coverage

### 1. E2E Tests (Frontend + Backend)
**File**: [`tests/e2e/tests/10-social-karma-v2.spec.ts`](../../tests/e2e/tests/10-social-karma-v2.spec.ts)

**Tests Cover**:
- ✅ Community Health Hero widget rendering on dashboard
- ✅ Network strength metrics display
- ✅ Growth trend indicators
- ✅ Milestone posts in feed
- ✅ Pinned milestone badges (48-hour rule)
- ✅ Milestone descriptions
- ✅ Feed Service API endpoints (health, milestones, stories, mixed)
- ✅ Authentication requirements
- ✅ Parameter validation
- ✅ Error handling

**Test Groups**:
```typescript
describe('Social Karma v2.0', () => {
  describe('Community Health Hero Widget')     // 3 tests
  describe('Milestone Posts in Feed')          // 3 tests
  describe('Feed Service API Endpoints')       // 8 tests
  describe('Network Strength Calculation')     // 2 tests
  describe('Milestone Pinning Logic')          // 1 test
})
```

**Run E2E Tests**:
```bash
cd tests/e2e
npm install
npx playwright install chromium
npm test tests/10-social-karma-v2.spec.ts
```

---

### 2. Integration Tests (Backend APIs)
**File**: [`tests/integration/feed-service.test.ts`](../../tests/integration/feed-service.test.ts)

**Tests Cover**:
- ✅ Community health data structure
- ✅ Network strength calculation correctness
- ✅ Trend direction logic
- ✅ Milestone structure validation
- ✅ 48-hour pinning logic
- ✅ Limit parameter enforcement
- ✅ Featured stories privacy flags
- ✅ Rating range validation (1-5)
- ✅ Mixed feed prioritization
- ✅ Content interleaving
- ✅ Error handling (invalid IDs, missing params, auth)

**Test Groups**:
```typescript
describe('Feed Service - Community Health')    // 5 tests
describe('Feed Service - Milestones')          // 5 tests
describe('Feed Service - Featured Stories')    // 3 tests
describe('Feed Service - Mixed Feed')          // 3 tests
describe('Feed Service - Error Handling')      // 2 tests
```

**Run Integration Tests**:
```bash
cd tests
npm test integration/feed-service.test.ts
```

---

### 3. Test Data Seeding
**File**: [`tests/e2e/seed-social-karma-v2-simple.sql`](../../tests/e2e/seed-social-karma-v2-simple.sql)

**Seeds**:
- 5 milestone events (matches_10, participants_10, matches_50, quality_40, participants_25)
- 2 community health metric snapshots (7 days ago, today)
- Network strength: 90.8/100 (Thriving)
- Growth rate: +12.5% (7-day trend)

**Seed Test Data**:
```bash
cat tests/e2e/seed-social-karma-v2-simple.sql | \
  docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db
```

---

## Automated Testing (CI/CD)

### GitHub Actions Workflows

#### 1. E2E Tests Workflow
**File**: [`.github/workflows/e2e-tests.yml`](../../.github/workflows/e2e-tests.yml)

**Trigger**: Manual (`workflow_dispatch`)

**Steps**:
1. Checkout code
2. Setup Node.js 18
3. Install dependencies
4. Start Docker services (all 8 backend services)
5. Wait for services to be healthy
6. Seed E2E test data **+ Social Karma v2 test data**
7. Run E2E tests (including `10-social-karma-v2.spec.ts`)
8. Upload test results and screenshots
9. Cleanup Docker services

**Run Manually**:
```bash
# Via GitHub Actions UI
Go to Actions > E2E Tests > Run workflow

# Or locally
./scripts/run-e2e-tests.sh
```

#### 2. CI/CD Pipeline
**File**: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)

**Trigger**: Push/PR to `main`, `master`, or `develop`

**Jobs**:
1. **test-backend**: Run integration tests (includes `feed-service.test.ts`)
2. **lint**: TypeScript type check and linting
3. **build-images**: Build all 8 service Docker images
4. **deploy-qa**: Deploy to QA environment (on `develop` push)
5. **deploy-prod**: Deploy to production (on `main` push, manual approval)

**Integration tests run automatically** on every push/PR, ensuring regressions are caught immediately.

---

## Test Assertions Reference

### API Response Structure

**Community Health**:
```json
{
  "success": true,
  "data": {
    "communityId": "uuid",
    "communityName": "string",
    "networkStrength": 0-100,
    "networkStrengthLabel": "Building|Developing|Growing|Strong|Thriving",
    "totalMatches": 0+,
    "activeHelpers": 0+,
    "growthRate": -100 to +100,
    "trendDirection": "growing|stable|declining"
  }
}
```

**Milestones**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "milestone",
      "milestoneType": "matches_10|participants_25|etc",
      "description": "string",
      "achievedAt": "ISO8601 timestamp",
      "networkStrength": 0-100,
      "strengthChange": number,
      "celebrationCount": 0,
      "isPinned": boolean,
      "communityId": "uuid",
      "communityName": "string"
    }
  ]
}
```

### Network Strength Calculation

**Formula**:
```
networkStrength = (activityScore * 0.4) + (qualityScore * 0.4) + (densityScore * 0.2)

where:
  activityScore = min(100, totalMatches * 2)           // 50 matches = 100
  qualityScore = ((avgHelp + avgResp + avgClarity) / 3) * 20  // 5 stars = 100
  densityScore = networkDensity * 100
```

**Label Ranges**:
- **Thriving**: 80-100
- **Strong**: 60-79
- **Growing**: 40-59
- **Developing**: 20-39
- **Building**: 0-19

### Milestone Pinning

**Rule**: Milestones achieved within the last 48 hours are pinned.

**Test**:
```typescript
const isPinned = (achievedAt - now) < (48 * 60 * 60 * 1000)
```

---

## Regression Prevention Strategy

### 1. Pre-Commit Checks
Run locally before committing:
```bash
# Type check
npm run type-check --workspace=services/feed-service

# Lint
npm run lint

# Unit tests (if any)
npm test
```

### 2. Pre-Push Validation
Run integration tests before pushing:
```bash
cd tests
npm test integration/feed-service.test.ts
```

### 3. CI Validation
**Automatic on every push/PR**:
- Integration tests run in CI
- Docker builds validated
- Type checking enforced

### 4. Pre-Deployment E2E
Run full E2E suite before deploying:
```bash
# Via GitHub Actions
Trigger: "E2E Tests" workflow manually

# Or locally
cd tests/e2e
npm test
```

---

## Test Maintenance

### Adding New Tests

**E2E Test** (UI behavior):
```typescript
// tests/e2e/tests/10-social-karma-v2.spec.ts
test('should display new feature', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/dashboard');
  const newFeature = authenticatedPage.locator('[data-testid="new-feature"]');
  await expect(newFeature).toBeVisible();
});
```

**Integration Test** (API behavior):
```typescript
// tests/integration/feed-service.test.ts
it('should validate new endpoint', async () => {
  const response = await axios.get(`${FEED_API_URL}/feed/new-endpoint`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  expect(response.status).toBe(200);
  expect(response.data.success).toBe(true);
});
```

### Updating Test Data

Edit seed file:
```sql
-- tests/e2e/seed-social-karma-v2-simple.sql
INSERT INTO reputation.milestone_events (...) VALUES (...);
```

Then re-seed:
```bash
cat tests/e2e/seed-social-karma-v2-simple.sql | \
  docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db
```

---

## Known Issues & Limitations

### Current Test Gaps
- ❌ Frontend component unit tests (React Testing Library)
- ❌ Featured stories UI rendering (component exists but not in feed yet)
- ❌ Feedback prompt modal (component exists but not triggered)
- ❌ Trust score badges on cards (not yet implemented)

### Future Test Additions
- [ ] Component unit tests for `CommunityHealthHero.tsx`
- [ ] Component unit tests for `MilestonePost.tsx`
- [ ] Visual regression tests (Percy/Chromatic)
- [ ] Load tests for Feed Service endpoints
- [ ] Performance tests for network strength calculation

---

## Debugging Failed Tests

### E2E Test Failures

1. **Check screenshots**: `tests/e2e/test-results/`
2. **Check Playwright report**: `npx playwright show-report`
3. **Run in headed mode**:
   ```bash
   npm test -- --headed tests/10-social-karma-v2.spec.ts
   ```
4. **Check service logs**:
   ```bash
   docker logs karmyq-feed-service -f
   ```

### Integration Test Failures

1. **Check service health**:
   ```bash
   curl http://localhost:3007/health
   ```
2. **Check database state**:
   ```bash
   docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db \
     -c "SELECT * FROM reputation.community_health_metrics ORDER BY snapshot_date DESC LIMIT 1;"
   ```
3. **Enable debug logs**:
   ```bash
   DEBUG=feed-service:* npm test integration/feed-service.test.ts
   ```

---

## Success Metrics

### Test Coverage Goals
- ✅ **E2E Coverage**: All new UI components tested
- ✅ **API Coverage**: All 4 Feed Service endpoints tested
- ✅ **Edge Cases**: Authentication, validation, error handling
- ✅ **Regression Prevention**: Tests run on every push/PR

### Current Status
- **E2E Tests**: 17 tests across 5 test groups
- **Integration Tests**: 18 tests across 5 test groups
- **Total Coverage**: 35 automated tests for Social Karma v2.0
- **CI Integration**: ✅ Enabled on all branches

---

## Quick Reference

**Run Tests Locally** (Recommended):
```bash
# Quick tests before commit (~30 seconds)
./scripts/test-local.sh quick

# E2E tests before push (~3-5 minutes)
./scripts/test-local.sh e2e

# Full test suite before PR (~5-7 minutes)
./scripts/test-local.sh
```

**Run Tests Manually**:
```bash
# Integration tests (fast)
cd tests && npm test integration/feed-service.test.ts

# E2E tests (slow, requires Docker)
cd tests/e2e && npm test tests/10-social-karma-v2.spec.ts
```

📖 **See [LOCAL_TESTING.md](LOCAL_TESTING.md) for complete local testing guide**

**Seed Test Data**:
```bash
cat tests/e2e/seed-social-karma-v2-simple.sql | \
  docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db
```

**Check Frontend**:
```bash
# Rebuild with fixes
docker-compose -f infrastructure/docker/docker-compose.yml up -d --build frontend

# View logs
docker logs karmyq-frontend -f
```

**Check Feed Service**:
```bash
# View logs
docker logs karmyq-feed-service -f

# Test API manually
TOKEN="..."
curl "http://localhost:3007/feed/community-health?community_id=..." \
  -H "Authorization: Bearer $TOKEN"
```

---

**Next Steps**: Run the E2E test suite to validate all Social Karma v2.0 features end-to-end!
