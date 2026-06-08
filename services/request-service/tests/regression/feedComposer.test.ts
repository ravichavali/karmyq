/**
 * Unit Tests for Feed Composer - Feed Algorithm Logic
 * Following TDD principles: Test business logic in isolation
 *
 * Test Coverage:
 * - Feed composition ratio calculation
 * - Skill matching algorithm
 * - Request priority calculation
 * - User behavior detection
 * - Adjacent community discovery
 * - Content interleaving
 */

import { FeedComposer } from '../../src/services/feed/feedComposer';
import { query } from '../../src/database/db';

// Mock the database module
jest.mock('../../src/database/db');

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('FeedComposer - Algorithm Logic', () => {
  let feedComposer: FeedComposer;

  beforeEach(() => {
    jest.clearAllMocks();
    feedComposer = new FeedComposer();
  });

  describe('calculateFeedRatio - User Behavior Detection', () => {
    it('should return exploration ratio for new users (≤2 communities, ≤3 helps)', async () => {
      // Arrange: Mock new user behavior
      mockQuery
        // Recent helps count
        .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 } as any)
        // Communities count
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as any)
        // Skills
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
        // User registration
        .mockResolvedValueOnce({ rows: [{ created_at: new Date() }], rowCount: 1 } as any);

      // Act
      const ratio = await feedComposer.calculateFeedRatio('user-new');

      // Assert: New users get more exploration
      expect(ratio.your_communities).toBe(40);
      expect(ratio.suggested_requests).toBe(40);
      expect(ratio.broader_stories).toBe(20);
    });

    it('should return community-focused ratio for active users (>10 helps)', async () => {
      // Arrange: Mock active user behavior
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '15' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [{ skill: 'tech' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [{ created_at: new Date('2024-01-01') }], rowCount: 1 } as any);

      // Act
      const ratio = await feedComposer.calculateFeedRatio('user-active');

      // Assert: Active users see more from their communities
      expect(ratio.your_communities).toBe(70);
      expect(ratio.suggested_requests).toBe(20);
      expect(ratio.broader_stories).toBe(10);
    });

    it('should return balanced ratio for standard users', async () => {
      // Arrange: Mock standard user
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '6' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [{ skill: 'tech' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [{ created_at: new Date('2024-06-01') }], rowCount: 1 } as any);

      // Act
      const ratio = await feedComposer.calculateFeedRatio('user-standard');

      // Assert: Balanced distribution
      expect(ratio.your_communities).toBe(60);
      expect(ratio.suggested_requests).toBe(25);
      expect(ratio.broader_stories).toBe(15);
    });

    it('should handle edge case: exactly 3 helps (still new user)', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
        .mockResolvedValueOnce({ rows: [{ created_at: new Date() }], rowCount: 1 } as any);

      // Act
      const ratio = await feedComposer.calculateFeedRatio('user-edge');

      // Assert: ≤3 helps = exploration ratio
      expect(ratio.your_communities).toBe(40);
      expect(ratio.suggested_requests).toBe(40);
    });

    it('should handle edge case: exactly 10 helps (still standard user)', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
        .mockResolvedValueOnce({ rows: [{ created_at: new Date('2024-01-01') }], rowCount: 1 } as any);

      // Act
      const ratio = await feedComposer.calculateFeedRatio('user-edge');

      // Assert: 10 helps = still standard (not >10)
      expect(ratio.your_communities).toBe(60);
      expect(ratio.suggested_requests).toBe(25);
    });
  });

  describe('calculateSkillMatchScore - Skill Matching Algorithm', () => {
    it('should return 100% for perfect match (all skills matched)', () => {
      // Arrange
      const requiredSkills = ['javascript', 'react'];
      const userSkills = ['javascript', 'react', 'node'];

      // Act
      const score = (feedComposer as any).calculateSkillMatchScore(requiredSkills, userSkills);

      // Assert
      expect(score).toBe(100);
    });

    it('should return 50% for half match', () => {
      // Arrange
      const requiredSkills = ['javascript', 'python'];
      const userSkills = ['javascript', 'go'];

      // Act
      const score = (feedComposer as any).calculateSkillMatchScore(requiredSkills, userSkills);

      // Assert
      expect(score).toBe(50);
    });

    it('should return 0% for no match', () => {
      // Arrange
      const requiredSkills = ['python', 'django'];
      const userSkills = ['javascript', 'react'];

      // Act
      const score = (feedComposer as any).calculateSkillMatchScore(requiredSkills, userSkills);

      // Assert
      expect(score).toBe(0);
    });

    it('should return 50 (default) when no skills required', () => {
      // Arrange
      const requiredSkills: string[] = [];
      const userSkills = ['javascript', 'react'];

      // Act
      const score = (feedComposer as any).calculateSkillMatchScore(requiredSkills, userSkills);

      // Assert: Default score for no requirements
      expect(score).toBe(50);
    });

    it('should handle partial string matching (case-insensitive)', () => {
      // Arrange
      const requiredSkills = ['JavaScript'];
      const userSkills = ['javascript']; // Lowercase

      // Act
      const score = (feedComposer as any).calculateSkillMatchScore(requiredSkills, userSkills);

      // Assert: Case-insensitive match
      expect(score).toBe(100);
    });

    it('should handle substring matching (react includes React Native)', () => {
      // Arrange
      const requiredSkills = ['react'];
      const userSkills = ['React Native'];

      // Act
      const score = (feedComposer as any).calculateSkillMatchScore(requiredSkills, userSkills);

      // Assert: Substring match works
      expect(score).toBe(100);
    });

    it('should calculate 33% for 1 of 3 skills matched', () => {
      // Arrange
      const requiredSkills = ['javascript', 'python', 'go'];
      const userSkills = ['javascript', 'rust'];

      // Act
      const score = (feedComposer as any).calculateSkillMatchScore(requiredSkills, userSkills);

      // Assert: 1/3 ≈ 33%
      expect(score).toBe(33);
    });
  });

  describe('calculateRequestPriority - Priority Algorithm', () => {
    const baseRequest = {
      request_id: 'req-1',
      title: 'Test Request',
      description: 'Test',
      author_id: 'user-1',
      author_name: 'Test User',
      community_id: 'comm-1',
      community_name: 'Test Community',
      urgency: 'medium' as const,
      expected_duration: null,
      created_at: new Date(),
      offers_count: 0,
      required_skills: []
    };

    it('should calculate base priority of 80 for standard request', () => {
      // Arrange: Medium urgency, no offers, created now
      const request = { ...baseRequest };

      // Act
      const priority = (feedComposer as any).calculateRequestPriority(request);

      // Assert: 80 (base) + 5 (medium) + 15 (no offers) + 10 (< 2hrs) = 110
      expect(priority).toBeGreaterThan(80);
      expect(priority).toBeLessThanOrEqual(130);
    });

    it('should boost priority for urgent requests (+20)', () => {
      // Arrange
      const request = { ...baseRequest, urgency: 'urgent' as const };

      // Act
      const priority = (feedComposer as any).calculateRequestPriority(request);

      // Assert: Should include +20 for urgent
      expect(priority).toBeGreaterThanOrEqual(100);
    });

    it('should boost priority for high urgency (+10)', () => {
      // Arrange
      const request = { ...baseRequest, urgency: 'high' as const };

      // Act
      const priority = (feedComposer as any).calculateRequestPriority(request);

      // Assert: Should include +10 for high
      expect(priority).toBeGreaterThanOrEqual(90);
    });

    it('should boost priority for requests with no offers (+15)', () => {
      // Arrange
      const request = { ...baseRequest, offers_count: 0 };

      // Act
      const priority = (feedComposer as any).calculateRequestPriority(request);

      // Assert: No offers bonus included
      expect(priority).toBeGreaterThanOrEqual(95); // 80 + 5 (medium) + 15 (no offers)
    });

    it('should give smaller boost for 1 offer (+5)', () => {
      // Arrange: Created 25 hours ago to avoid recency bonus
      const dayOldRequest = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const request = { ...baseRequest, offers_count: 1, created_at: dayOldRequest };

      // Act
      const priority = (feedComposer as any).calculateRequestPriority(request);

      // Assert: 80 + 5 (medium) + 5 (one offer) = 90 (no recency boost)
      expect(priority).toBeGreaterThanOrEqual(85);
      expect(priority).toBe(90);
    });

    it('should NOT boost for 2+ offers', () => {
      // Arrange
      const request = { ...baseRequest, offers_count: 2 };

      // Act
      const priority = (feedComposer as any).calculateRequestPriority(request);

      // Assert: No offer boost
      expect(priority).toBeLessThan(100);
    });

    it('should boost priority for very recent requests (<2 hours)', () => {
      // Arrange: Created 1 hour ago
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const request = { ...baseRequest, created_at: oneHourAgo };

      // Act
      const priority = (feedComposer as any).calculateRequestPriority(request);

      // Assert: Includes +10 recency boost
      expect(priority).toBeGreaterThanOrEqual(100);
    });

    it('should give smaller boost for recent requests (<24 hours)', () => {
      // Arrange: Created 12 hours ago
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
      const request = { ...baseRequest, created_at: twelveHoursAgo };

      // Act
      const priority = (feedComposer as any).calculateRequestPriority(request);

      // Assert: Includes +5 recency boost
      expect(priority).toBeGreaterThanOrEqual(85);
      expect(priority).toBeLessThan(110);
    });

    it('should NOT boost for old requests (>24 hours)', () => {
      // Arrange: Created 48 hours ago
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const request = { ...baseRequest, created_at: twoDaysAgo };

      // Act
      const priority = (feedComposer as any).calculateRequestPriority(request);

      // Assert: No recency boost
      expect(priority).toBeLessThanOrEqual(100);
    });

    it('should calculate maximum priority for perfect conditions', () => {
      // Arrange: Urgent, no offers, just created
      const request = {
        ...baseRequest,
        urgency: 'urgent' as const,
        offers_count: 0,
        created_at: new Date()
      };

      // Act
      const priority = (feedComposer as any).calculateRequestPriority(request);

      // Assert: 80 (base) + 20 (urgent) + 15 (no offers) + 10 (recent) = 125
      expect(priority).toBeGreaterThanOrEqual(120);
    });
  });

  describe('generateSuggestionReason - Explanation Generation', () => {
    const mockAdjCommunity = {
      community_id: 1,
      community_name: 'Tech Helpers',
      relevance_score: 10
    };

    const mockUserBehavior = {
      recent_helps_count: 5,
      communities_count: 2,
      skills: ['javascript', 'react'],
      member_since: new Date('2024-01-01')
    };

    it('should generate reason with strong skill match (>70%)', () => {
      // Arrange
      const matchScore = 80;

      // Act
      const reason = (feedComposer as any).generateSuggestionReason(
        mockAdjCommunity,
        mockUserBehavior,
        matchScore
      );

      // Assert
      expect(reason).toContain('Strong skill match (80%)');
      expect(reason).toContain('Tech Helpers');
    });

    it('should generate reason with good skill match (40-70%)', () => {
      // Arrange
      const matchScore = 50;

      // Act
      const reason = (feedComposer as any).generateSuggestionReason(
        mockAdjCommunity,
        mockUserBehavior,
        matchScore
      );

      // Assert
      expect(reason).toContain('Good skill match (50%)');
    });

    it('should only mention community connection for low match score (<40%)', () => {
      // Arrange
      const matchScore = 30;

      // Act
      const reason = (feedComposer as any).generateSuggestionReason(
        mockAdjCommunity,
        mockUserBehavior,
        matchScore
      );

      // Assert
      expect(reason).not.toContain('skill match');
      expect(reason).toContain('Members from your communities');
    });

    it('should always mention adjacent community name', () => {
      // Arrange
      const matchScore = 100;

      // Act
      const reason = (feedComposer as any).generateSuggestionReason(
        mockAdjCommunity,
        mockUserBehavior,
        matchScore
      );

      // Assert
      expect(reason).toContain('Tech Helpers');
    });
  });

  describe('Edge Cases & Validation', () => {
    it('should handle user with no help history', async () => {
      // Arrange: New user with zero helps
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
        .mockResolvedValueOnce({ rows: [{ created_at: new Date() }], rowCount: 1 } as any);

      // Act
      const ratio = await feedComposer.calculateFeedRatio('user-zero');

      // Assert: Should return new user ratio
      expect(ratio.your_communities).toBe(40);
    });

    it('should handle empty skill arrays in matching', () => {
      // Arrange
      const requiredSkills: string[] = [];
      const userSkills: string[] = [];

      // Act
      const score = (feedComposer as any).calculateSkillMatchScore(requiredSkills, userSkills);

      // Assert: Default score
      expect(score).toBe(50);
    });

    it('should handle database query failure gracefully', async () => {
      // Arrange: Mock database error
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      // Act & Assert
      await expect(feedComposer.calculateFeedRatio('user-1'))
        .rejects.toThrow('Database connection failed');
    });
  });

  describe('Feed Composition - Item Count Distribution', () => {
    it('should distribute 20 items correctly for new user (40/40/20)', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
        .mockResolvedValueOnce({ rows: [{ created_at: new Date() }], rowCount: 1 } as any);

      const ratio = await feedComposer.calculateFeedRatio('user-new');

      // Act: Calculate distribution
      const limit = 20;
      const yourCommunitiesCount = Math.floor(limit * ratio.your_communities / 100);
      const suggestedRequestsCount = Math.floor(limit * ratio.suggested_requests / 100);
      const broaderStoriesCount = limit - yourCommunitiesCount - suggestedRequestsCount;

      // Assert: 40% = 8, 40% = 8, remainder = 4
      expect(yourCommunitiesCount).toBe(8);
      expect(suggestedRequestsCount).toBe(8);
      expect(broaderStoriesCount).toBe(4);
      expect(yourCommunitiesCount + suggestedRequestsCount + broaderStoriesCount).toBe(20);
    });

    it('should distribute 20 items correctly for active user (70/20/10)', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '15' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
        .mockResolvedValueOnce({ rows: [{ created_at: new Date() }], rowCount: 1 } as any);

      const ratio = await feedComposer.calculateFeedRatio('user-active');

      // Act
      const limit = 20;
      const yourCommunitiesCount = Math.floor(limit * ratio.your_communities / 100);
      const suggestedRequestsCount = Math.floor(limit * ratio.suggested_requests / 100);
      const broaderStoriesCount = limit - yourCommunitiesCount - suggestedRequestsCount;

      // Assert: 70% = 14, 20% = 4, remainder = 2
      expect(yourCommunitiesCount).toBe(14);
      expect(suggestedRequestsCount).toBe(4);
      expect(broaderStoriesCount).toBe(2);
      expect(yourCommunitiesCount + suggestedRequestsCount + broaderStoriesCount).toBe(20);
    });
  });
});
