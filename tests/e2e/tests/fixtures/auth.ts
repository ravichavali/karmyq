import { test as base } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Authentication fixture for E2E tests
 *
 * Provides authenticated page instances for testing protected routes
 */

type AuthFixtures = {
  authenticatedPage: any;
  testUser: {
    email: string;
    password: string;
  };
};

export const test = base.extend<AuthFixtures>({
  testUser: async ({}, use) => {
    const user = {
      email: process.env.TEST_USER_EMAIL || 'isabella.thomas0@example.com',
      password: process.env.TEST_USER_PASSWORD || 'password123',
    };
    await use(user);
  },

  authenticatedPage: async ({ page, testUser }, use) => {
    // Navigate to login page
    await page.goto('/login');

    // Fill in credentials
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Verify we're logged in by checking localStorage
    const token = await page.evaluate(() => localStorage.getItem('token'));
    if (!token) {
      throw new Error('Login failed - no token in localStorage');
    }

    await use(page);

    // Cleanup: logout after test
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    });
  },
});

export { expect } from '@playwright/test';
