const handlers: Record<string, (job: any) => Promise<void>> = {};
const mockQuery = jest.fn();
jest.mock('bull', () => jest.fn().mockImplementation(() => ({
  process: (type: string, handler: any) => { handlers[type] = handler; }, on: jest.fn(),
})));
jest.mock('../../src/database/db', () => ({ query: (...args: any[]) => mockQuery(...args) }));
jest.mock('../../src/lib/expoPush', () => ({ sendPushToUsers: jest.fn() }));
jest.mock('../../src/services/notificationService', () => ({ createNotification: jest.fn() }));
import { initEventSubscriber } from '../../src/events/subscriber';

// Removing either lifecycle predicate must fail this database-boundary contract.
// Real delayed-job integration cases separately prove PostgreSQL filters closed/expired rows.
it('limits the delivery recipient lookup to open, unexpired directed requests', async () => {
  mockQuery.mockResolvedValue({ rows: [] });
  await initEventSubscriber();
  await handlers.directed_request_created({ data: { payload: { request_id: 'ask' } } });
  const [sql, params] = mockQuery.mock.calls[0];
  expect(params).toEqual(['ask']);
  expect(sql).toMatch(/\br\.status\s*=\s*'open'/i);
  expect(sql).toMatch(/\bNOT\s+r\.expired\b/i);
});
