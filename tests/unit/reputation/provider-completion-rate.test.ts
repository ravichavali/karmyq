/**
 * Unit tests for updateProviderCompletionRate (Sprint 11 - Workstream 1.1)
 *
 * Tests the provider completion_rate calculation and upsert logic with mocked DB.
 *
 * Note: As of Sprint 28, updateProviderCompletionRate now calls
 * recalculateProviderTrustScore after updating completion_rate. Each provider
 * processed requires 3 additional queries (review stats, existing metrics, trust_score upsert).
 */

jest.mock('../../../services/reputation-service/src/database/db', () => ({
  query: jest.fn(),
}));

// Sprint 126: awardKarmaForCompletedMatch moved to standingProjector; karmaService no longer
// exports it, so mocking it there isolated nothing (and blanked updateTrustScore as a side effect).
jest.mock('../../../services/reputation-service/src/services/standingProjector', () => ({
  awardKarmaForCompletedMatch: jest.fn(),
}));

jest.mock('bull', () =>
  jest.fn().mockImplementation(() => ({ process: jest.fn() }))
);

import { query } from '../../../services/reputation-service/src/database/db';
import { updateProviderCompletionRate } from '../../../services/reputation-service/src/events/subscriber';

const mockQuery = query as jest.MockedFunction<typeof query>;

// Helper: add the 3 extra queries recalculateProviderTrustScore makes after
// completion_rate is updated. noReviews=true when the provider has no reviews.
function addRecalculateMocks(noReviews = true) {
  // query: review stats
  mockQuery.mockResolvedValueOnce({
    rows: [{ avg_stars: noReviews ? null : '4.5', total_reviews: noReviews ? '0' : '5' }],
    rowCount: 1,
  } as any);
  // query: existing metrics (completion_rate/response_rate)
  mockQuery.mockResolvedValueOnce({
    rows: [{ completion_rate: '0', response_rate: '0' }],
    rowCount: 1,
  } as any);
  // query: trust_score upsert
  mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
}

describe('updateProviderCompletionRate', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('returns early when user has no active provider profile', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    await updateProviderCompletionRate('user-no-profile');

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toContain('provider_profiles');
    // No upsert should be made
    const upsert = mockQuery.mock.calls.find((c) => (c[0] as string).includes('provider_trust_scores'));
    expect(upsert).toBeUndefined();
  });

  it('calculates 75% completion_rate (3 completed / 4 accepted) and upserts', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'p-uuid-1' }], rowCount: 1 } as any)   // profile lookup
      .mockResolvedValueOnce({ rows: [{ accepted_matches: '4', completed_matches: '3' }], rowCount: 1 } as any)  // match stats
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);  // completion_rate upsert

    addRecalculateMocks(); // 3 more queries for recalculateProviderTrustScore

    await updateProviderCompletionRate('user-a');

    // Find the completion_rate upsert (first trust_scores query, with 2 params)
    const upsertCalls = mockQuery.mock.calls.filter((c) => (c[0] as string).includes('provider_trust_scores'));
    // First trust_scores query is the completion_rate upsert (params: [provider_id, completion_rate])
    const completionUpsert = upsertCalls.find((c) => (c[1] as any[])?.length === 2);
    expect(completionUpsert).toBeDefined();
    expect(completionUpsert![1]).toEqual(['p-uuid-1', 75]);
  });

  it('sets completion_rate to 0 when accepted_matches is 0 (avoids division by zero)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'p-uuid-2' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ accepted_matches: '0', completed_matches: '0' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    addRecalculateMocks();

    await updateProviderCompletionRate('user-b');

    const upsertCalls = mockQuery.mock.calls.filter((c) => (c[0] as string).includes('provider_trust_scores'));
    const completionUpsert = upsertCalls.find((c) => (c[1] as any[])?.length === 2);
    expect(completionUpsert![1]).toEqual(['p-uuid-2', 0]);
  });

  it('processes each profile when user has multiple active service types', async () => {
    mockQuery
      // profiles
      .mockResolvedValueOnce({ rows: [{ id: 'p1' }, { id: 'p2' }], rowCount: 2 } as any)
      // stats for p1
      .mockResolvedValueOnce({ rows: [{ accepted_matches: '2', completed_matches: '2' }], rowCount: 1 } as any)
      // completion_rate upsert for p1
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    addRecalculateMocks(); // recalculate for p1

    mockQuery
      // stats for p2
      .mockResolvedValueOnce({ rows: [{ accepted_matches: '1', completed_matches: '0' }], rowCount: 1 } as any)
      // completion_rate upsert for p2
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    addRecalculateMocks(); // recalculate for p2

    await updateProviderCompletionRate('user-c');

    const upsertCalls = mockQuery.mock.calls.filter((c) => (c[0] as string).includes('provider_trust_scores'));
    const completionUpserts = upsertCalls.filter((c) => (c[1] as any[])?.length === 2);
    expect(completionUpserts).toHaveLength(2);
    expect(completionUpserts[0][1]).toEqual(['p1', 100]);
    expect(completionUpserts[1][1]).toEqual(['p2', 0]);
  });

  it('uses responder_id (not requester_id) when querying provider_profiles', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    await updateProviderCompletionRate('responder-xyz');

    expect(mockQuery.mock.calls[0][1]).toContain('responder-xyz');
  });
});
