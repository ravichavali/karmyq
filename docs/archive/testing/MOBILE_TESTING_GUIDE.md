# Mobile Testing Guide

**Version**: 1.0.0
**Last Updated**: 2025-12-28
**Framework**: Maestro

---

## Overview

This guide covers testing the KarmyQ React Native mobile app using Maestro for E2E tests and Jest for unit tests.

---

## Quick Start

### 1. Install Maestro

```bash
# macOS/Linux
curl -Ls https://get.maestro.mobile.dev | bash

# Verify
maestro -v
```

### 2. Start Mobile App

```bash
cd apps/mobile
npm start

# Then press 'i' (iOS) or 'a' (Android)
```

### 3. Run Tests

```bash
# All E2E tests
npm run test:e2e

# Smoke tests only
npm run test:e2e:smoke

# Single test
npm run test:e2e:single .maestro/flows/02-login-flow.yaml
```

---

## Test Structure

```
apps/mobile/
└── .maestro/
    ├── config.yaml              # Global configuration
    ├── README.md                # Detailed testing docs
    └── flows/                   # Test files
        ├── 01-launch-app.yaml   # Smoke: App launches
        ├── 02-login-flow.yaml   # Smoke: User login
        ├── 03-view-feed.yaml    # Smoke: View feed
        ├── 04-view-communities.yaml
        ├── 05-view-help-requests.yaml
        ├── 06-view-profile.yaml
        └── 07-complete-login-flow.yaml  # E2E: Full flow
```

---

## Test Tags

Tests are organized by tags:

- **smoke**: Critical path tests (run on every commit)
- **auth**: Authentication flows
- **feed**: Feed functionality
- **requests**: Help requests
- **messages**: Messaging
- **e2e**: Full end-to-end workflows

**Usage**:
```bash
# Run smoke tests only
maestro test .maestro/flows/ --tag smoke

# Run auth tests
maestro test .maestro/flows/ --tag auth
```

---

## Test Coverage

### Current Coverage (v1.0.0)

| Feature | E2E Tests | Status |
|---------|-----------|--------|
| App Launch | ✅ | 01-launch-app.yaml |
| Login/Auth | ✅ | 02-login-flow.yaml |
| View Feed | ✅ | 03-view-feed.yaml |
| Communities | ✅ | 04-view-communities.yaml |
| Help Requests | ✅ | 05-view-help-requests.yaml |
| User Profile | ✅ | 06-view-profile.yaml |
| Complete Flow | ✅ | 07-complete-login-flow.yaml |
| Registration | ❌ | TODO |
| Create Request | ❌ | TODO |
| Messaging | ❌ | TODO |
| Push Notifications | ❌ | TODO |
| Offline Mode | ❌ | TODO |
| Camera/Photos | ❌ | TODO |
| Location Services | ❌ | TODO |

### Coverage Goals

- **Phase 1 (Current)**: 7 smoke tests covering critical paths
- **Phase 2 (Week 1)**: 15+ tests covering main features
- **Phase 3 (Week 2)**: 30+ tests with edge cases
- **Phase 4 (Week 3)**: 50+ tests with full coverage

---

## Writing Tests

### Basic Test Template

```yaml
# Test: [Descriptive Name]
# Tags: [tag1, tag2]
# Description: [What this test validates]
# Prerequisites: [Any required state, e.g., "User must be logged in"]

appId: com.karmyq.app
---
# Step 1: Setup
- launchApp

# Step 2: Action
- tapOn: "Button Text"

# Step 3: Assertion
- assertVisible: "Expected Result"

# Step 4: Screenshot (for documentation/debugging)
- takeScreenshot: test-name-step
```

### Best Practices

1. **Use Descriptive Names**: `login-with-valid-credentials`, not `test1`
2. **Tag Appropriately**: Use tags for organizing test suites
3. **Add Screenshots**: Take screenshots at key steps
4. **Wait for Elements**: Use `assertVisible` with `timeout` instead of `wait`
5. **Make Tests Independent**: Don't rely on previous test state
6. **Test Both Platforms**: Run on both iOS and Android

### Common Patterns

**Login Flow**:
```yaml
- tapOn: "Email"
- inputText: "${TEST_USER_EMAIL}"
- tapOn: "Password"
- inputText: "${TEST_USER_PASSWORD}"
- tapOn: "Sign In"
- assertVisible:
    text: "Feed|Home"
    timeout: 5000
```

**Navigation**:
```yaml
# Navigate to tab
- tapOn: "Communities"
- assertVisible: ".*"

# Go back
- back

# Swipe gestures
- swipe:
    direction: LEFT|RIGHT|UP|DOWN
```

**Scrolling to Find Element**:
```yaml
- scrollUntilVisible:
    element:
      text: "Element I'm Looking For"
```

**Conditional Steps**:
```yaml
# Skip if element not present
- tapOn: "Optional Button"
  optional: true

# Platform-specific
- runFlow:
    when:
      platform: iOS
    file: ios-only-test.yaml
```

---

## Test Data

### Environment Variables

Configured in `.maestro/config.yaml`:

```yaml
env:
  API_URL: http://localhost:3000
  TEST_USER_EMAIL: test@karmyq.com
  TEST_USER_PASSWORD: password123
  TEST_ADMIN_EMAIL: admin@karmyq.com
  TEST_ADMIN_PASSWORD: password123
```

**Usage in tests**:
```yaml
- inputText: "${TEST_USER_EMAIL}"
```

### Creating Test Users

**Option 1: Use Data Generator**:
```bash
cd scripts
npm run generate:realistic
```

This creates 2000+ users including predictable test users.

**Option 2: Manual SQL**:
```sql
INSERT INTO auth.users (id, name, email, password_hash, created_at)
VALUES (
  uuid_generate_v4(),
  'Test User',
  'test@karmyq.com',
  -- bcrypt hash for 'password123'
  '$2a$10$YourBcryptHashHere',
  NOW()
);
```

### Test Data Requirements

1. **Consistent**: Same data every test run
2. **Isolated**: Tests don't interfere with each other
3. **Realistic**: Matches production data structure
4. **Clean**: Reset between test runs

---

## Running Tests

### Local Development

```bash
# Start app first
cd apps/mobile
npm start
# Press 'i' for iOS or 'a' for Android

# In another terminal, run tests
cd apps/mobile

# All tests
npm run test:e2e

# Smoke tests only (fast)
npm run test:e2e:smoke

# Specific test
npm run test:e2e:single .maestro/flows/02-login-flow.yaml

# With specific tag
maestro test .maestro/flows/ --tag auth
```

### Continuous Mode (Watch for Changes)

```bash
maestro test --continuous .maestro/flows/
```

Useful during test development - re-runs on file changes.

### Recording Tests

```bash
# Record screen during test
maestro test --record .maestro/flows/02-login-flow.yaml
```

Creates a video in `~/.maestro/tests/[timestamp]/`.

---

## Debugging

### View Test Results

After running tests:
```bash
# Results saved in
~/.maestro/tests/[timestamp]/

# Contains:
# - Screenshots
# - Logs
# - Video (if recorded)
```

### Interactive Mode (Maestro Studio)

```bash
maestro studio
```

Opens interactive environment to:
- Paste test YAML
- Step through test manually
- Inspect elements
- Test selectors

### Common Issues

**"App not found"**:
- Ensure app is running on simulator/emulator
- Check `appId` matches app's bundle ID
- Verify Maestro can see the device: `maestro test`

**"Element not found"**:
```yaml
# Add timeout
- assertVisible:
    text: "Element"
    timeout: 10000  # Wait up to 10 seconds

# Or make optional
- tapOn: "Element"
  optional: true

# Check exact text (case-sensitive, whitespace matters)
```

**Tests fail intermittently**:
- Add appropriate waits/assertions
- Don't use fixed `wait` times
- Use `assertVisible` to wait for elements

**Different behavior on iOS vs Android**:
```yaml
# Platform-specific tests
- runFlow:
    when:
      platform: iOS
    file: ios-specific.yaml

- runFlow:
    when:
      platform: Android
    file: android-specific.yaml
```

---

## CI/CD Integration

### GitHub Actions

**File**: `.github/workflows/mobile-tests.yml`

```yaml
name: Mobile E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Maestro
        run: |
          curl -Ls https://get.maestro.mobile.dev | bash
          echo "$HOME/.maestro/bin" >> $GITHUB_PATH

      - name: Install dependencies
        run: |
          cd apps/mobile
          npm install

      - name: Start Metro bundler
        run: |
          cd apps/mobile
          npm start &
          sleep 30  # Wait for bundler to start

      - name: Build iOS app
        run: |
          cd apps/mobile
          expo prebuild --platform ios
          xcodebuild -workspace ios/karmyq.xcworkspace \
                     -scheme karmyq \
                     -destination 'platform=iOS Simulator,name=iPhone 15 Pro' \
                     -configuration Debug

      - name: Run Maestro smoke tests
        run: |
          cd apps/mobile
          maestro test .maestro/flows/ --tag smoke

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: maestro-test-results
          path: ~/.maestro/tests/

  test-android:
    runs-on: ubuntu-latest
    steps:
      # Similar to iOS but for Android
      - uses: actions/checkout@v3
      # ... (similar steps for Android)
```

### Test on Every PR

Add to `.github/workflows/pr-checks.yml`:

```yaml
- name: Run Mobile Smoke Tests
  run: |
    cd apps/mobile
    maestro test .maestro/flows/ --tag smoke
```

---

## Platform-Specific Testing

### iOS

**Simulator Setup**:
```bash
# List simulators
xcrun simctl list devices

# Boot simulator
xcrun simctl boot "iPhone 15 Pro"

# Or use Xcode GUI
```

**iOS-Specific Features to Test**:
- Swipe gestures (back navigation)
- 3D Touch / Haptic feedback
- Face ID / Touch ID (mock in simulator)
- iOS permissions dialogs
- Share sheet

### Android

**Emulator Setup**:
```bash
# List AVDs
emulator -list-avds

# Start emulator
emulator -avd Pixel_7_API_33

# Or use Android Studio GUI
```

**Android-Specific Features to Test**:
- Hardware back button
- Android permissions dialogs
- Share functionality
- Status bar behavior
- Bottom navigation vs tab behavior

### Device Matrix

**Recommended Test Devices**:

| Platform | Device | Screen Size | Notes |
|----------|--------|-------------|-------|
| iOS | iPhone SE | 375×667 | Small screen |
| iOS | iPhone 15 Pro | 393×852 | Standard |
| iOS | iPhone 15 Pro Max | 430×932 | Large screen |
| iOS | iPad Pro | 1024×1366 | Tablet |
| Android | Pixel 4a | 412×892 | Older device |
| Android | Pixel 7 | 412×915 | Modern |
| Android | Samsung Galaxy Tab | 800×1280 | Tablet |

---

## Permission Testing

### Location

```yaml
- tapOn: "Allow Location"
# iOS
- tapOn: "Allow While Using App"
# Android
- tapOn: "While using the app"
```

### Camera

```yaml
- tapOn: "Take Photo"
# iOS
- tapOn: "OK"
# Android
- tapOn: "Allow"
```

### Notifications

```yaml
# iOS
- tapOn: "Allow"
# Android
- tapOn: "Allow"
```

### Testing Denied Permissions

```yaml
# Deny permission
- tapOn: "Don't Allow"

# Verify app handles gracefully
- assertVisible: "Location access is required"
```

---

## Advanced Features Testing

### Offline Mode

```yaml
# Enable airplane mode
- setAirplaneMode: true

# Try action that requires network
- tapOn: "Create Request"

# Verify offline handling
- assertVisible: "You're offline|No connection"

# Re-enable network
- setAirplaneMode: false

# Verify sync
- assertVisible: "Synced|Connected"
```

### Push Notifications

```yaml
# Send test notification (via API or Firebase)
- sendPush:
    title: "New help request"
    body: "Someone needs help nearby"

# Tap notification
- tapOn: "New help request"

# Verify navigation
- assertVisible: "Request Details"
```

### Deep Links

```yaml
# Open deep link
- openLink: "karmyq://request/12345"

# Verify app opened to correct screen
- assertVisible: "Request Details"
```

---

## Performance Testing

### Measuring Load Times

```yaml
# Start timer
- start_timer: feed_load

# Navigate to feed
- tapOn: "Feed"

# Wait for content
- assertVisible: ".*"

# Stop timer
- stop_timer: feed_load

# Assert load time < 3 seconds
- assert_timer:
    name: feed_load
    max_duration: 3000
```

*(Note: Timer commands may require Maestro Cloud or custom extensions)*

### Frame Rate

Monitor FPS during scrolling:
```yaml
- scroll
- assertFPS:
    min: 55  # Minimum 55 FPS (out of 60)
```

---

## Best Practices Summary

### DO

- ✅ Use descriptive test names
- ✅ Add screenshots at key steps
- ✅ Use tags to organize tests
- ✅ Wait for elements (`assertVisible`)
- ✅ Test on both iOS and Android
- ✅ Keep tests independent
- ✅ Use environment variables for credentials
- ✅ Test happy path AND error states

### DON'T

- ❌ Use fixed `wait` times
- ❌ Hardcode user credentials in test files
- ❌ Rely on previous test state
- ❌ Use coordinates instead of text
- ❌ Skip screenshots (they're invaluable for debugging)
- ❌ Test only on one platform
- ❌ Forget to test permissions

---

## Maintenance

### Weekly

- Review failed tests
- Update selectors if UI changed
- Add tests for new features

### Monthly

- Review and update test data
- Check for flaky tests
- Update device matrix

### Quarterly

- Review full test coverage
- Remove obsolete tests
- Optimize slow tests

---

## Resources

- [Maestro Documentation](https://maestro.mobile.dev/)
- [Maestro GitHub](https://github.com/mobile-dev-inc/maestro)
- [Maestro Examples](https://github.com/mobile-dev-inc/maestro/tree/main/maestro-test)
- [Expo Testing Guide](https://docs.expo.dev/develop/unit-testing/)
- [React Native Testing](https://reactnative.dev/docs/testing-overview)

---

## Next Steps

1. **Install Maestro**: Follow Quick Start above
2. **Run Smoke Tests**: Verify setup with `npm run test:e2e:smoke`
3. **Add New Tests**: Use templates from this guide
4. **Integrate CI/CD**: Add to GitHub Actions
5. **Expand Coverage**: Add tests for remaining features

---

**Questions?** See [UI_TESTING_AUDIT.md](UI_TESTING_AUDIT.md) for overall testing strategy or check the Maestro documentation.
