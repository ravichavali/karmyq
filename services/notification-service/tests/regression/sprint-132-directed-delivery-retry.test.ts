const queues: Record<string, Record<string, (job: any) => Promise<void>>> = {};
const mockQuery = jest.fn();
jest.mock('bull', () => jest.fn().mockImplementation((name: string) => { queues[name] ??= {}; return { process: (type: string, fn: any) => { queues[name][type] = fn; }, on: jest.fn() }; }));
jest.mock('../../src/database/db', () => ({ query: (...a: any[]) => mockQuery(...a) }));
jest.mock('../../src/lib/expoPush', () => ({ sendPushToUsers: jest.fn() }));
import { initEventSubscriber } from '../../src/events/subscriber';
import { notificationEmitter } from '../../src/services/notificationService';
it('isolates directed jobs and inserts only one notification per recipient across partial retries', async () => {
  const persisted = new Set<string>(); let failA = true;
  mockQuery.mockImplementation(async (sql: string, params: any[]) => {
    if (sql.includes('FROM requests.help_requests r')) return { rows: ['O', 'A'].map(user_id => ({ user_id, requester_name: 'Riley', title: 'Ask to borrow Ladder', inventory_item_id: 'item' })) };
    if (sql.includes('FROM auth.users')) return { rows: [{ name: 'Riley' }] };
    if (sql.includes('INSERT INTO notifications.notifications')) {
      if (params[0] === 'A' && failA) { failA = false; throw Error('injected second-recipient failure'); }
      if (sql.includes('ON CONFLICT') && persisted.has(params[0])) return { rows: [] };
      persisted.add(params[0]); return { rows: [{ id: 'n-' + params[0] }] };
    }
    return { rows: [] };
  });
  const emit = jest.spyOn(notificationEmitter, 'emit');
  await initEventSubscriber();
  expect(queues['karmyq-events'].directed_request_created).toBeUndefined();
  const handler = queues['karmyq-directed-notifications'].directed_request_created;
  const job = { data: { payload: { request_id: 'ask', requester_id: 'R', recipient_user_ids: ['O', 'A'], title: 'Ask to borrow Ladder', inventory_item_id: 'item' } } };
  await expect(handler(job)).rejects.toThrow('injected'); await handler(job); await handler(job);
  expect(emit.mock.calls.filter(([name]) => name === 'notification')).toHaveLength(2);
  emit.mockRestore();
});
