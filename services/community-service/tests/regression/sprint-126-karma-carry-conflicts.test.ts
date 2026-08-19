/**
 * Sprint 126 — fusion/fission karma carry must be conflict-safe BEFORE the unique projection
 * indexes land.
 *
 * Both carry writers copy `reputation.karma_records` rows into a new community with a bare
 * `INSERT ... SELECT`. Once `uq_karma_match_projection` exists, two origin communities holding the
 * same `(user_id, reason, related_entity_id)` projection identity make that copy raise a
 * unique_violation and abort the whole fusion/split transaction.
 *
 * What this file proves: both services EMIT `ON CONFLICT DO NOTHING` on the karma copy, and emit it
 * on every karma copy they issue. What it deliberately does NOT prove is that PostgreSQL then
 * collapses the duplicate — a mocked pool asserts its own mock, never a database constraint. That
 * half is proved against real Postgres in
 * `tests/integration/sprint-126-standing-schema.integration.test.ts`.
 */
import { executeFusion } from '../../src/services/fusionService';
import { executeSplit } from '../../src/services/fissionService';

interface Call {
  sql: string;
  params: any[];
}

const KARMA_CARRY = /INSERT INTO reputation\.karma_records/i;
const CONFLICT_SAFE = /ON CONFLICT\s+DO NOTHING/i;

function karmaCarryCalls(calls: Call[]): Call[] {
  return calls.filter((c) => KARMA_CARRY.test(c.sql));
}

function makeFusionPool(calls: Call[]) {
  const client = {
    query: jest.fn(async (sql: string, params: any[] = []) => {
      calls.push({ sql, params });
      if (/SELECT \* FROM communities\.fusion_proposals/i.test(sql)) {
        return {
          rows: [
            {
              id: 'fusion-1',
              status: 'approved',
              community_a_id: 'comm-a',
              community_b_id: 'comm-b',
              merged_community_name: 'Merged',
            },
          ],
        };
      }
      if (/SELECT description, location/i.test(sql)) {
        return {
          rows: [
            {
              description: 'd',
              location: 'l',
              category: 'c',
              community_type: 'mutual_aid',
              access_type: 'public',
            },
          ],
        };
      }
      if (/INSERT INTO communities\.communities/i.test(sql)) {
        return { rows: [{ id: 'merged-1' }] };
      }
      if (/SELECT DISTINCT user_id FROM communities\.members/i.test(sql)) {
        return { rows: [{ user_id: 'u1' }, { user_id: 'u2' }] };
      }
      return { rows: [] };
    }),
    release: jest.fn(),
  };
  return { connect: jest.fn(async () => client) } as any;
}

function makeSplitPool(calls: Call[]) {
  let childInsertCount = 0;
  const client = {
    query: jest.fn(async (sql: string, params: any[] = []) => {
      calls.push({ sql, params });
      if (/SELECT \* FROM communities\.split_proposals/i.test(sql)) {
        return {
          rows: [
            {
              id: 'prop-1',
              status: 'approved',
              community_id: 'parent-1',
              group_a_name: 'A',
              group_b_name: 'B',
            },
          ],
        };
      }
      if (/SELECT id FROM communities\.members/i.test(sql)) {
        return { rows: [{ id: 'm-admin' }] };
      }
      if (/SELECT name, description, location/i.test(sql)) {
        return {
          rows: [
            {
              name: 'Parent',
              description: 'd',
              location: 'l',
              category: 'c',
              community_type: 'mutual_aid',
              access_type: 'public',
            },
          ],
        };
      }
      if (/SELECT user_id, assigned_to FROM communities\.split_member_assignments/i.test(sql)) {
        return {
          rows: [
            { user_id: 'u1', assigned_to: 'group_a' },
            { user_id: 'u2', assigned_to: 'group_b' },
          ],
        };
      }
      if (/INSERT INTO communities\.communities/i.test(sql)) {
        childInsertCount += 1;
        return { rows: [{ id: childInsertCount === 1 ? 'child-a' : 'child-b' }] };
      }
      return { rows: [] };
    }),
    release: jest.fn(),
  };
  return { connect: jest.fn(async () => client) } as any;
}

describe('Sprint 126 — conflict-safe karma carry', () => {
  it('executeFusion splits the carry and guards the identity-bearing half', async () => {
    const calls: Call[] = [];
    await executeFusion('fusion-1', 'admin-1', makeFusionPool(calls));

    const carries = karmaCarryCalls(calls);
    expect(carries).toHaveLength(2);

    const identity = carries.find((c) => /related_entity_id IS NOT NULL/i.test(c.sql));
    const unidentified = carries.find((c) => /related_entity_id IS NULL/i.test(c.sql));
    expect(identity).toBeDefined();
    expect(unidentified).toBeDefined();

    // The identity-bearing half must SUM, not discard: one match can have awarded this user in
    // both origin communities, and those collapse onto a single identity in the merged community.
    expect(identity!.sql).toMatch(/SUM\(points\)/i);
    expect(identity!.sql).toMatch(/GROUP BY user_id, reason, related_entity_id/i);
    expect(identity!.sql).toMatch(CONFLICT_SAFE);

    // The unconstrained half must NOT aggregate — distinct manual adjustments sharing a reason are
    // legitimately separate rows.
    expect(unidentified!.sql).not.toMatch(/SUM\(points\)/i);
    expect(unidentified!.sql).not.toMatch(/GROUP BY/i);
  });

  it('executeSplit copies karma into every child with ON CONFLICT DO NOTHING', async () => {
    const calls: Call[] = [];
    await executeSplit('prop-1', 'admin-1', makeSplitPool(calls));

    const carries = karmaCarryCalls(calls);
    // One carry per child community; both must be conflict-safe, not just the first.
    expect(carries).toHaveLength(2);
    for (const carry of carries) {
      expect(carry.sql).toMatch(CONFLICT_SAFE);
    }
  });

  it('leaves no identity-bearing karma carry unguarded in either service', async () => {
    const fusionCalls: Call[] = [];
    const splitCalls: Call[] = [];
    await executeFusion('fusion-1', 'admin-1', makeFusionPool(fusionCalls));
    await executeSplit('prop-1', 'admin-1', makeSplitPool(splitCalls));

    // Only statements that can carry a projection identity need the guard. The fusion statement
    // restricted to `related_entity_id IS NULL` touches rows the unique index does not constrain,
    // so it is correctly unguarded — asserting otherwise would demand a meaningless clause.
    const unguarded = karmaCarryCalls([...fusionCalls, ...splitCalls])
      .filter((c) => !/related_entity_id IS NULL/i.test(c.sql))
      .filter((c) => !CONFLICT_SAFE.test(c.sql));
    expect(unguarded).toEqual([]);
  });

  it('does not weaken the carry into a no-op or change its target columns', async () => {
    const calls: Call[] = [];
    await executeFusion('fusion-1', 'admin-1', makeFusionPool(calls));

    // Points and the original timestamp must still be carried — a conflict guard must not become
    // an excuse to drop columns or rewrite created_at to NOW().
    for (const carry of karmaCarryCalls(calls)) {
      expect(carry.sql).toMatch(
        /\(user_id, community_id, points, reason, related_entity_id, created_at\)/i
      );
      expect(carry.sql).not.toMatch(/NOW\(\)/i);
      expect(carry.sql).not.toMatch(/CURRENT_TIMESTAMP/i);
    }
  });

  it('carries both origin communities in every fusion statement', async () => {
    const calls: Call[] = [];
    await executeFusion('fusion-1', 'admin-1', makeFusionPool(calls));

    // A split carry must not accidentally drop one origin community from either half.
    for (const carry of karmaCarryCalls(calls)) {
      expect(carry.params[0]).toBe('merged-1');
      expect(carry.params[1]).toEqual(['comm-a', 'comm-b']);
    }
  });
});
