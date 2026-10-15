const mockAdds: Record<string, jest.Mock> = {};
const mockConstructed: string[] = [];
jest.mock('bull', () => jest.fn().mockImplementation((name: string) => {
  mockConstructed.push(name);
  mockAdds[name] = jest.fn().mockResolvedValue({ id: `${name}-job` });
  return { on: jest.fn(), add: mockAdds[name] };
}));
import { createPublisher } from '../../../events/publisher';

describe('createPublisher (ADR-101 routed)', () => {
  beforeEach(() => { mockConstructed.length = 0; });

  it('exposes only initEventPublisher and publishEvent', () => {
    expect(Object.keys(createPublisher('svc')).sort()).toEqual(['initEventPublisher', 'publishEvent']);
  });

  it('throws if not initialized', async () => {
    await expect(createPublisher('svc').publishEvent('request_created', {})).rejects.toThrow('Event queue not initialized');
  });

  it('creates one queue per consumer and never the shared karmyq-events queue', async () => {
    await createPublisher('svc').initEventPublisher();
    expect(mockConstructed.sort()).toEqual(['karmyq-events-notification', 'karmyq-events-reputation']);
  });

  it('routes a notification event to the notification queue only, in the unchanged envelope', async () => {
    const p = createPublisher('request-service');
    await p.initEventPublisher();
    const job = await p.publishEvent('request_created', { request_id: 'r1' });
    expect(job).toEqual({ id: 'karmyq-events-notification-job' });
    expect(mockAdds['karmyq-events-notification']).toHaveBeenCalledTimes(1);
    expect(mockAdds['karmyq-events-notification']).toHaveBeenCalledWith('request_created', {
      eventType: 'request_created', payload: { request_id: 'r1' }, timestamp: expect.any(String), source: 'request-service',
    });
    expect(mockAdds['karmyq-events-reputation']).not.toHaveBeenCalled();
  });

  it('routes interaction_feedback_submitted to the reputation queue only', async () => {
    const p = createPublisher('request-service');
    await p.initEventPublisher();
    await p.publishEvent('interaction_feedback_submitted', { to_user_id: 'u' });
    expect(mockAdds['karmyq-events-reputation']).toHaveBeenCalledTimes(1);
    expect(mockAdds['karmyq-events-notification']).not.toHaveBeenCalled();
  });

  it('skips Redis for an unconsumed event and resolves null', async () => {
    const p = createPublisher('auth-service');
    await p.initEventPublisher();
    await expect(p.publishEvent('user_created', { userId: 'u' })).resolves.toBeNull();
    expect(mockAdds['karmyq-events-notification']).not.toHaveBeenCalled();
    expect(mockAdds['karmyq-events-reputation']).not.toHaveBeenCalled();
  });

  it('throws for a dedicated event and names its transport', async () => {
    const p = createPublisher('svc');
    await p.initEventPublisher();
    await expect(p.publishEvent('match_completed', {})).rejects.toThrow('Event match_completed has a dedicated transport: karmyq-completion-dispatch');
  });

  it('throws for an unclassified event', async () => {
    const p = createPublisher('svc');
    await p.initEventPublisher();
    await expect(p.publishEvent('not_a_real_event', {})).rejects.toThrow('Event not_a_real_event is not classified in packages/shared/events/routes.ts');
  });
});
