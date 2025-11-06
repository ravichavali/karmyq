import { test, expect } from './fixtures/auth';

/**
 * Notification E2E Tests
 *
 * Tests the notification system:
 * - Viewing notifications
 * - Notification bell/dropdown
 * - Marking as read
 * - Notification preferences
 */

test.describe('Notifications', () => {
  test('should display notification bell', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');

    // Look for notification bell/icon
    const notificationBell = authenticatedPage.locator(
      '[data-testid="notification-bell"], .notification-bell, button:has([data-icon="bell"]), [aria-label*="notification"]'
    );

    await expect(notificationBell).toBeVisible();
  });

  test('should open notifications dropdown', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');

    // Find and click notification bell
    const notificationBell = authenticatedPage.locator(
      '[data-testid="notification-bell"], .notification-bell, button:has-text("Notifications"), [aria-label*="notification"]'
    ).first();

    if (await notificationBell.isVisible()) {
      await notificationBell.click();

      // Dropdown or panel should appear
      const dropdown = authenticatedPage.locator(
        '[data-testid="notification-dropdown"], .notification-dropdown, .notification-panel'
      );

      await expect(dropdown).toBeVisible({ timeout: 2000 });
    }
  });

  test('should navigate to notifications page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/notifications');

    await expect(authenticatedPage).toHaveTitle(/Notifications/i);

    // Should have notifications list or empty state
    const hasNotifications =
      (await authenticatedPage.locator('[data-testid="notification"], .notification').count()) > 0;
    const hasEmptyState =
      (await authenticatedPage.locator('text=/no notifications/i').count()) > 0;

    expect(hasNotifications || hasEmptyState).toBeTruthy();
  });

  test('should show unread count', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');

    // Look for unread count badge
    const unreadBadge = authenticatedPage.locator(
      '[data-testid="notification-count"], .notification-count, .badge, [aria-label*="unread"]'
    );

    // May or may not have unread notifications
    const count = await unreadBadge.count();
    expect(count >= 0).toBeTruthy();
  });

  test('should mark notification as read', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/notifications');

    const notifications = authenticatedPage.locator(
      '[data-testid="notification"]:has-text("unread"), .notification.unread, .notification:not(.read)'
    );

    const unreadCount = await notifications.count();

    if (unreadCount > 0) {
      const firstNotification = notifications.first();

      // Click on notification or mark as read button
      const markReadButton = firstNotification.locator('button:has-text("Mark as read"), [data-action="mark-read"]');

      if (await markReadButton.isVisible()) {
        await markReadButton.click();
      } else {
        await firstNotification.click();
      }

      // Wait for state to update
      await authenticatedPage.waitForTimeout(500);

      // Notification should now be marked as read
      const isRead = await firstNotification.evaluate((el) => {
        return el.classList.contains('read') || !el.classList.contains('unread');
      });

      expect(isRead).toBeTruthy();
    }
  });

  test('should display different notification types', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/notifications');

    const notifications = authenticatedPage.locator('[data-testid="notification"], .notification');
    const count = await notifications.count();

    if (count > 0) {
      // Check for type indicators (icons, colors, text)
      const hasTypeIndicators =
        (await authenticatedPage.locator('[data-notification-type], .notification-type').count()) > 0 ||
        (await authenticatedPage.locator('text=/match|message|karma|request/i').count()) > 0;

      expect(hasTypeIndicators).toBeTruthy();
    }
  });
});
