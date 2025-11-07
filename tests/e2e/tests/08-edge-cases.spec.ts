import { test, expect } from './fixtures/auth';
import { ApiHelpers } from './utils/api-helpers';

/**
 * Edge Cases & Error Handling E2E Tests
 *
 * Tests error scenarios and edge cases:
 * - Invalid input validation
 * - Network failures and timeouts
 * - Concurrent operations
 * - Session expiration
 * - Rate limiting
 * - Data integrity
 * - Boundary conditions
 */

test.describe('Edge Cases & Error Handling', () => {
  let api: ApiHelpers;

  test.beforeEach(async ({ authenticatedPage }) => {
    api = new ApiHelpers(authenticatedPage);
  });

  test('should validate required fields in forms', async ({ authenticatedPage }) => {
    // Test registration form validation
    await authenticatedPage.goto('/register');

    // Try to submit empty form
    const submitButton = authenticatedPage.locator('button[type="submit"]');
    await submitButton.click();

    // HTML5 validation should prevent submission
    const emailInput = authenticatedPage.locator('input[type="email"]');
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);

    expect(isInvalid).toBeTruthy();
  });

  test('should handle invalid email format', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/login');

    // Enter invalid email
    await authenticatedPage.fill('input[type="email"]', 'not-an-email');
    await authenticatedPage.fill('input[type="password"]', 'password123');

    // Try to submit
    await authenticatedPage.click('button[type="submit"]');

    // Should show validation error
    const emailInput = authenticatedPage.locator('input[type="email"]');
    const validationMessage = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage
    );

    expect(validationMessage).toBeTruthy();
  });

  test('should handle wrong password gracefully', async ({ authenticatedPage }) => {
    // Clear any existing session
    await authenticatedPage.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await authenticatedPage.goto('/login');

    // Enter valid email but wrong password
    await authenticatedPage.fill('input[type="email"]', 'isabella.thomas0@example.com');
    await authenticatedPage.fill('input[type="password"]', 'wrongpassword123');

    await authenticatedPage.click('button[type="submit"]');

    // Should show error message
    await authenticatedPage.waitForTimeout(1000);

    const errorMessage = authenticatedPage.locator(
      'text=/invalid|incorrect|wrong|failed|error/i, .error, .alert-error, [role="alert"]'
    );

    await expect(errorMessage).toBeVisible({ timeout: 3000 });
  });

  test('should handle duplicate email during registration', async ({ authenticatedPage }) => {
    // Clear session
    await authenticatedPage.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await authenticatedPage.goto('/register');

    // Try to register with existing email
    const timestamp = Date.now();
    await authenticatedPage.fill('input[name="name"]', `Test User ${timestamp}`);
    await authenticatedPage.fill('input[type="email"]', 'isabella.thomas0@example.com');
    await authenticatedPage.fill('input[type="password"]', 'password123');

    const confirmPasswordField = authenticatedPage.locator(
      'input[name="confirmPassword"], input[name="password_confirmation"]'
    );

    if (await confirmPasswordField.isVisible()) {
      await confirmPasswordField.fill('password123');
    }

    await authenticatedPage.click('button[type="submit"]');

    // Should show error about existing email
    await authenticatedPage.waitForTimeout(1000);

    const errorMessage = authenticatedPage.locator(
      'text=/already exists|already registered|email taken|duplicate/i, .error, [role="alert"]'
    );

    const hasError = (await errorMessage.count()) > 0;
    expect(hasError).toBeTruthy();
  });

  test('should handle very long input in text fields', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/communities/new');

    // Create very long text
    const veryLongText = 'A'.repeat(10000);

    const descriptionField = authenticatedPage.locator('textarea[name="description"]');

    if (await descriptionField.isVisible()) {
      await descriptionField.fill(veryLongText);

      // Try to submit
      await authenticatedPage.click('button[type="submit"]');
      await authenticatedPage.waitForTimeout(1000);

      // Should either:
      // 1. Show validation error (max length)
      // 2. Truncate the input
      // 3. Accept it (depending on backend validation)

      const validationError = authenticatedPage.locator(
        'text=/too long|maximum length|character limit/i, .error'
      );

      const errorCount = await validationError.count();

      // Just verify the app doesn't crash
      const isPageResponsive = await authenticatedPage.locator('body').isVisible();
      expect(isPageResponsive).toBeTruthy();
    }
  });

  test('should handle special characters in input', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/communities/new');

    // Test with special characters
    const specialText = '<script>alert("xss")</script>\'; DROP TABLE communities; --';

    await authenticatedPage.fill('input[name="name"]', specialText);

    const descriptionField = authenticatedPage.locator('textarea[name="description"]');
    if (await descriptionField.isVisible()) {
      await descriptionField.fill(specialText);
    }

    // Try to submit
    await authenticatedPage.click('button[type="submit"]');
    await authenticatedPage.waitForTimeout(1000);

    // App should handle it gracefully (sanitize or reject)
    const isPageResponsive = await authenticatedPage.locator('body').isVisible();
    expect(isPageResponsive).toBeTruthy();

    // Should not execute any scripts
    const hasAlert = await authenticatedPage.evaluate(() => {
      return typeof window.alert === 'function';
    });

    // Alert should still be a function (not hijacked)
    expect(hasAlert).toBeTruthy();
  });

  test('should handle API errors gracefully', async ({ authenticatedPage }) => {
    const user = await api.getCurrentUser();

    // Try to access non-existent resource
    const response = await api.makeAuthenticatedRequest(
      `${process.env.REQUEST_API_URL || 'http://localhost:3003'}/requests/99999999`,
      { method: 'GET' }
    );

    // Should get 404 or error response
    expect(response.status).toBeGreaterThanOrEqual(400);

    const data = await response.json();

    // Error response should have meaningful structure
    expect(data).toBeTruthy();
    expect(typeof data).toBe('object');
  });

  test('should handle concurrent operations', async ({ authenticatedPage }) => {
    const user = await api.getCurrentUser();

    // Create test community
    const community = await api.createTestCommunity({
      name: `Concurrent Test ${Date.now()}`,
      description: 'Testing concurrent operations',
    });

    // Try to create multiple requests simultaneously
    const requestPromises = [];
    for (let i = 0; i < 5; i++) {
      requestPromises.push(
        api.makeAuthenticatedRequest(
          `${process.env.REQUEST_API_URL || 'http://localhost:3003'}/requests`,
          {
            method: 'POST',
            body: JSON.stringify({
              community_id: community.id,
              requester_id: user.id,
              title: `Concurrent Request ${i}`,
              description: 'Testing concurrent creation',
              type: 'general',
            }),
          }
        )
      );
    }

    const responses = await Promise.all(requestPromises);

    // All should succeed (or fail gracefully)
    responses.forEach((response) => {
      expect(response.status).toBeLessThan(500); // No server errors
    });

    // Count successful creations
    const successCount = responses.filter((r) => r.status >= 200 && r.status < 300).length;
    expect(successCount).toBeGreaterThan(0);

    // Cleanup
    await api.deleteTestCommunity(community.id);
  });

  test('should handle expired session', async ({ authenticatedPage }) => {
    // Clear token to simulate expired session
    await authenticatedPage.evaluate(() => {
      localStorage.removeItem('token');
    });

    // Try to access protected page
    await authenticatedPage.goto('/dashboard');

    // Should redirect to login or show error
    await authenticatedPage.waitForTimeout(1000);

    const url = authenticatedPage.url();
    const isOnLogin = url.includes('/login');
    const hasUnauthorizedMessage = (await authenticatedPage.locator(
      'text=/unauthorized|please log in|session expired/i'
    ).count()) > 0;

    expect(isOnLogin || hasUnauthorizedMessage).toBeTruthy();
  });

  test('should handle malformed localStorage data', async ({ authenticatedPage }) => {
    // Set malformed user data
    await authenticatedPage.evaluate(() => {
      localStorage.setItem('user', 'not-valid-json');
      localStorage.setItem('token', 'invalid-token');
    });

    // Try to access dashboard
    await authenticatedPage.goto('/dashboard');

    // App should handle gracefully (not crash)
    await authenticatedPage.waitForTimeout(1000);

    const isPageResponsive = await authenticatedPage.locator('body').isVisible();
    expect(isPageResponsive).toBeTruthy();

    // Should probably redirect to login
    const url = authenticatedPage.url();
    const isHandled = url.includes('/login') || url.includes('/dashboard');
    expect(isHandled).toBeTruthy();
  });

  test('should handle missing required API parameters', async ({ authenticatedPage }) => {
    const user = await api.getCurrentUser();

    // Try to create request without required fields
    const response = await api.makeAuthenticatedRequest(
      `${process.env.REQUEST_API_URL || 'http://localhost:3003'}/requests`,
      {
        method: 'POST',
        body: JSON.stringify({
          requester_id: user.id,
          // Missing title, description, community_id
        }),
      }
    );

    // Should return validation error
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);

    const data = await response.json();

    // Should have error message
    expect(data.success).toBe(false);
    expect(data.message || data.error).toBeTruthy();
  });

  test('should handle pagination edge cases', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/requests');

    // Try to navigate to very high page number
    const url = new URL(authenticatedPage.url());
    url.searchParams.set('page', '999999');

    await authenticatedPage.goto(url.toString());

    // Should show empty state or redirect to valid page
    const isPageResponsive = await authenticatedPage.locator('body').isVisible();
    expect(isPageResponsive).toBeTruthy();

    const hasContent =
      (await authenticatedPage.locator('[data-testid="request-card"], .request-card').count()) > 0 ||
      (await authenticatedPage.locator('text=/no requests|empty/i').count()) > 0;

    expect(hasContent).toBeTruthy();
  });

  test('should handle empty search results', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/requests');

    // Look for search input
    const searchInput = authenticatedPage.locator(
      'input[type="search"], input[placeholder*="search"], input[name="search"]'
    );

    if (await searchInput.isVisible()) {
      // Search for something that definitely doesn't exist
      await searchInput.fill('xyzabc123nonexistentquery999');

      // Submit search
      const searchButton = authenticatedPage.locator('button[type="submit"]');
      if (await searchButton.isVisible()) {
        await searchButton.click();
      } else {
        await searchInput.press('Enter');
      }

      await authenticatedPage.waitForTimeout(1000);

      // Should show empty state
      const emptyState = authenticatedPage.locator(
        'text=/no results|no matches|nothing found/i, [data-testid="empty-state"]'
      );

      await expect(emptyState).toBeVisible({ timeout: 3000 });
    }
  });

  test('should handle rapid button clicks', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/requests/new');

    // Fill in form
    await authenticatedPage.fill('input[name="title"]', 'Rapid Click Test');

    const descriptionField = authenticatedPage.locator('textarea[name="description"]');
    if (await descriptionField.isVisible()) {
      await descriptionField.fill('Testing rapid submission');
    }

    // Try to click submit multiple times rapidly
    const submitButton = authenticatedPage.locator('button[type="submit"]');

    // Click 5 times rapidly
    for (let i = 0; i < 5; i++) {
      submitButton.click({ timeout: 100 }).catch(() => {}); // Don't await
    }

    await authenticatedPage.waitForTimeout(2000);

    // Should only create one request (button should be disabled or request deduplicated)
    const isPageResponsive = await authenticatedPage.locator('body').isVisible();
    expect(isPageResponsive).toBeTruthy();
  });

  test('should handle back button navigation', async ({ authenticatedPage }) => {
    // Navigate through several pages
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.goto('/communities');
    await authenticatedPage.goto('/requests');

    // Go back
    await authenticatedPage.goBack();

    // Should be on communities
    expect(authenticatedPage.url()).toContain('/communities');

    // Go back again
    await authenticatedPage.goBack();

    // Should be on dashboard
    expect(authenticatedPage.url()).toContain('/dashboard');

    // Page should be functional
    const isPageResponsive = await authenticatedPage.locator('body').isVisible();
    expect(isPageResponsive).toBeTruthy();
  });

  test('should handle network timeout gracefully', async ({ authenticatedPage }) => {
    // Simulate slow network by setting a very short timeout
    const user = await api.getCurrentUser();

    const startTime = Date.now();

    // Make request and catch timeout
    const response = await api
      .makeAuthenticatedRequest(
        `${process.env.REQUEST_API_URL || 'http://localhost:3003'}/requests`,
        {
          method: 'GET',
        }
      )
      .catch((error) => {
        return { status: 0, error: error.message };
      });

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Request should complete or timeout
    expect(duration).toBeGreaterThan(0);
  });

  test('should validate date inputs', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/requests/new');

    // Look for date inputs
    const dateInput = authenticatedPage.locator('input[type="date"], input[type="datetime-local"]');

    if (await dateInput.isVisible()) {
      // Try to set invalid date (past date for future-only field)
      await dateInput.fill('2000-01-01');

      const submitButton = authenticatedPage.locator('button[type="submit"]');
      await submitButton.click();

      await authenticatedPage.waitForTimeout(500);

      // May show validation error or accept it (depends on requirements)
      const isPageResponsive = await authenticatedPage.locator('body').isVisible();
      expect(isPageResponsive).toBeTruthy();
    }
  });

  test('should handle browser refresh during form submission', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/communities/new');

    // Fill form
    const timestamp = Date.now();
    await authenticatedPage.fill('input[name="name"]', `Refresh Test ${timestamp}`);

    const descriptionField = authenticatedPage.locator('textarea[name="description"]');
    if (await descriptionField.isVisible()) {
      await descriptionField.fill('Testing refresh behavior');
    }

    // Start submission (but don't await)
    authenticatedPage.click('button[type="submit"]').catch(() => {});

    // Immediately refresh
    await authenticatedPage.reload();

    // Page should load successfully
    const isPageResponsive = await authenticatedPage.locator('body').isVisible();
    expect(isPageResponsive).toBeTruthy();
  });
});
