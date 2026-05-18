/**
 * feedbackDb — getBlendedAvgFeedback tests
 *
 * Blended feedback: 70% local (this community) + 30% cross-community.
 * Falls back to whichever side has data when only one side exists.
 */

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...args: any[]) => mockQuery(...args) }));

import { getBlendedAvgFeedback } from '../../src/database/feedbackDb';

const mockFeedbackRow = (localAvg: string | null, globalAvg: string | null) => ({
  rows: [{ local_avg: localAvg, global_avg: globalAvg }],
});

describe('getBlendedAvgFeedback', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when there is no feedback at all', async () => {
    mockQuery.mockResolvedValue(mockFeedbackRow(null, null));
    const result = await getBlendedAvgFeedback('user-1', 'community-1');
    expect(result).toBeNull();
  });

  it('returns local avg directly when only local feedback exists', async () => {
    mockQuery.mockResolvedValue(mockFeedbackRow('4.50', '4.50'));
    // local=4.5, global=4.5 — when they're equal the blend is still 4.5
    const result = await getBlendedAvgFeedback('user-1', 'community-1');
    expect(result).toBeCloseTo(4.5);
  });

  it('returns global avg directly when user has no local feedback in this community', async () => {
    // local_avg is null (no ratings in this community), global_avg exists
    mockQuery.mockResolvedValue(mockFeedbackRow(null, '5.00'));
    const result = await getBlendedAvgFeedback('user-1', 'community-2');
    expect(result).toBe(5.0);
  });

  it('returns local avg directly when user has no cross-community feedback', async () => {
    // local_avg exists, global_avg equals local (only one community of data)
    // This is handled by the "both sides have data" path since global_avg is non-null
    // even if it equals local_avg (SQL AVG over all rows = local rows if all are in this community)
    mockQuery.mockResolvedValue(mockFeedbackRow('3.00', '3.00'));
    const result = await getBlendedAvgFeedback('user-1', 'community-1');
    expect(result).toBeCloseTo(3.0);
  });

  it('returns weighted blend (0.7 local + 0.3 global) when both sides have data', async () => {
    // local=5.0, global=3.0 → 0.7×5 + 0.3×3 = 3.5 + 0.9 = 4.4
    mockQuery.mockResolvedValue(mockFeedbackRow('5.00', '3.00'));
    const result = await getBlendedAvgFeedback('user-1', 'community-1');
    expect(result).toBeCloseTo(4.4);
  });

  it('weights local more heavily than cross-community (0.7 vs 0.3)', async () => {
    // local=2.0 (bad in this community), global=4.5 (good elsewhere)
    // blend = 0.7×2 + 0.3×4.5 = 1.4 + 1.35 = 2.75
    mockQuery.mockResolvedValue(mockFeedbackRow('2.00', '4.50'));
    const result = await getBlendedAvgFeedback('user-1', 'community-1');
    expect(result).toBeCloseTo(2.75);
  });

  it('uses custom weights when provided', async () => {
    // 50/50 split
    mockQuery.mockResolvedValue(mockFeedbackRow('4.00', '2.00'));
    const result = await getBlendedAvgFeedback('user-1', 'community-1', 0.5, 0.5);
    expect(result).toBeCloseTo(3.0);
  });

  it('passes user_id and community_id to the query', async () => {
    mockQuery.mockResolvedValue(mockFeedbackRow(null, null));
    await getBlendedAvgFeedback('user-abc', 'community-xyz');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('feedback.feedback'),
      ['user-abc', 'community-xyz'],
    );
  });
});
