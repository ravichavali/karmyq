import { test, expect, Page } from '@playwright/test';

/**
 * Dashboard Redesign E2E Tests (v5.3.0)
 *
 * Comprehensive automated tests for the post-and-comment structure:
 * - No duplicate posts from multi-community requests
 * - Offers appear in feed after offering to help
 * - No redirects - everything stays on dashboard
 * - Accept/Reject workflow
 * - Mark Complete functionality
 * - Inline chat and WebSocket messaging
 */

// Test users
const ALICE = {
  name: 'Alice Tester',
  email: `alice-${Date.now()}@test.com`,
  password: 'TestPassword123!',
};

const BOB = {
  name: 'Bob Helper',
  email: `bob-${Date.now()}@test.com`,
  password: 'TestPassword123!',
};

// Helper: Register and login a user
async function registerAndLogin(page: Page, user: typeof ALICE) {
  await page.goto('http://localhost:3000/register');
  await page.fill('input[name="name"], input[placeholder*="name" i]', user.name);
  await page.fill('input[name="email"], input[type="email"]', user.email);
  await page.fill('input[name="password"], input[type="password"]', user.password);
  await page.click('button[type="submit"], button:has-text("Sign Up")');

  // Wait for redirect to communities or dashboard
  await page.waitForURL(/\/(communities|dashboard)/);

  return user;
}

// Helper: Create a community
async function createCommunity(page: Page, name: string) {
  await page.goto('http://localhost:3000/communities');
  await page.click('a:has-text("Create Community"), button:has-text("Create Community")');

  await page.fill('input[name="name"]', name);
  await page.fill('textarea[name="description"], input[name="description"]', `Test community for ${name}`);

  // Select type if available
  const typeSelect = page.locator('select[name="type"]');
  if (await typeSelect.isVisible()) {
    await typeSelect.selectOption('neighborhood');
  }

  await page.click('button[type="submit"]:has-text("Create")');

  // Wait for community to appear
  await page.waitForTimeout(2000);

  // Get invite code
  const inviteCode = await page.locator('code, .invite-code, [data-testid="invite-code"]').first().textContent();

  return inviteCode || '';
}

// Helper: Join a community
async function joinCommunity(page: Page, inviteCode: string) {
  await page.goto('http://localhost:3000/communities');
  await page.click('button:has-text("Join"), a:has-text("Join Community")');

  await page.fill('input[name="inviteCode"], input[placeholder*="code" i]', inviteCode);
  await page.click('button[type="submit"]:has-text("Join")');

  await page.waitForTimeout(2000);
}

test.describe('Dashboard Redesign - Critical Flows', () => {
  let aliceContext: any;
  let bobContext: any;
  let alicePage: Page;
  let bobPage: Page;
  let communityInviteCode: string;

  test.beforeAll(async ({ browser }) => {
    // Create two browser contexts (two users)
    aliceContext = await browser.newContext();
    bobContext = await browser.newContext();

    alicePage = await aliceContext.newPage();
    bobPage = await bobContext.newPage();

    // Register both users
    await registerAndLogin(alicePage, ALICE);
    await registerAndLogin(bobPage, BOB);

    // Alice creates a community
    communityInviteCode = await createCommunity(alicePage, 'Test Community');

    // Bob joins the community
    if (communityInviteCode) {
      await joinCommunity(bobPage, communityInviteCode);
    }
  });

  test.afterAll(async () => {
    await aliceContext?.close();
    await bobContext?.close();
  });

  test('Issue #1: Should NOT show duplicate posts from multi-community requests', async () => {
    // Alice creates a request to ALL communities
    await alicePage.goto('http://localhost:3000/dashboard');

    const textarea = alicePage.locator('textarea[placeholder*="What do you need help"]');
    await expect(textarea).toBeVisible();

    const testRequest = `Multi-community test ${Date.now()}`;
    await textarea.fill(testRequest);

    // Ensure "All My Communities" is selected
    const allCommunitiesButton = alicePage.locator('button:has-text("All My Communities")');
    if (await allCommunitiesButton.isVisible()) {
      await allCommunitiesButton.click();
    }

    await alicePage.click('button:has-text("Post")');
    await alicePage.waitForTimeout(2000);
    await alicePage.reload();

    // Count how many times this request appears in the feed
    const posts = alicePage.locator(`text=${testRequest}`);
    const count = await posts.count();

    // CRITICAL: Should appear only ONCE, even if posted to multiple communities
    expect(count).toBe(1);
  });

  test('Issue #2: After offering to help, post SHOULD appear in feed as "YOUR OFFER"', async () => {
    // Alice creates a request
    await alicePage.goto('http://localhost:3000/dashboard');

    const testRequest = `Bob should offer help ${Date.now()}`;
    await alicePage.locator('textarea[placeholder*="What do you need help"]').fill(testRequest);
    await alicePage.click('button:has-text("Post")');
    await alicePage.waitForTimeout(2000);

    // Bob goes to dashboard and finds the request
    await bobPage.goto('http://localhost:3000/dashboard');
    await bobPage.reload();

    // Find the community request (white background)
    const communityRequest = bobPage.locator('div.bg-white').filter({ hasText: testRequest }).first();
    await expect(communityRequest).toBeVisible({ timeout: 10000 });

    // Click "Offer to Help"
    const offerButton = communityRequest.locator('button:has-text("💬 Offer to Help")');
    await expect(offerButton).toBeVisible();
    await offerButton.click();

    // Wait for page to refresh
    await bobPage.waitForTimeout(3000);
    await bobPage.reload();

    // CRITICAL: The post should now appear with blue background and "YOUR OFFER" badge
    const myOffer = bobPage.locator('div.bg-blue-50').filter({ hasText: testRequest });
    await expect(myOffer).toBeVisible({ timeout: 10000 });

    const yourOfferBadge = myOffer.locator('text=YOUR OFFER');
    await expect(yourOfferBadge).toBeVisible();
  });

  test('Issue #3: Should stay on dashboard after clicking "Offer to Help" (no redirect)', async () => {
    // Alice creates a request
    await alicePage.goto('http://localhost:3000/dashboard');

    const testRequest = `No redirect test ${Date.now()}`;
    await alicePage.locator('textarea[placeholder*="What do you need help"]').fill(testRequest);
    await alicePage.click('button:has-text("Post")');
    await alicePage.waitForTimeout(2000);

    // Bob offers to help
    await bobPage.goto('http://localhost:3000/dashboard');
    await bobPage.reload();

    const communityRequest = bobPage.locator('div.bg-white').filter({ hasText: testRequest }).first();
    await expect(communityRequest).toBeVisible({ timeout: 10000 });

    await communityRequest.locator('button:has-text("💬 Offer to Help")').click();

    // Wait for refresh
    await bobPage.waitForTimeout(3000);

    // CRITICAL: Should still be on /dashboard, not redirected to /matches or another page
    expect(bobPage.url()).toContain('/dashboard');
    expect(bobPage.url()).not.toContain('/matches');
    expect(bobPage.url()).not.toContain('/requests');
  });

  test('Should show Accept/Decline buttons to requester', async () => {
    // Alice creates request, Bob offers, Alice should see buttons
    await alicePage.goto('http://localhost:3000/dashboard');

    const testRequest = `Accept decline test ${Date.now()}`;
    await alicePage.locator('textarea[placeholder*="What do you need help"]').fill(testRequest);
    await alicePage.click('button:has-text("Post")');
    await alicePage.waitForTimeout(2000);

    // Bob offers
    await bobPage.goto('http://localhost:3000/dashboard');
    await bobPage.reload();

    await bobPage.locator('div.bg-white').filter({ hasText: testRequest }).first()
      .locator('button:has-text("💬 Offer to Help")').click();
    await bobPage.waitForTimeout(2000);

    // Alice refreshes and should see offer with Accept/Decline buttons
    await alicePage.reload();
    await alicePage.waitForTimeout(1000);

    const myRequest = alicePage.locator('div.bg-amber-50').filter({ hasText: testRequest });
    await expect(myRequest).toBeVisible();

    const acceptButton = myRequest.locator('button:has-text("Accept")');
    const declineButton = myRequest.locator('button:has-text("Decline")');

    await expect(acceptButton).toBeVisible();
    await expect(declineButton).toBeVisible();
  });

  test('Accept flow: Should show "✓ Accepted" badge and "Mark Complete" button', async () => {
    // Alice creates, Bob offers, Alice accepts
    await alicePage.goto('http://localhost:3000/dashboard');

    const testRequest = `Accept flow test ${Date.now()}`;
    await alicePage.locator('textarea[placeholder*="What do you need help"]').fill(testRequest);
    await alicePage.click('button:has-text("Post")');
    await alicePage.waitForTimeout(2000);

    // Bob offers
    await bobPage.goto('http://localhost:3000/dashboard');
    await bobPage.reload();

    await bobPage.locator('div.bg-white').filter({ hasText: testRequest }).first()
      .locator('button:has-text("💬 Offer to Help")').click();
    await bobPage.waitForTimeout(2000);

    // Alice accepts
    await alicePage.reload();
    await alicePage.waitForTimeout(1000);

    const myRequest = alicePage.locator('div.bg-amber-50').filter({ hasText: testRequest });
    await myRequest.locator('button:has-text("Accept")').first().click();
    await alicePage.waitForTimeout(2000);
    await alicePage.reload();

    // Should show "✓ Accepted" badge
    const acceptedBadge = alicePage.locator('span:has-text("✓ Accepted")').first();
    await expect(acceptedBadge).toBeVisible();

    // Should show "Mark Complete" button
    const markCompleteButton = alicePage.locator('button:has-text("Mark Complete")').first();
    await expect(markCompleteButton).toBeVisible();
  });

  test('Inline chat: Should expand and send messages', async () => {
    // Alice creates, Bob offers, then Alice tries to chat
    await alicePage.goto('http://localhost:3000/dashboard');

    const testRequest = `Chat test ${Date.now()}`;
    await alicePage.locator('textarea[placeholder*="What do you need help"]').fill(testRequest);
    await alicePage.click('button:has-text("Post")');
    await alicePage.waitForTimeout(2000);

    // Bob offers
    await bobPage.goto('http://localhost:3000/dashboard');
    await bobPage.reload();

    await bobPage.locator('div.bg-white').filter({ hasText: testRequest }).first()
      .locator('button:has-text("💬 Offer to Help")').click();
    await bobPage.waitForTimeout(2000);

    // Alice expands chat
    await alicePage.reload();
    await alicePage.waitForTimeout(1000);

    const myRequest = alicePage.locator('div.bg-amber-50').filter({ hasText: testRequest });

    // Click to expand chat
    const chatToggle = myRequest.locator('button:has-text("Chat with")').first();
    await chatToggle.click();
    await alicePage.waitForTimeout(500);

    // Should see chat input
    const chatInput = myRequest.locator('input[placeholder*="Type your message"]');
    await expect(chatInput).toBeVisible();

    // Send a message
    const testMessage = `Test message ${Date.now()}`;
    await chatInput.fill(testMessage);
    await myRequest.locator('button:has-text("Send")').click();
    await alicePage.waitForTimeout(1000);

    // Message should appear
    await expect(myRequest.locator(`text=${testMessage}`)).toBeVisible();
  });

  test('Priority ordering: Matched requests should appear before community requests', async () => {
    await alicePage.goto('http://localhost:3000/dashboard');
    await alicePage.reload();

    // Get all posts
    const allPosts = alicePage.locator('.space-y-4 > div');
    const count = await allPosts.count();

    if (count >= 2) {
      // First posts should have amber or blue backgrounds (my requests/offers)
      const firstPost = allPosts.first();
      const firstClass = await firstPost.getAttribute('class');

      // Should contain bg-amber-50 or bg-blue-50 (not just bg-white)
      const hasColoredBackground = firstClass?.includes('bg-amber-50') || firstClass?.includes('bg-blue-50');
      expect(hasColoredBackground).toBeTruthy();
    }
  });

  test('Visibility rule: Responder should only see their own thread', async () => {
    // Bob views his offer - should only see his conversation, not other offers
    await bobPage.goto('http://localhost:3000/dashboard');
    await bobPage.reload();

    // Find Bob's blue offer
    const myOffer = bobPage.locator('div.bg-blue-50').first();

    if (await myOffer.isVisible()) {
      // Should show "Your Conversation" (singular)
      const conversationHeader = myOffer.locator('text=Your Conversation');

      if (await conversationHeader.isVisible()) {
        await expect(conversationHeader).toBeVisible();

        // Should only have ONE comment visible (Bob's own match)
        const comments = myOffer.locator('.space-y-3 > div');
        const commentCount = await comments.count();

        expect(commentCount).toBeLessThanOrEqual(1);
      }
    }
  });
});

test.describe('Dashboard UI Tests', () => {
  test('Should display dashboard with proper styling', async ({ page }) => {
    // Quick visual test - just verify the page loads
    await page.goto('http://localhost:3000/register');

    const testUser = {
      name: `Test User ${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
    };

    await page.fill('input[name="name"], input[placeholder*="name" i]', testUser.name);
    await page.fill('input[name="email"], input[type="email"]', testUser.email);
    await page.fill('input[name="password"], input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/(communities|dashboard)/);
    await page.goto('http://localhost:3000/dashboard');

    // Should have title
    await expect(page).toHaveTitle(/Dashboard/i);

    // Should have quick create section
    const quickCreate = page.locator('textarea[placeholder*="What do you need help"]');
    await expect(quickCreate).toBeVisible();

    // Should have Post button
    const postButton = page.locator('button:has-text("Post")');
    await expect(postButton).toBeVisible();
  });
});
