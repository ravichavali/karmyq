/**
 * Sprint 136 (BUG-083): a completed ask's content is forgotten a window after it COMPLETED, not after it was last edited.
 * Completion never stamps help_requests.updated_at, so aging from updated_at alone forgot an old ask the run after it
 * completed. The completed branch now ages from its newest completed match's completed_at, falling back to updated_at
 * for a completed ask with no stamped completion.
 *
 * Shape only: a mocked query cannot prove the SQL's semantics. The real-row proof (aged ask completed yesterday is kept;
 * MAX, not MIN; the fallback) is in the root tests/integration/sprint-136-request-followups.integration.test.ts.
 */
import { forgetExchangeContent } from '../../src/jobs/memoryRetentionJob';

jest.mock('../../src/database/db', () => ({ query: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

import { query } from '../../src/database/db';
const mockQuery = query as jest.MockedFunction<typeof query>;
const flat = (sql: string) => sql.replace(/\s+/g, ' ').trim();
const issued = () => mockQuery.mock.calls.map((c) => flat(c[0] as string));
const completedBranch = () => issued().find((s) => s.includes('forgotten_requests AS'))!;
const expiredBranch = () => issued().find((s) => s.startsWith('DELETE FROM requests.help_requests'))!;

const COMPLETION_CLOCK =
  "COALESCE((SELECT MAX(m.completed_at) FROM requests.matches m WHERE m.request_id = h.id AND m.status = 'completed'), h.updated_at)";

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
});

describe('BUG-083: the completed branch ages from the completion', () => {
  it('compares the newest completed match, falling back to updated_at, against the window', async () => {
    await forgetExchangeContent();
    expect(completedBranch()).toContain(`AND ${COMPLETION_CLOCK} < NOW() - make_interval(days => rw.window_days::int)`);
  });

  it('no longer ages a completed ask from updated_at alone', async () => {
    await forgetExchangeContent();
    expect(completedBranch()).not.toContain('AND h.updated_at < NOW()');
  });

  it('leaves the expired/unmatched branch aging from updated_at', async () => {
    await forgetExchangeContent();
    expect(expiredBranch()).toContain('h.updated_at < NOW() - make_interval(days => ew.window_days::int)');
  });
});
