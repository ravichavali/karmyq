# Dashboard Redesign Automated Tests

## Quick Start

### Run Tests (Windows)
```bash
cd tests/e2e
run-dashboard-tests.bat
```

### Run Tests (Mac/Linux)
```bash
cd tests/e2e
chmod +x run-dashboard-tests.sh
./run-dashboard-tests.sh
```

---

## What These Tests Cover

### ✅ Issue #1: No Duplicate Posts
**Test:** `Should NOT show duplicate posts from multi-community requests`

**What it tests:**
- Alice creates a request to ALL communities
- Dashboard should show the request only ONCE, not multiple times
- Uses deduplication logic based on `description + requester_id + timestamp`

**Expected:** Count of posts with same text = 1

---

### ✅ Issue #2: Offers Appear in Feed
**Test:** `After offering to help, post SHOULD appear in feed as "YOUR OFFER"`

**What it tests:**
- Alice creates a request
- Bob clicks "💬 Offer to Help"
- Bob's dashboard should show the post with:
  - Blue background (`bg-blue-50`)
  - "YOUR OFFER" badge
  - Status: "⏳ Waiting for Response"

**Expected:** Bob sees blue post with "YOUR OFFER" badge

---

### ✅ Issue #3: No Redirect After Offering
**Test:** `Should stay on dashboard after clicking "Offer to Help" (no redirect)`

**What it tests:**
- Bob clicks "Offer to Help" on a community request
- After the action completes, Bob should still be on `/dashboard`
- NOT redirected to `/matches/:id` or any other page

**Expected:** URL contains `/dashboard`, not `/matches`

---

### ✅ Accept/Decline Workflow
**Test:** `Should show Accept/Decline buttons to requester`

**What it tests:**
- Alice creates request
- Bob offers to help
- Alice refreshes dashboard
- Alice should see Bob's offer with "Accept" and "Decline" buttons

**Expected:** Both buttons visible

---

### ✅ Accept Flow & Mark Complete
**Test:** `Accept flow: Should show "✓ Accepted" badge and "Mark Complete" button`

**What it tests:**
- Alice clicks "Accept" on Bob's offer
- Dashboard should show:
  - "✓ Accepted" badge (green)
  - "Mark Complete" button (blue)

**Expected:** Both badge and button visible after accepting

---

### ✅ Inline Chat
**Test:** `Inline chat: Should expand and send messages`

**What it tests:**
- Alice expands chat by clicking "Chat with Bob"
- Chat input appears
- Alice types and sends a message
- Message appears in the chat thread

**Expected:** Message visible after sending

---

### ✅ Priority Ordering
**Test:** `Priority ordering: Matched requests should appear before community requests`

**What it tests:**
- Dashboard posts are ordered by priority
- Matched requests (amber) and accepted offers (blue) appear first
- Community requests (white) appear later

**Expected:** First post has colored background (amber or blue)

---

### ✅ Visibility Rules
**Test:** `Visibility rule: Responder should only see their own thread`

**What it tests:**
- Bob views his offer (blue post)
- Header shows "Your Conversation" (singular, not "Responses")
- Bob only sees ONE comment (his own match)
- Other offers are hidden from Bob

**Expected:** Comment count ≤ 1 for responders

---

## Test Output Example

```
Running 9 tests using 2 workers

  ✓ [chromium] › 09-dashboard-redesign.spec.ts:95:3 › Dashboard Redesign - Critical Flows › Issue #1: Should NOT show duplicate posts (15s)
  ✓ [chromium] › 09-dashboard-redesign.spec.ts:120:3 › Dashboard Redesign - Critical Flows › Issue #2: After offering to help, post SHOULD appear (18s)
  ✓ [chromium] › 09-dashboard-redesign.spec.ts:150:3 › Dashboard Redesign - Critical Flows › Issue #3: Should stay on dashboard (12s)
  ✓ [chromium] › 09-dashboard-redesign.spec.ts:175:3 › Dashboard Redesign - Critical Flows › Should show Accept/Decline buttons (20s)
  ✓ [chromium] › 09-dashboard-redesign.spec.ts:205:3 › Dashboard Redesign - Critical Flows › Accept flow: Should show "✓ Accepted" (22s)
  ✓ [chromium] › 09-dashboard-redesign.spec.ts:240:3 › Dashboard Redesign - Critical Flows › Inline chat: Should expand and send messages (18s)
  ✓ [chromium] › 09-dashboard-redesign.spec.ts:275:3 › Dashboard Redesign - Critical Flows › Priority ordering (8s)
  ✓ [chromium] › 09-dashboard-redesign.spec.ts:295:3 › Dashboard Redesign - Critical Flows › Visibility rule (10s)
  ✓ [chromium] › 09-dashboard-redesign.spec.ts:320:3 › Dashboard UI Tests › Should display dashboard (8s)

  9 passed (2m)
```

---

## Manual Testing (If Automated Tests Fail)

### Test #1: Duplicate Posts
1. Login as Alice
2. Create community "Test Community A"
3. Create community "Test Community B"
4. Go to Dashboard
5. Create request with "All My Communities" selected
6. Type: "Need help with gardening"
7. Click "Post"
8. **CHECK:** Count how many times "Need help with gardening" appears
9. **EXPECTED:** Should appear only ONCE

### Test #2: Offer Appears
1. Login as Bob
2. Go to Dashboard
3. Find a white post with "💬 Offer to Help" button
4. Click "💬 Offer to Help"
5. Wait for page to refresh
6. **CHECK:** Find the same post
7. **EXPECTED:** Post should now be blue with "YOUR OFFER" badge

### Test #3: No Redirect
1. Login as Bob
2. Go to Dashboard
3. Click "💬 Offer to Help" on any request
4. **CHECK:** Look at the URL in browser
5. **EXPECTED:** URL should still be `http://localhost:3000/dashboard`

---

## Troubleshooting

### Tests Fail with "Services not running"
**Solution:**
```bash
cd infrastructure/docker
docker-compose up -d
```

### Tests timeout waiting for elements
**Possible causes:**
- Frontend not running on port 3000
- Backend services not responding
- Database not initialized

**Solution:**
```bash
# Check all services
docker-compose ps

# Check frontend logs
docker logs karmyq-frontend

# Restart if needed
docker-compose restart
```

### Browser not opening
**Solution:**
```bash
# Install Playwright browsers
cd tests/e2e
npx playwright install
```

---

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: docker-compose up -d
      - run: cd tests/e2e && npm install
      - run: npx playwright install --with-deps
      - run: npx playwright test 09-dashboard-redesign.spec.ts
```

---

## Test Coverage Summary

| Issue | Test Name | Status |
|-------|-----------|--------|
| Duplicate posts | Should NOT show duplicate posts | ✅ Automated |
| Offers disappear | After offering, should appear in feed | ✅ Automated |
| Wrong redirect | Should stay on dashboard | ✅ Automated |
| Accept/Decline | Should show buttons | ✅ Automated |
| Mark Complete | Should show after accepting | ✅ Automated |
| Inline Chat | Should expand and send | ✅ Automated |
| Priority Order | Should prioritize matched | ✅ Automated |
| Visibility | Responder sees only their thread | ✅ Automated |
| UI Loads | Dashboard displays properly | ✅ Automated |

**Total:** 9 automated tests covering all critical flows

---

## Next Steps

1. **Run tests after each code change**
2. **Add more edge cases** as bugs are discovered
3. **Integrate into CI/CD** for automatic testing on commits
4. **Monitor test reliability** - fix flaky tests immediately
