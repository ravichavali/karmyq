const mockQueues: Record<string, { processed: string[]; on: jest.Mock }> = {};
jest.mock('bull', () => jest.fn().mockImplementation((name: string) => {
  const q = { processed: [] as string[], on: jest.fn(), process: (n: string) => { q.processed.push(n); } };
  mockQueues[name] = q;
  return q;
}));
import { startConsumerQueue } from '../../../events/consumer';
import { eventsFor } from '../../../events/routes';

const handlerFor = (names: string[]) => Object.fromEntries(names.map((n) => [n, async () => undefined]));

describe('startConsumerQueue', () => {
  it('attaches exactly the routed names to the consumer queue', () => {
    startConsumerQueue('reputation', handlerFor(['interaction_feedback_submitted']), 'redis://x');
    expect(mockQueues['karmyq-events-reputation'].processed).toEqual(['interaction_feedback_submitted']);
    expect(mockQueues['karmyq-events-reputation'].on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('refuses to start with a missing handler and names it', () => {
    const names = eventsFor('notification').filter((n) => n !== 'request_created');
    expect(() => startConsumerQueue('notification', handlerFor(names), 'redis://x'))
      .toThrow('karmyq-events-notification handlers do not match EVENT_ROUTES: missing [request_created], unrouted []');
  });

  it('also attaches every routed handler, the same function, to a legacy drain queue', () => {
    const handlers = handlerFor(['interaction_feedback_submitted']);
    const legacy = { processed: [] as Array<[string, unknown]>, process(n: string, h: unknown) { this.processed.push([n, h]); } };
    startConsumerQueue('reputation', handlers, 'redis://x', legacy as any);
    expect(legacy.processed).toEqual([['interaction_feedback_submitted', handlers.interaction_feedback_submitted]]);
  });

  it('validates before attaching anything, so a mismatch never starts legacy workers', () => {
    const legacy = { process: jest.fn() };
    const before = Object.keys(mockQueues).length;
    expect(() => startConsumerQueue('reputation', handlerFor(['typo_event']), 'redis://x', legacy as any)).toThrow('handlers do not match');
    expect(legacy.process).not.toHaveBeenCalled();
    expect(Object.keys(mockQueues).length).toBe(before);
  });

  it('refuses to start with an unrouted handler and names it', () => {
    const names = [...eventsFor('reputation'), 'match_completed'];
    expect(() => startConsumerQueue('reputation', handlerFor(names), 'redis://x'))
      .toThrow('karmyq-events-reputation handlers do not match EVENT_ROUTES: missing [], unrouted [match_completed]');
  });
});
