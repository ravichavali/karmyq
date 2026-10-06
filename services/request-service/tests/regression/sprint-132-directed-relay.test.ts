const mockAdd = jest.fn(), mockGet = jest.fn(), mockRetry = jest.fn(), mockQuery = jest.fn();
jest.mock('bull', () => jest.fn().mockImplementation(() => ({ add: (...a: any[]) => mockAdd(...a), getJob: (...a: any[]) => mockGet(...a), on: jest.fn() })));
jest.mock('../../src/database/db', () => ({ withTransaction: (fn: any) => fn((...a: any[]) => mockQuery(...a)) }));
import { publishDirectedNotification, relayDirectedNotifications } from '../../src/events/directedNotifications';
import Queue from 'bull';
beforeEach(() => {
  (Queue as unknown as jest.Mock).mockImplementation(() => ({ add: (...a: any[]) => mockAdd(...a), getJob: (...a: any[]) => mockGet(...a), on: jest.fn() }));
  mockAdd.mockReset().mockResolvedValue({}); mockGet.mockReset().mockResolvedValue(null); mockRetry.mockReset().mockResolvedValue(undefined);
  mockQuery.mockReset().mockImplementation(async (sql: string) => ({ rows: sql.includes('SELECT request_id') ? [{ request_id: 'ask', payload: { request_id: 'ask' } }] : [] }));
});
it('leaves a durable delivery pending after Redis failure, then acknowledges on recovery', async () => {
  mockAdd.mockRejectedValueOnce(new Error('Redis down'));
  await expect(relayDirectedNotifications()).rejects.toThrow('Redis down');
  expect(mockQuery.mock.calls.filter(([sql]) => sql.startsWith('UPDATE'))).toEqual([]);
  await relayDirectedNotifications();
  expect(mockAdd.mock.calls[0][2].jobId).toBe('directed-ask');
  expect(mockQuery.mock.calls.filter(([sql]) => sql.startsWith('UPDATE'))).toHaveLength(1);
});
it('retries an exhausted failed job instead of treating its existing ID as a new delivery', async () => {
  mockGet.mockResolvedValue({ getState: async () => 'failed', retry: mockRetry });
  await publishDirectedNotification({ request_id: 'ask' });
  expect(mockRetry).toHaveBeenCalledTimes(1); expect(mockAdd).not.toHaveBeenCalled();
});
it('keeps checking acknowledged jobs until recipient delivery is confirmed', async () => {
  await relayDirectedNotifications();
  expect(mockQuery.mock.calls[0][0]).toContain('delivered_at IS NULL');
});
