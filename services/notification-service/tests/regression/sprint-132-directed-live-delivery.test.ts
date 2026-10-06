const handlers: Record<string, (job: any) => Promise<void>> = {};
const mockQuery = jest.fn();
jest.mock('bull', () => jest.fn().mockImplementation(() => ({ process: (type: string, fn: any) => { handlers[type] = fn; }, on: jest.fn() })));
jest.mock('../../src/database/db', () => ({ query: (...args: any[]) => mockQuery(...args) }));
jest.mock('../../src/lib/expoPush', () => ({ sendPushToUsers: jest.fn() }));
const mockCreate = jest.fn();
jest.mock('../../src/services/notificationService', () => ({ createNotification: (...args: any[]) => mockCreate(...args) }));
import { initEventSubscriber } from '../../src/events/subscriber';
const job = { data: { payload: { request_id: 'ask', requester_id: 'R', recipient_user_ids: ['demoted', 'deleted'], title: 'Stale title', inventory_item_id: 'item' } } };
beforeEach(async () => { mockQuery.mockReset(); mockCreate.mockReset(); await initEventSubscriber(); });
it('resolves current recipients and content after an outage instead of using demoted or deleted recipients', async () => {
  mockQuery.mockResolvedValue({ rows: [{ user_id: 'promoted', title: 'Current title', requester_name: 'Riley', inventory_item_id: 'item' }] });
  await handlers.directed_request_created(job);
  expect(mockCreate.mock.calls.map(([args]) => args.user_id)).toEqual(['promoted']);
  expect(mockCreate.mock.calls[0][0].data.request_title).toBe('Current title');
  expect(mockQuery.mock.calls[0][0]).toContain("cm.status='active'");
  expect(mockQuery.mock.calls[0][0]).toContain("cm.role='admin'");
});
it('treats a queued job for a deleted request as terminal without revealing its saved title', async () => {
  mockQuery.mockResolvedValue({ rows: [] });
  await expect(handlers.directed_request_created(job)).resolves.toBeUndefined();
  expect(mockCreate).not.toHaveBeenCalled();
});
