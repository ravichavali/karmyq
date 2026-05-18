import { createPublisher } from '../../../events/publisher';

// Mock bull so tests don't require Redis
jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    add: jest.fn().mockResolvedValue(undefined),
  }));
});

describe('createPublisher', () => {
  it('returns an object with initEventPublisher, publishEvent, and getEventQueue', () => {
    const publisher = createPublisher('test-service');
    expect(typeof publisher.initEventPublisher).toBe('function');
    expect(typeof publisher.publishEvent).toBe('function');
    expect(typeof publisher.getEventQueue).toBe('function');
  });

  it('getEventQueue returns undefined before initialization', () => {
    const publisher = createPublisher('test-service');
    expect(publisher.getEventQueue()).toBeUndefined();
  });

  it('publishEvent throws if queue is not initialized', async () => {
    const publisher = createPublisher('test-service');
    await expect(publisher.publishEvent('test_event', {})).rejects.toThrow(
      'Event queue not initialized'
    );
  });

  it('creates separate queues for different sources', () => {
    const publisher1 = createPublisher('service-a');
    const publisher2 = createPublisher('service-b');
    expect(publisher1).not.toBe(publisher2);
  });
});
