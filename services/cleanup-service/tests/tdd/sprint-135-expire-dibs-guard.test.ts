/**
 * Sprint 135: the dibs expiry job expires only a dibs that is still pending. Between the job's SELECT and its UPDATE a
 * provider can accept (or decline) the dibs; overwriting that with 'expired' would leave an expired dibs beside a live
 * exchange and notify the provider that an invitation they accepted had expired.
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
import { expireDibs } from '../../src/jobs/expireDibs';

const flat = (sql: unknown) => String(sql).replace(/\s+/g, ' ').trim();
const GUARDED = "UPDATE requests.dibs SET status = 'expired', updated_at = NOW() WHERE id = $1 AND status = 'pending'";

beforeEach(() => {
  mockPoolQuery.mockResolvedValue({ rows: [{ id: 'd1', request_id: 'r1', provider_user_id: 'p1' }] });
  mockPublish.mockResolvedValue({ id: 'job' });
});

it('expires the dibs only while it is still pending', async () => {
  mockClientQuery.mockResolvedValue({ rowCount: 1, rows: [] });
  await expect(expireDibs()).resolves.toBe(1);
  expect(mockClientQuery.mock.calls.map(([sql]) => flat(sql))).toContain(GUARDED);
  expect(mockPublish).toHaveBeenCalledTimes(1);
});

it('leaves a dibs the provider settled first alone: no request write, no event, rolled back', async () => {
  mockClientQuery.mockImplementation(async (sql: unknown) =>
    (flat(sql) === GUARDED ? { rowCount: 0, rows: [] } : { rowCount: 1, rows: [] }));
  await expect(expireDibs()).resolves.toBe(0);
  const sqls = mockClientQuery.mock.calls.map(([sql]) => flat(sql));
  expect(sqls.filter((s) => /help_requests/.test(s))).toEqual([]);
  expect(sqls).toContain('ROLLBACK');
  expect(sqls).not.toContain('COMMIT');
  expect(mockPublish).not.toHaveBeenCalled();
});
