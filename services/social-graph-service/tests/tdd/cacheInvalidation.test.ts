/**
 * TDD tests for trust path cache invalidation
 *
 * When a match completes, cached trust paths between the requester
 * and responder become stale (they now have a direct edge).
 * Cache entries for those two users must be cleared.
 */

jest.mock('../../src/config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

const { pool } = require('../../src/config/database');
import { clearTrustPathCache } from '../../src/services/pathComputation';

describe('clearTrustPathCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockResolvedValue({ rowCount: 0 });
  });

  it('deletes cached paths where user A is involved in either direction', async () => {
    await clearTrustPathCache('user-requester', 'user-responder');

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM auth.social_distances'),
      expect.arrayContaining(['user-requester', 'user-responder'])
    );
  });

  it('clears cache in both directions (A→B and B→A)', async () => {
    await clearTrustPathCache('user-a', 'user-b');

    const sql = pool.query.mock.calls[0][0] as string;
    // Must delete entries where user_a_id = A, user_b_id = B AND vice versa
    expect(sql).toMatch(/user_a_id.*user_b_id|user_b_id.*user_a_id/s);
  });
});
