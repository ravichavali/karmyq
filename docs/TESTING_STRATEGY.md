# Karmyq Testing Strategy - 90%+ Coverage Plan

**Version**: v5.4.0
**Target Coverage**: 90%+ across all metrics
**Last Updated**: 2025-01-29

---

## 📊 Coverage Goals

### Target Metrics
- **Line Coverage**: ≥ 90%
- **Branch Coverage**: ≥ 85%
- **Function Coverage**: ≥ 90%
- **Statement Coverage**: ≥ 90%

### Current Status
- ⏳ Assessment in progress
- 📝 Baseline measurements needed
- 🎯 Target: 90%+ across all services

---

## 🏗️ Test Architecture

### 1. Unit Tests (`tests/unit/`)
**Purpose**: Test individual functions, classes, and modules in isolation

**Coverage Target**: ≥ 95%

**Structure**:
```
tests/unit/
├── services/
│   ├── auth-service/
│   │   ├── password-hashing.test.ts
│   │   ├── jwt-generation.test.ts
│   │   └── user-validation.test.ts
│   ├── community-service/
│   │   ├── dunbar-limit.test.ts
│   │   ├── norm-voting.test.ts
│   │   └── member-management.test.ts
│   ├── request-service/
│   │   ├── request-creation.test.ts
│   │   ├── multi-community-posting.test.ts
│   │   └── match-logic.test.ts
│   ├── reputation-service/
│   │   ├── karma-calculation.test.ts
│   │   ├── decay-algorithm.test.ts
│   │   └── trust-score.test.ts
│   ├── notification-service/
│   │   ├── template-rendering.test.ts
│   │   ├── notification-filtering.test.ts
│   │   └── preference-handling.test.ts
│   ├── messaging-service/
│   │   ├── conversation-creation.test.ts
│   │   ├── message-validation.test.ts
│   │   └── websocket-events.test.ts
│   ├── feed-service/
│   │   ├── feed-algorithm.test.ts
│   │   ├── priority-sorting.test.ts
│   │   └── deduplication.test.ts
│   └── cleanup-service/
│       ├── ttl-calculation.test.ts
│       ├── soft-delete.test.ts
│       └── job-scheduling.test.ts
├── shared/
│   ├── middleware/
│   │   ├── auth-middleware.test.ts
│   │   ├── tenant-middleware.test.ts
│   │   └── rate-limiter.test.ts
│   └── utils/
│       ├── logger.test.ts
│       └── validators.test.ts
└── frontend/
    ├── components/
    │   ├── InlineChat.test.tsx
    │   ├── QuickCreate.test.tsx
    │   └── Layout.test.tsx
    └── hooks/
        ├── useMessaging.test.ts
        ├── useAuth.test.ts
        └── useCommunities.test.ts
```

**What to Test**:
- ✅ Pure functions with all edge cases
- ✅ Business logic (karma calc, decay, TTL)
- ✅ Validation functions
- ✅ Utility functions
- ✅ Data transformations
- ✅ Error handling

**Example**:
```typescript
describe('calculateKarma', () => {
  it('should award 15 points for first help', () => {
    expect(calculateKarma(0, 'help_given')).toBe(15)
  })

  it('should award 10 points for milestone at 10 exchanges', () => {
    expect(calculateKarma(9, 'milestone')).toBe(10)
  })

  it('should handle negative karma correctly', () => {
    expect(calculateKarma(-5, 'help_received')).toBe(0) // Minimum 0
  })
})
```

---

### 2. Integration Tests (`tests/integration/`)
**Purpose**: Test service APIs, database interactions, and inter-service communication

**Coverage Target**: ≥ 90%

**Current Tests** (7 files):
- ✅ `auth.test.ts` - Multi-community JWT, registration, login
- ✅ `tenant-isolation.test.ts` - RLS policies, data isolation
- ✅ `rls-policies.test.ts` - All 19 RLS policy validations
- ✅ `multi-community-flows.test.ts` - Cross-community workflows
- ✅ `ephemeral-data.test.ts` - TTL, expiration, cleanup
- ✅ `reputation-decay.test.ts` - Decay algorithm, activity tracking
- ✅ `complete-workflow.test.ts` - End-to-end user journeys

**Missing Integration Tests**:
- ⏳ Messaging service WebSocket integration
- ⏳ Notification event subscribers
- ⏳ Feed service algorithm testing
- ⏳ Cleanup service job execution
- ⏳ Multi-community request posting
- ⏳ Match acceptance/rejection flows
- ⏳ Real-time SSE notification streams

**Structure for New Tests**:
```typescript
describe('Messaging Service Integration', () => {
  let authToken: string
  let matchId: string

  beforeAll(async () => {
    // Setup test data
    authToken = await createTestUser()
    matchId = await createTestMatch()
  })

  it('should create conversation when match is created', async () => {
    const res = await request(MESSAGING_API)
      .get(`/match/${matchId}`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.conversation_id).toBeDefined()
  })

  it('should enforce participant access control', async () => {
    const otherUserToken = await createTestUser()

    const res = await request(MESSAGING_API)
      .get(`/match/${matchId}`)
      .set('Authorization', `Bearer ${otherUserToken}`)

    expect(res.status).toBe(403)
  })

  afterAll(async () => {
    await cleanupTestData()
  })
})
```

---

### 3. E2E Tests (`tests/e2e/`)
**Purpose**: Test complete user flows through the UI

**Coverage Target**: ≥ 85%

**Current Tests** (9 files):
- ✅ `01-auth.spec.ts` - Registration, login, logout
- ✅ `02-communities.spec.ts` - Community CRUD, joining
- ✅ `03-requests.spec.ts` - Request posting, offering
- ✅ `04-messaging.spec.ts` - Messaging (needs update for recent fixes)
- ✅ `05-notifications.spec.ts` - Notification delivery
- ✅ `06-karma-system.spec.ts` - Reputation tracking
- ✅ `07-advanced-matching.spec.ts` - Match workflows
- ✅ `08-edge-cases.spec.ts` - Error scenarios
- ✅ `09-dashboard-redesign.spec.ts` - New dashboard UI

**Missing E2E Tests**:
- ⏳ Multi-community request posting flow
- ⏳ Accept/Decline/Mark Complete workflow
- ⏳ Inline chat with WebSocket connection
- ⏳ Real-time typing indicators
- ⏳ Feed priority sorting verification
- ⏳ Duplicate request deduplication
- ⏳ Mobile app flows (React Native)

**Update Needed**:
```typescript
// tests/e2e/tests/04-messaging.spec.ts
// Need to update for:
// - Match-based messaging endpoints (/match/:id instead of /messages/match/:id)
// - Inline chat component instead of separate messages page
// - WebSocket connection and typing indicators
```

---

## 📋 Test Plan by Service

### Auth Service (Port 3001)
**Priority**: HIGH
**Current Coverage**: ~70% (estimated)
**Target**: 95%

**Unit Tests Needed**:
- [ ] Password hashing and comparison
- [ ] JWT token generation and validation
- [ ] Multi-community JWT refresh logic
- [ ] Email validation
- [ ] Password strength validation

**Integration Tests Needed**:
- [x] User registration
- [x] User login with JWT
- [x] Multi-community JWT generation
- [x] Token refresh endpoint
- [ ] Password reset flow
- [ ] Email verification

---

### Community Service (Port 3002)
**Priority**: HIGH
**Current Coverage**: ~65% (estimated)
**Target**: 90%

**Unit Tests Needed**:
- [ ] Dunbar number enforcement (max 150 members)
- [ ] Norm voting calculation
- [ ] Norm approval threshold (66%)
- [ ] Member role validation

**Integration Tests Needed**:
- [x] Community creation
- [x] Member joining
- [x] Norm proposal and voting
- [ ] Private community join requests
- [ ] Member removal
- [ ] Community deletion (soft delete)

---

### Request Service (Port 3003)
**Priority**: CRITICAL
**Current Coverage**: ~60% (estimated)
**Target**: 95%

**Unit Tests Needed**:
- [ ] Multi-community request validation
- [ ] Junction table operations
- [ ] Match status transitions
- [ ] Auto-rejection logic when one offer accepted
- [ ] Request reopening when all offers declined

**Integration Tests Needed**:
- [x] Request posting to single community
- [ ] Request posting to multiple communities
- [ ] Request posting to "All My Communities"
- [x] Offering to help (match creation)
- [ ] Accept offer (status: matched)
- [ ] Decline offer (auto-reopen if last)
- [ ] Mark complete (award karma)
- [ ] Request expiration (60 days TTL)

---

### Messaging Service (Port 3006)
**Priority**: HIGH
**Current Coverage**: ~50% (estimated)
**Target**: 90%

**Unit Tests Needed**:
- [ ] Conversation participant validation
- [ ] Message content sanitization
- [ ] WebSocket event handling
- [ ] Typing indicator throttling

**Integration Tests Needed**:
- [ ] GET /match/:matchId (fetch conversation)
- [ ] POST /match/:matchId/messages (send message)
- [ ] Conversation creation with both participants
- [ ] WebSocket connection with JWT auth
- [ ] Real-time message delivery
- [ ] Typing indicators via WebSocket
- [ ] Conversation access control (403 for non-participants)

---

### Reputation Service (Port 3004)
**Priority**: MEDIUM
**Current Coverage**: ~75% (estimated)
**Target**: 90%

**Unit Tests Needed**:
- [ ] Karma calculation with bonuses
- [ ] Trust score formula (0-100 scale)
- [ ] Decay algorithm (6-month half-life)
- [ ] Activity tracking reset

**Integration Tests Needed**:
- [x] Karma awarding on match completion
- [x] Reputation decay job
- [x] Activity tracking
- [ ] Leaderboard generation
- [ ] Badge unlocking
- [ ] Trust score API

---

### Notification Service (Port 3005)
**Priority**: MEDIUM
**Current Coverage**: ~55% (estimated)
**Target**: 85%

**Unit Tests Needed**:
- [ ] Template rendering for 12 notification types
- [ ] Notification filtering by preferences
- [ ] SSE event formatting

**Integration Tests Needed**:
- [x] Event-driven notification creation
- [ ] SSE stream with query param auth
- [ ] Notification preferences CRUD
- [ ] Mark read/unread
- [ ] Notification expiration (90 days TTL)

---

### Feed Service (Port 3007)
**Priority**: MEDIUM
**Current Coverage**: ~40% (estimated)
**Target**: 85%

**Unit Tests Needed**:
- [ ] Feed priority algorithm (5 priority levels)
- [ ] Request deduplication logic
- [ ] Adaptive feed ranking
- [ ] Time-based relevance scoring

**Integration Tests Needed**:
- [ ] GET /feed (user-specific feed)
- [ ] Priority ordering verification
- [ ] Cross-community request deduplication
- [ ] Feed preferences
- [ ] Dismiss feed items

---

### Cleanup Service (Port 3008)
**Priority**: MEDIUM
**Current Coverage**: ~70% (estimated)
**Target**: 90%

**Unit Tests Needed**:
- [ ] TTL calculation for different entity types
- [ ] Soft delete vs hard delete logic
- [ ] Grace period enforcement (7 days)

**Integration Tests Needed**:
- [x] Expire old requests job
- [x] Soft delete expired data job
- [x] Hard delete old soft-deleted data job
- [x] Decay reputation job
- [ ] Cleanup old notifications job
- [ ] Job scheduling and error handling

---

## 🎯 Priority Action Plan

### Phase 1: Critical Path (Week 1)
**Goal**: 80% coverage on critical services

1. **Request Service** (CRITICAL)
   - [ ] Add unit tests for multi-community logic
   - [ ] Add integration tests for accept/decline/complete
   - [ ] Test junction table operations
   - **Target**: 90% coverage

2. **Messaging Service** (HIGH)
   - [ ] Add integration tests for new endpoints
   - [ ] Add WebSocket connection tests
   - [ ] Test conversation participant enforcement
   - **Target**: 85% coverage

3. **Update E2E Tests** (HIGH)
   - [ ] Fix `04-messaging.spec.ts` for new paths
   - [ ] Add multi-community request posting tests
   - [ ] Add accept/decline workflow tests
   - **Target**: All tests passing

---

### Phase 2: Core Services (Week 2)
**Goal**: 85% coverage on auth, community, reputation

4. **Auth Service**
   - [ ] Add password validation unit tests
   - [ ] Add JWT refresh integration tests
   - **Target**: 95% coverage

5. **Community Service**
   - [ ] Add Dunbar limit unit tests
   - [ ] Add norm voting integration tests
   - **Target**: 90% coverage

6. **Reputation Service**
   - [ ] Add decay algorithm unit tests
   - [ ] Add leaderboard integration tests
   - **Target**: 90% coverage

---

### Phase 3: Supporting Services (Week 3)
**Goal**: 85% coverage on feed, notifications, cleanup

7. **Feed Service**
   - [ ] Add priority algorithm unit tests
   - [ ] Add deduplication integration tests
   - **Target**: 85% coverage

8. **Notification Service**
   - [ ] Add template rendering unit tests
   - [ ] Add SSE stream integration tests
   - **Target**: 85% coverage

9. **Cleanup Service**
   - [ ] Add TTL calculation unit tests
   - [ ] Add job error handling tests
   - **Target**: 90% coverage

---

### Phase 4: Frontend & Mobile (Week 4)
**Goal**: 90% coverage on frontend components

10. **Frontend React Components**
    - [ ] Add InlineChat component tests
    - [ ] Add QuickCreate component tests
    - [ ] Add dashboard feed tests
    - **Target**: 90% coverage

11. **React Hooks**
    - [ ] Add useMessaging hook tests
    - [ ] Add useAuth hook tests
    - [ ] Add custom hooks tests
    - **Target**: 95% coverage

12. **Mobile App (React Native)**
    - [ ] Port dashboard changes
    - [ ] Port inline messaging
    - [ ] Add E2E tests with Detox
    - **Target**: 85% coverage

---

## 🔧 Test Infrastructure

### Tools & Libraries
- **Unit Tests**: Jest + ts-jest
- **Integration Tests**: Jest + Supertest + pg
- **E2E Tests**: Playwright (web) + Detox (mobile)
- **Coverage**: Istanbul (nyc)
- **Mocking**: jest.mock()
- **API Testing**: Supertest
- **DB Testing**: PostgreSQL test database

### CI/CD Integration
```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run test:unit
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
      redis:
        image: redis:7
    steps:
      - uses: actions/checkout@v3
      - run: docker-compose up -d
      - run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npx playwright install
      - run: npm run test:e2e
```

### Coverage Reporting
- **Local**: HTML reports in `tests/coverage/`
- **CI**: Codecov integration
- **Badges**: Display in README.md
- **Threshold**: Fail CI if coverage < 80%

---

## 📊 Coverage Tracking

### Weekly Metrics (Update Every Monday)
```markdown
| Service            | Line % | Branch % | Function % | Status |
|--------------------|--------|----------|------------|--------|
| Auth Service       | TBD    | TBD      | TBD        | 🟡     |
| Community Service  | TBD    | TBD      | TBD        | 🟡     |
| Request Service    | TBD    | TBD      | TBD        | 🔴     |
| Reputation Service | TBD    | TBD      | TBD        | 🟡     |
| Notification Svc   | TBD    | TBD      | TBD        | 🟡     |
| Messaging Service  | TBD    | TBD      | TBD        | 🔴     |
| Feed Service       | TBD    | TBD      | TBD        | 🟡     |
| Cleanup Service    | TBD    | TBD      | TBD        | 🟢     |
| Frontend           | TBD    | TBD      | TBD        | 🔴     |
| **Overall**        | **TBD**| **TBD**  | **TBD**    | **🟡** |
```

Legend:
- 🟢 ≥ 90% coverage (target met)
- 🟡 70-89% coverage (in progress)
- 🔴 < 70% coverage (needs work)

---

## 🚀 Commands

### Run All Tests
```bash
cd tests
npm run test                 # All tests
npm run test:unit            # Unit tests only
npm run test:integration     # Integration tests
npm run test:coverage        # With coverage report
npm run test:watch           # Watch mode
```

### Run Specific Service Tests
```bash
npm run test:auth            # Auth service tests
npm run test:tenant          # Tenant isolation tests
npm run test:rls             # RLS policy tests
npm run test:flows           # Multi-community flows
npm run test:ephemeral       # Ephemeral data tests
npm run test:decay           # Reputation decay tests
```

### E2E Tests
```bash
cd tests/e2e
npx playwright test          # All E2E tests
npx playwright test --ui     # Interactive UI
npx playwright test --headed # See browser
npx playwright test --debug  # Debug mode
```

### Coverage Reports
```bash
cd tests
npm run test:coverage        # Generate coverage
open coverage/index.html     # View HTML report (Mac)
start coverage/index.html    # View HTML report (Windows)
```

---

## 📝 Test Writing Guidelines

### 1. Test Naming Convention
```typescript
// ✅ GOOD
describe('calculateKarma', () => {
  it('should award 15 points for first help', () => {})
  it('should throw error when karma is negative', () => {})
})

// ❌ BAD
describe('karma', () => {
  it('test1', () => {})
  it('calculates correctly', () => {})
})
```

### 2. AAA Pattern (Arrange-Act-Assert)
```typescript
it('should create conversation with both participants', async () => {
  // Arrange
  const matchId = await createTestMatch()
  const token = await getAuthToken()

  // Act
  const res = await request(API)
    .get(`/match/${matchId}`)
    .set('Authorization', `Bearer ${token}`)

  // Assert
  expect(res.status).toBe(200)
  expect(res.body.data.conversation_id).toBeDefined()
})
```

### 3. Test Isolation
```typescript
// ✅ GOOD - Each test is independent
beforeEach(async () => {
  await cleanDatabase()
  testUser = await createTestUser()
})

afterEach(async () => {
  await cleanupTestData()
})

// ❌ BAD - Tests depend on each other
let userId: string

it('creates user', () => {
  userId = createUser() // Don't do this!
})

it('updates user', () => {
  updateUser(userId) // Depends on previous test
})
```

### 4. Mock External Dependencies
```typescript
// ✅ GOOD - Mock Redis queue
jest.mock('../queue/client', () => ({
  publishEvent: jest.fn()
}))

it('should publish match_created event', async () => {
  await createMatch(matchData)
  expect(publishEvent).toHaveBeenCalledWith('match_created', expect.any(Object))
})
```

### 5. Edge Cases & Error Scenarios
```typescript
describe('createRequest', () => {
  it('should create request with valid data', () => {})
  it('should reject request without description', () => {})
  it('should reject request with empty community list', () => {})
  it('should enforce max 1000 character description', () => {})
  it('should handle database connection errors', () => {})
  it('should return 401 if not authenticated', () => {})
})
```

---

## 🎓 Resources

### Documentation
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest API](https://github.com/visionmedia/supertest)
- [Playwright Docs](https://playwright.dev/)
- [Testing Best Practices](https://testingjavascript.com/)

### Internal Docs
- [CLAUDE.md](../CLAUDE.md) - Project overview
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Development guide
- [PROJECT_STATUS.md](../docs/PROJECT_STATUS.md) - Current status

---

**Next Update**: 2025-02-05
**Owner**: Development Team
**Status**: 🟡 In Progress - Phase 1
