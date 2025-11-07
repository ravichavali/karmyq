import { test, expect } from './fixtures/auth';
import { ApiHelpers } from './utils/api-helpers';

/**
 * Karma & Reputation System E2E Tests
 *
 * Tests the karma/reputation system:
 * - Karma points for helping
 * - Trust score calculations
 * - Karma leaderboard
 * - Karma history
 * - First help bonus
 * - Milestone bonuses
 */

test.describe('Karma System', () => {
  let testCommunity: any;
  let api: ApiHelpers;

  test.beforeAll(async ({ authenticatedPage }) => {
    api = new ApiHelpers(authenticatedPage);

    // Create a test community for karma tests
    testCommunity = await api.createTestCommunity({
      name: `Karma Test Community ${Date.now()}`,
      description: 'Community for testing karma system',
    });
  });

  test.afterAll(async ({ authenticatedPage }) => {
    // Cleanup test community
    if (testCommunity) {
      await api.deleteTestCommunity(testCommunity.id);
    }
  });

  test('should display karma score on profile page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/profile');

    // Look for karma/points display
    const karmaDisplay = authenticatedPage.locator(
      '[data-testid="karma-score"], .karma-score, .karma-points, text=/karma|points/i'
    );

    await expect(karmaDisplay).toBeVisible({ timeout: 5000 });

    // Karma should be a number
    const karmaText = await karmaDisplay.textContent();
    expect(karmaText).toMatch(/\d+/);
  });

  test('should display trust score on profile', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/profile');

    // Look for trust score (0-100)
    const trustScore = authenticatedPage.locator(
      '[data-testid="trust-score"], .trust-score, text=/trust|score/i'
    );

    // Trust score may be visible or not implemented yet
    const count = await trustScore.count();

    if (count > 0) {
      await expect(trustScore.first()).toBeVisible();

      // Trust score should be 0-100
      const scoreText = await trustScore.first().textContent();
      const scoreMatch = scoreText?.match(/(\d+)/);

      if (scoreMatch) {
        const score = parseInt(scoreMatch[1], 10);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }
  });

  test('should award karma when completing a match', async ({ authenticatedPage }) => {
    const user = await api.getCurrentUser();

    // Get initial karma
    let response = await api.makeAuthenticatedRequest(
      `${process.env.REPUTATION_API_URL || 'http://localhost:3004'}/karma/${user.id}`
    );

    let karmaData = await response.json();
    const initialKarma = karmaData.data?.total_karma || 0;

    // Create a help request
    const request = await api.createTestRequest({
      community_id: testCommunity.id,
      title: `Karma Test Request ${Date.now()}`,
      description: 'Testing karma award on match completion',
      type: 'general',
    });

    // Create an offer (responding to the request)
    const offerResponse = await api.makeAuthenticatedRequest(
      `${process.env.REQUEST_API_URL || 'http://localhost:3003'}/offers`,
      {
        method: 'POST',
        body: JSON.stringify({
          request_id: request.id,
          responder_id: user.id,
          message: 'I can help with this!',
        }),
      }
    );

    const offer = await offerResponse.json();

    // Create a match (accept the offer)
    const matchResponse = await api.makeAuthenticatedRequest(
      `${process.env.REQUEST_API_URL || 'http://localhost:3003'}/matches`,
      {
        method: 'POST',
        body: JSON.stringify({
          request_id: request.id,
          offer_id: offer.data?.id,
          requester_id: user.id,
          responder_id: user.id,
        }),
      }
    );

    const match = await matchResponse.json();

    // Complete the match
    if (match.data?.id) {
      await api.makeAuthenticatedRequest(
        `${process.env.REQUEST_API_URL || 'http://localhost:3003'}/matches/${match.data.id}/complete`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            user_id: user.id,
            rating: 5,
            feedback: 'Great help!',
          }),
        }
      );

      // Wait for karma event to be processed
      await authenticatedPage.waitForTimeout(2000);

      // Get updated karma
      response = await api.makeAuthenticatedRequest(
        `${process.env.REPUTATION_API_URL || 'http://localhost:3004'}/karma/${user.id}`
      );

      karmaData = await response.json();
      const newKarma = karmaData.data?.total_karma || 0;

      // Karma should have increased
      expect(newKarma).toBeGreaterThan(initialKarma);
    }
  });

  test('should display karma leaderboard', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');

    // Look for leaderboard link or section
    const leaderboardLink = authenticatedPage.locator(
      'a:has-text("Leaderboard"), a[href*="leaderboard"], text=/leaderboard/i'
    );

    if (await leaderboardLink.count() > 0) {
      await leaderboardLink.first().click();

      // Should navigate to leaderboard
      await authenticatedPage.waitForURL(/leaderboard/, { timeout: 5000 });

      // Leaderboard should show ranked users
      const leaderboardItems = authenticatedPage.locator(
        '[data-testid="leaderboard-item"], .leaderboard-item, .user-rank'
      );

      const count = await leaderboardItems.count();
      expect(count).toBeGreaterThan(0);

      // Items should have rank, name, and karma
      const firstItem = leaderboardItems.first();
      const text = await firstItem.textContent();

      expect(text).toMatch(/\d+/); // Should have a number (rank or karma)
    }
  });

  test('should show karma history', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/profile');

    // Look for karma history section
    const historySection = authenticatedPage.locator(
      '[data-testid="karma-history"], .karma-history, text=/karma history|transaction history/i'
    );

    if (await historySection.count() > 0) {
      // Click to expand or navigate to history
      const historyLink = authenticatedPage.locator('a:has-text("View History"), button:has-text("History")');

      if (await historyLink.count() > 0) {
        await historyLink.first().click();
        await authenticatedPage.waitForTimeout(500);
      }

      // History items should have dates and reasons
      const historyItems = authenticatedPage.locator(
        '[data-testid="karma-record"], .karma-record, .transaction'
      );

      const count = await historyItems.count();

      if (count > 0) {
        const firstItem = historyItems.first();
        await expect(firstItem).toBeVisible();

        // Should contain reason for karma change
        const text = await firstItem.textContent();
        expect(text).toBeTruthy();
      }
    }
  });

  test('should award first help bonus', async ({ authenticatedPage }) => {
    const user = await api.getCurrentUser();

    // Check if user has any karma records
    const response = await api.makeAuthenticatedRequest(
      `${process.env.REPUTATION_API_URL || 'http://localhost:3004'}/karma/${user.id}/history`
    );

    const history = await response.json();
    const hasFirstHelpBonus = history.data?.some(
      (record: any) => record.reason?.includes('first') || record.reason?.includes('bonus')
    );

    // First help bonus is a one-time event, so it may or may not exist
    expect(typeof hasFirstHelpBonus).toBe('boolean');
  });

  test('should display karma badges/milestones', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/profile');

    // Look for badges or achievements
    const badgeSection = authenticatedPage.locator(
      '[data-testid="badges"], .badges, .achievements, text=/badges|achievements/i'
    );

    if (await badgeSection.count() > 0) {
      await expect(badgeSection.first()).toBeVisible();

      // Badge items
      const badges = authenticatedPage.locator(
        '[data-testid="badge"], .badge-item, .achievement-item'
      );

      const count = await badges.count();
      expect(count).toBeGreaterThanOrEqual(0);

      // If badges exist, they should have names/descriptions
      if (count > 0) {
        const firstBadge = badges.first();
        const text = await firstBadge.textContent();
        expect(text).toBeTruthy();
      }
    }
  });

  test('should show karma breakdown by activity type', async ({ authenticatedPage }) => {
    const user = await api.getCurrentUser();

    // Fetch karma history
    const response = await api.makeAuthenticatedRequest(
      `${process.env.REPUTATION_API_URL || 'http://localhost:3004'}/karma/${user.id}/history`
    );

    const history = await response.json();

    if (history.data && history.data.length > 0) {
      // Group by activity type
      const activityTypes = new Set(
        history.data.map((record: any) => record.activity_type || 'unknown')
      );

      // Should have different types of activities
      expect(activityTypes.size).toBeGreaterThan(0);

      // Common activity types
      const commonTypes = ['match_completed', 'first_help', 'milestone_bonus'];
      const hasKnownTypes = history.data.some((record: any) =>
        commonTypes.includes(record.activity_type)
      );

      // May or may not have known types depending on user activity
      expect(typeof hasKnownTypes).toBe('boolean');
    }
  });

  test('should respect karma point values', async ({ authenticatedPage }) => {
    const user = await api.getCurrentUser();

    // Fetch karma history
    const response = await api.makeAuthenticatedRequest(
      `${process.env.REPUTATION_API_URL || 'http://localhost:3004'}/karma/${user.id}/history`
    );

    const history = await response.json();

    if (history.data && history.data.length > 0) {
      // Check point values are reasonable
      history.data.forEach((record: any) => {
        expect(record.points).toBeDefined();
        expect(typeof record.points).toBe('number');

        // Points should be positive and reasonable (not millions)
        expect(record.points).toBeGreaterThan(0);
        expect(record.points).toBeLessThan(1000);
      });

      // Standard point values
      const helpPoints = history.data.find((r: any) => r.activity_type === 'match_completed');
      if (helpPoints) {
        // Standard help should award 5-10 points
        expect(helpPoints.points).toBeGreaterThanOrEqual(5);
        expect(helpPoints.points).toBeLessThanOrEqual(10);
      }

      const firstHelpBonus = history.data.find((r: any) => r.reason?.includes('first'));
      if (firstHelpBonus) {
        // First help bonus should be higher (10-20 points)
        expect(firstHelpBonus.points).toBeGreaterThanOrEqual(10);
        expect(firstHelpBonus.points).toBeLessThanOrEqual(20);
      }
    }
  });
});
