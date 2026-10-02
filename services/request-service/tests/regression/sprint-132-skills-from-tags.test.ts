const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: { query: (...args: unknown[]) => mockQuery(...args), connect: jest.fn() },
  query: (...args: unknown[]) => mockQuery(...args),
  withTransaction: (fn: any) => fn((...args: unknown[]) => mockQuery(...args)),
}));
jest.mock('../../src/events/publisher', () => ({ publishEvent: jest.fn() }));

import * as requestsModule from '../../src/routes/requests';

describe('Sprint 132 matching profile skills', () => {
  beforeEach(() => {
    // The root Jest config uses resetMocks:true, so install the DB implementation in beforeEach.
    mockQuery.mockReset();
    mockQuery.mockImplementation(async (sql: string) => {
      if (/FROM auth\.users/i.test(sql)) {
        return { rows: [{ id: 'member-1', name: 'Member' }], rowCount: 1 };
      }
      return {
        rows: [{ skill: 'carpentry' }, { skill: 'underwater_basket' }],
        rowCount: 2,
      };
    });
  });

  it('reads only skill tags and returns the exact resolved/fallback skill array', async () => {
    const getUserProfile = (requestsModule as any).getUserProfile;
    expect(typeof getUserProfile).toBe('function');

    const profile = await getUserProfile('member-1');
    expect(profile.skills).toEqual(['carpentry', 'underwater_basket']);

    const sql = mockQuery.mock.calls.map(([statement]) => String(statement));
    expect(sql).toHaveLength(2);
    expect(sql[1]).toMatch(/FROM auth\.user_tags/i);
    expect(sql[1]).toMatch(/tag_type\s*=\s*'skill'/i);
    expect(sql.join('\n')).not.toMatch(/auth\.user_skills/i);
    expect(mockQuery.mock.calls[1][1]).toEqual(['member-1']);
  });
});
