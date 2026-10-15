/**
 * Sprint 133 PR Q (ADR-101, BUG-060): cleanup-service publishes dibs_expired and match_reminder
 * through the shared router instead of writing straight to the shared karmyq-events queue.
 * The root config's resetMocks wipes factory implementations, so every implementation is set in-test.
 */
const mockPublish = jest.fn();
const mockPoolQuery = jest.fn();
const mockClientQuery = jest.fn();
jest.mock('../../src/events/publisher', () => ({ publishEvent: (...a: unknown[]) => mockPublish(...a) }));
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: { query: (...a: unknown[]) => mockPoolQuery(...a), connect: async () => ({ query: (...a: unknown[]) => mockClientQuery(...a), release: () => undefined }) },
  query: (...a: unknown[]) => mockPoolQuery(...a),
}));
jest.mock('../../src/utils/logger', () => ({ logger: { info: () => undefined, error: () => undefined, debug: () => undefined, warn: () => undefined } }));
jest.mock('bull', () => { throw new Error('cleanup-service must not construct a Bull queue directly (ADR-101)'); });
import { expireDibs } from '../../src/jobs/expireDibs';
import { sendMatchReminders } from '../../src/jobs/matchReminderJob';

it('expireDibs publishes dibs_expired through the router after commit', async () => {
  mockPoolQuery.mockResolvedValue({ rows: [{ id: 'd1', request_id: 'r1', provider_user_id: 'p1' }] });
  mockClientQuery.mockResolvedValue({ rows: [] });
  mockPublish.mockResolvedValue({ id: 'job' });
  await expect(expireDibs()).resolves.toBe(1);
  expect(mockPublish).toHaveBeenCalledTimes(1);
  expect(mockPublish).toHaveBeenCalledWith('dibs_expired', { dibs_id: 'd1', request_id: 'r1', provider_user_id: 'p1' });
  const commitOrder = mockClientQuery.mock.invocationCallOrder[mockClientQuery.mock.calls.findIndex(([sql]) => sql === 'COMMIT')];
  expect(commitOrder).toBeLessThan(mockPublish.mock.invocationCallOrder[0]);
});

it('sendMatchReminders publishes match_reminder through the router', async () => {
  const at = new Date('2026-10-15T10:00:00Z');
  mockPoolQuery.mockResolvedValue({ rows: [{ id: 'm1', responder_id: 'h', requester_id: 'q', scheduled_at: at, travel_time_minutes: 10, title: 'T', request_type: 'ride', payload: { a: 1 } }] });
  mockPublish.mockResolvedValue({ id: 'job' });
  await sendMatchReminders();
  expect(mockPublish).toHaveBeenCalledWith('match_reminder', {
    match_id: 'm1', responder_id: 'h', requester_id: 'q', request_title: 'T', request_type: 'ride',
    scheduled_at: at, travel_time_minutes: 10, payload: { a: 1 },
  });
});
