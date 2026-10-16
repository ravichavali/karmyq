/**
 * Sprint 133 PR Q code review: node-cron schedules are registered at module load, so a dibs or reminder
 * job can fire before startServer initializes the publisher. cleanup's publishEvent must initialize on
 * first use, once. The fake keeps the real contract: publishEvent throws until initEventPublisher ran.
 * Plain functions and counters, not jest.fn: the root config's resetMocks wipes factory implementations.
 */
const mockState = { inits: 0, published: [] as Array<[string, unknown]> };
jest.mock('@karmyq/shared', () => ({
  createPublisher: () => {
    let ready = false;
    return {
      initEventPublisher: async () => { mockState.inits++; ready = true; },
      publishEvent: async (type: string, payload: unknown) => {
        if (!ready) throw new Error('Event queue not initialized');
        mockState.published.push([type, payload]);
        return null;
      },
    };
  },
}));
import { publishEvent } from '../../src/events/publisher';

it('publishes before startServer has run, initializing exactly once', async () => {
  await publishEvent('dibs_expired', { dibs_id: 'd1' });
  await publishEvent('match_reminder', { match_id: 'm1' });
  expect(mockState.published).toEqual([['dibs_expired', { dibs_id: 'd1' }], ['match_reminder', { match_id: 'm1' }]]);
  expect(mockState.inits).toBe(1);
});
