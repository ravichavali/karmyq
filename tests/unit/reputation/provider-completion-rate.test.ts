/**
 * Unit tests for updateProviderCompletionRate (Sprint 11 - Workstream 1.1)
 *
 * Tests the provider completion_rate calculation and upsert logic with mocked DB.
 */

jest.mock('../../../services/reputation-service/src/database/db', () => ({
  query: jest.fn(),
}));

jest.mock('../../../services/reputation-service/src/services/karmaService', () => ({
  awardKarmaForCompletedMatch: jest.fn(),
}));

jest.mock('bull', () =>
  jest.fn().mockImplementation(() => ({ process: jest.fn() }))
);

import { query } from '../../../services/reputation-service/src/database/db';
import { updateProviderCompletionRate } from '../../../services/reputation-service/src/events/subscriber';

const mockQuery = query as jest.MockedFunction<typeof query>;

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
      .mockResolvedValueOnce({ rows: [{ id: 'p-uuid-1' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ accepted_matches: '4', completed_matches: '3' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    await updateProviderCompletionRate('user-a');

    const upsertCall = mockQuery.mock.calls.find((c) => (c[0] as string).includes('provider_trust_scores'));
    expect(upsertCall).toBeDefined();
    expect(upsertCall![1]).toEqual(['p-uuid-1', 75]);
  });

  it('sets completion_rate to 0 when accepted_matches is 0 (avoids division by zero)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'p-uuid-2' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ accepted_matches: '0', completed_matches: '0' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    await updateProviderCompletionRate('user-b');

    const upsertCall = mockQuery.mock.calls.find((c) => (c[0] as string).includes('provider_trust_scores'));
    expect(upsertCall![1]).toEqual(['p-uuid-2', 0]);
  });

  it('processes each profile when user has multiple active service types', async () => {
    mockQuery
      // profiles
      .mockResolvedValueOnce({ rows: [{ id: 'p1' }, { id: 'p2' }], rowCount: 2 } as any)
      // stats for p1
      .mockResolvedValueOnce({ rows: [{ accepted_matches: '2', completed_matches: '2' }], rowCount: 1 } as any)
      // upsert for p1
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
      // stats for p2
      .mockResolvedValueOnce({ rows: [{ accepted_matches: '1', completed_matches: '0' }], rowCount: 1 } as any)
      // upsert for p2
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    await updateProviderCompletionRate('user-c');

    const upsertCalls = mockQuery.mock.calls.filter((c) => (c[0] as string).includes('provider_trust_scores'));
    expect(upsertCalls).toHaveLength(2);
    expect(upsertCalls[0][1]).toEqual(['p1', 100]);
    expect(upsertCalls[1][1]).toEqual(['p2', 0]);
  });

  it('uses responder_id (not requester_id) when querying provider_profiles', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    await updateProviderCompletionRate('responder-xyz');

    expect(mockQuery.mock.calls[0][1]).toContain('responder-xyz');
  });
});
