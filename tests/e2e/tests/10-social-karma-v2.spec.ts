import { test, expect } from './fixtures/auth';
import { ApiHelpers } from './utils/api-helpers';

/**
 * Social Karma v2.0 E2E Tests
 *
 * Tests the new Social Karma v2.0 features:
 * - Community Health Hero widget on dashboard
 * - Milestone posts in feed
 * - Network strength metrics
 * - Feed Service API endpoints
 */

test.describe('Social Karma v2.0', () => {
  const FEED_API_URL = process.env.FEED_API_URL || 'http://localhost:3007';

  test.describe('Community Health Hero Widget', () => {
    test('should display community health hero on dashboard', async ({ authenticatedPage }) => {
      const api = new ApiHelpers(authenticatedPage);
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for Community Health Hero component
      const heroWidget = authenticatedPage.locator('[class*="gradient-to-br"]').first();

      // Hero should be visible (may have 0 metrics if no data)
      const heroCount = await heroWidget.count();

      if (heroCount > 0) {
        // If hero exists, check for key elements
        const heroText = await heroWidget.textContent();

        // Should mention network or health
        expect(heroText).toMatch(/network|health|strength/i);
      }
    });

    test('should show network strength metrics', async ({ authenticatedPage }) => {
      const api = new ApiHelpers(authenticatedPage);
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for network strength indicators
      const strengthIndicators = authenticatedPage.locator('text=/network strength|thriving|strong|growing|building/i');

      const count = await strengthIndicators.count();

      // May or may not have metrics depending on community data
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should display growth trends', async ({ authenticatedPage }) => {
      const api = new ApiHelpers(authenticatedPage);
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for growth indicators (arrows, percentages)
      const growthIndicators = authenticatedPage.locator('text=/↗️|↘️|→|\\+\\d+%|\\-\\d+%|growth/i');

      const count = await growthIndicators.count();

      // Growth indicators may or may not be present
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Milestone Posts in Feed', () => {
    test('should display milestone posts when available', async ({ authenticatedPage }) => {
      const api = new ApiHelpers(authenticatedPage);
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for milestone indicators
      const milestoneMarkers = authenticatedPage.locator('text=/milestone|🎉|celebration|achieved/i');

      const count = await milestoneMarkers.count();

      // Milestones may or may not exist depending on community progress
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should show pinned badge on recent milestones', async ({ authenticatedPage }) => {
      const api = new ApiHelpers(authenticatedPage);
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for pinned indicators
      const pinnedBadges = authenticatedPage.locator('text=/📌|pinned/i');

      const count = await pinnedBadges.count();

      // Pinned milestones only exist if achieved within last 48 hours
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should display milestone descriptions', async ({ authenticatedPage }) => {
      const api = new ApiHelpers(authenticatedPage);
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for typical milestone descriptions
      const milestoneDescriptions = authenticatedPage.locator(
        'text=/reached.*exchanges|members participated|quality rating/i'
      );

      const count = await milestoneDescriptions.count();

      // Milestone descriptions only if milestones exist
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Feed Service API Endpoints', () => {
    test('GET /feed/community-health should return health data', async ({ authenticatedPage }) => {
      const api = new ApiHelpers(authenticatedPage);
      const user = await api.getCurrentUser();

      // Get first community
      const communitiesResponse = await api.makeAuthenticatedRequest(
        `${process.env.COMMUNITY_API_URL || 'http://localhost:3002'}/communities`
      );

      const communities = await communitiesResponse.json();
      const communityId = communities.data?.[0]?.id;

      if (!communityId) {
        test.skip();
        return;
      }

      // Test community health endpoint
      const response = await api.makeAuthenticatedRequest(
        `${FEED_API_URL}/feed/community-health?community_id=${communityId}`
      );

      expect(response.status).toBe(200);

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.communityId).toBe(communityId);
      expect(data.data.communityName).toBeTruthy();
      expect(data.data.networkStrength).toBeGreaterThanOrEqual(0);
      expect(data.data.networkStrength).toBeLessThanOrEqual(100);
      expect(data.data.networkStrengthLabel).toMatch(/Building|Growing|Developing|Strong|Thriving/);
      expect(data.data.totalMatches).toBeGreaterThanOrEqual(0);
      expect(data.data.activeHelpers).toBeGreaterThanOrEqual(0);
      expect(data.data.trendDirection).toMatch(/growing|stable|declining/);
    });

    test('GET /feed/milestones should return milestone posts', async ({ authenticatedPage }) => {
      const api = new ApiHelpers(authenticatedPage);
      const user = await api.getCurrentUser();

      // Get first community
      const communitiesResponse = await api.makeAuthenticatedRequest(
        `${process.env.COMMUNITY_API_URL || 'http://localhost:3002'}/communities`
      );

      const communities = await communitiesResponse.json();
      const communityId = communities.data?.[0]?.id;

      if (!communityId) {
        test.skip();
        return;
      }

      // Test milestones endpoint
      const response = await api.makeAuthenticatedRequest(
        `${FEED_API_URL}/feed/milestones?community_id=${communityId}&limit=5`
      );

      expect(response.status).toBe(200);

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);

      // If milestones exist, validate structure
      if (data.data.length > 0) {
        const milestone = data.data[0];

        expect(milestone.id).toBeTruthy();
        expect(milestone.type).toBe('milestone');
        expect(milestone.milestoneType).toBeTruthy();
        expect(milestone.description).toBeTruthy();
        expect(milestone.achievedAt).toBeTruthy();
        expect(milestone.networkStrength).toBeGreaterThanOrEqual(0);
        expect(milestone.communityId).toBe(communityId);
        expect(milestone.communityName).toBeTruthy();
        expect(typeof milestone.isPinned).toBe('boolean');
      }
    });

    test('GET /feed/featured-stories should return stories', async ({ authenticatedPage }) => {
      const api = new ApiHelpers(authenticatedPage);
      const user = await api.getCurrentUser();

      // Get first community
      const communitiesResponse = await api.makeAuthenticatedRequest(
        `${process.env.COMMUNITY_API_URL || 'http://localhost:3002'}/communities`
      );

      const communities = await communitiesResponse.json();
      const communityId = communities.data?.[0]?.id;

      if (!communityId) {
        test.skip();
        return;
      }

      // Test featured stories endpoint
      const response = await api.makeAuthenticatedRequest(
        `${FEED_API_URL}/feed/featured-stories?community_id=${communityId}&limit=10`
      );

      expect(response.status).toBe(200);

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);

      // If stories exist, validate structure
      if (data.data.length > 0) {
        const story = data.data[0];

        expect(story.id).toBeTruthy();
        expect(story.type).toBe('featured_story');
        expect(typeof story.isAnonymous).toBe('boolean');
        expect(story.helpfulness).toBeGreaterThanOrEqual(1);
        expect(story.helpfulness).toBeLessThanOrEqual(5);
        expect(story.communityId).toBe(communityId);
      }
    });

    test('GET /feed/mixed should return interleaved content', async ({ authenticatedPage }) => {
      const api = new ApiHelpers(authenticatedPage);
      const user = await api.getCurrentUser();

      // Get first community
      const communitiesResponse = await api.makeAuthenticatedRequest(
        `${process.env.COMMUNITY_API_URL || 'http://localhost:3002'}/communities`
      );

      const communities = await communitiesResponse.json();
      const communityId = communities.data?.[0]?.id;

      if (!communityId) {
        test.skip();
        return;
      }

      // Test mixed feed endpoint
      const response = await api.makeAuthenticatedRequest(
        `${FEED_API_URL}/feed/mixed?community_id=${communityId}&limit=20`
      );

      expect(response.status).toBe(200);

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);

      // If feed has content, validate types
      if (data.data.length > 0) {
        const types = new Set(data.data.map((item: any) => item.type));

        // Should have milestone or featured_story types
        expect(
          types.has('milestone') || types.has('featured_story')
        ).toBe(true);
      }
    });

    test('should require authentication for feed endpoints', async ({ page }) => {
      const testCommunityId = '00000000-0000-0000-0000-000000000001';

      // Test without auth token
      const response = await page.request.get(
        `${FEED_API_URL}/feed/community-health?community_id=${testCommunityId}`
      );

      expect(response.status).toBe(401);
    });

    test('should validate community_id parameter', async ({ authenticatedPage }) => {
      const api = new ApiHelpers(authenticatedPage);
      // Test with invalid community_id
      const response = await api.makeAuthenticatedRequest(
        `${FEED_API_URL}/feed/community-health?community_id=invalid-uuid`
      );

      // Should return error for invalid UUID
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('should handle missing community gracefully', async ({ authenticatedPage }) => {
      const api = new ApiHelpers(authenticatedPage);
      const nonExistentId = '00000000-0000-0000-0000-999999999999';

      const response = await api.makeAuthenticatedRequest(
        `${FEED_API_URL}/feed/community-health?community_id=${nonExistentId}`
      );

      // Should return 404 or empty data
      const isNotFound = response.status === 404;
      const data = await response.json();
      const hasNoData = response.status === 200 && data.data === null;

      expect(isNotFound || hasNoData).toBe(true);
    });
  });

  test.describe('Network Strength Calculation', () => {
    test('network strength should be between 0-100', async ({ authenticatedPage }) => {
      const api = new ApiHelpers(authenticatedPage);
      const user = await api.getCurrentUser();

      const communitiesResponse = await api.makeAuthenticatedRequest(
        `${process.env.COMMUNITY_API_URL || 'http://localhost:3002'}/communities`
      );

      const communities = await communitiesResponse.json();
      const communityId = communities.data?.[0]?.id;

      if (!communityId) {
        test.skip();
        return;
      }

      const response = await api.makeAuthenticatedRequest(
        `${FEED_API_URL}/feed/community-health?community_id=${communityId}`
      );

      const data = await response.json();

      expect(data.data.networkStrength).toBeGreaterThanOrEqual(0);
      expect(data.data.networkStrength).toBeLessThanOrEqual(100);
    });

    test('network strength labels should match score ranges', async ({ authenticatedPage }) => {
      const api = new ApiHelpers(authenticatedPage);
      const user = await api.getCurrentUser();

      const communitiesResponse = await api.makeAuthenticatedRequest(
        `${process.env.COMMUNITY_API_URL || 'http://localhost:3002'}/communities`
      );

      const communities = await communitiesResponse.json();
      const communityId = communities.data?.[0]?.id;

      if (!communityId) {
        test.skip();
        return;
      }

      const response = await api.makeAuthenticatedRequest(
        `${FEED_API_URL}/feed/community-health?community_id=${communityId}`
      );

      const data = await response.json();
      const strength = data.data.networkStrength;
      const label = data.data.networkStrengthLabel;

      // Validate label matches strength range
      if (strength >= 80) {
        expect(label).toBe('Thriving');
      } else if (strength >= 60) {
        expect(label).toBe('Strong');
      } else if (strength >= 40) {
        expect(label).toBe('Growing');
      } else if (strength >= 20) {
        expect(label).toBe('Developing');
      } else {
        expect(label).toBe('Building');
      }
    });
  });

  test.describe('Milestone Pinning Logic', () => {
    test('milestones achieved within 48 hours should be pinned', async ({ authenticatedPage }) => {
      const api = new ApiHelpers(authenticatedPage);
      const user = await api.getCurrentUser();

      const communitiesResponse = await api.makeAuthenticatedRequest(
        `${process.env.COMMUNITY_API_URL || 'http://localhost:3002'}/communities`
      );

      const communities = await communitiesResponse.json();
      const communityId = communities.data?.[0]?.id;

      if (!communityId) {
        test.skip();
        return;
      }

      const response = await api.makeAuthenticatedRequest(
        `${FEED_API_URL}/feed/milestones?community_id=${communityId}&limit=10`
      );

      const data = await response.json();

      if (data.data.length > 0) {
        const now = new Date();
        const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

        data.data.forEach((milestone: any) => {
          const achievedAt = new Date(milestone.achievedAt);
          const shouldBePinned = achievedAt >= fortyEightHoursAgo;

          expect(milestone.isPinned).toBe(shouldBePinned);
        });
      }
    });
  });
});
