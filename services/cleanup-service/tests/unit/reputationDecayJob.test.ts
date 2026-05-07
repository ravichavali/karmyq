import { updateDecayedTrustScores } from '../../src/jobs/reputationDecayJob';

jest.mock('../../src/database/db', () => ({
  query: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

import { query } from '../../src/database/db';
const mockQuery = query as jest.MockedFunction<typeof query>;

describe('updateDecayedTrustScores', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches all trust score pairs — no update calls when no rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
    await updateDecayedTrustScores();
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('calls calculate_decayed_karma with correct userId and communityId', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'ts1', user_id: 'u1', community_id: 'c1', current_score: 10 }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({ rows: [{ decayed_karma: 100 }], rowCount: 1 } as any);
    // score unchanged (100/10=10 === current_score 10) — no UPDATE
    await updateDecayedTrustScores();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('calculate_decayed_karma'),
      expect.arrayContaining(['u1', 'c1'])
    );
  });

  it('applies min(100, floor(karma / 10)) formula — caps new score at 100', async () => {
    // karma = 1050 → floor(1050/10) = 105 → min(100, 105) = 100; current_score = 50 → update fires
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'ts1', user_id: 'u1', community_id: 'c1', current_score: 50 }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({ rows: [{ decayed_karma: 1050 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
    await updateDecayedTrustScores();
    const updateCall = mockQuery.mock.calls[2];
    expect(updateCall[1]).toContain(100);
  });

  it('skips UPDATE when calculated score equals current score', async () => {
    // karma = 100 → floor(100/10) = 10 → min(100, 10) = 10; current_score = 10 → no update
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'ts1', user_id: 'u1', community_id: 'c1', current_score: 10 }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({ rows: [{ decayed_karma: 100 }], rowCount: 1 } as any);
    await updateDecayedTrustScores();
    // Only 2 calls: SELECT + decay calc — no UPDATE
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('UPDATE uses the trust score id, not user_id', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'ts-abc', user_id: 'u1', community_id: 'c1', current_score: 0 }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({ rows: [{ decayed_karma: 200 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
    await updateDecayedTrustScores();
    const updateCall = mockQuery.mock.calls[2];
    expect(updateCall[1]).toContain('ts-abc');
  });

  it('processes multiple rows — fires correct number of db calls', async () => {
    // 2 rows: row1 score unchanged, row2 score changed → 1+2+3 = 5 calls total
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          { id: 'ts1', user_id: 'u1', community_id: 'c1', current_score: 10 },
          { id: 'ts2', user_id: 'u2', community_id: 'c1', current_score: 5 },
        ],
        rowCount: 2,
      } as any)
      .mockResolvedValueOnce({ rows: [{ decayed_karma: 100 }], rowCount: 1 } as any) // u1: 10 unchanged
      .mockResolvedValueOnce({ rows: [{ decayed_karma: 500 }], rowCount: 1 } as any) // u2: 50 > 5 → update
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // UPDATE for u2
    await updateDecayedTrustScores();
    expect(mockQuery).toHaveBeenCalledTimes(4);
  });
});
