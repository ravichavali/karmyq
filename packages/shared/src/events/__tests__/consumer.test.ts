const mockQueues: Record<string, { processed: string[]; on: jest.Mock }> = {};
const mockConstructed: string[] = [];
jest.mock('bull', () => jest.fn().mockImplementation((name: string) => {
  const q = { processed: [] as string[], on: jest.fn(), process: (n: string) => { q.processed.push(n); } };
  mockQueues[name] = q;
  mockConstructed.push(name);
  return q;
}));
import { startConsumerQueue } from '../../../events/consumer';
import { eventsFor } from '../../../events/routes';

const handlerFor = (names: string[]) => Object.fromEntries(names.map((n) => [n, async () => undefined]));

describe('startConsumerQueue', () => {
  beforeEach(() => { mockConstructed.length = 0; });

  it('attaches exactly the routed names to the consumer queue, and opens no other queue', () => {
    startConsumerQueue('notification', handlerFor(eventsFor('notification')), 'redis://x');
    expect(mockConstructed).toEqual(['karmyq-events-notification']);
    expect(mockQueues['karmyq-events-notification'].processed).toEqual(eventsFor('notification'));
    expect(mockQueues['karmyq-events-notification'].on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('takes no legacy drain queue (Sprint 134 PR L removed the shared karmyq-events handlers)', () => {
    expect(startConsumerQueue.length).toBe(3);
  });

  it('refuses to start with a missing handler and names it', () => {
    const names = eventsFor('notification').filter((n) => n !== 'request_created');
    expect(() => startConsumerQueue('notification', handlerFor(names), 'redis://x'))
      .toThrow('karmyq-events-notification handlers do not match EVENT_ROUTES: missing [request_created], unrouted []');
  });

  it('validates before opening its queue', () => {
    expect(() => startConsumerQueue('notification', handlerFor(['typo_event']), 'redis://x')).toThrow('handlers do not match');
    expect(mockConstructed).toEqual([]);
  });

  it('refuses to start with an unrouted handler and names it', () => {
    const names = [...eventsFor('notification'), 'match_completed'];
    expect(() => startConsumerQueue('notification', handlerFor(names), 'redis://x'))
      .toThrow('karmyq-events-notification handlers do not match EVENT_ROUTES: missing [], unrouted [match_completed]');
  });
});
