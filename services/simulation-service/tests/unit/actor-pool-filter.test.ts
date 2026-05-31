/**
 * Sprint 77 — the simulation actor pool must never include the e2e/integration
 * fixture accounts (@karmyq.test). Sending sim workflows to those accounts would
 * corrupt their state and flake the test suite.
 */

// Capture the query mock so we can inspect the SQL the loader issues.
const mockQuery = jest.fn();
jest.mock('pg', () => ({
  __esModule: true,
  Pool: class {
    query = mockQuery;
    end = jest.fn();
  },
}));

import {
  SIM_ACTOR_POOL_FILTER,
  initPool,
  getRandomUser,
  getUserCount,
} from '../../src/db-user-loader';

describe('Sprint 77 — simulation actor pool filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    initPool('postgres://ignored', 'secret');
  });

  it('the filter constant excludes @karmyq.test and includes only @test.karmyq.com', () => {
    expect(SIM_ACTOR_POOL_FILTER).toContain("email LIKE '%@test.karmyq.com'");
    expect(SIM_ACTOR_POOL_FILTER).toContain("email NOT LIKE '%@karmyq.test'");
  });

  it('getRandomUser queries with the e2e-excluding filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'a@test.karmyq.com', name: 'A' }] });
    await getRandomUser();
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("email NOT LIKE '%@karmyq.test'");
    expect(sql).toContain("email LIKE '%@test.karmyq.com'");
  });

  it('getUserCount counts with the e2e-excluding filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '42' }] });
    const n = await getUserCount();
    expect(n).toBe(42);
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("email NOT LIKE '%@karmyq.test'");
  });
});
