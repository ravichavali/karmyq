# UI Testing Audit & Framework

**Date**: 2025-12-28
**Version**: 1.0.0
**Status**: Initial Assessment

---

## Executive Summary

**Web UI**: ✅ Comprehensive E2E test coverage with Playwright
**Mobile UI**: ❌ No automated testing infrastructure

**Recommendation**: Establish mobile testing framework while maintaining web test quality.

---

## Current State

### Web UI (Next.js Frontend)

**Location**: `apps/frontend`

**Test Coverage**:
- ✅ **E2E Tests**: Comprehensive Playwright tests (`tests/e2e/tests/`)
- ✅ **Integration Tests**: API integration tests (`tests/integration/`)
- ❌ **Unit Tests**: No component-level unit tests
- ❌ **Visual Regression**: No screenshot comparison tests

**E2E Test Files**:
1. `01-auth.spec.ts` - Authentication flows (login, register, logout)
2. `02-communities.spec.ts` - Community management
3. `03-requests.spec.ts` - Help request creation and matching
4. `04-messaging.spec.ts` - Real-time messaging
5. `05-notifications.spec.ts` - Notification system
6. `06-karma-system.spec.ts` - Reputation and karma
7. `07-advanced-matching.spec.ts` - Match algorithms
8. `08-edge-cases.spec.ts` - Error handling
9. `09-dashboard-redesign.spec.ts` - Dashboard functionality
10. `10-social-karma-v2.spec.ts` - Social graph features
11. `11-comprehensive-flow.spec.ts` - End-to-end user journeys

**Test Execution**:
```bash
# Full E2E suite
npm run test:e2e

# Specific test
npx playwright test 01-auth.spec.ts
```

**Coverage Assessment**:
| Feature | E2E Coverage | Notes |
|---------|-------------|-------|
| Authentication | ✅ Excellent | Login, register, logout, token refresh |
| Communities | ✅ Good | CRUD operations, membership |
| Requests | ✅ Good | Create, view, match, complete |
| Messaging | ✅ Good | Real-time chat, notifications |
| Karma System | ✅ Good | Points, trust scores, leaderboards |
| Social Graph | ✅ Good | Trust paths, invitation chains |
| Polymorphic Requests | ❌ Missing | No tests for payload rendering |
| Mobile Responsive | ⚠️ Limited | Tests run in desktop viewport |

---

### Mobile UI (React Native + Expo)

**Location**: `apps/mobile`

**Tech Stack**:
- Framework: React Native with Expo
- Navigation: Expo Router (file-based)
- State: Zustand
- API: Axios with TypeScript

**Features** (from README):
- 📱 Native iOS & Android apps
- 🔔 Push notifications
- 📍 Location services
- 📷 Camera integration
- 💬 Real-time messaging
- 🗺️ Maps integration
- 🔒 Secure storage
- 📴 Offline support

**Current Testing Status**:
- ❌ **No E2E Tests**: No Detox or Appium tests found
- ❌ **No Unit Tests**: No Jest tests for components
- ❌ **No Integration Tests**: No API integration tests
- ❌ **No Manual Test Plan**: No documented test scenarios

**Screens to Test**:
1. Feed - Personalized feed of community activity
2. Communities - Browse and join local communities
3. Requests - View and respond to help requests
4. Messages - Real-time chat
5. Profile - Reputation, karma, activity history

---

## Gap Analysis

### Critical Gaps

1. **Mobile Testing Infrastructure** (P0)
   - No automated tests for React Native app
   - No CI/CD pipeline for mobile builds
   - No crash reporting / analytics setup

2. **Polymorphic Request Rendering** (P0)
   - Web UI doesn't display payload data (locations, dates, requirements)
   - No tests for type-specific request rendering
   - Missing visual verification of structured data

3. **Component Unit Tests** (P1)
   - No unit tests for React components
   - No snapshot testing
   - No hook testing (e.g., useTrustPath)

4. **Visual Regression** (P2)
   - No screenshot comparison tests
   - UI changes not visually validated
   - Responsive design not systematically tested

5. **Performance Testing** (P2)
   - No load time measurements
   - No bundle size monitoring
   - No mobile performance benchmarks

### Coverage Gaps

**Web UI Missing Tests**:
- ❌ Polymorphic request display (transportation, moving, childcare)
- ❌ Trust path badge rendering with different degrees
- ❌ Community membership counter display
- ❌ Mobile responsive layouts
- ❌ Error boundary handling
- ❌ Loading states and skeletons

**Mobile UI Missing Tests**:
- ❌ Everything (no tests exist)

---

## Recommended Testing Framework

### Web UI Testing Stack

**Current (Keep)**:
```
Playwright (E2E)
├─ Browser automation
├─ Network interception
└─ Screenshot comparison (can add)

Jest (Integration)
├─ API integration tests
└─ Database integration tests
```

**Add**:
```
Jest + React Testing Library (Unit)
├─ Component testing
├─ Hook testing
└─ Snapshot testing

Percy or Chromatic (Visual)
├─ Screenshot comparison
├─ Cross-browser testing
└─ Responsive design validation
```

### Mobile UI Testing Stack (New)

**Recommended**:
```
Detox (E2E) - by Wix
├─ Native iOS/Android testing
├─ Works with Expo
├─ Fast and reliable
└─ Gray-box testing approach

Jest + React Native Testing Library (Unit)
├─ Component testing
├─ Hook testing
└─ Navigation testing

Maestro (E2E Alternative)
├─ Simpler syntax than Detox
├─ Cross-platform (iOS/Android/Web)
├─ Cloud testing support
└─ Good for CI/CD
```

**Choice: Start with Maestro for simplicity, can add Detox later if needed**

---

## Testing Strategy

### Phase 1: Establish Foundation (Week 1)

**Web UI**:
1. ✅ Document current E2E coverage (this document)
2. Add visual regression tests for critical screens
3. Add unit tests for TrustPathBadge component
4. Add tests for polymorphic request rendering

**Mobile UI**:
1. Set up Maestro testing framework
2. Create basic smoke tests (login, view feed)
3. Document manual testing checklist
4. Set up test data seeding for mobile

**Deliverables**:
- [ ] Visual regression test suite (5-10 critical screens)
- [ ] 3-5 component unit tests
- [ ] Maestro installed and configured
- [ ] 2-3 basic Maestro E2E tests
- [ ] Mobile manual test checklist

### Phase 2: Expand Coverage (Week 2)

**Web UI**:
1. Add tests for all polymorphic request types
2. Test responsive design breakpoints
3. Add tests for error states
4. Test loading states and skeletons

**Mobile UI**:
1. E2E tests for all main screens
2. Test push notifications
3. Test offline mode
4. Test camera and location permissions

**Deliverables**:
- [ ] 80%+ E2E coverage for web critical paths
- [ ] 50%+ E2E coverage for mobile critical paths
- [ ] Component unit test suite (20+ components)
- [ ] Performance benchmarks baseline

### Phase 3: Automation & CI (Week 3)

**Web UI**:
1. Integrate visual regression into CI
2. Add performance budgets
3. Automated accessibility checks
4. Screenshot generation for docs

**Mobile UI**:
1. Configure EAS Build for testing
2. Set up device farm for testing
3. Add crash reporting (Sentry)
4. Automated build validation

**Deliverables**:
- [ ] CI/CD pipeline runs all tests
- [ ] Visual regression tests on PR
- [ ] Mobile builds tested on real devices
- [ ] Performance monitoring dashboard

---

## Test Data Strategy

### Current Approach

**For Web E2E Tests**:
- Uses seed SQL scripts in `tests/e2e/`
- `seed-social-karma-v2.sql` - Full data set
- `seed-social-karma-v2-simple.sql` - Minimal data set

**Issues**:
- ✅ Realistic data structure
- ❌ Not using realistic data generator
- ❌ Hardcoded IDs make tests brittle
- ❌ No cleanup between test runs

### Recommended Approach

**Use Realistic Data Generator**:
```bash
# Before tests
cd scripts
truncate-database.bat
npm run generate:realistic

# Run tests
cd ../tests
npm run test:e2e
```

**Benefits**:
- ✅ Same data as manual testing
- ✅ Polymorphic payloads present
- ✅ Realistic social graphs
- ✅ Historical data with dates

**Test Data Requirements**:
1. **Deterministic** - Same data every run
2. **Isolated** - Tests don't affect each other
3. **Realistic** - Matches production data shape
4. **Fast** - Quick to seed (<30 seconds)
5. **Documented** - Known users, communities, requests

**Implementation**:
```typescript
// tests/helpers/seed-data.ts
export async function seedTestData() {
  // Use data generator with fixed seed
  // Create known test users with predictable IDs
  // Return handles to test data
}

export const testUsers = {
  admin: { email: 'admin@test.com', password: 'test123' },
  member: { email: 'member@test.com', password: 'test123' },
  requester: { email: 'requester@test.com', password: 'test123' },
};
```

---

## Mobile Testing Setup Guide

### Prerequisites

```bash
# Install Maestro
curl -Ls https://get.maestro.mobile.dev | bash

# Verify installation
maestro -v

# For iOS simulator
xcrun simctl list devices

# For Android emulator
emulator -list-avds
```

### Configuration

**File**: `apps/mobile/.maestro/config.yaml`
```yaml
appId: com.karmyq.app
env:
  API_URL: http://localhost:3000
  TEST_USER_EMAIL: test@example.com
  TEST_USER_PASSWORD: password123
```

### First Test

**File**: `apps/mobile/.maestro/flows/01-login.yaml`
```yaml
appId: com.karmyq.app
---
- launchApp
- tapOn: "Login"
- inputText: "${TEST_USER_EMAIL}"
- tapOn: "Password"
- inputText: "${TEST_USER_PASSWORD}"
- tapOn: "Sign In"
- assertVisible: "Feed"
```

### Run Tests

```bash
# Start app
cd apps/mobile
npm start

# In another terminal, run Maestro
maestro test .maestro/flows/

# Run specific test
maestro test .maestro/flows/01-login.yaml
```

---

## Testing Checklist for UI Changes

Based on DEVELOPMENT_PROCESS.md, use this checklist when making UI changes:

### Before Changing UI Code

- [ ] Read the component file completely
- [ ] Check which props are used
- [ ] Find all usages with Grep: `<ComponentName`
- [ ] Check if data comes from API (verify API response format)
- [ ] Check if tests exist for this component
- [ ] Plan the change (write down what will be modified)

### While Making Changes

- [ ] Update TypeScript interfaces if props change
- [ ] Add null checks for optional data
- [ ] Test with realistic data (from data generator)
- [ ] Check responsive design (mobile, tablet, desktop)
- [ ] Verify accessibility (screen reader, keyboard nav)

### After Making Changes

- [ ] Run type check: `npm run type-check`
- [ ] Run unit tests: `npm test`
- [ ] Run E2E tests: `npm run test:e2e`
- [ ] Manual testing in browser
- [ ] Test on mobile viewport
- [ ] Check for console errors
- [ ] Verify data displays correctly

### Before Committing

- [ ] Run full test suite: `scripts/test-all.bat`
- [ ] Review git diff
- [ ] Update tests if behavior changed
- [ ] Update documentation if UI changed significantly
- [ ] Take screenshots for complex UI changes

---

## Mobile-Specific Testing Considerations

### Platform Differences

**iOS vs Android**:
- Navigation gestures (swipe vs back button)
- Permission dialogs (different UX)
- Keyboard behavior
- Date/time pickers
- Share functionality

**Test on Both Platforms**:
```yaml
# Maestro supports platform-specific steps
- runFlow:
    when:
      platform: iOS
    file: ios-specific-test.yaml

- runFlow:
    when:
      platform: Android
    file: android-specific-test.yaml
```

### Device Testing Matrix

**Minimum**:
- iPhone 14 Pro (iOS 17) - Latest
- iPhone SE (iOS 15) - Older small screen
- Pixel 7 (Android 13) - Modern Android
- Pixel 4a (Android 11) - Older Android

**Screen Sizes**:
- Small: iPhone SE (375×667)
- Medium: iPhone 14 (390×844)
- Large: iPhone 14 Pro Max (430×932)
- Tablet: iPad Pro (1024×1366)

### Permission Testing

**Required Permissions**:
```yaml
# Location
- tapOn: "Allow While Using App"

# Camera
- tapOn: "OK" # iOS
- tapOn: "Allow" # Android

# Notifications
- tapOn: "Allow"

# Photo Library
- tapOn: "Allow Access to All Photos"
```

**Test Denied Permissions**:
- App should gracefully handle denied permissions
- Show helpful error messages
- Provide alternative flows

### Offline Testing

**Scenarios to Test**:
1. Start offline → Go online
2. Start online → Go offline mid-flow
3. Submit request offline → Sync when online
4. Receive push notification while offline

**Maestro Offline Mode**:
```yaml
- setAirplaneMode: true
- tapOn: "Create Request"
- assertVisible: "You're offline"
- setAirplaneMode: false
- assertVisible: "Request created"
```

---

## Visual Regression Testing

### Critical Screens for Screenshot Comparison

**Web**:
1. Dashboard (Feed view)
2. Request detail with trust path
3. Community list
4. Profile with karma
5. Mobile responsive views

**Mobile**:
1. Feed screen
2. Request creation flow
3. Chat interface
4. Profile screen
5. Community detail

### Percy Configuration

**File**: `percy.config.js`
```javascript
module.exports = {
  version: 2,
  static: {
    cleanUrls: true
  },
  snapshot: {
    widths: [375, 768, 1280],
    minHeight: 1024,
    enableJavaScript: true,
    percyCSS: `
      .loading-skeleton { display: none; }
      .animated-element { animation: none !important; }
    `
  }
};
```

### Usage in Tests

```typescript
// In Playwright test
import percySnapshot from '@percy/playwright';

test('dashboard displays feed correctly', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForSelector('[data-testid="feed-item"]');

  // Take Percy snapshot
  await percySnapshot(page, 'Dashboard - Feed View');
});
```

---

## Performance Testing

### Web Performance Metrics

**Lighthouse CI**:
```yaml
# .lighthouserc.json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/dashboard"],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "first-contentful-paint": ["error", {"maxNumericValue": 2000}],
        "interactive": ["error", {"maxNumericValue": 3500}],
        "categories:performance": ["error", {"minScore": 0.9}],
        "categories:accessibility": ["error", {"minScore": 0.9}]
      }
    }
  }
}
```

### Mobile Performance

**React Native Performance Monitor**:
```typescript
import { PerformanceObserver, performance } from 'react-native-performance';

// Measure screen render time
performance.mark('screen-start');
// ... render screen ...
performance.mark('screen-end');
performance.measure('screen-render', 'screen-start', 'screen-end');
```

**Metrics to Track**:
- JS bundle size (target: <500KB)
- Time to interactive (target: <2s)
- Frame rate (target: 60fps)
- Memory usage (target: <100MB)
- Network requests (target: <10 per screen)

---

## Next Steps

### Immediate Actions (This Session)

Following DEVELOPMENT_PROCESS.md:

1. **Complete Pre-Change Checklist** ✅
   - [x] Understand scope (web + mobile UI testing)
   - [x] Check dependencies (test frameworks, data)
   - [x] Audit current state (this document)

2. **Plan Implementation**
   - [ ] Choose mobile testing framework (Maestro)
   - [ ] Set up basic mobile tests
   - [ ] Add web component unit tests
   - [ ] Test polymorphic request rendering

3. **Document Framework**
   - [x] Create UI_TESTING_AUDIT.md (this file)
   - [ ] Create mobile testing guide
   - [ ] Update DEVELOPMENT_PROCESS.md with UI testing section

### Follow-Up Work

1. **Week 1**: Foundation
   - Set up Maestro for mobile
   - Add 5-10 critical mobile E2E tests
   - Add unit tests for 3-5 web components
   - Test polymorphic request display

2. **Week 2**: Expansion
   - Expand mobile test coverage to 50%
   - Add visual regression tests
   - Test all polymorphic request types
   - Performance benchmarks

3. **Week 3**: Automation
   - Integrate tests into CI/CD
   - Set up device farm
   - Add crash reporting
   - Performance monitoring

---

## Resources

### Web Testing
- [Playwright Documentation](https://playwright.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Percy Visual Testing](https://percy.io/)

### Mobile Testing
- [Maestro Documentation](https://maestro.mobile.dev/)
- [Detox Documentation](https://wix.github.io/Detox/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Expo Testing Guide](https://docs.expo.dev/develop/unit-testing/)

### General
- [Kent C. Dodds - Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Martin Fowler - Testing Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)

---

**Conclusion**: Web UI has good E2E coverage but needs component unit tests and visual regression. Mobile UI needs complete testing infrastructure. Following this framework will establish a robust testing foundation for both platforms.
