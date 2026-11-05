import { markExpiredData, batchHardDelete } from '../../src/jobs/expirationJob';

jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: { connect: jest.fn() },
  query: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

import pool, { query } from '../../src/database/db';
import { logger } from '../../src/utils/logger';
const mockQuery = query as jest.MockedFunction<typeof query>;
const mockConnect = pool.connect as unknown as jest.Mock;

describe('markExpiredData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('issues the four flag UPDATEs, then the release (candidate read, no asks, one stranded-offer UPDATE)', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    await markExpiredData();
    expect(mockQuery).toHaveBeenCalledTimes(6);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('each statement targets the correct table, in order', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    await markExpiredData();
    const sqlCalls = mockQuery.mock.calls.map((c) => c[0] as string);
    expect(sqlCalls[0]).toContain('requests.help_requests');
    expect(sqlCalls[1]).toContain('requests.help_offers');
    expect(sqlCalls[2]).toContain('messaging.messages');
    expect(sqlCalls[3]).toContain('notifications.notifications');
    // The release runs after all four flags: the candidate read, then the stranded-offer free.
    expect(sqlCalls[4]).toMatch(/^\s*SELECT h\.id FROM requests\.help_requests h/);
    expect(sqlCalls[5]).toMatch(/^\s*UPDATE requests\.help_offers o SET status = 'active'/);
  });

  it('completes without throwing when rows are expired', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 3 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 2 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValue({ rows: [], rowCount: 0 } as any);
    await expect(markExpiredData()).resolves.not.toThrow();
  });

  it('handles zero expired rows without error', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    await expect(markExpiredData()).resolves.not.toThrow();
  });

  it('logs a distinct error and still rejects when the release step fails after the flags committed', async () => {
    const boom = new Error('candidate read failed');
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockRejectedValueOnce(boom);
    await expect(markExpiredData()).rejects.toBe(boom);
    // The four flag UPDATEs ran first, then the failing candidate read; nothing after it.
    const sqlCalls = mockQuery.mock.calls.map((c) => c[0] as string);
    expect(sqlCalls).toHaveLength(5);
    expect(sqlCalls[0]).toContain('requests.help_requests');
    expect(sqlCalls[3]).toContain('notifications.notifications');
    expect(sqlCalls[4]).toMatch(/^\s*SELECT h\.id FROM requests\.help_requests h/);
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to release expired holds; expiry flags already committed', { error: boom });
  });

  it('throws when the database query fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB down'));
    await expect(markExpiredData()).rejects.toThrow('DB down');
  });
});

describe('batchHardDelete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps deleting while a batch comes back full, and sums every batch', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 2 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 2 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
    await expect(batchHardDelete('messaging.messages', 2)).resolves.toBe(5);
    expect(mockQuery).toHaveBeenCalledTimes(3);
    expect(mockQuery.mock.calls[0][1]).toEqual([expect.any(String), 2]);
  });

  it('runs exactly once when the first batch is short, including an empty table', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
    await expect(batchHardDelete('requests.help_requests', 1000)).resolves.toBe(0);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('treats a null rowCount as 0 and stops', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: null } as any);
    await expect(batchHardDelete('requests.help_offers', 10)).resolves.toBe(0);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('rejects a table outside the allow-list without querying', async () => {
    await expect(batchHardDelete('auth.users', 10)).rejects.toThrow(/not in the allowed list/);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
