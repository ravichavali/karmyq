/**
 * Unit tests for prestige badge logic (ADR-016, Sprint 14)
 * Tests checkAndAwardBadges() in isolation using mocked DB queries.
 */

import { checkAndAwardBadges, getUserBadges, BADGE_TYPES } from '../../../services/reputation-service/src/services/badgeService';

// Mock the DB module
jest.mock('../../../services/reputation-service/src/database/db', () => ({
  query: jest.fn(),
}));

import { query } from '../../../services/reputation-service/src/database/db';
const mockQuery = query as jest.Mock;

describe('Prestige Badges', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('BADGE_TYPES', () => {
    it('exports all Phase 1 badge types', () => {
      expect(BADGE_TYPES).toContain('first_helper');
      expect(BADGE_TYPES).toContain('milestone_10');
      expect(BADGE_TYPES).toContain('milestone_50');
      expect(BADGE_TYPES).toContain('milestone_100');
      expect(BADGE_TYPES).toContain('connector');
      expect(BADGE_TYPES).toHaveLength(5);
    });
  });

  describe('getUserBadges', () => {
    it('returns badges for a user', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'b1', user_id: 'u1', community_id: null, badge_type: 'first_helper', earned_at: '2026-01-01' },
        ],
      });

      const badges = await getUserBadges('u1');
      expect(badges).toHaveLength(1);
      expect(badges[0].badge_type).toBe('first_helper');
    });

    it('returns empty array when user has no badges', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const badges = await getUserBadges('u-new');
      expect(badges).toEqual([]);
    });
  });

  describe('checkAndAwardBadges', () => {
    function setupMocks({ completed = 0, distinct = 0, existingBadges = [] as string[] } = {}) {
      // stats query
      mockQuery.mockResolvedValueOnce({
        rows: [{ completed_as_helper: String(completed), distinct_people_helped: String(distinct) }],
      });
      // existing badges query (getUserBadges internally)
      mockQuery.mockResolvedValueOnce({
        rows: existingBadges.map(bt => ({ id: 'x', user_id: 'u1', community_id: null, badge_type: bt, earned_at: '' })),
      });
      // Each insert returns nothing meaningful
      mockQuery.mockResolvedValue({ rows: [] });
    }

    it('awards first_helper on first completed match', async () => {
      setupMocks({ completed: 1, distinct: 1 });
      const awarded = await checkAndAwardBadges('u1');
      expect(awarded).toContain('first_helper');
    });

    it('awards milestone_10 when helper has 10 completed matches', async () => {
      setupMocks({ completed: 10, distinct: 5, existingBadges: ['first_helper'] });
      const awarded = await checkAndAwardBadges('u1');
      expect(awarded).toContain('milestone_10');
      expect(awarded).not.toContain('first_helper'); // already earned
    });

    it('awards connector when 10+ distinct people helped', async () => {
      setupMocks({ completed: 15, distinct: 10, existingBadges: ['first_helper', 'milestone_10'] });
      const awarded = await checkAndAwardBadges('u1');
      expect(awarded).toContain('connector');
    });

    it('awards multiple badges at once when milestones align', async () => {
      // First time hitting 50 — should also get milestone_10 if not already earned
      setupMocks({ completed: 50, distinct: 12, existingBadges: ['first_helper'] });
      const awarded = await checkAndAwardBadges('u1');
      expect(awarded).toContain('milestone_10');
      expect(awarded).toContain('milestone_50');
      expect(awarded).toContain('connector');
    });

    it('awards no badges when completed count is 0', async () => {
      setupMocks({ completed: 0, distinct: 0 });
      const awarded = await checkAndAwardBadges('u1');
      expect(awarded).toHaveLength(0);
    });

    it('skips badges already earned', async () => {
      setupMocks({
        completed: 100,
        distinct: 20,
        existingBadges: ['first_helper', 'milestone_10', 'milestone_50', 'milestone_100', 'connector'],
      });
      const awarded = await checkAndAwardBadges('u1');
      expect(awarded).toHaveLength(0);
    });

    it('awards milestone_100 at 100 completed matches', async () => {
      setupMocks({ completed: 100, distinct: 20, existingBadges: ['first_helper', 'milestone_10', 'milestone_50'] });
      const awarded = await checkAndAwardBadges('u1');
      expect(awarded).toContain('milestone_100');
    });

    it('does not award milestone_10 when completed count is 9', async () => {
      setupMocks({ completed: 9, distinct: 5, existingBadges: ['first_helper'] });
      const awarded = await checkAndAwardBadges('u1');
      expect(awarded).not.toContain('milestone_10');
    });
  });
});
