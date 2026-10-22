/**
 * Sprint 134 PR L (ADR-101): social-graph-service attaches only to its dedicated queues. The legacy shared
 * `karmyq-events` match_completed handler is gone; completion arrives on karmyq-completion-social-graph.
 */
const mockQueues: Record<string, string[]> = {};
// A plain constructor, not jest.fn(impl): a resetMocks config would wipe the implementation.
jest.mock('bull', () => function MockBull(name: string) {
  mockQueues[name] ??= [];
  return { process: (type: unknown) => { if (typeof type === 'string') mockQueues[name].push(type); }, on: () => undefined };
});
jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));
import { initEventSubscriber } from '../../src/events/subscriber';

it('opens only the completion and endorsement queues, each with its one event', async () => {
  await initEventSubscriber();
  expect(mockQueues).toEqual({
    'karmyq-completion-social-graph': ['match_completed'],
    'karmyq-skill-endorsement-social-graph': ['skill_endorsement_changed'],
  });
});
