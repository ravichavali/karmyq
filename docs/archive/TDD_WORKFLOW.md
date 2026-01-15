# Test-Driven Development (TDD) Workflow for Karmyq

## 🔴 Red → 🟢 Green → 🔵 Refactor

---

## TDD Principles

### 1. **Red Phase** 🔴
**Write the test FIRST (it will fail)**
- Define expected behavior in test
- Test should fail because feature doesn't exist yet
- Validates that test can actually detect failures

### 2. **Green Phase** 🟢
**Write minimum code to make test pass**
- Implement just enough to pass the test
- Don't over-engineer
- Focus on making it work, not making it perfect

### 3. **Refactor Phase** 🔵
**Improve code quality while keeping tests green**
- Clean up duplication
- Improve names
- Optimize performance
- Extract functions
- **Tests must still pass after refactoring**

---

## Benefits of TDD

✅ **Better Design** - Writing tests first forces you to think about API design
✅ **Fewer Bugs** - Every line of code has a test
✅ **Confidence** - Refactor safely knowing tests will catch regressions
✅ **Documentation** - Tests show how code should be used
✅ **Faster Debugging** - Failing test pinpoints exact issue

---

## Current TDD Implementation

### ✅ Completed
- Root Jest configuration (`jest.config.js`)
- Global test setup (`jest.setup.js`)
- Custom Jest matchers (toBeWithinRange, toBeISODate, toBeUUID)
- Reputation Service test structure

### 🚧 In Progress
- Reputation Service unit tests (karma calculation, trust scores)
- Test coverage for all 8 services

### 📋 Planned
- Feed Service tests (ranking algorithm)
- Request Service tests (matching logic)
- Notification Service tests (template rendering)
- Messaging Service tests (WebSocket validation)
- Community Service tests (membership rules)
- Auth Service tests (JWT validation)
- Cleanup Service tests (TTL calculations)
- Geocoding Service tests (cache tiers)

---

## Example TDD Workflow

### Example: Adding "Super Helper" Badge for 200 Exchanges

#### Step 1: Red 🔴 (Write Failing Test)
```typescript
it('should award Super Helper badge at 200 exchanges', async () => {
  // Arrange
  mockQuery
    .mockResolvedValueOnce({ rows: [{ community_id: 'comm-1' }] })
    .mockResolvedValueOnce({ rows: [{ count: '200' }] }); // 200 helps!

  // Act
  await awardKarmaForCompletedMatch(mockData);

  // Assert
  const badgeCall = mockQuery.mock.calls.find(call =>
    call[0].includes('Super Helper badge')
  );

  expect(badgeCall).toBeDefined();
  expect(badgeCall[1]).toContain(200); // Badge points
});
```

**Run test**: `npm test` → ❌ **FAILS** (badge logic doesn't exist)

#### Step 2: Green 🟢 (Make It Pass)
```typescript
// In karmaService.ts
const totalHelps = parseInt(helperHistory.rows[0].count);
if (totalHelps === 200) {
  await recordKarma({
    user_id: responder_id,
    community_id,
    points: 200,
    reason: 'Super Helper badge',
    related_entity_id: match_id,
  });
}
```

**Run test**: `npm test` → ✅ **PASSES**

#### Step 3: Refactor 🔵 (Improve Code)
```typescript
// Extract milestone logic to separate function
const MILESTONES = {
  10: { points: 25, reason: '10 exchanges milestone' },
  50: { points: 50, reason: '50 exchanges milestone' },
  100: { points: 100, reason: '100 exchanges milestone' },
  200: { points: 200, reason: 'Super Helper badge' },
};

async function awardMilestoneBonus(userId: string, communityId: string, totalHelps: number) {
  const milestone = MILESTONES[totalHelps];
  if (milestone) {
    await recordKarma({
      user_id: userId,
      community_id: communityId,
      points: milestone.points,
      reason: milestone.reason,
    });
  }
}
```

**Run test**: `npm test` → ✅ **STILL PASSES** (refactor successful!)

---

## Running Tests

### Run All Tests
```bash
# From project root
npm test

# With coverage
npm test -- --coverage

# Watch mode (re-run on file change)
npm test -- --watch
```

### Run Specific Service Tests
```bash
cd services/reputation-service
npm test

# Run specific test file
npm test -- karmaService.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="milestone"
```

### Coverage Reports
```bash
cd services/reputation-service
npm test -- --coverage

# Opens HTML coverage report
open coverage/lcov-report/index.html  # Mac/Linux
start coverage/lcov-report/index.html  # Windows
```

---

## Writing Good Tests

### Do ✅
- **Test behavior, not implementation** - Test what it does, not how
- **Use descriptive test names** - `should award 10pts to helper`
- **Arrange-Act-Assert pattern** - Setup, execute, verify
- **One assertion per test** (when possible) - Easier to debug failures
- **Mock external dependencies** - Database, APIs, file system
- **Test edge cases** - Empty arrays, null values, max integers

### Don't ❌
- **Test implementation details** - Don't test private methods directly
- **Write dependent tests** - Each test should be independent
- **Skip the Red phase** - Always see the test fail first
- **Test framework code** - Don't test Express, PostgreSQL, etc.
- **Write huge tests** - Break into smaller, focused tests

---

## Test Organization

```
services/reputation-service/
├── src/
│   ├── services/
│   │   ├── karmaService.ts       # Business logic
│   │   └── trustScoreService.ts
│   └── index.ts
├── tests/
│   ├── unit/
│   │   ├── karmaService.test.ts       # Unit tests (mocked DB)
│   │   └── trustScoreService.test.ts
│   └── integration/
│       └── reputation.integration.test.ts  # Integration tests (real DB)
├── jest.config.js
└── package.json
```

---

## Coverage Goals

| Metric | Target | Current |
|--------|--------|---------|
| **Lines** | 80% | TBD |
| **Functions** | 80% | TBD |
| **Branches** | 80% | TBD |
| **Statements** | 80% | TBD |

**Critical Code** (must be 100%):
- Karma calculation logic
- Trust score formula
- Decay algorithm
- Match acceptance/rejection
- Payment/transaction logic (if added)

---

## Common Test Patterns

### Pattern 1: Testing Calculations
```typescript
it('should calculate trust score as 50 + min(50, karma/10)', () => {
  const karma = 300;
  const expectedScore = 50 + Math.min(50, Math.floor(karma / 10)); // 50 + 30 = 80

  expect(calculateTrustScore(karma)).toBe(expectedScore);
});
```

### Pattern 2: Testing State Changes
```typescript
it('should transition request from OPEN to MATCHED', async () => {
  const request = await createRequest({ status: 'OPEN' });

  await acceptOffer(request.id, offerId);

  const updated = await getRequest(request.id);
  expect(updated.status).toBe('MATCHED');
});
```

### Pattern 3: Testing Validations
```typescript
it('should reject negative karma points', async () => {
  await expect(
    recordKarma({ points: -10 })
  ).rejects.toThrow('Points must be positive');
});
```

### Pattern 4: Testing Side Effects
```typescript
it('should send notification when karma awarded', async () => {
  const notifyMock = jest.fn();

  await awardKarma({ userId: 'user-1', points: 10 });

  expect(notifyMock).toHaveBeenCalledWith({
    userId: 'user-1',
    type: 'KARMA_AWARDED',
    message: 'You earned 10 karma points!'
  });
});
```

---

## Debugging Failed Tests

### Test Fails: "Expected 10 but received undefined"
**Cause**: Mock not configured correctly
**Fix**: Check `mockQuery` return values match expected structure

### Test Fails: "Cannot read property 'rows' of undefined"
**Cause**: Missing mock for database call
**Fix**: Add `.mockResolvedValueOnce()` for each query

### Test Passes in Isolation, Fails in Suite
**Cause**: Test pollution (shared state)
**Fix**: Ensure `beforeEach` clears all mocks: `jest.clearAllMocks()`

### Coverage Not Updating
**Cause**: Jest cache
**Fix**: `npm test -- --clearCache`

---

## Implementation Progress

### ✅ Completed Services (163 Tests Total)

#### 1. Reputation Service
- **Tests**: 22 passing
- **Coverage**: 98.46% (karmaService.ts)
- **File**: `services/reputation-service/tests/unit/karmaService.test.ts`
- **Test Areas**:
  - Karma calculation (10pts helper, 5pts requester)
  - First help bonus (15pts)
  - Milestone bonuses (10, 50, 100 exchanges)
  - Trust score formula (50 + min(50, karma/10))
  - Leaderboard ranking

#### 2. Request Service
- **Tests**: 36 passing
- **Coverage**: 98.46% (matchService.ts)
- **Files**:
  - Tests: `services/request-service/tests/unit/matchingLogic.test.ts`
  - Service: `services/request-service/src/services/matchService.ts`
- **Test Areas**:
  - Match creation validation
  - Accept/reject workflows
  - Auto-rejection of competing offers
  - Request status state machine
  - Authorization checks

#### 3. Feed Service
- **Tests**: 58 passing (30 + 28)
- **Coverage**: 62.79% (socialKarmaFeedComposer), 34.1% (feedComposer)
- **Files**:
  - `services/feed-service/tests/unit/feedComposer.test.ts`
  - `services/feed-service/tests/unit/socialKarmaFeedComposer.test.ts`
- **Test Areas**:
  - Feed ratio calculation (new/active/standard users)
  - Skill matching algorithm
  - Request priority calculation
  - Network strength formula (40% activity, 40% quality, 20% density)
  - Content interleaving (1 milestone, 2 stories)

#### 4. Notification Service
- **Tests**: 47 passing
- **Coverage**: 100% (notificationTemplates.ts)
- **File**: `services/notification-service/tests/unit/notificationTemplates.test.ts`
- **Test Areas**:
  - Template rendering (12 notification types)
  - Priority classification (high/medium/low)
  - Channel configuration (in_app/push/email)
  - Edge cases (special characters, unicode)

### 📋 Remaining Services

- Auth Service (JWT validation, password hashing)
- Messaging Service (WebSocket validation)
- Community Service (membership rules)
- Cleanup Service (TTL calculations)
- Geocoding Service (cache tiers)

### Next Steps

1. ✅ Complete Reputation Service tests
2. ✅ Complete Feed Service tests (ranking algorithm)
3. ✅ Complete Request Service tests (matching logic)
4. ✅ Complete Notification Service tests (templates)
5. 📝 Write tests for remaining 5 services
6. 📝 Achieve 80%+ coverage across all services
7. 🔄 Refactor code based on test insights
8. 🚀 Integrate tests into CI/CD pipeline

---

**Remember**: Write tests FIRST, then write code to make them pass. This is the TDD way! 🧪
