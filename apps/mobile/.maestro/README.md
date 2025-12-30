# Mobile E2E Tests (Maestro)

Automated end-to-end tests for the KarmyQ React Native mobile app using [Maestro](https://maestro.mobile.dev/).

## Prerequisites

### 1. Install Maestro

**macOS/Linux**:
```bash
curl -Ls https://get.maestro.mobile.dev | bash
```

**Windows** (WSL):
```bash
curl -Ls https://get.maestro.mobile.dev | bash
```

Verify installation:
```bash
maestro -v
```

### 2. Set Up Mobile Simulator/Emulator

**iOS Simulator** (macOS only):
```bash
# List available simulators
xcrun simctl list devices

# Boot a simulator
xcrun simctl boot "iPhone 15 Pro"

# Or use Xcode: Xcode > Open Developer Tool > Simulator
```

**Android Emulator**:
```bash
# List available AVDs
emulator -list-avds

# Start emulator
emulator -avd Pixel_7_API_33
```

## Running Tests

### 1. Start the Mobile App

In a separate terminal:
```bash
cd apps/mobile
npm start

# Then press:
# - 'i' for iOS simulator
# - 'a' for Android emulator
```

Wait for the app to load completely on the device/simulator.

### 2. Run Maestro Tests

**Run all tests**:
```bash
cd apps/mobile
maestro test .maestro/flows/
```

**Run specific test**:
```bash
maestro test .maestro/flows/02-login-flow.yaml
```

**Run tests with specific tag**:
```bash
# Run smoke tests only
maestro test .maestro/flows/ --tag smoke

# Run auth tests only
maestro test .maestro/flows/ --tag auth
```

**Run in continuous mode** (watch for changes):
```bash
maestro test --continuous .maestro/flows/
```

## Test Files

| Test File | Description | Tags |
|-----------|-------------|------|
| `01-launch-app.yaml` | Verify app launches successfully | `smoke` |
| `02-login-flow.yaml` | Test user login | `smoke`, `auth` |
| `03-view-feed.yaml` | View personalized feed | `smoke`, `feed` |
| `04-view-communities.yaml` | Browse communities | `smoke` |
| `05-view-help-requests.yaml` | View help requests | `smoke`, `requests` |
| `06-view-profile.yaml` | View user profile | `smoke` |
| `07-complete-login-flow.yaml` | Full E2E: launch → login → navigate | `e2e`, `smoke` |

## Test Data

Tests use environment variables defined in `config.yaml`:

- `TEST_USER_EMAIL`: test@karmyq.com
- `TEST_USER_PASSWORD`: password123

**Important**: Ensure these test users exist in your database before running tests.

### Creating Test Users

Option 1: Use the data generator (creates test users automatically):
```bash
cd scripts
npm run generate:realistic
```

Option 2: Create specific test users via API or database:
```sql
INSERT INTO auth.users (id, name, email, password_hash, created_at)
VALUES (
  uuid_generate_v4(),
  'Test User',
  'test@karmyq.com',
  -- bcrypt hash for 'password123'
  '$2a$10$...',
  NOW()
);
```

## Writing New Tests

### Basic Test Structure

```yaml
# Test: [Name]
# Tags: [comma,separated,tags]
# Description: [What this test does]

appId: com.karmyq.app
---
# Launch app
- launchApp

# Your test steps here
- tapOn: "Button Text"
- inputText: "Some text"
- assertVisible: "Expected Element"

# Take screenshot
- takeScreenshot: test-step-name
```

### Common Maestro Commands

**Navigation**:
```yaml
- tapOn: "Button Text"
- tapOn:
    text: "Text|Alternative"  # Matches any
    index: 0                   # First match
- back                          # Go back
- swipe:
    direction: LEFT|RIGHT|UP|DOWN
```

**Input**:
```yaml
- inputText: "Text to type"
- inputText: "${ENVIRONMENT_VARIABLE}"
- clearText                     # Clear input field
```

**Assertions**:
```yaml
- assertVisible: "Element Text"
- assertVisible:
    text: "Text"
    timeout: 5000              # Wait up to 5 seconds
- assertNotVisible: "Hidden Element"
```

**Scrolling**:
```yaml
- scroll                        # Scroll down
- scrollUp                      # Scroll up
- scrollUntilVisible:
    element: "Element to find"
```

**Waiting**:
```yaml
- wait: 2000                    # Wait 2 seconds
```

**Screenshots**:
```yaml
- takeScreenshot: filename
```

### Environment Variables

Access variables from `config.yaml`:
```yaml
- inputText: "${TEST_USER_EMAIL}"
```

### Optional Steps

Steps that may not always be present:
```yaml
- tapOn: "Optional Button"
  optional: true
```

## Debugging Tests

### View Test Results

After running tests, Maestro creates a report in:
```
~/.maestro/tests/[timestamp]/
```

Screenshots are saved in the same directory.

### Record Screen During Test

```bash
maestro test --record .maestro/flows/02-login-flow.yaml
```

### Interactive Mode (Step Through Test)

```bash
maestro studio
```

Then paste your test YAML and step through interactively.

### Common Issues

**Issue**: "App not found"
- **Solution**: Make sure the app is running on the simulator/emulator
- Check that `appId` in config matches your app's bundle ID

**Issue**: "Element not found"
- **Solution**:
  - Add `timeout` to wait longer
  - Use `optional: true` for conditional elements
  - Check element text exactly matches what's on screen

**Issue**: "Tests fail on different screen sizes"
- **Solution**: Use text matching instead of coordinates
- Test on multiple device sizes

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Mobile E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Maestro
        run: |
          curl -Ls https://get.maestro.mobile.dev | bash
          echo "$HOME/.maestro/bin" >> $GITHUB_PATH

      - name: Install dependencies
        run: |
          cd apps/mobile
          npm install

      - name: Build app
        run: |
          cd apps/mobile
          expo prebuild
          # Build for simulator
          xcodebuild -workspace ios/App.xcworkspace \
                     -scheme App \
                     -destination 'platform=iOS Simulator,name=iPhone 15 Pro'

      - name: Run Maestro tests
        run: |
          cd apps/mobile
          maestro test .maestro/flows/

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: maestro-results
          path: ~/.maestro/tests/
```

## Best Practices

1. **Use Tags**: Organize tests with tags for different test suites
2. **Descriptive Screenshots**: Name screenshots clearly (`login-success`, not `test1`)
3. **Wait for Elements**: Use `assertVisible` with timeouts instead of fixed `wait`
4. **Text Matching**: Use `|` for multiple possible texts: `"Login|Sign In"`
5. **Optional Steps**: Use `optional: true` for conditional UI elements
6. **Idempotent Tests**: Tests should work regardless of app state
7. **Isolate Tests**: Each test should be independent

## Resources

- [Maestro Documentation](https://maestro.mobile.dev/)
- [Maestro GitHub](https://github.com/mobile-dev-inc/maestro)
- [Maestro Examples](https://github.com/mobile-dev-inc/maestro/tree/main/maestro-test)
