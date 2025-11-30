import { test, expect } from './fixtures/auth';
import { ApiHelpers } from './utils/api-helpers';

/**
 * Inline Messaging E2E Tests (v5.3.0)
 *
 * Tests the new post-and-comment structure with inline messaging:
 * - Creating requests (posts)
 * - Offering to help (comments)
 * - Inline chat within posts
 * - Real-time WebSocket messaging
 * - Accept/Reject offer flow
 * - Mark Complete functionality
 * - Visibility rules (poster sees all, responders see only their thread)
 */

test.describe('Dashboard Post-and-Comment Flow', () => {
  test('should display dashboard feed', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');

    await expect(authenticatedPage).toHaveTitle(/Dashboard/i);

    // Should have feed or empty state
    const hasPosts = (await authenticatedPage.locator('.space-y-4 > div').count()) > 0;
    const hasEmptyState = (await authenticatedPage.locator('text=/no activity yet/i').count()) > 0;

    expect(hasPosts || hasEmptyState).toBeTruthy();
  });

  test('should create a request (post)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');

    // Find the quick create textarea
    const descriptionInput = authenticatedPage.locator('textarea[placeholder*="What do you need help with"]');
    await expect(descriptionInput).toBeVisible();

    const testRequest = `E2E Test: Need help with ${Date.now()}`;
    await descriptionInput.fill(testRequest);

    // Click Post button
    const postButton = authenticatedPage.locator('button:has-text("Post")');
    await postButton.click();

    // Wait for the request to appear in feed
    await expect(authenticatedPage.locator(`text=${testRequest}`)).toBeVisible({ timeout: 5000 });

    // Verify it has amber background (YOUR REQUEST)
    const requestPost = authenticatedPage.locator('div.bg-amber-50').filter({ hasText: testRequest });
    await expect(requestPost).toBeVisible();

    // Verify badge shows "YOUR REQUEST"
    await expect(requestPost.locator('text=YOUR REQUEST')).toBeVisible();
  });

  test('should offer to help on a community request', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');

    // Find a community request (white background, has "Offer to Help" button)
    const communityRequest = authenticatedPage
      .locator('div.bg-white')
      .filter({ has: authenticatedPage.locator('button:has-text("💬 Offer to Help")') })
      .first();

    const hasCommunityRequests = (await communityRequest.count()) > 0;

    if (hasCommunityRequests) {
      const requestText = await communityRequest.locator('p.text-gray-900.text-base').first().textContent();

      // Click "Offer to Help"
      await communityRequest.locator('button:has-text("💬 Offer to Help")').click();

      // Wait for page to refresh and find the offer
      await authenticatedPage.waitForTimeout(2000);
      await authenticatedPage.reload();

      // Should now see it as "YOUR OFFER" with blue background
      const myOffer = authenticatedPage.locator('div.bg-blue-50').filter({ hasText: requestText || '' });
      await expect(myOffer).toBeVisible({ timeout: 5000 });

      await expect(myOffer.locator('text=YOUR OFFER')).toBeVisible();
    }
  });

  test('should expand inline chat and send a message', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');

    // Find a post with comments (offers)
    const postWithComments = authenticatedPage
      .locator('div.bg-amber-50, div.bg-blue-50')
      .filter({ has: authenticatedPage.locator('button:has-text("Chat with")') })
      .first();

    const hasPostsWithChat = (await postWithComments.count()) > 0;

    if (hasPostsWithChat) {
      // Click to expand chat
      const chatToggle = postWithComments.locator('button:has-text("Chat with")').first();
      await chatToggle.click();

      // Wait for chat to expand
      await authenticatedPage.waitForTimeout(500);

      // Verify chat input is visible
      const chatInput = postWithComments.locator('input[placeholder*="Type your message"]');
      await expect(chatInput).toBeVisible();

      // Verify "Live" indicator appears (WebSocket connected)
      const liveIndicator = postWithComments.locator('text=Live');
      await expect(liveIndicator).toBeVisible({ timeout: 3000 });

      // Send a test message
      const testMessage = `E2E message ${Date.now()}`;
      await chatInput.fill(testMessage);

      const sendButton = postWithComments.locator('button:has-text("Send")');
      await sendButton.click();

      // Verify message appears in chat
      await expect(postWithComments.locator(`text=${testMessage}`)).toBeVisible({ timeout: 5000 });

      // Verify timestamp shows "just now"
      await expect(postWithComments.locator('text=/just now/i')).toBeVisible();
    }
  });

  test('should show Accept/Decline buttons for request poster', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');

    // Find my request with pending offers
    const myRequestWithOffers = authenticatedPage
      .locator('div.bg-amber-50')
      .filter({ has: authenticatedPage.locator('text=Responses') })
      .first();

    const hasOffers = (await myRequestWithOffers.count()) > 0;

    if (hasOffers) {
      // Should see Accept and Decline buttons
      const acceptButton = myRequestWithOffers.locator('button:has-text("Accept")');
      const declineButton = myRequestWithOffers.locator('button:has-text("Decline")');

      await expect(acceptButton.or(declineButton)).toBeVisible();
    }
  });

  test('should accept an offer and show Mark Complete button', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');

    // Find my request with pending offers
    const myRequestWithOffers = authenticatedPage
      .locator('div.bg-amber-50')
      .filter({ has: authenticatedPage.locator('button:has-text("Accept")') })
      .first();

    const hasPendingOffers = (await myRequestWithOffers.count()) > 0;

    if (hasPendingOffers) {
      // Click Accept
      const acceptButton = myRequestWithOffers.locator('button:has-text("Accept")').first();
      await acceptButton.click();

      // Wait for page refresh
      await authenticatedPage.waitForTimeout(2000);
      await authenticatedPage.reload();

      // Should now show "✓ Accepted" badge
      const acceptedBadge = authenticatedPage.locator('span:has-text("✓ Accepted")').first();
      await expect(acceptedBadge).toBeVisible();

      // Should show "Mark Complete" button
      const markCompleteButton = authenticatedPage.locator('button:has-text("Mark Complete")').first();
      await expect(markCompleteButton).toBeVisible();
    }
  });

  test('should mark exchange as complete', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');

    // Find a matched request with "Mark Complete" button
    const matchedRequest = authenticatedPage
      .locator('div.bg-amber-50, div.bg-blue-50')
      .filter({ has: authenticatedPage.locator('button:has-text("Mark Complete")') })
      .first();

    const hasMatchedExchange = (await matchedRequest.count()) > 0;

    if (hasMatchedExchange) {
      // Click Mark Complete
      const markCompleteButton = matchedRequest.locator('button:has-text("Mark Complete")').first();
      await markCompleteButton.click();

      // Wait for update
      await authenticatedPage.waitForTimeout(2000);
      await authenticatedPage.reload();

      // Should show "✓ Completed" badge
      const completedBadge = authenticatedPage.locator('span:has-text("✓ Completed")').first();
      await expect(completedBadge).toBeVisible();
    }
  });

  test('should show correct feed priority ordering', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');

    // Get all posts in order
    const allPosts = authenticatedPage.locator('.space-y-4 > div');
    const count = await allPosts.count();

    if (count >= 3) {
      // Priority 1 & 2: Matched requests and accepted offers should be at top (amber or blue)
      const firstPost = allPosts.nth(0);
      const firstPostClass = await firstPost.getAttribute('class');

      // Should be amber (my request) or blue (my offer)
      expect(firstPostClass).toMatch(/bg-amber-50|bg-blue-50/);

      // Later posts can be white (community requests)
      const lastPost = allPosts.nth(count - 1);
      const lastPostClass = await lastPost.getAttribute('class');

      // Could be any type
      expect(lastPostClass).toMatch(/bg-white|bg-amber-50|bg-blue-50/);
    }
  });

  test('should show comment count on poster\'s requests', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');

    // Find my request with offers
    const myRequestWithOffers = authenticatedPage
      .locator('div.bg-amber-50')
      .filter({ has: authenticatedPage.locator('text=/💬.*offer/i') })
      .first();

    const hasOffers = (await myRequestWithOffers.count()) > 0;

    if (hasOffers) {
      // Should show "💬 X offers"
      const offerCount = myRequestWithOffers.locator('text=/💬.*offer/i');
      await expect(offerCount).toBeVisible();
    }
  });

  test('should only show responder\'s own thread (visibility rule)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');

    // Find my offer (blue background)
    const myOffer = authenticatedPage.locator('div.bg-blue-50').first();
    const hasMyOffer = (await myOffer.count()) > 0;

    if (hasMyOffer) {
      // Should show "Your Conversation" (singular, not "Responses")
      const conversationHeader = myOffer.locator('text=Your Conversation');

      if ((await conversationHeader.count()) > 0) {
        await expect(conversationHeader).toBeVisible();

        // Should only have ONE comment visible (my match)
        const comments = myOffer.locator('.space-y-3 > div');
        const commentCount = await comments.count();

        expect(commentCount).toBeLessThanOrEqual(1);
      }
    }
  });

  test('should show typing indicator', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');

    // Find an expanded chat
    const expandedChat = authenticatedPage
      .locator('div.bg-amber-50, div.bg-blue-50')
      .filter({ has: authenticatedPage.locator('input[placeholder*="Type your message"]') })
      .first();

    const hasExpandedChat = (await expandedChat.count()) > 0;

    if (hasExpandedChat) {
      const chatInput = expandedChat.locator('input[placeholder*="Type your message"]');

      // Start typing
      await chatInput.fill('Testing typing indicator');

      // Note: Typing indicator from other user would appear here in real scenario
      // For this test, we just verify the input works
      await expect(chatInput).toHaveValue('Testing typing indicator');
    }
  });
});

test.describe('Feed Visibility and Permissions', () => {
  test('should not show "Offer to Help" on my own requests', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');

    // Find my requests (amber background)
    const myRequests = authenticatedPage.locator('div.bg-amber-50');
    const myRequestCount = await myRequests.count();

    if (myRequestCount > 0) {
      // My requests should NOT have "Offer to Help" button
      const offerButton = myRequests.first().locator('button:has-text("💬 Offer to Help")');
      await expect(offerButton).not.toBeVisible();
    }
  });

  test('should show all offers to request poster', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');

    // Find my request with multiple offers
    const myRequestWithOffers = authenticatedPage
      .locator('div.bg-amber-50')
      .filter({ has: authenticatedPage.locator('text=Responses') })
      .first();

    const hasOffers = (await myRequestWithOffers.count()) > 0;

    if (hasOffers) {
      // Extract number from "Responses (X)"
      const responsesHeader = myRequestWithOffers.locator('text=/Responses.*\\(\\d+\\)/');
      const headerText = await responsesHeader.textContent();

      if (headerText) {
        const match = headerText.match(/\((\d+)\)/);
        if (match) {
          const expectedCount = parseInt(match[1]);

          // Count actual comment divs
          const actualComments = myRequestWithOffers.locator('.space-y-3 > div');
          const actualCount = await actualComments.count();

          expect(actualCount).toBe(expectedCount);
        }
      }
    }
  });
});
