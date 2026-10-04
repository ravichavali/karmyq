const handlers: Record<string, (job: any) => Promise<void>> = {};
const mockQuery = jest.fn();
jest.mock('bull', () => jest.fn().mockImplementation(() => ({ process: (name: string, handler: any) => { handlers[name] = handler; }, on: jest.fn() })));
jest.mock('../../src/database/db', () => ({ query: (...args: any[]) => mockQuery(...args) }));
jest.mock('../../src/lib/expoPush', () => ({ sendPushToUsers: jest.fn() }));
import { initEventSubscriber } from '../../src/events/subscriber';
beforeEach(() => {
  mockQuery.mockReset().mockImplementation(async (sql: string) => {
    if (sql.includes('FROM auth.users')) return { rows: [{ name: 'Riley' }] };
    if (sql.includes('INSERT INTO notifications.notifications')) return { rows: [{ id: 'notification' }] };
    return { rows: [] };
  });
});
it('creates notifications for exactly the two explicit recipients using the real template/service, without membership fan-out', async () => {
  await initEventSubscriber(); expect(typeof handlers.directed_request_created).toBe('function');
  await handlers.directed_request_created({ data: { payload: { request_id: 'ask', requester_id: 'R', recipient_user_ids: ['O', 'A'], title: 'Ask to borrow Ladder', inventory_item_id: 'item' } } });
  const inserts = mockQuery.mock.calls.filter(([sql]) => sql.includes('INSERT INTO notifications.notifications'));
  expect(inserts.map(([, p]) => p[0])).toEqual(['O', 'A']);
  for (const [, params] of inserts) {
    expect(params[1]).toBe('directed_request_created'); expect(params[2]).toContain('Riley asked to borrow');
    expect(params[5]).toBe('/requests/ask');
  }
  expect(mockQuery.mock.calls.filter(([sql]) => sql.includes('communities.members'))).toEqual([]);
});
