/**
 * Sprint 134 BUG-077: every badge insert supplies reputation.badges.name, which is NOT NULL. The table predates
 * migration 024, whose CREATE TABLE IF NOT EXISTS never ran (init.sql `CREATE TABLE reputation.badges`). A conflict
 * that inserts nothing is not reported as awarded.
 *
 * The SQL here is mocked; the real table is exercised by the root
 * tests/integration/sprint-134-bug-077-completion-side-effects.integration.test.ts (CI-only on Windows).
 */
const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...a: unknown[]) => mockQuery(...a) }));

import { BADGE_TYPES, checkAndAwardBadges } from '../../src/services/badgeService';

const INSERT = 'INSERT INTO reputation.badges (user_id, badge_type, name) VALUES ($1, $2, $3) ON CONFLICT (user_id, badge_type) DO NOTHING';

function db(opts: { completed: number; distinct: number; existing?: string[]; rowCount?: (badgeType: string) => number }) {
  mockQuery.mockImplementation(async (sql: string, params: unknown[]) => {
    if (sql.includes('completed_as_helper')) {
      return { rows: [{ completed_as_helper: String(opts.completed), distinct_people_helped: String(opts.distinct) }] };
    }
    if (sql.includes('FROM reputation.badges')) return { rows: (opts.existing ?? []).map((badge_type) => ({ badge_type })) };
    if (sql.includes('INSERT INTO reputation.badges')) return { rows: [], rowCount: opts.rowCount ? opts.rowCount(params[1] as string) : 1 };
    throw new Error(`unexpected query: ${sql}`);
  });
}

const inserts = () => mockQuery.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO reputation.badges'));

describe('BUG-077 badge insert', () => {
  it('inserts every newly earned badge type with its display name', async () => {
    db({ completed: 100, distinct: 10 });

    expect(await checkAndAwardBadges('u1')).toEqual([...BADGE_TYPES]);

    for (const [sql] of inserts()) expect(String(sql).replace(/\s+/g, ' ').trim()).toBe(INSERT);
    expect(inserts().map(([, params]) => params)).toEqual([
      ['u1', 'first_helper', 'First help given'],
      ['u1', 'milestone_10', 'Helped 10 times'],
      ['u1', 'milestone_50', 'Helped 50 times'],
      ['u1', 'milestone_100', 'Helped 100 times'],
      ['u1', 'connector', 'Helped 10 different people'],
    ]);
  });

  it('does not report a badge whose insert the unique key absorbed', async () => {
    db({ completed: 1, distinct: 1, rowCount: () => 0 });

    expect(await checkAndAwardBadges('u1')).toEqual([]);
    expect(inserts()).toHaveLength(1);
  });

  it('reports only the badges it inserted', async () => {
    db({ completed: 10, distinct: 2, rowCount: (badgeType) => (badgeType === 'first_helper' ? 0 : 1) });

    expect(await checkAndAwardBadges('u1')).toEqual(['milestone_10']);
  });
});
