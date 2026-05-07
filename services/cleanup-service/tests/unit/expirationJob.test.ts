import { markExpiredData } from '../../src/jobs/expirationJob';

jest.mock('../../src/database/db', () => ({
  query: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

import { query } from '../../src/database/db';
const mockQuery = query as jest.MockedFunction<typeof query>;

describe('markExpiredData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls UPDATE for all four tables (requests, offers, messages, notifications)', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    await markExpiredData();
    expect(mockQuery).toHaveBeenCalledTimes(4);
  });

  it('each UPDATE targets the correct table', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    await markExpiredData();
    const sqlCalls = mockQuery.mock.calls.map((c) => c[0] as string);
    expect(sqlCalls[0]).toContain('requests.help_requests');
    expect(sqlCalls[1]).toContain('requests.help_offers');
    expect(sqlCalls[2]).toContain('messaging.messages');
    expect(sqlCalls[3]).toContain('notifications.notifications');
  });

  it('completes without throwing when rows are expired', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 3 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 2 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
    await expect(markExpiredData()).resolves.not.toThrow();
  });

  it('handles zero expired rows without error', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    await expect(markExpiredData()).resolves.not.toThrow();
  });

  it('throws when the database query fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB down'));
    await expect(markExpiredData()).rejects.toThrow('DB down');
  });
});
