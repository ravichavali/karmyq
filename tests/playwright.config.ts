import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for Karmyq v5.1.0
 *
 * Tests critical user flows:
 * - User authentication (login/signup)
 * - Community browsing and detail pages
 * - Dashboard/feed display
 * - Request creation and matching
 *
 * Prerequisites:
 * - All backend services running (docker-compose up)
 * - Frontend running on port 3000
 * - Test database seeded with fixtures
 */

export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Run tests in files in parallel
  fullyParallel: false, // Sequential for E2E to avoid race conditions

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : 1, // Always 1 worker for E2E tests

  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL for navigation
    baseURL: 'http://localhost:3000',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Maximum time each action can take
    actionTimeout: 10000,

    // Navigation timeout
    navigationTimeout: 30000,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run your local dev server before starting the tests
  // Note: Assumes docker-compose is already running
  // If you want Playwright to manage it, uncomment webServer below

  // webServer: {
  //   command: 'docker-compose -f infrastructure/docker/docker-compose.yml up',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120000, // 2 minutes for all services to start
  // },

  // Global timeout for each test
  timeout: 60000, // 1 minute per test

  // Expect timeout
  expect: {
    timeout: 5000,
  },
});
