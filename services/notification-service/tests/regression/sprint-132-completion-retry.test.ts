const mockQueues: Record<string, Record<string, (job: any) => Promise<void>>> = {};
const mockQuery = jest.fn();
const mockRelease = jest.fn();
jest.mock('bull', () => jest.fn().mockImplementation((name: string) => {
  mockQueues[name] ??= {};
  return { process: (type: string, handler: any) => { mockQueues[name][type] = handler; }, on: jest.fn() };
}));
jest.mock('../../src/database/db', () => ({ query: (...a: any[]) => mockQuery(...a), getClient: async () => ({ query: (...a: any[]) => mockQuery(...a), release: mockRelease }) }));
jest.mock('../../src/lib/expoPush', () => ({ sendPushToUsers: jest.fn() }));
import { initEventSubscriber } from '../../src/events/subscriber';
import { notificationEmitter } from '../../src/services/notificationService';
it('keeps one completion notification per participant after a second-recipient failure', async () => {
  const persisted = new Set<string>(); let failOwner = true;
  mockQuery.mockImplementation(async (sql: string, params: any[] = []) => {
    if (sql.includes('FROM requests.help_requests')) return { rows: [{ title: 'Private borrow' }] };
    if (sql.includes('SELECT id FROM notifications.notifications')) return { rows: persisted.has(params[0]) ? [{ id: 'existing' }] : [] };
    if (sql.includes('INSERT INTO notifications.notifications')) {
      if (params[0] === 'O' && failOwner) { failOwner = false; throw new Error('second recipient failed'); }
      persisted.add(params[0]); return { rows: [{ id: 'n-' + params[0] }] };
    }
    return { rows: [] };
  });
  const emit = jest.spyOn(notificationEmitter, 'emit');
  await initEventSubscriber();
  const handler = mockQueues['karmyq-completion-notification'].match_completed;
  expect(handler).toBe(mockQueues['karmyq-events'].match_completed);
  const job = { data: { payload: { match_id: 'match', request_id: 'ask', requester_id: 'R', responder_id: 'O' } } };
  await expect(handler(job)).rejects.toThrow('second recipient');
  await handler(job); await handler(job);
  expect(emit.mock.calls.filter(([name]) => name === 'notification')).toHaveLength(2);
  expect(mockQuery.mock.calls.filter(([sql]) => sql === 'ROLLBACK')).toHaveLength(1);
  expect(mockRelease).toHaveBeenCalledTimes(6);
  emit.mockRestore();
});
