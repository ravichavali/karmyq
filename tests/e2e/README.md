# End-to-End Tests

Comprehensive E2E tests for the Karmyq platform using Playwright.

## Setup

```bash
cd tests/e2e
npm install
npx playwright install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

## Running Tests

### Prerequisites

Make sure all services are running:

```bash
# From project root
bash scripts/dev/start.sh
```

### Run All Tests

```bash
npm test
```

### Run Specific Test Suite

```bash
npm test -- 01-auth.spec.ts
npm test -- 02-communities.spec.ts
```

### Run in UI Mode (Interactive)

```bash
npm run test:ui
```

### Run in Headed Mode (See Browser)

```bash
npm run test:headed
```

### Debug Tests

```bash
npm run test:debug
```

### Run Specific Browser

```bash
npm run test:chromium
npm run test:firefox
npm run test:webkit
```

## Test Structure

```
tests/e2e/
├── tests/
│   ├── fixtures/
│   │   └── auth.ts          # Authentication fixtures
│   ├── utils/
│   │   └── api-helpers.ts   # API helper utilities
│   ├── 01-auth.spec.ts      # Authentication tests
│   ├── 02-communities.spec.ts # Community management tests
│   ├── 03-requests.spec.ts  # Help request tests
│   ├── 04-messaging.spec.ts # Messaging tests
│   ├── 05-notifications.spec.ts # Notification tests
│   ├── 06-karma-system.spec.ts # Karma and reputation tests
│   ├── 07-advanced-matching.spec.ts # Advanced matching tests
│   └── 08-edge-cases.spec.ts # Edge cases and error handling tests
├── playwright.config.ts     # Playwright configuration
└── package.json
```

## Test Coverage

### 01-auth.spec.ts
- Login/logout flow
- Registration
- Session persistence
- Protected route access

### 02-communities.spec.ts
- Browse communities
- Create community
- View community details
- Join community
- Search and filter

### 03-requests.spec.ts
- Create help request
- View requests
- Filter by status
- Urgency levels

### 04-messaging.spec.ts
- View conversations
- Send messages
- Real-time updates
- Timestamps and read receipts

### 05-notifications.spec.ts
- Notification bell
- Dropdown/panel
- Mark as read
- Notification types

### 06-karma-system.spec.ts
- Karma score display on profile
- Trust score calculations (0-100)
- Karma awards on match completion
- Karma leaderboard
- Karma history/transaction log
- First help bonus (15 points)
- Milestone bonuses (10, 50, 100 exchanges)
- Karma badges and achievements
- Activity type breakdown
- Point value validation

### 07-advanced-matching.spec.ts
- Create and view offers for requests
- Multiple offers on a single request
- Accept offers and create matches
- Match status transitions (proposed → accepted → completed)
- Complete matches with ratings and feedback
- Filter matches by status
- Match cancellation and rejection
- Urgency-based prioritization
- Sort requests by urgency
- Location-based matching
- Skills-based matching

### 08-edge-cases.spec.ts
- Form validation (required fields, email format)
- Authentication errors (wrong password, duplicate email)
- Input validation (very long text, special characters)
- XSS prevention and sanitization
- API error handling (404, 400 errors)
- Concurrent operations
- Session expiration
- Malformed localStorage data
- Missing API parameters
- Pagination edge cases (page 999999)
- Empty search results
- Rapid button clicks (double submission prevention)
- Back button navigation
- Network timeouts
- Date validation
- Browser refresh during form submission

## Writing New Tests

### Basic Test

```typescript
import { test, expect } from '@playwright/test';

test('should do something', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Expected Text');
});
```

### Authenticated Test

```typescript
import { test, expect } from './fixtures/auth';

test('should access protected route', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/dashboard');
  await expect(authenticatedPage.locator('h1')).toBeVisible();
});
```

### Using API Helpers

```typescript
import { test, expect } from './fixtures/auth';
import { ApiHelpers } from './utils/api-helpers';

test('should create and delete community', async ({ authenticatedPage }) => {
  const api = new ApiHelpers(authenticatedPage);

  const community = await api.createTestCommunity({
    name: 'Test Community',
    description: 'Test description'
  });

  // ... test logic ...

  await api.deleteTestCommunity(community.id);
});
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up test data created during tests
3. **Selectors**: Use data-testid attributes for stable selectors
4. **Waits**: Use `waitForURL`, `waitForSelector` instead of `waitForTimeout`
5. **Assertions**: Use meaningful assertions with good error messages
6. **Page Objects**: Consider creating page objects for complex pages

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Start services
        run: bash scripts/dev/start.sh &

      - name: Install dependencies
        working-directory: tests/e2e
        run: npm install

      - name: Install Playwright browsers
        working-directory: tests/e2e
        run: npx playwright install --with-deps

      - name: Run tests
        working-directory: tests/e2e
        run: npm test

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: tests/e2e/playwright-report/
```

## Viewing Reports

After running tests, view the HTML report:

```bash
npm run report
```

## Troubleshooting

### Tests Timing Out

- Increase timeout in `playwright.config.ts`
- Check that all services are running
- Verify network connectivity

### Element Not Found

- Add explicit waits: `await page.waitForSelector('selector')`
- Check if element is in viewport: `await element.scrollIntoViewIfNeeded()`
- Verify selector is correct: Use Playwright Inspector

### Authentication Issues

- Check `.env` file has correct test credentials
- Verify auth service is running on port 3001
- Check localStorage is being set correctly

## Debugging Tips

1. **Use Playwright Inspector**:
   ```bash
   npm run test:debug
   ```

2. **Take Screenshots**:
   ```typescript
   await page.screenshot({ path: 'debug.png' });
   ```

3. **Console Logs**:
   ```typescript
   page.on('console', msg => console.log(msg.text()));
   ```

4. **Network Requests**:
   ```typescript
   page.on('request', request => console.log(request.url()));
   page.on('response', response => console.log(response.status()));
   ```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
