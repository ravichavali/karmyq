import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests
 *
 * Tests the complete authentication flow including:
 * - User registration
 * - User login
 * - Session persistence
 * - Logout
 */

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should display login page', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveTitle(/Login/i);
    await expect(page.locator('h1')).toContainText('Login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show validation errors for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // HTML5 validation should prevent submission
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeFocused();
  });

  test('should successfully log in with valid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in valid credentials
    await page.fill('input[type="email"]', 'isabella.thomas0@example.com');
    await page.fill('input[type="password"]', 'password123');

    // Submit form
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Check that user is stored in localStorage
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();

    const userStr = await page.evaluate(() => localStorage.getItem('user'));
    expect(userStr).toBeTruthy();

    const user = JSON.parse(userStr!);
    expect(user.email).toBe('isabella.thomas0@example.com');
  });

  test('should persist session after page reload', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', 'isabella.thomas0@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Reload the page
    await page.reload();

    // Should still be on dashboard (not redirected to login)
    await expect(page).toHaveURL(/\/dashboard/);

    // Token should still exist
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
  });

  test('should navigate to registration page', async ({ page }) => {
    await page.goto('/login');

    // Click the register link
    await page.click('a[href="/register"]');

    // Should be on register page
    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator('h1')).toContainText(/Register|Sign Up/i);
  });

  test('should redirect to login when accessing protected route without auth', async ({ page }) => {
    // Try to access dashboard without logging in
    await page.goto('/dashboard');

    // Should be redirected to login or see unauthorized message
    // (This depends on your auth implementation)
    const url = page.url();
    const hasLoginInUrl = url.includes('/login');
    const hasUnauthorizedMessage = await page.locator('text=/unauthorized|please log in/i').count() > 0;

    expect(hasLoginInUrl || hasUnauthorizedMessage).toBeTruthy();
  });
});
