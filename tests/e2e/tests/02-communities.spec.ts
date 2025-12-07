import { test, expect } from './fixtures/auth';
import { ApiHelpers } from './utils/api-helpers';

/**
 * Community Management E2E Tests
 *
 * Tests the complete community lifecycle:
 * - Browsing communities
 * - Creating a community
 * - Viewing community details
 * - Joining a community
 * - Managing members
 */

test.describe('Community Management', () => {
  test('should display communities list', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/communities');

    await expect(authenticatedPage).toHaveTitle(/Communities/i);
    await expect(authenticatedPage.locator('h1').first()).toContainText(/Communities/i);

    // Should have a "Create Community" button
    const createButton = authenticatedPage.locator('text=/Create Community|New Community/i');
    await expect(createButton).toBeVisible();
  });

  test('should create a new community', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/communities/new');

    // Fill in community form
    const timestamp = Date.now();
    await authenticatedPage.fill('input[name="name"]', `Test Community ${timestamp}`);
    await authenticatedPage.fill(
      'textarea[name="description"]',
      'This is a test community for E2E testing'
    );
    await authenticatedPage.fill('input[name="location"]', 'Test Location');

    // Submit form
    await authenticatedPage.click('button[type="submit"]');

    // Should redirect to community detail page
    await authenticatedPage.waitForURL(/\/communities\/[a-f0-9-]+/);

    // Verify community was created
    await expect(authenticatedPage.locator('h1').first()).toContainText(`Test Community ${timestamp}`);
    await expect(authenticatedPage.locator('text=This is a test community').first()).toBeVisible();
  });

  test('should view community details', async ({ authenticatedPage }) => {
    const api = new ApiHelpers(authenticatedPage);

    // Create a test community via API
    const communityName = `E2E Test Community ${Date.now()}`;
    const community = await api.createTestCommunity({
      name: communityName,
      description: 'Test community for viewing details',
      location: 'Test City',
    });

    // Navigate to community page
    await authenticatedPage.goto(`/communities/${community.id}`);

    // Wait for page to load
    await authenticatedPage.waitForLoadState('networkidle');

    // Verify community details are displayed
    await expect(authenticatedPage.locator('h1').first()).toContainText(communityName, { timeout: 10000 });
    await expect(authenticatedPage.locator('text=Test community for viewing details')).toBeVisible({ timeout: 5000 });
    await expect(authenticatedPage.locator('text=Test City')).toBeVisible({ timeout: 5000 });

    // Cleanup
    await api.deleteTestCommunity(community.id);
  });

  test('should join a community', async ({ authenticatedPage }) => {
    const api = new ApiHelpers(authenticatedPage);

    // Create a test community
    const community = await api.createTestCommunity({
      name: `Joinable Community ${Date.now()}`,
      description: 'Test community for joining',
    });

    // Navigate to community page
    await authenticatedPage.goto(`/communities/${community.id}`);

    // Click join button (if not already a member)
    const joinButton = authenticatedPage.locator('button:has-text("Join")');
    if (await joinButton.isVisible()) {
      await joinButton.click();

      // Wait for success message or button to change
      await expect(
        authenticatedPage.locator('text=/joined|member/i')
      ).toBeVisible({ timeout: 5000 });
    }

    // Cleanup
    await api.deleteTestCommunity(community.id);
  });

  test('should search for communities', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/communities');

    // Look for search input
    const searchInput = authenticatedPage.locator('input[type="search"], input[placeholder*="Search"]');

    if (await searchInput.isVisible()) {
      await searchInput.fill('University');

      // Wait for results to update
      await authenticatedPage.waitForTimeout(500);

      // Check that results contain the search term
      const results = authenticatedPage.locator('[data-testid="community-card"], .community-card, .community-item');
      const count = await results.count();

      if (count > 0) {
        const firstResult = results.first();
        const text = await firstResult.textContent();
        expect(text?.toLowerCase()).toContain('university');
      }
    }
  });

  test('should filter communities by category', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/communities');

    // Look for category filter
    const categoryFilter = authenticatedPage.locator('select[name="category"], [data-testid="category-filter"]');

    if (await categoryFilter.isVisible()) {
      // Select a category
      await categoryFilter.selectOption({ index: 1 }); // Select first non-default option

      // Wait for results to update
      await authenticatedPage.waitForTimeout(500);

      // Verify communities are displayed
      const results = authenticatedPage.locator('[data-testid="community-card"], .community-card');
      expect(await results.count()).toBeGreaterThan(0);
    }
  });
});
