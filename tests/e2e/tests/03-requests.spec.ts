import { test, expect } from './fixtures/auth';
import { ApiHelpers } from './utils/api-helpers';

/**
 * Help Request E2E Tests
 *
 * Tests the complete help request lifecycle:
 * - Creating a help request
 * - Viewing requests
 * - Responding to requests
 * - Managing request status
 */

test.describe('Help Requests', () => {
  // Helper function to create test community for tests that need it
  async function createTestCommunity(authenticatedPage: any) {
    const api = new ApiHelpers(authenticatedPage);
    return await api.createTestCommunity({
      name: `Request Test Community ${Date.now()}`,
      description: 'Community for testing requests',
    });
  }

  test('should create a help request', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/requests/new');

    // Fill in request form
    const timestamp = Date.now();
    await authenticatedPage.fill('input[name="title"]', `Test Request ${timestamp}`);
    await authenticatedPage.fill(
      'textarea[name="description"]',
      'I need help with testing'
    );

    // Select community
    const communitySelect = authenticatedPage.locator('select[name="community_id"]');
    if (await communitySelect.isVisible()) {
      await communitySelect.selectOption({ index: 1 });
    }

    // Select type/category
    const typeSelect = authenticatedPage.locator('select[name="type"], select[name="category"]');
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption({ index: 1 });
    }

    // Submit form
    await authenticatedPage.click('button[type="submit"]');

    // Should redirect to request detail or list
    await authenticatedPage.waitForURL(/\/requests/);

    // Verify request was created
    await expect(
      authenticatedPage.locator(`text=Test Request ${timestamp}`)
    ).toBeVisible({ timeout: 5000 });
  });

  test('should view request details', async ({ authenticatedPage }) => {
    const api = new ApiHelpers(authenticatedPage);

    // Create a test community
    const testCommunity = await createTestCommunity(authenticatedPage);

    // Create a test request via API
    const request = await api.createTestRequest({
      community_id: testCommunity.id,
      title: `Detail Test Request ${Date.now()}`,
      description: 'Testing request details view',
      type: 'general',
    });

    // Navigate to request page
    await authenticatedPage.goto(`/requests/${request.id}`);

    // Verify request details are displayed
    await expect(authenticatedPage.locator('h1, h2')).toContainText(request.title);
    await expect(authenticatedPage.locator('text=Testing request details view')).toBeVisible();

    // Cleanup
    await api.deleteTestCommunity(testCommunity.id);
  });

  test('should browse all requests', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/requests');

    await expect(authenticatedPage).toHaveTitle(/Requests/i);

    // Should have requests list or empty state
    const hasRequests = await authenticatedPage.locator('[data-testid="request-card"], .request-card').count() > 0;
    const hasEmptyState = await authenticatedPage.locator('text=/no requests|no help requests/i').count() > 0;

    expect(hasRequests || hasEmptyState).toBeTruthy();

    // Should have "Create Request" button
    const createButton = authenticatedPage.locator('text=/Create Request|New Request|Ask for Help/i');
    await expect(createButton).toBeVisible();
  });

  test('should filter requests by status', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/requests');

    // Look for status filter
    const statusFilter = authenticatedPage.locator('select[name="status"], [data-testid="status-filter"]');

    if (await statusFilter.isVisible()) {
      // Select "open" status
      await statusFilter.selectOption('open');

      // Wait for results to update
      await authenticatedPage.waitForTimeout(500);

      // Verify requests are displayed
      const requests = authenticatedPage.locator('[data-testid="request-card"], .request-card');
      const count = await requests.count();

      // All visible requests should have "open" status
      if (count > 0) {
        for (let i = 0; i < Math.min(count, 3); i++) {
          const request = requests.nth(i);
          const text = await request.textContent();
          expect(text?.toLowerCase()).toContain('open');
        }
      }
    }
  });

  test('should show request urgency levels', async ({ authenticatedPage }) => {
    const api = new ApiHelpers(authenticatedPage);

    // Create a test community
    const testCommunity = await createTestCommunity(authenticatedPage);

    // Create requests with different urgency levels
    const urgentRequest = await api.createTestRequest({
      community_id: testCommunity.id,
      title: 'Urgent Request',
      description: 'Very urgent help needed',
      type: 'general',
    });

    await authenticatedPage.goto(`/requests/${urgentRequest.id}`);

    // Check for urgency indicator (badge, color, etc.)
    const hasUrgencyIndicator =
      (await authenticatedPage.locator('text=/urgent|high|low|medium/i').count()) > 0 ||
      (await authenticatedPage.locator('[data-urgency], .urgency, .badge').count()) > 0;

    expect(hasUrgencyIndicator).toBeTruthy();

    // Cleanup
    await api.deleteTestCommunity(testCommunity.id);
  });
});
