/**
 * Unit Tests for Social Karma Feed Composer
 * Following TDD principles: Test business logic in isolation
 *
 * Test Coverage:
 * - Network strength calculation formula
 * - Network strength label categorization
 * - Trend direction detection
 * - Milestone pinning logic (48-hour window)
 * - Content interleaving algorithm
 * - Featured story privacy handling
 */

import { SocialKarmaFeedComposer } from '../../src/services/socialKarmaFeedComposer';
import { query } from '../../src/database/db';

// Mock the database module
jest.mock('../../src/database/db');

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('SocialKarmaFeedComposer - Network Health Algorithms', () => {
  let composer: SocialKarmaFeedComposer;

  beforeEach(() => {
    jest.clearAllMocks();
    composer = new SocialKarmaFeedComposer();
  });

  describe('Network Strength Calculation - Formula Validation', () => {
    it('should calculate network strength correctly (40% activity, 40% quality, 20% density)', async () => {
      // Arrange: Mock community with known metrics
      mockQuery
        // Community name query
        .mockResolvedValueOnce({
          rows: [{ id: 'comm-1', name: 'Test Community' }],
          rowCount: 1
        } as any)
        // Health metrics query
        .mockResolvedValueOnce({
          rows: [{
            total_matches_completed: 25, // Activity score = 25*2 = 50
            total_active_helpers: 10,
            network_density: 0.5, // Density score = 50
            avg_helpfulness: 4, // Quality = (4+4+4)/3 = 4
            avg_responsiveness: 4, // Quality score = 4*20 = 80
            avg_clarity: 4,
            growth_rate_matches: 10
          }],
          rowCount: 1
        } as any);

      // Act
      const summary = await composer.getCommunityHealthSummary('comm-1');

      // Assert
      // Activity: 50, Quality: 80, Density: 50
      // Network Strength = 50*0.4 + 80*0.4 + 50*0.2 = 20 + 32 + 10 = 62
      expect(summary).not.toBeNull();
      expect(summary!.networkStrength).toBeCloseTo(62, 1);
    });

    it('should cap activity score at 100 (50 matches = 100)', async () => {
      // Arrange: Community with 60 matches (would be 120 without cap)
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'comm-1', name: 'Very Active Community' }],
          rowCount: 1
        } as any)
        .mockResolvedValueOnce({
          rows: [{
            total_matches_completed: 60, // 60*2 = 120, capped at 100
            total_active_helpers: 20,
            network_density: 0.5,
            avg_helpfulness: 3,
            avg_responsiveness: 3,
            avg_clarity: 3,
            growth_rate_matches: 5
          }],
          rowCount: 1
        } as any);

      // Act
      const summary = await composer.getCommunityHealthSummary('comm-1');

      // Assert
      // Activity: Math.min(100, 60*2) = 100
      // Quality: (3+3+3)/3 * 20 = 60
      // Density: 50
      // Strength = 100*0.4 + 60*0.4 + 50*0.2 = 40 + 24 + 10 = 74
      expect(summary!.networkStrength).toBeCloseTo(74, 1);
    });

    it('should calculate quality score from 5-star averages (5-star = 100)', async () => {
      // Arrange: Perfect 5-star ratings
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'comm-1', name: 'High Quality Community' }],
          rowCount: 1
        } as any)
        .mockResolvedValueOnce({
          rows: [{
            total_matches_completed: 10, // Activity = 20
            total_active_helpers: 5,
            network_density: 0.2, // Density = 20
            avg_helpfulness: 5, // Perfect scores
            avg_responsiveness: 5,
            avg_clarity: 5, // Quality = 5*20 = 100
            growth_rate_matches: 0
          }],
          rowCount: 1
        } as any);

      // Act
      const summary = await composer.getCommunityHealthSummary('comm-1');

      // Assert
      // Activity: 20, Quality: 100, Density: 20
      // Strength = 20*0.4 + 100*0.4 + 20*0.2 = 8 + 40 + 4 = 52
      expect(summary!.networkStrength).toBeCloseTo(52, 1);
    });

    it('should handle zero metrics (new community)', async () => {
      // Arrange: Brand new community
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'comm-new', name: 'New Community' }],
          rowCount: 1
        } as any)
        .mockResolvedValueOnce({
          rows: [], // No metrics yet
          rowCount: 0
        } as any);

      // Act
      const summary = await composer.getCommunityHealthSummary('comm-new');

      // Assert: Default zero values
      expect(summary!.networkStrength).toBe(0);
      expect(summary!.totalMatches).toBe(0);
      expect(summary!.activeHelpers).toBe(0);
    });
  });

  describe('getNetworkStrengthLabel - Categorization', () => {
    it('should return "Thriving" for score >= 80', async () => {
      // Arrange: High-performing community
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'comm-1', name: 'Thriving Community' }],
          rowCount: 1
        } as any)
        .mockResolvedValueOnce({
          rows: [{
            total_matches_completed: 50, // Activity = 100
            total_active_helpers: 25,
            network_density: 0.8, // Density = 80
            avg_helpfulness: 5,
            avg_responsiveness: 5,
            avg_clarity: 5, // Quality = 100
            growth_rate_matches: 15
          }],
          rowCount: 1
        } as any);

      // Act
      const summary = await composer.getCommunityHealthSummary('comm-1');

      // Assert: 100*0.4 + 100*0.4 + 80*0.2 = 96
      expect(summary!.networkStrengthLabel).toBe('Thriving');
    });

    it('should return "Strong" for score 60-79', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'comm-1', name: 'Strong Community' }],
          rowCount: 1
        } as any)
        .mockResolvedValueOnce({
          rows: [{
            total_matches_completed: 30,
            total_active_helpers: 15,
            network_density: 0.5,
            avg_helpfulness: 4,
            avg_responsiveness: 4,
            avg_clarity: 4,
            growth_rate_matches: 5
          }],
          rowCount: 1
        } as any);

      // Act
      const summary = await composer.getCommunityHealthSummary('comm-1');

      // Assert: Should be ~68
      expect(summary!.networkStrengthLabel).toBe('Strong');
    });

    it('should return "Growing" for score 40-59', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'comm-1', name: 'Growing Community' }],
          rowCount: 1
        } as any)
        .mockResolvedValueOnce({
          rows: [{
            total_matches_completed: 15,
            total_active_helpers: 8,
            network_density: 0.3,
            avg_helpfulness: 3.5,
            avg_responsiveness: 3.5,
            avg_clarity: 3.5,
            growth_rate_matches: 8
          }],
          rowCount: 1
        } as any);

      // Act
      const summary = await composer.getCommunityHealthSummary('comm-1');

      // Assert: Should be ~46
      expect(summary!.networkStrengthLabel).toBe('Growing');
    });

    it('should return "Developing" for score 20-39', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'comm-1', name: 'Developing Community' }],
          rowCount: 1
        } as any)
        .mockResolvedValueOnce({
          rows: [{
            total_matches_completed: 8,
            total_active_helpers: 4,
            network_density: 0.15,
            avg_helpfulness: 3,
            avg_responsiveness: 3,
            avg_clarity: 3,
            growth_rate_matches: 3
          }],
          rowCount: 1
        } as any);

      // Act
      const summary = await composer.getCommunityHealthSummary('comm-1');

      // Assert: Should be ~26.4
      expect(summary!.networkStrengthLabel).toBe('Developing');
    });

    it('should return "Building" for score < 20', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'comm-1', name: 'New Community' }],
          rowCount: 1
        } as any)
        .mockResolvedValueOnce({
          rows: [{
            total_matches_completed: 2, // Activity = 4
            total_active_helpers: 1,
            network_density: 0.02, // Density = 2
            avg_helpfulness: 2,
            avg_responsiveness: 2,
            avg_clarity: 2, // Quality = 40
            growth_rate_matches: 1
          }],
          rowCount: 1
        } as any);

      // Act
      const summary = await composer.getCommunityHealthSummary('comm-1');

      // Assert: 4*0.4 + 40*0.4 + 2*0.2 = 1.6 + 16 + 0.4 = 18
      expect(summary!.networkStrengthLabel).toBe('Building');
    });
  });

  describe('getTrendDirection - Growth Rate Analysis', () => {
    it('should return "growing" for growth rate > 5%', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'comm-1', name: 'Growing Community' }],
          rowCount: 1
        } as any)
        .mockResolvedValueOnce({
          rows: [{
            total_matches_completed: 20,
            total_active_helpers: 10,
            network_density: 0.3,
            avg_helpfulness: 4,
            avg_responsiveness: 4,
            avg_clarity: 4,
            growth_rate_matches: 8 // > 5%
          }],
          rowCount: 1
        } as any);

      // Act
      const summary = await composer.getCommunityHealthSummary('comm-1');

      // Assert
      expect(summary!.trendDirection).toBe('growing');
    });

    it('should return "stable" for growth rate -5% to 5%', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'comm-1', name: 'Stable Community' }],
          rowCount: 1
        } as any)
        .mockResolvedValueOnce({
          rows: [{
            total_matches_completed: 20,
            total_active_helpers: 10,
            network_density: 0.3,
            avg_helpfulness: 4,
            avg_responsiveness: 4,
            avg_clarity: 4,
            growth_rate_matches: 2 // -5 < 2 < 5
          }],
          rowCount: 1
        } as any);

      // Act
      const summary = await composer.getCommunityHealthSummary('comm-1');

      // Assert
      expect(summary!.trendDirection).toBe('stable');
    });

    it('should return "declining" for growth rate < -5%', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'comm-1', name: 'Declining Community' }],
          rowCount: 1
        } as any)
        .mockResolvedValueOnce({
          rows: [{
            total_matches_completed: 20,
            total_active_helpers: 10,
            network_density: 0.3,
            avg_helpfulness: 4,
            avg_responsiveness: 4,
            avg_clarity: 4,
            growth_rate_matches: -8 // < -5%
          }],
          rowCount: 1
        } as any);

      // Act
      const summary = await composer.getCommunityHealthSummary('comm-1');

      // Assert
      expect(summary!.trendDirection).toBe('declining');
    });

    it('should handle edge case: exactly 5% (stable)', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'comm-1', name: 'Edge Community' }],
          rowCount: 1
        } as any)
        .mockResolvedValueOnce({
          rows: [{
            total_matches_completed: 20,
            total_active_helpers: 10,
            network_density: 0.3,
            avg_helpfulness: 4,
            avg_responsiveness: 4,
            avg_clarity: 4,
            growth_rate_matches: 5 // Exactly 5%
          }],
          rowCount: 1
        } as any);

      // Act
      const summary = await composer.getCommunityHealthSummary('comm-1');

      // Assert: 5 is not > 5, so stable
      expect(summary!.trendDirection).toBe('stable');
    });

    it('should handle edge case: exactly -5% (stable)', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'comm-1', name: 'Edge Community' }],
          rowCount: 1
        } as any)
        .mockResolvedValueOnce({
          rows: [{
            total_matches_completed: 20,
            total_active_helpers: 10,
            network_density: 0.3,
            avg_helpfulness: 4,
            avg_responsiveness: 4,
            avg_clarity: 4,
            growth_rate_matches: -5 // Exactly -5%
          }],
          rowCount: 1
        } as any);

      // Act
      const summary = await composer.getCommunityHealthSummary('comm-1');

      // Assert: -5 is not < -5, so stable
      expect(summary!.trendDirection).toBe('stable');
    });
  });

  describe('isMilestonePinned - 48-Hour Pinning Logic', () => {
    it('should pin milestone achieved less than 48 hours ago', () => {
      // Arrange: 24 hours ago
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Act
      const isPinned = (composer as any).isMilestonePinned(twentyFourHoursAgo);

      // Assert
      expect(isPinned).toBe(true);
    });

    it('should pin milestone achieved exactly 47 hours ago', () => {
      // Arrange: 47 hours ago (within 48-hour window)
      const fortySevenHoursAgo = new Date(Date.now() - 47 * 60 * 60 * 1000);

      // Act
      const isPinned = (composer as any).isMilestonePinned(fortySevenHoursAgo);

      // Assert
      expect(isPinned).toBe(true);
    });

    it('should NOT pin milestone achieved more than 48 hours ago', () => {
      // Arrange: 49 hours ago
      const fortyNineHoursAgo = new Date(Date.now() - 49 * 60 * 60 * 1000);

      // Act
      const isPinned = (composer as any).isMilestonePinned(fortyNineHoursAgo);

      // Assert
      expect(isPinned).toBe(false);
    });

    it('should pin milestone achieved just now', () => {
      // Arrange: Right now
      const now = new Date();

      // Act
      const isPinned = (composer as any).isMilestonePinned(now);

      // Assert
      expect(isPinned).toBe(true);
    });

    it('should NOT pin milestone from 3 days ago', () => {
      // Arrange: 72 hours ago
      const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

      // Act
      const isPinned = (composer as any).isMilestonePinned(threeDaysAgo);

      // Assert
      expect(isPinned).toBe(false);
    });
  });

  describe('interleaveContent - Content Mixing Algorithm', () => {
    it('should interleave with pattern: 1 milestone, 2 stories, 1 milestone, 2 stories', () => {
      // Arrange
      const milestones = [
        { type: 'milestone', id: 'M1' },
        { type: 'milestone', id: 'M2' },
        { type: 'milestone', id: 'M3' }
      ];
      const stories = [
        { type: 'story', id: 'S1' },
        { type: 'story', id: 'S2' },
        { type: 'story', id: 'S3' },
        { type: 'story', id: 'S4' }
      ];

      // Act
      const interleaved = (composer as any).interleaveContent(milestones, stories);

      // Assert: Pattern should be M1, S1, S2, M2, S3, S4, M3
      expect(interleaved.length).toBe(7);
      expect(interleaved[0].id).toBe('M1');
      expect(interleaved[1].id).toBe('S1');
      expect(interleaved[2].id).toBe('S2');
      expect(interleaved[3].id).toBe('M2');
      expect(interleaved[4].id).toBe('S3');
      expect(interleaved[5].id).toBe('S4');
      expect(interleaved[6].id).toBe('M3');
    });

    it('should handle more milestones than stories', () => {
      // Arrange
      const milestones = [
        { type: 'milestone', id: 'M1' },
        { type: 'milestone', id: 'M2' },
        { type: 'milestone', id: 'M3' },
        { type: 'milestone', id: 'M4' }
      ];
      const stories = [
        { type: 'story', id: 'S1' }
      ];

      // Act
      const interleaved = (composer as any).interleaveContent(milestones, stories);

      // Assert: M1, S1, M2, M3, M4
      expect(interleaved.length).toBe(5);
      expect(interleaved[0].id).toBe('M1');
      expect(interleaved[1].id).toBe('S1');
      expect(interleaved[2].id).toBe('M2');
      expect(interleaved[3].id).toBe('M3');
      expect(interleaved[4].id).toBe('M4');
    });

    it('should handle more stories than milestones', () => {
      // Arrange
      const milestones = [
        { type: 'milestone', id: 'M1' }
      ];
      const stories = [
        { type: 'story', id: 'S1' },
        { type: 'story', id: 'S2' },
        { type: 'story', id: 'S3' }
      ];

      // Act
      const interleaved = (composer as any).interleaveContent(milestones, stories);

      // Assert: M1, S1, S2, S3
      expect(interleaved.length).toBe(4);
      expect(interleaved[0].id).toBe('M1');
      expect(interleaved[1].id).toBe('S1');
      expect(interleaved[2].id).toBe('S2');
      expect(interleaved[3].id).toBe('S3');
    });

    it('should handle empty milestones array', () => {
      // Arrange
      const milestones: any[] = [];
      const stories = [
        { type: 'story', id: 'S1' },
        { type: 'story', id: 'S2' }
      ];

      // Act
      const interleaved = (composer as any).interleaveContent(milestones, stories);

      // Assert: Just stories
      expect(interleaved.length).toBe(2);
      expect(interleaved[0].id).toBe('S1');
      expect(interleaved[1].id).toBe('S2');
    });

    it('should handle empty stories array', () => {
      // Arrange
      const milestones = [
        { type: 'milestone', id: 'M1' },
        { type: 'milestone', id: 'M2' }
      ];
      const stories: any[] = [];

      // Act
      const interleaved = (composer as any).interleaveContent(milestones, stories);

      // Assert: Just milestones
      expect(interleaved.length).toBe(2);
      expect(interleaved[0].id).toBe('M1');
      expect(interleaved[1].id).toBe('M2');
    });

    it('should handle both arrays empty', () => {
      // Arrange
      const milestones: any[] = [];
      const stories: any[] = [];

      // Act
      const interleaved = (composer as any).interleaveContent(milestones, stories);

      // Assert: Empty result
      expect(interleaved.length).toBe(0);
    });
  });

  describe('Edge Cases & Validation', () => {
    it('should return null for non-existent community', async () => {
      // Arrange
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      } as any);

      // Act
      const summary = await composer.getCommunityHealthSummary('comm-nonexistent');

      // Assert
      expect(summary).toBeNull();
    });

    it('should round network strength to 1 decimal place', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'comm-1', name: 'Test' }],
          rowCount: 1
        } as any)
        .mockResolvedValueOnce({
          rows: [{
            total_matches_completed: 17, // 34
            total_active_helpers: 8,
            network_density: 0.333, // 33.3
            avg_helpfulness: 3.6,
            avg_responsiveness: 3.7,
            avg_clarity: 3.8, // avg = 3.7, *20 = 74
            growth_rate_matches: 4.567
          }],
          rowCount: 1
        } as any);

      // Act
      const summary = await composer.getCommunityHealthSummary('comm-1');

      // Assert: Should be rounded to 1 decimal
      // 34*0.4 + 74*0.4 + 33.3*0.2 = 13.6 + 29.6 + 6.66 = 49.86 ≈ 49.9
      expect(summary!.networkStrength.toString()).toMatch(/^\d+\.\d$/);
      expect(summary!.growthRate).toBeCloseTo(4.6, 1);
    });
  });
});
