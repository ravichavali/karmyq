type Handler = (job: any) => Promise<void>;
const mockQueues: Record<string, { add: jest.Mock; process: jest.Mock; on: jest.Mock }> = {};
const mockHandlers: Record<string, Handler> = {};
const mockSharedPublish = jest.fn();
jest.mock('@karmyq/shared', () => ({ createPublisher: () => ({ initEventPublisher: jest.fn(), getEventQueue: jest.fn(), publishEvent: mockSharedPublish }) }));
jest.mock('../../src/events/directedNotifications', () => ({ publishDirectedNotification: jest.fn(), startDirectedNotificationRelay: jest.fn() }));
jest.mock('bull', () => jest.fn().mockImplementation((name: string) => {
  return mockQueues[name] = {
    add: jest.fn().mockResolvedValue({}), on: jest.fn(),
    process: jest.fn((type: string, handler: Handler) => { mockHandlers[name] = handler; }),
  };
}));
import { initEventPublisher, publishEvent } from '../../src/events/publisher';
const targets = ['karmyq-completion-reputation', 'karmyq-completion-notification', 'karmyq-completion-social-graph'];
const payload = { match_id: 'match-1', request_id: 'request-1', requester_id: 'R', responder_id: 'O' };
beforeAll(async () => { await initEventPublisher(); });
beforeEach(() => { jest.clearAllMocks(); for (const q of Object.values(mockQueues)) q.add.mockResolvedValue({}); });
it('persists one completion dispatch job instead of sharing a job between competing consumers', async () => {
  await publishEvent('match_completed', payload);
  expect(mockSharedPublish).not.toHaveBeenCalled();
  expect(mockQueues['karmyq-completion-dispatch']?.add).toHaveBeenCalledWith('match_completed', expect.objectContaining({ payload }), expect.objectContaining({ jobId: 'completion-match-1' }));
});
it('fans out independent jobs with the same stable identity to every completion consumer', async () => {
  expect(mockHandlers['karmyq-completion-dispatch']).toBeDefined();
  await mockHandlers['karmyq-completion-dispatch']({ data: { eventType: 'match_completed', payload } });
  for (const name of targets) expect(mockQueues[name].add).toHaveBeenCalledWith('match_completed', expect.objectContaining({ payload }), expect.objectContaining({ jobId: 'completion-match-1' }));
});
it('retries partial enqueue failure without inventing a new identity for successful targets', async () => {
  expect(mockHandlers['karmyq-completion-dispatch']).toBeDefined();
  mockQueues[targets[1]].add.mockRejectedValueOnce(new Error('Redis interrupted fanout'));
  const job = { data: { payload } };
  await expect(mockHandlers['karmyq-completion-dispatch'](job)).rejects.toThrow('interrupted');
  await mockHandlers['karmyq-completion-dispatch'](job);
  for (const name of targets) for (const call of mockQueues[name].add.mock.calls) expect(call[2].jobId).toBe('completion-match-1');
});
it('keeps unrelated events on their existing transport', async () => {
  await publishEvent('match_created', payload);
  expect(mockSharedPublish).toHaveBeenCalledWith('match_created', payload);
});
