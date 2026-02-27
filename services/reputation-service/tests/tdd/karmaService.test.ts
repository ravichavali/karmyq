/**
 * Unit Tests for Karma Service
 * Following TDD principles: Test business logic in isolation
 *
 * Test Coverage:
 * - Cross-community karma distribution (ADR-031)
 * - Community config karma splits
 * - First help bonus
 * - Milestone bonuses (10, 50, 100 exchanges)
 * - Trust score calculation
 * - Edge cases and validation
 */

import { awardKarmaForCompletedMatch, getUserKarma, getUserTrustScore, getCommunityLeaderboard } from '../../src/services/karmaService';
import { query } from '../../src/database/db';

// Mock the database module
jest.mock('../../src/database/db');
jest.mock('../../src/utils/activityTracker');

const mockQuery = query as jest.MockedFunction<typeof query>;

// Helper to create a mock query result
function mockResult(rows: any[], rowCount?: number) {
  return { rows, rowCount: rowCount ?? rows.length } as any;
}

describe('Karma Service - Cross-Community Karma (ADR-031)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockMatchData = {
    match_id: 'match-123',
    request_id: 'req-456',
    requester_id: 'user-requester',
    responder_id: 'user-responder',
  };

  /**
   * Mock the full query sequence for awardKarmaForCompletedMatch:
   * 1. getSharedRequestCommunities (junction table + member check)
   * 2. For each community:
   *    a. getCommunityKarmaConfig
   *    b. recordKarma (helper)
   *    c. recordKarma (requester)
   *    d. check helper history
   *    e. (optional milestone/first-help bonus)
   *    f. updateTrustScore (responder) - stats query
   *    g. updateTrustScore (responder) - karma sum
   *    h. updateTrustScore (responder) - upsert
   *    i. updateTrustScore (requester) - stats query
   *    j. updateTrustScore (requester) - karma sum
   *    k. updateTrustScore (requester) - upsert
   *    l. recordActivity (responder)
   *    m. recordActivity (requester)
   */
  // Trust score mock data (needed by updateTrustScore — ADR-037 formula, 7 queries per user)
  const trustScoreMocks = [
    // 1. stats query (offers_accepted, requests_completed, recent_interactions)
    mockResult([{ offers_accepted: '3', requests_completed: '2', recent_interactions: '3' }]),
    // 2. getCommunityTrustConfig
    mockResult([{
      trust_depth_weight: 0.6,
      trust_breadth_weight: 0.4,
      trust_feedback_threshold: 3.0,
      min_interactions_for_trust: 1,
      trust_negative_allowed: false,
    }]),
    // 3. getWeightedAvgFeedback (feedback rows — empty means null avg)
    mockResult([]),
    // 4. getTrustMetrics: distinct_communities
    mockResult([{ distinct_communities: '1' }]),
    // 5. getTrustMetrics: distinct_people
    mockResult([{ distinct_people: '2' }]),
    // 6. getTrustMetrics: repeat_pairs
    mockResult([{ repeat_pairs: '0' }]),
    // 7. upsert trust score
    mockResult([]),
  ];

  function mockForSingleCommunity(opts: {
    communityId?: string;
    karmaSplitHelper?: number;
    karmaSplitRequestor?: number;
    helperHistoryCount?: string;
  } = {}) {
    const {
      communityId = 'community-789',
      karmaSplitHelper = 60,
      karmaSplitRequestor = 40,
      helperHistoryCount = '5',
    } = opts;

    mockQuery
      // 1. getSharedRequestCommunities
      .mockResolvedValueOnce(mockResult([{ community_id: communityId }]))
      // 2a. getCommunityKarmaConfig
      .mockResolvedValueOnce(mockResult([{
        karma_split_helper: karmaSplitHelper,
        karma_split_requestor: karmaSplitRequestor,
        base_karma_pool_per_request: 100,
      }]))
      // 2b. recordKarma (helper)
      .mockResolvedValueOnce(mockResult([]))
      // 2c. recordKarma (requester)
      .mockResolvedValueOnce(mockResult([]))
      // 2d. check helper history
      .mockResolvedValueOnce(mockResult([{ count: helperHistoryCount }]));

    // If first help (count=1), there's an extra recordKarma call for the bonus
    if (helperHistoryCount === '1') {
      mockQuery.mockResolvedValueOnce(mockResult([])); // first help bonus insert
    }

    // If milestone, there's an extra recordKarma call
    if (['10', '50', '100'].includes(helperHistoryCount)) {
      mockQuery.mockResolvedValueOnce(mockResult([])); // milestone bonus insert
    }

    // updateTrustScore (responder) - 3 queries
    for (const m of trustScoreMocks) mockQuery.mockResolvedValueOnce(m);
    // updateTrustScore (requester) - 3 queries
    for (const m of trustScoreMocks) mockQuery.mockResolvedValueOnce(m);
    // recordActivity (responder + requester) - mocked by jest.mock
  }

  describe('awardKarmaForCompletedMatch', () => {
    it('should award karma using community config splits', async () => {
      // Community config: 70/30 split (helper gets 70%)
      mockForSingleCommunity({ karmaSplitHelper: 70, karmaSplitRequestor: 30 });

      await awardKarmaForCompletedMatch(mockMatchData);

      const insertCalls = mockQuery.mock.calls.filter(
        call => call[0].includes('INSERT INTO reputation.karma_records')
      );

      // ADR-035: fixed pool (100pts), 70/30 split → helper=70, requester=30
      expect(insertCalls[0][1]).toContain('user-responder');
      expect(insertCalls[0][1]).toContain(70);

      expect(insertCalls[1][1]).toContain('user-requester');
      expect(insertCalls[1][1]).toContain(30);
    });

    it('should use default splits when community has no config', async () => {
      mockQuery
        // getSharedRequestCommunities
        .mockResolvedValueOnce(mockResult([{ community_id: 'community-789' }]))
        // getCommunityKarmaConfig - no config found
        .mockResolvedValueOnce(mockResult([]))
        // recordKarma (helper)
        .mockResolvedValueOnce(mockResult([]))
        // recordKarma (requester)
        .mockResolvedValueOnce(mockResult([]))
        // helper history
        .mockResolvedValueOnce(mockResult([{ count: '5' }]))
        // updateTrustScore (responder): 7 queries (ADR-037)
        .mockResolvedValueOnce(mockResult([{ offers_accepted: '3', requests_completed: '2', recent_interactions: '3' }]))
        .mockResolvedValueOnce(mockResult([]))  // getCommunityTrustConfig (no row → defaults)
        .mockResolvedValueOnce(mockResult([]))  // getWeightedAvgFeedback
        .mockResolvedValueOnce(mockResult([{ distinct_communities: '1' }]))
        .mockResolvedValueOnce(mockResult([{ distinct_people: '2' }]))
        .mockResolvedValueOnce(mockResult([{ repeat_pairs: '0' }]))
        .mockResolvedValueOnce(mockResult([]))  // upsert
        // updateTrustScore (requester): 7 queries
        .mockResolvedValueOnce(mockResult([{ offers_accepted: '1', requests_completed: '3', recent_interactions: '2' }]))
        .mockResolvedValueOnce(mockResult([]))  // getCommunityTrustConfig
        .mockResolvedValueOnce(mockResult([]))  // getWeightedAvgFeedback
        .mockResolvedValueOnce(mockResult([{ distinct_communities: '1' }]))
        .mockResolvedValueOnce(mockResult([{ distinct_people: '1' }]))
        .mockResolvedValueOnce(mockResult([{ repeat_pairs: '0' }]))
        .mockResolvedValueOnce(mockResult([]));  // upsert

      await awardKarmaForCompletedMatch(mockMatchData);

      const insertCalls = mockQuery.mock.calls.filter(
        call => call[0].includes('INSERT INTO reputation.karma_records')
      );

      // ADR-035: fixed pool (100pts), default 60/40 split → helper=60, requester=40
      expect(insertCalls[0][1]).toContain(60);
      expect(insertCalls[1][1]).toContain(40);
    });

    it('should award karma in multiple shared communities', async () => {
      // 7 mocks per updateTrustScore call (ADR-037 formula)
      const tsm = (o: string, r: string) => [
        mockResult([{ offers_accepted: o, requests_completed: r, recent_interactions: o }]),
        mockResult([]),  // getCommunityTrustConfig (defaults)
        mockResult([]),  // getWeightedAvgFeedback (no feedback)
        mockResult([{ distinct_communities: '1' }]),
        mockResult([{ distinct_people: '1' }]),
        mockResult([{ repeat_pairs: '0' }]),
        mockResult([]),  // upsert
      ];

      // ADR-035: configs are fetched via Promise.all BEFORE the loop begins
      mockQuery
        // getSharedRequestCommunities - two communities
        .mockResolvedValueOnce(mockResult([
          { community_id: 'comm-A' },
          { community_id: 'comm-B' },
        ]))
        // --- Both configs fetched upfront via Promise.all ---
        // config comm-A
        .mockResolvedValueOnce(mockResult([{
          karma_split_helper: 80,
          karma_split_requestor: 20,
          base_karma_pool_per_request: 100,
        }]))
        // config comm-B
        .mockResolvedValueOnce(mockResult([{
          karma_split_helper: 50,
          karma_split_requestor: 50,
          base_karma_pool_per_request: 100,
        }]))
        // --- Community A loop ---
        // recordKarma helper, requester
        .mockResolvedValueOnce(mockResult([]))
        .mockResolvedValueOnce(mockResult([]))
        // helper history (3rd help, no bonus)
        .mockResolvedValueOnce(mockResult([{ count: '3' }]));
      // Community A trust scores (responder + requester)
      for (const m of tsm('2', '1')) mockQuery.mockResolvedValueOnce(m);
      for (const m of tsm('1', '2')) mockQuery.mockResolvedValueOnce(m);

      mockQuery
        // --- Community B loop ---
        // recordKarma helper, requester
        .mockResolvedValueOnce(mockResult([]))
        .mockResolvedValueOnce(mockResult([]))
        // helper history (1st help → first help bonus!)
        .mockResolvedValueOnce(mockResult([{ count: '1' }]))
        // first help bonus insert
        .mockResolvedValueOnce(mockResult([]));
      // Community B trust scores (responder + requester)
      for (const m of tsm('1', '0')) mockQuery.mockResolvedValueOnce(m);
      for (const m of tsm('0', '1')) mockQuery.mockResolvedValueOnce(m);

      await awardKarmaForCompletedMatch(mockMatchData);

      const insertCalls = mockQuery.mock.calls.filter(
        call => call[0].includes('INSERT INTO reputation.karma_records')
      );

      // Community A: helper 8pts + requester 1pt = 2 records
      // Community B: helper 5pts + requester 3pts + first help bonus 15pts = 3 records
      // Total: 5 karma records
      expect(insertCalls.length).toBe(5);
    });

    it('should award first help bonus (15pts) when user helps for the first time in a community', async () => {
      mockForSingleCommunity({ helperHistoryCount: '1' });

      await awardKarmaForCompletedMatch(mockMatchData);

      const insertCalls = mockQuery.mock.calls.filter(
        call => call[0].includes('INSERT INTO reputation.karma_records')
      );

      // Should have 3 records: helper karma + requester karma + first help bonus
      expect(insertCalls.length).toBe(3);

      const firstHelpBonus = insertCalls.find(call =>
        call[1].includes('First help in community')
      );
      expect(firstHelpBonus).toBeDefined();
      expect(firstHelpBonus[1]).toContain(15);
    });

    it('should award 10-exchange milestone bonus (25pts)', async () => {
      mockForSingleCommunity({ helperHistoryCount: '10' });

      await awardKarmaForCompletedMatch(mockMatchData);

      const insertCalls = mockQuery.mock.calls.filter(
        call => call[0].includes('INSERT INTO reputation.karma_records')
      );

      const milestoneBonus = insertCalls.find(call =>
        call[1].includes('10 exchanges milestone')
      );
      expect(milestoneBonus).toBeDefined();
      expect(milestoneBonus[1]).toContain(25);
    });

    it('should award 50-exchange milestone bonus (50pts)', async () => {
      mockForSingleCommunity({ helperHistoryCount: '50' });

      await awardKarmaForCompletedMatch(mockMatchData);

      const insertCalls = mockQuery.mock.calls.filter(
        call => call[0].includes('INSERT INTO reputation.karma_records')
      );

      const milestoneBonus = insertCalls.find(call =>
        call[1].includes('50 exchanges milestone')
      );
      expect(milestoneBonus).toBeDefined();
      expect(milestoneBonus[1]).toContain(50);
    });

    it('should award 100-exchange milestone bonus (100pts)', async () => {
      mockForSingleCommunity({ helperHistoryCount: '100' });

      await awardKarmaForCompletedMatch(mockMatchData);

      const insertCalls = mockQuery.mock.calls.filter(
        call => call[0].includes('INSERT INTO reputation.karma_records')
      );

      const milestoneBonus = insertCalls.find(call =>
        call[1].includes('100 exchanges milestone')
      );
      expect(milestoneBonus).toBeDefined();
      expect(milestoneBonus[1]).toContain(100);
    });

    it('should NOT award milestone bonus for 11th exchange', async () => {
      mockForSingleCommunity({ helperHistoryCount: '11' });

      await awardKarmaForCompletedMatch(mockMatchData);

      const insertCalls = mockQuery.mock.calls.filter(
        call => call[0].includes('INSERT INTO reputation.karma_records')
      );

      // Only 2 records (helper + requester, no milestone)
      expect(insertCalls.length).toBe(2);
    });

    it('should fall back to any request community when no shared communities found', async () => {
      mockQuery
        // getSharedRequestCommunities - no shared communities
        .mockResolvedValueOnce(mockResult([]))
        // Fallback: get any community from request_communities
        .mockResolvedValueOnce(mockResult([{ community_id: 'fallback-comm' }]))
        // getCommunityKarmaConfig - no config
        .mockResolvedValueOnce(mockResult([]))
        // recordKarma helper, requester
        .mockResolvedValueOnce(mockResult([]))
        .mockResolvedValueOnce(mockResult([]))
        // helper history
        .mockResolvedValueOnce(mockResult([{ count: '3' }]))
        // updateTrustScore (responder): 7 queries (ADR-037)
        .mockResolvedValueOnce(mockResult([{ offers_accepted: '2', requests_completed: '1', recent_interactions: '2' }]))
        .mockResolvedValueOnce(mockResult([]))  // getCommunityTrustConfig
        .mockResolvedValueOnce(mockResult([]))  // getWeightedAvgFeedback
        .mockResolvedValueOnce(mockResult([{ distinct_communities: '1' }]))
        .mockResolvedValueOnce(mockResult([{ distinct_people: '1' }]))
        .mockResolvedValueOnce(mockResult([{ repeat_pairs: '0' }]))
        .mockResolvedValueOnce(mockResult([]))  // upsert
        // updateTrustScore (requester): 7 queries
        .mockResolvedValueOnce(mockResult([{ offers_accepted: '0', requests_completed: '2', recent_interactions: '1' }]))
        .mockResolvedValueOnce(mockResult([]))  // getCommunityTrustConfig
        .mockResolvedValueOnce(mockResult([]))  // getWeightedAvgFeedback
        .mockResolvedValueOnce(mockResult([{ distinct_communities: '1' }]))
        .mockResolvedValueOnce(mockResult([{ distinct_people: '1' }]))
        .mockResolvedValueOnce(mockResult([{ repeat_pairs: '0' }]))
        .mockResolvedValueOnce(mockResult([]));  // upsert

      await awardKarmaForCompletedMatch(mockMatchData);

      // Should still award karma (in fallback community)
      const insertCalls = mockQuery.mock.calls.filter(
        call => call[0].includes('INSERT INTO reputation.karma_records')
      );
      expect(insertCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('should throw error when no communities found at all', async () => {
      mockQuery
        // getSharedRequestCommunities - empty
        .mockResolvedValueOnce(mockResult([]))
        // Fallback - also empty
        .mockResolvedValueOnce(mockResult([]));

      await expect(awardKarmaForCompletedMatch(mockMatchData))
        .rejects
        .toThrow('No communities found');
    });

    it('should update trust scores for both users in each shared community', async () => {
      mockForSingleCommunity();

      await awardKarmaForCompletedMatch(mockMatchData);

      const trustScoreCalls = mockQuery.mock.calls.filter(
        call => call[0].includes('reputation.trust_scores')
      );

      // Should update trust scores for both users (at least 2 upsert calls)
      expect(trustScoreCalls.length).toBeGreaterThanOrEqual(2);
    });
  });
});

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
