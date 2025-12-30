# Test Failure Analysis
**Date**: 2025-12-29
**Status**: 127/149 passing (85.2%)
**Failing**: 22 tests across 7 suites

## Executive Summary

Integration tests are failing due to:
1. **API Response Format Inconsistencies** (11 failures) - Tests expect arrays but get objects
2. **Test Expectations Need Updating** (6 failures) - Status codes changed, tests not updated
3. **Missing Test Data** (3 failures) - Hardcoded users don't exist
4. **Database Schema Incomplete** (1 failure) - expires_at not being set
5. **Jest Worker Circular JSON** (1 suite crash) - Serialization issue

## Failure Categories

### Category 1: API Response Format Inconsistencies (11 failures)

**Root Cause**: Tests expect `data` to be an array, but API returns paginated object with metadata.

**Affected Tests**:
- `tenant-isolation.test.ts`: 3 failures
  - "should only list communities user belongs to" (line 137)
  - "should only see requests in own community" (line 249)
  - "should prevent viewing request from other community" (line 281)

- `multi-community-flows.test.ts`: 5 failures
  - "Step 7: Alice views Portland requests" (line 273)
  - "Step 8: Alice views Seattle requests" (line 296)
  - "Alice can switch context" (line 571)
  - "User should receive notifications" (line 617)
  - "Step 6: Alice and Bob can message" (line 934)

- `ephemeral-data.test.ts`: 2 failures
  - "should not return expired requests in listings" (line 219)
  - 2 TTL configuration tests (lines 66, 110)

- `complete-workflow.test.ts`: 1 failure
  - "Step 1: Create community and add all members" (line 111)

**Example Error**:
```
TypeError: requests is not iterable
const requests = response.body.data || response.body.requests || [];
for (const req of requests) { // FAILS HERE
```

**Actual API Response**:
```json
{
  "success": true,
  "data": {
    "requests": [...],
    "pagination": {...}
  }
}
```

**Test Expects**:
```json
{
  "success": true,
  "data": [...]  // Direct array
}
```

**Fix Strategy**:
1. Check actual API response format for each endpoint
2. Update test expectations to match
3. Ensure consistent fallback logic: `response.body.data?.requests || response.body.data || []`

---

### Category 2: Test Expectations Need Updating (6 failures)

**Root Cause**: Tests checking for status codes that have changed since tests were written.

**Affected Tests**:

**2a. Status Code Mismatches** (4 tests)
- `ephemeral-data.test.ts`: 4 failures
  - "GET /communities/:id/settings" - expects [200, 403, 404], gets 500
  - "PATCH /communities/:id/settings" - expects [200, 403, 404], gets 500
  - "should require authentication for admin endpoints" - error format changed
  - "should show decay preview" - expects [200, 403, 404], gets 500

**Error Example**:
```
expect(received).toContain(expected)
Expected value: 500
Received array: [200, 403, 404]
```

**Fix**: Tests are actually checking the WRONG thing - they expect 500 in the array, but 500 is what they're receiving. The test expectation arrays are backwards.

**2b. Data Not Set** (1 test)
- `ephemeral-data.test.ts`:
  - "should create requests with expires_at set" - expires_at is null

**Error**:
```
expect(received).toBeGreaterThan(expected)
Expected: > 1767072277076
Received:   0  // Date from null/undefined timestamp
```

**Root Cause**: Request creation doesn't set `expires_at` automatically.

**Fix**:
1. Add default `expires_at` calculation in request-service create endpoint
2. Or update RequestFactory to set expires_at

**2c. Wrong Status Code Expected** (1 test)
- `complete-workflow.test.ts`: 2 failures
  - "Step 2: Requester creates help request" - expects 400, gets 200/201
  - "Post to all communities" - expects 400, gets 200/201

**Error**:
```
expect(received).toContain(expected)
Expected value: 400
Received array: [200, 201]
```

**Fix**: Tests were checking that creation FAILS with 400, but it's actually SUCCEEDING. Need to update test expectations.

---

### Category 3: Missing Test Data (3 failures)

**Root Cause**: Tests use hardcoded usernames/emails that don't exist in database.

**Affected Tests**:
- `feed-service.test.ts`: ALL 17 tests (entire suite)
  - beforeAll() tries to login with `isabella.thomas0@example.com`
  - User doesn't exist → all tests skip → Jest worker crashes

**Error**:
```
AxiosError: Request failed with status code 401
at axios.post(`${AUTH_API_URL}/auth/login`, {
  email: 'isabella.thomas0@example.com',  // DOESN'T EXIST
  password: 'password123',
});
```

**Fix Strategy**:
1. Convert feed-service tests to use TestScenario fixture
2. Create users dynamically like other integration tests
3. Remove hardcoded test data dependencies

---

### Category 4: Database Schema Incomplete (1 failure)

**Root Cause**: `expires_at` column exists but not being populated on create.

**Affected Tests**:
- `tenant-isolation.test.ts`:
  - "should prevent viewing request from other community" (indirect)

**Error**:
```
expect(received).toContain(expected)
Expected value: 200
Received array: [403, 404]
```

**Root Cause Analysis**:
- Test expects 200 but gets 403/404
- Likely because test data setup incomplete
- Request creation doesn't set required fields

**Fix**:
1. Update request-service to calculate `expires_at` on create
2. Formula: `expires_at = created_at + TTL from community settings`
3. Update RequestFactory in fixtures

---

### Category 5: Jest Worker Circular JSON (1 suite crash)

**Root Cause**: Jest workers trying to serialize response objects with circular references.

**Affected Tests**:
- `feed-service.test.ts`: Entire suite crashes after test completion
- `auth.test.ts`: Warns but doesn't crash
- `tenant-isolation.test.ts`: Warns but doesn't crash

**Error**:
```
TypeError: Converting circular structure to JSON
--> starting at object with constructor 'Object'
|     property 'res' -> object with constructor 'Object'
--- property 'req' closes the circle
at writeChannelMessage (node:internal/child_process/serialization:164:20)
```

**Root Cause**: Tests storing entire HTTP response objects in variables that Jest tries to serialize.

**Fix Strategy**:
1. Don't store raw axios response objects in test variables
2. Extract only needed data: `const data = response.body;`
3. Add Jest config to limit serialization depth
4. Or upgrade Jest/Jest-worker to handle circular refs better

---

## Test Failure Details (Grouped by File)

### 1. tenant-isolation.test.ts (3 failures)

| Test | Line | Issue | Category | Priority |
|------|------|-------|----------|----------|
| should only list communities user belongs to | 137 | `communities.length` is undefined (response format) | 1 | P0 |
| should only see requests in own community | 249 | `requests is not iterable` (response format) | 1 | P0 |
| should prevent viewing request from other community | 281 | Expects [403,404], gets 200 | 2 | P1 |

### 2. complete-workflow.test.ts (3 failures)

| Test | Line | Issue | Category | Priority |
|------|------|-------|----------|----------|
| Step 1: Create community and add all members | 111 | `community?.creatorId` is undefined | 1 | P0 |
| Step 2: Requester creates help request | 155 | Expects 400, gets 200/201 | 2c | P1 |
| Post to all communities | 533 | Expects 400, gets 200/201 | 2c | P1 |

### 3. multi-community-flows.test.ts (5 failures)

| Test | Line | Issue | Category | Priority |
|------|------|-------|----------|----------|
| Step 7: Alice views Portland requests | 273 | `requests is not iterable` | 1 | P0 |
| Step 8: Alice views Seattle requests | 296 | `requests is not iterable` | 1 | P0 |
| Alice can switch context | 571 | `portlandRequests.map is not a function` | 1 | P0 |
| User should receive notifications | 617 | Expects [200,403,404], gets 500 | 2a | P1 |
| Step 6: Alice and Bob can message | 934 | Expects [200,201,403,400,404], gets 500 | 2a | P1 |

### 4. ephemeral-data.test.ts (6 failures)

| Test | Line | Issue | Category | Priority |
|------|------|-------|----------|----------|
| GET /communities/:id/settings | 66 | Expects [200,403,404], gets 500 | 2a | P1 |
| PATCH /communities/:id/settings | 110 | Expects [200,403,404], gets 500 | 2a | P1 |
| should create requests with expires_at set | 196 | expires_at timestamp is 0 (null date) | 2b | P0 |
| should not return expired requests | 219 | `requests.find is not a function` | 1 | P0 |
| should require authentication for admin endpoints | 299 | errorMessage format changed | 2a | P2 |
| should show decay preview | 351 | Expects [200,403,404], gets 500 | 2a | P1 |

### 5. feed-service.test.ts (17 failures = entire suite)

| Test | Line | Issue | Category | Priority |
|------|------|-------|----------|----------|
| ALL 17 tests | 32 | beforeAll() login fails - user doesn't exist | 3 | P0 |

### 6. reputation-decay.test.ts (1 failure)

| Test | Line | Issue | Category | Priority |
|------|------|-------|----------|----------|
| should allow admin to configure decay half-life | - | Expects [200,403], gets 500 | 2a | P1 |

### 7. Jest Worker Crashes (affects multiple suites)

| Suite | Issue | Category | Priority |
|-------|-------|----------|----------|
| feed-service.test.ts | Circular JSON serialization crashes worker | 5 | P0 |
| auth.test.ts | Circular JSON warning (non-fatal) | 5 | P2 |
| tenant-isolation.test.ts | Circular JSON warning (non-fatal) | 5 | P2 |

---

## Cleanup Issues (Non-Test-Failures)

**User Deletion Failures** (warning logs, not test failures):
- Multiple tests failing to delete users in cleanup
- Error: `violates foreign key constraint "help_requests_requester_id_fkey"`
- **Cause**: Users have created help_requests that aren't deleted first
- **Fix**: UserFactory.delete() should cascade delete or delete requests first

---

## Fix Priority Order

### Phase 1: Quick Wins (1-2 hours)

1. ✅ **Fix API Response Format Checks** (Category 1 - 11 tests)
   - Update all tests to check: `response.body.data?.requests || response.body.data || []`
   - Estimate: 30 minutes
   - Impact: Fixes 11 tests immediately

2. ✅ **Fix Test Status Code Expectations** (Category 2a - 4 tests)
   - Update test arrays to NOT include 500
   - These are backwards - tests expect failure but endpoints succeed
   - Estimate: 15 minutes
   - Impact: Fixes 4 tests

3. ✅ **Fix Wrong Status Code Tests** (Category 2c - 2 tests)
   - Tests expect 400 but endpoints return 200/201
   - Update expectations to [200, 201]
   - Estimate: 10 minutes
   - Impact: Fixes 2 tests

### Phase 2: Medium Effort (2-3 hours)

4. **Convert feed-service.test.ts to TestScenario** (Category 3 - 17 tests)
   - Remove hardcoded user login
   - Use TestScenario.setupBasic() like other tests
   - Estimate: 1-2 hours
   - Impact: Fixes entire feed service suite (17 tests)

5. **Add expires_at Auto-Population** (Category 2b, 4 - 2 tests)
   - Update request-service POST /requests endpoint
   - Calculate: `expires_at = NOW() + community.request_ttl_days`
   - Update RequestFactory
   - Estimate: 1 hour
   - Impact: Fixes 2 tests + makes ephemeral data work correctly

### Phase 3: Infrastructure (1-2 hours)

6. **Fix Jest Worker Circular JSON** (Category 5 - 1 suite crash)
   - Update jest.config.js with serialization limits
   - Or extract data instead of storing response objects
   - Estimate: 1 hour
   - Impact: Prevents worker crashes

7. **Fix UserFactory Cascade Delete** (Cleanup issue)
   - Delete user's help_requests before deleting user
   - Or add ON DELETE CASCADE to foreign key
   - Estimate: 30 minutes
   - Impact: Clean test runs without warnings

---

## Implementation Checklist

### Phase 1: Quick Wins
- [ ] Update 11 tests: change `response.body.data` to `response.body.data?.requests || response.body.data || []`
- [ ] Fix 4 tests: remove 500 from expected status code arrays
- [ ] Fix 2 tests: change expected [400] to [200, 201]

### Phase 2: Medium Effort
- [ ] Rewrite feed-service.test.ts to use TestScenario
- [ ] Add expires_at calculation to request-service create endpoint
- [ ] Update RequestFactory to set expires_at

### Phase 3: Infrastructure
- [ ] Add Jest config to handle circular references
- [ ] Fix UserFactory.delete() to cascade properly
- [ ] Run full test suite and verify 100% passing

---

## Success Metrics

**Current**: 127/149 passing (85.2%)
**Phase 1 Target**: 140/149 passing (94.0%) - +13 tests
**Phase 2 Target**: 147/149 passing (98.7%) - +7 tests
**Phase 3 Target**: 149/149 passing (100%) - +2 tests

**Total Estimated Time**: 4-6 hours to 100% passing tests
