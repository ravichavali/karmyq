/**
 * Unit Tests for Karma Service
 * Following TDD principles: Test business logic in isolation
 *
 * Test Coverage:
 * - Trust score reads
 * - Karma reads and the community leaderboard
 * - Edge cases and validation
 *
 * Sprint 126: the cross-community AWARD tests that used to lead this file were deleted with the
 * code they covered. They had been `describe.skip` since Sprint 112 because they pinned an exact
 * per-query mock SEQUENCE for `awardKarmaForCompletedMatch` that drifted from the implementation
 * while the regression tier was silently excluded — so they asserted nothing for four sprints.
 * That write path now lives in `standingProjector.ts`, and every behaviour those tests named
 * (config splits, first-help, the 10/50/100 milestones, multi-community capping, trust-score
 * fan-out) is covered by `sprint-126-standing-projector.test.ts` plus the pure-policy suite in
 * `tests/tdd/sprint-126-standing-projection-equivalence.test.ts` — against a projector whose
 * query order is no longer a hidden contract.
 */

import { getUserKarma, getUserTrustScore, getCommunityLeaderboard } from '../../src/services/karmaService';
import { query } from '../../src/database/db';

// Mock the database module
jest.mock('../../src/database/db');
jest.mock('../../src/utils/activityTracker');

const mockQuery = query as jest.MockedFunction<typeof query>;

// Helper to create a mock query result
function mockResult(rows: any[], rowCount?: number) {
  return { rows, rowCount: rowCount ?? rows.length } as any;
}


describe('getUserTrustScore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 0 for new users with no karma and no feedback', async () => {
    // New users start at 0, not 50 — all tiers are reachable from the bottom
    // getUserTrustScore query sequence (ADR-037):
    //   1. stats (recent_interactions, offers_accepted, requests_completed)
    //   2. getCommunityTrustConfig
    //   3. getWeightedAvgFeedback (feedback rows)
    //   4. getTrustMetrics: distinct_communities
    //   5. getTrustMetrics: distinct_people
    //   6. getTrustMetrics: repeat_pairs
    // recent_interactions=0 → carry path also runs (carry_enabled defaults true)
    // getMaxOtherCommunityScore returns null (no other community scores) → no carry applied
    mockQuery
      .mockResolvedValueOnce(mockResult([{ offers_accepted: '0', requests_completed: '0', recent_interactions: '0' }]))
      .mockResolvedValueOnce(mockResult([{
        trust_depth_weight: 0.6,
        trust_breadth_weight: 0.4,
        trust_feedback_threshold: 3.0,
        min_interactions_for_trust: 1,
        trust_negative_allowed: false,
        trust_carry_enabled: true,
        trust_carry_factor: 0.40,
        trust_carry_cap: 59,
      }]))
      .mockResolvedValueOnce(mockResult([]))     // no feedback
      .mockResolvedValueOnce(mockResult([{ distinct_communities: '0' }]))
      .mockResolvedValueOnce(mockResult([{ distinct_people: '0' }]))
      .mockResolvedValueOnce(mockResult([{ repeat_pairs: '0' }]))
      .mockResolvedValueOnce(mockResult([{ max_other_score: null }])); // no carry source

    const trustScore = await getUserTrustScore('user-new', 'community-123');

    expect(trustScore.score).toBe(0);
    expect(trustScore.requests_completed).toBe(0);
    expect(trustScore.offers_accepted).toBe(0);
  });

  it('should apply carry floor for new member with reputation elsewhere', async () => {
    // User has 75 trust in another community; carry = min(59, floor(75 × 0.40)) = min(59, 30) = 30
    mockQuery
      .mockResolvedValueOnce(mockResult([{ offers_accepted: '0', requests_completed: '0', recent_interactions: '0' }]))
      .mockResolvedValueOnce(mockResult([{
        trust_depth_weight: 0.6,
        trust_breadth_weight: 0.4,
        trust_feedback_threshold: 3.0,
        min_interactions_for_trust: 1,
        trust_negative_allowed: false,
        trust_carry_enabled: true,
        trust_carry_factor: 0.40,
        trust_carry_cap: 59,
      }]))
      .mockResolvedValueOnce(mockResult([]))     // no feedback
      .mockResolvedValueOnce(mockResult([{ distinct_communities: '0' }]))
      .mockResolvedValueOnce(mockResult([{ distinct_people: '0' }]))
      .mockResolvedValueOnce(mockResult([{ repeat_pairs: '0' }]))
      .mockResolvedValueOnce(mockResult([{ max_other_score: '75' }])); // carry source

    const trustScore = await getUserTrustScore('user-established', 'community-new');

    // carried = min(59, floor(75 × 0.40)) = 30; local = 0; score = max(0, 30) = 30
    expect(trustScore.score).toBe(30);
  });

  it('should cap carry at trust_carry_cap (59 by default)', async () => {
    // User has 150 trust elsewhere — carry should be capped at 59
    mockQuery
      .mockResolvedValueOnce(mockResult([{ offers_accepted: '0', requests_completed: '0', recent_interactions: '0' }]))
      .mockResolvedValueOnce(mockResult([{
        trust_depth_weight: 0.6,
        trust_breadth_weight: 0.4,
        trust_feedback_threshold: 3.0,
        min_interactions_for_trust: 1,
        trust_negative_allowed: false,
        trust_carry_enabled: true,
        trust_carry_factor: 0.90,
        trust_carry_cap: 59,
      }]))
      .mockResolvedValueOnce(mockResult([]))
      .mockResolvedValueOnce(mockResult([{ distinct_communities: '0' }]))
      .mockResolvedValueOnce(mockResult([{ distinct_people: '0' }]))
      .mockResolvedValueOnce(mockResult([{ repeat_pairs: '0' }]))
      .mockResolvedValueOnce(mockResult([{ max_other_score: '100' }]));

    const trustScore = await getUserTrustScore('user-trusted', 'community-new');

    // carry = min(59, floor(100 × 0.90)) = min(59, 90) = 59
    expect(trustScore.score).toBe(59);
  });

  it('should not apply carry when carry_enabled is false', async () => {
    mockQuery
      .mockResolvedValueOnce(mockResult([{ offers_accepted: '0', requests_completed: '0', recent_interactions: '0' }]))
      .mockResolvedValueOnce(mockResult([{
        trust_depth_weight: 0.6,
        trust_breadth_weight: 0.4,
        trust_feedback_threshold: 3.0,
        min_interactions_for_trust: 1,
        trust_negative_allowed: false,
        trust_carry_enabled: false,
        trust_carry_factor: 0.40,
        trust_carry_cap: 59,
      }]))
      .mockResolvedValueOnce(mockResult([]))
      .mockResolvedValueOnce(mockResult([{ distinct_communities: '0' }]))
      .mockResolvedValueOnce(mockResult([{ distinct_people: '0' }]))
      .mockResolvedValueOnce(mockResult([{ repeat_pairs: '0' }]));
    // No 7th mock — carry path should not execute

    const trustScore = await getUserTrustScore('user-established', 'community-closed');

    expect(trustScore.score).toBe(0); // no carry, no local history
  });

  it('should not apply carry when user has recent local interactions', async () => {
    // recent_interactions > 0 → carry path skipped entirely
    mockQuery
      .mockResolvedValueOnce(mockResult([{ offers_accepted: '3', requests_completed: '2', recent_interactions: '3' }]))
      .mockResolvedValueOnce(mockResult([{
        trust_depth_weight: 0.6,
        trust_breadth_weight: 0.4,
        trust_feedback_threshold: 3.0,
        min_interactions_for_trust: 1,
        trust_negative_allowed: false,
        trust_carry_enabled: true,
        trust_carry_factor: 0.40,
        trust_carry_cap: 59,
      }]))
      .mockResolvedValueOnce(mockResult([]))
      .mockResolvedValueOnce(mockResult([{ distinct_communities: '1' }]))
      .mockResolvedValueOnce(mockResult([{ distinct_people: '2' }]))
      .mockResolvedValueOnce(mockResult([{ repeat_pairs: '0' }]));
    // No 7th mock — carry path must not execute

    const trustScore = await getUserTrustScore('user-active', 'community-123');

    // vol: floor(log2(4)*10)=20; bonus:5; total ≥ 0
    expect(trustScore.score).toBeGreaterThan(0);
    // Verify carry query was NOT called (only 6 mockQuery calls)
    expect(mockQuery).toHaveBeenCalledTimes(6);
  });

  it('should not reduce score below locally-earned score via carry', async () => {
    // Local score > carry: carry should be ignored
    // recent_interactions=5 → carry path skipped (has local history)
    mockQuery
      .mockResolvedValueOnce(mockResult([{ offers_accepted: '3', requests_completed: '2', recent_interactions: '5' }]))
      .mockResolvedValueOnce(mockResult([{
        trust_depth_weight: 0.6,
        trust_breadth_weight: 0.4,
        trust_feedback_threshold: 3.0,
        min_interactions_for_trust: 1,
        trust_negative_allowed: false,
        trust_carry_enabled: true,
        trust_carry_factor: 0.40,
        trust_carry_cap: 59,
      }]))
      .mockResolvedValueOnce(mockResult([]))
      .mockResolvedValueOnce(mockResult([{ distinct_communities: '1' }]))
      .mockResolvedValueOnce(mockResult([{ distinct_people: '3' }]))
      .mockResolvedValueOnce(mockResult([{ repeat_pairs: '1' }]));

    const trustScore = await getUserTrustScore('user-local', 'community-123');

    // Score is whatever the formula gives — carry doesn't apply
    expect(trustScore.score).toBeGreaterThan(0);
    expect(mockQuery).toHaveBeenCalledTimes(6); // no carry query
  });
});

describe('getUserKarma', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return karma aggregated by community', async () => {
    const mockKarmaData = [
      { community_id: 'comm-1', total_karma: '150', transaction_count: '10' },
      { community_id: 'comm-2', total_karma: '75', transaction_count: '5' },
    ];

    mockQuery.mockResolvedValueOnce(mockResult(mockKarmaData));

    const karma = await getUserKarma('user-123');

    expect(karma).toHaveLength(2);
    expect(karma[0].total_karma).toBe('150');
    expect(karma[1].total_karma).toBe('75');
  });

  it('should filter karma by community_id when provided', async () => {
    mockQuery.mockResolvedValueOnce(mockResult([
      { community_id: 'comm-1', total_karma: '150', transaction_count: '10' },
    ]));

    await getUserKarma('user-123', 'comm-1');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('AND community_id = $2'),
      expect.arrayContaining(['user-123', 'comm-1'])
    );
  });

  it('should return empty array for user with no karma', async () => {
    mockQuery.mockResolvedValueOnce(mockResult([]));

    const karma = await getUserKarma('user-new');

    expect(karma).toEqual([]);
  });
});

describe('getCommunityLeaderboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return top users sorted by total karma', async () => {
    const mockLeaderboard = [
      { user_id: 'user-1', name: 'Alice', total_karma: '500', trust_score: 95 },
      { user_id: 'user-2', name: 'Bob', total_karma: '300', trust_score: 85 },
      { user_id: 'user-3', name: 'Carol', total_karma: '200', trust_score: 75 },
    ];

    mockQuery.mockResolvedValueOnce(mockResult(mockLeaderboard));

    const leaderboard = await getCommunityLeaderboard('community-123');

    expect(leaderboard).toHaveLength(3);
    expect(leaderboard[0].total_karma).toBe('500');
    expect(leaderboard[0].name).toBe('Alice');
  });

  it('should respect limit parameter', async () => {
    mockQuery.mockResolvedValueOnce(mockResult([]));

    await getCommunityLeaderboard('community-123', 5);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT $2'),
      expect.arrayContaining(['community-123', 5])
    );
  });

  it('should handle communities with no karma records', async () => {
    mockQuery.mockResolvedValueOnce(mockResult([]));

    const leaderboard = await getCommunityLeaderboard('community-empty');

    expect(leaderboard).toEqual([]);
  });
});
